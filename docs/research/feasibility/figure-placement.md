# 도형 인라인 배치 실현 가능성 분석

> **작성일**: 2026-03-22
> **작성자**: feasibility-analyst
> **목적**: 수학 시험 문제에서 도형이 텍스트 흐름 안에 인라인으로 삽입되는 경우를 기존 코드베이스에서 어떻게 수용할 수 있는지 평가
> **선행 리서치**:
> - `docs/research/tech/math-figures.md`
> - `docs/research/feasibility/math-figures.md`
> - `docs/research/math-figures-recommendation.md`
> - `docs/plan/latex-rendering.md`

---

## 요약

현재 COMPASS의 데이터 모델은 `questionText: string` + `options: string[]` + `figures: FigureInfo[]`의 **분리 구조**다. 도형이 텍스트 흐름 안에 인라인으로 삽입되는 실제 시험 패턴을 처리하려면 "도형 위치 정보"가 추가로 필요하다.

이미 진행 중인 **LaTeX 렌더링 PLAN**(`docs/plan/latex-rendering.md`)이 `parseLatexText` 파서와 `LatexRenderer` 컴포넌트를 도입하므로, 도형 구분자(`{{fig:N}}`) 방식은 그 파서를 **최소 확장**으로 통합할 수 있다.

**핵심 결론**: 방안 A(구분자 기반)가 기존 코드 변경 범위, DB 하위 호환성, 복수 도형 지원 모든 면에서 최적이다. 단, options 내 도형은 별도 인덱스 네임스페이스가 필요하다.

---

## 1. 현재 데이터 모델 분석

### 1-1. TypeScript 타입 (src/lib/ai/types.ts, 128~136번 줄)

```typescript
// ExtractedQuestion (AI 추출용)
readonly questionText: string          // 단일 문자열
readonly options?: readonly string[]   // 각 보기가 순수 문자열
readonly figures?: readonly FigureInfo[]  // 문제 전체에 붙는 도형 목록
```

```typescript
// GeneratedQuestion (AI 생성용, 232~233번 줄)
readonly content: string
readonly options?: readonly string[]
// figures 필드 없음 — 생성 프롬프트가 도형을 텍스트로 대체
```

### 1-2. Zod 스키마

| 파일 | 스키마 | options 타입 |
|------|--------|-------------|
| `src/lib/ai/extraction-validation.ts` (38번 줄) | `extractedQuestionSchema` | `z.array(z.string()).optional()` |
| `src/lib/ai/validation.ts` (27번 줄) | `generatedQuestionSchema` | `z.array(z.string()).optional()` |
| `src/lib/validations/save-questions.ts` (32번 줄) | `questionToSaveSchema` | `z.array(z.string()).optional()` |
| `src/lib/validations/exam-management.ts` (132, 148번 줄) | `updateExtractedQuestionSchema`, `createExtractedQuestionSchema` | `z.array(z.string()).optional()` |

**현황 요약**: options는 4개 Zod 스키마 파일 전체에서 `z.array(z.string())`으로 선언되어 있다.

### 1-3. DB 스키마

```sql
-- past_exam_details (supabase/migrations/20260315_past_exam_restructure.sql, 56~62번 줄)
question_text TEXT NOT NULL,
options JSONB,         -- string[] 배열
has_figure BOOLEAN DEFAULT false,
figures JSONB,         -- FigureInfo[] 배열 (이미 복수 도형 수용 가능)

-- questions (supabase/migrations/00001_initial_schema.sql, 159번 줄)
options JSONB,         -- string[] 배열
-- figures 관련 컬럼 없음
```

### 1-4. UI 렌더링 포인트에서 options 사용 방식

| 파일 | 라인 | 패턴 |
|------|------|------|
| `question-card.tsx` (163~169번 줄) | ReadMode | `question.options.map((option, i) => <p>{option}</p>)` |
| `question-card.tsx` (203번 줄) | EditMode | `useState<string[]>(question.options ?? ['', '', '', ''])` |
| `question-card.tsx` (217~220번 줄) | EditMode | `setOptions(prev => prev.map((opt, i) => ...))` |
| `generate-questions-dialog.tsx` (152~157번 줄) | QuestionCard | `question.options.map((option, i) => <p>{option}</p>)` |
| `question-detail-sheet.tsx` | QuestionDetailSheet | options 배열 순회 (동일 패턴) |

