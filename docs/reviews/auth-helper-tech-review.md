# technical-reviewer: auth-helper-consolidation.md 기술 검토

> 검토일: 2026-03-25
> 검토 대상: `docs/plan/auth-helper-consolidation.md`
> 검토자: technical-reviewer

---

## 요약 판정

**READY** — MUST FIX 0건. SHOULD FIX 2건은 구현 중 처리 권장.

---

## 이슈 목록

### HIGH: `exam-management.ts`와 `generate-questions.ts`, `save-questions.ts` PLAN 누락

**등급**: HIGH
**근거**: PLAN 섹션 3의 "수정 파일 14개" 목록에 `exam-management.ts`와 해당 테스트 파일이 빠져 있다.

실제 파일을 확인하면 `src/lib/actions/exam-management.ts` 64~120줄에 `getCurrentUserWithRole()`이 독립적으로 정의되어 있고, `extract-questions.ts` 66~108줄에도 같은 이름(`getCurrentUserWithRole`)의 헬퍼가 별도로 선언되어 있다. PLAN의 변형 목록(섹션 1)은 7개를 나열하지만 실제로는 `exam-management.ts`까지 포함하면 **8개 변형**이 존재한다.

```
src/lib/actions/exam-management.ts:83:async function getCurrentUserWithRole()
src/lib/actions/extract-questions.ts:68:async function getCurrentUserWithRole()
```

PLAN이 `exam-management.ts`를 누락한 채로 구현하면, 해당 파일의 헬퍼는 통합되지 않고 중복이 남는다. 또한 `generate-questions.ts`, `save-questions.ts`에도 인증 헬퍼가 있을 가능성이 있으므로 구현 전 전수 확인이 필요하다.

**권장 조치 (SHOULD FIX로 격하 가능)**: `exam-management.ts` + `__tests__/exam-management.test.ts`를 Task 목록에 추가. `generate-questions.ts`, `save-questions.ts` 헬퍼 유무 확인 후 포함 여부 결정.

---

### MEDIUM: `system_admin`의 `academyId: string | null` 반환 — 호출부 타입 안전성

**등급**: MEDIUM
**근거**: PLAN의 `ActionProfile` 인터페이스는 `academyId: string | null`을 선언한다. 그러나 기존 7개 헬퍼 중 `users.ts:89`, `questions.ts`, `past-exams.ts`, `extract-questions.ts:93-95`는 모두 `!profile.academy_id` 조건을 내부에서 처리하고 **`string | null`이 아닌 `string`을 반환**한다.

`src/lib/actions/users.ts:48`:
```typescript
interface CurrentUserProfile {
  readonly academyId: string  // null 없음
}
```

통합 후 `ActionProfile.academyId`가 `string | null`이 되면, 기존에 `profile.academyId`를 `string`으로 직접 사용하던 모든 호출부에서 **타입 에러** 또는 **null 체크 추가**가 필요하다. 예: `academies.ts:191`의 `.eq('id', academyId)`, `exam-management.ts`의 Storage 경로 생성 등.

`academyId: string | null` 반환을 허용하는 경우 **호출부 7~8곳에서 null 체크가 추가**되어야 하며 코드가 복잡해진다. 반면 기존처럼 `null`을 내부에서 에러로 차단하고 `academyId: string`만 반환하면 호출부는 더 단순하다.

**권장 조치**: `getCurrentUser()` 내부에서 `system_admin` 여부와 무관하게 `!profile.academy_id`이면 에러를 반환하고, `ActionProfile.academyId`를 `string`(null 불가)으로 선언하는 것을 검토. 단, system_admin이 academy_id 없이 사용하는 Action이 있다면 별도 헬퍼를 유지하거나 overload 패턴 적용.

---

### MEDIUM: `achievement-standards.ts`의 `checkSystemAdminRole()`은 `getCurrentUser()`와 매핑 불일치

**등급**: MEDIUM
**근거**: PLAN 섹션 4 Task 8은 `achievement-standards.ts`의 `checkAuthenticated()`만 교체 대상으로 명시하지만, 실제 파일에는 **두 개의 헬퍼**가 존재한다.

- `checkAuthenticated()` — 인증 여부만 확인 (lines 58~70)
- `checkSystemAdminRole()` — system_admin 역할 확인 (lines 33~55)

