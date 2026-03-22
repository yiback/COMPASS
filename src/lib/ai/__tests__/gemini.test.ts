import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type {
  GenerateQuestionParams,
  ExtractQuestionParams,
  ReanalyzeQuestionParams,
  ExtractedQuestion,
} from '../types'

// ─── 모킹 ────────────────────────────────────────────────

const mockGenerateContent = vi.fn()

vi.mock('@google/genai', () => {
  const MockGoogleGenAI = vi.fn(function (this: Record<string, unknown>) {
    this.models = { generateContent: mockGenerateContent }
  })
  return { GoogleGenAI: MockGoogleGenAI }
})

vi.mock('../config', () => ({
  getAIConfig: vi.fn().mockReturnValue({
    apiKey: 'test-api-key',
    model: 'gemini-2.5-flash',
    maxRetries: 2,
    timeoutMs: 30000,
  }),
}))

// 모킹 후 import (호이스팅 활용)
import { GeminiProvider } from '../gemini'
import { GoogleGenAI } from '@google/genai'
import {
  AIServiceError,
  AIValidationError,
  AIRateLimitError,
} from '../errors'

// ─── 공통 픽스처 ──────────────────────────────────────────

const VALID_PARAMS: GenerateQuestionParams = {
  subject: '수학',
  grade: 2,
  questionType: 'multiple_choice',
  count: 2,
  difficulty: 'medium',
}

/** 추출용 파라미터 */
const EXTRACTION_PARAMS: ExtractQuestionParams = {
  imageParts: [
    { mimeType: 'image/png', data: 'base64data1' },
    { mimeType: 'image/jpeg', data: 'base64data2' },
  ],
  subject: '수학',
  grade: 2,
}

const CURRENT_QUESTION: ExtractedQuestion = {
  questionNumber: 3,
  questionText: '다음 중 옳은 것은?',
  questionType: 'multiple_choice',
  options: ['보기1', '보기2', '보기3'],
  confidence: 0.7,
  hasFigure: false,
}

const REANALYZE_PARAMS: ReanalyzeQuestionParams = {
  imageParts: EXTRACTION_PARAMS.imageParts,
  questionNumber: 3,
  currentQuestion: CURRENT_QUESTION,
  subject: '수학',
  grade: 2,
}

/** Gemini API 정상 응답 픽스처 */
function createValidResponse() {
  return {
    text: JSON.stringify({
      questions: [
        {
          content: '1 + 1 = ?',
          answer: '2',
          explanation: '기본 덧셈',
          difficulty: 'medium',
          questionType: 'multiple_choice',
          options: ['1', '2', '3', '4', '5'],
        },
        {
          content: '2 + 2 = ?',
          answer: '4',
          explanation: '기본 덧셈',
          difficulty: 'medium',
          questionType: 'multiple_choice',
          options: ['2', '3', '4', '5', '6'],
        },
      ],
    }),
  }
}

/** 추출 정상 응답 (2문제) */
function createValidExtractionResponse() {
  return {
    text: JSON.stringify({
      questions: [
        {
          questionNumber: 1,
          questionText: '다음 중 올바른 것은?',
          questionType: 'multiple_choice',
          options: ['A', 'B', 'C', 'D'],
          answer: 'B',
          confidence: 0.95,
          hasFigure: false,
        },
        {
          questionNumber: 2,
          questionText: '$x + 1 = 3$의 해를 구하시오.',
          questionType: 'short_answer',
          answer: 'x = 2',
          confidence: 0.9,
          hasFigure: false,
        },
      ],
    }),
  }
}

/** 추출 정상 응답 (1문제 — 재분석용) */
function createSingleExtractionResponse() {
  return {
    text: JSON.stringify({
      questions: [
        {
          questionNumber: 3,
          questionText: '재분석된 문제',
          questionType: 'short_answer',
          answer: 'x = -1',
          confidence: 0.95,
          hasFigure: false,
        },
      ],
    }),
  }
}

