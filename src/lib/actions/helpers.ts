/**
 * Server Action 공통 인증 헬퍼
 *
 * 모든 Server Action에서 사용하는 인증 + 프로필 조회를 통합한 함수.
 * src/lib/auth/의 getCurrentProfile()(page/layout용, React cache 사용)과 달리
 * Server Action 컨텍스트에서 사용하며, redirect() 대신 { error } 반환 패턴을 따른다.
 *
 * @see docs/plan/auth-helper-consolidation.md
 */

import { createClient } from '@/lib/supabase/server'
import { ROLES, type Role } from '@/lib/auth'

// ─── 타입 ──────────────────────────────────────────────

export interface ActionProfile {
  readonly id: string
  readonly role: Role
  readonly academyId: string | null // system_admin은 null — 에러가 아님
}

export interface GetCurrentUserResult {
  readonly error?: string
  readonly profile?: ActionProfile
}

// ─── getCurrentUser ────────────────────────────────────

/**
 * 현재 인증된 사용자의 프로필을 조회한다.
 *
 * - 인증 실패, 프로필 미존재, 잘못된 role → { error } 반환
 * - academyId null은 에러가 아님 (system_admin 허용)
 * - 역할 체크는 호출부에서 수행 (SRP)
 */
export async function getCurrentUser(): Promise<GetCurrentUserResult> {
  const supabase = await createClient()

  // 1. 인증 확인
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: '인증이 필요합니다.' }
  }

  // 2. 프로필 조회
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, academy_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: '프로필을 찾을 수 없습니다.' }
  }

  // 3. 런타임 role 가드 — DB에서 잘못된 role 방어
  if (!ROLES.includes(profile.role as Role)) {
    return { error: '유효하지 않은 역할입니다.' }
  }

  // 4. academyId null은 에러가 아님 (system_admin)
  return {
    profile: {
      id: profile.id,
      role: profile.role as Role,
      academyId: profile.academy_id,
    },
  }
}
