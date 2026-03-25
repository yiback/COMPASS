# Scope Review: Server Action 인증 헬퍼 통합 (auth-helper-consolidation.md)

> 작성일: 2026-03-25
> 검토자: scope-reviewer
> 대상 PLAN: docs/plan/auth-helper-consolidation.md

---

## 판정

**BLOCKED** — MUST FIX 2건 해소 후 구현 진행

---

## 현황 요약

PLAN은 7가지 인증 헬퍼 변형을 `getCurrentUser()` 1개로 통합한다고 명시하고 있으나,
실제 코드베이스에는 PLAN이 집계한 7개 외에 **추가 변형이 3개** 더 존재한다.
PLAN의 영향 범위 분석(14개 파일)이 불완전하며, 구현 전 반드시 범위를 재정의해야 한다.

---

## MUST FIX

### [MUST-1] 누락된 인증 헬퍼 변형 3개 — CRITICAL

PLAN의 "현재 변형 목록"(표 7개)이 불완전하다. 실제 코드베이스에 추가로 3개의 변형이 더 존재한다.

| 추가 변형 | 파일 | 함수명 | 역할 체크 포함 |
|---------|------|--------|-------------|
| 8 | `src/lib/actions/generate-questions.ts` | `checkTeacherOrAdmin()` | O (teacher/admin/system_admin) |
| 9 | `src/lib/actions/save-questions.ts` | `checkTeacherOrAdmin()` | O (teacher/admin/system_admin) |
| 10 | `src/lib/actions/exam-management.ts` | `getCurrentUserWithRole()` | O (teacher/admin/system_admin) |

또한 PLAN이 분류한 변형 5번(`extract-questions.ts`)도 실제 함수명은 "인라인"이 아닌
`getCurrentUserWithRole()`로 명명된 분리 함수이며, `exam-management.ts`와 동일한 패턴이다.

**영향**: PLAN의 수정 파일 목록(14개)에서 아래 파일 및 테스트가 누락되었다:
- `src/lib/actions/generate-questions.ts` + `__tests__/generate-questions.test.ts`
- `src/lib/actions/save-questions.ts` + `__tests__/save-questions.test.ts`
- `src/lib/actions/exam-management.ts` + `__tests__/exam-management.test.ts`
- `src/lib/actions/extract-questions.ts`의 함수명 표기 오류 (인라인 → `getCurrentUserWithRole`)

추가로 `achievement-standards.ts`에는 헬퍼가 2개(`checkSystemAdminRole` + `checkAuthenticated`)로
각각 다른 역할 체크 수준을 가진다. 이를 모두 `getCurrentUser()`로 통합할 경우
역할 체크 로직이 호출부에서 분산 표현되어야 한다. PLAN이 이 파일을 단일 헬퍼로 처리하는 것으로
기술되어 있으나, 실제 2개의 헬퍼를 1개로 병합하는 상세 전환 전략이 누락되어 있다.

**수정 방향**: PLAN의 영향 범위 표에 누락된 3개 파일(6개 파일 + 6개 테스트)을 추가하고,
총 수정 파일 수를 실제 수치(20개 파일)로 정정할 것.

---

### [MUST-2] `questions.ts` 테스트 파일명 불일치 — HIGH

PLAN의 수정 파일 목록에 `__tests__/questions.test.ts`가 표기되어 있으나,
실제 파일은 `__tests__/questions-list.test.ts`와 `__tests__/questions-detail.test.ts` 2개로
분리되어 있다. 구현자가 잘못된 파일명을 작업하면 테스트 검증이 누락된다.

**수정 방향**: PLAN의 수정 파일 목록에서 `questions.test.ts` → `questions-list.test.ts`, `questions-detail.test.ts` 2개로 정정할 것.

---

## SHOULD FIX

### [SHOULD-1] `exam-management.ts`와 `extract-questions.ts`의 역할 내포 헬퍼 처리 방향 미명시 — MEDIUM

이 두 파일의 헬퍼(`getCurrentUserWithRole`)는 역할 체크(teacher/admin/system_admin)까지
함수 내부에서 수행한다. PLAN의 설계 결정 D2("역할 체크는 호출부에서 수행")와 충돌한다.

통합 후 두 가지 선택지가 있다:
1. `getCurrentUser()`로 교체하고 역할 체크를 호출부에 분산 (D2 준수)
2. 역할 체크 포함 래퍼를 유지하되 내부적으로 `getCurrentUser()`를 호출

어느 방향이든 명시 없이 구현자에게 맡기면 불일치가 발생할 수 있다.
PLAN에 해당 파일의 전환 방향을 명시할 것을 권고한다.

