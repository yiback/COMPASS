/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * users.ts Server Actions 테스트
 *
 * 테스트 대상:
 * - getUserList(): 같은 학원 사용자 목록 조회 (8개 테스트)
 * - changeUserRole(): 역할 변경 (14개 테스트)
 * - toggleUserActive(): 활성화/비활성화 (6개 테스트)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getUserList, changeUserRole, toggleUserActive } from '../users'

// ============================================================================
// Mock Setup
// ============================================================================

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// ============================================================================
// Mock 헬퍼 함수
// ============================================================================

/**
 * 인증 실패 Mock
 */
function mockAuthFailed() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'Not authenticated' },
  } as any)
}

/**
 * 역할별 인증 성공 Mock (id 포함)
 */
function mockAuthAs(role: string, id = '11111111-1111-4111-8111-111111111111', academyId = 'academy-1') {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id } },
    error: null,
  } as any)

  const profileQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id, role, academy_id: academyId },
      error: null,
    }),
  }

  return profileQuery
}

/**
 * 대상 사용자 조회 결과 Mock
 */
function mockTargetUser(overrides: any = {}) {
  const defaultUser = {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'target@example.com',
    name: '대상사용자',
    role: 'student',
    is_active: true,
    avatar_url: null,
    phone: null,
    created_at: '2024-01-01T00:00:00Z',
  }

  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { ...defaultUser, ...overrides },
      error: null,
    }),
  }
}

/**
 * UPDATE 결과 Mock
 */
function mockUpdateResult(overrides: any = {}) {
  const defaultUser = {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'target@example.com',
    name: '대상사용자',
    role: 'teacher',
    is_active: true,
    avatar_url: null,
    phone: null,
    created_at: '2024-01-01T00:00:00Z',
  }

  return {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { ...defaultUser, ...overrides },
      error: null,
    }),
  }
}

/**
 * 사용자 목록 조회 결과 Mock (Fluent API 체인)
 */
function mockUserListQuery(users: any[], count: number) {
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((resolve) =>
      resolve({ data: users, error: null, count })
    ),
  }
}

// ============================================================================
// getUserList 테스트
// ============================================================================

