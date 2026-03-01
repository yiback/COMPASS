/**
 * AI 생성 문제 저장 요청 검증
 * Zod 스키마 — MAX_QUESTION_COUNT는 공통 상수 파일에서 import
 *
 * 설계 결정:
 * - 입력은 AI 타입('essay')으로 받는다 → DB 변환은 Server Action 책임
 * - z.object() 기본 동작으로 unknown key를 자동 제거 (필드 인젝션 방지)
 * - MAX_QUESTION_COUNT를 별도 정의하지 않고 '@/lib/constants/questions'에서 가져온다
 *   → 생성(generate)과 저장(save)이 같은 상수를 공유 (Single Source of Truth)
 */

import { z } from 'zod'
import { MAX_QUESTION_COUNT } from '@/lib/constants/questions'

/**
 * 저장할 개별 문제 스키마
 *
 * type 필드는 AI 도메인 타입('essay')만 수락한다.
 * 'descriptive'(DB 타입)는 Server Action에서 변환되므로
 * 클라이언트에서 직접 DB 타입을 주입하려는 시도를 차단한다.
 */
export const questionToSaveSchema = z.object({
  content: z.string().min(1, '문제 내용이 비어있습니다.'),
  type: z.enum(['multiple_choice', 'short_answer', 'essay'], {
    message: '유효하지 않은 문제 유형입니다.',
  }),
  difficulty: z.enum(['easy', 'medium', 'hard'], {
    message: '유효하지 않은 난이도입니다.',
  }),
  answer: z.string().min(1, '정답이 비어있습니다.'),
  explanation: z.string().optional(),
  options: z.array(z.string()).optional(),
})

export const saveQuestionsRequestSchema = z.object({
  pastExamId: z.string().uuid('기출문제 ID가 유효하지 않습니다.'),
  questions: z
    .array(questionToSaveSchema)
    .min(1, '저장할 문제가 없습니다.')
    .max(
      MAX_QUESTION_COUNT,
      `한 번에 최대 ${MAX_QUESTION_COUNT}개까지 저장할 수 있습니다.`
    ),
})

/** saveQuestionsRequestSchema에서 추론된 타입 */
export type SaveQuestionsRequest = z.infer<typeof saveQuestionsRequestSchema>

/** questionToSaveSchema에서 추론된 타입 */
export type QuestionToSave = z.infer<typeof questionToSaveSchema>
