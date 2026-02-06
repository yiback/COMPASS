/**
 * Supabase 연결 테스트 페이지
 *
 * academies 테이블 데이터를 조회하여 연결 확인
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function TestPage() {
  // RLS를 우회하여 데이터 확인 (테스트용)
  const supabase = createAdminClient()

  // academies 테이블 조회
  const { data: academies, error } = await supabase
    .from('academies')
    .select('*')
    .limit(5)

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          ❌ Supabase 연결 실패
        </h1>
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="font-mono text-sm">{error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">
        ✅ Supabase 연결 성공!
      </h1>
      <p className="text-gray-600 mb-6">
        환경변수와 클라이언트 설정이 올바르게 되어 있습니다.
      </p>

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-3">
            📊 Academies 테이블 ({academies?.length || 0}개)
          </h2>
          <pre className="bg-gray-100 border border-gray-200 rounded p-4 overflow-auto">
            {JSON.stringify(academies, null, 2)}
          </pre>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          <h3 className="font-semibold text-blue-900 mb-2">
            ✨ 다음 단계
          </h3>
          <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
            <li>Phase 0-3: Route Groups 및 기본 레이아웃 구현</li>
            <li>Phase 0-3: 인증 페이지 (로그인, 회원가입)</li>
            <li>Phase 0-4: 대시보드 홈 페이지</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
