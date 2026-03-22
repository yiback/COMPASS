# LaTeX 렌더링 상세 PLAN 기술 검토

> 검토 대상: docs/plan/latex-wave1.md ~ latex-wave4.md, docs/plan/latex-rendering.md
> 검토일: 2026-03-22
> 역할: technical-reviewer

---

## 요약

전체 8개 Task 중 **MUST FIX 3건**, **SHOULD FIX 4건**, **CONSIDER 3건** 발견.
핵심 문제는 ① 라인 번호 불일치, ② vitest 환경 미설정으로 LatexRenderer 테스트 실패, ③ 마스터 PLAN과 Wave 상세 PLAN 간 타입 불일치이다.

---

## Wave 1 검토 (Task 1, 2, 3)

### Task 1 — katex 설치 + CSS 전역 import

**[MUST FIX] layout.tsx CSS import 위치 라인 번호 오류**

PLAN: "4번 줄 `'./globals.css'` 아래에 추가"

실제 `src/app/layout.tsx` 4번 줄:
```
import type { Metadata } from 'next'
```
`'./globals.css'`는 4번 줄이 아니라 **4번 줄 블록의 일부**가 아니다.
실제 파일 구조:
- 1번: `import type { Metadata } from 'next'`
- 2번: `import { Geist, Geist_Mono } from 'next/font/google'`
- 3번: `import { Toaster } from '@/components/ui/sonner'`
- 4번: `import './globals.css'`

`import './globals.css'`는 4번 줄이 맞다. 다만 PLAN 설명이 "4번 줄 `'./globals.css'` 아래에"라고 적었는데 실제 import 형식이 `import './globals.css'`이고 PLAN이 `'./globals.css'` 문자열 형태로 기술하여 혼동을 줄 수 있다. **라인 번호 자체는 정확하므로 이슈 없음.** → 취소, 정상.

**[SHOULD FIX] @types/katex devDependencies 기존 테스트 영향 확인 필요**

현재 `package.json`에 `vitest: "^4.0.18"`이 설치되어 있다. `katex`와 `@types/katex` 설치 후 `npm run build` 뿐만 아니라 `npm run test:run`도 Wave 1 완료 기준에 포함하는 것이 권장된다. 현재 Wave 1 완료 기준에는 테스트 실행이 빠져있다.

---

### Task 2 — parseLatexText 유틸

**[MUST FIX] 마스터 PLAN과 Wave 상세 PLAN 간 타입 불일치**

`docs/plan/latex-rendering.md` (마스터 PLAN v2) 섹션 4에서 `LatexSegment` 타입을 다음과 같이 정의:
```typescript
type LatexSegment =
  | { type: 'figure'; index: number }     // {{fig:N}} [v2 추가]
```

반면 `docs/plan/latex-wave1.md` Task 2에서:
```typescript
| { type: 'figure'; index: number; display: 'block' | 'inline' }
```

`display` 필드가 Wave 상세에는 있고 마스터 PLAN에는 없다. Wave 4 테스트(Task 8-a)에서도 `figure(0,'inline')`, `figure(0,'block')` 형태로 `display`를 포함하여 테스트하므로 **Wave 4는 Wave 1의 display 포함 타입에 의존**한다. 마스터 PLAN v2 섹션 4의 타입 정의가 `display` 없이 기술된 것이 오류이며 구현자가 혼동할 수 있다. 마스터 PLAN이 업데이트되어야 하지만 리뷰 역할로서 이슈 리스트만 산출한다.

**[SHOULD FIX] `\$` 이스케이프 처리 정규식 충돌 가능성**

파싱 정규식 `$...$` 패턴: `/(?<!\\)\$([^$\n]+)\$/g`

