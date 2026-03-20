# 기출문제 추출 상세 계획 — 기술 리뷰 v2

> 리뷰어: technical-reviewer
> 대상: docs/plan/extraction-step1~8.md (v9 상세) + 마스터 PLAN
> 기준: v1 리뷰(extraction-detail-tech-review.md)의 MUST FIX 5건 + SHOULD FIX 4건 반영 확인
> 일자: 2026-03-20

---

## 요약

v1 리뷰에서 지적한 MUST FIX 5건이 **전부 반영**되었다. 특히 Step 4에 `createExtractedQuestionAction`(MF5), Step 5에 `crypto.randomUUID()` 사전 생성(MF3), Step 7에 `router.refresh()` 패턴(MF4)이 명시적으로 추가되었다. SHOULD FIX 4건도 대부분 반영되었으나 `bodySizeLimit` 설정(SF3)은 **계획에는 반영되었으나 실제 설정 값이 여전히 부족**하여 별도 지적이 필요하다.

신규 이슈 탐색 결과, 구조적으로 중요한 이슈 2건(MUST FIX), 개선 권고 3건(SHOULD FIX), 참고 사항 2건(CONSIDER)이 발견되었다.

---

## v1 MUST FIX 5건 반영 확인

| # | 이슈 | 위치 | 반영 여부 | 확인 근거 |
|---|------|------|----------|----------|
| MF1 | AIProvider 인터페이스 변경 후 GeminiProvider 외 stub 순서 미명세 | Step 3 Task 3.1.7 | ✅ 반영 | Step 3 Task 3.1.7에 `// ⚠️ 구현 순서: 인터페이스 + GeminiProvider stub(throw 'Not implemented')를 가장 먼저 추가 → 기존 테스트 컴파일 통과 → 이후 실제 구현으로 교체` 주석 명시 |
| MF2 | 이미지 업로드 실패 시 orphan `past_exams` 레코드 정리 미명세 | Step 4 Task 4.2 | ✅ 반영 | Step 4 의사코드에 `// ⚠️ 업로드 실패 시 롤백 (리뷰 MUST FIX 반영)` + 실제 `past_exams` DELETE 로직 + `uploadedPaths` 추적 패턴 추가 |
| MF3 | crop Storage 경로에 `detailId` 미확보 — INSERT 전 UUID 없음 | Step 5 Task 5.2 (5d) | ✅ 반영 | `const detailId = crypto.randomUUID()` 루프 상단에서 사전 생성, `// ⚠️ 사전 생성 — INSERT 시 이 ID 사용` 주석 명시. 단, **신규 이슈 N1 참조** |
| MF4 | `extractQuestionsAction` 반환 타입에 `data.questions` 없음 — UI에서 추출 결과 수신 불가 | Step 7 Task 7.9 | ✅ 반영 | Step 7 useEffect 의사코드에서 `router.refresh()` 패턴으로 서버 컴포넌트 재패칭 전략 명시. `// ⚠️ extractQuestionsAction은 { totalQuestions, overallConfidence }만 반환 / 문제 목록은 router.refresh()로 서버 컴포넌트 재패칭하여 갱신` 주석 포함 |
| MF5 | 수동 추가 문제 DB INSERT Action 누락 (`createExtractedQuestion`) | Step 4 Task 4.6 | ✅ 반영 | Step 4에 `Task 4.6: createExtractedQuestionAction — 수동 문제 추가 (리뷰 MUST FIX 반영)` 의사코드 추가. 테스트 케이스 4개도 포함 |

---

## v1 SHOULD FIX 4건 반영 확인

| # | 이슈 | 위치 | 반영 여부 | 확인 근거 |
|---|------|------|----------|----------|
| SF1 | `buildImageParts` Signed URL 생성 실패 에러 처리 부재 | Step 5 Task 5.2 (buildImageParts) | ⚠️ 부분 반영 | `buildImageParts` 내부에 `signedUrlData!.signedUrl` non-null assertion 유지. 에러 처리 정책(전체 실패 vs 스킵)이 명시되지 않음. **신규 이슈 N2로 계속 추적** |
| SF2 | `reanalyzeQuestionAction` 반환 타입에 갱신된 문제 내용 미포함 | Step 5 Task 5.4 / Step 7 Task 7.6 | ✅ 반영 | Step 7 Task 7.6에 `questions state에서 해당 문제 교체 (불변 패턴: questions.map(q => q.id === detailId ? updated : q))` 명시. 단, 실제 반환 타입이 `Promise<{ error?: string }>` 유지인지 `data?.updatedQuestion` 포함인지 불명확. **신규 이슈 N3 참조** |
| SF3 | Vercel body size limit 4.5MB vs 총 100MB 불일치 | Step 6 리스크 / `next.config.ts` | ⚠️ 계획은 반영, 실제 설정 값 부족 | Step 6 계획에 `bodySizeLimit: '100mb'` 설정 명시 및 "리드 only" 주의 추가. 그러나 **실제 `next.config.ts`는 현재 `bodySizeLimit: '6mb'`로 설정** — 100MB 업로드 시 여전히 실패함. **신규 이슈 N1(MUST FIX)에서 다룸** |
| SF4 | `past-exams-list.test.ts` 파일명이 마스터 PLAN 파일 목록에 없음 | Step 2 Phase B / 마스터 PLAN | ✅ 반영 | Step 2 Phase B 목록에 `past-exams-list.test.ts` (B4)가 명시적으로 포함됨 |

