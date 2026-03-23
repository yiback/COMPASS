# Detail Technical Review v2: 도형 렌더링 상세 PLAN v2

> 리뷰어: technical-reviewer
> 리뷰 회차: 3/3 (최종)
> 리뷰 일자: 2026-03-23
> 검토 대상: `docs/plan/figure-rendering-detail.md` (v2)
> 기준 PLAN: `docs/plan/figure-rendering.md` (v2)

---

## v1 이슈 반영 확인

### MUST 1: validateFigureIndices duck typing 시그니처 ✅ 올바르게 반영됨

v1에서 지적한 `FigureInfo[]` vs `FigureData[]` 타입 불일치 문제를 duck typing `{ length: number } | undefined` 시그니처로 해결했다.

- Task 2 Step 2: `validateFigureIndices(questionText: string, figures: { length: number } | undefined): string[]` 시그니처 명시 ✅
- `/g` 플래그 `pattern.lastIndex = 0` 리셋 코드 스니펫 포함 ✅
- Task 6 Step 2: `FigureInfo[]`를 duck typing으로 그대로 전달 가능 명시 ✅
- Task 10a Step 1: `FigureData[]`도 동일 함수로 호출 가능 ✅

**판정**: MUST 1 완전 반영.

---

### MUST 2: renderSegment 클로저 → 매개변수 방식 전환 ✅ 올바르게 반영됨

v1에서 지적한 클로저 이동 시 `React.memo` 무력화 문제를 매개변수 방식으로 해결했다.

- Task 4 Step 2: 모듈 레벨 함수 유지 + `figures: readonly FigureData[] | undefined` 매개변수 추가 방식 명시 ✅
- 코드 스니펫에서 `function renderSegment(segment, index, figures)` 함수 시그니처 확인 ✅
- 에이전트 가이드 금지 사항: "renderSegment를 컴포넌트 내부로 이동 금지" 명시 ✅

**판정**: MUST 2 완전 반영.

---

### MUST 3: Task 7 → 7a/7b 분리 + CoordinatePlaneContent 내부 컴포넌트 분리 ✅ 올바르게 반영됨

v1에서 지적한 두 개의 독립된 `<svg>` 시각 합성 불가 문제를 `CoordinatePlaneContent` 분리로 해결했다.

- Task 7a: `CoordinatePlaneContent` (`<svg>` 없이 `<g>`만 반환) 분리 명시 ✅
- Task 7b: `CoordinatePlaneContent` + `<polyline>`을 단일 `<svg>` 안에 합성 ✅
- 에이전트 가이드 금지 사항: "`CoordinatePlane` 컴포넌트(외부 svg 포함) 임포트 금지" 명시 ✅
- Wave 3a 내부에서 Task 7a 완료 후 Task 7b 시작하는 직렬 순서 명시 ✅

**판정**: MUST 3 완전 반영.

---

### MUST 4: Wave 3a/3b 직렬 분리 ✅ 올바르게 반영됨

v1에서 지적한 `figure-renderer.tsx` 병렬 충돌(Wave 3 내 동시 수정) 문제를 Wave 3a/3b 직렬 분리로 해결했다.

- Wave 3a: coordinate_plane + function_graph (Task 7a → 7b 직렬)
- Wave 3b: Wave 3a 완료 + `npm run build` 통과 확인 후 시작 ✅
- Task 8 Step 4: `figure-renderer.tsx` 연결을 "Wave 3b에서 1회 수정"으로 통합 ✅
- Task 8 내 polygon/circle/vector 신규 파일은 병렬 가능 명시 ✅

**판정**: MUST 4 완전 반영.

---

### SHOULD 5~11 반영 확인 (요약)

| 항목 | 반영 여부 |
|------|----------|
| SHOULD 5: 각 SVG `<defs>` 자체 포함 패턴 | ✅ number-line, coordinate-plane, function-graph, polygon, circle, vector 모두 명시 |
| SHOULD 6: Task 9 선택지 렌더링 파일 경로 명시 | ✅ `question-detail-sheet.tsx` 174줄, `question-card.tsx` 168줄 Grep 확인 결과 포함 |
| SHOULD 7: Task 10a Gemini E2E 수동 검증 단계 | ✅ Task 10a Step 4 추가됨 |
| SHOULD 8: className 전달 체인 명시 | ✅ 각 Task에 `className` prop 요구사항 포함 |
| SHOULD 9: supabase gen types 실행 금지 | ✅ Task 1 에이전트 가이드에 명시 |
| SHOULD 10: 마스터 PLAN Task 10 → 10a/10b 명칭 동기화 NOTE | ✅ Task 10a 상단에 NOTE 포함 |
| SHOULD 11: ROADMAP.md `{{fig:0}}` → `{{fig:1}}` 수정 | 별도 작업으로 처리 (상세 PLAN 범위 외) — 리뷰 대상 아님 |

