# Technical Review: 도형 렌더링 PLAN v1

> 리뷰어: technical-reviewer
> 리뷰 일자: 2026-03-23
> 검토 대상: `docs/plan/figure-rendering.md`

---

## 이슈 목록

### [MUST FIX] `FigureData` 타입이 `FigureInfo`와 혼용 — `src/lib/ai/types.ts` 수정 범위 불명확

**설명**

현재 `src/lib/ai/types.ts`의 `FigureInfo` 인터페이스는 기출 추출 전용 타입이다:

```typescript
// 현재 FigureInfo (types.ts:114)
export interface FigureInfo {
  readonly url: string | null       // Storage 경로 (crop 후)
  readonly description: string
  readonly boundingBox: { x, y, width, height }  // normalized 0~1
  readonly pageNumber: number
  readonly confidence: number
}

// ExtractedQuestion (types.ts:128)
export interface ExtractedQuestion {
  readonly hasFigure: boolean
  readonly figures?: readonly FigureInfo[]  // 기출 추출 전용 구조
}
```

PLAN의 Task 6은 "FigureInfo 타입 업데이트 — 리드 승인 필요"라고만 명시하고, 새 `FigureData` (6타입 discriminated union)와 기존 `FigureInfo` (boundingBox + pageNumber + confidence)의 관계를 명확히 정의하지 않는다.

**문제**

- `past_exam_details.figures` JSONB는 현재 `FigureInfo[]` 구조(boundingBox 포함)를 저장 중
- `questions.figures` JSONB는 신규 `FigureData[]` 구조(coordinate_plane 등 SVG 스키마)를 저장 예정
- 두 타입이 완전히 다른 구조임에도 PLAN은 `FigureInfo`를 "업데이트"한다고 표현 → 기존 기출 추출 코드(`extraction-validation.ts`, `figureInfoSchema`)와 충돌 가능성

**근거**

`extraction-validation.ts:26`의 `figureInfoSchema`와 PLAN의 `FigureData` Zod 스키마(Task 2)는 전혀 다른 구조다. 동일 타입명으로 병합하면 기출 추출 흐름이 TypeScript 타입 에러를 발생시킨다.

**수정 제안**

- `FigureInfo` (기존) → 기출 추출용으로 유지 (변경 금지)
- `FigureData` (신규) → `src/lib/ai/types.ts`에 별도 타입으로 추가
- PLAN에 "FigureInfo는 변경하지 않음. FigureData를 신규 타입으로 추가"로 명시
<!-- NOTE: 수용 -->
---

### [MUST FIX] `GeneratedQuestion` 타입에 `hasFigure/figures` 추가 시 기존 저장 Action과 충돌

**설명**

Task 10에서 `GeneratedQuestion` 타입에 `hasFigure`, `figures` 필드를 추가한다고 계획한다.

**문제**

`src/lib/actions/save-questions.ts`와 `src/lib/validations/save-questions.ts`는 현재 `questionToSaveSchema`에 figure 관련 필드가 없다:

```typescript
// save-questions.ts:22 — 현재 스키마
export const questionToSaveSchema = z.object({
  content: z.string().min(1),
  type: z.enum(['multiple_choice', 'short_answer', 'essay']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  answer: z.string().min(1),
  explanation: z.string().optional(),
  options: z.array(z.string()).optional(),
  // hasFigure, figures 없음!
})
```

`GeneratedQuestion`에 새 필드를 추가하면 `saveQuestionsRequestSchema` 내부에서 타입 불일치가 발생하고, DB INSERT 시 `has_figure`, `figures` 컬럼에 데이터가 저장되지 않는다.

**근거**

`src/lib/actions/save-questions.ts`의 DB INSERT 부분에서 `questionToSaveSchema`에서 파싱된 데이터를 그대로 사용하므로, 스키마에 없는 필드는 DB에 저장되지 않는다.

**수정 제안**

Task 10 범위를 명확히 확장:
- `src/lib/validations/save-questions.ts`의 `questionToSaveSchema`에 `hasFigure: z.boolean().optional()`, `figures: z.array(figureDataSchema).optional()` 추가
- `src/lib/actions/save-questions.ts`의 DB INSERT에 `has_figure`, `figures` 컬럼 포함
- 해당 파일은 현재 소유자 미지정 → PLAN 파일 소유권 테이블에 추가 필요
<!-- NOTE: 수용 -->
---

### [MUST FIX] `LatexSegment`의 `figure` 세그먼트에 이미 `display: 'block' | 'inline'` 필드 존재 — PLAN과 불일치

