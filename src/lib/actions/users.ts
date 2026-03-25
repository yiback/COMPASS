/**
 * 사용자 관리 Server Actions
 *
 * - getUserList: 같은 학원 사용자 목록 조회 (admin, teacher, system_admin)
 * - changeUserRole: 역할 변경 (admin, system_admin만)
 * - toggleUserActive: 활성화/비활성화 (admin, system_admin만)
 */

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  userFilterSchema,
  roleChangeSchema,
  toggleActiveSchema,
  type UserFilterInput,
} from '@/lib/validations/users'
import { getCurrentUser } from './helpers'

// ============================================================================
// 타입 정의
// ============================================================================

export interface UserProfile {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly role: string
  readonly isActive: boolean
  readonly avatarUrl: string | null
  readonly phone: string | null
  readonly createdAt: string
}

export interface UserActionResult {
  readonly error?: string
  readonly data?: UserProfile | UserProfile[]
  readonly meta?: {
    readonly total: number
    readonly page: number
    readonly pageSize: number
  }
}

/**
 * DB 응답(snake_case) → 프론트엔드 타입(camelCase) 변환
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 생성 타입 미생성
function toUserProfile(dbRow: any): UserProfile {
  return {
    id: dbRow.id,
    email: dbRow.email,
    name: dbRow.name,
    role: dbRow.role,
    isActive: dbRow.is_active,
    avatarUrl: dbRow.avatar_url,
    phone: dbRow.phone,
    createdAt: dbRow.created_at,
  }
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * 사용자 목록 조회
 * 권한: admin, teacher, system_admin
 */
export async function getUserList(
  filters?: UserFilterInput
): Promise<UserActionResult> {
  // 1. 필터 검증
  const parsed = userFilterSchema.safeParse(filters ?? {})
  if (!parsed.success) {
    return { error: '잘못된 필터 값입니다.' }
  }

  const { search, role, isActive, page } = parsed.data
  const pageSize = 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // 2. 인증 + 프로필 확인
  const { error, profile } = await getCurrentUser()
  if (error || !profile) return { error: error ?? '인증 실패' }
  if (!profile.academyId) return { error: '소속 학원이 없습니다.' }

  // 3. 역할 체크: student 차단
  if (!['admin', 'teacher', 'system_admin'].includes(profile.role)) {
    return { error: '권한이 없습니다.' }
  }

  const supabase = await createClient()

  try {
    // 4. Supabase 쿼리 구성
    let query = supabase
      .from('profiles')
      .select(
        'id, email, name, role, is_active, avatar_url, phone, created_at',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to)

    // 5. 필터 적용
    if (search) {
      // name 또는 email에 검색어 포함 (or 쿼리)
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    if (role && role !== 'all') {
      query = query.eq('role', role)
    }

    if (isActive && isActive !== 'all') {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[getUserList] error:', error)
      return { error: '사용자 목록 조회에 실패했습니다.' }
    }

    // 6. snake_case → camelCase 변환
    const users = (data ?? []).map(toUserProfile)

    return {
      data: users,
      meta: {
        total: count ?? 0,
        page,
        pageSize,
      },
    }
  } catch {
    return { error: '사용자 목록 조회에 실패했습니다.' }
  }
}

/**
 * 역할 변경
 * 권한: admin, system_admin만
 */
export async function changeUserRole(
  userId: string,
  newRole: 'student' | 'teacher' | 'admin'
): Promise<UserActionResult> {
  // 1. Zod 검증
  const parsed = roleChangeSchema.safeParse({ userId, newRole })
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다.',
    }
  }

  // 2. 인증 + 프로필 확인
  const { error, profile: caller } = await getCurrentUser()
  if (error || !caller) return { error: error ?? '인증 실패' }
  if (!caller.academyId) return { error: '소속 학원이 없습니다.' }

  // 3. 역할 체크: admin 또는 system_admin만
  if (!['admin', 'system_admin'].includes(caller.role)) {
    return { error: '권한이 없습니다.' }
  }

  // =========================================================================
  // 🔴 빈칸 #1: Fail-fast — 자기 자신 변경 차단
  // 힌트: caller.id와 userId를 비교. DB 조회보다 먼저 체크하는 이유? → 불필요한 쿼리 방지
  // 에러 메시지: '자신의 역할은 변경할 수 없습니다.'
  // =========================================================================
  // TODO: 여기에 구현하세요
  if (caller.id === userId) {
    return { error: '자신의 역할은 변경할 수 없습니다.'}
  }

  const supabase = await createClient()

  try {
    // 5. 대상 사용자 조회 (RLS가 같은 학원만 보여줌)
    const { data: target, error: targetError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .single()

    if (targetError || !target) {
      return { error: '사용자를 찾을 수 없습니다.' }
    }

    // =========================================================================
    // 🔴 빈칸 #2: Defense in Depth — system_admin 보호
    // 힌트: target.role이 'system_admin'이면 차단. Zod 다음의 2번째 방어선
    // 에러 메시지: 'system_admin의 역할은 변경할 수 없습니다.'
    // =========================================================================
    // TODO: 여기에 구현하세요
    if (target.role === 'system_admin') {
      return { error: 'system_admin의 역할은 변경할 수 없습니다.'}
    }

    // =========================================================================
    // 🔴 빈칸 #3: RBAC 매트릭스 — admin의 수평/수직 권한 제한
    // 힌트: caller.role이 'admin'일 때 2가지 제한:
    //   a. 대상(target)이 admin이면 → 수평 권한 변경 금지
    //      에러: '다른 관리자의 역할은 변경할 수 없습니다.'
    //   b. newRole이 admin이면 → admin 승격 권한 없음
    //      에러: '관리자 역할을 부여할 권한이 없습니다.'
    // =========================================================================
    // TODO: 여기에 구현하세요
    if (caller.role === 'admin') {
      if (target.role === 'admin') {
        return {error: '다른 관리자의 역할은 변경할 수 없습니다.'}
      }

      if (newRole === 'admin') {
        return { error: '관리자 역할을 부여할 권한이 없습니다.'}
      }
    }

    // 8. UPDATE 실행
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)
      .select(
        'id, email, name, role, is_active, avatar_url, phone, created_at'
      )
      .single()

    if (updateError || !updated) {
      return { error: '역할 변경에 실패했습니다.' }
    }

    // 9. 캐시 무효화
    revalidatePath('/admin/users')

    // 10. 변환 후 반환
    return { data: toUserProfile(updated) }
  } catch {
    return { error: '역할 변경에 실패했습니다.' }
  }
}

