/**
 * 성취기준 관리 Server Actions 통합 테스트
 *
 * 테스트 대상:
 * - getAchievementStandards: 목록 조회 (필터, 검색)
 * - getAchievementStandardById: 단일 조회
 * - createAchievementStandard: 생성 (RBAC, 검증, 중복)
 * - updateAchievementStandard: 수정 (RBAC, 검증)
 * - deactivateAchievementStandard: 비활성화 (RBAC)
 * - getDistinctUnits: 단원 목록 조회
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getAchievementStandards,
  getAchievementStandardById,
  createAchievementStandard,
  updateAchievementStandard,
  deactivateAchievementStandard,
  getDistinctUnits,
} from '../achievement-standards'

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

/** system_admin 인증 mock — auth.getUser + profiles 조회 */
function mockAuthAsSystemAdmin() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'system-admin-id' } },
    error: null,
  })

  // checkSystemAdminRole 내 profiles 조회
  const profileQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { role: 'system_admin' },
      error: null,
    }),
  }
  mockSupabaseClient.from.mockReturnValueOnce(profileQuery)
}

/** admin 인증 mock — RBAC 거부 대상 */
function mockAuthAsAdmin() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'admin-id' } },
    error: null,
  })

  const profileQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { role: 'admin' },
      error: null,
    }),
  }
  mockSupabaseClient.from.mockReturnValueOnce(profileQuery)
}

/** 인증 실패 mock */
function mockAuthFailed() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: new Error('Unauthorized'),
  })
}

/** 인증 사용자 mock (조회 작업용 — profiles 조회 없음) */
function mockAuthAsUser() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-id' } },
    error: null,
  })
}

// ─── 4중 order 체인 mock 생성 헬퍼 ─────────────────────

/**
 * getAchievementStandards 쿼리 체인 mock
 * .from().select().order().order().order().order() + 조건부 .eq()/.ilike()
 */
function createListQueryMock(resolvedValue: { data: unknown; error: unknown }) {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  }

  // 마지막 체인 호출에서 결과를 반환하기 위해
  // mockReturnThis()가 Promise를 resolve하도록 설정
  // Supabase query는 thenable — 최종 await 시 resolve
  Object.defineProperty(mockQuery, 'then', {
    value: (resolve: (value: unknown) => void) => {
      resolve(resolvedValue)
    },
    writable: true,
    configurable: true,
  })

  return mockQuery
}

// ─── Mock Data ──────────────────────────────────────────

const mockStandards = [
  {
    id: 'std-1',
    code: '수학4-01-01',
    content: '자연수의 덧셈과 뺄셈을 할 수 있다.',
    subject: '수학',
    grade: 4,
    semester: 1,
    unit: '자연수의 연산',
    is_active: true,
  },
  {
    id: 'std-2',
    code: '수학4-01-02',
    content: '자연수의 곱셈을 할 수 있다.',
    subject: '수학',
    grade: 4,
    semester: 1,
    unit: '자연수의 연산',
    is_active: true,
  },
]

// ─── Tests ──────────────────────────────────────────────

describe('getAchievementStandards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('성공: 전체 조회 (필터 없음)', async () => {
    mockAuthAsUser()
    const mockQuery = createListQueryMock({
      data: mockStandards,
      error: null,
    })
    mockSupabaseClient.from.mockReturnValue(mockQuery)

    const result = await getAchievementStandards()

    expect(result.error).toBeUndefined()
    expect(result.data).toEqual(mockStandards)
    // 기본 isActive='true' → eq('is_active', true) 호출됨
    expect(mockQuery.eq).toHaveBeenCalledWith('is_active', true)
  })

  it('성공: grade 필터', async () => {
    mockAuthAsUser()
    const mockQuery = createListQueryMock({
      data: [mockStandards[0]],
      error: null,
    })
    mockSupabaseClient.from.mockReturnValue(mockQuery)

    const result = await getAchievementStandards({ grade: 4 })

    expect(result.error).toBeUndefined()
    expect(mockQuery.eq).toHaveBeenCalledWith('grade', 4)
  })

  it('성공: 검색 (search)', async () => {
    mockAuthAsUser()
    const mockQuery = createListQueryMock({
      data: [mockStandards[0]],
      error: null,
    })
    mockSupabaseClient.from.mockReturnValue(mockQuery)

    const result = await getAchievementStandards({ search: '덧셈' })

    expect(result.error).toBeUndefined()
    expect(mockQuery.ilike).toHaveBeenCalledWith('content', '%덧셈%')
  })

  it('성공: 복합 필터', async () => {
    mockAuthAsUser()
    const mockQuery = createListQueryMock({
      data: mockStandards,
      error: null,
    })
    mockSupabaseClient.from.mockReturnValue(mockQuery)

    await getAchievementStandards({
      subject: '수학',
      grade: 4,
      semester: 1,
      unit: '자연수의 연산',
      isActive: 'all',
    })

    expect(mockQuery.eq).toHaveBeenCalledWith('subject', '수학')
    expect(mockQuery.eq).toHaveBeenCalledWith('grade', 4)
    expect(mockQuery.eq).toHaveBeenCalledWith('semester', 1)
    expect(mockQuery.eq).toHaveBeenCalledWith('unit', '자연수의 연산')
    // isActive='all'이면 is_active 필터 호출 없음
    expect(mockQuery.eq).not.toHaveBeenCalledWith('is_active', true)
    expect(mockQuery.eq).not.toHaveBeenCalledWith('is_active', false)
  })

  it('실패: DB 에러', async () => {
    mockAuthAsUser()
    const mockQuery = createListQueryMock({
      data: null,
      error: { message: 'DB Error' },
    })
    mockSupabaseClient.from.mockReturnValue(mockQuery)

    const result = await getAchievementStandards()

    expect(result.error).toBe('성취기준 목록 조회에 실패했습니다.')
  })
})

