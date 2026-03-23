/**
 * 문제 생성 프롬프트 빌더
 *
 * GenerateQuestionParams를 받아 Gemini API에 전달할
 * PromptConfig(systemInstruction + userPrompt + responseSchema)를 생성한다.
 *
 * systemInstruction: AI의 역할과 출력 규칙 (LaTeX, 그래프 대체 등)
 * userPrompt: 과목/학년/문제유형/난이도 등 구체적 요청
 * responseSchema: Zod 스키마에서 변환한 JSON Schema (DRY)
 */

import type {
  GenerateQuestionParams,
  PromptConfig,
  QuestionType,
} from '../types'
import { questionsJsonSchema } from '../validation'

// ─── 상수 ──────────────────────────────────────────────────

const DEFAULT_TEMPERATURE = 0.7
const DEFAULT_MAX_OUTPUT_TOKENS = 4096

/**
 * QuestionType → 한글 매핑
 *
 * Record 기반이므로 새 QuestionType 추가 시
 * TypeScript가 누락을 컴파일 에러로 잡아준다.
 */
const QUESTION_TYPE_LABELS = {
  multiple_choice: '객관식(5지선다형)',
  short_answer: '단답형',
  essay: '서술형',
} as const satisfies Record<QuestionType, string>

// ─── 헬퍼 ──────────────────────────────────────────────────

/** QuestionType을 한글 레이블로 변환 */
function formatQuestionType(type: QuestionType): string {
  return QUESTION_TYPE_LABELS[type]
}

// ─── 프롬프트 빌더 ─────────────────────────────────────────

/**
 * 도형 JSON 출력 규칙 (6가지 타입 정의 포함)
 *
 * AI가 도형을 텍스트 설명으로 대체하는 대신,
 * 구조화된 JSON으로 출력하도록 지시한다.
 * {{fig:N}} 구분자(1-based)를 문제 텍스트 내에 삽입하여
 * figures 배열과 1:1 매칭한다.
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
  '당신은 한국 중학교 시험 출제 전문가입니다.',
  '다음 규칙을 반드시 준수하세요:',
  '1. 수식은 반드시 LaTeX 문법을 사용하세요 (인라인: $...$, 블록: $$...$$).',
  FIGURE_OUTPUT_RULES,
  '3. 문제는 해당 학년 교육과정에 맞는 수준으로 출제하세요.',
  '4. 각 문제에 정답과 풀이를 반드시 포함하세요.',
].join('\n')

/**
 * 문제 생성용 PromptConfig를 빌드한다.
 *
 * @param params - 과목, 학년, 문제유형, 난이도 등 생성 조건
 * @returns Gemini API에 전달할 PromptConfig
 */
export function buildQuestionGenerationPrompt(
  params: GenerateQuestionParams,
): PromptConfig {
  const lines: string[] = [
    `과목: ${params.subject}`,
    `학년: ${params.grade}학년`,
    `문제 유형: ${formatQuestionType(params.questionType)}`,
    `난이도: ${params.difficulty}`,
    `문제 수: ${params.count}문제`,
  ]

  if (params.unit) {
    lines.push(`단원: ${params.unit}`)
  }

  if (params.topics && params.topics.length > 0) {
    lines.push(`세부 주제: ${params.topics.join(', ')}`)
  }

  if (params.schoolName) {
    lines.push(`대상 학교: ${params.schoolName}`)
  }

  return {
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt: lines.join('\n'),
    responseSchema: questionsJsonSchema,
    temperature: DEFAULT_TEMPERATURE,
    maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
  }
}
