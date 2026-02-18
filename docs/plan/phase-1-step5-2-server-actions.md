# 단계 1-5 Step 2: Server Actions (TDD)

> **상태**: ✅ 완료 (구현 + 학습 리뷰 완료, 2026-02-18)
> **작성일**: 2026-02-16
> **상위 계획**: `docs/plan/phase-1-step5-user-crud.md` Step 2
> **학습 등급**: 🔴 CRITICAL
> **전제 조건**: Step 1 Zod 스키마 완료 (`src/lib/validations/users.ts`)

---

## 1. Context

단계 1-5 (사용자 관리 CRUD [F009])의 두 번째 스텝. Step 1에서 만든 Zod 스키마(`userFilterSchema`, `roleChangeSchema`, `toggleActiveSchema`)를 활용하여 3개의 Server Actions를 TDD로 구현한다.

**이 Step이 중요한 이유**: 역할 변경 기능은 RBAC(역할 기반 접근 제어)의 핵심이며, 권한 상승 공격을 Server Action 레벨에서 차단하는 **Defense in Depth 2차 방어선**이다.

---

## 2. 파일 변경 목록

| 파일 | 작업 |
|------|------|
| `src/lib/actions/__tests__/users.test.ts` | 새로 생성 (TDD RED) |
| `src/lib/actions/users.ts` | 새로 생성 (TDD GREEN) |

---

## 3. 타입 정의

### 3.1 UserProfile — 사용자 프로필 응답 타입

```typescript
export interface UserProfile {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly role: string
  readonly isActive: boolean
  readonly avatarUrl: string | null
  readonly phone: string | null
  readonly createdAt: string
}
```

- DB `profiles` 테이블의 snake_case → camelCase 변환
- `readonly`로 불변성 보장 (기존 `AcademyData` 패턴 동일)
- `updatedAt` 제외 — 목록/상세에서 불필요

### 3.2 UserActionResult — Action 공통 반환 타입

```typescript
export interface UserActionResult {
  readonly error?: string
  readonly data?: UserProfile | UserProfile[]
  readonly meta?: {
    readonly total: number
    readonly page: number
    readonly pageSize: number
  }
}
```

- `data`가 단일(`changeUserRole`, `toggleUserActive`) 또는 배열(`getUserList`)
- `meta`는 페이지네이션 정보 (목록 조회 시에만 포함)
- 기존 `SchoolActionResult`와 달리 `data`를 `unknown`이 아닌 구체적 타입으로 정의

### 3.3 CurrentUserProfile — 헬퍼 내부 타입

```typescript
interface CurrentUserProfile {
  readonly id: string
  readonly role: string
  readonly academyId: string
}

interface GetCurrentUserResult {
  readonly error?: string
  readonly profile?: CurrentUserProfile
}
```

- `academies.ts`의 `CheckAdminRoleResult`와 유사하지만 `id` 추가 반환
- `id` 필요 이유: `changeUserRole`에서 자기 자신 변경 차단 (caller.id !== userId)

---

## 4. Actions 설계

### 4.1 getCurrentUserProfile() — 내부 헬퍼 (export 안 함)

```
역할: 인증 확인 + profile 조회 (역할 체크는 각 Action에서)
반환: { error?, profile: { id, role, academyId } }
패턴: academies.ts checkAdminRole() 유사하지만 id도 반환
```

**기존 패턴과의 차이**:
- `academies.ts` `checkAdminRole()`: admin/system_admin만 허용 (역할 체크 포함)
- `users.ts` `getCurrentUserProfile()`: 인증 + 조회만 담당, 역할 체크는 각 Action에서

**이유**: `getUserList`(teacher도 OK)와 `changeUserRole`(admin만 OK)에서 역할 제한이 다르므로, 헬퍼는 인증+조회만 담당하고 역할 체크는 각 Action에서 수행.

```typescript
async function getCurrentUserProfile(): Promise<GetCurrentUserResult> {
  // 1. createClient()
  // 2. supabase.auth.getUser() → 인증 확인
  // 3. profiles 테이블에서 id, role, academy_id 조회
  // 4. academy_id null 체크
  // 5. 반환: { profile: { id, role, academyId } }
}
```

