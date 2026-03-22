# LaTeX 렌더링 기술 비교

## 요약

수학 시험 서비스인 COMPASS에서 AI 생성 문제의 LaTeX 수식 렌더링 라이브러리를 비교 분석한 결과, **KaTeX를 Server Component에서 직접 렌더링하는 방식**을 1순위로 추천한다. 렌더링 속도, 번들 크기, Next.js App Router와의 SSR 호환성 면에서 KaTeX가 최적이며, `react-katex` 래퍼 대신 `katex` 코어를 Server Component에서 직접 호출하면 클라이언트 번들을 0으로 줄일 수 있다.

---

## 비교표

| 기준 | katex (Server Component) | react-katex (Client) | better-react-mathjax | remark-math + rehype-katex |
|---|---|---|---|---|
| JS 번들 크기 (gzip) | **0 KB** (서버 렌더링) | ~234 KB | ~6 KB 래퍼 + MathJax CDN | ~234 KB (katex 포함) |
| CSS + 폰트 | katex.css (~280 KB 폰트) | katex.css (~280 KB 폰트) | MathJax 자체 폰트 | katex.css (~280 KB 폰트) |
| 렌더링 성능 | 매우 빠름 (동기, 서버) | 빠름 (동기, 클라이언트) | 느림 (비동기, 클라이언트) | 매우 빠름 (빌드 타임) |
| SSR/RSC 호환성 | **완전 호환** | 클라이언트 전용 | 클라이언트 전용 | 빌드 타임 (MDX 전용) |
| React 19 호환성 | **문제없음** (React 의존 없음) | peer dep 경고 가능 | peer dep 경고 가능 | **문제없음** (React 의존 없음) |
| TypeScript 지원 | `@types/katex` 별도 설치 | 번들 포함 | 번들 포함 | 각각 타입 제공 |
| LaTeX 커버리지 | 고등수학 수준 충분 | 동일 (katex 코어) | MathJax: 거의 완전 | 동일 (katex 코어) |
| 접근성 | 제한적 (MathML 숨김) | 제한적 | 우수 (ARIA 자동 생성) | 제한적 (katex 동일) |
| 유지보수 상태 | 활발 (Khan Academy) | 마지막 업데이트 오래됨 | 활발 | 활발 |
| 적용 복잡도 | 낮음 | 낮음 | 중간 | 높음 (MDX 파이프라인 필요) |

---

## 각 옵션 상세 분석

### 1. KaTeX (katex 코어 + Server Component)

**개요**
Khan Academy가 개발한 빠른 수식 렌더링 라이브러리. Node.js에서 직접 HTML 문자열로 렌더링 가능하므로, Server Component에서 `katex.renderToString()`을 호출하면 클라이언트 JS 번들에 katex가 포함되지 않는다.

**번들 크기**
- JS: 서버에서만 실행 → 클라이언트 번들 기여 **0 KB**
- CSS: `katex/dist/katex.min.css` (~28 KB minified)
- 폰트: KaTeX 전용 폰트 파일 약 280 KB (KaTeX_Math, KaTeX_Main 등 woff2)
- Bundlephobia 기준 katex 코어: minified 346 KB / gzipped ~111 KB (클라이언트 사용 시)

**렌더링 성능**
- 동기 렌더링. 리플로우 없음.
- 서버에서 렌더링하면 클라이언트는 이미 완성된 HTML을 수신 → 레이아웃 시프트 없음.

**SSR/RSC 호환성**
- `katex.renderToString()`: 브라우저 API 미사용, Node.js에서 완전 동작
- Server Component에서 직접 호출 가능 — 가장 이상적인 방식

```typescript
// Server Component 예시 (참고용 — 실제 구현 시 적용)
import katex from 'katex'

interface MathProps {
  expression: string
  block?: boolean
}

export function Math({ expression, block = false }: MathProps) {
  const html = katex.renderToString(expression, {
    throwOnError: false,
    displayMode: block,
  })
  return (
    <span
      dangerouslySetInnerHTML={{ __html: html }}
      aria-label={expression}
    />
  )
}
```

