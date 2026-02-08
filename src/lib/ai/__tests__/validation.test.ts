import { describe, it, expect } from 'vitest'
import {
  generatedQuestionSchema,
  generatedQuestionsResponseSchema,
  questionsJsonSchema,
  validateGeneratedQuestions,
} from '../validation'
import { AIValidationError } from '../errors'

// ─── 테스트 데이터 팩토리 ────────────────────────────────

/** 유효한 객관식 문제 데이터 */
function createMultipleChoice(overrides = {}) {
  return {
    content: '다음 중 올바른 것은?',
    answer: '③',
    explanation: '정답은 ③번입니다.',
    difficulty: 'medium' as const,
    questionType: 'multiple_choice' as const,
    options: ['보기1', '보기2', '보기3', '보기4', '보기5'],
    ...overrides,
  }
}

/** 유효한 주관식 문제 데이터 */
function createShortAnswer(overrides = {}) {
  return {
    content: '대한민국의 수도는?',
    answer: '서울',
    explanation: '서울특별시입니다.',
    difficulty: 'easy' as const,
    questionType: 'short_answer' as const,
    ...overrides,
  }
}

/** 유효한 서술형 문제 데이터 */
function createEssay(overrides = {}) {
  return {
    content: '광합성 과정을 설명하시오.',
    answer: '광합성은 빛 에너지를 화학 에너지로 변환하는 과정이다.',
    explanation: '엽록체에서 일어나는 과정입니다.',
    difficulty: 'hard' as const,
    questionType: 'essay' as const,
    ...overrides,
  }
}

// ─── generatedQuestionSchema ─────────────────────────────

describe('generatedQuestionSchema', () => {
  it('유효한 객관식 문제를 파싱한다', () => {
    const result = generatedQuestionSchema.safeParse(createMultipleChoice())
    expect(result.success).toBe(true)
  })

  it('유효한 주관식 문제를 파싱한다', () => {
    const result = generatedQuestionSchema.safeParse(createShortAnswer())
    expect(result.success).toBe(true)
  })

  it('유효한 서술형 문제를 파싱한다', () => {
    const result = generatedQuestionSchema.safeParse(createEssay())
    expect(result.success).toBe(true)
  })

  it('content가 빈 문자열이면 파싱에 실패한다', () => {
    const data = createMultipleChoice({ content: '' })
    const result = generatedQuestionSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('잘못된 difficulty 값이면 파싱에 실패한다', () => {
    const data = createMultipleChoice({ difficulty: 'extreme' })
    const result = generatedQuestionSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

// ─── generatedQuestionsResponseSchema ────────────────────

describe('generatedQuestionsResponseSchema', () => {
  it('questions 배열을 포함한 데이터를 파싱한다', () => {
    const data = { questions: [createMultipleChoice(), createShortAnswer()] }
    const result = generatedQuestionsResponseSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('questions 필드가 누락되면 파싱에 실패한다', () => {
    const result = generatedQuestionsResponseSchema.safeParse({ items: [] })
    expect(result.success).toBe(false)
  })
})

// ─── questionsJsonSchema ─────────────────────────────────

describe('questionsJsonSchema', () => {
  it('JSON Schema 형식 객체를 반환한다', () => {
    expect(questionsJsonSchema).toHaveProperty('type', 'object')
  })

  it('properties에 questions 필드를 포함한다', () => {
    const schema = questionsJsonSchema as Record<string, unknown>
    const properties = schema.properties as Record<string, unknown>
    expect(properties).toHaveProperty('questions')
  })
})

// ─── validateGeneratedQuestions ───────────────────────────

describe('validateGeneratedQuestions', () => {
  it('유효한 데이터를 GeneratedQuestion[] 로 반환한다', () => {
    const data = { questions: [createMultipleChoice(), createShortAnswer()] }
    const result = validateGeneratedQuestions(data)
    expect(result).toHaveLength(2)
  })

  it('반환 객체가 type 필드를 가진다 (questionType에서 매핑)', () => {
    const data = { questions: [createMultipleChoice()] }
    const result = validateGeneratedQuestions(data)
    expect(result[0].type).toBe('multiple_choice')
  })

  it('객관식 보기 5개면 성공한다', () => {
    const data = { questions: [createMultipleChoice()] }
    const result = validateGeneratedQuestions(data)
    expect(result[0].options).toHaveLength(5)
  })

  it('객관식 보기가 5개 미만이면 AIValidationError를 던진다', () => {
    const data = {
      questions: [createMultipleChoice({ options: ['A', 'B', 'C'] })],
    }
    expect(() => validateGeneratedQuestions(data)).toThrow(AIValidationError)
  })

  it('객관식에 보기가 없으면 AIValidationError를 던진다', () => {
    const data = {
      questions: [createMultipleChoice({ options: undefined })],
    }
    expect(() => validateGeneratedQuestions(data)).toThrow(AIValidationError)
  })

  it('Zod 파싱 실패 시 AIValidationError를 던진다 (details 포함)', () => {
    const data = { questions: [{ content: '' }] }

    expect(() => validateGeneratedQuestions(data)).toThrow(AIValidationError)

    // details 구조 상세 검증
    try {
      validateGeneratedQuestions(data)
    } catch (error) {
      const validationError = error as AIValidationError
      expect(validationError.details).toBeDefined()
      expect(validationError.details!.length).toBeGreaterThan(0)
      expect(validationError.details![0]).toHaveProperty('path')
      expect(validationError.details![0]).toHaveProperty('message')
    }
  })

  it('주관식은 options 없이 성공한다', () => {
    const data = { questions: [createShortAnswer()] }
    const result = validateGeneratedQuestions(data)
    expect(result[0].options).toBeUndefined()
  })

  it('서술형은 options 없이 성공한다', () => {
    const data = { questions: [createEssay()] }
    const result = validateGeneratedQuestions(data)
    expect(result[0].options).toBeUndefined()
  })
})
