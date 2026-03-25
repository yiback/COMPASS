/**
 * getCurrentUser() 단위 테스트
 *
 * Server Action 공통 인증 헬퍼의 동작을 검증한다.
 * - 인증 실패 / 프로필 미존재 / 잘못된 role / 정상 반환 등 8개 케이스
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCurrentUser } from '../helpers'

// ─── Mock Setup ─────────────────────────────────────────

const mockGetUser = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args)
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs)
            return { single: mockSingle }
          },
        }
      },
    }),
  })),
}))

// ─── Helper ─────────────────────────────────────────────

function mockAuth(user: { id: string } | null, error?: unknown) {
  mockGetUser.mockResolvedValue({
    data: { user },
    error: error ?? null,
  })
}

function mockProfile(
  profile: { id: string; role: string; academy_id: string | null } | null,
  error?: unknown,
) {
  mockSingle.mockResolvedValue({
    data: profile,
    error: error ?? null,
  })
}

// ─── Tests ──────────────────────────────────────────────

describe('getCurrentUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('미인증 → 에러 반환', async () => {
    mockAuth(null)

    const result = await getCurrentUser()

    expect(result).toEqual({ error: '인증이 필요합니다.' })
  })

  it('인증 에러 → 에러 반환', async () => {
    mockAuth(null, { message: 'auth error' })

    const result = await getCurrentUser()

    expect(result).toEqual({ error: '인증이 필요합니다.' })
  })

  it('프로필 없음 → 에러 반환', async () => {
    mockAuth({ id: 'user-1' })
    mockProfile(null)

    const result = await getCurrentUser()

    expect(result).toEqual({ error: '프로필을 찾을 수 없습니다.' })
  })

  it('프로필 조회 에러 → 에러 반환', async () => {
    mockAuth({ id: 'user-1' })
    mockProfile(null, { message: 'db error' })

    const result = await getCurrentUser()

    expect(result).toEqual({ error: '프로필을 찾을 수 없습니다.' })
  })

  it('잘못된 role → 에러 반환', async () => {
    mockAuth({ id: 'user-1' })
    mockProfile({ id: 'user-1', role: 'invalid_role', academy_id: 'acad-1' })

    const result = await getCurrentUser()

    expect(result).toEqual({ error: '유효하지 않은 역할입니다.' })
  })

  it('academy_id null (system_admin) → 정상 반환', async () => {
    mockAuth({ id: 'user-1' })
    mockProfile({ id: 'user-1', role: 'system_admin', academy_id: null })

    const result = await getCurrentUser()

    expect(result).toEqual({
      profile: {
        id: 'user-1',
        role: 'system_admin',
        academyId: null,
      },
    })
  })

  it('admin + academy_id 있음 → 정상 반환', async () => {
    mockAuth({ id: 'user-1' })
    mockProfile({ id: 'user-1', role: 'admin', academy_id: 'acad-1' })

    const result = await getCurrentUser()

    expect(result).toEqual({
      profile: {
        id: 'user-1',
        role: 'admin',
        academyId: 'acad-1',
      },
    })
  })

  it('teacher + academy_id 있음 → 정상 반환', async () => {
    mockAuth({ id: 'user-1' })
    mockProfile({ id: 'user-1', role: 'teacher', academy_id: 'acad-1' })

    const result = await getCurrentUser()

    expect(result).toEqual({
      profile: {
        id: 'user-1',
        role: 'teacher',
        academyId: 'acad-1',
      },
    })
  })

  it('student + academy_id 있음 → 정상 반환', async () => {
    mockAuth({ id: 'user-1' })
    mockProfile({ id: 'user-1', role: 'student', academy_id: 'acad-1' })

    const result = await getCurrentUser()

    expect(result).toEqual({
      profile: {
        id: 'user-1',
        role: 'student',
        academyId: 'acad-1',
      },
    })
  })

  it('profiles 테이블에서 올바른 필드를 조회한다', async () => {
    mockAuth({ id: 'user-1' })
    mockProfile({ id: 'user-1', role: 'admin', academy_id: 'acad-1' })

    await getCurrentUser()

    expect(mockSelect).toHaveBeenCalledWith('id, role, academy_id')
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1')
  })
})
