# Technical Review v2: 도형 렌더링 PLAN v2

> 리뷰어: technical-reviewer
> 리뷰 일자: 2026-03-23
> 리뷰 회차: 2/3

---

## v1 이슈 반영 확인

### [x] FigureInfo 불변 + FigureData 신규 추가
v2 섹션 2 확정 기술 결정 테이블에 "FigureInfo (기존) 변경 금지"와 "FigureData를 신규 추가"가 명확히 분리되어 기재됨. Task 6 작업 항목에도 "FigureInfo 변경 금지", "FigureData 신규 추가", "FigureInfo 기존 사용처 영향 없음 확인"이 모두 명시됨.

`src/lib/ai/types.ts` 실제 코드 확인: `FigureInfo`(line 114)와 `ExtractedQuestion.figures?: readonly FigureInfo[]`(line 136)는 현재 변경 없이 유지 중. Task 6 수행 시 `FigureData` discriminated union이 같은 파일에 별도 export로 추가될 예정이므로 기존 타입 충돌 없음. **완전 반영.**

### [x] save-questions Action/Validation 범위 확장
Task 10에 `src/lib/validations/save-questions.ts`와 `src/lib/actions/save-questions.ts` 양쪽이 파일 소유권 테이블(섹션 6)에 backend-actions 소유로 명시됨. 작업 내용에 `questionToSaveSchema` 확장과 `toQuestionInsertRow` 함수 확장이 구체적으로 기술됨. **완전 반영.**

### [x] segment.display 우선 / displaySize는 SVG 크기 힌트
섹션 2 확정 기술 결정에 "레이아웃 우선순위: segment.display(파서 판단) 우선"으로 명시. Task 4 작업 항목에 "레이아웃 결정: segment.display === 'block' → div, 'inline' → span 래퍼. displaySize는 FigureRenderer에 prop으로 전달하여 SVG 내부 크기 힌트로만 사용"이라고 구체적으로 기재됨. **완전 반영.**

### [x] vector .refine() 좌표 비교
Task 2 작업 항목에 `Zod .refine((v) => v.from[0] !== v.to[0] || v.from[1] !== v.to[1], { message: '제로 벡터 불가' })` 코드가 직접 명시됨. 배열 참조 비교의 한계를 인지하고 좌표값 직접 비교로 수정됨. **완전 반영.**

### [x] function_graph에 xRange/yRange/gridStep 추가
섹션 3 FigureData 타입 정의에 `function_graph`가 `xRange: [number, number]; yRange: [number, number]; gridStep: number;`를 포함함. Task 7 작업 항목에 "xRange, yRange, gridStep으로 coordinate_plane 내부 합성 + points → SVG polyline 오버레이"로 명시됨. **완전 반영.**

### [x] latex-renderer.tsx Wave 경계 강제
Task 9 작업 항목에 "Wave 4 시작 조건: Wave 2 Task 4 완료 + 빌드 통과 확인 후에만 이 Task 시작"이 명시됨. 섹션 5 Wave 4에도 동일 경고가 기재됨. **완전 반영.**

### [x] past_exam_details 하위 호환
Task 4 작업 항목에 "past_exam_details 하위 호환: past_exam_details 페이지에서는 LatexRenderer에 figures를 전달하지 않음. 기존 FigureInfo[]를 FigureData[]로 캐스팅하지 않으며 플레이스홀더 유지"가 명시됨. **완전 반영.**

---

## 신규 이슈

### [SHOULD FIX] extraction-validation.ts의 `extractedQuestionSchema.figures`가 FigureData로 교체되지 않는 케이스 미처리

**설명**

Task 6 작업 항목에 "`extractedQuestionSchema`에 `figures` 필드를 FigureData Zod 스키마로 교체"라고 명시되어 있다.

그러나 현재 `src/lib/ai/extraction-validation.ts`(line 26-43)의 `figureInfoSchema`는 다음 구조를 갖는다:

```typescript
// extraction-validation.ts:26
export const figureInfoSchema = z.object({
  description: z.string().min(1),
  boundingBox: boundingBoxSchema,
  pageNumber: z.number().int().min(1),
  confidence: z.number().min(0).max(1),
})

// extractedQuestionSchema.figures (line 42):
figures: z.array(figureInfoSchema).optional(),
```

