'use server'

/**
 * 인증 Server Actions
 *
 * - login: 이메일/비밀번호 로그인
 * - signup: 회원가입 (학원 코드 검증 포함)
 * - logout: 로그아웃
 * - resetPassword: 비밀번호 재설정 이메일 발송
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
} from '@/lib/validations/auth'

// ─── 공통 반환 타입 ─────────────────────────────────────

export interface AuthActionResult {
  readonly error?: string
}

// ─── 로그인 ─────────────────────────────────────────────

export async function loginAction(
  _prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
  }

  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    console.error('[login] error:', error)
    return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' }
  }

  redirect('/')
}

// ─── 회원가입 ───────────────────────────────────────────

export async function signupAction(
  _prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    name: formData.get('name'),
    inviteCode: formData.get('inviteCode'),
  }

  const parsed = signupSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }
  }

  const { email, password, name, inviteCode } = parsed.data

  // 1. 학원 코드 검증 (admin 클라이언트로 RLS 우회)
  const admin = createAdminClient()
  const { data: academy, error: academyError } = await admin
    .from('academies')
    .select('id')
    .eq('invite_code', inviteCode)
    .single() as { data: { id: string } | null; error: unknown }

  if (academyError || !academy) {
    return { error: '유효하지 않은 학원 코드입니다.' }
  }

  console.log('[signup] academy found:', academy)

  // 2. 회원가입 (metadata에 name, academy_id 전달 → 트리거에서 profiles 생성)
  const supabase = await createClient()
  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        academy_id: academy.id,
      },
    },
  })

  if (signUpError) {
    console.error('[signup] signUpError:', signUpError)
    // 중복 이메일 등의 에러 처리
    if (signUpError.message.includes('already registered')) {
      return { error: '이미 등록된 이메일입니다.' }
    }
    return { error: '회원가입에 실패했습니다. 다시 시도해주세요.' }
  }

  redirect('/login?message=signup-success')
}

// ─── 로그아웃 ───────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// ─── 비밀번호 재설정 ────────────────────────────────────

export async function resetPasswordAction(
  _prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const raw = { email: formData.get('email') }

  const parsed = forgotPasswordSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback?type=recovery`,
  })

  if (error) {
    return { error: '비밀번호 재설정 이메일 발송에 실패했습니다.' }
  }

  // 성공 시에도 보안상 동일 메시지 (이메일 존재 여부 노출 방지)
  redirect('/login?message=reset-sent')
}
