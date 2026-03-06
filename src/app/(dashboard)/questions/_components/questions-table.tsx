'use client'

import { DataTable } from '@/components/data-table'
import type { QuestionListItem } from '@/lib/actions/questions'
import { questionColumns } from './question-columns'
import { QuestionsToolbar } from './questions-toolbar'

interface QuestionsTableProps {
  readonly data: QuestionListItem[]
}

/**
 * 문제 DataTable 래퍼 (Client Component)
 *
 * Server Component(page.tsx)에서 클라이언트 전용 컬럼을 import할 수 없으므로
 * DataTable + 컬럼을 Client Component로 분리한다.
 */
export function QuestionsTable({ data }: QuestionsTableProps) {
  return (
    <DataTable
      columns={questionColumns}
      data={data}
      toolbar={<QuestionsToolbar />}
      noResultsMessage="저장된 문제가 없습니다."
      showPagination={false}
    />
  )
}
