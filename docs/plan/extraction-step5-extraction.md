# Step 5: 추출 + crop + 재추출 + 재분석 — 상세 구현 계획 ✅

> **상태**: ✅ 구현 완료 (2026-03-20, 5개 파일, 35 테스트, IDOR 수정 + crop 캐싱 적용)
> **소유 역할**: backend-actions
> **의존성**: Step 1 (스키마), Step 3 (AI 타입+프롬프트+GeminiProvider), Step 4 (시험 생성 Action)
> **Wave**: 3 (Step 1+3+4 완료 후)

---

## 파일 목록 (5개)

| # | 파일 | 유형 | 설명 |
|---|------|------|------|
| 1 | `src/lib/actions/extract-questions.ts` | 신규 | 추출 + 재추출 + 재분석 Server Action |
| 2 | `src/lib/validations/extract-questions.ts` | 신규 | Zod 스키마 3개 |
| 3 | `src/lib/actions/__tests__/extract-questions.test.ts` | 신규 | 추출 + 재추출 테스트 |
| 4 | `src/lib/actions/__tests__/reanalyze-question.test.ts` | 신규 (v9) | 재분석 전용 테스트 — mock 충돌 방지 + 파일 크기 관리 |
| 5 | `src/lib/validations/__tests__/extract-questions.test.ts` | 신규 | Zod 스키마 테스트 |

---

## 새 의존성

- **sharp** — `package.json` dependencies에 추가 필수 (Wave 3 시작 전 리드가 추가)
- **`export const runtime = 'nodejs'`** — sharp는 Edge Runtime 불가, extract-questions.ts 파일 상단에 명시
- **`export const maxDuration = 60`** — Vercel Pro 플랜 기준. Hobby 플랜은 10초 한도이므로 배포 환경 확인 필수

---

## Task 5.1: Zod 스키마 (`extract-questions.ts` validation)

파일: `src/lib/validations/extract-questions.ts`

### 스키마 3개

```typescript
// 1. extractQuestionsSchema — pastExamId 검증
const extractQuestionsSchema = z.object({
  pastExamId: z.string().min(1, '시험 ID가 필요합니다'),
})

// 2. resetExtractionSchema — pastExamId 검증
const resetExtractionSchema = z.object({
  pastExamId: z.string().min(1, '시험 ID가 필요합니다'),
})

// 3. reanalyzeQuestionSchema — detailId + 선택적 feedback
const reanalyzeQuestionSchema = z.object({
  detailId: z.string().min(1, '문제 ID가 필요합니다'),
  feedback: z.string().max(500).optional(),
})
```

> `.min(1)` 사용 (`.uuid()` 아님) — 시드 데이터의 비표준 UUID 호환 (MEMORY.md 교훈)

---

## Task 5.2: `extractQuestionsAction` 상세 의사코드

파일: `src/lib/actions/extract-questions.ts`

