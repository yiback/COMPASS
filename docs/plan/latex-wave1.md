# Wave 1: 기반 설치 + 파서 + 렌더러

> 마스터 PLAN: docs/plan/latex-rendering.md
> 의존: 없음 (최초 Wave)
> SHOULD FIX 반영: S1(figure.display 필드), S3(XSS 근거 문서화)
> 담당: frontend-ui (리드 승인: package.json)
> **상태: ✅ 완료** (Task 1, 2, 3 모두 완료, 빌드 성공)

---

## 변경 파일

| 파일 | 유형 | 라인 수 |
|------|------|---------|
| `package.json` | 수정 (리드 only) | +2줄 |
| `src/app/layout.tsx` | 수정 | +1줄 |
| `src/lib/utils/latex-parser.ts` | 신규 | ~90줄 |
| `src/components/ui/latex-renderer.tsx` | 신규 | ~60줄 |

---

## Task 1: katex 설치 + CSS 전역 import

### 구현

```bash
npm install katex
npm install -D @types/katex
```

`src/app/layout.tsx` 4번 줄 `'./globals.css'` 아래에 추가:
```typescript
import 'katex/dist/katex.min.css'
```

### 완료 기준
- [ ] katex, @types/katex 설치
- [ ] layout.tsx CSS import 추가
- [ ] `npm run build` 성공

---

## Task 2: parseLatexText 유틸 [v2 + S1]

### 파일: `src/lib/utils/latex-parser.ts` (신규)

### 타입 정의 (S1 반영: display 필드)

```typescript
export type LatexSegment =
  | { type: 'text'; content: string }
  | { type: 'inline'; content: string }                              // $...$
  | { type: 'block'; content: string }                               // $$...$$
  | { type: 'figure'; index: number; display: 'block' | 'inline' }  // {{fig:N}}
```

### 파싱 우선순위 (4단계)
1. `$$...$$` — `/\$\$([^$]+)\$\$/g`
2. `{{fig:N}}` — `/\{\{fig:(\d+)\}\}/g`
3. `$...$` — `/(?<!\\)\$([^$\n]+)\$/g`
4. 나머지 텍스트

### display 판단 로직
- `{{fig:N}}` 앞: `\n` 또는 문자열 시작 **AND** 뒤: `\n` 또는 문자열 끝 → `'block'`
- 그 외 → `'inline'`

### 함수 시그니처
```typescript
export function parseLatexText(text: string | null | undefined): LatexSegment[]
```

### 구현 흐름
1. null/undefined/빈 문자열 → `[]`
2. 정규식 단일 패스: cursor 이동하며 `$$` → `{{fig}}` → `$` 순서로 매칭
3. 매치 전 텍스트 → text 세그먼트
4. 매치 유형별 세그먼트 push
5. 빈 text 세그먼트 필터링 (`content.length > 0`)

### 엣지 케이스

| 입력 | 기대 |
|------|------|
| `null` | `[]` |
| `"순수 텍스트"` | `[text]` |
| `"\\$5"` | `[text]` (이스케이프) |
| `"닫히지 않은 $수식"` | `[text]` (폴백) |
| `"{{fig:0}}"` 줄 단독 | `[figure(0, 'block')]` |
| `"텍스트 {{fig:0}} 계속"` | `[text, figure(0,'inline'), text]` |
| `"{{fig:0}}{{fig:1}}"` | `[figure(0,'inline'), figure(1,'inline')]` |
| `"{{fig:0}}\n{{fig:1}}"` | `[figure(0,'block'), text('\n'), figure(1,'block')]` |
| `"{{fig:abc}}"` | `[text]` (`\d+` 불일치) |

### 완료 기준
- [ ] `latex-parser.ts` 생성
- [ ] `LatexSegment` 타입 export (figure에 display 포함)
- [ ] `parseLatexText` 함수 export
- [ ] `npm run build` 성공

---

## Task 3: LatexRenderer 컴포넌트 [v2 + S3]

### 파일: `src/components/ui/latex-renderer.tsx` (신규)

### Props
```typescript
interface LatexRendererProps {
  readonly text: string | null | undefined
  readonly className?: string
}
```

### 세그먼트별 렌더링

| 타입 | 렌더링 |
|------|--------|
| `text` | `<span className="whitespace-pre-wrap">{content}</span>` |
| `inline` | `katex.renderToString({ displayMode: false, throwOnError: false })` → `dangerouslySetInnerHTML` |
| `block` | `katex.renderToString({ displayMode: true, throwOnError: false })` → `dangerouslySetInnerHTML` |
| `figure` | `<span className="inline-flex items-center rounded bg-muted px-1 text-xs text-muted-foreground">[도형 {index}]</span>` |

### XSS 안전성 근거 (S3 반영 — JSDoc 주석 포함)
- KaTeX는 입력 LaTeX를 자체적으로 이스케이프하여 HTML로 변환
- 사용자 입력이 그대로 HTML에 삽입되지 않음
- `throwOnError: false`로 잘못된 LaTeX는 에러 텍스트로 표시
- react-katex, MathJax 등 업계 표준과 동일한 관행

### katex 에러 처리
```typescript
function renderKatex(content: string, displayMode: boolean): string {
  try {
    return katex.renderToString(content, { displayMode, throwOnError: false })
  } catch {
    return content  // 원본 텍스트 폴백
  }
}
```

### 완료 기준
- [ ] `latex-renderer.tsx` 생성 (`'use client'` 포함)
- [ ] `LatexRenderer` 컴포넌트 export
- [ ] XSS 안전성 주석 포함
- [ ] `npm run build` 성공

---

## Wave 1 완료 기준
- [ ] 3개 Task 모두 완료
- [ ] `npm run build` 전체 빌드 에러 없음
- [ ] Wave 2 진입 가능
