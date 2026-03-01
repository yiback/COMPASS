import { describe, expect, it } from 'vitest'
import {
  getGradeOptions,
  formatGradeLabel,
  isValidGradeForSchoolType,
  type SchoolType,
} from '../grade-filter-utils'

describe('getGradeOptions', () => {
  // 1. all: 1~12 전체 반환
  it('all이면 1~12 전체 12개를 반환한다', () => {
    const result = getGradeOptions('all')
    expect(result).toHaveLength(12)
    expect(result[0]).toBe(1)
    expect(result[11]).toBe(12)
  })

  // 2. elementary: 1~6
  it('elementary면 1~6 총 6개를 반환한다', () => {
    const result = getGradeOptions('elementary')
    expect(result).toHaveLength(6)
    expect(result[0]).toBe(1)
    expect(result[5]).toBe(6)
  })

  // 3. middle: 7~9
  it('middle이면 7~9 총 3개를 반환한다', () => {
    const result = getGradeOptions('middle')
    expect(result).toHaveLength(3)
    expect(result[0]).toBe(7)
    expect(result[2]).toBe(9)
  })

  // 4. high: 10~12
  it('high면 10~12 총 3개를 반환한다', () => {
    const result = getGradeOptions('high')
    expect(result).toHaveLength(3)
    expect(result[0]).toBe(10)
    expect(result[2]).toBe(12)
  })
})

describe('formatGradeLabel', () => {
  // 5. 초등 학년 레이블
  it('1학년을 "초1"로 반환한다', () => {
    expect(formatGradeLabel(1)).toBe('초1')
  })

  it('6학년을 "초6"으로 반환한다', () => {
    expect(formatGradeLabel(6)).toBe('초6')
  })

  // 6. 중학 학년 레이블 (7→중1, 8→중2, 9→중3)
  it('7학년을 "중1"로 반환한다', () => {
    expect(formatGradeLabel(7)).toBe('중1')
  })

  it('9학년을 "중3"으로 반환한다', () => {
    expect(formatGradeLabel(9)).toBe('중3')
  })

  // 7. 고등 학년 레이블 (10→고1, 11→고2, 12→고3)
  it('10학년을 "고1"로 반환한다', () => {
    expect(formatGradeLabel(10)).toBe('고1')
  })

  it('12학년을 "고3"으로 반환한다', () => {
    expect(formatGradeLabel(12)).toBe('고3')
  })
})

describe('isValidGradeForSchoolType', () => {
  // 8. all: 모든 학년 유효
  it('all이면 어떤 학년도 유효하다', () => {
    expect(isValidGradeForSchoolType(1, 'all')).toBe(true)
    expect(isValidGradeForSchoolType(12, 'all')).toBe(true)
  })

  // 9. elementary 경계값
  it('elementary에서 1은 유효하다', () => {
    expect(isValidGradeForSchoolType(1, 'elementary')).toBe(true)
  })

  it('elementary에서 6은 유효하다', () => {
    expect(isValidGradeForSchoolType(6, 'elementary')).toBe(true)
  })

  it('elementary에서 7은 유효하지 않다', () => {
    expect(isValidGradeForSchoolType(7, 'elementary')).toBe(false)
  })

  // 10. middle 경계값
  it('middle에서 7은 유효하다', () => {
    expect(isValidGradeForSchoolType(7, 'middle')).toBe(true)
  })

  it('middle에서 6은 유효하지 않다', () => {
    expect(isValidGradeForSchoolType(6, 'middle')).toBe(false)
  })

  it('middle에서 10은 유효하지 않다', () => {
    expect(isValidGradeForSchoolType(10, 'middle')).toBe(false)
  })

  // 11. high 경계값
  it('high에서 10은 유효하다', () => {
    expect(isValidGradeForSchoolType(10, 'high')).toBe(true)
  })

  it('high에서 9는 유효하지 않다', () => {
    expect(isValidGradeForSchoolType(9, 'high')).toBe(false)
  })

  it('high에서 12는 유효하다', () => {
    expect(isValidGradeForSchoolType(12, 'high')).toBe(true)
  })
})

// SchoolType이 타입으로 export되는지 확인 (타입 테스트)
type _SchoolTypeCheck = SchoolType extends 'elementary' | 'middle' | 'high' ? true : false
