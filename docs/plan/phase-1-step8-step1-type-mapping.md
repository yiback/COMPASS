# Step 1: 타입 매핑 유틸 + Zod 스키마 (TDD)

> **진행률**: 3/3 Tasks (100%)
> **마지막 업데이트**: 2026-03-01
> **상태**: ✅ 완료
> **의존성**: 없음 (시작점)

---

## Context

AI가 생성한 `GeneratedQuestion`과 DB `questions` 테이블 컬럼 사이에는 **두 가지 타입 불일치**가 있다.

| AI 타입 | DB 타입 | 설명 |
|---------|---------|------|
| `type: 'essay'` | `type: 'descriptive'` | 이미 `toDbQuestionType()` 구현 완료 |
| `difficulty: 'medium'` | `difficulty: 3` | **새로 구현 필요** |

`toDbQuestionType()`/`fromDbQuestionType()`은 Step 0-5에서 이미 구현되어 있다.
이번 Step에서는 **난이도 변환 함수**와 **저장 요청 검증 Zod 스키마**를 추가로 구현한다.

### 변환 규칙

```
AI difficulty → DB difficulty (정수)
easy    → 2
medium  → 3
hard    → 4

(1 = 매우 쉬움, 5 = 매우 어려움 — DB 스키마에서 정의됨)
```

---

## TDD 구현 순서 (RED → GREEN → REFACTOR)

---

### Task 1: 난이도 매핑 함수 (`src/lib/ai/types.ts`에 추가)

#### RED: 테스트 작성

파일: `src/lib/ai/__tests__/types-difficulty.test.ts` (신규)

```typescript
/**
 * 난이도 매핑 함수 테스트
 *
 * AI 프롬프트에서는 'easy'/'medium'/'hard' 문자열을 사용하지만,
 * DB 스키마에서는 정수(2/3/4)를 사용한다.
 * 두 함수가 이 불일치를 안전하게 변환하는지 검증한다.
 */

import { describe, it, expect } from 'vitest'
import { toDifficultyNumber, fromDifficultyNumber } from '../types'
import type { DifficultyLevel } from '../types'

describe('toDifficultyNumber', () => {
  it("'easy'를 2로 변환한다", () => {
    expect(toDifficultyNumber('easy')).toBe(2)
  })

  it("'medium'을 3으로 변환한다", () => {
    expect(toDifficultyNumber('medium')).toBe(3)
  })

  it("'hard'를 4로 변환한다", () => {
    expect(toDifficultyNumber('hard')).toBe(4)
  })
})

describe('fromDifficultyNumber', () => {
  it('2를 easy로 변환한다', () => {
    expect(fromDifficultyNumber(2)).toBe('easy')
  })

  it('3을 medium으로 변환한다', () => {
    expect(fromDifficultyNumber(3)).toBe('medium')
  })

  it('4를 hard로 변환한다', () => {
    expect(fromDifficultyNumber(4)).toBe('hard')
  })

  it('매핑에 없는 숫자(1)는 medium을 반환한다 (기본값)', () => {
    expect(fromDifficultyNumber(1)).toBe('medium')
  })

  it('매핑에 없는 숫자(5)는 medium을 반환한다 (기본값)', () => {
    expect(fromDifficultyNumber(5)).toBe('medium')
  })
})

describe('DifficultyLevel 타입 호환성', () => {
  it('DifficultyLevel 유니온 타입의 모든 값에 대해 toDifficultyNumber가 고유한 정수를 반환한다', () => {
    const levels: DifficultyLevel[] = ['easy', 'medium', 'hard']
    const numbers = levels.map(toDifficultyNumber)

    // 중복 없이 3개가 반환되어야 한다
    const uniqueNumbers = new Set(numbers)
    expect(uniqueNumbers.size).toBe(3)
  })

  it('양방향 변환: AI → DB → AI 변환이 원래 값을 반환한다', () => {
    const levels: DifficultyLevel[] = ['easy', 'medium', 'hard']
    levels.forEach((level) => {
      const num = toDifficultyNumber(level)
      const backToLevel = fromDifficultyNumber(num)
      expect(backToLevel).toBe(level)
    })
  })
})
```

