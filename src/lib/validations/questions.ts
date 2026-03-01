/**
 * 문제 목록 필터 Zod 스키마
 *
 * 패턴: pastExamFilterSchema (past-exams.ts) 재활용
 * - URL searchParams는 항상 문자열 → z.coerce 사용
 * - 'all'을 각 Select의 기본값으로 사용 (빈 문자열 → undefined 패턴 대신)
 */

import { z } from 'zod'

export const questionFilterSchema = z.object({
  // 과목 텍스트 검색 (debounce Input)
  subject: z.string().optional(),

  // 학교유형 Select (schoolType 변경 시 grade Select 연동)
  schoolType: z
    .enum(['elementary', 'middle', 'high', 'all'])
    .optional()
    .default('all'),

  // 학년 Select (schoolType에 따라 동적 옵션)
  grade: z.coerce.number().int().min(1).max(12).optional(),

  // 문제유형 Select (DB 타입 기준 — essay 아닌 descriptive)
  type: z
    .enum(['multiple_choice', 'short_answer', 'descriptive', 'all'])
    .optional()
    .default('all'),

  // 난이도 Select (1~5)
  difficulty: z.coerce.number().int().min(1).max(5).optional(),

  // 출처유형 Select
  sourceType: z
    .enum(['past_exam', 'textbook', 'self_made', 'ai_generated', 'all'])
    .optional()
    .default('all'),

  // 페이지 번호
  page: z.coerce.number().int().min(1).optional().default(1),
})

export type QuestionFilterInput = z.infer<typeof questionFilterSchema>
