'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ShieldAlert, UserX, UserCheck } from 'lucide-react'
import { toggleUserActive } from '@/lib/actions/users'
import type { UserProfile } from '@/lib/actions/users'
import { toast } from 'sonner'
import { ROLE_MAP, ROLE_BADGE_VARIANT, STATUS_BADGE } from './user-columns'

// ─── 타입 정의 ────────────────────────────────────────

interface UserDetailSheetProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly user: UserProfile
  readonly callerId: string
  readonly callerRole: string
  /** Sheet에서 역할 변경 클릭 시 — AlertDialog를 겹쳐 열기 위한 콜백 */
  readonly onRoleChangeClick: () => void
}

// ─── 정보 행 컴포넌트 ─────────────────────────────────

interface InfoRowProps {
  readonly label: string
  readonly children: React.ReactNode
}

function InfoRow({ label, children }: InfoRowProps) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium">{children}</div>
    </div>
  )
}

// ─── 컴포넌트 ──────────────────────────────────────────

/**
 * 사용자 상세 Sheet (오른쪽 사이드 패널)
 *
 * - 사용자 기본 정보 표시 (이름, 이메일, 역할, 상태, 전화번호, 가입일)
 * - admin/system_admin만 액션 버튼 표시
 * - 자기 자신 또는 system_admin 대상은 액션 비활성화
 */
export function UserDetailSheet({
  open,
  onOpenChange,
  user,
  callerId,
  callerRole,
  onRoleChangeClick,
}: UserDetailSheetProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // 액션 표시 조건
  const isSelf = user.id === callerId
  const isSystemAdmin = user.role === 'system_admin'
  const isAdmin = ['admin', 'system_admin'].includes(callerRole)
  const canManage = isAdmin && !isSelf && !isSystemAdmin

  const statusKey = user.isActive ? 'active' : 'inactive'
  const statusInfo = STATUS_BADGE[statusKey]

  function handleToggleActive() {
    const action = user.isActive ? '비활성화' : '활성화'

    startTransition(async () => {
      const result = await toggleUserActive(user.id, !user.isActive)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${user.name}님이 ${action}되었습니다.`)
        onOpenChange(false)
        router.refresh()
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>사용자 상세</SheetTitle>
          <SheetDescription>사용자 정보를 확인합니다.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 p-4">
          {/* ── 기본 정보 섹션 ── */}
          <InfoRow label="이름">{user.name}</InfoRow>

          <InfoRow label="이메일">{user.email}</InfoRow>

          <InfoRow label="역할">
            <Badge variant={ROLE_BADGE_VARIANT[user.role] ?? 'secondary'}>
              {ROLE_MAP[user.role] ?? user.role}
            </Badge>
          </InfoRow>

          <InfoRow label="상태">
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </InfoRow>

          <InfoRow label="전화번호">{user.phone ?? '—'}</InfoRow>

          <InfoRow label="가입일">
            {new Date(user.createdAt).toLocaleDateString('ko-KR')}
          </InfoRow>

          {/* ── 액션 섹션 (admin만, 자기 자신/system_admin 제외) ── */}
          {canManage && (
            <>
              <Separator />
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onRoleChangeClick}
                  disabled={isPending}
                >
                  <ShieldAlert className="mr-2 h-4 w-4" />
                  역할 변경
                </Button>

                <Button
                  variant={user.isActive ? 'destructive' : 'default'}
                  className="w-full"
                  onClick={handleToggleActive}
                  disabled={isPending}
                >
                  {isPending ? (
                    '처리 중...'
                  ) : user.isActive ? (
                    <>
                      <UserX className="mr-2 h-4 w-4" />
                      비활성화
                    </>
                  ) : (
                    <>
                      <UserCheck className="mr-2 h-4 w-4" />
                      활성화
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
