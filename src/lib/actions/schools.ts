'use server'

/**
 * 학교 관리 Server Actions
 *
 * - createSchool: 학교 생성 (admin, teacher)
 * - getSchoolList: 학교 목록 조회 (인증 사용자 전체)
 * - getSchoolById: 학교 단일 조회 (인증 사용자 전체)
 * - updateSchool: 학교 수정 (admin, teacher)
 * - deleteSchool: 학교 삭제 (admin, teacher)
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  schoolSchema,
  updateSchoolSchema,
  schoolFilterSchema,
  type SchoolFilterInput,
} from '@/lib/validations/schools'

// ─── 공통 타입 ──────────────────────────────────────────

export interface SchoolActionResult {
  readonly error?: string
  readonly data?: unknown
}

// ─── RBAC 헬퍼 함수 ─────────────────────────────────────

async function checkAdminOrTeacherRole(): Promise<{
  error?: string
  role?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: '인증이 필요합니다.' }
  }

  const { data: profile } = (await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()) as { data: { role: string } | null }

  if (
    !profile ||
    !['admin', 'teacher', 'system_admin'].includes(profile.role)
  ) {
    return { error: '권한이 없습니다.' }
  }

  return { role: profile.role }
}

// ─── createSchool (생성) ────────────────────────────────

export async function createSchool(
  _prevState: SchoolActionResult | null,
  formData: FormData
): Promise<SchoolActionResult> {
  // 1. RBAC 체크
  const { error: roleError } = await checkAdminOrTeacherRole()
  if (roleError) return { error: roleError }

  // 2. FormData 파싱
  const raw = {
    name: formData.get('name'),
    schoolType: formData.get('schoolType'),
    region: formData.get('region') || undefined,
    district: formData.get('district') || undefined,
    address: formData.get('address') || undefined,
  }

  // 3. Zod 검증
  const parsed = schoolSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.',
    }
  }

  // 4. DB 삽입 (school_type 스네이크 케이스 변환)
  const supabase = await createClient()
  const { error } = await supabase.from('schools').insert({
    name: parsed.data.name,
    school_type: parsed.data.schoolType, // camelCase -> snake_case
    region: parsed.data.region || null,
    district: parsed.data.district || null,
    address: parsed.data.address || null,
  } as any)

  if (error) {
    console.error('[createSchool] error:', error)
    return { error: '학교 생성에 실패했습니다.' }
  }

  // 5. 캐시 무효화
  revalidatePath('/admin/schools')
  return { data: { success: true } }
}

// ─── getSchoolList (목록 조회) ──────────────────────────

export async function getSchoolList(
  filters?: SchoolFilterInput
): Promise<SchoolActionResult> {
  const parsed = schoolFilterSchema.safeParse(filters ?? {})
  if (!parsed.success) {
    return { error: '잘못된 필터 값입니다.' }
  }

  const { search, schoolType, page } = parsed.data
  const pageSize = 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const supabase = await createClient()
  let query = supabase
    .from('schools')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  // 필터 적용
  if (search) {
    query = query.ilike('name', `%${search}%`)
  }
  if (schoolType && schoolType !== 'all') {
    query = query.eq('school_type', schoolType)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('[getSchoolList] error:', error)
    return { error: '학교 목록 조회에 실패했습니다.' }
  }

  return {
    data: {
      schools: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
    },
  }
}

// ─── getSchoolById (단일 조회) ──────────────────────────

export async function getSchoolById(
  id: string
): Promise<SchoolActionResult> {
  if (!id) {
    return { error: '학교 ID가 필요합니다.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[getSchoolById] error:', error)
    return { error: '학교 정보 조회에 실패했습니다.' }
  }

  return { data }
}

// ─── updateSchool (수정) ────────────────────────────────

export async function updateSchool(
  id: string,
  _prevState: SchoolActionResult | null,
  formData: FormData
): Promise<SchoolActionResult> {
  // 1. RBAC 체크
  const { error: roleError } = await checkAdminOrTeacherRole()
  if (roleError) return { error: roleError }

  // 2. FormData 파싱 + ID 포함
  const raw = {
    id,
    name: formData.get('name'),
    schoolType: formData.get('schoolType'),
    region: formData.get('region') || undefined,
    district: formData.get('district') || undefined,
    address: formData.get('address') || undefined,
  }

  // 3. Zod 검증
  const parsed = updateSchoolSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.',
    }
  }

  // 4. DB 업데이트
  const supabase: any = await createClient()
  const { error } = await supabase
    .from('schools')
    .update({
      name: parsed.data.name,
      school_type: parsed.data.schoolType,
      region: parsed.data.region || null,
      district: parsed.data.district || null,
      address: parsed.data.address || null,
    })
    .eq('id', parsed.data.id)

  if (error) {
    console.error('[updateSchool] error:', error)
    return { error: '학교 정보 수정에 실패했습니다.' }
  }

  // 5. 캐시 무효화
  revalidatePath('/admin/schools')
  revalidatePath(`/admin/schools/${id}/edit`)
  return { data: { success: true } }
}

// ─── deleteSchool (삭제) ────────────────────────────────

export async function deleteSchool(
  id: string
): Promise<SchoolActionResult> {
  // 1. RBAC 체크
  const { error: roleError } = await checkAdminOrTeacherRole()
  if (roleError) return { error: roleError }

  // 2. ID 검증
  if (!id) {
    return { error: '학교 ID가 필요합니다.' }
  }

  // 3. 삭제 전 의존성 체크 (students 테이블에 외래키)
  const supabase = await createClient()
  const { data: students } = await supabase
    .from('students')
    .select('id')
    .eq('school_id', id)
    .limit(1)

  if (students && students.length > 0) {
    return { error: '학생이 등록된 학교는 삭제할 수 없습니다.' }
  }

  // 4. DB 삭제
  const { error } = await supabase.from('schools').delete().eq('id', id)

  if (error) {
    console.error('[deleteSchool] error:', error)
    return { error: '학교 삭제에 실패했습니다.' }
  }

  // 5. 캐시 무효화
  revalidatePath('/admin/schools')
  return { data: { success: true } }
}
