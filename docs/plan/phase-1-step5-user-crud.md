# 단계 1-5: 사용자 관리 CRUD [F009] 상세 계획

> **상태**: ✅ 계획 승인 완료 (2026-02-15)
> **작성일**: 2026-02-15
> **모델**: Opus 4.6 (계획), Sonnet 4.5 (구현)
> **전제 조건**: 1-1 인증, 1-3 학교 관리, 1-4 학원 관리 완료
> **Sequential Thinking**: 9단계 분석 완료

---

## 1. 요구사항 재정의

### PRD F009 전체 범위

- 학생 목록 (DataTable), 학생 등록 폼, 대량 등록 (CSV), 학생 삭제/비활성화
- 교사 목록, 교사 초대 (이메일), 담당 학년/과목 설정, 권한 관리

### ROADMAP 1-5 범위

- 사용자 목록 DataTable
- 역할 변경 (admin 전용)
- 사용자 상세 조회

### MVP 범위 (최종 결정)

| 기능 | 포함 | 근거 |
|------|------|------|
| profiles DataTable (같은 학원 소속) | ✅ | ROADMAP 명시 |
| 역할 필터링 (student/teacher/admin) | ✅ | DataTable 필수 기능 |
| 이름/이메일 검색 | ✅ | DataTable 필수 기능 |
| 역할 변경 (admin/system_admin만) | ✅ | ROADMAP 명시, 핵심 기능 |
| 사용자 비활성화 (is_active 토글) | ✅ | 삭제 대신 안전한 비활성화 패턴 |
| 사용자 상세 조회 (Sheet 패널) | ✅ | ROADMAP 명시 |
| 학생/교사 확장 테이블 CRUD | ❌ | Phase 2 RBAC(2-1)에서 처리 |
| 교사 초대 (이메일 발송) | ❌ | 이메일 인프라 필요 |
| 대량 등록 (CSV) | ❌ | PRD에서도 MVP 제외 |
| 학생 등록 폼 | ❌ | 회원가입 플로우로 대체 |

### 1-3 학교 관리와의 비교

| 측면 | 학교 관리 (1-3) | 사용자 관리 (1-5) |
|------|----------------|------------------|
| 테이블 | schools (단일) | profiles (주) |
| CRUD | 전체 CRUD | R + 부분 U (역할/활성화) |
| 생성 | 폼으로 직접 생성 | 회원가입 트리거로 자동 (생성 UI 없음) |
| 삭제 | deleteSchool | **비활성화** (is_active 토글) |
| 수정 권한 | admin + teacher | **admin + system_admin만** |
| 조회 권한 | 전체 인증 사용자 | admin + teacher + system_admin |
| 특수 기능 | - | **역할 변경** (RBAC 규칙) |
| 상세 조회 | [id]/edit 페이지 | **Sheet 다이얼로그** |

---

## 2. DB 스키마 확인

