# Step 4: 시험 생성 + 이미지 업로드 상세 구현 계획 ✅

> **상태**: ✅ 구현 완료 (2026-03-20, 4개 파일, 5개 Action, 64 테스트)

> **상태**: 구현 대기
> **소유 역할**: backend-actions
> **의존성**: Step 1 (3계층 스키마 + `supabase gen types` → `src/types/supabase.ts` 업데이트 완료 필수)
> **마스터 PLAN**: `docs/plan/20260308-past-exam-extraction.md` Step 4

---

## 목표

시험 메타데이터 생성 + 다중 이미지 Storage 업로드 + 추출된 문제 편집/삭제/확정 Server Action을 구현한다. `extract-questions.ts`의 3개 Action(추출/재추출/재분석)과 분리하여 파일 크기를 밸런싱한다.

---

## 파일 4개

| 파일 | 유형 | 역할 |
|------|------|------|
| `src/lib/actions/exam-management.ts` | 신규 | Server Actions 4개 |
| `src/lib/validations/exam-management.ts` | 신규 | Zod 스키마 |
| `src/lib/actions/__tests__/exam-management.test.ts` | 신규 | Action 단위 테스트 |
| `src/lib/validations/__tests__/exam-management.test.ts` | 신규 | 스키마 단위 테스트 |

### `exam-management.ts` 배치 근거 (v9 Scope CONSIDER 4)

> `extract-questions.ts`에 이미 3개 Action(`extractQuestionsAction`, `resetExtractionAction`, `reanalyzeQuestionAction`)이 배치되어 비대화 방지가 필요하다. 편집/삭제/확정 Action은 sharp/AI 의존성이 없으므로 `exam-management.ts`에 배치하여 파일 크기를 분산시킨다.

---

## Task 분해

### Task 4.1: Zod 스키마 정의 (`src/lib/validations/exam-management.ts`)

#### `createPastExamSchema`

기존 `uploadPastExamAction`의 인증/권한 패턴 참조 (`src/lib/actions/past-exams.ts` line 164-274).

```typescript
import { z } from 'zod'

// ─── 상수 ────────────────────────────────────────────────

/** 이미지 검증 상한 (v8 반영) */
export const MAX_IMAGE_COUNT = 20       // 최대 20장
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024  // 개별 5MB
export const MAX_TOTAL_SIZE = 100 * 1024 * 1024 // 총 100MB

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export const EXAM_TYPES = ['midterm', 'final', 'mock', 'diagnostic'] as const

// ─── 메타데이터 스키마 ────────────────────────────────────

export const createPastExamSchema = z.object({
  schoolId: z.string().min(1, '학교를 선택해주세요.'),
  year: z.coerce
    .number()
    .int()
    .min(2000, '연도는 2000 이상이어야 합니다.')
    .max(2100, '연도는 2100 이하여야 합니다.'),
  semester: z.coerce
    .number()
    .int()
    .min(1, '학기를 선택해주세요.')
    .max(2, '학기는 1 또는 2입니다.'),
  examType: z.enum(['midterm', 'final', 'mock', 'diagnostic'], {
    errorMap: () => ({ message: '시험 유형을 선택해주세요.' }),
  }),
  grade: z.coerce
    .number()
    .int()
    .min(1, '학년은 1 이상이어야 합니다.')
    .max(12, '학년은 12 이하여야 합니다.'),
  subject: z
    .string()
    .min(1, '과목을 입력해주세요.')
    .max(50, '과목은 50자 이하여야 합니다.'),
})

export type CreatePastExamInput = z.infer<typeof createPastExamSchema>
```

#### 이미지 검증 함수

```typescript
export interface ImageValidationResult {
  readonly valid: boolean
  readonly error?: string
}

/** 다중 이미지 검증: 수량/개별크기/총크기/MIME 타입 */
export function validateImages(files: readonly File[]): ImageValidationResult {
  if (files.length === 0) {
    return { valid: false, error: '이미지를 1장 이상 선택해주세요.' }
  }
  if (files.length > MAX_IMAGE_COUNT) {
    return { valid: false, error: `이미지는 최대 ${MAX_IMAGE_COUNT}장까지 업로드할 수 있습니다.` }
  }

  let totalSize = 0
  for (const file of files) {
    if (file.size > MAX_IMAGE_SIZE) {
      return { valid: false, error: `개별 이미지 크기는 ${MAX_IMAGE_SIZE / (1024 * 1024)}MB 이하여야 합니다.` }
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
      return { valid: false, error: '허용된 이미지 형식: JPEG, PNG, WebP' }
    }
    totalSize += file.size
  }

  if (totalSize > MAX_TOTAL_SIZE) {
    return { valid: false, error: `전체 이미지 크기는 ${MAX_TOTAL_SIZE / (1024 * 1024)}MB 이하여야 합니다.` }
  }

  return { valid: true }
}
```

