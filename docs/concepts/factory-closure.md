# Factory Function & Closure (팩토리 함수 & 클로저)

> **분류**: JavaScript/TypeScript 핵심 개념 — 함수형 프로그래밍 패턴
> **기원**: 함수형 프로그래밍(1950년대 람다 대수) → JavaScript 클로저(1995) → 팩토리 함수 패턴(2010년대 모듈 시스템 성숙)
> **적용 기술스택**: JavaScript/TypeScript 기반 모든 환경 (브라우저, Node.js, React, Next.js 등) — 언어 수준 개념

---

## 1. 클로저 (Closure)

### 정의

클로저란 **함수가 자신이 선언될 때의 주변 변수를 기억하는 현상**이다.
함수가 실행을 마쳐도, 그 안에서 태어난 내부 함수는 바깥 변수를 계속 들고 다닌다.

### 실생활 비유

> 주문표(변수)를 들고 돌아다니는 카페 직원(내부 함수)을 떠올려라.
> 손님이 주문 후 자리를 떠나도(바깥 함수 종료), 직원은 여전히 그 주문표를 기억하고 음료를 만든다.

```
바깥 함수 실행
  ┌─────────────────────────────┐
  │  name = "필립"               │  ← 바깥 변수 (주문표)
  │                             │
  │  내부 함수 greet 생성        │
  │    └── name 변수를 캡처      │  ← 클로저: 주문표를 기억
  └─────────────────────────────┘
          ↓
바깥 함수 종료 (콜 스택에서 제거)
          ↓
greet() 호출 → name을 여전히 기억함 ✅
```

### 코드 예시

```typescript
// ─── 클로저 기본 예시 ────────────────────────────────────────

function makeGreeter(name: string) {
  // name은 makeGreeter의 지역 변수

  function greet() {
    // greet는 name을 "캡처"하여 기억한다
    return `안녕하세요, ${name}님!`
  }

  return greet // 함수를 반환 (호출하지 않음)
}

const greetPhilip = makeGreeter('필립')
const greetMinjae = makeGreeter('민재')

// makeGreeter는 이미 실행 종료됐지만, 내부 변수는 살아있다
console.log(greetPhilip()) // "안녕하세요, 필립님!"
console.log(greetMinjae()) // "안녕하세요, 민재님!"
```

```typescript
// ─── 클로저: 상태를 기억하는 카운터 ──────────────────────────

function makeCounter(initialValue: number) {
  let count = initialValue // 이 변수가 클로저로 캡처됨

  return {
    increment: () => ++count, // count를 기억하는 함수
    decrement: () => --count,
    getCount: () => count,
  }
}

const counter = makeCounter(0)
counter.increment() // 1
counter.increment() // 2
counter.decrement() // 1
console.log(counter.getCount()) // 1
```

**핵심 원리**: `count`는 `makeCounter` 함수 안에 있지만, 반환된 함수들은 이 `count`에 대한 참조를 계속 유지한다. 이를 **클로저가 변수를 "닫아(close over) 감쌌다"**고 표현한다.

---

## 2. 팩토리 함수 (Factory Function)

### 정의

팩토리 함수란 **객체나 함수를 찍어내는 함수**다.
동일한 구조를 가지지만, 입력값에 따라 **맞춤형** 결과물을 만들어낸다.

### 실생활 비유

> 붕어빵 기계(팩토리 함수)를 생각해라.
> 같은 틀(구조)을 쓰지만, 팥·크림·피자 등 재료(인자)에 따라 다른 붕어빵(결과물)이 나온다.

```
팩토리 함수
    ┌─────────────────────────────────────────┐
    │ createColumn(role)                      │
    │                                         │
    │  role = 'admin'  →  [col1, col2, col3]  │
    │  role = 'student' → [col1, col2]        │
    │  role = 'teacher' → [col1, col2, col3]  │
    │                                         │
    │  (같은 함수, 다른 재료 → 다른 결과물)    │
    └─────────────────────────────────────────┘
```

### 코드 예시