### 4.2 getUserList(filters?) — 사용자 목록 조회

```
권한: admin, teacher, system_admin
쿼리: profiles 테이블 → 필터(search/role/isActive) + 페이지네이션
패턴: schools.ts getSchoolList() 유사
새 패턴: Supabase or() 필터 (name + email 동시 검색)
RLS 위임: 같은 학원 소속만 자동 반환 (추가 필터 불필요)
```

**구현 흐름**:
```
1. userFilterSchema.safeParse(filters ?? {})
2. getCurrentUserProfile() → 인증 확인
3. 역할 체크: student 차단
4. Supabase 쿼리 구성:
   a. select('id, email, name, role, is_active, avatar_url, phone, created_at', { count: 'exact' })
   b. order('created_at', { ascending: false })
   c. range(from, to)
5. 필터 적용:
   a. search → query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
   b. role !== 'all' → query.eq('role', role)
   c. isActive !== 'all' → query.eq('is_active', isActive === 'true')
6. snake_case → camelCase 변환
7. 반환: { data: UserProfile[], meta: { total, page, pageSize } }
```

**Supabase `or()` 필터 (프로젝트 최초 사용)**:
```typescript
// name 또는 email에 검색어 포함
query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
```
- `or()` 안의 문자열은 PostgREST 필터 문법
- 쉼표로 구분, 각 조건은 `column.operator.value` 형식
- `ilike`는 대소문자 무시 부분 일치

### 4.3 changeUserRole(userId, newRole) — 역할 변경

```
권한: admin, system_admin만
보안: RBAC 매트릭스 기반 검증 (Defense in Depth 2차 방어)
```

**검증 순서** (순서 중요 — 각 단계를 건너뛰면 보안 허점):
```
1. Zod 검증: roleChangeSchema.safeParse({ userId, newRole })
   → system_admin 이미 차단 (1차 방어)
   → 잘못된 UUID 차단

2. getCurrentUserProfile() → 호출자 인증 + 프로필

3. 호출자 역할 체크: admin 또는 system_admin만
   → teacher, student 차단

4. 자기 자신 변경 차단: caller.id !== userId
   → 관리자가 실수로 자신의 권한을 제거하는 것 방지

5. 대상 사용자 조회: supabase.from('profiles').select(...).eq('id', userId).single()
   → RLS가 같은 학원만 보여줌 (3차 방어)
   → 결과 없으면 "사용자를 찾을 수 없습니다" (다른 학원 포함)

6. 대상이 system_admin → 차단
   → system_admin은 누구도 변경 불가

7. 호출자가 admin인 경우 추가 제한:
   a. 대상의 현재 역할이 admin → 차단 (다른 admin 변경 불가)
   b. newRole이 admin → 차단 (admin 부여 불가)

8. UPDATE 실행:
   supabase.from('profiles').update({ role: newRole }).eq('id', userId).select(...).single()

9. revalidatePath('/admin/users')

10. 반환: { data: 변환된 UserProfile }
```

**역할 변경 권한 매트릭스** (상위 계획에서 확정):
```
호출자           대상 현재 역할 → 변경 가능 대상
─────────────────────────────────────────────────
admin            student → teacher ✅
admin            teacher → student ✅
admin            student → admin ❌
admin            teacher → admin ❌
admin            admin → * ❌ (다른 admin 변경 불가)
system_admin     student → teacher ✅
system_admin     student → admin ✅
system_admin     teacher → student ✅
system_admin     teacher → admin ✅
system_admin     admin → student ✅
system_admin     admin → teacher ✅
*                * → system_admin ❌ (절대 불가)
```

### 4.4 toggleUserActive(userId, isActive) — 활성화/비활성화

```
권한: admin, system_admin만
패턴: changeUserRole과 유사하지만 역할 매트릭스 불필요
```

**검증 순서**:
```
1. Zod 검증: toggleActiveSchema.safeParse({ userId, isActive })

2. getCurrentUserProfile() → 호출자 인증 + 프로필

3. 호출자 역할 체크: admin 또는 system_admin만

4. 자기 자신 비활성화 차단: caller.id !== userId
   → 관리자가 자신을 비활성화하면 복구 불가

5. 대상 사용자 조회
   → RLS가 같은 학원만 보여줌
   → 결과 없으면 에러

6. 대상이 system_admin → 차단
   → system_admin 비활성화 불가

7. UPDATE 실행:
   supabase.from('profiles').update({ is_active: isActive }).eq('id', userId).select(...).single()

8. revalidatePath('/admin/users')

9. 반환: { data: 변환된 UserProfile }
```

