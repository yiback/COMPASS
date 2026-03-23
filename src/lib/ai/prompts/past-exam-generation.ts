/**
 * 기출문제 기반 문제 생성 프롬프트 빌더
 *
 * 기출문제 컨텍스트(학교·연도·학기·시험유형·원본 내용)를 참고하여
 * 유사 문제를 생성하기 위한 PromptConfig를 구성한다.
 *
 * 기존 buildQuestionGenerationPrompt(성취기준 기반)와 별도 함수로 분리.
 * questionsJsonSchema(응답 스키마)만 공유 재사용한다.
 */

import type {
  GenerateQuestionParams,
  PromptConfig,
  QuestionType,
} from '../types'
import { questionsJsonSchema } from '../validation'

// ─── 상수 ──────────────────────────────────────────────────

const DEFAULT_TEMPERATURE = 0.8
const DEFAULT_MAX_OUTPUT_TOKENS = 4096

/** QuestionType → 한글 매핑 (프롬프트용 독립 정의) */
const QUESTION_TYPE_LABELS = {
  multiple_choice: '객관식(5지선다형)',
  short_answer: '단답형',
  essay: '서술형',
} as const satisfies Record<QuestionType, string>

/** 시험 유형 → 한글 매핑 */
const EXAM_TYPE_LABELS: Record<string, string> = {
  midterm: '중간고사',
  final: '기말고사',
  mock: '모의고사',
}

// ─── 프롬프트 빌더 ─────────────────────────────────────────

/**
 * 도형 JSON 출력 규칙 (기출문제 생성 버전)
 *
 * question-generation.ts의 동일 규칙을 기출 생성 컨텍스트에도 적용.
 * 기출문제에 도형이 포함된 경우 유사 문제도 도형을 JSON으로 출력.
 *
 * 토큰 비용 제어: 포인트(좌표) 최대 20개 제한 명시
 */
const FIGURE_OUTPUT_RULES = [
  '2. 그래프나 도형이 필요한 문제는 다음 규칙에 따라 JSON으로 출력하세요:',
  '   a. 문제 텍스트에서 도형이 등장할 위치에 {{fig:N}} (N은 1부터 시작)을 삽입하세요.',
  '   b. figures 배열에 N번째 위치에 해당 도형 JSON을 추가하세요.',
  '   c. hasFigure 필드를 true로 설정하세요.',
  '   d. 지원 타입: coordinate_plane, function_graph, polygon, circle, vector, number_line',
  '   e. 포인트(좌표) 개수는 최대 20개로 제한하여 토큰 낭비를 방지하세요.',
  '   f. 모든 도형에 description 필드(폴백용 텍스트)를 반드시 포함하세요.',
  '   g. displaySize: "large"(기본값) 또는 "small"로 크기를 지정하세요.',
  '   h. 도형이 불필요한 경우 hasFigure를 false로 설정하고 figures를 생략하세요.',
].join('\n')

const SYSTEM_INSTRUCTION = [
  '당신은 한국 중학교 기출문제 분석 및 유사 문제 생성 전문가입니다.',
  '기출문제의 출제 경향을 분석하여 유사하지만 새로운 문제를 생성하세요.',
  '다음 규칙을 반드시 준수하세요:',
  '1. 수식은 반드시 LaTeX 문법을 사용하세요 (인라인: $...$, 블록: $$...$$).',
  FIGURE_OUTPUT_RULES,
  '3. 문제는 해당 학년 교육과정에 맞는 수준으로 출제하세요.',
  '4. 각 문제에 정답과 풀이를 반드시 포함하세요.',
  '5. 기출문제와 동일한 문제가 아닌, 출제 경향을 반영한 유사 문제를 생성하세요.',
].join('\n')

export function buildPastExamGenerationPrompt(
  params: GenerateQuestionParams,
): PromptConfig {
  const lines: string[] = []

  // 기출 컨텍스트 정보
  if (params.pastExamContext) {
    const ctx = params.pastExamContext
    const examTypeLabel = EXAM_TYPE_LABELS[ctx.examType] ?? ctx.examType

    lines.push('=== 기출문제 정보 ===')
    lines.push(`학교: ${ctx.schoolName}`)
    lines.push(`연도: ${ctx.year}년 ${ctx.semester}학기`)
    lines.push(`시험 유형: ${examTypeLabel}`)

    // extractedContent 유무에 따른 프롬프트 분기
    if (ctx.extractedContent) {
      lines.push('')
      lines.push('=== 기출문제 내용 (참고) ===')
      lines.push(ctx.extractedContent)
      lines.push('')
      lines.push('위 기출문제를 참고하여 유사하지만 새로운 문제를 생성하세요.')
    } else {
      lines.push('')
      lines.push(
        '기출문제 원본 내용이 없으므로 위 메타데이터를 기반으로 해당 학교의 출제 스타일에 맞는 문제를 생성하세요.',
      )
    }

    lines.push('')
  }

  // 생성 조건
  lines.push('=== 생성 조건 ===')
  lines.push(`과목: ${params.subject}`)
  lines.push(`학년: ${params.grade}학년`)
  lines.push(`문제 유형: ${QUESTION_TYPE_LABELS[params.questionType]}`)
  lines.push(`난이도: ${params.difficulty}`)
  lines.push(`문제 수: ${params.count}문제`)

  if (params.unit) {
    lines.push(`단원: ${params.unit}`)
  }

  if (params.topics && params.topics.length > 0) {
    lines.push(`세부 주제: ${params.topics.join(', ')}`)
  }

  return {
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt: lines.join('\n'),
    responseSchema: questionsJsonSchema,
    temperature: DEFAULT_TEMPERATURE,
    maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
  }
}
