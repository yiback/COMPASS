# auth-helper-tasks-detail.md — Scope Review

> 검토자: scope-reviewer
> 검토 대상: `docs/plan/auth-helper-tasks-detail.md` (11개 Task)
> 검토 일시: 2026-03-25

---

## 검토 요약

| 항목 | 판정 |
|------|------|
| Task 크기 적절성 | 대체로 적절, 일부 경계 사례 있음 |
| 파일 소유권 충돌 | 없음 (모든 Task가 독립 파일 세트 소유) |
| 역할 경계 일치 | 부분 불일치 — Task 1에서 backend-actions와 tester 역할 혼재 |
| Task 7 묶음 적절성 | 적절 (묶음 유지 권장) |
| Task 11 필요성 | 필요하지만 내용 범위 조정 권장 |
| 병렬화 가능 여부 | Task 2~10은 병렬 처리 가능, Task 1이 선행 조건 |

---

## 이슈 목록

---

### MUST FIX

없음.

---

### SHOULD FIX

#### S-1: Task 1에서 backend-actions 역할과 tester 역할 혼재

**현황**: Task 1이 `helpers.ts` 구현(backend-actions 역할)과 `helpers.test.ts` 단위 테스트(tester 역할)를 동일 Task에 포함.

**문제**:
- CLAUDE.md의 Implementation Phase 역할 경계상 `src/lib/actions/helpers.ts`는 backend-actions 소유, `src/lib/actions/__tests__/helpers.test.ts`는 tester 소유.
- 단일 워커가 두 역할 책임을 동시에 수행하면 CLAUDE.md 역할 경계 원칙과 충돌.
- 이 Task가 병렬 구현 단계에서 실행될 경우, 어느 에이전트에게 할당할지 모호.

**권장 수정**:
- Task 1을 "Task 1-A: helpers.ts 구현"(backend-actions)과 "Task 1-B: helpers.test.ts 작성"(tester)으로 분리.
- Task 1-A 완료 후 Task 1-B를 이어서 실행.
- 단, 단일 사람 개발자가 순차 작업하는 경우라면 현행 유지도 실용적.

**영향**: Task 총 수 11 → 12 (Task 1 분리 시)

---

#### S-2: Task 6(exam-management.ts)의 작업량이 가장 많은 Task 중 하나임에도 분리 없음

**현황**:
- `exam-management.ts`: 471줄 소스 + 778줄 테스트(가장 큰 테스트 파일).
- 호출부 5곳 교체 + 테스트 mock 5곳 교체.
- 예상 소요 시간: 30~40분. PLAN 기준(15~30분)을 초과할 가능성 있음.

**문제**: 파일 크기와 호출부 수가 가장 많아 다른 Task(Task 8: academies.ts 220줄 + 2곳 교체)와 작업량 편차가 크다.

**권장 수정**:
- 분리하지 않더라도 PLAN 주의사항에 "교체 5곳 — 각 함수 단위로 순차 처리"를 명시.
- 또는 조회용 Actions(L290, L340, L376)와 변경용 Actions(L136, L423)로 Task 6-A/B 분리 고려.

---

### CONSIDER

#### C-1: Task 11(전체 검증)을 별도 Task로 두는 것이 적절한가

**현황**: Task 11은 전체 테스트 실행, 타입 체크, 미사용 import 정리, HANDOFF.md 업데이트 4가지를 포함.

**분석**:
- 각 Task(2~10)에 이미 `npx vitest run` 단위 검증이 포함되어 있음.
- Task 11의 전체 테스트는 "Phase 완료 검증"(Step 5)에 해당하는 성격으로, 별도 Task로 두는 것은 맞음.
- 다만 Task 11은 구현 역할(backend-actions, tester) 에이전트의 작업이 아니라 리드(오케스트레이터)의 책임에 가까움.

**권장**: Task 11을 "통합 검증 + 마무리" Task로 명시하고, 담당 역할을 "리드(오케스트레이터)"로 표시. 현행 내용은 유지해도 무방.

---

#### C-2: Task 2~10 병렬 처리 가능성 명시 부재

**현황**: Task 간 의존성이 "Task 1 완료 후 Task 2~10 실행 가능"으로 구조상 명확하지만, PLAN 문서에 병렬화 가이드가 없음.

**분석**:
- Task 2~10은 서로 독립된 파일 세트를 소유하므로 완전 병렬화 가능.
- 오케스트레이터가 이를 인지하지 못하면 순차 실행하게 됨(9 Task × 20분 = 3시간).

**권장**: PLAN 상단 또는 Task 1 직후에 다음 내용 추가:
```
## 병렬화 전략
- Task 1 완료 후 Task 2~10은 동시 병렬 실행 가능
- Task 11은 Task 2~10 전체 완료 후 실행
```

---

#### C-3: Task 7의 2파일 묶음은 적절한가

**현황**:
- `generate-questions.ts`(177줄) + `save-questions.ts`(237줄)을 Task 7로 묶음.
- 두 파일 모두 동일한 `checkTeacherOrAdmin()` 패턴을 제거하고 동일 교체 패턴 적용.
- 테스트 파일 2개(411줄 + 525줄) 포함.

**분석**:
- 두 파일의 변경 패턴이 완전히 동일하여 맥락 전환 비용이 낮음.
- 합산 소스 414줄 + 테스트 936줄은 많아 보이지만, 각 파일의 교체 지점이 1곳씩이라 실질 작업량은 작음.
- 분리하면 Task 수만 늘어나고 의미 있는 이점이 없음.

**판정**: 현행 묶음 유지가 적절. 분리 불필요.

---

## Plan Review Completion Checklist 판정

| 항목 | 충족 여부 | 비고 |
|------|----------|------|
| 모든 Task의 파일 소유권이 명확하다 | ✅ | 각 Task에 소유 파일 명시 |
| Task 간 의존성 순서가 정의되었다 | ⚠️ | Task 1 선행 명시되어 있으나 병렬화 전략 미명시 (C-2) |
| 외부 의존성(라이브러리, API)이 명시되었다 | ✅ | 신규 외부 의존성 없음 (내부 리팩토링) |
| 에러 처리 방식이 정해졌다 | ✅ | 패턴 A/B/C 명시, `{ error }` 반환 패턴 일관 |
| 테스트 전략이 있다 | ✅ | 각 Task에 검증 커맨드 명시 |
| 이전 Phase 회고의 교훈이 반영되었다 | ✅ | IDOR 방지(academy_id 체크), ROLES.includes() 가드 등 반영 |
| 병렬 구현 시 파일 충돌 가능성이 없다 | ✅ | 모든 Task가 독립 파일 세트 소유 |

---

## 최종 판정: **READY**

MUST FIX 이슈 없음. SHOULD FIX 2건은 구현 편의를 높이는 수준이며 구현 진행을 막지 않음.

**구현 시 권장 처리 순서**:
1. Task 1 단독 완료 (helpers.ts + helpers.test.ts)
2. Task 2~10 병렬 실행 (각 에이전트에 독립 할당 가능)
3. Task 11 단독 완료 (전체 검증)
