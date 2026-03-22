# Wave 3: EditMode Live Preview Below

> 마스터 PLAN: docs/plan/latex-rendering.md
> 의존: Wave 2 완료 (Task 4 — question-card.tsx 동일 파일)
> S2 반영: useDebounce 커스텀 훅 파일 생성 **취소** → 인라인 패턴
> 담당: frontend-ui

---

## 변경 파일

| 파일 | 유형 | 라인 수 |
|------|------|---------|
| `question-card.tsx` | 수정 | +30~35줄 |

**`src/lib/hooks/use-debounce.ts` 생성 취소** (S2).
기존 `questions-toolbar.tsx` 48-62줄과 동일한 인라인 `useEffect + setTimeout` 패턴 사용.

---

## Task 7: EditMode Live Preview Below

### 7-a. import 수정 (10번 줄)

```typescript
// 변경 전
import { useState } from 'react'
// 변경 후
import { useState, useEffect } from 'react'
```

### 7-b. state 추가 (206번 줄 아래)

```typescript
const [previewText, setPreviewText] = useState(questionText)
const [focusedOptionIndex, setFocusedOptionIndex] = useState<number | null>(null)
const [previewAnswer, setPreviewAnswer] = useState(answer)
```

### 7-c. debounce useEffect (handleSave 위)

```typescript
// questionText debounce 300ms — toolbar 인라인 패턴과 동일
useEffect(() => {
  const timer = setTimeout(() => {
    setPreviewText(questionText)
  }, 300)
  return () => clearTimeout(timer)
}, [questionText])

// answer debounce 300ms
useEffect(() => {
  const timer = setTimeout(() => {
    setPreviewAnswer(answer)
  }, 300)
  return () => clearTimeout(timer)
}, [answer])
```

options는 포커스 시 현재 값 즉시 렌더링 (debounce 없음 — UX 우선).

### 7-d. 문제 내용 미리보기 (Textarea 아래, 251번 줄)

```tsx
{/* Textarea 아래 삽입 */}
{previewText && previewText.includes('$') && (
  <div className="max-h-32 overflow-y-auto rounded-md border bg-muted/30 p-2">
    <p className="mb-1 text-xs text-muted-foreground">미리보기</p>
    <LatexRenderer text={previewText} className="text-sm" />
  </div>
)}
```

표시 조건: `previewText.includes('$')` — `$` 없으면 패널 숨김.

### 7-e. 보기 Input 포커스 미리보기 (262번 줄)

```tsx
{options.map((opt, i) => (
  <div key={i} className="flex flex-col gap-1">
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">{i + 1}.</span>
      <Input
        value={opt}
        onChange={(e) => handleOptionChange(i, e.target.value)}
        onFocus={() => setFocusedOptionIndex(i)}
        onBlur={() => setFocusedOptionIndex(null)}
        className="h-8 text-sm"
        placeholder={`보기 ${i + 1}`}
      />
    </div>
    {focusedOptionIndex === i && opt.includes('$') && (
      <div className="ml-4 max-h-16 overflow-y-auto rounded-md border bg-muted/30 px-2 py-1">
        <LatexRenderer text={opt} className="text-xs" />
      </div>
    )}
  </div>
))}
```

### 7-f. 정답 미리보기 (284번 줄 아래)

```tsx
{previewAnswer && previewAnswer.includes('$') && (
  <div className="max-h-16 overflow-y-auto rounded-md border bg-muted/30 px-2 py-1">
    <LatexRenderer text={previewAnswer} className="text-xs" />
  </div>
)}
```

### 엣지 케이스

| 상황 | 처리 |
|------|------|
| `$` 없는 텍스트 | 미리보기 숨김 |
| 잘못된 LaTeX | `throwOnError: false` → 에러 텍스트 |
| 포커스 이동 | `focusedOptionIndex = null` → 모든 보기 미리보기 숨김 |
| `{{fig:0}}` 포함 | `[도형 0]` 플레이스홀더 표시 |
| Accordion 높이 | `max-h-32 overflow-y-auto` 제한 |

### 파일 크기
Task 4 후 ~446줄 → Task 7 후 ~476줄 (800줄 제한 내)

### 완료 기준
- [ ] import 수정 + state 추가 + useEffect 추가
- [ ] 문제 내용/보기/정답 미리보기 패널 추가
- [ ] `npm run build` 성공
- [ ] 수동 확인: `$x^2$` 입력 → 300ms → 미리보기 렌더링
- [ ] 수동 확인: 보기 포커스 시 해당 보기만 미리보기

---

## Wave 3 완료 기준
- [ ] Task 7 완료
- [ ] `npm run build` 에러 없음
- [ ] Wave 4 진입 가능
