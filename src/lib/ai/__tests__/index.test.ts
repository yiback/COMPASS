// src/lib/ai/__tests__/index.test.ts
// 공개 API 배럴 파일 검증 테스트

import { describe, it, expect } from 'vitest'

describe('AI 모듈 공개 API (index.ts)', () => {
  it('createAIProvider 팩토리 함수를 export한다', async () => {
    const mod = await import('@/lib/ai')
    expect(mod.createAIProvider).toBeDefined()
    expect(typeof mod.createAIProvider).toBe('function')
  })

  it('에러 클래스를 export한다', async () => {
    const { AIError, AIServiceError, AIValidationError, AIRateLimitError, AIConfigError } =
      await import('@/lib/ai')

    expect(AIError).toBeDefined()
    expect(AIServiceError).toBeDefined()
    expect(AIValidationError).toBeDefined()
    expect(AIRateLimitError).toBeDefined()
    expect(AIConfigError).toBeDefined()
  })

  it('내부 모듈은 직접 노출하지 않는다', async () => {
    const mod = await import('@/lib/ai')
    const exportedKeys = Object.keys(mod)

    // 내부 모듈 (config, retry, validation, prompts, gemini)은 노출 안 됨
    expect(exportedKeys).not.toContain('getAIConfig')
    expect(exportedKeys).not.toContain('withRetry')
    expect(exportedKeys).not.toContain('parseAIResponse')
    expect(exportedKeys).not.toContain('buildQuestionGenerationPrompt')
    expect(exportedKeys).not.toContain('GeminiProvider')
  })
})
