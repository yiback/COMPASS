/**
 * requireRole + getCurrentProfile 동작 검증 테스트
 *
 * Mock 전략:
 * - react: cache()를 identity 함수로 대체 (테스트 간 cache dedup 방지)
 * - next/navigation: redirect를 throw로 구현 (Next.js 내부 동작과 동일)
 * - @/lib/supabase/server: DB 호출 대체
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── React cache() mock ──────────────────────────────────
// cache()는 동일 요청 내 dedup용. 테스트에서는 identity 함수로 대체하여
// 각 호출이 실제로 실행되도록 보장
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    cache: (fn: (...args: unknown[]) => unknown) => fn,
  }
})

// ─── next/navigation mock ────────────────────────────────
// redirect()는 Next.js 내부에서 throw 방식으로 동작 — mock도 동일하게 처리
const mockRedirect = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    mockRedirect(url)
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

// ─── Supabase 서버 클라이언트 mock ───────────────────────
const mockGetUser = vi.fn()
const mockProfileSelect = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => mockProfileSelect(),
        }),
      }),
    }),
  }),
}))

// ─── 공통 프로필 픽스처 ─────────────────────────────────

function makeProfile(overrides?: Record<string, unknown>) {
  return {
    id: 'user-1',
    role: 'teacher',
    academy_id: 'academy-1',
    name: '홍길동',
    email: 'teacher@example.com',
    avatar_url: null,
    ...overrides,
  }
}

// ─── requireRole 테스트 ──────────────────────────────────

describe('requireRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('미인증 사용자는 /login으로 리다이렉트된다', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { requireRole } = await import('../require-role')

    await expect(requireRole(['teacher'])).rejects.toThrow('NEXT_REDIRECT:/login')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('프로필이 없으면 /login으로 리다이렉트된다', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockProfileSelect.mockResolvedValue({ data: null, error: null })

    const { requireRole } = await import('../require-role')

    await expect(requireRole(['teacher'])).rejects.toThrow('NEXT_REDIRECT:/login')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('역할이 불일치하면 /unauthorized로 리다이렉트된다 (teacher → admin 전용)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockProfileSelect.mockResolvedValue({
      data: makeProfile({ role: 'teacher', academy_id: 'academy-1' }),
      error: null,
    })

    const { requireRole } = await import('../require-role')

    await expect(requireRole(['admin'])).rejects.toThrow('NEXT_REDIRECT:/unauthorized')
    expect(mockRedirect).toHaveBeenCalledWith('/unauthorized')
  })

  it('역할이 일치하면 CurrentProfile을 반환한다', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockProfileSelect.mockResolvedValue({
      data: makeProfile({ role: 'teacher', academy_id: 'academy-1' }),
      error: null,
    })

    const { requireRole } = await import('../require-role')
    const profile = await requireRole(['teacher', 'admin'])

    expect(profile).toMatchObject({
      id: 'user-1',
      role: 'teacher',
      academyId: 'academy-1',
    })
  })

  it('system_admin은 allowedRoles에 없어도 항상 허용된다', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockProfileSelect.mockResolvedValue({
      data: makeProfile({ id: 'admin-1', role: 'system_admin', academy_id: null }),
      error: null,
    })

    const { requireRole } = await import('../require-role')
    // allowedRoles에 system_admin 미포함
    const profile = await requireRole(['teacher'])

    expect(profile.role).toBe('system_admin')
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('빈 allowedRoles 배열은 system_admin 외 모든 역할을 차단한다 (T-H1)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockProfileSelect.mockResolvedValue({
      data: makeProfile({ role: 'teacher', academy_id: 'academy-1' }),
      error: null,
    })

    const { requireRole } = await import('../require-role')

    await expect(requireRole([])).rejects.toThrow('NEXT_REDIRECT:/unauthorized')
    expect(mockRedirect).toHaveBeenCalledWith('/unauthorized')
  })

  it('student가 admin/teacher 전용 페이지에 접근하면 /unauthorized로 리다이렉트된다', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-2' } } })
    mockProfileSelect.mockResolvedValue({
      data: makeProfile({ id: 'user-2', role: 'student', academy_id: 'academy-1' }),
      error: null,
    })

    const { requireRole } = await import('../require-role')

    await expect(requireRole(['admin', 'teacher'])).rejects.toThrow('NEXT_REDIRECT:/unauthorized')
    expect(mockRedirect).toHaveBeenCalledWith('/unauthorized')
  })
})

// ─── getCurrentProfile 테스트 ────────────────────────────

describe('getCurrentProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('system_admin + academy_id=null → 정상 반환 (null 아님)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockProfileSelect.mockResolvedValue({
      data: makeProfile({ id: 'admin-1', role: 'system_admin', academy_id: null }),
      error: null,
    })

    const { getCurrentProfile } = await import('../get-current-user')
    const profile = await getCurrentProfile()

    expect(profile).not.toBeNull()
    expect(profile?.role).toBe('system_admin')
    expect(profile?.academyId).toBeNull()
  })

  it('teacher + academy_id=null → null 반환 (academy 미소속 비정상 상태)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockProfileSelect.mockResolvedValue({
      data: makeProfile({ role: 'teacher', academy_id: null }),
      error: null,
    })

    const { getCurrentProfile } = await import('../get-current-user')
    const profile = await getCurrentProfile()

    expect(profile).toBeNull()
  })

  it('teacher + academy_id 존재 → 정상 반환', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockProfileSelect.mockResolvedValue({
      data: makeProfile({ role: 'teacher', academy_id: 'academy-1' }),
      error: null,
    })

    const { getCurrentProfile } = await import('../get-current-user')
    const profile = await getCurrentProfile()

    expect(profile).toMatchObject({
      role: 'teacher',
      academyId: 'academy-1',
    })
  })

  it('미인증 사용자 → null 반환', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { getCurrentProfile } = await import('../get-current-user')
    const profile = await getCurrentProfile()

    expect(profile).toBeNull()
  })

  it('DB 에러 발생 시 null 반환 (error 필드 무시) (T-H2)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockProfileSelect.mockResolvedValue({ data: null, error: { message: 'DB connection error' } })

    const { getCurrentProfile } = await import('../get-current-user')
    const profile = await getCurrentProfile()

    expect(profile).toBeNull()
  })

  it('DB에서 알 수 없는 role 문자열이 오면 null 반환 (T-H3)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockProfileSelect.mockResolvedValue({
      data: makeProfile({ role: 'superuser', academy_id: 'academy-1' }),
      error: null,
    })

    const { getCurrentProfile } = await import('../get-current-user')
    const profile = await getCurrentProfile()

    expect(profile).toBeNull()
  })

  it('프로필이 DB에 없으면 null 반환', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-99' } } })
    mockProfileSelect.mockResolvedValue({ data: null, error: null })

    const { getCurrentProfile } = await import('../get-current-user')
    const profile = await getCurrentProfile()

    expect(profile).toBeNull()
  })
})
