import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generatedQuestionSchema,
  generatedQuestionsResponseSchema,
  questionsJsonSchema,
  validateGeneratedQuestions,
} from '../validation'
import { AIValidationError } from '../errors'

// ─── 도형 테스트 데이터 팩토리 ───────────────────────────

/** 유효한 원 FigureData */
function createCircleFigure(overrides = {}) {
  return {
    type: 'circle' as const,
    center: [0, 0] as [number, number],
    radius: 5,
    displaySize: 'large' as const,
    description: '반지름 5인 원',
    ...overrides,
  }
}

/** 유효한 다각형 FigureData */
function createPolygonFigure(overrides = {}) {
  return {
    type: 'polygon' as const,
    vertices: [
      [0, 0],
      [3, 0],
      [0, 4],
    ] as [number, number][],
    displaySize: 'large' as const,
    description: '직각삼각형',
    ...overrides,
  }
}

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

  // ─── figures 관련 테스트 (H2) ─────────────────────────

  it('hasFigure: true + 유효한 figures 배열 → 반환 객체에 hasFigure와 figures 포함', () => {
    const data = {
      questions: [
        createShortAnswer({
          content: '다음 그림 {{fig:1}}에서 원의 넓이를 구하시오.',
          hasFigure: true,
          figures: [createCircleFigure()],
        }),
      ],
    }
    const result = validateGeneratedQuestions(data)
    expect(result).toHaveLength(1)
    expect(result[0].hasFigure).toBe(true)
    expect(result[0].figures).toHaveLength(1)
  })

  it('figures 배열에 유효한 FigureData 항목 → validateGeneratedQuestions 성공', () => {
    const data = {
      questions: [
        createShortAnswer({
          content: '{{fig:1}}과 {{fig:2}}를 비교하시오.',
          hasFigure: true,
          figures: [createCircleFigure(), createPolygonFigure()],
        }),
      ],
    }
    const result = validateGeneratedQuestions(data)
    expect(result[0].figures).toHaveLength(2)
  })

  it('figures 배열에 type 누락된 무효한 도형 데이터 → Zod 파싱 실패 (AIValidationError)', () => {
    const data = {
      questions: [
        createShortAnswer({
          hasFigure: true,
          figures: [
            {
              // type 필드 없음 — discriminated union 판별 불가
              center: [0, 0],
              radius: 5,
              description: '타입 없는 도형',
            },
          ],
        }),
      ],
    }
    expect(() => validateGeneratedQuestions(data)).toThrow(AIValidationError)
  })

  it('{{fig:2}} 참조 + figures.length === 1 → console.warn 호출, throw 안 함', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const data = {
      questions: [
        createShortAnswer({
          // {{fig:2}} 참조하지만 figures는 1개뿐
          content: '다음 그림 {{fig:2}}에서 답을 구하시오.',
          hasFigure: true,
          figures: [createCircleFigure()],
        }),
      ],
    }

    // throw하지 않음
    expect(() => validateGeneratedQuestions(data)).not.toThrow()
    // console.warn이 호출됨
    expect(warnSpy).toHaveBeenCalledOnce()
    expect(warnSpy.mock.calls[0][0]).toContain('[validateGeneratedQuestions]')

    warnSpy.mockRestore()
  })

  it('hasFigure 없음 + figures: undefined → 정상 통과 (기존 동작 유지)', () => {
    const data = { questions: [createShortAnswer()] }
    const result = validateGeneratedQuestions(data)
    expect(result).toHaveLength(1)
    expect(result[0].hasFigure).toBeUndefined()
    expect(result[0].figures).toBeUndefined()
  })
})
