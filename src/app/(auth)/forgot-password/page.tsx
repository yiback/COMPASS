'use client'

/**
 * 비밀번호 재설정 페이지
 * 이메일 입력 → 재설정 링크 발송
 */

import { useActionState } from 'react'
import Link from 'next/link'
import { resetPasswordAction, type AuthActionResult } from '@/lib/actions/auth'
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

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState<AuthActionResult | null, FormData>(
    resetPasswordAction,
    null
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>비밀번호 재설정</CardTitle>
        <CardDescription>
          가입 시 사용한 이메일을 입력하면 재설정 링크를 보내드립니다.
        </CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="space-y-4">
          {/* 에러 메시지 */}
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
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? '발송 중...' : '재설정 링크 보내기'}
          </Button>

          <Link
            href="/login"
            className="text-center text-sm text-muted-foreground hover:underline"
          >
            로그인으로 돌아가기
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}
