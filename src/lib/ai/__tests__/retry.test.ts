import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withRetry } from '../retry'
import {
  AIServiceError,
  AIValidationError,
  AIRateLimitError,
} from '../errors'

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('첫 번째 시도에서 성공하면 즉시 반환한다', async () => {
    const fn = vi.fn().mockResolvedValueOnce('성공')

    const result = await withRetry(fn)

    expect(result).toBe('성공')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('재시도 후 성공하면 결과를 반환한다', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new AIServiceError('API 실패', 500))
      .mockResolvedValueOnce('복구 성공')

    // withRetry는 내부에서 await delay()를 호출하므로,
    // promise를 먼저 시작하고 타이머를 전진시켜야 한다
    const promise = withRetry(fn, { baseDelayMs: 100, maxDelayMs: 1000 })
    await vi.advanceTimersByTimeAsync(100) // 첫 번째 백오프 (100 * 2^0 = 100ms)

    const result = await promise

    expect(result).toBe('복구 성공')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('최대 재시도 횟수를 초과하면 마지막 에러를 던진다', async () => {
    const error = new AIServiceError('계속 실패', 503)
    const fn = vi.fn().mockRejectedValue(error)

    const promise = withRetry(fn, {
      maxRetries: 2,
      baseDelayMs: 100,
      maxDelayMs: 1000,
    })

    // rejection handler를 먼저 등록하여 unhandled rejection 방지
    const assertion = expect(promise).rejects.toThrow('계속 실패')

    // 2회 재시도 = 2번의 딜레이 (attempt 0: 100ms, attempt 1: 200ms)
    await vi.advanceTimersByTimeAsync(100) // 첫 번째 재시도 대기
    await vi.advanceTimersByTimeAsync(200) // 두 번째 재시도 대기

    await assertion
    // 최초 1회 + 재시도 2회 = 총 3회 호출
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('isRetryable이 false인 AIError는 즉시 던진다', async () => {
    const error = new AIValidationError('형식 오류')
    const fn = vi.fn().mockRejectedValueOnce(error)

    await expect(withRetry(fn)).rejects.toThrow('형식 오류')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('AIRateLimitError에 retryAfterMs가 있으면 해당 시간만큼 대기한다', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new AIRateLimitError('한도 초과', 5000))
      .mockResolvedValueOnce('성공')

    const promise = withRetry(fn, { baseDelayMs: 100, maxDelayMs: 1000 })

    // retryAfterMs(5000)를 사용해야 하므로 baseDelayMs(100)로는 부족
    await vi.advanceTimersByTimeAsync(100)
    // fn이 아직 1번만 호출된 상태 (5000ms를 기다려야 재시도)
    expect(fn).toHaveBeenCalledTimes(1)

    // 나머지 4900ms 전진 → 총 5000ms
    await vi.advanceTimersByTimeAsync(4900)

    const result = await promise
    expect(result).toBe('성공')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('AIRateLimitError에 retryAfterMs가 없으면 지수 백오프를 사용한다', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new AIRateLimitError('한도 초과'))
      .mockResolvedValueOnce('성공')

    const promise = withRetry(fn, { baseDelayMs: 100, maxDelayMs: 1000 })

    // retryAfterMs 없음 → 지수 백오프 (100 * 2^0 = 100ms)
    await vi.advanceTimersByTimeAsync(100)

    const result = await promise
    expect(result).toBe('성공')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('지수 백오프가 시도마다 2배씩 증가한다', async () => {
    const error = new AIServiceError('실패')
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error) // attempt 0 실패
      .mockRejectedValueOnce(error) // attempt 1 실패
      .mockRejectedValueOnce(error) // attempt 2 실패
      .mockResolvedValueOnce('성공') // attempt 3 성공

    const promise = withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 10000,
    })

    // attempt 0 실패 → 대기 100ms (100 * 2^0)
    await vi.advanceTimersByTimeAsync(100)
    expect(fn).toHaveBeenCalledTimes(2)

    // attempt 1 실패 → 대기 200ms (100 * 2^1)
    await vi.advanceTimersByTimeAsync(200)
    expect(fn).toHaveBeenCalledTimes(3)

    // attempt 2 실패 → 대기 400ms (100 * 2^2)
    await vi.advanceTimersByTimeAsync(400)
    expect(fn).toHaveBeenCalledTimes(4)

    const result = await promise
    expect(result).toBe('성공')
  })

  it('지수 백오프가 maxDelayMs를 초과하지 않는다', async () => {
    const error = new AIServiceError('실패')
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error) // attempt 0
      .mockRejectedValueOnce(error) // attempt 1
      .mockResolvedValueOnce('성공') // attempt 2

    const promise = withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 150, // 캡: 150ms
    })

    // attempt 0 실패 → 대기 100ms (100 * 2^0 = 100, min(100, 150) = 100)
    await vi.advanceTimersByTimeAsync(100)
    expect(fn).toHaveBeenCalledTimes(2)

    // attempt 1 실패 → 대기 150ms (100 * 2^1 = 200, min(200, 150) = 150)
    await vi.advanceTimersByTimeAsync(150)
    expect(fn).toHaveBeenCalledTimes(3)

    const result = await promise
    expect(result).toBe('성공')
  })

  it('maxRetries가 0이면 첫 시도만 하고 에러 시 즉시 던진다', async () => {
    const error = new AIServiceError('실패')
    const fn = vi.fn().mockRejectedValueOnce(error)

    await expect(
      withRetry(fn, { maxRetries: 0 })
    ).rejects.toThrow('실패')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('음수 maxRetries를 전달하면 에러를 던진다', async () => {
    const fn = vi.fn().mockResolvedValueOnce('성공')

    await expect(
      withRetry(fn, { maxRetries: -1 })
    ).rejects.toThrow('maxRetries는 0 이상이어야 합니다')
    expect(fn).not.toHaveBeenCalled()
  })

  it('음수 baseDelayMs를 전달하면 에러를 던진다', async () => {
    const fn = vi.fn().mockResolvedValueOnce('성공')

    await expect(
      withRetry(fn, { baseDelayMs: -100 })
    ).rejects.toThrow('대기 시간은 0 이상이어야 합니다')
    expect(fn).not.toHaveBeenCalled()
  })

  it('AIRateLimitError.retryAfterMs가 0이면 지수 백오프를 사용한다', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new AIRateLimitError('한도 초과', 0))
      .mockResolvedValueOnce('성공')

    const promise = withRetry(fn, { baseDelayMs: 100, maxDelayMs: 1000 })
    // retryAfterMs가 0이므로 지수 백오프 (100ms) 적용
    await vi.advanceTimersByTimeAsync(100)

    const result = await promise
    expect(result).toBe('성공')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('AIError가 아닌 일반 에러도 재시도 대상이다', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('네트워크 타임아웃'))
      .mockResolvedValueOnce('복구')

    const promise = withRetry(fn, { baseDelayMs: 100, maxDelayMs: 1000 })
    await vi.advanceTimersByTimeAsync(100) // 지수 백오프 적용

    const result = await promise
    expect(result).toBe('복구')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
