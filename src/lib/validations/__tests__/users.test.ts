import { describe, it, expect } from 'vitest'
import {
  userFilterSchema,
  roleChangeSchema,
  toggleActiveSchema,
} from '../users'

describe('userFilterSchema', () => {
  describe('기본값 적용', () => {
    it('빈 객체면 기본값 적용 (role=all, isActive=all, page=1)', () => {
      const result = userFilterSchema.parse({})
      expect(result.role).toBe('all')
      expect(result.isActive).toBe('all')
      expect(result.page).toBe(1)
      expect(result.search).toBeUndefined()
    })
  })

  describe('search 필터', () => {
    it('검색어 적용', () => {
      const result = userFilterSchema.parse({ search: '김철수' })
      expect(result.search).toBe('김철수')
    })

    it('빈 문자열 허용', () => {
      const result = userFilterSchema.parse({ search: '' })
      expect(result.search).toBe('')
    })
  })

  describe('role 필터', () => {
    it.each(['student', 'teacher', 'admin', 'all'] as const)(
      'role=%s 허용',
      (role) => {
        const result = userFilterSchema.parse({ role })
        expect(result.role).toBe(role)
      }
    )

    it('유효하지 않은 역할이면 실패', () => {
      const result = userFilterSchema.safeParse({ role: 'superuser' })
      expect(result.success).toBe(false)
    })

    it('system_admin은 필터 옵션에 없으므로 실패', () => {
      const result = userFilterSchema.safeParse({ role: 'system_admin' })
      expect(result.success).toBe(false)
    })
  })

  describe('isActive 필터', () => {
    it.each(['true', 'false', 'all'] as const)(
      'isActive=%s 허용',
      (isActive) => {
        const result = userFilterSchema.parse({ isActive })
        expect(result.isActive).toBe(isActive)
      }
    )

    it('유효하지 않은 값이면 실패', () => {
      const result = userFilterSchema.safeParse({ isActive: 'yes' })
      expect(result.success).toBe(false)
    })
  })

  describe('page 필터', () => {
    it('문자열 숫자를 숫자로 변환 (coerce)', () => {
      const result = userFilterSchema.parse({ page: '5' })
      expect(result.page).toBe(5)
      expect(typeof result.page).toBe('number')
    })

    it('숫자 그대로 통과', () => {
      const result = userFilterSchema.parse({ page: 3 })
      expect(result.page).toBe(3)
    })

    it('0 이하면 실패', () => {
      const result = userFilterSchema.safeParse({ page: 0 })
      expect(result.success).toBe(false)
    })

    it('음수면 실패', () => {
      const result = userFilterSchema.safeParse({ page: -1 })
      expect(result.success).toBe(false)
    })

    it('소수점이면 실패 (정수만 허용)', () => {
      const result = userFilterSchema.safeParse({ page: 1.5 })
      expect(result.success).toBe(false)
    })
  })

  describe('모든 필터 동시 적용', () => {
    it('전체 필터 조합', () => {
      const result = userFilterSchema.parse({
        search: '김',
        role: 'teacher',
        isActive: 'true',
        page: '2',
      })
      expect(result.search).toBe('김')
      expect(result.role).toBe('teacher')
      expect(result.isActive).toBe('true')
      expect(result.page).toBe(2)
    })
  })

  describe('악의적 입력 방어', () => {
    it('스키마에 없는 필드는 제거됨 (strip)', () => {
      const input = {
        search: '김',
        academy_id: 'hacked-id',
        is_admin: true,
      }
      const result = userFilterSchema.parse(input)
      expect(result).not.toHaveProperty('academy_id')
      expect(result).not.toHaveProperty('is_admin')
      expect(result.search).toBe('김')
    })
  })
})

describe('roleChangeSchema', () => {
  describe('유효한 입력값', () => {
    it.each(['student', 'teacher', 'admin'] as const)(
      'newRole=%s 허용',
      (newRole) => {
        const valid = {
          userId: '123e4567-e89b-12d3-a456-426614174000',
          newRole,
        }
        const result = roleChangeSchema.safeParse(valid)
        expect(result.success).toBe(true)
      }
    )
  })

  describe('userId 검증', () => {
    it('유효한 UUID 통과', () => {
      const result = roleChangeSchema.safeParse({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        newRole: 'teacher',
      })
      expect(result.success).toBe(true)
    })

    it('잘못된 UUID 형식이면 실패', () => {
      const result = roleChangeSchema.safeParse({
        userId: 'not-a-uuid',
        newRole: 'teacher',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          '올바른 사용자 ID가 아닙니다.'
        )
      }
    })

    it('빈 문자열이면 실패', () => {
      const result = roleChangeSchema.safeParse({
        userId: '',
        newRole: 'teacher',
      })
      expect(result.success).toBe(false)
    })

    it('userId 없으면 실패', () => {
      const result = roleChangeSchema.safeParse({
        newRole: 'teacher',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('newRole 검증', () => {
    it('system_admin으로의 변경은 스키마 레벨에서 차단', () => {
      const result = roleChangeSchema.safeParse({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        newRole: 'system_admin',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          '유효하지 않은 역할입니다.'
        )
      }
    })

    it('존재하지 않는 역할이면 실패', () => {
      const result = roleChangeSchema.safeParse({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        newRole: 'superuser',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          '유효하지 않은 역할입니다.'
        )
      }
    })

    it('newRole 없으면 실패', () => {
      const result = roleChangeSchema.safeParse({
        userId: '123e4567-e89b-12d3-a456-426614174000',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('악의적 입력 방어', () => {
    it('스키마에 없는 필드는 제거됨 (strip)', () => {
      const input = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        newRole: 'teacher' as const,
        academy_id: 'hacked-id',
        is_active: false,
      }
      const result = roleChangeSchema.parse(input)
      expect(result).not.toHaveProperty('academy_id')
      expect(result).not.toHaveProperty('is_active')
      expect(result.userId).toBe('123e4567-e89b-12d3-a456-426614174000')
      expect(result.newRole).toBe('teacher')
    })
  })
})

describe('toggleActiveSchema', () => {
  describe('유효한 입력값', () => {
    it('비활성화 (isActive=false)', () => {
      const result = toggleActiveSchema.safeParse({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        isActive: false,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isActive).toBe(false)
      }
    })

    it('활성화 (isActive=true)', () => {
      const result = toggleActiveSchema.safeParse({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        isActive: true,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isActive).toBe(true)
      }
    })
  })

  describe('userId 검증', () => {
    it('잘못된 UUID 형식이면 실패', () => {
      const result = toggleActiveSchema.safeParse({
        userId: 'invalid',
        isActive: true,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          '올바른 사용자 ID가 아닙니다.'
        )
      }
    })
  })

  describe('isActive 검증', () => {
    it('boolean이 아닌 값이면 실패', () => {
      const result = toggleActiveSchema.safeParse({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        isActive: 'true',
      })
      expect(result.success).toBe(false)
    })

    it('isActive 없으면 실패', () => {
      const result = toggleActiveSchema.safeParse({
        userId: '123e4567-e89b-12d3-a456-426614174000',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('악의적 입력 방어', () => {
    it('스키마에 없는 필드는 제거됨 (strip)', () => {
      const input = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        isActive: false,
        role: 'system_admin',
        academy_id: 'hacked',
      }
      const result = toggleActiveSchema.parse(input)
      expect(result).not.toHaveProperty('role')
      expect(result).not.toHaveProperty('academy_id')
      expect(result.isActive).toBe(false)
    })
  })
})
