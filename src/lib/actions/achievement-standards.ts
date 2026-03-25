'use server'

/**
 * 성취기준 관리 Server Actions
 *
 * - getAchievementStandards: 목록 조회 (인증 사용자)
 * - getAchievementStandardById: 단일 조회 (인증 사용자)
 * - createAchievementStandard: 생성 (system_admin)
 * - updateAchievementStandard: 수정 (system_admin)
 * - deactivateAchievementStandard: 비활성화 (system_admin)
 * - getDistinctUnits: 단원 목록 조회 (인증 사용자)
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  achievementStandardCreateSchema,
  achievementStandardUpdateSchema,
  achievementStandardFilterSchema,
  type AchievementStandardFilterInput,
} from '@/lib/validations/achievement-standards'

// ─── 공통 타입 ──────────────────────────────────────────

export interface AchievementStandardActionResult {
  readonly error?: string
  readonly data?: unknown
}

// ─── RBAC 헬퍼 함수 ─────────────────────────────────────

/** system_admin 역할 확인 — 성취기준 CUD 작업 전 호출 */
async function checkSystemAdminRole(): Promise<{ error?: string }> {
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

  if (!profile || profile.role !== 'system_admin') {
    return { error: '권한이 없습니다.' }
  }

  return {}
}

/** 인증 사용자 확인 — 조회 작업 전 호출 */
async function checkAuthenticated(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: '인증이 필요합니다.' }
  }

  return {}
}

// ─── getAchievementStandards (목록 조회) ─────────────────

