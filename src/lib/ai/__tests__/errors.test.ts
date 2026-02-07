import { describe, it, expect } from 'vitest'
import {
  AIError,
  AIServiceError,
  AIValidationError,
  AIRateLimitError,
  AIConfigError,
} from '../errors'

describe('AIError (기본 클래스)', () => {
  it('message, code, isRetryable 속성을 가진다', () => {
    const error = new AIError('테스트 에러', 'TEST_ERROR', true)

    expect(error.message).toBe('테스트 에러')
    expect(error.code).toBe('TEST_ERROR')
    expect(error.isRetryable).toBe(true)
    expect(error.name).toBe('AIError')
    expect(error).toBeInstanceOf(Error)
  })

  it('원인 에러(cause)를 포함할 수 있다', () => {
    const cause = new Error('원인')
    const error = new AIError('래핑 에러', 'WRAPPED', false, cause)

    expect(error.cause).toBe(cause)
  })
})

describe('AIServiceError (API 호출 실패)', () => {
  it('기본적으로 재시도 가능하다 (isRetryable: true)', () => {
    const error = new AIServiceError('API 호출 실패')

    expect(error.isRetryable).toBe(true)
    expect(error.code).toBe('AI_SERVICE_ERROR')
    expect(error.name).toBe('AIServiceError')
    expect(error).toBeInstanceOf(AIError)
  })

  it('statusCode를 포함할 수 있다', () => {
    const error = new AIServiceError('서버 에러', 500)

    expect(error.statusCode).toBe(500)
  })
})

describe('AIValidationError (응답 형식 불일치)', () => {
  it('재시도 불가능하다 (isRetryable: false)', () => {
    const error = new AIValidationError('형식 오류')

    expect(error.isRetryable).toBe(false)
    expect(error.code).toBe('AI_VALIDATION_ERROR')
    expect(error.name).toBe('AIValidationError')
    expect(error).toBeInstanceOf(AIError)
  })

  it('검증 에러 상세 정보를 포함할 수 있다', () => {
    const details = [{ path: 'questions[0].content', message: '필수 필드' }]
    const error = new AIValidationError('검증 실패', details)

    expect(error.details).toEqual(details)
  })
})

describe('AIRateLimitError (요청 한도 초과)', () => {
  it('재시도 가능하다 (isRetryable: true)', () => {
    const error = new AIRateLimitError('요청 한도 초과')

    expect(error.isRetryable).toBe(true)
    expect(error.code).toBe('AI_RATE_LIMIT_ERROR')
    expect(error.name).toBe('AIRateLimitError')
    expect(error).toBeInstanceOf(AIError)
  })

  it('retryAfterMs를 포함할 수 있다', () => {
    const error = new AIRateLimitError('한도 초과', 60_000)

    expect(error.retryAfterMs).toBe(60_000)
  })
})

describe('AIConfigError (환경변수 누락)', () => {
  it('재시도 불가능하다 (isRetryable: false)', () => {
    const error = new AIConfigError('API 키 누락')

    expect(error.isRetryable).toBe(false)
    expect(error.code).toBe('AI_CONFIG_ERROR')
    expect(error.name).toBe('AIConfigError')
    expect(error).toBeInstanceOf(AIError)
  })
})
