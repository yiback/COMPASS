/**
 * extract-questions Zod 스키마 테스트
 */

import { describe, it, expect } from 'vitest'
import {
  extractQuestionsSchema,
  resetExtractionSchema,
  reanalyzeQuestionSchema,
} from '../extract-questions'

// ─── extractQuestionsSchema ───────────────────────────────

describe('extractQuestionsSchema', () => {
  it('유효한 pastExamId를 통과시킨다', () => {
    const result = extractQuestionsSchema.safeParse({
      pastExamId: 'exam-001',
    })
    expect(result.success).toBe(true)
  })

  it('빈 문자열 pastExamId를 거부한다', () => {
    const result = extractQuestionsSchema.safeParse({
      pastExamId: '',
    })
    expect(result.success).toBe(false)
  })

  it('pastExamId 누락 시 거부한다', () => {
    const result = extractQuestionsSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('비표준 UUID를 허용한다 (.min(1) 사용)', () => {
    const result = extractQuestionsSchema.safeParse({
      pastExamId: 'b0000000-0000-0000-0000-000000000001',
    })
    expect(result.success).toBe(true)
  })
})

// ─── resetExtractionSchema ────────────────────────────────

describe('resetExtractionSchema', () => {
  it('유효한 pastExamId를 통과시킨다', () => {
    const result = resetExtractionSchema.safeParse({
      pastExamId: 'exam-001',
    })
    expect(result.success).toBe(true)
  })

  it('빈 문자열 pastExamId를 거부한다', () => {
    const result = resetExtractionSchema.safeParse({
      pastExamId: '',
    })
    expect(result.success).toBe(false)
  })

  it('pastExamId 누락 시 거부한다', () => {
    const result = resetExtractionSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

// ─── reanalyzeQuestionSchema ──────────────────────────────

describe('reanalyzeQuestionSchema', () => {
  it('유효한 detailId만으로 통과시킨다', () => {
    const result = reanalyzeQuestionSchema.safeParse({
      detailId: 'detail-001',
    })
    expect(result.success).toBe(true)
  })

  it('detailId + feedback을 통과시킨다', () => {
    const result = reanalyzeQuestionSchema.safeParse({
      detailId: 'detail-001',
      feedback: '답이 틀린 것 같습니다',
    })
    expect(result.success).toBe(true)
  })

  it('빈 문자열 detailId를 거부한다', () => {
    const result = reanalyzeQuestionSchema.safeParse({
      detailId: '',
    })
    expect(result.success).toBe(false)
  })

  it('detailId 누락 시 거부한다', () => {
    const result = reanalyzeQuestionSchema.safeParse({
      feedback: '피드백만',
    })
    expect(result.success).toBe(false)
  })

  it('feedback 500자 초과 시 거부한다', () => {
    const result = reanalyzeQuestionSchema.safeParse({
      detailId: 'detail-001',
      feedback: 'a'.repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it('feedback 500자는 통과시킨다', () => {
    const result = reanalyzeQuestionSchema.safeParse({
      detailId: 'detail-001',
      feedback: 'a'.repeat(500),
    })
    expect(result.success).toBe(true)
  })

  it('feedback undefined를 허용한다 (optional)', () => {
    const result = reanalyzeQuestionSchema.safeParse({
      detailId: 'detail-001',
      feedback: undefined,
    })
    expect(result.success).toBe(true)
  })
})
