# Task 4: 사이드바 역할별 메뉴 필터링

> 소유: frontend-ui (`src/lib/constants/`, `src/components/layout/`)
> 의존성: Task 1 (Role 타입)
> Wave: 2 (인프라, Task 2와 병렬)

## 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/constants/menu.ts` | MenuItem에 `roles?: Role[]` 추가, 각 항목에 역할 배열 |
| `src/components/layout/dashboard-sidebar.tsx` | `role?: Role` prop, 필터 로직 |
| `src/components/layout/mobile-nav.tsx` | `role?: Role` prop, 필터 로직 |
| `src/components/layout/dashboard-header.tsx` | `role?: Role` prop, MobileNav에 drilling |

## 구체적 구현 (before → after)

### 1. `menu.ts` — roles 필드 추가

```typescript
import type { Role } from '@/lib/auth'

export interface MenuItem {
  title: string
  href: string
  icon: LucideIcon
  description?: string
  roles?: Role[]  // undefined = 모든 역할 허용
}
```

메뉴-역할 매핑:
| 메뉴 | roles |
|------|-------|
| 대시보드 | `undefined` |
| 기출문제 | `['admin', 'teacher']` |
| 문제 생성 | `['admin', 'teacher']` |
| 문제 관리 | `['admin', 'teacher', 'student']` |
| 학원 관리 | `['admin']` |
| 사용자 관리 | `['admin', 'teacher']` |
| 학교 관리 | `['admin', 'teacher']` |
| 설정 | `undefined` |

### 2. `dashboard-sidebar.tsx` — role 필터링

```typescript
import type { Role } from '@/lib/auth'

interface DashboardSidebarProps {
  className?: string
  role?: Role  // optional — MF3
}

// 필터 로직
const visibleItems = MENU_ITEMS.filter(
  (item) => !role || !item.roles || role === 'system_admin' || item.roles.includes(role)
)
// MENU_ITEMS.map → visibleItems.map
```

### 3. `mobile-nav.tsx` — 동일 패턴

```typescript
interface MobileNavProps { role?: Role }
// 동일 필터 로직
```

### 4. `dashboard-header.tsx` — role drilling

```typescript
interface DashboardHeaderProps {
  user?: { name?: string; email?: string; avatar_url?: string } | null
  role?: Role
}
// <MobileNav role={role} />
```

### Props Drilling 경로

```
layout.tsx (profile.role)
  ├── <DashboardSidebar role={profile.role} />
  └── <DashboardHeader role={profile.role} />
        └── <MobileNav role={role} />
```

## 빌드 검증

```bash
npx tsc --noEmit   # role?: optional이므로 layout 미수정 시에도 타입 통과
npx vitest run     # 기존 테스트 PASS
```
