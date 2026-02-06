/**
 * Supabase Admin 클라이언트 (Service Role Key)
 *
 * ⚠️ RLS 우회 - 사용 최소화 필수
 *
 * 사용 케이스 (제한적):
 * - 회원가입 시 profiles 테이블 INSERT
 * - 시스템 관리자 배치 작업
 * - 멀티테넌시 academy 생성
 *
 * @warning
 * - 절대 Client Components에서 사용 금지
 * - 절대 브라우저에 노출 금지
 * - Server Actions, Route Handlers에서만 사용
 * - 가능한 RLS 정책으로 해결 (anon key 사용)
 */

import { createClient } from '@supabase/supabase-js'
import { Database } from './types'

export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
