# Step 3: 저장 버튼 + 개별 선택 UI

> **진행률**: 3/3 Tasks (100%)
> **의존성**: Step 2 완료 (saveGeneratedQuestions Server Action 존재 필요)
> **수정 대상**: `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` (현재 351줄)
> **테스트 전략**: UI 변경이므로 Unit Test 최소화, 수동 테스트 + 빌드 검증 성공 기준

---

## Context

1-7에서 AI 생성 문제가 Dialog 화면에 카드 형태로 표시된다. 현재는 결과를 확인하고 "닫기"만 할 수 있다. Step 3에서는:

1. 각 문제 카드 옆에 **체크박스**를 추가해 교사가 원하는 문제만 선택할 수 있게 한다.
2. 결과 헤더에 **"전체 선택/해제"** 토글과 **"선택 저장(N)"** 버튼을 추가한다.
3. 저장 완료된 문제는 체크박스가 **disabled + checked** 상태로 시각적 피드백을 준다.

**핵심**: 부분 저장(일부만 저장 → 나머지 추가 저장)을 지원해야 하므로
`isSaved: boolean` 대신 `savedIndices: Set<number>`로 개별 추적한다.

**UI 패턴**: 문제가 길 수 있으므로 **Accordion(접기/펼치기)** 패턴을 사용한다.
기본 상태에서는 제목 + 유형/난이도 뱃지만 표시하고, 클릭 시 전체 내용(content, options, answer, explanation)을 펼친다. 이로써 전체 목록을 한눈에 파악하면서 원하는 문제만 상세 확인할 수 있다.

> **사전 작업**: `npx shadcn@latest add accordion` 으로 Accordion 컴포넌트 설치 필요

---

## UI 변경 다이어그램

```
변경 전:
┌─── 결과 영역 (DialogContent) ──────────────────────┐
│ 생성된 문제 3개              [다시 생성]              │
│ ┌─ QuestionCard 1 ──────────────────────────────┐  │
│ │ 문제 1  [객관식] [보통]                          │  │
│ │ 이차방정식 ax² + bx + c = 0에서 ...             │  │
│ └──────────────────────────────────────────────┘  │
│ ┌─ QuestionCard 2 ──────────────────────────────┐  │
│ └──────────────────────────────────────────────┘  │
│ ┌─ QuestionCard 3 ──────────────────────────────┐  │
│ └──────────────────────────────────────────────┘  │
│                                          [닫기]    │
└────────────────────────────────────────────────────┘

변경 후 (Accordion 패턴):
┌─── 결과 영역 (DialogContent) ──────────────────────┐
│ 생성된 문제 3개 (1개 저장됨)                         │
│ [☑ 전체 선택/해제]              [선택 저장 (2)]      │
│                                                    │
│ ☑ ▸ 문제 1  [객관식] [보통]              (접혀 있음) │
│ ☑ ▾ 문제 2  [단답형] [쉬움]              (펼쳐 있음) │
│   │  1 + 1 = ?                                     │
│   │  정답: 2                                        │
│   │  해설: 1과 1을 더하면 2이다.                     │
│ ☑ ▸ 문제 3  [서술형] [어려움]  ✓ 저장됨   (접혀 있음) │
│                                          [닫기]    │
└────────────────────────────────────────────────────┘

범례:
  ☑  = 선택됨 (저장 대상)
  ☐  = 미선택
  ☑  (회색 + disabled) = 이미 저장됨
  ▸  = 접힘 (클릭 시 펼침)
  ▾  = 펼침 (클릭 시 접힘)
```

---

## TDD 구현 순서

UI 변경이 주목적이므로 RED → GREEN 사이클 대신
**Task 1 (상태+핸들러) → Task 2 (JSX) → Task 3 (초기화 수정)** 순서로 진행한다.
각 Task 완료 후 `npm run build` + 브라우저 수동 확인으로 검증한다.

---

## Task 1: 상태 + 핸들러 추가

### 추가할 import (파일 상단)

```typescript
// 기존 import에 추가
import { useEffect, useState, useTransition } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Checkbox } from '@/components/ui/checkbox'
import { saveGeneratedQuestions } from '@/lib/actions/save-questions'
```

> **사전 작업** (Accordion 미설치 시):
> ```bash
> npx shadcn@latest add accordion
> ```

> **주의**: `useState`와 `useTransition`은 이미 import 중이므로
> `useEffect`만 추가하면 된다. import 라인을 아래처럼 수정:
> ```typescript
> import { useEffect, useState, useTransition } from 'react'
> ```

