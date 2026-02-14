import { getMyAcademy } from '@/lib/actions/academies'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AcademyForm } from './_components/academy-form'
import { AcademyInfoCard } from './_components/academy-info-card'

export default async function AcademyPage() {
  const result = await getMyAcademy()

  // 에러 처리
  if (result.error || !result.data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">학원 관리</h1>
          <p className="text-muted-foreground">
            학원 기본 정보를 확인하고 관리합니다.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>오류 발생</CardTitle>
            <CardDescription>
              {result.error ?? '학원 정보를 불러올 수 없습니다.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const { role, ...academyData } = result.data
  const canEdit = role === 'admin' || role === 'system_admin'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">학원 관리</h1>
        <p className="text-muted-foreground">
          학원 기본 정보를 확인하고 관리합니다.
        </p>
      </div>
      {canEdit ? (
        <AcademyForm initialData={academyData} />
      ) : (
        <AcademyInfoCard data={academyData} />
      )}
    </div>
  )
}
