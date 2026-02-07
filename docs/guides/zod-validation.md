# Zod 검증 완전 가이드

이 문서는 COMPASS 프로젝트에서 Zod를 활용한 데이터 검증 패턴을 설명합니다.
환경변수 검증, AI 응답 검증, 폼 검증 등 실제 활용 사례를 중심으로 구성했습니다.

> **프로젝트 버전**: zod `^4.3.6` / zod-to-json-schema `^3.25.1`

---

## 목차

1. [개요](#1-개요)
2. [핵심 개념](#2-핵심-개념)
3. [기본 타입 메서드](#3-기본-타입-메서드)
4. [고급 기능](#4-고급-기능)
5. [에러 처리](#5-에러-처리)
6. [Zod v4 특이사항](#6-zod-v4-특이사항)
7. [COMPASS 활용 패턴](#7-compass-활용-패턴)
8. [안티패턴 및 주의사항](#8-안티패턴-및-주의사항)
9. [참조 링크](#9-참조-링크)

---

## 1. 개요

### Zod란?

Zod는 **TypeScript 우선(TypeScript-first)** 스키마 선언 및 데이터 검증 라이브러리다.
"스키마"를 정의하면 그것이 곧 **런타임 검증기**이자 **타입 정의**가 된다.

### 왜 필요한가?

TypeScript의 타입 시스템은 **컴파일 타임**에만 동작한다. 런타임에는 다음과 같은 상황에서 타입 안전성이 보장되지 않는다:

| 상황 | 문제 | Zod 해결 |
|------|------|----------|
| API 응답 수신 | 서버가 약속한 형식과 다를 수 있음 | 응답 데이터를 스키마로 검증 |
| 환경변수 읽기 | `process.env`는 항상 `string \| undefined` | coerce로 타입 변환 + 검증 |
| 폼 입력 처리 | 사용자 입력은 신뢰할 수 없음 | 클라이언트/서버 이중 검증 |
| AI 모델 응답 | JSON 형식이 불완전할 수 있음 | 구조화된 응답 파싱 + 검증 |
| 외부 데이터 파싱 | CSV, JSON 파일 등 형식 불확실 | safeParse로 안전한 파싱 |

핵심은 **"타입스크립트가 끝나는 곳에서 Zod가 시작한다"**는 점이다.

---

## 2. 핵심 개념

### 스키마 (Schema)

스키마는 데이터의 **형태(shape)**와 **제약 조건(constraints)**을 선언한 객체다.

```typescript
import { z } from 'zod'

// 스키마 = "이 데이터는 이런 형태여야 한다"는 선언
const userSchema = z.object({
  name: z.string().min(1, '이름은 필수입니다'),
  age: z.number().int().min(0).max(150),
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
})
```

### 파싱 (Parsing)

스키마에 데이터를 넣으면 **검증 + 변환**이 동시에 일어난다. 이것을 "파싱"이라 한다.

```typescript
// parse: 실패 시 예외를 던짐
const user = userSchema.parse({
  name: '김철수',
  age: 25,
  email: 'kim@example.com',
})
// user의 타입이 자동으로 { name: string; age: number; email: string }

// safeParse: 예외 없이 결과 객체를 반환
const result = userSchema.safeParse(unknownData)
if (result.success) {
  // result.data는 검증된 데이터
} else {
  // result.error는 ZodError 객체
}
```

### 타입 추론 (Type Inference)

Zod 스키마에서 TypeScript 타입을 **자동 추론**할 수 있다. 타입을 별도로 정의할 필요가 없다.

```typescript
// 스키마로부터 타입 추출
type User = z.infer<typeof userSchema>
// 결과: { name: string; age: number; email: string }

// 이렇게 하면 스키마와 타입이 항상 동기화된다
// 타입을 수동으로 정의하면 스키마와 어긋날 위험이 있음
```

**핵심 원칙: 스키마가 Single Source of Truth(유일한 진실 공급원)이다.**

---

## 3. 기본 타입 메서드

### 원시 타입

```typescript
// 문자열
z.string()                          // 기본 문자열
z.string().min(1)                   // 최소 1자 (빈 문자열 불가)
z.string().max(100)                 // 최대 100자
z.string().email()                  // 이메일 형식
z.string().url()                    // URL 형식
z.string().uuid()                   // UUID 형식
z.string().regex(/^[A-Z]{3}-\d+$/) // 정규식 매칭
z.string().trim()                   // 앞뒤 공백 제거 (변환)
z.string().toLowerCase()            // 소문자 변환 (변환)

// 숫자
z.number()                          // 기본 숫자
z.number().int()                    // 정수만
z.number().min(0)                   // 최솟값
z.number().max(100)                 // 최댓값
z.number().positive()               // 양수
z.number().nonnegative()            // 0 이상

// 불리언
z.boolean()

// 날짜
z.date()
z.date().min(new Date('2000-01-01'))
z.date().max(new Date())
```

### 열거형 (Enum)

```typescript
// 문자열 리터럴 유니온 (가장 많이 사용)
const roleSchema = z.enum(['student', 'teacher', 'admin'])
type Role = z.infer<typeof roleSchema> // 'student' | 'teacher' | 'admin'

// 열거형 값 목록 접근
roleSchema.options // ['student', 'teacher', 'admin']

// TypeScript enum과 연동
enum Status {
  Active = 'active',
  Inactive = 'inactive',
}
const statusSchema = z.nativeEnum(Status)
```

### 배열 (Array)

```typescript
z.array(z.string())                 // string[]
z.array(z.number()).min(1)          // 최소 1개 요소
z.array(z.number()).max(10)         // 최대 10개 요소
z.array(z.number()).length(5)       // 정확히 5개

// 실용 예시: 태그 목록
const tagsSchema = z
  .array(z.string().min(1).max(20))
  .min(1, '최소 1개의 태그가 필요합니다')
  .max(10, '태그는 최대 10개까지 가능합니다')
```

### 객체 (Object)

```typescript
const profileSchema = z.object({
  name: z.string(),
  bio: z.string().optional(),       // string | undefined
  age: z.number().nullable(),       // number | null
})

// 부분 객체 (모든 필드 optional)
const partialProfile = profileSchema.partial()
// { name?: string; bio?: string; age?: number | null }

// 필수 객체 (모든 필드 required)
const requiredProfile = profileSchema.required()

// 특정 필드만 선택
const nameOnly = profileSchema.pick({ name: true })
// { name: string }

// 특정 필드 제외
const withoutBio = profileSchema.omit({ bio: true })
// { name: string; age: number | null }

// 스키마 병합
const extendedSchema = profileSchema.extend({
  role: z.enum(['student', 'teacher']),
})
```

### 선택/널 처리

```typescript
z.string().optional()     // string | undefined
z.string().nullable()     // string | null
z.string().nullish()      // string | null | undefined

// 기본값 설정
z.string().default('기본값')  // undefined일 때 '기본값' 사용
z.number().default(0)

// catch: 파싱 실패 시 대체값 반환 (예외 대신)
z.number().catch(0)       // 숫자가 아니면 0 반환
```

---

## 4. 고급 기능

### coerce (타입 강제 변환)

`coerce`는 입력값을 **먼저 해당 타입으로 변환**한 뒤 검증한다.
환경변수(`process.env`)처럼 항상 문자열인 값을 다룰 때 필수다.

```typescript
// 문자열 → 숫자로 변환 후 검증
z.coerce.number()           // "42" → 42, "abc" → NaN → 실패
z.coerce.number().int()     // "42" → 42 (정수 확인)

// 문자열 → 불리언으로 변환
z.coerce.boolean()          // "true" → true, "" → false

// 문자열 → Date로 변환
z.coerce.date()             // "2024-01-01" → Date 객체

// COMPASS config.ts에서의 활용 예시
const configSchema = z.object({
  apiKey: z.string().min(1, 'API 키는 필수입니다'),
  maxRetries: z.coerce.number().int().min(1).max(10).default(3),
  timeoutMs: z.coerce.number().int().min(1000).max(120_000).default(30_000),
})
```

### transform (값 변환)

`transform`은 검증 **이후** 데이터를 변환한다. coerce와 달리 검증이 먼저 일어난다.

```typescript
// 문자열을 파싱 후 숫자로 변환
const stringToNumber = z.string().transform((val) => parseInt(val, 10))
// "42" → 42

// 입출력 타입이 다름
type Input = z.input<typeof stringToNumber>   // string
type Output = z.output<typeof stringToNumber> // number

// 실용 예시: 쉼표 구분 문자열을 배열로
const csvToArray = z.string().transform((val) =>
  val.split(',').map((s) => s.trim()).filter(Boolean)
)
// "react, next, zod" → ['react', 'next', 'zod']
```

### refine (커스텀 검증)

`refine`은 기본 메서드로 표현할 수 없는 **커스텀 검증 로직**을 추가한다.

```typescript
// 단일 필드 검증
const passwordSchema = z
  .string()
  .min(8)
  .refine(
    (val) => /[A-Z]/.test(val) && /[0-9]/.test(val),
    { message: '대문자와 숫자를 최소 1개씩 포함해야 합니다' }
  )

// 비동기 검증 (DB 조회 등)
const uniqueEmailSchema = z
  .string()
  .email()
  .refine(
    async (email) => {
      const existing = await checkEmailExists(email)
      return !existing
    },
    { message: '이미 사용 중인 이메일입니다' }
  )
```

### superRefine (다중 필드 교차 검증)

`superRefine`은 여러 필드를 동시에 검증하며, **여러 에러를 한 번에 추가**할 수 있다.

```typescript
const registerSchema = z
  .object({
    password: z.string().min(8),
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '비밀번호가 일치하지 않습니다',
        path: ['confirmPassword'],
      })
    }
  })
```

> **refine vs superRefine**: 단일 필드 검증은 `refine`, 다중 필드 교차 검증이나 여러 에러를 동시에 반환해야 할 때는 `superRefine`을 사용한다.

### union / discriminatedUnion

```typescript
// union: 여러 스키마 중 하나와 매칭 (순서대로 시도)
const responseSchema = z.union([
  z.object({ type: z.literal('success'), data: z.unknown() }),
  z.object({ type: z.literal('error'), message: z.string() }),
])

// discriminatedUnion: 판별자(discriminator) 필드로 빠르게 분기
// union보다 성능이 좋고 에러 메시지가 명확함
const eventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), x: z.number(), y: z.number() }),
  z.object({ type: z.literal('scroll'), offset: z.number() }),
  z.object({ type: z.literal('keypress'), key: z.string() }),
])

// "type" 필드를 보고 즉시 어떤 스키마를 적용할지 결정
```

### pipe (단계적 파싱)

`pipe`는 **한 스키마의 출력을 다른 스키마의 입력으로** 연결한다.
coerce + 추가 검증이 필요할 때 유용하다.

```typescript
// 문자열 → 숫자 변환 → 범위 검증
const portSchema = z.coerce.number().pipe(
  z.number().int().min(1).max(65535)
)

// JSON 문자열 → 객체 파싱 → 스키마 검증
const jsonStringToUser = z
  .string()
  .transform((str) => JSON.parse(str))
  .pipe(userSchema)
```

---

## 5. 에러 처리

### parse vs safeParse

```typescript
const schema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
})

// parse: 실패 시 ZodError 예외를 던짐
// → try/catch로 감싸야 함
try {
  const data = schema.parse(input)
  // data 사용
} catch (error) {
  if (error instanceof z.ZodError) {
    // 에러 처리
  }
}

// safeParse: 예외 없이 결과 객체 반환 (권장)
// → 조건 분기로 처리
const result = schema.safeParse(input)
if (result.success) {
  // result.data: 검증된 데이터
} else {
  // result.error: ZodError 객체
}
```

**권장**: 대부분의 경우 `safeParse`를 사용한다. 단, 검증 실패가 프로그램 오류(환경변수 누락 등)인 경우에는 `parse`로 즉시 중단하는 것이 적절하다.

### ZodError 구조

```typescript
const result = schema.safeParse({ name: '', age: -5 })

if (!result.success) {
  // issues: 개별 에러 목록
  result.error.issues
  // [
  //   { code: 'too_small', path: ['name'], message: '...' },
  //   { code: 'too_small', path: ['age'], message: '...' },
  // ]

  // flatten(): 필드별로 에러 그룹화 (폼 에러에 최적)
  result.error.flatten()
  // {
  //   formErrors: [],          // 최상위 에러
  //   fieldErrors: {
  //     name: ['이름은 필수입니다'],
  //     age: ['양수여야 합니다'],
  //   }
  // }

  // format(): 중첩 객체 구조로 에러 정리
  result.error.format()
  // {
  //   name: { _errors: ['이름은 필수입니다'] },
  //   age: { _errors: ['양수여야 합니다'] },
  // }
}
```

### flatten()과 Server Actions

`flatten()`은 Server Actions에서 폼 에러를 반환할 때 가장 유용하다.

```typescript
// Server Action에서 Zod 에러를 폼 에러로 변환
export async function createStudentAction(
  prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const validated = studentSchema.safeParse({
    name: formData.get('name'),
    grade: formData.get('grade'),
  })

  if (!validated.success) {
    return {
      success: false,
      message: '입력된 정보를 확인해주세요',
      errors: validated.error.flatten().fieldErrors,
      // { name: ['이름은 필수입니다'], grade: ['1~6 사이의 값이어야 합니다'] }
    }
  }

  // validated.data 사용...
}
```

---

## 6. Zod v4 특이사항

COMPASS 프로젝트는 Zod v4(`^4.3.6`)를 사용한다. v3에서 v4로의 주요 변경사항:

### 성능 개선

- **파싱 속도 ~2배 향상**: 내부 구조 최적화
- **번들 크기 ~50% 감소**: 트리 셰이킹 개선
- TypeScript 타입 추론 속도 대폭 개선

### JSON Schema 변환

```typescript
// v3: 별도 라이브러리(zod-to-json-schema) 필요
import { zodToJsonSchema } from 'zod-to-json-schema'
const jsonSchema = zodToJsonSchema(mySchema)

// v4: 내장 메서드 toJSONSchema() 제공
const jsonSchema = z.toJSONSchema(mySchema)

// COMPASS에서는 zod-to-json-schema(^3.25.1)도 설치되어 있음
// → AI 응답 구조화(Structured Output)에서 JSON Schema를
//   Gemini API에 전달할 때 활용
```

### 에러 메시지 시스템

```typescript
// v4에서 커스텀 에러 메시지 방식
z.string().min(1, { message: '필수 입력 항목입니다' })
z.number().max(100, { message: '100 이하여야 합니다' })

// 전역 에러 메시지 커스터마이징
z.string({
  invalid_type_error: '문자열이어야 합니다',
  required_error: '필수 입력 항목입니다',
})
```

### import 경로

```typescript
// v4 기본 import (변경 없음)
import { z } from 'zod'

// v4에서도 개별 import 가능
import { ZodString, ZodNumber, ZodObject } from 'zod'
```

---

## 7. COMPASS 활용 패턴

### 패턴 1: 환경변수 검증 (config.ts)

환경변수는 항상 `string | undefined`이므로 `coerce`와 `default`를 조합하여 타입 안전하게 변환한다.

> 파일 위치: `src/lib/ai/config.ts` (Phase 0-5에서 구현 예정)

```typescript
// src/lib/ai/config.ts
import { z } from 'zod'
import { AIConfigError } from './errors'

// 환경변수 스키마 정의
// - coerce: "3" → 3, "30000" → 30000 자동 변환
// - default: 값이 없으면(undefined) 기본값 사용
// - catch: coerce 실패 시(NaN 등) 대체값 반환
const aiConfigSchema = z.object({
  apiKey: z.string().min(1, 'GEMINI_API_KEY는 필수입니다'),
  model: z.string().default('gemini-2.0-flash'),
  provider: z.enum(['gemini']).default('gemini'),
  maxRetries: z.coerce.number().int().min(1).max(10).catch(3),
  timeoutMs: z.coerce.number().int().min(1000).max(120_000).catch(30_000),
})

// 스키마에서 타입 자동 추론
export type AIConfig = z.infer<typeof aiConfigSchema>

// 캐싱용 변수
let cachedConfig: AIConfig | null = null

export function getAIConfig(): AIConfig {
  if (cachedConfig) return cachedConfig

  const result = aiConfigSchema.safeParse({
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
    provider: process.env.AI_PROVIDER,
    maxRetries: process.env.AI_MAX_RETRIES,
    timeoutMs: process.env.AI_TIMEOUT_MS,
  })

  if (!result.success) {
    // 환경변수 문제는 복구 불가 → 즉시 에러
    throw new AIConfigError(
      `AI 설정 검증 실패: ${result.error.issues.map((i) => i.message).join(', ')}`
    )
  }

  cachedConfig = result.data
  return cachedConfig
}
```

**핵심 포인트**:
- `coerce.number()`: `"3"` 같은 환경변수 문자열을 숫자로 변환
- `.catch(3)`: 변환 실패(빈 문자열, 비숫자)시 기본값 3 사용
- `.default('gemini-2.0-flash')`: 환경변수가 undefined일 때 기본값
- `safeParse` → 실패 시 커스텀 에러(`AIConfigError`)로 래핑

### 패턴 2: AI 응답 검증 + JSON Schema 변환 (validation.ts)

AI 모델의 응답은 구조가 불완전할 수 있으므로 Zod로 반드시 검증해야 한다.

> 파일 위치: `src/lib/ai/validation.ts` (Phase 0-5에서 구현 예정)

```typescript
// src/lib/ai/validation.ts
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { AIValidationError } from './errors'

// AI가 생성할 시험 문제의 스키마
const examQuestionSchema = z.object({
  question: z.string().min(1, '문제 텍스트는 필수입니다'),
  options: z
    .array(z.string().min(1))
    .length(4, '보기는 정확히 4개여야 합니다'),
  correctAnswer: z.number().int().min(0).max(3),
  explanation: z.string().min(1, '해설은 필수입니다'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  topic: z.string().min(1),
})

// AI 응답 전체의 스키마
const examResponseSchema = z.object({
  questions: z
    .array(examQuestionSchema)
    .min(1, '최소 1개의 문제가 필요합니다'),
  metadata: z.object({
    subject: z.string(),
    grade: z.number().int().min(1).max(6),
    generatedAt: z.string(),
  }),
})

// 타입 추출
export type ExamQuestion = z.infer<typeof examQuestionSchema>
export type ExamResponse = z.infer<typeof examResponseSchema>

// JSON Schema 변환 → Gemini Structured Output에 전달
export const examResponseJsonSchema = zodToJsonSchema(
  examResponseSchema,
  { name: 'ExamResponse', target: 'openAi' }
)

// AI 응답 검증 함수
export function validateExamResponse(rawResponse: unknown): ExamResponse {
  const result = examResponseSchema.safeParse(rawResponse)

  if (!result.success) {
    // ZodError를 AIValidationError로 변환
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }))

    throw new AIValidationError(
      'AI 응답이 예상 형식과 일치하지 않습니다',
      details,
      result.error
    )
  }

  return result.data
}
```

**핵심 포인트**:
- `zodToJsonSchema()`: Zod 스키마를 JSON Schema로 변환하여 Gemini API에 전달
- `AIValidationError`와 연동: 검증 실패 시 에러 클래스의 `details` 필드에 경로별 에러 정보 저장
- 스키마가 타입과 검증 로직의 Single Source of Truth

### 패턴 3: 폼 검증 (React Hook Form + zodResolver)

클라이언트(UX 피드백)와 서버(보안) 양쪽에서 **동일한 스키마**로 이중 검증한다.

> 상세 내용: [React Hook Form 가이드](./forms-react-hook-form.md) 참조

```typescript
// lib/schemas/student.ts
import { z } from 'zod'

// 스키마를 한 번 정의하면 클라이언트/서버 모두에서 사용
export const studentSchema = z.object({
  name: z
    .string()
    .min(2, '이름은 최소 2자입니다')
    .max(50, '이름은 최대 50자입니다'),
  grade: z
    .number()
    .int('학년은 정수여야 합니다')
    .min(1, '1학년 이상이어야 합니다')
    .max(6, '6학년 이하여야 합니다'),
  schoolName: z.string().min(1, '학교명은 필수입니다'),
  parentPhone: z
    .string()
    .regex(/^01[016789]-?\d{3,4}-?\d{4}$/, '올바른 전화번호 형식이 아닙니다')
    .optional(),
})

export type StudentFormData = z.infer<typeof studentSchema>
```

```typescript
// components/forms/student-form.tsx (클라이언트)
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { studentSchema, type StudentFormData } from '@/lib/schemas/student'

export function StudentForm() {
  const form = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema), // 클라이언트 검증
    defaultValues: { name: '', grade: 1, schoolName: '' },
  })

  // ...
}
```

```typescript
// app/actions/student.ts (서버)
'use server'

import { studentSchema } from '@/lib/schemas/student'

export async function createStudentAction(prevState, formData: FormData) {
  // 서버에서도 동일 스키마로 재검증
  const validated = studentSchema.safeParse({
    name: formData.get('name'),
    grade: Number(formData.get('grade')),
    schoolName: formData.get('schoolName'),
    parentPhone: formData.get('parentPhone') || undefined,
  })

  if (!validated.success) {
    return {
      success: false,
      message: '입력 정보를 확인해주세요',
      errors: validated.error.flatten().fieldErrors,
    }
  }

  // validated.data 사용하여 DB 저장...
}
```

**핵심 포인트**:
- **스키마 1개 → 2곳에서 사용**: `lib/schemas/`에 스키마를 정의하고 클라이언트(zodResolver)와 서버(safeParse) 양쪽에서 import
- `flatten().fieldErrors`로 폼 필드별 에러 메시지 추출
- 클라이언트 검증은 UX용, 서버 검증은 보안용 (클라이언트 검증은 우회 가능하므로 서버 검증 필수)

---

## 8. 안티패턴 및 주의사항

### 타입과 스키마 이중 정의

```typescript
// 타입과 스키마를 따로 정의하면 동기화가 깨질 수 있음
interface User {
  name: string
  age: number
  email: string
  role: 'admin' | 'user'  // 스키마에는 없는 필드!
}

const userSchema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email(),
  // role 필드 누락 → 타입과 불일치
})

// 스키마에서 타입을 추론하여 항상 동기화
type User = z.infer<typeof userSchema>
```

### parse를 try/catch 없이 사용

```typescript
// parse는 실패 시 예외를 던지므로 반드시 try/catch 필요
const data = schema.parse(input) // 실패하면 프로그램 크래시

// safeParse를 사용하면 예외 없이 처리 가능
const result = schema.safeParse(input)
if (!result.success) {
  // 에러 처리
}
```

### coerce 남용

```typescript
// coerce.number()는 빈 문자열을 0으로 변환함
z.coerce.number().parse('')  // 0 (의도한 결과인가?)

// 명시적으로 빈 문자열을 거부하려면
z.string().min(1).pipe(z.coerce.number())
// 또는
z.coerce.number().refine((n) => !isNaN(n), '숫자를 입력해주세요')
```

### 과도한 중첩 refine

```typescript
// 여러 검증을 체이닝하면 첫 번째 실패에서 멈춤
const schema = z.string()
  .refine((v) => v.length >= 8, '8자 이상')
  .refine((v) => /[A-Z]/.test(v), '대문자 포함')  // 위가 실패하면 실행 안 됨
  .refine((v) => /[0-9]/.test(v), '숫자 포함')

// superRefine으로 모든 에러를 한 번에 수집
const schema = z.string().superRefine((val, ctx) => {
  if (val.length < 8) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '8자 이상' })
  }
  if (!/[A-Z]/.test(val)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '대문자 포함' })
  }
  if (!/[0-9]/.test(val)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '숫자 포함' })
  }
})
```

### optional vs nullable 혼동

```typescript
z.string().optional()   // string | undefined → 필드 자체가 없어도 됨
z.string().nullable()   // string | null      → 필드는 있어야 하되 null 가능
z.string().nullish()    // string | null | undefined → 둘 다 허용

// DB 컬럼이 NULL 허용이면 nullable()
// 폼에서 비필수 필드면 optional()
// API 응답에서 불확실하면 nullish()
```

---

## 9. 참조 링크

### 공식 문서

- [Zod 공식 사이트](https://zod.dev/)
- [Zod GitHub](https://github.com/colinhacks/zod)
- [zod-to-json-schema](https://github.com/StefanTerdell/zod-to-json-schema)

### COMPASS 프로젝트 관련 파일

| 파일 | 역할 |
|------|------|
| `src/lib/ai/config.ts` | 환경변수 검증 (Phase 0-5) |
| `src/lib/ai/validation.ts` | AI 응답 검증 (Phase 0-5) |
| `src/lib/ai/errors.ts` | AI 에러 클래스 (AIValidationError 등) |
| `src/lib/ai/__tests__/config.test.ts` | 환경변수 검증 테스트 |

### 관련 가이드 문서

- [React Hook Form + Zod + Server Actions 가이드](./forms-react-hook-form.md)
- [스타일링 가이드](./styling-guide.md)
- [컴포넌트 패턴 가이드](./component-patterns.md)
