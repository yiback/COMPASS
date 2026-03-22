# LaTeX 렌더링 실현 가능성 분석

## 요약

LaTeX 수식 렌더링 도입은 **M(2-3일)** 수준의 작업이다. AI가 이미 `$...$` / `$$...$$` 형식으로 수식을 출력하고 있으며 DB 변환 없이 UI 렌더링 레이어만 수정하면 된다. 총 4개 파일(렌더링 지점)에 컴포넌트를 삽입하고, 라이브러리 1개(`react-katex` 또는 `katex`)를 추가하면 완료된다.

---

## 수식 표시 지점 전수 조사

LaTeX 텍스트가 실제로 사용자에게 표시되는 UI 지점을 전수 조사한 결과는 다음과 같다.

| # | 파일 | 컴포넌트 | 표시 필드 | 라인 |
|---|------|----------|-----------|------|
| 1 | `src/app/(dashboard)/past-exams/[id]/edit/question-card.tsx` | `ReadMode` | `question.questionText` | 160 |
| 2 | `src/app/(dashboard)/past-exams/[id]/edit/question-card.tsx` | `ReadMode` | `question.options[i]` | 166 |
| 3 | `src/app/(dashboard)/past-exams/[id]/edit/question-card.tsx` | `ReadMode` | `question.answer` | 177 |
| 4 | `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` | `QuestionCard` | `question.content` | 149 |
| 5 | `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` | `QuestionCard` | `question.options[i]` | 155 |
| 6 | `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` | `QuestionCard` | `question.answer` | 167 |
| 7 | `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` | `QuestionCard` | `question.explanation` | 174 |
| 8 | `src/app/(dashboard)/questions/_components/question-detail-sheet.tsx` | `QuestionDetailSheet` | `detail.content` | 164 |
| 9 | `src/app/(dashboard)/questions/_components/question-detail-sheet.tsx` | `QuestionDetailSheet` | `detail.options[i]` | 173 |
| 10 | `src/app/(dashboard)/questions/_components/question-detail-sheet.tsx` | `QuestionDetailSheet` | `detail.answer` (183) 및 `detail.explanation` (190) | 183, 190 |

**편집 모드(EditMode)**: `question-card.tsx`의 `EditMode`는 `<Textarea>`에 raw LaTeX를 그대로 편집하게 두어야 한다. 렌더링 대상이 아님. 단, 편집 중 미리보기 기능은 Phase 2 이후 선택적 추가 가능.

---

## AI 출력 포맷 현황

### 수식 포맷
모든 AI 프롬프트에서 LaTeX 포맷을 **명시적으로 강제**하고 있다.

- `src/lib/ai/prompts/question-extraction.ts` (28-29행):
  ```
  '2. 수식은 LaTeX 형태로 변환하세요 (인라인: $...$, 블록: $$...$$).'
  ```
- `src/lib/ai/prompts/question-generation.ts` (48행):
  ```
  '1. 수식은 반드시 LaTeX 문법을 사용하세요 (인라인: $...$, 블록: $$...$$).'
  ```
- `src/lib/ai/prompts/past-exam-generation.ts` (43행):
  ```
  '1. 수식은 반드시 LaTeX 문법을 사용하세요 (인라인: $...$, 블록: $$...$$).'
  ```

즉, **AI는 이미 LaTeX를 생성하고 있다.** 출력 포맷 변경은 불필요하다.

### 수식이 담기는 필드
- **기출 추출 흐름**: `questionText`, `options[]`, `answer` (DB: `past_exam_details` 테이블)
- **AI 생성 흐름**: `content`, `options[]`, `answer`, `explanation` (DB: `questions` 테이블)

---

## 데이터 흐름

```
AI 생성 (LaTeX 포함 텍스트)
    ↓
Zod 검증 (validation.ts / extraction-validation.ts)
    → 수식 변환/처리 없음 — raw string 그대로 통과
    ↓
DB 저장
    past_exam_details.question_text  (TEXT)
    past_exam_details.options        (JSONB — string[])
    past_exam_details.answer         (TEXT)
    questions.content                (TEXT)
    questions.options                (JSONB — string[])
    questions.answer                 (TEXT)
    questions.explanation            (TEXT)
    ↓
Server Action 조회 (raw string 그대로 반환)
    ↓
React 컴포넌트
    → 현재: {question.questionText} (plain text, LaTeX 미렌더링)
    → 목표: <LatexRenderer text={question.questionText} /> (렌더링)
```

