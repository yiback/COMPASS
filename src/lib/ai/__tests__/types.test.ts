import { describe, it, expect } from 'vitest'
import { toDbQuestionType, fromDbQuestionType } from '../types'
import type { GenerateQuestionParams, PastExamContext } from '../types'

/**
 * QuestionType ↔ DbQuestionType 매핑 함수 테스트
 *
 * AI에서는 'essay'라는 용어가 더 명확하지만,
 * DB 스키마(이미 배포됨)에서는 'descriptive'를 사용한다.
 * 두 함수가 이 불일치를 안전하게 변환하는지 검증한다.
 */
describe('toDbQuestionType', () => {
  it('multiple_choice는 그대로 반환한다', () => {
    expect(toDbQuestionType('multiple_choice')).toBe('multiple_choice')
  })

  it('short_answer는 그대로 반환한다', () => {
    expect(toDbQuestionType('short_answer')).toBe('short_answer')
  })

  it('essay를 descriptive로 변환한다', () => {
    expect(toDbQuestionType('essay')).toBe('descriptive')
  })
})

describe('fromDbQuestionType', () => {
  it('multiple_choice는 그대로 반환한다', () => {
    expect(fromDbQuestionType('multiple_choice')).toBe('multiple_choice')
  })

  it('short_answer는 그대로 반환한다', () => {
    expect(fromDbQuestionType('short_answer')).toBe('short_answer')
  })

  it('descriptive를 essay로 변환한다', () => {
    expect(fromDbQuestionType('descriptive')).toBe('essay')
  })
})

describe('QuestionType 양방향 변환 정합성', () => {
  it('AI → DB → AI 변환이 원래 값을 반환한다', () => {
    const aiTypes = ['multiple_choice', 'short_answer', 'essay'] as const

    aiTypes.forEach((aiType) => {
      const dbType = toDbQuestionType(aiType)
      const backToAi = fromDbQuestionType(dbType)
      expect(backToAi).toBe(aiType)
    })
  })

  it('DB → AI → DB 변환이 원래 값을 반환한다', () => {
    const dbTypes = ['multiple_choice', 'short_answer', 'descriptive'] as const

    dbTypes.forEach((dbType) => {
      const aiType = fromDbQuestionType(dbType)
      const backToDb = toDbQuestionType(aiType)
      expect(backToDb).toBe(dbType)
    })
  })
})

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
