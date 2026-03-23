# Scope Review v2: 도형 렌더링 PLAN v2

> 리뷰어: scope-reviewer
> 리뷰 일자: 2026-03-23
> 리뷰 회차: 2/3

---

## v1 이슈 반영 확인

### [x] Task 11 → Wave 5로 독립
- **반영 완료**: Wave 5에 Task 11만 배치되어 있으며, "Task 2~10 전체 완료 후 시작"이 명시됨.
- 의존성 그래프에서도 Task 11이 Task 10 아래에 단독으로 연결되어 있어 직렬 처리 구조가 명확함.

### [x] Task 9/10 병렬 가능 명시
- **반영 완료**: Task 9 설명에 "Task 9(latex-renderer.tsx 수정)와 Task 10(ai/save-questions 파일 수정)은 서로 다른 파일이므로 Wave 4에서 병렬 구현 가능"이 1문장으로 명시됨.

### [x] 선택지 도형 YAGNI → options string[] 유지 명시
- **반영 완료**: 핵심 기능 항목 5에 "options 타입은 string[] 그대로 유지하며, 선택지 내 {{fig:N}} 구분자를 LatexRenderer로 렌더링 시 figures를 전달하는 방식으로 처리 — 기존 타입 변경 없음"이 명시됨.

### [x] 단계적 출시 기준 (number_line + coordinate_plane = MVP)
- **반영 완료**: Wave 3 설명에 "✅ 단계적 출시 기준: Wave 3 완료 전에도 number_line(Task 5) + coordinate_plane만으로 MVP 기능 동작 가능. 미구현 타입은 Task 3의 description 폴백으로 처리됨." 명시됨.

### [x] FigureInfo 영향 범위 → FigureInfo 불변으로 해소
- **반영 완료**: 기술 결정 표에 "FigureInfo 불변 — 기출 추출 전용, 변경 금지"가 명시됨. Task 6 설명에 "FigureInfo 기존 사용처 영향 없음 확인 (FigureInfo를 변경하지 않으므로 연쇄 타입 에러 없음)"이 체크리스트로 포함됨. FigureData를 별도 타입으로 신규 추가하는 방식으로 영향 범위 문제를 구조적으로 해소함.

### [x] AI 생성 도형 품질 검증 → "프롬프트 구조 검증만" 명시
- **반영 완료**: Task 10 AI 파일 작업에 "품질 검증 범위: 프롬프트 구조 검증만 이 Task에서 수행; 실제 Gemini 출력 품질은 E2E/수동 확인"이 명시됨. 테스트 전략(섹션 8)에도 "AI 프롬프트 figures 파싱 (구조 검증만 — Mock 기반, 출력 품질은 E2E/수동)"으로 일치.

### [x] Wave 3 일정 → 3-4일로 조정
- **반영 완료**: Wave 3 추정이 "3-4일"로 조정됨. 총계도 "~8-13일"로 상한을 13일로 확장하여 낙관적 추정을 완화함.

**v1 이슈 7개 모두 반영 완료.**

---

## 신규 이슈

### [SHOULD FIX] Task 10이 ai-integration과 backend-actions 두 역할이 공동 소유 — Wave 4 병렬 시 조율 방식 불명확

**위치**: PLAN 섹션 4 Task 10, 섹션 6 파일 소유권 표

**문제**: Task 10은 ai-integration(question-generation.ts, past-exam-generation.ts, validation.ts)과 backend-actions(save-questions.ts, save-questions action)가 동시에 작업한다. Wave 4 병렬 구간에서 두 에이전트가 **같은 Task 10** 내 각자 다른 파일을 동시에 수정하는 구조다.

실제 파일은 분리되어 있으므로 충돌은 없다. 그러나 backend-actions의 `save-questions.ts`가 `figureDataSchema`(Task 2, backend-actions 소유)를 import하고, ai-integration의 `validation.ts`도 `figureDataSchema`를 import한다. 두 에이전트가 Wave 4에서 같은 Zod 스키마를 참조하는 점은 문제없으나, PLAN에서 "Task 10 내 ai-integration 작업과 backend-actions 작업은 병렬 구현 가능"이라는 문장이 없다. Wave 4에서 Task 9(latex-renderer.tsx)와 Task 10 전체가 병렬이라는 설명만 있고, Task 10 내부 분업 조율 방식이 명시되지 않음.

**수정 방향**: Task 10 설명에 "ai-integration 작업(ai/ 파일)과 backend-actions 작업(validations/, actions/ 파일)은 서로 다른 파일이므로 Wave 4 내 병렬 구현 가능"을 1문장 추가. 또는 파일 소유권 표에서 Task 10을 ai-integration 소유 파일군과 backend-actions 소유 파일군으로 분리 표기.

