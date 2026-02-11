'use client'

/**
 * 로그아웃 버튼
 * Client Component: Server Action 호출
 */

import { logoutAction } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button variant="ghost" size="icon" type="submit" title="로그아웃">
        <LogOut className="h-4 w-4" />
      </Button>
    </form>
  )
}