### 추가할 상태 (메인 컴포넌트 내부, 기존 상태 아래)

```typescript
// 저장 관련 상태 — 기존 const [isPending, startTransition] = useTransition() 아래에 추가
const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set())
const [isSaving, setIsSaving] = useState(false)
const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
```

### 파생 상태 (상태 선언 직후)

```typescript
// 별도 state 불필요 — 기존 Set에서 계산 (Single Source of Truth)
const allSaved =
  savedIndices.size === generatedQuestions.length && generatedQuestions.length > 0
const savableCount = [...selectedIndices].filter((i) => !savedIndices.has(i)).length
```

### 추가할 useEffect (생성 완료 시 전체 선택)

```typescript
// 문제 생성 완료 시 모든 문제를 선택 상태로 초기화
useEffect(() => {
  if (generatedQuestions.length > 0) {
    setSelectedIndices(new Set(generatedQuestions.map((_, i) => i)))
  }
}, [generatedQuestions])
```

> **왜 useEffect인가?**
> `setGeneratedQuestions(result.data)` 직후에 `setSelectedIndices`를 호출해도
> 되지만, 관심사 분리 관점에서 "생성 결과가 바뀌면 → 선택 상태 동기화"라는
> 부수 효과를 useEffect로 명시하는 것이 더 명확하다.

### 추가할 핸들러 3개 (기존 handleRetry 위에 삽입)

#### handleSave

```typescript
/** 선택된 문제 중 아직 저장 안 된 것만 DB에 저장 */
async function handleSave() {
  if (!generatedQuestions || !pastExamId) return

  // 선택됐지만 아직 저장 안 된 인덱스만 추림
  const indicesToSave = [...selectedIndices].filter((i) => !savedIndices.has(i))
  if (indicesToSave.length === 0) return

  setIsSaving(true)
  try {
    const questionsToSave = indicesToSave.map((i) => generatedQuestions[i])
    const result = await saveGeneratedQuestions({
      pastExamId,
      questions: questionsToSave,
    })

    if (result.error) {
      toast.error(result.error)
    } else {
      // 저장 성공 → savedIndices에 추가, selectedIndices에서 제거
      setSavedIndices((prev) => new Set([...prev, ...indicesToSave]))
      setSelectedIndices((prev) => {
        const next = new Set(prev)
        indicesToSave.forEach((i) => next.delete(i))
        return next
      })
      toast.success(`${questionsToSave.length}개 문제가 저장되었습니다.`)
    }
  } catch {
    toast.error('저장 중 오류가 발생했습니다.')
  } finally {
    setIsSaving(false)
  }
}
```

> **왜 throw 대신 result.error 패턴인가?**
> Server Action에서 에러를 throw하면 Next.js 에러 바운더리로 전파된다.
> `{ error }` 반환 패턴은 클라이언트에서 `if (result.error)`로 분기 처리 가능하여
> 다이얼로그를 닫지 않고 인라인 토스트로 에러 안내할 수 있다.

#### toggleQuestion

```typescript
/** 개별 문제 선택/해제 (저장 완료된 문제는 토글 불가) */
function toggleQuestion(index: number) {
  if (savedIndices.has(index)) return // 저장 완료 → 변경 불가

  setSelectedIndices((prev) => {
    const next = new Set(prev)
    if (next.has(index)) {
      next.delete(index)
    } else {
      next.add(index)
    }
    return next
  })
}
```

#### toggleAll

```typescript
/** 저장 안 된 문제 전체 선택/해제 토글 */
function toggleAll() {
  // 아직 저장되지 않은 인덱스만 대상
  const unsavedIndices = generatedQuestions
    .map((_, i) => i)
    .filter((i) => !savedIndices.has(i))

  // 미저장 문제가 모두 선택돼 있으면 → 전체 해제, 아니면 → 전체 선택
  const allUnsavedSelected = unsavedIndices.every((i) => selectedIndices.has(i))

  if (allUnsavedSelected) {
    setSelectedIndices((prev) => {
      const next = new Set(prev)
      unsavedIndices.forEach((i) => next.delete(i))
      return next
    })
  } else {
    setSelectedIndices((prev) => new Set([...prev, ...unsavedIndices]))
  }
}
```

---

## Task 2: JSX 수정 — 체크박스 + 저장 버튼

### QuestionCard Props 확장

`QuestionCard` 컴포넌트에 체크박스 관련 props를 추가한다.

