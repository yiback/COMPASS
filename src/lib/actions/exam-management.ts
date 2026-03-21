/**
 * 시험 관리 Server Actions
 *
 * extract-questions.ts(추출/재추출/재분석)와 분리하여 파일 크기를 밸런싱한다.
 * (v9 Scope CONSIDER 4: extract-questions.ts에 이미 3개 Action이 배치되어 비대화 방지)
 *
 * - createPastExamAction: 시험 생성 + 다중 이미지 Storage 업로드
 * - updateExtractedQuestionAction: 추출 문제 편집
 * - deleteExtractedQuestionAction: 추출 문제 삭제
 * - confirmExtractedQuestionsAction: 추출 문제 전체 확정
 * - createExtractedQuestionAction: 수동 문제 추가 (리뷰 MUST FIX 반영)
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createPastExamSchema,
  validateImages,
  updateExtractedQuestionSchema,
  createExtractedQuestionSchema,
} from '@/lib/validations/exam-management'
import {
  isValidGradeForSchoolType,
  type SchoolType,
} from '@/lib/utils/grade-filter-utils'

// ─── 반환 타입 ────────────────────────────────────────────

export interface ExamManagementResult {
  readonly error?: string
  readonly data?: {
    readonly pastExamId: string
  }
}

export interface UpdateQuestionResult {
  readonly error?: string
  readonly data?: {
    readonly id: string
  }
}

export interface DeleteQuestionResult {
  readonly error?: string
}

export interface ConfirmQuestionsResult {
  readonly error?: string
  readonly data?: {
    readonly confirmedCount: number
  }
}

export interface CreateQuestionResult {
  readonly error?: string
  readonly data?: {
    readonly id: string
  }
}

// ─── 내부 헬퍼 ────────────────────────────────────────────

interface CurrentUserProfile {
  readonly id: string
  readonly role: string
  readonly academyId: string
}

interface GetCurrentUserResult {
  readonly error?: string
  readonly profile?: CurrentUserProfile
}

/** 허용 역할: teacher, admin, system_admin */
const ALLOWED_ROLES = ['teacher', 'admin', 'system_admin']

/**
 * 현재 사용자 인증 + 프로필 + 역할 확인
 * 역할 검증까지 포함 (teacher/admin/system_admin)
 */
async function getCurrentUserWithRole(): Promise<GetCurrentUserResult> {
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

// ─── createPastExamAction ─────────────────────────────────

/**
 * @deprecated API Route(/api/past-exams/upload)로 대체됨.
 * Next.js Server Action의 bodySizeLimit 제약으로 다중 이미지 업로드 실패 →
 * Route Handler로 이전. Phase 2에서 제거 예정.
 */
export async function createPastExamAction(
  formData: FormData
): Promise<ExamManagementResult> {
  // 1. 인증 + 권한
  const { error: authError, profile } = await getCurrentUserWithRole()
  if (authError || !profile) {
    return { error: authError }
  }

  // 2. 메타데이터 검증 (Zod — Fail Fast)
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
    return {
      error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.',
    }
  }

  // 3. 이미지 파일 추출 + 검증 (20장/5MB/100MB)
  const files = formData.getAll('images') as File[]
  const imageResult = validateImages(files)
  if (!imageResult.valid) {
    return { error: imageResult.error }
  }

  // 4. school_type ↔ grade 교차 검증 (Defense in Depth)
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
    return { error: '선택한 학교 유형에 맞지 않는 학년입니다.' }
  }

  // 5. past_exams INSERT
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 생성 타입 미생성
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
    return { error: '시험 생성에 실패했습니다.' }
  }

  const pastExamId = exam.id
  const admin = createAdminClient()

  // 6. 재업로드 시 기존 이미지 정리
  const { data: existingImages } = await supabase
    .from('past_exam_images')
    .select('source_image_url')
    .eq('past_exam_id', pastExamId)

  if (existingImages && existingImages.length > 0) {
    const existingUrls = existingImages.map(
      (img: { source_image_url: string }) => img.source_image_url
    )
    // Non-blocking: Storage 삭제 실패 시 무시 (orphan은 Phase 2 cleanup)
    await admin.storage
      .from('past-exams')
      .remove(existingUrls)
      .catch(() => {})
    await supabase
      .from('past_exam_images')
      .delete()
      .eq('past_exam_id', pastExamId)
  }

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
      // 롤백: 이미 업로드된 이미지 삭제 (Non-blocking)
      if (uploadedPaths.length > 0) {
        try {
          await admin.storage.from('past-exams').remove(uploadedPaths)
        } catch {
          /* orphan 허용 */
        }
      }
      // past_exams 레코드 삭제 (orphan 방지)
      await supabase.from('past_exams').delete().eq('id', pastExamId)
      return { error: '이미지 업로드에 실패했습니다. 다시 시도해주세요.' }
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
    return { error: '이미지 정보 저장에 실패했습니다.' }
  }

  return { data: { pastExamId } }
}

// ─── updateExtractedQuestionAction ────────────────────────

