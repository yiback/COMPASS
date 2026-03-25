/**
 * extractQuestionsAction + resetExtractionAction 테스트
 *
 * Supabase 클라이언트 + AI Provider + sharp를 모킹하여 로직 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── 인증 헬퍼 모킹 ────────────────────────────────────────
const mockGetCurrentUser = vi.fn()

vi.mock('../helpers', () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}))

// ─── 모킹 ───────────────────────────────────────────────

const mockUpdatePastExams = vi.fn()
const mockDeletePastExamDetails = vi.fn()
const mockSelectPastExamImages = vi.fn()
const mockCreateSignedUrl = vi.fn()
const mockInsertPastExamDetails = vi.fn()
const mockSelectPastExamDetailsFigures = vi.fn()
const mockUpdatePastExamsCompleted = vi.fn()

// Supabase 서버 클라이언트 모킹 — 체이닝 패턴
// academy_id 필터 추가로 .eq() 체이닝 지원 필요
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (table: string) => {
      if (table === 'past_exams') {
        return {
          update: (data: unknown) => ({
            // .update(data).eq('id', pastExamId)
            eq: () => ({
              // .eq('id', ...).eq('academy_id', ...)
              eq: () => {
                // 호출 데이터 기록 (completed/failed/pending 검증용)
                mockUpdatePastExamsCompleted(data)
                return {
                  // Optimistic Lock: .eq('academy_id').in().select()
                  in: () => ({
                    select: () => mockUpdatePastExams(data),
                  }),
                }
              },
            }),
          }),
        }
      }
      if (table === 'past_exam_details') {
        return {
          delete: () => ({
            eq: () => ({
              eq: () => mockDeletePastExamDetails(),
            }),
          }),
          insert: (data: unknown) => mockInsertPastExamDetails(data),
          select: () => ({
            eq: () => ({
              eq: () => mockSelectPastExamDetailsFigures(),
              single: () => mockSelectPastExamDetailsFigures(),
            }),
          }),
          update: (data: unknown) => ({
            eq: () => ({
              eq: () => mockInsertPastExamDetails(data),
            }),
          }),
        }
      }
      if (table === 'past_exam_images') {
        return {
          select: () => ({
            eq: () => ({
              order: () => mockSelectPastExamImages(),
            }),
          }),
        }
      }
      return {}
    },
    storage: {
      from: () => ({
        createSignedUrl: (path: string, expiry: number) =>
          mockCreateSignedUrl(path, expiry),
      }),
    },
  }),
}))

// Supabase admin 클라이언트 모킹
const mockAdminStorageUpload = vi.fn()
const mockAdminStorageRemove = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    storage: {
      from: () => ({
        upload: (path: string, data: unknown, options: unknown) =>
          mockAdminStorageUpload(path, data, options),
        remove: (paths: string[]) => mockAdminStorageRemove(paths),
      }),
    },
  }),
}))

// AI Provider 모킹
const mockExtractQuestions = vi.fn()

vi.mock('@/lib/ai/provider', () => ({
  createAIProvider: vi.fn().mockReturnValue({
    extractQuestions: (params: unknown) => mockExtractQuestions(params),
  }),
}))

// sharp 모킹
const mockMetadata = vi.fn()
const mockExtract = vi.fn()
const mockJpeg = vi.fn()
const mockToBuffer = vi.fn()

vi.mock('sharp', () => ({
  default: vi.fn().mockImplementation(() => ({
    metadata: () => mockMetadata(),
    extract: (opts: unknown) => {
      mockExtract(opts)
      return {
        jpeg: (opts2: unknown) => {
          mockJpeg(opts2)
          return {
            toBuffer: () => mockToBuffer(),
          }
        },
      }
    },
  })),
}))

// fetch 모킹
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ─── 테스트 유틸 ────────────────────────────────────────

/** 인증된 teacher 프로필 모킹 */
function mockAuthenticatedTeacher() {
  mockGetCurrentUser.mockResolvedValue({
    profile: { id: 'user-id', role: 'teacher', academyId: 'academy-id' },
  })
}

/** 기본 AI 추출 결과 */
function createMockAiResult() {
  return {
    questions: [
      {
        questionNumber: 1,
        questionText: '다음 중 올바른 것은?',
        questionType: 'multiple_choice' as const,
        options: ['A', 'B', 'C', 'D'],
        answer: 'A',
        confidence: 0.95,
        hasFigure: false,
        figures: undefined,
      },
    ],
    totalQuestions: 1,
    overallConfidence: 0.95,
  }
}

