/**
 * 시험 관리 검증 스키마
 *
 * - createPastExamSchema: 시험 메타데이터 검증
 * - validateImages: 다중 이미지 검증 (수량/크기/MIME)
 * - updateExtractedQuestionSchema: 추출 문제 수정 검증
 * - createExtractedQuestionSchema: 수동 문제 추가 검증
 * - confirmExtractedQuestionsSchema: 문제 확정 검증
 */

import { z } from 'zod'

// ─── 상수 ────────────────────────────────────────────────

/** 이미지 검증 상한 (v8 반영) */
export const MAX_IMAGE_COUNT = 20
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 개별 5MB
export const MAX_TOTAL_SIZE = 100 * 1024 * 1024 // 총 100MB

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

/** 허용 파일 확장자 — MIME 위조 방어 (클라이언트 선언값만으로는 불충분) */
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const

export const EXAM_TYPES = ['midterm', 'final', 'mock', 'diagnostic'] as const

export const QUESTION_TYPES = [
  'multiple_choice',
  'short_answer',
  'essay',
] as const

// ─── 메타데이터 스키마 ────────────────────────────────────

export const createPastExamSchema = z.object({
  schoolId: z.string().min(1, '학교를 선택해주세요.'),
  year: z.coerce
    .number()
    .int()
    .min(2000, '연도는 2000 이상이어야 합니다.')
    .max(2100, '연도는 2100 이하여야 합니다.'),
  semester: z.coerce
    .number()
    .int()
    .min(1, '학기를 선택해주세요.')
    .max(2, '학기는 1 또는 2입니다.'),
  examType: z.enum(['midterm', 'final', 'mock', 'diagnostic'], {
    error: '시험 유형을 선택해주세요.',
  }),
  grade: z.coerce
    .number()
    .int()
    .min(1, '학년은 1 이상이어야 합니다.')
    .max(12, '학년은 12 이하여야 합니다.'),
  subject: z
    .string()
    .min(1, '과목을 입력해주세요.')
    .max(50, '과목은 50자 이하여야 합니다.'),
})

export type CreatePastExamInput = z.infer<typeof createPastExamSchema>

// ─── 이미지 검증 ─────────────────────────────────────────

export interface ImageValidationResult {
  readonly valid: boolean
  readonly error?: string
}

/** 다중 이미지 검증: 수량/개별크기/총크기/MIME 타입 */
export function validateImages(
  files: readonly File[]
): ImageValidationResult {
  if (files.length === 0) {
    return { valid: false, error: '이미지를 1장 이상 선택해주세요.' }
  }
  if (files.length > MAX_IMAGE_COUNT) {
    return {
      valid: false,
      error: `이미지는 최대 ${MAX_IMAGE_COUNT}장까지 업로드할 수 있습니다.`,
    }
  }

  let totalSize = 0
  for (const file of files) {
    if (file.size > MAX_IMAGE_SIZE) {
      return {
        valid: false,
        error: `개별 이미지 크기는 ${MAX_IMAGE_SIZE / (1024 * 1024)}MB 이하여야 합니다.`,
      }
    }
    // MIME 타입 검사 (클라이언트 선언값)
    if (
      !ALLOWED_IMAGE_TYPES.includes(
        file.type as (typeof ALLOWED_IMAGE_TYPES)[number]
      )
    ) {
      return { valid: false, error: '허용된 이미지 형식: JPEG, PNG, WebP' }
    }
    // 확장자 검사 — MIME 위조 방어 (이중 검증)
    const ext = file.name.toLowerCase().split('.').pop()
    if (
      !ext ||
      !ALLOWED_EXTENSIONS.includes(`.${ext}` as (typeof ALLOWED_EXTENSIONS)[number])
    ) {
      return { valid: false, error: '허용된 이미지 형식: JPEG, PNG, WebP' }
    }
    totalSize += file.size
  }

  if (totalSize > MAX_TOTAL_SIZE) {
    return {
      valid: false,
      error: `전체 이미지 크기는 ${MAX_TOTAL_SIZE / (1024 * 1024)}MB 이하여야 합니다.`,
    }
  }

  return { valid: true }
}

// ─── 추출 문제 수정 스키마 ────────────────────────────────

export const updateExtractedQuestionSchema = z.object({
  questionText: z.string().min(1, '문제 내용을 입력해주세요.'),
  questionType: z.enum(['multiple_choice', 'short_answer', 'essay'], {
    error: '문제 유형을 선택해주세요.',
  }),
  options: z.array(z.string()).optional(),
  answer: z.string().optional(),
})

export type UpdateExtractedQuestionInput = z.infer<
  typeof updateExtractedQuestionSchema
>

// ─── 수동 문제 추가 스키마 ────────────────────────────────

export const createExtractedQuestionSchema = z.object({
  questionNumber: z.number().int().min(1, '문제 번호는 1 이상이어야 합니다.'),
  questionText: z.string().min(1, '문제 내용을 입력해주세요.'),
  questionType: z.enum(['multiple_choice', 'short_answer', 'essay'], {
    error: '문제 유형을 선택해주세요.',
  }),
  options: z.array(z.string()).optional(),
  answer: z.string().optional(),
})

export type CreateExtractedQuestionInput = z.infer<
  typeof createExtractedQuestionSchema
>

// ─── 문제 확정 스키마 ────────────────────────────────────

export const confirmExtractedQuestionsSchema = z.object({
  pastExamId: z.string().min(1, '시험 ID가 필요합니다.'),
})

export type ConfirmExtractedQuestionsInput = z.infer<
  typeof confirmExtractedQuestionsSchema
>
