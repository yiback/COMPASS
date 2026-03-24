'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { MENU_ITEMS } from '@/lib/constants/menu'
import { Separator } from '@/components/ui/separator'
import type { Role } from '@/lib/auth'

interface MobileNavProps {
  /** 현재 사용자 역할. undefined이면 모든 메뉴 표시 */
  role?: Role
}

/**
 * 모바일 네비게이션 (모바일/태블릿용)
 * Client Component: Sheet 상태 관리 및 usePathname 사용
 */
export function MobileNav({ role }: MobileNavProps) {
  const [open, setOpen] = useState(false)
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-6 w-6" />
          <span className="sr-only">메뉴 열기</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="px-6 py-6">
          <SheetTitle>
            <Link
              href="/"
              className="flex items-center gap-2"
              onClick={() => setOpen(false)}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <span className="text-lg font-bold">C</span>
              </div>
              <span className="text-xl font-bold">COMPASS</span>
            </Link>
          </SheetTitle>
        </SheetHeader>

        <Separator />

        <nav className="flex flex-col gap-y-1 px-4 py-4">
          {visibleItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
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
      </SheetContent>
    </Sheet>
  )
}
