# Detail Technical Review: 도형 렌더링 상세 PLAN

> 리뷰어: technical-reviewer
> 리뷰 일자: 2026-03-23
> 검토 대상: `docs/plan/figure-rendering-detail.md`
> 기준 PLAN: `docs/plan/figure-rendering.md` (v2)

---

## 검토 결과 요약

| 심각도 | 건수 |
|--------|------|
| MUST FIX | 3 |
| SHOULD FIX | 4 |
| CONSIDER | 3 |

---

## 이슈 목록

### [MUST FIX 1] Task 6 교차 검증 — 타입 불일치로 컴파일 에러 발생

**위치**: 상세 PLAN Wave 2, Task 6, Step 2

**문제**: `validateFigureIndices` 함수 시그니처는 `FigureData[] | undefined`를 받도록 설계(Task 2 정의)되어 있으나, `extraction-validation.ts`에서 전달하는 값은 `FigureInfo[]` 타입이다. `FigureInfo`에는 `type` discriminator 필드가 없으므로 TypeScript 컴파일 에러가 발생한다.

**실제 코드 확인** (`extraction-validation.ts` 99-106줄):
```typescript
figures: q.figures?.map((f) => ({
  url: null,
  description: f.description,
  boundingBox: f.boundingBox,
  pageNumber: f.pageNumber,
  confidence: f.confidence,
})),
```
`q.figures`는 `figureInfoSchema[]` 타입 — `FigureData` discriminated union과 구조가 완전히 다름.

**PLAN의 임시 해결 시도** (Task 6 Step 2 주석):
> "figures.length만 확인하는 별도 헬퍼 함수 사용 또는 validateFigureIndices 오버로드 고려"

이 부분이 명확히 결정되지 않아 에이전트가 임의 구현할 위험이 있다.

**수정 방향**: `validateFigureIndices`를 figures 길이만 받는 별도 내부 함수(`validateFigureIndexRange(questionText: string, figuresCount: number): string[]`)로 분리하거나, 기존 함수에 `figuresCount: number` 오버로드를 추가하는 방향 중 하나를 명시적으로 결정해야 한다. Task 6 Step 2에 구체적 구현 방식이 확정되어야 에이전트가 올바르게 구현할 수 있다.

---

### [MUST FIX 2] Task 4 — `renderSegment` 함수 이동 방식이 기존 코드 구조와 충돌

**위치**: 상세 PLAN Wave 2, Task 4, Step 2~3

**문제**: PLAN은 "`renderSegment`를 LatexRenderer 컴포넌트 내부로 이동하여 `figures`에 클로저로 접근"을 지시하고 있다. 그런데 현재 `renderSegment`는 모듈 레벨 함수로, `LatexRenderer` 컴포넌트 **내부에서** 정의하면 매 렌더링마다 함수가 재생성되어 `React.memo`의 최적화가 무력화된다.

**실제 기존 코드** (`latex-renderer.tsx` 52줄):
```typescript
function renderSegment(segment: LatexSegment, index: number): React.ReactNode {
  // 모듈 레벨 — 컴포넌트 외부에 정의됨
}
```

**올바른 대안**:
1. `figures`를 컴포넌트 내부에서 `useCallback`으로 메모이제이션한 render 함수로 만들기
2. `figures`를 `renderSegment`의 추가 매개변수로 전달: `renderSegment(segment, index, figures)`

PLAN이 "클로저로 접근"을 지시함으로써 에이전트가 성능 문제가 있는 구현을 선택할 위험이 있다. 올바른 구현 방식을 명시해야 한다.
<!-- NOTE: 1 적용 -->
---

### [MUST FIX 3] Task 7 — function_graph의 CoordinatePlane 합성 방식이 구현 불가

**위치**: 상세 PLAN Wave 3, Task 7, Step 2

**문제**: PLAN은 두 가지 방법을 제시하고 "방법 a 선택: CoordinatePlane Props를 받아 내부 렌더링, polyline 추가"라고 명시하고 있다. 그러나 SVG에서 두 개의 독립된 `<svg>` 엘리먼트를 겹쳐 렌더링하는 것은 표준 HTML 레이아웃으로는 불가능하다 (각각 독립 뷰포트를 가짐).

**실제 구현 시 발생하는 문제**: `<CoordinatePlane>` 컴포넌트는 자체적으로 완결된 `<svg>` 엘리먼트를 반환한다. `<FunctionGraph>` 안에서 `<CoordinatePlane>`을 렌더링하면 별도 SVG가 생기고, polyline은 다른 SVG에 추가되어 시각적 합성이 되지 않는다.

