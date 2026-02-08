/**
 * AI 서비스 타입 정의
 *
 * Factory + Strategy 패턴의 핵심 인터페이스와
 * 문제 생성, 채점, OCR, 경향 분석 관련 타입을 정의한다.
 *
 * Zod 스키마는 validation.ts(Step 6)에 배치하여
 * 이 파일은 순수 TypeScript 타입만 포함한다.
 */

// ─── 공통 타입 ──────────────────────────────────────────

/** AI 프롬프트에서 사용하는 문제 유형 (essay = 서술형) */
export type QuestionType = 'multiple_choice' | 'short_answer' | 'essay'

/** DB 스키마의 문제 유형 (descriptive = 서술형) */
export type DbQuestionType = 'multiple_choice' | 'short_answer' | 'descriptive'

/** 지원하는 AI 제공자 */
export type ProviderType = 'gemini'

// ─── 매핑 함수 ──────────────────────────────────────────

/**
 * Record 기반 매핑 — 새 유형 추가 시 TypeScript가
 * "Property 'new_type' is missing" 컴파일 에러로 누락을 방지한다.
 */
const AI_TO_DB_MAP = {
  multiple_choice: 'multiple_choice',
  short_answer: 'short_answer',
  essay: 'descriptive',
} as const satisfies Record<QuestionType, DbQuestionType>

const DB_TO_AI_MAP = {
  multiple_choice: 'multiple_choice',
  short_answer: 'short_answer',
  descriptive: 'essay',
} as const satisfies Record<DbQuestionType, QuestionType>

/** AI 문제 유형 → DB 문제 유형 변환 */
export function toDbQuestionType(type: QuestionType): DbQuestionType {
  return AI_TO_DB_MAP[type]
}

/** DB 문제 유형 → AI 문제 유형 변환 */
export function fromDbQuestionType(type: DbQuestionType): QuestionType {
  return DB_TO_AI_MAP[type]
}

// ─── AI Provider 인터페이스 (Strategy 패턴) ─────────────

/** 모든 AI 제공자가 구현해야 할 인터페이스 */
export interface AIProvider {
  readonly name: ProviderType

  /** 시험 문제 생성 */
  generateQuestions(params: GenerateQuestionParams): Promise<readonly GeneratedQuestion[]>

  /** 서술형 답안 채점 (Phase 2 구현 예정) */
  gradeAnswer(params: GradeAnswerParams): Promise<GradingResult>

  /** 시험지 이미지 OCR (Phase 3 구현 예정) */
  processOCR(params: OCRParams): Promise<OCRResult>

  /** 기출 경향 분석 (Phase 3 구현 예정) */
  analyzeTrends(params: AnalyzeTrendsParams): Promise<ExamTrendAnalysis>
}

// ─── 프롬프트 설정 ──────────────────────────────────────

export interface PromptConfig {
  readonly template: string
  readonly maxTokens: number
  readonly temperature: number
}

// ─── 문제 생성 ──────────────────────────────────────────

export interface GenerateQuestionParams {
  readonly subject: string
  readonly grade: number
  readonly questionType: QuestionType
  readonly count: number
  readonly difficulty: 'easy' | 'medium' | 'hard'
  readonly topics?: readonly string[]
  readonly schoolName?: string
}

export interface GeneratedQuestion {
  readonly content: string
  readonly type: QuestionType
  readonly difficulty: 'easy' | 'medium' | 'hard'
  readonly answer: string
  readonly explanation?: string
  readonly options?: readonly string[]
}

// ─── 채점 (Phase 2 구현 예정) ───────────────────────────

export interface GradeAnswerParams {
  readonly questionContent: string
  readonly questionType: QuestionType
  readonly correctAnswer: string
  readonly studentAnswer: string
  readonly maxScore: number
}

export interface GradingResult {
  readonly score: number
  readonly maxScore: number
  readonly feedback: string
}

// ─── OCR (Phase 3 구현 예정) ────────────────────────────

export interface OCRParams {
  readonly imageUrl: string
  readonly subject: string
}

export interface OCRResult {
  readonly extractedText: string
  readonly confidence: number
  readonly questions: readonly GeneratedQuestion[]
}

// ─── 경향 분석 (Phase 3 구현 예정) ──────────────────────

export interface AnalyzeTrendsParams {
  readonly schoolId: string
  readonly subject: string
  readonly years: readonly number[]
}

export interface ExamTrendAnalysis {
  readonly frequentTopics: readonly string[]
  readonly difficultyDistribution: Record<string, number>
  readonly recommendations: readonly string[]
}
