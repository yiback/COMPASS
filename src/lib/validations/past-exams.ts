/**
 * 기출문제 업로드 검증
 * Zod 스키마 + 파일 검증 유틸리티
 */

import { z } from 'zod'

// ─── 상수 ────────────────────────────────────────────────

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const

export const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export const EXAM_TYPES = ['midterm', 'final', 'mock', 'diagnostic'] as const

// ─── 메타데이터 스키마 ────────────────────────────────────

export const pastExamUploadSchema = z.object({
  schoolId: z.string().uuid('학교를 선택해주세요.'),
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
  examType: z
    .string()
    .refine(
      (val) => ['midterm', 'final', 'mock', 'diagnostic'].includes(val),
      { message: '시험 유형을 선택해주세요.' }
    ),
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

export type PastExamUploadInput = z.infer<typeof pastExamUploadSchema>

// ─── 파일 검증 함수 (Server Action에서 사용) ──────────────

export interface FileValidationResult {
  readonly valid: boolean
  readonly error?: string
}

export function validateFile(file: unknown): FileValidationResult {
  if (!(file instanceof File)) {
    return { valid: false, error: '파일을 선택해주세요.' }
  }

  if (file.size === 0) {
    return { valid: false, error: '빈 파일은 업로드할 수 없습니다.' }
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: '파일 크기는 5MB 이하여야 합니다.' }
  }

  if (
    !ALLOWED_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_MIME_TYPES)[number]
    )
  ) {
    return { valid: false, error: '허용된 파일 형식: JPEG, PNG, WebP, PDF' }
  }

  return { valid: true }
}

// ─── 파일 확장자 추출 ─────────────────────────────────────

export function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  if (parts.length === 1) {
    // 확장자가 없는 경우
    return 'bin'
  }
  const ext = parts.pop()?.toLowerCase()
  return ext ?? 'bin'
}