**올바른 구현**: `coordinate-plane.tsx`에서 SVG 내부 엘리먼트들(그리드, 축, 눈금)을 렌더링하는 내부 함수 또는 컴포넌트(`CoordinatePlaneContent`)를 분리하여, `function-graph.tsx`가 단일 `<svg>` 안에 `CoordinatePlaneContent` + `<polyline>`을 함께 렌더링하도록 해야 한다. 이 구조 변경이 Task 7에 명시되어야 한다.
<!-- NOTE: 적용 -->
---

### [SHOULD FIX 1] Task 5 — `ARROWHEAD_MARKER_ID` 단일 값이 여러 SVG에서 충돌

**위치**: 상세 PLAN Wave 2, Task 5, Step 1

**문제**: `svg-utils.ts`에서 `ARROWHEAD_MARKER_ID = 'arrowhead'`를 상수로 정의하고, `vector-arrow.tsx`와 `function-graph.tsx`(축 화살표)에서 동일한 ID를 사용한다. 하나의 페이지에 여러 도형이 렌더링될 경우 `<defs>`의 `<marker id="arrowhead">`가 DOM에 중복 등록되어 CSS cascade에 의해 마지막 정의가 모든 화살표에 적용되는 문제가 발생할 수 있다 (특히 각 SVG가 독립적이므로 실제로는 각 SVG 내부에서만 참조되어 문제없을 수 있으나, 주의사항으로 명시 필요).

**수정 방향**: 각 SVG 컴포넌트가 독립 `<svg>` 엘리먼트이므로 ID 충돌은 실제로 발생하지 않는다. 단, PLAN에서 에이전트에게 "각 SVG 내부에 `<defs>` 포함" 패턴을 명시하지 않아 에이전트가 전역 `<defs>`를 별도 컴포넌트로 분리하려 시도할 수 있다. Task 5와 Task 8에 "각 SVG 컴포넌트는 자체 `<defs>`를 포함한다"라고 명확히 명시해야 한다.
<!-- NOTE: 적용 -->
---

### [SHOULD FIX 2] Task 9 — 선택지 렌더링 컴포넌트 파일명 미지정

**위치**: 상세 PLAN Wave 4, Task 9, Step 2

**문제**: "선택지 렌더링 컴포넌트에서 `<LatexRenderer text={option} figures={figures} />`로 호출" 지시가 있으나, 수정할 실제 파일명이 명시되어 있지 않다. "선택지 렌더링 컴포넌트 파일을 먼저 확인하여 LatexRenderer 호출 위치 파악"이라고만 되어 있어 에이전트가 탐색에 시간을 소비하거나 잘못된 파일을 수정할 수 있다.

**수정 방향**: 기존 선택지 렌더링 코드가 어떤 파일에 있는지 확인하여 PLAN에 파일 경로를 명시해야 한다. 파일 소유권 테이블(섹션 6)에도 해당 파일이 누락되어 있다.
<!-- NOTE: 적용 -->
---

### [SHOULD FIX 3] Task 10a — `questionsJsonSchema` 재생성 가정의 위험성

**위치**: 상세 PLAN Wave 4, Task 10a, Step 1

**문제**: PLAN은 "`questionsJsonSchema`는 `generatedQuestionsResponseSchema.toJSONSchema()`로 자동 재생성됨"이라고 설명하고 있다. 실제 코드를 확인한 결과 (`validation.ts` 42줄):

```typescript
export const questionsJsonSchema = generatedQuestionsResponseSchema.toJSONSchema()
```

이것은 모듈 초기화 시 **한 번만** 실행되는 상수다. `generatedQuestionsResponseSchema`에 `figureDataSchema`가 추가되면 `questionsJsonSchema`도 자동으로 포함된다. 이 부분은 맞다.

그러나 문제는 Zod의 `toJSONSchema()`가 discriminated union을 변환할 때 Gemini API가 지원하는 형식(`anyOf` / `oneOf`)을 올바르게 생성하는지 보장되지 않는다는 점이다. 특히 Gemini의 `responseSchema`는 OpenAPI 3.0 형식을 따르므로 Zod가 생성하는 JSON Schema와 차이가 있을 수 있다. PLAN에 "Gemini 호환성 검증" 단계가 없다.

**수정 방향**: Task 10a 완료 후 실제 Gemini API 호출 테스트(E2E 또는 수동 테스트)로 JSON Schema가 올바르게 동작하는지 확인하는 단계를 추가해야 한다.
<!-- NOTE: 적용 -->
---

### [SHOULD FIX 4] Task 3 — FigureRenderer의 `className` prop 전달 누락 가능성

**위치**: 상세 PLAN Wave 1, Task 3

**문제**: Task 3에서 `FigureRenderer` Props를 `{ figure: FigureData; className?: string }`로 정의하고, Task 4에서 `<FigureRenderer figure={figure} />`로 호출한다 (className 미전달). Task 5에서는 `<NumberLine figure={figure} className={className} />`으로 className을 전달한다. 그런데 `FigureRenderer`에서 `NumberLine`으로 className을 내려줄 때 어떻게 처리하는지 명시되지 않았다.

