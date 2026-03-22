# PLAN: LaTeX 수식 렌더링 + 편집 미리보기

> 작성일: 2026-03-22
> 버전: v2 (도형 `{{fig:N}}` 세그먼트 통합)
> 리서치 기반:
> - docs/research/latex-rendering-recommendation.md
> - docs/research/latex-editor-preview-recommendation.md
> - docs/research/figure-placement-recommendation.md (v2)
> - docs/research/tech/figure-mid-text.md
> - docs/research/feasibility/figure-mid-text.md
> 상태: ✅ 완료 (2026-03-22, 31 tests, E2E 통과)

---

## 1. 개요

AI가 이미 `$...$` / `$$...$$` LaTeX 포맷으로 수식을 생성·저장하고 있지만, UI에서 raw LaTeX 문자열이 그대로 노출된다. 이 PLAN은 10개 수식 표시 지점에 KaTeX 렌더링을 적용하고, EditMode에 Live Preview Below 패턴을 추가한다.

**[v2 변경]** `parseLatexText` 파서에 `{{fig:N}}` 도형 구분자 세그먼트를 처음부터 포함. 단계 1.5-2(도형 렌더링) PLAN이 미작성이므로 `figure` 세그먼트는 `[도형 N]` 텍스트 플레이스홀더로 표시.

**DB 스키마 변경 없음.**

---

## 2. 확정된 기술 결정

| 결정 항목 | 선택 | 근거 |
|----------|------|------|
| 렌더링 라이브러리 | `katex` 코어 직접 사용 | react-katex 미유지보수, React 19 비호환 |
| 렌더링 방식 | Client Component | 10개 지점 모두 `'use client'` |
| 편집 미리보기 | Live Preview Below | Textarea 아래 실시간, 추가 라이브러리 0개 |
| debounce | 300ms | 기존 toolbar 패턴과 일관성 |
| 에러 폴백 | `throwOnError: false` | 잘못된 LaTeX → 에러 텍스트 표시 |
| CSS | `katex/dist/katex.min.css` 전역 import | layout.tsx 1줄 |
| [v2] 도형 구분자 | `{{fig:N}}` 파서 통합 | 단계 1.5-2 선행 작업 |
| [v2] figure 폴백 | `[도형 N]` 플레이스홀더 | FigureRenderer 미구현 시 graceful degradation |

---

## 3. 요구사항

### 수식 표시 지점 (10개 읽기 + 1개 편집)

| 파일 | 컴포넌트 | 필드 | 모드 |
|------|----------|------|------|
| `question-card.tsx` | ReadMode | questionText, options, answer | 읽기 |
| `question-card.tsx` | EditMode | questionText, options, answer | 편집+미리보기 |
| `generate-questions-dialog.tsx` | QuestionCard | content, options, answer, explanation | 읽기 |
| `question-detail-sheet.tsx` | QuestionDetailSheet | content, options, answer, explanation | 읽기 |

### 핵심 기능
1. `$수식$` 인라인, `$$수식$$` 블록 구분 렌더링
2. 잘못된 LaTeX → 에러 폴백 (크래시 없음)
3. 텍스트 + 수식 혼합 문자열 처리
4. EditMode 300ms debounce 미리보기
5. [v2] `{{fig:N}}` 세그먼트 파싱 + 플레이스홀더 표시

---

## 4. Task 분해

### 의존성 그래프

```
Task 1 (katex 설치 + CSS)
  └→ Task 2 (parseLatexText — {{fig:N}} 포함) [v2]
       └→ Task 3 (LatexRenderer — figure 폴백) [v2]
            ├→ Task 4 (ReadMode 적용)
            ├→ Task 5 (generate-questions-dialog)
            ├→ Task 6 (question-detail-sheet)
            └→ Task 7 (EditMode 미리보기)
                 └→ Task 8 (단위 테스트 17개) [v2]
```

---

### Task 1: katex 설치 + CSS 전역 import

**소유**: frontend-ui
**파일**: `package.json` (리드 승인), `src/app/layout.tsx`
**작업**: `npm install katex`, `npm install -D @types/katex`, CSS import 1줄
**의존**: 없음 | **작업량**: XS

