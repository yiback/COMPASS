/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * academies.ts Server Actions 테스트
 *
 * 테스트 대상:
 * - getMyAcademy(): 현재 사용자의 학원 정보 조회 (6개 테스트)
 * - updateMyAcademy(): 학원 정보 수정 (7개 테스트)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMyAcademy, updateMyAcademy } from '../academies'

// Mock Setup
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

// Mock 헬퍼 함수
function mockAuthAsAdmin() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  } as any)

  const profileQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { role: 'admin', academy_id: 'academy-1' },
      error: null,
    }),
  }

  return profileQuery
}

function mockAuthAsTeacher() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  } as any)

  const profileQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { role: 'teacher', academy_id: 'academy-1' },
      error: null,
    }),
  }

  return profileQuery
}

function mockAuthAsStudent() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  } as any)

  const profileQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { role: 'student', academy_id: 'academy-1' },
      error: null,
    }),
  }

  return profileQuery
}

function mockAuthFailed() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'Not authenticated' },
  } as any)
}

function mockAcademyData() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: 'academy-1',
        name: '테스트 학원',
        address: '서울시 강남구',
        phone: '02-1234-5678',
        logo_url: 'https://example.com/logo.png',
        invite_code: 'ABC123',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      error: null,
    }),
  }
}

function createMockFormData(data: Record<string, string>): FormData {
  const formData = new FormData()
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value)
  }
  return formData
}

describe('getMyAcademy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('성공: admin이 자기 학원 조회', async () => {
    const profileQuery = mockAuthAsAdmin()
    const academyQuery = mockAcademyData()

    // from() 2번 호출: profiles → academies
    mockSupabaseClient.from.mockReturnValueOnce(profileQuery)
    mockSupabaseClient.from.mockReturnValueOnce(academyQuery)

    const result = await getMyAcademy()

    expect(result.error).toBeUndefined()
    expect(result.data).toEqual({
      id: 'academy-1',
      name: '테스트 학원',
      address: '서울시 강남구',
      phone: '02-1234-5678',
      logoUrl: 'https://example.com/logo.png',
      inviteCode: 'ABC123',
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      role: 'admin',
    })
  })

  it('성공: teacher가 자기 학원 조회', async () => {
    const profileQuery = mockAuthAsTeacher()
    const academyQuery = mockAcademyData()

    mockSupabaseClient.from.mockReturnValueOnce(profileQuery)
    mockSupabaseClient.from.mockReturnValueOnce(academyQuery)

    const result = await getMyAcademy()

    expect(result.error).toBeUndefined()
    expect(result.data).toBeDefined()
    expect(result.data?.role).toBe('teacher')
    expect(result.data?.name).toBe('테스트 학원')
  })

  it('실패: 인증 안 됨', async () => {
    mockAuthFailed()

    const result = await getMyAcademy()

    expect(result.error).toBe('인증이 필요합니다.')
    expect(result.data).toBeUndefined()
  })

  it('실패: 프로필 없음', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    } as any)

    const profileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'No profile found' },
      }),
    }

    mockSupabaseClient.from.mockReturnValueOnce(profileQuery)

    const result = await getMyAcademy()

    expect(result.error).toBe('프로필을 찾을 수 없습니다.')
    expect(result.data).toBeUndefined()
  })

  it('실패: academy_id null (system_admin)', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    } as any)

    const profileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { role: 'system_admin', academy_id: null },
        error: null,
      }),
    }

    mockSupabaseClient.from.mockReturnValueOnce(profileQuery)

    const result = await getMyAcademy()

    expect(result.error).toBe('소속 학원이 없습니다.')
    expect(result.data).toBeUndefined()
  })

  it('실패: DB 조회 에러', async () => {
    const profileQuery = mockAuthAsAdmin()

    const academyQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Academy not found' },
      }),
    }

    mockSupabaseClient.from.mockReturnValueOnce(profileQuery)
    mockSupabaseClient.from.mockReturnValueOnce(academyQuery)

    const result = await getMyAcademy()

    expect(result.error).toBe('학원 정보를 찾을 수 없습니다.')
    expect(result.data).toBeUndefined()
  })
})

