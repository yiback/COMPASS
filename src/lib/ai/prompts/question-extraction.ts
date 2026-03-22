/**
 * 기출 추출 프롬프트 빌더
 *
 * 시험지 이미지에서 문제를 추출하기 위한 PromptConfig를 구성한다.
 * buildExtractionPrompt: 전체 이미지 분석 → 모든 문제 추출
 * buildReanalyzePrompt: 특정 문제 재분석 (사용자 피드백 반영)
 */

import type {
  ExtractQuestionParams,
  ReanalyzeQuestionParams,
  PromptConfig,
} from '../types'
import { extractionJsonSchema } from '../extraction-validation'

// ─── 상수 ──────────────────────────────────────────────────

const EXTRACTION_TEMPERATURE = 0.2 // 정확성 우선 (생성 0.7/0.8과 다름)
const DEFAULT_MAX_OUTPUT_TOKENS = 8192 // 다중 이미지 + 다수 문제 추출 시 충분한 토큰

// ─── 추출 프롬프트 ─────────────────────────────────────────

const EXTRACTION_SYSTEM_INSTRUCTION = [
  '당신은 한국 학교 시험지 이미지 분석 전문가입니다.',
  'N장의 시험지 이미지를 순서대로 분석하여 개별 문제를 추출하세요.',
  '',
  '다음 규칙을 반드시 준수하세요:',
  '1. 페이지 경계에 걸친 문제는 하나의 문제로 합쳐서 추출하세요.',
  '2. 수식은 LaTeX 형태로 변환하세요 (인라인: $...$, 블록: $$...$$).',
  '3. 학생의 필기, 답안 표시, 풀이 흔적은 무시하고 원본 문제만 추출하세요.',
  '4. 그래프, 그림, 도형이 있는 경우:',
  '   - bounding box 좌표를 normalized(0~1)로 반환하세요.',
  '   - bounding box는 그림 전체를 넉넉히 포함해야 합니다. 여백을 약간 포함하세요.',
  '   - x, y는 그림 영역의 좌상단 꼭짓점이고, width, height는 그림 영역의 전체 너비와 높이입니다.',
  '   - 그래프/그림의 내용을 상세히 설명하세요.',
  '   - hasFigure를 true로 설정하세요.',
  '5. 각 문제의 추출 신뢰도(confidence)를 0.0~1.0으로 평가하세요.',
  '   - 1.0에 가까울수록 추출이 정확함을 의미합니다.',
  '   - 불명확한 글씨, 잘린 문제 등은 낮은 confidence를 부여하세요.',
  '6. 문제 유형을 정확히 분류하세요: multiple_choice, short_answer, essay.',
  '7. 객관식 문제의 보기는 options 배열에 순서대로 포함하세요.',
  '8. 정답이 시험지에 표시되어 있다면 answer에 포함하세요. 없으면 생략.',
].join('\n')

/**
 * 기출 추출용 PromptConfig를 빌드한다.
 *
 * imageParts는 PromptConfig.imageParts로 전달되어
 * GeminiProvider에서 contents Part 배열로 변환된다.
 */
export function buildExtractionPrompt(
  params: ExtractQuestionParams,
): PromptConfig {
  const lines: string[] = [
    `시험지 이미지 ${params.imageParts.length}장을 분석하여 모든 문제를 추출하세요.`,
    '',
    `과목: ${params.subject}`,
    `학년: ${params.grade}학년`,
  ]

  if (params.examType) {
    lines.push(`시험 유형: ${params.examType}`)
  }

  lines.push('')
  lines.push('이미지는 page_number 순서대로 전달됩니다.')
  lines.push('모든 문제를 빠짐없이 추출하세요.')

  return {
    systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
    userPrompt: lines.join('\n'),
    responseSchema: extractionJsonSchema,
    temperature: EXTRACTION_TEMPERATURE,
    maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
    imageParts: params.imageParts,
  }
}

// ─── 재분석 프롬프트 ───────────────────────────────────────

const REANALYZE_SYSTEM_INSTRUCTION = [
  '당신은 한국 학교 시험지 이미지 분석 전문가입니다.',
  '사용자가 특정 문제의 추출 결과에 대해 재분석을 요청했습니다.',
  '전체 시험지 이미지를 다시 확인하고, 해당 문제만 다시 분석하세요.',
  '',
  '다음 규칙을 반드시 준수하세요:',
  '1. 수식은 LaTeX 형태로 변환하세요.',
  '2. 학생의 필기, 답안 표시, 풀이 흔적은 무시하세요.',
  '3. 그래프/그림이 있으면 bounding box(normalized 0~1)를 반환하세요.',
  '4. 추출 신뢰도(confidence)를 0.0~1.0으로 재평가하세요.',
  '5. 응답은 questions 배열에 해당 문제 1개만 포함하세요.',
].join('\n')

/**
 * 재분석용 PromptConfig를 빌드한다.
 *
 * 전체 이미지를 전달하는 이유:
 * - 페이지 경계를 넘는 문제 가능성
 * - AI 컨텍스트 일관성 보장
 */
export function buildReanalyzePrompt(
  params: ReanalyzeQuestionParams,
): PromptConfig {
  const lines: string[] = [
    `${params.questionNumber}번 문제를 다시 분석해주세요.`,
    '',
    `과목: ${params.subject}`,
    `학년: ${params.grade}학년`,
    '',
    '=== 현재 추출 결과 ===',
    `문제 유형: ${params.currentQuestion.questionType}`,
    `문제 내용: ${params.currentQuestion.questionText}`,
  ]

  if (params.currentQuestion.options) {
    lines.push(`보기: ${params.currentQuestion.options.join(', ')}`)
  }

  if (params.currentQuestion.answer) {
    lines.push(`현재 정답: ${params.currentQuestion.answer}`)
  }

  if (params.userFeedback) {
    lines.push('')
    lines.push('=== 사용자 피드백 ===')
    lines.push(params.userFeedback)
  }

  lines.push('')
  lines.push('위 정보를 참고하여 해당 문제를 다시 정확히 추출하세요.')
  lines.push('응답은 questions 배열에 이 문제 1개만 포함하세요.')

  return {
    systemInstruction: REANALYZE_SYSTEM_INSTRUCTION,
    userPrompt: lines.join('\n'),
    responseSchema: extractionJsonSchema,
    temperature: EXTRACTION_TEMPERATURE,
    maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
    imageParts: params.imageParts,
  }
}
