/**
 * 문제 생성 프롬프트 빌더 테스트
 *
 * buildQuestionGenerationPrompt()가 GenerateQuestionParams를 받아
 * Gemini API에 전달할 PromptConfig를 올바르게 생성하는지 검증한다.
 */

import { describe, it, expect } from 'vitest'
import { buildQuestionGenerationPrompt } from '../../prompts/question-generation'
import { questionsJsonSchema } from '../../validation'
import type { GenerateQuestionParams } from '../../types'

// ─── 테스트 팩토리 ─────────────────────────────────────────

/** 기본 테스트 파라미터 생성 (오버라이드 가능) */
function createTestParams(
  overrides?: Partial<GenerateQuestionParams>,
): GenerateQuestionParams {
  return {
    subject: '수학',
    grade: 2,
    questionType: 'multiple_choice',
    count: 5,
    difficulty: 'medium',
    ...overrides,
  }
}

// ─── 테스트 ────────────────────────────────────────────────

describe('buildQuestionGenerationPrompt', () => {
  describe('반환 형식', () => {
    it('PromptConfig의 5개 필드를 모두 포함해야 한다', () => {
      const result = buildQuestionGenerationPrompt(createTestParams())

      expect(result).toHaveProperty('systemInstruction')
      expect(result).toHaveProperty('userPrompt')
      expect(result).toHaveProperty('responseSchema')
      expect(result).toHaveProperty('temperature')
      expect(result).toHaveProperty('maxOutputTokens')
    })
  })

  describe('systemInstruction', () => {
    it('시험 출제 전문가 역할 정의를 포함해야 한다', () => {
      const result = buildQuestionGenerationPrompt(createTestParams())

      expect(result.systemInstruction).toContain('시험 출제 전문가')
    })

    it('LaTeX 수식 사용 지시를 포함해야 한다', () => {
      const result = buildQuestionGenerationPrompt(createTestParams())

      expect(result.systemInstruction).toContain('LaTeX')
    })

    it('그래프 대체 지시를 포함해야 한다', () => {
      const result = buildQuestionGenerationPrompt(createTestParams())

      expect(result.systemInstruction).toContain('그래프')
    })
  })

  describe('userPrompt - 필수 파라미터', () => {
    it('과목(subject)을 포함해야 한다', () => {
      const result = buildQuestionGenerationPrompt(
        createTestParams({ subject: '영어' }),
      )

      expect(result.userPrompt).toContain('영어')
    })

    it('학년(grade)을 포함해야 한다', () => {
      const result = buildQuestionGenerationPrompt(
        createTestParams({ grade: 3 }),
      )

      expect(result.userPrompt).toContain('3')
    })

    it('문제 수(count)를 포함해야 한다', () => {
      const result = buildQuestionGenerationPrompt(
        createTestParams({ count: 10 }),
      )

      expect(result.userPrompt).toContain('10')
    })

    it('난이도(difficulty)를 포함해야 한다', () => {
      const result = buildQuestionGenerationPrompt(
        createTestParams({ difficulty: 'hard' }),
      )

      expect(result.userPrompt).toContain('hard')
    })

    it('questionType을 한글로 변환하여 포함해야 한다', () => {
      const multipleChoice = buildQuestionGenerationPrompt(
        createTestParams({ questionType: 'multiple_choice' }),
      )
      expect(multipleChoice.userPrompt).toContain('객관식')

      const shortAnswer = buildQuestionGenerationPrompt(
        createTestParams({ questionType: 'short_answer' }),
      )
      expect(shortAnswer.userPrompt).toContain('단답형')

      const essay = buildQuestionGenerationPrompt(
        createTestParams({ questionType: 'essay' }),
      )
      expect(essay.userPrompt).toContain('서술형')
    })
  })

  describe('userPrompt - 옵셔널 파라미터', () => {
    it('unit이 있으면 userPrompt에 포함해야 한다', () => {
      const result = buildQuestionGenerationPrompt(
        createTestParams({ unit: '이차방정식' }),
      )

      expect(result.userPrompt).toContain('이차방정식')
    })

    it('unit이 없어도 정상 동작해야 한다', () => {
      const result = buildQuestionGenerationPrompt(createTestParams())

      expect(result.userPrompt).toBeDefined()
      expect(result.userPrompt.length).toBeGreaterThan(0)
    })

    it('topics가 있으면 userPrompt에 포함해야 한다', () => {
      const result = buildQuestionGenerationPrompt(
        createTestParams({ topics: ['근의 공식', '판별식'] }),
      )

      expect(result.userPrompt).toContain('근의 공식')
      expect(result.userPrompt).toContain('판별식')
    })

    it('schoolName이 있으면 userPrompt에 포함해야 한다', () => {
      const result = buildQuestionGenerationPrompt(
        createTestParams({ schoolName: '서울중학교' }),
      )

      expect(result.userPrompt).toContain('서울중학교')
    })
  })

  describe('기본값', () => {
    it('responseSchema는 questionsJsonSchema와 같아야 한다', () => {
      const result = buildQuestionGenerationPrompt(createTestParams())

      expect(result.responseSchema).toBe(questionsJsonSchema)
    })

    it('temperature는 0.7이어야 한다', () => {
      const result = buildQuestionGenerationPrompt(createTestParams())

      expect(result.temperature).toBe(0.7)
    })

    it('maxOutputTokens는 4096이어야 한다', () => {
      const result = buildQuestionGenerationPrompt(createTestParams())

      expect(result.maxOutputTokens).toBe(4096)
    })
  })
})