> **RED 검증 명령어**:
> ```bash
> npx vitest run src/lib/ai/__tests__/types-difficulty.test.ts
> ```
> 이 시점에서 `toDifficultyNumber`, `fromDifficultyNumber`, `DifficultyLevel`이 존재하지 않으므로 **컴파일 에러 또는 FAIL**이 발생해야 한다.

---

#### GREEN: 최소 구현

파일: `src/lib/ai/types.ts` — 기존 파일에 아래 내용 추가 (line 48 이후, `// ─── AI Provider 인터페이스` 섹션 앞)

```typescript
// ─── 난이도 매핑 ─────────────────────────────────────────

/** AI 프롬프트에서 사용하는 난이도 레벨 */
export type DifficultyLevel = 'easy' | 'medium' | 'hard'

/**
 * AI 난이도 문자열 → DB 정수 매핑
 *
 * DB 스키마: 1(매우쉬움) ~ 5(매우어려움)
 * AI 생성 문제는 2(쉬움), 3(보통), 4(어려움) 범위를 사용한다.
 *
 * `as const`: 리터럴 타입 고정 (number가 아닌 2 | 3 | 4 타입)
 * `satisfies Record<DifficultyLevel, number>`: 키 누락 시 컴파일 에러
 */
const DIFFICULTY_TO_NUMBER = {
  easy: 2,
  medium: 3,
  hard: 4,
} as const satisfies Record<DifficultyLevel, number>

/**
 * DB 정수 → AI 난이도 문자열 역매핑
 *
 * `as const`를 사용하지 않는 이유:
 * - 키가 number 타입 → TypeScript가 Record<number, DifficultyLevel>로 추론
 * - 특정 리터럴(2 | 3 | 4) 타입이 필요하지 않으므로 `satisfies`만 사용
 */
const NUMBER_TO_DIFFICULTY: Record<number, DifficultyLevel> = {
  2: 'easy',
  3: 'medium',
  4: 'hard',
}

/** AI 난이도 문자열 → DB 정수 변환 */
export function toDifficultyNumber(difficulty: DifficultyLevel): number {
  return DIFFICULTY_TO_NUMBER[difficulty]
}

/**
 * DB 정수 → AI 난이도 문자열 변환
 *
 * 매핑에 없는 정수(1, 5 등)는 'medium'을 반환한다.
 * throw하지 않는 이유: DB에 1이나 5가 저장되어 있어도
 * UI가 중단되지 않아야 하며, 'medium'은 안전한 폴백이다.
 */
export function fromDifficultyNumber(num: number): DifficultyLevel {
  return NUMBER_TO_DIFFICULTY[num] ?? 'medium'
}
```

> **GREEN 검증 명령어**:
> ```bash
> npx vitest run src/lib/ai/__tests__/types-difficulty.test.ts
> ```
> 11개 테스트 모두 PASS해야 한다.

---

#### REFACTOR: 개선

변경 사항 없음 — 구현이 간결하고 명확하다.

확인 사항:
- 주석이 `as const`와 `satisfies`의 역할을 명확히 설명하는가? (YES)
- `NUMBER_TO_DIFFICULTY`에 `as const`를 생략한 이유가 문서화되어 있는가? (YES)
- 기본값('medium') 반환 이유가 주석에 설명되어 있는가? (YES)

---

#### 검증 명령어

```bash
# Task 1 단위 테스트
npx vitest run src/lib/ai/__tests__/types-difficulty.test.ts

# 기존 types 테스트가 깨지지 않았는지 확인
npx vitest run src/lib/ai/__tests__/types.test.ts
```

---

### Task 2: `src/lib/ai/index.ts`에 export 추가

Task 1에서 추가한 타입과 함수를 외부 모듈에서 `@/lib/ai`로 접근할 수 있게 공개 API에 추가한다.

#### RED: 테스트 작성

파일: `src/lib/ai/__tests__/index.test.ts` — 기존 파일에 아래 `describe` 블록 추가

