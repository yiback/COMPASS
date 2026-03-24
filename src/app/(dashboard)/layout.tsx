import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/auth'
import { DashboardSidebar } from '@/components/layout/dashboard-sidebar'
import { DashboardHeader } from '@/components/layout/dashboard-header'

interface DashboardLayoutProps {
  children: React.ReactNode
}

/**
 * 대시보드 레이아웃
 * Server Component: getCurrentProfile()로 사용자 정보 조회 (React 19 cache 적용)
 * 인증 이중 보호: 미들웨어 + 레이아웃 레벨
 * 역할 체크는 각 page.tsx의 requireRole()에서 수행
 */
export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const profile = await getCurrentProfile()

  if (!profile) {
    redirect('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 사이드바 (데스크톱) — role로 메뉴 필터링 */}
      <DashboardSidebar role={profile.role} />

      {/* 메인 콘텐츠 영역 */}
      <div className="flex flex-1 flex-col overflow-hidden md:ml-64">
        {/* 헤더 — role을 MobileNav에 drilling */}
        <DashboardHeader
          user={{
            name: profile.name,
            email: profile.email,
            avatar_url: profile.avatarUrl ?? undefined,
          }}
          role={profile.role}
        />

        {/* 페이지 콘텐츠 */}
        <main className="flex-1 overflow-y-auto bg-muted/40 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