---

## 신규 기술 이슈

### [MUST FIX] N1: `next.config.ts` `bodySizeLimit` 실제 값이 '6mb'로 부족 — 다중 이미지 업로드 즉시 실패

- **위치**: `/next.config.ts` 현재 상태 / `extraction-step6-upload-ui.md` Task 의존사항
- **문제**: 계획(Step 6)에는 Wave 3 시작 전 리드가 `bodySizeLimit: '100mb'`로 설정해야 한다고 명시되어 있으나, 현재 `next.config.ts`에는 `bodySizeLimit: '6mb'`가 설정되어 있다. 최대 100MB 이미지(20장 x 5MB)를 FormData로 전송하면 6MB 제한에 의해 Next.js Server Action 호출 자체가 HTTP 413 에러로 실패한다. Step 6 구현 착수 전 이 값이 업데이트되지 않으면 업로드 기능 자체가 동작하지 않는다.
- **현재 값**: `bodySizeLimit: '6mb'` (기존 단일 파일 업로드용 설정)
- **필요 값**: `bodySizeLimit: '100mb'` (다중 이미지 최대 100MB 대응)
- **조치**: Wave 3 시작 전(Step 6 착수 전) 리드가 `next.config.ts`의 `bodySizeLimit`을 `'100mb'`로 변경해야 한다. Step 6 계획 문서에는 이미 명시되어 있으나 실제 코드 반영이 누락된 상태다. **이 변경 없이는 Step 6 기능 자체가 불가능하다.**

---

### [MUST FIX] N2: `detailId` 사전 생성 로직과 INSERT 의사코드 간 불일치 — `details` 배열에 `id` 누락

- **위치**: Step 5 Task 5.2 (5d) crop 처리 → (5e) past_exam_details INSERT
- **문제**: Step 5 의사코드에서 `const detailId = crypto.randomUUID()`를 루프 상단에서 사전 생성하여 crop Storage 경로(`{academyId}/{pastExamId}/figures/{detailId}-{i}.jpg`)에 사용한다. 그런데 (5e)의 INSERT 의사코드를 보면:
  ```typescript
  const details = aiResult.questions.map(q => ({
    past_exam_id: pastExamId,
    academy_id: academyId,
    question_number: q.questionNumber,
    // ...
  }))
  await supabase.from('past_exam_details').insert(details)
  ```
  여기에 `id: detailId`가 명시되어 있지 않다. `id`를 명시하지 않으면 PostgreSQL이 `gen_random_uuid()`로 새 UUID를 생성하여, crop에서 사용한 `detailId`와 DB에 저장된 `id`가 **서로 다른 값**이 된다. 결과적으로 `figures[].url`의 Storage 경로에 포함된 `detailId`와 실제 DB 레코드의 `id`가 불일치하여 crop 이미지를 조회할 수 없다.
- **영향**: crop 이미지를 Storage에서 올바르게 조회할 수 없음. 그래프/그림 미리보기 기능 완전 실패.
- **제안**: (5e) INSERT 의사코드의 `details.map(...)` 내에 `id: detailId`를 명시적으로 포함시킨다. 또는 각 문제의 `detailId`를 별도 Map으로 추적하여 `details` 배열 구성 시 `id` 필드로 할당한다. 의사코드 수준에서 이 연결을 명확히 표현해야 구현자가 실수하지 않는다.

---

### [SHOULD FIX] N3: `reanalyzeQuestionAction` 반환 타입이 `Promise<{ error?: string }>`이나 Step 7 UI가 `questions` state 교체를 기대

