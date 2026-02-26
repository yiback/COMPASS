import Link from 'next/link'
import { Plus } from 'lucide-react'
import { DataTable, DataTableServerPagination } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { getPastExamList } from '@/lib/actions/past-exams'
import type { PastExamListItem } from '@/lib/actions/past-exams'
import { createClient } from '@/lib/supabase/server'
import { createPastExamColumns } from './_components/past-exam-columns'
import { PastExamsToolbar } from './_components/past-exams-toolbar'

interface PastExamsPageProps {
  searchParams: Promise<{
    school?: string
    subject?: string
    grade?: string
    examType?: string
    year?: string
    semester?: string
    page?: string
  }>
}

/**
 * 기출문제 목록 페이지
 *
 * Server Component: 현재 사용자 역할 확인 + 데이터 조회 + DataTable 렌더링
 * 교사/관리자만 업로드 버튼 표시 (Server에서 역할 결정 → DevTools 우회 방지)
 */
export default async function PastExamsPage({
  searchParams,
}: PastExamsPageProps) {
  const params = await searchParams

  // 1. 현재 사용자 역할 조회 (Server Component에서 Supabase 직접 접근 — RLS 적용)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let callerRole = 'student'

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile) {
      callerRole = (profile as { role: string }).role
    }
  }

  // 2. 기출문제 목록 조회
  const result = await getPastExamList({
    school: params.school,
    grade: params.grade,
    subject: params.subject,
    examType: params.examType ?? 'all',
    year: params.year,
    semester: params.semester ?? 'all',
    page: params.page ?? '1',
  })

  if (result.error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">기출문제</h1>
        </div>
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          에러: {result.error}
        </div>
      </div>
    )
  }

  const exams = (result.data ?? []) as PastExamListItem[]
  const total = result.meta?.total ?? 0
  const isTeacherOrAbove = ['teacher', 'admin', 'system_admin'].includes(
    callerRole
  )

  // callerRole 기반 컬럼 생성 (AI 문제 생성 버튼 조건부 표시)
  const columns = createPastExamColumns(callerRole)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">기출문제</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            총 {total}건의 기출문제
          </p>
        </div>
        {isTeacherOrAbove && (
          <Link href="/past-exams/upload">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              기출문제 업로드
            </Button>
          </Link>
        )}
      </div>

      <DataTable
        columns={columns}
        data={exams}
        toolbar={<PastExamsToolbar />}
        noResultsMessage="등록된 기출문제가 없습니다."
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
