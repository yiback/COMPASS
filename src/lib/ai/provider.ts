/**
 * AI Provider Factory 함수
 *
 * 타입 인자 또는 환경변수를 기반으로 적절한 AIProvider 인스턴스를 생성한다.
 * 우선순위: type 인자 > AI_PROVIDER 환경변수 > 기본값 'gemini'
 */

import type { AIProvider, ProviderType } from './types'
import { GeminiProvider } from './gemini'
import { AIConfigError } from './errors'

const DEFAULT_PROVIDER: ProviderType = 'gemini'

/**
 * AI Provider 인스턴스를 생성한다.
 *
 * @param type - 사용할 AI 제공자 타입 (생략 시 환경변수 또는 기본값 사용)
 * @returns AIProvider 인스턴스
 * @throws AIConfigError - 지원하지 않는 타입을 지정한 경우
 */
export function createAIProvider(type?: string): AIProvider {
  const resolvedType = type ?? process.env.AI_PROVIDER ?? DEFAULT_PROVIDER

  switch (resolvedType) {
    case 'gemini':
      return new GeminiProvider()
    default:
      throw new AIConfigError(
        `지원하지 않는 AI Provider: ${resolvedType}`,
      )
  }
}
