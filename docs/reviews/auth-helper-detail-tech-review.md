# auth-helper-tasks-detail.md 기술 검토 보고서

> 검토 대상: `docs/plan/auth-helper-tasks-detail.md` — 11개 Task 상세 계획
> 검토자: technical-reviewer
> 검토 일자: 2026-03-25

---

## 판정: READY (MUST FIX 0건)

모든 이슈는 HIGH 이하. Task 1 완료 후 Task 2~10 병렬 진행 가능.

---

## 검토 결과 요약

| 우선순위 | 건수 |
|---------|------|
| CRITICAL | 0 |
| HIGH | 3 |
| MEDIUM | 4 |
| LOW | 2 |

---

## HIGH 이슈

### H-1. `'use server'` 파일에서 다른 `'use server'` 파일 import — 번들링 오류 가능

**위치**: Task 1 `helpers.ts` 구현 코드, Task 2~10 호출부 패턴

**문제**:
PLAN의 `helpers.ts`에 `'use server'` 지시어가 선언되어 있고, 각 Task에서 `import { getCurrentUser } from './helpers'`로 임포트한다. 현재 `users.ts`, `past-exams.ts`, `generate-questions.ts` 등 모든 Action 파일에도 `'use server'`가 선언되어 있다.

Next.js에서 `'use server'` 파일은 Server Action 바운더리 파일이며, 다른 `'use server'` 파일을 직접 import하는 것은 공식 지원 패턴이다. 그러나 `helpers.ts`가 `export async function getCurrentUser()` 형태로 노출될 경우, Next.js가 이를 독립 Server Action으로 인식하여 클라이언트에서 직접 호출 가능한 엔드포인트로 등록할 수 있다.

**권장 조치**: `helpers.ts`에서 `'use server'` 지시어를 **제거**하고 일반 서버 유틸리티 파일로 선언한다. 이 파일은 Server Action을 export하는 게 아니라 Server Action 내부에서만 호출되는 헬퍼이므로 `'use server'`가 불필요하다. `@/lib/supabase/server`와 `@/lib/auth`를 import하는 것은 `'use server'` 없이도 가능하다.

```typescript
// helpers.ts — 'use server' 제거
// import는 동일하게 유지
import { createClient } from '@/lib/supabase/server'
import { ROLES, type Role } from '@/lib/auth'
```

**실제 영향**: 현재 Next.js 버전에서 동작할 수 있으나, `helpers.ts`가 `'use server'`를 포함하면 `getCurrentUser`가 의도치 않게 외부 노출될 위험이 있다.

---

### H-2. Task 2 `users.ts` — `getCurrentUserProfile()`의 academyId null 처리 동작 변경

**위치**: Task 2, users.ts L89~91

**문제**:
기존 `getCurrentUserProfile()` (users.ts L88~91)은 `academy_id`가 null이면 즉시 `{ error: '소속 학원이 없습니다.' }`를 반환하고 함수 내부에서 처리한다.

PLAN의 교체 패턴은 `getCurrentUser()`를 호출한 후 **호출부에서** `!profile.academyId` 체크를 추가한다:

```typescript
// PLAN 패턴 B:
const { error, profile } = await getCurrentUser()
if (error || !profile) return { error: error ?? '인증 실패' }
if (!profile.academyId) return { error: '소속 학원이 없습니다.' }
```

그런데 users.ts의 `getUserList`(L142~144)는 현재:
```typescript
const { error: profileError, profile } = await getCurrentUserProfile()
if (profileError || !profile) {
  return { error: profileError }  // ← profileError가 undefined면 undefined 반환
}
```

교체 후 `if (error || !profile) return { error: error ?? '인증 실패' }`가 되면, 기존에는 `profileError`가 `'소속 학원이 없습니다.'`였던 케이스에서 이제 `error`는 undefined이고 `profile`도 없으므로 `'인증 실패'`를 반환하게 된다. **에러 메시지가 달라진다.**

정확히는, 새 `getCurrentUser()`는 `academy_id`가 null이어도 `{ profile: {..., academyId: null} }`를 성공으로 반환하므로, `profile`이 존재하지만 `academyId`가 null인 상태다. 호출부에서 별도 체크해야 하며 PLAN이 이를 명시하고 있다. 그러나 기존 테스트가 "academy_id null → profileError 반환" 시나리오를 검증하고 있다면, 교체 후 에러 메시지 변경으로 테스트가 실패할 수 있다.

**권장 조치**: Task 2 구현 시 users.test.ts에서 "소속 학원이 없습니다." 에러 메시지를 검증하는 테스트 케이스가 있는지 확인하고, 있으면 mock 교체와 함께 에러 메시지 기댓값도 업데이트할 것.

---

### H-3. Task 5 `extract-questions.ts` — `getCurrentUserWithRole()`의 인증 실패 에러 메시지 불일치

**위치**: Task 5, extract-questions.ts L77

