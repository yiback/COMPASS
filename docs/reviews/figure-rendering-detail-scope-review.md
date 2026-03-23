# Detail Scope Review: 도형 렌더링 상세 PLAN

> 리뷰어: scope-reviewer
> 리뷰 일자: 2026-03-23
> 검토 대상: `docs/plan/figure-rendering-detail.md`
> 기반 PLAN: `docs/plan/figure-rendering.md` (v2)

---

## 이슈 목록

### [MUST FIX] Task 5 Step 3 — figure-renderer.tsx 소유권 이중 수정

**위치**: Wave 2, Task 5 Step 3

**문제**: Task 5(소유: frontend-ui, SVG 유틸)가 `src/components/ui/figure-renderer.tsx`의 `case 'number_line'`을 수정한다. 그런데 Task 3(Wave 1)이 이미 이 파일을 소유했고, Task 7 Step 3과 Task 8 Step 4도 동일 파일(`figure-renderer.tsx`)을 수정한다. Wave 2에서 Task 4(frontend-ui)와 Task 5(frontend-ui)가 **동시에** 실행될 경우, Task 4는 `latex-renderer.tsx`를 수정하고 Task 5는 `figure-renderer.tsx`를 수정하므로 Wave 2 내 두 Task 간 파일 충돌은 없다. 그러나 더 근본적인 문제가 있다.

**실제 충돌 위험**: Wave 3에서 Task 7(coordinate_plane + function_graph)과 Task 8(polygon + circle + vector)이 **병렬 실행**되는데, Task 7 Step 3과 Task 8 Step 4가 **모두 `figure-renderer.tsx`를 수정**한다. 이것은 동일 Wave에서 동일 파일 동시 수정 — **파일 충돌 확정**.

**수정 방안**: Wave 3을 두 단계로 분리한다.
- Wave 3a: Task 7(coordinate_plane → function_graph) 신규 파일 작성 + figure-renderer.tsx 연결
- Wave 3b: Task 8(polygon + circle + vector) 신규 파일 작성 + figure-renderer.tsx 연결 (Wave 3a 완료 후)
<!-- NOTE: 두 단계로 분리 --> 
또는, `figure-renderer.tsx` 연결 Step을 모아 Wave 3 말미에 별도 직렬 Step으로 처리한다.

---

### [MUST FIX] Task 6 Step 2 — validateFigureIndices 타입 불일치

**위치**: Wave 2, Task 6 Step 2

**문제**: `validateFigureIndices(questionText, figures)` 시그니처는 `FigureData[] | undefined`를 받도록 정의되어 있다(Task 2). 그런데 Task 6에서 이 함수를 `extractedQuestionSchema`의 figures — 즉 `figureInfoSchema[]` 타입 값에 대해 호출하려 한다. `FigureInfo`와 `FigureData`는 별개의 타입이므로 TypeScript 에러가 발생한다.

상세 PLAN 본문에 "가장 단순한 방법: figures가 있으면 figures.length를 기준으로 {{fig:N}} 인덱스 범위만 로컬 검증"이라고 언급되어 있지만, 실제 사용 코드(`const warnings = validateFigureIndices(q.questionText, q.figures ? [...q.figures] : undefined)`)는 `FigureInfo[]`를 `FigureData[] | undefined`에 전달하는 형태이다. 빌드 시 타입 에러 발생이 확실하다.

**수정 방안**: 두 가지 선택지 중 하나를 명시해야 한다.
1. `validateFigureIndices`를 `length`만 받는 별도 오버로드 또는 `validateFigureIndexRange(questionText: string, figureCount: number): string[]`로 분리
2. Task 6에서 `validateFigureIndices` 대신 인라인으로 인덱스 범위만 검증
<!-- NOTE: 1 적용 -->
현재 PLAN에서 어느 방법을 사용할지 불명확하다. 에이전트가 독자적으로 판단할 경우 타입 에러 또는 figureInfoSchema 수정 위험이 있다.

