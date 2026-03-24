# Task 2: 공유 인증 유틸리티 ✅

> 소유: backend-actions (`src/lib/auth/`)
> 의존성: Task 1 (Role 타입)
> Wave: 2 (인프라, Task 4와 병렬)

## 생성/수정 파일

| 파일 | 상태 | 설명 |
|------|------|------|
| `src/lib/auth/get-current-user.ts` | 신규 | React 19 cache() 감싼 프로필 조회 |
| `src/lib/auth/require-role.ts` | 신규 | page.tsx용 역할 체크 + redirect |
| `src/lib/auth/index.ts` | 수정 | export 2줄 추가 |

## 구체적 구현

### 1. `src/lib/auth/get-current-user.ts`

```typescript
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Role } from './roles'

export interface CurrentProfile {
  readonly id: string
  readonly role: Role
  readonly academyId: string | null  // system_admin은 null
  readonly name: string
  readonly email: string
  readonly avatarUrl: string | null
}

// React 19 cache(): layout + page 양쪽 호출해도 DB 실질 1회
export const getCurrentProfile = cache(
  async (): Promise<CurrentProfile | null> => {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, academy_id, name, email, avatar_url')
      .eq('id', user.id)
      .single()

    if (!profile) return null
    // system_admin만 academy_id NULL 허용 (MF1)
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
```

### 2. `src/lib/auth/require-role.ts`

```typescript
import { redirect } from 'next/navigation'
import type { Role } from './roles'
import { getCurrentProfile, type CurrentProfile } from './get-current-user'

/** 인증/권한 에러 메시지 (SF4) */
const AUTH_ERRORS = {
  UNAUTHENTICATED: '인증이 필요합니다.',
  PROFILE_NOT_FOUND: '프로필을 찾을 수 없습니다.',
  NO_ACADEMY: '소속 학원이 없습니다.',
  UNAUTHORIZED: '권한이 없습니다.',
} as const

export async function requireRole(allowedRoles: Role[]): Promise<CurrentProfile> {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  // system_admin 항상 허용 (D7)
  if (profile.role !== 'system_admin' && !allowedRoles.includes(profile.role)) {
    redirect('/unauthorized')
  }
  return profile
}
```

### 3. `src/lib/auth/index.ts` 수정

```typescript
export { ROLES, type Role } from './roles'
export { ROUTE_PERMISSIONS, type RoutePermission } from './route-permissions'
export { getCurrentProfile, type CurrentProfile } from './get-current-user'
export { requireRole } from './require-role'
```

## 빌드 검증

```bash
npx tsc --noEmit   # 타입 체크 통과
npx vitest run     # 기존 1367 테스트 PASS
```
