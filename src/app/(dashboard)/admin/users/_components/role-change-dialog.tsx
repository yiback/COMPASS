'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { changeUserRole } from '@/lib/actions/users'
import type { UserProfile } from '@/lib/actions/users'
import { toast } from 'sonner'
import { ROLE_MAP } from './user-columns'

interface RoleChangeDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly user: UserProfile
  readonly callerRole: string
}

// ─── 빈칸 #1 ────────────────────────────────────────────
// getAvailableRoles(callerRole, currentRole) 함수를 구현하세요.
//
// 규칙:
//   - allRoles: student / teacher / admin 3가지
//   - currentRole과 같은 건 제외 (의미 없는 선택)
//   - callerRole이 'admin'이면 'admin' 옵션도 제외
//
// 반환 타입: Array<{ value: string; label: string }>
// ─────────────────────────────────────────────────────────
function getAvailableRoles(
  callerRole: string,
  currentRole: string
): Array<{ value: string; label: string }> {
  // TODO: 여기에 구현하세요
  const allRoles = [
    { value: 'student', label: ROLE_MAP.student },
    { value: 'teacher', label: ROLE_MAP.teacher },
    { value: 'admin', label: ROLE_MAP.admin},
  ]

  return allRoles.filter((role) => {
    if(role.value === currentRole) return false
    if(callerRole === 'admin' && role.value === 'admin') return false

    return true
  })
}

// ─── 빈칸 #2 ────────────────────────────────────────────
// RoleChangeDialog 컴포넌트를 완성하세요.
//
// 힌트:
//   - useState로 selectedRole 관리 (초기값: '')
//   - useTransition으로 isPending 관리
//   - handleConfirm: changeUserRole 호출 → 성공/실패 분기
//   - handleOpenChange: 닫힐 때 selectedRole 초기화
// ─────────────────────────────────────────────────────────
export function RoleChangeDialog({
  open,
  onOpenChange,
  user,
  callerRole,
}: RoleChangeDialogProps) {
  const router = useRouter()

  // TODO: isPending, startTransition, selectedRole state 선언
  const [isPending, startTransition] = useTransition()
  const [selectedRole, setSelectedRole] = useState<string>('')

  const availableRoles = getAvailableRoles(callerRole, user.role)

  // TODO: handleConfirm 함수
  // - selectedRole 없으면 early return
  // - startTransition 내에서 changeUserRole 호출
  // - 성공: toast.success + onOpenChange(false) + selectedRole 초기화 + router.refresh()
  // - 실패: toast.error
  function handleConfirm() {
    if(!selectedRole) return
  
    startTransition(async () => {
      const result = await changeUserRole(
          user.id,
          selectedRole as 'student' | 'teacher' | 'admin'
      )
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${user.name}님의 역할이 변경되었습니다.`)
        onOpenChange(false)
        setSelectedRole('')
        router.refresh()
      }
    })
  }

  // TODO: handleOpenChange 함수
  // - 닫힐 때(nextOpen === false) selectedRole을 ''로 초기화
  function handleOpenChange(nextOpen: boolean) {
    if(!nextOpen) {
      setSelectedRole('')
    }
    onOpenChange(nextOpen)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>역할 변경</AlertDialogTitle>
          <AlertDialogDescription>
            {/* TODO: user.name을 표시하고 안내 문구 작성 */}
            <span className="font-medium text-foreground">{user.name}</span>님의 역할을
            변경합니다. 이 작업은 해당 사용자의 접근 권한에 영향을 줍니다.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <p className="text-sm text-muted-foreground">
            현재 역할:{' '}
            <span className="font-medium text-foreground">
              {/* TODO: ROLE_MAP으로 현재 역할 표시 */}
              {ROLE_MAP[user.role] ?? user.role}

            </span>
          </p>

          {/* TODO: Select 컴포넌트로 새 역할 선택 */}
          {/* value={selectedRole}, onValueChange로 setSelectedRole */}
          {/* availableRoles.map으로 SelectItem 렌더 */}
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger>
              <SelectValue placeholder = "새 역할을 선택하세요" />
            </SelectTrigger>
            <SelectContent>
              {availableRoles.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <AlertDialogFooter>
          {/* TODO: AlertDialogCancel — isPending일 때 disabled */}
          {/* TODO: AlertDialogAction — onClick=handleConfirm, isPending 또는 selectedRole 없으면 disabled */}
          {/*       버튼 텍스트: isPending ? '변경 중...' : '변경' */}
          <AlertDialogCancel disabled={isPending}>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending || !selectedRole}
          >
            {isPending ? '변경 중...' : '변경'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