describe('getUserList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('인증/권한', () => {
    it('인증 안 됨 → 에러', async () => {
      mockAuthFailed()

      const result = await getUserList()

      expect(result.error).toBe('인증이 필요합니다.')
      expect(result.data).toBeUndefined()
    })

    it('student 접근 → 에러', async () => {
      const profileQuery = mockAuthAs('student')
      mockSupabaseClient.from.mockReturnValueOnce(profileQuery)

      const result = await getUserList()

      expect(result.error).toBe('권한이 없습니다.')
      expect(result.data).toBeUndefined()
    })

    it('teacher 접근 → 성공', async () => {
      const profileQuery = mockAuthAs('teacher')
      const listQuery = mockUserListQuery(
        [
          {
            id: 'user-1',
            email: 'user1@example.com',
            name: '사용자1',
            role: 'student',
            is_active: true,
            avatar_url: null,
            phone: null,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        1
      )

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(listQuery)

      const result = await getUserList()

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(Array.isArray(result.data)).toBe(true)
    })
  })

  describe('정상 조회', () => {
    it('기본 필터로 목록 반환 (meta 포함)', async () => {
      const profileQuery = mockAuthAs('admin')
      const listQuery = mockUserListQuery(
        [
          {
            id: 'user-1',
            email: 'user1@example.com',
            name: '사용자1',
            role: 'student',
            is_active: true,
            avatar_url: null,
            phone: null,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        50
      )

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(listQuery)

      const result = await getUserList()

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(result.meta).toEqual({
        total: 50,
        page: 1,
        pageSize: 10,
      })
    })

    it('검색 필터: name 또는 email', async () => {
      const profileQuery = mockAuthAs('admin')
      const listQuery = mockUserListQuery([], 0)

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(listQuery)

      await getUserList({ search: '김' })

      // or() 메서드 호출 확인
      expect(listQuery.or).toHaveBeenCalledWith(
        'name.ilike.%김%,email.ilike.%김%'
      )
    })

    it('역할 필터: role=teacher', async () => {
      const profileQuery = mockAuthAs('admin')
      const listQuery = mockUserListQuery([], 0)

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(listQuery)

      await getUserList({ role: 'teacher' })

      // eq('role', 'teacher') 호출 확인
      expect(listQuery.eq).toHaveBeenCalledWith('role', 'teacher')
    })

    it('활성 상태 필터: isActive=false', async () => {
      const profileQuery = mockAuthAs('admin')
      const listQuery = mockUserListQuery([], 0)

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(listQuery)

      await getUserList({ isActive: 'false' })

      // eq('is_active', false) 호출 확인
      expect(listQuery.eq).toHaveBeenCalledWith('is_active', false)
    })

    it('페이지네이션: page=2', async () => {
      const profileQuery = mockAuthAs('admin')
      const listQuery = mockUserListQuery([], 0)

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(listQuery)

      await getUserList({ page: 2 })

      // range(10, 19) 호출 확인 (2페이지)
      expect(listQuery.range).toHaveBeenCalledWith(10, 19)
    })
  })
})

// ============================================================================
// changeUserRole 테스트
// ============================================================================

describe('changeUserRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('입력 검증', () => {
    it('잘못된 UUID → Zod 에러', async () => {
      const result = await changeUserRole('invalid-uuid', 'teacher')

      expect(result.error).toBe('올바른 사용자 ID가 아닙니다.')
      expect(result.data).toBeUndefined()
    })

    it('system_admin으로 변경 시도 → Zod 에러', async () => {
      const result = await changeUserRole(
        '12345678-1234-4234-8234-123456789012',
        'system_admin' as any
      )

      expect(result.error).toBe('유효하지 않은 역할입니다.')
      expect(result.data).toBeUndefined()
    })
  })

  describe('인증/권한', () => {
    it('인증 안 됨 → 에러', async () => {
      mockAuthFailed()

      const result = await changeUserRole(
        '12345678-1234-4234-8234-123456789012',
        'teacher'
      )

      expect(result.error).toBe('인증이 필요합니다.')
      expect(result.data).toBeUndefined()
    })

    it('teacher 접근 → 에러', async () => {
      const profileQuery = mockAuthAs('teacher')
      mockSupabaseClient.from.mockReturnValueOnce(profileQuery)

      const result = await changeUserRole(
        '12345678-1234-4234-8234-123456789012',
        'teacher'
      )

      expect(result.error).toBe('권한이 없습니다.')
      expect(result.data).toBeUndefined()
    })
  })

  describe('admin 호출자', () => {
    it('admin이 student→teacher 변경 성공', async () => {
      const callerId = '11111111-1111-4111-8111-111111111111'
      const targetId = '22222222-2222-4222-8222-222222222222'
      const profileQuery = mockAuthAs('admin', callerId)
      const targetQuery = mockTargetUser({ id: targetId, role: 'student' })
      const updateQuery = mockUpdateResult({ role: 'teacher' })

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(targetQuery)
        .mockReturnValueOnce(updateQuery)

      const result = await changeUserRole(targetId, 'teacher')

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(result.data?.role).toBe('teacher')

      // revalidatePath 호출 확인
      const { revalidatePath } = await import('next/cache')
      expect(revalidatePath).toHaveBeenCalledWith('/admin/users')
    })

    it('admin이 teacher→student 변경 성공', async () => {
      const profileQuery = mockAuthAs('admin', '11111111-1111-4111-8111-111111111111')
      const targetQuery = mockTargetUser({ id: '22222222-2222-4222-8222-222222222222', role: 'teacher' })
      const updateQuery = mockUpdateResult({ role: 'student' })

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(targetQuery)
        .mockReturnValueOnce(updateQuery)

      const result = await changeUserRole('22222222-2222-4222-8222-222222222222', 'student')

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(result.data?.role).toBe('student')
    })

    it('admin이 student→admin 변경 시도 → 에러', async () => {
      const profileQuery = mockAuthAs('admin', '11111111-1111-4111-8111-111111111111')
      const targetQuery = mockTargetUser({ id: '22222222-2222-4222-8222-222222222222', role: 'student' })

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(targetQuery)

      const result = await changeUserRole('22222222-2222-4222-8222-222222222222', 'admin')

      expect(result.error).toBe('관리자 역할을 부여할 권한이 없습니다.')
      expect(result.data).toBeUndefined()
    })

    it('admin이 다른 admin 변경 시도 → 에러', async () => {
      const profileQuery = mockAuthAs('admin', '11111111-1111-4111-8111-111111111111')
      const targetQuery = mockTargetUser({ id: '22222222-2222-4222-8222-222222222222', role: 'admin' })

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(targetQuery)

      const result = await changeUserRole('22222222-2222-4222-8222-222222222222', 'student')

      expect(result.error).toBe('다른 관리자의 역할은 변경할 수 없습니다.')
      expect(result.data).toBeUndefined()
    })
  })

  describe('system_admin 호출자', () => {
    it('system_admin이 student→admin 변경 성공', async () => {
      const profileQuery = mockAuthAs('system_admin', '11111111-1111-4111-8111-111111111111')
      const targetQuery = mockTargetUser({ id: '22222222-2222-4222-8222-222222222222', role: 'student' })
      const updateQuery = mockUpdateResult({ role: 'admin' })

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(targetQuery)
        .mockReturnValueOnce(updateQuery)

      const result = await changeUserRole('22222222-2222-4222-8222-222222222222', 'admin')

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(result.data?.role).toBe('admin')
    })

    it('system_admin이 admin→student 변경 성공', async () => {
      const profileQuery = mockAuthAs('system_admin', '11111111-1111-4111-8111-111111111111')
      const targetQuery = mockTargetUser({ id: '22222222-2222-4222-8222-222222222222', role: 'admin' })
      const updateQuery = mockUpdateResult({ role: 'student' })

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(targetQuery)
        .mockReturnValueOnce(updateQuery)

      const result = await changeUserRole('22222222-2222-4222-8222-222222222222', 'student')

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(result.data?.role).toBe('student')
    })
  })

  describe('보안 규칙', () => {
    it('자기 자신 역할 변경 → 에러', async () => {
      const profileQuery = mockAuthAs('admin', '11111111-1111-4111-8111-111111111111')

      mockSupabaseClient.from.mockReturnValueOnce(profileQuery)

      const result = await changeUserRole('11111111-1111-4111-8111-111111111111', 'teacher')

      expect(result.error).toBe('자신의 역할은 변경할 수 없습니다.')
      expect(result.data).toBeUndefined()
    })

    it('대상이 system_admin → 변경 불가', async () => {
      const profileQuery = mockAuthAs('system_admin', '11111111-1111-4111-8111-111111111111')
      const targetQuery = mockTargetUser({
        id: '22222222-2222-4222-8222-222222222222',
        role: 'system_admin',
      })

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(targetQuery)

      const result = await changeUserRole('22222222-2222-4222-8222-222222222222', 'admin')

      expect(result.error).toBe('system_admin의 역할은 변경할 수 없습니다.')
      expect(result.data).toBeUndefined()
    })

    it('대상 사용자 없음 (다른 학원/미존재) → 에러', async () => {
      const profileQuery = mockAuthAs('admin', '11111111-1111-4111-8111-111111111111')
      const targetQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      }

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(targetQuery)

      const result = await changeUserRole('22222222-2222-4222-8222-222222222222', 'teacher')

      expect(result.error).toBe('사용자를 찾을 수 없습니다.')
      expect(result.data).toBeUndefined()
    })
  })

  describe('성공 후 처리', () => {
    it('revalidatePath(/admin/users) 호출 확인', async () => {
      const profileQuery = mockAuthAs('admin', '11111111-1111-4111-8111-111111111111')
      const targetQuery = mockTargetUser({ id: '22222222-2222-4222-8222-222222222222', role: 'student' })
      const updateQuery = mockUpdateResult({ role: 'teacher' })

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(targetQuery)
        .mockReturnValueOnce(updateQuery)

      await changeUserRole('22222222-2222-4222-8222-222222222222', 'teacher')

      const { revalidatePath } = await import('next/cache')
      expect(revalidatePath).toHaveBeenCalledWith('/admin/users')
    })
  })
})

