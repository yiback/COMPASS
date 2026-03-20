/**
 * 시험 관리 Server Actions 테스트
 *
 * Supabase 클라이언트를 모킹하여 Server Action 로직만 테스트
 * 기존 past-exams.test.ts 패턴 참조
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── 모킹 ───────────────────────────────────────────────

const mockGetUser = vi.fn()
const mockSelectProfiles = vi.fn()
const mockSelectSchools = vi.fn()
const mockInsertPastExams = vi.fn()
const mockSelectPastExamImages = vi.fn()
const mockDeletePastExamImages = vi.fn()
const mockInsertPastExamImages = vi.fn()
const mockDeletePastExams = vi.fn()
const mockSelectPastExamDetails = vi.fn()
const mockUpdatePastExamDetails = vi.fn()
const mockDeletePastExamDetails = vi.fn()
const mockSelectPastExams = vi.fn()
const mockInsertPastExamDetails = vi.fn()

// Supabase 서버 클라이언트 모킹 — 체이닝 패턴
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
      if (table === 'schools') {
        return {
          select: () => ({
            eq: () => ({
              single: () => mockSelectSchools(),
            }),
          }),
        }
      }
      if (table === 'past_exams') {
        return {
          insert: (data: unknown) => ({
            select: () => ({
              single: () => mockInsertPastExams(data),
            }),
          }),
          delete: () => ({
            eq: () => mockDeletePastExams(),
          }),
          select: () => ({
            eq: () => ({
              single: () => mockSelectPastExams(),
            }),
          }),
        }
      }
      if (table === 'past_exam_images') {
        return {
          select: () => ({
            eq: () => mockSelectPastExamImages(),
          }),
          delete: () => ({
            eq: () => mockDeletePastExamImages(),
          }),
          insert: (data: unknown) => mockInsertPastExamImages(data),
        }
      }
      if (table === 'past_exam_details') {
        return {
          select: () => ({
            eq: () => ({
              single: () => mockSelectPastExamDetails(),
            }),
          }),
          update: (data: unknown) => {
            // updateExtractedQuestionAction: .update(data).eq('id', x) → { error }
            // confirmExtractedQuestionsAction: .update(data).eq('past_exam_id', x).eq('is_confirmed', false).select('id') → { data, error }
            const eqFn = () => {
              const result = mockUpdatePastExamDetails(data)
              return {
                ...result,
                // 두 번째 .eq() 체이닝 (confirm용)
                eq: () => ({
                  select: () => mockUpdatePastExamDetails(data),
                }),
                // .select() 체이닝 (confirm용)
                select: () => mockUpdatePastExamDetails(data),
              }
            }
            return { eq: eqFn }
          },
          delete: () => ({
            eq: () => mockDeletePastExamDetails(),
          }),
          insert: (data: unknown) => ({
            select: () => ({
              single: () => mockInsertPastExamDetails(data),
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
  fields: Record<string, string | number>,
  images?: File[]
): FormData {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, String(value))
  }
  if (images) {
    for (const img of images) {
      formData.append('images', img)
    }
  }
  return formData
}

function createMockFile(name: string, size: number, type: string): File {
  const buffer = new ArrayBuffer(size)
  return new File([buffer], name, { type })
}

/** 인증된 teacher 프로필 모킹 */
function mockAuthenticatedTeacher() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'user-id' } },
    error: null,
  })
  mockSelectProfiles.mockResolvedValue({
    data: {
      id: 'user-id',
      role: 'teacher',
      academy_id: 'academy-id',
    },
    error: null,
  })
}

// ─── createPastExamAction ───────────────────────────────

