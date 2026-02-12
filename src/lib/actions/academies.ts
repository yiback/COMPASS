/**
 * 학원 관리 Server Actions
 */

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { academyUpdateSchema } from '@/lib/validations/academies'

// ============================================================================
// 타입 정의
// ============================================================================

// TODO: AcademyData 인터페이스를 작성하세요
// 필드: id, name, address, phone, logoUrl, inviteCode, isActive, createdAt, updatedAt
// 힌트: DB에 값이 없을 수 있는 필드는 string | null
export interface AcademyData {
  readonly id: string
  readonly name: string
  readonly address: string | null
  readonly phone: string | null
  readonly logoUrl:string | null
  readonly inviteCode: string | null
  readonly isActive: boolean
  readonly createdAt:string | null
  readonly updatedAt:string | null
}

// TODO: AcademyActionResult 인터페이스를 작성하세요
// 성공 시: data에 AcademyData + role 포함
// 실패 시: error에 메시지 포함
export interface AcademyActionResult {
  readonly error?: string
  readonly data?: AcademyData & { readonly role:string }
}

// TODO: CheckAdminRoleResult 인터페이스를 작성하세요
// 성공 시: profile에 role + academyId 포함
// 실패 시: error에 메시지 포함
interface CheckAdminRoleResult {
  readonly error?: string
  readonly profile?: { readonly role:string, readonly academyId:string }
}

// ============================================================================
// RBAC 헬퍼 함수 (나중에 작성)
// ============================================================================

async function checkAdminRole(): Promise<CheckAdminRoleResult> {
  const supabase = await createClient()

  // 1단계: 로그인한 사용자 확인
  // 힌트: supabase.auth.getUser() 사용
  // 실패 시: return { error: '인증이 필요합니다.' }
  const {data:{user}, error:authError} = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: '인증이 필요합니다.'}
  }

  // 2단계: profiles 테이블에서 role, academy_id 조회
  // 힌트: supabase.from('profiles').select('role, academy_id').eq('id', ???).single()
  // 실패 시: return { error: '프로필을 찾을 수 없습니다.' }
  const {data:profile, error:profileError} = await supabase.from('profiles').select('role, academy_id').eq('id', user.id).single()  
  if (profileError || !profile) {
    return { error: '프로필을 찾을 수 없습니다.'}
  }

  // 3단계: admin 또는 system_admin인지 확인
  // 힌트: ['admin', 'system_admin'].includes(???)
  // 실패 시: return { error: '학원 관리자만 수정할 수 있습니다.' }
  if (!['admin', 'system_admin'].includes(profile.role)) {
    return { error: '학원 관리자만 수정할 수 있습니다.'}
  }

  // 4단계: academy_id가 null이면 에러
  // 힌트: !profile.academy_id 이면 에러
  // 실패 시: return { error: '소속 학원이 없습니다.' }
  if (!profile.academy_id) {
    return { error: '소속 학원이 없습니다.'}
  }

  // 모두 통과하면 성공 반환
  // 힌트: return { profile: { role: ???, academyId: ??? } }
  return { profile: { role: profile.role, academyId: profile.academy_id }}
}

// ============================================================================
// Server Actions (나중에 작성)
// ============================================================================

export async function getMyAcademy(): Promise<AcademyActionResult> {
  const supabase = await createClient()

  try {
    // 1단계: 로그인한 사용자 확인
    // 힌트: checkAdminRole()과 같은 방식
    const { data: {user}, error:authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { error: '인증이 필요합니다.'}
    }

    // 2단계: profiles에서 academy_id, role 조회
    // 힌트: checkAdminRole()과 같은 방식
    const {data:profile, error:profileError} = await supabase.from('profiles').select('academy_id, role').eq('id', user.id).single()
    if (profileError || !profile) {
      return { error: '프로필을 찾을 수 없습니다.'}
    }

    // 3단계: academy_id null 체크
    if (!profile.academy_id) {
      return {error:'소속 학원이 없습니다.'}
    }

    // 4단계: academies 테이블에서 학원 정보 조회
    // 힌트: supabase.from('academies').select('*').eq('id', ???).single()
    // 실패 시: return { error: '학원 정보를 찾을 수 없습니다.' }
    const {data:academy, error:academyError} = await supabase.from('academies').select('*').eq('id', profile.academy_id).single()
    if (academyError || !academy) {
      return { error: '학원 정보를 찾을 수 없습니다.'}
    }

    // 5단계: snake_case → camelCase 변환 + role 포함하여 반환
    // 힌트: academy.logo_url → logoUrl, academy.invite_code → inviteCode 등
    // return { data: { id: ..., name: ..., ..., role: profile.role } }
    return { data: {
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

  } catch (error) {
    return { error: '학원 정보를 찾을 수 없습니다.' }
  }
}

export async function updateMyAcademy(
  _prevState: AcademyActionResult | null,
  formData: FormData,
): Promise<AcademyActionResult> {
  const supabase = await createClient()

  // 1단계: RBAC 확인 (admin만 수정 가능)
  // 힌트: checkAdminRole() 사용 (getMyAcademy와 달리 admin만 허용해야 함)
  // 실패 시: return { error: roleCheck.error }
  const roleCheck = await checkAdminRole() 
  if ( roleCheck.error || !roleCheck.profile) {
    return { error: roleCheck.error }
  }

  const {academyId, role} = roleCheck.profile 

  // 2단계: FormData → 일반 객체로 변환
  // 힌트: formData.get('name'), formData.get('address') 등
  const rawData = {
    name: (formData.get('name') as  string) || '',
    address: (formData.get('address') as string) || '',
    phone: (formData.get('phone') as string) || '',
    logoUrl: (formData.get('logoUrl') as string) || '',
  }

  // 3단계: Zod 검증
  // 힌트: academyUpdateSchema.safeParse(rawData)
  // 실패 시: return { error: parsed.error.issues[0]?.message || '입력값이 올바르지 않습니다.' }
  const parsed = academyUpdateSchema.safeParse(rawData)

  if(!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { error: firstError?.message || '입력값이 올바르지 않습니다.'}
  }

  try {
    // 4단계: camelCase → snake_case 변환 + DB 업데이트
    // 힌트: parsed.data.logoUrl → logo_url, 빈 문자열은 || null로 null 변환
    // supabase.from('academies').update(???).eq('id', ???).select().single()
    const updateData = {
      name: parsed.data.name,
      address: parsed.data.address  || null,
      phone: parsed.data.phone || null,
      logo_url: parsed.data.logoUrl || null,
    }

    const { data: updated, error: updateError } = await supabase.from('academies').update(updateData).eq('id', academyId).select().single()

    if (updateError || !updated) {
      return { error: '학원 정보 수정에 실패했습니다.'}
    }
    // 5단계: 캐시 무효화
    // 힌트: revalidatePath('/admin/academy')
    revalidatePath('/admin/academy')

    // 6단계: snake_case → camelCase 변환 + role 포함하여 반환
    // 힌트: getMyAcademy()의 5단계와 같은 패턴
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
        role,
      },
    }

  } catch (error) {
    return { error: '학원 정보 수정에 실패했습니다.' }
  }
}