```typescript
export const runtime = 'nodejs'   // sharp 필수
export const maxDuration = 60     // Vercel Pro 기준

export async function extractQuestionsAction(
  pastExamId: string
): Promise<{ error?: string }> {

  // 1. 인증 + 권한 확인
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  // teacher/admin/system_admin만 허용

  // 2. Zod 검증
  const parsed = extractQuestionsSchema.safeParse({ pastExamId })

  // 3. ⚠️ Optimistic Lock
  //    UPDATE past_exams
  //    SET extraction_status = 'processing'
  //    WHERE id = pastExamId AND extraction_status IN ('pending', 'failed')
  //    .select('id')
  //    → 빈 배열이면 return { error: '이미 처리 중입니다.' }
  const { data: locked } = await supabase
    .from('past_exams')
    .update({ extraction_status: 'processing' })
    .eq('id', pastExamId)
    .in('extraction_status', ['pending', 'failed'])
    .select('id')
  if (!locked || locked.length === 0) {
    return { error: '이미 처리 중입니다.' }
  }

  // 4. 기존 details DELETE 방어 (INSERT 성공 + UPDATE 실패 부분 성공 대응)
  //    재추출 시 기존 details가 남아있을 수 있으므로 먼저 삭제
  await supabase
    .from('past_exam_details')
    .delete()
    .eq('past_exam_id', pastExamId)

  // 5. isCompleted + try/finally
  let isCompleted = false
  try {
    // 5a. past_exam_images 조회 (page_number ASC)
    const { data: images } = await supabase
      .from('past_exam_images')
      .select('id, source_image_url, page_number')
      .eq('past_exam_id', pastExamId)
      .order('page_number', { ascending: true })

    // 5b. ⚠️ 이미지별 직렬 base64 변환 (메모리 방어)
    const imageParts: ImagePart[] = []
    for (const image of images) {
      const { data: signedUrlData } = await supabase.storage
        .from('past-exams')
        .createSignedUrl(image.source_image_url, 300)
      const response = await fetch(signedUrlData.signedUrl)
      const buffer = await response.arrayBuffer()
      const mimeType = /* response.headers content-type 또는 확장자 기반 */
      imageParts.push({
        mimeType,
        data: Buffer.from(buffer).toString('base64'),
      })
    }

    // 5c. AI Provider.extractQuestions 호출 — imageParts 직접 전달
    const aiResult = await aiProvider.extractQuestions({
      imageParts,
      subject: pastExam.subject,
      grade: pastExam.grade,
      examType: pastExam.exam_type,
    })

    // 5d. 그래프 crop 처리 (R9)
    //     ⚠️ detailId를 DB INSERT 전에 사전 생성 (crypto.randomUUID())
    //     → crop Storage 경로에 detailId가 필요하므로 INSERT 전에 미리 할당
    //     figures 배열이 있는 문제에 대해:
    for (const question of aiResult.questions) {
      const detailId = crypto.randomUUID()  // ⚠️ 사전 생성 — INSERT 시 이 ID 사용
      if (question.hasFigure && question.figures) {
        for (let i = 0; i < question.figures.length; i++) {
          const figure = question.figures[i]
          try {
            // pageNumber로 원본 이미지 선택
            const sourceImage = images.find(
              img => img.page_number === figure.pageNumber
            )
            // Signed URL → fetch → Buffer
            const imgBuffer = await fetchImageBuffer(sourceImage)

            // ⚠️ normalized→pixel 변환 공식
            //   sharp(imgBuffer).metadata() → { width, height }
            //   pixelX = Math.round(figure.boundingBox.x * width)
            //   pixelY = Math.round(figure.boundingBox.y * height)
            //   pixelW = Math.round(figure.boundingBox.width * width)
            //   pixelH = Math.round(figure.boundingBox.height * height)
            //
            //   클램핑: 이미지 경계를 넘지 않도록 보정
            //   pixelX = Math.max(0, Math.min(pixelX, width - 1))
            //   pixelY = Math.max(0, Math.min(pixelY, height - 1))
            //   pixelW = Math.min(pixelW, width - pixelX)
            //   pixelH = Math.min(pixelH, height - pixelY)
            //   if (pixelW <= 0 || pixelH <= 0) throw new Error('Invalid crop')

            const metadata = await sharp(imgBuffer).metadata()
            const { width, height } = metadata
            let px = Math.round(figure.boundingBox.x * width!)
            let py = Math.round(figure.boundingBox.y * height!)
            let pw = Math.round(figure.boundingBox.width * width!)
            let ph = Math.round(figure.boundingBox.height * height!)
            // 클램핑
            px = Math.max(0, Math.min(px, width! - 1))
            py = Math.max(0, Math.min(py, height! - 1))
            pw = Math.min(pw, width! - px)
            ph = Math.min(ph, height! - py)
            if (pw <= 0 || ph <= 0) throw new Error('Invalid crop dimensions')

            const croppedBuffer = await sharp(imgBuffer)
              .extract({ left: px, top: py, width: pw, height: ph })
              .jpeg({ quality: 85 })
              .toBuffer()

            // Storage 업로드 (createAdminClient)
            // ⚠️ detailId는 루프 상단에서 crypto.randomUUID()로 사전 생성됨 (DB INSERT 전)
            const storagePath =
              `${academyId}/${pastExamId}/figures/${detailId}-${i}.jpg`
            const adminClient = createAdminClient()
            await adminClient.storage
              .from('past-exams')
              .upload(storagePath, croppedBuffer, { contentType: 'image/jpeg' })

            figure.url = storagePath
          } catch {
            // ⚠️ crop 개별 실패 시 figure.url = null (부분 성공 허용)
            figure.url = null
          }
        }
      }
    }

    // 5e. past_exam_details INSERT (문제별 1행)
    const details = aiResult.questions.map(q => ({
      past_exam_id: pastExamId,
      academy_id: academyId,
      question_number: q.questionNumber,
      question_text: q.questionText,
      question_type: q.questionType,
      options: q.options ?? null,
      answer: q.answer ?? null,
      has_figure: q.hasFigure,
      figures: q.figures ?? null,
      confidence: q.confidence,
      is_confirmed: false,
    }))
    await supabase.from('past_exam_details').insert(details)

    // 5f. raw_ai_response 백업 + extraction_status = 'completed'
    await supabase
      .from('past_exams')
      .update({
        extraction_status: 'completed',
        raw_ai_response: JSON.stringify(aiResult),
      })
      .eq('id', pastExamId)

    isCompleted = true
  } finally {
    // ⚠️ 실패 시 extraction_status = 'failed' 롤백 보장
    if (!isCompleted) {
      await supabase
        .from('past_exams')
        .update({ extraction_status: 'failed' })
        .eq('id', pastExamId)
    }
  }

  return {}
}
```