```typescript
// 기존 import에 추가
import type { DifficultyLevel } from '@/lib/ai'
import { toDifficultyNumber, fromDifficultyNumber } from '@/lib/ai'

// 기존 describe 블록들 다음에 추가
describe('난이도 매핑 함수 공개 API', () => {
  it('toDifficultyNumber가 @/lib/ai에서 export된다', () => {
    expect(typeof toDifficultyNumber).toBe('function')
  })

  it('fromDifficultyNumber가 @/lib/ai에서 export된다', () => {
    expect(typeof fromDifficultyNumber).toBe('function')
  })

  it('DifficultyLevel 타입이 타입 시스템에서 사용 가능하다', () => {
    // 타입 레벨 검증 — 런타임에서는 함수 동작으로 간접 확인
    const level: DifficultyLevel = 'easy'
    expect(toDifficultyNumber(level)).toBe(2)
  })
})
```

> **RED 검증 명령어**:
> ```bash
> npx vitest run src/lib/ai/__tests__/index.test.ts
> ```
> `toDifficultyNumber`를 import할 수 없으므로 **FAIL**이 발생해야 한다.

---

#### GREEN: 최소 구현

파일: `src/lib/ai/index.ts` — 타입 export와 함수 export에 각각 추가

```typescript
// src/lib/ai/index.ts
// AI 모듈 공개 API — 외부에서는 '@/lib/ai'로만 접근

// 팩토리 함수
export { createAIProvider } from './provider'

// 타입
export type {
  AIProvider,
  DifficultyLevel,        // ← 추가
  GenerateQuestionParams,
  GeneratedQuestion,
  PastExamContext,
  PromptConfig,
  ProviderType,
  QuestionType,
} from './types'

// 매핑 함수                  // ← 섹션 추가
export {
  toDbQuestionType,
  fromDbQuestionType,
  toDifficultyNumber,
  fromDifficultyNumber,
} from './types'

// 에러 클래스
export {
  AIError,
  AIServiceError,
  AIValidationError,
  AIRateLimitError,
  AIConfigError,
} from './errors'
```

> **GREEN 검증 명령어**:
> ```bash
> npx vitest run src/lib/ai/__tests__/index.test.ts
> ```
> 새로 추가한 3개 테스트 포함 전체 PASS해야 한다.

---

#### REFACTOR: 개선

변경 사항 없음 — export 목록이 알파벳 순이 아닌 기능별로 그룹화되어 있는 것이 더 가독성이 좋다.

---

#### 검증 명령어

```bash
npx vitest run src/lib/ai/__tests__/index.test.ts
```

---

### Task 3: 저장 Zod 스키마 (`src/lib/validations/save-questions.ts` 신규)

#### 예비 작업: 공통 상수 파일 생성 + 기존 import 경로 변경

> **배경**: `MAX_QUESTION_COUNT`는 기존에 `generate-questions.ts`에서 정의·export되었다.
> 생성과 저장 모두 같은 상수를 사용하므로, 공통 상수 파일로 이동하여
> **Single Source of Truth**를 달성한다.
>
> **변경 이유**: 상수의 정의 위치는 "어디서 쓰이는가"가 아니라
> "어떤 종류의 값인가"로 결정한다.
> `MAX_QUESTION_COUNT`는 비즈니스 규칙 상수 → `constants/` 폴더가 자연스럽다.

**Step 1**: 공통 상수 파일 생성

파일: `src/lib/constants/questions.ts` (신규)

```typescript
/**
 * 문제 관련 공통 상수
 * 생성(generate)과 저장(save) 모두에서 사용
 */

/** 한 번에 생성/저장할 수 있는 최대 문제 수 */
export const MAX_QUESTION_COUNT = 10
```

**Step 2**: 기존 파일에서 상수 정의 제거 + import 변경

파일: `src/lib/validations/generate-questions.ts` (수정)

```typescript
// BEFORE:
/** 문제 생성 요청 최대 문제 수 (API 비용 관리) */
export const MAX_QUESTION_COUNT = 10

// AFTER:
import { MAX_QUESTION_COUNT } from '@/lib/constants/questions'
```

> `generate-questions.ts`에서 `MAX_QUESTION_COUNT`를 더 이상 export하지 않으므로,
> 기존 import 경로를 사용하던 파일들도 수정해야 한다.

**Step 3**: 기존 import 경로 변경 (2곳)

파일: `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` (수정)

```typescript
// BEFORE:
import { MAX_QUESTION_COUNT } from '@/lib/validations/generate-questions'

// AFTER:
import { MAX_QUESTION_COUNT } from '@/lib/constants/questions'
```

파일: `src/lib/validations/__tests__/generate-questions.test.ts` (수정)

