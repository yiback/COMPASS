/**
 * 기출문제 업로드 페이지 (Server Component)
 * 학교 목록 조회 + 권한 확인
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UploadForm } from './upload-form'

export default async function PastExamUploadPage() {
  const supabase = await createClient()

  // 인증 확인
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 역할 확인 (교사/관리자만)
  const { data: profile } = (await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()) as { data: { role: string } | null }

  if (
    !profile ||
    !['teacher', 'admin', 'system_admin'].includes(profile.role)
  ) {
    redirect('/past-exams')
  }

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
          학교별 기출문제를 업로드하세요.
        </p>
      </div>

      <UploadForm schools={schools ?? []} />
    </div>
  )
}