**설명**

PLAN Task 4는 `LatexRenderer`의 `renderSegment` figure 케이스에서 `displaySize` (FigureData 내부 필드)를 사용하여 블록/인라인 결정을 계획한다.

그러나 현재 `src/lib/utils/latex-parser.ts`의 `LatexSegment` 타입은 이미 `display: 'block' | 'inline'` 필드를 보유한다:

```typescript
// latex-parser.ts:19
| { type: 'figure'; index: number; display: 'block' | 'inline' }
```

파서는 `{{fig:N}}`의 앞뒤 문자(`\n` 여부)로 `display`를 자동 판단한다.

**문제**

렌더링 시 두 가지 레이아웃 결정 신호가 존재한다:
1. 파서의 `segment.display` (텍스트 컨텍스트 기반)
2. `FigureData.displaySize` (AI가 도형 자체에 설정한 힌트)

어느 것을 우선할지 PLAN이 정의하지 않는다. 두 값이 충돌할 때(예: AI가 `displaySize: 'large'`로 설정했지만 파서가 `display: 'inline'`으로 판단) 어떻게 처리할지 명세 없음.

**수정 제안**

우선순위 정책을 PLAN에 명시:
- 제안: `segment.display`(파서 판단) 우선 → 이미 구현된 `determineFigureDisplay` 로직 재활용, `displaySize`는 SVG 크기 힌트로만 사용
- 또는: `FigureData.displaySize` 우선 → 파서의 `display` 필드 제거 고려
<!-- NOTE: 수용 -->
---

### [SHOULD FIX] `vector` 타입의 `from !== to` 검증이 JavaScript 참조 비교로는 불가능

**설명**

PLAN Task 2에서 vector 타입 검증:
```
- `vector`: `from !== to` (제로 벡터 방지)
```

`from`과 `to`는 모두 `[number, number]` 배열이다. JavaScript에서 `[0,0] !== [0,0]`는 항상 `true`(참조 비교)이므로 이 검증은 제로 벡터를 차단하지 못한다.

**수정 제안**

Zod `.refine()`으로 좌표값을 직접 비교:

```typescript
z.object({
  type: z.literal('vector'),
  from: z.tuple([z.number(), z.number()]),
  to: z.tuple([z.number(), z.number()]),
  // ...
}).refine(
  (v) => v.from[0] !== v.to[0] || v.from[1] !== v.to[1],
  { message: '벡터의 시작점과 끝점이 동일합니다 (제로 벡터)' }
)
```
<!-- NOTE: 수용 -->
---

### [SHOULD FIX] `function_graph` 타입에 coordinate_plane 참조가 없을 때 viewBox 기준 모호

**설명**

PLAN Task 7에서 `function_graph.tsx`는 `coordinate_plane`을 "내부적으로 사용(합성)"한다고 명시하지만, `FigureData` 타입의 `function_graph`는 독립 타입으로 정의되어 있다:

```typescript
{ type: 'function_graph'; points: [number, number][]; domain: [number, number]; color?: string; displaySize; description }
```

`function_graph`에는 `xRange`, `yRange`, `gridStep`이 없다. coordinate_plane을 내부적으로 합성할 때 좌표축 범위를 어떻게 결정할지 미정의다.

**문제**

- `points` 배열에서 x/y 범위를 자동 추론하면 축 단위가 불규칙해진다
- AI가 points를 생성할 때 좌표축 정보가 없으므로 불필요하게 좌표값이 과도하거나 과소할 수 있다

**수정 제안**

두 가지 옵션 중 선택:
- **옵션 A**: `function_graph` 타입에 `xRange`, `yRange`, `gridStep` 필드 추가 (좌표축 명시)
- **옵션 B**: `function_graph`는 coordinate_plane을 포함하지 않고 순수 polyline만 렌더링 (더 단순)
<!-- NOTE: 옵션 A 수용 -->
---

### [SHOULD FIX] Task 9와 Task 4가 동일 파일(`latex-renderer.tsx`) 수정 — Wave 경계 명세 부족

**설명**

PLAN 파일 소유권 테이블에서 `latex-renderer.tsx`가 Wave 2와 Wave 4 양쪽에 표시된다:

```
| `src/components/ui/latex-renderer.tsx` | frontend-ui | 2, 4 |
```

PLAN 섹션 9("Task 9")는 Wave 4에서 "연속 figure 세그먼트 감지" 로직을 이 파일에 추가한다.

