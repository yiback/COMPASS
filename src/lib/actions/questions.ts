/**
 * 문제(questions) Server Actions
 *
 * - getQuestionList: 목록 조회 + 필터 + 서버사이드 페이지네이션
 *
 * 패턴: getPastExamList (past-exams.ts) 재활용
 * 주의:
 * - profiles!created_by: questions 테이블에 created_by, reviewed_by 두 FK가
 *   모두 profiles를 참조하므로 컬럼명을 명시해야 PostgREST가 구분 가능
 * - created_by는 nullable → LEFT JOIN (profiles!inner 사용 안 함)
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { questionFilterSchema } from '@/lib/validations/questions'

// ─── 타입 정의 ────────────────────────────────────────

/** 목록에 표시할 문제 정보 */
export interface QuestionListItem {
  readonly id: string
  readonly content: string
  readonly type: string
  readonly difficulty: number
  readonly subject: string
  readonly grade: number
  readonly isAiGenerated: boolean
  readonly aiReviewStatus: string
  readonly sourceType: string | null
  readonly createdByName: string | null
  readonly createdAt: string
}

export interface QuestionListResult {
  readonly error?: string
  readonly data?: readonly QuestionListItem[]
  readonly meta?: {
    readonly total: number
    readonly page: number
    readonly pageSize: number
  }
}

// ─── 내부 타입 ────────────────────────────────────────

interface CurrentUserProfile {
  readonly id: string
  readonly role: string
  readonly academyId: string
}

interface GetCurrentUserResult {
  readonly error?: string
  readonly profile?: CurrentUserProfile
}

// ─── 상수 ────────────────────────────────────────────

const PAGE_SIZE = 10

// ─── 헬퍼 함수 ───────────────────────────────────────

/** 현재 사용자 프로필 조회 (인증 + academy_id 확인) */
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

/** 빈 문자열 → undefined 변환 (Zod 파싱 전 sanitize) */
function sanitizeFilters(raw: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      value === '' ? undefined : value,
    ])
  )
}

/**
 * DB row(snake_case + FK JOIN) → QuestionListItem(camelCase) 변환
 * profiles!created_by JOIN으로 등록자 이름 포함
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 생성 타입 미생성
function toQuestionListItem(dbRow: any): QuestionListItem {
  return {
    id: dbRow.id,
    content: dbRow.content,
    type: dbRow.type,
    difficulty: dbRow.difficulty,
    subject: dbRow.subject,
    grade: dbRow.grade,
    isAiGenerated: dbRow.is_ai_generated ?? false,
    aiReviewStatus: dbRow.ai_review_status ?? 'none',
    sourceType: dbRow.source_type ?? null,
    createdByName: dbRow.profiles?.name ?? null,
    createdAt: dbRow.created_at,
  }
}

// ─── 상수 (상세 조회용) ──────────────────────────────

/** 난이도 숫자 → 레이블 매핑 */
const DIFFICULTY_LABELS: Record<number, string> = {
  1: '매우 쉬움',
  2: '쉬움',
  3: '보통',
  4: '어려움',
  5: '매우 어려움',
}

// ─── 상세 조회 타입 ───────────────────────────────────

/** 상세 조회 전용 추가 항목 */
export interface QuestionDetail extends QuestionListItem {
  readonly difficultyLabel: string
  readonly answer: string
  readonly explanation: string | null
  readonly options: readonly string[] | null
  readonly unit: string | null
  readonly aiModel: string | null
  readonly sourceMetadata: Record<string, unknown> | null
}

export interface QuestionDetailResult {
  readonly error?: string
  readonly data?: QuestionDetail
}

// ─── Server Action ────────────────────────────────────

/**
 * 문제 목록 조회
 *
 * @param rawFilters - URL searchParams (문자열 값 허용, sanitize 후 Zod 검증)
 * @returns QuestionListResult (data, meta, error)
 */
