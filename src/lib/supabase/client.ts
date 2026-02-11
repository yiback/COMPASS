/**
 * Supabase 브라우저 클라이언트
 *
 * Client Components에서 사용
 * - 클라이언트 사이드 쿼리
 * - 실시간 구독
 * - RLS 자동 적용 (anon key 사용)
 */

import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
