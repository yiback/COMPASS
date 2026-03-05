# Single Source of Truth + Derived State (단일 진실 공급원 + 파생 상태)

> **분류**: 상태 관리 원칙 (State Management Principle)
> **기원**: 데이터베이스 정규화 이론 → 함수형 프로그래밍 → React 상태 설계
> **적용 기술스택**: 특정 기술에 종속되지 않는 범용 원칙. React, Vue, Svelte, Redux, 관계형 DB 모두 동일하게 적용된다.

---

## 1. 개념

**Single Source of Truth(SSOT)**는 어떤 데이터든 딱 하나의 출처(source)에만 존재해야 한다는 원칙이다.

**Derived State(파생 상태)**는 그 단일 출처로부터 **계산으로 얻어지는** 값이다. 별도 `useState`로 저장하지 않고 렌더링 시점에 즉석 계산한다.

```
일상 비유: 주민등록증의 나이

  주민등록증에는 "생년월일"만 적혀 있다.
  나이는 매년 자동으로 바뀌기 때문에 따로 적지 않는다.
  나이가 필요할 때마다 "올해 연도 - 태어난 연도"로 계산한다.

  생년월일 = Single Source of Truth (단 하나의 출처)
  나이      = Derived State       (계산으로 얻는 값)

  만약 주민등록증에 나이를 따로 적는다면?
  → 생일이 지나도 나이를 수동으로 고쳐야 한다.
  → 고치는 걸 깜빡하면 생년월일과 나이가 불일치한다.
```

### 구조 시각화

```
                   단일 출처 (Single Source of Truth)
                   ┌──────────────────────────────┐
                   │  savedIndices: Set<number>   │
                   │  generatedQuestions: []      │
                   └──────────────┬───────────────┘
                                  │ 계산 (render time)
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
    ┌─────────────────┐ ┌──────────────────┐ ┌──────────────────┐
    │  allSaved       │ │  savableCount    │ │ allUnsavedSelected│
    │  (boolean)      │ │  (number)        │ │  (boolean)        │
    │  별도 state X   │ │  별도 state X    │ │  별도 state X     │
    └─────────────────┘ └──────────────────┘ └──────────────────┘
         파생 상태               파생 상태            파생 상태
```

---

## 2. 왜 필요한가 (문제 상황)

### 파생 상태를 별도 `useState`로 관리하면 생기는 일

아래처럼 작성하면 어떤 문제가 생길까?

```typescript
// 안티패턴: 파생 가능한 값을 별도 state로 관리
const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set())
const [allSaved, setAllSaved] = useState(false)          // 파생 상태를 state로!
const [savableCount, setSavableCount] = useState(0)      // 파생 상태를 state로!

async function handleSave() {
  // 저장 성공 후 세 개의 state를 동시에 업데이트해야 한다
  setSavedIndices((prev) => new Set([...prev, ...indicesToSave]))
  setSavableCount(selectedIndices.size - indicesToSave.length) // 계산 실수 가능
  setAllSaved(savedIndices.size + indicesToSave.length === total) // 타이밍 버그!
}
```

### 무엇이 잘못됐는가

| 문제 | 설명 | 결과 |
|------|------|------|
| 동기화 책임 | state가 바뀔 때마다 파생 state도 수동으로 갱신 | 갱신 누락 시 UI 불일치 |
| 타이밍 버그 | `setSavedIndices` 직후 `savedIndices`는 아직 이전 값 | `allSaved` 계산 오류 |
| 코드 중복 | 같은 계산 로직이 여러 핸들러에 흩어짐 | 수정 시 한 곳을 빠뜨림 |
| 테스트 복잡도 | state가 많을수록 초기값 설정이 복잡해짐 | 테스트 작성 부담 증가 |

### 타이밍 버그 구체 예시

```typescript
// React의 state 업데이트는 비동기 배치(batch) 처리된다.
// setSavedIndices를 호출한 직후 savedIndices는 아직 이전 값이다.

setSavedIndices((prev) => new Set([...prev, ...indicesToSave]))

// 여기서 savedIndices는 여전히 업데이트 전 값!
// 아래 계산은 항상 1 사이클 뒤처진다.
setAllSaved(savedIndices.size === total) // 버그
```

