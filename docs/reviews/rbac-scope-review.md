# 2-1 RBAC PLAN v2 — 범위 리뷰

> 작성일: 2026-03-24
> 작성자: scope-reviewer 에이전트
> 검토 대상: `docs/plan/rbac-system.md` (PLAN v2)

---

## 검토 요약

PLAN v2는 v1 대비 8→5 Task 축소, 변경 파일 ~30→~17개로 상당히 범위를 줄였다. 전체적으로 YAGNI 원칙이 잘 적용되었으며 방식 C(page.tsx 개별 체크) 채택은 적절한 결정이다.

단, 아래에서 서술할 몇 가지 이슈가 있다. MUST FIX 1건, SHOULD FIX 2건, CONSIDER 3건.

---

## 이슈 목록

### [MUST FIX] Task 4 사이드바 — `role` props drilling 시 DashboardSidebar/MobileNav가 `'use client'` Client Component임을 간과

**위치**: Task 3(Layout 수정) + Task 4(사이드바 필터링)

**현재 상태**:
- `dashboard-sidebar.tsx`와 `mobile-nav.tsx`는 모두 `'use client'` Client Component
- 두 컴포넌트는 현재 `MENU_ITEMS`를 직접 import하고 props 없이 동작
- Layout(Server Component)에서 `<DashboardSidebar role={profile.role} />`로 role을 넘기는 것 자체는 가능 (Server → Client props 전달은 지원됨)

**이슈**:
PLAN에서 `DashboardSidebar`에 `role` prop을 추가하는 것은 기술적으로 동작하나, 현재 `DashboardSidebar`의 props 인터페이스가 `{ className?: string }` 뿐이다. Task 3과 Task 4를 별도 Wave(Wave 2 병렬 / Wave 3)로 나눴을 때 다음 충돌이 발생한다:

- **Wave 2**: frontend-ui 에이전트가 `menu.ts`와 `dashboard-sidebar.tsx`를 수정하여 `role` 필터링 추가
- **Wave 3**: 리드가 `layout.tsx`를 수정하여 `<DashboardSidebar role={profile.role} />` 전달

그런데 Wave 구성을 보면 Task 4(사이드바)가 Wave 2이고 Task 3(layout + page.tsx)이 Wave 3이다. **즉 layout.tsx는 Wave 3에 수정되는데, 사이드바가 이미 Wave 2에서 `role` prop을 받는 인터페이스로 수정되어 있다. Wave 3 완료 전까지 layout.tsx는 role 없이 사이드바를 호출하므로, Wave 2~3 사이에 TypeScript 타입 에러가 발생한다.**

**수정 방향**: Task 4의 `role` prop은 optional (`role?: Role`)로 선언하거나, Wave 3이 완료될 때까지 layout.tsx의 사이드바 호출도 함께 처리하도록 Task 3과 Task 4를 동일 Wave에 배치한다. 가장 단순한 방법은 `role?: Role` (optional, undefined 시 전체 메뉴 표시)로 선언하는 것.
<!-- NOTE: 적용 -->
---

### [MUST FIX] `/questions` 페이지가 보호 대상 7개 목록에서 누락

**위치**: PLAN 섹션 4 Task 3 "보호 대상 page.tsx (7개)" 표

**현재 상태**:
- 권한 매트릭스(섹션 3.1)에서 `/questions`는 `admin`, `teacher`, `student` 3개 역할 허용으로 명시됨
- 보호 대상 page.tsx 7개 표에서 `/questions`는 누락됨
- 현재 `questions/page.tsx`를 확인하면 역할 체크 없음 (student가 접근하면 됨이지만, 인증이 안 된 사용자가 접근하는 경우의 처리가 없음)

**이슈**:
PLAN 섹션 3.1 권한 매트릭스에서 `/questions`는 student도 읽기 허용이므로, `requireRole(['admin', 'teacher', 'student'])`를 호출해야 한다. 이렇게 하면 사실상 "로그인한 모든 역할"에 해당하므로, `requireRole` 없이 `getCurrentProfile()` + null 체크만 해도 동일하다. 그러나 Task 3 목록에서 누락된 것은 구현자가 `/questions`를 체크 없이 두게 만들 수 있다.

**수정 방향**: 보호 대상 목록에 `/questions`를 추가하고, `requireRole(['admin', 'teacher', 'student'])` 호출을 명시한다. 또는 주석으로 "인증된 모든 사용자 허용 → `getCurrentProfile()` null 체크만"을 명확히 기재한다.
<!-- NOTE: 적용 -->
---