---

## 5. TDD 테스트 케이스 (~25-30개)

### 5.1 getUserList (8개)

```
describe('getUserList')
  describe('인증/권한')
    it('인증 안 됨 → 에러')
    it('student 접근 → 에러')
    it('teacher 접근 → 성공')

  describe('정상 조회')
    it('기본 필터로 목록 반환 (meta 포함)')
    it('검색 필터: name 또는 email (or 쿼리)')
    it('역할 필터: role=teacher')
    it('활성 상태 필터: isActive=false')
    it('페이지네이션: page=2')
```

### 5.2 changeUserRole (14개)

```
describe('changeUserRole')
  describe('입력 검증')
    it('잘못된 UUID → Zod 에러')
    it('system_admin으로 변경 시도 → Zod 에러')

  describe('인증/권한')
    it('인증 안 됨 → 에러')
    it('teacher 접근 → 에러')

  describe('admin 호출자')
    it('admin이 student→teacher ✅')
    it('admin이 teacher→student ✅')
    it('admin이 student→admin ❌')
    it('admin이 admin 역할 사용자 변경 시도 ❌')

  describe('system_admin 호출자')
    it('system_admin이 student→admin ✅')
    it('system_admin이 admin→student ✅')

  describe('보안 규칙')
    it('자기 자신 역할 변경 ❌')
    it('대상이 system_admin → 변경 불가')
    it('대상 없음 (다른 학원/미존재) → 에러')

  describe('성공 후 처리')
    it('revalidatePath 호출 확인')
```

### 5.3 toggleUserActive (6개)

```
describe('toggleUserActive')
  describe('인증/권한')
    it('인증 안 됨 → 에러')

  describe('정상 동작')
    it('admin이 사용자 비활성화 ✅')
    it('admin이 사용자 활성화 ✅')

  describe('보안 규칙')
    it('자기 자신 비활성화 ❌')
    it('system_admin 비활성화 ❌')
    it('대상 없음 → 에러')
```

**총 예상: ~28개**

---

## 6. Mock 전략

### 6.1 Supabase 클라이언트 Mock (기존 패턴)

```typescript
const mockSupabaseClient = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))
```

### 6.2 Mock 헬퍼 함수

기존 `academies.test.ts` 패턴 확장:

```typescript
// 인증 실패
function mockAuthFailed() { ... }

// 역할별 인증 성공 (id 포함 — academies.test.ts와의 차이)
function mockAuthAs(role: string, id = 'caller-uuid') {
  // auth.getUser → { user: { id } }
  // from('profiles') → { id, role, academy_id }
  // 반환: profileQuery (mockReturnValueOnce에 사용)
}

// 대상 사용자 조회 결과
function mockTargetUser(user: Partial<TargetUser>) {
  // from('profiles').select().eq().single() → user
}

// 대상 사용자 업데이트 결과
function mockUpdateResult(updatedUser: Partial<TargetUser>) {
  // from('profiles').update().eq().select().single() → updatedUser
}

// 사용자 목록 조회 결과
function mockUserListResult(users: any[], count: number) {
  // from('profiles').select().order().range() → { data: users, count }
}
```

### 6.3 from() 호출 순서 주의

`changeUserRole`은 `from('profiles')`가 3번 호출됨:
1. `getCurrentUserProfile` → 호출자 프로필 조회
2. 대상 사용자 조회
3. UPDATE 실행

```typescript
mockSupabaseClient.from
  .mockReturnValueOnce(callerProfileQuery)   // 1. 호출자 조회
  .mockReturnValueOnce(targetProfileQuery)   // 2. 대상 조회
  .mockReturnValueOnce(updateQuery)          // 3. 업데이트
```

### 6.4 getUserList의 Fluent API 체인 Mock

`getUserList`는 Supabase Fluent API 체인이 길어 Mock이 복잡:

```typescript
function mockUserListQuery(users: any[], count: number) {
  const query = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    // 체인 마지막에 Promise 반환
    then: vi.fn((resolve) => resolve({ data: users, error: null, count })),
  }
  return query
}
```

**대안**: 체인 마지막 호출에서 결과를 반환하는 방식 대신, `mockReturnThis()`로 체인 유지 후 `await`에서 결과 반환. 기존 `schools.ts`의 쿼리 패턴을 참고하여 `range()` 이후 필터를 적용하는 순서에 맞춰 Mock 구성.

> **구현 시 주의**: Supabase 쿼리 빌더는 `then`을 가진 thenable 객체. `await`로 실행하면 내부적으로 `.then()`이 호출됨. Mock에서는 최종 체인 메서드가 `{ data, error, count }`를 가진 Promise를 반환하도록 설정.

---

## 7. snake_case → camelCase 변환

DB 응답을 프론트엔드 타입으로 변환하는 헬퍼 함수:

```typescript
function toUserProfile(dbRow: any): UserProfile {
  return {
    id: dbRow.id,
    email: dbRow.email,
    name: dbRow.name,
    role: dbRow.role,
    isActive: dbRow.is_active,
    avatarUrl: dbRow.avatar_url,
    phone: dbRow.phone,
    createdAt: dbRow.created_at,
  }
}
```

- `academies.ts` `getMyAcademy()`에서 인라인으로 수행하던 변환을 함수로 추출
- `getUserList`에서 배열 변환에 재사용: `data.map(toUserProfile)`
- `changeUserRole`, `toggleUserActive`에서도 단일 변환에 재사용

---

## 8. 기존 패턴 재사용

| 패턴 | 출처 | 적용 |
|------|------|------|
| RBAC 헬퍼 함수 (인라인) | `academies.ts` `checkAdminRole` | `getCurrentUserProfile` (id 추가 반환) |
| Fluent API 체인 + 페이지네이션 | `schools.ts` `getSchoolList` | `getUserList` |
| snake_case → camelCase 변환 | `academies.ts` `getMyAcademy` | `toUserProfile` 함수 추출 |
| `revalidatePath` | `schools.ts` 전체 | CUD 후 캐시 무효화 |
| `vi.mock` + `mockReturnValueOnce` | `academies.test.ts` | 테스트 전체 |
| Zod `safeParse` → 첫 에러 반환 | `academies.ts` `updateMyAcademy` | 입력 검증 |
| `createClient` (일반 클라이언트) | `academies.ts`, `schools.ts` | RLS 2중 방어 유지 |

---

## 9. 설계 결정

### 9.1 RBAC 헬퍼 인라인 (공통 유틸리티 추출 안 함)

`users.ts`의 `getCurrentUserProfile`은 `id`를 추가 반환해야 해서 `academies.ts` `checkAdminRole`과 시그니처가 다름. Phase 2 리팩토링 시 통합.

### 9.2 일반 클라이언트 사용 (admin 클라이언트 아님)

상위 계획에서 이미 결정:
- 일반 클라이언트 = RLS "같은 학원" 제약 유지 → 2중 방어
- admin 클라이언트 = RLS 완전 우회 → 코드 버그 시 다른 학원 영향 가능
- `profiles_update_admin` RLS가 이미 admin의 같은 학원 프로필 수정 허용

### 9.3 academy_id 비교 생략

RLS가 같은 학원 필터를 자동 적용하므로 Server Action에서 중복 체크 불필요. 대상 조회 결과가 null이면 "사용자를 찾을 수 없습니다"로 처리 (다른 학원 사용자 포함).

### 9.4 Supabase `or()` 필터

name + email 동시 검색은 프로젝트 최초 사용:
```typescript
query.or('name.ilike.%검색%,email.ilike.%검색%')
```
- PostgREST 필터 문법: `column.operator.value`
- 쉼표로 OR 조건 구분
- `ilike`는 대소문자 무시 부분 일치 (`LIKE`의 case-insensitive 버전)

### 9.5 검증 순서의 의도적 배치