describe('createPastExamAction', () => {
  const validFields = {
    schoolId: 'school-001',
    year: 2024,
    semester: 1,
    examType: 'midterm',
    grade: 10,
    subject: '수학',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // 기본: 학교 고등학교 (grade 10 호환)
    mockSelectSchools.mockResolvedValue({
      data: { school_type: 'high' },
      error: null,
    })
    // 기본: 기존 이미지 없음
    mockSelectPastExamImages.mockResolvedValue({
      data: [],
      error: null,
    })
  })

  it('비인증 사용자에게 에러를 반환한다', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const { createPastExamAction } = await import('../exam-management')
    const formData = createFormData(validFields, [
      createMockFile('img.jpg', 1024, 'image/jpeg'),
    ])

    const result = await createPastExamAction(formData)
    expect(result.error).toContain('로그인')
  })

  it('student 역할에게 권한 에러를 반환한다', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
      error: null,
    })
    mockSelectProfiles.mockResolvedValue({
      data: {
        id: 'user-id',
        role: 'student',
        academy_id: 'academy-id',
      },
      error: null,
    })

    const { createPastExamAction } = await import('../exam-management')
    const formData = createFormData(validFields, [
      createMockFile('img.jpg', 1024, 'image/jpeg'),
    ])

    const result = await createPastExamAction(formData)
    expect(result.error).toContain('권한')
  })

  it('teacher 역할 + 유효 데이터 → 성공', async () => {
    mockAuthenticatedTeacher()
    const pastExamId = 'exam-id-123'
    mockInsertPastExams.mockResolvedValue({
      data: { id: pastExamId },
      error: null,
    })
    mockStorageUpload.mockResolvedValue({ error: null })
    mockInsertPastExamImages.mockResolvedValue({ error: null })

    const { createPastExamAction } = await import('../exam-management')
    const formData = createFormData(validFields, [
      createMockFile('img.jpg', 1024, 'image/jpeg'),
    ])

    const result = await createPastExamAction(formData)
    expect(result.error).toBeUndefined()
    expect(result.data?.pastExamId).toBe(pastExamId)
  })

  it('admin 역할 → 성공', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
      error: null,
    })
    mockSelectProfiles.mockResolvedValue({
      data: {
        id: 'user-id',
        role: 'admin',
        academy_id: 'academy-id',
      },
      error: null,
    })
    mockInsertPastExams.mockResolvedValue({
      data: { id: 'exam-id' },
      error: null,
    })
    mockStorageUpload.mockResolvedValue({ error: null })
    mockInsertPastExamImages.mockResolvedValue({ error: null })

    const { createPastExamAction } = await import('../exam-management')
    const formData = createFormData(validFields, [
      createMockFile('img.jpg', 1024, 'image/jpeg'),
    ])

    const result = await createPastExamAction(formData)
    expect(result.error).toBeUndefined()
  })

  it('메타데이터 Zod 검증 실패 → 에러', async () => {
    mockAuthenticatedTeacher()

    const { createPastExamAction } = await import('../exam-management')
    const formData = createFormData(
      { ...validFields, schoolId: '' },
      [createMockFile('img.jpg', 1024, 'image/jpeg')]
    )

    const result = await createPastExamAction(formData)
    expect(result.error).toBeDefined()
  })

  it('이미지 0장 → 에러', async () => {
    mockAuthenticatedTeacher()

    const { createPastExamAction } = await import('../exam-management')
    const formData = createFormData(validFields) // 이미지 없음

    const result = await createPastExamAction(formData)
    expect(result.error).toContain('1장 이상')
  })

  it('이미지 21장 → 에러 (수량 초과)', async () => {
    mockAuthenticatedTeacher()

    const { createPastExamAction } = await import('../exam-management')
    const images = Array.from({ length: 21 }, (_, i) =>
      createMockFile(`img${i}.jpg`, 1024, 'image/jpeg')
    )
    const formData = createFormData(validFields, images)

    const result = await createPastExamAction(formData)
    expect(result.error).toContain('20장')
  })

  it('개별 6MB 이미지 → 에러 (용량 초과)', async () => {
    mockAuthenticatedTeacher()

    const { createPastExamAction } = await import('../exam-management')
    const formData = createFormData(validFields, [
      createMockFile('large.jpg', 6 * 1024 * 1024, 'image/jpeg'),
    ])

    const result = await createPastExamAction(formData)
    expect(result.error).toContain('5MB')
  })

  it('school_type ↔ grade 불일치 → 에러', async () => {
    mockAuthenticatedTeacher()
    // 초등학교인데 grade 10 → 불일치
    mockSelectSchools.mockResolvedValue({
      data: { school_type: 'elementary' },
      error: null,
    })

    const { createPastExamAction } = await import('../exam-management')
    const formData = createFormData(validFields, [
      createMockFile('img.jpg', 1024, 'image/jpeg'),
    ])

    const result = await createPastExamAction(formData)
    expect(result.error).toContain('학교 유형')
  })

  it('past_exams INSERT 실패 → 에러', async () => {
    mockAuthenticatedTeacher()
    mockInsertPastExams.mockResolvedValue({
      data: null,
      error: { message: 'DB error' },
    })

    const { createPastExamAction } = await import('../exam-management')
    const formData = createFormData(validFields, [
      createMockFile('img.jpg', 1024, 'image/jpeg'),
    ])

    const result = await createPastExamAction(formData)
    expect(result.error).toContain('시험 생성에 실패')
  })

  it('Storage 업로드 실패 → 에러 + cleanup', async () => {
    mockAuthenticatedTeacher()
    mockInsertPastExams.mockResolvedValue({
      data: { id: 'exam-id' },
      error: null,
    })
    mockStorageUpload.mockResolvedValue({
      error: { message: 'Storage error' },
    })
    mockDeletePastExams.mockResolvedValue({ error: null })

    const { createPastExamAction } = await import('../exam-management')
    const formData = createFormData(validFields, [
      createMockFile('img.jpg', 1024, 'image/jpeg'),
    ])

    const result = await createPastExamAction(formData)
    expect(result.error).toContain('업로드에 실패')
  })

  it('past_exam_images INSERT 실패 → 에러', async () => {
    mockAuthenticatedTeacher()
    mockInsertPastExams.mockResolvedValue({
      data: { id: 'exam-id' },
      error: null,
    })
    mockStorageUpload.mockResolvedValue({ error: null })
    mockInsertPastExamImages.mockResolvedValue({
      error: { message: 'DB error' },
    })

    const { createPastExamAction } = await import('../exam-management')
    const formData = createFormData(validFields, [
      createMockFile('img.jpg', 1024, 'image/jpeg'),
    ])

    const result = await createPastExamAction(formData)
    expect(result.error).toContain('이미지 정보 저장')
  })

  it('Storage 경로 형식이 올바르다', async () => {
    mockAuthenticatedTeacher()
    mockInsertPastExams.mockResolvedValue({
      data: { id: 'exam-id-123' },
      error: null,
    })
    mockStorageUpload.mockResolvedValue({ error: null })
    mockInsertPastExamImages.mockResolvedValue({ error: null })

    const { createPastExamAction } = await import('../exam-management')
    const formData = createFormData(validFields, [
      createMockFile('photo.jpg', 1024, 'image/jpeg'),
    ])

    await createPastExamAction(formData)

    // Storage 경로: {academyId}/{pastExamId}/{pageNumber}-{fileId}.{ext}
    const uploadPath = mockStorageUpload.mock.calls[0]?.[0] as string
    expect(uploadPath).toMatch(
      /^academy-id\/exam-id-123\/1-[a-f0-9-]+\.jpg$/
    )
  })
})

