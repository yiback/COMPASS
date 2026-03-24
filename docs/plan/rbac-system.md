# 2-1 RBAC 시스템 — 마스터 PLAN v2.1

> 작성일: 2026-03-23 (v1) → 2026-03-24 (v2 → v2.1)
> 상태: **READY — 구현 시작 가능**
> 예상 작업량: S~M (2-3일)
> v1→v2 변경: 방식 C 채택, 8→5 Task 축소, YAGNI 적용
> v2→v2.1 변경: 리뷰 MUST FIX 3건 + SHOULD FIX 4건 반영

---

## 1. 요구사항 재정의

### 목표
역할 기반 접근 제어(RBAC)를 정적 코드 기반으로 구현하여 3개 역할(admin, teacher, student)과 system_admin에 대한
라우트 보호, UI 메뉴 필터링, Server Action 권한 체크를 통합한다.

### 현재 상태
1. **RLS 계층 (완성)**: `get_user_role()`, `has_role()`, `has_any_role()` 헬퍼 + 테이블별 정책 — **변경 불필요**
2. **Server Action 계층 (중복)**: 7가지 인증 헬퍼 변형이 10개 Action 파일에 산재, 10곳의 하드코딩된 역할 배열
3. **미들웨어 (인증만)**: 로그인 여부만 체크, 역할 기반 라우트 보호 없음
4. **사이드바/메뉴 (무필터)**: 역할 구분 없이 전체 메뉴 노출
5. **Layout (미활용)**: profile.role 조회하지만 역할 체크/전달 안 함
6. **page.tsx (부분 사용)**: `upload/page.tsx`, `past-exams/page.tsx` 등에서 이미 인라인 역할 체크 존재 (방식 C 패턴)

### 핵심 원칙
- **Defense in Depth 4중 방어**: page.tsx(라우트) + 사이드바(UX) + Server Action(보안) + RLS(DB 방어)
- **미들웨어는 인증만**: 매 요청마다 profiles 조회는 성능 부담 → 미들웨어 변경 없음
- **page.tsx에서 requireRole()**: Layout pathname 접근 문제 해소, Next.js 공식 권장 패턴
- **React 19 cache()로 DB 최적화**: layout + page 간 실질 1회 조회
- **코드 기반 정적 RBAC**: 3+1 역할은 고정 — DB 권한 테이블은 과도(YAGNI)

---

## 2. 핵심 설계 결정

| # | 결정 | 선택 | 대안 (기각) | 근거 |
|---|------|------|------------|------|
| D1 | 권한 저장 방식 | 코드 기반 상수 (`as const`) | DB 권한 테이블 | MVP 3+1 역할 고정; DB 조인 비용 불필요; 타입 안전성 확보 |
| D2 | 라우트 보호 위치 | **page.tsx + Server Action** | Layout (v1) | Layout은 pathname 접근 불가 (App Router 설계); page.tsx는 Next.js/Vercel 공식 권장; 기존 2개 page.tsx에서 이미 사용 중 |
| D3 | 클라이언트 역할 접근 | **props drilling** | RoleProvider (React Context) | 소비자 2개(사이드바, 모바일네비)뿐 → Context 과잉 |
| D4 | 공유 인증 유틸 | `src/lib/auth/` 모듈 | 기존 인라인 유지 | 7가지 변형 통합 → 단일 진실 공급원 (DRY) |
| D5 | parent 역할 | **단계 4로 이동** | DB CHECK 확장 (v1) | YAGNI — parent 소비자 0개; 단계 4 학부모 리포트에서 추가 |
| D6 | 401 vs 403 처리 | 403 전용 페이지 (`/unauthorized`) | toast 알림 | 명확한 UX; 뒤로가기/대시보드 이동 제공 |
| D7 | system_admin 처리 | 모든 권한 암묵 허용 | 명시적 나열 | 최상위 관리자는 항상 접근 가능 — 체크 함수에서 별도 처리 |
| D8 | DB 조회 최적화 | **React 19 cache()** | 없음 (v1) | layout + page 모두 getCurrentProfile() 호출 → 동일 요청 내 1회만 실행 |

### v1 대비 변경 요약

