# as const (Const Assertion, 상수 단언)

> **분류**: TypeScript 타입 시스템 (Type System Feature)
> **도입**: TypeScript 3.4 (2019)
> **적용 기술스택**: TypeScript 전용. JavaScript에는 존재하지 않음 (컴파일 시 제거됨)

---

## 1. 개념

`as const`는 TypeScript에게 **"이 값은 절대 바뀌지 않으니, 가장 좁은 타입으로 추론해"**라고 알려주는 문법이다.

### 리터럴 타입(Literal Type)이란?

TypeScript의 타입은 **넓은 타입**과 **좁은 타입**이 있다:

```
넓음   string              ← "hello", "world", "abc" ... 모든 문자열 가능
  ↑    "red" | "blue"      ← 딱 둘 중 하나만 가능
좁음   "red"               ← 오직 "red"만 가능
```

`"red"`, `2`, `true` 같은 **구체적인 값 자체가 타입**이 될 수 있다. 이걸 **리터럴 타입**이라고 부른다:

```typescript
let a: string = "hello"   // string 타입 → 아무 문자열 가능
let b: "hello" = "hello"  // "hello" 리터럴 타입 → "hello"만 가능

b = "world"  // ❌ 에러! "hello"만 허용
```

### as const의 역할

`as const`는 값에 대해 **두 가지 효과**를 동시에 적용한다:

1. **readonly** — 수정 불가
2. **리터럴 타입 추론** — `string`이 아니라 `"red"`, `number`가 아니라 `2`

```typescript
// as const 없음
const colors = { primary: "red", secondary: "blue" }
// 추론: { primary: string, secondary: string }

// as const 있음
const colors = { primary: "red", secondary: "blue" } as const
// 추론: { readonly primary: "red", readonly secondary: "blue" }
```

---

## 2. 비유: 메뉴판

```
[일반 메뉴판] (as const 없음)
┌──────────────────────────┐
│  음료: 아무 음료         │  ← string (뭐든 가능)
│  가격: 아무 숫자         │  ← number (뭐든 가능)
│  내용 수정 가능 ✏️       │
└──────────────────────────┘

[확정된 메뉴판] (as const 있음)
┌──────────────────────────┐
│  음료: "아메리카노"      │  ← 딱 이것만 (리터럴 타입)
│  가격: 4500             │  ← 딱 이것만 (리터럴 타입)
│  수정 불가 🔒           │  ← readonly
└──────────────────────────┘
```

메뉴판이 확정되면 음료 이름도, 가격도 바꿀 수 없다. `as const`가 하는 일이 정확히 이것이다.

---

## 3. 동작 원리

### 3-1. 객체에 적용

```typescript
// ❌ as const 없음 — 넓은 타입으로 추론
const DIFFICULTY = {
  easy: 2,
  medium: 3,
  hard: 4,
}
// 타입: { easy: number, medium: number, hard: number }

DIFFICULTY.easy = 999  // ✅ 가능 (그냥 number니까)


// ✅ as const 있음 — 리터럴 타입 + readonly
const DIFFICULTY = {
  easy: 2,
  medium: 3,
  hard: 4,
} as const
// 타입: { readonly easy: 2, readonly medium: 3, readonly hard: 4 }

DIFFICULTY.easy = 999  // ❌ 에러! readonly
```

### 3-2. 배열에 적용

```typescript
// ❌ as const 없음
const COLORS = ["red", "blue", "green"]
// 타입: string[]  (길이도 자유, 내용도 자유)

COLORS.push("yellow")  // ✅ 가능
COLORS[0] = "purple"   // ✅ 가능


// ✅ as const 있음
const COLORS = ["red", "blue", "green"] as const
// 타입: readonly ["red", "blue", "green"]  (튜플, 고정)

COLORS.push("yellow")  // ❌ 에러! readonly
COLORS[0] = "purple"   // ❌ 에러! readonly
```

배열에 `as const`를 적용하면 **튜플(tuple)**이 된다 — 길이가 고정되고, 각 위치의 타입도 고정된다:

```typescript
const COLORS = ["red", "blue", "green"] as const

type First = typeof COLORS[0]   // "red" (string이 아님!)
type Second = typeof COLORS[1]  // "blue"
type Third = typeof COLORS[2]   // "green"
```

### 3-3. 중첩 객체에도 깊게(deep) 적용

`as const`는 **최상위뿐 아니라 내부 객체까지** 모두 readonly + 리터럴로 만든다:

```typescript
const CONFIG = {
  api: {
    url: "https://example.com",
    timeout: 3000,
  },
  retry: {
    max: 3,
    delay: 1000,
  },
} as const

// 내부까지 전부 readonly + 리터럴
CONFIG.api.url = "other"    // ❌ 에러!
CONFIG.retry.max = 10       // ❌ 에러!

type Url = typeof CONFIG.api.url  // "https://example.com"
```

---

## 4. 실전 사용 패턴

### 패턴 1: 매핑 객체 + 타입 추출

프로젝트에서 가장 많이 쓰는 패턴이다:

```typescript
// 난이도 → 숫자 매핑
const DIFFICULTY_TO_NUMBER = {
  easy: 2,
  medium: 3,
  hard: 4,
} as const

// 키 타입 추출: "easy" | "medium" | "hard"
type Difficulty = keyof typeof DIFFICULTY_TO_NUMBER

// 값 타입 추출: 2 | 3 | 4
type DifficultyNumber = typeof DIFFICULTY_TO_NUMBER[Difficulty]

// as const 없었다면?
// Difficulty = "easy" | "medium" | "hard"  ← 이건 동일
// DifficultyNumber = number               ← 999도 가능! 위험!
```

### 패턴 2: 선택지 배열 + 유니온 타입

```typescript
const ROLES = ["admin", "teacher", "student"] as const

// 배열에서 유니온 타입 추출: "admin" | "teacher" | "student"
type Role = typeof ROLES[number]

// 함수에서 활용
function checkRole(role: Role) {
  // role은 "admin" | "teacher" | "student"만 가능
}

checkRole("admin")    // ✅
checkRole("hacker")   // ❌ 에러!
```

`typeof ROLES[number]`는 "배열의 모든 요소 타입을 합쳐라"라는 뜻이다.

### 패턴 3: Badge 색상 매핑 (프로젝트 실제 사용)

```typescript
const DIFFICULTY_BADGE_VARIANT = {
  easy: "secondary",
  medium: "default",
  hard: "destructive",
} as const

// variant가 정확한 값만 허용됨
// as const 없으면 variant: string → Badge 컴포넌트에서 타입 에러 가능
```

### 패턴 4: 상수 열거형 대체 (enum 대신)

```typescript
// ❌ enum — 런타임에 객체가 생성됨 (번들 크기 증가)
enum Direction {
  Up = "UP",
  Down = "DOWN",
}

// ✅ as const — 컴파일 시 제거됨 (번들 크기 영향 없음)
const DIRECTION = {
  Up: "UP",
  Down: "DOWN",
} as const

type Direction = typeof DIRECTION[keyof typeof DIRECTION]
// "UP" | "DOWN"
```

---

## 5. as const vs 비슷한 문법 비교

### as const vs const

```typescript
// const: 변수 재할당 금지 (하지만 내부 수정은 가능)
const obj = { a: 1 }
obj.a = 2       // ✅ 가능! const는 재할당만 막음
obj = { a: 3 }  // ❌ 에러! 재할당 금지

// as const: 내부까지 전부 수정 금지 + 리터럴 타입
const obj = { a: 1 } as const
obj.a = 2       // ❌ 에러! 내부도 readonly
```

| | `const` | `as const` |
|---|---|---|
| 변수 재할당 | ❌ 금지 | ❌ 금지 |
| 내부 값 수정 | ✅ 가능 | ❌ 금지 (readonly) |
| 타입 추론 | 넓음 (`number`) | 좁음 (`2`) |

### as const vs Object.freeze()

```typescript
// Object.freeze(): 런타임에 수정 방지 (실제 에러 발생)
const obj = Object.freeze({ a: 1 })
obj.a = 2  // 런타임에 무시됨 (strict mode면 에러)

// as const: 컴파일 타임에만 수정 방지 (TypeScript 검사)
const obj = { a: 1 } as const
obj.a = 2  // 컴파일 에러 (하지만 JS로 변환되면 사라짐)
```

| | `Object.freeze()` | `as const` |
|---|---|---|
| 작동 시점 | **런타임** (실제 실행 중) | **컴파일 타임** (코드 검사 중) |
| JS 결과물 | `Object.freeze()` 코드 남음 | 완전히 제거됨 |
| 타입 좁히기 | ❌ 안 함 | ✅ 리터럴 타입 |
| 깊은 동결 | ❌ 1단계만 | ✅ 전체 깊이 |

---

## 6. 안티패턴: 이렇게 쓰지 말 것

### ❌ 변경이 필요한 값에 사용

```typescript
// 상태처럼 바뀌어야 하는 값에는 쓰면 안 됨
const [count, setCount] = useState(0)  // as const 쓸 이유 없음

// as const는 "절대 안 바뀌는 상수"에만 사용
const API_ENDPOINTS = {
  users: "/api/users",
  posts: "/api/posts",
} as const
```

### ❌ 타입 추출이 필요 없는 단순 상수

```typescript
// 이건 과함 — 타입을 뽑아 쓸 일이 없다면 그냥 const
const MAX_RETRY = 3          // ✅ 충분
const MAX_RETRY = 3 as const // 불필요 (number든 3이든 상관없음)
```

---

## 7. 한 줄 요약

> **`as const` = readonly(수정 금지) + 리터럴 타입(가장 좁은 타입 추론). 매핑 객체에서 키·값 타입을 안전하게 추출할 때 필수.**

---

## 8. 프로젝트 내 실제 사용처

| 파일 | 사용 | 목적 |
|------|------|------|
| 난이도 매핑 | `DIFFICULTY_TO_NUMBER` | 난이도 문자열 → 숫자 변환 + 타입 추출 |
| Badge variant | `DIFFICULTY_BADGE_VARIANT` | 난이도별 UI 색상 매핑 |
| 역할 상수 | 권한 체크용 상수 객체 | 역할 유니온 타입 추출 |

---

## 참고 자료

- [TypeScript 공식 문서 — const assertions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions)
- [TypeScript 핸드북 — Literal Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#literal-types)
