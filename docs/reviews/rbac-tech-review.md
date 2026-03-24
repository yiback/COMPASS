# 2-1 RBAC PLAN v2 — 기술 리뷰

> 작성일: 2026-03-24
> 작성자: technical-reviewer 에이전트
> 대상: `docs/plan/rbac-system.md` (v2)

---

## 검토 요약

PLAN v2는 전반적으로 기술적으로 건전하다. 방식 C(page.tsx 개별 체크) 채택 결정은 기존 코드베이스 패턴과 일치하며, React 19 `cache()` 최적화 방향도 정확하다. 다만 아래 3가지 이슈가 구현 전 반드시 해결되어야 한다.

---

## 이슈 목록

### [MUST FIX] system_admin academy_id null → getCurrentProfile() null 반환 → redirect('/login') 버그

**위치**: PLAN Task 2 `get-current-user.ts` 설계 코드 (201번 라인)

**문제**:
```typescript
if (!profile || !profile.academy_id) return null
```

DB 스키마(`00001_initial_schema.sql` 63번 라인)에서 `system_admin`은 `academy_id = NULL`이 허용된다:
```sql
CONSTRAINT profiles_academy_required
  CHECK (role = 'system_admin' OR academy_id IS NOT NULL)
```

현재 PLAN 설계대로면 `system_admin` 계정으로 로그인해도 `getCurrentProfile()`이 `null`을 반환하고, `requireRole()`에서 `redirect('/login')`이 발생한다. `system_admin`은 D7 결정에서 "모든 권한 암묵 허용"으로 설계했음에도 실제로는 로그인조차 불가능해지는 심각한 버그다.

**수정 방향**:
```typescript
// academy_id null 체크는 system_admin을 제외해야 함
if (!profile) return null
if (profile.role !== 'system_admin' && !profile.academy_id) return null

return {
  id: profile.id,
  role: profile.role,
  academyId: profile.academy_id ?? '', // system_admin은 빈 문자열 또는 null 허용
  ...
}
```

또는 `CurrentProfile` 인터페이스에서 `academyId: string | null`로 타입 변경 필요. 이 경우 `academyId`를 사용하는 모든 page.tsx에서 null 처리가 추가로 필요하다.
<!-- NOTE: 적용 -->
---

### [MUST FIX] DashboardSidebar와 MobileNav가 Client Component — role prop 전달 방식 불일치

**위치**: PLAN Task 3 Layout 수정 설계, Task 4 사이드바 필터링

**문제**:
`dashboard-sidebar.tsx`와 `mobile-nav.tsx`는 모두 `'use client'` 선언된 Client Component다. `layout.tsx`(Server Component)에서 `role` prop을 직접 전달하는 것은 가능하지만, `MobileNav`는 현재 `DashboardHeader` 내부에 포함된 것인지 별도 컴포넌트인지 PLAN에서 불명확하다.

실제 `layout.tsx`를 보면:
```tsx
<DashboardSidebar />   // role prop 없음
<DashboardHeader ... /> // MobileNav가 헤더 안에 있는지 확인 필요
```

`MobileNav`가 `DashboardHeader` 내부에 위치한다면, `layout.tsx → DashboardHeader → MobileNav`로 role을 drilling해야 한다. PLAN의 Task 3 Layout 수정 설계에서 `DashboardHeader`에 `role` 전달이 명시되어 있지 않고, Task 4 수정 파일 목록에 `DashboardHeader`가 포함되어 있지 않다.

**확인 필요**: `DashboardHeader` 내부 구조를 보고 `MobileNav` 위치를 파악한 후, layout.tsx → DashboardHeader → MobileNav props drilling 경로를 Task 3/4에 명시해야 한다.
<!-- NOTE: 적용 -->
---

### [MUST FIX] `/past-exams` 목록 페이지가 보호 대상 7개에서 누락

**위치**: PLAN Task 3 "보호 대상 page.tsx (7개)" 표

