# 단계 1-4 Step 2: Server Actions (TDD)

> **상태**: ✅ 완료
> **작성일**: 2026-02-12
> **완료일**: 2026-02-12
> **모델**: Opus 4.6 (계획), Sonnet 4.5 (구현)
> **전제 조건**: Step 1 Zod 검증 스키마 완료 (`src/lib/validations/academies.ts`)
> **분석 도구**: Sequential Thinking MCP (7단계 사고 과정)
> **구현 결과**: 13개 테스트 모두 통과, 빌드 성공

---

## 1. 요구사항 재정의

### 구현 대상

2개의 Server Action + 1개의 RBAC 헬퍼 함수:

| 함수 | 용도 | 권한 |
|------|------|------|
| `getMyAcademy()` | 현재 사용자의 학원 정보 조회 | 인증된 사용자 전체 |
| `updateMyAcademy()` | 학원 정보 수정 | **admin만** (teacher는 조회만) |
| `checkAdminRole()` | admin 역할 확인 헬퍼 | 내부 함수 |

### 학교 관리(schools.ts)와의 핵심 차이

| 측면 | schools.ts | academies.ts |
|------|-----------|--------------|
| RBAC 범위 | admin + teacher + system_admin | **admin + system_admin만** |
| 레코드 범위 | 여러 레코드 (ID 파라미터) | **자기 학원 1개** (profile에서 ID 추출) |
| ID 전달 방식 | 파라미터로 받음 | **profile.academy_id에서 추출 (보안 강화)** |
| 데이터 변환 | raw 반환 | **snake_case → camelCase 변환** |
| CRUD 범위 | 생성/조회/수정/삭제 | **조회 + 수정만** |

---

## 2. 타입 설계

### 반환 타입

```typescript
// 학원 데이터 (camelCase, 프론트엔드용)
interface AcademyData {
  readonly id: string
  readonly name: string
  readonly address: string | null
  readonly phone: string | null
  readonly logoUrl: string | null
  readonly inviteCode: string | null
  readonly isActive: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

// Action 결과 (role 포함 — 페이지에서 역할별 UI 분기용)
interface AcademyActionResult {
  readonly error?: string
  readonly data?: AcademyData & { readonly role: string }
}
```

### 설계 결정: role을 왜 같이 반환하는가?

- `page.tsx` (Server Component)에서 역할에 따라 admin → 수정 폼, teacher → 읽기 전용 UI를 분기
- `getMyAcademy()` 한 번 호출로 academy + role을 모두 가져오면 별도 API 호출 불필요
- profiles 쿼리는 이미 실행하므로 추가 비용 없음

---

## 3. 함수별 상세 설계

### 3-1. checkAdminRole() — RBAC 헬퍼

```typescript
async function checkAdminRole(): Promise<{
  error?: string
  profile?: { role: string; academyId: string }
}>
```

**흐름:**
1. `supabase.auth.getUser()` → 인증 확인
2. `profiles.select('role, academy_id').eq('id', user.id).single()` → 역할 조회
3. `['admin', 'system_admin'].includes(role)` 확인
4. `academy_id` null 체크 (system_admin 방어)

**기존 checkAdminOrTeacherRole()과의 차이:**
- 허용 역할: `['admin', 'system_admin']` (teacher 제외)
- 에러 메시지: '학원 관리자만 수정할 수 있습니다.' (구체적)
- 반환값에 `academyId` 포함 (updateMyAcademy에서 사용)

### 3-2. getMyAcademy()

```typescript
export async function getMyAcademy(): Promise<AcademyActionResult>
```

**흐름:**
1. 인증 확인 (`getUser()`)
2. profiles에서 `academy_id`, `role` 조회
3. `academy_id` null 체크 → system_admin 방어
4. `academies.select('*').eq('id', academy_id).single()` 조회
5. snake_case → camelCase 변환 + role 포함하여 반환

**에지 케이스:**
- 인증 실패 → `{ error: '인증이 필요합니다.' }`
- 프로필 없음 → `{ error: '프로필을 찾을 수 없습니다.' }`
- academy_id null (system_admin) → `{ error: '소속 학원이 없습니다.' }`
- DB 조회 에러 → `{ error: '학원 정보를 찾을 수 없습니다.' }`

### 3-3. updateMyAcademy()