**문제**:
기존 `getCurrentUserWithRole()` (extract-questions.ts)은 미인증 에러 메시지로 `'로그인이 필요합니다.'`를 반환한다 (L77):
```typescript
if (authError || !user) {
  return { error: '로그인이 필요합니다.' }
}
```

새 `getCurrentUser()` (PLAN Task 1)은 동일 상황에서 `'인증이 필요합니다.'`를 반환한다. 이 메시지 변경은 extract-questions.test.ts에서 `'로그인이 필요합니다.'`를 기대하는 테스트 케이스를 실패시킨다.

exam-management.ts도 동일하게 `'로그인이 필요합니다.'` 메시지를 사용한다 (L92). Task 6도 같은 문제가 발생한다.

**권장 조치**: Task 5, Task 6 구현 시 해당 테스트 파일에서 `'로그인이 필요합니다.'`를 기댓값으로 쓰는 테스트를 `'인증이 필요합니다.'`로 업데이트할 것. PLAN에 이 변경이 명시되어 있지 않으므로 구현자가 놓칠 가능성이 있다.

---

## MEDIUM 이슈

### M-1. Task 7 `generate-questions.ts` — `user` → `profile` 변수명 변경 시 이후 코드 누락 가능성

**위치**: Task 7, generate-questions.ts L87~90

**문제**:
기존 코드는 `const { error: authError, user } = await checkTeacherOrAdmin()`으로 받아 이후 `user.id`, `user.role`, `user.academyId`를 사용하지 않는다 (generate-questions.ts에서는 `user` 자체가 이후 코드에서 미사용). 그러나 save-questions.ts에서는 L163~165:

```typescript
const { error: authError, user } = await checkTeacherOrAdmin()
if (authError || !user) { return { error: authError } }
```

이후 `user.id`, `user.academyId`가 `toQuestionInsertRow`에 메타데이터로 전달된다 (L178~220). PLAN은 "user → profile 변수명 변경 필요"를 주의사항으로 언급하고 있으나, save-questions.ts의 이후 코드에서 `user.id → profile.id`, `user.academyId → profile.academyId` 교체를 빠뜨리면 타입 에러 없이 undefined 접근이 발생한다(TypeScript는 구조적으로 호환되므로 컴파일 통과).

**권장 조치**: Task 7 구현 시 save-questions.ts에서 `user` 사용 위치를 전수 검색하여 `profile`로 교체 확인. `npx tsc --noEmit`으로 검증하면 잡히므로 Task 11 검증 단계에서 확인 가능.

---

### M-2. Task 8 `academies.ts` — `updateMyAcademy`의 에러 메시지 변경

**위치**: Task 8, academies.ts L72~73

**문제**:
기존 `checkAdminRole()`은 admin/system_admin이 아닌 경우 `'학원 관리자만 수정할 수 있습니다.'`를 반환한다 (L72):
```typescript
if (!['admin', 'system_admin'].includes(profile.role)) {
  return { error: '학원 관리자만 수정할 수 있습니다.' }
}
```

PLAN의 교체 패턴에서는:
```typescript
if (!['admin', 'system_admin'].includes(profile.role)) {
  return { error: '관리자만 학원 정보를 수정할 수 있습니다.' }
}
```

메시지가 달라진다. PLAN이 의도적으로 메시지를 변경한 것인지, 아니면 실수인지 불명확하다. academies.test.ts가 이 에러 메시지를 검증하면 테스트 실패.

**권장 조치**: PLAN에서 에러 메시지를 기존 `'학원 관리자만 수정할 수 있습니다.'`로 통일하거나, 변경 의도를 명시할 것.

---

### M-3. Task 10 `achievement-standards.ts` — 조회 Action의 `profile` 미검증

**위치**: Task 10, 조회 Action 패턴

**문제**:
PLAN의 조회 Action 패턴:
```typescript
const { error } = await getCurrentUser()
if (error) return { error }
```

`getCurrentUser()`가 성공하면 `{ profile: {...} }`를 반환하는데, 조회 Action에서는 `profile`을 destructure하지 않는다. 이는 기존 `checkAuthenticated()`와 동일한 동작(인증 확인만)을 유지하므로 올바른 패턴이다.

다만, `getCurrentUser()`가 `{ error: undefined, profile: undefined }` 형태로 반환하는 엣지케이스가 없는지 구현 검토 필요. PLAN의 인터페이스 정의에서 `error`와 `profile` 중 하나는 항상 존재하도록 설계되어 있으므로 이론적으로 안전하다. 그러나 TypeScript 타입만으로는 `error`가 없어도 `profile`이 없을 수 있으므로, 조회 Action에서 `error`만 체크하면 `profile`이 undefined인 상태로 진행될 수 있다. 실제로는 인증이 성공했으므로 `profile`이 항상 존재하지만, 타입 안전성 측면에서 느슨하다.

**권장 조치**: 현 설계로 진행하되, helpers.ts 구현 시 `error`가 없으면 반드시 `profile`이 존재하도록 반환 타입을 discriminated union으로 강화하는 것을 고려. (현재 `GetCurrentUserResult` 타입은 optional 필드 조합이므로 타입 추론이 약함)