```typescript
interface QuestionCardProps {
  readonly question: GeneratedQuestion
  readonly index: number
  // --- Step 3에서 추가 ---
  readonly isSelected: boolean
  readonly isSaved: boolean
  readonly onToggle: (index: number) => void
}
```

### QuestionCard 컴포넌트 수정 (Accordion + 체크박스)

> **Accordion 패턴**: 기본 접혀 있고, 클릭 시 전체 내용 펼침.
> 문제가 길어도 목록을 한눈에 파악 가능. `type="multiple"`로 여러 개 동시 펼침 허용.
>
> 구조: `AccordionTrigger` 안에 체크박스 + 제목 + 뱃지, `AccordionContent` 안에 상세 내용.

```typescript
function QuestionCard({ question, index, isSelected, isSaved, onToggle }: QuestionCardProps) {
  return (
    <AccordionItem
      value={`question-${index}`}
      className={isSaved ? 'opacity-60' : ''}
    >
      <div className="flex items-center gap-3">
        {/* 체크박스 — AccordionTrigger 밖에 위치 (클릭 이벤트 분리) */}
        <Checkbox
          checked={isSelected || isSaved}
          disabled={isSaved}
          onCheckedChange={() => onToggle(index)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`문제 ${index + 1} 선택`}
        />

        {/* Accordion 트리거 — 클릭 시 접기/펼치기 */}
        <AccordionTrigger className="flex-1 py-2 hover:no-underline">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">문제 {index + 1}</span>
            <Badge variant="outline" className="text-xs">
              {QUESTION_TYPE_LABELS[question.type] ?? question.type}
            </Badge>
            <Badge
              variant={DIFFICULTY_BADGE_VARIANT[question.difficulty] ?? 'secondary'}
              className="text-xs"
            >
              {DIFFICULTY_LABELS[question.difficulty] ?? question.difficulty}
            </Badge>
            {/* 저장됨 표시 */}
            {isSaved && (
              <Badge variant="secondary" className="text-xs">
                ✓ 저장됨
              </Badge>
            )}
          </div>
        </AccordionTrigger>
      </div>

      {/* 펼쳐지는 내용 */}
      <AccordionContent className="pl-9 space-y-3">
        {/* 문제 내용 */}
        <p className="whitespace-pre-wrap text-sm">{question.content}</p>

        {/* 객관식 보기 */}
        {question.options && question.options.length > 0 && (
          <div className="space-y-1 pl-2">
            {question.options.map((option, i) => (
              <p key={i} className="text-sm text-muted-foreground">
                {i + 1}. {option}
              </p>
            ))}
          </div>
        )}

        <Separator />

        {/* 정답 */}
        <div>
          <p className="text-xs font-medium text-muted-foreground">정답</p>
          <p className="text-sm">{question.answer}</p>
        </div>

        {/* 해설 */}
        {question.explanation && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">해설</p>
            <p className="whitespace-pre-wrap text-sm">{question.explanation}</p>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}
```

> **`onClick={(e) => e.stopPropagation()}`**: 체크박스 클릭이 Accordion 트리거로
> 버블링되는 것을 방지. 체크박스 클릭 → 선택/해제만, Accordion 클릭 → 접기/펼치기만.

### 결과 영역 JSX 수정 (메인 컴포넌트)

기존 `{hasResults && !isPending && ( ... )}` 블록을 아래로 교체한다.

```typescript
{/* 결과 영역 */}
{hasResults && !isPending && (
  <div className="space-y-3">
    {/* 헤더: 문제 수 + 저장됨 카운트 + 다시 생성 버튼 */}
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium">
        생성된 문제 {generatedQuestions.length}개
        {savedIndices.size > 0 && (
          <span className="ml-1 text-muted-foreground">
            ({savedIndices.size}개 저장됨)
          </span>
        )}
      </p>
      <Button variant="outline" size="sm" onClick={handleRetry}>
        <RotateCcw className="mr-1 h-4 w-4" />
        다시 생성
      </Button>
    </div>

    {/* 전체 선택 + 저장 버튼 행 */}
    {!allSaved && (
      <div className="flex items-center justify-between rounded-md border px-3 py-2">
        <div
          className="flex cursor-pointer items-center gap-2"
          onClick={toggleAll}
        >
          <Checkbox
            checked={
              generatedQuestions
                .filter((_, i) => !savedIndices.has(i))
                .every((_, idx) => {
                  // 미저장 문제의 실제 인덱스를 계산해서 selectedIndices 확인
                  const realIdx = generatedQuestions
                    .map((_, i) => i)
                    .filter((i) => !savedIndices.has(i))[idx]
                  return selectedIndices.has(realIdx)
                })
            }
            onCheckedChange={toggleAll}
            aria-label="전체 선택/해제"
          />
          <span className="text-sm">전체 선택/해제</span>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={savableCount === 0 || isSaving}
        >
          {isSaving ? '저장 중...' : `선택 저장 (${savableCount})`}
        </Button>
      </div>
    )}

    {/* 문제 목록 (Accordion — 여러 개 동시 펼침 가능) */}
    <Accordion type="multiple" className="max-h-96 overflow-y-auto pr-1">
      {generatedQuestions.map((question, index) => (
        <QuestionCard
          key={index}
          question={question}
          index={index}
          isSelected={selectedIndices.has(index)}
          isSaved={savedIndices.has(index)}
          onToggle={toggleQuestion}
        />
      ))}
    </Accordion>
  </div>
)}
```

