// src/lib/ai/index.ts
// AI 모듈 공개 API — 외부에서는 '@/lib/ai'로만 접근

// 팩토리 함수
export { createAIProvider } from './provider'

// 타입
export type {
  AIProvider,
  DifficultyLevel,        // 난이도 매핑 타입 추가
  GenerateQuestionParams,
  GeneratedQuestion,
  PastExamContext,
  PromptConfig,
  ProviderType,
  QuestionType,
} from './types'

// 매핑 함수
export {
  toDbQuestionType,
  fromDbQuestionType,
  toDifficultyNumber,
  fromDifficultyNumber,
} from './types'

// 에러 클래스
export {
  AIError,
  AIServiceError,
  AIValidationError,
  AIRateLimitError,
  AIConfigError,
} from './errors'
