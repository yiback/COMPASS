# 1-7 Step 1 상세 구현 계획: 타입 확장 + Zod 스키마 (TDD)

> **상위 계획**: `docs/plan/phase-1-step7-ai-question-generation.md` Step 1
> **작성일**: 2026-02-19
> **완료일**: 2026-02-20
> **상태**: ✅ 완료 (369 tests PASS)

---

## 개요

기존 AI 타입 시스템(`src/lib/ai/types.ts`)에 `PastExamContext` 인터페이스를 추가하고, `GenerateQuestionParams`에 optional `pastExamContext` 필드를 확장한다. 별도로 문제 생성 요청 검증용 Zod 스키마(`src/lib/validations/generate-questions.ts`)를 신규 생성한다. 전체 과정을 TDD RED -> GREEN -> REFACTOR 순서로 5개 서브스텝(a~e)에 걸쳐 진행한다.

**핵심 원칙**: optional 필드 추가이므로 기존 코드/테스트에 영향 없음(하위 호환).

---

## 서브스텝 흐름도

```
a. 타입 테스트 작성 (RED)
    ↓`
b. 타입 구현 (GREEN)
    ↓
c. Zod 스키마 테스트 작성 (RED)
    ↓
d. Zod 스키마 구현 (GREEN)
    ↓
e. 회귀 검증 (REFACTOR)
```

---

## 서브스텝 a: 타입 테스트 작성 (RED)

### 목표

`PastExamContext` 인터페이스와 `GenerateQuestionParams` 확장에 대한 **타입 호환성 테스트 3개**를 기존 테스트 파일에 추가한다. 아직 타입이 없으므로 **테스트가 컴파일 에러로 실패(RED)**하는 것이 정상이다.

### 변경 파일

| 작업 | 파일 | 변경 내용 |
|------|------|----------|
| 수정 | `src/lib/ai/__tests__/types.test.ts` | describe 블록 1개 + 테스트 3개 추가 (~25줄) |

### 변경 내용 상세

기존 59줄 끝에 새 describe 블록을 추가한다.

```typescript
// 기존 import에 추가:
import type { GenerateQuestionParams, PastExamContext } from '../types'

// 기존 describe 블록들 아래에 추가:
describe('PastExamContext 타입 호환성', () => {
  it('pastExamContext가 없는 GenerateQuestionParams가 유효해야 한다 (하위 호환)', () => {
    const params: GenerateQuestionParams = {
      subject: '수학',
      grade: 10,
      questionType: 'multiple_choice',
      count: 5,
      difficulty: 'medium',
    }
    expect(params.pastExamContext).toBeUndefined()
  })

  it('pastExamContext가 있는 GenerateQuestionParams가 유효해야 한다', () => {
    const context: PastExamContext = {
      pastExamId: '550e8400-e29b-41d4-a716-446655440000',
      schoolName: '한국고등학교',
      year: 2025,
      semester: 1,
      examType: 'midterm',
      extractedContent: '1번 문제: 다음 중 올바른 것은?',
    }

    const params: GenerateQuestionParams = {
      subject: '수학',
      grade: 10,
      questionType: 'multiple_choice',
      count: 5,
      difficulty: 'medium',
      pastExamContext: context,
    }

    expect(params.pastExamContext).toBeDefined()
    expect(params.pastExamContext?.schoolName).toBe('한국고등학교')
  })

  it('extractedContent가 없는 PastExamContext가 유효해야 한다', () => {
    const context: PastExamContext = {
      pastExamId: '550e8400-e29b-41d4-a716-446655440000',
      schoolName: '한국고등학교',
      year: 2025,
      semester: 1,
      examType: 'midterm',
    }

    expect(context.extractedContent).toBeUndefined()
    expect(context.schoolName).toBe('한국고등학교')
  })
})
```

### 실행 및 예상 결과

```bash
npx vitest run src/lib/ai/__tests__/types.test.ts
```

**FAIL** — `PastExamContext` 타입 미존재로 컴파일 에러

---

## 서브스텝 b: 타입 구현 (GREEN)

### 목표

`PastExamContext` 인터페이스를 정의하고, `GenerateQuestionParams`에 optional `pastExamContext` 필드를 추가한다. 서브스텝 a의 테스트가 **PASS(GREEN)**해야 한다.

### 변경 파일

| 작업 | 파일 | 변경 내용 |
|------|------|----------|
| 수정 | `src/lib/ai/types.ts` | PastExamContext 인터페이스 추가 (~10줄) + GenerateQuestionParams에 필드 1줄 추가 |
| 수정 | `src/lib/ai/index.ts` | PastExamContext export 추가 (~1줄) |

### 변경 내용 상세

**`src/lib/ai/types.ts`** — 79줄 (`// ─── 문제 생성 ──────────────`) 직전에 추가:

```typescript
// ─── 기출 컨텍스트 (1-7 추가) ────────────────────────────

/** 기출문제 참고 AI 문제 생성 시 전달되는 컨텍스트 */
export interface PastExamContext {
  readonly pastExamId: string
  readonly schoolName: string
  readonly year: number
  readonly semester: number
  readonly examType: string
  readonly extractedContent?: string   // OCR 추출 또는 수동 입력된 기출 내용
}
```

`GenerateQuestionParams`에 추가 (기존 `schoolName?` 아래):

```typescript
readonly pastExamContext?: PastExamContext  // 1-7 추가: 기출 기반 생성 시
```

**`src/lib/ai/index.ts`** — export 블록에 PastExamContext 추가 (알파벳 순):

```typescript
export type {
  AIProvider,
  GenerateQuestionParams,
  GeneratedQuestion,
  PastExamContext,     // 1-7 추가
  PromptConfig,
  ProviderType,
  QuestionType,
} from './types'
```

### 실행 및 예상 결과

```bash
npx vitest run src/lib/ai/__tests__/types.test.ts
```

**PASS** — 기존 8개 + 신규 3개 = **11개 테스트 PASS**

### 하위 호환 확인

- `pastExamContext`는 optional이므로 기존 사용처(프롬프트 빌더, GeminiProvider, 테스트 fixtures)에서 타입 에러 없음
- `PastExamContext`는 신규 타입이므로 기존 코드에 영향 없음

---

## 서브스텝 c: Zod 스키마 테스트 작성 (RED)

### 목표

문제 생성 요청 검증용 Zod 스키마에 대한 **테스트 ~19 케이스**를 신규 파일에 작성한다. 아직 스키마가 없으므로 **import 에러로 실패(RED)**하는 것이 정상이다.

### 변경 파일

| 작업 | 파일 | 변경 내용 |
|------|------|----------|
| 신규 | `src/lib/validations/__tests__/generate-questions.test.ts` | 테스트 ~19 케이스 (~130줄) |

### 테스트 목록

| # | describe | 테스트명 | 검증 내용 |
|---|----------|---------|----------|
| 1 | pastExamId | 유효한 UUID를 통과시킨다 | UUID 형식 허용 |
| 2 | pastExamId | 유효하지 않은 UUID를 거부한다 | 잘못된 UUID 거부 + 한국어 에러 메시지 |
| 3 | pastExamId | 빈 문자열을 거부한다 | 빈 문자열 거부 |
| 4-6 | questionType | 유효한 문제 유형 it.each 3종 | multiple_choice, short_answer, essay |
| 7 | questionType | 유효하지 않은 문제 유형을 거부한다 | 'quiz' 거부 + 에러 메시지 |
| 8-10 | difficulty | 유효한 난이도 it.each 3종 | easy, medium, hard |
| 11 | difficulty | 유효하지 않은 난이도를 거부한다 | 'extreme' 거부 + 에러 메시지 |
| 12 | count | 유효한 문제 수를 통과시킨다 | count=5 통과 |
| 13 | count | 문자열을 숫자로 coerce한다 | '3' -> 3 |
| 14 | count | 0 이하를 거부한다 | count=0, count=-1 |
| 15 | count | 최대값 초과를 거부한다 | count=11 거부 |
| 16 | count | 소수점을 거부한다 | count=2.5 거부 |
| 17 | 복합 검증 | 모든 필드 동시 유효 | 전체 필드 동시 검증 |
| 18 | 복합 검증 | 스키마에 없는 필드 자동 strip | IDOR/필드 인젝션 방어 |
| 19 | MAX_QUESTION_COUNT | 상수 값이 10이어야 한다 | 상수 값 확인 |

### 실행 및 예상 결과

```bash
npx vitest run src/lib/validations/__tests__/generate-questions.test.ts
```

**FAIL** — `Cannot find module '../generate-questions'`

### 설계 결정

| 결정 | 근거 |
|------|------|
| safeParse 사용 | 테스트에서 에러 메시지를 검증하기 위해 |
| validInput 상수를 describe 밖에 선언 | 모든 테스트에서 스프레드로 재사용. 불변이므로 공유 안전 |
| strip 검증 포함 | MEMORY.md 교훈: "Zod `.strip()`: 악의적 필드 자동 제거" |
| 에러 메시지 한국어 검증 | 사용자 대면 메시지이므로 한국어 포함 여부 확인 필수 |

---

## 서브스텝 d: Zod 스키마 구현 (GREEN)

### 목표

Zod 스키마와 `MAX_QUESTION_COUNT` 상수를 신규 파일에 구현한다. 서브스텝 c의 테스트가 **PASS(GREEN)**해야 한다.

### 변경 파일

| 작업 | 파일 | 변경 내용 |
|------|------|----------|
| 신규 | `src/lib/validations/generate-questions.ts` | Zod 스키마 + 상수 + 타입 export (~30줄) |

### 변경 내용 상세