---

### Task 2: parseLatexText 유틸 [v2 변경]

**소유**: frontend-ui
**파일**: `src/lib/utils/latex-parser.ts` (신규)

**[v2] 세그먼트 타입**:
```typescript
type LatexSegment =
  | { type: 'text'; content: string }
  | { type: 'inline'; content: string }   // $...$
  | { type: 'block'; content: string }    // $$...$$
  | { type: 'figure'; index: number; display: 'block' | 'inline' }  // {{fig:N}} [v2 추가, S1+M1 반영]
```

**[v2] 파싱 우선순위 (4단계)**:
1. `$$...$$` 블록 수식
2. `{{fig:N}}` 도형 구분자 — 정규식 `/\{\{fig:(\d+)\}\}/g`
3. `$...$` 인라인 수식
4. 나머지 텍스트

**엣지 케이스**:
- `$$` > `{{fig}}` > `$` 우선순위
- 이스케이프 `\$` → 텍스트
- null/undefined → 빈 배열
- 닫히지 않은 `$` → 텍스트 폴백
- [v2] 연속 `{{fig:0}}{{fig:1}}` → `[figure(0), figure(1)]`
- [v2] `{{fig:0}}\n{{fig:1}}` → `[figure(0), text('\n'), figure(1)]`
- [v2] 잘못된 fig (`{{fig:abc}}`) → 텍스트 처리

**의존**: Task 1 | **작업량**: S

---

### Task 3: LatexRenderer 컴포넌트 [v2 변경]

**소유**: frontend-ui
**파일**: `src/components/ui/latex-renderer.tsx` (신규)

**세그먼트별 렌더링**:
- `text` → `<span>` 텍스트
- `inline` → `katex.renderToString({ displayMode: false })` → `dangerouslySetInnerHTML`
- `block` → `katex.renderToString({ displayMode: true })` → `dangerouslySetInnerHTML`
- [v2] `figure` → `<span className="...">[도형 {index}]</span>` 플레이스홀더

**Props**: `text: string`, `className?: string`
**의존**: Task 2 | **작업량**: S

---

### Task 4: ReadMode 적용

**소유**: frontend-ui
**파일**: `question-card.tsx` (ReadMode 3곳)
**의존**: Task 3 | **작업량**: XS

---

### Task 5: generate-questions-dialog 적용

**소유**: frontend-ui
**파일**: `generate-questions-dialog.tsx` (4곳)
**의존**: Task 3 | **작업량**: XS

---

### Task 6: question-detail-sheet 적용

**소유**: frontend-ui
**파일**: `question-detail-sheet.tsx` (4곳)
**의존**: Task 3 | **작업량**: XS

---

### Task 7: EditMode Live Preview Below

**소유**: frontend-ui
**파일**: `question-card.tsx` (인라인 debounce — `use-debounce.ts` 생성 취소, S2 반영)

**작업**:
1. 인라인 `useEffect + setTimeout` debounce (기존 toolbar 패턴과 동일)
2. questionText Textarea 아래 미리보기 패널 (`max-h-32 overflow-y-auto`)
3. options: Input 포커스 시에만 미리보기 (`focusedOptionIndex` state)
4. answer: 포커스 시 미리보기

**의존**: Task 3, Task 4 완료 후 (동일 파일 직렬) | **작업량**: S

---

### Task 8: 단위 테스트 [v2 변경: 13 → 17개]

**소유**: tester
**파일**: `src/lib/utils/__tests__/latex-parser.test.ts`, `src/components/ui/__tests__/latex-renderer.test.tsx`

**v2 추가 테스트 케이스 (+4개)**:

| # | 입력 | 기대 |
|---|------|------|
| 14 | `"텍스트 {{fig:0}} 계속"` | `[text, figure(0), text]` |
| 15 | `"{{fig:0}}{{fig:1}}"` | `[figure(0), figure(1)]` |
| 16 | `"$x^2$ 와 {{fig:0}}"` | `[inline, text, figure(0)]` |
| 17 | `"{{fig:0}}\n{{fig:1}}"` | `[figure(0), text('\n'), figure(1)]` |

