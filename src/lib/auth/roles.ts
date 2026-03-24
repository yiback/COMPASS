/**
 * RBAC 역할 정의
 *
 * as const 패턴: 배열을 readonly 튜플로 추론 → 유니온 타입 추출
 * DB profiles.role CHECK 제약조건과 1:1 대응
 */

export const ROLES = ['student', 'teacher', 'admin', 'system_admin'] as const

/** 역할 유니온 타입 */
export type Role = (typeof ROLES)[number]
