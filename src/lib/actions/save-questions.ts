'use server'

/**
 * 생성된 문제 저장 Server Action
 *
 * 전체 흐름:
 * ┌──────────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐
 * │ 인증 확인 │ → │ Zod 검증 │ → │ 기출 조회  │ → │ 타입 변환 │ → │ DB 저장  │
 * └──────────┘    └──────────┘    └───────────┘    └──────────┘    └──────────┘
 */

import { createClient } from '@/lib/supabase/server'
import { saveQuestionsRequestSchema } from '@/lib/validations/save-questions'
import type { QuestionToSave } from '@/lib/validations/save-questions'
import { toDbQuestionType, toDifficultyNumber } from '@/lib/ai'

// ─── 반환 타입 ──────────────────────────────────────────

export interface SaveQuestionsResult {
  readonly error?: string
  readonly data?: {
    readonly savedCount: number
    readonly questionIds: readonly string[]
  }
}

// ─── 내부 타입 ──────────────────────────────────────────

interface AuthorizedUser {
  readonly id: string
  readonly role: string
  readonly academyId: string
}

interface AuthCheckResult {
  readonly error?: string
  readonly user?: AuthorizedUser
}

// ─── 헬퍼: 인증 + 권한 확인 ────────────────────────────
// generate-questions.ts와 동일 패턴 (3회 반복 미달로 아직 공통 모듈 추출 안 함)

async function checkTeacherOrAdmin(): Promise<AuthCheckResult> {
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

  if (!['teacher', 'admin', 'system_admin'].includes(profile.role)) {
    return { error: '문제 저장 권한이 없습니다. 교사 또는 관리자만 사용할 수 있습니다.' }
  }

  return {
    user: {
      id: profile.id,
      role: profile.role,
      academyId: profile.academy_id,
    },
  }
}

// ─── 변환 함수 ──────────────────────────────────────────

/**
 * AI 생성 문제 1개 → DB INSERT용 객체로 변환
 *
 * 변환 내용:
 * 1. type: 'essay' → 'descriptive'         (toDbQuestionType)
 * 2. difficulty: 'medium' → 3              (toDifficultyNumber)
 * 3. options: string[] → JSONB             (Supabase가 자동 처리)
 * 4. AI 메타데이터 필드 추가               (is_ai_generated, source_metadata 등)
 * 5. 출처 메타데이터 스냅샷                (schoolName 비정규화 — 생성 시점 기록)
 */
function toQuestionInsertRow(
  question: QuestionToSave,
  meta: {
    readonly academyId: string
    readonly userId: string
    readonly subject: string
    readonly grade: number
    readonly pastExamId: string
    readonly schoolId: string
    readonly schoolName: string
    readonly year: number
    readonly semester: number
    readonly examType: string
  },
) {
  return {
    // === 필수 필드 ===
    academy_id: meta.academyId,
    created_by: meta.userId,
    content: question.content,
    type: toDbQuestionType(question.type as 'multiple_choice' | 'short_answer' | 'essay'),
    answer: question.answer,
    subject: meta.subject,
    grade: meta.grade,

    // === 변환 필드 ===
    difficulty: toDifficultyNumber(question.difficulty as 'easy' | 'medium' | 'hard'),

    // === 선택 필드 ===
    explanation: question.explanation ?? null,
    options: question.options ?? null, // Supabase가 JSONB로 자동 직렬화

    // === AI 메타데이터 ===
    is_ai_generated: true,
    ai_review_status: 'pending', // 교사 검수 대기
    ai_model: 'gemini',
    source_type: 'ai_generated',

    // === 출처 스냅샷 (비정규화) ===
    // schoolName을 중복 저장하는 이유: 생성 시점의 학교명을 보존.
    // 나중에 학교명이 바뀌어도 "이 문제는 OO고 기출 기반" 기록 유지.
    source_metadata: {
      pastExamId: meta.pastExamId,
      schoolId: meta.schoolId,
      schoolName: meta.schoolName,
      year: meta.year,
      semester: meta.semester,
      examType: meta.examType,
      generatedAt: new Date().toISOString(),
    },

    // === DB default 활용 (넣지 않음) ===
    // id: gen_random_uuid() — DB 자동 생성
    // points: 1 — DB default
    // created_at: now() — DB default
    // updated_at: now() — DB default
  }
}

// ─── Server Action ──────────────────────────────────────

export async function saveGeneratedQuestions(
  rawInput: Record<string, unknown>,
): Promise<SaveQuestionsResult> {
  // 1. 인증 + 권한
  const { error: authError, user } = await checkTeacherOrAdmin()
  if (authError || !user) {
    return { error: authError }
  }

  // 2. 입력값 검증
  const parsed = saveQuestionsRequestSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }
  }

  const { pastExamId, questions } = parsed.data

  // 3. 기출문제 메타데이터 조회 (subject, grade, 학교 정보)
  //    클라이언트를 신뢰하지 않음 — pastExamId로 서버에서 직접 조회 (Defense in Depth)
  const supabase = await createClient()
  const { data: pastExam, error: dbError } = (await supabase
    .from('past_exam_questions')
    .select('id, subject, grade, year, semester, exam_type, school_id, schools!inner ( name )')
    .eq('id', pastExamId)
    .single()) as {
    data: {
      id: string
      subject: string
      grade: number
      year: number
      semester: number
      exam_type: string
      school_id: string
      schools: { name: string }
    } | null
    error: unknown
  }

  if (dbError || !pastExam) {
    return { error: '기출문제를 찾을 수 없습니다.' }
  }

  // 4. AI 타입 → DB 타입 변환 (Bulk INSERT용 배열 생성)
  const insertRows = questions.map((q) =>
    toQuestionInsertRow(q, {
      academyId: user.academyId,
      userId: user.id,
      subject: pastExam.subject,
      grade: pastExam.grade,
      pastExamId,
      schoolId: pastExam.school_id,
      schoolName: pastExam.schools.name,
      year: pastExam.year,
      semester: pastExam.semester,
      examType: pastExam.exam_type,
    }),
  )

  // 5. Bulk INSERT
  try {
    const { data: inserted, error: insertError } = await supabase
      .from('questions')
      .insert(insertRows)
      .select('id')

    if (insertError || !inserted) {
      return { error: '문제 저장에 실패했습니다. 다시 시도해주세요.' }
    }

    return {
      data: {
        savedCount: inserted.length,
        questionIds: (inserted as { id: string }[]).map((row) => row.id),
      },
    }
  } catch {
    return { error: '문제 저장 중 오류가 발생했습니다.' }
  }
}
