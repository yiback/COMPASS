'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, ShieldAlert, UserX, UserCheck } from 'lucide-react'
import { toggleUserActive } from '@/lib/actions/users'
import type { UserProfile } from '@/lib/actions/users'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

// ─── 상수 매핑 ──────────────────────────────────────────

const ROLE_MAP: Record<string, string> = {
  student: '학생',
  teacher: '교사',
  admin: '관리자',
  system_admin: '시스템관리자',
} as const

const ROLE_BADGE_VARIANT: Record<
  string,
  'secondary' | 'default' | 'outline' | 'destructive'
> = {
  student: 'secondary',
  teacher: 'default',
  admin: 'outline',
  system_admin: 'destructive',
} as const

const STATUS_BADGE: Record<
  string,
  { label: string; variant: 'default' | 'secondary' }
> = {
  active: { label: '활성', variant: 'default' },
  inactive: { label: '비활성', variant: 'secondary' },
} as const

// ─── 컬럼 팩토리 함수 ───────────────────────────────────

/**
 * 사용자 목록 DataTable 컬럼 정의
 *
 * 학교 관리(schoolColumns)와 달리 팩토리 함수로 구현.
 * 이유: 호출자 역할에 따라 액션 컬럼을 조건부 포함 + 자기 자신 행 비활성화
 */
export function createUserColumns(
  callerRole: string,
  callerId: string
): ColumnDef<UserProfile>[] {
  const baseColumns: ColumnDef<UserProfile>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="이름" />
      ),
    },
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="이메일" />
      ),
    },
    {
      accessorKey: 'role',
      header: '역할',
      cell: ({ row }) => {
        const role = row.original.role
        return (
          <Badge variant={ROLE_BADGE_VARIANT[role] ?? 'secondary'}>
            {ROLE_MAP[role] ?? role}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'isActive',
      header: '상태',
      cell: ({ row }) => {
        const status = row.original.isActive ? 'active' : 'inactive'
        const badge = STATUS_BADGE[status]
        return <Badge variant={badge.variant}>{badge.label}</Badge>
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="가입일" />
      ),
      cell: ({ row }) =>
        new Date(row.original.createdAt).toLocaleDateString('ko-KR'),
    },
  ]

  // admin / system_admin만 액션 컬럼 포함
  if (['admin', 'system_admin'].includes(callerRole)) {
    baseColumns.push({
      id: 'actions',
      cell: function ActionsCell({ row }) {
        const router = useRouter()
        const user = row.original
        const isSelf = user.id === callerId
        const isSystemAdmin = user.role === 'system_admin'
        const isDisabled = isSelf || isSystemAdmin

        async function handleToggleActive() {
          const action = user.isActive ? '비활성화' : '활성화'
          if (!confirm(`${user.name}님을 ${action}하시겠습니까?`)) return

          const result = await toggleUserActive(user.id, !user.isActive)

          if (result.error) {
            toast.error(result.error)
          } else {
            toast.success(`${user.name}님이 ${action}되었습니다.`)
            router.refresh()
          }
        }

        function handleRoleChange() {
          toast.info('역할 변경 기능은 곧 추가됩니다.')
        }

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" disabled={isDisabled}>
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">메뉴 열기</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleRoleChange}>
                <ShieldAlert className="mr-2 h-4 w-4" />
                역할 변경
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleToggleActive}
                className={user.isActive ? 'text-destructive' : ''}
              >
                {user.isActive ? (
                  <>
                    <UserX className="mr-2 h-4 w-4" />
                    비활성화
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 h-4 w-4" />
                    활성화
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    })
  }

  return baseColumns
}