| 항목 | v1 | v2 | 이유 |
|------|----|----|------|
| Task 수 | 8개 | **5개** | YAGNI 적용 |
| Wave 수 | 5개 | **4개** | 병렬 최적화 |
| 라우트 보호 | Layout pathname | **page.tsx requireRole()** | HIGH 리스크 해소 |
| parent 마이그레이션 | Task 4 포함 | **제거 (단계 4)** | YAGNI |
| RoleProvider | Task 6 포함 | **제거 (props drilling)** | 소비자 2개뿐 |
| Action 리팩토링 | Task 7 (9개 파일) | **제거 (독립 이슈)** | RBAC와 무관한 코드품질 |
| permissions.ts | Task 1 포함 | **제거** | route-permissions.ts와 중복, premature abstraction |
| 리스크 등급 | HIGH 1건 | **LOW 2건** | 방식 C로 근본 해소 |
| 변경 파일 수 | ~30개 | **~17개** | 범위 대폭 축소 |

---

## 3. 권한 매트릭스

### 3.1 라우트 접근 권한

| 라우트 | admin | teacher | student | system_admin |
|--------|-------|---------|---------|-------------|
| `/` (대시보드) | ✅ | ✅ | ✅ | ✅ |
| `/past-exams` | ✅ | ✅ | ❌ | ✅ |
| `/past-exams/upload` | ✅ | ✅ | ❌ | ✅ |
| `/past-exams/[id]/edit` | ✅ | ✅ | ❌ | ✅ |
| `/generate` | ✅ | ✅ | ❌ | ✅ |
| `/questions` | ✅ | ✅ | ✅ (읽기) | ✅ |
| `/admin/academy` | ✅ | ❌ | ❌ | ✅ |
| `/admin/users` | ✅ | ✅ | ❌ | ✅ |
| `/admin/schools` | ✅ | ✅ | ❌ | ✅ |
| `/settings` | ✅ | ✅ | ✅ | ✅ |
| `/unauthorized` | ✅ | ✅ | ✅ | ✅ |

### 3.2 Server Action 권한 (변경 없음 — 기존 유지)

| Action | 허용 역할 | 비고 |
|--------|----------|------|
| `getUserList` | admin, teacher, system_admin | 같은 학원 사용자 조회 |
| `changeUserRole` | admin, system_admin | admin 전용 |
| `toggleUserActive` | admin, system_admin | admin 전용 |
| `getQuestionList` | admin, teacher, student, system_admin | student는 읽기만 |
| `saveGeneratedQuestions` | admin, teacher, system_admin | 문제 저장 |
| `generateQuestionsAction` | admin, teacher, system_admin | AI 문제 생성 |
| `createPastExamAction` | admin, teacher, system_admin | 시험 생성 |
| `extractQuestionsAction` | admin, teacher, system_admin | AI 추출 |
| `getSchoolList` | 모든 인증 사용자 | 공개 정보 |
| `createSchool` / `updateSchool` / `deleteSchool` | admin, teacher, system_admin | 학교 관리 |
| `getAcademy` / `updateAcademy` | admin, system_admin | 학원 관리 |

---

## 4. Task 분해

### 의존성 그래프

```
Task 1 (권한 정의) ──┬──→ Task 2 (공유 인증 유틸)
                     │
                     ├──→ Task 4 (사이드바 필터링)
                     │
                     └──→ Task 3 (page.tsx 역할 체크 + Layout 수정) ← Task 2
                                          │
                                          └──→ Task 5 (테스트) ← Task 1~4
```

---

### Task 1: 권한 정의 모듈

- **소유**: backend-actions (`src/lib/auth/`)
- **의존성**: 없음
- **위험도**: Low

#### 생성 파일

| 파일 | 설명 |
|------|------|
| `src/lib/auth/roles.ts` | Role 타입, 역할 상수, system_admin 포함 |
| `src/lib/auth/route-permissions.ts` | 경로 패턴 → 허용 역할 매핑 (문서화 상수, 테스트 검증용) |
| `src/lib/auth/index.ts` | 배럴 파일 (공개 API) |

#### 핵심 설계