**중요**: DB 스키마 변경 없음. 데이터는 이미 LaTeX 포맷으로 저장되고 있다.

---

## 변경 범위 평가

### 라이브러리 추가

| 라이브러리 | 번들 크기 | 특징 | 권장 여부 |
|-----------|----------|------|----------|
| `katex` | ~180KB (gzip ~50KB) | 가장 빠름, CSS 별도 임포트 필요 | 권장 |
| `react-katex` | katex wrapper | React 컴포넌트 래퍼, katex 기반 | 권장 (DX 향상) |
| `mathjax-react` | ~2MB+ | 무겁고 느림 | 비권장 |
| `better-react-mathjax` | MathJax 기반 | 큰 번들 | 비권장 |

**결론**: `katex` + `react-katex` 조합 권장 (`npm install katex react-katex @types/react-katex`).

### 파일별 변경 내용

| 영역 | 파일 | 변경 내용 | 예상 라인 수 | 작업량 |
|------|------|-----------|-------------|--------|
| 공통 유틸 컴포넌트 신규 | `src/components/ui/latex-renderer.tsx` | LaTeX 파싱 + 렌더링 컴포넌트 생성 | +50~70줄 | S |
| 기출 편집 — 읽기 모드 | `src/app/(dashboard)/past-exams/[id]/edit/question-card.tsx` | `ReadMode` 내 3곳 (`questionText`, `options[i]`, `answer`) 교체 | +10줄 수정 | S |
| 기출 기반 문제 생성 다이얼로그 | `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` | `QuestionCard` 내 4곳 (`content`, `options[i]`, `answer`, `explanation`) 교체 | +12줄 수정 | S |
| 문제 상세 Sheet | `src/app/(dashboard)/questions/_components/question-detail-sheet.tsx` | `detail.content`, `detail.options[i]`, `detail.answer`, `detail.explanation` 교체 | +12줄 수정 | S |
| CSS 임포트 | `src/app/globals.css` 또는 `src/app/layout.tsx` | `import 'katex/dist/katex.min.css'` 추가 | +1줄 | S |
| package.json | `package.json` | katex, react-katex 추가 | +2줄 | S |

**총 변경 파일**: 6개 (신규 1 + 수정 5)
**총 변경 라인**: 약 80~100줄

---

## 호환성 리스크

### 1. Client Component 제약 (낮음)
- LaTeX가 표시되는 모든 컴포넌트가 이미 `'use client'` 선언 파일이다.
  - `question-card.tsx`: `'use client'` (1행)
  - `generate-questions-dialog.tsx`: `'use client'` (1행)
  - `question-detail-sheet.tsx`: `'use client'` (1행)
- `LatexRenderer` 컴포넌트를 `'use client'`로 선언하거나, Server Component에서 사용 시 dynamic import를 사용하면 충돌 없음.
- **리스크 수준**: 낮음 — 현재 사용 지점이 모두 Client Component임.

### 2. SSR 렌더링 (낮음)
- `katex`는 SSR을 지원하지만 `react-katex`의 일부 버전은 hydration mismatch를 유발할 수 있다.
- 대응 방법: `dangerouslySetInnerHTML` 기반 katex 직접 호출 또는 `dynamic()` + `ssr: false` 사용.
- **리스크 수준**: 낮음 — 기존 컴포넌트가 이미 Client-side 전용임.

### 3. 번들 크기 증가 (중간)
- `katex` 추가 시 번들 gzip 기준 ~50KB 증가.
- 현재 `next.config.ts`에 Turbopack 사용 중이며 별도 번들 분석 설정은 없다.
- KaTeX CSS(~20KB gzip)도 추가된다.
- 수학 시험 서비스의 핵심 기능이므로 번들 크기 증가는 충분히 정당화된다.
- **리스크 수준**: 중간 — 성능 영향은 미미하나 번들 예산이 있다면 code splitting 고려.

