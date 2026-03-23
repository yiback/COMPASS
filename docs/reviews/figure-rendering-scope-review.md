# Scope Review: 도형 렌더링 PLAN v1

> 리뷰어: scope-reviewer
> 리뷰 일자: 2026-03-23

---

## 이슈 목록

### [MUST FIX] Task 11 (테스트)가 Wave 4 병렬 구간에 배치됨 — Task 9, 10과 동시 시작 불가

**위치**: PLAN 섹션 5 구현 순서(Wave), 섹션 4 Task 11

**문제**: Task 11(전체 테스트)의 의존성이 "Task 2~10 전체"로 명시되어 있는데, Wave 4에서 Task 9(연속 도형 + 선택지), Task 10(AI 생성 프롬프트)과 **병렬**로 배치되어 있다. Task 9, 10이 완료되기 전에 테스트를 작성할 수 없다.

**수정 방향**: Wave 4를 2단계로 분리.
- Wave 4a(병렬): Task 9, Task 10
- Wave 4b(직렬): Task 11 (Task 9, 10 완료 후)

또는 Task 11을 Wave 5로 독립시킨다.
<!-- NOTE: Task11을 Wave5로 독립 -->
---

### [MUST FIX] Wave 2에서 Task 4와 Task 9가 모두 `latex-renderer.tsx`를 수정 — 파일 충돌 미해결

**위치**: PLAN 섹션 6 파일 소유권 표

**문제**: 파일 소유권 표에서 `src/components/ui/latex-renderer.tsx`가 "Wave 2, 4"로 표기되어 있고, "Wave 2 → Wave 4 직렬"이라고 리스크 섹션(10번)에 명시되어 있으나, **Wave 2에서 Task 4(LatexRenderer 업데이트)**, **Wave 4에서 Task 9(연속 도형 + 선택지)**가 각각 같은 파일을 수정하는 구조는 직렬 처리가 맞다. 그런데 Wave 4 병렬 구간에 Task 9가 배치되어 Task 10과 병렬로 실행될 경우 에이전트가 동시에 같은 파일을 편집할 가능성이 있다.

**수정 방향**: Task 9는 Task 10과 병렬 불가. Wave 4a에서 Task 9(latex-renderer.tsx), Task 10(ai 파일들)을 병렬 처리하되, 이 둘은 서로 다른 파일이므로 **실제 충돌 없음**. 그러나 PLAN 문서에서 "Task 9와 10이 병렬 가능"임을 명시적으로 설명해야 혼동을 방지할 수 있다.
<!-- NOTE: 수정방향 수용 -->
---

### [SHOULD FIX] 리서치 추천안의 "Phase 3 선택 항목"이 PLAN에서 필수로 격상됨 — YAGNI 위반 위험

**위치**: PLAN 섹션 3 핵심 기능 항목 6: "선택지 내 도형"

**문제**: `docs/research/math-figures-recommendation.md` Phase 3에서 "선택지 내 도형: YAGNI — 현 시점 보류"로 명시된 항목이 PLAN 핵심 기능에 포함되어 있다. 리서치 단계에서 YAGNI로 판단한 이유가 있다 — `options` 타입이 `string[]`에서 `(string | FigureOption)[]`로 변경 시 기존 코드 전수 수정 비용.

**단, PLAN의 구현 방식을 보면**: PLAN에서는 `options` 배열 내 `{{fig:N}}` 구분자를 `LatexRenderer`로 렌더링할 때 `figures` props를 그대로 전달하는 방식으로, `options` 타입 변경 없이 처리한다. 이 접근은 타입 변경 비용을 발생시키지 않으므로 리서치의 YAGNI 우려를 우회한다.

**수정 방향**: PLAN에 "options 타입은 `string[]` 그대로 유지, 구분자 방식으로 처리"임을 명시하여 리서치와 PLAN의 표면적 불일치를 해소. 리뷰어가 혼동할 수 있으므로 1문장 주석이면 충분.
<!-- NOTE: 수용 -->
---

### [SHOULD FIX] 6종 도형 모두 이번 Phase에 구현 — 단계적 출시 가능한 구간이 명확히 분리되지 않음

