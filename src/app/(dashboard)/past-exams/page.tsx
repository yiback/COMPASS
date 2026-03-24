import Link from 'next/link'
import { Plus } from 'lucide-react'
import { DataTableServerPagination } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { getPastExamList } from '@/lib/actions/past-exams'
import type { PastExamListItem } from '@/lib/actions/past-exams'
import { requireRole } from '@/lib/auth'
import { PastExamsTable } from './_components/past-exams-table'

interface PastExamsPageProps {
  searchParams: Promise<{
    school?: string
    schoolType?: string
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

  // 1. 역할 검증 — admin/teacher만 접근 가능 (미통과 시 /unauthorized 리다이렉트)
  const profile = await requireRole(['admin', 'teacher'])
  const callerRole = profile.role

  // 2. 기출문제 목록 조회
  const result = await getPastExamList({
    school: params.school,
    schoolType: params.schoolType ?? 'all',
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

      <PastExamsTable data={exams} callerRole={callerRole} />

      <DataTableServerPagination
        total={total}
        page={result.meta?.page ?? 1}
        pageSize={result.meta?.pageSize ?? 10}
      />
    </div>
  )
}
