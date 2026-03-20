/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * AI 문제 생성 Server Action 테스트
 *
 * 테스트 대상: generateQuestionsFromPastExam
 * Mock 전략:
 * - Supabase: from() mockImplementation 테이블명 분기
 * - AI Provider: vi.importActual + createAIProvider mock
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── AI Provider Mock (vi.importActual 필수) ─────────────
// 🔴 빈칸 1: vi.mock('@/lib/ai', ...) 를 작성하세요.
// 요구사항:
//   - AIError, AIServiceError 등 에러 클래스는 실제 구현 유지 (instanceof 필요)
//   - createAIProvider만 vi.fn()으로 대체
//   - 힌트: vi.importActual 사용
//
// TODO: 여기에 vi.mock 코드를 작성하세요
vi.mock('@/lib/ai', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai')> ('@/lib/ai')
  return {
    ...actual,
    createAIProvider: vi.fn(),
  }
})


// ─── Supabase Mock ───────────────────────────────────────
const mockProfileQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
}

const mockPastExamQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
}

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}))

// ─── Mock 후 import (호이스팅 활용) ──────────────────────
import { generateQuestionsFromPastExam } from '../generate-questions'
import {
  createAIProvider,
  AIServiceError,
  AIValidationError,
  AIRateLimitError,
} from '@/lib/ai'

// ─── AI Provider Mock 설정 ───────────────────────────────
const mockGenerateQuestions = vi.fn()
const mockAIProvider = {
  name: 'gemini' as const,
  generateQuestions: mockGenerateQuestions,
  gradeAnswer: vi.fn(),
  processOCR: vi.fn(),
  analyzeTrends: vi.fn(),
}

const mockCreateAIProvider = createAIProvider as ReturnType<typeof vi.fn>

// ─── 테스트 픽스처 ──────────────────────────────────────
const MOCK_PAST_EXAM_ROW = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  year: 2024,
  semester: 1,
  exam_type: 'midterm',
  grade: 10,
  subject: '수학',
  past_exam_details: [] as { question_text: string }[],
  schools: { name: '한국고등학교' },
}

const MOCK_GENERATED_QUESTIONS = [
  {
    content: '1 + 1 = ?',
    type: 'multiple_choice',
    difficulty: 'medium',
    answer: '2',
    explanation: '기본 덧셈',
    options: ['1', '2', '3', '4', '5'],
  },
  {
    content: '2 × 3 = ?',
    type: 'multiple_choice',
    difficulty: 'medium',
    answer: '6',
    explanation: '기본 곱셈',
    options: ['4', '5', '6', '7', '8'],
  },
]

const VALID_INPUT = {
  pastExamId: '550e8400-e29b-41d4-a716-446655440000',
  questionType: 'multiple_choice',
  difficulty: 'medium',
  count: 2,
}

// ─── Mock 헬퍼 함수 ─────────────────────────────────────

/** 인증 실패 Mock */
function mockAuthFailed() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'Not authenticated' },
  })
}

/** 역할별 인증 성공 Mock */
function mockAuthAs(
  role: string,
  id = '11111111-1111-4111-8111-111111111111',
  academyId: string | null = 'academy-uuid-1',
) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id } },
    error: null,
  })

  mockProfileQuery.single.mockResolvedValue({
    data: { id, role, academy_id: academyId },
    error: null,
  })
}

/** 프로필 없음 Mock */
function mockProfileNotFound() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'some-user-id' } },
    error: null,
  })

  mockProfileQuery.single.mockResolvedValue({
    data: null,
    error: { message: 'Not found' },
  })
}

/** 기출 조회 성공 Mock */
function mockPastExamFound(row = MOCK_PAST_EXAM_ROW) {
  mockPastExamQuery.single.mockResolvedValue({
    data: row,
    error: null,
  })
}

/** 기출 조회 실패 Mock */
function mockPastExamNotFound() {
  mockPastExamQuery.single.mockResolvedValue({
    data: null,
    error: { message: 'Not found', code: 'PGRST116' },
  })
}

