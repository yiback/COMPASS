# 기출문제 추출 — 보안 리뷰 v2 (재검토)

> 리뷰어: security-reviewer
> 일자: 2026-03-20
> 이전 리뷰: `docs/reviews/extraction-security-review.md`

---

## 요약

이전 리뷰에서 지적한 MUST FIX 2건이 **완전히 수정**되었음을 확인했다. 수정 과정에서 새로운 HIGH 이슈는 발생하지 않았다. SHOULD FIX 3건 중 1건은 완전 수정, 2건은 미수정 상태다. 신규 발견된 MEDIUM 이슈 2건을 추가한다.

---

## MUST FIX 수정 확인

### [완료] MUST FIX 1: IDOR — academy_id 명시적 필터 누락

이전 리뷰 대상: `extractQuestionsAction`, `resetExtractionAction`, `reanalyzeQuestionAction`, `confirmExtractedQuestionsAction`

**확인 결과: 완전 수정됨**

`extract-questions.ts` 내 모든 UPDATE/DELETE 쿼리에 `.eq('academy_id', profile.academyId)` 필터가 추가되었다.

| 위치 | 수정 전 | 수정 후 |
|------|---------|---------|
| `extractQuestionsAction` Optimistic Lock UPDATE (ln 179-196) | 누락 | `.eq('academy_id', profile.academyId)` 추가 + 주석 포함 |
| `extractQuestionsAction` details DELETE (ln 204-210) | 누락 | `.eq('academy_id', pastExam.academy_id)` 추가 |
| `extractQuestionsAction` completed UPDATE (ln 370-377) | 누락 | `.eq('academy_id', profile.academyId)` 추가 |
| `extractQuestionsAction` failed 롤백 UPDATE (ln 383-388) | 누락 | `.eq('academy_id', profile.academyId)` 추가 |
| `resetExtractionAction` details SELECT (ln 424-428) | 누락 | `.eq('academy_id', profile.academyId)` 추가 |
| `resetExtractionAction` details DELETE (ln 459-463) | 누락 | `.eq('academy_id', profile.academyId)` 추가 |
| `resetExtractionAction` status UPDATE (ln 467-471) | 누락 | `.eq('academy_id', profile.academyId)` 추가 |
| `reanalyzeQuestionAction` detail SELECT (ln 509-513) | 누락 | `.eq('academy_id', profile.academyId)` 추가 |
| `reanalyzeQuestionAction` detail UPDATE (ln 574-594) | 누락 | `.eq('academy_id', profile.academyId)` 추가 |

SHOULD FIX였던 `reanalyzeQuestionAction`의 `profile` 미사용 문제도 함께 해소되었다. `getCurrentUserWithRole()` 반환값에서 `profile`을 수신하고 이후 쿼리에 일관되게 사용한다.

이전 리뷰에서 지적한 `confirmExtractedQuestionsAction`(exam-management.ts ln 396-407)은 RLS 의존 구조를 유지하고 있다. 상세 내용은 아래 신규 이슈 항목 참조.

---

### [완료] MUST FIX 2: 파일 MIME 타입 — 클라이언트 선언값 신뢰

이전 리뷰 대상: `src/lib/validations/exam-management.ts`

**확인 결과: 완전 수정됨**

```typescript
// exam-management.ts ln 26-27
/** 허용 파일 확장자 — MIME 위조 방어 (클라이언트 선언값만으로는 불충분) */
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const
```

`validateImages()` 함수(ln 74-123) 내부에서 MIME 타입 검사(ln 97-103)에 더해 확장자 whitelist 검사(ln 104-111)가 추가되어 이중 검증이 구현되었다.

```typescript
// 확장자 검사 — MIME 위조 방어 (이중 검증) (ln 104-111)
const ext = file.name.toLowerCase().split('.').pop()
if (
  !ext ||
  !ALLOWED_EXTENSIONS.includes(`.${ext}` as (typeof ALLOWED_EXTENSIONS)[number])
) {
  return { valid: false, error: '허용된 이미지 형식: JPEG, PNG, WebP' }
}
```

MIME 타입과 확장자 모두 통과해야 업로드가 허용된다. 이중 검증 의도가 주석으로 명확히 기록되어 있어 유지보수 시 제거될 위험이 낮다.

---

## SHOULD FIX 현황

### [미수정] SHOULD FIX: updateExtractedQuestionSchema + createExtractedQuestionSchema — options/answer 길이 제한 없음

**현재 상태**: 미수정

