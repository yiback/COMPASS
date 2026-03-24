'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { MENU_ITEMS } from '@/lib/constants/menu'
import { Separator } from '@/components/ui/separator'
import type { Role } from '@/lib/auth'

interface DashboardSidebarProps {
  className?: string
  /** 현재 사용자 역할. undefined이면 모든 메뉴 표시 */
  role?: Role
}

/**
 * 대시보드 사이드바 (데스크톱용)
 * Client Component: usePathname으로 활성 링크 확인
 */
export function DashboardSidebar({ className, role }: DashboardSidebarProps) {
  const pathname = usePathname()

  /**
   * 역할별 메뉴 필터링:
   * - role 미전달 → 모든 항목 표시
   * - item.roles 미설정 → 모든 역할 허용
   * - system_admin → 모든 항목 표시
   * - 그 외 → item.roles에 현재 역할 포함 여부로 결정
   */
  const visibleItems = MENU_ITEMS.filter(
    (item) => !role || !item.roles || role === 'system_admin' || item.roles.includes(role)
  )

  return (
    <aside
      className={cn(
        'hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col',
        className
      )}
    >
      <div className="flex flex-col gap-y-5 overflow-y-auto border-r bg-card px-6 py-6">
        {/* 로고 영역 */}
        <div className="flex h-12 items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <span className="text-lg font-bold">C</span>
            </div>
            <span className="text-xl font-bold">COMPASS</span>
          </Link>
        </div>

        <Separator />

        {/* 네비게이션 메뉴 */}
        <nav className="flex flex-1 flex-col gap-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 transition-colors',
                    isActive ? 'text-primary-foreground' : 'text-muted-foreground'
                  )}
                />
                <span>{item.title}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