- **위치**: Step 5 Task 5.4 반환 타입 / Step 7 Task 7.6 성공 시 처리
- **문제**: Step 5의 `reanalyzeQuestionAction` 반환 타입은 `Promise<{ error?: string }>`이다. Step 7 Task 7.6에서는 "성공 시: `questions` state에서 해당 문제 교체 (불변 패턴: `questions.map(q => q.id === detailId ? updated : q)`)"라고 명시하지만, `updated`로 교체할 데이터가 어디서 오는지 설명이 없다. 두 가지 해석이 가능하다:
  1. `reanalyzeQuestionAction`이 `data?: { updatedQuestion: ExtractedQuestionUI }` 필드를 반환 → 이 경우 Step 5 반환 타입과 불일치
  2. 성공 후 별도 DB 쿼리로 갱신 → 이 경우 추가 네트워크 요청 발생

  현재 계획에서는 둘 중 어느 방식인지 명시되지 않아 구현자가 혼동할 수 있다.
- **제안**: Step 5의 `reanalyzeQuestionAction` 반환 타입에 `data?: { updatedQuestion: ExtractedQuestionUI }` 추가를 권장한다(방안 1). Action 레이어에서 DB UPDATE 후 갱신된 레코드를 `.select()`로 조회하여 반환하면, 추가 네트워크 요청 없이 UI를 갱신할 수 있다. 계획에 선택한 방안을 명시해야 한다.

---

### [SHOULD FIX] N4: `buildImageParts` 내 `signedUrlData!.signedUrl` non-null assertion — Signed URL 생성 실패 시 런타임 에러

- **위치**: Step 5 Task 5.2 `buildImageParts` 내부 함수
- **문제**: v1 SF1 이슈가 부분적으로만 반영되었다. `buildImageParts` 의사코드에 여전히 `signedUrlData!.signedUrl`(non-null assertion)이 남아 있다. Signed URL 생성이 실패하면(`data`가 null) `!` 연산자에 의해 런타임에서 `TypeError: Cannot read properties of null`이 발생한다. 이 에러는 `try/finally`의 `finally` 블록에서 `extraction_status = 'failed'`로 처리되겠지만, 에러 메시지가 불명확하여 디버깅이 어렵다.
- **제안**: 다음과 같이 명시적 에러 처리 추가를 제안한다:
  ```typescript
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('past-exams')
    .createSignedUrl(image.source_image_url, 300)
  if (signedUrlError || !signedUrlData) {
    throw new Error(`Signed URL 생성 실패: ${image.source_image_url}`)
  }
  ```
  또는 전체 추출 실패 대신 해당 이미지를 스킵하는 정책을 선택하되, 어느 방안이든 명시가 필요하다.

---

### [CONSIDER] N5: MF1 반영 시 실제 stub 대상 파일 목록이 계획에 없음

- **위치**: Step 3 Task 3.1.7 / `src/lib/ai/` 현재 파일 구조
- **문제**: v1 MF1에 대해 "GeminiProvider stub 먼저 추가"라는 순서는 명시되었으나, 실제로 stub이 필요한 파일 목록은 여전히 계획에 없다. 현재 코드베이스에서 `AIProvider`를 구현하는 파일은 `src/lib/ai/gemini.ts`(GeminiProvider) 하나뿐임을 확인했다. 테스트에서 직접 `AIProvider` 인터페이스를 구현하는 Mock 클래스는 `src/lib/ai/__tests__/provider.test.ts`와 `src/lib/ai/__tests__/gemini.test.ts`에 인라인으로 정의되어 있다. 이 테스트 내 인라인 Mock에도 `extractQuestions`, `reanalyzeQuestion` stub 구현이 필요하다.
- **리스크**: Low — 구현자가 TypeScript 컴파일 에러를 통해 발견하고 수정 가능하다. 단, 컴파일 에러 발생 시 구현자가 당황하지 않도록 Step 3 계획에 "테스트 Mock 클래스에도 stub 추가 필요"를 한 줄 주석으로 추가하면 충분하다.

---

### [CONSIDER] N6: Step 4 `createPastExamAction` 재업로드 로직의 전제 불일치 (v1 SF2 이어서)

- **위치**: Step 4 Task 4.2 의사코드 6단계 재업로드
- **문제**: v1 SHOULD FIX 2(재업로드 시 새 `past_exams` INSERT와 기존 이미지 삭제 로직 불일치)가 v9에서 반영된 방식이 여전히 혼재되어 있다. 의사코드를 보면:
  - 5단계: `past_exams INSERT` → 새 `pastExamId` 생성
  - 6단계: `past_exam_images SELECT ... WHERE past_exam_id = pastExamId` → 방금 INSERT한 새 시험의 이미지를 조회

  그런데 신규 INSERT된 `past_exams` 레코드에는 이미지가 없으므로 6단계는 항상 빈 결과를 반환하여 `if (existingImages && existingImages.length > 0)` 조건을 만족하지 않는다. 즉, 재업로드 cleanup 로직이 실제로는 절대 실행되지 않는다. 이는 v1 SF2에서 지적한 구조적 문제가 형식적으로만 반영되고 실질적으로 해결되지 않은 상태다.