---

## 3. React에서의 적용

### 올바른 패턴: 렌더링 시점에 계산

```typescript
// 출처(source)는 두 개의 Set만 존재한다.
const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set())
const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())

// 파생 상태: 별도 useState 없이 렌더링 시점에 계산한다.
// savedIndices나 selectedIndices가 바뀌면 React가 알아서 재계산한다.
const allSaved =
  savedIndices.size === generatedQuestions.length &&
  generatedQuestions.length > 0

const savableCount = [...selectedIndices].filter(
  (i) => !savedIndices.has(i)
).length

const unsavedIndices = generatedQuestions
  .map((_, i) => i)
  .filter((i) => !savedIndices.has(i))

const allUnsavedSelected =
  unsavedIndices.length > 0 &&
  unsavedIndices.every((i) => selectedIndices.has(i))
```

### 왜 이 방식이 옳은가

```
state 업데이트 → React 재렌더링 → 파생값 재계산 (자동)

savedIndices가 바뀌면:
  → React: "컴포넌트를 다시 그려야 해"
  → allSaved 계산 코드가 새로운 savedIndices로 실행됨
  → 항상 최신값, 항상 일치
```

`useState` 1개 줄이면:

- 동기화 로직 제거
- 타이밍 버그 불가능 (매 렌더마다 새로 계산)
- 코드 줄 감소

---

## 4. 프로젝트 실제 예시

### 예시 1: `generate-questions-dialog.tsx` — savedIndices에서 파생

파일 경로: `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx`

```typescript
// ─── 출처(Source of Truth) — 2개의 state만 존재 ───────────
const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set())
const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())

// ─── 파생 상태 — 별도 state X, 렌더 시점 계산 ─────────────

// "모두 저장됐는가?" — 저장 완료 버튼 숨김 여부 결정
const allSaved =
  savedIndices.size === generatedQuestions.length &&
  generatedQuestions.length > 0

// "저장 가능한 개수" — 저장 버튼 텍스트에 표시
const savableCount = [...selectedIndices].filter(
  (i) => !savedIndices.has(i)
).length

// "미저장 문제 중 전체 선택 여부" — 전체 선택 체크박스 상태
const unsavedIndices = generatedQuestions
  .map((_, i) => i)
  .filter((i) => !savedIndices.has(i))
const allUnsavedSelected =
  unsavedIndices.length > 0 &&
  unsavedIndices.every((i) => selectedIndices.has(i))
```

**UI 반영:**

```tsx
{/* savableCount는 렌더마다 재계산 → 항상 정확 */}
<Button disabled={savableCount === 0 || isSaving}>
  선택 저장 ({savableCount})
</Button>

{/* allSaved는 모두 저장 시 이 블록 전체를 숨김 */}
{!allSaved && (
  <div>전체 선택/해제</div>
)}
```

---

### 예시 2: `questions-toolbar.tsx` — schoolType에서 gradeOptions 파생

파일 경로: `src/app/(dashboard)/questions/_components/questions-toolbar.tsx`

```typescript
// ─── 출처 — schoolType state 1개 ──────────────────────────
const [schoolType, setSchoolType] = useState<SchoolType | 'all'>(
  (searchParams.get('schoolType') as SchoolType | 'all') ?? 'all'
)

// ─── 파생 상태 — schoolType으로부터 학년 옵션 목록 계산 ────
// schoolType이 바뀌면 gradeOptions도 자동으로 갱신된다.
// 별도 state나 useEffect 없이 렌더 시점에 즉석 계산.
const gradeOptions = getGradeOptions(schoolType)
```

**유틸 함수** (`src/lib/utils/grade-filter-utils.ts`):