/** fetch 응답 모킹 */
function mockFetchResponse() {
  mockFetch.mockResolvedValue({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    headers: {
      get: () => 'image/jpeg',
    },
  })
}

// ─── extractQuestionsAction ───────────────────────────────

describe('extractQuestionsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 기본 성공 모킹 설정
    mockDeletePastExamDetails.mockResolvedValue({ error: null })
    mockInsertPastExamDetails.mockResolvedValue({ error: null })
    mockUpdatePastExamsCompleted.mockReturnValue({})
  })

  it('비인증 사용자에게 에러를 반환한다', async () => {
    mockGetCurrentUser.mockResolvedValue({
      error: '인증이 필요합니다.',
    })

    const { extractQuestionsAction } = await import('../extract-questions')
    const result = await extractQuestionsAction('exam-id')
    expect(result.error).toContain('인증')
  })

  it('student 역할에게 권한 에러를 반환한다', async () => {
    mockGetCurrentUser.mockResolvedValue({
      profile: { id: 'user-id', role: 'student', academyId: 'academy-id' },
    })

    const { extractQuestionsAction } = await import('../extract-questions')
    const result = await extractQuestionsAction('exam-id')
    expect(result.error).toContain('권한')
  })

  it('academyId null → 에러', async () => {
    mockGetCurrentUser.mockResolvedValue({
      profile: { id: 'user-id', role: 'teacher', academyId: null },
    })

    const { extractQuestionsAction } = await import('../extract-questions')
    const result = await extractQuestionsAction('exam-id')
    expect(result.error).toContain('학원')
  })

  it('유효한 pastExamId → 추출 성공 + details INSERT + status completed', async () => {
    mockAuthenticatedTeacher()
    mockUpdatePastExams.mockResolvedValue({
      data: [
        {
          id: 'exam-id',
          subject: '수학',
          grade: 10,
          exam_type: 'midterm',
          academy_id: 'academy-id',
        },
      ],
      error: null,
    })
    mockSelectPastExamImages.mockResolvedValue({
      data: [
        {
          id: 'img-1',
          source_image_url: 'academy-id/exam-id/1-abc.jpg',
          page_number: 1,
        },
      ],
      error: null,
    })
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed' },
    })
    mockFetchResponse()
    mockExtractQuestions.mockResolvedValue(createMockAiResult())

    const { extractQuestionsAction } = await import('../extract-questions')
    const result = await extractQuestionsAction('exam-id')

    expect(result.error).toBeUndefined()
    expect(mockInsertPastExamDetails).toHaveBeenCalled()
  })

  it('Optimistic Lock — 이미 processing 상태 → 에러 반환', async () => {
    mockAuthenticatedTeacher()
    // .select() 빈 배열 반환 → 이미 처리 중
    mockUpdatePastExams.mockResolvedValue({
      data: [],
      error: null,
    })

    const { extractQuestionsAction } = await import('../extract-questions')
    const result = await extractQuestionsAction('exam-id')
    expect(result.error).toContain('이미 처리 중')
  })

  it('Optimistic Lock — null 반환 → 조기 반환', async () => {
    mockAuthenticatedTeacher()
    mockUpdatePastExams.mockResolvedValue({
      data: null,
      error: null,
    })

    const { extractQuestionsAction } = await import('../extract-questions')
    const result = await extractQuestionsAction('exam-id')
    expect(result.error).toContain('이미 처리 중')
  })

  it('기존 details 존재 시 DELETE 후 재삽입 확인', async () => {
    mockAuthenticatedTeacher()
    mockUpdatePastExams.mockResolvedValue({
      data: [
        {
          id: 'exam-id',
          subject: '수학',
          grade: 10,
          exam_type: 'midterm',
          academy_id: 'academy-id',
        },
      ],
      error: null,
    })
    mockSelectPastExamImages.mockResolvedValue({
      data: [
        {
          id: 'img-1',
          source_image_url: 'path/img.jpg',
          page_number: 1,
        },
      ],
      error: null,
    })
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed' },
    })
    mockFetchResponse()
    mockExtractQuestions.mockResolvedValue(createMockAiResult())

    const { extractQuestionsAction } = await import('../extract-questions')
    await extractQuestionsAction('exam-id')

    // DELETE가 INSERT 전에 호출되었는지 확인
    expect(mockDeletePastExamDetails).toHaveBeenCalled()
    expect(mockInsertPastExamDetails).toHaveBeenCalled()
  })

  it('AI 호출 실패 → finally에서 extraction_status = failed 롤백', async () => {
    mockAuthenticatedTeacher()
    mockUpdatePastExams.mockResolvedValue({
      data: [
        {
          id: 'exam-id',
          subject: '수학',
          grade: 10,
          exam_type: 'midterm',
          academy_id: 'academy-id',
        },
      ],
      error: null,
    })
    mockSelectPastExamImages.mockResolvedValue({
      data: [
        {
          id: 'img-1',
          source_image_url: 'path/img.jpg',
          page_number: 1,
        },
      ],
      error: null,
    })
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed' },
    })
    mockFetchResponse()
    mockExtractQuestions.mockRejectedValue(new Error('AI API 오류'))

    const { extractQuestionsAction } = await import('../extract-questions')
    // AI 오류 시 catch에서 { error } 반환 (throw 대신)
    const result = await extractQuestionsAction('exam-id')
    expect(result).toEqual({ error: 'AI API 오류' })

    // finally에서 'failed' 업데이트가 호출되었는지 확인
    expect(mockUpdatePastExamsCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ extraction_status: 'failed' }),
    )
  })

  it('figure 포함 문제 — crop 미수행, figure.url = null로 INSERT', async () => {
    mockAuthenticatedTeacher()
    mockUpdatePastExams.mockResolvedValue({
      data: [
        {
          id: 'exam-id',
          subject: '수학',
          grade: 10,
          exam_type: 'midterm',
          academy_id: 'academy-id',
        },
      ],
      error: null,
    })
    mockSelectPastExamImages.mockResolvedValue({
      data: [
        {
          id: 'img-1',
          source_image_url: 'path/img.jpg',
          page_number: 1,
        },
      ],
      error: null,
    })
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed' },
    })
    mockFetchResponse()

    // AI 결과에 figure 포함
    const aiResultWithFigure = {
      questions: [
        {
          questionNumber: 1,
          questionText: '그래프를 분석하시오.',
          questionType: 'essay' as const,
          confidence: 0.9,
          hasFigure: true,
          figures: [
            {
              url: null,
              description: '그래프',
              boundingBox: { x: 0.1, y: 0.2, width: 0.5, height: 0.3 },
              pageNumber: 1,
              confidence: 0.85,
            },
          ],
        },
      ],
      totalQuestions: 1,
      overallConfidence: 0.9,
    }
    mockExtractQuestions.mockResolvedValue(aiResultWithFigure)

    const { extractQuestionsAction } = await import('../extract-questions')
    await extractQuestionsAction('exam-id')

    // crop 제거됨 — Storage 업로드 미호출
    expect(mockAdminStorageUpload).not.toHaveBeenCalled()

    // INSERT된 details에 figures[0].url = null (메타데이터만 저장)
    const insertedData = mockInsertPastExamDetails.mock.calls[0]?.[0]
    expect(insertedData[0].figures[0].url).toBeNull()
    expect(insertedData[0].figures[0].description).toBe('그래프')
  })

  it('crop 부분 실패 — figure.url = null + 나머지 INSERT 정상', async () => {
    mockAuthenticatedTeacher()
    mockUpdatePastExams.mockResolvedValue({
      data: [
        {
          id: 'exam-id',
          subject: '수학',
          grade: 10,
          exam_type: 'midterm',
          academy_id: 'academy-id',
        },
      ],
      error: null,
    })
    mockSelectPastExamImages.mockResolvedValue({
      data: [
        {
          id: 'img-1',
          source_image_url: 'path/img.jpg',
          page_number: 1,
        },
      ],
      error: null,
    })
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed' },
    })
    mockFetchResponse()

    const aiResultWithFigure = {
      questions: [
        {
          questionNumber: 1,
          questionText: '그래프를 분석하시오.',
          questionType: 'essay' as const,
          confidence: 0.9,
          hasFigure: true,
          figures: [
            {
              url: null,
              description: '그래프',
              boundingBox: { x: 0.1, y: 0.2, width: 0.5, height: 0.3 },
              pageNumber: 1,
              confidence: 0.85,
            },
          ],
        },
      ],
      totalQuestions: 1,
      overallConfidence: 0.9,
    }
    mockExtractQuestions.mockResolvedValue(aiResultWithFigure)

    // sharp metadata 실패 → crop 실패
    mockMetadata.mockRejectedValue(new Error('Sharp error'))

    const { extractQuestionsAction } = await import('../extract-questions')
    await extractQuestionsAction('exam-id')

    // INSERT는 정상 수행 + figures[0].url = null
    expect(mockInsertPastExamDetails).toHaveBeenCalled()
    const insertedData = mockInsertPastExamDetails.mock.calls[0]?.[0]
    expect(insertedData[0].figures[0].url).toBeNull()
  })

  it('raw_ai_response에 AI 원본 응답이 백업된다', async () => {
    mockAuthenticatedTeacher()
    const aiResult = createMockAiResult()
    mockUpdatePastExams.mockResolvedValue({
      data: [
        {
          id: 'exam-id',
          subject: '수학',
          grade: 10,
          exam_type: 'midterm',
          academy_id: 'academy-id',
        },
      ],
      error: null,
    })
    mockSelectPastExamImages.mockResolvedValue({
      data: [
        {
          id: 'img-1',
          source_image_url: 'path/img.jpg',
          page_number: 1,
        },
      ],
      error: null,
    })
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed' },
    })
    mockFetchResponse()
    mockExtractQuestions.mockResolvedValue(aiResult)

    const { extractQuestionsAction } = await import('../extract-questions')
    await extractQuestionsAction('exam-id')

    // raw_ai_response 포함 completed 업데이트 확인
    expect(mockUpdatePastExamsCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        extraction_status: 'completed',
        raw_ai_response: expect.any(String),
      }),
    )
  })
})