**총 파일 수**: 3개 tsx 파일에서 options를 `string`으로 직접 다룬다.

---

## 2. AI 프롬프트에서 도형 위치 정보 현황

### 2-1. 추출 프롬프트 (src/lib/ai/prompts/question-extraction.ts, 23~43번 줄)

현재 프롬프트는 도형을 **문제 전체 수준**으로만 연결한다:

```
규칙 4: 그래프, 그림, 도형이 있는 경우
  - bounding box 좌표를 normalized(0~1)로 반환하세요.
  - 그래프/그림의 내용을 상세히 설명하세요.
  - hasFigure를 true로 설정하세요.
```

인라인 위치(`questionText` 어디, `options[N]` 어디)에 도형이 있는지는 **지시하지 않는다**.

### 2-2. 생성 프롬프트 (src/lib/ai/prompts/question-generation.ts, 48~49번 줄)

```
규칙 2: 그래프나 그림이 필요한 문제는 텍스트로 상황을 설명하여 대체하세요.
```

현재 AI 생성은 도형을 **의도적으로 회피**하도록 설계되어 있다.

---

## 3. LaTeX 파서와의 통합 가능성

`docs/plan/latex-rendering.md`의 Task 2에서 설계된 `parseLatexText` 유틸은 다음 세그먼트 타입을 반환한다:

```typescript
type LatexSegment =
  | { type: 'text'; content: string }
  | { type: 'inline'; content: string }   // $...$
  | { type: 'block'; content: string }    // $$...$$
```

`{{fig:N}}` 구분자를 **4번째 세그먼트 타입**으로 추가하면:

```typescript
type LatexSegment =
  | { type: 'text'; content: string }
  | { type: 'inline'; content: string }
  | { type: 'block'; content: string }
  | { type: 'figure'; index: number }  // {{fig:N}}
```

파서 변경은 `src/lib/utils/latex-parser.ts` **1개 파일**이며, 렌더러(`LatexRenderer`)도 `'figure'` 케이스 분기만 추가하면 된다.

**핵심 이점**: LaTeX 파서 도입(현재 PLAN)과 도형 구분자 도입을 **동일 Wave에서 병행**할 수 있다.

---

## 4. 복수 도형 처리 — 인덱스 설계

### 4-1. 현재 구조의 복수 도형 수용 가능성

`past_exam_details.figures JSONB`는 이미 배열이므로 복수 도형을 DB 레벨에서 수용한다.
`ExtractedQuestion.figures?: readonly FigureInfo[]`도 배열 타입이다 (`src/lib/ai/types.ts`, 136번 줄).

### 4-2. 문제: questionText와 options 사이 인덱스 충돌

예시 — 하나의 문제에 도형 5개:

```
그림 (가)와 같이 {{fig:0}} 삼각형 ABC에서...
그림 (나)와 같이 {{fig:1}} 원 O에서...

{{fig:2}}

① $\frac{1}{2}$   ② {{fig:3}}   ③ {{fig:4}}   ④ 3
```

`figures` 배열 인덱스가 **전역(global)**이라면:
- `questionText` 내 `{{fig:0}}`, `{{fig:1}}`, `{{fig:2}}` → `figures[0]`, `figures[1]`, `figures[2]`
- `options[1]` 내 `{{fig:3}}` → `figures[3]`
- `options[2]` 내 `{{fig:4}}` → `figures[4]`

이 방식은 **단순하고 일관적**이다. 하나의 배열로 모든 도형을 관리한다.

### 4-3. 인덱스 정합성 검증 필요성

Zod 스키마에서 교차 검증:

```typescript
// figures 배열 최대 인덱스 == questionText + options 전체에서 참조된 최대 인덱스
```

이 검증은 "구현 단계"에서 추가하는 것이 적절하다. 현 시점 핵심은 **구조가 지원 가능한지** 여부이며, 지원 가능하다.

---

## 5. 데이터 모델 전환 비용 — 3개 방안 비교

### 방안 A: 구분자 기반 (추천)

**설명**: `questionText`와 `options[i]` 문자열 안에 `{{fig:N}}` 구분자 삽입. `figures[]` 배열은 전역 인덱스로 참조.

#### 기존 코드 변경 범위