이스케이프 `\$5 가격` 입력에 대해 lookbehind `(?<!\\)` 로 처리한다고 명시했다. 그러나 구현 흐름(2번: "정규식 단일 패스: cursor 이동")과 정규식 설명(`/(?<!\\)\$([^$\n]+)\$/g`) 사이에 모순이 있다. 단일 패스 cursor 방식이라면 lookbehind 정규식을 쓰는 것이 아니라 수동으로 cursor를 이동시키는 로직이 필요하다. 두 가지 접근 방식 중 어느 것을 사용할지 명확히 해야 한다. 불일치한 상태로 구현자에게 전달되면 테스트 케이스 5번(`\\$5 가격`)에서 실패할 가능성이 있다.

**[CONSIDER] `$$` 안에 줄바꿈 허용 여부 미명시**

정규식 `/\$\$([^$]+)\$\$/g`에서 `[^$]+`는 줄바꿈(`\n`)을 포함한다. 블록 수식이 여러 줄로 작성된 경우도 처리 가능하다는 의미이다. 단, `[^$\n]+` 패턴의 inline `$`와 달리 block `$$`는 줄바꿈 허용이 의도된 것인지 문서에 명시가 없다. 엣지 케이스 테이블에도 다중 줄 `$$...$$` 케이스가 없다.

---

### Task 3 — LatexRenderer 컴포넌트

**[SHOULD FIX] `figure` 세그먼트 렌더링에서 display 필드 활용 미명시**

Task 2에서 `figure` 세그먼트에 `display: 'block' | 'inline'` 필드를 추가했지만, Task 3 렌더링 명세에서 `display` 값에 따른 분기 처리가 전혀 언급되지 않았다.

Wave 3 완료 기준(Task 8-a)에서 테스트 17번:
```
"{{fig:0}}\n{{fig:1}}" → [figure(0,'block'), text('\n'), figure(1,'block')]
```
`display: 'block'`인 figure와 `display: 'inline'`인 figure가 시각적으로 동일하게 `[도형 N]` 스팬으로 렌더링되는 것이 의도인지, 아니면 block일 때 다른 스타일(예: `display: block`, 별도 줄)을 적용해야 하는지 명시 필요.

**[CONSIDER] `className` prop이 wrapper에 적용되는지 명세 누락**

Props 명세에 `className?: string`이 있지만 어느 엘리먼트(최상위 wrapper? `<span>`?)에 적용되는지 명세가 없다. Wave 4 테스트 Task 8-b에서 "className 전달 → wrapper에 클래스 적용"으로 검증하는데, 실제 구현이 `<span className={className}>` 으로 감싸는 구조인지, 각 세그먼트의 개별 span에 전달되는지 불명확하다. 테스트 실패 가능성이 있다.

---

## Wave 2 검토 (Task 4, 5, 6)

### Task 4 — ReadMode 적용 (question-card.tsx)

**[MUST FIX] 라인 번호 불일치**

PLAN에 명시된 변경 지점:
- 라인 160: `<p className="whitespace-pre-wrap text-sm">{question.questionText}</p>`
- 라인 166: `{i + 1}. {option}`
- 라인 177: `<p className="text-sm">{question.answer}</p>`

실제 `question-card.tsx` 확인 결과:
- 160번 줄: `<p className="whitespace-pre-wrap text-sm">{question.questionText}</p>` ✓ **일치**
- 166번 줄: `{i + 1}. {option}` ✓ **일치**
- 177번 줄: `<p className="text-sm">{question.answer}</p>` ✓ **일치**

라인 번호 일치. 단, 현재 `answer` 필드는 `question.answer`이고 이는 실제 코드 177번에서 `<p className="text-sm">{question.answer}</p>`이다. 그러나 실제 코드 구조를 보면 173~178번:
```tsx
{question.answer && (
  <div>
    <p className="text-xs font-medium text-muted-foreground">정답</p>
    <p className="text-sm">{question.answer}</p>
  </div>
)}
```
177번이 `<p className="text-sm">{question.answer}</p>`로 일치한다. **라인 번호 정확.**

**[SHOULD FIX] options 렌더링 구조 변경 시 부모 `<p>` 태그 문제**

