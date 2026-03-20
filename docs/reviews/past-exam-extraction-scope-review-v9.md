# 기출문제 추출 계획 v9 — 범위 리뷰

> 리뷰어: scope-reviewer
> 대상: docs/plan/20260308-past-exam-extraction.md (v9)
> 일자: 2026-03-20
> 이전 리뷰: docs/reviews/past-exam-extraction-scope-review-v8.md

---

## 요약

v8 Scope Review의 SHOULD FIX 1건(테스트 파일 분리)과 CONSIDER 3건(Storage cleanup 실패 처리, dnd-kit 의존성 타이밍, exam-management 파일 응집도) 모두 v9에 반영되었다. v9에서 새로 추가된 이슈는 MUST FIX 없음, SHOULD FIX 없음, CONSIDER 2건이다. 두 CONSIDER 모두 구현 진입을 차단하지 않는 경미한 수준이다.

---

## v8 이슈 반영 확인

| v8 이슈 | 분류 | v9 반영 여부 |
|---------|------|------------|
| Step 5 단일 파일 책임 과중 — `reanalyzeQuestionAction` 테스트를 별도 파일(`reanalyze-question.test.ts`)로 분리 권장 | SHOULD FIX 1 | ✅ 반영 — Step 5 파일 목록에 `reanalyze-question.test.ts` 신규 파일 명시. 테스트 전략 표의 `reanalyzeQuestionAction` 행이 `reanalyze-question.test.ts` (별도 파일)로 업데이트됨. v8→v9 변경 요약 7번 항목에도 기술 |
| `resetExtractionAction` Storage 삭제 실패 시 처리 방식 미명시 | CONSIDER 2 | ✅ 반영 — "Non-blocking (무시하고 계속 진행)" 확정. Step 5 의사코드, 리스크 표, 확정 결정사항 표에 명시. orphan은 Phase 2 cleanup job 처리로 결정. v8→v9 변경 요약 1번에도 기술 |
| Step 6 `@dnd-kit` 의존성 추가 타이밍 미명시 | CONSIDER 3 | ✅ 반영 — Step 6 신규 의존성 항목에 "착수 전 리드가 `package.json`에 `@dnd-kit/*` 추가 후 Wave 3 시작" 주석 명시. Wave 의존성 그래프에도 반영. v8→v9 변경 요약 5번에 기술 |
| `exam-management.ts`에 편집/삭제/확정 Action 배치 근거 미명시 | CONSIDER 4 | ✅ 반영 — Step 4 설명에 "파일 크기 밸런싱 목적: `extract-questions.ts`에 이미 3개 Action 배치 → 비대화 방지를 위해 분산" 주석 명시. v8→v9 변경 요약 6번에 기술 |

---

## 새로운 이슈 목록

### [CONSIDER] 1. `reanalyzeQuestionAction`의 `maxDuration = 60` 선언 위치 모호성

- **위치**: Step 5 신규 의존성 설명 / `reanalyzeQuestionAction` 의사코드
- **문제**: `export const maxDuration = 60`은 Next.js Route Segment Config로 파일 단위로 적용된다. `extract-questions.ts`에는 `extractQuestionsAction`과 `reanalyzeQuestionAction`이 함께 배치된다. PLAN에서 `maxDuration = 60`을 "Step 5 신규 의존성"으로 기술하고, `reanalyzeQuestionAction`에도 별도로 "extractQuestionsAction과 동일 적용" 주석을 달았는데, 독자에게 "파일당 1개 선언으로 두 Action 모두 60초 적용"이 자동으로 성립한다는 점이 명확히 기술되지 않았다.
- **위험도**: 구현자가 `reanalyzeQuestionAction`에 별도 `maxDuration`을 선언하려 하거나, 반대로 `extractQuestionsAction`에만 적용된다고 오해할 수 있다.
- **제안**: Step 5 신규 의존성 항목에 "`export const maxDuration = 60`은 파일 수준 선언으로 `extract-questions.ts`의 모든 Action에 일괄 적용됨 — `extractQuestionsAction`, `resetExtractionAction`, `reanalyzeQuestionAction` 모두 포함" 한 줄 추가.

