'use client'

/**
 * 로그인 페이지
 * 이메일/비밀번호 폼 + Server Action 연동
 */

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { loginAction, type AuthActionResult } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/** searchParams 기반 메시지 (Suspense 필수) */
function LoginMessages() {
  const searchParams = useSearchParams()
  const message = searchParams.get('message')

  if (message === 'signup-success') {
    return (
      <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
        회원가입이 완료되었습니다. 이메일을 확인한 후 로그인해주세요.
      </div>
    )
  }

  if (message === 'reset-sent') {
    return (
      <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700">
        비밀번호 재설정 이메일을 발송했습니다. 이메일을 확인해주세요.
      </div>
    )
  }

  if (message === 'auth-error') {
    return (
      <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
        인증 처리 중 오류가 발생했습니다. 다시 시도해주세요.
      </div>
    )
  }

  return null
}

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState<AuthActionResult | null, FormData>(
    loginAction,
    null
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>로그인</CardTitle>
        <CardDescription>이메일과 비밀번호로 로그인하세요.</CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="space-y-4">
          {/* URL 쿼리 파라미터 기반 메시지 */}
          <Suspense>
            <LoginMessages />
          </Suspense>

          {/* Server Action 에러 메시지 */}
          {state?.error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          )}

          {/* 이메일 */}
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="email@example.com"
              autoComplete="email"
              required
            />
          </div>

          {/* 비밀번호 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">비밀번호</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:underline"
              >
                비밀번호를 잊으셨나요?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="8자 이상"
              autoComplete="current-password"
              required
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? '로그인 중...' : '로그인'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            아직 계정이 없으신가요?{' '}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              회원가입
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
