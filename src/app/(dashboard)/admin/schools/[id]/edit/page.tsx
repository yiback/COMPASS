import { SchoolForm } from '../../_components/school-form'
import { getSchoolById } from '@/lib/actions/schools'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'

interface EditSchoolPageProps {
  params: Promise<{
    id: string
  }>
}

/**
 * 학교 수정 페이지
 * Server Component: 학교 데이터 조회 후 SchoolForm에 전달
 */
export default async function EditSchoolPage({ params }: EditSchoolPageProps) {
  const { id } = await params
  const result = await getSchoolById(id)

  if (result.error || !result.data) {
    notFound()
  }

  const school = result.data as {
    id: string
    name: string
    school_type: 'elementary' | 'middle' | 'high'
    region?: string | null
    district?: string | null
    address?: string | null
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/schools">
            <ChevronLeft className="mr-2 h-4 w-4" />
            목록으로
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">학교 정보 수정</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {school.name}의 정보를 수정합니다.
        </p>
      </div>

      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg border bg-card p-6">
          <SchoolForm mode="edit" initialData={school} />
        </div>
      </div>
    </div>
  )
}
