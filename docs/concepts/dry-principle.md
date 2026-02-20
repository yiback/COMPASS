# DRY (Don't Repeat Yourself) 원칙

> **분류**: 소프트웨어 설계 원칙 (Software Design Principle)
> **기원**: Andy Hunt·Dave Thomas의 "The Pragmatic Programmer" (1999) — "Every piece of **knowledge must have a single, unambiguous, authoritative representation within a system"
> **적용 기술스택**: 특정 기술에 종속되지 않는 범용 원칙. 모든 언어·프레임워크·계층에 적용

---

## 1. 개념

DRY는 "코드를 복사하지 말라"가 아니다. 정확한 의미는 이것이다:

> **"시스템 내의 모든 지식(knowledge)은 단 하나의 명확하고 권위 있는 표현을 가져야 한다."**

"지식(knowledge)"이란 비즈니스 규칙, 알고리즘, 데이터 구조처럼 **왜 이 값인지**를 설명하는 것을 뜻한다. 단순히 코드 문자열이 같다는 것과 다르다.

조립라인 비유로 생각해보자:

```
자동차 공장 조립라인
┌─────────────────────────────────────────┐
│  "도어 크기 = 90cm"  ← 설계 명세서 1부  │
│                                         │
│  조립 라인 A ──────→ 설계서 참조         │
│  조립 라인 B ──────→ 설계서 참조         │
│  품질 검사   ──────→ 설계서 참조         │
└─────────────────────────────────────────┘
```

도어 크기가 85cm로 바뀌어야 할 때, **설계 명세서 1부만 수정**하면 모든 라인이 자동으로 반영된다.

반대로 DRY를 위반한 경우:

```
┌─────────────────────────────────────────┐
│  조립 라인 A: "도어 크기 = 90cm" (직접 기입) │
│  조립 라인 B: "도어 크기 = 90cm" (직접 기입) │
│  품질 검사: "도어 크기 = 90cm" (직접 기입)   │
└─────────────────────────────────────────┘
```

변경 시 세 곳을 모두 찾아 수정해야 한다. 한 곳이라도 빠지면 불일치가 생긴다.

---

## 2. 왜 필요한가 (문제 상황)

### 시나리오: 최대 문제 수 제한이 변경되는 경우

요구사항: "AI 문제 생성 최대 개수를 10개에서 5개로 줄여야 합니다."

**DRY 위반 — 숫자 10이 여기저기 흩어진 경우:**

```typescript
// ❌ generate-questions.ts (검증)
const count = z.number().max(10, '최대 10문제까지 생성 가능합니다.')

// ❌ question-form.tsx (UI 슬라이더)
<Slider max={10} />

// ❌ generate-action.ts (서버 액션)
if (params.count > 10) {
  return { error: '10문제를 초과할 수 없습니다.' }
}

// ❌ api-route.ts (API)
if (body.count > 10) {
  return Response.json({ error: '최대 10개' }, { status: 400 })
}
```

이 경우 발생하는 문제:

| 수정 위치 | 수정 여부 | 결과 |
|-----------|-----------|------|
| generate-questions.ts | 수정함 | Zod 검증은 5개 제한 |
| question-form.tsx | **빠뜨림** | UI는 여전히 10개까지 선택 가능 |
| generate-action.ts | 수정함 | 서버에서 5개 초과 차단 |
| api-route.ts | **빠뜨림** | API는 10개까지 허용 (보안 허점) |

→ 4곳 중 2곳을 빠뜨려도 빌드는 성공한다. **버그는 런타임에 숨어있다.**

**DRY 준수 — 단일 상수 정의:**

```typescript
// ✅ src/lib/validations/generate-questions.ts
/** 문제 생성 최대 개수 (API 비용 관리) — 이 값 하나만 수정하면 전체 반영 */
export const MAX_QUESTION_COUNT = 10

export const generateQuestionsRequestSchema = z.object({
  count: z.number()
    .max(MAX_QUESTION_COUNT, `최대 ${MAX_QUESTION_COUNT}문제까지 생성 가능합니다.`),
})
```

```typescript
// ✅ question-form.tsx
import { MAX_QUESTION_COUNT } from '@/lib/validations/generate-questions'

<Slider max={MAX_QUESTION_COUNT} />
```

```typescript
// ✅ generate-action.ts
import { MAX_QUESTION_COUNT, generateQuestionsRequestSchema } from '@/lib/validations/generate-questions'

// Zod 스키마가 이미 MAX_QUESTION_COUNT를 사용하므로 추가 검증 불필요
const parsed = generateQuestionsRequestSchema.parse(body)
```

