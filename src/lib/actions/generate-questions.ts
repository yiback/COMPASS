'use server'

/**
 * 기출문제 기반 AI 문제 생성 Server Action
 *
 * 흐름: 인증 → 입력 검증 → 기출 DB 조회 → PastExamContext 조립 → AI 호출 → 결과 반환
 * AI 에러는 throw하지 않고 { error } 객체로 반환한다 (사용자 친화적 메시지).
 */

import { createClient } from '@/lib/supabase/server'
import { generateQuestionsRequestSchema } from '@/lib/validations/generate-questions'
import { createAIProvider, AIError } from '@/lib/ai'
import type { GeneratedQuestion, PastExamContext } from '@/lib/ai'

// ─── 반환 타입 ──────────────────────────────────────────

export interface GenerateQuestionsResult {
  readonly error?: string
  readonly data?: readonly GeneratedQuestion[]
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
    return {
      error:
        'AI 문제 생성 권한이 없습니다. 교사 또는 관리자만 사용할 수 있습니다.',
    }
  }

  return {
    user: {
      id: profile.id,
      role: profile.role,
      academyId: profile.academy_id,
    },
  }
}

// ─── Server Action ──────────────────────────────────────

export async function generateQuestionsFromPastExam(
  rawInput: Record<string, unknown>,
): Promise<GenerateQuestionsResult> {
  // 1. 인증 + 권한
  const { error: authError, user } = await checkTeacherOrAdmin()
  if (authError || !user) {
    return { error: authError }
  }

  // 2. 입력값 검증
  const parsed = generateQuestionsRequestSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }
  }

  const { pastExamId, questionType, difficulty, count } = parsed.data

  // 3. 기출문제 조회
  const supabase = await createClient()
  const { data: pastExam, error: dbError } = (await supabase
    .from('past_exam_questions')
    .select(
      `
      id, year, semester, exam_type, grade, subject, extracted_content,
      schools!inner ( name )
    `,
    )
    .eq('id', pastExamId)
    .single()) as {
    data: {
      id: string
      year: number
      semester: number
      exam_type: string
      grade: number
      subject: string
      extracted_content: string | null
      schools: { name: string }
    } | null
    error: unknown
  }

  if (dbError || !pastExam) {
    return { error: '기출문제를 찾을 수 없습니다.' }
  }

  // 4. PastExamContext 조립
  // 🟡 빈칸 3: PastExamContext 객체를 조립하세요.
  // 요구사항:
  //   - pastExam의 필드를 PastExamContext 형태로 매핑
  //   - extracted_content가 null이면 extractedContent key 자체가 없어야 함
  //   - extracted_content가 있으면 extractedContent에 포함
  //   - 힌트: 조건부 스프레드 패턴 ...(condition ? { key: value } : {})
  //
  // TODO: const pastExamContext: PastExamContext = { ... } 작성
  const pastExamContext: PastExamContext = {
    pastExamId : pastExam.id,
    schoolName : pastExam.schools.name,
    year : pastExam.year,
    semester : pastExam.semester,
    examType : pastExam.exam_type,
    ...(pastExam.extracted_content 
      ? {extractedContent: pastExam.extracted_content}
      : {}),
  } 

  // 5. AI Provider 호출
  try {
    const provider = createAIProvider()
    const questions = await provider.generateQuestions({
      subject: pastExam.subject,
      grade: pastExam.grade,
      questionType,
      difficulty,
      count,
      schoolName: pastExam.schools.name,
      pastExamContext,
    })

    return { data: questions }
  } catch (error) {
    // 🟡 빈칸 4: AI 에러 처리 분기를 작성하세요.
    // 요구사항:
    //   - AIError 인스턴스면 → { error: `AI 문제 생성 실패: ${에러메시지}` }
    //   - 그 외 → { error: 'AI 문제 생성 중 알 수 없는 오류가 발생했습니다.' }
    //   - 힌트: instanceof 연산자s
    //
    // TODO: if/else 분기 작성
    if (error instanceof AIError) {
      return { error: `AI 문제 생성 실패: ${error.message}`}
    }
    return { error: 'AI 문제 생성 중 알 수 없는 오류가 발생했습니다.'}
  }
}