```typescript
// roles.ts
export const ROLES = ['student', 'teacher', 'admin', 'system_admin'] as const
export type Role = (typeof ROLES)[number]

// route-permissions.ts — 문서화 상수 + 테스트 검증용 (런타임 canAccessRoute 없음)
// page.tsx는 requireRole() 직접 호출, 사이드바는 MenuItem.roles로 필터링
// 이 배열은 "경로-역할 매핑 문서"로 테스트에서 page.tsx의 requireRole 인자 일치를 검증하는 데 사용
export const ROUTE_PERMISSIONS: { pattern: string; roles: Role[] }[] = [
  { pattern: '/admin/academy', roles: ['admin'] },
  { pattern: '/admin/users', roles: ['admin', 'teacher'] },
  { pattern: '/admin/schools', roles: ['admin', 'teacher'] },
  { pattern: '/past-exams', roles: ['admin', 'teacher'] },
  { pattern: '/generate', roles: ['admin', 'teacher'] },
  { pattern: '/questions', roles: ['admin', 'teacher', 'student'] },
  // 미등록 경로는 인증된 모든 사용자 허용 (대시보드, 설정 등)
]
// canAccessRoute() 함수는 v2.1에서 제거 — 실질 소비자 없음 (YAGNI)
// page.tsx → requireRole() 직접 호출, 사이드바 → MenuItem.roles 필터
```

**주의**:
- `ROUTE_PERMISSIONS`는 문서화 + 테스트 검증용 상수. 런타임에서 직접 사용하지 않음
- page.tsx에서는 `requireRole(['admin', 'teacher'])` 직접 호출
- 구체적 경로 먼저 정의 (예: `/admin/academy`가 `/admin` 앞에)
- `startsWith` 매칭으로 하위 경로 자동 포함 (예: `/past-exams/upload`는 `/past-exams` 규칙 적용)

---

### Task 2: 공유 인증 유틸리티

- **소유**: backend-actions (`src/lib/auth/`)
- **의존성**: Task 1 (Role 타입 참조)
- **위험도**: Low

#### 생성 파일

| 파일 | 설명 |
|------|------|
| `src/lib/auth/get-current-user.ts` | React 19 `cache()`로 감싼 getCurrentProfile |
| `src/lib/auth/require-role.ts` | Server Component용 역할 체크 (redirect 포함) |

#### 핵심 설계

```typescript
// get-current-user.ts
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export interface CurrentProfile {
  readonly id: string
  readonly role: Role           // ← string → Role 타입 강화 (리뷰 C2 반영)
  readonly academyId: string | null  // ← system_admin은 null 허용 (리뷰 MF1 반영)
  readonly name: string
  readonly email: string
  readonly avatarUrl: string | null
}

// AUTH_ERRORS — require-role.ts 내부 상수로 배치 (리뷰 SF4 반영)
const AUTH_ERRORS = {
  UNAUTHENTICATED: '인증이 필요합니다.',
  PROFILE_NOT_FOUND: '프로필을 찾을 수 없습니다.',
  NO_ACADEMY: '소속 학원이 없습니다.',
  UNAUTHORIZED: '권한이 없습니다.',
} as const

// React 19 cache(): 동일 요청 내 layout + page 모두 호출해도 DB 실질 1회
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, academy_id, name, email, avatar_url')
    .eq('id', user.id)
    .single()

  if (!profile) return null
  // system_admin만 academy_id NULL 허용 (DB CHECK 제약조건과 일치)
  if (profile.role !== 'system_admin' && !profile.academy_id) return null

  return {
    id: profile.id,
    role: profile.role as Role,
    academyId: profile.academy_id,  // system_admin은 null
    name: profile.name,
    email: profile.email,
    avatarUrl: profile.avatar_url,
  }
})

// require-role.ts — page.tsx에서 사용
import { redirect } from 'next/navigation'
import type { Role } from './roles'
import { getCurrentProfile, type CurrentProfile } from './get-current-user'

export async function requireRole(allowedRoles: Role[]): Promise<CurrentProfile> {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'system_admin' && !allowedRoles.includes(profile.role)) {
    redirect('/unauthorized')  // ← profile.role이 이미 Role 타입이므로 as 캐스팅 불필요
  }
  return profile
}
```

**기존 패턴 대비 변경점**:
- page.tsx에서 사용: `const profile = await requireRole(['admin', 'teacher'])` — 1줄로 역할 체크 완료
- Server Action에서는 기존 인라인 헬퍼 유지 (v2에서는 Action 리팩토링 미포함)
- `getCurrentProfile`은 layout.tsx에서도 사용 → `cache()`로 중복 조회 제거

