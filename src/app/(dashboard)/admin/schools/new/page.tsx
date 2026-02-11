import { SchoolForm } from '../_components/school-form'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'

/**
 * 새 학교 추가 페이지
 */
export default function NewSchoolPage() {
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
        <h1 className="text-3xl font-bold">학교 추가</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          새로운 학교를 등록합니다.
        </p>
      </div>

      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg border bg-card p-6">
          <SchoolForm mode="create" />
        </div>
      </div>
    </div>
  )
}
