'use client'

import { DataTable } from '@/components/data-table'
import type { PastExamListItem } from '@/lib/actions/past-exams'
import { createPastExamColumns } from './past-exam-columns'
import { PastExamsToolbar } from './past-exams-toolbar'

interface PastExamsTableProps {
  readonly data: PastExamListItem[]
  readonly callerRole: string
}

/**
 * 기출문제 DataTable 래퍼 (Client Component)
 *
 * Server Component(page.tsx)에서 클라이언트 전용 컬럼 팩토리를 호출할 수 없으므로
 * DataTable + 컬럼 생성을 Client Component로 분리한다.
 */
export function PastExamsTable({ data, callerRole }: PastExamsTableProps) {
  const columns = createPastExamColumns(callerRole)

  return (
    <DataTable
      columns={columns}
      data={data}
      toolbar={<PastExamsToolbar />}
      noResultsMessage="등록된 기출문제가 없습니다."
      showPagination={false}
    />
  )
}