### profiles 테이블

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  academy_id UUID REFERENCES academies(id),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin', 'system_admin')),
  avatar_url TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT profiles_academy_required
    CHECK (role = 'system_admin' OR academy_id IS NOT NULL)
);
```

### 관련 RLS 정책

| 정책 | 대상 | 조건 |
|------|------|------|
| `profiles_select_same_academy` | SELECT | `academy_id = get_user_academy_id() OR id = auth.uid()` |
| `profiles_update_own` | UPDATE | `id = auth.uid()` (자기 프로필) |
| `profiles_update_admin` | UPDATE | 같은 학원 + admin/system_admin |
| `profiles_insert` | INSERT | 자기 자신 또는 admin |

> **중요**: `profiles_update_admin`은 column-level 제한이 없으므로, admin이 role을 system_admin으로 변경하는 것을 RLS로는 막을 수 없음. **Server Action에서 반드시 검증 필요.**

---

## 3. 보안 분석

### 역할 변경 위협 모델

| 위협 | 심각도 | 방어 |
|------|--------|------|
| admin이 자신을 system_admin으로 승격 | **CRITICAL** | Server Action에서 system_admin 변경 하드코딩 차단 |
| admin이 다른 학원 사용자 역할 변경 | **HIGH** | RLS(같은 학원) + Server Action(academy_id 검증) |
| admin이 다른 admin 강등 | **MEDIUM** | admin은 admin 역할 변경 불가 (system_admin만) |
| 자기 자신 역할 변경 | **MEDIUM** | Server Action에서 self-change 차단 |
| system_admin 비활성화 | **MEDIUM** | Server Action에서 차단 |

### Defense in Depth (3중 방어)

```
1차: Server Action → RBAC 체크 + 역할 변경 규칙 검증
2차: Zod strip → 허용된 필드만 통과
3차: RLS → 같은 학원 소속만 수정 가능
```

### 역할 변경 권한 매트릭스

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

### admin 클라이언트 vs 일반 클라이언트

HANDOFF.md에서 "admin 클라이언트(service role) 사용" 권고가 있었으나, 분석 결과:

- **일반 클라이언트 사용 결정** (service role 미사용)
- 이유:
  1. `profiles_update_admin` RLS가 이미 admin의 같은 학원 프로필 수정 허용
  2. 일반 클라이언트 = RLS "같은 학원" 제약 유지 → 2중 방어
  3. admin 클라이언트 = RLS 완전 우회 → 코드 버그 시 다른 학원 영향 가능
  4. Server Action이 유일한 게이트웨이이므로 역할 변경 규칙은 여기서 검증

---

## 4. 구현 계획 (5 Steps)

### Step 1: Zod 검증 스키마 (TDD) ✅

> **완료일**: 2026-02-16
> **테스트**: 37개 통과 (전체 272개 회귀 없음)
> **비고**: `z.enum` errorMap → message 옵션 변경 (Zod 3.23+ 호환)

**파일:**
- ✅ `src/lib/validations/users.ts`
- ✅ `src/lib/validations/__tests__/users.test.ts`

**스키마:**

```typescript
// 사용자 목록 필터 스키마
export const userFilterSchema = z.object({
  search: z.string().optional(),
  role: z.enum(['student', 'teacher', 'admin', 'all']).optional().default('all'),
  isActive: z.enum(['true', 'false', 'all']).optional().default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
})

// 역할 변경 스키마
export const roleChangeSchema = z.object({
  userId: z.string().uuid('올바른 사용자 ID가 아닙니다.'),
  newRole: z.enum(['student', 'teacher', 'admin'], {
    errorMap: () => ({ message: '유효하지 않은 역할입니다.' }),
  }),
})

// 활성화/비활성화 스키마
export const toggleActiveSchema = z.object({
  userId: z.string().uuid('올바른 사용자 ID가 아닙니다.'),
  isActive: z.boolean(),
})
```

**TDD 테스트 케이스:**
- userFilterSchema: 기본값 적용, 유효/무효 역할, 페이지 coerce
- roleChangeSchema: system_admin 거부, 유효 역할 통과, 잘못된 UUID 거부
- toggleActiveSchema: boolean 검증

---

### Step 2: Server Actions (TDD) ✅

> **완료일**: 2026-02-18
> **테스트**: 28개 통과 (전체 300개 회귀 없음)
> **학습 리뷰**: 🔴 CRITICAL — 삭제 후 재구현 완료 (Fail-fast, Defense in Depth, RBAC 매트릭스 체화)

**파일:**
- ✅ `src/lib/actions/users.ts` (300줄, 3 Actions + 2 헬퍼)
- ✅ `src/lib/actions/__tests__/users.test.ts` (626줄, 28 테스트)

**Actions:**

```typescript
// 1. getUserList(): 같은 학원 사용자 목록
export async function getUserList(
  filters?: UserFilterInput
): Promise<UserActionResult>

// 2. changeUserRole(): 역할 변경 (admin/system_admin만)
export async function changeUserRole(
  userId: string,
  newRole: 'student' | 'teacher' | 'admin'
): Promise<UserActionResult>