`exam-management.ts` ln 127-150:
```typescript
options: z.array(z.string()).optional(),   // 배열 개수·개별 길이 제한 없음
answer: z.string().optional(),             // 길이 제한 없음
questionText: z.string().min(1, ...),      // 상한 없음
```

이전 리뷰 제안(`options: z.array(z.string().max(500)).max(10)`, `answer: z.string().max(1000)`, `questionText: z.string().max(5000)`)이 적용되지 않았다. JSONB 컬럼 과부하 가능성은 여전히 존재한다.

---

### [미수정] SHOULD FIX: feedback 프롬프트 인젝션 — sanitize 미적용

**현재 상태**: 미수정

`src/lib/validations/extract-questions.ts` ln 33:
```typescript
feedback: z.string().max(500).optional(),
```

500자 제한은 유지되나 HTML 태그 또는 프롬프트 인젝션 패턴 필터링이 없다. `extract-questions.ts` ln 563-570에서 feedback이 AI 프롬프트에 직접 삽입된다.

---

### [완료] SHOULD FIX: reanalyzeQuestionAction — profile 미사용 (IDOR 방어 불완전)

**현재 상태: 수정됨** (MUST FIX 1 수정과 함께 해소)

`getCurrentUserWithRole()` 반환값의 `profile`이 `reanalyzeQuestionAction`에서 이제 명시적으로 사용된다:
- detail SELECT: `.eq('academy_id', profile.academyId)` (ln 513)
- detail UPDATE: `.eq('academy_id', profile.academyId)` (ln 594)

---

## 신규 발견 이슈

### [MEDIUM] `confirmExtractedQuestionsAction` — academy_id 명시적 필터 누락 (RLS 단독 의존)

> **SHOULD FIX**

- **파일**: `src/lib/actions/exam-management.ts:365-408`
- **문제**: 이전 리뷰에서 보완 필요를 지적했으나 수정되지 않았다. `confirmExtractedQuestionsAction`의 모든 쿼리가 `academy_id` 명시 필터 없이 RLS만 의존한다.

  ```typescript
  // ln 379-386: past_exams 조회 시 academy_id 필터 없음
  const { data: exam } = await supabase
    .from('past_exams')
    .select('id, extraction_status')
    .eq('id', pastExamId)   // ← .eq('academy_id', ...) 없음
    .single()

  // ln 396-401: past_exam_details UPDATE 시 academy_id 필터 없음
  const { data: updated } = await supabase
    .from('past_exam_details')
    .update({ is_confirmed: true, ... })
    .eq('past_exam_id', pastExamId)   // ← .eq('academy_id', ...) 없음
    .eq('is_confirmed', false)
  ```

  더불어 이 함수는 `getCurrentUserWithRole()`에서 `profile`을 받지 않아(`{ error: authError }` 구조 분해만 함) 설령 필터를 추가하려 해도 `profile.academyId`를 사용할 수 없는 구조다.

- **영향**: extract-questions.ts는 9곳 모두 수정된 반면 exam-management.ts의 confirm 액션만 일관성이 결여되어 있다. Defense in Depth 관점에서 RLS 단독 방어선이 취약해지는 구조.
- **제안**:
  1. `getCurrentUserWithRole()` 반환값에서 `profile`도 수신: `const { error: authError, profile } = await getCurrentUserWithRole()`
  2. `past_exams` 조회에 `.eq('academy_id', profile.academyId)` 추가
  3. `past_exam_details` UPDATE에 `.eq('academy_id', profile.academyId)` 추가

---

### [MEDIUM] `updateExtractedQuestionAction` + `deleteExtractedQuestionAction` — academy_id 명시적 필터 누락

> **SHOULD FIX**

- **파일**: `src/lib/actions/exam-management.ts:280-363`
- **문제**: 두 함수 모두 `detailId` 존재 확인 및 UPDATE/DELETE 쿼리에 `academy_id` 필터가 없다.

  ```typescript
  // updateExtractedQuestionAction ln 300-304: 존재 확인 시 academy_id 없음
  const { data: detail } = await supabase
    .from('past_exam_details')
    .select('id')
    .eq('id', detailId)   // ← .eq('academy_id', ...) 없음
    .single()

  // ln 311-320: UPDATE 시 academy_id 없음
  const { error: updateError } = await supabase
    .from('past_exam_details')
    .update({ ... })
    .eq('id', detailId)   // ← .eq('academy_id', ...) 없음

  // deleteExtractedQuestionAction ln 342-346: 존재 확인 시 academy_id 없음
  const { data: detail } = await supabase
    .from('past_exam_details')
    .select('id')
    .eq('id', detailId)   // ← .eq('academy_id', ...) 없음

  // ln 353-356: DELETE 시 academy_id 없음
  const { error: deleteError } = await supabase
    .from('past_exam_details')
    .delete()
    .eq('id', detailId)   // ← .eq('academy_id', ...) 없음
  ```

  두 함수 모두 `getCurrentUserWithRole()`에서 `{ error: authError }`만 구조 분해하므로 `profile.academyId`가 없는 상태다.

