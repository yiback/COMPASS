import { DataTable, DataTableServerPagination } from '@/components/data-table'
import { getQuestionList } from '@/lib/actions/questions'
import type { QuestionListItem } from '@/lib/actions/questions'
import { questionColumns } from './_components/question-columns'
import { QuestionsToolbar } from './_components/questions-toolbar'

interface QuestionsPageProps {
  searchParams: Promise<{
    subject?: string
    schoolType?: string
    grade?: string
    type?: string
    difficulty?: string
    sourceType?: string
    page?: string
  }>
}

/**
 * 문제 목록 페이지
 *
 * Server Component: 데이터 조회 + DataTable 렌더링
 * 권한 조회 불필요: 정적 컬럼 배열 사용 (모든 역할 동일)
 */
export default async function QuestionsPage({
  searchParams,
}: QuestionsPageProps) {
  const params = await searchParams

  const result = await getQuestionList({
    subject: params.subject,
    schoolType: params.schoolType,
    grade: params.grade,
    type: params.type,
    difficulty: params.difficulty,
    sourceType: params.sourceType,
    page: params.page ?? '1',
  })

  if (result.error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">문제 관리</h1>
        </div>
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          에러: {result.error}
        </div>
      </div>
    )
  }

  const questions = (result.data ?? []) as QuestionListItem[]
  const total = result.meta?.total ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">문제 관리</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            총 {total}개의 문제
          </p>
        </div>
      </div>

      <DataTable
        columns={questionColumns}
        data={questions}
        toolbar={<QuestionsToolbar />}
        noResultsMessage="저장된 문제가 없습니다."
        showPagination={false}
      />

      <DataTableServerPagination
        total={total}
        page={result.meta?.page ?? 1}
        pageSize={result.meta?.pageSize ?? 10}
      />
    </div>
  )
}
