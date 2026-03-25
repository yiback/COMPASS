# 단계 2-3 대시보드 상세 계획 — Scope Review

> 역할: scope-reviewer
> 검토 대상: `docs/plan/dashboard-tasks-detail.md`
> 참조: `docs/plan/dashboard-by-role.md` v2, `CLAUDE.md`
> 작성일: 2026-03-25

---

## 검토 요약

Task 수: 3개
전체 판정: **READY** (MUST FIX 0건)

---

## 1. 각 Task가 단일 워커로 처리 가능한 크기인가

### Task 1: Server Action + 테스트

- 파일 2개 (dashboard.ts + dashboard.test.ts)
- 쿼리 총 16개 (admin 6 + teacher 5 + system_admin 4 + student 0), 모두 Promise.all 병렬
- 테스트 케이스 10개 — 역할별 + 엣지 케이스 망라
- 예상 코드량: dashboard.ts 약 100~130줄, test 파일 약 150~200줄
- **판정: 적절함.** 단일 워커가 반나절 내에 처리 가능한 크기

### Task 2: 컴포넌트 + page.tsx 교체

- 파일 3개 (admin-dashboard.tsx, teacher-dashboard.tsx, page.tsx)
- admin-dashboard.tsx: 카드 4개 + 최근 활동 목록 (약 80~100줄 예상)
- teacher-dashboard.tsx: 카드 4개 + 최근 활동 목록 (admin과 동일 패턴, 약 80~100줄)
- page.tsx: getDashboardStats 호출 + 역할 분기 + student/system_admin 인라인
- **판정: 적절함.** 3개 파일 모두 `src/app/`, `src/components/` — 동일 소유 역할(frontend-ui) 내에 있어 파일 충돌 없음

### Task 3: 검증 + 정리

- 내용: vitest 전체 실행, tsc --noEmit, E2E 수동 확인, HANDOFF/ROADMAP 업데이트
- 코드 작성 없음 — 검증 전용
- **판정: 적절함.** 별도 Task로 분리한 것이 올바름 (빌드·테스트 확인 = 구현과 다른 관심사)

---

## 2. Task별 파일 소유권 명확성

| Task | 파일 | 역할 | 충돌 가능성 |
|------|------|------|-----------|
| 1 | `src/lib/actions/dashboard.ts` | backend-actions | 없음 |
| 1 | `src/lib/actions/__tests__/dashboard.test.ts` | tester (또는 backend-actions) | 없음 |
| 2 | `src/components/dashboard/admin-dashboard.tsx` | frontend-ui | 없음 |
| 2 | `src/components/dashboard/teacher-dashboard.tsx` | frontend-ui | 없음 |
| 2 | `src/app/(dashboard)/page.tsx` | frontend-ui | 없음 |

마스터 PLAN 섹션 7에 명시된 파일 소유권(`backend-actions` vs `frontend-ui`)과 상세 계획이 일치함.

---

## 3. CLAUDE.md 역할 경계와의 일치성

**backend-actions** 규칙:
- 소유: `src/lib/actions/`, `src/lib/validations/` ✅
- 편집 금지: `src/app/`, `src/components/` — Task 1은 이 영역 미수정 ✅

**frontend-ui** 규칙:
- 소유: `src/app/`, `src/components/` ✅
- 편집 금지: `src/lib/actions/`, `src/lib/ai/` — Task 2는 이 영역 미수정 ✅
- 읽기 전용: `src/lib/actions/` (API 인터페이스 참조) — page.tsx에서 `getDashboardStats` 임포트는 읽기 해당 ✅

**tester** 규칙:
- PLAN에서 테스트 파일이 `__tests__/dashboard.test.ts`로 Task 1에 통합되어 있음
- 이는 backend-actions 워커가 Action과 테스트를 함께 작성하는 구조
- 이전 Phase에서도 동일하게 사용한 패턴 — 일관성 있음 ✅

결론: **CLAUDE.md 역할 경계와 완전히 일치함**

---

## 4. Task 2 — UI 컴포넌트 + page.tsx 함께 포함 여부 분리 필요한가

**현재 구조**: Task 2가 admin-dashboard.tsx + teacher-dashboard.tsx + page.tsx 3개를 함께 처리

**분리하지 않아도 되는 이유**:

1. **동일 소유 역할**: 3개 파일 모두 frontend-ui 담당 → 파일 충돌 없음
2. **강한 의존성**: page.tsx는 admin-dashboard.tsx, teacher-dashboard.tsx를 임포트 → 같은 Task에서 완성해야 타입 에러 없이 빌드 가능
3. **크기**: 3개 파일 합산 약 300~350줄 예상 — 800줄 제한 이내
4. **직렬 의존성**: 마스터 PLAN "Task 1 완료 후 Task 2 진행" 명시 — Task 2 내에서 컴포넌트→page 순서로 진행 가능

**분리할 경우 오히려 발생하는 문제**:
- page.tsx만 별도 Task로 분리하면 admin-dashboard.tsx가 미완성인 상태에서 임포트 → 타입 에러 → 빌드 실패 위험
- 병렬화 이점 없음 (어차피 순차 실행)

**판정**: **분리 불필요.** 현재 구조 유지가 올바름

---

## 5. 3 Task가 너무 적은가, 충분한가

**비교 기준**: 이 프로젝트의 이전 Phase Task 분해

| Phase | Task 수 | 파일 수 | 복잡도 |
|-------|--------|--------|--------|
| 2-1 RBAC | 5 Task | 23 파일 | 높음 (인증/인가 로직 + 다수 page.tsx) |
| 2-2 성취기준 | 4 Task | 15+ 파일 | 중간 (CRUD + 캐스케이딩 필터) |
| **2-3 대시보드** | **3 Task** | **5 파일** | **낮음 (읽기 전용 쿼리 + UI)** |

**판정: 충분함.** 이유:
- 신규 파일 4개 + 수정 파일 1개로 범위가 작음
- 데이터베이스 마이그레이션 없음 (기존 테이블 조회만)
- CREATE/UPDATE/DELETE 없음 — 읽기 전용 쿼리 + 표시
- 학생 대시보드와 system_admin 대시보드는 인라인 처리 (별도 파일 없음)
- MEMORY.md 기록: "S 크기 작업 = 1일" → 3 Task 분해가 적절한 granularity

---

## MUST FIX (0건)

없음.

---

## SHOULD FIX (0건)

없음.

---

## CONSIDER (2건)

### C1: teacher 대시보드 `extractionPending` — processing 상태 포함 여부

**현재**: `extractionPending` = `extraction_status = 'pending'` 쿼리만
**관찰**: 실제 "진행 중" 상태(`processing`)가 pending과 다름 — UI 카드명이 "추출 대기"인데 processing 중인 기출은 카운트 안 됨
**영향**: 교사 입장에서 "내가 올린 기출 중 현재 처리 중인 것" 개수가 과소 표시될 수 있음
**제안**: 카드 레이블을 "추출 대기/진행 중"으로 변경하거나, `in(['pending', 'processing'])` 쿼리로 확장
**판단**: 비즈니스 요구사항에 따라 결정. UI 레이블과 쿼리 조건이 일치하면 어느 방향이든 무방

### C2: system_admin 대시보드 — page.tsx 인라인 미완성 코드 확인

상세 계획 page.tsx 코드 스니펫에 system_admin 섹션이 주석으로만 표시됨:
```tsx
{/* 4개 카드: academyCount, totalUsers, totalPastExams, activeStandardsCount */}
```
실제 구현 시 admin-dashboard 패턴을 그대로 적용하면 되므로 작성자가 의도적으로 압축한 것으로 보임. 워커가 AdminDashboard 패턴 참조하여 인라인으로 구현하면 충분.

---

## Plan Review Completion Checklist

| 항목 | 충족 여부 | 근거 |
|------|---------|------|
| 모든 Task의 파일 소유권이 명확하다 | ✅ | 마스터 PLAN 섹션 7 + 상세 계획 소유 파일 명시 |
| Task 간 의존성 순서가 정의되었다 | ✅ | "Task 1 완료 후 Task 2 진행" 명시 |
| 외부 의존성(라이브러리, API)이 명시되었다 | ✅ | shadcn/ui Card (기존 사용), createAdminClient (기존) |
| 에러 처리 방식이 정해졌다 | ✅ | try/catch + 개별 count 폴백(count ?? 0) + { error } 반환 |
| 테스트 전략이 있다 | ✅ | 10개 케이스 + mock 패턴 상세 명시 |
| 이전 Phase 회고 교훈이 반영되었다 | ✅ | createAdminClient(RLS 우회), created_by(컬럼명 정확성) |
| 병렬 구현 시 파일 충돌 가능성이 없다 | ✅ | Task 1(backend-actions)과 Task 2(frontend-ui) 파일 분리 |

**판정: READY**

모든 Completion Checklist 항목 충족. MUST FIX 0건. 즉시 구현 단계로 이동 가능.