```typescript
export async function updateMyAcademy(
  _prevState: AcademyActionResult | null,
  formData: FormData
): Promise<AcademyActionResult>
```

**흐름:**
1. `checkAdminRole()` → admin 확인 + academy_id 획득
2. FormData → raw object 변환
3. `academyUpdateSchema.safeParse(raw)` → Zod 검증
4. camelCase → snake_case 변환 + DB update
5. `revalidatePath('/admin/academy')` → 캐시 무효화
6. 성공 응답 반환

**보안 설계 (Defense in Depth):**
- 1차: `checkAdminRole()` — 앱 레벨 RBAC
- 2차: Zod 스키마 — invite_code, settings 등 수정 불가 필드 자동 차단 (strip 모드)
- 3차: RLS `academies_update_admin` — DB 레벨에서 admin만 UPDATE 허용

**빈 문자열 → null 변환:**
- FormData에서 빈 input은 빈 문자열(`''`)로 전달
- `parsed.data.address || null` → 빈 문자열이면 DB에 null 저장
- logoUrl도 동일 처리

---

## 4. 테스트 설계 (TDD RED 단계)

### Mock 구조 (schools.test.ts 패턴 동일)

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

### 헬퍼 함수

```typescript
// admin Mock: profiles → { role: 'admin', academy_id: 'academy-1' }
function mockAuthAsAdmin()

// teacher Mock: profiles → { role: 'teacher', academy_id: 'academy-1' }
function mockAuthAsTeacher()

// student Mock: profiles → { role: 'student', academy_id: 'academy-1' }
function mockAuthAsStudent()

// 인증 실패 Mock
function mockAuthFailed()

// FormData 생성 헬퍼
function createMockFormData(data: Record<string, string>): FormData
```

### 테스트 케이스 (13개)

#### getMyAcademy (6개)

| # | 테스트명 | 시나리오 | 기대 결과 |
|---|---------|---------|-----------|
| 1 | 성공: admin이 자기 학원 조회 | admin 인증 + academy 존재 | academy 데이터 + role='admin' |
| 2 | 성공: teacher가 자기 학원 조회 | teacher 인증 + academy 존재 | academy 데이터 + role='teacher' |
| 3 | 실패: 인증 안 됨 | getUser 실패 | `{ error: '인증이 필요합니다.' }` |
| 4 | 실패: 프로필 없음 | getUser 성공, profiles null | `{ error: '프로필을 찾을 수 없습니다.' }` |
| 5 | 실패: academy_id null | system_admin (academy_id=null) | `{ error: '소속 학원이 없습니다.' }` |
| 6 | 실패: DB 조회 에러 | profiles 성공, academies 에러 | `{ error: '학원 정보를 찾을 수 없습니다.' }` |

#### updateMyAcademy (7개)

| # | 테스트명 | 시나리오 | 기대 결과 |
|---|---------|---------|-----------|
| 7 | 성공: admin이 학원 정보 수정 | admin + 유효 데이터 | 성공 + revalidatePath 호출 |
| 8 | 성공: 선택 필드 빈값도 정상 | admin + address/phone/logoUrl 빈값 | 성공 (null로 저장) |
| 9 | 실패: teacher 권한 에러 | teacher 인증 | `{ error: '학원 관리자만 수정할 수 있습니다.' }` |
| 10 | 실패: student 권한 에러 | student 인증 | `{ error: '학원 관리자만 수정할 수 있습니다.' }` |
| 11 | 실패: 인증 안 됨 | getUser 실패 | `{ error: '인증이 필요합니다.' }` |
| 12 | 실패: Zod 검증 에러 | admin + name 빈값 | `{ error: '학원명을 입력해주세요.' }` |
| 13 | 실패: DB 업데이트 에러 | admin + DB 에러 | `{ error: '학원 정보 수정에 실패했습니다.' }` |

### Mock 순서 주의사항

`getMyAcademy()`는 `from()`을 **2번** 호출 (profiles + academies):
```typescript
// 1번째: profiles 조회
mockSupabaseClient.from.mockReturnValueOnce(profileQuery)
// 2번째: academies 조회
mockSupabaseClient.from.mockReturnValueOnce(academyQuery)
```

