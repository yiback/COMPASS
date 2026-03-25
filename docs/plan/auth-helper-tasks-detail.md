# Server Action 인증 헬퍼 통합 — Task별 상세 계획

> 마스터 PLAN: `docs/plan/auth-helper-consolidation.md` v2
> 상태: ✅ 전체 완료 (11/11 Tasks, 1449 tests PASS)
> 코드 리뷰: 2차 만장일치 PASS (security/perf/test)

---

## Task 1: helpers.ts 생성 + 단위 테스트

### 소유 파일
- `src/lib/actions/helpers.ts` (신규)
- `src/lib/actions/__tests__/helpers.test.ts` (신규)

### 구현 내용

```typescript
// src/lib/actions/helpers.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { ROLES, type Role } from '@/lib/auth'

export interface ActionProfile {
  readonly id: string
  readonly role: Role
  readonly academyId: string | null
}

export interface GetCurrentUserResult {
  readonly error?: string
  readonly profile?: ActionProfile
}

export async function getCurrentUser(): Promise<GetCurrentUserResult> {
  const supabase = await createClient()

  // 1. 인증 확인
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: '인증이 필요합니다.' }
  }

  // 2. 프로필 조회
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, academy_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: '프로필을 찾을 수 없습니다.' }
  }

  // 3. 런타임 role 가드 (DB에서 잘못된 role 방어)
  if (!ROLES.includes(profile.role as Role)) {
    return { error: '유효하지 않은 역할입니다.' }
  }

  // 4. academyId null은 에러가 아님 (system_admin)
  return {
    profile: {
      id: profile.id,
      role: profile.role as Role,
      academyId: profile.academy_id,
    },
  }
}
```

### 테스트 케이스 (~8개)
1. 미인증 → `{ error: '인증이 필요합니다.' }`
2. 프로필 없음 → `{ error: '프로필을 찾을 수 없습니다.' }`
3. 잘못된 role → `{ error: '유효하지 않은 역할입니다.' }`
4. academy_id null (system_admin) → 정상 반환 (null 포함)
5. 정상 반환 (admin + academy_id 있음)
6. 정상 반환 (teacher + academy_id 있음)
7. 정상 반환 (student + academy_id 있음)
8. supabase 에러 → `{ error }` 반환

### 검증
```bash
npx vitest run src/lib/actions/__tests__/helpers.test.ts
```

---

## Task 2: users.ts 교체

### 소유 파일
- `src/lib/actions/users.ts`
- `src/lib/actions/__tests__/users.test.ts`

### 제거 대상
- `getCurrentUserProfile()` 함수 (L64~100)
- `GetCurrentUserResult` 타입 (L46~55)
- `UserProfile` 타입 내 `academyId` 관련 (확인 필요)

### 호출부 교체 (3곳)
| 라인 | 기존 | 교체 후 |
|------|------|---------|
| 142 | `const { error: profileError, profile } = await getCurrentUserProfile()` | `const { error, profile } = await getCurrentUser()` + academyId null 체크 |
| 219 | `const { error: profileError, profile: caller } = await getCurrentUserProfile()` | 동일 패턴 |
| 323 | `const { error: profileError, profile: caller } = await getCurrentUserProfile()` | 동일 패턴 |

### 호출부 패턴 (패턴 B)
```typescript
import { getCurrentUser } from './helpers'

// 기존:
const { error: profileError, profile } = await getCurrentUserProfile()
if (profileError || !profile) return { error: profileError ?? '인증 실패' }

// 교체:
const { error, profile } = await getCurrentUser()
if (error || !profile) return { error: error ?? '인증 실패' }
if (!profile.academyId) return { error: '소속 학원이 없습니다.' }
```

### 테스트 mock 교체
```typescript
// 기존: supabase.auth.getUser + profiles.select 체인 mock
// 교체:
vi.mock('./helpers', () => ({
  getCurrentUser: vi.fn(),
}))

// 각 테스트에서:
vi.mocked(getCurrentUser).mockResolvedValue({
  profile: { id: 'user-id', role: 'admin', academyId: 'academy-id' },
})
```

### 검증
```bash
npx vitest run src/lib/actions/__tests__/users.test.ts
```

---

## Task 3: questions.ts 교체

### 소유 파일
- `src/lib/actions/questions.ts`
- `src/lib/actions/__tests__/questions-list.test.ts`
- `src/lib/actions/__tests__/questions-detail.test.ts`

### 제거 대상
- `getCurrentUserProfile()` 함수
- `GetCurrentUserResult` 타입

### 호출부 교체 (2곳: L176, L260)
Task 2와 동일 패턴 B.