### 내부 함수: `buildImageParts` (추출 + 재분석 공유)

```typescript
/**
 * 시험의 모든 이미지를 직렬로 base64 변환하여 ImagePart 배열 반환
 * extractQuestionsAction과 reanalyzeQuestionAction에서 공유
 */
async function buildImageParts(
  supabase: SupabaseClient,
  pastExamId: string
): Promise<readonly ImagePart[]> {
  const { data: images } = await supabase
    .from('past_exam_images')
    .select('source_image_url')
    .eq('past_exam_id', pastExamId)
    .order('page_number', { ascending: true })

  const parts: ImagePart[] = []
  for (const image of images ?? []) {
    const { data: signedUrlData } = await supabase.storage
      .from('past-exams')
      .createSignedUrl(image.source_image_url, 300)
    const response = await fetch(signedUrlData!.signedUrl)
    const buffer = await response.arrayBuffer()
    const mimeType = response.headers.get('content-type') ?? 'image/jpeg'
    parts.push({
      mimeType,
      data: Buffer.from(buffer).toString('base64'),
    })
  }
  return parts
}
```

---

## Task 5.3: `resetExtractionAction` 상세 의사코드

```typescript
export async function resetExtractionAction(
  pastExamId: string
): Promise<{ error?: string }> {

  // 1. 인증 + 권한
  // 2. Zod 검증

  // 3. 기존 past_exam_details 조회 → figures[].url 목록 수집
  const { data: existingDetails } = await supabase
    .from('past_exam_details')
    .select('figures')
    .eq('past_exam_id', pastExamId)

  // 4. Storage orphan cleanup (Non-blocking — v9)
  //    삭제 실패 시 무시하고 계속 진행
  //    orphan 파일은 Phase 2 cleanup job으로 처리
  //    이유: 재추출 흐름을 Storage 오류로 중단하지 않음 (사용자 경험 우선)
  const figurePaths: string[] = []
  for (const detail of existingDetails ?? []) {
    if (detail.figures && Array.isArray(detail.figures)) {
      for (const fig of detail.figures) {
        if (fig.url) figurePaths.push(fig.url)
      }
    }
  }
  if (figurePaths.length > 0) {
    try {
      const adminClient = createAdminClient()
      await adminClient.storage.from('past-exams').remove(figurePaths)
    } catch {
      // Non-blocking: Storage 삭제 실패 무시
    }
  }

  // 5. past_exam_details DELETE
  await supabase
    .from('past_exam_details')
    .delete()
    .eq('past_exam_id', pastExamId)

  // 6. extraction_status = 'pending'
  await supabase
    .from('past_exams')
    .update({ extraction_status: 'pending' })
    .eq('id', pastExamId)

  return {}
}
```

---

## Task 5.4: `reanalyzeQuestionAction` 상세 의사코드

```typescript
// maxDuration = 60 적용 (전체 이미지 전달로 대기시간 수십 초 가능)

export async function reanalyzeQuestionAction(
  detailId: string,
  feedback?: string
): Promise<{ error?: string }> {

  // 1. 인증 + 권한
  // 2. Zod 검증

  // 3. 해당 detail + 시험 정보 조회
  const { data: detail } = await supabase
    .from('past_exam_details')
    .select('*, past_exams(id, subject, grade, exam_type)')
    .eq('id', detailId)
    .single()

  // 4. 전체 이미지 → 직렬 base64 변환 (buildImageParts 재사용)
  //    ⚠️ 전체 이미지를 전달하는 이유 (v9 Tech CONSIDER 3):
  //    - 페이지 경계를 넘는 문제 가능성
  //    - AI 컨텍스트 일관성 보장
  //    - 특정 페이지만 전달하면 앞뒤 맥락 부족으로 정확도 저하 우려
  const imageParts = await buildImageParts(supabase, detail.past_exams.id)

  // 5. AI Provider.reanalyzeQuestion 호출
  const currentQuestion: ExtractedQuestion = {
    questionNumber: detail.question_number,
    questionText: detail.question_text,
    questionType: detail.question_type,
    options: detail.options,
    answer: detail.answer,
    confidence: detail.confidence,
    hasFigure: detail.has_figure,
    figures: detail.figures,
  }

  const result = await aiProvider.reanalyzeQuestion({
    imageParts,
    questionNumber: detail.question_number,
    currentQuestion,
    userFeedback: feedback,
    subject: detail.past_exams.subject,
    grade: detail.past_exams.grade,
  })

  // 6. 해당 detail만 UPDATE
  await supabase
    .from('past_exam_details')
    .update({
      question_text: result.questionText,
      question_type: result.questionType,
      options: result.options ?? null,
      answer: result.answer ?? null,
      confidence: result.confidence,
      has_figure: result.hasFigure,
      figures: result.figures ?? null,
    })
    .eq('id', detailId)

  return {}
}
```