**문제**:
권한 매트릭스(3.1)에서 `/past-exams`는 student `❌`로 명확히 접근 불가다. 그러나 Task 3의 보호 대상 7개 목록에 `/past-exams` 목록 페이지(`past-exams/page.tsx`)가 누락되어 있다.

현재 `upload/page.tsx`의 인라인 역할 체크를 보면 역할 불일치 시 `redirect('/past-exams')`로 보내는데, `/past-exams` 자체가 보호되지 않으면 student가 목록은 볼 수 있게 된다.

**수정 방향**: 보호 대상 목록에 `/past-exams` 항목 추가:
```
| `/past-exams` | admin, teacher | `past-exams/page.tsx` | 역할 체크 없음 |
```

또한 기존 `upload/page.tsx`의 역할 불일치 redirect 경로도 `/past-exams` 대신 `/unauthorized`로 변경이 필요하다(Task 3 구현 시 주의).
<!-- NOTE: 적용 -->
---

### [SHOULD FIX] `admin/academy/page.tsx` 기존 role 조회와 requireRole() 중복 처리

**위치**: PLAN Task 3, `admin/academy/page.tsx` 현재 구현

**문제**:
현재 `admin/academy/page.tsx`는 `getMyAcademy()` Action에서 반환된 `role`을 사용해 `canEdit` 여부를 결정한다:
```typescript
const { role, ...academyData } = result.data
const canEdit = role === 'admin' || role === 'system_admin'
```

`requireRole(['admin'])` 추가 후에도 `getMyAcademy()`가 여전히 `role`을 반환한다면 중복 조회가 발생한다. 단, `cache()`가 적용되면 DB 조회는 1회이므로 기능 문제는 없다. 그러나 `requireRole()`의 반환 profile과 Action의 role이 다른 타입에서 올 경우 혼란을 야기한다.

**권장 처리**: Task 3 구현 시 `admin/academy/page.tsx`에서 `requireRole(['admin'])` 반환 profile의 `role`을 `canEdit` 판단에 재사용하고, `getMyAcademy()`의 role 반환을 제거하거나 무시하도록 리팩토링 가이드를 Task 3에 명시한다.
<!-- NOTE: 적용 -->
---

### [SHOULD FIX] `admin/users/page.tsx`의 `callerRole` 중복 조회 명시적 처리 필요

**위치**: PLAN Task 3, `admin/users/page.tsx` 현재 구현

**문제**:
현재 `admin/users/page.tsx`는 `callerRole`과 `callerId`를 직접 Supabase에서 조회한다(24-44번 라인). Task 3에서 `requireRole(['admin', 'teacher'])` 추가 후 중복 조회가 발생한다.

PLAN 본문에는 "layout + page 간 cache()로 1회 조회"라고 명시되어 있으나, `admin/users/page.tsx` 내의 `supabase.auth.getUser()` + `profiles.select('id, role')` 직접 조회 코드가 `requireRole()` 내부의 `getCurrentProfile()`과 별도로 존재한다.

`cache()`가 동일 함수 참조를 기준으로 캐싱하므로, `users/page.tsx`의 인라인 조회는 캐싱 대상이 아니다. 즉 `requireRole()` 호출 + 인라인 조회 = 실질 2회 DB 접근이 발생한다.

**권장 처리**: Task 3 구현 가이드에 "기존 인라인 역할 조회 코드를 `requireRole()` 반환 profile로 교체" 명시 필요. `callerRole = profile.role`, `callerId = profile.id`로 교체한다.
<!-- NOTE: 적용 -->
---

### [CONSIDER] `canAccessRoute()`의 `startsWith` 매칭 순서 취약성

**위치**: PLAN Task 1 `route-permissions.ts` 설계

**관찰**:
PLAN에서 "구체적 경로 먼저 정의" 주의사항을 명시했지만, `find()` 기반 `startsWith` 매칭은 배열 순서에 의존한다. 현재 PLAN의 `ROUTE_PERMISSIONS` 배열 순서를 보면:
```typescript
{ pattern: '/admin/academy', roles: ['admin'] },
{ pattern: '/admin/users', roles: ['admin', 'teacher'] },
{ pattern: '/admin/schools', roles: ['admin', 'teacher'] },
```

