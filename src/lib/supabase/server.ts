/**
 * Supabase 서버 클라이언트
 *
 * Server Components, Server Actions, Route Handlers에서 사용
 * - 서버 사이드 쿼리
 * - RLS 자동 적용 (anon key 사용)
 * - 쿠키 기반 세션 관리
 *
 * @important Next.js 16에서 cookies() 함수는 비동기 (await 필수)
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component에서는 쿠키 set 불가 (무시)
            // Server Action, Route Handler에서만 쿠키 쓰기 가능
          }
        },
      },
    }
  )
}