```typescript
// BEFORE:
import {
  generateQuestionsRequestSchema,
  GenerateQuestionsRequest,
  MAX_QUESTION_COUNT,
} from '../generate-questions'

// AFTER:
import {
  generateQuestionsRequestSchema,
  GenerateQuestionsRequest,
} from '../generate-questions'
import { MAX_QUESTION_COUNT } from '@/lib/constants/questions'
```

> **검증 명령어**:
> ```bash
> # 기존 테스트가 깨지지 않았는지 확인
> npx vitest run src/lib/validations/__tests__/generate-questions.test.ts
> ```
> 모든 기존 테스트가 PASS해야 한다.

---

#### RED: 테스트 작성

파일: `src/lib/validations/__tests__/save-questions.test.ts` (신규)

```typescript
/**
 * saveQuestionsRequestSchema 테스트
 * TDD RED → GREEN → IMPROVE
 *
 * AI 생성 문제 저장 요청 검증용 Zod 스키마 테스트
 *
 * 설계 결정: 저장 스키마는 AI 타입('essay')으로 입력을 받는다.
 * 이유: 클라이언트는 AI 도메인 타입을 사용하고,
 * DB 변환(essay → descriptive)은 Server Action에서만 수행한다.
 * 스키마와 Server Action 사이의 관심사 분리.
 */

import { describe, it, expect } from 'vitest'
import {
  questionToSaveSchema,
  saveQuestionsRequestSchema,
} from '../save-questions'
import { MAX_QUESTION_COUNT } from '@/lib/constants/questions'

// 기본 유효 문제 객체 — 불변이므로 공유 안전
const validQuestion = {
  content: '이차방정식 x² - 5x + 6 = 0의 해를 구하시오.',
  type: 'multiple_choice',
  difficulty: 'medium',
  answer: '① x=2, x=3',
  explanation: '(x-2)(x-3) = 0이므로 x=2 또는 x=3',
  options: ['① x=2, x=3', '② x=1, x=4', '③ x=-2, x=-3', '④ x=0, x=5'],
} as const

const validInput = {
  pastExamId: '550e8400-e29b-41d4-a716-446655440000',
  questions: [validQuestion],
} as const

// ─── questionToSaveSchema ────────────────────────────────

describe('questionToSaveSchema', () => {
  describe('content', () => {
    it('유효한 문제 내용을 통과시킨다', () => {
      const result = questionToSaveSchema.safeParse(validQuestion)
      expect(result.success).toBe(true)
    })

    it('빈 문자열을 거부한다', () => {
      const result = questionToSaveSchema.safeParse({
        ...validQuestion,
        content: '',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('비어있습니다')
      }
    })
  })

  describe('type', () => {
    it.each(['multiple_choice', 'short_answer', 'essay'] as const)(
      'AI 유형 "%s"을 통과시킨다',
      (type) => {
        const result = questionToSaveSchema.safeParse({
          ...validQuestion,
          type,
        })
        expect(result.success).toBe(true)
      }
    )

    it("DB 유형 'descriptive'를 거부한다 (스키마는 AI 타입만 수락)", () => {
      const result = questionToSaveSchema.safeParse({
        ...validQuestion,
        type: 'descriptive',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('유효하지 않은 문제 유형')
      }
    })

    it('유효하지 않은 타입을 거부한다', () => {
      const result = questionToSaveSchema.safeParse({
        ...validQuestion,
        type: 'quiz',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('difficulty', () => {
    it.each(['easy', 'medium', 'hard'] as const)(
      '유효한 난이도 "%s"를 통과시킨다',
      (difficulty) => {
        const result = questionToSaveSchema.safeParse({
          ...validQuestion,
          difficulty,
        })
        expect(result.success).toBe(true)
      }
    )

    it('유효하지 않은 난이도를 거부한다', () => {
      const result = questionToSaveSchema.safeParse({
        ...validQuestion,
        difficulty: 'extreme',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('유효하지 않은 난이도')
      }
    })
  })

  describe('answer', () => {
    it('유효한 정답을 통과시킨다', () => {
      const result = questionToSaveSchema.safeParse(validQuestion)
      expect(result.success).toBe(true)
    })

    it('빈 정답을 거부한다', () => {
      const result = questionToSaveSchema.safeParse({
        ...validQuestion,
        answer: '',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('비어있습니다')
      }
    })
  })

  describe('optional 필드', () => {
    it('explanation이 없어도 통과한다', () => {
      const { explanation: _, ...withoutExplanation } = validQuestion
      const result = questionToSaveSchema.safeParse(withoutExplanation)
      expect(result.success).toBe(true)
    })

    it('options가 없어도 통과한다 (단답형/서술형)', () => {
      const { options: _, ...withoutOptions } = validQuestion
      const result = questionToSaveSchema.safeParse(withoutOptions)
      expect(result.success).toBe(true)
    })

    it('options가 빈 배열이어도 통과한다', () => {
      const result = questionToSaveSchema.safeParse({
        ...validQuestion,
        options: [],
      })
      expect(result.success).toBe(true)
    })
  })

  describe('필드 인젝션 방지', () => {
    it('스키마에 없는 필드를 자동 strip한다', () => {
      const result = questionToSaveSchema.safeParse({
        ...validQuestion,
        academyId: 'injected-id',
        isAdmin: true,
        createdBy: 'hacker',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).not.toHaveProperty('academyId')
        expect(result.data).not.toHaveProperty('isAdmin')
        expect(result.data).not.toHaveProperty('createdBy')
      }
    })
  })
})

// ─── saveQuestionsRequestSchema ──────────────────────────

describe('saveQuestionsRequestSchema', () => {
  describe('pastExamId', () => {
    it('유효한 UUID를 통과시킨다', () => {
      const result = saveQuestionsRequestSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it('유효하지 않은 UUID를 거부한다', () => {
      const result = saveQuestionsRequestSchema.safeParse({
        ...validInput,
        pastExamId: 'not-a-uuid',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('유효하지 않습니다')
      }
    })
  })

  describe('questions 배열', () => {
    it('빈 배열을 거부한다', () => {
      const result = saveQuestionsRequestSchema.safeParse({
        ...validInput,
        questions: [],
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('저장할 문제가 없습니다')
      }
    })

    it(`${10}개를 초과하면 거부한다`, () => {
      const tooMany = Array.from({ length: 11 }, () => ({ ...validQuestion }))
      const result = saveQuestionsRequestSchema.safeParse({
        ...validInput,
        questions: tooMany,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('최대')
      }
    })

    it(`MAX_QUESTION_COUNT(${10})개는 통과한다`, () => {
      const maxQuestions = Array.from({ length: MAX_QUESTION_COUNT }, () => ({
        ...validQuestion,
        type: 'short_answer' as const,
      }))
      const result = saveQuestionsRequestSchema.safeParse({
        pastExamId: '550e8400-e29b-41d4-a716-446655440000',
        questions: maxQuestions,
      })
      expect(result.success).toBe(true)
    })

    it('배열 내 개별 문제 검증도 수행한다', () => {
      const result = saveQuestionsRequestSchema.safeParse({
        ...validInput,
        questions: [{ ...validQuestion, content: '' }],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('타입 export 확인', () => {
    it('SaveQuestionsRequest 타입이 infer로 추출 가능하다 (런타임 검증)', () => {
      const result = saveQuestionsRequestSchema.safeParse(validInput)
      expect(result.success).toBe(true)
      if (result.success) {
        // result.data가 SaveQuestionsRequest 타입이어야 함
        expect(result.data.pastExamId).toBe('550e8400-e29b-41d4-a716-446655440000')
        expect(result.data.questions).toHaveLength(1)
        expect(result.data.questions[0].type).toBe('multiple_choice')
      }
    })
  })
})

```