**문제**

Wave 2(Task 4)에서 `figures?: FigureData[]` prop을 추가하고, Wave 4(Task 9)에서 연속 figure 감지 로직을 추가할 때, 두 Wave 사이에 `latex-renderer.tsx`를 다른 에이전트가 건드릴 경우 충돌 가능. PLAN 리스크 섹션에 "LOW"로 표시되어 있지만, 직렬 처리를 명확히 강제하는 문구가 없다.

**수정 제안**

에이전트 프롬프트에 "Wave 2 Task 4 완료 + 빌드 통과 확인 후에만 Wave 4 Task 9 시작"을 명시한다.
<!-- NOTE: 수용 -->
---

### [SHOULD FIX] `past_exam_details.figures` JSONB 기존 데이터 구조와 신규 `FigureData` 구조가 다름

**설명**

`past_exam_details.figures` JSONB는 현재 `FigureInfo[]` (description + boundingBox + pageNumber + confidence)를 저장하고 있다. PLAN은 `questions.figures`에 `FigureData[]` (type + 좌표 데이터)를 저장하는 계획이다.

**문제**

`LatexRenderer`에 `figures?: FigureData[]`를 추가하면, 기출 추출 문제 상세 페이지에서 `past_exam_details.figures`를 `FigureData[]`로 타입 캐스팅하려 할 때 런타임 에러가 발생할 수 있다. PLAN은 `past_exam_details`의 figure 처리 방식을 다루지 않는다.

**수정 제안**

PLAN에 명시:
- `LatexRenderer`의 `figures` prop 타입을 `FigureData[] | FigureInfo[]`의 공용체로 할지, 아니면 `past_exam_details`는 별도 렌더링 경로를 유지할지 결정 필요
- 가장 단순한 방법: `past_exam_details` 페이지에서 `LatexRenderer`에 `figures`를 전달하지 않고 기존 플레이스홀더 유지 (하위 호환 보장, Task 4의 `figures` 없을 때 기존 `[도형 N]` 유지 로직 활용)
<!-- NOTE: 수용 -->
---

### [CONSIDER] `coordinate_plane` 타입에 도형 오버레이 방식 미정의

**설명**

PLAN Task 8에서 `polygon`, `circle`, `vector`는 "coordinate_plane 위에 오버레이 가능"하다고 명시하지만, 데이터 구조적으로는 각각 독립 `FigureData` 항목이다. 어떻게 "같은 coordinate_plane 위에 겹쳐 그릴지"가 불명확하다.

예: figures[0]=coordinate_plane, figures[1]=polygon일 때, `{{fig:0}}{{fig:1}}`로 연속 도형 수평 배치하면 도형들이 합성되지 않고 나란히 표시된다.

**수고 제안**

MVP 범위에서는 합성 렌더링을 미구현으로 명시하고, 각 도형은 독립 SVG로 렌더링함을 PLAN에 추가한다. 필요 시 Phase 3에서 composite 타입 도입을 고려한다.
<!-- NOTE: 수용 -->
---

### [CONSIDER] Gemini Structured Output 토큰 비용 — `points` 배열이 많을 때

**설명**

`function_graph`의 `points: [number, number][]`는 AI가 샘플 포인트를 직접 출력한다. 복잡한 함수(sin, 포물선 등)를 충분한 정밀도로 표현하려면 50-100개 포인트가 필요할 수 있고, 문제 1개당 토큰 소비가 크게 증가한다.

**수정 제안**

AI 프롬프트에 최대 포인트 수를 명시 (예: "최대 20개 포인트"). Zod 스키마에 `points: z.array(...).max(50)` 제한 추가 고려.
<!-- NOTE: 수용 -->
---

### [CONSIDER] `displaySize` 기본값 폴백 처리와 Zod 스키마의 관계

**설명**

PLAN 에러 처리 테이블:
```
| displaySize 누락 | 기본값 'large' |
```

그런데 Task 2의 Zod 스키마에 `displaySize: z.enum(['large', 'small'])` (기본값 없음)으로 정의할 경우, AI가 필드를 생략하면 Zod 검증 자체가 실패한다.

**수정 제안**

`displaySize: z.enum(['large', 'small']).default('large')`로 Zod 스키마에서 기본값을 처리하도록 명시.
<!-- NOTE: 수용 -->
---

## 리서치 일치도

### math-figures-recommendation.md와의 일치

