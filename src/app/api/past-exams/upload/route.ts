/**
 * 기출문제 업로드 API Route Handler
 *
 * Server Action의 bodySizeLimit 제약을 우회하기 위해 Route Handler 사용.
 * 다중 이미지(최대 20장, 총 100MB) FormData를 수신하여
 * Supabase Storage 업로드 + DB INSERT를 처리한다.
 *
 * 기존 createPastExamAction 로직을 Route Handler로 이전.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createPastExamSchema,
  validateImages,
} from '@/lib/validations/exam-management'
import {
  isValidGradeForSchoolType,
  type SchoolType,
} from '@/lib/utils/grade-filter-utils'

// Route Segment Config — body size 제한 해제
export const runtime = 'nodejs'

// ─── 내부 헬퍼 ────────────────────────────────────────────

/** 허용 역할: teacher, admin, system_admin */
const ALLOWED_ROLES = ['teacher', 'admin', 'system_admin']

interface CurrentUserProfile {
  readonly id: string
  readonly role: string
  readonly academyId: string
}

async function getCurrentUserWithRole(): Promise<{
  readonly error?: string
  readonly profile?: CurrentUserProfile
}> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: '로그인이 필요합니다.' }
  }

  const { data: profile, error: profileError } = (await supabase
    .from('profiles')
    .select('id, role, academy_id')
    .eq('id', user.id)
    .single()) as {
    data: { id: string; role: string; academy_id: string | null } | null
    error: unknown
  }

  if (profileError || !profile) {
    return { error: '프로필을 찾을 수 없습니다.' }
  }

  if (!profile.academy_id) {
    return { error: '소속 학원이 없습니다.' }
  }

  if (!ALLOWED_ROLES.includes(profile.role)) {
    return { error: '권한이 없습니다.' }
  }

  return {
    profile: {
      id: profile.id,
      role: profile.role,
      academyId: profile.academy_id,
    },
  }
}

// ─── POST Handler ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. 인증 + 권한
  const { error: authError, profile } = await getCurrentUserWithRole()
  if (authError || !profile) {
    return NextResponse.json(
      { error: authError ?? '인증 실패' },
      { status: 401 }
    )
  }

  // 2. FormData 파싱
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: '요청 데이터를 파싱할 수 없습니다.' },
      { status: 400 }
    )
  }

  // 3. 메타데이터 검증 (Zod — Fail Fast)
  const raw = {
    schoolId: formData.get('schoolId'),
    year: formData.get('year'),
    semester: formData.get('semester'),
    examType: formData.get('examType'),
    grade: formData.get('grade'),
    subject: formData.get('subject'),
  }
  const parsed = createPastExamSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' },
      { status: 400 }
    )
  }

  // 4. 이미지 파일 추출 + 검증 (20장/5MB/100MB)
  const files = formData.getAll('images') as File[]
  const imageResult = validateImages(files)
  if (!imageResult.valid) {
    return NextResponse.json({ error: imageResult.error }, { status: 400 })
  }

  // 5. school_type ↔ grade 교차 검증 (Defense in Depth)
  const supabase = await createClient()
  const { data: school } = (await supabase
    .from('schools')
    .select('school_type')
    .eq('id', parsed.data.schoolId)
    .single()) as { data: { school_type: string } | null; error: unknown }

  if (
    school &&
    !isValidGradeForSchoolType(
      parsed.data.grade,
      school.school_type as SchoolType
    )
  ) {
    return NextResponse.json(
      { error: '선택한 학교 유형에 맞지 않는 학년입니다.' },
      { status: 400 }
    )
  }

  // 6. past_exams INSERT
  const { data: exam, error: examError } = (await supabase
    .from('past_exams')
    .insert({
      academy_id: profile.academyId,
      school_id: parsed.data.schoolId,
      created_by: profile.id,
      year: parsed.data.year,
      semester: parsed.data.semester,
      exam_type: parsed.data.examType,
      grade: parsed.data.grade,
      subject: parsed.data.subject,
      extraction_status: 'pending',
    })
    .select('id')
    .single()) as { data: { id: string } | null; error: unknown }

  if (examError || !exam) {
    return NextResponse.json(
      { error: '시험 생성에 실패했습니다.' },
      { status: 500 }
    )
  }

  const pastExamId = exam.id
  const admin = createAdminClient()

  // 7. 다중 이미지 → Storage 업로드 + past_exam_images INSERT
  const imageInserts: Array<{
    readonly past_exam_id: string
    readonly academy_id: string
    readonly page_number: number
    readonly source_image_url: string
  }> = []
  const uploadedPaths: string[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const fileId = crypto.randomUUID()
    const pageNumber = i + 1
    const storagePath = `${profile.academyId}/${pastExamId}/${pageNumber}-${fileId}.${ext}`

    const { error: uploadError } = await admin.storage
      .from('past-exams')
      .upload(storagePath, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      // Compensating Transaction: 이미 업로드된 이미지 삭제
      if (uploadedPaths.length > 0) {
        try {
          await admin.storage.from('past-exams').remove(uploadedPaths)
        } catch {
          /* orphan 허용 — Phase 2 cleanup */
        }
      }
      // past_exams 레코드 삭제 (orphan 방지)
      await supabase.from('past_exams').delete().eq('id', pastExamId)
      return NextResponse.json(
        { error: '이미지 업로드에 실패했습니다. 다시 시도해주세요.' },
        { status: 500 }
      )
    }
    uploadedPaths.push(storagePath)

    imageInserts.push({
      past_exam_id: pastExamId,
      academy_id: profile.academyId,
      page_number: pageNumber,
      source_image_url: storagePath,
    })
  }

  // Bulk INSERT (PostgreSQL 트랜잭션 — All or Nothing)
  const { error: imageDbError } = await supabase
    .from('past_exam_images')
    .insert(imageInserts)

  if (imageDbError) {
    return NextResponse.json(
      { error: '이미지 정보 저장에 실패했습니다.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: { pastExamId } })
}
