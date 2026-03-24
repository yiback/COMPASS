import { getUserList } from '@/lib/actions/users'
import type { UserProfile } from '@/lib/actions/users'
import { requireRole } from '@/lib/auth'
import { UsersTable } from './_components/users-table'

interface UsersPageProps {
  searchParams: Promise<{
    search?: string
    role?: string
    isActive?: string
    page?: string
  }>
}

/**
 * 사용자 목록 페이지
 *
 * Server Component: 현재 사용자 역할 확인 + 데이터 조회 + DataTable 렌더링
 * 권한 정보(callerRole, callerId)를 Server에서 결정하고 Client에 전달 → 보안 강화
 */
export default async function UsersPage({ searchParams }: UsersPageProps) {
  const params = await searchParams

  // 1. 역할 검증 — admin/teacher만 접근 가능 (미통과 시 /unauthorized 리다이렉트)
  const profile = await requireRole(['admin', 'teacher'])
  const callerRole = profile.role
  const callerId = profile.id

  // 2. 사용자 목록 조회
  const result = await getUserList({
    search: params.search,
    role: (params.role as 'student' | 'teacher' | 'admin' | 'all') ?? 'all',
    isActive: (params.isActive as 'true' | 'false' | 'all') ?? 'all',
    page: params.page ? parseInt(params.page) : 1,
  })

  if (result.error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">사용자 관리</h1>
        </div>
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          에러: {result.error}
        </div>
      </div>
    )
  }

  const users = (result.data ?? []) as UserProfile[]
  const total = result.meta?.total ?? 0

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">사용자 관리</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          총 {total}명의 사용자
        </p>
      </div>

      <UsersTable data={users} callerRole={callerRole} callerId={callerId} />
    </div>
  )
}