#### `updateExtractedQuestionSchema`

```typescript
export const updateExtractedQuestionSchema = z.object({
  questionText: z.string().min(1, '문제 내용을 입력해주세요.'),
  questionType: z.enum(['multiple_choice', 'short_answer', 'essay'], {
    errorMap: () => ({ message: '문제 유형을 선택해주세요.' }),
  }),
  options: z.array(z.string()).optional(), // 객관식 보기
  answer: z.string().optional(),           // 정답
})

export type UpdateExtractedQuestionInput = z.infer<typeof updateExtractedQuestionSchema>
```

---

### Task 4.2: `createPastExamAction` 의사코드

기존 `uploadPastExamAction` (`src/lib/actions/past-exams.ts` line 164-274) 참조 — 인증/권한/Storage 업로드 패턴을 그대로 재사용.

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPastExamSchema, validateImages } from '@/lib/validations/exam-management'
import { isValidGradeForSchoolType, type SchoolType } from '@/lib/utils/grade-filter-utils'

// ─── 반환 타입 ────────────────────────────────────────────

export interface ExamManagementResult {
  readonly error?: string
  readonly data?: {
    readonly pastExamId: string
  }
}

export async function createPastExamAction(
  formData: FormData
): Promise<ExamManagementResult> {
  // 1. 인증 + 권한 확인 (기존 패턴: createClient → getUser → profiles.select)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, academy_id')
    .eq('id', user.id)
    .single()
  // ... 역할 체크: teacher/admin/system_admin만

  // 2. 메타데이터 검증 (Zod)
  const raw = {
    schoolId: formData.get('schoolId'),
    year: formData.get('year'),
    semester: formData.get('semester'),
    examType: formData.get('examType'),
    grade: formData.get('grade'),
    subject: formData.get('subject'),
  }
  const parsed = createPastExamSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }

  // 3. 이미지 파일 추출 + 검증 (20장/5MB/100MB)
  const files = formData.getAll('images') as File[]
  const imageResult = validateImages(files)
  if (!imageResult.valid) return { error: imageResult.error }

  // 4. school_type ↔ grade 교차 검증 (Defense in Depth — 기존 패턴)
  const { data: school } = await supabase
    .from('schools')
    .select('school_type')
    .eq('id', parsed.data.schoolId)
    .single()
  if (school && !isValidGradeForSchoolType(parsed.data.grade, school.school_type as SchoolType)) {
    return { error: '선택한 학교 유형에 맞지 않는 학년입니다.' }
  }

  // 5. past_exams INSERT (시험 생성)
  const { data: exam, error: examError } = await supabase
    .from('past_exams')
    .insert({
      academy_id: profile.academy_id,
      school_id: parsed.data.schoolId,
      created_by: user.id,
      year: parsed.data.year,
      semester: parsed.data.semester,
      exam_type: parsed.data.examType,
      grade: parsed.data.grade,
      subject: parsed.data.subject,
      extraction_status: 'pending',
    })
    .select('id')
    .single()
  if (examError || !exam) return { error: '시험 생성에 실패했습니다.' }

  const pastExamId = exam.id

  // 6. (v9 반영) 재업로드 시 기존 이미지 정리
  //    6a. 기존 past_exam_images 조회 → source_image_url 목록 수집
  //    6b. Storage에서 기존 원본 이미지 삭제 (admin 클라이언트, Non-blocking)
  //    6c. past_exam_images DELETE (DB)
  //    6d. 새 이미지 Storage 업로드 → past_exam_images INSERT

  const admin = createAdminClient()

  // 기존 이미지 존재 시 삭제 (재업로드 시나리오)
  const { data: existingImages } = await supabase
    .from('past_exam_images')
    .select('source_image_url')
    .eq('past_exam_id', pastExamId)

  if (existingImages && existingImages.length > 0) {
    const existingUrls = existingImages.map((img) => img.source_image_url)
    // Non-blocking: Storage 삭제 실패 시 무시 (orphan은 Phase 2 cleanup)
    await admin.storage.from('past-exams').remove(existingUrls).catch(() => {})
    // DB DELETE
    await supabase
      .from('past_exam_images')
      .delete()
      .eq('past_exam_id', pastExamId)
  }

  // 7. 다중 이미지 → Storage 업로드 + past_exam_images INSERT
  //    Storage 경로: {academyId}/{pastExamId}/{page_number}-{fileId}.{ext}
  const imageInserts = []
  const uploadedPaths: string[] = []  // 롤백용 업로드 경로 추적
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const fileId = crypto.randomUUID()
    const pageNumber = i + 1
    const storagePath = `${profile.academy_id}/${pastExamId}/${pageNumber}-${fileId}.${ext}`

    const { error: uploadError } = await admin.storage
      .from('past-exams')
      .upload(storagePath, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      // ⚠️ 업로드 실패 시 롤백 (리뷰 MUST FIX 반영):
      // 1. 이미 업로드된 이미지 Storage 삭제 (Non-blocking)
      if (uploadedPaths.length > 0) {
        try { await admin.storage.from('past-exams').remove(uploadedPaths) } catch { /* orphan 허용 */ }
      }
      // 2. past_exams 레코드 삭제 (orphan 방지)
      await supabase.from('past_exams').delete().eq('id', pastExamId)
      return { error: '이미지 업로드에 실패했습니다. 다시 시도해주세요.' }
    }
    uploadedPaths.push(storagePath)  // 롤백용 경로 추적

    imageInserts.push({
      past_exam_id: pastExamId,
      academy_id: profile.academy_id,
      page_number: pageNumber,
      source_image_url: storagePath,
    })
  }

  // Bulk INSERT (PostgreSQL 트랜잭션 — All or Nothing)
  const { error: imageDbError } = await supabase
    .from('past_exam_images')
    .insert(imageInserts)

  if (imageDbError) {
    return { error: '이미지 정보 저장에 실패했습니다.' }
  }

  // 8. 결과 반환
  return { data: { pastExamId } }
}
```

---

### Task 4.3: `updateExtractedQuestion` 의사코드

```typescript
export interface UpdateQuestionResult {
  readonly error?: string
  readonly data?: { readonly id: string }
}

