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
  readonly sourceImageUrl: string | null
  readonly createdAt: string
}

export interface PastExamDetail extends PastExamListItem {
  readonly signedImageUrl: string | null
  readonly extractedContent: string | null
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
    sourceImageUrl: dbRow.source_image_url,
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

// ─── 목록 조회 Action ─────────────────────────────────────

/**
 * 기출문제 목록 조회
 * 권한: 인증된 사용자 전체 (student 포함) — RLS가 academy_id로 자동 격리
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

  const { school, grade, subject, examType, year, semester, page } = parsed.data
  const pageSize = 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const supabase = await createClient()

  try {
    // 3. FK JOIN 쿼리 구성
    let query = supabase
      .from('past_exam_questions')
      .select(
        `
          id, year, semester, exam_type, grade, subject,
          source_image_url, extraction_status, created_at,
          schools!inner ( name, school_type ),
          profiles!uploaded_by ( name )
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
 * 권한: 인증된 사용자 전체 — RLS가 academy_id로 자동 격리
 * Storage Signed URL 생성 (60초 만료) — 상세 조회 시에만
 */
export async function getPastExamDetail(id: string): Promise<PastExamDetailResult> {
  // 1. 인증 + 프로필 확인
  const { error: profileError, profile } = await getCurrentUserProfile()
  if (profileError || !profile) {
    return { error: profileError }
  }

  const supabase = await createClient()

  try {
    // =========================================================================
    // 🔴 빈칸 #1: FK JOIN 단건 조회
    // 힌트:
    //   - 테이블: past_exam_questions
    //   - select 컬럼: id, year, semester, exam_type, grade, subject,
    //                  source_image_url, extracted_content, extraction_status, created_at
    //   - FK JOIN 두 개:
    //       a. schools → INNER JOIN, name + school_type 가져오기
    //       b. profiles → uploaded_by FK로, name 가져오기
    //   - .eq('id', id).single() 으로 단건 조회
    //   - 결과를 as { data: any | null; error: unknown } 으로 캐스팅
    // =========================================================================
        const { data: row, error: dbError } = ( await supabase
          .from('past_exam_questions')
          .select (
            `
              id, year, semester, exam_type, grade,  subject,
              source_image_url, extracted_content, extraction_status, created_at,
              schools!inner (name, school_type),
              profiles!uploaded_by(name)
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
        
        // =========================================================================
        // 🔴 빈칸 #2: Storage Signed URL 생성
        // 힌트:
        //   - source_image_url 이 있을 때만 생성 (없으면 null 유지)
        //   - 버킷 이름: 'past-exams'
        //   - 만료 시간: 60초
        //   - supabase.storage.from(...).createSignedUrl(path, seconds)
        //   - 결과: signedData?.signedUrl ?? null
        // =========================================================================
        let signedImageUrl: string | null = null
        // TODO: source_image_url 있을 때 Signed URL 생성 로직 작성
        if (row.source_image_url) {
          const { data: signedData } = await supabase.storage
            .from('past-exams')
            .createSignedUrl(row.source_image_url, 60)
          signedImageUrl = signedData?.signedUrl ?? null
        }
    
        return {
          data: {
            ...toPastExamListItem(row),
            signedImageUrl,
            extractedContent: row.extracted_content ?? null,
          },
        }
      } catch {
        return { error: '기출문제 상세 조회에 실패했습니다.' }
      }
}
