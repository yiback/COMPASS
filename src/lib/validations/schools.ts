/**
 * 학교 관리 Zod 검증 스키마
 *
 * - 학교 생성/수정: name, schoolType, region, district, address
 * - 학교 목록 필터: search, schoolType, page
 */

import { z } from 'zod'

// ─── 학교 기본 스키마 ──────────────────────────────────

export const schoolSchema = z.object({
  name: z
    .string()
    .min(1, '학교명을 입력해주세요.')
    .max(100, '학교명은 100자 이하여야 합니다.'),
  schoolType: z
    .string()
    .refine(
      (val) => ['elementary', 'middle', 'high'].includes(val),
      { message: '학교 유형을 선택해주세요.' }
    ),
  region: z
    .string()
    .max(50, '지역은 50자 이하여야 합니다.')
    .optional()
    .or(z.literal('')),
  district: z
    .string()
    .max(50, '구/군은 50자 이하여야 합니다.')
    .optional()
    .or(z.literal('')),
  address: z
    .string()
    .max(200, '주소는 200자 이하여야 합니다.')
    .optional()
    .or(z.literal('')),
})

export type SchoolInput = z.infer<typeof schoolSchema>

// ─── 학교 수정 스키마 (ID 포함) ──────────────────────

export const updateSchoolSchema = schoolSchema.extend({
  id: z.string().uuid('올바른 ID 형식이 아닙니다.'),
})

export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>

// ─── 학교 목록 필터 스키마 ──────────────────────────

export const schoolFilterSchema = z.object({
  search: z.string().optional(),
  schoolType: z
    .enum(['elementary', 'middle', 'high', 'all'])
    .optional()
    .default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
})

export type SchoolFilterInput = z.infer<typeof schoolFilterSchema>