**React 19 호환성**
- katex 코어 자체는 React에 의존하지 않으므로 호환성 문제 없음

**TypeScript 지원**
- `@types/katex` 별도 설치 필요 (`npm i -D @types/katex`)
- 타입 정의 품질 양호

**LaTeX 커버리지**
- 분수(`\frac`), 루트(`\sqrt`), 적분(`\int`), 합(`\sum`), 행렬(`pmatrix`, `bmatrix`), 극한(`\lim`), 삼각함수, 지수/로그 등 한국 중고등 수학 교육과정 전범위 지원
- 일부 고급 TeX 매크로 미지원 (Tikz 등 그래픽 제외)

**접근성**
- 숨겨진 MathML 포함하지만 스크린 리더가 완전히 읽지 못하는 이슈 있음
- `aria-label` 수동 추가 권장

**커뮤니티**
- GitHub Stars: ~18,000+
- npm 주간 다운로드: ~1,500,000+
- 유지보수: Khan Academy 주도, 활발한 업데이트

---

### 2. react-katex / @matejmazur/react-katex

**개요**
katex 코어를 React 컴포넌트로 래핑한 라이브러리. `<InlineMath>`, `<BlockMath>` 컴포넌트 제공.

**번들 크기**
- react-katex: ~1.18 MB (unpacked), katex 코어 포함
- `'use client'` 필수 → 클라이언트 번들에 katex JS 전체 포함

**렌더링 성능**
- 클라이언트에서 동기 렌더링 → 빠르지만 초기 로드 시 JS 파싱 비용 발생
- Hydration 후 렌더링이므로 Server Component보다 레이아웃 시프트 가능성 있음

**SSR/RSC 호환성**
- `'use client'` 필수 — Server Component에서 직접 사용 불가
- Next.js App Router에서 클라이언트 컴포넌트로만 동작

**React 19 호환성**
- react-katex: 마지막 배포 2022년 (2년+ 미업데이트), peer deps가 `react@^16 || ^17 || ^18`로 선언되어 있어 React 19에서 peer dep 경고 발생 가능
- `--legacy-peer-deps`로 설치 우회 가능하나, 장기 유지 관점에서 리스크

**TypeScript 지원**
- 타입 정의 내장, 품질 양호

**LaTeX 커버리지**
- katex 코어와 동일

**커뮤니티**
- react-katex npm 주간 다운로드: ~130,000
- GitHub Stars: ~426
- 유지보수: 장기 미업데이트 상태 — **위험 신호**

---

### 3. better-react-mathjax

**개요**
MathJax 3.x를 React로 래핑한 라이브러리. `<MathJaxContext>` 프로바이더 + `<MathJax>` 컴포넌트 구조.

**번들 크기**
- 래퍼 자체: ~6 KB (gzip ~2.3 KB)
- 그러나 MathJax 3.x를 CDN 또는 자체 호스팅으로 로드해야 함: ~89 KB (gzip) — HTML+CSS+SVG 렌더러 선택에 따라 다름
- 총 추가 크기: MathJax 엔진 ~300~900 KB (폰트 포함)

**렌더링 성능**
- 비동기 렌더링: 초기 로드 후 수식이 늦게 나타남 → 레이아웃 시프트(CLS) 발생 가능
- MathJax 3는 v2 대비 대폭 개선되었으나 KaTeX보다 여전히 느림

**SSR/RSC 호환성**
- 클라이언트 전용 (`'use client'` 필수)
- Server Component 미지원

**React 19 호환성**
- better-react-mathjax 2.x: peer deps `react@>=16.8.0` — React 19 경고 가능성 있음
- 기능 동작 자체는 문제없을 가능성 높음

**TypeScript 지원**
- 타입 정의 내장, 품질 양호

