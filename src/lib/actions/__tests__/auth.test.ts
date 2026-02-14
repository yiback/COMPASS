/**
 * 인증 Server Actions 테스트
 *
 * Supabase 클라이언트를 모킹하여 Server Action 로직만 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── 모킹 ───────────────────────────────────────────────

// next/navigation 모킹
const mockRedirect = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    mockRedirect(url)
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

// Supabase 서버 클라이언트 모킹
const mockSignInWithPassword = vi.fn()
const mockSignUp = vi.fn()
const mockSignOut = vi.fn()
const mockResetPasswordForEmail = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signOut: () => mockSignOut(),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
    },
  }),
}))

// Supabase admin 클라이언트 모킹
const mockAdminSelect = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => mockAdminSelect(),
        }),
      }),
    }),
  }),
}))

// ─── 테스트 유틸 ────────────────────────────────────────

function createFormData(data: Record<string, string>): FormData {
  const formData = new FormData()
  for (const [key, value] of Object.entries(data)) {
    formData.set(key, value)
  }
  return formData
}

// ─── 테스트 ─────────────────────────────────────────────

describe('loginAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('잘못된 이메일로 에러를 반환한다', async () => {
    const { loginAction } = await import('../auth')
    const formData = createFormData({ email: 'invalid', password: 'password123' })
    const result = await loginAction(null, formData)
    expect(result?.error).toBeDefined()
  })

  it('빈 비밀번호로 에러를 반환한다', async () => {
    const { loginAction } = await import('../auth')
    const formData = createFormData({ email: 'test@example.com', password: '' })
    const result = await loginAction(null, formData)
    expect(result?.error).toBeDefined()
  })

  it('Supabase 인증 실패 시 에러를 반환한다', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    })

    const { loginAction } = await import('../auth')
    const formData = createFormData({
      email: 'test@example.com',
      password: 'password123',
    })
    const result = await loginAction(null, formData)
    expect(result?.error).toBe('이메일 또는 비밀번호가 올바르지 않습니다.')
  })

  it('성공 시 /로 리다이렉트한다', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null })

    const { loginAction } = await import('../auth')
    const formData = createFormData({
      email: 'test@example.com',
      password: 'password123',
    })

    await expect(loginAction(null, formData)).rejects.toThrow('NEXT_REDIRECT:/')
    expect(mockRedirect).toHaveBeenCalledWith('/')
  })
})

describe('signupAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('비밀번호 불일치 시 에러를 반환한다', async () => {
    const { signupAction } = await import('../auth')
    const formData = createFormData({
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'different',
      name: '홍길동',
      inviteCode: 'ABC123',
    })
    const result = await signupAction(null, formData)
    expect(result?.error).toBeDefined()
  })

  it('유효하지 않은 학원 코드로 에러를 반환한다', async () => {
    mockAdminSelect.mockResolvedValue({
      data: null,
      error: { message: 'not found' },
    })

    const { signupAction } = await import('../auth')
    const formData = createFormData({
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
      name: '홍길동',
      inviteCode: 'INVALID',
    })
    const result = await signupAction(null, formData)
    expect(result?.error).toBe('유효하지 않은 학원 코드입니다.')
  })

  it('Supabase 회원가입 실패 시 에러를 반환한다', async () => {
    mockAdminSelect.mockResolvedValue({
      data: { id: 'academy-uuid' },
      error: null,
    })
    mockSignUp.mockResolvedValue({
      error: { message: 'User already registered' },
    })

    const { signupAction } = await import('../auth')
    const formData = createFormData({
      email: 'existing@example.com',
      password: 'password123',
      confirmPassword: 'password123',
      name: '홍길동',
      inviteCode: 'ABC123',
    })
    const result = await signupAction(null, formData)
    expect(result?.error).toBeDefined()
  })

  it('성공 시 /login으로 리다이렉트한다', async () => {
    mockAdminSelect.mockResolvedValue({
      data: { id: 'academy-uuid' },
      error: null,
    })
    mockSignUp.mockResolvedValue({ error: null })

    const { signupAction } = await import('../auth')
    const formData = createFormData({
      email: 'new@example.com',
      password: 'password123',
      confirmPassword: 'password123',
      name: '홍길동',
      inviteCode: 'ABC123',
    })

    await expect(signupAction(null, formData)).rejects.toThrow('NEXT_REDIRECT')
  })
})

describe('resetPasswordAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('잘못된 이메일로 에러를 반환한다', async () => {
    const { resetPasswordAction } = await import('../auth')
    const formData = createFormData({ email: 'invalid' })
    const result = await resetPasswordAction(null, formData)
    expect(result?.error).toBeDefined()
  })

  it('Supabase 에러 시 에러를 반환한다', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      error: { message: 'Rate limit exceeded' },
    })

    const { resetPasswordAction } = await import('../auth')
    const formData = createFormData({ email: 'test@example.com' })
    const result = await resetPasswordAction(null, formData)
    expect(result?.error).toBe('비밀번호 재설정 이메일 발송에 실패했습니다.')
  })

  it('성공 시 /login으로 리다이렉트한다', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null })

    const { resetPasswordAction } = await import('../auth')
    const formData = createFormData({ email: 'test@example.com' })

    await expect(resetPasswordAction(null, formData)).rejects.toThrow('NEXT_REDIRECT')
  })
})