describe('getAchievementStandardById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('성공: 단일 조회', async () => {
    mockAuthAsUser()
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockStandards[0],
            error: null,
          }),
        }),
      }),
    })

    const result = await getAchievementStandardById('std-1')

    expect(result.error).toBeUndefined()
    expect(result.data).toEqual(mockStandards[0])
  })

  it('실패: ID 누락', async () => {
    const result = await getAchievementStandardById('')

    expect(result.error).toBe('성취기준 ID가 필요합니다.')
  })

  it('실패: 미존재 ID', async () => {
    mockAuthAsUser()
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

    const result = await getAchievementStandardById('nonexistent-id')

    expect(result.error).toBe('성취기준 조회에 실패했습니다.')
  })
})

describe('createAchievementStandard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('성공: system_admin 생성', async () => {
    mockAuthAsSystemAdmin()
    mockSupabaseClient.from.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({
        data: { id: 'new-std' },
        error: null,
      }),
    })

    const formData = createMockFormData({
      code: '수학4-01-01',
      content: '자연수의 덧셈과 뺄셈을 할 수 있다.',
      subject: '수학',
      grade: '4',
      keywords: JSON.stringify(['덧셈', '뺄셈']),
    })

    const result = await createAchievementStandard(null, formData)

    expect(result.error).toBeUndefined()
    expect(result.data).toEqual({ success: true })
  })

  it('실패: admin 권한 부족', async () => {
    mockAuthAsAdmin()

    const formData = createMockFormData({
      code: '수학4-01-01',
      content: '내용',
      subject: '수학',
      grade: '4',
    })

    const result = await createAchievementStandard(null, formData)

    expect(result.error).toBe('권한이 없습니다.')
  })

  it('실패: 인증 실패', async () => {
    mockAuthFailed()

    const formData = createMockFormData({
      code: '수학4-01-01',
      content: '내용',
      subject: '수학',
      grade: '4',
    })

    const result = await createAchievementStandard(null, formData)

    expect(result.error).toBe('인증이 필요합니다.')
  })

  it('실패: 필수 필드 누락', async () => {
    mockAuthAsSystemAdmin()

    // content 누락
    const formData = createMockFormData({
      code: '수학4-01-01',
      subject: '수학',
      grade: '4',
    })

    const result = await createAchievementStandard(null, formData)

    expect(result.error).toBeDefined()
  })

  it('실패: code 중복 (23505)', async () => {
    mockAuthAsSystemAdmin()
    mockSupabaseClient.from.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      }),
    })

    const formData = createMockFormData({
      code: '수학4-01-01',
      content: '내용',
      subject: '수학',
      grade: '4',
    })

    const result = await createAchievementStandard(null, formData)

    expect(result.error).toBe('이미 존재하는 성취기준 코드입니다.')
  })

  it('실패: DB 에러', async () => {
    mockAuthAsSystemAdmin()
    mockSupabaseClient.from.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '42000', message: 'DB Error' },
      }),
    })

    const formData = createMockFormData({
      code: '수학4-01-01',
      content: '내용',
      subject: '수학',
      grade: '4',
    })

    const result = await createAchievementStandard(null, formData)

    expect(result.error).toBe('처리 중 오류가 발생했습니다.')
  })
})

describe('updateAchievementStandard', () => {
  const validId = 'std-1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('성공: system_admin 수정', async () => {
    mockAuthAsSystemAdmin()
    mockSupabaseClient.from.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: { id: validId },
        error: null,
      }),
    })

    const formData = createMockFormData({
      content: '수정된 내용',
      keywords: JSON.stringify(['새키워드']),
    })

    const result = await updateAchievementStandard(validId, null, formData)

    expect(result.error).toBeUndefined()
    expect(result.data).toEqual({ success: true })
  })

  it('실패: admin 권한 부족', async () => {
    mockAuthAsAdmin()

    const formData = createMockFormData({
      content: '수정된 내용',
    })

    const result = await updateAchievementStandard(validId, null, formData)

    expect(result.error).toBe('권한이 없습니다.')
  })

  it('실패: ID 누락', async () => {
    const formData = createMockFormData({
      content: '수정된 내용',
    })

    const result = await updateAchievementStandard('', null, formData)

    expect(result.error).toBe('성취기준 ID가 필요합니다.')
  })

  it('실패: DB 에러', async () => {
    mockAuthAsSystemAdmin()
    mockSupabaseClient.from.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'DB Error' },
      }),
    })

    const formData = createMockFormData({
      content: '수정된 내용',
    })

    const result = await updateAchievementStandard(validId, null, formData)

    expect(result.error).toBe('처리 중 오류가 발생했습니다.')
  })
})

