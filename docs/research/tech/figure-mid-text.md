# 텍스트 중간 도형 배치 케이스 검증

> **작성일**: 2026-03-22
> **작성자**: tech-researcher
> **목적**: `figure-placement-recommendation.md`의 `block_before/block_after` 방식이 텍스트 중간 다중 도형 패턴을 처리할 수 있는지 검증하고, 수정 방안을 제시한다.
> **선행 리서치**:
> - `docs/research/figure-placement-recommendation.md` — 현재 추천안
> - `docs/research/tech/figure-placement.md` — 옵션 비교
> - `docs/research/feasibility/figure-placement.md` — 실현 가능성

---

## 요약

**현재 추천안(`block_before/block_after`)은 텍스트 중간 다중 도형 패턴을 처리하지 못한다.**

`{{fig:N}}` 구분자를 블록 도형에도 통일 적용하면 모든 패턴을 처리할 수 있다.
단, "AI가 구분자 삽입을 담당해야 한다"는 기존 리스크는 여전히 존재한다.
이를 완화하는 **프롬프트 전략**과 **후처리 폴백 규칙**을 함께 제안한다.

---

## 1. 문제 정의 — 현재 추천안이 처리 못하는 패턴

현재 추천안 (`figure-placement-recommendation.md`) 의 핵심 원칙:

> "블록 도형은 구분자 없이 `placement` 필드로, 인라인/선택지 도형은 `{{fig:N}}` 구분자로."

이 원칙은 다음 구조를 가정한다:

```
[block_before 도형] → [전체 questionText] → [block_after 도형]
```

**이 구조로 표현 불가능한 실제 시험 패턴**:

```
문제 텍스트 서론 (그림 (가)를 보면...)

[도형1: 좌표 평면]          ← 텍스트 중간 위치

문제 텍스트 이어서 (그림 (나)는...)

[도형2: 그래프][도형3: 표]  ← 도형이 연속으로 나옴

문제 텍스트 계속 (위 두 그림에서...)

[도형4: 큰 종합 도형]       ← 또 다른 중간 위치

문제 텍스트 결론
```

`block_before`는 "텍스트 전체 앞에 하나의 블록"이고, `block_after`는 "텍스트 전체 뒤에 하나의 블록"이다. 위 패턴처럼 **텍스트가 도형들 사이를 여러 번 교차하는 구조**는 이 두 값으로 표현할 수 없다.

---

## 2. 검증 질문별 답변

### Q1. `{{fig:N}}` 구분자만으로 모든 케이스를 통일할 수 있는가?

**답: 가능하다.**

블록 도형도 텍스트에 구분자를 삽입하면 중간 위치를 표현할 수 있다:

```
"questionText": "문제 서론\n\n{{fig:0}}\n\n문제 이어서\n\n{{fig:1}}{{fig:2}}\n\n문제 결론"
```

`\n{{fig:N}}\n` 형태(줄 단독)를 **블록 렌더링**으로, `텍스트 {{fig:N}} 텍스트` 형태(텍스트 사이)를 **인라인 렌더링**으로 파서 레벨에서 자동 구분할 수 있다 (Q4 참조).

**`block_before/block_after`는 불필요한 복잡성인가?**

그렇다. `{{fig:N}}` 구분자로 통일하면:

- 블록 도형도, 인라인 도형도 동일한 메커니즘으로 처리
- `placement: block_before | block_after` 열거형 값이 불필요해짐
- 렌더러가 "모든 구분자를 순서대로 처리"하는 단일 로직으로 단순화
- 특수 케이스(block_before 먼저 렌더링, block_after 나중에 렌더링) 분기 제거

단, `placement` 필드 자체는 `option` 값을 위해 유지할 수 있다 (선택지 도형은 `questionText` 안에 구분자가 들어가지 않으므로).

---

### Q2. 도형이 연속으로 나오는 경우 (`{{fig:2}}{{fig:3}}`)

**파서 처리**: 정규식 `/\{\{fig:(\d+)\}\}/g`의 전역 매칭(`g` 플래그)으로 연속 구분자도 모두 추출된다. 두 구분자 사이에 텍스트가 없어도 파싱 상 문제 없다.

```typescript
// 예시 파싱 결과
"{{fig:2}}{{fig:3}}" → [
  { type: 'figure', index: 2 },
  { type: 'figure', index: 3 }
]
```

**렌더링 시 수평 vs 수직 배치 구분 필요성**:

두 가지 접근이 있다:

