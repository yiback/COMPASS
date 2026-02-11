/**
 * 인증 관련 Zod 검증 스키마
 *
 * - 로그인: 이메일 + 비밀번호
 * - 회원가입: 이메일 + 비밀번호 + 이름 + 학원 코드
 * - 비밀번호 재설정: 이메일
 */

import { z } from 'zod'

// ─── 공통 필드 ──────────────────────────────────────────

const emailField = z
  .string()
  .min(1, '이메일을 입력해주세요.')
  .email('올바른 이메일 형식이 아닙니다.')

const passwordField = z
  .string()
  .min(8, '비밀번호는 8자 이상이어야 합니다.')
  .max(72, '비밀번호는 72자 이하여야 합니다.')

// ─── 로그인 스키마 ──────────────────────────────────────

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
})

export type LoginInput = z.infer<typeof loginSchema>

// ─── 회원가입 스키마 ────────────────────────────────────

export const signupSchema = z
  .object({
    email: emailField,
    password: passwordField,
    confirmPassword: z.string().min(1, '비밀번호 확인을 입력해주세요.'),
    name: z
      .string()
      .min(2, '이름은 2자 이상이어야 합니다.')
      .max(50, '이름은 50자 이하여야 합니다.'),
    inviteCode: z
      .string()
      .min(1, '학원 코드를 입력해주세요.')
      .max(20, '학원 코드는 20자 이하여야 합니다.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다.',
    path: ['confirmPassword'],
  })

export type SignupInput = z.infer<typeof signupSchema>

// ─── 비밀번호 재설정 스키마 ─────────────────────────────

export const forgotPasswordSchema = z.object({
  email: emailField,
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