---

### [SHOULD FIX] Task 7 — 워커 크기 과다 (M → M+M, 단계 내 직렬 의존)

**위치**: Wave 3, Task 7

**문제**: Task 7은 coordinate_plane과 function_graph 두 개의 SVG 렌더러를 포함하며, function_graph는 coordinate_plane 완료 후에야 시작 가능하다(내부 직렬 의존). PLAN 본문에도 "Wave 3 내 구현 순서: coordinate_plane 먼저 → function_graph 다음"이라 명시되어 있다. 이 두 Step을 하나의 Task에 묶으면 에이전트 세션이 두 단계를 순서대로 처리해야 하고, 빌드 체크도 2회 실행된다. 작업량은 사실상 M+M이다.

Task 8(polygon + circle + vector)도 마찬가지로 세 개의 독립 파일을 다루지만, 세 도형은 상호 독립이므로 하나의 세션에서 처리하면 오히려 합리적이다.

**수정 방안**: Task 7을 Task 7a(coordinate_plane)와 Task 7b(function_graph)로 분리하는 것이 명확하다. 다만 같은 에이전트 역할(frontend-ui)이 순서대로 처리하는 경우 단일 세션으로도 가능하므로 CONSIDER 수준으로 낮출 수도 있다. 그러나 현재 상세 PLAN이 "병렬 구현 가능"을 Wave 3의 장점으로 제시하고 있어 에이전트가 혼동할 여지가 있으므로 SHOULD FIX로 분류한다.
<!-- NOTE: 적용 -->
---

### [SHOULD FIX] Task 9 Step 2 — 수정 대상 컴포넌트 파일 미특정

**위치**: Wave 4, Task 9 Step 2

**문제**: "선택지를 렌더링하는 컴포넌트 (기존 past-exam 관련 컴포넌트)"라고만 명시되어 있고 실제 파일 경로가 없다. 에이전트가 수정할 파일을 스스로 탐색해야 하며, 잘못된 파일을 수정하거나 frontend-ui 소유권 범위 외의 파일을 수정할 위험이 있다.

**수정 방안**: 선택지 렌더링 컴포넌트의 실제 파일 경로를 명시한다. 리드가 사전에 파악하여 "파일: `src/app/.../[실제경로].tsx`"로 기재해야 한다.
<!-- NOTE: 적용 -->
---

### [SHOULD FIX] Task 10a와 Task 10b — Wave 4 병렬 에이전트 역할 분리 불명확

**위치**: Wave 4

**문제**: 마스터 PLAN(v2)의 파일 소유권 표에서 Task 10은 "ai-integration (AI 파일), backend-actions (save-questions 파일)"으로 공동 소유로 기재되어 있다. 상세 PLAN에서 Task 10a(ai-integration)와 Task 10b(backend-actions)로 분리했고, 각 파일도 분리되어 있다. 그러나 orchestrate 커맨드 실행 시 동일 Wave에서 두 에이전트를 생성할 때 어떤 에이전트에 어떤 Task를 할당하는지 명시가 없다.

또한 Task 10a가 수정하는 `src/lib/ai/validation.ts`와 Task 10b가 수정하는 `src/lib/actions/save-questions.ts`는 서로 다른 파일이지만, 두 파일 모두 `figureDataSchema`를 import한다. 이 import 자체는 충돌이 아니나, 에이전트 프롬프트에 "Task 10a = ai-integration 에이전트, Task 10b = backend-actions 에이전트"임을 명시적으로 기재해야 한다.

**수정 방안**: Wave 4 섹션 상단에 에이전트 할당표를 추가한다.
<!-- NOTE: 적용 -->
```
Wave 4 에이전트 할당:
- frontend-ui 에이전트: Task 9 (latex-renderer.tsx)
- ai-integration 에이전트: Task 10a (validation.ts, prompt 파일 2개)
- backend-actions 에이전트: Task 10b (save-questions.ts, validations/save-questions.ts)
```