5개로 줄이려면 `MAX_QUESTION_COUNT = 5` 한 줄만 바꾸면 된다. UI, 검증, 에러 메시지가 모두 자동으로 업데이트된다.

---

## 3. DRY의 함정 — 우연한 중복 (Accidental Duplication)

이것이 DRY에서 가장 많이 오해되는 부분이다.

> **겉보기에 같은 코드라도, 변경 이유가 다르면 합치면 안 된다.**

### 실제 사례: QUESTION_TYPE_LABELS

현재 COMPASS 프로젝트의 `question-generation.ts`에 이런 코드가 있다:

```typescript
// src/lib/ai/prompts/question-generation.ts
const QUESTION_TYPE_LABELS = {
  multiple_choice: '객관식(5지선다형)',
  short_answer: '단답형',
  essay: '서술형',
} as const satisfies Record<QuestionType, string>
```

미래에 기출 기반 프롬프트 빌더(`past-exam-prompt.ts`)가 추가된다고 가정해보자. 이 두 빌더에서 같은 레이블 객체를 쓰고 싶어질 수 있다.

**나쁜 판단 — 그냥 같으니까 공유하자:**

```typescript
// ❌ src/lib/ai/prompts/shared-labels.ts
// "어차피 같은 값이니까" 라는 이유만으로 공통 추출
export const QUESTION_TYPE_LABELS = {
  multiple_choice: '객관식(5지선다형)',
  short_answer: '단답형',
  essay: '서술형',
}
```

```typescript
// ❌ question-generation.ts (성취기준 기반 프롬프트 빌더)
import { QUESTION_TYPE_LABELS } from './shared-labels'

// ❌ past-exam-prompt.ts (기출 기반 프롬프트 빌더)
import { QUESTION_TYPE_LABELS } from './shared-labels'
```

**왜 위험한가?**

6개월 뒤, 기출 기반 프롬프트에서 객관식을 "5지선다"가 아닌 "4지선다(약식)"로 표현해야 하는 새로운 요구사항이 생겼다:

```
성취기준 기반 프롬프트: "객관식(5지선다형)"  ← 변경 없음
기출 기반 프롬프트:     "객관식(4지선다형)"  ← 변경 필요
```

이 순간 공유된 `QUESTION_TYPE_LABELS`를 수정하면 **성취기준 기반 프롬프트도 같이 바뀌어버린다.** 별도 상수를 만들기 위해 결국 분리해야 하는데, 공유로 묶어놓은 탓에 작업이 더 복잡해진다.

**올바른 판단 — 변경 이유를 기준으로 판단:**

```
질문: 이 두 레이블은 같은 이유로 변경되는가?

성취기준 기반 프롬프트의 레이블  →  국가 교육과정 기준 변경 시 업데이트
기출 기반 프롬프트의 레이블     →  기출문제 파싱 규칙 변경 시 업데이트

→ 변경 이유가 다르다 → 독립 정의가 맞다
```

현재 값이 같더라도, **독립적으로 진화할 가능성이 있다면 분리를 유지한다.** 이를 "우연한 중복(Accidental Duplication)"이라 부른다.

---

## 4. 판단 기준: 변경 주기(Change Cycle)

DRY 적용 여부를 판단하는 핵심 질문:

```
"이 두 곳은 항상 같은 이유로, 같은 시점에 함께 변경되는가?"
```

| 상황 | 판단 | 이유 |
|------|------|------|
| UI 슬라이더 max, Zod 검증 max, 에러 메시지의 숫자 10 | **합친다** | "최대 문제 수"라는 동일한 비즈니스 규칙을 표현. 하나가 바뀌면 나머지도 반드시 바뀜 |
| 성취기준 프롬프트의 레이블, 기출 프롬프트의 레이블 | **분리한다** | 각각 독립적인 프롬프트 전략의 일부. 따로 진화할 수 있음 |
| 회원가입 폼 검증 로직, 로그인 폼 검증 로직 | **분리한다** | 겉보기엔 비슷해도 비즈니스 규칙이 다름 (회원가입은 비밀번호 규칙 강화, 로그인은 그대로) |
| DB 쿼리에서 사용하는 페이지 크기(20), URL에서 파싱하는 페이지 크기(20) | **합친다** | 동일한 "페이지네이션 크기" 규칙. 하나가 바뀌면 나머지도 반드시 바뀜 |

실전 체크리스트:

```
중복된 코드를 발견했을 때:

□ 두 곳이 같은 비즈니스 개념(규칙, 알고리즘, 정책)을 표현하는가?
□ 한 곳이 바뀌면 다른 곳도 반드시 바뀌어야 하는가?
□ 변경의 원인(trigger)이 동일한가?

→ 셋 다 YES: 합친다 (진짜 중복)
→ 하나라도 NO: 분리한다 (우연한 중복)
```

---

## 5. COMPASS 프로젝트 적용 사례

### ✅ DRY 올바르게 적용된 사례

**`MAX_QUESTION_COUNT` — 단일 비즈니스 규칙의 단일 표현**

```
src/lib/validations/generate-questions.ts
├── MAX_QUESTION_COUNT = 10        ← 단 하나의 정의
│
├── Zod 스키마 max 검증            ← 참조
├── 에러 메시지 문자열 보간        ← 참조
│
app/dashboard/generate/page.tsx
└── UI Slider max                  ← 참조
```

"API 비용 관리를 위한 최대 문제 수"라는 지식이 코드 한 곳에만 존재한다.

```typescript
// src/lib/validations/generate-questions.ts
export const MAX_QUESTION_COUNT = 10  // 이 줄 하나가 진실의 원천(source of truth)

export const generateQuestionsRequestSchema = z.object({
  count: z.coerce
    .number()
    .int('문제 수는 정수여야 합니다.')
    .min(1, '최소 1문제 이상이어야 합니다.')
    .max(
      MAX_QUESTION_COUNT,
      `최대 ${MAX_QUESTION_COUNT}문제까지 생성 가능합니다.`  // 문자열도 자동 반영
    ),
})
```

**`questionsJsonSchema` — Zod → JSON Schema 변환 (DRY)**

`question-generation.ts` 파일 상단 주석에 직접 "(DRY)"라고 명시되어 있다:

```typescript
/**
 * responseSchema: Zod 스키마에서 변환한 JSON Schema (DRY)
 */
import { questionsJsonSchema } from '../validation'
```

Gemini API가 요구하는 응답 구조 스키마를 Zod 스키마에서 변환해 사용한다. 응답 구조가 바뀌면 Zod 스키마 한 곳만 수정하면 된다.

### 분리를 유지해야 하는 사례 (현재 + 미래)

**`QUESTION_TYPE_LABELS` — 각 프롬프트 빌더에서 독립 정의**

```
src/lib/ai/prompts/
├── question-generation.ts        ← 자체 QUESTION_TYPE_LABELS 정의
└── (미래) past-exam-prompt.ts    ← 자체 QUESTION_TYPE_LABELS 정의 권장
```

현재 값이 같더라도, 두 프롬프트 빌더는 서로 다른 AI 생성 전략을 구현하며 각자의 방향으로 진화할 수 있다. "우연한 중복"이므로 분리를 유지한다.

---

## 6. 다른 기술스택에서의 적용

| 기술스택 | DRY 적용 방법 | 예시 |
|----------|---------------|------|
| **Next.js + TypeScript** | 공유 상수/타입을 `lib/constants.ts`에 정의. Zod 스키마를 서버·클라이언트 양쪽에서 import | `MAX_QUESTION_COUNT`, `generateQuestionsRequestSchema` |
| **Spring Boot (Java)** | `@ConfigurationProperties`로 설정값 중앙화. `enum`으로 비즈니스 코드 관리 | `QuestionType.MULTIPLE_CHOICE.getLabel()` |
| **Django (Python)** | `choices` 튜플을 모델 클래스에서 한 번만 정의. form과 serializer가 모델 참조 | `Question.TYPE_CHOICES` |
| **NestJS** | `@IsMax(MAX_QUESTION_COUNT)` 데코레이터에 공유 상수 사용. DTO 클래스 재사용 | `GenerateQuestionsDto` |
| **Express (Node.js)** | 미들웨어에 공통 검증 로직 배치. 라우트에서는 미들웨어만 호출 | `validateQuestionCount` 미들웨어 |

---

## 7. 핵심 원칙 정리

### 원칙 1: 지식을 복사하지 말고, 지식을 참조하라

```typescript
// ❌ 지식(숫자 10)을 여러 곳에 복사
const slider = <Slider max={10} />
const validate = z.number().max(10)
const error = '최대 10개입니다'

// ✅ 지식을 한 곳에 정의하고 참조
export const MAX = 10
const slider = <Slider max={MAX} />
const validate = z.number().max(MAX)
const error = `최대 ${MAX}개입니다`
```

### 원칙 2: 코드 복사보다 개념 복사가 더 위험하다

