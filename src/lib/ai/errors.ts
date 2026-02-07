/**
 * AI 서비스 전용 커스텀 에러 클래스 계층
 *
 * 에러 종류별로 isRetryable 플래그를 제공하여
 * retry.ts의 재시도 로직이 자동으로 판단할 수 있게 합니다.
 *
 * AIError (기본)
 * ├── AIServiceError    - API 호출 실패 (재시도 가능)
 * ├── AIValidationError - 응답 형식 불일치 (재시도 불가)
 * ├── AIRateLimitError  - 요청 한도 초과 (재시도 가능, 긴 대기)
 * └── AIConfigError     - 환경변수 누락 (재시도 불가)
 */

export class AIError extends Error {
  readonly code: string
  readonly isRetryable: boolean

  constructor(message: string, code: string, isRetryable: boolean, cause?: Error) {
    super(message, { cause })
    this.name = 'AIError'
    this.code = code
    this.isRetryable = isRetryable
  }
}

/** API 호출 실패 (네트워크 오류, 서버 5xx 등) */
export class AIServiceError extends AIError {
  readonly statusCode?: number

  constructor(message: string, statusCode?: number, cause?: Error) {
    super(message, 'AI_SERVICE_ERROR', true, cause)
    this.name = 'AIServiceError'
    this.statusCode = statusCode
  }
}

/** AI 응답이 예상 형식과 불일치 (Zod 검증 실패 등) */
export class AIValidationError extends AIError {
  readonly details?: Array<{ path: string; message: string }>

  constructor(
    message: string,
    details?: Array<{ path: string; message: string }>,
    cause?: Error
  ) {
    super(message, 'AI_VALIDATION_ERROR', false, cause)
    this.name = 'AIValidationError'
    this.details = details
  }
}

/** API 요청 한도 초과 (429 Too Many Requests) */
export class AIRateLimitError extends AIError {
  readonly retryAfterMs?: number

  constructor(message: string, retryAfterMs?: number, cause?: Error) {
    super(message, 'AI_RATE_LIMIT_ERROR', true, cause)
    this.name = 'AIRateLimitError'
    this.retryAfterMs = retryAfterMs
  }
}

/** 환경변수 누락 또는 잘못된 설정 */
export class AIConfigError extends AIError {
  constructor(message: string, cause?: Error) {
    super(message, 'AI_CONFIG_ERROR', false, cause)
    this.name = 'AIConfigError'
  }
}