### [SHOULD FIX] `ROUTE_PERMISSIONS` 배열과 `requireRole()` 이중 관리로 불일치 위험

**위치**: Task 1 `route-permissions.ts` + Task 3 `page.tsx` 수정

**이슈**:
PLAN에 두 가지 권한 체크 메커니즘이 공존한다:
1. `route-permissions.ts`의 `ROUTE_PERMISSIONS` 배열 + `canAccessRoute()` 함수
2. 각 `page.tsx`의 `requireRole(['admin', 'teacher'])` 직접 호출

이 두 곳은 같은 정보(경로별 허용 역할)를 이중으로 관리한다. 예를 들어 `/past-exams`를 admin 전용으로 바꾸려면 `ROUTE_PERMISSIONS`와 `past-exams/upload/page.tsx`, `past-exams/[id]/edit/page.tsx` 모두 수정해야 한다.

PLAN 자체에서도 이 점을 인지하고 있으나(`requireRole(['admin', 'teacher'])` — 1줄로 역할 체크 완료), `ROUTE_PERMISSIONS`의 존재 목적이 모호해진다.

**현실적 평가**: 이번 스코프에서 `canAccessRoute()`를 사용하는 곳은 사이드바 필터(Task 4)뿐이다. 그런데 사이드바는 이미 `MenuItem.roles` 배열로 필터링하므로, `canAccessRoute()`를 사이드바에서도 사용하지 않는다. 결국 Task 5 테스트 외에 `canAccessRoute()`의 실질 소비자가 없다.

**수정 방향**: `canAccessRoute()`를 Task 1에서 제거하고 테스트도 단순화하거나, `page.tsx`에서 `ROUTE_PERMISSIONS`를 참조하도록 통합한다. 후자는 구현 복잡도를 높이므로, YAGNI 관점에서 전자(제거)가 적절하다. `ROUTE_PERMISSIONS`는 나중에 미들웨어 기반 가드가 필요할 때 추가하면 된다.
<!-- NOTE: 적용 -->
---

### [SHOULD FIX] `AUTH_ERRORS` 상수의 소유 파일이 명시되지 않음

**위치**: PLAN 섹션 7 "에러 처리 전략"

**이슈**:
`AUTH_ERRORS` 상수가 섹션 7에 정의되어 있지만, 어떤 파일에 위치하고 어떤 Task에서 생성하는지 명시되지 않았다. Task 1/2 생성 파일 목록에도 없다. 구현 에이전트가 혼선을 겪을 수 있다.

**수정 방향**: `AUTH_ERRORS`를 `src/lib/auth/errors.ts`로 파일을 명시하고 Task 2 생성 파일 목록에 추가한다. 또는 `require-role.ts` 내부 상수로 사용할 경우 그렇게 명시한다.
<!-- NOTE: 적용 -->
---

### [CONSIDER] `canAccessRoute()` 사용처 없음 → 테스트 비용 대비 가치 낮음

**위치**: Task 1 `route-permissions.ts` + Task 5 `route-permissions.test.ts`

**분석**:
- Task 4 사이드바는 `MenuItem.roles` 배열로 직접 필터링 → `canAccessRoute()` 미사용
- Task 3 `page.tsx`는 `requireRole()` 직접 호출 → `canAccessRoute()` 미사용
- Task 5에서 `canAccessRoute()` 테스트 5건 예정

`canAccessRoute()` 함수가 삭제되면 테스트도 불필요해지므로, [SHOULD FIX]의 canAccessRoute 제거가 채택되면 Task 5 범위도 동시에 줄어든다.
<!-- NOTE: 적용 -->
---

### [CONSIDER] 2-3 대시보드에서 props drilling 재작업 가능성 평가

**위치**: PLAN 섹션 2 설계 결정 D3

**분석**:
D3 결정: "소비자 2개(사이드바, 모바일네비)뿐 → Context 과잉 → props drilling"

2-3 역할별 대시보드에서 role에 따라 다른 위젯을 렌더링해야 한다. 이때:
- `page.tsx`에서 `requireRole()` 호출 → `profile.role` 이미 사용 가능 → 직접 위젯에 전달 가능
- DashboardSidebar/MobileNav(레이아웃 수준)와 각 page.tsx(페이지 수준)는 독립적

따라서 2-3 대시보드에서 RoleProvider가 필요한 상황은 발생하지 않는다. D3 결정은 타당하다. 다만, 헤더에서도 role에 따라 다른 UI가 필요해질 경우(예: 학원장 뱃지, 학생 포인트 표시) 소비자 수가 3개 이상으로 늘어날 수 있으며 그때 Context를 도입하면 된다. PLAN 섹션 11에 "소비자 3개 이상 시" 조건이 명시되어 있어 적절히 관리되고 있다.