**LaTeX 커버리지**
- MathJax는 거의 완전한 LaTeX 커버리지 제공 (KaTeX 미지원 고급 매크로 포함)
- 한국 교육과정 수식에서는 KaTeX와 차이 없음

**접근성**
- **가장 우수**: ARIA 레이블 자동 생성, MathML 출력, 스크린 리더 완전 지원
- MathJax의 접근성 익스텐션이 음성 문자열 자동 생성

**커뮤니티**
- better-react-mathjax npm 주간 다운로드: ~35,000
- 유지보수: 활발

---

### 4. remark-math + rehype-katex

**개요**
Markdown/MDX 파이프라인에서 수식을 처리하는 방식. remark-math가 `$...$`를 파싱하고, rehype-katex가 빌드 타임에 HTML로 변환.

**번들 크기**
- 빌드 타임 렌더링이므로 런타임 JS 번들 기여 없음
- CSS는 클라이언트에서 로드 필요 (`katex.min.css`)

**렌더링 성능**
- 빌드 타임 완전 사전 렌더링 → 런타임 연산 없음, 최고 성능
- 단, 동적 수식(사용자 입력 또는 AI 생성 실시간 텍스트)에는 적용 불가

**SSR/RSC 호환성**
- MDX/Markdown 문서에서만 동작
- **COMPASS의 AI 생성 문제 텍스트에는 적용 불가** — DB에서 가져온 동적 문자열 처리 불가

**React 19 호환성**
- React에 의존하지 않으므로 호환성 문제 없음

**TypeScript 지원**
- 각 패키지 타입 정의 제공

**LaTeX 커버리지**
- katex 코어와 동일

**COMPASS 적용 가능성**
- 현재 문제 텍스트가 DB에서 동적으로 로드되는 구조이므로 **직접 적용 불가**
- 블로그/정적 문서에 최적화된 방식

---

### 5. 기타 주목할 대안

#### react-latex-next
- KaTeX 기반, `$...$` 패턴을 텍스트에서 자동 감지하여 렌더링
- COMPASS 사용 패턴(AI가 생성한 텍스트에서 `$...$` 추출)에 가장 근접
- 단, 클라이언트 컴포넌트 필수, 유지보수 상태 확인 필요
- npm 주간 다운로드: 약 20,000

#### MathLive (mathlive)
- 수식 **편집기** 기능 포함 (인터랙티브 수식 입력 UI)
- 렌더링 전용이 아닌 편집 기능이 필요할 때 적합
- COMPASS 미래 로드맵(학생 수식 입력)에서 검토 가치 있음

---

## 추천 및 근거

### 1순위 추천: **katex 코어 + Server Component 직접 렌더링**

```
npm install katex
npm install -D @types/katex
```

**추천 근거:**

1. **클라이언트 번들 0 KB**: Server Component에서 `katex.renderToString()` 호출 시 katex JS가 클라이언트 번들에 포함되지 않음. 수학 시험 서비스이므로 수식이 많아 번들 절약 효과 큼.

2. **React 19 완전 호환**: katex 코어는 React에 의존하지 않으므로 peer dep 문제 없음.

3. **레이아웃 시프트 없음**: 서버에서 이미 렌더링된 HTML 전달 → 수식 위치가 SSR 시점에 확정됨.

4. **기존 코드 최소 수정**: `question-card.tsx`의 `<p>{question.questionText}</p>` 부분에 텍스트 파서를 적용하여 `$...$` 구간만 katex 렌더링으로 교체. 컴포넌트 구조 변경 불필요.

5. **AI 프롬프트 현황**: `question-generation.ts`에서 이미 `$...$` 인라인, `$$...$$` 블록 LaTeX를 출력하도록 지시하고 있어 파싱 규칙이 단순.

**구현 방향 (참고용):**