/** AI 생성 성공 Mock */
function mockAISuccess(questions = MOCK_GENERATED_QUESTIONS) {
  mockGenerateQuestions.mockResolvedValue(questions)
}

/** 전체 성공 경로 Mock (인증 + 기출 + AI) */
function mockFullSuccess(role = 'teacher') {
  mockAuthAs(role)
  mockPastExamFound()
  mockAISuccess()
}

// ─── 테스트 ─────────────────────────────────────────────

describe('generateQuestionsFromPastExam', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateAIProvider.mockReturnValue(mockAIProvider)
    // 🔴 빈칸 2: from() mockImplementation 테이블 분기를 작성하세요.
    // 요구사항:
    //   - 'profiles' → mockProfileQuery 반환
    //   - 'past_exams' → mockPastExamQuery 반환
    //   - 그 외 테이블 → Error throw
    //
    // TODO: mockSupabaseClient.from.mockImplementation(...) 작성
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if(table === 'profiles') return mockProfileQuery
      if(table === 'past_exams') return mockPastExamQuery
      
      throw new Error (`예산치 못한 테이블: ${table}`)
    })
  })

  // ─── 그룹 1: 인증 + 권한 ────────────────────────────────

  describe('인증 + 권한', () => {
    it('비인증 사용자 → 에러 "인증이 필요합니다."', async () => {
      mockAuthFailed()

      const result = await generateQuestionsFromPastExam(VALID_INPUT)

      expect(result.error).toBe('인증이 필요합니다.')
      expect(result.data).toBeUndefined()
    })

    it('프로필 없음 → 에러 "프로필을 찾을 수 없습니다."', async () => {
      mockProfileNotFound()

      const result = await generateQuestionsFromPastExam(VALID_INPUT)

      expect(result.error).toBe('프로필을 찾을 수 없습니다.')
    })

    it('academy_id 없음 → 에러 "소속 학원이 없습니다."', async () => {
      mockAuthAs('teacher', undefined, null)

      const result = await generateQuestionsFromPastExam(VALID_INPUT)

      expect(result.error).toBe('소속 학원이 없습니다.')
    })

    it('student 역할 → 에러 "AI 문제 생성 권한이 없습니다..."', async () => {
      mockAuthAs('student')

      const result = await generateQuestionsFromPastExam(VALID_INPUT)

      expect(result.error).toContain('권한이 없습니다')
    })

    it('teacher 역할 → 인증 통과 (에러 없음)', async () => {
      mockFullSuccess('teacher')

      const result = await generateQuestionsFromPastExam(VALID_INPUT)

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
    })

    it('admin 역할 → 인증 통과 (에러 없음)', async () => {
      mockFullSuccess('admin')

      const result = await generateQuestionsFromPastExam(VALID_INPUT)

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
    })
  })

  // ─── 그룹 2: 입력값 검증 ───────────────────────────────

  describe('입력값 검증', () => {
    it('유효하지 않은 pastExamId → 에러', async () => {
      mockAuthAs('teacher')

      const result = await generateQuestionsFromPastExam({
        ...VALID_INPUT,
        pastExamId: 'not-a-uuid',
      })

      expect(result.error).toBeDefined()
    })

    it('유효하지 않은 questionType → 에러', async () => {
      mockAuthAs('teacher')

      const result = await generateQuestionsFromPastExam({
        ...VALID_INPUT,
        questionType: 'invalid_type',
      })

      expect(result.error).toBeDefined()
    })

    it('count 범위 초과(11) → 에러', async () => {
      mockAuthAs('teacher')

      const result = await generateQuestionsFromPastExam({
        ...VALID_INPUT,
        count: 11,
      })

      expect(result.error).toContain('최대')
    })
  })

  // ─── 그룹 3: 기출문제 조회 ─────────────────────────────

  describe('기출문제 조회', () => {
    it('존재하지 않는 pastExamId → 에러 "기출문제를 찾을 수 없습니다."', async () => {
      mockAuthAs('teacher')
      mockPastExamNotFound()

      const result = await generateQuestionsFromPastExam(VALID_INPUT)

      expect(result.error).toBe('기출문제를 찾을 수 없습니다.')
    })
  })

  // ─── 그룹 4: AI 문제 생성 성공 ─────────────────────────

  describe('AI 문제 생성 성공', () => {
    it('유효 입력 → GeneratedQuestion[] 반환', async () => {
      mockFullSuccess()

      const result = await generateQuestionsFromPastExam(VALID_INPUT)

      expect(result.data).toBeDefined()
      expect(result.data).toHaveLength(2)
      expect(result.error).toBeUndefined()
    })

    it('pastExamContext에 schoolName, year, semester 포함 확인', async () => {
      mockFullSuccess()

      await generateQuestionsFromPastExam(VALID_INPUT)

      const callArgs = mockGenerateQuestions.mock.calls[0][0]
      expect(callArgs.pastExamContext).toMatchObject({
        schoolName: '한국고등학교',
        year: 2024,
        semester: 1,
      })
    })

    it('past_exam_details에 question_text가 있으면 pastExamContext.extractedContent에 포함', async () => {
      mockAuthAs('teacher')
      mockPastExamFound({
        ...MOCK_PAST_EXAM_ROW,
        past_exam_details: [
          { question_text: '1번 문제: 이차방정식 x²+2x+1=0의 해를 구하시오.' },
        ],
      })
      mockAISuccess()

      await generateQuestionsFromPastExam(VALID_INPUT)

      const callArgs = mockGenerateQuestions.mock.calls[0][0]
      expect(callArgs.pastExamContext).toMatchObject({
        extractedContent: '1번 문제: 이차방정식 x²+2x+1=0의 해를 구하시오.',
      })
    })

    it('past_exam_details가 빈 배열이면 pastExamContext.extractedContent 없음', async () => {
      mockFullSuccess()

      await generateQuestionsFromPastExam(VALID_INPUT)

      const callArgs = mockGenerateQuestions.mock.calls[0][0]
      expect(callArgs.pastExamContext.extractedContent).toBeUndefined()
    })
  })

  // ─── 그룹 5: AI 에러 처리 ──────────────────────────────

  describe('AI 에러 처리', () => {
    it('AIServiceError → "AI 문제 생성 실패: ..." 메시지 반환', async () => {
      mockAuthAs('teacher')
      mockPastExamFound()
      mockGenerateQuestions.mockRejectedValue(
        new AIServiceError('Gemini API 오류: 서버 에러', 500),
      )

      const result = await generateQuestionsFromPastExam(VALID_INPUT)

      expect(result.error).toContain('AI 문제 생성 실패')
      expect(result.data).toBeUndefined()
    })

    it('AIValidationError → "AI 문제 생성 실패: ..." 메시지 반환', async () => {
      mockAuthAs('teacher')
      mockPastExamFound()
      mockGenerateQuestions.mockRejectedValue(
        new AIValidationError('응답 형식이 올바르지 않습니다'),
      )

      const result = await generateQuestionsFromPastExam(VALID_INPUT)

      expect(result.error).toContain('AI 문제 생성 실패')
    })

    it('AIRateLimitError → "AI 문제 생성 실패: ..." 메시지 반환', async () => {
      mockAuthAs('teacher')
      mockPastExamFound()
      mockGenerateQuestions.mockRejectedValue(
        new AIRateLimitError('요청 한도를 초과했습니다'),
      )

      const result = await generateQuestionsFromPastExam(VALID_INPUT)

      expect(result.error).toContain('AI 문제 생성 실패')
    })

    it('일반 Error → "알 수 없는 오류" 메시지 반환', async () => {
      mockAuthAs('teacher')
      mockPastExamFound()
      mockGenerateQuestions.mockRejectedValue(new Error('unexpected'))

      const result = await generateQuestionsFromPastExam(VALID_INPUT)

      expect(result.error).toContain('알 수 없는 오류')
    })
  })
})
