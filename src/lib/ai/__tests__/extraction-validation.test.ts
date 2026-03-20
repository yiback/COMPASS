import { describe, it, expect } from 'vitest'
import {
  validateExtractedQuestions,
  boundingBoxSchema,
  figureInfoSchema,
  extractedQuestionSchema,
  extractionResponseSchema,
  extractionJsonSchema,
} from '../extraction-validation'
import { AIValidationError } from '../errors'

// ─── 공통 픽스처 ──────────────────────────────────────────

/** 유효한 객관식 문제 */
function createMultipleChoiceQuestion(overrides = {}) {
  return {
    questionNumber: 1,
    questionText: '다음 중 올바른 것은?',
    questionType: 'multiple_choice',
    options: ['보기1', '보기2', '보기3', '보기4', '보기5'],
    answer: '보기2',
    confidence: 0.95,
    hasFigure: false,
    ...overrides,
  }
}

/** 유효한 단답형 문제 */
function createShortAnswerQuestion(overrides = {}) {
  return {
    questionNumber: 2,
    questionText: '$x^2 + 2x + 1 = 0$의 해를 구하시오.',
    questionType: 'short_answer',
    answer: 'x = -1',
    confidence: 0.9,
    hasFigure: false,
    ...overrides,
  }
}

/** 유효한 서술형 문제 */
function createEssayQuestion(overrides = {}) {
  return {
    questionNumber: 3,
    questionText: '다음 그래프를 보고 해석하시오.',
    questionType: 'essay',
    confidence: 0.85,
    hasFigure: true,
    figures: [
      {
        description: 'y = 2x + 1 그래프',
        boundingBox: { x: 0.1, y: 0.2, width: 0.4, height: 0.3 },
        pageNumber: 1,
        confidence: 0.8,
      },
    ],
    ...overrides,
  }
}

/** 유효한 혼합 응답 */
function createValidResponse() {
  return {
    questions: [
      createMultipleChoiceQuestion(),
      createShortAnswerQuestion(),
      createEssayQuestion(),
    ],
  }
}

// ─── 테스트 ──────────────────────────────────────────────

