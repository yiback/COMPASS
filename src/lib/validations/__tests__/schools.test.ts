import { describe, it, expect } from 'vitest'
import {
  schoolSchema,
  updateSchoolSchema,
  schoolFilterSchema,
} from '../schools'

describe('schoolSchema', () => {
  describe('유효한 입력값', () => {
    it('필수 필드만 있는 경우', () => {
      const valid = {
        name: '서울고등학교',
        schoolType: 'high' as const,
      }
      const result = schoolSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('모든 필드가 있는 경우', () => {
      const valid = {
        name: '서울고등학교',
        schoolType: 'high' as const,
        region: '서울',
        district: '강남구',
        address: '서울시 강남구 테헤란로 123',
      }
      const result = schoolSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('optional 필드가 빈 문자열인 경우', () => {
      const valid = {
        name: '학교',
        schoolType: 'middle' as const,
        region: '',
        district: '',
        address: '',
      }
      const result = schoolSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })
  })

  describe('name 필드 검증', () => {
    it('name이 빈 문자열이면 실패', () => {
      const invalid = {
        name: '',
        schoolType: 'high' as const,
      }
      const result = schoolSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('학교명을 입력해주세요.')
      }
    })

    it('name이 100자 초과하면 실패', () => {
      const invalid = {
        name: 'a'.repeat(101),
        schoolType: 'high' as const,
      }
      const result = schoolSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          '학교명은 100자 이하여야 합니다.'
        )
      }
    })

    it('name이 정확히 100자면 성공', () => {
      const valid = {
        name: 'a'.repeat(100),
        schoolType: 'high' as const,
      }
      const result = schoolSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })
  })

  describe('schoolType 필드 검증', () => {
    it('elementary는 허용', () => {
      const valid = {
        name: '초등학교',
        schoolType: 'elementary' as const,
      }
      const result = schoolSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('middle은 허용', () => {
      const valid = {
        name: '중학교',
        schoolType: 'middle' as const,
      }
      const result = schoolSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('high는 허용', () => {
      const valid = {
        name: '고등학교',
        schoolType: 'high' as const,
      }
      const result = schoolSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('잘못된 값이면 실패', () => {
      const invalid = {
        name: '학교',
        schoolType: 'university',
      }
      const result = schoolSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('학교 유형을 선택해주세요.')
      }
    })

    it('schoolType이 없으면 실패', () => {
      const invalid = {
        name: '학교',
      }
      const result = schoolSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('optional 필드 길이 제한', () => {
    it('region이 50자 초과하면 실패', () => {
      const invalid = {
        name: '학교',
        schoolType: 'high' as const,
        region: 'a'.repeat(51),
      }
      const result = schoolSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('지역은 50자 이하여야 합니다.')
      }
    })

    it('district가 50자 초과하면 실패', () => {
      const invalid = {
        name: '학교',
        schoolType: 'high' as const,
        district: 'a'.repeat(51),
      }
      const result = schoolSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('구/군은 50자 이하여야 합니다.')
      }
    })

    it('address가 200자 초과하면 실패', () => {
      const invalid = {
        name: '학교',
        schoolType: 'high' as const,
        address: 'a'.repeat(201),
      }
      const result = schoolSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('주소는 200자 이하여야 합니다.')
      }
    })
  })
})

describe('updateSchoolSchema', () => {
  it('유효한 UUID와 학교 정보', () => {
    const valid = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: '학교',
      schoolType: 'high' as const,
    }
    const result = updateSchoolSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('잘못된 UUID 형식이면 실패', () => {
    const invalid = {
      id: 'not-a-uuid',
      name: '학교',
      schoolType: 'high' as const,
    }
    const result = updateSchoolSchema.safeParse(invalid)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('올바른 ID 형식이 아닙니다.')
    }
  })

  it('id가 없으면 실패', () => {
    const invalid = {
      name: '학교',
      schoolType: 'high' as const,
    }
    const result = updateSchoolSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})

describe('schoolFilterSchema', () => {
  it('빈 객체면 기본값 적용 (schoolType=all, page=1)', () => {
    const result = schoolFilterSchema.parse({})
    expect(result.schoolType).toBe('all')
    expect(result.page).toBe(1)
    expect(result.search).toBeUndefined()
  })

  it('search 필터 적용', () => {
    const result = schoolFilterSchema.parse({ search: '서울' })
    expect(result.search).toBe('서울')
  })

  it('schoolType 필터 적용', () => {
    const result = schoolFilterSchema.parse({ schoolType: 'high' })
    expect(result.schoolType).toBe('high')
  })

  it('page 숫자 변환 (coerce)', () => {
    const result = schoolFilterSchema.parse({ page: '5' })
    expect(result.page).toBe(5)
    expect(typeof result.page).toBe('number')
  })

  it('page가 문자열 숫자면 변환 성공', () => {
    const result = schoolFilterSchema.parse({ page: '10' })
    expect(result.page).toBe(10)
  })

  it('page가 0 이하면 실패', () => {
    const result = schoolFilterSchema.safeParse({ page: 0 })
    expect(result.success).toBe(false)
  })

  it('page가 음수면 실패', () => {
    const result = schoolFilterSchema.safeParse({ page: -1 })
    expect(result.success).toBe(false)
  })

  it('모든 필터 동시 적용', () => {
    const result = schoolFilterSchema.parse({
      search: '서울',
      schoolType: 'middle',
      page: '3',
    })
    expect(result.search).toBe('서울')
    expect(result.schoolType).toBe('middle')
    expect(result.page).toBe(3)
  })
})