---

### Task 3: page.tsx 역할 체크 + Layout 수정

- **소유**: 리드 only (`layout.tsx` — 공유 파일) + frontend-ui (`page.tsx`, `unauthorized/page.tsx`)
- **의존성**: Task 2 (requireRole, getCurrentProfile)
- **위험도**: Low — page.tsx별 2~5줄 추가, Layout은 props 전달만

#### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/app/(dashboard)/layout.tsx` | `getCurrentProfile()` 사용 → role을 사이드바/모바일네비에 props 전달 |

#### 생성 파일

| 파일 | 설명 |
|------|------|
| `src/app/(dashboard)/unauthorized/page.tsx` | 403 페이지 — "접근 권한이 없습니다" + 대시보드 링크 |

#### Layout 수정 설계

```typescript
// layout.tsx 변경 흐름
// 1. 기존 Supabase 직접 조회 → getCurrentProfile() 사용 (cache 적용)
// 2. role을 사이드바/모바일네비에 props 전달
// 3. Layout에서 역할 체크 없음 — 역할 체크는 page.tsx에서

// <DashboardSidebar role={profile.role} />
// <DashboardHeader user={{...}} role={profile.role} />
```

#### 보호 대상 page.tsx (9개) — 리뷰 MF2, MF4 반영

| 경로 | 허용 역할 | 파일 | 기존 상태 |
|------|----------|------|----------|
| `/past-exams` | admin, teacher | `past-exams/page.tsx` | **역할 체크 없음 (리뷰 MF2 추가)** |
| `/past-exams/upload` | admin, teacher | `past-exams/upload/page.tsx` | 이미 인라인 체크 존재 → redirect를 `/unauthorized`로 변경 |
| `/past-exams/[id]/edit` | admin, teacher | `past-exams/[id]/edit/page.tsx` | 이미 인라인 체크 존재 |
| `/generate` | admin, teacher | `generate/page.tsx` | 역할 체크 없음 |
| `/questions` | admin, teacher, student | `questions/page.tsx` | **역할 체크 없음 (리뷰 MF4 추가)** |
| `/admin/academy` | admin | `admin/academy/page.tsx` | 역할 체크 없음 |
| `/admin/users` | admin, teacher | `admin/users/page.tsx` | 인라인 역할 조회 존재 |
| `/admin/schools` | admin, teacher | `admin/schools/page.tsx` | 역할 체크 없음 |
| `/admin/schools/new` | admin, teacher | `admin/schools/new/page.tsx` | 역할 체크 없음 |

**각 page.tsx 변경 패턴 (2~5줄)**:

```typescript
import { requireRole } from '@/lib/auth'

export default async function SomePage() {
  const profile = await requireRole(['admin', 'teacher'])
  // profile.role, profile.academyId 등 바로 사용 가능
  // ...기존 로직
}
```

**구현 가이드 — 리뷰 SF2, SF3 반영**:
- `admin/users/page.tsx`: 기존 인라인 `supabase.auth.getUser()` + `profiles.select('id, role')` 코드를 제거하고, `requireRole()` 반환 profile에서 `callerRole = profile.role`, `callerId = profile.id`로 교체. cache() 밖의 중복 DB 조회 방지
- `admin/academy/page.tsx`: `requireRole(['admin'])` 반환 `profile.role`로 `canEdit` 판단. `getMyAcademy()`의 role 반환은 기존 Action 미수정이므로 무시
- `past-exams/upload/page.tsx`: 기존 역할 불일치 시 `redirect('/past-exams')` → `redirect('/unauthorized')`로 변경

---

### Task 4: 사이드바 역할별 메뉴 필터링

- **소유**: frontend-ui (`src/lib/constants/`, `src/components/layout/`)
- **의존성**: Task 1 (Role 타입)
- **위험도**: Low

#### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/constants/menu.ts` | `MenuItem` 인터페이스에 `roles?: Role[]` 추가 + 각 항목에 역할 배열 |
| `src/components/layout/dashboard-sidebar.tsx` | `role?: Role` optional prop 추가 → `MENU_ITEMS.filter()` |
| `src/components/layout/mobile-nav.tsx` | `role?: Role` optional prop 추가 → 필터링 |
| `src/components/layout/dashboard-header.tsx` | `role?: Role` prop 추가 → MobileNav에 drilling (리뷰 MF3 반영) |

#### 핵심 설계

```typescript
// menu.ts 변경
import type { Role } from '@/lib/auth'

export interface MenuItem {
  title: string
  href: string
  icon: LucideIcon
  description?: string
  roles?: Role[]  // undefined = 모든 역할 허용
}

// sidebar, mobile-nav 공통 — role?: Role (optional, 리뷰 MF3 반영)
// role이 undefined면 전체 메뉴 표시 (Wave 2에서 layout 수정 전 타입 에러 방지)
const visibleItems = MENU_ITEMS.filter(item =>
  !role || !item.roles || role === 'system_admin' || item.roles.includes(role)
)

// props drilling 경로 (리뷰 MF3 반영):
// layout.tsx → <DashboardSidebar role={profile.role} />
// layout.tsx → <DashboardHeader role={profile.role} /> → <MobileNav role={role} />
```

#### 메뉴-역할 매핑

| 메뉴 | roles |
|------|-------|
| 대시보드 | `undefined` (전체) |
| 기출문제 | `['admin', 'teacher']` |
| 문제 생성 | `['admin', 'teacher']` |
| 문제 관리 | `['admin', 'teacher', 'student']` |
| 학원 관리 | `['admin']` |
| 사용자 관리 | `['admin', 'teacher']` |
| 학교 관리 | `['admin', 'teacher']` |
| 설정 | `undefined` (전체) |

---

### Task 5: 테스트

- **소유**: tester (`src/lib/auth/__tests__/`)
- **의존성**: Task 1~4 전체
- **위험도**: Low

#### 생성 파일

| 파일 | 테스트 내용 |
|------|-----------|
| `src/lib/auth/__tests__/roles.test.ts` | Role 타입, ROLES 상수, ROUTE_PERMISSIONS 매핑 검증 |
| `src/lib/auth/__tests__/require-role.test.ts` | 인증 실패, 역할 불일치, system_admin 허용, academy_id null 처리 |

#### 테스트 범위 (예상 ~20-25개)

- **단위 테스트**: ROLES 상수, ROUTE_PERMISSIONS 매핑, `requireRole` 헬퍼, `getCurrentProfile` system_admin 분기 (~15개)
- **사이드바 테스트**: 역할별 메뉴 필터링 (~5개)
- **회귀 테스트**: 기존 1367+ 테스트 전체 PASS 확인

#### 핵심 테스트 케이스 (리뷰 반영 — canAccessRoute 제거)

1. `requireRole(['admin'])` + teacher 프로필 → redirect('/unauthorized')
2. `requireRole(['teacher'])` + system_admin 프로필 → 성공 (항상 허용)
3. `requireRole(['admin'])` + null 프로필 → redirect('/login')
4. `getCurrentProfile()` + system_admin (academy_id=null) → 정상 반환 (null 아님)
5. `getCurrentProfile()` + teacher (academy_id=null) → null 반환
6. ROUTE_PERMISSIONS 배열과 각 page.tsx requireRole 인자 일치 검증
7. 사이드바: student → 대시보드, 문제 관리, 설정 3개만 표시
8. 사이드바: admin → 전체 8개 표시
9. 사이드바: role=undefined → 전체 메뉴 표시 (fallback)

---

## 5. Wave 구성 (병렬 구현)

```
Wave 1 (사전작업) ─ 직렬
└── Task 1: 권한 정의 모듈        (backend-actions)

Wave 2 (인프라) ─ 병렬
├── Task 2: 공유 인증 유틸리티     (backend-actions) ← Task 1
└── Task 4: 사이드바 메뉴 필터링   (frontend-ui) ← Task 1

Wave 3 (통합) ─ 직렬
└── Task 3: page.tsx 역할 체크 + Layout 수정  (리드 + frontend-ui) ← Task 2

Wave 4 (검증) ─ 직렬
└── Task 5: 테스트                 (tester) ← Task 1~4
```

### 병렬 충돌 분석