- **영향**: extract-questions.ts에서 수정된 동일 패턴(9곳)이 exam-management.ts의 수정/삭제 액션에는 적용되지 않아 일관성이 결여된다. RLS가 실질적인 방어선이나, Defense in Depth 원칙 위반.
- **제안**: `getCurrentUserWithRole()` 반환값에서 `profile` 수신 후 모든 쿼리에 `.eq('academy_id', profile.academyId)` 추가.

---

## CONSIDER 현황

### [유지] CONSIDER: raw_ai_response 노출 범위

현재 `edit/page.tsx` SELECT 컬럼 목록(ln 103-113)에 `raw_ai_response`가 포함되지 않아 클라이언트로 노출되지 않는다. 올바른 패턴 유지 중. 추가 조치 불필요.

### [부분 개선] CONSIDER: createPastExamAction 롤백 불완전

`past_exam_images` INSERT 실패 시 `past_exams` 레코드 삭제가 여전히 없다(ln 267-273). 그러나 이미지 **업로드** 실패 시에는 `past_exams` 삭제가 구현되었다(ln 252-254). DB INSERT 실패 경우만 롤백이 누락된 상태다.

---

## 체크리스트

| 항목 | v1 상태 | v2 상태 | 비고 |
|------|---------|---------|------|
| RLS 정책 완전성 | ✅ | ✅ | 3개 테이블 모두 커버 |
| 인증/인가 | ⚠️ | ✅ | `'use server'` + `getUser()` + academy_id 필터 일관 적용 (extract-questions.ts 기준) |
| 입력 검증 | ⚠️ | ⚠️ | 확장자 이중검증 추가, options 길이 제한은 미수정 |
| IDOR 방지 (extract-questions.ts) | ⚠️ | ✅ | 9곳 모두 수정 완료 |
| IDOR 방지 (exam-management.ts) | ⚠️ | ⚠️ | confirm/update/delete 액션 미수정 |
| Storage 보안 | ✅ | ✅ | 경로 1번째 컴포넌트 = academyId |
| SQL Injection | ✅ | ✅ | 쿼리 빌더 사용 |
| `'use server'` 선언 | ✅ | ✅ | 모든 Server Action 파일 유지 |
| 에러 정보 노출 없음 | ✅ | ✅ | 사용자 친화적 메시지만 반환 |
| 프롬프트 인젝션 방어 | ⚠️ | ⚠️ | feedback sanitize 미적용 |
| 파일 타입 검증 | ⚠️ | ✅ | MIME + 확장자 이중 검증 완료 |
| raw_ai_response 노출 | ✅ | ✅ | edit/page.tsx SELECT 미포함 |

---

## 판정: **CONDITIONALLY READY**

MUST FIX 2건이 완전히 수정되어 구현 단계 완료 조건을 충족한다. 단, 신규 발견 SHOULD FIX 2건(exam-management.ts의 confirm/update/delete 액션 academy_id 필터 누락)은 extract-questions.ts 수정 패턴의 일관성 적용 차원에서 조속히 보완을 권장한다.

| 우선순위 | 이슈 | 상태 | 조치 |
|---------|------|------|------|
| 1 | IDOR — extract-questions.ts 9곳 academy_id 필터 | ✅ 완료 | |
| 2 | MIME 위조 — 확장자 whitelist 이중 검증 | ✅ 완료 | |
| 3 (신규) | IDOR — confirmExtractedQuestionsAction academy_id 필터 누락 | ⚠️ 미수정 | SHOULD FIX |
| 4 (신규) | IDOR — update/deleteExtractedQuestionAction academy_id 필터 누락 | ⚠️ 미수정 | SHOULD FIX |
| 5 | options/answer/questionText 길이 제한 | ⚠️ 미수정 | SHOULD FIX |
| 6 | feedback 프롬프트 인젝션 sanitize | ⚠️ 미수정 | SHOULD FIX |
| 7 | raw_ai_response 노출 범위 | ✅ 양호 | CONSIDER |
| 8 | createPastExamAction 롤백 (DB INSERT 실패 시) | ⚠️ 부분 개선 | CONSIDER |