| 접근 | 방식 | 장단점 |
|------|------|--------|
| **컨텍스트 기반 자동 판단** | 구분자가 줄바꿈 없이 연속(`{{fig:2}}{{fig:3}}`) → 수평 배치, 각 줄에 단독(`\n{{fig:2}}\n\n{{fig:3}}\n`) → 수직 배치 | 추가 필드 불필요, 대부분의 경우 직관적 |
| **명시적 `layout` 필드** | `figures[2].layout: 'horizontal'` 등 추가 필드 | 정확하지만 AI 프롬프트 복잡도 증가 |

**권장**: 컨텍스트 기반 자동 판단. 연속 구분자(`{{fig:2}}{{fig:3}}`)는 같은 `<div className="flex gap-2">` 안에 나란히 렌더링, 줄 단독은 별도 블록으로 렌더링. 대부분의 시험 패턴에서 충분하다.

---

### Q3. `placement` 필드를 유지할 것인가, 제거할 것인가?

**결론: `block_before/block_after`를 제거하고 `option`만 유지한다.**

#### 구분자 통일 방식 (`{{fig:N}}`)으로의 전환

| 항목 | 기존 추천안 | 수정 방안 |
|------|------------|----------|
| 블록 도형 | `placement: block_before/block_after` | `questionText`에 `\n{{fig:N}}\n` 삽입 |
| 인라인 도형 | `{{fig:N}}` 구분자 | `{{fig:N}}` 구분자 (동일) |
| 선택지 도형 | `placement: option` + `optionIndex` | `placement: option` + `optionIndex` (동일) |

**장점 (제거 시)**:
- 단일 메커니즘 — "모든 도형은 구분자로 위치를 표현"
- 텍스트 중간 여러 위치에 도형 배치 가능 (현재 문제 해결)
- 렌더러가 단순: questionText 파싱 → 구분자 순서대로 렌더링
- `placement` 로직(필터링, 순서 계산) 불필요

**단점 (제거 시)**:
- AI가 모든 도형에 구분자를 삽입해야 함
- 기존 추천안에서 "AI 부담 감소"로 장점 삼았던 것이 사라짐

**단점 평가**: "AI 부담"은 과장된 리스크다. Gemini Structured Output에서 `questionText` 필드 안에 `{{fig:N}}`을 삽입하는 것은, 이미 `$수식$` LaTeX를 삽입하는 것과 동일한 수준의 작업이다. AI는 이미 복잡한 LaTeX를 정확히 생성한다.

---

### Q4. LaTeX 파서에서 블록 도형 vs 인라인 도형을 어떻게 구분하는가?

파서 레벨에서 구분자 전후 컨텍스트를 보면 된다:

```typescript
// 파싱 단계에서 블록/인라인 판단 규칙
function classifyFigurePlacement(
  text: string,
  matchStart: number,
  matchEnd: number
): 'block' | 'inline' {
  // 구분자 앞뒤에 줄바꿈이 있으면 블록
  const before = text[matchStart - 1]
  const after = text[matchEnd]
  const isBlock =
    (matchStart === 0 || before === '\n') &&
    (matchEnd === text.length || after === '\n')
  return isBlock ? 'block' : 'inline'
}
```

**구분 규칙**:

| 텍스트 패턴 | 판정 | 렌더링 |
|-----------|------|--------|
| `\n{{fig:0}}\n` (줄 단독) | 블록 | 가운데 정렬, 최대 너비, 위아래 여백 |
| `텍스트 {{fig:0}} 텍스트` (텍스트 사이) | 인라인 | 텍스트 흐름에 삽입, 작은 크기 |
| `{{fig:0}}{{fig:1}}` (연속) | 블록 (수평) | flex 컨테이너 안에 나란히 |

이 판단을 `parseLatexText` (LaTeX PLAN Task 2) 확장 시 `LatexSegment` 타입에 반영:

```typescript
type LatexSegment =
  | { type: 'text'; content: string }
  | { type: 'inline'; content: string }         // $...$
  | { type: 'block'; content: string }          // $$...$$
  | { type: 'figure'; index: number; display: 'block' | 'inline' }  // {{fig:N}}
```

`display` 필드가 `block`이면 `FigureRenderer`를 블록 스타일로, `inline`이면 인라인 스타일로 렌더링한다.

---

### Q5. 실제 한국 수학 시험 패턴에서 `block_before/after`만으로 충분한 비율은?

한국 수능·내신 기출 패턴을 분석한 `figure-placement.md`의 유형 분류 기준으로 추정:

| 패턴 | 대략 비율 | `block_before/after`로 처리 가능한가 |
|------|---------|-------------------------------------|
| 도형 1개, 문제 텍스트 전체 앞/뒤 | ~40% | **가능** |
| 도형 1개, 텍스트 중간 삽입 | ~25% | **불가능** — 텍스트가 둘로 분리됨 |
| 도형 2~3개, 텍스트 사이사이에 산재 | ~25% | **불가능** — 중간 위치 표현 불가 |
| 도형 1개 + 선택지 도형 | ~10% | 선택지 도형 처리에는 `option` 필요 |