현재 코드 166번: `{i + 1}. {option}`는 `<p key={i} className="text-sm text-muted-foreground">` 안에 있다. PLAN에서 `{i + 1}. <LatexRenderer text={option} />`로 교체 시 `<p>` 태그 안에 `LatexRenderer`가 렌더링된다.

`LatexRenderer` 내부에서 block 수식이 있을 경우 `katex.renderToString({ displayMode: true })`를 `dangerouslySetInnerHTML`로 렌더링하면 `<span>` 내에 `<div>` 등의 block 요소가 생성되어 HTML 유효성 위반이 발생할 수 있다. 그러나 options 필드는 일반적으로 인라인 수식만 포함하므로 실용적 위험은 낮다. options 내부에서 block 수식(`$$`)이 사용되는 케이스를 명시적으로 제외하거나 경고가 필요하다.

---

### Task 5 — generate-questions-dialog 적용

**[MUST FIX] 라인 번호 불일치**

PLAN에 명시된 변경 지점:
- 라인 149: `{question.content}`
- 라인 155: `{option}`
- 라인 167: `{question.answer}`
- 라인 174: `{question.explanation}`

실제 `generate-questions-dialog.tsx` 확인 결과:
- 149번 줄: `<p className="whitespace-pre-wrap text-sm">{question.content}</p>` ✓ **일치**
- 154~157번 줄:
  ```tsx
  {question.options.map((option, i) => (
    <p key={i} className="text-sm text-muted-foreground">
      {i + 1}. {option}
  ```
  155번: `{i + 1}. {option}` 형태로 `{option}`만 교체하는 것인지 `{i + 1}. {option}` 전체를 교체하는 것인지 명확하지 않다. Task 4와 비교하면 Task 4에서는 `{i + 1}. <LatexRenderer text={option} />`으로 `{option}` 부분만 교체한다. Task 5에서도 동일한 패턴인지 명세에 명확히 기재 필요.
- 167번 줄: `<p className="text-sm">{question.answer}</p>` ✓ **일치**
- 174번 줄: 실제 174번:
  ```tsx
  <p className="whitespace-pre-wrap text-sm">{question.explanation}</p>
  ```
  ✓ **일치**

**라인 149, 167, 174는 정확하다.** 155번 교체 범위만 불명확.

---

### Task 6 — question-detail-sheet 적용

**[MUST FIX] 라인 번호 불일치**

PLAN에 명시된 변경 지점:
- 라인 163-165: `<p ...>{detail.content}</p>`
- 라인 172-174: `{option}` (li 내부)
- 라인 183: `<span ...>{detail.answer}</span>`
- 라인 189-191: `<p ...>{detail.explanation}</p>`

실제 `question-detail-sheet.tsx` 확인 결과:

- 162-165번 (1-indexed):
  ```tsx
  <InfoRow label="문제 내용">
    <p className="whitespace-pre-wrap text-sm font-normal leading-relaxed">
      {detail.content}
    </p>
  ```
  `<p>` 시작은 163번 줄이 맞지만 `{detail.content}`는 164번 줄이다. PLAN은 "163-165: `<p ...>{detail.content}</p>`"로 기술하는데 실제로는 163번이 `<p ...>`, 164번이 `{detail.content}`, 165번이 `</p>`로 3줄로 나뉜다. 의미적으로는 일치하나 PLAN의 단일 라인 표기가 부정확하다.

- 172-174번: 실제 173번:
  ```tsx
  <li key={index} className="text-sm font-normal">
    {option}
  </li>
  ```
  `{option}`은 174번 줄이다. PLAN "172-174: `{option}` (li 내부)" 기술은 대략적으로 일치.

- 183번: 실제 183번:
  ```tsx
  <span className="font-semibold text-primary">{detail.answer}</span>
  ```
  ✓ **일치**

- 189-191번: 실제 189번:
  ```tsx
  <p className="whitespace-pre-wrap text-sm font-normal leading-relaxed">
  ```
  ✓ 대략 일치.