| 항목 | 리서치 | PLAN | 일치 여부 |
|------|--------|------|-----------|
| 렌더링 방식 | JSON 스키마 + 커스텀 SVG | 동일 | ✅ |
| AI SVG 직접 생성 금지 | 명시 | 동일 | ✅ |
| eval 회피 (points 배열) | 명시 | 동일 | ✅ |
| 외부 라이브러리 0개 | 명시 | 동일 | ✅ |
| 선택지 도형 | Phase 3으로 미룸 | **MVP에 포함** (Task 9) | ⚠️ 불일치 |
| 통계 차트 (Recharts) | Phase 3 선택 | 미언급 | 미해당 |

**선택지 도형 불일치 설명**

리서치 추천안은 "선택지 내 도형 타입 변경 → Phase 3으로 미룸"을 주요 리스크로 명시하고 YAGNI로 보류 권장했다. PLAN은 Task 9에서 선택지 도형을 MVP로 포함했다. 이 결정 자체가 틀린 것은 아니지만, PLAN에 명시적 근거("options 타입은 string[]로 유지하고 {{fig:N}} 구분자로 처리하므로 기존 코드 전수 수정 불필요")가 없다. scope-reviewer 또는 사용자 의사결정이 필요하다.

### figure-placement-recommendation.md(v2)와의 일치

| 항목 | 리서치(v2) | PLAN | 일치 여부 |
|------|-----------|------|-----------|
| `{{fig:N}}` 구분자 통일 | 명시 | 동일 | ✅ |
| block_before/after 제거 | 명시 | 동일 | ✅ |
| `displaySize` 렌더링 힌트 | 명시 | 동일 | ✅ |
| 연속 도형 flex 수평 배치 | 명시 | Task 9에서 구현 | ✅ |
| LaTeX 파서 +8줄 | "LaTeX PLAN과 동시" | 현재 파서에 이미 구현됨 ✅ | ✅ 완료 |
| `segment.display: 'block'\|'inline'` | 명시 | **PLAN에 미반영** | ⚠️ |

**`segment.display` 미반영 설명**

리서치 v2는 파서에 `display: 'block' | 'inline'` 필드를 추가하는 내용을 포함한다. 실제로 `latex-parser.ts`에 이미 `determineFigureDisplay` 함수와 `display` 필드가 구현되어 있다. PLAN Task 4는 이 기존 `display` 필드를 언급하지 않고 `FigureData.displaySize`만 다루므로, 렌더링 로직 구현 시 혼란이 발생할 수 있다 (위 MUST FIX 3번 이슈 참조).

---

## Plan Review Completion Checklist 평가

| 항목 | 상태 | 비고 |
|------|------|------|
| 모든 Task의 파일 소유권 명확 | ⚠️ 부분 | `save-questions.ts`, `save-questions.ts(validation)` 미포함 |
| Task 간 의존성 순서 정의 | ✅ | Wave 구조로 명확 |
| 외부 의존성 명시 | ✅ | 0개 (순수 SVG JSX) |
| 에러 처리 방식 정해짐 | ⚠️ 부분 | `displaySize` 기본값 Zod 처리 미정의 |
| 테스트 전략 있음 | ✅ | ~68개 케이스 |
| 이전 Phase 회고 교훈 반영 | ✅ | academy_id 필터, 빌드 체크 등 명시 |
| 병렬 구현 파일 충돌 없음 | ✅ | latex-renderer.tsx 직렬 명시 |

---

## 결론

**BLOCKED**

MUST FIX 이슈 3개가 구현 시 런타임 오류 또는 TypeScript 컴파일 에러를 유발할 가능성이 높다:

1. **`FigureInfo` vs `FigureData` 타입 충돌** — 기출 추출 기존 코드 파손 위험
2. **`save-questions` Action/Validation 누락** — AI 생성 문제 저장 시 figures DB 미저장
3. **`segment.display` vs `FigureData.displaySize` 우선순위** — 렌더링 레이아웃 결정 로직 충돌

SHOULD FIX 이슈 4개(vector 검증, function_graph viewBox, Wave 경계, past_exam_details 하위 호환)는 구현 중 처리 가능하나 사전 명세가 없으면 에이전트마다 다른 방식으로 구현할 수 있다.

**권장 조치**:
1. PLAN에 `FigureInfo` 불변 + `FigureData` 신규 추가로 명시
2. `save-questions.ts`, `save-questions.ts(validation)` 파일 소유권 테이블에 추가 (Task 10 범위 확장)
3. `segment.display` 우선 / `displaySize`는 SVG 크기 힌트로만 사용하는 정책 명시