```typescript
// ─── 팩토리 함수 기본 예시 ────────────────────────────────────

interface Button {
  label: string
  color: string
  onClick: () => void
}

// 팩토리 함수: Button 객체를 찍어냄
function createButton(label: string, color: string): Button {
  return {
    label,
    color,
    onClick: () => alert(`${label} 버튼 클릭!`),
  }
}

const submitButton = createButton('제출', 'blue')
const cancelButton = createButton('취소', 'gray')
const deleteButton = createButton('삭제', 'red')

// 구조는 동일하지만, 내용이 다른 버튼 3개가 생성됨
```

```typescript
// ─── 팩토리 함수: 역할별 메뉴 생성 ──────────────────────────

type Role = 'admin' | 'teacher' | 'student'

interface MenuItem {
  label: string
  href: string
}

function createMenuItems(role: Role): MenuItem[] {
  const baseItems: MenuItem[] = [
    { label: '대시보드', href: '/dashboard' },
    { label: '내 프로필', href: '/profile' },
  ]

  // 역할에 따라 메뉴 항목 추가
  if (role === 'admin') {
    return [
      ...baseItems,
      { label: '사용자 관리', href: '/admin/users' },
      { label: '학원 설정', href: '/admin/settings' },
    ]
  }

  if (role === 'teacher') {
    return [
      ...baseItems,
      { label: '기출문제', href: '/past-exams' },
    ]
  }

  return baseItems // student는 기본 메뉴만
}

const adminMenu = createMenuItems('admin')    // 4개 항목
const studentMenu = createMenuItems('student') // 2개 항목
```

---

## 3. 팩토리 함수 + 클로저 결합 패턴

팩토리 함수가 **클로저를 활용하면** 강력해진다.
함수를 반환할 때, 그 함수 안에 입력값이 자동으로 "박혀" 들어간다.

```typescript
// ─── 결합 패턴: 클로저로 인자를 "기억"하는 팩토리 함수 ─────────

function createLogger(prefix: string) {
  // prefix가 클로저로 캡처됨

  return function log(message: string) {
    // prefix를 따로 받지 않아도 기억하고 있음
    console.log(`[${prefix}] ${message}`)
  }
}

const authLogger = createLogger('AUTH')
const dbLogger = createLogger('DB')

authLogger('로그인 성공')   // "[AUTH] 로그인 성공"
authLogger('로그아웃')      // "[AUTH] 로그아웃"
dbLogger('쿼리 실행')       // "[DB] 쿼리 실행"

// authLogger와 dbLogger는 서로 다른 prefix를 기억하는 별개의 함수
```

### 구조 도식

```
createLogger('AUTH') 호출
  ┌──────────────────────────────┐
  │  prefix = 'AUTH'  ← 캡처됨  │
  │                             │
  │  return function log() {    │
  │    // prefix 사용 가능       │
  │  }                          │
  └──────────────────────────────┘
          ↓
authLogger = log 함수 (내부에 'AUTH'가 박혀있음)

authLogger('메시지') → "[AUTH] 메시지"
         └── prefix를 인자로 넘기지 않아도 동작함
```

**핵심**: 팩토리 함수가 반환하는 값(함수/객체) 안에 생성 당시의 인자가 클로저로 "고정"된다.

---

## 4. 프로젝트 실전 적용

### COMPASS 프로젝트의 실제 사례

이 프로젝트에서 DataTable 컬럼 정의는 팩토리 함수 + 클로저 패턴을 사용한다.
파일 경로: `src/app/(dashboard)/past-exams/_components/past-exam-columns.tsx`

### Before: 정적 배열 (역할 분기 불가)

```typescript
// ─── 정적 배열 방식 (역할 분기 불가) ────────────────────────

export const pastExamColumns: ColumnDef<PastExamListItem>[] = [
  { accessorKey: 'schoolName', header: '학교' },
  { accessorKey: 'subject', header: '과목' },
  {
    id: 'actions',
    cell: ({ row }) => {
      // 문제: callerRole이 없다!
      // 역할에 따라 'AI 문제 생성' 버튼을 보여줄 수가 없음
      return <Button>상세</Button>
    },
  },
]

// 사용 시: <DataTable columns={pastExamColumns} />
// → 모든 사용자에게 동일한 컬럼 노출 (역할 구분 불가)
```