---

### [CONSIDER] 2. Wave 3 시작 조건에 `sharp` 의존성 추가가 누락됨

- **위치**: 의존성 그래프 — Wave 3 주석
- **문제**: v9 의존성 그래프는 다음과 같다:
  ```
  Wave 3: Step 5 ∥ Step 6
          └ (v9 반영) Wave 3 시작 전: 리드가 package.json에 @dnd-kit/* + sharp 추가
  ```
  `@dnd-kit/*`와 `sharp` 둘 다 명시되어 있으나, Step 5 설명에는 "신규 의존성: `sharp` — package.json dependencies에 추가 필수"가 이미 있다. Wave 3 시작 조건의 주석이 Step 5와 Step 6의 의존성을 모두 묶어 리드에게 한 번에 전달하는 구조는 좋다.
- **남은 모호성**: `sharp`는 Step 5(추출 Action)에만 필요하고 `@dnd-kit/*`는 Step 6(업로드 UI)에만 필요하다. 두 패키지를 묶어 "Wave 3 시작 전 리드가 추가"로 기술하면, Step 5와 Step 6 병렬 구현 시 어느 시점에 어느 패키지가 필요한지 구현자 입장에서 구분이 어려울 수 있다.
- **제안**: Wave 3 주석을 다음처럼 세분화:
  ```
  Wave 3 시작 전: 리드가 package.json에 추가
    - sharp: Step 5(extract-questions.ts) 착수 전 필요
    - @dnd-kit/*: Step 6(image-sorter.tsx) 착수 전 필요
  ```
  단, 현재 기술로도 "Wave 3 시작 전 둘 다 추가"로 처리하면 충분하므로 CONSIDER 수준.

---

## Plan Review Completion Checklist

- [x] 모든 Task의 파일 소유권이 명확하다 — `reanalyzeQuestionAction` 소유권 `extract-questions.ts`(backend-actions) 확정. `updateExtractedQuestion` 등은 `exam-management.ts` 배치 근거 주석 추가로 명확화
- [x] Task 간 의존성 순서가 정의되었다 — Wave 기반 의존성 그래프, Step 6 "Step 4 + Step 2" 의존, Wave 3 시작 전 `package.json` 추가 조건 명시
- [x] 외부 의존성(라이브러리, API)이 명시되었다 — sharp, @dnd-kit/*, Gemini Vision API, Vercel 플랜 조건, `package.json` 리드 소유 규칙 및 타이밍 모두 명시됨 (CONSIDER 2는 경미한 세분화 제안)
- [x] 에러 처리 방식이 정해졌다 — isCompleted 패턴, crop 부분 실패 null 처리, Optimistic Lock, Storage 삭제 Non-blocking 처리, try/finally 모두 명시
- [x] 테스트 전략이 있다 — TDD 명시, 테스트 파일별 커버리지 항목 기술. `reanalyze-question.test.ts` 별도 분리로 v8 SHOULD FIX 해소
- [x] 이전 Phase 회고(`docs/retrospective/`)의 교훈이 반영되었다 — 디렉토리 미존재. 프로젝트 최초 Phase이므로 해당 없음으로 간주 (v7, v8과 동일 판정)
- [x] 병렬 구현 시 파일 충돌 가능성이 없다 — Wave 기반 분리, Step 6+7 순차 진행 확정, `reanalyzeQuestionAction` 소유권 명확화, `exam-management.ts` 배치 근거 주석 추가로 구현자 혼란 최소화

**판정: READY**

v8 Scope Review의 SHOULD FIX 1건과 CONSIDER 3건이 모두 v9에 반영되었다. 새로운 이슈는 MUST FIX 없음, SHOULD FIX 없음, CONSIDER 2건(`maxDuration` 선언 범위 설명 보강, Wave 3 의존성 세분화)이다. 두 CONSIDER 모두 구현 품질 향상을 위한 제안이며 구현 진입을 차단하지 않는다. v9는 구현 단계 진입 가능 상태다.
