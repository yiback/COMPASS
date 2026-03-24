/**
 * 역할 기반 접근 제어 가드
 *
 * Server Action / Server Component에서 호출하여
 * 인증 여부와 역할을 한 번에 검증합니다.
 * system_admin은 항상 허용 (슈퍼유저)
 */

import { redirect } from 'next/navigation'
import type { Role } from './roles'
import { getCurrentProfile, type CurrentProfile } from './get-current-user'

/**
 * 지정된 역할 중 하나를 가진 사용자만 통과시킵니다.
 *
 * - 미인증: /login으로 리다이렉트
 * - 권한 없음: /unauthorized으로 리다이렉트
 * - system_admin: allowedRoles와 무관하게 항상 통과
 *
 * @param allowedRoles 접근 허용할 역할 목록
 * @returns 검증된 CurrentProfile
 */
export async function requireRole(allowedRoles: Role[]): Promise<CurrentProfile> {
  const profile = await getCurrentProfile()
  // redirect()는 Next.js 내부에서 throw — 이후 코드 미실행 보장 (코드 리뷰 S-M2)
  if (!profile) redirect('/login')

  // system_admin 슈퍼유저 — 항상 허용
  if (profile.role === 'system_admin') return profile

  if (!allowedRoles.includes(profile.role)) {
    redirect('/unauthorized')
  }

  return profile
}