describe('extraction-validation', () => {
  // ─── 그룹 1: 유효 응답 ────────────────────────────────

  describe('유효한 응답 검증', () => {
    it('객관식 + 단답형 + 서술형 혼합 응답을 정상 반환한다', () => {
      const result = validateExtractedQuestions(createValidResponse())

      expect(result.totalQuestions).toBe(3)
      expect(result.questions).toHaveLength(3)
      expect(result.questions[0].questionType).toBe('multiple_choice')
      expect(result.questions[1].questionType).toBe('short_answer')
      expect(result.questions[2].questionType).toBe('essay')
    })

    it('빈 questions 배열은 overallConfidence = 0, totalQuestions = 0이다', () => {
      const result = validateExtractedQuestions({ questions: [] })

      expect(result.totalQuestions).toBe(0)
      expect(result.overallConfidence).toBe(0)
      expect(result.questions).toHaveLength(0)
    })

    it('confidence 경계값 (0.0, 0.5, 1.0)은 유효하다', () => {
      const data = {
        questions: [
          createShortAnswerQuestion({ questionNumber: 1, confidence: 0.0 }),
          createShortAnswerQuestion({ questionNumber: 2, confidence: 0.5 }),
          createShortAnswerQuestion({ questionNumber: 3, confidence: 1.0 }),
        ],
      }

      const result = validateExtractedQuestions(data)

      expect(result.questions[0].confidence).toBe(0.0)
      expect(result.questions[1].confidence).toBe(0.5)
      expect(result.questions[2].confidence).toBe(1.0)
    })
  })

  // ─── 그룹 2: Zod 검증 실패 ───────────────────────────

  describe('Zod 구문적 검증 실패', () => {
    it('confidence가 -0.1이면 AIValidationError를 던진다', () => {
      const data = {
        questions: [createShortAnswerQuestion({ confidence: -0.1 })],
      }

      expect(() => validateExtractedQuestions(data)).toThrow(
        AIValidationError,
      )
    })

    it('confidence가 1.1이면 AIValidationError를 던진다', () => {
      const data = {
        questions: [createShortAnswerQuestion({ confidence: 1.1 })],
      }

      expect(() => validateExtractedQuestions(data)).toThrow(
        AIValidationError,
      )
    })

    it('questionType이 무효 값("fill_blank")이면 AIValidationError를 던진다', () => {
      const data = {
        questions: [
          createShortAnswerQuestion({ questionType: 'fill_blank' }),
        ],
      }

      expect(() => validateExtractedQuestions(data)).toThrow(
        AIValidationError,
      )
    })

    it('questionNumber가 비정수(1.5)이면 AIValidationError를 던진다', () => {
      const data = {
        questions: [createShortAnswerQuestion({ questionNumber: 1.5 })],
      }

      expect(() => validateExtractedQuestions(data)).toThrow(
        AIValidationError,
      )
    })

    it('pageNumber가 0이면 AIValidationError를 던진다', () => {
      const data = {
        questions: [
          createEssayQuestion({
            figures: [
              {
                description: '그래프',
                boundingBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
                pageNumber: 0,
                confidence: 0.8,
              },
            ],
          }),
        ],
      }

      expect(() => validateExtractedQuestions(data)).toThrow(
        AIValidationError,
      )
    })

    it('boundingBox 범위 초과(x: 1.5)이면 AIValidationError를 던진다', () => {
      const data = {
        questions: [
          createEssayQuestion({
            figures: [
              {
                description: '그래프',
                boundingBox: { x: 1.5, y: 0.2, width: 0.3, height: 0.4 },
                pageNumber: 1,
                confidence: 0.8,
              },
            ],
          }),
        ],
      }

      expect(() => validateExtractedQuestions(data)).toThrow(
        AIValidationError,
      )
    })
  })

  // ─── 그룹 3: 비즈니스 규칙 검증 ──────────────────────

  describe('비즈니스 규칙 검증', () => {
    it('객관식인데 options가 누락되면 AIValidationError를 던진다', () => {
      const data = {
        questions: [
          createMultipleChoiceQuestion({ options: undefined }),
        ],
      }

      expect(() => validateExtractedQuestions(data)).toThrow(
        AIValidationError,
      )
      expect(() => validateExtractedQuestions(data)).toThrow(
        '객관식인데 보기가 없습니다',
      )
    })

    it('객관식인데 options가 빈 배열이면 AIValidationError를 던진다', () => {
      const data = {
        questions: [createMultipleChoiceQuestion({ options: [] })],
      }

      expect(() => validateExtractedQuestions(data)).toThrow(
        AIValidationError,
      )
    })
  })

  // ─── 그룹 4: figures 처리 ─────────────────────────────

  describe('figures 처리', () => {
    it('유효한 figures가 있으면 url = null로 매핑한다', () => {
      const data = {
        questions: [createEssayQuestion()],
      }

      const result = validateExtractedQuestions(data)

      expect(result.questions[0].figures).toHaveLength(1)
      expect(result.questions[0].figures![0].url).toBeNull()
      expect(result.questions[0].figures![0].description).toBe(
        'y = 2x + 1 그래프',
      )
    })

    it('hasFigure = true, figures 없음은 경고 없이 통과한다', () => {
      const data = {
        questions: [
          createEssayQuestion({ figures: undefined }),
        ],
      }

      const result = validateExtractedQuestions(data)

      expect(result.questions[0].hasFigure).toBe(true)
      expect(result.questions[0].figures).toBeUndefined()
    })
  })

  // ─── 그룹 5: overallConfidence 계산 ──────────────────

  describe('overallConfidence 계산', () => {
    it('문제별 confidence 평균을 정확히 계산한다', () => {
      const data = {
        questions: [
          createShortAnswerQuestion({ questionNumber: 1, confidence: 0.8 }),
          createShortAnswerQuestion({ questionNumber: 2, confidence: 0.6 }),
          createShortAnswerQuestion({ questionNumber: 3, confidence: 1.0 }),
        ],
      }

      const result = validateExtractedQuestions(data)

      // (0.8 + 0.6 + 1.0) / 3 = 0.8
      expect(result.overallConfidence).toBeCloseTo(0.8)
    })
  })

  // ─── 그룹 6: JSON Schema ────────────────────────────

  describe('extractionJsonSchema', () => {
    it('JSON Schema 객체가 생성된다', () => {
      expect(extractionJsonSchema).toBeDefined()
      expect(extractionJsonSchema).toHaveProperty('type')
    })
  })
})
