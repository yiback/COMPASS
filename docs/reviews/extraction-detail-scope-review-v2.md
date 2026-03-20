# 기출문제 추출 상세 계획 — 범위 리뷰 v2

> 리뷰어: scope-reviewer
> 대상: docs/plan/20260308-past-exam-extraction.md (마스터 PLAN v9) + extraction-step1~8.md (상세 8개)
> v1 리뷰: docs/reviews/extraction-detail-scope-review.md
> 일자: 2026-03-20

---

## 요약

v1 SHOULD FIX 3건 모두 반영 완료, CONSIDER 4건 중 3건 반영 확인. 신규 Task(createExtractedQuestionAction, bodySizeLimit 설정)가 명시적으로 추가되어 v1 대비 실질적인 개선이 이루어졌다. 새로 식별된 MUST FIX 1건, SHOULD FIX 2건, CONSIDER 3건이 있다.

**전체 판정: READY** (MUST FIX 1건은 구현자가 착수 전 처리 가능한 수준)

---

## v1 이슈 반영 확인

### SHOULD FIX 반영 여부

| # | v1 이슈 | 반영 상태 | 확인 위치 |
|---|---------|----------|----------|
| SHOULD FIX 1 | `past_exam_images` UPDATE RLS 존재 이유 주석 미명시 | ❌ **미반영** | extraction-step1-schema.md Task 1.5: `past_exam_images_update_teacher` 정책 코드 그대로, "미래 확장용" 주석 없음 |
| SHOULD FIX 2 | Step 2 복합 역할 병렬 불가 명시 누락 | ✅ 반영 | extraction-step2-refactor.md: Phase A→B→C→D 순서 준수 명시, "17개 파일 동시 변경으로 인한 타입 에러 연쇄" 리스크 표에 "Phase A→B→C→D 순서 준수" 완화 방안 포함 |
| SHOULD FIX 3 | 이미지 업로드 실패 시 orphan exam cleanup "간략화" 처리 | ✅ 반영 | extraction-step4-exam-management.md Task 4.2 의사코드: 구체적 cleanup 흐름 명시 (uploadedPaths 추적 + Storage 삭제 + exam DELETE) |

> **SHOULD FIX 1 미반영 상세**: Task 1.5의 `past_exam_images_update_teacher` 정책에 "현재 Action에서 직접 사용하지 않음. 미래 확장을 위해 선제적으로 추가." 주석이 여전히 없다. 마이그레이션 파일을 읽는 구현자가 해당 정책의 존재 이유를 오해할 수 있다.

### CONSIDER 반영 여부

| # | v1 이슈 | 반영 상태 | 확인 위치 |
|---|---------|----------|----------|
| CONSIDER 1 | `supabase gen types` 실행 주체·환경 불명확 | ✅ 반영 | extraction-step1-schema.md "완료 직후 작업": `npx supabase gen types typescript --local > src/types/supabase.ts` 명시 |
| CONSIDER 2 | `uploadPastExamAction` deprecated 유지 기간 미명시 | ✅ 반영 | extraction-step2-refactor.md: `@deprecated Step 6 이후 삭제 예정. createPastExamAction으로 대체.` JSDoc 명시 |
| CONSIDER 3 | `figureInfoSchema`에 `url` 미포함 이유 주석 필요 | ✅ 반영 | extraction-step3-ai-layer.md Task 3.2 `validateExtractedQuestions` 함수 내: `url: null,  // crop 전이므로 null — Step 5에서 채움` 주석 존재 |
| CONSIDER 4 | Vercel body size limit(4.5MB) 초과 | ✅ 반영 (격상) | extraction-step6-upload-ui.md: **"⚠️ `next.config.ts` bodySizeLimit 설정 필수 (리뷰 SHOULD FIX 반영)"** 섹션으로 격상 + `bodySizeLimit: '100mb'` 설정 코드 명시 + "리드 only" 명시 |

---

## 신규 Task 적절성 검토

### `createExtractedQuestionAction` (Task 4.6 — 신규)

