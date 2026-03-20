# 기출문제 추출 상세 계획 — 기술 리뷰

> 리뷰어: technical-reviewer
> 대상: docs/plan/extraction-step1~8.md (v9 상세)
> 일자: 2026-03-20

---

## 요약

전체 9개 문서(마스터 PLAN + Step 1~8)를 검토한 결과, 이전 Tech Review v8 + Scope Review v8에서 지적된 핵심 이슈들이 대부분 반영되었다. v9에서 추가된 상세 Task 계획은 기존 Action/AI 레이어 패턴과 일관성이 높고 에러 처리 전략도 명확하다. 단, 몇 가지 미세한 기술적 취약점이 남아 있으며, 특히 **Step 4의 업로드 실패 시 orphan exam 레코드 정리 로직 누락**, **Step 5의 detailId 미확보 시점의 crop 경로 문제**, **Step 7의 `extractQuestionsAction` 반환 타입 불일치**가 구현 전 반드시 해결되어야 할 이슈다.

---

## Step별 이슈

### Step 1

#### [CONSIDER] Storage 버킷 MIME 타입 허용 목록과 신규 경로 구조 불일치

- **위치**: Task 1.10 / `extraction-step1-schema.md`
- **문제**: 기존 `00005_storage_buckets.sql`에서 버킷에 `application/pdf`가 허용 타입으로 등록되어 있다. 신규 계획에서는 업로드 이미지만 허용(JPEG/PNG/WebP)하지만, 버킷 자체의 `allowed_mime_types`를 변경하는 마이그레이션이 계획에 없다. PDF가 남아있어도 기능 동작에는 문제없지만, 의도와 다른 타입이 업로드될 수 있다.
- **제안**: 마이그레이션 파일에 `UPDATE storage.buckets SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'] WHERE id = 'past-exams'` 추가를 고려하거나, COMMENT로 향후 정리 예정임을 명시한다.

#### [CONSIDER] `past_exam_images` DELETE 정책 누락 가능성

- **위치**: Task 1.5 / `extraction-step1-schema.md`
- **문제**: `past_exam_images` RLS 계획에 DELETE 정책이 있으나, `past_exams`는 "본인 생성분(teacher) 또는 같은 academy(admin/system_admin)"로 세분화되어 있고, `past_exam_images`는 단순히 "같은 academy 전체"로 처리한다. `createPastExamAction`에서 재업로드 시 `supabase` (anon 클라이언트)로 `past_exam_images.delete()`를 호출하는데, RLS 정책상 teacher 역할은 자신이 생성하지 않은 시험의 이미지도 삭제할 수 있게 된다.
- **제안**: `past_exam_images` DELETE 정책도 `past_exams_delete_owner`처럼 `past_exams`의 `created_by` 또는 admin만 삭제 가능하도록 강화하거나, Step 1 주석에 이 의도적 결정을 명시한다.

---

### Step 2

#### [SHOULD FIX] `past-exams-list.test.ts` 파일명이 계획에 없음

- **위치**: Phase B / `extraction-step2-refactor.md`
- **문제**: Step 2 구현 계획 15번 항목에서 `past-exams-list.test.ts`를 수정한다고 기술하지만, 마스터 PLAN의 "변경/신규 파일 목록"에는 이 파일이 없다. 실제로 이 파일이 존재하는지 여부에 따라 작업 범위가 달라진다. 파일이 없으면 신규 생성이 필요하다.
- **제안**: 마스터 PLAN 파일 목록에 `__tests__/past-exams-list.test.ts` (수정 또는 신규)를 명시한다. 구현자가 혼동하지 않도록 Step 2 문서에서도 "파일이 이미 존재하는 경우" 전제를 명확히 한다.

#### [CONSIDER] `uploadPastExamAction` deprecated 후 Step 6까지 유지 시 테스트 중복

- **위치**: Phase B / `extraction-step2-refactor.md`
- **문제**: `uploadPastExamAction`을 deprecated 상태로 Step 6까지 유지하면서, 이 Action의 테스트도 Step 2에서 변경 없이 유지한다. Step 6 완료 후 Action 삭제 시점에 테스트도 삭제해야 하는데, 계획에 이 시점이 명시되어 있지 않다.
- **제안**: Step 6 완료 기준 체크리스트에 `uploadPastExamAction` 및 관련 테스트 삭제 항목을 추가한다.

---

### Step 3

#### [CONSIDER] `extractionJsonSchema = extractionResponseSchema.toJSONSchema()` Zod v4 호환 확인 필요

