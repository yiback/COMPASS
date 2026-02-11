import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardSidebar } from '@/components/layout/dashboard-sidebar'
import { DashboardHeader } from '@/components/layout/dashboard-header'

interface DashboardLayoutProps {
  children: React.ReactNode
}

/**
 * 대시보드 레이아웃
 * Server Component: Supabase에서 사용자 정보 조회
 * 인증 이중 보호: 미들웨어 + 레이아웃 레벨
 */
export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const supabase = await createClient()

  // 인증 체크 (미들웨어 이중 보호)
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/login')
  }

  // 사용자 프로필 조회 (profiles 테이블)
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, role')
    .eq('id', authUser.id)
    .single()

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