**문제점**: `PastExamDetailSheet`에 `callerRole`을 전달하려면,
컬럼 배열이 `callerRole` 값을 알아야 한다.
그런데 정적 배열은 컴포넌트 밖에서 한 번만 선언되므로 **런타임 값을 받을 수 없다**.

### After: 팩토리 함수 (역할을 클로저로 캡처)

```typescript
// ─── 팩토리 함수 방식 (실제 코드: past-exam-columns.tsx) ─────

export function createPastExamColumns(
  callerRole: string, // 이 값이 클로저로 캡처됨
): ColumnDef<PastExamListItem>[] {
  return [
    { accessorKey: 'schoolName', header: '학교' },
    { accessorKey: 'subject', header: '과목' },
    {
      id: 'actions',
      cell: function ActionsCell({ row }) {
        const [sheetOpen, setSheetOpen] = useState(false)
        const exam = row.original

        return (
          <>
            <Button onClick={() => setSheetOpen(true)}>상세</Button>
            <PastExamDetailSheet
              examId={exam.id}
              callerRole={callerRole} // ← 클로저! 인자로 받지 않고 기억한 값 사용
              open={sheetOpen}
              onOpenChange={setSheetOpen}
            />
          </>
        )
      },
    },
  ]
}

// 사용 시:
// const columns = createPastExamColumns('admin')
// <DataTable columns={columns} />
// → callerRole='admin'이 모든 cell 렌더러에 박혀있음
```

### callerRole이 클로저로 동작하는 과정

```
createPastExamColumns('admin') 호출
  ┌─────────────────────────────────────────┐
  │  callerRole = 'admin'  ← 캡처됨         │
  │                                         │
  │  return [                               │
  │    { cell: ActionsCell }  ← 이 함수가   │
  │  ]                          callerRole을 │
  │                             기억함       │
  └─────────────────────────────────────────┘
          ↓
columns 배열 안의 ActionsCell 함수들은
callerRole='admin'을 인자 없이도 사용 가능

// 나중에 React가 ActionsCell을 렌더링할 때:
// callerRole은 별도 props 없이 클로저로 접근됨
```

### createUserColumns 패턴 비교

파일 경로: `src/app/(dashboard)/admin/users/_components/user-columns.tsx`

```typescript
// ─── user-columns.tsx: 두 개의 인자를 클로저로 캡처 ─────────

export function createUserColumns(
  callerRole: string, // 역할: admin/system_admin만 액션 컬럼 표시
  callerId: string    // 자기 자신 행을 비활성화하기 위한 ID
): ColumnDef<UserProfile>[] {
  const baseColumns = [ /* 기본 컬럼들 */ ]

  // callerRole이 admin/system_admin인 경우에만 액션 컬럼 추가
  if (['admin', 'system_admin'].includes(callerRole)) {
    baseColumns.push({
      id: 'actions',
      cell: function ActionsCell({ row }) {
        const user = row.original
        // callerId가 클로저로 캡처됨 → 자기 자신 행 식별
        const isSelf = user.id === callerId

        // isSelf이면 역할 변경/비활성화 버튼 숨김
        return <ActionMenu disabled={isSelf} />
      },
    })
  }

  return baseColumns
}
```

| 비교 항목 | `createPastExamColumns` | `createUserColumns` |
|---|---|---|
| 캡처하는 인자 | `callerRole` (1개) | `callerRole`, `callerId` (2개) |
| 클로저 활용 목적 | Sheet에 역할 전달 | 역할별 컬럼 추가 + 자기 자신 식별 |
| 조건부 컬럼 추가 | 없음 (항상 동일) | 있음 (admin만 액션 컬럼 추가) |

---

## 5. 정적 배열 vs 팩토리 함수 — 판단 기준

```
컬럼 정의에 런타임 값이 필요한가?
            │
     YES ───┼─── 팩토리 함수 (createXxxColumns)
            │
     NO ────┴─── 정적 배열 (xxxColumns)
```

| 상황 | 선택 | 이유 |
|---|---|---|
| 모든 사용자가 동일한 컬럼을 봄 | 정적 배열 | 불필요한 복잡도 제거 |
| 역할(role)에 따라 컬럼/버튼이 다름 | 팩토리 함수 | 역할을 클로저로 캡처 |
| 현재 로그인한 사용자 ID가 필요 | 팩토리 함수 | ID를 클로저로 캡처 |
| 컬럼 안에서 콜백/핸들러가 외부 상태 접근 | 팩토리 함수 | 외부 값을 클로저로 캡처 |