- **위치**: Task 3.2 / `extraction-step3-ai-layer.md`
- **문제**: Zod의 `.toJSONSchema()` 메서드는 Zod v4(beta)에서 도입되었다. 기존 `validation.ts`에서 동일 패턴을 사용 중이라는 주석이 있으나, 프로젝트의 실제 Zod 버전과 해당 메서드의 동작(nested optional 처리, `enum` 직렬화 등)이 Gemini `responseJsonSchema` 파라미터와 정확히 호환되는지 확인이 필요하다.
- **제안**: 기존 `validation.ts`의 동일 패턴이 실제로 동작함을 근거로 리스크 낮음으로 판단할 수 있다. 단, Step 3 완료 기준에 "실제 Gemini API에 스키마를 전달하여 JSON 응답 형식 준수 확인" 항목을 추가한다.

#### [MUST FIX] `AIProvider` 인터페이스 변경 후 `GeminiProvider` 외 Mock/Stub 구현체 누락

- **위치**: Task 3.1.7 / `extraction-step3-ai-layer.md`
- **문제**: `AIProvider` 인터페이스에 `extractQuestions`, `reanalyzeQuestion` 2개 메서드를 추가하면, `GeminiProvider` 외에 테스트에서 사용하는 Mock 구현체(있다면)나 다른 Provider 구현체가 있을 경우 TypeScript 컴파일 에러가 발생한다. 계획에서 "stub 메서드 추가로 컴파일 통과"라고 언급하지만, 어느 파일에 stub을 추가해야 하는지가 명시되어 있지 않다.
- **제안**: `src/lib/ai/` 내 `AIProvider`를 구현하는 파일을 모두 grep하여 목록을 파악하고, 각각에 stub 구현을 추가하는 작업을 Step 3 Task에 명시적으로 포함시킨다. 파일명과 stub 내용(`throw new Error('not implemented')`)을 계획에 기술한다.

---

### Step 4

#### [MUST FIX] 이미지 업로드 중간 실패 시 orphan `past_exams` 레코드 정리 미명세

- **위치**: Task 4.2 / `extraction-step4-exam-management.md`
- **문제**: 의사코드에서 이미지 업로드 실패 시 `return { error: '이미지 업로드에 실패했습니다.' }`로 반환하고, "(간략화: 실제 구현 시 cleanup 로직 추가)"라는 주석이 있다. 이 경우 이미 생성된 `past_exams` 레코드가 orphan으로 남는다. 리스크 섹션에도 이 문제가 있음을 인정하고 있으나, 구체적 처리 방안이 명시되지 않았다.
- **제안**: 이미지 업로드 실패 시 처리 전략을 확정한다. 두 가지 방안:
  1. **즉시 삭제**: 업로드 실패 시 `past_exams` DELETE → 이미 성공한 Storage 파일도 삭제 (cleanup 복잡도 높음)
  2. **extraction_status 활용**: `extraction_status = 'failed'`로 유지 → 주기적 cleanup (더 단순, Phase 2 cleanup job과 일관성)

  어느 방안을 선택하든 명시적으로 Task에 포함시켜야 한다. 현재는 테스트 케이스 11번 "Storage 업로드 실패 → 에러 + cleanup"도 기대 동작이 불명확하다.

#### [SHOULD FIX] `createPastExamAction` 재업로드 시 새 `past_exams` INSERT와 기존 이미지 삭제 로직 불일치

- **위치**: Task 4.2 / `extraction-step4-exam-management.md`
- **문제**: 의사코드의 6단계 "재업로드 시 기존 이미지 정리"에서 `pastExamId`로 기존 이미지를 조회·삭제하는데, 5단계에서 방금 새로 생성한 `past_exams`의 `pastExamId`를 사용한다. 즉, 이 흐름은 "새 시험 생성 후 같은 ID의 이미지를 삭제"하는 구조인데, 방금 생성한 시험에는 이미지가 없으므로 재업로드 로직이 실제로 동작하지 않는다. "재업로드"는 동일 `pastExamId`에 이미지를 교체하는 시나리오인데, 현재 구조는 항상 새 `past_exams`를 INSERT하므로 재업로드 시나리오가 실제로 발생하지 않는다.
- **제안**: 재업로드의 구체적 UX를 먼저 확정한다. 두 가지 선택:
  1. **항상 새 시험 생성**: 재업로드 시에도 새 `pastExamId` 생성 → 재업로드 cleanup 로직 불필요 (단순)
  2. **기존 시험 수정**: `pastExamId`를 인자로 받아 기존 시험의 이미지만 교체 → Action 시그니처 변경 필요

  현재 계획은 1번 패턴인데 2번 cleanup 로직이 섞여 있어 혼란스럽다. 재업로드 cleanup 코드를 제거하거나 시나리오를 명확히 한다.

