'use client'

import { DataTable } from '@/components/data-table'
import type { UserProfile } from '@/lib/actions/users'
import { createUserColumns } from './user-columns'
import { UsersToolbar } from './users-toolbar'

interface UsersTableProps {
  readonly data: UserProfile[]
  readonly callerRole: string
  readonly callerId: string
}

/**
 * 사용자 DataTable 래퍼 (Client Component)
 *
 * Server Component(page.tsx)에서 클라이언트 전용 컬럼 팩토리를 호출할 수 없으므로
 * DataTable + 컬럼 생성을 Client Component로 분리한다.
 */
export function UsersTable({ data, callerRole, callerId }: UsersTableProps) {
  const columns = createUserColumns(callerRole, callerId)

  return (
    <DataTable
      columns={columns}
      data={data}
      toolbar={<UsersToolbar />}
      noResultsMessage="등록된 사용자가 없습니다."
    />
  )
}