```typescript
/**
 * AI 문제 생성 요청 검증
 * Zod 스키마 + MAX_QUESTION_COUNT 상수
 */

import { z } from 'zod'

/** 문제 생성 요청 최대 문제 수 (API 비용 관리) */
export const MAX_QUESTION_COUNT = 10

export const generateQuestionsRequestSchema = z.object({
  pastExamId: z.string().uuid('기출문제 ID가 유효하지 않습니다.'),
  questionType: z.enum(['multiple_choice', 'short_answer', 'essay'], {
    errorMap: () => ({ message: '문제 유형을 선택해주세요.' }),
  }),
  difficulty: z.enum(['easy', 'medium', 'hard'], {
    errorMap: () => ({ message: '난이도를 선택해주세요.' }),
  }),
  count: z.coerce
    .number()
    .int('문제 수는 정수여야 합니다.')
    .min(1, '최소 1문제 이상이어야 합니다.')
    .max(MAX_QUESTION_COUNT, `최대 ${MAX_QUESTION_COUNT}문제까지 생성 가능합니다.`),
})

export type GenerateQuestionsRequest = z.infer<typeof generateQuestionsRequestSchema>
```

### 실행 및 예상 결과

```bash
npx vitest run src/lib/validations/__tests__/generate-questions.test.ts
```

**PASS** — ~19 케이스 전체 통과

### 설계 결정

| 결정 | 근거 |
|------|------|
| `z.coerce.number()` | UI Select value가 문자열일 수 있으므로 자동 변환 |
| `.int()` 명시 | 소수점 거부. `z.coerce`는 `2.5`를 그대로 변환하므로 필요 |
| `z.object` strip 기본값 | Zod v3에서 unknown 키 자동 제거. 명시적 `.strip()` 불필요 |
| 별도 파일 `generate-questions.ts` | `past-exams.ts`와 도메인 다름 (조회/업로드 vs AI 생성) |

---

## 서브스텝 e: 회귀 검증 (REFACTOR)

### 목표

전체 테스트를 실행하여 기존 코드에 회귀가 없음을 확인한다.

### 실행 명령어

```bash
# 1. 신규 테스트 재확인
npx vitest run src/lib/validations/__tests__/generate-questions.test.ts

# 2. 수정된 타입 테스트 재확인
npx vitest run src/lib/ai/__tests__/types.test.ts

# 3. 기존 AI 전체 테스트 회귀 검증
npx vitest run src/lib/ai/__tests__/

# 4. 기존 validation 전체 테스트 회귀 검증
npx vitest run src/lib/validations/__tests__/

# 5. 전체 프로젝트 테스트
npx vitest run
```

### 예상 결과

- types.test.ts: 11개 PASS (기존 8 + 신규 3)
- generate-questions.test.ts: ~19 케이스 PASS
- AI 전체: 회귀 없음
- Validation 전체: 회귀 없음
- 전체: 기존 347 + 신규 ~22 = ~369개 PASS

---

## 전체 파일 변경 요약

| 서브스텝 | 작업 | 파일 | 변경량 |
|---------|------|------|--------|
| a (RED) | 수정 | `src/lib/ai/__tests__/types.test.ts` | +25줄 |
| b (GREEN) | 수정 | `src/lib/ai/types.ts` | +12줄 |
| b (GREEN) | 수정 | `src/lib/ai/index.ts` | +1줄 |
| c (RED) | 신규 | `src/lib/validations/__tests__/generate-questions.test.ts` | ~130줄 |
| d (GREEN) | 신규 | `src/lib/validations/generate-questions.ts` | ~30줄 |
| e | 없음 | -- | 검증만 |

**총: 3개 수정 + 2개 신규 = 5개 파일**
**신규 테스트: ~22 케이스 (타입 3 + Zod ~19)**

---

## 성공 기준

- [x] `npx vitest run src/lib/ai/__tests__/types.test.ts` — 11개 전체 PASS
- [x] `npx vitest run src/lib/validations/__tests__/generate-questions.test.ts` — 19개 전체 PASS
- [x] `npx vitest run src/lib/ai/__tests__/` — 기존 AI 테스트 전체 PASS (회귀 없음)
- [x] `npx vitest run src/lib/validations/__tests__/` — 기존 validation 테스트 전체 PASS
- [x] 기존 `GenerateQuestionParams` 사용처에서 TypeScript 타입 에러 없음

**구현 메모**: `z.enum`의 `errorMap`이 `invalid_enum_value`에서 커스텀 메시지를 반환하지 않는 이슈 발견. Zod 3.22+의 `message` 파라미터로 변경하여 해결.

---

## 리스크 및 대응

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| `types.ts` 수정 시 기존 테스트 영향 | **낮음** | optional 필드 추가이므로 기존 코드 무영향 |
| `z.coerce.number()` + 빈 문자열 | **낮음** | Server Action에서 sanitize 처리 (Step 3) |
| Zod strip 동작 변경 | **매우 낮음** | 기존 테스트(past-exams-filter)에서 strip 검증 통과 중 |

---

## 커밋 계획

서브스텝 e 완료 후 단일 커밋:

```
feat: 1-7 Step 1 타입 확장 + Zod 스키마 -- PastExamContext + generateQuestionsRequestSchema
```
