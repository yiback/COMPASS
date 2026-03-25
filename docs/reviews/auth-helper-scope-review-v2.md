# Scope Review v2: Server Action 인증 헬퍼 통합 (auth-helper-consolidation.md v2)

> 작성일: 2026-03-25
> 검토자: scope-reviewer
> 대상 PLAN: docs/plan/auth-helper-consolidation.md (v2 — 1차 리뷰 반영본)
> 이전 리뷰: docs/reviews/auth-helper-scope-review.md

---

## 최종 판정

**READY** — 1차 MUST FIX 2건 해소 확인. 신규 이슈 없음.

---

## 1차 이슈 해소 여부 판정

### MUST-1: 누락된 인증 헬퍼 변형 3개 → **해소**

v2 PLAN의 섹션 1 "현재 변형 목록" 표가 7개 → 10개로 확장되었다.
코드베이스 실제 상태와 대조:

| # | 파일 | 헬퍼 이름 | v2 PLAN 포함 여부 |
|---|------|----------|----------------|
| 1 | `users.ts` | `getCurrentUserProfile()` | O |
| 2 | `questions.ts` | `getCurrentUserProfile()` | O |
| 3 | `past-exams.ts` | `getCurrentUserProfile()` + 인라인 | O |
| 4 | `extract-questions.ts` | `getCurrentUserWithRole()` | O (1차에서 '인라인'으로 오기된 것도 정정됨) |
| 5 | `exam-management.ts` | `getCurrentUserWithRole()` | O (1차 누락 → 추가됨) |
| 6 | `generate-questions.ts` | `checkTeacherOrAdmin()` | O (1차 누락 → 추가됨) |
| 7 | `save-questions.ts` | `checkTeacherOrAdmin()` | O (1차 누락 → 추가됨) |
| 8 | `academies.ts` | `checkAdminRole()` | O |
| 9 | `schools.ts` | `checkAdminOrTeacherRole()` | O |
| 10 | `achievement-standards.ts` | `checkAuthenticated()` + `checkSystemAdminRole()` | O (헬퍼 2개 모두 명시됨) |

1차 리뷰에서 지적한 3개 누락 파일(generate-questions, save-questions, exam-management)이
모두 v2에 반영되었다. 코드베이스와 완전히 일치한다.

### MUST-2: 테스트 파일명 불일치 → **해소**

- 섹션 3 테스트 파일 목록: `questions-list.test.ts` + `questions-detail.test.ts` 2개로 정정됨
- `past-exams-list.test.ts`도 포함됨 (1차 SHOULD-2 이슈도 함께 해소됨)
- `reanalyze-question.test.ts`도 포함됨 (1차 CONSIDER-3 이슈도 함께 해소됨)
- 총 13개 테스트 파일 목록이 실제 `__tests__/` 디렉토리 파일과 일치한다.

### SHOULD-1: 역할 내포 헬퍼 전환 방향 미명시 → **해소**

v2 섹션 2에 호출부 패턴 A/B/C가 명시되었다. 특히 패턴 C:
```
// 패턴 C: 인증 + 역할 + academy_id (역할 제한 Action)
if (!['teacher', 'admin', 'system_admin'].includes(profile.role)) {
  return { error: '권한이 없습니다.' }
}
```
`exam-management.ts`, `extract-questions.ts`, `generate-questions.ts`, `save-questions.ts`
모두 이 패턴으로 전환 방향이 명확히 정의되어 있다. Task 5~7 설명에도 "역할 분기 호출부로 이동"이 명시됨.

### CONSIDER-1: 단계적 분할 → **채택 (해소)**

1차에서 단계적 분할을 검토 대상으로 제시했으나, v2는 Task 11개로 분할하고 각 Task 후 검증하는
방식을 채택했다. 분할의 대안(일부만 포함)이 아닌 전체 포함 + 세분화된 단위 검증으로 결정됨.

---

## 2차 신규 검토 항목

### 2-1. Task 분해 적절성 (11개)

| Task | 대상 | 예상 시간 | 평가 |
|------|------|---------|------|
| T1 | helpers.ts 신규 생성 + 단위 테스트 | 30분 | 적절 |
| T2 | users.ts (호출 3곳) | 15분 | 적절 |
| T3 | questions.ts + 테스트 2개 | 15분 | 적절 |
| T4 | past-exams.ts + 인라인 1곳 + 테스트 2개 | 20분 | 적절 |
| T5 | extract-questions.ts + 테스트 2개 | 20분 | 적절 |
| T6 | exam-management.ts + 테스트 1개 | 15분 | 적절 |
| T7 | generate-questions.ts + save-questions.ts 묶음 | 20분 | 적절 (패턴 동일) |
| T8 | academies.ts + 인라인 포함 | 20분 | 적절 |
| T9 | schools.ts | 15분 | 적절 |
| T10 | achievement-standards.ts (헬퍼 2개 → 패턴 A/C) | 15분 | 적절 |
| T11 | 전체 검증 | 15분 | 적절 |

**총 예상 3~3.5시간.** Task가 과도하게 세분화된 것이 아니라, 파일별 1:1 대응이므로
각 Task 완료 후 즉시 테스트 검증이 가능한 구조다. 불필요한 분할 없음.