전반적으로 라인 번호는 허용 오차 내(±1줄)이나, **Task 6에서 `LatexRenderer`가 `<InfoRow>` 내부의 `<p>` 자식 또는 `<span>` 자식을 완전히 교체해야 한다.** PLAN 설명이 `<p>` 전체를 교체하는 것인지 내부 텍스트만 교체하는 것인지 불명확하다. `<InfoRow>`의 `children` 슬롯에 `<LatexRenderer>`를 직접 전달하는 것이 의미적으로 더 명확하다.

---

## Wave 3 검토 (Task 7)

### Task 7 — EditMode Live Preview Below

**[MUST FIX] 라인 번호 불일치 — 7-b, 7-c, 7-d, 7-e, 7-f**

PLAN에서 Task 4 완료 후 question-card.tsx가 ~446줄이 될 것으로 예측하고 그 기반의 라인 번호를 명시했다. 그러나 **현재 파일은 438줄**이며, Task 4 완료 시 3개 import + 교체 작업으로 약 +5줄이 추가되어 ~443줄이 될 것으로 예상된다. PLAN의 446줄 예측과 ~3줄 차이가 있다.

구체적 영향:
- **7-a**: "10번 줄 import { useState } 변경" → 실제 현재 10번 줄: `import { useState } from 'react'` ✓ **일치** (Task 4 완료 후에도 동일)
- **7-b**: "206번 줄 아래 state 추가" → 현재 코드에서 `EditMode` 함수 내 state 선언부는 201-206번 줄이다. Task 4 완료 후 import 라인 추가(~11번으로 밀림)로 이후 모든 라인이 +1된다. 206번 → 약 207번으로 이동.
- **7-c**: "handleSave 위" — 절대 라인이 아니라 상대 위치로 기술되어 있어 안전하다.
- **7-d**: "251번 줄" — 현재 `Textarea` 블록은 254-259번 줄이다. Task 4 완료 후 라인 이동 감안 시 약 255-260번이 될 것이다. PLAN의 251번과 차이가 있다.
- **7-e**: "262번 줄" — 현재 options `map` 시작은 267번 줄이다. Task 4 완료 후 약 268번. PLAN의 262번과 차이가 있다.
- **7-f**: "284번 줄 아래" — 현재 answer Input은 287-290번이다. Task 4 완료 후 약 288-291번. PLAN의 284번과 차이가 있다.

절대 라인 번호가 10줄 이상 어긋날 수 있어 구현자 혼동 가능성 높음.

**[SHOULD FIX] options 미리보기 구조 변경 — grid → flex**

현재 EditMode의 options 레이아웃(264-281번):
```tsx
<div className="grid grid-cols-2 gap-2">
  {options.map((opt, i) => (
    <div key={i} className="flex items-center gap-1">
```

PLAN Task 7-e에서는:
```tsx
<div key={i} className="flex flex-col gap-1">
  <div className="flex items-center gap-1">
    ...Input...
  </div>
  {focusedOptionIndex === i && opt.includes('$') && (미리보기 div)}
</div>
```
`grid grid-cols-2` 구조를 `flex flex-col`로 교체해야 한다는 의미인데, 이 경우 **2열 그리드 레이아웃이 깨진다**. 기존 2열 보기 배치가 단일 열로 변경되는 레이아웃 변경이 의도된 것인지 명시 필요.

**[CONSIDER] 마스터 PLAN과 Wave3 상세의 answer 미리보기 방식 불일치**

마스터 PLAN v2 섹션 7 (Task 7 설명):
> "answer: 포커스 시 미리보기"

Wave 3 Task 7-f:
> "previewAnswer" (debounce 기반 상시 미리보기)

answer 필드는 Input 태그로 짧은 텍스트가 입력되므로 debounce 300ms로 상시 미리보기를 하는 Wave 3 상세 방식이 더 적절하다. 그러나 마스터 PLAN의 "포커스 시 미리보기" 기술과 다르므로 명시적으로 변경 사유를 Wave 3 파일에 기재하는 것이 권장된다.

---

## Wave 4 검토 (Task 8)

### Task 8 — 단위 테스트 17개

