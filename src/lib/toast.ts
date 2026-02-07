import { toast } from 'sonner'

interface ActionResult {
  success: boolean
  error?: string
}

/**
 * Server Action 결과를 토스트로 표시
 * @param result - Server Action 반환값
 * @param successMessage - 성공 시 메시지
 */
export function showActionResult(result: ActionResult, successMessage: string) {
  if (result.success) {
    toast.success(successMessage)
  } else {
    toast.error(result.error ?? '오류가 발생했습니다.')
  }
}

/**
 * Promise 기반 토스트 (로딩 → 성공/실패 자동 전환)
 * @param promise - 실행할 Promise
 * @param messages - 각 상태별 메시지
 */
export function showPromiseToast<T>(
  promise: Promise<T>,
  messages: {
    loading: string
    success: string
    error?: string
  }
) {
  return toast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error ?? '오류가 발생했습니다.',
  })
}
