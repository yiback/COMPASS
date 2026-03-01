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

// ─── 난이도 매핑 ─────────────────────────────────────────

/** AI 프롬프트에서 사용하는 난이도 레벨 */
export type DifficultyLevel = 'easy' | 'medium' | 'hard'

/**
 * AI 난이도 문자열 → DB 정수 매핑
 *
 * DB 스키마: 1(매우쉬움) ~ 5(매우어려움)
 * AI 생성 문제는 2(쉬움), 3(보통), 4(어려움) 범위를 사용한다.
 *
 * `as const`: 리터럴 타입 고정 (number가 아닌 2 | 3 | 4 타입)
 * `satisfies Record<DifficultyLevel, number>`: 키 누락 시 컴파일 에러
 */
const DIFFICULTY_TO_NUMBER = {
  easy: 2,
  medium: 3,
  hard: 4,
} as const satisfies Record<DifficultyLevel, number>

/**
 * DB 정수 → AI 난이도 문자열 역매핑
 *
 * `as const`를 사용하지 않는 이유:
 * - 키가 number 타입 → TypeScript가 Record<number, DifficultyLevel>로 추론
 * - 특정 리터럴(2 | 3 | 4) 타입이 필요하지 않으므로 `satisfies`만 사용
 */
const NUMBER_TO_DIFFICULTY: Record<number, DifficultyLevel> = {
  2: 'easy',
  3: 'medium',
  4: 'hard',
}

/** AI 난이도 문자열 → DB 정수 변환 */
export function toDifficultyNumber(difficulty: DifficultyLevel): number {
  return DIFFICULTY_TO_NUMBER[difficulty]
}

/**
 * DB 정수 → AI 난이도 문자열 변환
 *
 * 매핑에 없는 정수(1, 5 등)는 'medium'을 반환한다.
 * throw하지 않는 이유: DB에 1이나 5가 저장되어 있어도
 * UI가 중단되지 않아야 하며, 'medium'은 안전한 폴백이다.
 */
export function fromDifficultyNumber(num: number): DifficultyLevel {
  return NUMBER_TO_DIFFICULTY[num] ?? 'medium'
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
  readonly systemInstruction: string
  readonly userPrompt: string
  readonly responseSchema: unknown
  readonly temperature: number
  readonly maxOutputTokens: number
}

// ─── 기출 컨텍스트 (1-7 추가) ────────────────────────────

/** 기출문제 참고 AI 문제 생성 시 전달되는 컨텍스트 */
export interface PastExamContext {
  readonly pastExamId: string
  readonly schoolName: string
  readonly year: number
  readonly semester: number
  readonly examType: string
  readonly extractedContent?: string // OCR 추출 또는 수동 입력된 기출 내용
}

// ─── 문제 생성 ──────────────────────────────────────────

export interface GenerateQuestionParams {
  readonly subject: string
  readonly grade: number
  readonly questionType: QuestionType
  readonly count: number
  readonly difficulty: 'easy' | 'medium' | 'hard'
  readonly unit?: string
  readonly topics?: readonly string[]
  readonly schoolName?: string
  readonly pastExamContext?: PastExamContext // 1-7 추가: 기출 기반 생성 시
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
