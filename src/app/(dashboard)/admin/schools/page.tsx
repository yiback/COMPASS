import { DataTable } from '@/components/data-table'
import { getSchoolList } from '@/lib/actions/schools'
import { schoolColumns } from './_components/school-columns'
import { SchoolsToolbar } from './_components/schools-toolbar'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

interface SchoolsPageProps {
  searchParams: Promise<{
    search?: string
    schoolType?: string
    page?: string
  }>
}

/**
 * 학교 목록 페이지
 * Server Component: 데이터 조회 후 DataTable에 전달
 */
export default async function SchoolsPage({ searchParams }: SchoolsPageProps) {
  const params = await searchParams
  const result = await getSchoolList({
    search: params.search,
    schoolType:
      (params.schoolType as 'elementary' | 'middle' | 'high' | 'all') ?? 'all',
    page: params.page ? parseInt(params.page) : 1,
  })

  if (result.error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">학교 관리</h1>
        </div>
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          에러: {result.error}
        </div>
      </div>
    )
  }

  const { schools, total } = result.data as {
    schools: Array<{
      id: string
      name: string
      school_type: 'elementary' | 'middle' | 'high'
      region?: string | null
      district?: string | null
      created_at: string
    }>
    total: number
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">학교 관리</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            총 {total}개의 학교
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/schools/new">
            <Plus className="mr-2 h-4 w-4" />
            학교 추가
          </Link>
        </Button>
      </div>

      <DataTable
        columns={schoolColumns}
        data={schools}
        toolbar={<SchoolsToolbar />}
        noResultsMessage="등록된 학교가 없습니다."
      />
    </div>
  )
}