> **RED 검증 명령어**:
> ```bash
> npx vitest run src/lib/validations/__tests__/save-questions.test.ts
> ```
> `save-questions.ts` 파일이 존재하지 않으므로 **모듈 없음 에러**가 발생해야 한다.
>
> 참고: `MAX_QUESTION_COUNT` 상수 테스트는 `generate-questions.test.ts`에 이미 존재하므로
> 여기서는 중복하지 않는다.

---

#### GREEN: 최소 구현

파일: `src/lib/validations/save-questions.ts` (신규)

```typescript
/**
 * AI 생성 문제 저장 요청 검증
 * Zod 스키마 — MAX_QUESTION_COUNT는 공통 상수 파일에서 import
 *
 * 설계 결정:
 * - 입력은 AI 타입('essay')으로 받는다 → DB 변환은 Server Action 책임
 * - z.object() 기본 동작으로 unknown key를 자동 제거 (필드 인젝션 방지)
 * - MAX_QUESTION_COUNT를 별도 정의하지 않고 '@/lib/constants/questions'에서 가져온다
 *   → 생성(generate)과 저장(save)이 같은 상수를 공유 (Single Source of Truth)
 */

import { z } from 'zod'
import { MAX_QUESTION_COUNT } from '@/lib/constants/questions'

/**
 * 저장할 개별 문제 스키마
 *
 * type 필드는 AI 도메인 타입('essay')만 수락한다.
 * 'descriptive'(DB 타입)는 Server Action에서 변환되므로
 * 클라이언트에서 직접 DB 타입을 주입하려는 시도를 차단한다.
 */
export const questionToSaveSchema = z.object({
  content: z.string().min(1, '문제 내용이 비어있습니다.'),
  type: z.enum(['multiple_choice', 'short_answer', 'essay'], {
    message: '유효하지 않은 문제 유형입니다.',
  }),
  difficulty: z.enum(['easy', 'medium', 'hard'], {
    message: '유효하지 않은 난이도입니다.',
  }),
  answer: z.string().min(1, '정답이 비어있습니다.'),
  explanation: z.string().optional(),
  options: z.array(z.string()).optional(),
})

export const saveQuestionsRequestSchema = z.object({
  pastExamId: z.string().uuid('기출문제 ID가 유효하지 않습니다.'),
  questions: z
    .array(questionToSaveSchema)
    .min(1, '저장할 문제가 없습니다.')
    .max(
      MAX_QUESTION_COUNT,
      `한 번에 최대 ${MAX_QUESTION_COUNT}개까지 저장할 수 있습니다.`
    ),
})

/** saveQuestionsRequestSchema에서 추론된 타입 */
export type SaveQuestionsRequest = z.infer<typeof saveQuestionsRequestSchema>

/** questionToSaveSchema에서 추론된 타입 */
export type QuestionToSave = z.infer<typeof questionToSaveSchema>
```

