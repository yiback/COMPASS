# auth-helper 통합 리팩토링 — 테스트 커버리지 리뷰

**역할**: test-reviewer
**검토 대상**: `getCurrentUser()` 통합 리팩토링 후 테스트 커버리지
**날짜**: 2026-03-25
**총 테스트**: 1444 PASS

---

## 요약 판정

전체적으로 리팩토링 후 테스트 구조는 건실하다.
`helpers.test.ts`의 단독 경로 커버리지와 호출부의 `vi.mock('../helpers')` 패턴 적용은 일관적이다.
다만, **일부 Action 파일에서 `academyId null` 시나리오 테스트가 누락**되어 있고,
**`schools.ts`와 `questions.ts` (detail)의 mock 구조에 잠재적 주의 사항**이 있다.

---

## 이슈 목록

### HIGH

#### H-1. `users.test.ts` — `getUserList`, `changeUserRole`, `toggleUserActive`에서 `academyId null` 시나리오 미검증

**위치**: `src/lib/actions/__tests__/users.test.ts`
**현상**: `users.ts`는 `getUserList`, `changeUserRole`, `toggleUserActive` 세 함수 모두에서 `!profile.academyId` 분기가 존재한다 (각각 line 88, 164, 267). 그러나 `users.test.ts`에는 `academyId: null`로 설정한 시나리오 테스트가 한 건도 없다. `mockAuthAs` 함수는 `academyId` 기본값이 `'academy-1'`로만 설정되어 있다.
**영향**: system_admin이 `/admin/users`에 접근할 경우 `소속 학원이 없습니다.` 에러를 받아야 하는데, 이 경로가 테스트 그물에서 누락된다. users.ts는 가장 많은 역할 체크 로직을 포함하는 파일이므로 누락 가중치가 크다.
**분류**: HIGH

---

#### H-2. `exam-management.test.ts` — 모든 Action 함수에서 `academyId null` 시나리오 미검증

**위치**: `src/lib/actions/__tests__/exam-management.test.ts`
**현상**: `exam-management.ts`는 `createPastExamAction`, `updateExtractedQuestionAction`, `deleteExtractedQuestionAction`, `confirmExtractedQuestionsAction`, `addManualQuestionAction` 다섯 함수 모두에서 `!profile.academyId` 분기가 존재한다 (line 77, 233, 285, 323, 372). 테스트에 `academyId: null` 케이스가 한 건도 없다.
**분류**: HIGH

---

#### H-3. `schools.test.ts` — `academyId null` 시나리오 미검증

**위치**: `src/lib/actions/__tests__/schools.test.ts`
**현상**: `schools.ts`는 `createSchool`, `updateSchool`, `deleteSchool`에 `academyId null` 분기가 없지만, `getSchoolList`와 `getSchoolById`는 인증 통과 후 academy_id 필터를 사용한다. 더불어 `schools.ts` 인증 패턴(`authError ?? '인증 실패'`)에서 `academyId null` 분기가 없음에도, 실제로 academy_id 기반 쿼리가 실행되므로 system_admin이 호출하면 null이 DB 필터로 들어간다. 테스트 미검증.
**분류**: HIGH

---

### MEDIUM

#### M-1. `extract-questions.test.ts` — `academyId null` 시나리오 미검증

**위치**: `src/lib/actions/__tests__/extract-questions.test.ts`
**현상**: `extract-questions.ts`의 `extractQuestionsAction`, `resetExtractionAction`, `reanalyzeQuestionAction`에 `!profile.academyId` 분기가 있다 (line 98, 282, 368). `reanalyze-question.test.ts`를 포함해 두 파일 모두 `academyId: null` 케이스가 없다.
**분류**: MEDIUM (teacher/admin만 사용하는 기능이므로 현실적 리스크가 낮음)

---

#### M-2. `questions-detail.test.ts` — `academyId null` 시나리오 미검증

**위치**: `src/lib/actions/__tests__/questions-detail.test.ts`
**현상**: `getQuestionDetail`은 `!profile.academyId` 분기가 있다 (questions.ts line 210). 테스트에 해당 케이스가 없다. `questions-list.test.ts`는 `mockProfileNoAcademy()`가 있어 커버되나, detail 테스트는 누락.
**분류**: MEDIUM

---

#### M-3. `helpers.test.ts` — 실제 `null` academyId non-system_admin 케이스 미검증

**위치**: `src/lib/actions/__tests__/helpers.test.ts`
**현상**: helpers.ts는 academyId null을 에러로 처리하지 않는다(SRP — 역할 체크는 호출부 책임). 이는 의도적 설계이며 테스트(line 106-118)도 system_admin의 null 정상 반환을 검증한다. 하지만 `admin` 역할에서 `academy_id: null`인 경우(DB 데이터 이상) — 즉 non-system_admin이 null academy_id를 가지는 케이스 — 를 helpers.ts 단위에서 어떻게 처리하는지 테스트가 없다. 현재는 정상 반환하여 호출부로 위임되는 구조인데, 이 경로가 명시적으로 검증되지 않음.
**분류**: MEDIUM