// ─── updateExtractedQuestionAction ──────────────────────

describe('updateExtractedQuestionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('비인증 사용자에게 에러를 반환한다', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const { updateExtractedQuestionAction } = await import(
      '../exam-management'
    )
    const result = await updateExtractedQuestionAction('detail-id', {
      questionText: '문제',
      questionType: 'essay',
    })
    expect(result.error).toContain('로그인')
  })

  it('존재하지 않는 detailId → 에러', async () => {
    mockAuthenticatedTeacher()
    mockSelectPastExamDetails.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    })

    const { updateExtractedQuestionAction } = await import(
      '../exam-management'
    )
    const result = await updateExtractedQuestionAction('nonexistent', {
      questionText: '문제',
      questionType: 'essay',
    })
    expect(result.error).toContain('찾을 수 없습니다')
  })

  it('Zod 검증 실패 → 에러', async () => {
    mockAuthenticatedTeacher()

    const { updateExtractedQuestionAction } = await import(
      '../exam-management'
    )
    const result = await updateExtractedQuestionAction('detail-id', {
      questionText: '', // 빈 문자열
      questionType: 'essay',
    })
    expect(result.error).toBeDefined()
  })

  it('유효 입력 → UPDATE 성공 + id 반환', async () => {
    mockAuthenticatedTeacher()
    mockSelectPastExamDetails.mockResolvedValue({
      data: { id: 'detail-id' },
      error: null,
    })
    mockUpdatePastExamDetails.mockResolvedValue({ error: null })

    const { updateExtractedQuestionAction } = await import(
      '../exam-management'
    )
    const result = await updateExtractedQuestionAction('detail-id', {
      questionText: '수정된 문제',
      questionType: 'multiple_choice',
      options: ['A', 'B', 'C'],
      answer: 'A',
    })
    expect(result.error).toBeUndefined()
    expect(result.data?.id).toBe('detail-id')
  })

  it('객관식 → options 포함 UPDATE', async () => {
    mockAuthenticatedTeacher()
    mockSelectPastExamDetails.mockResolvedValue({
      data: { id: 'detail-id' },
      error: null,
    })
    mockUpdatePastExamDetails.mockResolvedValue({ error: null })

    const { updateExtractedQuestionAction } = await import(
      '../exam-management'
    )
    await updateExtractedQuestionAction('detail-id', {
      questionText: '문제',
      questionType: 'multiple_choice',
      options: ['A', 'B', 'C', 'D'],
    })

    const updateData = mockUpdatePastExamDetails.mock.calls[0]?.[0]
    expect(updateData.options).toEqual(['A', 'B', 'C', 'D'])
  })

  it('서술형 → options null UPDATE', async () => {
    mockAuthenticatedTeacher()
    mockSelectPastExamDetails.mockResolvedValue({
      data: { id: 'detail-id' },
      error: null,
    })
    mockUpdatePastExamDetails.mockResolvedValue({ error: null })

    const { updateExtractedQuestionAction } = await import(
      '../exam-management'
    )
    await updateExtractedQuestionAction('detail-id', {
      questionText: '서술하시오.',
      questionType: 'essay',
    })

    const updateData = mockUpdatePastExamDetails.mock.calls[0]?.[0]
    expect(updateData.options).toBeNull()
  })
})

