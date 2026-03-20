/**
 * 기출 추출 응답 검증 모듈
 *
 * Gemini API가 시험지 이미지에서 추출한 문제 응답을
 * Zod 스키마로 검증하고, 타입 안전한 ExtractQuestionResult로 변환한다.
 *
 * 동일 Zod 스키마를 JSON Schema로도 변환하여
 * Gemini의 responseJsonSchema에 전달 (DRY 원칙).
 */

import { z } from 'zod'
import type { ExtractedQuestion, ExtractQuestionResult } from './types'
import { AIValidationError } from './errors'

// ─── Zod 스키마 ──────────────────────────────────────────

/** bounding box 스키마 (normalized 0~1) */
export const boundingBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
})

/** 그래프/그림 정보 스키마 */
export const figureInfoSchema = z.object({
  description: z.string().min(1),
  boundingBox: boundingBoxSchema,
  pageNumber: z.number().int().min(1),
  confidence: z.number().min(0).max(1),
})

/** AI가 추출한 단일 문제 스키마 */
export const extractedQuestionSchema = z.object({
  questionNumber: z.number().int().min(1),
  questionText: z.string().min(1),
  questionType: z.enum(['multiple_choice', 'short_answer', 'essay']),
  options: z.array(z.string()).optional(),
  answer: z.string().optional(),
  confidence: z.number().min(0).max(1),
  hasFigure: z.boolean(),
  figures: z.array(figureInfoSchema).optional(),
})

/** AI 추출 응답 전체 스키마 */
export const extractionResponseSchema = z.object({
  questions: z.array(extractedQuestionSchema),
})

// ─── JSON Schema 변환 (Gemini responseJsonSchema용) ──────

export const extractionJsonSchema = extractionResponseSchema.toJSONSchema()

// ─── 검증 함수 ───────────────────────────────────────────

/**
 * AI 추출 응답을 2단계로 검증하여 ExtractQuestionResult를 반환한다.
 *
 * 1단계: Zod safeParse (구문적 검증)
 * 2단계: 비즈니스 규칙 (객관식 보기, figures 일관성 등)
 */
export function validateExtractedQuestions(
  data: unknown,
): ExtractQuestionResult {
  // 1단계: Zod 구문적 검증
  const parsed = extractionResponseSchema.safeParse(data)

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }))
    throw new AIValidationError(
      'AI 추출 응답이 예상 형식과 일치하지 않습니다',
      details,
    )
  }

  // 2단계: 비즈니스 규칙 검증 + 결과 매핑
  const questions: ExtractedQuestion[] = parsed.data.questions.map((q) => {
    // 객관식인데 보기가 없으면 에러
    if (
      q.questionType === 'multiple_choice' &&
      (!q.options || q.options.length === 0)
    ) {
      throw new AIValidationError(
        `문제 ${q.questionNumber}: 객관식인데 보기가 없습니다`,
      )
    }

    // hasFigure=true인데 figures가 없으면 경고 (에러는 아님 — 부분 성공 허용)
    return {
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      questionType: q.questionType,
      options: q.options,
      answer: q.answer,
      confidence: q.confidence,
      hasFigure: q.hasFigure,
      figures: q.figures?.map((f) => ({
        url: null, // crop 전이므로 null — Step 5에서 채움
        description: f.description,
        boundingBox: f.boundingBox,
        pageNumber: f.pageNumber,
        confidence: f.confidence,
      })),
    }
  })

  // overallConfidence: 전체 문제의 평균 confidence
  const totalConfidence = questions.reduce((sum, q) => sum + q.confidence, 0)
  const overallConfidence =
    questions.length > 0 ? totalConfidence / questions.length : 0

  return {
    questions,
    totalQuestions: questions.length,
    overallConfidence,
  }
}