`changeUserRole`에서 "Zod 검증 → 인증 → 역할 → 자기수정 → 대상조회 → 매트릭스" 순서인 이유:
1. **Zod 먼저**: DB 접근 없이 잘못된 입력 빠르게 차단 (성능)
2. **인증 다음**: 비인증 사용자는 아무것도 못함 (가장 넓은 차단)
3. **역할 체크**: 대상 조회 전에 호출자 권한 확인 (불필요한 DB 쿼리 방지)
4. **자기수정**: 대상 조회 전에 ID 비교만으로 차단 가능
5. **대상 조회**: RLS로 같은 학원 자동 필터 (3차 방어)
6. **매트릭스**: 대상의 현재 역할 확인 필요 → 대상 조회 후에만 가능

---

## 10. 학습 포인트 (🔴 CRITICAL)

### 10.1 RBAC 비즈니스 규칙

- **매트릭스 기반 역할 변경 검증**: 누가 누구를 변경 가능한지 명시적 규칙
- 코드에서 if-else 체인이 아닌 **조건 분기의 의도**를 이해하는 것이 핵심
- admin vs system_admin의 권한 차이가 비즈니스 요구사항에서 왜 필요한지

### 10.2 권한 상승 방어 (Privilege Escalation)

- **3중 방어**: Zod(1차) → Server Action(2차) → RLS(3차)
- Zod에서 system_admin을 차단해도 Server Action에서 다시 체크하는 이유
- "중복 검증"이 아닌 "계층별 독립 방어" — 한 계층이 뚫려도 다른 계층이 막음

### 10.3 자기 수정 방지 (Self-modification Prevention)

- `caller.id !== userId` 패턴의 의미
- 관리자가 자신의 역할을 변경하거나 비활성화하면 복구 불가
- UI에서도 차단하지만 Server Action에서 최종 검증 (클라이언트 우회 방지)

### 10.4 RLS 위임 전략

- Server Action에서 `academy_id` 비교를 안 하는 이유
- RLS `profiles_select_same_academy`가 같은 학원 소속만 반환
- 대상 조회 실패 = "다른 학원이거나 존재하지 않음" → 공격자에게 정보 노출 없음

### 10.5 Supabase `or()` 필터

- PostgREST 필터 문법 (`column.operator.value`)
- `or()` vs `textSearch()` vs 클라이언트 필터링의 트레이드오프
- MVP에서는 `or(ilike)` 충분 (학원 단위 수백~수천 사용자)

---

## 11. TDD 실행 순서

```
1. RED:   테스트 파일 작성 (src/lib/actions/__tests__/users.test.ts)
          → 28개 테스트 모두 FAIL 확인
          npx vitest run src/lib/actions/__tests__/users.test.ts

2. GREEN: 구현 파일 작성 (src/lib/actions/users.ts)
          → getCurrentUserProfile 헬퍼
          → getUserList
          → changeUserRole
          → toggleUserActive
          순서로 구현, 각 그룹별 테스트 통과 확인

3. REFACTOR: 에러 메시지 한국어 일관성, 중복 코드 정리
          → toUserProfile 함수 재사용 확인
          → 불필요한 코드 제거
```

---

## 12. 검증

```bash
# Step 2 테스트
npx vitest run src/lib/actions/__tests__/users.test.ts

# 전체 회귀 테스트 (272개 + Step 2 새 테스트)
npx vitest run

# 린트
npm run lint
```

---

## 13. 직접 구현 추천 (🔴 CRITICAL)

Step 2 완료 후 **삭제 → 재구현** 강력 추천:

```bash
# 1. 구현 파일 백업
cp src/lib/actions/users.ts src/lib/actions/users.ts.reference

# 2. 구현 파일 삭제 (테스트는 유지)
rm src/lib/actions/users.ts

# 3. 테스트 실행 → 28개 모두 FAIL 확인
npx vitest run src/lib/actions/__tests__/users.test.ts

# 4. reference 참고하며 직접 구현 (복붙 NO)
# 5. 테스트 PASS 달성 → RBAC 규칙 체화 완료
```

**이유**: RBAC 비즈니스 규칙과 검증 순서는 보안의 핵심. 복붙으로는 "왜 이 순서인지" 체화 불가. 직접 작성해야 권한 상승 방어의 각 단계가 왜 필요한지 이해할 수 있음.