`/admin/academy`가 `/admin` 앞에 정의되어 있어 현재는 문제없다. 그러나 향후 `/admin` 경로 자체를 추가하면 순서 오류가 생길 수 있다. 현재 MVP 범위에서는 허용 가능하며, 코드 리뷰 체크리스트에 "ROUTE_PERMISSIONS 순서는 구체적 → 일반적 순으로 유지" 항목 추가로 충분하다.
<!-- NOTE: 적용 -->
---

### [CONSIDER] `requireRole()` 내 `profile.role` 타입 캐스팅 안전성

**위치**: PLAN Task 2 `require-role.ts` 설계

**관찰**:
```typescript
if (profile.role !== 'system_admin' && !allowedRoles.includes(profile.role as Role)) {
```

`CurrentProfile.role`이 `string` 타입으로 정의되어 있어 `as Role` 캐스팅이 필요하다. DB에서 올 수 있는 role 값은 CHECK 제약조건으로 보장되지만, TypeScript 레벨에서는 타입 안전성이 없다.

**권장 처리**: `CurrentProfile.role`을 `string` 대신 `Role` 타입으로 선언하거나, 함수 내부에서 `ROLES.includes(profile.role as Role)` 앞에 가드를 추가하면 더 안전하다. 구현 시 고려하면 되며 블로커는 아니다.
<!-- NOTE: 적용 -->
---

## 리서치-PLAN 일치성 확인

| 항목 | tech-research 내용 | PLAN v2 반영 | 일치 여부 |
|------|-------------------|-------------|----------|
| 방식 C 채택 | 추천 | D2 결정, Task 2/3 구현 | ✅ 일치 |
| React 19 `cache()` | 레이아웃+페이지 1회 조회 | D8 결정, Task 2 설계 | ✅ 일치 |
| 미들웨어 변경 없음 | 성능 부담 이유로 유지 | 핵심 원칙에 명시 | ✅ 일치 |
| 코드 기반 상수 | DB 권한 테이블 YAGNI | D1 결정 | ✅ 일치 |
| 보일러플레이트 리스크 | 코드 리뷰 체크리스트로 방지 | Task 6 리스크 항목에 포함 | ✅ 일치 |
| 작업량 S | feasibility 평가 | "S~M (2-3일)" | ✅ 실질적 일치 |
| parent 역할 제거 | 언급 없음 (devil-advocate 권고) | D5 결정, 단계 4 이동 | ✅ YAGNI 반영 |

DB 스키마 충돌 확인:
- profiles.role CHECK 제약: `('student', 'teacher', 'admin', 'system_admin')` ↔ PLAN의 `ROLES` 상수 일치 ✅
- RLS `has_any_role()` 함수의 role 문자열 ↔ PLAN 역할 상수 일치 ✅
- parent 역할: DB CHECK에 없음, PLAN에서도 제거 → 충돌 없음 ✅

---

## 결론

**판정: BLOCKED (2개 MUST FIX 해소 후 구현 가능)**

PLAN v2는 구조적으로 올바르고 feasibility/tech 리서치와의 정합성도 높다. 단, 아래 2개 이슈는 구현 시작 전 PLAN 또는 구현 가이드에 반드시 반영되어야 한다:

1. **system_admin academy_id null 처리** — getCurrentProfile() 로직 수정 필요 (기능 버그)
2. **`/past-exams` 목록 페이지 보호 누락** — 보호 대상 7개 → 8개로 확장 필요 (보안 갭)

SHOULD FIX 2개(academy/page.tsx 중복 처리, users/page.tsx 인라인 조회 교체)는 구현 중 처리 가능하며, 구현 에이전트 프롬프트에 "기존 인라인 role 조회 코드를 requireRole() 반환 profile로 교체"를 명시하면 충분하다.

CONSIDER 2개는 현재 MVP 범위에서 선택적 개선 사항이다.
