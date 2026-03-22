# Wave 4: 단위 테스트 17개

> 마스터 PLAN: docs/plan/latex-rendering.md
> 의존: Wave 1 완료 (테스트 대상 파일 존재)
> 담당: tester
> 커버리지 목표: parseLatexText 90%+, LatexRenderer 80%+
> **상태: ✅ 완료** (파서 22/22 + 렌더러 9/9 = 31 tests ALL PASS)

---

## 사전 조건: jsdom 환경 설정 [M3 반영]

`latex-renderer.test.tsx`는 DOM 환경이 필요하다. 현재 `vitest.config.ts`가 `environment: 'node'`이므로:

**방법 A (파일별 환경 지정 — 권장)**:
```typescript
// latex-renderer.test.tsx 최상단
// @vitest-environment jsdom
```

**방법 B (글로벌 설정)**:
```bash
npm install -D jsdom
```
`vitest.config.ts`에 `environment: 'jsdom'` 추가 — 단, 기존 node 환경 테스트에 영향 있으므로 방법 A 권장.

**latex-parser.test.ts**는 순수 함수 테스트이므로 `node` 환경에서 동작. 설정 변경 불필요.

---

## 변경 파일

| 파일 | 유형 | 라인 수 |
|------|------|---------|
| `src/lib/utils/__tests__/latex-parser.test.ts` | 신규 | ~130줄 |
| `src/components/ui/__tests__/latex-renderer.test.tsx` | 신규 | ~80줄 |

---

## Task 8-a: latex-parser.test.ts (17개 케이스)

### 타입 헬퍼 (테스트 가독성)

```typescript
const text = (content: string): LatexSegment => ({ type: 'text', content })
const inline = (content: string): LatexSegment => ({ type: 'inline', content })
const block = (content: string): LatexSegment => ({ type: 'block', content })
const figure = (index: number, display: 'block' | 'inline'): LatexSegment => ({
  type: 'figure', index, display,
})
```

### 그룹 1: 기본 케이스 (1-5)

| # | 설명 | 입력 | 기대 |
|---|------|------|------|
| 1 | null | `null` | `[]` |
| 2 | undefined | `undefined` | `[]` |
| 3 | 빈 문자열 | `""` | `[]` |
| 4 | 순수 텍스트 | `"안녕하세요"` | `[text('안녕하세요')]` |
| 5 | 이스케이프 `\$` | `"\\$5 가격"` | `[text('\\$5 가격')]` |

### 그룹 2: 수식 (6-9)

| # | 설명 | 입력 | 기대 |
|---|------|------|------|
| 6 | 인라인 단독 | `"$x^2$"` | `[inline('x^2')]` |
| 7 | 블록 단독 | `"$$\\frac{1}{2}$$"` | `[block('\\frac{1}{2}')]` |
| 8 | 텍스트+인라인 혼합 | `"넓이는 $S=\\pi r^2$ 입니다"` | `[text, inline, text]` |
| 9 | 닫히지 않은 `$` | `"$닫히지 않은"` | `[text('$닫히지 않은')]` |

### 그룹 3: 혼합/우선순위 (10-13)

| # | 설명 | 입력 | 기대 |
|---|------|------|------|
| 10 | 블록+텍스트 | `"$$E=mc^2$$ 공식"` | `[block, text]` |
| 11 | 인라인 2개 | `"$a$ + $b$"` | `[inline, text, inline]` |
| 12 | `$$` > `$` 우선순위 | `"$$x^2$$"` | `[block('x^2')]` (블록 1개) |
| 13 | 빈 세그먼트 필터링 | `"$x$"` | `[inline('x')]` (빈 text 없음) |

### 그룹 4: figure [v2] (14-17)

| # | 설명 | 입력 | 기대 |
|---|------|------|------|
| 14 | 텍스트 중간 figure | `"텍스트 {{fig:0}} 계속"` | `[text, figure(0,'inline'), text]` |
| 15 | 연속 figure | `"{{fig:0}}{{fig:1}}"` | `[figure(0,'inline'), figure(1,'inline')]` |
| 16 | 수식+figure 혼합 | `"$x^2$ 와 {{fig:0}}"` | `[inline, text, figure(0,'inline')]` |
| 17 | 줄바꿈 분리 figure | `"{{fig:0}}\n{{fig:1}}"` | `[figure(0,'block'), text('\n'), figure(1,'block')]` |

### describe 구조

```typescript
describe('parseLatexText', () => {
  describe('기본 케이스', () => { /* 1-5 */ })
  describe('수식 파싱', () => { /* 6-9 */ })
  describe('혼합 및 우선순위', () => { /* 10-13 */ })
  describe('figure 세그먼트 [v2]', () => { /* 14-17 */ })
})
```

---

## Task 8-b: latex-renderer.test.tsx

### 테스트 케이스

| 그룹 | 테스트 | 검증 |
|------|--------|------|
| 기본 | null text 크래시 없음 | 빈 렌더링, 에러 없음 |
| 기본 | 순수 텍스트 | `screen.getByText('안녕하세요')` |
| 기본 | className 전달 | wrapper에 클래스 적용 |
| 수식 | 인라인 수식 | `.katex` 클래스 존재 |
| 수식 | 블록 수식 | `.katex-display` 클래스 존재 |
| 수식 | 잘못된 LaTeX | 크래시 없음, 폴백 텍스트 |
| figure [v2] | `{{fig:0}}` | `screen.getByText('[도형 0]')` |
| figure [v2] | `{{fig:2}}` | `screen.getByText('[도형 2]')` |

### 필요 의존성 확인
```bash
# @testing-library/react 미설치 시
npm install -D @testing-library/react @testing-library/jest-dom
```

---

## 실행 명령어

```bash
npx vitest run src/lib/utils/__tests__/latex-parser.test.ts
npx vitest run src/components/ui/__tests__/latex-renderer.test.tsx
```

---

## Wave 4 완료 기준
- [ ] 17개 파서 테스트 GREEN
- [ ] 렌더러 테스트 GREEN
- [ ] `parseLatexText` 커버리지 90%+
- [ ] `LatexRenderer` 커버리지 80%+

---

## 전체 수동 E2E 체크포인트

| # | 위치 | 확인 |
|---|------|------|
| 1 | ReadMode | `$x^2$` → 수식 렌더링 |
| 2 | ReadMode options | 보기 수식 렌더링 |
| 3 | EditMode | Textarea 입력 → 300ms → 미리보기 |
| 4 | EditMode options | Input 포커스 → 해당 보기 미리보기 |
| 5 | Dialog | 생성된 문제 수식 렌더링 |
| 6 | Dialog | explanation 수식 렌더링 |
| 7 | Sheet | content 수식 렌더링 |
| 8 | figure [v2] | `{{fig:0}}` → `[도형 0]` 플레이스홀더 |
