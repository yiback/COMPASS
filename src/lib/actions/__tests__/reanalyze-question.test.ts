/**
 * reanalyzeQuestionAction 전용 테스트
 *
 * 별도 파일 분리 이유: AI Provider mock 충돌 방지 + 파일 크기 관리
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── 모킹 ───────────────────────────────────────────────

const mockGetUser = vi.fn()
const mockSelectProfiles = vi.fn()
const mockSelectDetailSingle = vi.fn()
const mockSelectPastExamImages = vi.fn()
const mockCreateSignedUrl = vi.fn()
const mockUpdateDetail = vi.fn()

// Supabase 서버 클라이언트 모킹
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
      if (table === 'past_exam_details') {
        return {
          // reanalyzeQuestionAction: .select('*, past_exams(...)').eq('id', x).eq('academy_id', y).single()
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => mockSelectDetailSingle(),
              }),
            }),
          }),
          // UPDATE: .update(data).eq('id', x).eq('academy_id', y)
          update: (data: unknown) => ({
            eq: () => ({
              eq: () => mockUpdateDetail(data),
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

// Supabase admin 모킹 (재분석에서는 사용하지 않지만 모듈 로딩 필요)
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    storage: {
      from: () => ({
        upload: vi.fn(),
        remove: vi.fn(),
      }),
    },
  }),
}))

// AI Provider 모킹
const mockReanalyzeQuestion = vi.fn()

vi.mock('@/lib/ai/provider', () => ({
  createAIProvider: vi.fn().mockReturnValue({
    reanalyzeQuestion: (params: unknown) => mockReanalyzeQuestion(params),
  }),
}))

// fetch 모킹
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ─── 테스트 유틸 ────────────────────────────────────────

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

/** 기본 detail + past_exams 조인 결과 */
function createMockDetail() {
  return {
    id: 'detail-id',
    question_number: 1,
    question_text: '다음 중 올바른 것은?',
    question_type: 'multiple_choice',
    options: ['A', 'B', 'C', 'D'],
    answer: 'A',
    confidence: 0.9,
    has_figure: false,
    figures: null,
    past_exams: {
      id: 'exam-id',
      subject: '수학',
      grade: 10,
      exam_type: 'midterm',
    },
  }
}

/** 재분석 AI 결과 */
function createMockReanalyzeResult() {
  return {
    questionNumber: 1,
    questionText: '수정된 문제 텍스트',
    questionType: 'multiple_choice' as const,
    options: ['A', 'B', 'C', 'D', 'E'],
    answer: 'B',
    confidence: 0.98,
    hasFigure: false,
    figures: undefined,
  }
}

function mockFetchResponse() {
  mockFetch.mockResolvedValue({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    headers: {
      get: () => 'image/jpeg',
    },
  })
}

// ─── reanalyzeQuestionAction ──────────────────────────────

describe('reanalyzeQuestionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateDetail.mockResolvedValue({ error: null })
  })

  it('비인증 사용자에게 에러를 반환한다', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const { reanalyzeQuestionAction } = await import('../extract-questions')
    const result = await reanalyzeQuestionAction('detail-id')
    expect(result.error).toContain('로그인')
  })

  it('유효한 detailId → 단일 문제 재분석 + UPDATE 확인', async () => {
    mockAuthenticatedTeacher()
    mockSelectDetailSingle.mockResolvedValue({
      data: createMockDetail(),
      error: null,
    })
    mockSelectPastExamImages.mockResolvedValue({
      data: [{ source_image_url: 'path/img.jpg' }],
      error: null,
    })
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed' },
    })
    mockFetchResponse()
    mockReanalyzeQuestion.mockResolvedValue(createMockReanalyzeResult())

    const { reanalyzeQuestionAction } = await import('../extract-questions')
    const result = await reanalyzeQuestionAction('detail-id')

    expect(result.error).toBeUndefined()
    expect(mockUpdateDetail).toHaveBeenCalled()

    // UPDATE 데이터 확인
    const updateData = mockUpdateDetail.mock.calls[0]?.[0]
    expect(updateData.question_text).toBe('수정된 문제 텍스트')
    expect(updateData.confidence).toBe(0.98)
  })

  it('feedback 포함 재분석 → AI에 feedback 전달 확인', async () => {
    mockAuthenticatedTeacher()
    mockSelectDetailSingle.mockResolvedValue({
      data: createMockDetail(),
      error: null,
    })
    mockSelectPastExamImages.mockResolvedValue({
      data: [{ source_image_url: 'path/img.jpg' }],
      error: null,
    })
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed' },
    })
    mockFetchResponse()
    mockReanalyzeQuestion.mockResolvedValue(createMockReanalyzeResult())

    const { reanalyzeQuestionAction } = await import('../extract-questions')
    await reanalyzeQuestionAction('detail-id', '답이 B가 아니라 C입니다')

    // AI Provider에 feedback이 전달되었는지 확인
    const aiParams = mockReanalyzeQuestion.mock.calls[0]?.[0]
    expect(aiParams.userFeedback).toBe('답이 B가 아니라 C입니다')
  })

  it('전체 이미지 전달 확인 (buildImageParts 호출)', async () => {
    mockAuthenticatedTeacher()
    mockSelectDetailSingle.mockResolvedValue({
      data: createMockDetail(),
      error: null,
    })
    // 3장의 이미지
    mockSelectPastExamImages.mockResolvedValue({
      data: [
        { source_image_url: 'path/img1.jpg' },
        { source_image_url: 'path/img2.jpg' },
        { source_image_url: 'path/img3.jpg' },
      ],
      error: null,
    })
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed' },
    })
    mockFetchResponse()
    mockReanalyzeQuestion.mockResolvedValue(createMockReanalyzeResult())

    const { reanalyzeQuestionAction } = await import('../extract-questions')
    await reanalyzeQuestionAction('detail-id')

    // 전체 이미지(3장)가 AI에 전달되었는지 확인
    const aiParams = mockReanalyzeQuestion.mock.calls[0]?.[0]
    expect(aiParams.imageParts).toHaveLength(3)
  })

  it('AI 오류 → error 반환 (extraction_status 변경 없음)', async () => {
    mockAuthenticatedTeacher()
    mockSelectDetailSingle.mockResolvedValue({
      data: createMockDetail(),
      error: null,
    })
    mockSelectPastExamImages.mockResolvedValue({
      data: [{ source_image_url: 'path/img.jpg' }],
      error: null,
    })
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed' },
    })
    mockFetchResponse()
    mockReanalyzeQuestion.mockRejectedValue(new Error('AI API 오류'))

    const { reanalyzeQuestionAction } = await import('../extract-questions')
    const result = await reanalyzeQuestionAction('detail-id')

    expect(result.error).toContain('AI 재분석에 실패')
    // extraction_status는 변경되지 않아야 함
    expect(mockUpdateDetail).not.toHaveBeenCalled()
  })

  it('존재하지 않는 detailId → error 반환', async () => {
    mockAuthenticatedTeacher()
    mockSelectDetailSingle.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    })

    const { reanalyzeQuestionAction } = await import('../extract-questions')
    const result = await reanalyzeQuestionAction('nonexistent')
    expect(result.error).toContain('찾을 수 없습니다')
  })
})