Task 6이 `extractedQuestionSchema.figures`를 `FigureData` Zod 스키마로 교체하면:
1. 기출 추출 흐름에서 Gemini에 전달하는 `extractionJsonSchema`(line 52, `extractionResponseSchema.toJSONSchema()`)가 자동으로 변경된다.
2. Gemini는 변경된 JSON Schema에 따라 기출 이미지에서도 `coordinate_plane`, `polygon` 등 도형 JSON을 출력하려 시도한다.
3. 기출 추출 AI 프롬프트(`question-extraction.ts`)는 boundingBox 기반 crop을 위한 지시를 포함하는데, FigureData 스키마로 변경하면 crop 좌표 정보(boundingBox)를 AI가 더 이상 출력하지 않는다.

**문제**

- 기출 추출(`extractedQuestionSchema`)과 AI 생성(`generatedQuestionSchema`)은 서로 다른 figures 구조를 필요로 한다.
  - 기출 추출: `figureInfoSchema` (boundingBox + crop 좌표) 유지 필요
  - AI 생성: `FigureData` Zod 스키마 (coordinate_plane 등 SVG 데이터) 필요
- Task 6이 `extractedQuestionSchema.figures`를 FigureData로 교체하면 기출 추출 crop 기능이 파손된다.

**근거**

`extraction-validation.ts:52`의 `extractionJsonSchema = extractionResponseSchema.toJSONSchema()`가 Gemini `responseJsonSchema`에 직접 전달된다. 이 스키마를 변경하면 AI 출력 형식이 변경되고 crop에 필요한 boundingBox가 사라진다.

**수정 제안**

Task 6 작업 범위를 재정의:
- `extractedQuestionSchema.figures`는 `figureInfoSchema`(boundingBox 포함)로 유지
- AI 추출 프롬프트 변경 내용: "bounding box → JSON 도형 데이터 + `{{fig:N}}` 구분자"를 `extractedQuestionSchema`에 반영하는 것은 별도 Task 또는 Task 6 내에서 구분하여 처리
- 실질적으로 Task 6의 `extractedQuestionSchema` 수정 대상은 `questionText`에 `{{fig:N}}` 삽입 지시 추가와 `validateExtractedQuestions`의 figures 인덱스 교차 검증만으로 한정
- `figureInfoSchema` 자체는 변경 금지, `figures` 필드 타입도 `figureInfoSchema[]`로 유지

---

### [SHOULD FIX] `validateExtractedQuestions`의 figures 인덱스 교차 검증 로직 — figures 배열 없을 때 오류 가능

**설명**

Task 6에 "validateExtractedQuestions에 figures 인덱스 교차 검증 추가"가 명시되어 있다.

현재 `extraction-validation.ts`(line 62-120)의 `validateExtractedQuestions`는 다음 흐름으로 동작한다:

```typescript
// line 91: hasFigure=true인데 figures가 없으면 경고 (에러는 아님)
return { ..., figures: q.figures?.map((f) => ({ url: null, ... })) }
```

`{{fig:N}}` 교차 검증을 추가할 때 `questionText`에 `{{fig:N}}`이 있지만 `figures[N]`이 없으면 범위 초과다. 그런데 현재 코드에서 `hasFigure: true`이지만 `figures`가 undefined인 경우도 허용되어 있어, 교차 검증 로직이 `undefined?.length`를 처리해야 하는 엣지 케이스가 발생한다.

**문제**

교차 검증 유틸 구현 시 `figures`가 undefined일 때의 처리를 Task 2에서 명시하는 "교차 검증 유틸" 설명에 포함해야 하지만, 현재 Task 2 명세에는 "figures 배열 + questionText 내 {{fig:N}} 인덱스 교차 검증 유틸"만 언급되어 있고 `figures`가 undefined인 경우에 대한 처리 방침이 없다.

**수정 제안**

Task 2 또는 Task 6 명세에 추가:
- 교차 검증 유틸은 `figures`가 undefined/null이면 교차 검증을 건너뜀 (경고만)
- `{{fig:N}}` 인덱스가 `figures.length`를 초과하면 경고 로그 + 부분 성공 허용 (에러 처리 섹션 방침과 일치)

이 내용이 에러 처리 섹션(섹션 7)에는 "figures[N] 인덱스 범위 초과 → description 텍스트 폴백"으로 명시되어 있으나, 구현 Task에서는 언급이 없어 에이전트가 참조 누락할 수 있다.

---

### [CONSIDER] Task 6에서 `extractionJsonSchema` 자동 재생성 — Gemini responseJsonSchema 불변성 위험

**설명**

`extraction-validation.ts:52`에서:
```typescript
export const extractionJsonSchema = extractionResponseSchema.toJSONSchema()
```