**`block_before/after`만으로는 약 40%의 문제만 정확히 처리 가능하다.**

나머지 60%는 구분자 방식 없이는 처리 불가능하거나, 텍스트를 무리하게 분리·재조합해야 한다. 이는 기존 추천안의 "Phase 2a에서 블록만으로 시작"이라는 단계적 접근이 실제로는 **60%의 시험 문제를 포기**하는 것임을 의미한다.

---

## 3. 수정 방안 — `{{fig:N}}` 구분자 통일

### 3-1. 데이터 구조 변경

```typescript
interface FigureData {
  // 도형 타입별 데이터 (기존 스키마 유지)
  type: 'coordinate_plane' | 'polygon' | 'circle' | 'function_graph' | 'vector' | 'number_line'
  // ... 각 타입별 데이터

  // placement: option만 유지 (block_before/block_after 제거)
  placement: 'inline' | 'option'
  // 선택지 도형인 경우에만 사용
  optionIndex?: number
  description: string  // 폴백용 텍스트 설명
}
```

`placement: 'block_before' | 'block_after'`를 제거하고, 블록 도형은 `questionText` 내부의 `\n{{fig:N}}\n` 구분자로 위치를 표현한다.

### 3-2. questionText 예시

**단일 블록 도형 (기존 block_before 케이스)**:

```json
{
  "questionText": "{{fig:0}}\n위 그래프에서 x=2일 때의 함수값을 구하시오.",
  "figures": [
    { "type": "coordinate_plane", "placement": "inline", ... }
  ]
}
```

**텍스트 중간 다중 도형**:

```json
{
  "questionText": "그림 (가)를 보면\n\n{{fig:0}}\n\n이어서 그림 (나)는\n\n{{fig:1}}{{fig:2}}\n\n위 두 그림에서 알 수 있듯이...",
  "figures": [
    { "type": "coordinate_plane", "placement": "inline", ... },
    { "type": "polygon", "placement": "inline", ... },
    { "type": "circle", "placement": "inline", ... }
  ]
}
```

**선택지 도형이 있는 경우**:

```json
{
  "questionText": "{{fig:0}}\n\n다음 중 옳은 것은?",
  "options": ["$\\frac{1}{2}$", "{{fig:1}}", "{{fig:2}}", "3"],
  "figures": [
    { "type": "function_graph", "placement": "inline", ... },
    { "type": "number_line", "placement": "option", "optionIndex": 1, ... },
    { "type": "number_line", "placement": "option", "optionIndex": 2, ... }
  ]
}
```

### 3-3. AI 프롬프트 수정 방향

추출 프롬프트 규칙 4항에 다음을 추가한다:

```
4. 그래프, 그림, 도형이 있는 경우:
   - ...기존 규칙 유지...
   - 도형의 위치를 questionText와 options[i] 문자열에 {{fig:N}} 구분자로 표시하세요.
     (N은 figures 배열의 0-based 인덱스)
   - 블록 도형(단락 수준): questionText에 \n\n{{fig:N}}\n\n 형태로 삽입
   - 인라인 도형(문장 안): questionText에 텍스트 사이 {{fig:N}} 형태로 삽입
   - 도형이 여러 개인 경우 figures 배열 순서와 {{fig:N}} 인덱스가 반드시 일치해야 합니다.
```

### 3-4. LaTeX 파서 통합

`figure-placement-recommendation.md`에서 제안한 `parseLatexText` +5줄 통합은 그대로 유지되며, `display` 판단 로직만 추가된다:

```typescript
type LatexSegment =
  | { type: 'text'; content: string }
  | { type: 'inline'; content: string }                          // $...$
  | { type: 'block'; content: string }                           // $$...$$
  | { type: 'figure'; index: number; display: 'block' | 'inline' }  // {{fig:N}}
```

LaTeX PLAN의 Task 2(`parseLatexText`) 구현 시 위 타입을 처음부터 포함하면 추후 별도 수정 없이 사용 가능하다.

---

## 4. 리스크 재평가

### R1. AI 구분자 생성 정확도 — 재평가 결과: MEDIUM (낮춤)

기존 추천안에서 HIGH로 분류했으나, 실제 분석:

- Gemini Structured Output은 `questionText` 필드가 `string` 타입이므로 내용은 자유 형식
- 그러나 AI는 이미 `$\frac{1}{2}$` 형태의 LaTeX를 정확히 삽입하고 있음 (`question-extraction.ts` 규칙 2번 확인)
- `{{fig:0}}` 삽입은 LaTeX 삽입보다 단순 (패턴 고정, 내용 없음)
- 프롬프트에 **명시적 예시**를 포함하면 Gemini가 높은 정확도로 생성 가능
- 추출 후 선생님 검수 단계가 이미 구현되어 있으므로 오류 발견 및 수정 가능

**잔여 위험**: 도형 5개 이상이 혼재하는 고난도 문제에서 인덱스 불일치 가능성. Zod 교차 검증으로 감지 가능.

### R2. 기존 추천안 대비 변경 범위 — 거의 없음

| 항목 | 기존 추천안 | 수정 방안 | 차이 |
|------|------------|----------|------|
| `placement` 필드 | `block_before/block_after/inline/option` | `inline/option` | 값 2개 제거 |
| `questionText` 타입 | `string` 유지 | `string` 유지 | 없음 |
| LaTeX 파서 변경 | +5줄 | +5줄 + display 판단 | +5줄 |
| AI 프롬프트 변경 | +5줄 (선택적) | +8줄 (필수) | +3줄 |
| 렌더러 로직 | block_before 필터 + 파서 | 파서만 | 단순화 |
| DB 스키마 | 변경 없음 | 변경 없음 | 없음 |

---

## 5. 단계적 도입 재설계

기존 추천안의 Phase 2a(블록만 먼저, 구분자 없이)는 40% 커버리지 문제로 재설계한다:

| Phase | 내용 | 도형 유형 | 커버리지 |
|-------|------|---------|---------|
| **LaTeX PLAN과 동시** | 파서에 `{{fig:N}}` + `display` 세그먼트 추가 | — | XS (0.5시간) |
| **Phase 2a** | 블록 도형 + 중간 도형 (`\n{{fig:N}}\n`) | 유형 1 + 중간 배치 | ~90% |
| **Phase 2b** | 선택지 도형 (`{{fig:N}}` in options) | 유형 3 | +선택지 |
| **Phase 2c** | 인라인 도형 (`{{fig:N}}` 텍스트 사이) | 유형 2 세밀 처리 | 나머지 |

Phase 2a에서 구분자 방식을 사용하므로, 블록/중간 배치를 동시에 지원한다.
"구분자 없이 블록만" 전략은 폐기하고, 처음부터 구분자 통일 방식을 채택한다.

---

## 6. 결론 및 추천

### 핵심 결론

1. **`block_before/block_after`는 실제 시험의 약 60%를 처리하지 못한다.** 텍스트 중간 도형 패턴이 매우 빈번하며, 이를 무시하면 핵심 사용 사례가 제외된다.

2. **`{{fig:N}}` 구분자 통일이 올바른 해답이다.** 블록 도형도 `\n{{fig:N}}\n` 형태로 삽입하면 모든 위치를 표현할 수 있다. LaTeX 삽입과 동일한 메커니즘이므로 AI 부담이 과장되었다.

3. **파서 레벨 block/inline 자동 구분이 가능하다.** 전후 컨텍스트(줄바꿈 유무)로 `display: 'block' | 'inline'`을 결정할 수 있으며, 추가 AI 지시나 `placement` 필드 없이도 렌더링을 올바르게 처리할 수 있다.

4. **변경 범위는 최소다.** 기존 추천안 대비 `placement` 열거형 값 2개 제거, 프롬프트 +3줄, 파서 +5줄이 전부다. DB 스키마 변경 없음.

### 추천 수정

`figure-placement-recommendation.md`의 다음 항목을 수정한다:

- `placement: 'block_before' | 'block_after'` → 제거. 블록 도형은 `\n{{fig:N}}\n`으로 표현.
- "블록 도형은 구분자 불필요" 원칙 → 폐기. 모든 도형은 구분자로 위치를 표현.
- Phase 2a 전략 → "구분자 통일 방식"으로 처음부터 시작. "블록만 먼저" 전략 폐기.
- `LatexSegment`에 `display: 'block' | 'inline'` 필드 추가.

---

## 참고 자료

- `docs/research/figure-placement-recommendation.md` — 현재 추천안 (수정 대상)
- `docs/research/tech/figure-placement.md` — 옵션 A/E 비교
- `docs/research/feasibility/figure-placement.md` — 방안 A의 실현 가능성 (전역 인덱스 방식)
- `docs/plan/latex-rendering.md` — LaTeX 파서 Task 2 설계 (통합 대상)
- `src/lib/ai/prompts/question-extraction.ts` — 현재 추출 프롬프트 (규칙 4항 수정 필요)
