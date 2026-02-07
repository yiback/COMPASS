import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('getAIConfig', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // 환경변수 초기화 - 각 테스트마다 깨끗한 상태
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('GEMINI_API_KEY가 없으면 AIConfigError를 던진다', async () => {
    delete process.env.GEMINI_API_KEY

    // vi.resetModules() 후에는 동적 import로 같은 모듈 인스턴스를 사용해야
    // instanceof 체크가 정상 동작한다 (정적 import와 동적 import는 서로 다른 모듈 인스턴스)
    const { getAIConfig } = await import('../config')
    const { AIConfigError } = await import('../errors')
    expect(() => getAIConfig()).toThrow(AIConfigError)
  })

  it('GEMINI_API_KEY만 있으면 기본값으로 설정된다', async () => {
    process.env.GEMINI_API_KEY = 'test-api-key'

    const { getAIConfig } = await import('../config')
    const config = getAIConfig()

    expect(config.apiKey).toBe('test-api-key')
    expect(config.model).toBe('gemini-2.0-flash')
    expect(config.provider).toBe('gemini')
    expect(config.maxRetries).toBe(3)
    expect(config.timeoutMs).toBe(30_000)
  })

  it('환경변수로 모든 값을 커스텀할 수 있다', async () => {
    process.env.GEMINI_API_KEY = 'custom-key'
    process.env.GEMINI_MODEL = 'gemini-2.5-pro'
    process.env.AI_PROVIDER = 'gemini'
    process.env.AI_MAX_RETRIES = '5'
    process.env.AI_TIMEOUT_MS = '60000'

    const { getAIConfig } = await import('../config')
    const config = getAIConfig()

    expect(config.apiKey).toBe('custom-key')
    expect(config.model).toBe('gemini-2.5-pro')
    expect(config.provider).toBe('gemini')
    expect(config.maxRetries).toBe(5)
    expect(config.timeoutMs).toBe(60_000)
  })

  it('AI_MAX_RETRIES가 숫자가 아니면 기본값 3을 사용한다', async () => {
    process.env.GEMINI_API_KEY = 'test-key'
    process.env.AI_MAX_RETRIES = 'not-a-number'

    const { getAIConfig } = await import('../config')
    // coerce가 NaN이 되면 기본값 사용
    const config = getAIConfig()
    expect(config.maxRetries).toBe(3)
  })

  it('설정을 캐싱하여 반복 호출 시 동일 객체를 반환한다', async () => {
    process.env.GEMINI_API_KEY = 'test-key'

    const { getAIConfig } = await import('../config')
    const config1 = getAIConfig()
    const config2 = getAIConfig()

    expect(config1).toBe(config2)
  })
})
