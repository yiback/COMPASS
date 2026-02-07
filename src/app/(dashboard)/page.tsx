import { createClient } from '@/lib/supabase/server'

/**
 * 대시보드 홈 페이지
 * Server Component
 */
export default async function DashboardPage() {
  const supabase = await createClient()

  // 사용자 정보 조회
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let userName: string | null = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()

    // Supabase 타입 단언 (타입 생성 전 임시 처리)
    userName = (data as { name: string } | null)?.name || null
  }

  return (
    <div className="space-y-6">
      {/* 환영 메시지 */}
      <div className="rounded-lg border bg-card p-6">
        <h1 className="text-3xl font-bold">
          {userName ? `안녕하세요, ${userName}님!` : '안녕하세요!'}
        </h1>
        <p className="mt-2 text-muted-foreground">
          COMPASS 대시보드에 오신 것을 환영합니다.
        </p>
      </div>

      {/* TODO: 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">
            생성된 문제
          </h3>
          <p className="mt-2 text-3xl font-bold">0</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">
            기출문제
          </h3>
          <p className="mt-2 text-3xl font-bold">0</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">학생 수</h3>
          <p className="mt-2 text-3xl font-bold">0</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">
            진행 중인 시험
          </h3>
          <p className="mt-2 text-3xl font-bold">0</p>
        </div>
      </div>

      {/* TODO: 최근 활동 */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold">최근 활동</h2>
        <p className="mt-4 text-sm text-muted-foreground">
          최근 활동 내역이 없습니다.
        </p>
      </div>
    </div>
  )
}
