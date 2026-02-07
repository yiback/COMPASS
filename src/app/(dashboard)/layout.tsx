import { createClient } from '@/lib/supabase/server'
import { DashboardSidebar } from '@/components/layout/dashboard-sidebar'
import { DashboardHeader } from '@/components/layout/dashboard-header'

interface DashboardLayoutProps {
  children: React.ReactNode
}

/**
 * 대시보드 레이아웃
 * Server Component: Supabase에서 사용자 정보 조회
 */
export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  // Supabase 클라이언트 생성 (비동기)
  const supabase = await createClient()

  // 현재 로그인한 사용자 정보 조회
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  // 사용자 프로필 조회 (profiles 테이블)
  let userProfile = null
  if (authUser) {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, avatar_url, role')
      .eq('id', authUser.id)
      .single()

    userProfile = data
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 사이드바 (데스크톱) */}
      <DashboardSidebar />

      {/* 메인 콘텐츠 영역 */}
      <div className="flex flex-1 flex-col overflow-hidden md:ml-64">
        {/* 헤더 */}
        <DashboardHeader user={userProfile} />

        {/* 페이지 콘텐츠 */}
        <main className="flex-1 overflow-y-auto bg-muted/40 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