`updateMyAcademy()`의 `checkAdminRole()`도 `from()`을 **1번** 호출 (profiles):
```typescript
// checkAdminRole 내부: profiles 조회
mockSupabaseClient.from.mockReturnValueOnce(profileQuery)
// 실제 update 쿼리: academies
mockSupabaseClient.from.mockReturnValueOnce(updateQuery)
```

---

## 5. 구현 순서 (TDD 사이클)

### Phase A: RED (테스트 먼저)

1. `src/lib/actions/__tests__/academies.test.ts` 작성 (13개 테스트)
2. `npx vitest run src/lib/actions/__tests__/academies.test.ts` → **모두 FAIL 확인**

### Phase B: GREEN (최소 구현)

3. `src/lib/actions/academies.ts` 작성
   - `AcademyActionResult`, `AcademyData` 타입
   - `checkAdminRole()` 헬퍼
   - `getMyAcademy()` 구현
   - `updateMyAcademy()` 구현
4. `npx vitest run src/lib/actions/__tests__/academies.test.ts` → **모두 PASS 확인**

### Phase C: REFACTOR (리팩토링)

5. 코드 리뷰 (code-reviewer 에이전트)
6. 불필요한 중복 제거, console.error 패턴 통일

### Phase D: 검증

7. `npm run test:run` → 전체 테스트 통과 확인
8. `npm run build` → 빌드 통과 확인

---

## 6. 파일 변경 요약

### 새로 생성 (2개)

| 파일 | 설명 | 예상 줄 수 |
|------|------|-----------|
| `src/lib/actions/__tests__/academies.test.ts` | Server Actions 테스트 (13개) | ~250줄 |
| `src/lib/actions/academies.ts` | getMyAcademy + updateMyAcademy | ~120줄 |

### 수정: 없음

### 의존성

- `src/lib/validations/academies.ts` — Step 1에서 완료 (academyUpdateSchema)
- `src/lib/supabase/server.ts` — 기존 createClient()
- `next/cache` — revalidatePath()

---

## 7. 리스크 평가

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| Mock 체이닝 순서 복잡 (from 2번 호출) | 중간 | mockReturnValueOnce 순서 철저히 관리 |
| Supabase placeholder 타입 | 낮음 | `as any` 캐스팅 (기존 패턴) |
| FormData 빈값 처리 | 낮음 | `\|\| null` 패턴으로 통일 |
| 00004 마이그레이션 (invite_code) Cloud 적용 여부 | 중간 | 조회만 하므로 컬럼 없어도 에러 안남, null 반환 |

---

## 8. 학습 포인트 (구현 후 리뷰 세션용)

### 8-1. Self-referencing ID 패턴

다른 학원 수정 방지를 위해 **파라미터가 아닌 profile에서 ID 추출**:
```
schools.ts: updateSchool(id, ...) ← ID를 파라미터로 받음 (악의적 변조 가능)
academies.ts: updateMyAcademy(...) ← profile.academy_id 사용 (자기 것만 수정 가능)
```

### 8-2. Defense in Depth (3중 방어)

| 계층 | 방어 수단 | 역할 |
|------|----------|------|
| 앱 레이어 | `checkAdminRole()` | admin/system_admin만 통과 |
| 데이터 계층 | Zod `strip` 모드 | invite_code, settings 필드 자동 제거 |
| DB 계층 | RLS `academies_update_admin` | DB에서 한 번 더 admin 확인 |

### 8-3. RBAC 헬퍼 분리 원칙

역할 범위에 따라 별도 헬퍼:
- `checkAdminOrTeacherRole()` — 학교 관리 (admin + teacher)
- `checkAdminRole()` — 학원 관리 (admin만)
- 향후: `checkAuthOnly()` — 인증만 필요한 경우

### 8-4. snake_case → camelCase 변환 계층

Server Action이 프론트엔드와 DB 사이의 **변환 계층** 역할:
```
DB (snake_case)  →  Server Action (변환)  →  프론트엔드 (camelCase)
logo_url         →  logoUrl
invite_code      →  inviteCode
is_active        →  isActive
```

---

## 9. 사용자 승인 대기

위 계획대로 TDD 구현을 시작해도 되는지 승인 요청합니다.

- **테스트**: 13개 (getMyAcademy 6개 + updateMyAcademy 7개)
- **구현 파일**: 2개 (actions + tests)
- **예상 작업량**: 테스트 먼저 → 구현 → 리팩토링 → 검증
