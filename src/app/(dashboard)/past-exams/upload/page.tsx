/**
 * 기출문제 업로드 페이지 (Server Component)
 * 학교 목록 조회 + 권한 확인
 */

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { UploadForm } from './upload-form'

export default async function PastExamUploadPage() {
  // admin/teacher만 접근 가능 (미통과 시 /unauthorized 리다이렉트)
  await requireRole(['admin', 'teacher'])

  // createClient는 학교 목록 조회에 필요 — 유지
  const supabase = await createClient()

  // 학교 목록 조회 (select 드롭다운용)
  const { data: schools } = await supabase
    .from('schools')
    .select('id, name, school_type')
    .order('name')

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6">
        <h1 className="text-2xl font-bold">기출문제 업로드</h1>
        <p className="mt-1 text-muted-foreground">
          시험지 이미지를 업로드하고 순서를 확인하세요.
        </p>
      </div>

      <UploadForm schools={schools ?? []} />
    </div>
  )
}