---

### [CONSIDER] Task 3 Step 2 — Wave 3 예비 switch 구조 유지 보수 부담

**위치**: Wave 1, Task 3 Step 2

**관찰**: Wave 1에서 switch 구조를 미리 작성하되 모든 case를 `FigurePlaceholder`로 반환하고, Wave 2에서 `number_line` case를 교체하고, Wave 3에서 나머지를 교체하는 방식이다. 이로 인해 `figure-renderer.tsx`가 Wave 1, 2, 3에 걸쳐 3회 수정된다. 각 수정 사이에 다른 에이전트가 이 파일을 잘못 수정할 경우 충돌 위험이 있다.

대안으로, Wave 1에서는 switch 없이 단순 폴백만 구현하고, Wave 5(또는 Wave 3 완료 후) 한 번에 전체 switch를 작성하는 방법도 있다. 단, 이는 Wave 2~3 점진적 출시 검증을 어렵게 하므로 현재 방식이 더 유리하다고 판단하면 유지해도 무방하다.

---

### [CONSIDER] Task 11 — tester 에이전트 시작 조건이 너무 엄격할 수 있음

**위치**: Wave 5, Task 11

**관찰**: "Task 2~10 전체 완료 후"가 시작 조건이다. 그러나 PLAN 내 CONSIDER 항목에 "Task 2 완료 직후 figure-schema.test.ts 스키마 단위 테스트 선행 작성 가능"이라고 언급된다. 두 조건이 모순되지는 않지만, TDD 원칙(testing.md) 관점에서는 Task 2 직후 테스트를 작성하는 것이 더 적합하다.

Wave 5를 전체 테스트 통합 세션으로 유지하되, Task 2 완료 직후 `figure-schema.test.ts` 선행 작성을 선택 사항이 아닌 권장 사항으로 격상하는 것을 고려할 수 있다.
<!-- NOTE: 적용 -->
---

## 파일 소유권 충돌 매트릭스

| 파일 | Wave 1 | Wave 2 | Wave 3 | Wave 4 | Wave 5 |
|------|--------|--------|--------|--------|--------|
| `figure-renderer.tsx` | Task 3 (생성) | Task 5 Step 3 | Task 7 Step 3 **+** Task 8 Step 4 ⚠️ | - | - |
| `latex-renderer.tsx` | - | Task 4 | - | Task 9 | - |
| `svg/number-line.tsx` | - | Task 5 (생성) | - | - | - |
| `svg/coordinate-plane.tsx` | - | - | Task 7 (생성) | - | - |
| `svg/function-graph.tsx` | - | - | Task 7 (생성, 직렬) | - | - |
| `svg/polygon.tsx` | - | - | Task 8 (생성) | - | - |
| `svg/circle-shape.tsx` | - | - | Task 8 (생성) | - | - |
| `svg/vector-arrow.tsx` | - | - | Task 8 (생성) | - | - |
| `figure-schema.ts` | Task 2 (생성) | - | - | - | - |
| `supabase.ts` | Task 1 | - | - | - | - |
| `ai/types.ts` | - | 리드 선행 | - | - | - |
| `ai/validation.ts` | - | - | - | Task 10a | - |
| `ai/prompts/question-generation.ts` | - | - | - | Task 10a | - |
| `ai/prompts/past-exam-generation.ts` | - | - | - | Task 10a | - |
| `validations/save-questions.ts` | - | - | - | Task 10b | - |
| `actions/save-questions.ts` | - | - | - | Task 10b | - |

**⚠️ 충돌 발생**: Wave 3에서 Task 7 Step 3과 Task 8 Step 4가 `figure-renderer.tsx` 동시 수정 → MUST FIX #1

---

## CLAUDE.md 역할 경계 일치 검토