> **NOTE 1 해결**: `MAX_QUESTION_COUNT`를 `@/lib/constants/questions.ts`로 이동하여
> 생성/저장 모두에서 공유한다 (Single Source of Truth). 예비 작업에서 처리.
>
> **NOTE 2 해결**: `questionToSaveSchema`와 `generateQuestionsRequestSchema`는 **중복이 아니다**.
> - 생성 스키마: `{ pastExamId, questionType, difficulty, count }` → "무엇을 만들지" (주문서)
> - 저장 스키마: `{ pastExamId, questions[] }` → "만들어진 것을 저장" (배달된 음식 검수)
> - `type`/`difficulty` enum이 겹치는 건 같은 도메인 용어를 사용하기 때문이지 중복이 아님

> **GREEN 검증 명령어**:
> ```bash
> npx vitest run src/lib/validations/__tests__/save-questions.test.ts
> ```
> 모든 테스트 PASS해야 한다.

---

#### REFACTOR: 개선

변경 사항 없음 — 구현이 단순하고 명확하다.

확인 사항:
- 주석이 'essay' vs 'descriptive' 설계 결정을 명확히 설명하는가? (YES)
- `MAX_QUESTION_COUNT`가 `@/lib/constants/questions`에서 import되는가? (YES — 별도 정의 없음)
- `SaveQuestionsRequest`와 `QuestionToSave` 타입이 export되어 Server Action에서 활용 가능한가? (YES)

---

#### 검증 명령어

```bash
npx vitest run src/lib/validations/__tests__/save-questions.test.ts
```

---

## 파일 변경 요약

