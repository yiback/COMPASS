# DRY 원칙 완전 가이드

이 문서는 DRY(Don't Repeat Yourself) 원칙의 이론과 COMPASS 프로젝트 내 실제 적용 사례를 다룬다.
"코드 복붙을 줄여라"라는 표면적 이해를 넘어, **지식(knowledge)의 중복**이라는 본질을 짚는다.

> **대상 독자**: DRY가 뭔지 대충 알지만 "언제 적용하고, 언제 무시해야 하는지" 판단이 어려운 개발자

---

## 목차

1. [개요](#1-개요)
2. [핵심 개념](#2-핵심-개념)
3. [DRY 위반 유형 5가지](#3-dry-위반-유형-5가지)
4. [DRY가 아닌 것 (주의사항)](#4-dry가-아닌-것-주의사항)
5. [적용 판단 기준](#5-적용-판단-기준)
6. [COMPASS 프로젝트 적용 사례](#6-compass-프로젝트-적용-사례)
7. [COMPASS 프로젝트 개선 포인트](#7-compass-프로젝트-개선-포인트)
8. [DRY 적용 범위 3단계](#8-dry-적용-범위-3단계)
9. [관련 원칙](#9-관련-원칙)
10. [참조 링크](#10-참조-링크)

---

## 1. 개요

### DRY란?

DRY(Don't Repeat Yourself)는 Andy Hunt와 Dave Thomas가 **The Pragmatic Programmer**(1999)에서 제안한 원칙이다.

> *"Every piece of knowledge must have a single, unambiguous, authoritative representation within a system."*
>
> — *The Pragmatic Programmer*, 1999

번역하면: **모든 지식은 시스템 내에서 단일하고, 명확하고, 권위 있는 표현을 가져야 한다.**

### 왜 중요한가?

| 문제 | DRY 위반 시 결과 | DRY 준수 시 |
|------|-------------------|-------------|
| 버그 수정 | 같은 수정을 N곳에 적용해야 함 | 한 곳만 수정하면 전파됨 |
| 요구사항 변경 | 변경 누락으로 불일치 발생 | 변경 지점이 하나라 누락 없음 |
| 코드 이해 | "이 로직이 여기도 있고 저기도 있네?" | 하나의 정의를 따라가면 됨 |
| 온보딩 | 신규 개발자가 어디가 "진짜"인지 혼란 | Single Source of Truth가 명확 |

핵심은 **중복 코드 자체가 문제가 아니라, 중복된 지식이 동기화되지 않는 것**이 문제라는 점이다.

---

## 2. 핵심 개념

### "지식(Knowledge)"의 중복

DRY에서 말하는 "반복"은 코드 라인의 복붙이 아니다. **비즈니스 규칙, 알고리즘, 데이터 형태 등 "지식"이 두 곳 이상에 존재하는 것**을 말한다.

```typescript
// 두 파일에 같은 "비즈니스 규칙"이 중복
// --- file-a.ts ---
if (score >= 90) grade = 'A'  // 등급 기준: 90점 이상 = A

// --- file-b.ts ---
if (score >= 90) grade = 'A'  // 같은 규칙이 또 있음
```

만약 등급 기준이 85점으로 바뀌면? 두 곳 모두 수정해야 하고, 한 곳을 빠뜨리면 버그가 된다.

### Single Source of Truth (SSOT)

DRY의 실천법은 **하나의 권위 있는 정의**를 만들고 나머지는 그것을 참조하게 하는 것이다.

```typescript
// --- grading-rules.ts --- (SSOT)
export const GRADE_THRESHOLDS = {
  A: 90,
  B: 80,
  C: 70,
} as const

// --- file-a.ts ---
import { GRADE_THRESHOLDS } from './grading-rules'
if (score >= GRADE_THRESHOLDS.A) grade = 'A'

// --- file-b.ts ---
import { GRADE_THRESHOLDS } from './grading-rules'
if (score >= GRADE_THRESHOLDS.A) grade = 'A'
```

이제 기준이 바뀌면 `grading-rules.ts` 한 곳만 수정하면 된다.

---

## 3. DRY 위반 유형 5가지

### 3-1. 코드 중복 (복붙)

가장 눈에 보이는 형태. 같은 로직 블록이 여러 파일에 복사되어 있다.

```typescript
// ❌ 나쁜 예: 두 컴포넌트에서 동일한 포맷 함수를 각각 정의
// --- ComponentA.tsx ---
const formatDate = (date: Date) => {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

// --- ComponentB.tsx ---
const formatDate = (date: Date) => {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

// ✅ 좋은 예: 유틸리티로 추출
// --- lib/format.ts ---
export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}
```

### 3-2. 타입/스키마 이중 정의

같은 데이터 형태를 TypeScript 타입과 Zod 스키마에서 각각 정의하는 경우.

```typescript
// ❌ 나쁜 예: 타입과 스키마가 따로 놈
interface User {
  name: string
  email: string
  age: number
}

const userSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number(),
})
// User 인터페이스와 userSchema가 동기화 안 될 위험

// ✅ 좋은 예: 스키마에서 타입을 추론
const userSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number(),
})

type User = z.infer<typeof userSchema>
// 스키마가 변경되면 타입도 자동으로 변경됨
```

> COMPASS 프로젝트의 Zod 활용 패턴은 [`docs/guides/zod-validation.md`](./zod-validation.md) 참조.

### 3-3. 매직 넘버/문자열 반복

의미 있는 값이 리터럴로 흩어져 있는 경우.

```typescript
// ❌ 나쁜 예: '90'이 여러 곳에 흩어짐
if (score >= 90) { /* ... */ }
if (average >= 90) { /* ... */ }

// ✅ 좋은 예: 상수로 추출
const GRADE_A_THRESHOLD = 90

if (score >= GRADE_A_THRESHOLD) { /* ... */ }
if (average >= GRADE_A_THRESHOLD) { /* ... */ }
```

### 3-4. 지식의 중복 (코드가 달라도 같은 지식)

코드의 형태는 다르지만 **동일한 비즈니스 규칙**을 표현하는 경우. 가장 발견하기 어려운 유형이다.

```typescript
// ❌ 나쁜 예: "성인 판단"이라는 같은 지식이 다른 형태로 존재
// --- registration.ts ---
if (user.age >= 18) { allowRegistration() }

// --- pricing.ts ---
if (birthYear <= currentYear - 18) { applyAdultPrice() }

// ✅ 좋은 예: 하나의 함수로 통합
// --- user-rules.ts ---
export function isAdult(age: number): boolean {
  return age >= 18
}
```

### 3-5. 문서/코드 동기화 불일치

코드를 변경했지만 관련 문서를 업데이트하지 않은 경우.

```typescript
/**
 * 사용자 점수를 계산합니다.
 * @param items - 최대 5개의 항목  // ← 문서: 5개
 */
function calculateScore(items: Item[]): number {
  if (items.length > 10) throw new Error('Too many')  // ← 코드: 10개
  // ...
}
```

이것도 DRY 위반이다. 주석의 "5개"와 코드의 "10개"는 같은 지식이 불일치한 상태다.

---

## 4. DRY가 아닌 것 (주의사항)

DRY를 과도하게 적용하면 오히려 코드가 나빠진다. 다음 세 가지를 기억하자.

### 4-1. 우연히 비슷한 코드 ≠ DRY 위반

```typescript
// 두 함수가 비슷하게 생겼지만 "다른 이유"로 변경됨
function validateStudentForm(data: StudentForm) {
  if (!data.name) throw new Error('이름 필수')
  if (!data.grade) throw new Error('학년 필수')
}

function validateTeacherForm(data: TeacherForm) {
  if (!data.name) throw new Error('이름 필수')
  if (!data.subject) throw new Error('과목 필수')
}
```

얼핏 `name` 검증이 중복되어 보이지만, 학생 폼과 교사 폼은 **서로 다른 이유로 변경**된다. 이를 억지로 합치면 한쪽 변경이 다른 쪽에 영향을 줄 수 있다.

### 4-2. 과도한 DRY = 조기 추상화

**AHA (Avoid Hasty Abstractions)** 원칙: 2번 반복되면 참고, 3번째에 추상화를 고려하라.

```typescript
// ❌ 과도한 DRY: 2번 나왔다고 바로 추상화
function createEntity<T extends { name: string }>(
  type: 'student' | 'teacher' | 'parent',
  data: T,
  hooks: { beforeSave?: () => void; afterSave?: () => void }
) {
  // 범용적으로 만들었지만 각 타입마다 다른 로직이 필요해지면서
  // 조건문이 증가하고, 읽기 어려워짐
}

// ✅ 적절한 수준: 세 줄의 유사 코드는 그냥 두는 게 낫다
async function createStudent(data: StudentData) { /* ... */ }
async function createTeacher(data: TeacherData) { /* ... */ }
```

### 4-3. WET (Write Everything Twice)

WET는 DRY의 실용적 변형이다. "2번까지는 중복을 허용하고, 3번째 반복에서 추상화하라."

| 반복 횟수 | 전략 |
|-----------|------|
| 1번 | 그냥 작성 |
| 2번 | 중복 인지, 일단 유지 |
| 3번 | 패턴 확인 후 추상화 |

---

## 5. 적용 판단 기준

DRY를 적용할지 말지 결정하는 핵심 질문:

> **"이 두 코드가 같은 이유로, 같은 시점에, 함께 변경되는가?"**

| 조건 | 판단 | 행동 |
|------|------|------|
| 같은 이유로 함께 변경됨 | DRY 위반 | 하나의 정의로 통합 |
| 우연히 비슷할 뿐, 독립적으로 변경됨 | DRY 아님 | 중복 유지 (각자 진화) |
| 2번 반복됨 | 관찰 | 일단 유지, 3번째 때 판단 |
| 3번 이상 반복, 같은 변경 패턴 | DRY 위반 확실 | 반드시 추상화 |

보조 질문들:

- "이 값이 바뀌면 다른 곳도 함께 바꿔야 하나?" → Yes면 DRY 적용
- "이걸 합치면 한쪽 변경이 다른 쪽을 깨뜨릴 수 있나?" → Yes면 분리 유지
- "이 추상화가 코드 이해를 더 어렵게 만드나?" → Yes면 중복이 나을 수 있음

---

## 6. COMPASS 프로젝트 적용 사례

### 사례 1: Zod 스키마 공유 — 클라이언트/서버 이중 검증

COMPASS에서는 Zod 스키마를 **하나 정의**하고, 클라이언트(폼 검증)와 서버(Server Action 검증) 양쪽에서 재사용한다.

```
src/lib/validations/
  └── question.ts   ← 스키마 + 타입을 여기서 한 번만 정의

src/app/generate/page.tsx    ← 클라이언트: 폼 검증에 사용
src/app/actions/question.ts  ← 서버: Server Action에서 재검증
```

```typescript
// --- src/lib/validations/question.ts ---
import { z } from 'zod'

export const questionSchema = z.object({
  subject: z.string().min(1, '과목을 선택하세요'),
  grade: z.number().int().min(1).max(3),
  difficulty: z.enum(['easy', 'medium', 'hard']),
})

// 타입을 스키마에서 추론 → 이중 정의 방지
export type QuestionInput = z.infer<typeof questionSchema>
```

**DRY 효과**: 검증 규칙이 바뀌면 `question.ts` 한 곳만 수정. 타입도 자동 동기화.

### 사례 2: AI 에러 클래스 상속 계층

> 파일: `src/lib/ai/errors.ts`

AI 서비스에서 발생할 수 있는 에러를 **클래스 상속**으로 구조화했다. 공통 속성(`code`, `isRetryable`)은 부모 클래스에 한 번만 정의한다.

```
AIError (기본)
├── AIServiceError    - API 호출 실패 (isRetryable: true)
├── AIValidationError - 응답 형식 불일치 (isRetryable: false)
├── AIRateLimitError  - 요청 한도 초과 (isRetryable: true)
└── AIConfigError     - 환경변수 누락 (isRetryable: false)
```

```typescript
// 기본 에러 클래스: code와 isRetryable을 한 번만 정의
export class AIError extends Error {
  readonly code: string
  readonly isRetryable: boolean

  constructor(message: string, code: string, isRetryable: boolean, cause?: Error) {
    super(message, { cause })
    this.name = 'AIError'
    this.code = code
    this.isRetryable = isRetryable
  }
}

// 하위 클래스: 부모의 constructor를 호출, 고유 속성만 추가
export class AIRateLimitError extends AIError {
  readonly retryAfterMs?: number

  constructor(message: string, retryAfterMs?: number, cause?: Error) {
    super(message, 'AI_RATE_LIMIT_ERROR', true, cause)
    this.name = 'AIRateLimitError'
    this.retryAfterMs = retryAfterMs
  }
}
```

**DRY 효과**: `code`, `isRetryable`, `cause` 처리 로직을 4개 하위 클래스에서 반복하지 않음. 새 에러 타입 추가 시 `AIError`를 extends하면 끝.

### 사례 3: 메뉴 상수 중앙 관리 (SSOT)

> 파일: `src/lib/constants/menu.ts`

사이드바(`DashboardSidebar`)와 모바일 메뉴(`MobileNav`) 두 컴포넌트가 **동일한 메뉴 목록**을 표시한다. 메뉴 데이터를 상수 파일에 한 번 정의하고 양쪽에서 import한다.

```typescript
// --- src/lib/constants/menu.ts --- (SSOT)
export interface MenuItem {
  title: string
  href: string
  icon: LucideIcon
  description?: string
}

export const MENU_ITEMS: MenuItem[] = [
  { title: '대시보드', href: '/dashboard', icon: LayoutDashboard },
  { title: '기출문제', href: '/past-exams', icon: FileText },
  { title: '문제 생성', href: '/generate', icon: Sparkles },
  { title: '설정',     href: '/settings',  icon: Settings },
]
```

```typescript
// --- dashboard-sidebar.tsx ---
import { MENU_ITEMS } from '@/lib/constants/menu'
// MENU_ITEMS.map(...)으로 렌더링

// --- mobile-nav.tsx ---
import { MENU_ITEMS } from '@/lib/constants/menu'
// 같은 MENU_ITEMS.map(...)으로 렌더링
```

**DRY 효과**: 메뉴 항목 추가/삭제 시 `menu.ts` 한 곳만 수정하면 데스크톱/모바일 양쪽에 반영. 동기화 누락 가능성 제로.

### 사례 4: Supabase 클라이언트 팩토리

> 파일: `src/lib/supabase/client.ts`, `server.ts`, `admin.ts`

Supabase 연결 클라이언트를 **실행 환경별 팩토리 함수**로 분리했다. 각각이 고유한 설정을 가지면서도, `Database` 타입을 공유한다.

| 파일 | 환경 | 키 | RLS |
|------|------|-----|-----|
| `client.ts` | 브라우저 (Client Component) | anon key | 적용 |
| `server.ts` | 서버 (Server Component, Action) | anon key + cookies | 적용 |
| `admin.ts` | 서버 (관리자 작업) | service role key | **우회** |

```typescript
// client.ts - 브라우저용
import { Database } from './types'  // ← 공유 타입
export function createClient() {
  return createBrowserClient<Database>(/* ... */)
}

// server.ts - 서버용
import { Database } from './types'  // ← 같은 타입 재사용
export async function createClient() {
  return createServerClient<Database>(/* ... */)
}

// admin.ts - 관리자용
import { Database } from './types'  // ← 같은 타입 재사용
export function createAdminClient() {
  return createClient<Database>(/* ... */)
}
```

**DRY 효과**: `Database` 타입(= DB 스키마 지식)이 한 곳(`types.ts`)에만 정의됨. 스키마가 변경되면 타입 파일만 재생성하면 3개 클라이언트 모두 반영.

> 이 세 파일의 구조가 비슷해 보이지만, **설정이 다르고 사용 환경이 다르므로** 하나로 합치면 안 된다. "우연히 비슷한 코드"의 좋은 예시다 (§4-1 참조).

### 사례 5: `cn()` 유틸리티 함수

> 파일: `src/lib/utils.ts`

Tailwind CSS 클래스를 조건부로 병합하는 `cn()` 함수를 한 곳에 정의하고, 프로젝트 전체(현재 22개 컴포넌트 파일)에서 재사용한다.

```typescript
// --- src/lib/utils.ts --- (단 3줄)
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

```typescript
// 사용 예: dashboard-sidebar.tsx
<Link className={cn(
  'group flex items-center gap-3 rounded-md px-3 py-2',
  isActive
    ? 'bg-primary text-primary-foreground'
    : 'text-muted-foreground hover:bg-accent'
)}>
```

**DRY 효과**: `clsx` + `twMerge` 조합 패턴을 22개 파일에서 각각 작성하는 대신 `cn()` 한 줄로 호출. shadcn/ui 컴포넌트의 표준 패턴이기도 하다.

### 사례 6: DataTable 제너릭 컴포넌트

> 파일: `src/components/data-table/data-table.tsx`

TanStack Table 기반의 **제너릭 테이블 컴포넌트**. 데이터 타입 `TData`에 관계없이 정렬, 필터, 페이지네이션을 제공한다.

```typescript
// 제너릭 타입 파라미터 <TData, TValue>로 어떤 데이터든 수용
interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  noResultsMessage?: string
  showPagination?: boolean
  toolbar?: (table: ReturnType<typeof useReactTable<TData>>) => React.ReactNode
}

export function DataTable<TData, TValue>({
  columns, data, noResultsMessage, showPagination, toolbar,
}: DataTableProps<TData, TValue>) {
  // 정렬, 필터, 페이지네이션 상태 관리 (공통 로직)
  // ...
}
```

사용 시에는 **컬럼 정의만** 달라진다:

```typescript
// 기출문제 테이블
<DataTable columns={examColumns} data={exams} />

// 학생 목록 테이블
<DataTable columns={studentColumns} data={students} />
```

**DRY 효과**: 테이블 셋업(정렬, 필터, 페이지네이션, 빈 상태 처리)을 매번 반복하지 않음. `toolbar` render prop으로 테이블별 커스텀 UI도 가능.

---

## 7. COMPASS 프로젝트 개선 포인트

현재 프로젝트에서 발견된 DRY 위반 사례와 개선 방향.

### 7-1. `getInitials()` 로컬 정의

> 파일: `src/components/layout/dashboard-header.tsx:18-26`

`getInitials()` 함수가 컴포넌트 내부에 로컬 정의되어 있다. 현재는 한 곳에서만 사용하지만, 사용자 아바타가 표시되는 곳이 늘어나면 중복될 위험이 있다.

```typescript
// 현재: 컴포넌트 내부에 로컬 정의
export function DashboardHeader({ user }: DashboardHeaderProps) {
  const getInitials = (name?: string) => {
    if (!name) return '?'
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  }
  // ...
}
```

**개선 방향**: 아바타 관련 컴포넌트가 추가될 때(예: 댓글 작성자, 학생 목록 등) `lib/utils.ts` 또는 `lib/format.ts`로 추출을 고려.

```typescript
// 개선 예: lib/format.ts
export function getInitials(name?: string): string {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}
```

> **참고**: 현재 1곳에서만 사용하므로 지금 당장 추출할 필요는 없다 (WET 원칙: 3번 반복 시 추출). 하지만 "잠재적 DRY 위반"으로 인지해 두면 좋다.

### 7-2. Supabase 사용자 프로필 조회 중복

> 파일: `src/app/(dashboard)/layout.tsx:20-34`, `src/app/(dashboard)/page.tsx:10-25`

대시보드 레이아웃과 홈 페이지에서 **동일한 패턴**으로 사용자 프로필을 조회하고 있다.

```typescript
// --- layout.tsx ---
const supabase = await createClient()
const { data: { user: authUser } } = await supabase.auth.getUser()
let userProfile = null
if (authUser) {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, role')
    .eq('id', authUser.id)
    .single()
  userProfile = data
}

// --- page.tsx ---
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
let userName: string | null = null
if (user) {
  const { data } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single()
  userName = (data as { name: string } | null)?.name || null
}
```

같은 "현재 사용자의 프로필을 조회한다"는 **지식**이 두 곳에 존재한다. select 컬럼이 다르지만 핵심 패턴(인증 확인 → profiles 조회)은 동일하다.

**개선 방향**: 프로필 조회를 서비스 함수로 추출.

```typescript
// 개선 예: lib/services/profile.ts
export async function getCurrentUserProfile(
  fields: string = 'id, name, email, avatar_url, role'
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select(fields)
    .eq('id', user.id)
    .single()

  return data
}
```

> **참고**: Next.js Server Component에서 `fetch`를 사용하면 자동 요청 중복 제거(deduplication)가 동작하지만, Supabase 클라이언트를 직접 사용하는 경우에는 해당 최적화가 적용되지 않는다. 서비스 함수 추출은 DRY 측면뿐 아니라 **향후 캐싱 전략 적용**에도 유리하다.

---

## 8. DRY 적용 범위 3단계

DRY는 코드 내부에서만 적용되는 것이 아니다.

### 단계 1: 코드 내 (Within Code)

한 프로젝트 내에서 같은 로직/값을 한 곳에 정의.

- 상수 추출 (`MENU_ITEMS`, `GRADE_THRESHOLDS`)
- 유틸리티 함수 (`cn()`, `getInitials()`)
- 제너릭 컴포넌트 (`DataTable<TData>`)

### 단계 2: 모듈 간 (Across Modules)

서로 다른 모듈/레이어가 공유하는 지식을 한 곳에 정의.

- Zod 스키마 공유 (클라이언트 ↔ 서버)
- `Database` 타입 공유 (3개 Supabase 클라이언트)
- 에러 클래스 상속 계층 (AI 서비스 전체)

### 단계 3: 시스템 간 (Across Systems)

서로 다른 시스템/서비스 간 지식 동기화.

- DB 스키마 → TypeScript 타입 자동 생성 (`supabase gen types`)
- OpenAPI 스펙 → 클라이언트 SDK 자동 생성
- 환경변수 스키마 → `.env.example` + Zod 검증

COMPASS에서는 Supabase CLI의 `supabase gen types typescript` 명령으로 DB 스키마에서 TypeScript 타입을 자동 생성하여, DB 스키마와 코드 타입 간의 DRY를 보장한다.

---

## 9. 관련 원칙

DRY는 단독으로 존재하지 않는다. 관련 원칙들과의 관계를 이해하면 더 나은 판단이 가능하다.

| 원칙 | 설명 | DRY와의 관계 |
|------|------|--------------|
| **WET** | Write Everything Twice. 2번까지 중복 허용 | DRY의 실용적 완화 |
| **SSOT** | Single Source of Truth. 하나의 권위 있는 정의 | DRY의 핵심 실천법 |
| **AHA** | Avoid Hasty Abstractions. 성급한 추상화 금지 | DRY 과적용 방지 |
| **KISS** | Keep It Simple, Stupid. 단순하게 유지 | DRY 추상화의 복잡도 한계 설정 |
| **YAGNI** | You Aren't Gonna Need It. 불필요한 기능 금지 | "나중에 중복될 것 같아서" 미리 추상화하지 마라 |

> COMPASS 프로젝트의 핵심 개발 원칙인 **"MVP 집중"**과 **"점진적 개선"**은 DRY/AHA/YAGNI와 잘 어울린다. 처음부터 완벽한 추상화보다, 중복이 실제로 발생할 때 리팩토링한다.

### 판단 흐름도

```
중복 발견
  └─ "같은 이유로 함께 변경되는가?"
       ├─ Yes → 추상화 (DRY 적용)
       └─ No  → "3번 이상 반복되었는가?"
                  ├─ Yes → 패턴 확인 후 추상화 (AHA)
                  └─ No  → 중복 유지 (WET/YAGNI)
```

---

## 10. 참조 링크

### 출처 서적

- *The Pragmatic Programmer* — Andrew Hunt, David Thomas (1999)
  - DRY 원칙의 최초 정의
- *The Pragmatic Programmer, 20th Anniversary Edition* (2019)
  - DRY의 범위를 "코드 + 데이터 + API + 문서"로 확장

### 관련 프로젝트 파일

| 파일 | 역할 |
|------|------|
| `src/lib/ai/errors.ts` | AI 에러 클래스 상속 계층 |
| `src/lib/constants/menu.ts` | 메뉴 상수 SSOT |
| `src/lib/supabase/client.ts` | 브라우저 클라이언트 팩토리 |
| `src/lib/supabase/server.ts` | 서버 클라이언트 팩토리 |
| `src/lib/supabase/admin.ts` | 관리자 클라이언트 팩토리 |
| `src/lib/utils.ts` | `cn()` 유틸리티 |
| `src/components/data-table/data-table.tsx` | 제너릭 DataTable |
| `src/components/layout/dashboard-header.tsx` | getInitials() 위반 사례 |
| `src/app/(dashboard)/layout.tsx` | 프로필 조회 위반 사례 |
| `src/app/(dashboard)/page.tsx` | 프로필 조회 위반 사례 |

### 관련 가이드

- [`docs/guides/zod-validation.md`](./zod-validation.md) — Zod 스키마를 통한 타입/검증 DRY
- [`docs/guides/component-patterns.md`](./component-patterns.md) — 제너릭 컴포넌트 패턴
- [`docs/guides/styling-guide.md`](./styling-guide.md) — `cn()` 유틸리티 활용법