export async function updateExtractedQuestion(
  detailId: string,
  rawInput: Record<string, unknown>
): Promise<UpdateQuestionResult> {
  // 1. 인증 + 권한 (teacher/admin/system_admin)
  const supabase = await createClient()
  // ... 기존 패턴

  // 2. Zod 검증
  const parsed = updateExtractedQuestionSchema.safeParse(rawInput)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }

  // 3. 해당 detail이 사용자 academy에 속하는지 확인 (RLS가 자동 처리하지만 명시적 체크)
  const { data: detail, error: detailError } = await supabase
    .from('past_exam_details')
    .select('id, academy_id')
    .eq('id', detailId)
    .single()

  if (detailError || !detail) return { error: '문제를 찾을 수 없습니다.' }

  // 4. UPDATE
  const { error: updateError } = await supabase
    .from('past_exam_details')
    .update({
      question_text: parsed.data.questionText,
      question_type: parsed.data.questionType,
      options: parsed.data.options ?? null,
      answer: parsed.data.answer ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', detailId)

  if (updateError) return { error: '문제 수정에 실패했습니다.' }

  return { data: { id: detailId } }
}
```

---

### Task 4.4: `deleteExtractedQuestion` 의사코드

```typescript
export interface DeleteQuestionResult {
  readonly error?: string
}

export async function deleteExtractedQuestion(
  detailId: string
): Promise<DeleteQuestionResult> {
  // 1. 인증 + 권한
  const supabase = await createClient()
  // ... 기존 패턴

  // 2. 해당 detail 존재 확인
  const { data: detail, error: detailError } = await supabase
    .from('past_exam_details')
    .select('id')
    .eq('id', detailId)
    .single()

  if (detailError || !detail) return { error: '문제를 찾을 수 없습니다.' }

  // 3. DELETE
  const { error: deleteError } = await supabase
    .from('past_exam_details')
    .delete()
    .eq('id', detailId)

  if (deleteError) return { error: '문제 삭제에 실패했습니다.' }

  return {}
}
```

---

### Task 4.5: `confirmExtractedQuestions` 의사코드

```typescript
export interface ConfirmQuestionsResult {
  readonly error?: string
  readonly data?: { readonly confirmedCount: number }
}

export async function confirmExtractedQuestions(
  pastExamId: string
): Promise<ConfirmQuestionsResult> {
  // 1. 인증 + 권한
  const supabase = await createClient()
  // ... 기존 패턴

  // 2. 해당 시험 존재 + extraction_status 확인
  const { data: exam, error: examError } = await supabase
    .from('past_exams')
    .select('id, extraction_status')
    .eq('id', pastExamId)
    .single()

  if (examError || !exam) return { error: '시험을 찾을 수 없습니다.' }
  if (exam.extraction_status !== 'completed') {
    return { error: '추출이 완료된 시험만 확정할 수 있습니다.' }
  }

  // 3. 모든 details를 is_confirmed = true로 UPDATE
  const { data: updated, error: updateError } = await supabase
    .from('past_exam_details')
    .update({ is_confirmed: true, updated_at: new Date().toISOString() })
    .eq('past_exam_id', pastExamId)
    .eq('is_confirmed', false)
    .select('id')

  if (updateError) return { error: '문제 확정에 실패했습니다.' }

  return { data: { confirmedCount: updated?.length ?? 0 } }
}
```

---

### Task 4.6: `createExtractedQuestionAction` — 수동 문제 추가 (리뷰 MUST FIX 반영)

> Step 7 편집 UI에서 [+ 문제 수동 추가] 시 DB INSERT가 필요하다.
> `updateExtractedQuestion`은 기존 문제 UPDATE만 담당하므로 별도 Action 필요.

```typescript
export async function createExtractedQuestionAction(
  pastExamId: string,
  data: {
    questionNumber: number
    questionText: string
    questionType: 'multiple_choice' | 'short_answer' | 'essay'
    options?: string[]
    answer?: string
  }
): Promise<{ error?: string; data?: { id: string } }>
```

**의사코드**:
```
1. 인증 + 권한 확인
2. Zod 검증
3. past_exams 존재 + academy_id 확인
4. past_exam_details INSERT:
   {
     past_exam_id: pastExamId,
     academy_id: profile.academyId,
     question_number: data.questionNumber,
     question_text: data.questionText,
     question_type: data.questionType,
     options: data.options ?? null,
     answer: data.answer ?? null,
     has_figure: false,
     confidence: null,  // 수동 추가이므로 confidence 없음
     is_confirmed: false,
   }
5. return { data: { id: insertedRow.id } }
```

---

### Task 4.7: 테스트 케이스 목록

#### `src/lib/validations/__tests__/exam-management.test.ts`

**createPastExamSchema 테스트**:
| # | 테스트 케이스 |
|---|-------------|
| 1 | 유효한 데이터 통과 |
| 2 | schoolId 빈 문자열 거부 |
| 3 | year 2000 미만 거부 |
| 4 | year 2100 초과 거부 |
| 5 | semester 0 거부 |
| 6 | semester 3 거부 |
| 7 | 허용되지 않은 examType 거부 |
| 8 | grade 0 거부 |
| 9 | grade 13 거부 |
| 10 | subject 빈 문자열 거부 |
| 11 | subject 50자 초과 거부 |
| 12 | 문자열 숫자 coerce 통과 |

**validateImages 테스트**:
| # | 테스트 케이스 |
|---|-------------|
| 1 | 빈 배열 거부 |
| 2 | 21장 거부 (MAX_IMAGE_COUNT 초과) |
| 3 | 개별 6MB 파일 거부 (MAX_IMAGE_SIZE 초과) |
| 4 | 총 101MB 거부 (MAX_TOTAL_SIZE 초과) |
| 5 | 허용되지 않은 MIME 타입 (text/plain) 거부 |
| 6 | PDF 파일 거부 (이미지만 허용) |
| 7 | 유효한 JPEG 1장 통과 |
| 8 | 유효한 PNG+WebP 혼합 20장 통과 |
| 9 | 정확히 5MB 파일 통과 (경계값) |
| 10 | 정확히 100MB 총합 통과 (경계값) |

**updateExtractedQuestionSchema 테스트**:
| # | 테스트 케이스 |
|---|-------------|
| 1 | 유효한 데이터 통과 |
| 2 | questionText 빈 문자열 거부 |
| 3 | 허용되지 않은 questionType 거부 |
| 4 | options 선택적 (없어도 통과) |
| 5 | answer 선택적 (없어도 통과) |

#### `src/lib/actions/__tests__/exam-management.test.ts`

**createPastExamAction 테스트**:
| # | 테스트 케이스 |
|---|-------------|
| 1 | 비인증 사용자 → 에러 |
| 2 | student 역할 → 권한 에러 |
| 3 | teacher 역할 → 성공 |
| 4 | admin 역할 → 성공 |
| 5 | 메타데이터 Zod 검증 실패 → 에러 |
| 6 | 이미지 0장 → 에러 |
| 7 | 이미지 21장 → 에러 (수량 초과) |
| 8 | 개별 6MB 이미지 → 에러 (용량 초과) |
| 9 | school_type ↔ grade 불일치 → 에러 |
| 10 | past_exams INSERT 실패 → 에러 |
| 11 | Storage 업로드 실패 → 에러 + cleanup |
| 12 | past_exam_images INSERT 실패 → 에러 |
| 13 | 성공 시 pastExamId 반환 |
| 14 | Storage 경로 형식 확인: `{academyId}/{pastExamId}/{pageNumber}-{fileId}.{ext}` |
| 15 | 재업로드 시 기존 이미지 삭제 후 새 이미지 INSERT |

**updateExtractedQuestion 테스트**:
| # | 테스트 케이스 |
|---|-------------|
| 1 | 비인증 사용자 → 에러 |
| 2 | 존재하지 않는 detailId → 에러 |
| 3 | Zod 검증 실패 → 에러 |
| 4 | 유효 입력 → UPDATE 성공 + id 반환 |
| 5 | 객관식 → options 포함 UPDATE 확인 |
| 6 | 서술형 → options null UPDATE 확인 |

**deleteExtractedQuestion 테스트**:
| # | 테스트 케이스 |
|---|-------------|
| 1 | 비인증 사용자 → 에러 |
| 2 | 존재하지 않는 detailId → 에러 |
| 3 | 유효 입력 → DELETE 성공 |
| 4 | DB 삭제 에러 → 에러 반환 |

**confirmExtractedQuestions 테스트**:
| # | 테스트 케이스 |
|---|-------------|
| 1 | 비인증 사용자 → 에러 |
| 2 | 존재하지 않는 pastExamId → 에러 |
| 3 | extraction_status !== 'completed' → 에러 |
| 4 | 유효 입력 → is_confirmed = true UPDATE + confirmedCount 반환 |
| 5 | 이미 모두 confirmed → confirmedCount === 0 |

**createExtractedQuestionAction 테스트** (리뷰 MUST FIX 반영):
| # | 테스트 케이스 |
|---|-------------|
| 1 | 비인증 사용자 → 에러 |
| 2 | 유효 입력 → past_exam_details INSERT 성공 + id 반환 |
| 3 | 존재하지 않는 pastExamId → 에러 |
| 4 | Zod 검증 실패 (빈 questionText) → 에러 |

---

## 반환 타입 정의

```typescript
// createPastExamAction
export interface ExamManagementResult {
  readonly error?: string
  readonly data?: {
    readonly pastExamId: string
  }
}

// updateExtractedQuestion
export interface UpdateQuestionResult {
  readonly error?: string
  readonly data?: {
    readonly id: string
  }
}

// deleteExtractedQuestion
export interface DeleteQuestionResult {
  readonly error?: string
}

// confirmExtractedQuestions
export interface ConfirmQuestionsResult {
  readonly error?: string
  readonly data?: {
    readonly confirmedCount: number
  }
}
```

---

## 완료 기준

- [ ] 5개 Server Action 구현 완료 (createPastExamAction, updateExtractedQuestion, deleteExtractedQuestion, confirmExtractedQuestions, createExtractedQuestionAction)
- [ ] Zod 스키마 2개 구현 + 이미지 검증 함수 구현
- [ ] 단위 테스트 전부 통과 (`npx vitest run src/lib/actions/__tests__/exam-management.test.ts`)
- [ ] Validation 테스트 전부 통과 (`npx vitest run src/lib/validations/__tests__/exam-management.test.ts`)
- [ ] TypeScript 에러 없음 (`npx tsc --noEmit`)
- [ ] `exam-management.ts` 파일 크기 400줄 이내 (800줄 상한의 절반 — 밸런싱 목적)

---

## 리스크

| 리스크 | 영향 | 확률 | 완화 방안 |
|--------|------|------|----------|
| Storage 업로드 순차 처리 시 지연 | Medium | Medium | 이미지 수 상한 20장으로 제한, 개별 5MB 상한 |
| 재업로드 시 orphan 파일 잔류 | Low | Medium | Storage 삭제 Non-blocking + Phase 2 cleanup job 예정 |
| past_exams INSERT 후 이미지 업로드 실패 시 고아 exam 레코드 | Medium | Low | 에러 시 exam DELETE cleanup 로직 추가 또는 extraction_status='pending'으로 식별 가능 |
| 다중 이미지 FormData 처리 복잡도 | Low | Low | `formData.getAll('images')` 표준 API 사용, 테스트로 검증 |
| UNIQUE(past_exam_id, page_number) 제약 위반 | Low | Low | page_number를 배열 인덱스 기반으로 순차 할당, 재업로드 시 DELETE 선행 |