| 파일 | 변경 내용 | 작업량 |
|------|---------|-------|
| `src/lib/utils/latex-parser.ts` (신규, LaTeX PLAN Task 2) | `{{fig:N}}` 세그먼트 타입 추가 | XS (+5줄) |
| `src/components/ui/latex-renderer.tsx` (신규, LaTeX PLAN Task 3) | `type === 'figure'` 분기 추가 + `FigureRenderer` 연결 | XS (+10줄) |
| `src/lib/ai/prompts/question-extraction.ts` (23~43번 줄) | 규칙 4항 확장: `{{fig:N}}` 위치 지시 추가 | S (+5줄) |
| `src/lib/ai/extraction-validation.ts` | 별도 변경 없음 (questionText는 여전히 `string`) | — |
| `src/lib/ai/validation.ts` | 별도 변경 없음 (options는 여전히 `string[]`) | — |

**DB 마이그레이션**: 불필요. `questionText TEXT`, `options JSONB`(string[]) 타입 유지.

**기존 데이터 하위 호환성**: 완전 호환. `{{fig:N}}`이 없는 기존 데이터는 `type: 'text'` 세그먼트로만 파싱되어 그대로 표시된다.

**LaTeX 파서 통합 방법**:

```typescript
// latex-parser.ts에서 파싱 우선순위
// 1. $$...$$ (블록 수식)
// 2. {{fig:N}} (도형 구분자) — 수식 파싱 전에 처리
// 3. $...$ (인라인 수식)
// 4. 나머지 텍스트
```

**options 내 도형**: `options[i]` 문자열이 `"{{fig:3}}"` 형태일 수 있다. ReadMode에서 `<LatexRenderer text={option} />`를 호출하면 동일 파서가 처리하므로 **별도 로직 없이 자동 지원**된다.

**복수 도형 지원**: `figures[]` 전역 인덱스 방식. `questionText`와 `options` 전체에서 같은 배열을 참조. 인덱스 0~N 순서가 정의되므로 충돌 없음.

#### 평가

- 기존 코드 수정 파일 수: **2개** (parser, renderer — 모두 신규 파일이므로 기존 코드 직접 수정 없음)
- DB 마이그레이션: **없음**
- 하위 호환성: **완전**
- LaTeX 파서 통합: **동일 파서 확장** (DRY)
- 복수 도형: **전역 인덱스로 완전 지원**

---

### 방안 B: 리치 콘텐츠 블록 배열

**설명**: `questionText: string`을 `questionContent: ContentBlock[]`으로 교체. 각 블록이 `{ type: 'text', text }` 또는 `{ type: 'figure', figureIndex }`.

#### 기존 코드 변경 범위

| 파일 | 변경 내용 | 작업량 |
|------|---------|-------|
| `src/lib/ai/types.ts` | `ExtractedQuestion.questionText: string` → `questionContent: ContentBlock[]` | M |
| `src/lib/ai/extraction-validation.ts` | `questionText: z.string()` → `questionContent: z.array(contentBlockSchema)` | M |
| `src/lib/ai/validation.ts` | `GeneratedQuestion.content: string` → `content: ContentBlock[]` | M |
| `src/lib/validations/save-questions.ts` | `questionToSaveSchema` 변경 | M |
| `src/lib/validations/exam-management.ts` | `updateExtractedQuestionSchema`, `createExtractedQuestionSchema` 변경 | M |
| `src/lib/actions/save-questions.ts` | 직렬화 로직 수정 | M |
| `src/lib/actions/questions.ts` | `QuestionDetail.content` 타입 변경 | M |
| `src/lib/actions/extract-questions.ts` | `ExtractedQuestion` 타입 사용처 수정 | M |
| `question-card.tsx` | `questionText` → `questionContent` 렌더링 로직 전면 교체 | M |
| `generate-questions-dialog.tsx` | `question.content` 렌더링 전면 교체 | M |
| `question-detail-sheet.tsx` | 동일 | M |
| `extraction-editor.tsx` | `EditFormData.questionText` 타입 변경 | M |
| DB 마이그레이션 | `question_text TEXT` → `question_content JSONB` (또는 신규 컬럼 추가) | L |

**DB 마이그레이션**: 필요. `question_text TEXT` 컬럼을 JSONB로 교체하거나 새 컬럼 추가 후 기존 데이터 변환 스크립트 필요.

**기존 데이터 하위 호환성**: 마이그레이션 스크립트로 변환 필요. 기존 `questionText` 값을 `[{ type: 'text', text: '...' }]` 형태로 변환해야 한다.