// ─── deleteExtractedQuestionAction ──────────────────────

describe('deleteExtractedQuestionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('비인증 사용자에게 에러를 반환한다', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const { deleteExtractedQuestionAction } = await import(
      '../exam-management'
    )
    const result = await deleteExtractedQuestionAction('detail-id')
    expect(result.error).toContain('로그인')
  })

  it('존재하지 않는 detailId → 에러', async () => {
    mockAuthenticatedTeacher()
    mockSelectPastExamDetails.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    })

    const { deleteExtractedQuestionAction } = await import(
      '../exam-management'
    )
    const result = await deleteExtractedQuestionAction('nonexistent')
    expect(result.error).toContain('찾을 수 없습니다')
  })

  it('유효 입력 → DELETE 성공', async () => {
    mockAuthenticatedTeacher()
    mockSelectPastExamDetails.mockResolvedValue({
      data: { id: 'detail-id' },
      error: null,
    })
    mockDeletePastExamDetails.mockResolvedValue({ error: null })

    const { deleteExtractedQuestionAction } = await import(
      '../exam-management'
    )
    const result = await deleteExtractedQuestionAction('detail-id')
    expect(result.error).toBeUndefined()
  })

  it('DB 삭제 에러 → 에러 반환', async () => {
    mockAuthenticatedTeacher()
    mockSelectPastExamDetails.mockResolvedValue({
      data: { id: 'detail-id' },
      error: null,
    })
    mockDeletePastExamDetails.mockResolvedValue({
      error: { message: 'Delete failed' },
    })

    const { deleteExtractedQuestionAction } = await import(
      '../exam-management'
    )
    const result = await deleteExtractedQuestionAction('detail-id')
    expect(result.error).toContain('삭제에 실패')
  })
})

// ─── confirmExtractedQuestionsAction ────────────────────