### 주의사항
- 테스트 파일이 2개 — 양쪽 모두 mock 교체

---

## Task 4: past-exams.ts 교체

### 소유 파일
- `src/lib/actions/past-exams.ts`
- `src/lib/actions/__tests__/past-exams.test.ts`
- `src/lib/actions/__tests__/past-exams-list.test.ts`

### 제거 대상
- `getCurrentUserProfile()` 함수 (L108~)
- `GetCurrentUserResult` 타입

### 호출부 교체 (3곳)
| 라인 | 함수 | 패턴 |
|------|------|------|
| 308 | `getPastExams()` | 패턴 B (기존 getCurrentUserProfile) |
| 399 | `getPastExamDetail()` | 패턴 B |
| 194 | `uploadPastExamAction()` | 인라인 → getCurrentUser + 패턴 C (역할 체크) |

### uploadPastExamAction 인라인 교체
```typescript
// 기존 (L190~215): supabase.auth.getUser() + profiles.select + role 체크 인라인
// 교체:
const { error, profile } = await getCurrentUser()
if (error || !profile) return { error: error ?? '인증 실패' }
if (!profile.academyId) return { error: '소속 학원이 없습니다.' }
if (!['teacher', 'admin', 'system_admin'].includes(profile.role)) {
  return { error: '기출문제 업로드 권한이 없습니다.' }
}
// 이후 profile.academyId 사용 (기존 profile.academy_id 대신)
```

### 주의사항
- uploadPastExamAction은 supabase 클라이언트를 이미 생성함 → getCurrentUser가 내부에서 또 생성. 2회 생성이지만 Server Action에서는 cache 없으므로 어쩔 수 없음.
- 기존 `profile.academy_id` → `profile.academyId` (camelCase)로 이후 코드도 수정 필요

---

## Task 5: extract-questions.ts 교체

### 소유 파일
- `src/lib/actions/extract-questions.ts`
- `src/lib/actions/__tests__/extract-questions.test.ts`
- `src/lib/actions/__tests__/reanalyze-question.test.ts`

### 제거 대상
- `getCurrentUserWithRole()` 함수
- `GetCurrentUserResult`, `CurrentUserProfile` 타입
- `ALLOWED_ROLES` 상수

### 호출부 교체 (3곳: L159, L341, L425)
```typescript
// 기존: 역할 체크가 헬퍼 내부
const { error: authError, profile } = await getCurrentUserWithRole()
if (authError || !profile) return { error: authError ?? '인증 실패' }

// 교체: 패턴 C (역할 체크 호출부)
const { error, profile } = await getCurrentUser()
if (error || !profile) return { error: error ?? '인증 실패' }
if (!profile.academyId) return { error: '소속 학원이 없습니다.' }
// 역할 체크는 기존 extractQuestionsAction에만 필요 (reanalyze, reset도 확인)
```

### 주의사항
- `profile.academyId` (camelCase) — 이후 쿼리에서 `.eq('academy_id', profile.academyId)` 사용

---

## Task 6: exam-management.ts 교체

### 소유 파일
- `src/lib/actions/exam-management.ts`
- `src/lib/actions/__tests__/exam-management.test.ts`

### 제거 대상
- `getCurrentUserWithRole()` 함수
- `GetCurrentUserResult` 타입
- `ALLOWED_ROLES` 상수

### 호출부 교체 (5곳: L136, L290, L340, L376, L423)
패턴 C (역할 + academy_id 체크). 기존 헬퍼가 내포하던 역할 체크를 호출부로 이동.

### 주의사항
- 호출부 5곳으로 가장 많음. 반복 패턴이므로 신중하게 교체.

---

## Task 7: generate-questions.ts + save-questions.ts 교체

### 소유 파일
- `src/lib/actions/generate-questions.ts`
- `src/lib/actions/save-questions.ts`
- `src/lib/actions/__tests__/generate-questions.test.ts`
- `src/lib/actions/__tests__/save-questions.test.ts`

### 제거 대상 (양쪽 동일)
- `checkTeacherOrAdmin()` 함수
- `AuthCheckResult`, `AuthorizedUser` 타입

### 호출부 교체
```typescript
// 기존: { error: authError, user } — user로 받음!
const { error: authError, user } = await checkTeacherOrAdmin()
if (authError || !user) return { error: authError ?? '인증 실패' }
// user.id, user.role, user.academyId 사용

// 교체: { error, profile } — profile로 받음
const { error, profile } = await getCurrentUser()
if (error || !profile) return { error: error ?? '인증 실패' }
if (!profile.academyId) return { error: '소속 학원이 없습니다.' }
if (!['teacher', 'admin', 'system_admin'].includes(profile.role)) {
  return { error: 'AI 문제 생성 권한이 없습니다.' }  // 기존 에러 메시지 유지
}
// 이후 user.id → profile.id, user.academyId → profile.academyId
```