---

### [SHOULD FIX] `src/lib/ai/types.ts` 리드 승인이 Wave 2에서 병목이 될 수 있음 — 승인 타이밍 미명시

**위치**: PLAN 섹션 6 파일 소유권 표, 섹션 9 리스크

**문제**: `src/lib/ai/types.ts`는 공유 파일로 "리드 승인 필요"가 명시되어 있고, Wave 2에서 ai-integration 역할이 FigureData 타입 추가를 위해 이 파일을 수정한다. Task 6 자체가 Wave 2 병렬 구간에 배치되어 있으므로, 리드 승인을 얻지 못한 채 ai-integration 에이전트가 Task 6 전체를 완료하거나, 반대로 승인 대기로 Wave 2 전체가 블로킹될 가능성이 있다.

**수정 방향**: Task 6 설명에 "Wave 2 시작 전 또는 Task 6 시작 시 리드 승인 선행 처리" 타이밍을 명시하거나, Task 6을 두 단계로 분리 — (a) types.ts 수정(리드 승인 후 단독 처리) → (b) 나머지 Task 6 작업(병렬 진행). 구현 복잡도를 높이지 않으려면 "Wave 2 착수 전 리드가 types.ts에 FigureData 타입 뼈대를 선행 추가"하는 방식이 가장 단순함.

---

### [CONSIDER] function_graph가 coordinate_plane을 "내부 합성"하는지 "props 전달"인지 불명확

**위치**: PLAN 섹션 4 Task 7, 기술 결정 표

**문제**: Task 7에서 "function-graph.tsx: xRange, yRange, gridStep으로 coordinate_plane 내부 합성 + points → SVG polyline 오버레이"라고 설명되어 있다. 그러나 기술 결정 표에는 "coordinate_plane 오버레이: MVP에서 합성 렌더링 미구현, 각 도형은 독립 SVG"라고 되어 있다.

이 두 설명이 상충해 보인다. function_graph가 coordinate_plane 컴포넌트를 내부에서 재사용하는지(JSX 합성), 아니면 svg-utils의 좌표 계산 로직만 공유하는 독립 SVG인지 구분이 모호하다. 에이전트가 Task 7을 구현할 때 해석에 따라 다른 결과물이 나올 수 있다.

**고려사항**: "각 도형은 독립 SVG"라는 결정을 유지한다면, function_graph는 coordinate_plane 컴포넌트를 import하지 않고 svg-utils의 좌표 변환 로직만 공유하며 독립적으로 SVG를 렌더링한다는 점을 Task 7에 명시하는 것이 좋다.

---

## 범위 평가 (v2 신규 항목 포함)

### v2에서 새로 추가된 범위 항목

| 항목 | 평가 |
|------|------|
| FigureData 별도 타입 추가 (FigureInfo 불변) | 적절 — 타입 충돌 해소, 영향 범위 최소화 |
| save-questions Task 10에 통합 | 적절 — 도형 저장은 이번 Phase 완성에 필수 |
| Wave 5 테스트 독립 | 적절 — 의존성 순서 명확 |
| Task 9/10 병렬 명시 | 적절 — 에이전트 혼동 방지 |

**범위 과도 확장 없음.** v2 변경은 모두 v1 이슈 해소를 위한 수정이며, 새로운 기능이 추가되지 않았다.

---

## Plan Review Completion Checklist 판정

- [x] 모든 Task의 파일 소유권이 명확하다
- [x] Task 간 의존성 순서가 정의되었다
- [x] 외부 의존성(라이브러리, API)이 명시되었다
- [x] 에러 처리 방식이 정해졌다
- [x] 테스트 전략이 있다
- [x] 이전 Phase 회고의 교훈이 반영되었다
- [x] 병렬 구현 시 파일 충돌 가능성이 없다

---

## 결론

**READY**

v1 MUST FIX 2개, SHOULD FIX 3개, CONSIDER 2개가 모두 v2에 명확히 반영되었다. Plan Review Completion Checklist 7개 항목 전부 충족. 신규 이슈 2개(SHOULD FIX)는 구현 중 처리 가능한 문서 명확화 수준이며 블로킹 요인이 아니다.

**구현 착수 전 처리 권고 (SHOULD FIX 2개)**:
1. Task 10 내부 ai-integration / backend-actions 병렬 구현 가능 여부 1문장 추가
2. `src/lib/ai/types.ts` 리드 승인 타이밍(Wave 2 시작 전 선행 처리) 명시

**구현 중 처리 가능 (CONSIDER 1개)**:
- function_graph의 coordinate_plane 합성 방식(독립 SVG vs JSX 재사용) 명확화 — Task 7 구현자가 svg-utils 공유 방식으로 처리하면 됨