**[MUST FIX] vitest 환경 설정 미일치 — LatexRenderer 테스트 실패 가능성 높음**

현재 `vitest.config.ts`:
```typescript
test: {
  globals: true,
  environment: 'node',  // ← DOM 환경 아님
},
```

`latex-renderer.test.tsx`는 `@testing-library/react`의 `render`, `screen`을 사용한다. 이는 **jsdom 또는 happy-dom 환경**이 필요하다. 현재 `environment: 'node'`로 설정된 경우 `document is not defined` 에러로 테스트가 즉시 실패한다.

해결 방법 (둘 중 하나 선택):
1. `vitest.config.ts`에서 `environment: 'jsdom'`으로 전역 변경 + `npm install -D jsdom`
2. 파일 상단에 `// @vitest-environment jsdom` 주석 추가 (파일별 환경 오버라이드)

PLAN Task 8 "필요 의존성 확인" 섹션에 `@testing-library/react @testing-library/jest-dom`만 언급되어 있고 `jsdom` 또는 `happy-dom` 및 vitest 환경 설정 변경이 **누락**되어 있다. Wave 4를 그대로 실행하면 LatexRenderer 테스트 전체 실패.

**[SHOULD FIX] latex-parser.test.ts 에서 테스트 케이스 5번 기대값 불명확**

테스트 5번: 이스케이프 `\$`
- 입력: `"\\$5 가격"` (JavaScript 문자열 → 실제 값: `\$5 가격`)
- 기대: `[text('\\$5 가격')]`

기대값 `text('\\$5 가격')`에서 `\\$`가 JavaScript 문자열 리터럴로 `\$`를 표현하는지, 아니면 실제 `\\`와 `$`를 나타내는지 테스트 코드 작성 시 혼동이 발생할 수 있다. 테스트 작성 시 주석으로 실제 입력 문자열 값(`\$5 가격`)을 명시하는 것이 권장된다.

**[CONSIDER] LatexRenderer 테스트에서 KaTeX 실제 렌더링 여부**

테스트 "인라인 수식 → `.katex` 클래스 존재" 검증은 KaTeX가 실제로 HTML을 생성해야만 통과한다. jsdom 환경에서는 CSS가 적용되지 않지만 DOM 요소는 생성되므로 클래스 기반 검증은 가능하다. 그러나 `dangerouslySetInnerHTML`로 주입된 KaTeX HTML이 jsdom에서 파싱되는지 확인이 필요하다. 일반적으로 동작하지만, KaTeX 버전에 따라 일부 SVG/font 요소에서 경고가 발생할 수 있다. 완료 기준에 "콘솔 경고 없음" 조건 추가를 고려하라.

---

## 이슈 요약

| # | 이슈 | 분류 | Wave | Task |
|---|------|------|------|------|
| 1 | 마스터 PLAN v2의 `figure` 타입에 `display` 필드 누락 (Wave 상세와 불일치) | MUST FIX | 1 | 2 |
| 2 | Task 5 라인 155의 options 교체 범위 불명확 (`{option}` vs `{i+1}. {option}`) | MUST FIX | 2 | 5 |
| 3 | Wave 4: `vitest.config.ts` environment가 `node` → jsdom 미설정으로 LatexRenderer 테스트 실패 | MUST FIX | 4 | 8-b |
| 4 | Task 7 라인 번호 (7-b, 7-d, 7-e, 7-f) Task 4 완료 후 라인 이동으로 10줄 이상 차이 | MUST FIX | 3 | 7 |
| 5 | Task 1 완료 기준에 `npm run test:run` 누락 | SHOULD FIX | 1 | 1 |
| 6 | `$...$` 이스케이프 처리: 단일 패스 cursor 방식과 lookbehind 정규식 방식 불일치 | SHOULD FIX | 1 | 2 |
| 7 | Task 3: figure의 `display` 값에 따른 렌더링 분기 명세 누락 | SHOULD FIX | 1 | 3 |
| 8 | Task 7: options 2열 grid → flex-col 변경 시 레이아웃 영향 미명시 | SHOULD FIX | 3 | 7 |
| 9 | `$$` 블록 수식의 줄바꿈 허용 여부 엣지 케이스 미명시 | CONSIDER | 1 | 2 |
| 10 | Task 3: `className` prop이 적용되는 wrapper 구조 미명세 | CONSIDER | 1 | 3 |
| 11 | answer 미리보기 방식 마스터 PLAN("포커스 시")과 Wave3("상시 debounce") 불일치 | CONSIDER | 3 | 7 |
| 12 | Wave 4: LatexRenderer 테스트에서 KaTeX dangerouslySetInnerHTML jsdom 호환성 | CONSIDER | 4 | 8-b |

