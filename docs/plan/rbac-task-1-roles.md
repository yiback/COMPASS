# Task 1: 권한 정의 모듈

> 소유: backend-actions (`src/lib/auth/`)
> 의존성: 없음
> Wave: 1 (사전작업, 직렬)

## 생성 파일

| 파일 | 설명 |
|------|------|
| `src/lib/auth/roles.ts` | Role 타입, ROLES 상수 |
| `src/lib/auth/route-permissions.ts` | 경로-역할 매핑 (문서화 + 테스트 검증용) |
| `src/lib/auth/index.ts` | 배럴 파일 (공개 API) — Wave 1 시점 임시 버전 |

## 구체적 구현

### 1. `src/lib/auth/roles.ts`

```typescript
/**
 * RBAC 역할 정의
 * as const 패턴: 배열을 readonly 튜플로 추론 → 유니온 타입 추출
 */
export const ROLES = ['student', 'teacher', 'admin', 'system_admin'] as const

/** 역할 유니온 타입 — DB profiles.role CHECK와 1:1 대응 */
export type Role = (typeof ROLES)[number]
```

### 2. `src/lib/auth/route-permissions.ts`

```typescript
/**
 * 경로-역할 매핑 (문서화 + 테스트 검증용)
 * 런타임에서 직접 사용하지 않음:
 * - page.tsx → requireRole() 직접 호출
 * - 사이드바 → MenuItem.roles 필터
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
] as const
```

### 3. `src/lib/auth/index.ts` (Wave 1 임시)

```typescript
export { ROLES, type Role } from './roles'
export { ROUTE_PERMISSIONS, type RoutePermission } from './route-permissions'
// Task 2에서 추가:
// export { getCurrentProfile, type CurrentProfile } from './get-current-user'
// export { requireRole } from './require-role'
```

## 빌드 검증

```bash
npx tsc --noEmit   # 타입 체크 통과
npx vitest run     # 기존 1367 테스트 PASS
```
