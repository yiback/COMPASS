// src/lib/ai/index.ts
// AI 모듈 공개 API — 외부에서는 '@/lib/ai'로만 접근

// 팩토리 함수
export { createAIProvider } from './provider'

// 타입
export type {
  AIProvider,
  GenerateQuestionParams,
  GeneratedQuestion,
  PromptConfig,
  ProviderType,
  QuestionType,
} from './types'

// 에러 클래스
export {
  AIError,
  AIServiceError,
  AIValidationError,
  AIRateLimitError,
  AIConfigError,
} from './errors'
