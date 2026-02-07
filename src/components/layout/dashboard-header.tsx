import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MobileNav } from './mobile-nav'

interface DashboardHeaderProps {
  user?: {
    name?: string
    email?: string
    avatar_url?: string
  } | null
}

/**
 * 대시보드 헤더
 * Server Component: 사용자 정보를 props로 받음
 */
export function DashboardHeader({ user }: DashboardHeaderProps) {
  // 사용자 이름에서 이니셜 추출
  const getInitials = (name?: string) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="flex h-16 items-center gap-4 px-4 md:px-6">
        {/* 모바일 메뉴 버튼 */}
        <MobileNav />

        {/* 여백 */}
        <div className="flex-1" />

        {/* 사용자 정보 */}
        <div className="flex items-center gap-3">
          {user && (
            <>
              <div className="hidden text-right md:block">
                <p className="text-sm font-medium">{user.name || '사용자'}</p>
                <p className="text-xs text-muted-foreground">
                  {user.email || ''}
                </p>
              </div>
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.avatar_url} alt={user.name || '사용자'} />
                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
              </Avatar>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
