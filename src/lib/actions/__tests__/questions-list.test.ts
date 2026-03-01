/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * getQuestionList Server Action 테스트
 *
 * 테스트 대상: 12개
 * - 인증 실패 (3개)
 * - 필터 적용 (5개)
 * - 응답 변환 (3개)
 * - 에러 처리 (1개)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getQuestionList } from '../questions'

// ─── Mock 설정 ────────────────────────────────────────

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}))

// ─── Mock 헬퍼 ────────────────────────────────────────

function mockAuthFailed() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'Not authenticated' },
  } as any)
}

function mockAuthAs(
  role: string,
  id = 'user-uuid-1',
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

function mockProfileNotFound() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'some-user-id' } },
    error: null,
  } as any)

  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    }),
  }
}

/** 목록 조회 Mock 헬퍼 */
function mockQuestionListQuery(rows: any[], total: number) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({
      data: rows,
      count: total,
      error: null,
    }),
  }
}

const SAMPLE_ROW = {
  id: 'question-uuid-1',
  content: '이차방정식 x² - 5x + 6 = 0의 해는?',
  type: 'multiple_choice',
  difficulty: 3,
  subject: '수학',
  grade: 10,
  is_ai_generated: true,
  ai_review_status: 'pending',
  source_type: 'ai_generated',
  created_at: '2026-02-28T00:00:00.000Z',
  profiles: { name: '홍길동' },
}

// ─── 테스트 ───────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getQuestionList', () => {
  // ─── 인증 실패 ──────────────────────────────────────

  describe('인증 실패', () => {
    it('인증되지 않은 사용자는 에러를 반환한다', async () => {
      mockAuthFailed()
      mockSupabaseClient.from.mockReturnValue(mockProfileNotFound())

      const result = await getQuestionList()

      expect(result.error).toBeDefined()
      expect(result.data).toBeUndefined()
    })

    it('프로필이 없으면 에러를 반환한다', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'some-user-id' } },
        error: null,
      } as any)
      mockSupabaseClient.from.mockReturnValue(mockProfileNotFound())

      const result = await getQuestionList()

      expect(result.error).toBeDefined()
    })

    it('소속 학원이 없으면 에러를 반환한다', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-no-academy' } },
        error: null,
      } as any)
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'user-no-academy', role: 'teacher', academy_id: null },
          error: null,
        }),
      })

      const result = await getQuestionList()

      expect(result.error).toBeDefined()
    })
  })

  // ─── 필터 적용 ──────────────────────────────────────

  describe('필터 적용', () => {
    beforeEach(() => {
      const profileQuery = mockAuthAs('teacher')
      const listQuery = mockQuestionListQuery([SAMPLE_ROW], 1)

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'questions') return listQuery
        return listQuery
      })
    })

    it('필터 없이 목록을 조회한다', async () => {
      const result = await getQuestionList()

      expect(result.error).toBeUndefined()
      expect(result.data).toHaveLength(1)
    })

    it('subject 필터를 적용한다', async () => {
      const result = await getQuestionList({ subject: '수학' })

      expect(result.error).toBeUndefined()
    })

    it('grade 필터를 적용한다', async () => {
      const result = await getQuestionList({ grade: '10' })

      expect(result.error).toBeUndefined()
    })

    it('type 필터를 적용한다', async () => {
      const result = await getQuestionList({ type: 'multiple_choice' })

      expect(result.error).toBeUndefined()
    })

    it('sourceType 필터를 적용한다', async () => {
      const result = await getQuestionList({ sourceType: 'ai_generated' })

      expect(result.error).toBeUndefined()
    })
  })

  // ─── 응답 변환 ──────────────────────────────────────

  describe('응답 변환', () => {
    beforeEach(() => {
      const profileQuery = mockAuthAs('teacher')
      const listQuery = mockQuestionListQuery([SAMPLE_ROW], 5)

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'questions') return listQuery
        return listQuery
      })
    })

    it('DB row를 QuestionListItem으로 변환한다', async () => {
      const result = await getQuestionList()

      const item = result.data?.[0]
      expect(item?.id).toBe('question-uuid-1')
      expect(item?.content).toBe('이차방정식 x² - 5x + 6 = 0의 해는?')
      expect(item?.difficulty).toBe(3)
      expect(item?.isAiGenerated).toBe(true)
      expect(item?.createdByName).toBe('홍길동')
    })

    it('페이지네이션 메타를 반환한다', async () => {
      const result = await getQuestionList({ page: '1' })

      expect(result.meta?.total).toBe(5)
      expect(result.meta?.page).toBe(1)
      expect(result.meta?.pageSize).toBe(10)
    })

    it('profiles.name이 null이면 createdByName은 null이다', async () => {
      const profileQuery = mockAuthAs('teacher')
      const listQuery = mockQuestionListQuery(
        [{ ...SAMPLE_ROW, profiles: null }],
        1
      )

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        return listQuery
      })

      const result = await getQuestionList()

      expect(result.data?.[0]?.createdByName).toBeNull()
    })
  })

  // ─── 에러 처리 ──────────────────────────────────────

  describe('에러 처리', () => {
    it('DB 조회 실패 시 에러를 반환한다', async () => {
      const profileQuery = mockAuthAs('teacher')
      const errorQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: null,
          count: null,
          error: { message: 'DB Error' },
        }),
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        return errorQuery
      })

      const result = await getQuestionList()

      expect(result.error).toBeDefined()
      expect(result.data).toBeUndefined()
    })
  })
})
