/**
 * 기출 추출/재추출/재분석 검증 스키마
 *
 * - extractQuestionsSchema: 추출 요청 (pastExamId)
 * - resetExtractionSchema: 재추출 요청 (pastExamId)
 * - reanalyzeQuestionSchema: 재분석 요청 (detailId + 선택적 feedback)
 *
 * .min(1) 사용 (.uuid() 아님) — 시드 데이터의 비표준 UUID 호환
 */

import { z } from 'zod'

// ─── 추출 요청 ────────────────────────────────────────────

export const extractQuestionsSchema = z.object({
  pastExamId: z.string().min(1, '시험 ID가 필요합니다'),
})

export type ExtractQuestionsInput = z.infer<typeof extractQuestionsSchema>

// ─── 재추출 요청 ──────────────────────────────────────────

export const resetExtractionSchema = z.object({
  pastExamId: z.string().min(1, '시험 ID가 필요합니다'),
})

export type ResetExtractionInput = z.infer<typeof resetExtractionSchema>

// ─── 재분석 요청 ──────────────────────────────────────────

export const reanalyzeQuestionSchema = z.object({
  detailId: z.string().min(1, '문제 ID가 필요합니다'),
  feedback: z.string().max(500).optional(),
})

export type ReanalyzeQuestionInput = z.infer<typeof reanalyzeQuestionSchema>