### 주의사항
- `user` → `profile`로 변수명 변경 필요 (이후 코드에서 user.id 등 사용)
- 에러 메시지 기존 것 유지 (리뷰 CONSIDER 반영)

---

## Task 8: academies.ts 교체

### 소유 파일
- `src/lib/actions/academies.ts`
- `src/lib/actions/__tests__/academies.test.ts`

### 제거 대상
- `checkAdminRole()` 함수
- `CheckAdminRoleResult` 타입

### 호출부 교체

**updateMyAcademy (L154)**:
```typescript
// 기존:
const roleCheck = await checkAdminRole()
if (roleCheck.error) return { error: roleCheck.error }
// roleCheck.profile.academyId 사용

// 교체:
const { error, profile } = await getCurrentUser()
if (error || !profile) return { error: error ?? '인증 실패' }
if (!['admin', 'system_admin'].includes(profile.role)) {
  return { error: '관리자만 학원 정보를 수정할 수 있습니다.' }
}
if (!profile.academyId) return { error: '소속 학원이 없습니다.' }
```

**getMyAcademy (L92~)**: 인라인 인증 코드
```typescript
// 기존: supabase.auth.getUser() + profiles.select 인라인
// 교체: getCurrentUser() 사용
const { error, profile } = await getCurrentUser()
if (error || !profile) return { error: error ?? '인증 실패' }
if (!profile.academyId) return { error: '소속 학원이 없습니다.' }
// 이후 profile.academyId로 academy 조회
```

### 주의사항
- getMyAcademy는 role 체크 없음 (인증 + academy_id만)
- `profile.role`이 반환값에 포함되어야 함 → getMyAcademy 반환 타입에 role 포함 확인

---

## Task 9: schools.ts 교체

### 소유 파일
- `src/lib/actions/schools.ts`
- `src/lib/actions/__tests__/schools.test.ts`

### 제거 대상
- `checkAdminOrTeacherRole()` 함수

### 호출부 교체 (3곳: L68, L187, L239)
```typescript
// 기존: academy_id 미체크, 역할만 확인
const { error: roleError } = await checkAdminOrTeacherRole()
if (roleError) return { error: roleError }

// 교체: 패턴 A + 역할 체크 (academy_id 체크 생략 — 리뷰 SHOULD FIX 반영)
const { error, profile } = await getCurrentUser()
if (error || !profile) return { error: error ?? '인증 실패' }
if (!['admin', 'teacher', 'system_admin'].includes(profile.role)) {
  return { error: '권한이 없습니다.' }
}
```

### 주의사항 (리뷰 SHOULD FIX)
- **academy_id 체크 생략** — 기존 동작 보존. system_admin은 academy_id null이지만 학교 관리 가능
- 학교는 글로벌 데이터 (특정 학원 소속 아님)

---

## Task 10: achievement-standards.ts 교체

### 소유 파일
- `src/lib/actions/achievement-standards.ts`
- `src/lib/actions/__tests__/achievement-standards.test.ts`

### 제거 대상
- `checkAuthenticated()` 함수
- `checkSystemAdminRole()` 함수

### 호출부 교체

**조회 Action (패턴 A — 인증만)**: L78, L142, L340
```typescript
// 기존:
const { error: authError } = await checkAuthenticated()
if (authError) return { error: authError }

// 교체:
const { error } = await getCurrentUser()
if (error) return { error }
```

**CUD Action (패턴 A + system_admin 체크)**: L167, L249, L314
```typescript
// 기존:
const { error: roleError } = await checkSystemAdminRole()
if (roleError) return { error: roleError }

// 교체:
const { error, profile } = await getCurrentUser()
if (error || !profile) return { error: error ?? '인증 실패' }
if (profile.role !== 'system_admin') {
  return { error: '권한이 없습니다.' }
}
```

### 주의사항
- 조회는 profile 불필요 → `const { error }` 만 destructure
- CUD는 academy_id 체크 불필요 (성취기준은 글로벌 데이터)

---

## Task 11: 전체 검증 + 정리

### 내용
1. `npx vitest run` — 전체 테스트 (1434+ PASS 목표)
2. `npx tsc --noEmit` — 타입 에러 0건
3. 각 파일에서 미사용 import/타입 정리 확인
4. HANDOFF.md 업데이트 (인증 헬퍼 통합 완료 기록)
