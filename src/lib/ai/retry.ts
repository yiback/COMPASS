/**
 * 지수 백오프 기반 재시도 유틸리티
 *
 * AI API 호출 시 네트워크 오류, Rate Limit 등 일시적 장애에서
 * 자동 복구하기 위한 withRetry() 함수를 제공합니다.
 *
 * 재시도 판단 기준:
 * - AIError이고 isRetryable=false → 즉시 throw (재시도 안 함)
 * - AIError이고 isRetryable=true → 재시도
 * - 비-AIError (일반 Error) → 재시도 (네트워크 타임아웃 등 일시적 장애 가능)
 *
 * 대기 시간 결정:
 * - AIRateLimitError.retryAfterMs 존재 → 해당 값 사용 (서버 명시)
 * - 그 외 → 지수 백오프: baseDelayMs * 2^attempt (maxDelayMs 캡)
 */

import { AIError, AIRateLimitError } from './errors'

/** 재시도 옵션 */
export interface RetryOptions {
  /** 최대 재시도 횟수 (기본: 3) */
  readonly maxRetries?: number
  /** 기본 대기 시간 (기본: 1000ms) */
  readonly baseDelayMs?: number
  /** 최대 대기 시간 캡 (기본: 10000ms) */
  readonly maxDelayMs?: number
}

const DEFAULT_MAX_RETRIES = 3
const DEFAULT_BASE_DELAY_MS = 1000
const DEFAULT_MAX_DELAY_MS = 10000

/** 주어진 밀리초만큼 대기 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 지수 백오프 대기 시간 계산: min(baseDelayMs * 2^attempt, maxDelayMs) */
function calculateBackoff(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  return Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs)
}

/**
 * 지수 백오프 기반으로 비동기 함수를 재시도한다.
 *
 * @param fn - 재시도할 비동기 함수
 * @param options - 재시도 옵션 (maxRetries, baseDelayMs, maxDelayMs)
 * @returns fn의 반환값
 * @throws 재시도 불가능한 에러이거나, 최대 재시도 횟수 초과 시 마지막 에러
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   () => callGeminiAPI(prompt),
 *   { maxRetries: 3, baseDelayMs: 1000 }
 * )
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS
  const maxDelayMs = options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS

  // 입력값 검증: 음수 방어
  if (maxRetries < 0) {
    throw new Error('maxRetries는 0 이상이어야 합니다')
  }
  if (baseDelayMs < 0 || maxDelayMs < 0) {
    throw new Error('대기 시간은 0 이상이어야 합니다')
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      // AIError이고 재시도 불가능하면 즉시 throw
      if (error instanceof AIError && !error.isRetryable) {
        throw error
      }

      // 마지막 시도였으면 에러 throw (재시도 소진)
      if (attempt === maxRetries) {
        throw error
      }

      // AIRateLimitError에 retryAfterMs가 양수이면 서버 명시 시간 사용
      if (error instanceof AIRateLimitError && error.retryAfterMs != null && error.retryAfterMs > 0) {
        await delay(error.retryAfterMs)
      } else {
        // 그 외: 지수 백오프 적용
        await delay(calculateBackoff(attempt, baseDelayMs, maxDelayMs))
      }
    }
  }

  // TypeScript 안전장치 - for 루프 내에서 반드시 return 또는 throw
  throw new Error('withRetry: 예기치 않은 루프 종료')
}