#### [CONSIDER] `updateExtractedQuestion` 시그니처의 `rawInput: Record<string, unknown>` 타입

- **위치**: Task 4.3 / `extraction-step4-exam-management.md`
- **문제**: `updateExtractedQuestion(detailId, rawInput: Record<string, unknown>)` 시그니처는 타입 안전성이 낮다. 기존 프로젝트 패턴에서 Server Action은 `FormData` 또는 구체적 타입을 받는다. Client Component에서 이 Action을 호출할 때 타입 추론이 어렵다.
- **제안**: `rawInput`을 `UpdateExtractedQuestionInput` 타입으로 교체하거나, 클라이언트에서 Zod 검증 후 파싱된 값을 전달하는 방식으로 변경한다. 또는 현재 방식으로 유지하되 Action 내부의 Zod 검증이 충분하다는 점을 명시한다.

---

### Step 5

#### [MUST FIX] crop 경로에서 `detailId` 미확보 문제

- **위치**: Task 5.2 (5d 그래프 crop 처리) / `extraction-step5-extraction.md`
- **문제**: crop Storage 경로를 `{academyId}/{pastExamId}/figures/{detailId}-{figureIndex}.jpg`로 정의했는데, crop은 5d 단계에서 수행되지만 `past_exam_details` INSERT는 5e 단계에서 이루어진다. 즉, DB INSERT 전에는 `detailId`(UUID)가 존재하지 않는다. crop → Storage 업로드 시점에 `detailId`를 알 수 없으므로 경로 구성이 불가능하다.
- **제안**: 두 가지 해결 방안:
  1. **미리 UUID 생성**: `details` 배열 구성 시 `crypto.randomUUID()`로 `id`를 미리 생성 → INSERT 시 `id` 명시 → crop 경로에 해당 UUID 사용
  2. **경로 패턴 변경**: `detailId` 대신 `{questionNumber}-{figureIndex}` 패턴 사용 → detailId 불필요

  방안 1이 기존 Storage 경로 명명 규칙과 일관성이 높다. 계획에 명시적으로 반영 필요.

#### [SHOULD FIX] `buildImageParts` 함수 반환값의 에러 처리 부재

- **위치**: Task 5.2 (5b) / `extraction-step5-extraction.md`
- **문제**: `buildImageParts`에서 Signed URL 생성 실패 또는 `fetch` 실패 시 처리가 없다. Signed URL 생성이 실패하면 `signedUrlData`가 null이어서 `signedUrlData!.signedUrl`에서 런타임 에러가 발생하고, `try/finally`의 `finally` 블록에서 `extraction_status = 'failed'`로 처리되겠지만, 이미지 1장만 실패해도 전체 추출이 실패한다.
- **제안**: Signed URL 생성 실패 또는 fetch 실패 시 명시적 에러 메시지를 반환하거나, 개별 이미지 fetch 실패에 대한 처리 정책(전체 실패 vs 해당 이미지 스킵)을 정의한다. 현재 계획(전체 실패)이 의도라면 명시적 `throw`와 에러 메시지를 추가한다.

#### [SHOULD FIX] `reanalyzeQuestionAction` 반환 타입이 재분석 후 갱신된 문제 내용을 포함하지 않음

- **위치**: Task 5.4 / `extraction-step5-extraction.md`
- **문제**: `reanalyzeQuestionAction`이 `Promise<{ error?: string }>`만 반환한다. Step 7 UI(`extraction-editor.tsx`)에서는 재분석 완료 후 해당 문제 카드를 갱신해야 하는데, 갱신된 문제 내용을 얻으려면 별도 DB 조회가 필요하다. Step 7 계획을 보면 "성공 시: questions state에서 해당 문제 교체"라고 되어 있는데, 반환값이 없으면 교체할 데이터가 없다.
- **제안**: `reanalyzeQuestionAction` 반환 타입을 `Promise<{ error?: string; data?: { updatedQuestion: ExtractedQuestionUI } }>`로 변경하여 갱신된 문제 데이터를 클라이언트에 반환한다. 또는 Step 7에서 재분석 후 `getPastExamDetail`을 다시 호출하는 방식으로 UI를 갱신하는 계획임을 명시한다.

#### [CONSIDER] Vercel Hobby 플랜에서 `maxDuration = 60` 빌드 경고