// 3. toggleUserActive(): 비활성화/활성화 (admin/system_admin만)
export async function toggleUserActive(
  userId: string,
  isActive: boolean
): Promise<UserActionResult>
```

**RBAC 헬퍼:**
```typescript
// admin/system_admin 확인 + profile 정보 반환
async function checkAdminRole(): Promise<{
  error?: string
  profile?: { id: string; role: string; academy_id: string }
}>
```

**getUserList 구현 포인트:**
- Supabase `or()` 필터로 name/email 동시 검색
- 페이지네이션: `range(from, to)` + `count: 'exact'`
- teacher도 조회 가능 (역할 변경은 불가)

**changeUserRole 검증 로직:**
1. checkAdminRole() → admin/system_admin 확인
2. userId로 대상 사용자 조회 (같은 학원 확인)
3. 자기 자신 변경 시도 → 차단
4. system_admin으로의 변경 → 차단
5. 호출자가 admin인 경우: 대상이 admin이면 차단, newRole이 admin이면 차단
6. 대상의 현재 role이 system_admin이면 → 차단

**TDD 테스트 케이스 (핵심):**
- getUserList: 인증 안 됨 → 에러
- getUserList: 정상 목록 반환 (필터 적용)
- getUserList: student 접근 → 에러
- changeUserRole: admin이 student→teacher ✅
- changeUserRole: admin이 student→admin ❌
- changeUserRole: admin이 admin→student ❌
- changeUserRole: system_admin이 student→admin ✅
- changeUserRole: 자기 자신 변경 ❌
- changeUserRole: *→system_admin ❌
- changeUserRole: 다른 학원 사용자 ❌
- toggleUserActive: admin이 사용자 비활성화 ✅
- toggleUserActive: 자기 자신 비활성화 ❌
- toggleUserActive: system_admin 비활성화 ❌

---

### Step 3: DataTable + 목록 페이지 UI

**파일:**
```
src/app/(dashboard)/admin/users/
├── page.tsx                         # Server Component (데이터 조회)
└── _components/
    ├── user-columns.tsx             # DataTable 컬럼 정의
    └── users-toolbar.tsx            # 필터/검색 툴바