**적절성**: 적절하다. v1 리뷰에서 발견된 "`updateExtractedQuestion`은 기존 문제 UPDATE만 담당하므로 수동 추가 시 INSERT Action이 별도 필요" 이슈를 Task 4.6으로 명시적으로 해결했다.

**파일 소유권**: `exam-management.ts` (backend-actions) — 기존 파일에 추가. 소유권 충돌 없음.

**테스트**: 4개 케이스가 `exam-management.test.ts`에 추가됨. 적절한 규모.

**Task 크기**: 의사코드 기준 약 30줄 추정. 단일 INSERT + 권한 검증으로 단순. 적절.

### `bodySizeLimit` 설정 (Step 6 신규 의존성)

**적절성**: 적절하다. v1에서 CONSIDER로 분류한 것을 SHOULD FIX로 격상하여 Wave 3 착수 전 리드 필수 처리 사항으로 명시했다. "리드 only" Shared Files 규칙 준수.

**위치**: extraction-step6-upload-ui.md 새 의존성 섹션 최상단에 배치 — 구현자가 놓치기 어려운 위치.

---

## Step별 신규 이슈

---

### Step 1 — SHOULD FIX 미반영 1건

#### SHOULD FIX 1 (v1 미반영): `past_exam_images` UPDATE RLS 주석 누락

앞서 확인한 대로, Task 1.5의 `past_exam_images_update_teacher` 정책에 미래 확장용 주석이 없다. 구현자가 "현재 사용하지 않는 정책이 왜 있는가?"를 의심하거나, 반대로 이 정책이 현재 어딘가에서 사용 중이라고 오해할 수 있다.

- **권고**: Task 1.5 `past_exam_images_update_teacher` 정책 SQL 직전에 주석 한 줄 추가:
  ```sql
  -- 현재 Action에서 직접 사용하지 않음.
  -- page_number 갱신 등 미래 확장을 위해 선제적으로 추가.
  ```

---

### Step 2 — 이슈 없음

Phase A→B→C→D 순서, 병렬 불가 명시(리스크 표), 17개 파일 변경 상세 모두 적절하다. v1 SHOULD FIX 2가 잘 반영되었다.

---

### Step 4 — 신규 이슈 1건

#### MUST FIX 1 (신규): `createExtractedQuestionAction` Zod 스키마 누락

Task 4.6에 `createExtractedQuestionAction` 의사코드가 추가되었으나, 이 Action에 대한 **Zod 스키마가 `exam-management.ts` (validation)에 정의되지 않았다**. 의사코드 2단계에 "Zod 검증"이 명시되어 있지만, `createPastExamSchema`, `updateExtractedQuestionSchema`는 정의되어 있는 반면 `createExtractedQuestionSchema`(또는 해당 스키마)가 Task 4.1에 없다.

이 누락이 구현 단계로 이어지면:
1. 구현자가 스키마 없이 직접 검증 로직을 Action 내부에 작성하거나
2. 스키마 없이 구현하여 입력 검증이 생략될 수 있다

- **권고**: Task 4.1에 `createExtractedQuestionSchema` 추가:
  ```typescript
  export const createExtractedQuestionSchema = z.object({
    questionNumber: z.number().int().min(1),
    questionText: z.string().min(1, '문제 내용을 입력해주세요.'),
    questionType: z.enum(['multiple_choice', 'short_answer', 'essay']),
    options: z.array(z.string()).optional(),
    answer: z.string().optional(),
  })
  ```
  `exam-management.ts` (validation 파일)의 완료 기준 체크리스트에도 `createExtractedQuestionSchema` 테스트 항목 추가 필요.

---

### Step 5 — 신규 이슈 1건

#### SHOULD FIX 2 (신규): `extractQuestionsAction` 내 `academyId` 변수 출처 미명시