```typescript
// 텍스트에서 $...$ 구간을 찾아 katex HTML로 교체하는 유틸
// Server Component에서 호출하거나, 파싱 결과를 클라이언트로 전달
import katex from 'katex'

export function renderLatexText(text: string): string {
  // $$...$$ 블록 먼저 처리, 그다음 $...$ 인라인
  // dangerouslySetInnerHTML로 출력 시 CSS 필요
}
```

### 2순위 대안: **react-latex-next** (클라이언트 컴포넌트 허용 시)

- `$...$` 텍스트 자동 파싱 기능이 내장되어 구현 공수 최소화
- 단, 클라이언트 번들에 katex 포함됨 (~234 KB gzip)
- Server Component 불가 시 차선책

---

## 주요 리스크

### 1. CSS 글로벌 로드 필요
`katex.min.css`를 `layout.tsx` 또는 페이지 레벨에서 import해야 한다. 누락 시 수식 레이아웃 깨짐.

```typescript
// app/layout.tsx 또는 관련 페이지
import 'katex/dist/katex.min.css'
```

### 2. 폰트 파일 Vercel CDN 캐싱
katex CSS가 참조하는 폰트 파일(~280 KB)이 katex 패키지에 포함되어 있다. Next.js의 static assets 처리를 통해 자동 제공되나, `next.config.ts`의 `assetPrefix` 설정에 따라 경로 문제가 생길 수 있다.

### 3. `dangerouslySetInnerHTML` 사용
katex.renderToString() 출력을 DOM에 삽입하려면 `dangerouslySetInnerHTML`이 필요하다. katex 출력은 수식 표현식(사용자 입력이 아닌 AI 출력)을 렌더링하므로 XSS 위험은 낮지만, `throwOnError: false` 옵션으로 잘못된 LaTeX 입력을 graceful하게 처리해야 한다.

### 4. react-katex 유지보수 위험
react-katex(래퍼)는 2022년 이후 업데이트가 없다. React 19와의 peer dep 충돌 발생 시 수정을 기대하기 어렵다. 래퍼 대신 katex 코어 직접 사용 또는 react-latex-next를 대안으로 유지해야 한다.

### 5. 접근성 한계
KaTeX의 숨겨진 MathML은 일부 스크린 리더에서 읽히지 않는다. 교육 서비스 특성상 접근성이 중요하다면, `aria-label={rawLatexExpression}` 수동 추가가 필요하다. MathJax(better-react-mathjax)가 접근성 면에서 우위이나, 성능/번들 trade-off를 감수해야 한다.

### 6. Server Component에서 동적 텍스트 파싱 구현 필요
react-katex처럼 `$...$` 자동 파싱을 제공하는 Server Component 호환 래퍼가 없으므로, 텍스트에서 LaTeX 구간을 직접 파싱하는 유틸 함수를 구현해야 한다. 정규표현식 기반 파서는 중첩 `$` 처리 등 엣지 케이스가 있다.

---

## 참고 자료

- [KaTeX 공식 문서](https://katex.org/)
- [katex npm](https://www.npmjs.com/package/katex)
- [Bundlephobia: katex](https://bundlephobia.com/package/katex)
- [KaTeX 접근성 이슈 #38](https://github.com/KaTeX/KaTeX/issues/38)
- [KaTeX 접근성 토론 #3120](https://github.com/KaTeX/KaTeX/discussions/3120)
- [MathJax 접근성 공식 문서](https://docs.mathjax.org/en/latest/basic/accessibility.html)
- [better-react-mathjax GitHub](https://github.com/fast-reflexes/better-react-mathjax)
- [remark-math GitHub](https://github.com/remarkjs/remark-math)
- [Next.js KaTeX 토론](https://github.com/vercel/next.js/discussions/54852)
- [KaTeX vs MathJax 비교](https://biggo.com/news/202511040733_KaTeX_MathJax_Web_Rendering_Comparison)
- [HTMHell 2025 수학 접근성](https://www.htmhell.dev/adventcalendar/2025/12/)