### 4. 에러 처리 (낮음)
- AI가 유효하지 않은 LaTeX를 생성할 경우 katex 파싱 에러가 발생한다.
- `katex.renderToString(text, { throwOnError: false })` 옵션으로 에러 시 원본 텍스트 폴백 처리 가능.
- **리스크 수준**: 낮음 — 옵션 설정으로 방어 가능.

### 5. Turbopack 호환성 (낮음)
- 현재 `next.config.ts`가 Turbopack(`--turbopack`)을 사용 중이다.
- `katex`는 순수 JavaScript 라이브러리로 Turbopack 호환 문제가 없다.
- **리스크 수준**: 낮음.

### 6. 인라인 vs 블록 수식 혼용 파싱 (중간)
- AI가 `$...$` (인라인)과 `$$...$$` (블록)을 혼용하여 생성한다.
- 단순 `katex.renderToString`은 전체 문자열을 하나의 수식으로 처리하므로, 텍스트와 수식이 혼재된 문자열(`"x의 값은 $\frac{1}{2}$이다"`)을 처리하려면 파싱 로직이 필요하다.
- `react-katex`의 `InlineMath`/`BlockMath` 컴포넌트는 전체를 수식으로 처리하므로 직접 사용 불가.
- **해결책**: 문자열을 `$...$`와 `$$...$$` 구분자로 분리하여 텍스트/수식 세그먼트로 분할하는 헬퍼 함수 필요 (~30줄).
- **리스크 수준**: 중간 — 파싱 로직 구현이 핵심 난이도.

---

## 총 작업량 평가

**M (2-3일)**

근거:
- 라이브러리 설치 + CSS 설정: 0.5일
- `LatexRenderer` 컴포넌트 설계 + 인라인/블록 파싱 로직: 0.5일
- 4개 파일 렌더링 지점 교체 + 에러 처리: 0.5일
- 테스트 (단위 테스트 + 수동 E2E): 0.5~1일
- 엣지 케이스 대응 (부분 LaTeX, 에러 폴백): 0.5일

복잡도 요인:
- 인라인(`$...$`) + 블록(`$$...$$`) + 일반 텍스트가 혼합된 문자열 파싱
- SSR hydration 호환성 검증
- AI 출력의 엣지 케이스 (불완전한 LaTeX 구문)

---

## 권장 구현 순서

1. **[P0] 라이브러리 추가** (`package.json`)
   - `katex`, `react-katex`, `@types/react-katex` 설치
   - `src/app/layout.tsx` 또는 `globals.css`에 `katex/dist/katex.min.css` 임포트

2. **[P0] `LatexRenderer` 공통 컴포넌트 생성** (`src/components/ui/latex-renderer.tsx`)
   - `$...$` / `$$...$$` 구분자 기반 세그먼트 분할 파싱 함수
   - `{ throwOnError: false }` 옵션으로 파싱 실패 시 원본 텍스트 폴백
   - `'use client'` 선언

3. **[P1] 기출 편집 페이지 적용** (`question-card.tsx` — `ReadMode`)
   - `questionText`, `options[i]`, `answer` 필드에 `<LatexRenderer>` 적용
   - 편집 모드(`EditMode`)의 `<Textarea>`는 raw LaTeX 유지

4. **[P1] 문제 생성 다이얼로그 적용** (`generate-questions-dialog.tsx` — `QuestionCard`)
   - `content`, `options[i]`, `answer`, `explanation` 필드 적용

5. **[P1] 문제 상세 Sheet 적용** (`question-detail-sheet.tsx`)
   - `detail.content`, `detail.options[i]`, `detail.answer`, `detail.explanation` 적용

6. **[P2] 단위 테스트 추가** (`src/components/ui/__tests__/latex-renderer.test.tsx`)
   - 인라인 수식, 블록 수식, 혼합 텍스트, 빈 문자열, 잘못된 LaTeX 케이스 검증

7. **[P3] 편집 모드 미리보기 (선택)** — Phase 2 이후
   - `question-card.tsx` `EditMode`에 분할 뷰(편집 | 미리보기) 추가