describe('updateMyAcademy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('성공: admin이 학원 정보 수정', async () => {
    const profileQuery = mockAuthAsAdmin()

    const updateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'academy-1',
          name: '수정된 학원',
          address: '서울시 서초구',
          phone: '02-9999-8888',
          logo_url: 'https://example.com/new-logo.png',
          invite_code: 'ABC123',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
        error: null,
      }),
    }

    // checkAdminRole: profiles 조회
    mockSupabaseClient.from.mockReturnValueOnce(profileQuery)
    // updateMyAcademy: academies 업데이트
    mockSupabaseClient.from.mockReturnValueOnce(updateQuery)

    const formData = createMockFormData({
      name: '수정된 학원',
      address: '서울시 서초구',
      phone: '02-9999-8888',
      logoUrl: 'https://example.com/new-logo.png',
    })

    const result = await updateMyAcademy(null, formData)

    expect(result.error).toBeUndefined()
    expect(result.data).toBeDefined()
    expect(result.data?.name).toBe('수정된 학원')
    expect(result.data?.address).toBe('서울시 서초구')

    // revalidatePath 호출 확인
    const { revalidatePath } = await import('next/cache')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/academy')
  })

  it('성공: 선택 필드 빈값도 정상', async () => {
    const profileQuery = mockAuthAsAdmin()

    const updateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'academy-1',
          name: '테스트 학원',
          address: null,
          phone: null,
          logo_url: null,
          invite_code: 'ABC123',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
        error: null,
      }),
    }

    mockSupabaseClient.from.mockReturnValueOnce(profileQuery)
    mockSupabaseClient.from.mockReturnValueOnce(updateQuery)

    const formData = createMockFormData({
      name: '테스트 학원',
      address: '', // 빈값
      phone: '', // 빈값
      logoUrl: '', // 빈값
    })

    const result = await updateMyAcademy(null, formData)

    expect(result.error).toBeUndefined()
    expect(result.data).toBeDefined()
    expect(result.data?.address).toBeNull()
    expect(result.data?.phone).toBeNull()
    expect(result.data?.logoUrl).toBeNull()
  })

  it('실패: teacher 권한 에러', async () => {
    const profileQuery = mockAuthAsTeacher()

    mockSupabaseClient.from.mockReturnValueOnce(profileQuery)

    const formData = createMockFormData({
      name: '수정 시도',
    })

    const result = await updateMyAcademy(null, formData)

    expect(result.error).toBe('학원 관리자만 수정할 수 있습니다.')
    expect(result.data).toBeUndefined()
  })

  it('실패: student 권한 에러', async () => {
    const profileQuery = mockAuthAsStudent()

    mockSupabaseClient.from.mockReturnValueOnce(profileQuery)

    const formData = createMockFormData({
      name: '수정 시도',
    })

    const result = await updateMyAcademy(null, formData)

    expect(result.error).toBe('학원 관리자만 수정할 수 있습니다.')
    expect(result.data).toBeUndefined()
  })

  it('실패: 인증 안 됨', async () => {
    mockAuthFailed()

    const formData = createMockFormData({
      name: '수정 시도',
    })

    const result = await updateMyAcademy(null, formData)

    expect(result.error).toBe('인증이 필요합니다.')
    expect(result.data).toBeUndefined()
  })

  it('실패: Zod 검증 에러', async () => {
    const profileQuery = mockAuthAsAdmin()

    // checkAdminRole에서 profiles 조회
    mockSupabaseClient.from.mockReturnValueOnce(profileQuery)

    const formData = createMockFormData({
      name: '', // 빈값 - Zod 에러
    })

    const result = await updateMyAcademy(null, formData)

    expect(result.error).toBe('학원명을 입력해주세요.')
    expect(result.data).toBeUndefined()
  })

  it('실패: DB 업데이트 에러', async () => {
    const profileQuery = mockAuthAsAdmin()

    const updateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'DB update failed' },
      }),
    }

    mockSupabaseClient.from.mockReturnValueOnce(profileQuery)
    mockSupabaseClient.from.mockReturnValueOnce(updateQuery)

    const formData = createMockFormData({
      name: '수정된 학원',
      address: '서울시 서초구',
    })

    const result = await updateMyAcademy(null, formData)

    expect(result.error).toBe('학원 정보 수정에 실패했습니다.')
    expect(result.data).toBeUndefined()
  })
})
