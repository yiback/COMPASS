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

const SYSTEM_INSTRUCTION = [
  '당신은 한국 중학교 기출문제 분석 및 유사 문제 생성 전문가입니다.',
  '기출문제의 출제 경향을 분석하여 유사하지만 새로운 문제를 생성하세요.',
  '다음 규칙을 반드시 준수하세요:',
  '1. 수식은 반드시 LaTeX 문법을 사용하세요 (인라인: $...$, 블록: $$...$$).',
  '2. 그래프나 그림이 필요한 문제는 텍스트로 상황을 설명하여 대체하세요.',
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
