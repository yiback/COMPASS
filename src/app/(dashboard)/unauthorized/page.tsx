import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ShieldAlert } from 'lucide-react'

/**
 * 403 권한 없음 페이지
 * requireRole() 실패 시 redirect 대상
 */
export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <ShieldAlert className="h-16 w-16 text-muted-foreground" />
      <h1 className="text-2xl font-bold">접근 권한이 없습니다</h1>
      <p className="text-muted-foreground">
        이 페이지에 접근할 권한이 부족합니다.
      </p>
      <Button asChild>
        <Link href="/">대시보드로 이동</Link>
      </Button>
    </div>
  )
}
