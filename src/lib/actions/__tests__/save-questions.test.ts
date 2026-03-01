/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 생성된 문제 저장 Server Action 테스트
 *
 * 테스트 대상: saveGeneratedQuestions
 * Mock 전략:
 * - Supabase: from() mockImplementation 테이블명 분기 (profiles / past_exam_questions / questions)
 * - 인증 헬퍼: generate-questions.test.ts와 동일 패턴 재사용
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Supabase Mock ───────────────────────────────────────

/** profiles 테이블 쿼리 체인 Mock */
const mockProfileQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
}

/** past_exam_questions 테이블 쿼리 체인 Mock */
const mockPastExamQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
}

/** questions 테이블 쿼리 체인 Mock (insert + select 체인) */
const mockQuestionsQuery = {
  insert: vi.fn().mockReturnThis(),
  select: vi.fn(),
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

// ─── Mock 후 import ───────────────────────────────────────
import { saveGeneratedQuestions } from '../save-questions'

// ─── 테스트 픽스처 ──────────────────────────────────────

/** 기출문제 DB 행 Mock */
const MOCK_PAST_EXAM_ROW = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  subject: '수학',
  grade: 10,
  year: 2024,
  semester: 1,
  exam_type: 'midterm',
  school_id: 'school-uuid-1',
  schools: { name: '한국고등학교' },
}

/** 저장할 문제 1개 (AI 타입 그대로) */
const MOCK_QUESTION_MULTIPLE_CHOICE = {
  content: '이차방정식 x²-5x+6=0의 해를 구하시오.',
  type: 'multiple_choice',
  difficulty: 'medium',
  answer: 'x=2 또는 x=3',
  explanation: '인수분해: (x-2)(x-3)=0',
  options: ['x=1 또는 x=5', 'x=2 또는 x=3', 'x=-2 또는 x=-3', 'x=2 또는 x=-3', 'x=-2 또는 x=3'],
}

/** 서술형 문제 Mock (type: 'essay') */
const MOCK_QUESTION_ESSAY = {
  content: '이차방정식을 이용하여 풀이 과정을 서술하시오.',
  type: 'essay',
  difficulty: 'hard',
  answer: '풀이 참조',
  explanation: '인수분해 또는 근의 공식 사용',
}

/** 단답형 문제 Mock */
const MOCK_QUESTION_SHORT_ANSWER = {
  content: '1 + 1 = ?',
  type: 'short_answer',
  difficulty: 'easy',
  answer: '2',
  explanation: '1과 1을 더하면 2이다.',
}

/** DB INSERT 결과 Mock (id 배열) */
const MOCK_INSERTED_IDS = [
  { id: 'question-uuid-1' },
  { id: 'question-uuid-2' },
  { id: 'question-uuid-3' },
]

/** 유효한 기본 입력값 (객관식 1개) */
const VALID_INPUT_ONE = {
  pastExamId: '550e8400-e29b-41d4-a716-446655440000',
  questions: [MOCK_QUESTION_MULTIPLE_CHOICE],
}

/** 유효한 입력값 (3개: 객관식/단답/서술형 혼합) */
const VALID_INPUT_THREE = {
  pastExamId: '550e8400-e29b-41d4-a716-446655440000',
  questions: [
    MOCK_QUESTION_MULTIPLE_CHOICE,
    MOCK_QUESTION_SHORT_ANSWER,
    MOCK_QUESTION_ESSAY,
  ],
}

// ─── Mock 헬퍼 함수 ─────────────────────────────────────

/** 비인증 사용자 Mock */
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

/** INSERT 성공 Mock */
function mockInsertSuccess(insertedRows = MOCK_INSERTED_IDS) {
  mockQuestionsQuery.select.mockResolvedValue({
    data: insertedRows,
    error: null,
  })
}

/** INSERT 에러 Mock (DB 에러 객체 반환) */
function mockInsertError() {
  mockQuestionsQuery.select.mockResolvedValue({
    data: null,
    error: { message: 'DB constraint violation', code: '23514' },
  })
}

/** INSERT 예외 Mock (throw) */
function mockInsertThrows() {
  mockQuestionsQuery.select.mockRejectedValue(new Error('Connection timeout'))
}

