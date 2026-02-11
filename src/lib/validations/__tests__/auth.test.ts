/**
 * 인증 Zod 스키마 테스트
 */

import { describe, it, expect } from 'vitest'
import { loginSchema, signupSchema, forgotPasswordSchema } from '../auth'

// ─── loginSchema ────────────────────────────────────────

describe('loginSchema', () => {
  it('유효한 로그인 데이터를 통과시킨다', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
    })
    expect(result.success).toBe(true)
  })

  it('빈 이메일을 거부한다', () => {
    const result = loginSchema.safeParse({
      email: '',
      password: 'password123',
    })
    expect(result.success).toBe(false)
  })

  it('잘못된 이메일 형식을 거부한다', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
    })
    expect(result.success).toBe(false)
  })

  it('빈 비밀번호를 거부한다', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: '',
    })
    expect(result.success).toBe(false)
  })
})

// ─── signupSchema ───────────────────────────────────────

describe('signupSchema', () => {
  const validData = {
    email: 'test@example.com',
    password: 'password123',
    confirmPassword: 'password123',
    name: '홍길동',
    inviteCode: 'ABC123',
  }

  it('유효한 가입 데이터를 통과시킨다', () => {
    const result = signupSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('비밀번호 불일치를 거부한다', () => {
    const result = signupSchema.safeParse({
      ...validData,
      confirmPassword: 'different',
    })
    expect(result.success).toBe(false)
  })

  it('8자 미만 비밀번호를 거부한다', () => {
    const result = signupSchema.safeParse({
      ...validData,
      password: 'short',
      confirmPassword: 'short',
    })
    expect(result.success).toBe(false)
  })

  it('72자 초과 비밀번호를 거부한다', () => {
    const longPassword = 'a'.repeat(73)
    const result = signupSchema.safeParse({
      ...validData,
      password: longPassword,
      confirmPassword: longPassword,
    })
    expect(result.success).toBe(false)
  })

  it('2자 미만 이름을 거부한다', () => {
    const result = signupSchema.safeParse({
      ...validData,
      name: 'A',
    })
    expect(result.success).toBe(false)
  })

  it('빈 학원 코드를 거부한다', () => {
    const result = signupSchema.safeParse({
      ...validData,
      inviteCode: '',
    })
    expect(result.success).toBe(false)
  })

  it('20자 초과 학원 코드를 거부한다', () => {
    const result = signupSchema.safeParse({
      ...validData,
      inviteCode: 'A'.repeat(21),
    })
    expect(result.success).toBe(false)
  })
})

// ─── forgotPasswordSchema ───────────────────────────────

describe('forgotPasswordSchema', () => {
  it('유효한 이메일을 통과시킨다', () => {
    const result = forgotPasswordSchema.safeParse({
      email: 'test@example.com',
    })
    expect(result.success).toBe(true)
  })

  it('빈 이메일을 거부한다', () => {
    const result = forgotPasswordSchema.safeParse({
      email: '',
    })
    expect(result.success).toBe(false)
  })

  it('잘못된 이메일 형식을 거부한다', () => {
    const result = forgotPasswordSchema.safeParse({
      email: 'invalid',
    })
    expect(result.success).toBe(false)
  })
})