**평가**:
- 기존 코드 수정 파일 수: **11개 이상** (타입, 검증, 액션, UI 전 레이어)
- DB 마이그레이션: **필요** (데이터 변환 포함)
- 하위 호환성: **마이그레이션 스크립트 필요**
- LaTeX 파서 통합: **블록 안의 텍스트에도 별도 파서 필요** (중첩)
- 복수 도형: **`figures[]` 배열 인덱스 참조**로 지원 가능하나 구조 복잡도 증가

---

### 방안 E: 하이브리드 (블록 도형 별도, 인라인 구분자)

**설명**: 문제 본문 도형은 `{{fig:N}}` 구분자, 선택지 도형은 `options`를 `(string | OptionFigure)[]`로 확장.

#### 기존 코드 변경 범위

options 타입을 `string | OptionFigure`로 바꾸면 options를 `string`으로 처리하는 코드가 모두 수정 대상이 된다:

| 파일 | 라인 | 현재 패턴 | 변경 필요 |
|------|------|---------|---------|
| `question-card.tsx` | 163~169 | `option` 직접 출력 | 타입 가드 필요 |
| `question-card.tsx` | 203 | `useState<string[]>` | 타입 변경 |
| `question-card.tsx` | 217~220 | `setOptions(prev => prev.map(...))` | 타입 변경 |
| `generate-questions-dialog.tsx` | 152~157 | `option` 직접 출력 | 타입 가드 필요 |
| `question-detail-sheet.tsx` | options 순회 | `option` 직접 출력 | 타입 가드 필요 |
| `extraction-validation.ts` | 38 | `z.array(z.string())` | union 스키마 |
| `validation.ts` | 27 | `z.array(z.string())` | union 스키마 |
| `save-questions.ts` | 32 | `z.array(z.string())` | union 스키마 |
| `exam-management.ts` | 132, 148 | `z.array(z.string())` | union 스키마 |

**평가**:
- 기존 코드 수정 파일 수: **9개** (방안 A와 B의 중간)
- DB 마이그레이션: `options JSONB` 스키마는 유지 가능 (배열 원소 타입만 변경)
- 하위 호환성: 기존 string 원소는 타입 가드로 처리 가능하나 런타임 분기 코드 증가
- 복수 도형: 방안 A와 동일 + options 내 도형은 별도 인덱스 → 인덱스 계산 복잡도 증가

---

## 6. 방안별 비교표

| 평가 기준 | 방안 A (구분자) | 방안 B (블록 배열) | 방안 E (하이브리드) |
|----------|--------------|-----------------|-----------------|
| 기존 코드 수정 파일 수 | **2개 (신규 파일)** | 11개+ | 9개 |
| DB 마이그레이션 | **없음** | 필요 (데이터 변환) | 없음 |
| 하위 호환성 | **완전** | 스크립트 필요 | 타입 가드 추가 |
| LaTeX 파서 통합 | **단일 파서 확장** | 중첩 파서 필요 | 단일 파서 확장 |
| options 타입 변경 | **없음** (string 유지) | 있음 | 있음 |
| 복수 도형 지원 | **전역 인덱스 (단순)** | 전역 인덱스 | 분리 인덱스 (복잡) |
| 구현 작업량 | **S~M** | L | M |
| 기존 EditMode 영향 | **최소** | 전면 교체 | 부분 교체 |
| TypeScript 안전성 | 중간 (구분자는 문자열) | 높음 (타입 구분) | 중간 |

---

## 7. 복수 도형 인덱스 설계 상세 (방안 A)

방안 A의 전역 인덱스 방식에서 복수 도형이 있는 문제의 데이터 구조:

```json
{
  "questionText": "그림 (가)와 같이 {{fig:0}} 삼각형 ABC에서 변 AB 위의 점 D에 대하여, 그림 (나)와 같이 {{fig:1}} 원 O에서 접선을 그을 때\n\n{{fig:2}}\n\n다음 조건을 만족할 때, $\\angle AOB$의 크기를 구하시오.",
  "options": [
    "$\\frac{1}{2}$",
    "{{fig:3}}",
    "{{fig:4}}",
    "3"
  ],
  "figures": [
    { "description": "삼각형 ABC, 꼭짓점 A·B·C, 변 위의 점 D 표시", ... },
    { "description": "원 O, 외부점에서 두 접선", ... },
    { "description": "좌표평면 위 포물선 y=x²", ... },
    { "description": "수직선 위 0~1 구간", ... },
    { "description": "직각삼각형 ABC", ... }
  ]
}
```