**위치**: PLAN 섹션 4 Task 7, 8

**문제**: 리서치 추천안은 "수직선 → 좌표평면+직선 → 기하도형 → 벡터"의 단계적 도입을 제안했다. PLAN도 Wave 구조로 단계를 나누었으나, Wave 3 전체가 SVG 렌더러 완성에 배정되어 있다. 만약 Wave 3 개발 중 일부 도형(coordinate_plane, function_graph)만 완성되고 다각형/원/벡터가 미완성인 채로 머지될 경우 FigureRenderer가 미지원 타입을 `description` 폴백으로 처리해야 하는데, 이 폴백 경로가 Task 3에서 이미 구현되므로 **실제로는 단계 출시 가능**하다.

**수정 방향**: "Wave 3 완료 전에도 number_line + coordinate_plane만으로 MVP 기능 동작 가능"이라는 중간 출시 기준을 명시하면 일정 리스크 완화에 도움이 된다. 필수 수정은 아니나 팀 판단 기준이 명확해진다.
<!-- NOTE: 수용 -->
---

### [SHOULD FIX] Task 6 (AI 추출 프롬프트)의 `FigureInfo` 타입 변경이 리드 승인 조건으로만 명시됨 — 영향 범위 미산정

**위치**: PLAN 섹션 4 Task 6

**문제**: `src/lib/ai/types.ts`가 공유 파일(Shared Files)로 지정되어 있고, Task 6에서 `FigureInfo` 타입을 수정한다. 이 타입이 현재 코드베이스에서 몇 개의 파일에 사용되는지 PLAN에서 확인되지 않는다. 타입 변경 시 연쇄 TypeScript 에러가 발생할 수 있으며, 이는 에이전트 빌드 에러로 이어질 가능성이 있다.

**수정 방향**: Task 6 설명에 "`FigureInfo` 기존 사용처 N곳 확인 후 호환성 유지 확인" 체크리스트를 추가하거나, 기존 필드를 제거하지 않고 `figures` 필드를 **추가(optional)**하는 방식임을 명시.
<!-- NOTE: 수용 -->
---

### [CONSIDER] AI 생성 도형(Task 10)이 같은 Phase에 포함됨 — 검증 없이 구현하는 리스크

**위치**: PLAN 섹션 4 Task 10

**배경**: Task 6(AI 추출 프롬프트)와 Task 10(AI 생성 프롬프트) 모두 실제 Gemini API를 호출해야만 JSON 도형 출력의 품질을 확인할 수 있다. AI 생성 도형은 추출보다 더 어려운 과제다 — AI가 좌표를 직접 창작해야 하기 때문.

**고려사항**: Task 10을 이번 Phase에서 "프롬프트 + Zod 스키마 변경만" 구현하고, 실제 출력 품질 검증은 별도로 진행하는 것이 타당하다. PLAN에서 이미 68개 테스트 중 AI 프롬프트 파싱 테스트(~8개)는 Mock 기반으로 계획되어 있어 실제 API 호출 없이 구조 검증만 한다. 이 접근이 맞다면 PLAN에 명시적으로 "Task 10은 프롬프트 구조 검증만, 출력 품질은 E2E/수동 확인"이라고 기재하는 것이 좋다.
<!-- NOTE: 수용 -->
---

### [CONSIDER] 7-10일 추정 — Wave 3 SVG 렌더러 5개 파일이 낙관적으로 추정됨

**위치**: PLAN 섹션 11 작업량 추정

**근거**: Wave 3에서 `coordinate-plane.tsx`, `function-graph.tsx`, `polygon.tsx`, `circle-shape.tsx`, `vector-arrow.tsx` 5개 신규 SVG 컴포넌트를 2-3일에 완성하는 것은 낙관적이다. 각 컴포넌트는 viewBox 계산, 눈금(tick), 화살표 마커, 레이블 배치 등 수학 도메인 지식이 필요한 SVG 구현이다.

특히 `function_graph`는 `coordinate_plane`을 내부적으로 합성하는 구조라 시각적 버그 디버깅 비용이 높다.