> **전체 선택 체크박스 checked 계산 간소화 방안**:
> 위 코드의 `checked` prop 계산이 복잡하다면, 파생 상태로 추출한다:
> ```typescript
> // 파생 상태 섹션에 추가
> const unsavedIndices = generatedQuestions
>   .map((_, i) => i)
>   .filter((i) => !savedIndices.has(i))
> const allUnsavedSelected =
>   unsavedIndices.length > 0 && unsavedIndices.every((i) => selectedIndices.has(i))
> ```
> 그러면 JSX에서 `checked={allUnsavedSelected}`로 단순화된다.

---

## Task 3: handleRetry / handleOpenChange 수정

### handleRetry 수정

"다시 생성" 시 선택/저장 상태를 초기화해야 한다.

```typescript
/** "다시 생성" — 결과 초기화 후 폼으로 복귀 */
function handleRetry() {
  setGeneratedQuestions([])
  setSavedIndices(new Set())      // 추가
  setSelectedIndices(new Set())   // 추가
}
```

> **왜 savedIndices를 초기화하는가?**
> 새로운 문제를 생성하면 인덱스(0, 1, 2...)가 새 문제를 가리킨다.
> 이전 savedIndices를 유지하면 새 문제가 기존에 저장된 인덱스와 충돌해
> 이미 저장됐다고 잘못 표시된다.

### handleOpenChange 수정

Dialog 닫힐 때 모든 상태를 초기화한다.

```typescript
/** Dialog 닫힐 때 상태 초기화 */
function handleOpenChange(nextOpen: boolean) {
  if (!nextOpen) {
    setQuestionType('')
    setDifficulty('')
    setCount('')
    setGeneratedQuestions([])
    setSavedIndices(new Set())      // 추가
    setSelectedIndices(new Set())   // 추가
  }
  onOpenChange(nextOpen)
}
```

---

## 파일 변경 요약

| 위치 | 변경 내용 | 종류 |
| ---- | -------- | ---- |
| `src/components/ui/accordion.tsx` | shadcn Accordion 컴포넌트 설치 (`npx shadcn@latest add accordion`) | 신규 |
| import 라인 | `useEffect` 추가, `Accordion*` + `Checkbox` + `saveGeneratedQuestions` import 추가 | 추가 |
| QuestionCardProps | `isSelected`, `isSaved`, `onToggle` props 추가 | 수정 |
| QuestionCard 컴포넌트 | Card → AccordionItem 기반 + 체크박스 + 저장됨 뱃지 | 수정 |
| 메인 컴포넌트 상태 | `savedIndices`, `isSaving`, `selectedIndices` 추가 | 추가 |
| 파생 상태 | `allSaved`, `savableCount`, `unsavedIndices`, `allUnsavedSelected` | 추가 |
| useEffect | 생성 완료 시 전체 선택 초기화 | 추가 |
| handleSave | 선택 항목 저장 핸들러 | 추가 |
| toggleQuestion | 개별 선택/해제 핸들러 | 추가 |
| toggleAll | 전체 선택/해제 핸들러 | 추가 |
| handleRetry | savedIndices + selectedIndices 초기화 추가 | 수정 |
| handleOpenChange | savedIndices + selectedIndices 초기화 추가 | 수정 |
| 결과 영역 JSX | 전체 선택 행 + 저장 버튼 + QuestionCard props 전달 | 수정 |

**예상 최종 줄 수**: 351줄 → 약 430~450줄 (800줄 제한 이내)

---

## 성공 기준 (UI 동작 확인 체크리스트)