**인덱스 규칙**:
- `questionText` 내 `{{fig:0}}`, `{{fig:1}}`, `{{fig:2}}` → `figures[0]`, `figures[1]`, `figures[2]`
- `options[1]` 내 `{{fig:3}}` → `figures[3]`
- `options[2]` 내 `{{fig:4}}` → `figures[4]`
- **단일 `figures[]` 배열, 전역 인덱스**. questionText와 options 사이 인덱스 충돌 없음.

**Zod 검증에서 범위 교차 검증 구현 가능성**:
```typescript
// 검증 함수에서 수동 교차 검증 (2단계)
const allRefs = extractFigureRefs(question.questionText, question.options)
const maxRef = Math.max(...allRefs)
if (maxRef >= (question.figures?.length ?? 0)) {
  throw new AIValidationError('figures 참조 인덱스가 배열 범위를 초과합니다')
}
```

이 검증은 `validateExtractedQuestions` 함수의 2단계 비즈니스 규칙 검증 위치(`src/lib/ai/extraction-validation.ts`, 79~107번 줄)에 추가하면 된다.

---

## 8. 추출 프롬프트 수정 범위 (방안 A 기준)

`src/lib/ai/prompts/question-extraction.ts` 23~43번 줄의 `EXTRACTION_SYSTEM_INSTRUCTION` 규칙 4항에 위치 지시를 추가:

**현재**:
```
4. 그래프, 그림, 도형이 있는 경우:
   - bounding box 좌표를 normalized(0~1)로 반환하세요.
   - hasFigure를 true로 설정하세요.
```

**추가 필요 내용**:
```
4. 그래프, 그림, 도형이 있는 경우:
   - ...기존 규칙 유지...
   - 도형이 텍스트 흐름 안에 위치하는 경우, questionText와 options[i] 문자열에
     {{fig:N}} 구분자를 삽입하세요 (N은 figures 배열의 0-based 인덱스).
   - 도형이 여러 개인 경우 figures 배열 순서와 {{fig:N}} 인덱스가 일치해야 합니다.
```

**변경 라인 수**: 약 +5줄. Zod/타입 변경 없음.

---

## 9. 기존 EditMode 영향 분석

`question-card.tsx`의 `EditMode` 컴포넌트 (199~315번 줄):

- `questionText` → `<Textarea>`: raw 문자열 그대로 편집. `{{fig:0}}`이 텍스트로 표시됨.
  - **영향**: 없음. 선생님이 `{{fig:0}}` 구분자를 직접 수정 가능.
- `options[i]` → `<Input>`: raw 문자열 그대로 편집. `{{fig:3}}`도 Input에 문자열로 표시됨.
  - **영향**: 없음. 동일 패턴.
- `figures`: 현재 "그래프/그림은 편집할 수 없습니다" 안내 표시 (296~301번 줄). 변경 없음.

EditMode는 방안 A에서 **변경이 필요 없다**.

---

## 10. 단계적 도입 전략 (방안 A 기준)

### Phase 0: LaTeX PLAN과 동시 구현 (현재 대기 중)

LaTeX PLAN Task 2(`parseLatexText`) 구현 시 `{{fig:N}}` 세그먼트를 처음부터 포함하면 추후 별도 수정 없이 바로 사용 가능하다.

- 파일: `src/lib/utils/latex-parser.ts` (신규)
- 변경량: +5줄 (세그먼트 타입 1개 + 파싱 케이스 1개)
- 리스크: 없음 (LaTeX PLAN 작업 범위 안에서 처리)

### Phase 1: 추출 프롬프트 위치 지시 추가 (S — 0.5일)

- 파일: `src/lib/ai/prompts/question-extraction.ts`
- 변경량: +5줄
- DB 변경: 없음
- 기존 데이터 영향: 없음 (기존 데이터는 `{{fig:N}}`이 없어도 정상 동작)

### Phase 2: FigureRenderer 연결 (M — 2~3일)

- `LatexRenderer`에서 `type === 'figure'` 케이스 시 `FigureRenderer` 컴포넌트 호출
- `FigureRenderer`는 이미 도형 리서치(`docs/research/math-figures-recommendation.md`)에서 설계됨
- `figures[N]`의 `description` 텍스트 표시부터 시작 → 이후 SVG 렌더링으로 확장

### Phase 3: options 내 도형 검증 강화 (S — 0.5일)