/** SDK ApiError를 시뮬레이션하는 plain object (duck typing) */
function createApiError(status: number, message: string): Error {
  const error = new Error(message)
  error.name = 'ApiError'
  ;(error as Record<string, unknown>).status = status
  return error
}

// ─── 테스트 ──────────────────────────────────────────────

describe('GeminiProvider', () => {
  let provider: InstanceType<typeof GeminiProvider>

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new GeminiProvider()
  })

  // ─── 그룹 1: 인스턴스 생성 ─────────────────────────────

  describe('인스턴스 생성', () => {
    it('name 속성이 "gemini"이다', () => {
      expect(provider.name).toBe('gemini')
    })

    it('getAIConfig()로 설정을 읽어 GoogleGenAI를 초기화한다', () => {
      expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'test-api-key' })
    })
  })

  // ─── 그룹 2: generateQuestions 성공 ────────────────────

  describe('generateQuestions 성공', () => {
    it('정상 응답 시 GeneratedQuestion[]를 반환한다', async () => {
      mockGenerateContent.mockResolvedValueOnce(createValidResponse())

      const result = await provider.generateQuestions(VALID_PARAMS)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        content: '1 + 1 = ?',
        type: 'multiple_choice',
        difficulty: 'medium',
        answer: '2',
        explanation: '기본 덧셈',
        options: ['1', '2', '3', '4', '5'],
      })
    })

    it('API에 올바른 model과 contents를 전달한다', async () => {
      mockGenerateContent.mockResolvedValueOnce(createValidResponse())

      await provider.generateQuestions(VALID_PARAMS)

      const callArgs = mockGenerateContent.mock.calls[0][0]
      expect(callArgs.model).toBe('gemini-2.5-flash')
      expect(callArgs.contents).toContain('수학')
      expect(callArgs.contents).toContain('2학년')
    })

    it('responseJsonSchema 필드에 JSON Schema를 전달한다', async () => {
      mockGenerateContent.mockResolvedValueOnce(createValidResponse())

      await provider.generateQuestions(VALID_PARAMS)

      const callArgs = mockGenerateContent.mock.calls[0][0]
      expect(callArgs.config.responseJsonSchema).toBeDefined()
      expect(callArgs.config.responseJsonSchema).toHaveProperty('type')
    })

    it('responseMimeType을 "application/json"으로 설정한다', async () => {
      mockGenerateContent.mockResolvedValueOnce(createValidResponse())

      await provider.generateQuestions(VALID_PARAMS)

      const callArgs = mockGenerateContent.mock.calls[0][0]
      expect(callArgs.config.responseMimeType).toBe('application/json')
    })
  })

  // ─── 그룹 3: generateQuestions 에러 ────────────────────

  describe('generateQuestions 에러', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('response.text가 undefined이면 AIValidationError를 던진다', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: undefined })

      await expect(provider.generateQuestions(VALID_PARAMS)).rejects.toThrow(
        AIValidationError,
      )
    })

    it('유효하지 않은 JSON이면 AIValidationError를 던진다', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: '이것은 JSON이 아닙니다',
      })

      await expect(provider.generateQuestions(VALID_PARAMS)).rejects.toThrow(
        AIValidationError,
      )
    })

    it('API 429 에러 시 AIRateLimitError를 던진다', async () => {
      mockGenerateContent.mockRejectedValue(
        createApiError(429, 'Too Many Requests'),
      )

      const promise = provider.generateQuestions(VALID_PARAMS)
      const assertion = expect(promise).rejects.toThrow(AIRateLimitError)
      // maxRetries=2 → 재시도 2회 대기 시간 전진
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(2000)
      await assertion
    })

    it('API 500 에러 시 AIServiceError(statusCode=500)를 던진다', async () => {
      mockGenerateContent.mockRejectedValue(
        createApiError(500, 'Internal Server Error'),
      )

      const promise = provider.generateQuestions(VALID_PARAMS)
      // rejection handler를 먼저 등록하여 unhandled rejection 방지
      const errorPromise = promise.catch((e: unknown) => e)
      // 재시도 대기 시간 전진
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(2000)

      const error = await errorPromise
      expect(error).toBeInstanceOf(AIServiceError)
      expect((error as AIServiceError).statusCode).toBe(500)
    })

    it('API 401 에러 시 AIServiceError(statusCode=401)를 던진다', async () => {
      mockGenerateContent.mockRejectedValue(
        createApiError(401, 'Unauthorized'),
      )

      const promise = provider.generateQuestions(VALID_PARAMS)
      const errorPromise = promise.catch((e: unknown) => e)
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(2000)

      const error = await errorPromise
      expect(error).toBeInstanceOf(AIServiceError)
      expect((error as AIServiceError).statusCode).toBe(401)
    })

    it('네트워크 에러(일반 Error) 시 AIServiceError를 던진다', async () => {
      mockGenerateContent.mockRejectedValue(new Error('ECONNREFUSED'))

      const promise = provider.generateQuestions(VALID_PARAMS)
      const assertion = expect(promise).rejects.toThrow(AIServiceError)
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(2000)
      await assertion
    })

    it('Zod 검증 실패 시 AIValidationError를 던진다 (재시도 안 됨)', async () => {
      // 구조는 맞지만 객관식에 보기가 없는 케이스
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({
          questions: [
            {
              content: '문제',
              answer: '답',
              explanation: '설명',
              difficulty: 'easy',
              questionType: 'multiple_choice',
              // options 누락 → 비즈니스 규칙 위반
            },
          ],
        }),
      })

      await expect(provider.generateQuestions(VALID_PARAMS)).rejects.toThrow(
        AIValidationError,
      )
      // isRetryable=false이므로 1번만 호출
      expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    })
  })

  // ─── 그룹 4: withRetry 통합 ────────────────────────────

  describe('withRetry 통합', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('AIServiceError 발생 시 재시도 후 성공한다', async () => {
      mockGenerateContent
        .mockRejectedValueOnce(createApiError(500, 'Server Error'))
        .mockResolvedValueOnce(createValidResponse())

      const promise = provider.generateQuestions(VALID_PARAMS)

      // maxRetries=2 (config 모킹), baseDelayMs=1000 (기본값)
      await vi.advanceTimersByTimeAsync(1000)

      const result = await promise
      expect(result).toHaveLength(2)
      expect(mockGenerateContent).toHaveBeenCalledTimes(2)
    })

    it('AIValidationError는 재시도 없이 즉시 던진다', async () => {
      mockGenerateContent.mockResolvedValue({ text: undefined })

      await expect(provider.generateQuestions(VALID_PARAMS)).rejects.toThrow(
        AIValidationError,
      )
      // withRetry가 isRetryable=false인 AIValidationError를 즉시 throw하므로
      // generateContent는 1번만 호출됨
      expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    })
  })

  // ─── 그룹 5: 미구현 메서드 ─────────────────────────────

  describe('미구현 메서드', () => {
    it('gradeAnswer는 AIServiceError를 던진다', async () => {
      await expect(
        provider.gradeAnswer({
          questionContent: '문제',
          questionType: 'essay',
          correctAnswer: '정답',
          studentAnswer: '학생답',
          maxScore: 10,
        }),
      ).rejects.toThrow(AIServiceError)
    })

    it('processOCR은 AIServiceError를 던진다', async () => {
      await expect(
        provider.processOCR({ imageUrl: 'https://example.com/img.png', subject: '수학' }),
      ).rejects.toThrow(AIServiceError)
    })

    it('analyzeTrends는 AIServiceError를 던진다', async () => {
      await expect(
        provider.analyzeTrends({
          schoolId: 'school-1',
          subject: '수학',
          years: [2024, 2025],
        }),
      ).rejects.toThrow(AIServiceError)
    })
  })

  // ─── 그룹 6: pastExamContext 분기 ─────────────────────────

  describe('generateQuestions - pastExamContext 분기', () => {
    it('pastExamContext가 없으면 기존 systemInstruction을 사용한다', async () => {
      mockGenerateContent.mockResolvedValueOnce(createValidResponse())

      await provider.generateQuestions(VALID_PARAMS)

      const callArgs = mockGenerateContent.mock.calls[0][0]
      // 기존 buildQuestionGenerationPrompt의 systemInstruction은 "시험 출제 전문가"를 포함
      expect(callArgs.config.systemInstruction).toContain('시험 출제 전문가')
      // 기출 분석 관련 키워드는 포함하지 않음
      expect(callArgs.config.systemInstruction).not.toContain('기출문제 분석')
    })

    it('pastExamContext가 있으면 기출 기반 systemInstruction을 사용한다', async () => {
      mockGenerateContent.mockResolvedValueOnce(createValidResponse())

      const paramsWithContext: GenerateQuestionParams = {
        ...VALID_PARAMS,
        pastExamContext: {
          pastExamId: '550e8400-e29b-41d4-a716-446655440000',
          schoolName: '한국중학교',
          year: 2025,
          semester: 1,
          examType: 'midterm',
        },
      }

      await provider.generateQuestions(paramsWithContext)

      const callArgs = mockGenerateContent.mock.calls[0][0]
      // buildPastExamGenerationPrompt의 systemInstruction은 "기출문제 분석"을 포함
      expect(callArgs.config.systemInstruction).toContain('기출문제 분석')
      // 기존 프롬프트 빌더의 키워드는 포함하지 않음
      expect(callArgs.config.systemInstruction).not.toContain('시험 출제 전문가')
    })

    it('pastExamContext가 있어도 응답 형식은 동일하다 (GeneratedQuestion[])', async () => {
      mockGenerateContent.mockResolvedValueOnce(createValidResponse())

      const paramsWithContext: GenerateQuestionParams = {
        ...VALID_PARAMS,
        pastExamContext: {
          pastExamId: '550e8400-e29b-41d4-a716-446655440000',
          schoolName: '한국중학교',
          year: 2025,
          semester: 1,
          examType: 'midterm',
        },
      }

      const result = await provider.generateQuestions(paramsWithContext)

      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('content')
      expect(result[0]).toHaveProperty('type')
      expect(result[0]).toHaveProperty('answer')
    })
  })

  // ─── 그룹 7: buildContents 분기 ───────────────────────────

  describe('buildContents 분기', () => {
    it('imageParts가 없으면 contents가 문자열이다 (기존 동작 유지)', async () => {
      mockGenerateContent.mockResolvedValueOnce(createValidResponse())

      await provider.generateQuestions(VALID_PARAMS)

      const callArgs = mockGenerateContent.mock.calls[0][0]
      expect(typeof callArgs.contents).toBe('string')
    })

    it('imageParts가 있으면 contents가 배열이며 마지막 요소에 text가 있다', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        createValidExtractionResponse(),
      )

      await provider.extractQuestions(EXTRACTION_PARAMS)

      const callArgs = mockGenerateContent.mock.calls[0][0]
      expect(Array.isArray(callArgs.contents)).toBe(true)
      const contentsArr = callArgs.contents as Array<Record<string, unknown>>
      // 마지막 요소에 text 포함
      expect(contentsArr[contentsArr.length - 1]).toHaveProperty('text')
      // 이미지 요소에 inlineData 포함
      expect(contentsArr[0]).toHaveProperty('inlineData')
    })
  })

  // ─── 그룹 8: extractQuestions ─────────────────────────────

  describe('extractQuestions', () => {
    it('multi-image 정상 응답 시 ExtractQuestionResult를 반환한다', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        createValidExtractionResponse(),
      )

      const result = await provider.extractQuestions(EXTRACTION_PARAMS)

      expect(result.totalQuestions).toBe(2)
      expect(result.questions).toHaveLength(2)
      expect(result.questions[0].questionNumber).toBe(1)
      expect(result.questions[1].questionNumber).toBe(2)
      expect(result.overallConfidence).toBeCloseTo(0.925)
    })

    it('imageParts가 있으면 inlineData Part 배열로 구성한다', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        createValidExtractionResponse(),
      )

      await provider.extractQuestions(EXTRACTION_PARAMS)

      const callArgs = mockGenerateContent.mock.calls[0][0]
      const contentsArr = callArgs.contents as Array<Record<string, unknown>>
      // 2개 이미지 + 1개 text = 3개 요소
      expect(contentsArr).toHaveLength(3)
      expect(
        (contentsArr[0] as Record<string, Record<string, string>>).inlineData
          .mimeType,
      ).toBe('image/png')
    })

    it('AI 빈 응답이면 AIValidationError를 던진다', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: undefined })

      await expect(
        provider.extractQuestions(EXTRACTION_PARAMS),
      ).rejects.toThrow(AIValidationError)
    })

    it('JSON 파싱 실패 시 AIValidationError를 던진다', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: '이것은 JSON이 아닙니다' })

      await expect(
        provider.extractQuestions(EXTRACTION_PARAMS),
      ).rejects.toThrow(AIValidationError)
    })

    it('Zod 검증 실패 시 AIValidationError를 던진다', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({ questions: [{ invalid: true }] }),
      })

      await expect(
        provider.extractQuestions(EXTRACTION_PARAMS),
      ).rejects.toThrow(AIValidationError)
    })

    it('SDK 429 에러 시 AIRateLimitError를 던진다', async () => {
      vi.useFakeTimers()
      mockGenerateContent.mockRejectedValue(
        createApiError(429, 'Too Many Requests'),
      )

      const promise = provider.extractQuestions(EXTRACTION_PARAMS)
      const assertion = expect(promise).rejects.toThrow(AIRateLimitError)
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(2000)
      await assertion
      vi.useRealTimers()
    })

    it('SDK 500 에러 시 AIServiceError를 던진다', async () => {
      vi.useFakeTimers()
      mockGenerateContent.mockRejectedValue(
        createApiError(500, 'Internal Server Error'),
      )

      const promise = provider.extractQuestions(EXTRACTION_PARAMS)
      const errorPromise = promise.catch((e: unknown) => e)
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(2000)

      const error = await errorPromise
      expect(error).toBeInstanceOf(AIServiceError)
      vi.useRealTimers()
    })

    it('재시도 후 성공한다', async () => {
      vi.useFakeTimers()
      mockGenerateContent
        .mockRejectedValueOnce(createApiError(500, 'Server Error'))
        .mockResolvedValueOnce(createValidExtractionResponse())

      const promise = provider.extractQuestions(EXTRACTION_PARAMS)
      await vi.advanceTimersByTimeAsync(1000)

      const result = await promise
      expect(result.totalQuestions).toBe(2)
      expect(mockGenerateContent).toHaveBeenCalledTimes(2)
      vi.useRealTimers()
    })
  })

  // ─── 그룹 9: reanalyzeQuestion ───────────────────────────

  describe('reanalyzeQuestion', () => {
    it('단일 문제 반환 시 ExtractedQuestion을 반환한다', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        createSingleExtractionResponse(),
      )

      const result = await provider.reanalyzeQuestion(REANALYZE_PARAMS)

      expect(result.questionNumber).toBe(3)
      expect(result.questionText).toBe('재분석된 문제')
    })

    it('2개 문제 반환 시 AIValidationError를 던진다', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        createValidExtractionResponse(), // 2개 문제 반환
      )

      const error = await provider
        .reanalyzeQuestion(REANALYZE_PARAMS)
        .catch((e: unknown) => e)

      expect(error).toBeInstanceOf(AIValidationError)
      expect((error as AIValidationError).message).toContain('1개 기대')
    })

    it('SDK 에러 시 AIServiceError를 던진다', async () => {
      vi.useFakeTimers()
      mockGenerateContent.mockRejectedValue(
        createApiError(500, 'Internal Server Error'),
      )

      const promise = provider.reanalyzeQuestion(REANALYZE_PARAMS)
      const errorPromise = promise.catch((e: unknown) => e)
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(2000)

      const error = await errorPromise
      expect(error).toBeInstanceOf(AIServiceError)
      vi.useRealTimers()
    })
  })
})