export async function updateExtractedQuestionAction(
  detailId: string,
  rawInput: Record<string, unknown>
): Promise<UpdateQuestionResult> {
  // 1. 인증 + 권한
  const { error: authError } = await getCurrentUserWithRole()
  if (authError) {
    return { error: authError }
  }

  // 2. Zod 검증
  const parsed = updateExtractedQuestionSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.',
    }
  }

  // 3. 해당 detail 존재 확인 (RLS가 academy_id 자동 격리)
  const supabase = await createClient()
  const { data: detail, error: detailError } = await supabase
    .from('past_exam_details')
    .select('id')
    .eq('id', detailId)
    .single()

  if (detailError || !detail) {
    return { error: '문제를 찾을 수 없습니다.' }
  }

  // 4. UPDATE
  const { error: updateError } = await supabase
    .from('past_exam_details')
    .update({
      question_text: parsed.data.questionText,
      question_type: parsed.data.questionType,
      options: parsed.data.options ?? null,
      answer: parsed.data.answer ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', detailId)

  if (updateError) {
    return { error: '문제 수정에 실패했습니다.' }
  }

  return { data: { id: detailId } }
}

// ─── deleteExtractedQuestionAction ────────────────────────

export async function deleteExtractedQuestionAction(
  detailId: string
): Promise<DeleteQuestionResult> {
  // 1. 인증 + 권한
  const { error: authError } = await getCurrentUserWithRole()
  if (authError) {
    return { error: authError }
  }

  // 2. 해당 detail 존재 확인
  const supabase = await createClient()
  const { data: detail, error: detailError } = await supabase
    .from('past_exam_details')
    .select('id')
    .eq('id', detailId)
    .single()

  if (detailError || !detail) {
    return { error: '문제를 찾을 수 없습니다.' }
  }

  // 3. DELETE
  const { error: deleteError } = await supabase
    .from('past_exam_details')
    .delete()
    .eq('id', detailId)

  if (deleteError) {
    return { error: '문제 삭제에 실패했습니다.' }
  }

  return {}
}

// ─── confirmExtractedQuestionsAction ──────────────────────

export async function confirmExtractedQuestionsAction(
  pastExamId: string
): Promise<ConfirmQuestionsResult> {
  // 1. 인증 + 권한
  const { error: authError } = await getCurrentUserWithRole()
  if (authError) {
    return { error: authError }
  }

  // 2. 해당 시험 존재 + extraction_status 확인
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 생성 타입 미생성
  const { data: exam, error: examError } = (await supabase
    .from('past_exams')
    .select('id, extraction_status')
    .eq('id', pastExamId)
    .single()) as {
    data: { id: string; extraction_status: string } | null
    error: unknown
  }

  if (examError || !exam) {
    return { error: '시험을 찾을 수 없습니다.' }
  }
  if (exam.extraction_status !== 'completed') {
    return { error: '추출이 완료된 시험만 확정할 수 있습니다.' }
  }

  // 3. 모든 미확정 details → is_confirmed = true
  const { data: updated, error: updateError } = await supabase
    .from('past_exam_details')
    .update({ is_confirmed: true, updated_at: new Date().toISOString() })
    .eq('past_exam_id', pastExamId)
    .eq('is_confirmed', false)
    .select('id')

  if (updateError) {
    return { error: '문제 확정에 실패했습니다.' }
  }

  return { data: { confirmedCount: updated?.length ?? 0 } }
}

// ─── createExtractedQuestionAction ────────────────────────

/** 수동 문제 추가 (리뷰 MUST FIX 반영 — Step 7 편집 UI에서 [+ 문제 수동 추가]) */
export async function createExtractedQuestionAction(
  pastExamId: string,
  rawInput: Record<string, unknown>
): Promise<CreateQuestionResult> {
  // 1. 인증 + 권한
  const { error: authError, profile } = await getCurrentUserWithRole()
  if (authError || !profile) {
    return { error: authError }
  }

  // 2. Zod 검증
  const parsed = createExtractedQuestionSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.',
    }
  }

  // 3. past_exams 존재 확인 (RLS가 academy_id 자동 격리)
  const supabase = await createClient()
  const { data: exam, error: examError } = await supabase
    .from('past_exams')
    .select('id')
    .eq('id', pastExamId)
    .single()

  if (examError || !exam) {
    return { error: '시험을 찾을 수 없습니다.' }
  }

  // 4. past_exam_details INSERT
  const { data: inserted, error: insertError } = (await supabase
    .from('past_exam_details')
    .insert({
      past_exam_id: pastExamId,
      academy_id: profile.academyId,
      question_number: parsed.data.questionNumber,
      question_text: parsed.data.questionText,
      question_type: parsed.data.questionType,
      options: parsed.data.options ?? null,
      answer: parsed.data.answer ?? null,
      has_figure: false,
      confidence: null,
      is_confirmed: false,
    })
    .select('id')
    .single()) as { data: { id: string } | null; error: unknown }

  if (insertError || !inserted) {
    return { error: '문제 추가에 실패했습니다.' }
  }

  return { data: { id: inserted.id } }
}