describe('deactivateAchievementStandard', () => {
  const validId = 'std-1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('성공: system_admin 비활성화', async () => {
    mockAuthAsSystemAdmin()
    mockSupabaseClient.from.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: { id: validId },
        error: null,
      }),
    })

    const result = await deactivateAchievementStandard(validId)

    expect(result.error).toBeUndefined()
    expect(result.data).toEqual({ success: true })
  })

  it('실패: admin 권한 부족', async () => {
    mockAuthAsAdmin()

    const result = await deactivateAchievementStandard(validId)

    expect(result.error).toBe('권한이 없습니다.')
  })

  it('실패: ID 누락', async () => {
    const result = await deactivateAchievementStandard('')

    expect(result.error).toBe('성취기준 ID가 필요합니다.')
  })
})

describe('getDistinctUnits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('성공: 전체 단원', async () => {
    mockAuthAsUser()

    const mockUnitData = [
      { unit: '자연수의 연산' },
      { unit: '분수' },
      { unit: '자연수의 연산' }, // 중복 — JS에서 제거 대상
    ]

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    }

    Object.defineProperty(mockQuery, 'then', {
      value: (resolve: (value: unknown) => void) => {
        resolve({ data: mockUnitData, error: null })
      },
      writable: true,
      configurable: true,
    })

    mockSupabaseClient.from.mockReturnValue(mockQuery)

    const result = await getDistinctUnits()

    expect(result.error).toBeUndefined()
    // 중복 제거 확인
    expect(result.data).toEqual(['자연수의 연산', '분수'])
  })

  it('성공: 학년별 필터', async () => {
    mockAuthAsUser()

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    }

    Object.defineProperty(mockQuery, 'then', {
      value: (resolve: (value: unknown) => void) => {
        resolve({ data: [{ unit: '도형' }], error: null })
      },
      writable: true,
      configurable: true,
    })

    mockSupabaseClient.from.mockReturnValue(mockQuery)

    const result = await getDistinctUnits('수학', 5)

    expect(result.error).toBeUndefined()
    expect(result.data).toEqual(['도형'])
    expect(mockQuery.eq).toHaveBeenCalledWith('is_active', true)
    expect(mockQuery.eq).toHaveBeenCalledWith('subject', '수학')
    expect(mockQuery.eq).toHaveBeenCalledWith('grade', 5)
  })

  it('실패: DB 에러', async () => {
    mockAuthAsUser()

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    }

    Object.defineProperty(mockQuery, 'then', {
      value: (resolve: (value: unknown) => void) => {
        resolve({ data: null, error: { message: 'DB error' } })
      },
      writable: true,
      configurable: true,
    })

    mockSupabaseClient.from.mockReturnValue(mockQuery)

    const result = await getDistinctUnits()

    expect(result.error).toBe('단원 목록 조회에 실패했습니다.')
  })
})

// ─── 추가 테스트 (코드 리뷰 SHOULD FIX) ─────────────────

describe('getAchievementStandards — isActive 필터', () => {
  it('성공: isActive=false 필터 — 비활성화된 항목만 조회', async () => {
    mockAuthAsUser()

    const mockQuery = createListQueryMock({
      data: [{ id: '1', code: '[9수01-01]', is_active: false }],
      error: null,
    })
    mockSupabaseClient.from.mockReturnValue(mockQuery)

    const result = await getAchievementStandards({ isActive: 'false' })

    expect(result.error).toBeUndefined()
    expect(mockQuery.eq).toHaveBeenCalledWith('is_active', false)
  })
})

describe('updateAchievementStandard — keywords JSON 파싱 에러', () => {
  it('실패: 잘못된 JSON 형식 → 에러 반환', async () => {
    mockAuthAsSystemAdmin()

    const formData = createMockFormData({
      content: '수정된 내용',
      keywords: '{invalid json}',
    })

    const result = await updateAchievementStandard(
      'test-id',
      null,
      formData
    )

    expect(result.error).toBe('키워드 형식이 잘못되었습니다.')
  })
})

describe('createAchievementStandard — keywords JSON 파싱 에러', () => {
  it('실패: 잘못된 JSON 형식 → 에러 반환', async () => {
    mockAuthAsSystemAdmin()

    const formData = createMockFormData({
      code: '[9수99-01]',
      content: '테스트 성취기준',
      subject: '수학',
      grade: '9',
      keywords: '{invalid json}',
    })

    const result = await createAchievementStandard(null, formData)

    expect(result.error).toBe('키워드 형식이 잘못되었습니다.')
  })
})