### 초기 상태
- [ ] 문제 생성 완료 시 모든 카드의 체크박스가 선택(☑) 상태
- [ ] "선택 저장 (N)" 버튼의 N이 총 문제 수와 동일
- [ ] "전체 선택/해제" 체크박스가 checked 상태

### 개별 토글
- [ ] 체크박스 클릭 시 선택 상태 토글
- [ ] "선택 저장 (N)" 버튼의 N이 실시간 갱신
- [ ] 모두 해제 시 "선택 저장 (0)" + 저장 버튼 disabled

### 전체 토글
- [ ] "전체 선택/해제" 클릭 시 모든 미저장 문제 선택/해제
- [ ] 일부만 선택된 상태에서 "전체 선택/해제" 클릭 → 전체 선택으로 전환

### 저장 동작
- [ ] "선택 저장" 클릭 시 버튼이 "저장 중..."으로 변경 + disabled
- [ ] 저장 성공 시 해당 카드가 opacity-60 + "✓ 저장됨" 뱃지 표시
- [ ] 저장된 카드의 체크박스가 checked + disabled (회색)
- [ ] "선택 저장" 버튼의 N에서 저장 완료된 수가 제외됨
- [ ] 성공 토스트: "N개 문제가 저장되었습니다."

### 부분 저장 후 추가 저장
- [ ] 3개 중 2개 저장 후 → 나머지 1개 선택 → "선택 저장 (1)" 가능
- [ ] 모두 저장 완료 시 "전체 선택/해제" 행이 사라짐 (allSaved = true)

### 다시 생성
- [ ] "다시 생성" 클릭 시 savedIndices + selectedIndices 초기화 → 폼으로 복귀
- [ ] 새 문제 생성 후 저장됨 표시가 없는 상태로 시작

### Dialog 닫기/재오픈
- [ ] 닫고 다시 열면 모든 상태 초기화 (저장됨 표시 없음)

---

## 최종 검증 명령어

```bash
# TypeScript 타입 검사
npx tsc --noEmit

# 빌드 검증
npm run build

# (Step 2 테스트가 존재한다면) 관련 테스트 실행
npx vitest run src/lib/actions/__tests__/save-questions.test.ts
```

---

## 학습 리뷰

### 핵심 개념

#### 1. `Set<number>` vs `boolean[]` — 왜 Set인가?

부분 저장 시나리오를 생각해보자.

```
상황: 5개 문제 중 1, 3번 저장 → 이후 2, 4번 추가 저장

boolean[] 방식:
  isSavedArr = [true, false, true, false, false]
  → 추가 저장 후: [true, true, true, true, false]
  → 배열 전체를 복사해야 함 (불변 업데이트 복잡)

Set<number> 방식:
  savedIndices = new Set([0, 2])
  → 추가 저장 후: new Set([0, 1, 2, 3])
  → 스프레드로 간단하게 병합: new Set([...prev, ...newItems])
```

또한 "저장됐는가?" 조회가 `O(1)` (`set.has(i)`)으로 배열 인덱스 접근과 동일하게 빠르다.

#### 2. 파생 상태 (Derived State) — Single Source of Truth

```typescript
// 나쁜 패턴: 별도 state로 관리
const [allSaved, setAllSaved] = useState(false)
const [savableCount, setSavableCount] = useState(0)
// → savedIndices가 바뀔 때마다 두 state를 동기화해야 함
//   → 동기화 실수 → 버그 발생

// 좋은 패턴: 기존 state에서 계산
const allSaved = savedIndices.size === generatedQuestions.length && generatedQuestions.length > 0
const savableCount = [...selectedIndices].filter((i) => !savedIndices.has(i)).length
// → savedIndices, selectedIndices, generatedQuestions가 변하면 자동으로 최신값
```

**규칙**: "다른 state에서 계산 가능한 값은 state로 만들지 않는다."

#### 3. Set 불변 업데이트 패턴 (React 불변성 원칙)

```typescript
// 나쁜 패턴: 기존 Set 직접 변경 (mutation)
setSavedIndices((prev) => {
  prev.add(index)  // MUTATION! React가 변화 감지 못함
  return prev
})

// 좋은 패턴: 새 Set 생성
setSavedIndices((prev) => new Set([...prev, index]))

// 여러 항목 추가
setSavedIndices((prev) => new Set([...prev, ...indicesToSave]))

// 항목 제거
setSelectedIndices((prev) => {
  const next = new Set(prev)
  next.delete(index)
  return next  // 새 Set 반환
})
```