- `validateExtractedQuestions` 2단계 검증에 인덱스 범위 교차 검증 추가
- 파일: `src/lib/ai/extraction-validation.ts` (79~107번 줄)

---

## 11. 호환성 리스크

### R1. AI가 구분자를 올바르게 생성할지 (MEDIUM)

Gemini가 `{{fig:N}}`을 정확한 위치에 삽입하는 것은 검증이 필요하다. AI가 LaTeX `$...$`와 `{{fig:N}}`을 혼동할 수 있다.
**완화**: 프롬프트에 명확한 예시 포함 + 추출 결과에서 선생님 검수 단계 유지 (현재 기출 편집 페이지에 구현됨).

### R2. 기존 `figures` 배열이 없는 레코드 (LOW)

`hasFigure = false`이고 `figures = null`인 기존 레코드가 `{{fig:0}}`을 참조하면 렌더링 시 null 참조 오류 가능.
**완화**: `FigureRenderer`에서 `figures?.[index]`로 optional chaining. 도형 없으면 `[도형]` 텍스트 폴백.

### R3. editingId 단일 편집 + 구분자 직접 편집 UX (LOW)

선생님이 EditMode에서 `{{fig:0}}`을 텍스트로 보게 된다. 직관적이지 않을 수 있다.
**완화**: EditMode Textarea 상단에 "도형 위치는 {{fig:N}}으로 표시됩니다" 안내 추가.

### R4. 복수 도형 인덱스 갭 (LOW)

선생님이 편집으로 `{{fig:1}}`을 삭제해도 `figures[1]`은 DB에 남는다. 인덱스 갭 발생.
**완화**: 단계적으로 허용. 렌더러는 해당 인덱스가 없으면 폴백 표시.

---

## 12. 총 작업량 평가

| Phase | 파일 수 | 작업량 | 의존성 |
|-------|--------|-------|-------|
| Phase 0: LaTeX PLAN 통합 | 1개 (`latex-parser.ts`) | **XS (0.5시간)** | LaTeX PLAN Task 2 |
| Phase 1: 추출 프롬프트 수정 | 1개 | **XS (0.5일)** | Phase 0 |
| Phase 2: FigureRenderer 연결 | 2개 | **S~M (2~3일)** | Phase 1 + 도형 렌더러 |
| Phase 3: 인덱스 교차 검증 | 1개 | **XS (0.5일)** | Phase 1 |

**전체 합산**: **S~M (3~4일)**. 단, LaTeX PLAN이 먼저 구현되어야 한다는 전제 조건이 있다.

---

## 참조 파일 목록

- `/Users/yiback10/devlop/compass/src/lib/ai/types.ts` (128~136번 줄: ExtractedQuestion)
- `/Users/yiback10/devlop/compass/src/lib/ai/extraction-validation.ts` (34~43번 줄: extractedQuestionSchema)
- `/Users/yiback10/devlop/compass/src/lib/ai/validation.ts` (21~28번 줄: generatedQuestionSchema)
- `/Users/yiback10/devlop/compass/src/lib/validations/save-questions.ts` (22~33번 줄: questionToSaveSchema)
- `/Users/yiback10/devlop/compass/src/lib/validations/exam-management.ts` (127~150번 줄: update/createExtractedQuestionSchema)
- `/Users/yiback10/devlop/compass/src/lib/ai/prompts/question-extraction.ts` (23~43번 줄: EXTRACTION_SYSTEM_INSTRUCTION)
- `/Users/yiback10/devlop/compass/src/lib/ai/prompts/question-generation.ts` (45~52번 줄: SYSTEM_INSTRUCTION)
- `/Users/yiback10/devlop/compass/src/app/(dashboard)/past-exams/[id]/edit/question-card.tsx` (156~315번 줄: ReadMode, EditMode)
- `/Users/yiback10/devlop/compass/src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` (147~178번 줄: QuestionCard)
- `/Users/yiback10/devlop/compass/src/app/(dashboard)/questions/_components/question-detail-sheet.tsx` (146~190번 줄)
- `/Users/yiback10/devlop/compass/supabase/migrations/20260315_past_exam_restructure.sql` (56~62번 줄)
- `/Users/yiback10/devlop/compass/supabase/migrations/00001_initial_schema.sql` (159번 줄)
- `/Users/yiback10/devlop/compass/docs/plan/latex-rendering.md` (Task 2: parseLatexText 설계)