---

## MUST FIX 4건 상세

### MUST FIX 1: 마스터 PLAN `figure` 타입 불일치

**위치**: `docs/plan/latex-rendering.md` 섹션 4, Task 2
**문제**: 마스터 PLAN의 `LatexSegment` 타입에 `display` 필드 없음, Wave 1 상세와 Wave 4 테스트는 `display` 있음
**영향**: 구현자가 마스터 PLAN을 참조하면 `display` 없는 타입을 구현 → Wave 4 테스트 14~17 전체 실패
**수정 방향**: 마스터 PLAN 섹션 4 타입 정의를 Wave 1 상세(display 포함)와 동일하게 업데이트

### MUST FIX 2: Task 5 options 교체 범위 불명확

**위치**: `docs/plan/latex-wave2.md` Task 5 라인 155
**문제**: "변경 전: `{option}`, 변경 후: `<LatexRenderer text={option} />`"인데 실제 코드가 `{i + 1}. {option}` 형태여서 Task 4와 동일한 패턴(`{i + 1}. <LatexRenderer text={option} />`)인지 확인이 필요
**영향**: 구현 시 `{option}`만 교체할 경우 `{i + 1}. ` 부분은 렌더링되지 않음 (결과는 동일하나 PLAN 명세 부정확)
**수정 방향**: 변경 후를 `{i + 1}. <LatexRenderer text={option} />`으로 명확히 기재

### MUST FIX 3: Wave 4 jsdom 환경 미설정

**위치**: `docs/plan/latex-wave4.md` Task 8-b, `vitest.config.ts`
**문제**: 현재 vitest `environment: 'node'`, LatexRenderer 테스트는 DOM 환경 필요
**영향**: `npm install -D @testing-library/react` 해도 `document is not defined` 에러로 즉시 실패
**수정 방향**: Wave 4 PLAN에 다음 추가 필요
  - `npm install -D jsdom`
  - `latex-renderer.test.tsx` 파일 상단에 `// @vitest-environment jsdom` 추가 (전역 변경 회피)
  - 또는 `vitest.config.ts` `environment: 'jsdom'`으로 변경 + 기존 테스트 호환성 확인

### MUST FIX 4: Task 7 라인 번호 불일치

**위치**: `docs/plan/latex-wave3.md` Task 7-b, 7-d, 7-e, 7-f
**문제**: Task 4 완료 후 라인 이동(+1)이 반영되지 않아 절대 라인 번호가 실제와 어긋남
**현재 실제 → Task 4 완료 예상 → PLAN 명시 (차이)**:
  - 7-b state 추가: 205번 → 206번 / PLAN: 206번 (1줄 차이 — 허용 오차)
  - 7-d Textarea 아래: 258번 → 259번 / PLAN: 251번 (8줄 차이)
  - 7-e options map: 266번 → 267번 / PLAN: 262번 (5줄 차이)
  - 7-f answer 아래: 290번 → 291번 / PLAN: 284번 (7줄 차이)
**영향**: 구현자가 잘못된 위치에 코드 삽입 가능
**수정 방향**: 절대 라인 번호 대신 코드 컨텍스트(기존 코드 스니펫 기준 상대 위치)로 표기하거나, Task 4 완료 후의 실제 라인 번호로 업데이트

---

*산출물 경로: docs/reviews/latex-detail-tech-review.md*