/**
 * 활성화/비활성화 토글
 * 권한: admin, system_admin만
 */
export async function toggleUserActive(
  userId: string,
  isActive: boolean
): Promise<UserActionResult> {
  // 1. Zod 검증
  const parsed = toggleActiveSchema.safeParse({ userId, isActive })
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다.',
    }
  }

  // 2. 인증 + 프로필 확인
  const { error: toggleError, profile: caller } = await getCurrentUser()
  if (toggleError || !caller) return { error: toggleError ?? '인증 실패' }
  if (!caller.academyId) return { error: '소속 학원이 없습니다.' }

  // 3. 역할 체크: admin 또는 system_admin만
  if (!['admin', 'system_admin'].includes(caller.role)) {
    return { error: '권한이 없습니다.' }
  }

  // =========================================================================
  // 🔴 빈칸 #4: Fail-fast — 자기 자신 비활성화 차단
  // 힌트: changeUserRole과 동일한 패턴. DB 조회 전에 체크
  // 에러 메시지: '자신을 비활성화할 수 없습니다.'
  // =========================================================================
  // TODO: 여기에 구현하세요
  if (caller.id === userId) {
    return { error: '자신을 비활성화할 수 없습니다.'}
  }

  const supabase = await createClient()

  try {
    // 5. 대상 사용자 조회
    const { data: target, error: targetError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .single()

    if (targetError || !target) {
      return { error: '사용자를 찾을 수 없습니다.' }
    }

    // =========================================================================
    // 🔴 빈칸 #5: Defense in Depth — system_admin 보호
    // 힌트: system_admin은 비활성화 불가. #2와 동일 패턴
    // 에러 메시지: 'system_admin을 비활성화할 수 없습니다.'
    // =========================================================================
    // TODO: 여기에 구현하세요
    if (target.role === 'system_admin') {
      return { error: 'system_admin을 비활성화할 수 없습니다.'}
    }

    // 7. UPDATE 실행
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ is_active: isActive })
      .eq('id', userId)
      .select(
        'id, email, name, role, is_active, avatar_url, phone, created_at'
      )
      .single()

    if (updateError || !updated) {
      return { error: '상태 변경에 실패했습니다.' }
    }

    // 8. 캐시 무효화
    revalidatePath('/admin/users')

    // 9. 변환 후 반환
    return { data: toUserProfile(updated) }
  } catch {
    return { error: '상태 변경에 실패했습니다.' }
  }
}
