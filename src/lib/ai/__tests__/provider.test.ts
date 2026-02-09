import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── 모킹 ────────────────────────────────────────────────

vi.mock('../gemini', () => {
  const MockGeminiProvider = vi.fn(function (this: Record<string, unknown>) {
    this.name = 'gemini'
  })
  return { GeminiProvider: MockGeminiProvider }
})

// 모킹 후 import (호이스팅 활용)
import { createAIProvider } from '../provider'
import { GeminiProvider } from '../gemini'
import { AIConfigError } from '../errors'

// ─── 환경변수 격리 ──────────────────────────────────────────

let envBackup: string | undefined

beforeEach(() => {
  envBackup = process.env.AI_PROVIDER
  delete process.env.AI_PROVIDER
  vi.clearAllMocks()
})

afterEach(() => {
  if (envBackup !== undefined) {
    process.env.AI_PROVIDER = envBackup
  } else {
    delete process.env.AI_PROVIDER
  }
})

// ─── 테스트 ────────────────────────────────────────────────

describe('createAIProvider', () => {
  describe('인자로 타입 지정', () => {
    it('gemini를 전달하면 GeminiProvider 인스턴스를 반환한다', () => {
      const provider = createAIProvider('gemini')

      expect(provider).toBeInstanceOf(GeminiProvider)
      expect(provider.name).toBe('gemini')
    })
  })

  describe('환경변수 기반 선택', () => {
    it('AI_PROVIDER=gemini이면 GeminiProvider를 반환한다', () => {
      process.env.AI_PROVIDER = 'gemini'

      const provider = createAIProvider()

      expect(provider).toBeInstanceOf(GeminiProvider)
    })

    it('AI_PROVIDER=openai처럼 미지원 타입이면 AIConfigError를 던진다', () => {
      process.env.AI_PROVIDER = 'openai'

      expect(() => createAIProvider()).toThrow(AIConfigError)
    })
  })

  describe('기본값', () => {
    it('인자와 환경변수 모두 없으면 기본값 gemini를 사용한다', () => {
      const provider = createAIProvider()

      expect(provider).toBeInstanceOf(GeminiProvider)
      expect(provider.name).toBe('gemini')
    })
  })

  describe('우선순위', () => {
    it('인자가 환경변수보다 우선한다', () => {
      process.env.AI_PROVIDER = 'unknown'

      const provider = createAIProvider('gemini')

      expect(provider).toBeInstanceOf(GeminiProvider)
      expect(provider.name).toBe('gemini')
    })
  })

  describe('에러 처리', () => {
    it('알 수 없는 타입이면 AIConfigError를 던진다', () => {
      expect(() =>
        createAIProvider('unknown' as 'gemini'),
      ).toThrow(AIConfigError)
    })

    it('에러 메시지에 요청된 타입이 포함된다', () => {
      expect(() =>
        createAIProvider('claude' as 'gemini'),
      ).toThrow(/claude/)
    })

    it('에러의 code는 AI_CONFIG_ERROR이고 isRetryable은 false이다', () => {
      try {
        createAIProvider('openai' as 'gemini')
        expect.fail('에러가 발생해야 합니다')
      } catch (error) {
        expect(error).toBeInstanceOf(AIConfigError)
        const configError = error as AIConfigError
        expect(configError.code).toBe('AI_CONFIG_ERROR')
        expect(configError.isRetryable).toBe(false)
      }
    })
  })
})