Step 3 코드 스니펫:
```tsx
case 'number_line':
  return <NumberLine figure={figure} className={className} />
```

`className`이 `FigureRenderer`로 전달되지 않으면 `NumberLine`에도 전달되지 않아 외부 스타일링이 불가능하다. Task 4의 호출부에서 className 전달 여부와, LatexRenderer의 래퍼 div/span에서 className을 어디서 제어하는지 일관성을 명시해야 한다.
<!-- NOTE: 적용 -->
---

### [CONSIDER 1] Task 2 — `validateFigureIndices`가 `options` 배열의 도형 참조를 검증하지 않음

**위치**: 상세 PLAN Wave 1, Task 2, Step 2

`validateFigureIndices`는 `questionText`에 있는 `{{fig:N}}` 참조만 검증한다. 선택지(`options[i]`) 안에 `{{fig:N}}`이 있는 경우는 검증하지 않는다. MVP 범위에서 선택지 내 도형이 지원될 예정(Task 9)이므로, 이 경우 인덱스 불일치가 감지되지 않을 수 있다.

검증 범위를 `options` 배열까지 확대하거나, MVP 단계에서는 의도적으로 생략한다는 주석을 PLAN에 추가하는 것을 고려한다.

---

### [CONSIDER 2] 사전 작업 (리드 선행) — Wave 1과 병렬 실행 가능성 명시

**위치**: 상세 PLAN 사전 작업 섹션

현재 PLAN은 사전 작업(types.ts FigureData 추가)이 "Wave 2 시작 전"에 완료되어야 한다고 명시하고 있다. 그러나 Task 1(DB 마이그레이션)과 Task 2(Zod 스키마)는 types.ts에 의존하지 않으므로, Wave 1과 사전 작업을 병렬로 진행할 수 있다. 이를 명시하면 전체 일정을 단축할 수 있다.
<!-- NOTE: 적용 -->
---

### [CONSIDER 3] Task 11 — 테스트 환경에서 KaTeX CSS import 충돌

**위치**: 상세 PLAN Wave 5, Task 11

`latex-renderer.tsx`는 파일 상단에 `import 'katex/dist/katex.min.css'`가 있다 (실제 파일 1줄). vitest의 jsdom 환경에서 CSS import는 기본적으로 오류를 발생시키거나 무시된다. 기존 `latex-renderer` 테스트가 이미 이 문제를 해결했을 가능성이 높지만, `latex-renderer-figure.test.tsx`에서 동일한 컴포넌트를 테스트할 때 CSS import 처리 방식을 명시하는 것이 좋다.

기존 테스트 파일(`src/components/ui/__tests__/`)의 vitest 설정 또는 mock 패턴을 참조하도록 에이전트 가이드에 추가하는 것을 고려한다.
<!-- NOTE: 적용 -->
---

## Plan Review Completion Checklist 검토

| 항목 | 판정 | 비고 |
|------|------|------|
| 모든 Task의 파일 소유권이 명확하다 | ⚠️ 조건부 | Task 9 Step 2의 선택지 컴포넌트 파일명 누락 |
| Task 간 의존성 순서가 정의되었다 | ✅ | Wave 구조 명확 |
| 외부 의존성(라이브러리, API)이 명시되었다 | ✅ | 0개 (순수 SVG JSX) |
| 에러 처리 방식이 정해졌다 | ✅ | 폴백/경고 전략 명확 |
| 테스트 전략이 있다 | ✅ | ~68개 케이스 상세 명세 |
| 이전 Phase 회고 교훈이 반영되었다 | ✅ | MEMORY.md 교훈 전반적으로 반영 |
| 병렬 구현 시 파일 충돌 가능성이 없다 | ✅ | Wave별 파일 분리 확인 |

---

## 결론: BLOCKED

**MUST FIX 3건이 구현 단계에서 컴파일 에러 또는 렌더링 오류를 유발한다:**

1. **MUST FIX 1**: `validateFigureIndices`의 타입 불일치 — Task 6 에이전트가 구현 방식을 확정하지 않으면 TypeScript 컴파일 에러 발생
2. **MUST FIX 2**: `renderSegment` 클로저 이동 — 성능 문제 또는 잘못된 구현 패턴으로 이어질 수 있음
3. **MUST FIX 3**: function_graph의 CoordinatePlane 합성 — 독립 SVG 두 개를 겹치는 방식은 불가능. 내부 컴포넌트 분리 구조로 Task 7을 수정해야 함

MUST FIX 3건 수정 후 SHOULD FIX를 검토하여 재판정을 요청한다.