React의 상태 업데이트 감지는 **참조 비교(===)**다. 같은 Set 객체를 반환하면
값이 바뀌어도 리렌더링이 트리거되지 않는다.

#### 4. Accordion 패턴 — 접기/펼치기로 긴 콘텐츠 관리

```tsx
// type="multiple" → 여러 아이템을 동시에 펼칠 수 있음
// type="single" → 하나만 펼치면 나머지는 자동으로 접힘
<Accordion type="multiple">
  <AccordionItem value="item-1">
    <AccordionTrigger>제목 (항상 보임)</AccordionTrigger>
    <AccordionContent>상세 내용 (클릭 시 펼침/접힘)</AccordionContent>
  </AccordionItem>
</Accordion>
```

**체크박스 + Accordion 조합 시 주의점**:
체크박스가 AccordionTrigger 안에 있으면 클릭 시 체크 + 펼침이 동시에 발생한다.
`onClick={(e) => e.stopPropagation()}`으로 이벤트 버블링을 차단하여
체크박스 클릭 → 선택만, Accordion 영역 클릭 → 펼침만 되도록 분리한다.

#### 5. Checkbox + disabled 조합 — 저장 완료 피드백

```tsx
<Checkbox
  checked={isSelected || isSaved}  // 저장됐으면 항상 체크
  disabled={isSaved}               // 저장됐으면 변경 불가
  onCheckedChange={() => onToggle(index)}
/>
```

`disabled` prop은 두 가지 역할을 한다:
1. 시각적 피드백 (회색/투명도로 "더 이상 조작 불가" 표시)
2. 이벤트 차단 (`onCheckedChange`가 호출되지 않음 → `toggleQuestion`의 `if (savedIndices.has(index)) return` 방어 코드와 이중 보호)

---

### 이해도 질문

다음 질문에 답해보며 개념을 체화하세요.

**Q1.** `savedIndices`를 `Set<number>`로 관리하는 이유는? `boolean[]`로 관리하면 어떤 문제가 있는가?

**Q2.** `allSaved`를 별도 `useState`로 관리하지 않고 파생 상태로 계산하는 이유는? "Single Source of Truth"란 무엇인가?

**Q3.** 아래 코드에서 버그는 무엇인가?
```typescript
setSavedIndices((prev) => {
  prev.add(index)
  return prev
})
```

**Q4.** 저장 실패 시 `savedIndices`를 변경하지 않는다. 그 이유는? (힌트: 재시도 가능성)

**Q5.** "다시 생성" 시 `savedIndices`를 초기화하는 이유는? 초기화하지 않으면 어떤 버그가 발생하는가?

**Q6.** 체크박스에 `onClick={(e) => e.stopPropagation()}`을 넣는 이유는? 이 코드가 없으면 어떤 동작이 발생하는가?

---

### 직접 구현 추천

| 핸들러/컴포넌트 | 추천 | 이유 |
| ------------- | ---- | ---- |
| `handleSave` 함수 | 🟡 빈칸 채우기 권장 | Set 기반 부분 저장 로직이 새로운 패턴 |
| `toggleQuestion` / `toggleAll` | 🟡 빈칸 채우기 권장 | Set 불변 업데이트 패턴 연습 필요 |
| JSX 변경 (체크박스 래핑) | 🟢 AI 자동 구현 OK | 기존 패턴 + Checkbox 추가이므로 반복적 |
| 파생 상태 계산 | 🟢 AI 자동 구현 OK | 수식이 명확하여 이해하기 쉬움 |

**빈칸 채우기 예시 (handleSave)**:

```typescript
async function handleSave() {
  if (!generatedQuestions || !pastExamId) return

  // TODO: selectedIndices 중 savedIndices에 없는 인덱스만 추림
  const indicesToSave = ___

  if (indicesToSave.length === 0) return

  setIsSaving(true)
  try {
    const questionsToSave = ___

    const result = await saveGeneratedQuestions({
      pastExamId,
      questions: questionsToSave,
    })

    if (result.error) {
      toast.error(result.error)
    } else {
      // TODO: savedIndices에 indicesToSave 추가 (불변)
      setSavedIndices(___)
      // TODO: selectedIndices에서 indicesToSave 제거 (불변)
      setSelectedIndices(___)
      toast.success(`${questionsToSave.length}개 문제가 저장되었습니다.`)
    }
  } catch {
    toast.error('저장 중 오류가 발생했습니다.')
  } finally {
    setIsSaving(false)
  }
}
```
