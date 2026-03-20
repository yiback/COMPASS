/**
 * Gemini AI Provider 구현체
 *
 * @google/genai SDK를 사용하여 AIProvider 인터페이스를 구현한다.
 * 현재 generateQuestions만 완전 구현, 나머지 3개 메서드는 Phase 2-3 stub.
 */

import { GoogleGenAI } from '@google/genai'
import type {
  AIProvider,
  GenerateQuestionParams,
  GeneratedQuestion,
  GradeAnswerParams,
  GradingResult,
  OCRParams,
  OCRResult,
  AnalyzeTrendsParams,
  ExamTrendAnalysis,
  ExtractQuestionParams,
  ExtractQuestionResult,
  ReanalyzeQuestionParams,
  ExtractedQuestion,
  PromptConfig,
} from './types'
import {
  AIError,
  AIServiceError,
  AIValidationError,
  AIRateLimitError,
} from './errors'
import { getAIConfig } from './config'
import { withRetry } from './retry'
import { validateGeneratedQuestions, questionsJsonSchema } from './validation'
import { buildQuestionGenerationPrompt } from './prompts/question-generation'
import { buildPastExamGenerationPrompt } from './prompts/past-exam-generation'
import { validateExtractedQuestions } from './extraction-validation'
import { buildExtractionPrompt, buildReanalyzePrompt } from './prompts/question-extraction'

// ─── SDK 에러 변환 ──────────────────────────────────────────

/**
 * SDK 에러를 프로젝트 에러 계층으로 변환한다.
 *
 * Duck typing으로 ApiError를 판별한다:
 * - vi.mock 환경에서 instanceof 신뢰 불가
 * - plain object로 에러 시뮬레이션 가능해야 함
 */
function convertSdkError(error: unknown): AIError {
  if (
    error instanceof Error &&
    error.name === 'ApiError' &&
    'status' in error
  ) {
    const status = (error as Record<string, unknown>).status as number

    if (status === 429) {
      return new AIRateLimitError(
        'Gemini API 요청 한도를 초과했습니다',
        undefined,
        error,
      )
    }

    return new AIServiceError(
      `Gemini API 오류: ${error.message}`,
      status,
      error,
    )
  }

  // 일반 Error (네트워크 타임아웃 등)
  const cause = error instanceof Error ? error : undefined
  return new AIServiceError(
    `Gemini API 호출 실패: ${cause?.message ?? '알 수 없는 오류'}`,
    undefined,
    cause,
  )
}