/** 전체 성공 경로 Mock (인증 + 기출 + INSERT) */
function mockFullSuccess(
  role = 'teacher',
  insertedRows = MOCK_INSERTED_IDS,
) {
  mockAuthAs(role)
  mockPastExamFound()
  mockInsertSuccess(insertedRows)
}

// ─── 테스트 스위트 ───────────────────────────────────────

describe('saveGeneratedQuestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // from() 테이블 분기 — 3개 테이블
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') return mockProfileQuery
      if (table === 'past_exam_questions') return mockPastExamQuery
      if (table === 'questions') return mockQuestionsQuery
      throw new Error(`예상치 못한 테이블: ${table}`)
    })
  })

  // ─── 그룹 1: 인증 + 권한 ────────────────────────────────

  describe('인증 + 권한', () => {
    it('비인증 사용자 → 에러 "인증이 필요합니다."', async () => {
      mockAuthFailed()

      const result = await saveGeneratedQuestions(VALID_INPUT_ONE)

      expect(result.error).toBe('인증이 필요합니다.')
      expect(result.data).toBeUndefined()
    })

    it('프로필 없음 → 에러 "프로필을 찾을 수 없습니다."', async () => {
      mockProfileNotFound()

      const result = await saveGeneratedQuestions(VALID_INPUT_ONE)

      expect(result.error).toBe('프로필을 찾을 수 없습니다.')
      expect(result.data).toBeUndefined()
    })

    it('academy_id 없음 → 에러 "소속 학원이 없습니다."', async () => {
      mockAuthAs('teacher', undefined, null)

      const result = await saveGeneratedQuestions(VALID_INPUT_ONE)

      expect(result.error).toBe('소속 학원이 없습니다.')
    })

    it('student 역할 → 에러 "문제 저장 권한이 없습니다."', async () => {
      mockAuthAs('student')

      const result = await saveGeneratedQuestions(VALID_INPUT_ONE)

      expect(result.error).toContain('문제 저장 권한이 없습니다')
    })

    it('teacher 역할 → 인증 통과 (에러 없음)', async () => {
      mockFullSuccess('teacher', [{ id: 'question-uuid-1' }])

      const result = await saveGeneratedQuestions(VALID_INPUT_ONE)

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
    })

    it('admin 역할 → 인증 통과 (에러 없음)', async () => {
      mockFullSuccess('admin', [{ id: 'question-uuid-1' }])

      const result = await saveGeneratedQuestions(VALID_INPUT_ONE)

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
    })
  })

  // ─── 그룹 2: 입력값 검증 ────────────────────────────────

  describe('입력값 검증', () => {
    it('유효하지 않은 pastExamId (not-a-uuid) → 에러', async () => {
      mockAuthAs('teacher')

      const result = await saveGeneratedQuestions({
        ...VALID_INPUT_ONE,
        pastExamId: 'not-a-uuid',
      })

      expect(result.error).toBeDefined()
      expect(result.data).toBeUndefined()
    })

    it('빈 questions 배열 → 에러 "저장할 문제가 없습니다."', async () => {
      mockAuthAs('teacher')

      const result = await saveGeneratedQuestions({
        ...VALID_INPUT_ONE,
        questions: [],
      })

      expect(result.error).toBe('저장할 문제가 없습니다.')
    })

    it('11개 문제 → 에러 (최대 10개)', async () => {
      mockAuthAs('teacher')

      const result = await saveGeneratedQuestions({
        pastExamId: '550e8400-e29b-41d4-a716-446655440000',
        questions: Array.from({ length: 11 }, () => MOCK_QUESTION_MULTIPLE_CHOICE),
      })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('10')
    })

    it('content 빈 문자열 → 에러', async () => {
      mockAuthAs('teacher')

      const result = await saveGeneratedQuestions({
        pastExamId: '550e8400-e29b-41d4-a716-446655440000',
        questions: [{ ...MOCK_QUESTION_MULTIPLE_CHOICE, content: '' }],
      })

      expect(result.error).toBeDefined()
    })
  })

  // ─── 그룹 3: 기출문제 조회 ─────────────────────────────

  describe('기출문제 조회', () => {
    it('존재하지 않는 pastExamId → 에러 "기출문제를 찾을 수 없습니다."', async () => {
      mockAuthAs('teacher')
      mockPastExamNotFound()

      const result = await saveGeneratedQuestions(VALID_INPUT_ONE)

      expect(result.error).toBe('기출문제를 찾을 수 없습니다.')
      expect(result.data).toBeUndefined()
    })
  })

  // ─── 그룹 4: 타입 변환 검증 ─────────────────────────────

  describe('타입 변환 검증', () => {
    it('type "essay" → DB에 "descriptive"로 변환 확인', async () => {
      mockAuthAs('teacher')
      mockPastExamFound()
      mockInsertSuccess([{ id: 'question-uuid-1' }])

      await saveGeneratedQuestions({
        pastExamId: '550e8400-e29b-41d4-a716-446655440000',
        questions: [MOCK_QUESTION_ESSAY],
      })

      // insert()에 전달된 배열의 첫 번째 요소 검사
      const insertedRows = mockQuestionsQuery.insert.mock.calls[0][0] as any[]
      expect(insertedRows[0].type).toBe('descriptive')
    })

    it('difficulty "medium" → DB에 3으로 변환 확인', async () => {
      mockAuthAs('teacher')
      mockPastExamFound()
      mockInsertSuccess([{ id: 'question-uuid-1' }])

      await saveGeneratedQuestions(VALID_INPUT_ONE)

      const insertedRows = mockQuestionsQuery.insert.mock.calls[0][0] as any[]
      expect(insertedRows[0].difficulty).toBe(3)
    })

    it('is_ai_generated: true 확인', async () => {
      mockFullSuccess('teacher', [{ id: 'question-uuid-1' }])

      await saveGeneratedQuestions(VALID_INPUT_ONE)

      const insertedRows = mockQuestionsQuery.insert.mock.calls[0][0] as any[]
      expect(insertedRows[0].is_ai_generated).toBe(true)
    })

    it('source_metadata에 pastExamId, schoolId, schoolName, year, semester, examType 포함', async () => {
      mockFullSuccess('teacher', [{ id: 'question-uuid-1' }])

      await saveGeneratedQuestions(VALID_INPUT_ONE)

      const insertedRows = mockQuestionsQuery.insert.mock.calls[0][0] as any[]
      const meta = insertedRows[0].source_metadata
      expect(meta).toMatchObject({
        pastExamId: '550e8400-e29b-41d4-a716-446655440000',
        schoolId: 'school-uuid-1',
        schoolName: '한국고등학교',
        year: 2024,
        semester: 1,
        examType: 'midterm',
      })
      // generatedAt은 ISO 문자열인지만 확인
      expect(typeof meta.generatedAt).toBe('string')
    })

    it('academy_id가 인증된 사용자의 학원 ID와 일치', async () => {
      mockAuthAs('teacher', '11111111-1111-4111-8111-111111111111', 'academy-uuid-1')
      mockPastExamFound()
      mockInsertSuccess([{ id: 'question-uuid-1' }])

      await saveGeneratedQuestions(VALID_INPUT_ONE)

      const insertedRows = mockQuestionsQuery.insert.mock.calls[0][0] as any[]
      expect(insertedRows[0].academy_id).toBe('academy-uuid-1')
    })
  })

  // ─── 그룹 5: DB 저장 성공 ─────────────────────────────

  describe('DB 저장 성공', () => {
    it('유효 입력 → savedCount와 questionIds 반환', async () => {
      mockFullSuccess('teacher', [{ id: 'question-uuid-1' }])

      const result = await saveGeneratedQuestions(VALID_INPUT_ONE)

      expect(result.error).toBeUndefined()
      expect(result.data).toMatchObject({
        savedCount: 1,
        questionIds: ['question-uuid-1'],
      })
    })

    it('3개 문제 → savedCount === 3, questionIds 3개', async () => {
      mockAuthAs('teacher')
      mockPastExamFound()
      mockInsertSuccess(MOCK_INSERTED_IDS) // 3개 ID

      const result = await saveGeneratedQuestions(VALID_INPUT_THREE)

      expect(result.data?.savedCount).toBe(3)
      expect(result.data?.questionIds).toHaveLength(3)
      expect(result.data?.questionIds).toEqual([
        'question-uuid-1',
        'question-uuid-2',
        'question-uuid-3',
      ])
    })
  })

  // ─── 그룹 6: 부분 선택 저장 ─────────────────────────────
  // UI에서 savedIndices(Set)로 선택된 문제만 필터링하여 Server Action에 전달.
  // Server Action은 받은 questions 배열을 그대로 저장 — 선택 로직은 UI 책임.

  describe('부분 선택 저장', () => {
    it('1개만 선택 → savedCount === 1', async () => {
      mockAuthAs('teacher')
      mockPastExamFound()
      mockInsertSuccess([{ id: 'question-uuid-1' }])

      // UI가 1개만 필터링해서 보낸 상황
      const result = await saveGeneratedQuestions({
        pastExamId: '550e8400-e29b-41d4-a716-446655440000',
        questions: [MOCK_QUESTION_MULTIPLE_CHOICE],
      })

      expect(result.data?.savedCount).toBe(1)
      // insert()에 전달된 배열도 1개인지 확인
      const insertedRows = mockQuestionsQuery.insert.mock.calls[0][0] as any[]
      expect(insertedRows).toHaveLength(1)
    })

    it('3개 중 1개만 선택 → savedCount === 1, insert에 1개만 전달', async () => {
      mockAuthAs('teacher')
      mockPastExamFound()
      mockInsertSuccess([{ id: 'question-uuid-2' }])

      // UI가 중간 1개(단답형)만 선택해서 보낸 상황
      const result = await saveGeneratedQuestions({
        pastExamId: '550e8400-e29b-41d4-a716-446655440000',
        questions: [MOCK_QUESTION_SHORT_ANSWER],
      })

      expect(result.data?.savedCount).toBe(1)
      expect(result.data?.questionIds).toEqual(['question-uuid-2'])
      const insertedRows = mockQuestionsQuery.insert.mock.calls[0][0] as any[]
      expect(insertedRows).toHaveLength(1)
    })

    it('10개 중 3개 선택 → savedCount === 3, insert에 3개만 전달', async () => {
      mockAuthAs('teacher')
      mockPastExamFound()
      mockInsertSuccess([
        { id: 'question-uuid-1' },
        { id: 'question-uuid-4' },
        { id: 'question-uuid-7' },
      ])

      // UI가 1번, 4번, 7번 문제만 선택해서 보낸 상황
      const result = await saveGeneratedQuestions({
        pastExamId: '550e8400-e29b-41d4-a716-446655440000',
        questions: [
          MOCK_QUESTION_MULTIPLE_CHOICE,
          MOCK_QUESTION_SHORT_ANSWER,
          MOCK_QUESTION_ESSAY,
        ],
      })

      expect(result.data?.savedCount).toBe(3)
      expect(result.data?.questionIds).toHaveLength(3)
      const insertedRows = mockQuestionsQuery.insert.mock.calls[0][0] as any[]
      expect(insertedRows).toHaveLength(3)
    })
  })

  // ─── 그룹 7: DB 저장 실패 ─────────────────────────────

  describe('DB 저장 실패', () => {
    it('insert 에러 → "문제 저장에 실패했습니다."', async () => {
      mockAuthAs('teacher')
      mockPastExamFound()
      mockInsertError()

      const result = await saveGeneratedQuestions(VALID_INPUT_ONE)

      expect(result.error).toBe('문제 저장에 실패했습니다. 다시 시도해주세요.')
      expect(result.data).toBeUndefined()
    })

    it('예외 발생 → "문제 저장 중 오류가 발생했습니다."', async () => {
      mockAuthAs('teacher')
      mockPastExamFound()
      mockInsertThrows()

      const result = await saveGeneratedQuestions(VALID_INPUT_ONE)

      expect(result.error).toBe('문제 저장 중 오류가 발생했습니다.')
      expect(result.data).toBeUndefined()
    })
  })
})
