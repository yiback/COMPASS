/**
 * 기출문제 업로드 Server Actions
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  pastExamUploadSchema,
  validateFile,
  getFileExtension,
} from '@/lib/validations/past-exams'

// ─── 반환 타입 ────────────────────────────────────────────

export interface PastExamActionResult {
  readonly error?: string
  readonly data?: {
    readonly id: string
  }
}

// ─── 업로드 Action ────────────────────────────────────────

export async function uploadPastExamAction(
  _prevState: PastExamActionResult | null,
  formData: FormData
): Promise<PastExamActionResult> {
  // 1. 인증 확인
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 2. 역할 확인 (교사/관리자만)
  const { data: profile } = (await supabase
    .from('profiles')
    .select('role, academy_id')
    .eq('id', user.id)
    .single()) as {
    data: { role: string; academy_id: string } | null
    error: unknown
  }

  if (!profile) {
    return { error: '프로필을 찾을 수 없습니다.' }
  }

  if (!['teacher', 'admin', 'system_admin'].includes(profile.role)) {
    return { error: '기출문제 업로드 권한이 없습니다.' }
  }

  // 3. 파일 검증
  const file = formData.get('file')
  const fileResult = validateFile(file)
  if (!fileResult.valid) {
    return { error: fileResult.error }
  }
  const validFile = file as File

  // 4. 메타데이터 검증
  const raw = {
    schoolId: formData.get('schoolId'),
    year: formData.get('year'),
    semester: formData.get('semester'),
    examType: formData.get('examType'),
    grade: formData.get('grade'),
    subject: formData.get('subject'),
  }
  const parsed = pastExamUploadSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.',
    }
  }

  // 5. Storage 경로 생성
  const ext = getFileExtension(validFile.name)
  const fileId = crypto.randomUUID()
  const storagePath = `${profile.academy_id}/${parsed.data.schoolId}/${parsed.data.year}-${parsed.data.semester}-${parsed.data.examType}/${fileId}.${ext}`

  // 6. Storage 업로드 (admin 클라이언트 -> RLS 우회)
  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from('past-exams')
    .upload(storagePath, validFile, {
      contentType: validFile.type,
      upsert: false,
    })

  if (uploadError) {
    return { error: '파일 업로드에 실패했습니다. 다시 시도해주세요.' }
  }

  // 7. DB 저장 (서버 클라이언트 -> RLS 적용)
  const { data: inserted, error: dbError } = await supabase
    .from('past_exam_questions')
    .insert({
      academy_id: profile.academy_id,
      school_id: parsed.data.schoolId,
      uploaded_by: user.id,
      year: parsed.data.year,
      semester: parsed.data.semester,
      exam_type: parsed.data.examType,
      grade: parsed.data.grade,
      subject: parsed.data.subject,
      source_image_url: storagePath,
      extraction_status: 'pending',
    })
    .select('id')
    .single()

  if (dbError || !inserted) {
    // DB 실패 시 업로드된 파일 정리
    await admin.storage.from('past-exams').remove([storagePath])
    return { error: '기출문제 저장에 실패했습니다. 다시 시도해주세요.' }
  }

  return { data: { id: (inserted as { id: string }).id } }
}