---

## Task 5.5: 테스트 케이스 목록

### 파일 1: `extract-questions.test.ts`

| # | 테스트 케이스 | 유형 |
|---|--------------|------|
| 1 | 인증되지 않은 사용자 → error 반환 | 권한 |
| 2 | student 역할 → error 반환 | 권한 |
| 3 | 유효한 pastExamId → 추출 성공 + details INSERT + status 'completed' | 정상 |
| 4 | Optimistic Lock — 이미 processing 상태 → '이미 처리 중입니다.' 반환 | 동시성 |
| 5 | Optimistic Lock — `.select('id')` 빈 배열 → 조기 반환 | 동시성 |
| 6 | 기존 details 존재 시 DELETE 후 재삽입 확인 (부분 성공 방어) | 방어 |
| 7 | AI 호출 실패 → finally에서 extraction_status = 'failed' 롤백 | 에러 |
| 8 | try/finally — isCompleted = false 시 'failed' 설정 확인 | 에러 |
| 9 | crop 성공 — figure.url에 Storage 경로 저장 | crop |
| 10 | crop 부분 실패 — 일부 figure.url = null + 나머지 INSERT 정상 | crop |
| 11 | raw_ai_response에 AI 원본 응답 백업 | 백업 |
| 12 | resetExtractionAction — details DELETE + status 'pending' 전이 | 재추출 |
| 13 | resetExtractionAction — Storage orphan cleanup 호출 확인 | 재추출 |
| 14 | resetExtractionAction — Storage 삭제 실패 시 Non-blocking 동작 확인 (v9) | 재추출 |
| 15 | resetExtractionAction — figures 없는 경우 Storage 삭제 스킵 | 재추출 |

### 파일 2: `reanalyze-question.test.ts` (v9 — 별도 파일)

| # | 테스트 케이스 | 유형 |
|---|--------------|------|
| 1 | 인증되지 않은 사용자 → error 반환 | 권한 |
| 2 | 유효한 detailId → 단일 문제 재분석 + UPDATE 확인 | 정상 |
| 3 | feedback 포함 재분석 → AI에 feedback 전달 확인 | 정상 |
| 4 | 전체 이미지 전달 확인 (buildImageParts 호출) | 컨텍스트 |
| 5 | AI 오류 → error 반환 (extraction_status 변경 없음) | 에러 |
| 6 | 존재하지 않는 detailId → error 반환 | 검증 |

---

## 완료 기준

- [ ] 3개 Zod 스키마 정의 + 테스트 PASS
- [ ] `extractQuestionsAction` 구현 — Optimistic Lock + 직렬 base64 + AI 호출 + crop + INSERT
- [ ] `resetExtractionAction` 구현 — Storage orphan cleanup (Non-blocking) + DELETE + status 'pending'
- [ ] `reanalyzeQuestionAction` 구현 — 전체 이미지 전달 + AI 재분석 + UPDATE
- [ ] `buildImageParts` 내부 함수 — 추출/재분석 공유
- [ ] `runtime = 'nodejs'` + `maxDuration = 60` 명시
- [ ] 모든 테스트 PASS (2개 파일, 총 21개 케이스)
- [ ] `npm run build` 성공

---

## 리스크

| 리스크 | 영향 | 확률 | 완화 방안 |
|--------|------|------|----------|
| sharp native module 빌드 실패 | High | Low | `runtime = 'nodejs'` 명시 + Vercel Node.js 호환 확인 |
| Gemini Vision API 다중 이미지 정확도 | High | Medium | confidence + 사용자 편집 + AI 재분석 보완 |
| base64 변환 메모리 초과 (20장 * 5MB) | High | Medium | 직렬 변환(for...of)으로 피크 메모리 억제 + Step 4의 20장/5MB 사전 차단 |
| API 응답 시간 초과 | Medium | High | maxDuration=60 + SDK timeout + extraction_status로 상태 추적 |
| AI bounding box 부정확 → crop 실패 | Medium | Medium | 클램핑 보정 + figure.url=null 부분 성공 + 사용자 원본 대조 |
| Optimistic Lock 우회 (극단적 동시성) | Low | Low | DB-level CHECK 제약은 Action 레벨에서 enforce |
| Vercel Hobby 플랜 10초 한도 | High | Medium | 배포 환경 사전 확인 필수, Pro 플랜 권장 |