| 파일 | 작업 | 설명 |
|------|------|------|
| `src/lib/ai/__tests__/types-difficulty.test.ts` | 신규 | 난이도 매핑 함수 테스트 (11개) |
| `src/lib/ai/types.ts` | 수정 | `DifficultyLevel` 타입, `DIFFICULTY_TO_NUMBER`, `NUMBER_TO_DIFFICULTY`, `toDifficultyNumber`, `fromDifficultyNumber` 추가 |
| `src/lib/ai/__tests__/index.test.ts` | 수정 | 난이도 매핑 함수 export 검증 테스트 추가 (3개) |
| `src/lib/ai/index.ts` | 수정 | `DifficultyLevel`, `toDifficultyNumber`, `fromDifficultyNumber` export 추가 |
| `src/lib/constants/questions.ts` | 신규 | `MAX_QUESTION_COUNT` 공통 상수 (생성/저장 공유) |
| `src/lib/validations/generate-questions.ts` | 수정 | 상수 정의 제거 → `@/lib/constants/questions`에서 import |
| `src/lib/validations/__tests__/generate-questions.test.ts` | 수정 | `MAX_QUESTION_COUNT` import 경로 변경 |
| `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` | 수정 | `MAX_QUESTION_COUNT` import 경로 변경 |
| `src/lib/validations/__tests__/save-questions.test.ts` | 신규 | 저장 Zod 스키마 테스트 (14개) |
| `src/lib/validations/save-questions.ts` | 신규 | `questionToSaveSchema`, `saveQuestionsRequestSchema`, 관련 타입 |

---

## 성공 기준

- [ ] `types-difficulty.test.ts` 11개 테스트 PASS
- [ ] `index.test.ts` 기존 + 신규 3개 테스트 PASS (기존 테스트 미파손)
- [ ] `generate-questions.test.ts` 기존 테스트 PASS (import 경로 변경 후 회귀 없음)
- [ ] `save-questions.test.ts` 14개 테스트 PASS
- [ ] `types.test.ts` 기존 테스트 미파손 (회귀 없음)
- [ ] TypeScript 컴파일 에러 없음

---

## 최종 검증 명령어

```bash
# 전체 Task 테스트
npx vitest run src/lib/ai/__tests__/types-difficulty.test.ts
npx vitest run src/lib/ai/__tests__/types.test.ts
npx vitest run src/lib/ai/__tests__/index.test.ts
npx vitest run src/lib/validations/__tests__/generate-questions.test.ts
npx vitest run src/lib/validations/__tests__/save-questions.test.ts

# 또는 한 번에 (AI 모듈 + 검증 모듈 전체)
npx vitest run src/lib/ai src/lib/validations
```

---

## 학습 리뷰

### 핵심 개념 설명

#### 1. `as const satisfies Record<K, V>` 패턴

```typescript
// as const 없이: TypeScript가 number로 추론 (너무 넓음)
const MAP = { easy: 2, medium: 3, hard: 4 }
// MAP.easy의 타입 → number (2가 아닌!)

// as const만: 리터럴 타입은 고정되지만, 키 누락 감지 불가
const MAP = { easy: 2, medium: 3 } as const
// hard가 없어도 컴파일 에러 없음!

// as const satisfies Record<DifficultyLevel, number>: 두 문제 모두 해결
const MAP = {
  easy: 2,
  medium: 3,
  hard: 4,
} as const satisfies Record<DifficultyLevel, number>
// MAP.easy의 타입 → 2 (리터럴!)
// hard 누락 시 → 컴파일 에러 "Property 'hard' is missing"
```

`as const`는 **리터럴 타입 고정**, `satisfies`는 **형태 검증** 역할을 한다.
함께 사용하면 "타입 안전성 + 완전성 강제" 두 가지를 동시에 얻는다.

#### 2. 양방향 타입 매핑 — AI↔DB 변환 함수 쌍

```typescript
// 단방향이 아닌 양방향으로 구현하는 이유:
// - toDbQuestionType: 저장 시 사용 (AI → DB)
// - fromDbQuestionType: 조회 시 사용 (DB → AI)
// 두 함수가 없으면 조회 결과를 AI 도메인에서 사용할 때 타입 불일치 발생

// 설계 원칙: 각 도메인(AI, DB)은 자신만의 타입을 사용하고,
// 경계(Server Action)에서만 변환이 일어난다.
```

#### 3. 우연한 중복(Accidental Duplication) vs 진짜 중복