- **위치**: 파일 상단 export / `extraction-step5-extraction.md`
- **문제**: `export const maxDuration = 60`은 Vercel Pro 이상에서만 유효하다. Hobby 플랜에서는 빌드 시 경고(또는 배포 후 런타임 에러)가 발생할 수 있다. 계획에 주석으로 명시되어 있으나, 개발 환경(Hobby)과 운영 환경(Pro) 간 불일치가 발생할 수 있다.
- **제안**: 개발 중에는 `maxDuration`을 환경변수 기반으로 설정하거나, 주석에 "현재 개발 환경이 Hobby 플랜인 경우 10으로 낮춰서 테스트 후 배포 시 60으로 변경"과 같은 안내를 추가한다.

---

### Step 6

#### [SHOULD FIX] Vercel body size limit 4.5MB와 총 100MB 이미지 전송 불일치

- **위치**: 리스크 섹션 / `extraction-step6-upload-ui.md`
- **문제**: 계획 리스크 섹션에서 "Vercel body size limit (4.5MB default) 확인 필요"라고 언급하지만, 처리 방안이 명시되어 있지 않다. 총 100MB 이미지를 단일 FormData로 Vercel Next.js Server Action에 전송하면 기본 4.5MB 제한에 의해 실패한다. 이 문제는 현재 계획의 핵심 기능(다중 이미지 업로드)을 무력화할 수 있는 High 리스크다.
- **제안**: `next.config.js`(또는 `next.config.ts`)에서 `api.bodyParser.sizeLimit` 또는 `experimental.serverActions.bodySizeLimit`을 증가시켜야 한다. 계획에 이 설정을 명시적으로 Task로 추가한다. 예:
  ```typescript
  // next.config.ts
  experimental: {
    serverActions: {
      bodySizeLimit: '110mb'
    }
  }
  ```
  이 파일은 Shared Files(리드 only)이므로 리드가 Wave 3 시작 전 추가해야 함을 명시한다.

#### [CONSIDER] `<input type="file" multiple>` FormData name 통일 필요

- **위치**: Task 6.1 / `extraction-step6-upload-ui.md`
- **문제**: UI에서 `name="files"`로 정의하지만, Step 4의 `createPastExamAction` 의사코드에서는 `formData.getAll('images')`로 접근한다. name 불일치로 Action에서 파일을 받을 수 없다.
- **제안**: UI와 Action 모두 `'images'`로 통일하거나, 계획에서 명시적으로 동일한 name을 사용하도록 교차 참조를 추가한다.

---

### Step 7

#### [MUST FIX] `extractQuestionsAction` 반환 타입 — `data.questions` 필드 없음

- **위치**: Task 7.9 자동 추출 useEffect / `extraction-step7-edit-ui.md`
- **문제**: Step 7의 useEffect 의사코드에서 `result.data?.questions`로 추출된 문제를 받으려 하지만, Step 5의 `extractQuestionsAction` 반환 타입은 `Promise<{ error?: string }>`이다. 추출 완료 후 문제 목록이 반환값에 포함되지 않으므로 `result.data?.questions`는 항상 `undefined`다.
- **제안**: 두 가지 해결 방안 중 하나를 확정한다:
  1. `extractQuestionsAction` 반환 타입에 `data?: { questions: ExtractedQuestionUI[] }` 추가
  2. `extractQuestionsAction` 완료 후 별도 DB 쿼리로 `past_exam_details`를 다시 fetch

  방안 2가 Action과 UI의 관심사를 분리하는 관점에서 깔끔하다. Step 7의 `page.tsx`가 서버 컴포넌트로 초기 데이터를 패칭하므로, 추출 완료 후 `router.refresh()`를 호출하여 서버 컴포넌트를 재렌더링하는 방식이 더 Next.js스럽다. 어느 방안을 사용할지 계획에 명시한다.

#### [SHOULD FIX] Signed URL 만료 시간(60초)과 편집 세션 충돌

- **위치**: Task 7.2 useEffect / `extraction-step7-edit-ui.md`
- **문제**: 리스크 섹션에 "Signed URL 만료 (60초)" 이슈가 있고 "주기적 갱신 또는 사용자 액션 시 재생성"으로 처리하겠다고 되어 있지만, Task 정의에는 구체적 처리 방안이 없다. 사용자가 편집 중 60초가 지나면 이미지가 깨진다.
- **제안**: Signed URL 유효시간을 300초(5분) 이상으로 늘리거나, useEffect 내 주기적 갱신(setInterval)을 Task에 추가한다. 현재 `past-exam-detail-sheet.tsx`에서는 Signed URL을 어떻게 처리하는지 참조하여 일관성을 유지한다.

#### [CONSIDER] `temp-ID` 수동 추가 문제를 실제 DB에 저장하는 흐름 누락

