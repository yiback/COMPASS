/**
 * 학원 관리 Server Actions
 */

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { academyUpdateSchema } from '@/lib/validations/academies'
import { getCurrentUser } from './helpers'

// ============================================================================
// 타입 정의
// ============================================================================

export interface AcademyData {
  readonly id: string
  readonly name: string
  readonly address: string | null
  readonly phone: string | null
  readonly logoUrl: string | null
  readonly inviteCode: string | null
  readonly isActive: boolean
  readonly createdAt: string | null
  readonly updatedAt: string | null
}

export interface AcademyActionResult {
  readonly error?: string
  readonly data?: AcademyData & { readonly role: string }
}

// ============================================================================
// Server Actions
// ============================================================================

export async function getMyAcademy(): Promise<AcademyActionResult> {
  try {
    // 1단계: 인증 확인
    const { error, profile } = await getCurrentUser()
    if (error || !profile) {
      return { error: error ?? '인증 실패' }
    }

    // 2단계: academy_id null 체크
    if (!profile.academyId) {
      return { error: '소속 학원이 없습니다.' }
    }

    // 3단계: academies 테이블에서 학원 정보 조회
    const supabase = await createClient()
    const { data: academy, error: academyError } = await supabase
      .from('academies')
      .select('*')
      .eq('id', profile.academyId)
      .single()

    if (academyError || !academy) {
      return { error: '학원 정보를 찾을 수 없습니다.' }
    }

    // 4단계: snake_case → camelCase 변환 + role 포함하여 반환
    return {
      data: {
        id: academy.id,
        name: academy.name,
        address: academy.address,
        phone: academy.phone,
        logoUrl: academy.logo_url,
        inviteCode: academy.invite_code,
        isActive: academy.is_active ?? true,
        createdAt: academy.created_at,
        updatedAt: academy.updated_at,
        role: profile.role,
      },
    }
  } catch {
    return { error: '학원 정보를 찾을 수 없습니다.' }
  }
}

export async function updateMyAcademy(
  _prevState: AcademyActionResult | null,
  formData: FormData,
): Promise<AcademyActionResult> {
  // 1단계: 인증 + 역할 확인
  const { error, profile } = await getCurrentUser()
  if (error || !profile) {
    return { error: error ?? '인증 실패' }
  }
  if (!['admin', 'system_admin'].includes(profile.role)) {
    return { error: '관리자만 학원 정보를 수정할 수 있습니다.' }
  }
  if (!profile.academyId) {
    return { error: '소속 학원이 없습니다.' }
  }

  // 2단계: FormData → 일반 객체로 변환
  const rawData = {
    name: (formData.get('name') as string) || '',
    address: (formData.get('address') as string) || '',
    phone: (formData.get('phone') as string) || '',
    logoUrl: (formData.get('logoUrl') as string) || '',
  }

  // 3단계: Zod 검증
  const parsed = academyUpdateSchema.safeParse(rawData)

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { error: firstError?.message || '입력값이 올바르지 않습니다.' }
  }

  try {
    // 4단계: camelCase → snake_case 변환 + DB 업데이트
    const updateData = {
      name: parsed.data.name,
      address: parsed.data.address || null,
      phone: parsed.data.phone || null,
      logo_url: parsed.data.logoUrl || null,
    }

    const supabase = await createClient()
    const { data: updated, error: updateError } = await supabase
      .from('academies')
      .update(updateData)
      .eq('id', profile.academyId)
      .select()
      .single()

    if (updateError || !updated) {
      return { error: '학원 정보 수정에 실패했습니다.' }
    }

    // 5단계: 캐시 무효화
    revalidatePath('/admin/academy')

    // 6단계: snake_case → camelCase 변환 + role 포함하여 반환
    return {
      data: {
        id: updated.id,
        name: updated.name,
        address: updated.address,
        phone: updated.phone,
        logoUrl: updated.logo_url,
        inviteCode: updated.invite_code,
        isActive: updated.is_active ?? true,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
        role: profile.role,
      },
    }
  } catch {
    return { error: '학원 정보 수정에 실패했습니다.' }
  }
}
