/**
 * 난이도 매핑 함수 테스트
 *
 * AI 프롬프트에서는 'easy'/'medium'/'hard' 문자열을 사용하지만,
 * DB 스키마에서는 정수(2/3/4)를 사용한다.
 * 두 함수가 이 불일치를 안전하게 변환하는지 검증한다.
 */

import { describe, it, expect } from 'vitest'
import { toDifficultyNumber, fromDifficultyNumber } from '../types'
import type { DifficultyLevel } from '../types'

describe('toDifficultyNumber', () => {
  it("'easy'를 2로 변환한다", () => {
    expect(toDifficultyNumber('easy')).toBe(2)
  })

  it("'medium'을 3으로 변환한다", () => {
    expect(toDifficultyNumber('medium')).toBe(3)
  })

  it("'hard'를 4로 변환한다", () => {
    expect(toDifficultyNumber('hard')).toBe(4)
  })
})

describe('fromDifficultyNumber', () => {
  it('2를 easy로 변환한다', () => {
    expect(fromDifficultyNumber(2)).toBe('easy')
  })

  it('3을 medium으로 변환한다', () => {
    expect(fromDifficultyNumber(3)).toBe('medium')
  })

  it('4를 hard로 변환한다', () => {
    expect(fromDifficultyNumber(4)).toBe('hard')
  })

  it('매핑에 없는 숫자(1)는 medium을 반환한다 (기본값)', () => {
    expect(fromDifficultyNumber(1)).toBe('medium')
  })

  it('매핑에 없는 숫자(5)는 medium을 반환한다 (기본값)', () => {
    expect(fromDifficultyNumber(5)).toBe('medium')
  })
})

describe('DifficultyLevel 타입 호환성', () => {
  it('DifficultyLevel 유니온 타입의 모든 값에 대해 toDifficultyNumber가 고유한 정수를 반환한다', () => {
    const levels: DifficultyLevel[] = ['easy', 'medium', 'hard']
    const numbers = levels.map(toDifficultyNumber)

    // 중복 없이 3개가 반환되어야 한다
    const uniqueNumbers = new Set(numbers)
    expect(uniqueNumbers.size).toBe(3)
  })

  it('양방향 변환: AI → DB → AI 변환이 원래 값을 반환한다', () => {
    const levels: DifficultyLevel[] = ['easy', 'medium', 'hard']
    levels.forEach((level) => {
      const num = toDifficultyNumber(level)
      const backToLevel = fromDifficultyNumber(num)
      expect(backToLevel).toBe(level)
    })
  })
})