| Wave | 에이전트 | 소유 파일 | 충돌 위험 |
|------|---------|----------|----------|
| Wave 1 | backend-actions: `src/lib/auth/roles.ts`, `route-permissions.ts`, `index.ts` | — | 없음 |
| Wave 2 | backend-actions: `src/lib/auth/get-current-user.ts`, `require-role.ts` | frontend-ui: `src/lib/constants/menu.ts`, `src/components/layout/` | ❌ 없음 |
| Wave 3 | 리드: `layout.tsx` + frontend-ui: `page.tsx` 7개, `unauthorized/page.tsx` | — | ❌ 없음 |
| Wave 4 | tester: `src/lib/auth/__tests__/` | — | ❌ 없음 |

---

## 6. 리스크

| 등급 | 리스크 | 대응 |
|------|--------|------|
| **LOW** | 새 page 추가 시 requireRole 누락 | 코드 리뷰 체크리스트에 "보호 필요한 page.tsx에 requireRole 호출 확인" 추가 |
| **LOW** | React 19 cache() SSR 동작 확인 | Wave 2에서 PoC 포함 — layout + page 양쪽에서 호출 후 DB 로그 1회만 확인 |

**v1 대비 리스크 대폭 경감**:
- ~~HIGH: Layout pathname 접근 불가~~ → 해소 (page.tsx 방식 채택)
- ~~MEDIUM: Task 7 리팩토링 9개 파일~~ → 제거 (독립 이슈로 분리)
- ~~MEDIUM: parent 역할 회원가입 영향~~ → 제거 (단계 4로 이동)

---

## 7. 에러 처리 전략

### 인증/권한 에러 계층

| 상황 | 처리 위치 | 동작 |
|------|----------|------|
| 미인증 (로그인 안 함) | 미들웨어 | `/login?redirect=` 리다이렉트 |
| 인증됨 + 역할 불일치 (라우트) | **page.tsx requireRole()** | `/unauthorized` 리다이렉트 |
| 인증됨 + 역할 불일치 (Action) | Server Action | `{ error: '권한이 없습니다.' }` 반환 |
| 인증됨 + 역할 불일치 (DB) | RLS | 빈 결과 또는 에러 (최종 방어선) |

### 에러 메시지 일관성

`AUTH_ERRORS` 상수는 `src/lib/auth/get-current-user.ts` 내부에 배치 (Task 2, 리뷰 SF4 반영):

```typescript
const AUTH_ERRORS = {
  UNAUTHENTICATED: '인증이 필요합니다.',
  PROFILE_NOT_FOUND: '프로필을 찾을 수 없습니다.',
  NO_ACADEMY: '소속 학원이 없습니다.',
  UNAUTHORIZED: '권한이 없습니다.',
} as const
```

---

## 8. 테스트 전략

### 테스트 유형별 범위

| 유형 | 대상 | 예상 수 |
|------|------|---------|
| **단위 테스트** | roles.ts, require-role.ts, getCurrentProfile system_admin 분기 | ~20개 |
| **회귀 테스트** | 기존 1367+ 테스트 전체 PASS 확인 | 기존 |

---

## 9. Phase 1 회고 교훈 반영

| 교훈 | 반영 위치 |
|------|----------|
| **PLAN 리뷰 3회 제한** | v1→v2가 마지막 리뷰. 구현 진행 |
| **academy_id 필터 체크리스트** | requireRole이 profile.academyId 반환 → page.tsx에서 바로 사용 |
| **Step 단위 빌드 체크** | Wave 완료마다 빌드 + 테스트 확인 |
| **에이전트 프롬프트에 "기존 패턴 확인"** | Task 3에서 기존 page.tsx 인라인 체크 패턴 참조 후 교체 |
| **IDOR 방어** | requireRole → profile.academyId 강제 반환으로 IDOR 방지 기반 유지 |
| **`{ error }` 반환 패턴 유지** | Server Action은 기존 패턴 그대로 유지 (이번 스코프에서 미변경) |
| **YAGNI 준수** | parent, RoleProvider, permissions.ts, Action 리팩토링 제거 |

---

## 10. 변경 영향 범위 요약

### 신규 파일 (~8개)

