/**
 * 사용자 관리 Zod 검증 스키마
 *
 * - 사용자 목록 필터: search, role, isActive, page
 * - 역할 변경: userId, newRole (system_admin 제외)
 * - 활성화/비활성화 토글: userId, isActive
 */

import { z } from 'zod'

// ─── 사용자 목록 필터 스키마 ──────────────────────────

export const userFilterSchema = z.object({
  search: z.string().optional(),
  role: z
    .enum(['student', 'teacher', 'admin', 'all'])
    .optional()
    .default('all'),
  isActive: z
    .enum(['true', 'false', 'all'])
    .optional()
    .default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
})

export type UserFilterInput = z.infer<typeof userFilterSchema>

// ─── 역할 변경 스키마 ──────────────────────────────────

export const roleChangeSchema = z.object({
  userId: z.string().uuid('올바른 사용자 ID가 아닙니다.'),
  newRole: z.enum(['student', 'teacher', 'admin'], {
    message: '유효하지 않은 역할입니다.',
  }),
})

export type RoleChangeInput = z.infer<typeof roleChangeSchema>

// ─── 활성화/비활성화 토글 스키마 ────────────────────────

export const toggleActiveSchema = z.object({
  userId: z.string().uuid('올바른 사용자 ID가 아닙니다.'),
  isActive: z.boolean(),
})

export type ToggleActiveInput = z.infer<typeof toggleActiveSchema>