**판정**: SHOULD 5~10 완전 반영.

---

## 신규 이슈

### [MUST FIX] 없음

v2에서 새로 도입된 변경이 새로운 MUST 수준 문제를 만들지 않았다.

---

### [SHOULD FIX 1] Task 9 Step 2 — `question-detail-sheet.tsx`의 figures 전달 경로 미확인

**위치**: 상세 PLAN Wave 4, Task 9, Step 2

**문제**: PLAN은 `question-detail-sheet.tsx` 174줄 `<LatexRenderer text={option} />`에 `figures` prop을 전달해야 한다고 명시하고 있다. 그런데 이 컴포넌트가 렌더링하는 `detail` 데이터는 `getQuestionDetail` Server Action의 반환값이다.

실제 코드를 확인하면:
- `question-detail-sheet.tsx`의 `getQuestionDetail` 반환 타입 `QuestionDetail`에 `figures` 필드가 **현재 없다**.
- Task 1에서 `questions` 테이블에 `has_figure`, `figures` 컬럼을 추가하고, Task 10b에서 `save-questions` INSERT에 포함하지만, `getQuestionDetail` 쿼리에서 `figures` 컬럼을 SELECT하도록 수정하는 Task가 PLAN에 **없다**.
- `question-detail-sheet.tsx`가 `figures: FigureData[]`를 받으려면 `getQuestionDetail`이 `figures` 컬럼을 SELECT하고 `QuestionDetail` 타입에 `figures?: readonly FigureData[]`가 추가되어야 한다.

**수정 방향**: Task 9 Step 2에 다음 항목을 추가해야 한다:
- `src/lib/actions/questions.ts`의 `getQuestionDetail` 쿼리에 `figures` 컬럼 포함 여부 확인
- `QuestionDetail` 반환 타입에 `figures?: readonly FigureData[]` 추가 여부 결정
- `question-detail-sheet.tsx`에서 `detail.figures`를 `<LatexRenderer>`에 전달하는 props drilling 경로 명시

현재 PLAN은 "상위 컴포넌트에서 figures를 props로 전달받아야 함 — 우선 파일을 열어 현재 컴포넌트 시그니처 확인"이라고만 서술하고 있어 에이전트가 `questions.ts`(backend-actions 소유) 수정이 필요함을 인지하지 못할 수 있다.

---

### [SHOULD FIX 2] Task 10a — `questionsJsonSchema`의 discriminated union 직렬화 호환성 미검증

**위치**: 상세 PLAN Wave 4, Task 10a, Step 1

**문제**: PLAN은 `generatedQuestionsResponseSchema.toJSONSchema()`가 자동으로 재생성되어 Gemini가 새 스키마를 받는다고 서술하고 있다. 그러나 Zod v4의 `discriminatedUnion` → JSON Schema 변환이 Gemini API의 `responseJsonSchema` 필드가 지원하는 JSON Schema 형식과 호환되는지 검증하지 않았다.

Zod v4의 `discriminatedUnion`은 JSON Schema에서 `oneOf` + 각 타입의 `properties.type.const` 형식으로 직렬화된다. Gemini API가 `oneOf`와 `const` 키워드를 지원하지 않으면 스키마 오류가 발생한다.

**실제 영향**: 기존 `generatedQuestionSchema`에 `hasFigure: z.boolean().default(false)`와 `figures: z.array(figureDataSchema).optional()`를 추가할 때, `figureDataSchema`가 `z.discriminatedUnion`으로 구성된 경우 JSON Schema 직렬화 결과가 Gemini가 처리 불가한 형식이 될 수 있다.

**수정 방향**: Task 10a Step 4의 E2E 수동 검증 시 `questionsJsonSchema`를 직접 출력하여 `oneOf` 구조 확인을 첫 번째 검증 항목으로 명시해야 한다. 호환성 문제가 발생할 경우 `figureDataSchema`를 단순 `z.object()`의 flat union으로 작성하거나 Gemini 호환 형태로 변경하는 fallback 경로가 PLAN에 없다. Step 4에 "Gemini가 oneOf/const 키워드를 지원하지 않을 경우 대안: `figureDataSchema`를 flat z.object() + z.discriminatedUnion 대신 z.union() 방식 검토" 항목을 추가하는 것이 안전하다.

---

### [SHOULD FIX 3] Task 9 Step 1 — `groupAdjacentFigures` 함수 위치 및 모듈 레벨 배치 미명시

**위치**: 상세 PLAN Wave 4, Task 9, Step 1