describe('confirmExtractedQuestionsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('비인증 사용자에게 에러를 반환한다', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const { confirmExtractedQuestionsAction } = await import(
      '../exam-management'
    )
    const result = await confirmExtractedQuestionsAction('exam-id')
    expect(result.error).toContain('로그인')
  })

  it('존재하지 않는 pastExamId → 에러', async () => {
    mockAuthenticatedTeacher()
    mockSelectPastExams.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    })

    const { confirmExtractedQuestionsAction } = await import(
      '../exam-management'
    )
    const result = await confirmExtractedQuestionsAction('nonexistent')
    expect(result.error).toContain('시험을 찾을 수 없습니다')
  })

  it('extraction_status !== completed → 에러', async () => {
    mockAuthenticatedTeacher()
    mockSelectPastExams.mockResolvedValue({
      data: { id: 'exam-id', extraction_status: 'pending' },
      error: null,
    })

    const { confirmExtractedQuestionsAction } = await import(
      '../exam-management'
    )
    const result = await confirmExtractedQuestionsAction('exam-id')
    expect(result.error).toContain('추출이 완료된')
  })

  it('유효 입력 → confirmedCount 반환', async () => {
    mockAuthenticatedTeacher()
    mockSelectPastExams.mockResolvedValue({
      data: { id: 'exam-id', extraction_status: 'completed' },
      error: null,
    })
    mockUpdatePastExamDetails.mockResolvedValue({
      data: [{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }],
      error: null,
    })

    const { confirmExtractedQuestionsAction } = await import(
      '../exam-management'
    )
    const result = await confirmExtractedQuestionsAction('exam-id')
    expect(result.error).toBeUndefined()
    expect(result.data?.confirmedCount).toBe(3)
  })

  it('이미 모두 confirmed → confirmedCount === 0', async () => {
    mockAuthenticatedTeacher()
    mockSelectPastExams.mockResolvedValue({
      data: { id: 'exam-id', extraction_status: 'completed' },
      error: null,
    })
    mockUpdatePastExamDetails.mockResolvedValue({
      data: [],
      error: null,
    })

    const { confirmExtractedQuestionsAction } = await import(
      '../exam-management'
    )
    const result = await confirmExtractedQuestionsAction('exam-id')
    expect(result.data?.confirmedCount).toBe(0)
  })
})

// ─── createExtractedQuestionAction ──────────────────────

describe('createExtractedQuestionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('비인증 사용자에게 에러를 반환한다', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const { createExtractedQuestionAction } = await import(
      '../exam-management'
    )
    const result = await createExtractedQuestionAction('exam-id', {
      questionNumber: 1,
      questionText: '문제',
      questionType: 'essay',
    })
    expect(result.error).toContain('로그인')
  })

  it('유효 입력 → INSERT 성공 + id 반환', async () => {
    mockAuthenticatedTeacher()
    mockSelectPastExams.mockResolvedValue({
      data: { id: 'exam-id' },
      error: null,
    })
    mockInsertPastExamDetails.mockResolvedValue({
      data: { id: 'new-detail-id' },
      error: null,
    })

    const { createExtractedQuestionAction } = await import(
      '../exam-management'
    )
    const result = await createExtractedQuestionAction('exam-id', {
      questionNumber: 1,
      questionText: '수동 추가 문제',
      questionType: 'short_answer',
    })
    expect(result.error).toBeUndefined()
    expect(result.data?.id).toBe('new-detail-id')
  })

  it('존재하지 않는 pastExamId → 에러', async () => {
    mockAuthenticatedTeacher()
    mockSelectPastExams.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    })

    const { createExtractedQuestionAction } = await import(
      '../exam-management'
    )
    const result = await createExtractedQuestionAction('nonexistent', {
      questionNumber: 1,
      questionText: '문제',
      questionType: 'essay',
    })
    expect(result.error).toContain('시험을 찾을 수 없습니다')
  })

  it('Zod 검증 실패 (빈 questionText) → 에러', async () => {
    mockAuthenticatedTeacher()

    const { createExtractedQuestionAction } = await import(
      '../exam-management'
    )
    const result = await createExtractedQuestionAction('exam-id', {
      questionNumber: 1,
      questionText: '',
      questionType: 'essay',
    })
    expect(result.error).toBeDefined()
  })
})