```typescript
// schoolType → 학년 배열 변환 (순수 함수)
export function getGradeOptions(schoolType: SchoolType | 'all'): number[] {
  if (schoolType === 'all') {
    return Array.from({ length: 12 }, (_, i) => i + 1) // [1, 2, ..., 12]
  }

  const range = GRADE_RANGES[schoolType]
  return Array.from(
    { length: range.max - range.min + 1 },
    (_, i) => range.min + i
  )
  // elementary: [1, 2, 3, 4, 5, 6]
  // middle:     [7, 8, 9]
  // high:       [10, 11, 12]
}
```

schoolType(출처) 1개 → gradeOptions(파생) 무한 계산 가능. 출처만 맞으면 파생값은 항상 정확하다.

---

### 두 예시 비교 테이블

| 항목 | `savedIndices` 예시 | `schoolType` 예시 |
|------|--------------------|--------------------|
| 출처(Source) | `savedIndices: Set<number>` | `schoolType: string` |
| 파생(Derived) | `allSaved`, `savableCount`, `allUnsavedSelected` | `gradeOptions: number[]` |
| 계산 위치 | 컴포넌트 함수 본문 (렌더 시점) | 컴포넌트 함수 본문 (렌더 시점) |
| 별도 `useState` | 없음 | 없음 |
| 별도 `useEffect` | 없음 | 없음 |

---

## 5. 핵심 원칙 정리

### 원칙 1: 계산 가능하면 state로 만들지 않는다

```typescript
// 나쁜 예: count는 items.length로 항상 계산 가능
const [items, setItems] = useState<string[]>([])
const [count, setCount] = useState(0) // 불필요

// 좋은 예: 렌더 시점에 계산
const [items, setItems] = useState<string[]>([])
const count = items.length // 파생 상태
```

### 원칙 2: 같은 데이터를 두 곳에 저장하지 않는다

```typescript
// 나쁜 예: selectedId와 selectedItem이 동기화를 요구
const [selectedId, setSelectedId] = useState<string | null>(null)
const [selectedItem, setSelectedItem] = useState<Item | null>(null) // 중복!

function handleSelect(id: string) {
  setSelectedId(id)
  setSelectedItem(items.find((i) => i.id === id) ?? null) // 잊으면 불일치
}

// 좋은 예: id만 저장, item은 파생
const [selectedId, setSelectedId] = useState<string | null>(null)
const selectedItem = items.find((i) => i.id === selectedId) ?? null
```

### 원칙 3: 파생 계산은 순수 함수로 분리한다

```typescript
// 나쁜 예: 계산 로직이 컴포넌트 곳곳에 흩어짐
// handleSave 안에서도, handleRetry 안에서도 같은 계산을 반복

// 좋은 예: 유틸 함수로 추출 (grade-filter-utils.ts 패턴)
export function getGradeOptions(schoolType: SchoolType | 'all'): number[] {
  // 순수 함수 — 같은 입력 → 항상 같은 출력
  // 테스트하기 쉽고, 컴포넌트 어디서든 재사용 가능
}
```

### 원칙 4: `useEffect`로 파생 state를 동기화하지 않는다

```typescript
// 나쁜 예: useEffect로 파생 state 동기화 — 1 렌더 지연 발생
const [allSaved, setAllSaved] = useState(false)
useEffect(() => {
  setAllSaved(savedIndices.size === total)
}, [savedIndices, total])

// 좋은 예: 렌더 시점 직접 계산
const allSaved = savedIndices.size === total && total > 0
```

### 원칙 5: 파생값이 느리면 useMemo를 사용한다

```typescript
// 파생 계산이 비싼 경우 (대용량 데이터 필터링 등)
const expensiveDerived = useMemo(() => {
  return hugeList.filter((item) => complexCondition(item, selectedId))
}, [hugeList, selectedId]) // 의존성이 바뀔 때만 재계산
```

---

## 6. 안티패턴

### 안티패턴 1: useEffect로 파생 state 동기화

```typescript
// 문제: 렌더가 2번 발생 (state 업데이트 → 재렌더 → useEffect → state 업데이트 → 재렌더)
const [items, setItems] = useState<Item[]>([])
const [isEmpty, setIsEmpty] = useState(true) // 파생 상태를 useEffect로 동기화

useEffect(() => {
  setIsEmpty(items.length === 0) // 불필요한 렌더 유발
}, [items])

// 해결: 렌더 시점 계산
const isEmpty = items.length === 0
```