---

### [SHOULD-2] `past-exams-list.test.ts` 누락 여부 확인 필요 — MEDIUM

`past-exams.ts`의 테스트가 `__tests__/past-exams.test.ts`와 `__tests__/past-exams-list.test.ts`
두 파일로 분리되어 있을 수 있다(파일이 존재함 확인). PLAN은 `past-exams.test.ts` 1개만 명시하고 있다.
`questions.test.ts`와 동일한 패턴의 파일명 불일치일 수 있으므로 확인 후 PLAN에 반영할 것.

---

## CONSIDER

### [CONSIDER-1] `generate-questions.ts`와 `save-questions.ts`의 역할: 이번에 포함할 것인가?

두 파일의 `checkTeacherOrAdmin()`은 역할 체크를 함수 내부에 포함하는 "무거운" 변형이다.
이번 통합에 포함하면 총 파일 수가 약 20개로 늘어나 예상 작업 시간(2~2.5시간)을 초과할 수 있다.

단계적 접근 대안:
- 이번 범위: 역할 체크 없는 순수 인증 헬퍼 5개 통합(users, questions, past-exams, achievement-standards, schools)
- 다음 범위: 역할 체크 내포 헬퍼 5개 통합(generate-questions, save-questions, exam-management, extract-questions, academies)

단, 이미 순차 처리(병렬 불가) 작업이므로 분할해도 리스크 감소 효과는 제한적이다.
모두 포함하는 것이 기술 부채 청산 효과는 크다. 사용자의 의사결정을 권고한다.

---

### [CONSIDER-2] `checkSystemAdminRole()` 별도 헬퍼로 유지 검토

`achievement-standards.ts`의 `checkSystemAdminRole()`은 다른 헬퍼와 달리 `academy_id` 없는
`system_admin` 역할을 대상으로 한다(MEMORY.md: "system_admin academy_id null" 참조).
`getCurrentUser()`가 `academy_id` null을 에러로 처리하면 `system_admin`이 성취기준 CUD를
수행할 수 없게 된다. PLAN 섹션 2("설계 결정")에서 `academy_id null` 처리 방침을 명확히 해야 한다.

현재 PLAN의 `ActionProfile` 타입에서 `academyId: string | null`로 선언되어 있어
null 허용으로 설계된 것으로 보이나, 현재 `users.ts`의 `getCurrentUserProfile()`은
`academy_id` null을 에러로 반환한다. 두 처리 방식이 충돌한다.

**권고**: `getCurrentUser()`는 `academy_id` null을 허용(system_admin 대응)하고,
academy_id가 필요한 Action의 호출부에서 null 체크를 추가하는 방향이 일관성 있다.
이를 PLAN에 명시할 것.

---

### [CONSIDER-3] `reanalyze-question.test.ts` 누락 여부 확인

`src/lib/actions/__tests__/reanalyze-question.test.ts`가 존재한다.
이 파일이 `extract-questions.ts`의 인증 헬퍼를 mock하는지 여부에 따라
수정 파일 목록에 추가해야 할 수 있다.

---

## 범위 적절성 종합 평가

| 항목 | 평가 |
|------|------|
| 리팩토링 목적의 명확성 | 적절 — 동작 변경 없는 DRY 원칙 적용 |
| 영향 범위 분석 정확도 | **불충분** — 3개 파일 + 테스트 파일명 누락 |
| Task 분해 크기 | 적절 — Task 1(신규 헬퍼 30분) + Task 2~8(각 15분) |
| 단계적 접근 vs 일괄 통합 | 사용자 결정 필요 (CONSIDER-1) |
| 파일 소유권 충돌 위험 | 없음 — 단일 구현자 순차 처리 적절 |
| 병렬 구현 차단 근거 | 적절 — helpers.ts 의존 관계 명확 |

---

## Plan Review Completion Checklist

- [x] 모든 Task의 파일 소유권이 명확하다
- [x] Task 간 의존성 순서가 정의되었다 (helpers.ts 먼저)
- [x] 외부 의존성(라이브러리, API)이 명시되었다 (없음)
- [x] 에러 처리 방식이 정해졌다 (`{ error }` 반환)
- [x] 테스트 전략이 있다 (각 Task 완료 시 단위 테스트)
- [x] 이전 Phase 회고의 교훈이 반영되었다 (Server Action `{ error }` 반환 패턴)
- [x] 병렬 구현 시 파일 충돌 가능성이 없다

**BLOCKED 이유**: MUST-1(누락 파일 3개), MUST-2(파일명 불일치)가 미해소 상태.
두 이슈 수정 후 → **READY** 전환 가능.