### 구체적 판단 질문

> "컬럼 정의 안에서 컴포넌트 바깥의 값을 사용하는가?"

- "admin이면 삭제 버튼 보여줘" → 팩토리 함수
- "내 아이디와 같은 행은 수정 불가" → 팩토리 함수
- "날짜 포맷만 바꿔서 표시" → 정적 배열
- "배지 색상만 매핑" → 정적 배열

---

## 6. 안티패턴

### 안티패턴 1: 전역 변수로 우회 (클로저를 피하려다 생기는 문제)

```typescript
// ❌ 나쁜 예: 전역 변수에 역할 저장
let globalCallerRole = '' // 전역 상태 — 절대 금지

export const pastExamColumns: ColumnDef<PastExamListItem>[] = [
  {
    id: 'actions',
    cell: ({ row }) => {
      // 전역 변수 참조: 여러 컴포넌트가 동시에 다른 역할로 사용하면 충돌
      return <PastExamDetailSheet callerRole={globalCallerRole} />
    },
  },
]

// 사용 시:
globalCallerRole = 'admin' // 다른 컴포넌트가 'teacher'로 바꾸면?
```

```typescript
// ✅ 좋은 예: 팩토리 함수로 캡슐화
export function createPastExamColumns(callerRole: string) {
  return [
    {
      id: 'actions',
      cell: ({ row }) => (
        // 각 호출마다 독립된 클로저 — 충돌 없음
        <PastExamDetailSheet callerRole={callerRole} />
      ),
    },
  ]
}
```

### 안티패턴 2: 매 렌더링마다 팩토리 함수 재호출 (성능 문제)

```typescript
// ❌ 나쁜 예: 컴포넌트 본문에서 직접 호출
function PastExamPage({ callerRole }: { callerRole: string }) {
  // 렌더링마다 columns 배열이 새로 생성됨 → DataTable이 매번 리렌더링
  const columns = createPastExamColumns(callerRole)

  return <DataTable columns={columns} data={data} />
}
```

```typescript
// ✅ 좋은 예: useMemo로 메모이제이션
function PastExamPage({ callerRole }: { callerRole: string }) {
  // callerRole이 바뀔 때만 재생성
  const columns = useMemo(
    () => createPastExamColumns(callerRole),
    [callerRole]
  )

  return <DataTable columns={columns} data={data} />
}
```

### 안티패턴 3: 클로저 루프 함정 (var 사용)

```typescript
// ❌ 나쁜 예: var는 블록 스코프가 없어 클로저가 마지막 값만 기억
const buttons = []
for (var i = 0; i < 3; i++) {
  buttons.push(() => console.log(i)) // i를 캡처하는 것처럼 보이지만...
}
buttons[0]() // 3 (0이 아님! var는 루프 종료 후 값인 3을 가리킴)
buttons[1]() // 3
buttons[2]() // 3
```

```typescript
// ✅ 좋은 예: let/const는 블록 스코프 → 각 반복마다 독립 클로저
const buttons = []
for (let i = 0; i < 3; i++) {
  buttons.push(() => console.log(i)) // 각 i가 독립적으로 캡처됨
}
buttons[0]() // 0
buttons[1]() // 1
buttons[2]() // 2
```

### 안티패턴 4: 클로저 과남용 (단순한 경우까지 팩토리 함수로 감쌈)

```typescript
// ❌ 나쁜 예: 역할 분기가 없는데 팩토리 함수로 만듦
export function createSchoolColumns(): ColumnDef<School>[] {
  return [
    { accessorKey: 'name', header: '학교명' },
    { accessorKey: 'region', header: '지역' },
  ]
}
// createSchoolColumns()는 항상 동일한 결과 → 정적 배열이 낫다
```

```typescript
// ✅ 좋은 예: 역할 분기 없으면 정적 배열
export const schoolColumns: ColumnDef<School>[] = [
  { accessorKey: 'name', header: '학교명' },
  { accessorKey: 'region', header: '지역' },
]
```

---

## 7. 연습 문제

### 연습 1: 클로저 읽기

