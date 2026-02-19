/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 기출문제 목록/상세 조회 Server Actions 테스트
 *
 * 테스트 대상:
 * - getPastExamList(): 목록 조회 + 필터 + 페이지네이션 (13개)
 * - getPastExamDetail(): 상세 조회 + Signed URL (5개)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPastExamList, getPastExamDetail } from '../past-exams'

// ============================================================================
// Mock Setup
// ============================================================================

const mockCreateSignedUrl = vi.fn()

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  storage: {
    from: vi.fn().mockReturnValue({
      createSignedUrl: mockCreateSignedUrl,
    }),
  },
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

  const profileQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id, role, academy_id: academyId },
      error: null,
    }),
  }

  return profileQuery
}

/** 프로필 없음 Mock */
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

/** academy_id 없음 Mock */
function mockProfileNoAcademy() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'some-user-id' } },
    error: null,
  } as any)

  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id: 'some-user-id', role: 'student', academy_id: null },
      error: null,
    }),
  }
}

/** FK JOIN 목록 쿼리 Mock (Fluent API 체인) */
function mockPastExamListQuery(items: any[], count: number) {
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((resolve: any) =>
      resolve({ data: items, error: null, count })
    ),
  }
}

/** 상세 조회 쿼리 Mock */
function mockPastExamDetailQuery(item: any | null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: item,
      error: item ? null : { message: 'Not found', code: 'PGRST116' },
    }),
  }
}

/** FK JOIN DB Row Mock (목록용) */
const mockDbRow = {
  id: 'exam-uuid-1',
  year: 2024,
  semester: 1,
  exam_type: 'midterm',
  grade: 10,
  subject: '수학',
  source_image_url: 'academy-uuid-1/school-uuid-1/2024-1-midterm/file.jpg',
  extraction_status: 'pending',
  created_at: '2024-01-15T00:00:00Z',
  schools: { name: '한국고등학교', school_type: 'high' },
  profiles: { name: '김교사' },
}

/** FK JOIN DB Row Mock (상세용, extracted_content 포함) */
const mockDbDetailRow = {
  ...mockDbRow,
  extracted_content: '문제 내용...',
}

// ============================================================================
// getPastExamList 테스트
// ============================================================================

describe('getPastExamList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabaseClient.storage.from.mockReturnValue({
      createSignedUrl: mockCreateSignedUrl,
    })
  })

  describe('인증', () => {
    it('비인증 사용자 → 에러 "인증이 필요합니다."', async () => {
      mockAuthFailed()

      const result = await getPastExamList()

      expect(result.error).toBe('인증이 필요합니다.')
      expect(result.data).toBeUndefined()
    })

    it('프로필 없음 → 에러 "프로필을 찾을 수 없습니다."', async () => {
      const profileQuery = mockProfileNotFound()
      mockSupabaseClient.from.mockReturnValueOnce(profileQuery)

      const result = await getPastExamList()

      expect(result.error).toBe('프로필을 찾을 수 없습니다.')
      expect(result.data).toBeUndefined()
    })

    it('academy_id 없음 → 에러 "소속 학원이 없습니다."', async () => {
      const profileQuery = mockProfileNoAcademy()
      mockSupabaseClient.from.mockReturnValueOnce(profileQuery)

      const result = await getPastExamList()

      expect(result.error).toBe('소속 학원이 없습니다.')
      expect(result.data).toBeUndefined()
    })
  })

  describe('기본 조회', () => {
    it('필터 없이 호출 → 목록 + meta(total, page=1, pageSize=10) 반환', async () => {
      const profileQuery = mockAuthAs('student')
      const listQuery = mockPastExamListQuery([mockDbRow], 1)

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(listQuery)

      const result = await getPastExamList()

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.meta).toEqual({ total: 1, page: 1, pageSize: 10 })
    })

    it('데이터 없으면 빈 배열 + meta.total=0', async () => {
      const profileQuery = mockAuthAs('student')
      const listQuery = mockPastExamListQuery([], 0)

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(listQuery)

      const result = await getPastExamList()

      expect(result.error).toBeUndefined()
      expect(result.data).toEqual([])
      expect(result.meta?.total).toBe(0)
    })
  })

  describe('필터 적용', () => {
    it('school 필터 → ilike("schools.name", "%한국%") 호출 확인', async () => {
      const profileQuery = mockAuthAs('student')
      const listQuery = mockPastExamListQuery([], 0)

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(listQuery)

      await getPastExamList({ school: '한국' })

      expect(listQuery.ilike).toHaveBeenCalledWith('schools.name', '%한국%')
    })

    it('grade 필터 → eq("grade", 10) 호출 확인', async () => {
      const profileQuery = mockAuthAs('student')
      const listQuery = mockPastExamListQuery([], 0)

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(listQuery)

      await getPastExamList({ grade: 10 })

      expect(listQuery.eq).toHaveBeenCalledWith('grade', 10)
    })

    it('examType="midterm" → eq("exam_type", "midterm") 호출 확인', async () => {
      const profileQuery = mockAuthAs('student')
      const listQuery = mockPastExamListQuery([], 0)

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(listQuery)

      await getPastExamList({ examType: 'midterm' })

      expect(listQuery.eq).toHaveBeenCalledWith('exam_type', 'midterm')
    })

    it('examType="all" → eq 호출 안 함 확인', async () => {
      const profileQuery = mockAuthAs('student')
      const listQuery = mockPastExamListQuery([], 0)

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(listQuery)

      await getPastExamList({ examType: 'all' })

      expect(listQuery.eq).not.toHaveBeenCalled()
    })

    it('복합 필터 (grade + examType + year) → 여러 eq 호출 확인', async () => {
      const profileQuery = mockAuthAs('student')
      const listQuery = mockPastExamListQuery([], 0)

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(listQuery)

      await getPastExamList({ grade: 10, examType: 'midterm', year: 2024 })

      expect(listQuery.eq).toHaveBeenCalledWith('grade', 10)
      expect(listQuery.eq).toHaveBeenCalledWith('exam_type', 'midterm')
      expect(listQuery.eq).toHaveBeenCalledWith('year', 2024)
    })
  })

  describe('페이지네이션', () => {
    it('page=2 → range(10, 19) 호출 확인', async () => {
      const profileQuery = mockAuthAs('student')
      const listQuery = mockPastExamListQuery([], 0)

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(listQuery)

      await getPastExamList({ page: 2 })

      expect(listQuery.range).toHaveBeenCalledWith(10, 19)
    })
  })

  describe('빈 문자열 처리', () => {
    it('school="" → ilike 호출 안 함 확인 (undefined 변환)', async () => {
      const profileQuery = mockAuthAs('student')
      const listQuery = mockPastExamListQuery([], 0)

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(listQuery)

      await getPastExamList({ school: '' })

      expect(listQuery.ilike).not.toHaveBeenCalled()
    })
  })

  describe('snake_case → camelCase 변환', () => {
    it('DB 응답 → schoolName, schoolType, uploadedByName 등 camelCase 변환 확인', async () => {
      const profileQuery = mockAuthAs('student')
      const listQuery = mockPastExamListQuery([mockDbRow], 1)

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(listQuery)

      const result = await getPastExamList()

      expect(result.error).toBeUndefined()
      expect(result.data?.[0]).toMatchObject({
        id: 'exam-uuid-1',
        schoolName: '한국고등학교',
        schoolType: 'high',
        year: 2024,
        semester: 1,
        examType: 'midterm',
        grade: 10,
        subject: '수학',
        extractionStatus: 'pending',
        uploadedByName: '김교사',
        sourceImageUrl: 'academy-uuid-1/school-uuid-1/2024-1-midterm/file.jpg',
        createdAt: '2024-01-15T00:00:00Z',
      })
    })
  })
})

