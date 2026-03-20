import { describe, it, expect } from 'vitest'
import {
  buildExtractionPrompt,
  buildReanalyzePrompt,
} from '../../prompts/question-extraction'
import type {
  ExtractQuestionParams,
  ReanalyzeQuestionParams,
  ExtractedQuestion,
} from '../../types'

// ─── 공통 픽스처 ──────────────────────────────────────────

const SAMPLE_IMAGE_PARTS = [
  { mimeType: 'image/png', data: 'base64data1' },
  { mimeType: 'image/png', data: 'base64data2' },
  { mimeType: 'image/jpeg', data: 'base64data3' },
] as const

const EXTRACTION_PARAMS: ExtractQuestionParams = {
  imageParts: SAMPLE_IMAGE_PARTS,
  subject: '수학',
  grade: 2,
}

const CURRENT_QUESTION: ExtractedQuestion = {
  questionNumber: 3,
  questionText: '다음 중 옳은 것은?',
  questionType: 'multiple_choice',
  options: ['보기1', '보기2', '보기3'],
  answer: '보기2',
  confidence: 0.7,
  hasFigure: false,
}

const REANALYZE_PARAMS: ReanalyzeQuestionParams = {
  imageParts: SAMPLE_IMAGE_PARTS,
  questionNumber: 3,
  currentQuestion: CURRENT_QUESTION,
  subject: '수학',
  grade: 2,
}

// ─── 테스트 ──────────────────────────────────────────────

describe('buildExtractionPrompt', () => {
  it('userPrompt에 이미지 장수를 포함한다', () => {
    const result = buildExtractionPrompt(EXTRACTION_PARAMS)

    expect(result.userPrompt).toContain('3장')
  })

  it('userPrompt에 과목/학년을 포함한다', () => {
    const result = buildExtractionPrompt(EXTRACTION_PARAMS)

    expect(result.userPrompt).toContain('수학')
    expect(result.userPrompt).toContain('2학년')
  })

  it('examType 생략 시 userPrompt에 시험 유형이 포함되지 않는다', () => {
    const result = buildExtractionPrompt(EXTRACTION_PARAMS)

    expect(result.userPrompt).not.toContain('시험 유형')
  })

  it('examType이 있으면 userPrompt에 시험 유형을 포함한다', () => {
    const params: ExtractQuestionParams = {
      ...EXTRACTION_PARAMS,
      examType: '중간고사',
    }

    const result = buildExtractionPrompt(params)

    expect(result.userPrompt).toContain('시험 유형: 중간고사')
  })

  it('temperature가 0.2이다 (정확성 우선)', () => {
    const result = buildExtractionPrompt(EXTRACTION_PARAMS)

    expect(result.temperature).toBe(0.2)
  })

  it('imageParts를 그대로 전달한다', () => {
    const result = buildExtractionPrompt(EXTRACTION_PARAMS)

    expect(result.imageParts).toBe(EXTRACTION_PARAMS.imageParts)
  })

  it('systemInstruction에 필수 키워드를 포함한다', () => {
    const result = buildExtractionPrompt(EXTRACTION_PARAMS)
    const si = result.systemInstruction

    expect(si).toContain('페이지 경계')
    expect(si).toContain('학생')
    expect(si).toContain('bounding box')
    expect(si).toContain('LaTeX')
    expect(si).toContain('confidence')
  })
})

describe('buildReanalyzePrompt', () => {
  it('userPrompt에 questionNumber를 포함한다', () => {
    const result = buildReanalyzePrompt(REANALYZE_PARAMS)

    expect(result.userPrompt).toContain('3번 문제')
  })

  it('userPrompt에 현재 추출 결과를 포함한다', () => {
    const result = buildReanalyzePrompt(REANALYZE_PARAMS)

    expect(result.userPrompt).toContain('다음 중 옳은 것은?')
    expect(result.userPrompt).toContain('multiple_choice')
  })

  it('userFeedback이 있으면 포함한다', () => {
    const params: ReanalyzeQuestionParams = {
      ...REANALYZE_PARAMS,
      userFeedback: '보기가 잘못 인식되었습니다',
    }

    const result = buildReanalyzePrompt(params)

    expect(result.userPrompt).toContain('사용자 피드백')
    expect(result.userPrompt).toContain('보기가 잘못 인식되었습니다')
  })

  it('userFeedback이 없으면 해당 섹션을 생략한다', () => {
    const result = buildReanalyzePrompt(REANALYZE_PARAMS)

    expect(result.userPrompt).not.toContain('사용자 피드백')
  })

  it('imageParts를 그대로 전달한다', () => {
    const result = buildReanalyzePrompt(REANALYZE_PARAMS)

    expect(result.imageParts).toBe(REANALYZE_PARAMS.imageParts)
  })
})