**결론**: 이 결정은 현재 스코프에서 문제가 없으며 추후 전환 조건도 명확하다. 추가 조치 불필요.

---

### [CONSIDER] `academy/page.tsx`가 이미 `getMyAcademy()`를 통해 역할을 가져오는데, `requireRole()` 추가 시 DB 이중 조회

**위치**: Task 3 보호 대상 목록 + 기존 `admin/academy/page.tsx`

**현재 상태**:
`admin/academy/page.tsx`는 `getMyAcademy()` 액션을 통해 `role`을 이미 가져온다 (`const { role, ...academyData } = result.data`). React 19 `cache()`가 적용되면 `requireRole()` 내부의 `getCurrentProfile()` 호출이 캐시에서 반환되므로 실질 이중 조회는 없다.

다만 `getMyAcademy()` 내부에서도 별도로 DB를 조회한다면, `cache()` 효과가 미치지 않는 두 번째 조회가 발생할 수 있다. Task 2에서 `getCurrentProfile`에만 `cache()`가 적용되므로, `getMyAcademy()`가 내부적으로 별도 `getUser()`+`profiles` 조회를 사용하면 실제로는 2회 조회가 된다.

**평가**: 성능 임계치를 넘는 수준은 아니며 정확성에는 영향 없다. cache()의 적용 범위가 PLAN에서 명확히 설명되었으므로 구현자가 확인하면 된다. 이번 스코프에서 액션 리팩토링은 제외되었기 때문에, 이 최적화는 "독립 리팩토링 이슈(서버 액션 리팩토링)"와 함께 처리하는 것이 더 자연스럽다. 지금 수정할 필요 없음.

---

## Phase 1 회고 교훈 반영 확인

| 교훈 | PLAN v2 반영 여부 | 판정 |
|------|-----------------|------|
| **PLAN 리뷰 3회 제한** | v1→v2 = 2회 리뷰 완료. 본 리뷰가 마지막(3회차) | ✅ 준수 |
| **YAGNI 준수** | parent, RoleProvider, permissions.ts, Action 리팩토링 제거. 8→5 Task 축소 | ✅ 준수 |
| **PLAN 과도 반복 방지** | v2에서 구현 시작 예정 | ✅ 준수 |
| **Academy_id 필터 체크리스트** | requireRole이 profile.academyId 강제 반환 → page.tsx에서 academyId 사용 | ✅ 반영 |
| **Step 단위 빌드 체크** | Wave 완료마다 빌드 + 테스트 명시 | ✅ 반영 |
| **에이전트 프롬프트에 "기존 패턴 확인"** | Task 3에서 기존 page.tsx 인라인 패턴 참조 명시 | ✅ 반영 |
| **Defense in Depth** | page.tsx + 사이드바 + Action + RLS 4중 방어로 확장 | ✅ 반영 |

---

## 결론

PLAN v2는 전반적으로 잘 작성되었으며 YAGNI가 적절히 적용되었다.

**MUST FIX 2건 처리 후 구현 가능하다.**

| 우선순위 | 이슈 | 처리 방법 |
|---------|------|----------|
| MUST FIX | Task 4 `role` prop이 Wave 2/3 사이 타입 에러 유발 | `role?: Role` optional로 선언 |
| MUST FIX | `/questions` 페이지가 Task 3 보호 대상 목록에서 누락 | 목록에 추가 및 처리 방식 명시 |
| SHOULD FIX | `canAccessRoute()` 실질 소비자 없음 → 제거 권장 | `route-permissions.ts`에서 `canAccessRoute()` 제거 |
| SHOULD FIX | `AUTH_ERRORS` 상수 파일 위치 미명시 | Task 2 생성 파일 목록에 추가 또는 인라인 명시 |

**Plan Review Completion Checklist 판정: BLOCKED**

- [x] 모든 Task의 파일 소유권이 명확하다
- [x] Task 간 의존성 순서가 정의되었다
- [x] 외부 의존성(라이브러리, API)이 명시되었다
- [x] 에러 처리 방식이 정해졌다
- [x] 테스트 전략이 있다
- [x] 이전 Phase 회고(`docs/retrospective/`)의 교훈이 반영되었다
- [ ] 병렬 구현 시 파일 충돌 가능성이 없다 ← **Wave 2/3 간 타입 오류 (MUST FIX)**

MUST FIX 2건을 PLAN v2에 반영하면 즉시 구현 가능하다. SHOULD FIX는 구현 중 처리 가능.