// ============================================================================
// toggleUserActive 테스트
// ============================================================================

describe('toggleUserActive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('인증/권한', () => {
    it('인증 안 됨 → 에러', async () => {
      mockAuthFailed()

      const result = await toggleUserActive('22222222-2222-4222-8222-222222222222', false)

      expect(result.error).toBe('인증이 필요합니다.')
      expect(result.data).toBeUndefined()
    })
  })

  describe('정상 동작', () => {
    it('admin이 사용자 비활성화 성공', async () => {
      const profileQuery = mockAuthAs('admin', '11111111-1111-4111-8111-111111111111')
      const targetQuery = mockTargetUser({ id: '22222222-2222-4222-8222-222222222222', is_active: true })
      const updateQuery = mockUpdateResult({ is_active: false })

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(targetQuery)
        .mockReturnValueOnce(updateQuery)

      const result = await toggleUserActive('22222222-2222-4222-8222-222222222222', false)

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(result.data?.isActive).toBe(false)
    })

    it('admin이 사용자 활성화 성공', async () => {
      const profileQuery = mockAuthAs('admin', '11111111-1111-4111-8111-111111111111')
      const targetQuery = mockTargetUser({
        id: '22222222-2222-4222-8222-222222222222',
        is_active: false,
      })
      const updateQuery = mockUpdateResult({ is_active: true })

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(targetQuery)
        .mockReturnValueOnce(updateQuery)

      const result = await toggleUserActive('22222222-2222-4222-8222-222222222222', true)

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(result.data?.isActive).toBe(true)
    })
  })

  describe('보안 규칙', () => {
    it('자기 자신 비활성화 → 에러', async () => {
      const profileQuery = mockAuthAs('admin', '11111111-1111-4111-8111-111111111111')

      mockSupabaseClient.from.mockReturnValueOnce(profileQuery)

      const result = await toggleUserActive('11111111-1111-4111-8111-111111111111', false)

      expect(result.error).toBe('자신을 비활성화할 수 없습니다.')
      expect(result.data).toBeUndefined()
    })

    it('system_admin 비활성화 → 에러', async () => {
      const profileQuery = mockAuthAs('system_admin', '11111111-1111-4111-8111-111111111111')
      const targetQuery = mockTargetUser({
        id: '22222222-2222-4222-8222-222222222222',
        role: 'system_admin',
      })

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(targetQuery)

      const result = await toggleUserActive('22222222-2222-4222-8222-222222222222', false)

      expect(result.error).toBe('system_admin을 비활성화할 수 없습니다.')
      expect(result.data).toBeUndefined()
    })

    it('대상 없음 → 에러', async () => {
      const profileQuery = mockAuthAs('admin', '11111111-1111-4111-8111-111111111111')
      const targetQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      }

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(targetQuery)

      const result = await toggleUserActive('22222222-2222-4222-8222-222222222222', false)

      expect(result.error).toBe('사용자를 찾을 수 없습니다.')
      expect(result.data).toBeUndefined()
    })
  })
})