`checkSystemAdminRole()`은 PLAN 변형 목록(섹션 1 #7)에 `checkAuthenticated()`로만 기재되어 있어 `checkSystemAdminRole()`의 처리 방식이 명시되어 있지 않다. 구현자가 `checkSystemAdminRole()`을 단순 제거하고 `getCurrentUser() + role 체크` 패턴으로 교체해야 함을 유추해야 한다.

**권장 조치**: 섹션 1 #7을 `checkAuthenticated() + checkSystemAdminRole()` 두 개 헬퍼로 수정하거나, Task 8 특이사항에 "두 헬퍼 모두 제거 대상, checkSystemAdminRole → getCurrentUser + role 체크로 교체" 명시.

---

### LOW: 기존 테스트 mock 전환 위험 — `vi.mock('@/lib/supabase/server')` 깊은 체이닝

**등급**: LOW
**근거**: 현재 테스트들은 `mockSupabaseClient.auth.getUser` + `mockSupabaseClient.from('profiles')` 를 각 테스트 파일에서 직접 설정한다(`users.test.ts:18~66`, `academies.test.ts:14~80`, `schools.test.ts:22~60`).

`helpers.ts`를 도입하면 PLAN이 제안하는 대로 `vi.mock('./helpers')` + `getCurrentUser` 직접 mock으로 전환된다. 이 전환은 각 테스트 파일에서 `auth.getUser + profiles.from` 두 mock 설정을 제거하고 단일 mock으로 단순화되므로 **테스트 코드가 실제로 더 간결해진다**. 기술적 위험은 낮다.

단, `extract-questions.test.ts`와 `exam-management.test.ts`는 `vi.mock('@/lib/supabase/server')`를 함수 단위로 분리하는 복잡한 체이닝 패턴을 사용하고 있다(`extract-questions.test.ts:23~100`). 이 파일들의 mock 전환은 supabase client mock 구조 전체를 재작성하지 않고 `getCurrentUser` 부분만 분리해서 교체해야 하므로 **부분 전환** 주의가 필요하다.

---

### LOW: `ROLES.includes()` 런타임 가드 누락 가능성

**등급**: LOW
**근거**: 기존 `src/lib/auth/get-current-user.ts:43`에는 `ROLES.includes(profile.role as Role)` 런타임 가드가 있다. 그러나 기존 Action 헬퍼 함수들(`users.ts`, `questions.ts`, `past-exams.ts`, `extract-questions.ts`)에는 이 가드가 없다.

PLAN의 `getCurrentUser()` 설계에 ROLES 런타임 가드 포함 여부가 명시되어 있지 않다. DB에서 잘못된 role 값이 오는 경우 역할 체크를 우회할 수 있다(MEMORY.md "ROLES.includes() 런타임 가드" 항목 참조).

**권장 조치**: `helpers.ts` 구현 시 `src/lib/auth/get-current-user.ts`와 동일하게 `ROLES.includes(profile.role as Role)` 가드를 포함하도록 Task 1 내용에 명시.

---

## Plan Review Completion Checklist 판정

| 항목 | 상태 | 비고 |
|------|------|------|
| 모든 Task의 파일 소유권이 명확하다 | ✅ | 단일 구현자, 순차 처리 |
| Task 간 의존성 순서가 정의되었다 | ✅ | Task 1(helpers.ts) → Task 2~8 |
| 외부 의존성(라이브러리, API)이 명시되었다 | ✅ | 없음 (내부 리팩토링) |
| 에러 처리 방식이 정해졌다 | ✅ | `{ error }` 반환 패턴 유지 |
| 테스트 전략이 있다 | ✅ | helpers.test.ts 신규 + 각 테스트 mock 교체 |
| 이전 Phase 회고 교훈이 반영되었다 | ✅ | system_admin null 처리, IDOR 패턴 유지 |
| 병렬 구현 시 파일 충돌 가능성이 없다 | ✅ | 순차 구현 명시 |

**판정: READY**

단, HIGH 이슈(`exam-management.ts` 누락)는 구현 시작 전 Task 목록에 추가할 것을 강력히 권장한다. 방치하면 리팩토링 목표(중복 제거)가 부분적으로만 달성된다.
