/**
 * 기출문제 Server Actions
 *
 * - uploadPastExamAction: 기출문제 업로드 (교사/관리자)
 * - getPastExamList: 목록 조회 + 필터 + 페이지네이션 (인증된 사용자)
 * - getPastExamDetail: 상세 조회 + Storage Signed URL (인증된 사용자)
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  pastExamUploadSchema,
  pastExamFilterSchema,
  validateFile,
  getFileExtension,
} from '@/lib/validations/past-exams'
import {
  getGradeRange,
  isValidGradeForSchoolType,
  type SchoolType,
} from '@/lib/utils/grade-filter-utils'

// ─── 업로드 반환 타입 ─────────────────────────────────────

export interface PastExamActionResult {
  readonly error?: string
  readonly data?: {
    readonly id: string
  }
}

// ─── 목록/상세 조회 타입 ──────────────────────────────────

export interface PastExamListItem {
  readonly id: string
  readonly schoolName: string
  readonly schoolType: string
  readonly year: number
  readonly semester: number
  readonly examType: string
  readonly grade: number
  readonly subject: string
  readonly extractionStatus: string
  readonly uploadedByName: string | null
  readonly createdAt: string
}

/** 기출문제 이미지 (past_exam_images JOIN 결과) */
export interface PastExamImage {
  readonly id: string
  readonly pageNumber: number
  readonly sourceImageUrl: string
  readonly signedImageUrl?: string | null
}

/** 기출문제 상세 항목 (past_exam_details JOIN 결과) */
export interface PastExamDetailItem {
  readonly id: string
  readonly questionNumber: number
  readonly questionText: string
  readonly questionType: string | null
  readonly confidence: number | null
  readonly isConfirmed: boolean
}

export interface PastExamDetail extends PastExamListItem {
  readonly signedImageUrls: readonly string[]
  readonly images?: readonly PastExamImage[]
  readonly details?: readonly PastExamDetailItem[]
}

export interface PastExamListResult {
  readonly error?: string
  readonly data?: readonly PastExamListItem[]
  readonly meta?: {
    readonly total: number
    readonly page: number
    readonly pageSize: number
  }
}

export interface PastExamDetailResult {
  readonly error?: string
  readonly data?: PastExamDetail
}

// ─── 내부 타입 ────────────────────────────────────────────

interface CurrentUserProfile {
  readonly id: string
  readonly role: string
  readonly academyId: string
}

interface GetCurrentUserResult {
  readonly error?: string
  readonly profile?: CurrentUserProfile
}

// ─── 헬퍼 함수 ────────────────────────────────────────────

/**
 * 현재 사용자 프로필 조회 (인증 + 프로필 + academy_id 확인)
 * 역할 체크는 각 Action에서 수행
 */
async function getCurrentUserProfile(): Promise<GetCurrentUserResult> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: '인증이 필요합니다.' }
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

  return {
    profile: {
      id: profile.id,
      role: profile.role,
      academyId: profile.academy_id,
    },
  }
}

/**
 * DB 응답(snake_case + FK JOIN) → PastExamListItem(camelCase) 변환
 * FK 경로: profiles!created_by (past_exams 테이블)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 생성 타입 미생성
function toPastExamListItem(dbRow: any): PastExamListItem {
  return {
    id: dbRow.id,
    schoolName: dbRow.schools?.name ?? '',
    schoolType: dbRow.schools?.school_type ?? '',
    year: dbRow.year,
    semester: dbRow.semester,
    examType: dbRow.exam_type,
    grade: dbRow.grade,
    subject: dbRow.subject,
    extractionStatus: dbRow.extraction_status,
    uploadedByName: dbRow.profiles?.name ?? null,
    createdAt: dbRow.created_at,
  }
}

/**
 * searchParams 빈 문자열 → undefined 변환
 * Zod 파싱 전에 호출하여 URL searchParams의 빈 문자열을 정리
 */
function sanitizeFilters(raw: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      value === '' ? undefined : value,
    ])
  )
}

// ─── 업로드 Action ────────────────────────────────────────

/**
 * @deprecated Step 6 이후 삭제 예정. createPastExamAction으로 대체.
 * past_exam_questions 테이블에 직접 INSERT하는 레거시 Action.
 */
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

  // 5. school_type ↔ grade 교차 검증 (Defense in Depth)
  const { data: school } = await supabase
    .from('schools')
    .select('school_type')
    .eq('id', parsed.data.schoolId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 생성 타입 미생성
    .single() as { data: { school_type: string } | null; error: unknown }

  if (school && !isValidGradeForSchoolType(parsed.data.grade, school.school_type as SchoolType)) {
    return { error: '선택한 학교 유형에 맞지 않는 학년입니다.' }
  }

  // 6. Storage 경로 생성
  const ext = getFileExtension(validFile.name)
  const fileId = crypto.randomUUID()
  const storagePath = `${profile.academy_id}/${parsed.data.schoolId}/${parsed.data.year}-${parsed.data.semester}-${parsed.data.examType}/${fileId}.${ext}`

  // 7. Storage 업로드 (admin 클라이언트 -> RLS 우회)
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
    await admin.storage.from('past-exams').remove([storagePath])
    return { error: '기출문제 저장에 실패했습니다. 다시 시도해주세요.' }
  }

  return { data: { id: (inserted as { id: string }).id } }
}