같은 코드가 두 번 나타나는 것보다, 같은 **비즈니스 규칙**이 두 군데에서 각자 구현된 것이 더 위험하다. 코드는 검색으로 찾을 수 있지만, 개념의 분산은 찾기 어렵다.

### 원칙 3: 변경 이유가 같은 것만 묶어라

```typescript
// ❌ 겉보기만 같은 코드를 억지로 합침
// 회원가입과 로그인 검증이 지금은 같아 보여도
function validateEmail(email: string) {
  return z.string().email().parse(email)
}
// 회원가입은 기업 이메일(@company.com)만 허용 정책 추가 → 분리 필요해짐

// ✅ 처음부터 분리 유지
// 같은 이유로 변경되지 않을 것이 예상되면 처음부터 분리
function validateSignupEmail(email: string) { ... }
function validateLoginEmail(email: string) { ... }
```

### 원칙 4: 타입 시스템을 DRY의 도구로 활용하라

TypeScript의 `satisfies`, `infer`, `typeof`는 타입을 단 한 번 정의하고 여러 곳에서 재사용하게 해준다:

```typescript
// ✅ Zod 스키마에서 타입 추론 — 타입을 따로 정의하지 않음
const schema = z.object({ count: z.number() })
type Request = z.infer<typeof schema>  // schema가 단일 진실의 원천

// ✅ satisfies로 타입 강제 + 자동완성 유지
const LABELS = {
  multiple_choice: '객관식',
  short_answer: '단답형',
  essay: '서술형',
} as const satisfies Record<QuestionType, string>
// QuestionType에 새 값 추가 시 TypeScript가 누락을 컴파일 에러로 잡아줌
```

---

## 8. 안티패턴

### 안티패턴 1: 매직 넘버 (Magic Number)

```typescript
// ❌ 10이 왜 10인지, 어디서 왔는지 알 수 없음
if (count > 10) {
  throw new Error('Too many')
}
const slider = <Slider max={10} step={1} />

// ✅ 의도가 명확하고, 변경 지점이 하나
const MAX_QUESTION_COUNT = 10  // API 비용 관리 목적
if (count > MAX_QUESTION_COUNT) {
  throw new Error(`최대 ${MAX_QUESTION_COUNT}문제까지 가능합니다`)
}
```

### 안티패턴 2: 조급한 추상화 (Premature Abstraction)

DRY를 적용하고 싶은 나머지, 아직 공통점이 확정되지 않은 코드를 너무 일찍 합치는 실수다.

```typescript
// ❌ 두 함수가 지금은 같아 보이지만, 각자 다른 방향으로 진화할 예정
function buildCurriculumPrompt(params: Params): string {
  return `${params.subject} ${params.grade}학년 ${params.questionType}`
}
function buildPastExamPrompt(params: Params): string {
  return `${params.subject} ${params.grade}학년 ${params.questionType}`
}

// "중복이다!" 라며 합침
function buildPrompt(params: Params, mode: 'curriculum' | 'past-exam'): string {
  return `${params.subject} ${params.grade}학년 ${params.questionType}`
}

// 3개월 뒤, 기출 기반은 학교명/연도/학기가 추가되어야 함
// curriculum은 성취기준 코드가 추가되어야 함
// → mode 분기가 복잡해지고, 결국 다시 분리하게 됨
```

"Rule of Three"를 기억하라: 같은 패턴이 **세 번** 나타나면 그때 추상화를 고려한다. 두 번은 아직 이르다.

### 안티패턴 3: 잘못된 계층에서의 공유

```typescript
// ❌ UI 레이어의 레이블을 DB 레이어에서 참조
// src/lib/db/queries.ts
import { QUESTION_TYPE_LABELS } from '@/components/question-form'  // 계층 역전!

// ✅ 레이어별 책임 분리 유지
// DB 레이어는 DB 타입만 알아야 한다
// UI 레이블은 UI 레이어에서 정의
// 공유가 필요하면 중간 계층(lib/constants.ts)에 배치
```

### 안티패턴 4: 문서와 코드 이중 관리

```typescript
// ❌ 주석이 코드와 별개로 유지됨 (DRY 위반)
/**
 * 최대 10문제까지 생성 가능
 * @param count 1~10 사이의 정수
 */
function validateCount(count: number) {
  if (count > 15) { // 실제 코드는 15인데 주석은 10이라고 함!
    throw new Error('Too many')
  }
}

// ✅ 코드에서 진실을 읽을 수 있게 만들어 주석 의존도를 낮춤
const MAX = 10
function validateCount(count: number) {
  if (count > MAX) {
    throw new Error(`최대 ${MAX}문제까지 가능합니다`)
  }
}
```

---

