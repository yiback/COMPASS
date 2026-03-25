/**
 * 성취기준 관리 Zod 검증 스키마
 *
 * - 생성: code, content, subject, grade (필수) + 선택 필드
 * - 수정: content, keywords, unit, sub_unit, source_name, source_url만 편집 가능
 * - 필터: subject, grade, semester, unit, search, isActive
 *
 * DB 제약조건 교차 검증:
 * - code: TEXT NOT NULL UNIQUE → .min(1).max(20)
 * - content: TEXT NOT NULL → .min(1).max(1000)
 * - grade: CHECK 1-12 → .min(1).max(12)
 * - semester: CHECK 1,2 → .min(1).max(2)
 */

import { z } from 'zod'

// ─── 성취기준 생성 스키마 ──────────────────────────────────

export const achievementStandardCreateSchema = z.object({
  code: z
    .string()
    .min(1, '성취기준 코드를 입력해주세요.')
    .max(20, '코드는 20자 이하여야 합니다.'),
  content: z
    .string()
    .min(1, '성취기준 내용을 입력해주세요.')
    .max(1000, '내용은 1000자 이하여야 합니다.'),
  subject: z
    .string()
    .min(1, '과목을 입력해주세요.'),
  grade: z.coerce
    .number()
    .int()
    .min(1, '학년은 1 이상이어야 합니다.')
    .max(12, '학년은 12 이하여야 합니다.'),
  semester: z.coerce
    .number()
    .int()
    .min(1)
    .max(2)
    .optional(),
  unit: z
    .string()
    .max(100, '단원은 100자 이하여야 합니다.')
    .optional()
    .or(z.literal('')),
  sub_unit: z
    .string()
    .max(100, '소단원은 100자 이하여야 합니다.')
    .optional()
    .or(z.literal('')),
  keywords: z
    .array(z.string())
    .default([]),
  source_name: z
    .string()
    .max(100, '출처명은 100자 이하여야 합니다.')
    .optional()
    .or(z.literal('')),
  source_url: z
    .string()
    .url('올바른 URL 형식이 아닙니다.')
    .optional()
    .or(z.literal('')),
  order_in_semester: z.coerce
    .number()
    .int()
    .min(1)
    .optional(),
  effective_year: z.coerce
    .number()
    .int()
    .min(2000)
    .max(2100)
    .optional(),
  curriculum_version: z
    .string()
    .default('2022'),
})

export type AchievementStandardCreateInput = z.infer<typeof achievementStandardCreateSchema>

// ─── 성취기준 수정 스키마 (편집 가능 필드만) ──────────────

export const achievementStandardUpdateSchema = z.object({
  content: z
    .string()
    .min(1, '성취기준 내용을 입력해주세요.')
    .max(1000, '내용은 1000자 이하여야 합니다.')
    .optional(),
  keywords: z
    .array(z.string())
    .optional(),
  unit: z
    .string()
    .max(100, '단원은 100자 이하여야 합니다.')
    .optional()
    .or(z.literal('')),
  sub_unit: z
    .string()
    .max(100, '소단원은 100자 이하여야 합니다.')
    .optional()
    .or(z.literal('')),
  source_name: z
    .string()
    .max(100, '출처명은 100자 이하여야 합니다.')
    .optional()
    .or(z.literal('')),
  source_url: z
    .string()
    .url('올바른 URL 형식이 아닙니다.')
    .optional()
    .or(z.literal('')),
})

export type AchievementStandardUpdateInput = z.infer<typeof achievementStandardUpdateSchema>

// ─── 성취기준 필터 스키마 ──────────────────────────────────

export const achievementStandardFilterSchema = z.object({
  subject: z.string().optional(),
  grade: z.coerce.number().int().min(1).max(12).optional(),
  semester: z.coerce.number().int().min(1).max(2).optional(),
  unit: z.string().optional(),
  search: z.string().optional(),
  isActive: z
    .enum(['true', 'false', 'all'])
    .optional()
    .default('true'),
})

export type AchievementStandardFilterInput = z.infer<typeof achievementStandardFilterSchema>