- **영향**: 재업로드 시나리오가 계획에서 정의되지 않거나, 정의된 방식이 작동하지 않는다. 기능 완성도에는 영향 없으나(새 시험 생성 자체는 정상), 코드 가독성과 의도 명확성에 문제가 있다.
- **제안**: 재업로드 UX를 명확히 확정한다. 현재 구현은 "항상 새 시험 생성" 패턴이므로, 6단계의 재업로드 cleanup 코드를 제거하거나 다음과 같이 명확히 주석 처리한다: `// 현재 구현: 항상 새 시험 생성. 재업로드는 별도 시나리오로 처리하지 않음.`

---

## Plan Review Completion Checklist (v2 재평가)

- [x] 모든 Task의 파일 소유권이 명확하다
  - Step 1~8 각 문서에 소유 역할(db-schema / backend-actions / ai-integration / frontend-ui) 명시.
- [x] Task 간 의존성 순서가 정의되었다
  - Wave 1~5 구조 명확. Step 1 완료 직후 `supabase gen types` 타이밍도 명시.
- [x] 외부 의존성이 명시되었다
  - sharp, @dnd-kit/core+sortable+utilities, @google/genai 모두 명시. package.json 리드 only 규칙 반영.
- [x] 에러 처리 방식이 정해졌다
  - isCompleted + try/finally, Optimistic Lock, Non-blocking Storage 삭제, crop 부분 성공 명시.
  - **단, N2(detailId INSERT 누락)와 N4(buildImageParts non-null assertion) 미해결.**
- [x] 테스트 전략이 있다
  - 각 Step별 테스트 케이스 목록 + 총 케이스 수 명시. TDD 순서 안내.
- [x] 이전 Phase 회고 교훈이 반영되었다
  - MEMORY.md의 Zod `.uuid()` → `.min(1)`, `useEffect` cancelled 플래그 등 반영.
- [x] 병렬 구현 시 파일 충돌 가능성이 없다
  - Wave 단위로 병렬 실행 범위 명확. 동일 파일 동시 수정 구조 없음.

---

## 미해결 이슈 요약

### MUST FIX (구현 전 반드시 해결)

| # | Step | 이슈 | 심각도 |
|---|------|------|--------|
| N1 | Step 6 (Wave 3 시작 전) | `next.config.ts` `bodySizeLimit: '6mb'` → `'100mb'` 변경 필요. 현재 값으로는 다중 이미지 업로드 즉시 실패 | 기능 불동작 |
| N2 | Step 5 Task 5.2 | `past_exam_details` INSERT 시 `id: detailId` 누락 → crop Storage 경로와 DB ID 불일치 → 그래프 조회 불가 | 데이터 불일치 |

### SHOULD FIX (가능하면 해결)

| # | Step | 이슈 | 심각도 |
|---|------|------|--------|
| N3 | Step 5 Task 5.4 / Step 7 Task 7.6 | `reanalyzeQuestionAction` 반환 타입과 UI 상태 갱신 방안 불명확 | 구현 모호성 |
| N4 | Step 5 Task 5.2 | `buildImageParts`의 `signedUrlData!.signedUrl` non-null assertion 명시적 에러 처리 필요 | 런타임 에러 위험 |

### CONSIDER (참고)

| # | Step | 이슈 |
|---|------|------|
| N5 | Step 3 | MF1 stub 대상으로 테스트 인라인 Mock도 포함됨 — 한 줄 주석으로 명시 권장 |
| N6 | Step 4 | 재업로드 cleanup 로직이 실제로 작동하지 않는 구조 — 코드 제거 또는 주석으로 명확히 처리 권장 |

---

## 판정: BLOCKED

MUST FIX 2건(N1, N2)이 해결되어야 구현으로 진행할 수 있다.

- **N1** (`bodySizeLimit`)은 코드 1줄 수정이지만, 이것 없이는 Step 6 자체가 동작하지 않는다. Wave 3 시작 전 리드가 `next.config.ts`를 수정해야 한다.
- **N2** (`id: detailId` 누락)는 Step 5 의사코드 수정으로 해결 가능하나, 구현 중 발견하면 crop 경로와 DB ID 불일치로 조용한 버그가 발생한다. 의사코드 단계에서 명시가 필요하다.

SHOULD FIX 2건(N3, N4)은 구현 전 계획 문서에 방안을 확정해두어야 구현자가 혼동 없이 작업할 수 있다.
