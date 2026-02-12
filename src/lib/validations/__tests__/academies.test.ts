import { describe, it, expect } from 'vitest'
import { academyUpdateSchema } from '../academies'

describe('academyUpdateSchema', () => {
  describe('유효한 입력값', () => {
    it('필수 필드만 있는 경우', () => {
      const valid = {
        name: '서울학원',
      }
      const result = academyUpdateSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('모든 필드가 있는 경우', () => {
      const valid = {
        name: '서울학원',
        address: '서울시 강남구 테헤란로 123',
        phone: '02-1234-5678',
        logoUrl: 'https://example.com/logo.png',
      }
      const result = academyUpdateSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('선택 필드가 빈 문자열인 경우', () => {
      const valid = {
        name: '학원',
        address: '',
        phone: '',
        logoUrl: '',
      }
      const result = academyUpdateSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })
  })

  describe('name 필드 검증', () => {
    it('빈 문자열이면 실패', () => {
      const invalid = {
        name: '',
      }
      const result = academyUpdateSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('학원명을 입력해주세요.')
      }
    })

    it('100자 초과하면 실패', () => {
      const invalid = {
        name: 'a'.repeat(101),
      }
      const result = academyUpdateSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          '학원명은 100자 이하여야 합니다.'
        )
      }
    })

    it('정확히 100자면 성공', () => {
      const valid = {
        name: 'a'.repeat(100),
      }
      const result = academyUpdateSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })
  })

  describe('address 필드 검증', () => {
    it('200자 초과하면 실패', () => {
      const invalid = {
        name: '학원',
        address: 'a'.repeat(201),
      }
      const result = academyUpdateSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('주소는 200자 이하여야 합니다.')
      }
    })

    it('빈 문자열 허용', () => {
      const valid = {
        name: '학원',
        address: '',
      }
      const result = academyUpdateSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })
  })

  describe('phone 필드 검증', () => {
    it('20자 초과하면 실패', () => {
      const invalid = {
        name: '학원',
        phone: 'a'.repeat(21),
      }
      const result = academyUpdateSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          '전화번호는 20자 이하여야 합니다.'
        )
      }
    })

    it('빈 문자열 허용', () => {
      const valid = {
        name: '학원',
        phone: '',
      }
      const result = academyUpdateSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })
  })

  describe('logoUrl 필드 검증', () => {
    it('유효한 URL이면 성공', () => {
      const valid = {
        name: '학원',
        logoUrl: 'https://example.com/logo.png',
      }
      const result = academyUpdateSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('잘못된 URL이면 실패', () => {
      const invalid = {
        name: '학원',
        logoUrl: 'not-a-url',
      }
      const result = academyUpdateSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          '올바른 URL 형식이 아닙니다.'
        )
      }
    })

    it('빈 문자열 허용 (로고 미설정)', () => {
      const valid = {
        name: '학원',
        logoUrl: '',
      }
      const result = academyUpdateSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })
  })

  describe('수정 불가 필드 확인', () => {
    it('스키마에 없는 필드(inviteCode, settings)는 파싱 결과에서 제거됨', () => {
      const input = {
        name: '학원',
        inviteCode: 'HACK123', // 악의적 입력
        settings: { maxStudents: 999 }, // 악의적 입력
      }
      const result = academyUpdateSchema.parse(input)
      expect(result).not.toHaveProperty('inviteCode')
      expect(result).not.toHaveProperty('settings')
      expect(result).toHaveProperty('name', '학원')
    })
  })
})