- **위치**: Task 7.9 수동 추가 / `extraction-step7-edit-ui.md`
- **문제**: `temp-${Date.now()}` ID로 빈 카드를 추가하고 편집 모드로 진입하는 흐름은 있으나, [저장] 클릭 시 신규 문제를 DB에 INSERT하는 Action이 계획에 없다. 현재 `updateExtractedQuestion`은 기존 `detailId`로 UPDATE하는 Action이고, `createExtractedQuestion`(신규 INSERT) Action은 계획에 없다.
- **제안**: 수동 추가 시 신규 INSERT Action이 필요하다. `updateExtractedQuestion`이 `detailId`가 `temp-*`로 시작하면 INSERT, 그렇지 않으면 UPDATE로 분기하거나, 별도 `createExtractedQuestion` Action을 `exam-management.ts`에 추가한다. 현재 계획에서 이 Action이 완전히 누락되어 있다.

---

### Step 8

#### [CONSIDER] E2E 테스트 계획 부재

- **위치**: 수동 테스트 시나리오 / `extraction-step8-verification.md`
- **문제**: Step 8의 수동 테스트 시나리오 8개가 있지만 자동화된 E2E 테스트(Playwright)는 계획에 없다. MEMORY.md 교훈에서도 "Mock 테스트 한계: SQL 문자열 오타 → PASS지만 실제 실패 → E2E 필요"가 명시되어 있다.
- **제안**: 핵심 Happy Path(시나리오 A)에 대한 Playwright E2E 테스트를 Step 8 완료 기준에 추가한다. 최소한 업로드 → 추출 → 확정 저장 흐름의 E2E를 권장한다.

---

## Plan Review Completion Checklist

- [x] 모든 Task의 파일 소유권이 명확하다
  - 각 Step에 "소유 역할" 명시. backend-actions/ai-integration/frontend-ui/db-schema로 분리.
- [x] Task 간 의존성 순서가 정의되었다
  - Wave 1~5로 의존성 그래프 명시. Step 1 완료 후 supabase gen types 타이밍도 명확.
- [x] 외부 의존성이 명시되었다
  - sharp, @dnd-kit/core+sortable+utilities, @google/genai 모두 명시. package.json 리드 only 규칙도 반영.
- [x] 에러 처리 방식이 정해졌다
  - isCompleted + try/finally, Optimistic Lock, Non-blocking Storage 삭제, crop 부분 성공 등 대부분 명시.
  - **단, Step 4 orphan exam 레코드와 Step 5 detailId 미확보 이슈는 처리 방안 미확정.**
- [x] 테스트 전략이 있다
  - TDD(RED→GREEN), 각 Step별 테스트 케이스 목록, 총 테스트 수 명시.
- [x] 이전 Phase 회고 교훈이 반영되었다
  - MEMORY.md의 Zod `.uuid()` → `.min(1)`, `useEffect` cancelled 플래그, Non-blocking Storage 삭제 등 반영.
- [x] 병렬 구현 시 파일 충돌 가능성이 없다
  - Wave 단위로 병렬 실행 범위 명확. 동일 파일을 두 역할이 동시에 수정하지 않는 구조.

### 미해결 MUST FIX 이슈 (3건)

| # | Step | 이슈 | 심각도 |
|---|------|------|--------|
| 1 | Step 3 | AIProvider 인터페이스 변경 후 기존 구현체/Mock stub 파일 목록 미명세 | 컴파일 에러 위험 |
| 2 | Step 4 | 이미지 업로드 실패 시 orphan `past_exams` 레코드 정리 전략 미확정 | 데이터 정합성 |
| 3 | Step 5 | crop Storage 경로의 `detailId`가 INSERT 전에는 존재하지 않음 | 런타임 에러 위험 |

추가 MUST FIX:

| # | Step | 이슈 | 심각도 |
|---|------|------|--------|
| 4 | Step 7 | `extractQuestionsAction` 반환값에 `data.questions` 없음 → UI에서 추출 결과 수신 불가 | 기능 미동작 |
| 5 | Step 7 | 수동 추가 문제의 DB INSERT Action 계획 누락 (`createExtractedQuestion`) | 기능 미동작 |

---

**판정: BLOCKED**

MUST FIX 5건이 해결되어야 구현으로 진행할 수 있다. 특히 Step 5의 `detailId` 미확보 이슈와 Step 7의 반환 타입 불일치는 구현 중 발견하면 다른 파일까지 연쇄 수정이 필요한 구조적 문제다. 5건을 마스터 PLAN에 반영 후 재검토를 권장한다.