### 안티패턴 2: 핸들러마다 파생 state 수동 갱신

```typescript
// 문제: 핸들러가 늘어날수록 동기화 책임도 늘어남
function handleAdd(item: Item) {
  setItems((prev) => [...prev, item])
  setCount((prev) => prev + 1)      // 잊으면 불일치
  setHasItems(true)                 // 잊으면 불일치
}

function handleRemove(id: string) {
  setItems((prev) => prev.filter((i) => i.id !== id))
  setCount((prev) => prev - 1)      // 잊으면 불일치
  // setHasItems 업데이트를 깜빡하면 버그
}

// 해결: items만 관리, 나머지는 파생
const count = items.length
const hasItems = items.length > 0
```

### 안티패턴 3: props로 받은 데이터를 state로 복사

```typescript
// 문제: props가 바뀌어도 state는 초기값에 머문다
function ItemList({ items }: { items: Item[] }) {
  const [localItems, setLocalItems] = useState(items) // props를 state로 복사!
  // items prop이 바뀌어도 localItems는 처음 값 그대로
}

// 해결: props는 props 그대로 사용
function ItemList({ items }: { items: Item[] }) {
  // items를 직접 사용하거나, 변환이 필요하면 파생으로 계산
  const sortedItems = [...items].sort((a, b) => a.name.localeCompare(b.name))
}
```

### 안티패턴 4: 비슷해 보이는 두 값을 실제로 별도 관리

```typescript
// 문제: totalPrice는 항상 items 금액의 합 — 별도 state 불필요
const [items, setItems] = useState<CartItem[]>([])
const [totalPrice, setTotalPrice] = useState(0) // 파생 가능

function addItem(item: CartItem) {
  setItems((prev) => [...prev, item])
  setTotalPrice((prev) => prev + item.price) // 실수 가능
}

// 해결
const totalPrice = items.reduce((sum, item) => sum + item.price, 0)
```

---

## 7. 다른 기술스택에서의 동일 개념

파생 상태는 React에만 있는 개념이 아니다. 데이터를 다루는 모든 곳에 동일하게 적용된다.

| 기술 | 파생 상태 구현 방법 | 예시 |
|------|--------------------|----|
| **React** | 컴포넌트 함수 본문에서 계산 / `useMemo` | `const total = items.reduce(...)` |
| **Vue 3** | `computed` 프로퍼티 | `const total = computed(() => items.value.reduce(...))` |
| **Svelte** | `$:` 반응형 선언 (reactive declaration) | `$: total = items.reduce(...)` |
| **Redux / Zustand** | `selector` 함수 | `const total = useSelector(selectTotal)` |
| **MobX** | `@computed` 데코레이터 | `@computed get total() { return this.items.reduce(...) }` |
| **관계형 DB** | `VIEW` / 계산 컬럼 | `CREATE VIEW order_total AS SELECT SUM(price) ...` |
| **스프레드시트** | 수식 셀 | `=SUM(A1:A10)` |

### Vue 3 `computed` 예시

```javascript
// Vue 3 — schoolType이 바뀌면 gradeOptions도 자동 재계산
import { ref, computed } from 'vue'

const schoolType = ref('all')  // Single Source of Truth

// computed = React 파생 상태와 동일한 개념
const gradeOptions = computed(() => {
  if (schoolType.value === 'all') {
    return Array.from({ length: 12 }, (_, i) => i + 1)
  }
  // ...
})
```

### Svelte 반응형 선언

```svelte
<!-- Svelte — $: 선언은 의존 값이 바뀔 때마다 재실행된다 -->
<script>
  let savedIndices = new Set()
  let generatedQuestions = []

  // $: = "이 값이 의존하는 변수가 바뀌면 재계산해라"
  $: allSaved = savedIndices.size === generatedQuestions.length && generatedQuestions.length > 0
  $: savableCount = [...selectedIndices].filter(i => !savedIndices.has(i)).length
</script>
```