## 9. DRY vs WET (Write Everything Twice)

"WET"는 DRY의 반대를 의도적으로 선택하는 전략이다. 무조건 DRY가 옳은 것은 아니다.

| 상황 | WET 선택이 합리적인 경우 |
|------|--------------------------|
| 코드가 두 번만 나타났을 때 | 세 번째 나타날 때 추상화를 결정해도 늦지 않음 |
| 변경 이유가 다를 것으로 예상될 때 | 각 사본이 독립적으로 진화하도록 허용 |
| 추상화 비용이 이득보다 클 때 | 함수 하나 더 만드는 것보다 복사가 간단할 수 있음 |
| 팀원이 공통 모듈을 찾기 어려울 때 | 발견 가능성(discoverability)이 DRY보다 중요할 때 |

---

## 10. 관련 원칙과의 관계

### SRP (단일 책임 원칙)와 DRY

SRP는 "한 모듈은 한 가지 변경 이유만 가져야 한다"고 말한다. DRY의 변경 주기 판단과 직접 연결된다.

```
DRY를 적용하려 할 때:
→ "이 두 코드의 변경 이유가 같은가?"

SRP로 검증:
→ "합치면 한 모듈이 두 가지 변경 이유를 갖게 되는가?"
→ YES: 합치면 SRP 위반 → 분리가 맞음
→ NO: 합쳐도 SRP를 유지함 → 합칠 수 있음
```

### OCP (개방-폐쇄 원칙)와 DRY

OCP는 "확장에는 열려있고 수정에는 닫혀있어야 한다"고 말한다. DRY로 공통 로직을 중앙화하면 OCP 달성이 쉬워진다.

```typescript
// DRY + OCP: 새 QuestionType 추가 시
// → types.ts의 타입 유니온에만 추가
// → satisfies Record<QuestionType, ...>를 쓰는 모든 맵에서 TypeScript가 누락을 감지
// → 수정 지점이 명확하고 최소화됨
export type QuestionType = 'multiple_choice' | 'short_answer' | 'essay' | 'true_false'
//                                                                         ↑ 추가 시
// TypeScript: "QUESTION_TYPE_LABELS에 'true_false'가 없습니다" → 컴파일 에러
```

---

## 11. 실전 체크리스트

중복 코드를 발견했을 때 따라하는 의사결정 흐름:

```
중복 발견
    │
    ▼
같은 비즈니스 개념인가?
    │
    ├─ NO → 우연한 중복 → 분리 유지
    │
    └─ YES
        │
        ▼
    같은 이유로 변경되는가?
        │
        ├─ NO → 우연한 중복 → 분리 유지
        │
        └─ YES
            │
            ▼
        세 번 이상 반복되는가?
            │
            ├─ NO → WET 허용 (아직 패턴 확정 전)
            │
            └─ YES
                │
                ▼
            적절한 계층에 배치 가능한가?
                │
                ├─ NO → 아키텍처 개선 후 DRY 적용
                │
                └─ YES → DRY 적용 (추상화)
```

구체적 점검 항목:

```
합치기 전 확인:
□ 두 코드가 표현하는 비즈니스 개념이 동일한가?
□ 한 곳이 바뀌면 다른 곳도 반드시 바뀌어야 하는가?
□ 변경을 유발하는 외부 요인(비즈니스 규칙, 정책)이 같은가?
□ 세 번 이상 반복되는 패턴인가?
□ 공통 모듈이 팀원에게 발견 가능한 위치에 있는가?

합친 후 확인:
□ 공통 모듈이 한 가지 변경 이유만 가지는가? (SRP)
□ 새 케이스 추가 시 기존 코드 수정이 최소화되는가? (OCP)
□ 의존 방향이 올바른가? (UI → lib → db, 역방향 없음)
```

---

## 참고 자료

- [The Pragmatic Programmer - Andy Hunt & Dave Thomas (1999)](https://pragprog.com/titles/tpp20/the-pragmatic-programmer-20th-anniversary-edition/) — DRY 원칙의 원전
- [DRY is about Knowledge - Dave Thomas (2022)](https://media.pragprog.com/articles/jan_03_enbug.pdf) — "코드 중복"이 아닌 "지식 중복"임을 재강조한 글
- [The Wrong Abstraction - Sandi Metz](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction) — 조급한 추상화(Premature Abstraction)의 위험성
- [Rule of Three - Martin Fowler](https://wiki.c2.com/?RuleOfThree) — 세 번 나타날 때 추상화하라
- [Single Responsibility Principle - Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html) — DRY의 변경 주기 판단과 연결되는 SRP