// ============================================================================
// getPastExamDetail 테스트
// ============================================================================

describe('getPastExamDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateSignedUrl.mockReset()
    mockSupabaseClient.storage.from.mockReturnValue({
      createSignedUrl: mockCreateSignedUrl,
    })
  })

  describe('인증', () => {
    it('비인증 사용자 → 에러 "인증이 필요합니다."', async () => {
      mockAuthFailed()

      const result = await getPastExamDetail('exam-uuid-1')

      expect(result.error).toBe('인증이 필요합니다.')
      expect(result.data).toBeUndefined()
    })
  })

  describe('조회', () => {
    it('유효 ID → 상세 데이터 + signedImageUrl 반환', async () => {
      const profileQuery = mockAuthAs('student')
      const detailQuery = mockPastExamDetailQuery(mockDbDetailRow)
      mockCreateSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://signed.url/file.jpg' },
        error: null,
      })

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(detailQuery)

      const result = await getPastExamDetail('exam-uuid-1')

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(result.data?.signedImageUrl).toBe('https://signed.url/file.jpg')
      expect(result.data?.schoolName).toBe('한국고등학교')
      expect(result.data?.extractedContent).toBe('문제 내용...')
    })

    it('존재하지 않는 ID → 에러 "기출문제를 찾을 수 없습니다."', async () => {
      const profileQuery = mockAuthAs('student')
      const detailQuery = mockPastExamDetailQuery(null)

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(detailQuery)

      const result = await getPastExamDetail('nonexistent-uuid')

      expect(result.error).toBe('기출문제를 찾을 수 없습니다.')
      expect(result.data).toBeUndefined()
    })

    it('source_image_url 없으면 signedImageUrl = null (createSignedUrl 미호출)', async () => {
      const rowWithoutImage = { ...mockDbDetailRow, source_image_url: null }
      const profileQuery = mockAuthAs('student')
      const detailQuery = mockPastExamDetailQuery(rowWithoutImage)

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(detailQuery)

      const result = await getPastExamDetail('exam-uuid-1')

      expect(result.error).toBeUndefined()
      expect(result.data?.signedImageUrl).toBeNull()
      expect(mockCreateSignedUrl).not.toHaveBeenCalled()
    })
  })

  describe('Signed URL', () => {
    it('createSignedUrl(path, 60) 호출 확인', async () => {
      const profileQuery = mockAuthAs('student')
      const detailQuery = mockPastExamDetailQuery(mockDbDetailRow)
      mockCreateSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://signed.url/file.jpg' },
        error: null,
      })

      mockSupabaseClient.from
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(detailQuery)

      await getPastExamDetail('exam-uuid-1')

      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('past-exams')
      expect(mockCreateSignedUrl).toHaveBeenCalledWith(
        'academy-uuid-1/school-uuid-1/2024-1-midterm/file.jpg',
        60
      )
    })
  })
})