export async function getAchievementStandards(
  filters?: AchievementStandardFilterInput
): Promise<AchievementStandardActionResult> {
  // 1. 인증 확인
  const { error: authError } = await checkAuthenticated()
  if (authError) return { error: authError }

  // 2. 필터 파싱
  const parsed = achievementStandardFilterSchema.safeParse(filters ?? {})
  if (!parsed.success) {
    return { error: '잘못된 필터 값입니다.' }
  }

  const { subject, grade, semester, unit, search, isActive } = parsed.data

  // 3. 쿼리 빌드
  const supabase = await createClient()
  let query = supabase
    .from('achievement_standards')
    .select('*')
    .order('grade')
    .order('semester')
    .order('order_in_semester', { nullsFirst: false })
    .order('code')

  // 필터 적용
  if (isActive === 'true') {
    query = query.eq('is_active', true)
  } else if (isActive === 'false') {
    query = query.eq('is_active', false)
  }
  // 'all'이면 필터 없음

  if (subject) {
    query = query.eq('subject', subject)
  }
  if (grade) {
    query = query.eq('grade', grade)
  }
  if (semester) {
    query = query.eq('semester', semester)
  }
  if (unit) {
    query = query.eq('unit', unit)
  }
  if (search) {
    query = query.ilike('content', `%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    return { error: '성취기준 목록 조회에 실패했습니다.' }
  }

  return { data: data ?? [] }
}

// ─── getAchievementStandardById (단일 조회) ──────────────

export async function getAchievementStandardById(
  id: string
): Promise<AchievementStandardActionResult> {
  if (!id) {
    return { error: '성취기준 ID가 필요합니다.' }
  }

  // 1. 인증 확인
  const { error: authError } = await checkAuthenticated()
  if (authError) return { error: authError }

  // 2. DB 조회
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('achievement_standards')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return { error: '성취기준 조회에 실패했습니다.' }
  }

  return { data }
}

// ─── createAchievementStandard (생성) ────────────────────

export async function createAchievementStandard(
  _prevState: AchievementStandardActionResult | null,
  formData: FormData
): Promise<AchievementStandardActionResult> {
  // 1. RBAC 체크
  const { error: roleError } = await checkSystemAdminRole()
  if (roleError) return { error: roleError }

  // 2. FormData 파싱 — keywords는 JSON 문자열로 전달됨
  const keywordsRaw = formData.get('keywords') as string
  let parsedKeywords: string[] = []
  if (keywordsRaw) {
    try {
      parsedKeywords = JSON.parse(keywordsRaw)
    } catch {
      return { error: '키워드 형식이 잘못되었습니다.' }
    }
  }

  const raw = {
    code: formData.get('code'),
    content: formData.get('content'),
    subject: formData.get('subject'),
    grade: formData.get('grade'),
    semester: formData.get('semester') || undefined,
    unit: formData.get('unit') || undefined,
    sub_unit: formData.get('sub_unit') || undefined,
    keywords: parsedKeywords,
    source_name: formData.get('source_name') || undefined,
    source_url: formData.get('source_url') || undefined,
    order_in_semester: formData.get('order_in_semester') || undefined,
    effective_year: formData.get('effective_year') || undefined,
    curriculum_version: formData.get('curriculum_version') || undefined,
  }

  // 3. Zod 검증
  const parsed = achievementStandardCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.',
    }
  }

  // 4. DB 삽입
  const supabase = await createClient()
  const { error } = await supabase.from('achievement_standards').insert({
    code: parsed.data.code,
    content: parsed.data.content,
    subject: parsed.data.subject,
    grade: parsed.data.grade,
    semester: parsed.data.semester ?? null,
    unit: parsed.data.unit || null,
    sub_unit: parsed.data.sub_unit || null,
    keywords: parsed.data.keywords,
    source_name: parsed.data.source_name || null,
    source_url: parsed.data.source_url || null,
    order_in_semester: parsed.data.order_in_semester ?? null,
    effective_year: parsed.data.effective_year ?? null,
    curriculum_version: parsed.data.curriculum_version,
  })

  if (error) {
    // code UNIQUE 제약 위반
    if (error.code === '23505') {
      return { error: '이미 존재하는 성취기준 코드입니다.' }
    }
    return { error: '처리 중 오류가 발생했습니다.' }
  }

  // 5. 캐시 무효화
  revalidatePath('/achievement-standards')
  return { data: { success: true } }
}

// ─── updateAchievementStandard (수정) ────────────────────

export async function updateAchievementStandard(
  id: string,
  _prevState: AchievementStandardActionResult | null,
  formData: FormData
): Promise<AchievementStandardActionResult> {
  if (!id) {
    return { error: '성취기준 ID가 필요합니다.' }
  }

  // 1. RBAC 체크
  const { error: roleError } = await checkSystemAdminRole()
  if (roleError) return { error: roleError }

  // 2. FormData 파싱 — 편집 가능 필드만
  const keywordsRaw = formData.get('keywords') as string
  let parsedKeywords: string[] | undefined
  if (keywordsRaw) {
    try {
      parsedKeywords = JSON.parse(keywordsRaw)
    } catch {
      return { error: '키워드 형식이 잘못되었습니다.' }
    }
  }

  const raw = {
    content: formData.get('content') || undefined,
    keywords: parsedKeywords,
    unit: formData.get('unit') || undefined,
    sub_unit: formData.get('sub_unit') || undefined,
    source_name: formData.get('source_name') || undefined,
    source_url: formData.get('source_url') || undefined,
  }

  // 3. Zod 검증
  const parsed = achievementStandardUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.',
    }
  }

  // 4. DB 업데이트 — 빈 문자열을 null로 변환
  const supabase = await createClient()
  const { error } = await supabase
    .from('achievement_standards')
    .update({
      content: parsed.data.content,
      keywords: parsed.data.keywords,
      unit: parsed.data.unit || null,
      sub_unit: parsed.data.sub_unit || null,
      source_name: parsed.data.source_name || null,
      source_url: parsed.data.source_url || null,
    })
    .eq('id', id)

  if (error) {
    return { error: '처리 중 오류가 발생했습니다.' }
  }

  // 5. 캐시 무효화
  revalidatePath('/achievement-standards')
  return { data: { success: true } }
}

// ─── deactivateAchievementStandard (비활성화) ────────────

export async function deactivateAchievementStandard(
  id: string
): Promise<AchievementStandardActionResult> {
  if (!id) {
    return { error: '성취기준 ID가 필요합니다.' }
  }

  // 1. RBAC 체크
  const { error: roleError } = await checkSystemAdminRole()
  if (roleError) return { error: roleError }

  // 2. DB 비활성화 (소프트 삭제)
  const supabase = await createClient()
  const { error } = await supabase
    .from('achievement_standards')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    return { error: '처리 중 오류가 발생했습니다.' }
  }

  // 3. 캐시 무효화
  revalidatePath('/achievement-standards')
  return { data: { success: true } }
}

// ─── getDistinctUnits (단원 목록 조회) ───────────────────

export async function getDistinctUnits(
  subject?: string,
  grade?: number
): Promise<AchievementStandardActionResult> {
  // 1. 인증 확인
  const { error: authError } = await checkAuthenticated()
  if (authError) return { error: authError }

  // 2. 쿼리 빌드
  const supabase = await createClient()
  let query = supabase
    .from('achievement_standards')
    .select('unit')
    .eq('is_active', true)
    .not('unit', 'is', null)
    .order('unit')

  if (subject) {
    query = query.eq('subject', subject)
  }
  if (grade) {
    query = query.eq('grade', grade)
  }

  const { data, error } = await query

  if (error) {
    return { error: '단원 목록 조회에 실패했습니다.' }
  }

  // 3. JS에서 중복 제거 (PostgREST에 DISTINCT 없음)
  const units = [...new Set((data ?? []).map((d) => d.unit as string))]

  return { data: units }
}