---

### M-4. 테스트 mock 교체 — 기존 테스트의 `from('profiles')` 체이닝 mock 잔존 위험

**위치**: Task 2~10 테스트 파일들

**문제**:
PLAN은 테스트 mock을 `vi.mock('./helpers', () => ({ getCurrentUser: vi.fn() }))`로 교체하도록 안내한다. 그러나 기존 테스트(users.test.ts, exam-management.test.ts 등)는 `mockSupabaseClient.from`에서 `profiles` 테이블 체이닝 mock을 설정한다.

`getCurrentUser`를 module mock으로 교체하면 supabase `from('profiles')` 호출이 없어지므로 `mockSupabaseClient.from`의 `profiles` 분기 mock이 불필요해진다. 그런데 일부 테스트에서 `from`이 호출 순서에 의존하는 `mockReturnValueOnce` 패턴을 사용하는 경우(achievement-standards.test.ts L66: `mockSupabaseClient.from.mockReturnValueOnce(profileQuery)`), profiles 호출이 사라지면 순서가 달라져 다른 테이블의 mock이 밀릴 수 있다.

**권장 조치**: 각 Task 테스트 교체 시, `mockReturnValueOnce` 패턴을 사용하는 테스트에서 profiles mock 제거 후 순서를 재검토할 것. `mockImplementation` 패턴(테이블명 분기)은 영향 없음.

---

## LOW 이슈

### L-1. `helpers.ts`에 `'use server'` 포함 시 Next.js Server Action 노출

이는 H-1과 동일한 맥락이지만, 실제 노출 여부는 Next.js 버전 및 번들러 설정에 따라 달라지므로 H-1에서 설명한 권장 조치(지시어 제거)로 해결된다.

---

### L-2. Task 11 — `import` 정리 시 `GetCurrentUserResult`, `CurrentUserProfile` 타입 삭제 누락 가능

**위치**: Task 11 정리 단계

**문제**:
각 파일에는 로컬 `interface CurrentUserProfile`, `interface GetCurrentUserResult`, `interface AuthorizedUser`, `interface AuthCheckResult` 등이 선언되어 있다. Task 2~10에서 해당 타입을 제거하도록 명시되어 있으나, 타입만 남기고 헬퍼 함수만 제거하는 실수가 발생할 수 있다.

**권장 조치**: Task 11에서 `npx tsc --noEmit` 실행 시 미사용 선언은 TypeScript가 잡지 못한다(unused variable이 아니므로). ESLint `@typescript-eslint/no-unused-vars` 규칙이 활성화되어 있으면 미사용 타입이 경고로 잡힌다. 명시적으로 각 파일에서 제거 여부를 확인하도록 Task 11 체크리스트에 추가 권장.

---

## 검증된 사항 (이슈 없음)

1. **Task 1 `getCurrentUser()` 대체 범위**: 10개 헬퍼(`getCurrentUserProfile` ×3, `getCurrentUserWithRole` ×2, `checkTeacherOrAdmin` ×2, `checkAdminRole` ×1, `checkAdminOrTeacherRole` ×1, `checkAuthenticated` ×1, `checkSystemAdminRole` ×1)를 모두 대체할 수 있다. 각 헬퍼가 수행하던 academy_id null 체크와 role 체크를 호출부로 이동하는 패턴은 기술적으로 올바르다.

2. **academyId null + system_admin 시나리오**: `getCurrentUser()`는 `academy_id`가 null이어도 정상 반환하고, 각 호출부에서 필요한 경우만 체크한다. schools.ts(Task 9)와 achievement-standards.ts(Task 10)는 academy_id 체크를 생략하는 것이 올바른 비즈니스 로직이다(글로벌 데이터).

3. **ROLES 런타임 가드**: `src/lib/auth/roles.ts`에 `ROLES` 상수와 `Role` 타입이 존재하며, `import { ROLES, type Role } from '@/lib/auth'`로 정확히 import 가능하다.

4. **Task 간 의존성**: Task 1(helpers.ts 생성) → Task 2~10(각 파일 교체)의 선형 의존성이 명확하다. Task 2~10은 상호 독립적이므로 병렬 실행 가능하다.

5. **RLS 정책 호환성**: `getCurrentUser()`는 인증 + 프로필 조회만 수행하고 DB 쿼리를 직접 실행하지 않는다. 기존 각 Action의 Supabase 쿼리 패턴은 그대로 유지되므로 RLS에 영향 없다. `academy_id` 필터(IDOR 방어)도 각 Action 내부 쿼리에 유지된다.

6. **`generate-questions.ts` user.id 미사용**: generate-questions.ts의 `generateQuestionsFromPastExam`에서 `user`(또는 교체 후 `profile`)의 id, academyId는 실제로 Action 내부에서 사용되지 않는다. 교체 패턴에서 `profile.academyId` 체크만 추가하면 된다.