```

**page.tsx (Server Component):**
- `searchParams` 파싱 (Next.js 16 `Promise` 패턴)
- `getUserList(filters)` 호출
- 현재 사용자 role 확인 (admin이면 액션 버튼 표시)
- 에러 상태 처리

**user-columns.tsx:**

| 컬럼 | 내용 | 비고 |
|------|------|------|
| 이름 | name | 정렬 가능 |
| 이메일 | email | 정렬 가능 |
| 역할 | role | Badge 컴포넌트 (student=회색, teacher=파랑, admin=보라) |
| 상태 | is_active | 활성/비활성 Badge |
| 가입일 | created_at | ko-KR 포맷 |
| 액션 | 역할 변경, 비활성화 | DropdownMenu (admin만 표시) |

**users-toolbar.tsx:**
- 이름/이메일 검색 (Input + debounce)
- 역할 필터 (Select: 전체/학생/교사/관리자)
- 활성 상태 필터 (Select: 전체/활성/비활성)
- router.push로 searchParams 업데이트

---

### Step 4: 역할 변경/비활성화 UI + 상세 Sheet

**파일:**
```
src/app/(dashboard)/admin/users/_components/
├── role-change-dialog.tsx           # 역할 변경 AlertDialog
└── user-detail-sheet.tsx            # 사용자 상세 Sheet
```

**role-change-dialog.tsx:**
- AlertDialog (파괴적 작업이므로 Dialog가 아닌 AlertDialog)
- Select로 새 역할 선택 (호출자 권한에 따라 옵션 제한)
- `useTransition` + `changeUserRole` Server Action
- 성공 시 toast + router.refresh()

**user-detail-sheet.tsx:**
- Sheet (사이드 패널) 컴포넌트
- 사용자 기본 정보 표시 (이름, 이메일, 역할, 전화번호, 가입일, 상태)
- 역할 변경 버튼 (admin만)
- 비활성화/활성화 토글 (admin만)
- 자기 자신에 대한 액션 비활성화

---

### Step 5: 사이드바 메뉴 + 빌드 검증 + 학습 리뷰

**Phase A: 사이드바 메뉴 추가**
- `src/lib/constants/menu.ts`에 "사용자 관리" (`/admin/users`) 추가
- 아이콘: `Users` (lucide-react)
- 위치: 학원 관리 아래

**Phase B: 빌드 검증**
- `npm run test:run` → 전체 테스트 통과
- `npm run lint` → 에러 0개
- `npm run build` → 빌드 성공

**Phase C: 학습 리뷰 (MANDATORY)**
- 핵심 개념 리뷰 → 이해도 체크 → 직접 구현 추천

---

## 5. 학습 포인트

### Step 1 학습: 🟢 ROUTINE
- Zod `z.coerce.number()`: searchParams 문자열 → 숫자 자동 변환
- `z.enum(['...'])`: 허용 값 리스트 검증

### Step 2 학습: 🔴 CRITICAL
- **역할 기반 접근 제어(RBAC) 비즈니스 규칙**: 보안의 핵심. 누가 누구의 역할을 변경할 수 있는지 매트릭스 설계
- **권한 상승 공격(Privilege Escalation) 방어**: system_admin 승격 차단. 보안 취약점의 대표 사례
- **자기 수정 방지(Self-modification Prevention)**: 관리자가 자신의 권한을 실수로 제거하는 것 방지
- **Supabase `or()` 필터**: 복수 컬럼 동시 검색 패턴

### Step 3 학습: 🟡 RECOMMENDED
- **DataTable 커스텀 셀 렌더러**: Badge 컴포넌트로 역할/상태 시각화
- **서버 사이드 필터/페이지네이션**: searchParams → Server Component → Supabase 쿼리

### Step 4 학습: 🟡 RECOMMENDED
- **AlertDialog vs Dialog**: 파괴적/위험한 작업에는 AlertDialog (Escape로 닫히지 않음)
- **Sheet 컴포넌트**: 상세 정보를 페이지 이동 없이 표시하는 UX 패턴
- **조건부 UI 렌더링**: 호출자 권한에 따라 가능한 역할 옵션 제한

---

## 6. 리스크 평가

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| 역할 변경 규칙 버그 → 권한 상승 | **높음** | TDD로 모든 경우의 수 테스트 (매트릭스 기반 12+ 케이스) |
| 같은 학원 소속 확인 누락 | **높음** | RLS + Server Action 이중 방어 |
| Supabase or() 검색 성능 | 낮음 | 사용자 수가 학원 단위이므로 수백~수천 수준 |
| placeholder 타입 (as any) | 낮음 | 기존 패턴 유지 |
| DataTable 서버사이드 페이지네이션 | 낮음 | 1-3 학교 관리 패턴 그대로 재사용 |

---

## 7. 파일 변경 요약

### 새로 생성 (9개)

| 파일 | 설명 |
|------|------|
| `src/lib/validations/users.ts` | 사용자 필터/역할변경/활성화 Zod 스키마 |
| `src/lib/validations/__tests__/users.test.ts` | 스키마 테스트 |
| `src/lib/actions/users.ts` | 사용자 관리 Server Actions |
| `src/lib/actions/__tests__/users.test.ts` | Actions 테스트 |
| `src/app/(dashboard)/admin/users/page.tsx` | 사용자 목록 페이지 |
| `src/app/(dashboard)/admin/users/_components/user-columns.tsx` | DataTable 컬럼 |
| `src/app/(dashboard)/admin/users/_components/users-toolbar.tsx` | 필터 툴바 |
| `src/app/(dashboard)/admin/users/_components/role-change-dialog.tsx` | 역할 변경 다이얼로그 |
| `src/app/(dashboard)/admin/users/_components/user-detail-sheet.tsx` | 상세 Sheet |

### 수정 (1개)

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/constants/menu.ts` | "사용자 관리" 메뉴 추가 |

---

## 8. 사용자 확인 사항 (모두 승인 완료 ✅)

### ✅ 확인 1: admin 클라이언트 미사용

- **결정**: 일반 클라이언트 + Server Action 검증 사용
- HANDOFF 권고(admin 클라이언트)를 분석 후 변경
- 이유: RLS 2중 방어 유지, admin 클라이언트는 RLS 우회 → 코드 버그 시 위험

### ✅ 확인 2: 비활성화 기능 포함

- **결정**: 포함 (삭제 대신 비활성화)
- ROADMAP에 없지만 안전한 패턴으로 추가

### ✅ 확인 3: 사용자 상세를 Sheet로 구현

- **결정**: Sheet (사이드 패널) 사용
- 별도 페이지 불필요, MVP에 충분

### ✅ 확인 4: 역할 변경 권한 매트릭스 확정

- admin: student ↔ teacher만 (admin 부여/해제 불가)
- system_admin: student ↔ teacher ↔ admin (system_admin 승격 절대 불가)