```typescript
// 생성 스키마: "AI에게 뭘 만들라고 할지" 검증
const generateSchema = z.object({
  questionType: z.enum(['multiple_choice', 'short_answer', 'essay']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  count: z.number(),
})

// 저장 스키마: "AI가 만든 결과를 DB에 저장할지" 검증
const saveSchema = z.object({
  content: z.string(),
  type: z.enum(['multiple_choice', 'short_answer', 'essay']),  // 같은 enum!
  difficulty: z.enum(['easy', 'medium', 'hard']),               // 같은 enum!
  answer: z.string(),
})

// Q: type, difficulty enum이 같으니 중복인가?
// A: 아니다! "같은 도메인 용어"를 사용할 뿐, 검증 대상이 다르다.
//    - 생성: "어떤 종류로 만들지" 선택 (주문서)
//    - 저장: "만들어진 결과가 유효한지" 검증 (품질 검수)
//    DRY 판단: "같은 이유로 변경되는가?" → NO → 우연한 중복 → 분리 유지
```

#### 4. Zod `z.object()` 기본 동작 — 필드 인젝션 방지

```typescript
const schema = z.object({ name: z.string() })

// 알 수 없는 키는 자동으로 제거됨 (strip 모드가 기본값)
const result = schema.parse({ name: '필립', isAdmin: true })
// result → { name: '필립' }  ← isAdmin이 제거됨!

// 이것이 보안에 중요한 이유:
// 클라이언트가 { academyId: 'hacker-id' }를 추가로 보내도
// 스키마를 통과하면 사라지므로 Server Action에서 무시됨
```

---

### 이해도 질문

**질문 1**: `as const`와 `satisfies`를 각각 단독으로 사용하면 어떤 문제가 생기는가?
- `as const`만 사용 시 `DIFFICULTY_TO_NUMBER`에 'hard' 키를 빠뜨려도 TypeScript가 에러를 내지 않는다. 왜인가?
- `satisfies`만 사용 시 `DIFFICULTY_TO_NUMBER.easy`의 타입은 무엇으로 추론되는가? 그것이 왜 문제인가?

**질문 2**: `fromDifficultyNumber`에서 매핑에 없는 숫자(1, 5)에 대해 `throw new Error(...)` 대신 `'medium'`을 기본값으로 반환하는 이유는 무엇인가?
- UI 관점에서 throw와 기본값 반환의 차이는 무엇인가?
- 어떤 상황에서는 throw가 더 적합할 수 있는가?

**질문 3**: 저장 Zod 스키마(`questionToSaveSchema`)에서 `type` 필드를 DB 타입(`'descriptive'`)이 아닌 AI 타입(`'essay'`)으로 받는 설계 이유는 무엇인가?
- 만약 DB 타입('descriptive')으로 받으면 어떤 문제가 생기는가?
- 이 설계가 "관심사 분리(Separation of Concerns)"와 어떻게 연결되는가?

**질문 4**: `generateQuestionsRequestSchema`와 `saveQuestionsRequestSchema`에서 `type`/`difficulty` enum이 동일한데, 이것은 DRY 위반인가?
- "같은 이유로 변경되는가?" 기준으로 판단해보라.
- 이 두 스키마의 enum을 하나로 합쳤을 때 발생할 수 있는 문제는?

---

### 직접 구현 추천 판단

| Task | 추천 | 이유 |
|------|------|------|
| Task 1: 난이도 매핑 유틸 | 🔴 직접 구현 필수 | `as const satisfies` 패턴이 새로운 개념. 직접 구현하지 않으면 체화 불가. `toDbQuestionType` 구현 방식을 참고하되 복붙 금지 |
| Task 2: index.ts export 추가 | 🟢 AI 구현 OK | 단순한 export 추가. 패턴 반복. 학습 가치 낮음 |
| Task 3: Zod 스키마 | 🟡 직접 구현 권장 | `generate-questions.ts`를 참고해서 구현 가능하지만, `'descriptive'` 거부 설계 결정의 이유를 이해해야 함. 이해 후 구현 |

**Task 1 직접 구현 절차 (삭제 후 재구현 불필요 — 신규 추가이므로)**:
1. `types-difficulty.test.ts` 먼저 작성 (RED)
2. 테스트 실행 → FAIL 확인
3. `types.ts`에 `DifficultyLevel`, `DIFFICULTY_TO_NUMBER`, `NUMBER_TO_DIFFICULTY`, 두 함수 직접 작성
4. 테스트 실행 → PASS 확인
5. `as const satisfies`를 제거하면 어떤 차이가 있는지 실험해보기