Task 5.2 의사코드의 crop Storage 경로 구성 코드:
```typescript
const storagePath = `${academyId}/${pastExamId}/figures/${detailId}-${i}.jpg`
```
여기서 `academyId`가 어디서 오는지 의사코드에서 불명확하다. `past_exam_images`를 조회할 때 `academy_id`를 함께 SELECT하거나, `past_exams` 조회 시 `academy_id`를 가져와야 한다. 의사코드에서 `past_exam_images` 조회는 `id, source_image_url, page_number`만 SELECT하고 있어 `academyId` 변수의 출처가 의사코드에서 확인되지 않는다.

구현자가 이를 놓치면 `academyId`가 undefined인 Storage 경로가 생성될 수 있다.

- **권고**: Task 5.2 의사코드에서 `past_exams` 조회 시 `academy_id`를 SELECT하여 `academyId` 변수에 할당하는 코드를 명시:
  ```
  // past_exams.academy_id를 함께 조회
  const { data: pastExam } = await supabase
    .from('past_exams')
    .select('id, subject, grade, exam_type, academy_id')
    .eq('id', pastExamId)
    .single()
  const academyId = pastExam.academy_id
  ```

---

### Step 6 — 이슈 없음

`bodySizeLimit` 설정이 명확히 추가되었고 "리드 only" 가이드라인 준수. DnD fallback 구조, 메모리 cleanup, 불변 패턴 모두 적절하다.

---

### Step 7 — 신규 이슈 1건

#### SHOULD FIX 3 (신규): `createExtractedQuestionAction` 미임포트 — 수동 추가 흐름 단절

Task 7.9 "수동 추가" 섹션에서 temp-ID 패턴으로 새 빈 카드를 추가하는 흐름이 상세하게 기술되어 있다. "DB 저장 시 서버에서 UUID 생성 → 로컬 temp-ID를 실제 ID로 교체"라고 명시되어 있으나, **[저장] 버튼 클릭 시 호출할 Action이 누락되어 있다**.

`extraction-editor.tsx` Import 의존성 표 (`Task 7.9` 영역):

| import | 출처 | 용도 |
|--------|------|------|
| `updateExtractedQuestion` | `@/lib/actions/exam-management` | 문제 편집 저장 |
| `deleteExtractedQuestion` | `@/lib/actions/exam-management` | 문제 삭제 |
| `confirmExtractedQuestions` | `@/lib/actions/exam-management` | 확정 저장 |

**`createExtractedQuestionAction`이 Import 목록에 없다.** temp-ID 문제를 저장할 때 `updateExtractedQuestion`은 기존 detailId(DB ID)가 필요하므로 사용할 수 없고, `createExtractedQuestionAction`을 import해야 한다.

- **권고**: extraction-editor.tsx Import 의존성 표에 다음 항목 추가:
  ```
  | createExtractedQuestionAction | @/lib/actions/exam-management | 수동 추가 문제 DB 저장 |
  ```
  그리고 수동 추가 흐름 설명에 저장 버튼 클릭 시 처리 로직 명시:
  ```
  temp-ID 문제의 [저장] 클릭:
  1. createExtractedQuestionAction(pastExamId, data) 호출
  2. 성공: 반환된 id로 로컬 state의 temp-ID 교체
  3. 실패: toast.error
  ```

---

### Step 8 — CONSIDER 1건

#### CONSIDER 1 (신규): `createExtractedQuestionAction` 테스트가 수동 테스트 시나리오 C에만 의존

시나리오 C에서 "수동 추가 + 저장" 흐름을 수동 테스트하지만, 단위 테스트 파일(`exam-management.test.ts`)에는 `createExtractedQuestionAction` 테스트 4개가 추가되어 있다 (Task 4.7 참조). 이 부분은 이미 적절히 계획되어 있다.

단, Step 8의 신규 테스트 파일 목록(섹션 1)에 **`createExtractedQuestionAction`이 별도 항목으로 명시되어 있지 않고** `exam-management.test.ts` 항목에 묵시적으로 포함된다. Step 8 검토자가 exam-management.test.ts가 기존 4개 Action + 신규 1개 Action을 포함한다는 사실을 명시적으로 인지할 수 있도록 Step 8 섹션 1 표에 주석 추가가 권장된다.