**문제**: PLAN은 `groupAdjacentFigures` 헬퍼 함수를 추가한다고 서술하고 있으나, 이 함수를 모듈 레벨에 배치할지 컴포넌트 내부에 배치할지 명시하지 않았다.

MUST 2에서 `renderSegment`를 모듈 레벨에 유지하는 이유(React.memo 최적화)와 동일한 논리로, `groupAdjacentFigures`도 순수 계산 함수이므로 모듈 레벨에 배치해야 한다. 에이전트가 이를 컴포넌트 내부에 정의하면 매 렌더마다 함수가 재생성된다.

**수정 방향**: Task 9 Step 1 에이전트 가이드 금지 사항에 "`groupAdjacentFigures`를 컴포넌트 내부에 정의 금지 — 모듈 레벨에 배치"를 추가하면 충분하다.

---

### [CONSIDER 1] Task 3 Step 2 — Wave 2 TODO 주석에 `number_line`이 Wave 2 대상임을 혼동 유발

**위치**: 상세 PLAN Wave 1, Task 3, Step 2

**현상**: Task 3의 switch 구조 스니펫에 다음 주석이 있다:
```typescript
case 'number_line':
  // TODO Wave 2: NumberLine 컴포넌트 교체
```
그런데 마스터 PLAN의 Task 5(SVG 유틸 + number_line 렌더러)는 **Wave 2**에 배치되어 있고, 상세 PLAN에서도 Task 5는 Wave 2에서 `FigureRenderer`의 `number_line` case를 교체하는 Step 3을 포함한다. 이는 올바른 내용이다.

그러나 PLAN 전체 Wave 구조상 `coordinate_plane`, `function_graph`는 Wave 3a이므로 주석도 "TODO Wave 3a"로 표기되어야 일관성이 있다. 에이전트 혼란을 최소화하기 위해 Wave 번호를 정확히 표기하는 것이 권장된다.

**영향 수준**: 구현 결과에 영향 없음. 주석 일관성 문제.

---

### [CONSIDER 2] ARROWHEAD_MARKER_ID 상수 — 여러 SVG에서 동일 ID 사용 시 DOM 충돌 가능성

**위치**: 상세 PLAN Wave 2, Task 5, Step 1

**현상**: `svg-utils.ts`에 `export const ARROWHEAD_MARKER_ID = 'arrowhead'` 상수를 정의하고, 각 SVG 컴포넌트가 자체 `<defs>`에 동일 ID `arrowhead`로 마커를 포함하도록 설계하고 있다.

그런데 HTML DOM에서 같은 페이지에 `id="arrowhead"`인 `<defs><marker>` 엘리먼트가 여러 개 존재하면, `url(#arrowhead)` 참조 시 브라우저가 **문서에서 처음 발견된** ID를 사용한다. 각 SVG가 독립적으로 `<defs>`를 보유하는 경우, SVG 스펙상 `url(#id)` 참조는 **해당 SVG 내부**의 `<defs>`를 먼저 찾는다. 따라서 이 경우 충돌은 발생하지 않는다.

**결론**: SVG `url(#id)` 참조가 SVG 내부 스코프를 우선 탐색하는 브라우저 동작이 표준적이므로 현재 설계가 안전하다. 단, 이를 주석으로 SVG 컴포넌트에 명시하면 에이전트가 불필요하게 ID를 UUID로 바꾸는 것을 방지할 수 있다.

**영향 수준**: 현재 설계는 안전함. 주석 보강 권장.

---

## 결론

### 판정: READY

**v1 MUST FIX 4건** 모두 올바르게 반영되었다. v2에서 새로 도입된 변경(Task 7a/7b 분리, Wave 3a/3b 직렬, duck typing 시그니처, 매개변수 방식)은 기존 코드 구조와 정합성이 확인되었다.

신규 이슈 3건은 모두 SHOULD FIX 수준이며, 구현 시 에이전트가 처리할 수 있는 수준이다:

- **SHOULD FIX 1**: `question-detail-sheet.tsx`의 `figures` 전달 경로 — Task 9 시작 시 `getQuestionDetail` 반환 타입 확인 후 처리 가능
- **SHOULD FIX 2**: Gemini discriminated union JSON Schema 호환성 — Task 10a Step 4 E2E 검증 시 발견 및 처리 가능
- **SHOULD FIX 3**: `groupAdjacentFigures` 모듈 레벨 배치 — 에이전트 가이드 한 줄 추가로 해결 가능

CONSIDER 2건은 구현 결과에 영향 없음.

**구현 진행 가능 여부**: READY. PLAN v2는 구현 단계로 이동할 수 있는 수준이다. SHOULD FIX 3건은 구현 에이전트 프롬프트 또는 PLAN 파일에 반영하되, 구현 차단 사유는 아니다.
