/**
 * 현재 로그인 사용자 프로필 조회
 *
 * React cache()로 같은 요청 내 중복 DB 호출 방지
 * system_admin은 academyId가 null일 수 있음 (DB CHECK 제약조건)
 */

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { ROLES, type Role } from './roles'

/** 현재 로그인 사용자 프로필 */
export interface CurrentProfile {
  readonly id: string
  readonly role: Role
  readonly academyId: string | null // system_admin은 null
  readonly name: string
  readonly email: string
  readonly avatarUrl: string | null
}

/**
 * 현재 로그인 사용자의 프로필을 조회합니다.
 *
 * @returns 인증된 사용자 프로필, 미인증이면 null
 */
export const getCurrentProfile = cache(
  async (): Promise<CurrentProfile | null> => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, academy_id, name, email, avatar_url')
      .eq('id', user.id)
      .single()

    if (!profile) return null
    // 런타임 역할 검증 — DB에 잘못된 role이 있으면 차단 (코드 리뷰 S-M1, T-H3)
    if (!ROLES.includes(profile.role as Role)) return null
    // system_admin만 academy_id NULL 허용 (DB CHECK 제약조건)
    if (profile.role !== 'system_admin' && !profile.academy_id) return null

    return {
      id: profile.id,
      role: profile.role as Role,
      academyId: profile.academy_id,
      name: profile.name,
      email: profile.email,
      avatarUrl: profile.avatar_url,
    }
  }
)