### Redux selector 패턴

```typescript
// Redux — state를 직접 읽지 않고 selector 함수로 파생값을 계산
// reselect 라이브러리로 메모이제이션 가능

import { createSelector } from '@reduxjs/toolkit'

const selectSavedIndices = (state: RootState) => state.questions.savedIndices
const selectGeneratedQuestions = (state: RootState) => state.questions.generatedQuestions

// 파생 selector — savedIndices와 generatedQuestions에서 계산
export const selectAllSaved = createSelector(
  [selectSavedIndices, selectGeneratedQuestions],
  (savedIndices, questions) =>
    savedIndices.size === questions.length && questions.length > 0
)
```

### 관계형 DB VIEW

```sql
-- DB에서도 동일 원칙이 적용된다.
-- questions 테이블이 출처, 통계는 VIEW(파생)로 계산.

CREATE VIEW question_stats AS
SELECT
  school_id,
  COUNT(*)                                         AS total_count,
  COUNT(*) FILTER (WHERE difficulty = 'hard')      AS hard_count,
  ROUND(AVG(CASE WHEN difficulty = 'easy' THEN 1
                 WHEN difficulty = 'medium' THEN 2
                 ELSE 3 END), 2)                   AS avg_difficulty
FROM questions
GROUP BY school_id;

-- total_count, hard_count, avg_difficulty를 별도 컬럼으로 저장하지 않는다.
-- questions 행이 추가/삭제되면 VIEW는 항상 최신값을 반환한다.
```

---

## 8. 체크리스트: 파생 상태를 써야 하는지 판단 기준

새로운 `useState`를 추가하기 전, 아래 질문에 답해보자.

```
새 state를 추가하기 전 체크리스트
─────────────────────────────────────────────────────────────
[ ] 이 값이 다른 state나 props로부터 계산 가능한가?
    → YES: useState 추가 금지, 렌더 시점에 계산하라.

[ ] 이 값을 업데이트하려면 다른 state 업데이트와 동시에 해야 하는가?
    → YES: 파생으로 전환 검토. 동기화 책임이 생긴다는 신호.

[ ] 이 값을 갱신하는 useEffect가 존재하는가?
    → YES: 파생으로 전환 가능한지 확인. useEffect 기반 동기화는 안티패턴.

[ ] 이 값이 어떤 핸들러에서도 독립적으로 변경될 수 있는가?
    → YES: 그때만 별도 state로 관리한다.

[ ] 계산 비용이 매우 큰가? (대용량 리스트 필터링 등)
    → YES: 파생 state + useMemo 조합을 사용한다.
─────────────────────────────────────────────────────────────
```

### 결정 트리

```
새 값이 필요하다
        │
        ▼
다른 state/props로 계산 가능한가?
        │
    YES ┤                        NO
        │                        │
        ▼                        ▼
  파생 상태로 처리          별도 useState 추가
  (렌더 시점 계산)                │
        │               계산 비용이 크다면
        │               useMemo 추가 고려
        ▼
  계산이 느린가?
        │
    YES ┤        NO
        │         │
        ▼         ▼
    useMemo   const 계산
    사용        (그냥 계산)
```

---

## 9. 관련 공식 문서

- [React 공식 문서 — State를 어디에 두어야 하는가](https://react.dev/learn/thinking-in-react#step-4-identify-where-your-state-should-live)
- [React 공식 문서 — 중복 state 피하기](https://react.dev/learn/choosing-the-state-structure#avoid-redundant-state)
- [React 공식 문서 — useMemo](https://react.dev/reference/react/useMemo)
- [Vue 3 공식 문서 — Computed Properties](https://vuejs.org/guide/essentials/computed.html)
- [Svelte 공식 문서 — Reactive declarations](https://learn.svelte.dev/tutorial/reactive-declarations)
- [Redux 공식 문서 — Selectors](https://redux.js.org/usage/deriving-data-selectors)