이 값은 모듈 로드 시 자동 생성되어 `question-extraction.ts`에서 Gemini `responseJsonSchema`로 사용된다. Task 6이 `extractedQuestionSchema`의 어떤 필드라도 수정하면 이 JSON Schema가 자동으로 변경되어 Gemini가 이전과 다른 출력 형식을 요구받는다.

**문제**

이미 `past_exam_details`에 저장된 수백 개 추출 결과는 기존 스키마 기반이다. extractionJsonSchema 변경 시 재추출이 필요할 수 있고, 추출 결과 구조 변경은 기존 crop 파이프라인에 영향을 줄 수 있다.

**수정 제안**

Task 6 설명에 "extractionJsonSchema 변경 여부와 그 영향"을 리스크 항목으로 추가. 위 SHOULD FIX에서 제안한 대로 `extractedQuestionSchema.figures`를 `figureInfoSchema[]`로 유지하면 이 위험은 회피된다.

---

### [CONSIDER] Task 11 tester가 Wave 2 완료 전에 스키마만 단위 테스트 가능한지 명시 필요

**설명**

Task 11은 "Task 2~10 전체 완료 후 시작"으로 명시되어 있다. 그런데 Task 2(FigureData Zod 스키마)는 독립 파일(`figure-schema.ts`)이므로 Wave 1 완료 직후 Zod 스키마 단위 테스트(~20개)는 즉시 작성 가능하다.

**문제**

"전체 완료 후 시작" 제약이 tester 에이전트의 조기 테스트 작성을 막을 수 있다. 스키마 테스트와 SVG 컴포넌트 테스트는 서로 독립이므로 Wave 1 완료 후 스키마 테스트를 선행 작성하면 구현 오류를 더 빨리 발견할 수 있다.

**수정 제안**

Task 11에 "Wave 1 완료 후 figure-schema.test.ts 선행 작성 가능 (옵션)"을 추가하거나, 테스트 Wave를 Wave 1과 Wave 5로 분리하는 방안을 고려한다.

---

## 리서치 일치도 (변경 사항만)

v1 리뷰에서 식별된 불일치 항목들이 v2에서 해소되었는지 확인한다.

| 항목 | v1 불일치 | v2 상태 |
|------|----------|---------|
| `segment.display` vs `displaySize` 우선순위 | ⚠️ 미정의 | ✅ segment.display 우선으로 확정 |
| save-questions 파일 소유권 누락 | ⚠️ 미포함 | ✅ Task 10 + 파일 소유권 테이블에 추가 |
| 선택지 도형 — 리서치는 Phase 3, PLAN은 MVP | ⚠️ 불일치 | ✅ PLAN에 "options 타입 string[] 유지, {{fig:N}} 구분자로 처리" 근거 추가 |
| figure-placement-recommendation.md의 `displaySize` 의미 변경 | ⚠️ | ✅ PLAN 섹션 2에 "large=블록, small=인라인" 명시 |

v1 불일치 항목 전부 해소됨.

---

## 결론

**READY**

v1 MUST FIX 3개, SHOULD FIX 4개, CONSIDER 3개 모두 v2에서 완전히 반영되었다.

신규 이슈 2개가 발견되었으나 MUST FIX 수준은 아니다:

1. **[SHOULD FIX] extractedQuestionSchema.figures 교체 범위** — Task 6 구현자가 `figureInfoSchema`(boundingBox)를 `FigureData`로 오해하고 교체할 경우 기출 추출 crop 파이프라인이 파손될 수 있다. 에이전트 프롬프트에 "기출 추출 figures는 figureInfoSchema 유지, FigureData 교체 대상은 generatedQuestionSchema만"을 명시하면 구현 단계에서 처리 가능하다.

2. **[SHOULD FIX] 교차 검증 유틸의 figures undefined 처리** — 구현 중 발견 가능한 수준이나, Task 2 또는 Task 6 명세에 한 줄 추가로 명확히 할 수 있다.

3. **[CONSIDER] 2개** — 구현 중 처리 가능.

> **Plan Review Completion Checklist 평가**:
> - [x] 모든 Task의 파일 소유권이 명확하다
> - [x] Task 간 의존성 순서가 정의되었다
> - [x] 외부 의존성(라이브러리, API)이 명시되었다 (0개)
> - [x] 에러 처리 방식이 정해졌다
> - [x] 테스트 전략이 있다 (~68개)
> - [x] 이전 Phase 회고 교훈이 반영되었다
> - [x] 병렬 구현 시 파일 충돌 가능성이 없다
>
> **모든 항목 충족 → READY**. SHOULD FIX 2개는 에이전트 프롬프트 보강으로 구현 단계에서 처리한다.