아래 코드의 출력 결과를 예측하라.

```typescript
function makeMultiplier(factor: number) {
  return function (number: number) {
    return number * factor
  }
}

const double = makeMultiplier(2)
const triple = makeMultiplier(3)

console.log(double(5))  // 출력: ___
console.log(triple(5))  // 출력: ___
console.log(double(10)) // 출력: ___
```

<details>
<summary>정답 보기</summary>

```
double(5)  → 10  (factor=2가 클로저로 캡처됨)
triple(5)  → 15  (factor=3이 클로저로 캡처됨)
double(10) → 20  (double은 여전히 factor=2를 기억)
```

`double`과 `triple`은 서로 독립된 클로저다. `makeMultiplier`를 두 번 호출했으므로, 각각 별개의 `factor` 값을 기억하는 별개의 함수다.
</details>

---

### 연습 2: 팩토리 함수 완성하기

빈칸을 채워서 역할에 따라 다른 버튼 목록을 반환하는 팩토리 함수를 완성하라.

```typescript
interface ActionButton {
  label: string
  action: () => void
}

function createActionButtons(
  _______: string, // 역할 인자 추가
  onDelete: () => void,
  onEdit: () => void,
): ActionButton[] {
  const baseButtons: ActionButton[] = [
    { label: '수정', action: _______ }, // onEdit 연결
  ]

  // admin만 삭제 버튼 포함
  if (_______ === 'admin') {             // 역할 확인
    baseButtons.push({ label: '삭제', action: _______ }) // onDelete 연결
  }

  return baseButtons
}
```

<details>
<summary>정답 보기</summary>

```typescript
function createActionButtons(
  role: string,
  onDelete: () => void,
  onEdit: () => void,
): ActionButton[] {
  const baseButtons: ActionButton[] = [
    { label: '수정', action: onEdit },
  ]

  if (role === 'admin') {
    baseButtons.push({ label: '삭제', action: onDelete })
  }

  return baseButtons
}
```

`role`, `onDelete`, `onEdit` 모두 클로저로 캡처된다. 특히 `onDelete`와 `onEdit`은 버튼이 눌릴 때까지 실행되지 않지만, 팩토리 함수 호출 시점의 함수 참조를 기억하고 있다.
</details>

---

### 연습 3: 이 코드의 문제를 찾아라

```typescript
// 문제: 이 컴포넌트에는 성능 문제가 있다. 무엇인가?

function UserTable({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<User[]>([])

  const columns = createUserColumns('admin', currentUserId) // ← 이 줄

  return <DataTable columns={columns} data={users} />
}
```

<details>
<summary>정답 보기</summary>

`createUserColumns`가 컴포넌트 본문에 직접 위치하므로, `UserTable`이 렌더링될 때마다 새 배열이 생성된다. `DataTable`은 `columns` 참조가 바뀌었다고 판단해 매번 리렌더링된다.

해결책:

```typescript
function UserTable({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<User[]>([])

  // currentUserId가 바뀔 때만 재생성
  const columns = useMemo(
    () => createUserColumns('admin', currentUserId),
    [currentUserId]
  )

  return <DataTable columns={columns} data={users} />
}
```
</details>

---

## 참고 자료

- [MDN: Closures](https://developer.mozilla.org/ko/docs/Web/JavaScript/Closures) — 클로저 공식 문서 (한국어)
- [MDN: Functions](https://developer.mozilla.org/ko/docs/Web/JavaScript/Guide/Functions) — 자바스크립트 함수 가이드
- [TanStack Table: Column Defs](https://tanstack.com/table/v8/docs/guide/column-defs) — 프로젝트에서 사용하는 컬럼 정의 방식
- [React: useMemo](https://ko.react.dev/reference/react/useMemo) — 팩토리 함수 결과물 메모이제이션
- [You Don't Know JS: Scope & Closures](https://github.com/getify/You-Dont-Know-JS/blob/2nd-ed/scope-closures/README.md) — 클로저 심화 학습 (영문)

---

## 관련 개념 문서

- `docs/concepts/dry-principle.md` — DRY 원칙 (팩토리 함수로 중복 제거)
- `docs/guides/component-patterns.md` — 컴포넌트 패턴 (render props, compound components)
