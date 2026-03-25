'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
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
import { deactivateAchievementStandard } from '@/lib/actions/achievement-standards'

// ─── 타입 ──────────────────────────────────────────────

interface DeactivateDialogProps {
  readonly standardId: string
  readonly standardCode: string
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

// ─── 비활성화 AlertDialog ──────────────────────────────

export function DeactivateDialog({
  standardId,
  standardCode,
  open,
  onOpenChange,
}: DeactivateDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleDeactivate() {
    startTransition(async () => {
      const result = await deactivateAchievementStandard(standardId)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('성취기준이 비활성화되었습니다.')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>성취기준 비활성화</AlertDialogTitle>
          <AlertDialogDescription>
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
              {standardCode}
            </code>
            {' '}성취기준을 비활성화하시겠습니까?
            <br />
            비활성화된 성취기준은 목록에서 숨겨지지만 삭제되지 않습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeactivate}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? '처리 중...' : '비활성화'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
