/**
 * AI 문제 생성 요청 검증
 * Zod 스키마 + MAX_QUESTION_COUNT 상수
 */

import { z } from 'zod'

/** 문제 생성 요청 최대 문제 수 (API 비용 관리) */
export const MAX_QUESTION_COUNT = 10

export const generateQuestionsRequestSchema = z.object({
  pastExamId: z.string().uuid('기출문제 ID가 유효하지 않습니다.'),
  questionType: z.enum(['multiple_choice', 'short_answer', 'essay'], {
    message: '문제 유형을 선택해주세요.',
  }),
  difficulty: z.enum(['easy', 'medium', 'hard'], {
    message: '난이도를 선택해주세요.',
  }),
  count: z.coerce
    .number()
    .int('문제 수는 정수여야 합니다.')
    .min(1, '최소 1문제 이상이어야 합니다.')
    .max(
      MAX_QUESTION_COUNT,
      `최대 ${MAX_QUESTION_COUNT}문제까지 생성 가능합니다.`
    ),
})

export type GenerateQuestionsRequest = z.infer<
  typeof generateQuestionsRequestSchema
>
