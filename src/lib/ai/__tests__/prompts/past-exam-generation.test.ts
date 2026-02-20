/**
 * 기출문제 기반 프롬프트 빌더 테스트
 *
 * buildPastExamGenerationPrompt()가 GenerateQuestionParams(pastExamContext 포함)를 받아
 * 기출문제 참고 문제 생성용 PromptConfig를 올바르게 생성하는지 검증한다.
 */

import { describe, it, expect } from 'vitest'
import { buildPastExamGenerationPrompt } from '../../prompts/past-exam-generation'
import { questionsJsonSchema } from '../../validation'
import type { GenerateQuestionParams } from '../../types'

// ─── 테스트 팩토리 ─────────────────────────────────────────

/** 기본 테스트 파라미터 생성 (pastExamContext 기본 포함) */
function createTestParams(
  overrides?: Partial<GenerateQuestionParams>,
): GenerateQuestionParams {
  return {
    subject: '수학',
    grade: 2,
    questionType: 'multiple_choice',
    count: 5,
    difficulty: 'medium',
    pastExamContext: {
      pastExamId: '550e8400-e29b-41d4-a716-446655440000',
      schoolName: '한국중학교',
      year: 2025,
      semester: 1,
      examType: 'midterm',
    },
    ...overrides,
  }
}

// ─── 테스트 ────────────────────────────────────────────────

describe('buildPastExamGenerationPrompt', () => {
  describe('반환 형식', () => {
    it('PromptConfig의 5개 필드를 모두 포함해야 한다', () => {
      const result = buildPastExamGenerationPrompt(createTestParams())

      expect(result).toHaveProperty('systemInstruction')
      expect(result).toHaveProperty('userPrompt')
      expect(result).toHaveProperty('responseSchema')
      expect(result).toHaveProperty('temperature')
      expect(result).toHaveProperty('maxOutputTokens')
    })
  })

  describe('systemInstruction', () => {
    it('기출문제 분석 전문가 역할 정의를 포함해야 한다', () => {
      const result = buildPastExamGenerationPrompt(createTestParams())

      expect(result.systemInstruction).toContain('기출문제 분석')
    })

    it('LaTeX 수식 사용 지시를 포함해야 한다', () => {
      const result = buildPastExamGenerationPrompt(createTestParams())

      expect(result.systemInstruction).toContain('LaTeX')
    })

    it('유사 키워드를 포함해야 한다', () => {
      const result = buildPastExamGenerationPrompt(createTestParams())

      expect(result.systemInstruction).toContain('유사')
    })

    it('출제 경향 반영 지시를 포함해야 한다', () => {
      const result = buildPastExamGenerationPrompt(createTestParams())

      expect(result.systemInstruction).toContain('출제 경향')
    })
  })

  describe('userPrompt - 기출 컨텍스트', () => {
    it('pastExamContext가 있으면 학교명을 포함해야 한다', () => {
      const result = buildPastExamGenerationPrompt(createTestParams())

      expect(result.userPrompt).toContain('한국중학교')
    })

    it('pastExamContext가 있으면 연도/학기를 포함해야 한다', () => {
      const result = buildPastExamGenerationPrompt(createTestParams())

      expect(result.userPrompt).toContain('2025')
      expect(result.userPrompt).toContain('1학기')
    })

    it('pastExamContext가 있으면 시험유형을 한글로 포함해야 한다', () => {
      const result = buildPastExamGenerationPrompt(createTestParams())

      expect(result.userPrompt).toContain('중간고사')
    })

    it('extractedContent가 있으면 기출 내용을 포함해야 한다', () => {
      const result = buildPastExamGenerationPrompt(
        createTestParams({
          pastExamContext: {
            pastExamId: '550e8400-e29b-41d4-a716-446655440000',
            schoolName: '한국중학교',
            year: 2025,
            semester: 1,
            examType: 'midterm',
            extractedContent: '1. 다음 이차방정식을 풀어라. x² + 3x - 4 = 0',
          },
        }),
      )

      expect(result.userPrompt).toContain('기출문제 내용')
      expect(result.userPrompt).toContain('x² + 3x - 4 = 0')
    })

    it('extractedContent가 없으면 메타데이터 기반 안내 메시지를 포함해야 한다', () => {
      const result = buildPastExamGenerationPrompt(createTestParams())

      expect(result.userPrompt).toContain('원본 내용이 없')
    })
  })

  describe('userPrompt - 생성 조건', () => {
    it('과목/학년/문제유형/난이도/문제수를 포함해야 한다', () => {
      const result = buildPastExamGenerationPrompt(createTestParams())

      expect(result.userPrompt).toContain('수학')
      expect(result.userPrompt).toContain('2')
      expect(result.userPrompt).toContain('객관식')
      expect(result.userPrompt).toContain('medium')
      expect(result.userPrompt).toContain('5')
    })

    it('unit이 있으면 포함, topics가 있으면 포함해야 한다', () => {
      const result = buildPastExamGenerationPrompt(
        createTestParams({
          unit: '이차방정식',
          topics: ['근의 공식', '판별식'],
        }),
      )

      expect(result.userPrompt).toContain('이차방정식')
      expect(result.userPrompt).toContain('근의 공식')
    })
  })

  describe('기본값', () => {
    it('temperature는 0.8이어야 한다', () => {
      const result = buildPastExamGenerationPrompt(createTestParams())

      expect(result.temperature).toBe(0.8)
    })

    it('responseSchema는 questionsJsonSchema와 같아야 한다', () => {
      const result = buildPastExamGenerationPrompt(createTestParams())

      expect(result.responseSchema).toBe(questionsJsonSchema)
    })
  })
})
