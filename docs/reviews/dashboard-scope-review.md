# 역할별 대시보드 범위 리뷰 (scope-reviewer)

> 검토 대상: `docs/plan/dashboard-by-role.md`
> 작성일: 2026-03-25
> 역할: scope-reviewer

---

## 판정: READY (조건부)

SHOULD FIX 3건을 구현 중 처리하면 바로 구현 진행 가능.
MUST FIX 없음.

---

## 검토 결과

### 1. YAGNI — 4개 역할 대시보드 필요성

**판정: SHOULD FIX (system_admin)**

- **admin / teacher**: 실제 DB 데이터 기반 통계 — 필요 타당
- **student**: 빈 상태 + 바로가기 — 필요 타당 (학생 계정이 존재하고 대시보드 접근 가능)
- **system_admin**: 현재 실사용자가 없는 역할. RBAC 구현(세션 31)에서 system_admin 시드 계정이 존재하나, 앱 실사용 관점에서 소비자가 0명에 가깝다.

**권장**: system_admin 대시보드를 별도 컴포넌트로 분리하지 말고, page.tsx의 `default` 분기(또는 admin과 동일 컴포넌트)로 인라인 처리. 실사용자가 생길 때 분리.

> 단, system_admin 분기 자체는 필요 — `getDashboardStats`에서 역할 분기를 누락하면 admin 통계가 노출될 수 있음 (보안). 컴포넌트 분리 여부와 Server Action 분기는 별개 문제.

---

### 2. 과도 설계 — stat-card.tsx, recent-activity.tsx 공통 컴포넌트

**판정: SHOULD FIX**

PLAN D4(shadcn/ui Card 직접 사용)를 결정하고도 Task 2에서 `stat-card.tsx`, `recent-activity.tsx` 두 파일을 추가로 신규 생성한다. 이는 내부 모순이다.

**근거**:
- `stat-card.tsx`는 shadcn/ui `<Card>`에 제목 + 숫자 + 아이콘을 래핑하는 수준 (약 20~30줄)
- `recent-activity.tsx`는 리스트 + 빈 상태 처리 (약 30~40줄)
- 두 컴포넌트의 소비자는 이 대시보드뿐 (다른 페이지에서 재사용 계획 없음)
- 역할별 대시보드 컴포넌트(4개) 내부에 인라인으로 작성해도 각 파일이 80줄 이하로 유지 가능

**권장**: `stat-card.tsx`, `recent-activity.tsx` 파일 신규 생성 제거. 역할별 컴포넌트 내부에서 shadcn/ui `<Card>`를 직접 사용.
- 재사용이 필요해지는 시점에 추출 (YAGNI + 기존 코딩 스타일: 파일 분리는 명확한 재사용 필요성이 생겼을 때)
- 이로써 신규 파일 수 8개 → 6개로 감소

---

### 3. 파일 수 — 8개 신규 파일

**판정: CONSIDER**

공통 컴포넌트 2개를 제거하면 6개. 추가로 system_admin 대시보드를 인라인화하면 5개(컴포넌트 3개 + Action + 테스트 + page.tsx 수정).

현재 프로젝트의 다른 기능(성취기준: 10개+, RBAC: 23개)과 비교하면 5~6개는 충분히 적은 수준. 파일 수 자체가 문제는 아님.

---

### 4. system_admin 대시보드

**판정: SHOULD FIX**

앞서 언급한 내용 정리:

| 항목 | 판단 |
|------|------|
| `getDashboardStats`에서 system_admin 분기 | **필요** (보안 — admin RLS 우회 방지) |
| `system-admin-dashboard.tsx` 별도 컴포넌트 | **YAGNI** — 실사용자 없음 |

**권장**: Server Action에 system_admin 분기는 유지. UI는 page.tsx에서 `default` 케이스로 admin 대시보드 재사용 또는 4개 통계를 인라인 렌더링. 별도 컴포넌트 파일 생성 불필요.

---

### 5. student 대시보드

**판정: CONSIDER**

`student-dashboard.tsx`를 별도 파일로 분리하는 것은 일관성 차원에서 수용 가능. 단:

- 내용이 단순 (빈 상태 안내 + 바로가기 2개 링크)하므로 page.tsx 인라인 처리도 충분
- `<StudentDashboard />` 컴포넌트로 분리하면 테스트 작성이 쉬워지는 장점 있음

구현팀 재량으로 결정 가능. MUST/SHOULD 이슈 아님.

---

### 6. Task 분해 — 5 Task

**판정: CONSIDER**

| Task | 평가 |
|------|------|
| Task 1 (Server Action + 테스트) | 적절 |
| Task 2 (공통 UI 컴포넌트) | SHOULD FIX 수용 시 제거됨 |
| Task 3 (역할별 컴포넌트 4개) | system_admin 인라인화 수용 시 컴포넌트 3개 |
| Task 4 (page.tsx 교체) | 적절 |
| Task 5 (전체 검증) | 적절 |

SHOULD FIX 반영 시 Task 2 제거 → 4 Task로 축소. Task 3는 system_admin 제외 3개 컴포넌트로 축소.

**합칠 수 있는 것**: Task 3 + Task 4는 frontend-ui 소유이므로 함께 진행 가능. 단, Task 1(backend) 완료 후 진행해야 하는 의존성은 유지.

---

## 이슈 요약

| 등급 | 이슈 | 권장 조치 |
|------|------|----------|
| **SHOULD FIX** | stat-card.tsx, recent-activity.tsx 공통 컴포넌트 신규 생성 — D4 결정과 내부 모순 | 파일 제거, 역할별 컴포넌트 내 인라인 처리 |
| **SHOULD FIX** | system-admin-dashboard.tsx 별도 컴포넌트 분리 — 실사용자 0명 수준 | page.tsx default 케이스 인라인화, Server Action 분기는 유지 |
| **CONSIDER** | student-dashboard.tsx 분리 필요성 | 구현팀 재량 (단순 컴포넌트이므로 어느 쪽도 무방) |
| **CONSIDER** | Task 3 + Task 4 통합 가능성 | 의존성(Task 1 선행) 유지하되 병렬 실행 범위 명확화 |

---

## Plan Review Completion Checklist 판정

| 항목 | 상태 |
|------|------|
| 모든 Task의 파일 소유권 명확 | ✅ (backend-actions / frontend-ui) |
| Task 간 의존성 순서 정의 | ✅ (Task 1 완료 후 Task 2~4) |
| 외부 의존성 명시 | ✅ (shadcn/ui Card — 기존 설치됨) |
| 에러 처리 방식 정의 | ✅ (getCurrentUser() 활용, `{ error }` 반환 패턴) |
| 테스트 전략 존재 | ✅ (역할별 4케이스 + 인증 실패 1케이스) |
| 이전 Phase 회고 교훈 반영 | ✅ (YAGNI 명시, getCurrentUser() 활용, RLS D5/D6) |
| 병렬 구현 파일 충돌 없음 | ✅ (backend/frontend 파일 소유권 분리) |

**최종 판정: READY**

SHOULD FIX 2건은 파일 수를 줄이는 방향이므로 구현 복잡도를 낮춤. 구현 시작 전 PLAN 작성자가 반영 여부를 결정하면 충분. 차단 이슈 없음.
