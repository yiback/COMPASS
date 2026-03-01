/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * getQuestionDetail Server Action 테스트
 *
 * 테스트 대상:
 * - getQuestionDetail(): 단건 조회 (8개)
 *
 * Mock 전략: past-exams-list.test.ts와 동일한 from() 테이블 분기 패턴
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getQuestionDetail } from '../questions'

// ============================================================================
// Mock Setup
// ============================================================================

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}))

// ============================================================================
// Mock 헬퍼 함수
// ============================================================================

/** 인증 실패 Mock */
function mockAuthFailed() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'Not authenticated' },
  } as any)
}

/** 역할별 인증 성공 Mock */
function mockAuthAs(
  role: string,
  id = '11111111-1111-4111-8111-111111111111',
  academyId = 'academy-uuid-1'
) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id } },
    error: null,
  } as any)

  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id, role, academy_id: academyId },
      error: null,
    }),
  }
}

/** 단건 조회 쿼리 Mock */
function mockQuestionDetailQuery(item: any | null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: item,
      error: item ? null : { message: 'Not found', code: 'PGRST116' },
    }),
  }
}

/** DB Row Mock (questions 테이블 + FK JOIN) */
const mockQuestionDbRow = {
  id: 'question-uuid-1',
  content: '이차방정식 x² - 5x + 6 = 0의 근을 구하시오.',
  type: 'multiple_choice',
  difficulty: 3,
  subject: '수학',
  grade: 10,
  answer: '1',
  explanation: 'x = 2 또는 x = 3이므로 답은 보기 1번이다.',
  options: ['2, 3', '-2, -3', '1, 6', '-1, -6', '2, -3'],
  unit: '이차방정식',
  is_ai_generated: true,
  ai_review_status: 'pending',
  ai_model: 'gemini',
  source_type: 'ai_generated',
  source_metadata: {
    pastExamId: 'exam-uuid-1',
    schoolName: '한국고등학교',
    year: 2024,
    semester: 1,
    examType: 'midterm',
  },
  created_at: '2024-01-15T00:00:00Z',
  profiles: { name: '김교사' }, // profiles!created_by FK JOIN
}

// ============================================================================
// getQuestionDetail 테스트 (8개)
// ============================================================================

describe('getQuestionDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1. 비인증
  it('비인증 사용자 → 에러 "인증이 필요합니다."', async () => {
    mockAuthFailed()

    const result = await getQuestionDetail('question-uuid-1')

    expect(result.error).toBe('인증이 필요합니다.')
    expect(result.data).toBeUndefined()
  })

  // 2. 유효 ID → 상세 데이터 반환
  it('유효 ID → 상세 데이터 반환 (answer, explanation 포함)', async () => {
    const profileQuery = mockAuthAs('student')
    const detailQuery = mockQuestionDetailQuery(mockQuestionDbRow)

    mockSupabaseClient.from
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(detailQuery)

    const result = await getQuestionDetail('question-uuid-1')

    expect(result.error).toBeUndefined()
    expect(result.data).toBeDefined()
    expect(result.data?.answer).toBe('1')
    expect(result.data?.explanation).toBe('x = 2 또는 x = 3이므로 답은 보기 1번이다.')
  })

  // 3. 존재하지 않는 ID
  it('존재하지 않는 ID → 에러 "문제를 찾을 수 없습니다."', async () => {
    const profileQuery = mockAuthAs('student')
    const detailQuery = mockQuestionDetailQuery(null)

    mockSupabaseClient.from
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(detailQuery)

    const result = await getQuestionDetail('nonexistent-uuid')

    expect(result.error).toBe('문제를 찾을 수 없습니다.')
    expect(result.data).toBeUndefined()
  })

  // 4. answer, explanation 필드 존재 확인
  it('answer, explanation 포함 → QuestionDetail에 정상 매핑', async () => {
    const profileQuery = mockAuthAs('teacher')
    const detailQuery = mockQuestionDetailQuery(mockQuestionDbRow)

    mockSupabaseClient.from
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(detailQuery)

    const result = await getQuestionDetail('question-uuid-1')

    expect(result.data?.answer).toBe('1')
    expect(result.data?.explanation).toBe('x = 2 또는 x = 3이므로 답은 보기 1번이다.')
    expect(result.data?.unit).toBe('이차방정식')
    expect(result.data?.aiModel).toBe('gemini')
  })

  // 5. options JSONB → TypeScript 배열 확인
  it('options JSONB → 배열로 반환', async () => {
    const profileQuery = mockAuthAs('student')
    const detailQuery = mockQuestionDetailQuery(mockQuestionDbRow)

    mockSupabaseClient.from
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(detailQuery)

    const result = await getQuestionDetail('question-uuid-1')

    expect(Array.isArray(result.data?.options)).toBe(true)
    expect(result.data?.options).toHaveLength(5)
    expect(result.data?.options?.[0]).toBe('2, 3')
  })

  // 6. difficulty 숫자 → difficultyLabel 변환 확인
  it('difficulty 숫자(3) → difficultyLabel("보통") 변환', async () => {
    const profileQuery = mockAuthAs('student')
    const detailQuery = mockQuestionDetailQuery(mockQuestionDbRow)

    mockSupabaseClient.from
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(detailQuery)

    const result = await getQuestionDetail('question-uuid-1')

    // toQuestionDetail 내부에서 변환: 3 → '보통'
    expect(result.data?.difficultyLabel).toBe('보통')
  })

  // 7. profiles!created_by FK JOIN → createdByName 매핑
  it('profiles!created_by FK JOIN → createdByName 정상 매핑', async () => {
    const profileQuery = mockAuthAs('student')
    const detailQuery = mockQuestionDetailQuery(mockQuestionDbRow)

    mockSupabaseClient.from
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(detailQuery)

    const result = await getQuestionDetail('question-uuid-1')

    expect(result.data?.createdByName).toBe('김교사')
  })

  // 8. DB 에러 → 에러 메시지
  it('DB 에러 → 에러 "문제 상세 조회에 실패했습니다."', async () => {
    const profileQuery = mockAuthAs('student')
    mockSupabaseClient.from.mockReturnValueOnce(profileQuery)

    // DB 쿼리가 throw 하도록 Mock
    mockSupabaseClient.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockRejectedValue(new Error('DB connection error')),
    })

    const result = await getQuestionDetail('question-uuid-1')

    expect(result.error).toBe('문제 상세 조회에 실패했습니다.')
    expect(result.data).toBeUndefined()
  })
})