**위험 시나리오**: Wave 3가 5일 이상 소요될 경우 전체 일정이 12-15일로 늘어날 수 있다.

**완화 방향**: 리서치가 제안한 "수직선 먼저, 좌표평면 다음, 기하도형 마지막" 단계적 구현 순서를 Wave 3 내에서 명시적으로 구분하면, 중간 성과물 확인이 가능하여 일정 리스크를 낮출 수 있다.
<!-- NOTE: 수용 -->
---

## 범위 분석

### 필수 범위 (이번 Phase에 반드시)

| Task | 이유 |
|------|------|
| Task 1 (DB 마이그레이션) | 단계 2 PDF 출력의 전제 조건. `questions` 테이블 확장 없이는 생성 문제에 도형 불가 |
| Task 2 (Zod 스키마) | 모든 하위 Task의 공통 타입 기반. 없으면 병렬 구현 불가 |
| Task 3 (FigureRenderer 기본 + description 폴백) | `{{fig:N}}` 플레이스홀더를 화면에 표시하는 최소 기능 |
| Task 4 (LatexRenderer figure 케이스 업데이트) | FigureRenderer를 실제 렌더링 파이프라인에 연결 |
| Task 5 (SVG 유틸 + number_line) | 공통 유틸 없이는 Wave 3 병렬 SVG 구현 불가 |
| Task 6 (AI 추출 프롬프트) | 기출 추출 시 `{{fig:N}}` 삽입 지시 — 데이터 생성의 핵심 |
| Task 7~8 (SVG 렌더러) | 실제 도형 표시. description 폴백만으로는 사용자 가치 없음 |
| Task 11 (테스트) | 80%+ 커버리지 요구사항, 회귀 방지 |

### 미룰 수 있는 범위 (다음 Phase로 연기 가능)

| Task/기능 | 연기 근거 |
|----------|----------|
| Task 9 (연속 도형 수평 배치) | 단일 도형 렌더링이 먼저. 연속 배치는 UX 개선이므로 Phase 2d로 연기 가능. description 폴백으로 동작 유지됨 |
| Task 10 (AI 생성 프롬프트 도형) | AI 추출 도형(Task 6)이 먼저 검증되어야 생성 프롬프트 품질 기준이 잡힘. 그러나 PLAN에서 Zod 스키마 변경만이므로 구현 비용이 낮아 포함은 합리적 |
| 통계 차트(Recharts), 인터랙티브(Mafs) | 리서치에서 Phase 3 선택 사항으로 명시됨. 현재 PLAN에서 제외되어 있어 적절 |

---

## 결론

**READY** — 단, 아래 1건은 Wave 시작 전 수정 권고.

**수정 필요**:

1. **[MUST FIX] Task 11 의존성 충돌**: Wave 4를 4a(Task 9, 10 병렬)와 4b(Task 11 직렬)로 분리하거나, Task 11을 Wave 5로 독립시켜야 한다. 에이전트가 Task 9, 10과 동시에 테스트를 작성하려 하면 미완성 코드를 대상으로 테스트가 작성될 위험이 있다.

2. **[MUST FIX] Task 9 병렬 가능 여부 명시**: `latex-renderer.tsx` 충돌이 Task 9(Wave 4)와 Task 10(Wave 4)이 실제로 다른 파일을 건드리므로 충돌은 없으나, PLAN 문서 자체에서 혼동을 줄이려면 한 문장으로 명시 필요.

**권장 수정(구현 중 처리 가능)**:

- [SHOULD FIX] 선택지 도형 구현 방식(타입 변경 없음)을 PLAN에 1문장 명시
- [SHOULD FIX] Wave 3 내 단계 출시 기준(number_line + coordinate_plane = MVP) 명시
- [SHOULD FIX] Task 6 `FigureInfo` 타입 변경 영향 범위 확인 체크리스트 추가

핵심 설계(JSON 스키마 + 커스텀 SVG, `{{fig:N}}` 구분자, `displaySize`)는 리서치와 완전히 일치하며 YAGNI 위반 없음. Task 분해와 파일 소유권도 명확. Wave 구조 문서 수정 1건만 해결하면 구현 진행 가능하다.
