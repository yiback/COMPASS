/**
 * Supabase Auth Callback Route Handler
 *
 * 역할:
 * - 이메일 확인 (가입 후 이메일 내 링크 클릭)
 * - 비밀번호 재설정 (리셋 이메일 내 링크 클릭)
 * - Supabase가 전달하는 code를 세션 토큰으로 교환
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const type = searchParams.get('type')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      return NextResponse.redirect(
        new URL('/login?message=auth-error', origin)
      )
    }

    // 비밀번호 복구 콜백인 경우 설정 페이지로 (비밀번호 변경 UI)
    if (type === 'recovery') {
      return NextResponse.redirect(new URL('/settings', origin))
    }

    // 이메일 확인 완료 → 대시보드로
    return NextResponse.redirect(new URL('/', origin))
  }

  // code가 없으면 로그인 페이지로
  return NextResponse.redirect(new URL('/login', origin))
}
