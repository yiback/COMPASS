/**
 * generateQuestionsRequestSchema 테스트
 * TDD RED → GREEN → IMPROVE
 *
 * AI 문제 생성 요청 검증용 Zod 스키마 테스트
 */

import { describe, expect, it } from 'vitest'
import { generateQuestionsRequestSchema } from '../generate-questions'
import { MAX_QUESTION_COUNT } from '@/lib/constants/questions'

// 모든 테스트에서 스프레드로 재사용 — 불변이므로 공유 안전
const validInput = {
  pastExamId: '550e8400-e29b-41d4-a716-446655440000',
  questionType: 'multiple_choice',
  difficulty: 'medium',
  count: 5,
} as const

describe('generateQuestionsRequestSchema', () => {
  // ─── pastExamId ─────────────────────────────────────────

  describe('pastExamId', () => {
    it('유효한 UUID를 통과시킨다', () => {
      const result = generateQuestionsRequestSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it('유효하지 않은 UUID를 거부한다', () => {
      const result = generateQuestionsRequestSchema.safeParse({
        ...validInput,
        pastExamId: 'not-a-uuid',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('유효하지 않습니다')
      }
    })

    it('빈 문자열을 거부한다', () => {
      const result = generateQuestionsRequestSchema.safeParse({
        ...validInput,
        pastExamId: '',
      })
      expect(result.success).toBe(false)
    })
  })

  // ─── questionType ───────────────────────────────────────

  describe('questionType', () => {
    it.each(['multiple_choice', 'short_answer', 'essay'] as const)(
      '유효한 문제 유형 "%s"을 통과시킨다',
      (type) => {
        const result = generateQuestionsRequestSchema.safeParse({
          ...validInput,
          questionType: type,
        })
        expect(result.success).toBe(true)
      }
    )

    it('유효하지 않은 문제 유형을 거부한다', () => {
      const result = generateQuestionsRequestSchema.safeParse({
        ...validInput,
        questionType: 'quiz',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('문제 유형')
      }
    })
  })

  // ─── difficulty ─────────────────────────────────────────

  describe('difficulty', () => {
    it.each(['easy', 'medium', 'hard'] as const)(
      '유효한 난이도 "%s"을 통과시킨다',
      (level) => {
        const result = generateQuestionsRequestSchema.safeParse({
          ...validInput,
          difficulty: level,
        })
        expect(result.success).toBe(true)
      }
    )

    it('유효하지 않은 난이도를 거부한다', () => {
      const result = generateQuestionsRequestSchema.safeParse({
        ...validInput,
        difficulty: 'extreme',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('난이도')
      }
    })
  })

  // ─── count ──────────────────────────────────────────────

  describe('count', () => {
    it('유효한 문제 수를 통과시킨다', () => {
      const result = generateQuestionsRequestSchema.safeParse(validInput)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.count).toBe(5)
      }
    })

    it('문자열을 숫자로 coerce한다', () => {
      const result = generateQuestionsRequestSchema.safeParse({
        ...validInput,
        count: '3',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.count).toBe(3)
      }
    })

    it('0 이하를 거부한다', () => {
      const zeroResult = generateQuestionsRequestSchema.safeParse({
        ...validInput,
        count: 0,
      })
      expect(zeroResult.success).toBe(false)

      const negativeResult = generateQuestionsRequestSchema.safeParse({
        ...validInput,
        count: -1,
      })
      expect(negativeResult.success).toBe(false)
    })

    it('최대값 초과를 거부한다', () => {
      const result = generateQuestionsRequestSchema.safeParse({
        ...validInput,
        count: MAX_QUESTION_COUNT + 1,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('최대')
      }
    })

    it('소수점을 거부한다', () => {
      const result = generateQuestionsRequestSchema.safeParse({
        ...validInput,
        count: 2.5,
      })
      expect(result.success).toBe(false)
    })
  })

  // ─── 복합 검증 ──────────────────────────────────────────

  describe('복합 검증', () => {
    it('모든 필드가 동시에 유효하면 통과한다', () => {
      const result = generateQuestionsRequestSchema.safeParse({
        pastExamId: '550e8400-e29b-41d4-a716-446655440000',
        questionType: 'essay',
        difficulty: 'hard',
        count: 10,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          pastExamId: '550e8400-e29b-41d4-a716-446655440000',
          questionType: 'essay',
          difficulty: 'hard',
          count: 10,
        })
      }
    })

    it('스키마에 없는 필드를 자동 strip한다', () => {
      const result = generateQuestionsRequestSchema.safeParse({
        ...validInput,
        academyId: 'injected-id',
        isAdmin: true,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).not.toHaveProperty('academyId')
        expect(result.data).not.toHaveProperty('isAdmin')
      }
    })
  })

  // ─── MAX_QUESTION_COUNT ─────────────────────────────────

  describe('MAX_QUESTION_COUNT', () => {
    it('상수 값이 10이어야 한다', () => {
      expect(MAX_QUESTION_COUNT).toBe(10)
    })
  })
})
