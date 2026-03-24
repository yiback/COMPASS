/**
 * auth 모듈 배럴 파일
 * 외부에서 import: import { Role, requireRole, getCurrentProfile } from '@/lib/auth'
 *
 * Wave 1: roles + route-permissions만 export
 * Wave 2에서 get-current-user, require-role 추가
 */
export { ROLES, type Role } from './roles'
export { ROUTE_PERMISSIONS, type RoutePermission } from './route-permissions'
// Task 2에서 추가:
export { getCurrentProfile, type CurrentProfile } from './get-current-user'
export { requireRole } from './require-role'
