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