**의존**: Task 2, 3 | **작업량**: S

---

## 5. 구현 순서

```
Wave 1 (직렬): Task 1 → Task 2 → Task 3
Wave 2 (병렬): Task 4 + Task 5 + Task 6
Wave 3 (직렬): Task 7 (Task 4 완료 후 — 동일 파일)
Wave 4: Task 8
```

---

## 6. 파일 소유권

| 파일 | 역할 | Wave |
|------|------|------|
| `package.json` | **리드 only** | 1 |
| `src/app/layout.tsx` | frontend-ui | 1 |
| ~~`src/lib/hooks/use-debounce.ts`~~ | ~~취소 (S2)~~ — 인라인 패턴 | — |
| `src/lib/utils/latex-parser.ts` (신규) | frontend-ui | 1 |
| `src/components/ui/latex-renderer.tsx` (신규) | frontend-ui | 1 |
| `question-card.tsx` | frontend-ui | 2, 3 |
| `generate-questions-dialog.tsx` | frontend-ui | 2 |
| `question-detail-sheet.tsx` | frontend-ui | 2 |
| `latex-parser.test.ts` (신규) | tester | 4 |
| `latex-renderer.test.tsx` (신규) | tester | 4 |

---

## 7. 에러 처리

| 에러 상황 | 처리 |
|----------|------|
| 잘못된 LaTeX | `throwOnError: false` → 에러 텍스트 |
| 닫히지 않은 `$` | 텍스트 폴백 |
| null/undefined text | 빈 문자열 변환 |
| katex 런타임 예외 | try/catch → 원본 텍스트 |
| CSS 미로드 | layout.tsx 전역 import |
| [v2] figure 세그먼트 | `[도형 N]` 플레이스홀더 |
| [v2] 잘못된 fig 구문 | 텍스트 처리 |

---

## 8. 테스트 전략

- **parseLatexText**: 17개 케이스 (Vitest)
- **LatexRenderer**: 렌더링 + aria-label + [v2] figure 폴백 (Vitest + testing-library)
- **debounce**: 인라인 패턴이므로 별도 테스트 불필요 (EditMode 수동 E2E로 검증)
- **수동 E2E**: 8포인트 ([v2] figure 플레이스홀더 2개 포함)
- **커버리지**: parseLatexText 90%+, LatexRenderer 80%+

---

## 9. 리스크

| 리스크 | 수준 | 완화 |
|--------|------|------|
| `$...$` 파서 엣지 케이스 | 중간 | 17개 단위 테스트 |
| KaTeX CSS 누락 | 중간 | layout.tsx 전역 import |
| Accordion 높이 변화 | 중간 | `max-h-32 overflow-y-auto` |
| Task 4·7 동일 파일 | 낮음 | Wave 2→3 직렬 |
| [v2] `{{fig:N}}` 파싱 충돌 | 낮음 | LaTeX에서 `{{` 미사용 |
| [v2] figure 플레이스홀더 노출 | 낮음 | 1.5-2 PLAN 후 FigureRenderer 교체 |

---

## 10. v2 변경 요약

| 항목 | v1 | v2 |
|------|----|----|
| LatexSegment 타입 | 3종 | 4종 (+ `figure`) |
| 파싱 우선순위 | 3단계 | 4단계 (+ `{{fig:N}}`) |
| LatexRenderer figure | 없음 | `[도형 N]` 플레이스홀더 |
| 테스트 케이스 | 13개 | 17개 |
| 수동 E2E | 6포인트 | 8포인트 |

---

## 11. Plan Review Completion Checklist

- [x] 모든 Task의 파일 소유권이 명확하다
- [x] Task 간 의존성 순서가 정의되었다
- [x] 외부 의존성(`katex`, `@types/katex`)이 명시되었다
- [x] 에러 처리 방식이 정해졌다
- [x] 테스트 전략이 있다 (17개 케이스 + 8 E2E)
- [x] 이전 Phase 회고 교훈 반영 (MEMORY.md)
- [x] 병렬 구현 시 파일 충돌 없다

**판정: READY**
