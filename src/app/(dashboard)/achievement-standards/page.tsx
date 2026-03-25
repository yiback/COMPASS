import { requireRole } from '@/lib/auth'
import { getAchievementStandards } from '@/lib/actions/achievement-standards'
import { AchievementStandardsTable } from '@/components/achievement-standards/achievement-standards-table'
import { FormDialog } from '@/components/achievement-standards/form-dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { AchievementStandard } from '@/components/achievement-standards/columns'

interface PageProps {
  searchParams: Promise<{
    subject?: string
    grade?: string
    semester?: string
    unit?: string
    search?: string
  }>
}

/**
 * 성취기준 목록 페이지
 * Server Component: 필터 기반 조회 + RBAC
 */
export default async function AchievementStandardsPage({
  searchParams,
}: PageProps) {
  // RBAC: admin, teacher, student 접근 (system_admin은 자동 통과)
  const profile = await requireRole(['admin', 'teacher', 'student'])

  const params = await searchParams
  const isSystemAdmin = profile.role === 'system_admin'

  // 필터 적용하여 데이터 조회
  const result = await getAchievementStandards({
    subject: params.subject,
    grade: params.grade ? parseInt(params.grade) : undefined,
    semester: params.semester ? parseInt(params.semester) : undefined,
    unit: params.unit,
    search: params.search,
    isActive: 'true', // 기본값: 활성만
  })

  if (result.error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">성취기준</h1>
        </div>
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          에러: {result.error}
        </div>
      </div>
    )
  }

  const standards = (result.data ?? []) as AchievementStandard[]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">성취기준</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            총 {standards.length}개의 성취기준
          </p>
        </div>
        {/* system_admin만 추가 버튼 */}
        {isSystemAdmin && (
          <FormDialog
            mode="create"
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                성취기준 추가
              </Button>
            }
          />
        )}
      </div>

      <AchievementStandardsTable
        data={standards}
        isSystemAdmin={isSystemAdmin}
      />
    </div>
  )
}