export async function getQuestionList(
  rawFilters?: Record<string, unknown>
): Promise<QuestionListResult> {
  // 1. 인증 확인
  const { error: profileError, profile } = await getCurrentUserProfile()
  if (profileError || !profile) {
    return { error: profileError ?? '인증 실패' }
  }

  // 2. 필터 검증
  const sanitized = sanitizeFilters(rawFilters ?? {})
  const parsed = questionFilterSchema.safeParse(sanitized)
  if (!parsed.success) {
    return { error: '잘못된 필터 값입니다.' }
  }
  const filters = parsed.data

  // 3. DB 쿼리 구성
  const supabase = await createClient()
  const page = filters.page ?? 1
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  // profiles!created_by: FK 컬럼명 명시 (reviewed_by와 구분)
  // eslint-disable-next-line prefer-const -- 필터 체이닝을 위해 let 필요
  let query = supabase
    .from('questions')
    .select(
      'id, content, type, difficulty, subject, grade, is_ai_generated, ai_review_status, source_type, created_at, profiles!created_by ( name )',
      { count: 'exact' }
    )
    .eq('academy_id', profile.academyId)
    .order('created_at', { ascending: false })

  // 4. 필터 적용 (전부 선택적)
  if (filters.subject) {
    query = query.ilike('subject', `%${filters.subject}%`)
  }

  if (filters.grade) {
    query = query.eq('grade', filters.grade)
  }

  if (filters.type && filters.type !== 'all') {
    query = query.eq('type', filters.type)
  }

  if (filters.difficulty) {
    query = query.eq('difficulty', filters.difficulty)
  }

  if (filters.sourceType && filters.sourceType !== 'all') {
    query = query.eq('source_type', filters.sourceType)
  }

  // schoolType → grade 범위 필터 (grade가 없을 때만 적용)
  if (filters.schoolType && filters.schoolType !== 'all' && !filters.grade) {
    const ranges: Record<string, { min: number; max: number }> = {
      elementary: { min: 1, max: 6 },
      middle: { min: 7, max: 9 },
      high: { min: 10, max: 12 },
    }
    const range = ranges[filters.schoolType]
    if (range) {
      query = query.gte('grade', range.min).lte('grade', range.max)
    }
  }

  // 5. 페이지네이션 + 실행
  const { data, count, error } = await query.range(from, to)

  if (error) {
    return { error: '문제 목록 조회에 실패했습니다.' }
  }

  return {
    data: (data ?? []).map(toQuestionListItem),
    meta: {
      total: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
    },
  }
}

/**
 * 문제 상세 조회
 * 권한: 인증된 사용자 전체 — RLS가 academy_id로 자동 격리
 * Signed URL 불필요 — questions 테이블에 Storage 경로 없음
 *
 * 주의: questions 테이블에 created_by, reviewed_by 두 FK가 있으므로
 * profiles!created_by 로 명시하여 PostgREST가 올바른 FK를 선택하게 한다.
 */
export async function getQuestionDetail(id: string): Promise<QuestionDetailResult> {
  // 1. 인증 + 프로필 확인
  const { error: profileError, profile } = await getCurrentUserProfile()
  if (profileError || !profile) {
    return { error: profileError }
  }

  const supabase = await createClient()

  try {
    const { data: row, error: dbError } = (await supabase
      .from('questions')
      .select(
        `
        id, content, type, difficulty, subject, grade,
        answer, explanation, options, unit,
        is_ai_generated, ai_review_status, ai_model,
        source_type, source_metadata, created_at,
        profiles!created_by ( name )
      `
      )
      .eq('id', id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 생성 타입 미생성
      .single()) as { data: any | null; error: unknown }

    if (dbError || !row) {
      return { error: '문제를 찾을 수 없습니다.' }
    }

    const listItem = toQuestionListItem(row)

    return {
      data: {
        ...listItem,
        difficultyLabel: DIFFICULTY_LABELS[row.difficulty as number] ?? String(row.difficulty),
        answer: row.answer,
        explanation: row.explanation ?? null,
        options: row.options ?? null,
        unit: row.unit ?? null,
        aiModel: row.ai_model ?? null,
        sourceMetadata: row.source_metadata ?? null,
      },
    }
  } catch {
    return { error: '문제 상세 조회에 실패했습니다.' }
  }
}
