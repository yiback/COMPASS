/**
 * 학원 관리 Zod 검증 스키마
 *
 * - 학원 수정: name, address, phone, logoUrl
 * - 생성 스키마 없음: 학원은 테넌트(멀티테넌시 최상위 단위)
 *   system_admin만 학원을 생성할 수 있으며, 이는 MVP 범위 밖
 */

import { z } from 'zod'

// ─── 학원 수정 스키마 ──────────────────────────────────

export const academyUpdateSchema = z.object({
  name: z
    .string()
    .min(1, '학원명을 입력해주세요.')
    .max(100, '학원명은 100자 이하여야 합니다.'),
  address: z
    .string()
    .max(200, '주소는 200자 이하여야 합니다.')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .max(20, '전화번호는 20자 이하여야 합니다.')
    .optional()
    .or(z.literal('')),
  logoUrl: z
    .string()
    .url('올바른 URL 형식이 아닙니다.')
    .or(z.literal(''))
    .optional(),
})

export type AcademyUpdateInput = z.infer<typeof academyUpdateSchema>