| 파일 | Task |
|------|------|
| `src/lib/auth/roles.ts` | 1 |
| `src/lib/auth/route-permissions.ts` | 1 |
| `src/lib/auth/index.ts` | 1 |
| `src/lib/auth/get-current-user.ts` | 2 |
| `src/lib/auth/require-role.ts` | 2 |
| `src/app/(dashboard)/unauthorized/page.tsx` | 3 |
| `src/lib/auth/__tests__/roles.test.ts` | 5 |
| `src/lib/auth/__tests__/require-role.test.ts` | 5 |

### 수정 파일 (~14개)

| 파일 | Task |
|------|------|
| `src/lib/constants/menu.ts` | 4 |
| `src/components/layout/dashboard-sidebar.tsx` | 4 |
| `src/components/layout/mobile-nav.tsx` | 4 |
| `src/components/layout/dashboard-header.tsx` | 4 (role prop drilling — 리뷰 MF3) |
| `src/app/(dashboard)/layout.tsx` | 3 |
| `src/app/(dashboard)/past-exams/page.tsx` | 3 (리뷰 MF2 추가) |
| `src/app/(dashboard)/past-exams/upload/page.tsx` | 3 |
| `src/app/(dashboard)/past-exams/[id]/edit/page.tsx` | 3 |
| `src/app/(dashboard)/generate/page.tsx` | 3 |
| `src/app/(dashboard)/questions/page.tsx` | 3 (리뷰 MF4 추가) |
| `src/app/(dashboard)/admin/academy/page.tsx` | 3 |
| `src/app/(dashboard)/admin/users/page.tsx` | 3 |
| `src/app/(dashboard)/admin/schools/page.tsx` | 3 |
| `src/app/(dashboard)/admin/schools/new/page.tsx` | 3 |

---

## 11. 이후 작업 (PLAN 범위 외)

PLAN에서 제거한 항목을 명시적으로 기록합니다.

| 항목 | 이동 시점 | 트리거 조건 |
|------|----------|------------|
| parent DB 마이그레이션 (CHECK 확장 + students FK) | **단계 4** | 학부모 리포트 구현 시 |
| RoleProvider (React Context) | **소비자 3개 이상 시** | 헤더 등 새 소비자 추가 시 |
| Server Action 리팩토링 (getCurrentUserProfile 7변형 통합) | **독립 리팩토링 이슈** | 코드품질 스프린트 시 |
| permissions.ts (행동 기반 세분화 권한) | **실제 필요 시** | 같은 역할 내 행동 분기가 필요해질 때 |

---

## 리서치 및 리뷰 참조

- `docs/research/tech/rbac-route-protection.md` — 4가지 방식 기술 비교 (방식 C 추천)
- `docs/research/feasibility/rbac-route-protection.md` — 실현 가능성 + 작업량 평가 (방식 C 작업량 S)
- devil-advocate 분석: YAGNI 적용으로 8→5 Task 축소 권고
- `docs/reviews/rbac-tech-review.md` — 기술 리뷰 (MUST FIX 2 + SHOULD FIX 2 + CONSIDER 2)
- `docs/reviews/rbac-scope-review.md` — 범위 리뷰 (MUST FIX 2 + SHOULD FIX 2 + CONSIDER 3)

### v2.1에서 반영한 리뷰 이슈

| 이슈 | 출처 | 반영 위치 |
|------|------|----------|
| MF1: system_admin academy_id null | tech | Task 2 getCurrentProfile 분기 |
| MF2: /past-exams 목록 보호 누락 | tech | Task 3 보호 대상 9개로 확장 |
| MF3: Wave 2/3 타입 에러 | scope | Task 4 role?: Role optional |
| MF4: /questions 보호 누락 | scope | Task 3 보호 대상에 추가 |
| SF1: canAccessRoute() 소비자 없음 | scope | Task 1에서 함수 제거 |
| SF2: users/page.tsx 인라인 조회 | tech | Task 3 구현 가이드에 명시 |
| SF3: academy/page.tsx 중복 처리 | tech | Task 3 구현 가이드에 명시 |
| SF4: AUTH_ERRORS 위치 | scope | Task 2 get-current-user.ts 내부 |
| C1: startsWith 순서 | tech | 코드 리뷰 체크리스트 |
| C2: role 타입 강화 | tech | Task 2 CurrentProfile.role → Role |