// ─── resetExtractionAction ────────────────────────────────

describe('resetExtractionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeletePastExamDetails.mockResolvedValue({ error: null })
    mockUpdatePastExamsCompleted.mockReturnValue({})
  })

  it('비인증 사용자에게 에러를 반환한다', async () => {
    mockGetCurrentUser.mockResolvedValue({
      error: '인증이 필요합니다.',
    })

    const { resetExtractionAction } = await import('../extract-questions')
    const result = await resetExtractionAction('exam-id')
    expect(result.error).toContain('인증')
  })

  it('details DELETE + status pending 전이', async () => {
    mockAuthenticatedTeacher()
    mockSelectPastExamDetailsFigures.mockResolvedValue({
      data: [],
      error: null,
    })

    const { resetExtractionAction } = await import('../extract-questions')
    const result = await resetExtractionAction('exam-id')

    expect(result.error).toBeUndefined()
    expect(mockDeletePastExamDetails).toHaveBeenCalled()
    // status = 'pending' 업데이트 확인
    expect(mockUpdatePastExamsCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ extraction_status: 'pending' }),
    )
  })

  it('Storage orphan cleanup 호출 확인', async () => {
    mockAuthenticatedTeacher()
    mockSelectPastExamDetailsFigures.mockResolvedValue({
      data: [
        {
          figures: [
            { url: 'academy-id/exam-id/figures/detail-1-0.jpg' },
            { url: 'academy-id/exam-id/figures/detail-1-1.jpg' },
          ],
        },
      ],
      error: null,
    })

    const { resetExtractionAction } = await import('../extract-questions')
    await resetExtractionAction('exam-id')

    expect(mockAdminStorageRemove).toHaveBeenCalledWith([
      'academy-id/exam-id/figures/detail-1-0.jpg',
      'academy-id/exam-id/figures/detail-1-1.jpg',
    ])
  })

  it('Storage 삭제 실패 시 Non-blocking 동작 확인', async () => {
    mockAuthenticatedTeacher()
    mockSelectPastExamDetailsFigures.mockResolvedValue({
      data: [
        {
          figures: [{ url: 'some-path.jpg' }],
        },
      ],
      error: null,
    })
    // Storage 삭제 실패
    mockAdminStorageRemove.mockRejectedValue(new Error('Storage error'))

    const { resetExtractionAction } = await import('../extract-questions')
    const result = await resetExtractionAction('exam-id')

    // 에러 없이 정상 완료
    expect(result.error).toBeUndefined()
    expect(mockDeletePastExamDetails).toHaveBeenCalled()
  })

  it('figures 없는 경우 Storage 삭제 스킵', async () => {
    mockAuthenticatedTeacher()
    mockSelectPastExamDetailsFigures.mockResolvedValue({
      data: [{ figures: null }, { figures: [] }],
      error: null,
    })

    const { resetExtractionAction } = await import('../extract-questions')
    await resetExtractionAction('exam-id')

    expect(mockAdminStorageRemove).not.toHaveBeenCalled()
  })
})