| Task | 소유 역할 | CLAUDE.md 역할 경계 | 일치 여부 |
|------|----------|-------------------|----------|
| Task 1 (DB 마이그레이션) | db-schema | `supabase/migrations/`, `src/types/supabase.ts` | ✅ |
| Task 2 (Zod 스키마) | backend-actions | `src/lib/validations/` | ✅ |
| Task 3 (FigureRenderer) | frontend-ui | `src/components/ui/` | ✅ |
| Task 4 (LatexRenderer) | frontend-ui | `src/components/ui/` | ✅ |
| Task 5 (SVG 유틸 + number_line) | frontend-ui | `src/components/ui/` | ✅ |
| Task 6 (AI 추출 프롬프트) | ai-integration | `src/lib/ai/` | ✅ |
| Task 7 (coordinate_plane + function_graph) | frontend-ui | `src/components/ui/` | ✅ |
| Task 8 (polygon + circle + vector) | frontend-ui | `src/components/ui/` | ✅ |
| Task 9 (연속 도형 + 선택지) | frontend-ui | `src/components/ui/` | ✅ (수정 대상 파일 미특정 → SHOULD FIX) |
| Task 10a (AI 생성 프롬프트) | ai-integration | `src/lib/ai/` | ✅ |
| Task 10b (save-questions) | backend-actions | `src/lib/actions/`, `src/lib/validations/` | ✅ |
| Task 11 (테스트) | tester | `src/lib/*/` `__tests__/`, `src/components/ui/__tests__/` | ✅ |

역할 경계 위반 없음. 공유 파일(`src/lib/ai/types.ts`)은 리드 선행 작업으로 분리되어 있어 올바르게 처리되었다.

---

## 워커 크기 적절성 평가

| Task | 작업량 | 신규 파일 수 | 기존 파일 수정 | 평가 |
|------|-------|------------|-------------|-----|
| Task 1 | XS | 1 | 1 | 적절 |
| Task 2 | S | 1 | 0 | 적절 |
| Task 3 | S | 1 | 0 | 적절 |
| Task 4 | S | 0 | 1 | 적절 |
| Task 5 | M | 2 | 1 (`figure-renderer.tsx`) | 적절 (M이 맞음) |
| Task 6 | M | 0 | 2 | 적절 |
| Task 7 | M | 2 (직렬 의존) | 1 | 주의 (내부 직렬 → SHOULD FIX) |
| Task 8 | M | 3 (상호 독립) | 1 | 적절 (독립 3개이므로 단일 세션 가능) |
| Task 9 | S | 0 | 1 (불특정) | SHOULD FIX |
| Task 10a | M | 0 | 3 | 적절 |
| Task 10b | S | 0 | 2 | 적절 |
| Task 11 | M | 5+ | 0 | 적절 |

---

## 결론: BLOCKED

**MUST FIX 이슈 2건**이 해소되어야 구현을 시작할 수 있다.

### MUST FIX 요약

1. **Wave 3 figure-renderer.tsx 충돌**: Task 7 Step 3과 Task 8 Step 4를 동일 Wave에서 병렬 실행하면 `figure-renderer.tsx` 동시 수정 발생. Wave 3를 단계적으로 분리하거나, figure-renderer.tsx 연결 Step을 Wave 3 말미 직렬 Step으로 분리 필요.

2. **Task 6 validateFigureIndices 타입 불일치**: `FigureInfo[]`를 `FigureData[] | undefined` 파라미터에 전달하는 코드가 TypeScript 에러를 발생시킨다. 교차 검증 방법을 `validateFigureIndexRange(questionText, figureCount)` 분리 또는 인라인 로직으로 명확히 결정해야 한다.

### SHOULD FIX 요약

3. Task 7을 Task 7a/7b로 분리하거나, 내부 직렬 의존이 있음을 에이전트 프롬프트에 더 명확히 기재
4. Task 9 Step 2의 수정 대상 파일 경로 명시
5. Wave 4 에이전트 할당표 추가