---

#### M-4. `past-exams.test.ts` — `academyId null` 시나리오 미검증 (`uploadPastExamAction`)

**위치**: `src/lib/actions/__tests__/past-exams.test.ts`
**현상**: `uploadPastExamAction`은 `!profile.academyId` 분기가 있다 (past-exams.ts line 139). `past-exams-list.test.ts`에는 해당 케이스가 있으나, `past-exams.test.ts`(upload Action)에는 없다.
**분류**: MEDIUM

---

### LOW

#### L-1. `questions-list.test.ts` — `mockProfileNoAcademy()`가 student role로 설정됨

**위치**: `src/lib/actions/__tests__/questions-list.test.ts:53`
**현상**: `mockProfileNoAcademy()`가 `role: 'teacher'`가 아니라 `role: 'student'`로 설정되어 있어, 역할 체크와 academyId null 체크 중 어느 경로로 에러가 발생하는지 불명확하다. `getQuestionList`는 역할 체크가 없으므로 실제로는 academyId null에서 걸리지만, 의도를 명확히 하려면 teacher/admin 역할로 설정하는 것이 더 정확한 테스트다.
**분류**: LOW

---

#### L-2. `past-exams-list.test.ts` — `mockProfileNoAcademy()`가 student role로 설정됨

**위치**: `src/lib/actions/__tests__/past-exams-list.test.ts:63-66`
**현상**: L-1과 동일 패턴. `academyId null` 시나리오에서 student role을 사용하고 있어, academy_id null이 아닌 역할 체크에서 걸릴 가능성이 있다. `getPastExamList`는 역할 무관하게 academyId null을 체크하므로 기능적으로는 동작하나, 테스트 의도가 모호하다.
**분류**: LOW

---

#### L-3. `auth.test.ts` — `getCurrentUser()` 의존 없음 (정상, 주목 필요 없음)

**위치**: `src/lib/actions/__tests__/auth.test.ts`
**현상**: `auth.ts`는 `getCurrentUser()`를 사용하지 않고 직접 Supabase auth를 호출한다. 리팩토링 영향 없음. 기존 supabase mock이 그대로 유지되는 것이 올바른 구조.
**분류**: 이슈 아님 (확인 사항)

---

#### L-4. 에러 메시지 일관성 — 일부 Action에서 fallback 메시지 불일치

**위치**: `users.ts:87`, `questions.ts:126`, `schools.ts:38`, `academies.ts:42`, `extract-questions.ts:97`
**현상**: `getCurrentUser()`가 `error` 없이 `profile` null을 반환할 수 없는 구조임에도, 호출부에서 `error ?? '인증 실패'` fallback을 사용한다. helpers.ts는 항상 `error`를 설정하므로 `'인증 실패'`는 사실상 도달 불가능한 코드다. 테스트도 이 fallback을 검증하지 않는다. 코드 품질상 불필요한 분기이나, 런타임 안전성 측면에서는 문제없다.
**분류**: LOW

---

## 긍정 사항 (잘 된 부분)

1. **helpers.test.ts 단독 커버리지 완전**: 미인증, 인증에러, 프로필없음, 프로필에러, 잘못된role, system_admin null, admin/teacher/student 정상 — 10개 케이스 전부 커버. DB 쿼리 인수(`select('id, role, academy_id')`, `eq('id', userId)`) 검증도 포함.

2. **`vi.mock('../helpers')` 패턴 일관 적용**: 검토한 14개 테스트 파일 모두 `getCurrentUser`를 헬퍼 mock으로 대체. 기존 supabase auth mock과 프로필 DB mock이 `getCurrentUser` mock으로 교체됨.

3. **역할 체크 호출부 이동 후 테스트 유지**: academies.test.ts에서 teacher/student 권한 거부가 검증되고, users.test.ts에서 teacher/student 차단이 명확히 검증된다.

4. **system_admin 경로 일부 커버**: `academies.test.ts`의 `getMyAcademy` system_admin null 케이스, `generate-questions.test.ts`의 academy_id null 케이스, `save-questions.test.ts`의 academy_id null 케이스가 모두 검증됨.

5. **에러 메시지 일관성 양호**: 헬퍼에서 반환하는 `'인증이 필요합니다.'`, `'프로필을 찾을 수 없습니다.'`가 호출부 테스트에서 동일 문자열로 검증됨.

---

## 판정 요약

| 심각도 | 개수 | 내용 |
|--------|------|------|
| CRITICAL | 0 | - |
| HIGH | 3 | users, exam-management, schools — academyId null 테스트 누락 |
| MEDIUM | 4 | extract-questions, questions-detail, past-exams upload, helpers non-system_admin null |
| LOW | 4 | role 설정 모호성, fallback 메시지 도달 불가 코드 |

> 전체 1444 PASS 상태이며, 리팩토링 목표인 mock 구조 통일은 달성됨.
> HIGH 이슈 3건은 `academyId null` 실전 방어 경로의 미검증으로, 기능상 버그가 아닌 테스트 누락이다.
