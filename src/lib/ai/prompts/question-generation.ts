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

const SYSTEM_INSTRUCTION = [
  '당신은 한국 중학교 시험 출제 전문가입니다.',
  '다음 규칙을 반드시 준수하세요:',
  '1. 수식은 반드시 LaTeX 문법을 사용하세요 (인라인: $...$, 블록: $$...$$).',
  '2. 그래프나 그림이 필요한 문제는 텍스트로 상황을 설명하여 대체하세요.',
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
