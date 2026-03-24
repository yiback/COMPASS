# Task 3: page.tsx 역할 체크 + Layout 수정

> 소유: 리드 only (layout.tsx) + frontend-ui (page.tsx 9개, unauthorized)
> 의존성: Task 2 (requireRole, getCurrentProfile)
> Wave: 3 (통합, 직렬)

## 생성/수정 파일

| 파일 | 상태 | 변경 내용 |
|------|------|----------|
| `layout.tsx` | 수정 | getCurrentProfile() 사용, role props 전달 |
| `unauthorized/page.tsx` | 신규 | 403 페이지 |
| `admin/academy/page.tsx` | 수정 | requireRole + canEdit 교체 (SF3) |
| `admin/users/page.tsx` | 수정 | requireRole + callerRole/callerId 교체 (SF2) |
| `admin/schools/page.tsx` | 수정 | requireRole 추가 |
| `admin/schools/new/page.tsx` | 수정 | async + requireRole 추가 |
| `past-exams/page.tsx` | 수정 | requireRole 추가 (MF2) |
| `past-exams/upload/page.tsx` | 수정 | requireRole 교체 + redirect 변경 |
| `past-exams/[id]/edit/page.tsx` | 수정 | requireRole 교체 |
| `generate/page.tsx` | 수정 | async + requireRole 추가 |
| `questions/page.tsx` | 수정 | requireRole 추가 (MF4) |

## 구체적 구현 (before → after)

### 1. `layout.tsx` — getCurrentProfile() 도입

**before**: Supabase 직접 조회 (~12줄)
```typescript
const supabase = await createClient()
const { data: { user: authUser } } = await supabase.auth.getUser()
if (!authUser) redirect('/login')
const { data: userProfile } = await supabase.from('profiles').select(...)
```

**after**:
```typescript
import { getCurrentProfile } from '@/lib/auth'

const profile = await getCurrentProfile()
if (!profile) redirect('/login')

// role props 전달
<DashboardSidebar role={profile.role} />
<DashboardHeader
  user={{ name: profile.name, email: profile.email, avatar_url: profile.avatarUrl ?? undefined }}
  role={profile.role}
/>
```

### 2. `unauthorized/page.tsx` — 신규

```typescript
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ShieldAlert } from 'lucide-react'

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <ShieldAlert className="h-16 w-16 text-muted-foreground" />
      <h1 className="text-2xl font-bold">접근 권한이 없습니다</h1>
      <p className="text-muted-foreground">이 페이지에 접근할 권한이 부족합니다.</p>
      <Button asChild><Link href="/">대시보드로 이동</Link></Button>
    </div>
  )
}
```

### 3. `admin/users/page.tsx` — 인라인 조회 제거 (SF2)

**before**: `supabase.auth.getUser()` + `profiles.select('id, role')` (~15줄)
**after**:
```typescript
import { requireRole } from '@/lib/auth'
const profile = await requireRole(['admin', 'teacher'])
const callerRole = profile.role
const callerId = profile.id
```

### 4. `admin/academy/page.tsx` — canEdit 교체 (SF3)

**before**: `const canEdit = role === 'admin' || role === 'system_admin'`
**after**:
```typescript
import { requireRole } from '@/lib/auth'
const profile = await requireRole(['admin'])
const canEdit = true  // requireRole 통과 = admin 이상
```

### 5~6. `admin/schools/page.tsx`, `admin/schools/new/page.tsx`

```typescript
import { requireRole } from '@/lib/auth'
await requireRole(['admin', 'teacher'])
// 이하 기존 로직 동일
```
주의: `schools/new/page.tsx`는 sync → async 변경 필수

### 7. `past-exams/page.tsx` (MF2)

**before**: 인라인 역할 조회
**after**:
```typescript
import { requireRole } from '@/lib/auth'
const profile = await requireRole(['admin', 'teacher'])
const callerRole = profile.role
```

### 8. `past-exams/upload/page.tsx` — redirect 변경

**before**: `redirect('/past-exams')` (역할 불일치 시)
**after**: `requireRole(['admin', 'teacher'])` → 실패 시 자동 `/unauthorized`
주의: `createClient` import 유지 — 학교 목록 조회에 필요

### 9. `past-exams/[id]/edit/page.tsx`

**before**: `notFound()` (역할 불일치 시)
**after**: `requireRole(['admin', 'teacher'])` → 실패 시 `/unauthorized`
주의: `createClient` import 유지, `runtime`/`maxDuration` export 유지

### 10. `generate/page.tsx` — sync → async + requireRole

```typescript
import { requireRole } from '@/lib/auth'
export default async function GeneratePage() {
  await requireRole(['admin', 'teacher'])
```

### 11. `questions/page.tsx` (MF4)

```typescript
import { requireRole } from '@/lib/auth'
// 모든 인증 역할 허용 (student 포함 읽기)
await requireRole(['admin', 'teacher', 'student'])
```

## 빌드 검증

```bash
npx tsc --noEmit   # role prop 타입 호환 확인
npx vitest run     # 기존 테스트 PASS
npm run dev        # 수동 확인: student → /past-exams → /unauthorized
```
