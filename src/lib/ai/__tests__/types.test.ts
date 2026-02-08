import { describe, it, expect } from 'vitest'
import { toDbQuestionType, fromDbQuestionType } from '../types'

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