// ─── 목록 조회 Action ─────────────────────────────────────

/**
 * 기출문제 목록 조회
 * 권한: teacher/admin/system_admin만 (RLS 적용)
 */
export async function getPastExamList(
  rawFilters?: Record<string, unknown>
): Promise<PastExamListResult> {
  // 1. 인증 + 프로필 확인
  const { error: profileError, profile } = await getCurrentUserProfile()
  if (profileError || !profile) {
    return { error: profileError }
  }

  // 2. 빈 문자열 제거 → Zod 파싱
  const sanitized = sanitizeFilters(rawFilters ?? {})
  const parsed = pastExamFilterSchema.safeParse(sanitized)
  if (!parsed.success) {
    return { error: '잘못된 필터 값입니다.' }
  }

  const { school, schoolType, grade, subject, examType, year, semester, page } = parsed.data
  const pageSize = 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const supabase = await createClient()

  try {
    // 3. FK JOIN 쿼리 구성 (past_exams 테이블 기준)
    let query = supabase
      .from('past_exams')
      .select(
        `
          id, year, semester, exam_type, grade, subject,
          extraction_status, created_at,
          schools!inner ( name, school_type ),
          profiles!created_by ( name )
        `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to)

    // 4. 필터 적용
    if (school) {
      query = query.ilike('schools.name', `%${school}%`)
    }
    if (grade) {
      query = query.eq('grade', grade)
    }
    // schoolType → grade 범위 필터 (grade가 없을 때만 적용)
    if (schoolType && schoolType !== 'all' && !grade) {
      const range = getGradeRange(schoolType as SchoolType)
      query = query.gte('grade', range.min).lte('grade', range.max)
    }
    if (subject) {
      query = query.ilike('subject', `%${subject}%`)
    }
    if (examType && examType !== 'all') {
      query = query.eq('exam_type', examType)
    }
    if (year) {
      query = query.eq('year', year)
    }
    if (semester && semester !== 'all') {
      query = query.eq('semester', Number(semester))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 생성 타입 미생성
    const { data, error, count } = await (query as any)

    if (error) {
      return { error: '기출문제 목록 조회에 실패했습니다.' }
    }

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 생성 타입 미생성
      data: (data ?? []).map((row: any) => toPastExamListItem(row)),
      meta: {
        total: count ?? 0,
        page,
        pageSize,
      },
    }
  } catch {
    return { error: '기출문제 목록 조회에 실패했습니다.' }
  }
}

// ─── 상세 조회 Action ─────────────────────────────────────

/**
 * 기출문제 상세 조회
 * 권한: teacher/admin/system_admin만 (RLS 적용)
 * Storage Signed URL 생성 (60초 만료) — 상세 조회 시에만
 * past_exams + past_exam_images + past_exam_details 3계층 JOIN
 */
export async function getPastExamDetail(id: string): Promise<PastExamDetailResult> {
  // 1. 인증 + 프로필 확인
  const { error: profileError, profile } = await getCurrentUserProfile()
  if (profileError || !profile) {
    return { error: profileError }
  }

  const supabase = await createClient()

  try {
    const { data: row, error: dbError } = (await supabase
      .from('past_exams')
      .select(
        `
          id, year, semester, exam_type, grade, subject,
          extraction_status, created_at,
          schools!inner ( name, school_type ),
          profiles!created_by ( name ),
          past_exam_images ( id, page_number, source_image_url ),
          past_exam_details ( id, question_number, question_text, question_type, confidence, is_confirmed )
        `
      )
      .eq('id', id)
      .single()) as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 생성 타입 미생성 (FK JOIN 중첩 객체)
      data: any | null
      error: unknown
    }

    if (dbError || !row) {
      return { error: '기출문제를 찾을 수 없습니다.' }
    }

    // past_exam_images에서 Signed URL 배열 생성 (60초 만료) — Promise.all 병렬화
    const rawImages: any[] = row.past_exam_images ?? []
    const signedUrlResults = await Promise.all(
      rawImages.map(async (img: any) => {
        if (!img.source_image_url) return null
        const { data: signedData } = await supabase.storage
          .from('past-exams')
          .createSignedUrl(img.source_image_url, 60)
        return signedData?.signedUrl ?? null
      })
    )

    const signedImageUrls: string[] = []
    const images: PastExamImage[] = rawImages.map((img: any, idx: number) => {
      const signedUrl = signedUrlResults[idx]
      if (signedUrl) {
        signedImageUrls.push(signedUrl)
      }
      return {
        id: img.id,
        pageNumber: img.page_number,
        sourceImageUrl: img.source_image_url,
        signedImageUrl: signedUrl,
      }
    })

    // past_exam_details를 camelCase로 변환
    const rawDetails: any[] = row.past_exam_details ?? []
    const details: PastExamDetailItem[] = rawDetails.map((d: any) => ({
      id: d.id,
      questionNumber: d.question_number,
      questionText: d.question_text,
      questionType: d.question_type,
      confidence: d.confidence,
      isConfirmed: d.is_confirmed,
    }))

    return {
      data: {
        ...toPastExamListItem(row),
        signedImageUrls,
        images,
        details,
      },
    }
  } catch {
    return { error: '기출문제 상세 조회에 실패했습니다.' }
  }
}
