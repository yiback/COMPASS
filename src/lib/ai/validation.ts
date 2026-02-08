/**
 * AI 응답 검증 모듈
 *
 * Gemini API 응답을 Zod 스키마로 검증하고,
 * 타입 안전한 GeneratedQuestion[]로 변환한다.
 *
 * 동일 Zod 스키마를 JSON Schema로도 변환하여
 * Gemini의 responseJsonSchema에 전달 (DRY 원칙).
 */

import { z } from 'zod'
import type { GeneratedQuestion, QuestionType } from './types'
import { AIValidationError } from './errors'

/** 객관식 문제에 필요한 보기 수 */
const REQUIRED_OPTIONS_COUNT = 5

// ─── Zod 스키마 ──────────────────────────────────────────

/** AI 응답의 단일 문제 스키마 */
export const generatedQuestionSchema = z.object({
  content: z.string().min(1),
  answer: z.string().min(1),
  explanation: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  questionType: z.enum(['multiple_choice', 'short_answer', 'essay']),
  options: z.array(z.string()).optional(),
})

/** AI 응답 전체 스키마 (questions 배열 래퍼) */
export const generatedQuestionsResponseSchema = z.object({
  questions: z.array(generatedQuestionSchema),
})

// ─── JSON Schema 변환 (Gemini responseJsonSchema용) ──────

/**
 * Gemini API의 responseJsonSchema에 전달할 JSON Schema.
 * Zod 스키마에서 자동 변환하여 DRY 원칙을 지킨다.
 */
export const questionsJsonSchema =
  generatedQuestionsResponseSchema.toJSONSchema()

// ─── 검증 함수 ───────────────────────────────────────────

/**
 * AI 응답 데이터를 2단계로 검증하여 GeneratedQuestion[]를 반환한다.
 *
 * 1단계 (구문적): Zod safeParse로 필드/타입 검증
 * 2단계 (의미적): 객관식 보기 5개 필수 등 비즈니스 규칙 검증
 *
 * @throws AIValidationError - 검증 실패 시 (details에 세부 오류 포함)
 */
export function validateGeneratedQuestions(
  data: unknown,
): readonly GeneratedQuestion[] {
  // 1단계: Zod 구문적 검증
  const parsed = generatedQuestionsResponseSchema.safeParse(data)

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }))

    throw new AIValidationError(
      'AI 응답이 예상 형식과 일치하지 않습니다',
      details,
    )
  }

  // 2단계: 비즈니스 규칙 검증 + questionType → type 매핑
  return parsed.data.questions.map((q) => {
    if (q.questionType === 'multiple_choice') {
      if (!q.options || q.options.length !== REQUIRED_OPTIONS_COUNT) {
        throw new AIValidationError(
          `객관식 문제에 보기가 ${REQUIRED_OPTIONS_COUNT}개 필요합니다 (현재: ${q.options?.length ?? 0}개)`,
        )
      }
    }

    return {
      content: q.content,
      type: q.questionType as QuestionType,
      difficulty: q.difficulty,
      answer: q.answer,
      explanation: q.explanation,
      options: q.options,
    }
  })
}
