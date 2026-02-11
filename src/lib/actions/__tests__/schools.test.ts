/**
 * 학교 관리 Server Actions 통합 테스트
 *
 * 테스트 대상:
 * - createSchool: 생성 성공/실패, RBAC, 검증
 * - getSchoolList: 필터링, 페이지네이션
 * - getSchoolById: 단일 조회
 * - updateSchool: 수정 성공/실패, RBAC
 * - deleteSchool: 삭제 성공/실패, 의존성 체크
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createSchool,
  getSchoolList,
  getSchoolById,
  updateSchool,
  deleteSchool,
} from '../schools'

// ─── Mock Setup ─────────────────────────────────────────

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// ─── Helper Functions ───────────────────────────────────

function createMockFormData(data: Record<string, string>): FormData {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value)
  })
  return formData
}

function mockAuthAsTeacher() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'teacher-id' } },
    error: null,
  })

  // RBAC 체크용 profiles 조회 mock (첫 번째 from 호출)
  const profileQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { role: 'teacher' },
      error: null,
    }),
  }

  mockSupabaseClient.from.mockReturnValueOnce(profileQuery)
}

function mockAuthAsStudent() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'student-id' } },
    error: null,
  })

  // RBAC 체크용 profiles 조회 mock
  const profileQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { role: 'student' },
      error: null,
    }),
  }

  mockSupabaseClient.from.mockReturnValueOnce(profileQuery)
}

function mockAuthFailed() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: new Error('Unauthorized'),
  })
}

// ─── Tests ──────────────────────────────────────────────

describe('createSchool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('성공: 유효한 데이터로 학교 생성 (teacher)', async () => {
    mockAuthAsTeacher()
    mockSupabaseClient.from.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({
        data: { id: 'school-1' },
        error: null,
      }),
    })

    const formData = createMockFormData({
      name: '서울고등학교',
      schoolType: 'high',
      region: '서울특별시',
      district: '강남구',
      address: '서울특별시 강남구 테헤란로 123',
    })

    const result = await createSchool(null, formData)

    expect(result.error).toBeUndefined()
    expect(result.data).toEqual({ success: true })
  })

  it('실패: 권한 없음 (student)', async () => {
    mockAuthAsStudent()

    const formData = createMockFormData({
      name: '서울고등학교',
      schoolType: 'high',
    })

    const result = await createSchool(null, formData)

    expect(result.error).toBe('권한이 없습니다.')
  })

  it('실패: 인증 실패', async () => {
    mockAuthFailed()

    const formData = createMockFormData({
      name: '서울고등학교',
      schoolType: 'high',
    })

    const result = await createSchool(null, formData)

    expect(result.error).toBe('인증이 필요합니다.')
  })

  it('실패: 필수 필드 누락 (name)', async () => {
    mockAuthAsTeacher()

    const formData = createMockFormData({
      schoolType: 'high',
    })

    const result = await createSchool(null, formData)

    expect(result.error).toBeDefined()
    expect(result.error).toMatch(/string|학교명/)
  })

  it('실패: 유효하지 않은 schoolType', async () => {
    mockAuthAsTeacher()

    const formData = createMockFormData({
      name: '서울고등학교',
      schoolType: 'invalid',
    })

    const result = await createSchool(null, formData)

    expect(result.error).toContain('학교 유형')
  })

  it('실패: DB 삽입 에러', async () => {
    mockAuthAsTeacher()
    mockSupabaseClient.from.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'DB Error' },
      }),
    })

    const formData = createMockFormData({
      name: '서울고등학교',
      schoolType: 'high',
    })

    const result = await createSchool(null, formData)

    expect(result.error).toBe('학교 생성에 실패했습니다.')
  })
})

describe('getSchoolList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('성공: 전체 목록 조회 (필터 없음)', async () => {
    const mockSchools = [
      {
        id: 'school-1',
        name: '서울고등학교',
        school_type: 'high',
        region: '서울특별시',
        district: '강남구',
        created_at: '2024-01-01',
      },
      {
        id: 'school-2',
        name: '부산중학교',
        school_type: 'middle',
        region: '부산광역시',
        district: '해운대구',
        created_at: '2024-01-02',
      },
    ]

    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          range: vi.fn().mockResolvedValue({
            data: mockSchools,
            error: null,
            count: 2,
          }),
        }),
      }),
    })

    const result = await getSchoolList()

    expect(result.error).toBeUndefined()
    expect(result.data).toEqual({
      schools: mockSchools,
      total: 2,
      page: 1,
      pageSize: 10,
    })
  })

  it('성공: 검색 필터 (name ILIKE)', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      }),
    }

    mockSupabaseClient.from.mockReturnValue(mockQuery)

    await getSchoolList({ search: '서울' })

    expect(mockQuery.ilike).toHaveBeenCalledWith('name', '%서울%')
  })

  it('성공: schoolType 필터', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      }),
    }

    mockSupabaseClient.from.mockReturnValue(mockQuery)

    await getSchoolList({ schoolType: 'high' })

    expect(mockQuery.eq).toHaveBeenCalledWith('school_type', 'high')
  })

  it('성공: 페이지네이션 (page=2)', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      }),
    }

    mockSupabaseClient.from.mockReturnValue(mockQuery)

    await getSchoolList({ page: 2 })

    expect(mockQuery.range).toHaveBeenCalledWith(10, 19)
  })

  it('실패: DB 조회 에러', async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          range: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'DB Error' },
            count: null,
          }),
        }),
      }),
    })

    const result = await getSchoolList()

    expect(result.error).toBe('학교 목록 조회에 실패했습니다.')
  })
})

describe('getSchoolById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('성공: 학교 단일 조회', async () => {
    const mockSchool = {
      id: 'school-1',
      name: '서울고등학교',
      school_type: 'high',
      region: '서울특별시',
      district: '강남구',
      address: '서울특별시 강남구 테헤란로 123',
      created_at: '2024-01-01',
    }

    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockSchool,
            error: null,
          }),
        }),
      }),
    })

    const result = await getSchoolById('school-1')

    expect(result.error).toBeUndefined()
    expect(result.data).toEqual(mockSchool)
  })

  it('실패: ID 누락', async () => {
    const result = await getSchoolById('')

    expect(result.error).toBe('학교 ID가 필요합니다.')
  })

  it('실패: 존재하지 않는 ID', async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not Found' },
          }),
        }),
      }),
    })

    const result = await getSchoolById('invalid-id')

    expect(result.error).toBe('학교 정보 조회에 실패했습니다.')
  })
})

describe('updateSchool', () => {
  const validSchoolId = '123e4567-e89b-12d3-a456-426614174000'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('성공: 학교 정보 수정 (teacher)', async () => {
    // 1. RBAC 체크
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'teacher-id' } },
      error: null,
    })
    mockSupabaseClient.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { role: 'teacher' },
        error: null,
      }),
    })

    // 2. 실제 update 쿼리
    mockSupabaseClient.from.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: { id: validSchoolId },
        error: null,
      }),
    })

    const formData = createMockFormData({
      name: '서울고등학교 (수정)',
      schoolType: 'high',
      region: '서울특별시',
      district: '강남구',
      address: '새 주소',
    })

    const result = await updateSchool(validSchoolId, null, formData)

    expect(result.error).toBeUndefined()
    expect(result.data).toEqual({ success: true })
  })

  it('실패: 권한 없음 (student)', async () => {
    // RBAC 체크: student
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'student-id' } },
      error: null,
    })
    mockSupabaseClient.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { role: 'student' },
        error: null,
      }),
    })

    const formData = createMockFormData({
      name: '서울고등학교',
      schoolType: 'high',
    })

    const result = await updateSchool(validSchoolId, null, formData)

    expect(result.error).toBe('권한이 없습니다.')
  })

  it('실패: 필수 필드 누락', async () => {
    // RBAC 체크
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'teacher-id' } },
      error: null,
    })
    mockSupabaseClient.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { role: 'teacher' },
        error: null,
      }),
    })

    const formData = createMockFormData({
      schoolType: 'high',
    })

    const result = await updateSchool(validSchoolId, null, formData)

    expect(result.error).toBeDefined()
    expect(result.error).toMatch(/string|학교명/)
  })

  it('실패: DB 업데이트 에러', async () => {
    // 1. RBAC 체크
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'teacher-id' } },
      error: null,
    })
    mockSupabaseClient.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { role: 'teacher' },
        error: null,
      }),
    })

    // 2. 실제 update 쿼리 (실패)
    mockSupabaseClient.from.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'DB Error' },
      }),
    })

    const formData = createMockFormData({
      name: '서울고등학교',
      schoolType: 'high',
    })

    const result = await updateSchool(validSchoolId, null, formData)

    expect(result.error).toBe('학교 정보 수정에 실패했습니다.')
  })
})

describe('deleteSchool', () => {
  const validSchoolId = '123e4567-e89b-12d3-a456-426614174000'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('성공: 학교 삭제 (의존성 없음)', async () => {
    // 1. RBAC 체크 (profiles)
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'teacher-id' } },
      error: null,
    })
    mockSupabaseClient.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { role: 'teacher' },
        error: null,
      }),
    })

    // 2. 의존성 체크 (students)
    mockSupabaseClient.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    })

    // 3. 삭제 (schools)
    mockSupabaseClient.from.mockReturnValueOnce({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    })

    const result = await deleteSchool(validSchoolId)

    expect(result.error).toBeUndefined()
    expect(result.data).toEqual({ success: true })
  })

  it('실패: 의존성 있음 (학생 존재)', async () => {
    // 1. RBAC 체크
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'teacher-id' } },
      error: null,
    })
    mockSupabaseClient.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { role: 'teacher' },
        error: null,
      }),
    })

    // 2. 의존성 체크: 학생 있음
    mockSupabaseClient.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [{ id: 'student-1' }],
        error: null,
      }),
    })

    const result = await deleteSchool(validSchoolId)

    expect(result.error).toBe('학생이 등록된 학교는 삭제할 수 없습니다.')
  })

  it('실패: 권한 없음 (student)', async () => {
    // RBAC 체크: student
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'student-id' } },
      error: null,
    })
    mockSupabaseClient.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { role: 'student' },
        error: null,
      }),
    })

    const result = await deleteSchool(validSchoolId)

    expect(result.error).toBe('권한이 없습니다.')
  })

  it('실패: ID 누락', async () => {
    // RBAC 체크
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'teacher-id' } },
      error: null,
    })
    mockSupabaseClient.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { role: 'teacher' },
        error: null,
      }),
    })

    const result = await deleteSchool('')

    expect(result.error).toBe('학교 ID가 필요합니다.')
  })

  it('실패: DB 삭제 에러', async () => {
    // 1. RBAC 체크
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'teacher-id' } },
      error: null,
    })
    mockSupabaseClient.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { role: 'teacher' },
        error: null,
      }),
    })

    // 2. 의존성 체크: 학생 없음
    mockSupabaseClient.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    })

    // 3. 삭제 실패
    mockSupabaseClient.from.mockReturnValueOnce({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'DB Error' },
      }),
    })

    const result = await deleteSchool(validSchoolId)

    expect(result.error).toBe('학교 삭제에 실패했습니다.')
  })
})