### 2-2. ~25파일 수정 규모의 적절성

- 신규 파일 2개 + Action 10개 수정 + 테스트 13개 수정 = 25개
- 모두 **동일 디렉토리**(`src/lib/actions/`) 내에 집중되어 있다.
- 병렬 구현 불가 → 단일 구현자가 순차 처리. 파일이 많아도 패턴이 반복되므로 실질 복잡도는 낮다.
- 단, 13개 테스트 파일의 mock 구조 변경이 작업 시간의 절반 이상을 차지할 가능성이 있다.
  PLAN의 "HIGH 리스크" 항목(`vi.mock('./helpers')` 전환)이 이미 명시되어 있어 인지됨.

**적절한 규모.** 한 번에 처리 가능하다.

### 2-3. YAGNI 위반 여부

v2 PLAN의 설계 결정 검토:

| 항목 | 판단 |
|------|------|
| `ActionProfile` 타입 export | 테스트에서 mock 구성에 사용됨 → 필요 |
| `GetCurrentUserResult` 타입 export | 기존 각 파일에서 사용 중인 타입과 교체 → 필요 |
| `ROLES.includes()` 런타임 가드 | MEMORY.md에 기록된 필수 패턴 → 필요 |
| `academyId: string | null` 반환 | system_admin null 허용이 설계 결정 D4에 명시됨 → 필요 |
| helpers.ts 분리 (auth 모듈과 별도) | D1에 이유 명시됨 (Server Action 전용, cache 불필요) → 정당 |

YAGNI 위반 없음. 모든 설계 결정에 근거가 있다.

### 2-4. 더 단순한 접근 가능 여부

현재 접근(10개 파일의 로컬 헬퍼를 1개의 공유 헬퍼로 통합)이 이 리팩토링에서 가장 단순한 방법이다.
대안 검토:

- **더 작은 범위**: 1차 CONSIDER-1에서 제안된 "역할 체크 없는 5개만 먼저 통합" 방향.
  v2는 이를 채택하지 않고 전체 통합을 선택했다. 타당한 결정 — 분할해도 리스크 감소 효과가
  제한적이고 기술 부채 청산 효과는 전체 통합이 더 크다.
- **더 큰 범위**: `src/lib/auth/` 모듈과 통합하는 방향.
  D1에서 명확히 기각됨 (cache 메커니즘 차이, 사용 컨텍스트 차이).

현재 접근이 최적이다.

### 2-5. 잠재적 미명시 리스크

v2 PLAN 검토 중 발견된 경미한 사항:

**[CONSIDER] academies.ts `getMyAcademy` 인라인 인증 2단계 처리**

`academies.ts`의 `getMyAcademy()`는 `checkAdminRole()`을 사용하지 않고 직접 인라인 인증 코드를
작성하고 있다 (파일 92-113행). Task 8 설명에 "getMyAcademy() 내 인라인 인증도 getCurrentUser로 교체"가
명시되어 있어 구현자가 인지할 수 있다. 위험 수준 낮음.

**[CONSIDER] `exam-management.ts`의 `ALLOWED_ROLES` 상수 제거 여부**

`exam-management.ts`에는 `const ALLOWED_ROLES = ['teacher', 'admin', 'system_admin']`가 별도로
선언되어 있다. 역할 분기가 호출부로 이동하면 이 상수도 제거 대상인데, Task 6 설명에 명시적 언급이 없다.
구현자가 미처 제거하지 않아도 테스트는 PASS되므로 dead code로 남을 수 있다. 경미한 수준.

---

## 범위 적절성 종합 평가

| 항목 | 평가 |
|------|------|
| 1차 MUST FIX 해소 | 완전 해소 (2/2) |
| 1차 SHOULD FIX 해소 | 완전 해소 (1/1, SHOULD-2도 해소) |
| 1차 CONSIDER 반영 | 선택적 반영 (C1 채택, C2 채택, C3 해소) |
| 리팩토링 목적 명확성 | 적절 — 동작 변경 없는 DRY 원칙 적용 |
| 영향 범위 분석 정확도 | 충분 — 코드베이스와 완전 일치 |
| Task 분해 크기 | 적절 — 파일별 1:1, 과도 세분화 없음 |
| YAGNI 위반 | 없음 |
| 파일 소유권 충돌 | 없음 — 단일 구현자 순차 처리 |

---

## Plan Review Completion Checklist

- [x] 모든 Task의 파일 소유권이 명확하다
- [x] Task 간 의존성 순서가 정의되었다 (helpers.ts T1 → T2-T10 순차)
- [x] 외부 의존성(라이브러리, API)이 명시되었다 (없음 — 기존 `@/lib/supabase/server` 활용)
- [x] 에러 처리 방식이 정해졌다 (`{ error }` 반환 패턴 일관 적용)
- [x] 테스트 전략이 있다 (각 Task 완료 시 단위 테스트 + T11 전체 검증)
- [x] 이전 Phase 회고의 교훈이 반영되었다 (MEMORY.md: ROLES.includes 가드, { error } 반환)
- [x] 병렬 구현 시 파일 충돌 가능성이 없다 (단일 구현자 순차 처리)

**판정: READY** — 구현 진행 가능.
