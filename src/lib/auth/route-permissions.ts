/**
 * 경로-역할 매핑 (문서화 + 테스트 검증용)
 *
 * 런타임에서 직접 사용하지 않음:
 * - page.tsx → requireRole() 직접 호출
 * - 사이드바 → MenuItem.roles 필터
 *
 * 테스트에서 page.tsx의 requireRole 인자와 일치를 검증하는 데 사용
 * 구체적 경로가 먼저 정의되어야 함 (startsWith 매칭 순서)
 */
import type { Role } from './roles'

export interface RoutePermission {
  readonly pattern: string
  readonly roles: Role[]
}

export const ROUTE_PERMISSIONS: readonly RoutePermission[] = [
  { pattern: '/admin/academy', roles: ['admin'] },
  { pattern: '/admin/users', roles: ['admin', 'teacher'] },
  { pattern: '/admin/schools', roles: ['admin', 'teacher'] },
  { pattern: '/past-exams', roles: ['admin', 'teacher'] },
  { pattern: '/generate', roles: ['admin', 'teacher'] },
  { pattern: '/questions', roles: ['admin', 'teacher', 'student'] },
  // 미등록 경로(/, /settings, /unauthorized)는 인증된 모든 사용자 허용
] as const
