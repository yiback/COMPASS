# LaTeX 렌더링 도입 — 추천안

> **리서치 기반**: `docs/research/tech/latex-rendering.md` + `docs/research/feasibility/latex-rendering.md`
> **작성일**: 2026-03-22

---

## 추천: katex 코어 직접 사용 (Client Component)

```
npm install katex
npm install -D @types/katex
```

**react-katex 래퍼는 사용하지 않는다** — 2022년 이후 미업데이트, React 19 peer dep 경고, `$...$` 혼합 텍스트 파싱 미지원.

---

## 핵심 근거

| 판단 기준 | 결정 | 이유 |
|-----------|------|------|
| 라이브러리 | katex 코어만 | react-katex 미유지보수 + React 19 비호환 위험 |
| 렌더링 위치 | Client Component | 모든 표시 지점(10곳)이 이미 `'use client'` |
| Server Component? | 불필요 | 기존 구조 리팩토링 대비 이점 미미 |
| MathJax? | 비채택 | 번들 300KB+, 비동기 렌더링 → 레이아웃 시프트 |
| remark-math? | 비채택 | 동적 DB 문자열 처리 불가 (MDX 전용) |

---

## 변경 범위

- **DB 스키마 변경**: 없음 (AI가 이미 `$...$` LaTeX로 생성·저장 중)
- **신규 파일 1개**: `src/components/ui/latex-renderer.tsx` (~50줄)
  - `$...$` / `$$...$$` 구분자 기반 세그먼트 분할 파싱 함수
  - `katex.renderToString()` + `throwOnError: false` 폴백
  - `dangerouslySetInnerHTML` 사용 (AI 출력이므로 XSS 위험 낮음)
- **수정 파일 4개**: 총 ~35줄 수정
  - `question-card.tsx` ReadMode (3곳)
  - `generate-questions-dialog.tsx` QuestionCard (4곳)
  - `question-detail-sheet.tsx` (4곳)
  - `layout.tsx` — `import 'katex/dist/katex.min.css'` 1줄
- **총 작업량**: **M (2-3일)** — 핵심 난이도는 혼합 텍스트 파싱 유틸

---

## 주요 리스크 3가지

1. **혼합 텍스트 파싱**: `"x의 값은 $\frac{1}{2}$이다"` → 텍스트/수식 세그먼트 분할 필요. 중첩 `$` 엣지 케이스 주의
2. **KaTeX CSS 누락**: `katex.min.css` import 빠뜨리면 수식 레이아웃 깨짐. layout.tsx에서 전역 import
3. **번들 크기 ~50KB(gzip)**: 수학 시험 서비스 핵심 기능이므로 정당화됨. code splitting으로 최적화 가능

---

## 구현 순서 (권장)

1. `katex` 설치 + CSS 전역 import
2. `LatexRenderer` 컴포넌트 생성 (파싱 유틸 포함)
3. 10개 표시 지점에 `<LatexRenderer>` 적용
4. 단위 테스트 (인라인/블록/혼합/에러 폴백)
5. E2E 수동 검증
