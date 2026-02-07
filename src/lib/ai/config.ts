/**
 * AI 서비스 환경변수 검증 및 설정 관리
 *
 * Zod 스키마로 환경변수를 검증하고 타입 안전한 설정 객체를 반환한다.
 * 캐싱으로 반복 호출 시 동일 객체를 재사용한다.
 */

import { z } from 'zod'
import { AIConfigError } from './errors'

/**
 * 환경변수 문자열을 숫자로 변환하는 Zod 스키마
 * - 유효한 숫자 문자열 → number (예: '5' → 5)
 * - NaN이 되는 값 → undefined (후속 .default()로 기본값 적용)
 * - undefined/빈 문자열 → undefined
 *
 * z.coerce.number()는 'not-a-number' → NaN → 범위 검증 실패 → 에러를 던지므로
 * "기본값 fallback" 요구사항을 충족할 수 없다. 그래서 커스텀 transform을 사용한다.
 */
const coerceNumber = z
  .string()
  .optional()
  .transform((val) => {
    if (val === undefined || val === '') return undefined
    const num = Number(val)
    return Number.isNaN(num) ? undefined : num
  })

const aiConfigSchema = z.object({
  apiKey: z.string().min(1, 'GEMINI_API_KEY는 필수입니다'),
  model: z.string().default('gemini-2.0-flash'),
  provider: z.string().default('gemini'),
  maxRetries: coerceNumber.pipe(z.number().int().min(1).max(10).default(3)),
  timeoutMs: coerceNumber.pipe(z.number().int().min(1000).max(120_000).default(30_000)),
})

export type AIConfig = z.infer<typeof aiConfigSchema>

let cachedConfig: AIConfig | null = null

export function getAIConfig(): AIConfig {
  if (cachedConfig) return cachedConfig

  const result = aiConfigSchema.safeParse({
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
    provider: process.env.AI_PROVIDER,
    maxRetries: process.env.AI_MAX_RETRIES,
    timeoutMs: process.env.AI_TIMEOUT_MS,
  })

  if (!result.success) {
    const messages = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ')

    throw new AIConfigError(`AI 설정 검증 실패: ${messages}`)
  }

  cachedConfig = result.data
  return cachedConfig
}
