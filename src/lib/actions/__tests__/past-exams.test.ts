/**
 * 기출문제 업로드 Server Action 테스트
 *
 * Supabase 클라이언트를 모킹하여 Server Action 로직만 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── 모킹 ───────────────────────────────────────────────

// Supabase 서버 클라이언트 모킹
const mockGetUser = vi.fn()
const mockSelectProfiles = vi.fn()
const mockInsertPastExamQuestions = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => mockSelectProfiles(),
            }),
          }),
        }
      }
      if (table === 'past_exam_questions') {
        return {
          insert: (data: unknown) => ({
            select: () => ({
              single: () => mockInsertPastExamQuestions(data),
            }),
          }),
        }
      }
      return {}
    },
  }),
}))

// Supabase admin 클라이언트 모킹
const mockStorageUpload = vi.fn()
const mockStorageRemove = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    storage: {
      from: () => ({
        upload: (path: string, file: File, options: unknown) =>
          mockStorageUpload(path, file, options),
        remove: (paths: string[]) => mockStorageRemove(paths),
      }),
    },
  }),
}))

// ─── 테스트 유틸 ────────────────────────────────────────

function createFormData(
  data: Record<string, string | File | number>
): FormData {
  const formData = new FormData()
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof File) {
      formData.set(key, value)
    } else {
      formData.set(key, String(value))
    }
  }
  return formData
}

function createMockFile(name: string, size: number, type: string): File {
  const buffer = new ArrayBuffer(size)
  return new File([buffer], name, { type })
}

// ─── 테스트 ─────────────────────────────────────────────

describe('uploadPastExamAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('비인증 사용자에게 에러를 반환한다', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
    })

    const { uploadPastExamAction } = await import('../past-exams')
    const file = createMockFile('exam.jpg', 1024 * 1024, 'image/jpeg')
    const formData = createFormData({
      file,
      schoolId: '550e8400-e29b-41d4-a716-446655440000',
      year: 2024,
      semester: 1,
      examType: 'midterm',
      grade: 10,
      subject: '수학',
    })

    const result = await uploadPastExamAction(null, formData)
    expect(result.error).toContain('로그인')
  })

  it('student 역할에게 권한 에러를 반환한다', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    })
    mockSelectProfiles.mockResolvedValue({
      data: {
        role: 'student',
        academy_id: 'academy-id',
      },
    })

    const { uploadPastExamAction } = await import('../past-exams')
    const file = createMockFile('exam.jpg', 1024 * 1024, 'image/jpeg')
    const formData = createFormData({
      file,
      schoolId: '550e8400-e29b-41d4-a716-446655440000',
      year: 2024,
      semester: 1,
      examType: 'midterm',
      grade: 10,
      subject: '수학',
    })

    const result = await uploadPastExamAction(null, formData)
    expect(result.error).toContain('권한')
  })

  it('파일이 없으면 에러를 반환한다', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    })
    mockSelectProfiles.mockResolvedValue({
      data: {
        role: 'teacher',
        academy_id: 'academy-id',
      },
    })

    const { uploadPastExamAction } = await import('../past-exams')
    const formData = createFormData({
      schoolId: '550e8400-e29b-41d4-a716-446655440000',
      year: 2024,
      semester: 1,
      examType: 'midterm',
      grade: 10,
      subject: '수학',
    })
    // file 필드 누락

    const result = await uploadPastExamAction(null, formData)
    expect(result.error).toContain('파일')
  })

  it('허용되지 않은 MIME 타입 파일을 거부한다', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    })
    mockSelectProfiles.mockResolvedValue({
      data: {
        role: 'teacher',
        academy_id: 'academy-id',
      },
    })

    const { uploadPastExamAction } = await import('../past-exams')
    const file = createMockFile('file.txt', 1024, 'text/plain')
    const formData = createFormData({
      file,
      schoolId: '550e8400-e29b-41d4-a716-446655440000',
      year: 2024,
      semester: 1,
      examType: 'midterm',
      grade: 10,
      subject: '수학',
    })

    const result = await uploadPastExamAction(null, formData)
    expect(result.error).toContain('허용된 파일 형식')
  })

  it('5MB 초과 파일을 거부한다', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    })
    mockSelectProfiles.mockResolvedValue({
      data: {
        role: 'teacher',
        academy_id: 'academy-id',
      },
    })

    const { uploadPastExamAction } = await import('../past-exams')
    const file = createMockFile(
      'large.jpg',
      6 * 1024 * 1024,
      'image/jpeg'
    )
    const formData = createFormData({
      file,
      schoolId: '550e8400-e29b-41d4-a716-446655440000',
      year: 2024,
      semester: 1,
      examType: 'midterm',
      grade: 10,
      subject: '수학',
    })

    const result = await uploadPastExamAction(null, formData)
    expect(result.error).toContain('5MB')
  })

  it('메타데이터 검증 실패 시 에러를 반환한다', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    })
    mockSelectProfiles.mockResolvedValue({
      data: {
        role: 'teacher',
        academy_id: 'academy-id',
      },
    })

    const { uploadPastExamAction } = await import('../past-exams')
    const file = createMockFile('exam.jpg', 1024 * 1024, 'image/jpeg')
    const formData = createFormData({
      file,
      schoolId: 'invalid-uuid', // 잘못된 UUID
      year: 2024,
      semester: 1,
      examType: 'midterm',
      grade: 10,
      subject: '수학',
    })

    const result = await uploadPastExamAction(null, formData)
    expect(result.error).toBeDefined()
  })

  it('Storage 업로드 실패 시 에러를 반환한다', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    })
    mockSelectProfiles.mockResolvedValue({
      data: {
        role: 'teacher',
        academy_id: 'academy-id',
      },
    })
    mockStorageUpload.mockResolvedValue({
      error: { message: 'Storage error' },
    })

    const { uploadPastExamAction } = await import('../past-exams')
    const file = createMockFile('exam.jpg', 1024 * 1024, 'image/jpeg')
    const formData = createFormData({
      file,
      schoolId: '550e8400-e29b-41d4-a716-446655440000',
      year: 2024,
      semester: 1,
      examType: 'midterm',
      grade: 10,
      subject: '수학',
    })

    const result = await uploadPastExamAction(null, formData)
    expect(result.error).toContain('업로드에 실패')
  })

  it('DB 저장 실패 시 Storage 파일을 정리하고 에러를 반환한다', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    })
    mockSelectProfiles.mockResolvedValue({
      data: {
        role: 'teacher',
        academy_id: 'academy-id',
      },
    })
    mockStorageUpload.mockResolvedValue({
      error: null,
      data: { path: 'academy-id/school-id/2024-1-midterm/file.jpg' },
    })
    mockInsertPastExamQuestions.mockResolvedValue({
      error: { message: 'DB error' },
      data: null,
    })
    mockStorageRemove.mockResolvedValue({ error: null })

    const { uploadPastExamAction } = await import('../past-exams')
    const file = createMockFile('exam.jpg', 1024 * 1024, 'image/jpeg')
    const formData = createFormData({
      file,
      schoolId: '550e8400-e29b-41d4-a716-446655440000',
      year: 2024,
      semester: 1,
      examType: 'midterm',
      grade: 10,
      subject: '수학',
    })

    const result = await uploadPastExamAction(null, formData)
    expect(result.error).toContain('저장에 실패')
    expect(mockStorageRemove).toHaveBeenCalled()
  })

  it('성공 시 업로드된 기출문제 ID를 반환한다', async () => {
    const mockQuestionId = '123e4567-e89b-12d3-a456-426614174000'
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    })
    mockSelectProfiles.mockResolvedValue({
      data: {
        role: 'teacher',
        academy_id: 'academy-id',
      },
    })
    mockStorageUpload.mockResolvedValue({
      error: null,
      data: { path: 'academy-id/school-id/2024-1-midterm/file.jpg' },
    })
    mockInsertPastExamQuestions.mockResolvedValue({
      error: null,
      data: { id: mockQuestionId },
    })

    const { uploadPastExamAction } = await import('../past-exams')
    const file = createMockFile('exam.jpg', 1024 * 1024, 'image/jpeg')
    const formData = createFormData({
      file,
      schoolId: '550e8400-e29b-41d4-a716-446655440000',
      year: 2024,
      semester: 1,
      examType: 'midterm',
      grade: 10,
      subject: '수학',
    })

    const result = await uploadPastExamAction(null, formData)
    expect(result.error).toBeUndefined()
    expect(result.data?.id).toBe(mockQuestionId)
  })
})