// ─── GeminiProvider ─────────────────────────────────────────

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini' as const

  private readonly client: GoogleGenAI
  private readonly model: string
  private readonly maxRetries: number

  constructor() {
    const config = getAIConfig()
    this.client = new GoogleGenAI({ apiKey: config.apiKey })
    this.model = config.model
    this.maxRetries = config.maxRetries
  }

  /**
   * PromptConfig로부터 Gemini SDK의 contents를 구성한다.
   *
   * imageParts가 있으면 Part 배열 (이미지 + 텍스트),
   * 없으면 기존 동작 유지 (문자열).
   */
  private buildContents(
    prompt: PromptConfig,
  ): string | Array<Record<string, unknown>> {
    if (!prompt.imageParts || prompt.imageParts.length === 0) {
      return prompt.userPrompt // 기존 동작 유지
    }

    // imageParts가 있으면 Part 배열로 구성
    return [
      ...prompt.imageParts.map((img) => ({
        inlineData: { mimeType: img.mimeType, data: img.data },
      })),
      { text: prompt.userPrompt },
    ]
  }

  async generateQuestions(
    params: GenerateQuestionParams,
  ): Promise<readonly GeneratedQuestion[]> {
    const prompt = params.pastExamContext
      ? buildPastExamGenerationPrompt(params)
      : buildQuestionGenerationPrompt(params)

    return withRetry(
      async () => {
        try {
          const response = await this.client.models.generateContent({
            model: this.model,
            contents: this.buildContents(prompt),
            config: {
              systemInstruction: prompt.systemInstruction,
              responseMimeType: 'application/json',
              responseJsonSchema: prompt.responseSchema,
              temperature: prompt.temperature,
              maxOutputTokens: prompt.maxOutputTokens,
            },
          })

          const text = response.text
          if (text === undefined || text === null) {
            throw new AIValidationError('Gemini 응답에 텍스트가 없습니다')
          }

          let parsed: unknown
          try {
            parsed = JSON.parse(text)
          } catch {
            throw new AIValidationError(
              'Gemini 응답을 JSON으로 파싱할 수 없습니다',
            )
          }

          return validateGeneratedQuestions(parsed)
        } catch (error) {
          // AIError 계열은 재변환 방지 — 그대로 re-throw
          if (error instanceof AIError) {
            throw error
          }
          throw convertSdkError(error)
        }
      },
      { maxRetries: this.maxRetries },
    )
  }

  async extractQuestions(
    params: ExtractQuestionParams,
  ): Promise<ExtractQuestionResult> {
    const prompt = buildExtractionPrompt(params)

    return withRetry(
      async () => {
        try {
          const response = await this.client.models.generateContent({
            model: this.model,
            contents: this.buildContents(prompt),
            config: {
              systemInstruction: prompt.systemInstruction,
              responseMimeType: 'application/json',
              responseJsonSchema: prompt.responseSchema,
              temperature: prompt.temperature,
              maxOutputTokens: prompt.maxOutputTokens,
            },
          })

          const text = response.text
          if (text === undefined || text === null) {
            throw new AIValidationError('Gemini 응답에 텍스트가 없습니다')
          }

          let parsed: unknown
          try {
            parsed = JSON.parse(text)
          } catch {
            throw new AIValidationError(
              'Gemini 응답을 JSON으로 파싱할 수 없습니다',
            )
          }

          return validateExtractedQuestions(parsed)
        } catch (error) {
          if (error instanceof AIError) {
            throw error
          }
          throw convertSdkError(error)
        }
      },
      { maxRetries: this.maxRetries },
    )
  }

  async reanalyzeQuestion(
    params: ReanalyzeQuestionParams,
  ): Promise<ExtractedQuestion> {
    const prompt = buildReanalyzePrompt(params)

    return withRetry(
      async () => {
        try {
          const response = await this.client.models.generateContent({
            model: this.model,
            contents: this.buildContents(prompt),
            config: {
              systemInstruction: prompt.systemInstruction,
              responseMimeType: 'application/json',
              responseJsonSchema: prompt.responseSchema,
              temperature: prompt.temperature,
              maxOutputTokens: prompt.maxOutputTokens,
            },
          })

          const text = response.text
          if (text === undefined || text === null) {
            throw new AIValidationError('Gemini 응답에 텍스트가 없습니다')
          }

          let parsed: unknown
          try {
            parsed = JSON.parse(text)
          } catch {
            throw new AIValidationError(
              'Gemini 응답을 JSON으로 파싱할 수 없습니다',
            )
          }

          const result = validateExtractedQuestions(parsed)

          // 재분석은 1개 문제만 반환해야 함
          if (result.questions.length !== 1) {
            throw new AIValidationError(
              `재분석 결과에 ${result.questions.length}개 문제가 반환됨 (1개 기대)`,
            )
          }

          return result.questions[0]
        } catch (error) {
          if (error instanceof AIError) {
            throw error
          }
          throw convertSdkError(error)
        }
      },
      { maxRetries: this.maxRetries },
    )
  }

  async gradeAnswer(_params: GradeAnswerParams): Promise<GradingResult> {
    throw new AIServiceError('gradeAnswer는 Phase 2에서 구현 예정입니다')
  }

  async processOCR(_params: OCRParams): Promise<OCRResult> {
    throw new AIServiceError('processOCR은 Phase 3에서 구현 예정입니다')
  }

  async analyzeTrends(
    _params: AnalyzeTrendsParams,
  ): Promise<ExamTrendAnalysis> {
    throw new AIServiceError('analyzeTrends는 Phase 3에서 구현 예정입니다')
  }
}