---

## 이슈 요약 표

| # | Step | 분류 | v1/신규 | 이슈 |
|---|------|------|---------|------|
| 1 | Step 4 Task 4.1 | MUST FIX | 신규 | `createExtractedQuestionSchema` Zod 스키마 정의 누락 |
| 2 | Step 1 Task 1.5 | SHOULD FIX | v1 미반영 | `past_exam_images` UPDATE RLS "미래 확장용" 주석 없음 |
| 3 | Step 5 Task 5.2 | SHOULD FIX | 신규 | `academyId` 변수 출처가 의사코드에서 불명확 |
| 4 | Step 7 Task 7.9 | SHOULD FIX | 신규 | `createExtractedQuestionAction` import 목록 누락 + temp-ID 저장 흐름 미완성 |
| 5 | Step 8 | CONSIDER | 신규 | `createExtractedQuestionAction` 테스트가 파일 목록에서 묵시적 포함 |

---

## Plan Review Completion Checklist

| 항목 | 상태 | 비고 |
|------|------|------|
| 모든 Task의 파일 소유권이 명확하다 | ✅ | 전 Step 소유 역할 명시됨. `createExtractedQuestionAction`도 backend-actions (exam-management.ts) 소유 확인 |
| Task 간 의존성 순서가 정의되었다 | ✅ | Wave 1~5 구조 + Phase A→B→C→D 순서 유지됨. Step 6 의존성(Step 4 + Step 2) 명시됨 |
| 외부 의존성(라이브러리, API)이 명시되었다 | ✅ | sharp, @dnd-kit/*, Gemini Vision API, bodySizeLimit 설정 모두 Wave 3 착수 전 처리 사항으로 명시됨 |
| 에러 처리 방식이 정해졌다 | ✅ | `{ error? }` 반환, try/finally 롤백, Non-blocking Storage 삭제, orphan exam cleanup |
| 테스트 전략이 있다 | ⚠️ | MUST FIX 1 해결 시 완전: `createExtractedQuestionSchema` 테스트 항목 누락 (Task 4.7 `validateImages` 테스트는 있으나 새 스키마 테스트 항목 없음) |
| 이전 Phase 회고(`docs/retrospective/`)의 교훈이 반영되었다 | ✅ | MEMORY.md 교훈 다수 반영 확인 (`.uuid()` → `.min(1)`, Non-blocking 패턴, Zod strip, etc.) |
| 병렬 구현 시 파일 충돌 가능성이 없다 | ✅ | Step 2 "단일 워커 전담" 리스크 표 반영 확인. `createExtractedQuestionAction`은 exam-management.ts 단독 소유 |

**판정: READY**

MUST FIX 1건(`createExtractedQuestionSchema` 누락)은 구현자가 Task 4.1에서 자체 발견 가능한 수준이며, 테스트 케이스(Task 4.7 "Zod 검증 실패 → 에러")가 이미 요구하고 있어 구현 시 자연스럽게 발견된다. Plan 구조적 완성도는 충분하다. SHOULD FIX 3건은 구현 착수 전 확인 권장이지만 구현 단계로 이동 가능.

---

## 추가 권고 (리드에게)

1. **Wave 3 착수 전 체크리스트**:
   - `package.json`에 `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `sharp` 추가
   - `next.config.ts`에 `experimental.serverActions.bodySizeLimit: '100mb'` 추가
   - 두 작업 모두 Shared Files(리드 only) 규칙 대상

2. **SHOULD FIX 1 처리**: Step 1 구현자(db-schema)에게 Task 1.5 `past_exam_images_update_teacher` 정책 위에 미래 확장용 주석 1줄 추가 요청.

3. **SHOULD FIX 3 처리**: Step 7 구현자(frontend-ui)에게 `createExtractedQuestionAction` import 추가 + temp-ID 저장 시 호출 흐름 보완 요청.
