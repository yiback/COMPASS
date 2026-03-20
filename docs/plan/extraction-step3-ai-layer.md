# Step 3: AI 타입 + 프롬프트 + GeminiProvider 상세 구현 계획 ✅

> **상태**: ✅ 구현 완료 (2026-03-20, 8개 파일, 38 신규 테스트, 300 AI 테스트 PASS)

> **소유 역할**: ai-integration
> **의존성**: 없음 (Step 1과 병렬 — Wave 1)
> **마스터 PLAN**: `docs/plan/20260308-past-exam-extraction.md` Step 3 + 타입 정의 섹션

---

## 파일 목록 (8개)

| # | 파일 | 상태 | 내용 |
|---|------|------|------|
| 1 | `src/lib/ai/types.ts` | 수정 | 신규 타입 + PromptConfig.imageParts + AIProvider.extractQuestions/reanalyzeQuestion |
| 2 | `src/lib/ai/extraction-validation.ts` | 신규 | 추출 전용 Zod 스키마 + JSON Schema + 검증 함수 |
| 3 | `src/lib/ai/prompts/question-extraction.ts` | 신규 | buildExtractionPrompt, buildReanalyzePrompt |
| 4 | `src/lib/ai/prompts/index.ts` | 수정 | 신규 프롬프트 빌더 re-export 추가 |
| 5 | `src/lib/ai/gemini.ts` | 수정 | extractQuestions, reanalyzeQuestion 메서드 + imageParts 분기 |
| 6 | `src/lib/ai/__tests__/extraction-validation.test.ts` | 신규 | Zod 스키마 검증 테스트 |
| 7 | `src/lib/ai/__tests__/prompts/question-extraction.test.ts` | 신규 | 프롬프트 빌더 테스트 |
| 8 | `src/lib/ai/__tests__/gemini.test.ts` | 수정 | extractQuestions/reanalyzeQuestion 테스트 추가 |

---

## Task 분해

### Task 3.1: 타입 정의 — `src/lib/ai/types.ts` 수정

기존 패턴: `readonly` 불변 필드, `as const satisfies Record<K, V>`, `ProviderType` union.

#### 3.1.1: ImagePart 타입 추가

```typescript
/** 이미지 데이터 (base64 인코딩) */
export interface ImagePart {
  readonly mimeType: string
  readonly data: string  // base64
}
```

#### 3.1.2: FigureInfo 타입 추가

```typescript
/**
 * 그래프/그림 crop 정보
 *
 * 기출 추출 + 향후 AI 문제 생성(Phase 2) 통합 인터페이스.
 * - 기출 추출: sharp crop → Storage 업로드 → url 저장
 * - AI 문제 생성 (Phase 2): AI SVG → sharp PNG 변환 → Storage 업로드 → url 저장
 */
export interface FigureInfo {
  readonly url: string | null       // Storage 경로 (crop 후), 실패 시 null
  readonly description: string      // AI가 생성한 설명
  readonly boundingBox: {
    readonly x: number              // 좌상단 x (normalized 0~1)
    readonly y: number              // 좌상단 y (normalized 0~1)
    readonly width: number          // 폭 (normalized 0~1)
    readonly height: number         // 높이 (normalized 0~1)
  }
  readonly pageNumber: number       // 원본 이미지 page_number
  readonly confidence: number       // bounding box 정확도
}
```

#### 3.1.3: ExtractedQuestion 타입 추가

```typescript
/** AI가 이미지에서 추출한 개별 문제 */
export interface ExtractedQuestion {
  readonly questionNumber: number
  readonly questionText: string
  readonly questionType: QuestionType
  readonly options?: readonly string[]
  readonly answer?: string
  readonly confidence: number       // 0.0 ~ 1.0
  readonly hasFigure: boolean
  readonly figures?: readonly FigureInfo[]
}
```

#### 3.1.4: ExtractQuestionParams / ExtractQuestionResult 타입 추가

```typescript
/** 추출 요청 — Action에서 base64 변환 완료 후 imageParts로 전달 */
export interface ExtractQuestionParams {
  readonly imageParts: readonly ImagePart[]
  readonly subject: string
  readonly grade: number
  readonly examType?: string
}

/** 추출 결과 */
export interface ExtractQuestionResult {
  readonly questions: readonly ExtractedQuestion[]
  readonly totalQuestions: number
  readonly overallConfidence: number
}
```

#### 3.1.5: ReanalyzeQuestionParams 타입 추가

```typescript
/** 재분석 요청 */
export interface ReanalyzeQuestionParams {
  readonly imageParts: readonly ImagePart[]
  readonly questionNumber: number
  readonly currentQuestion: ExtractedQuestion
  readonly userFeedback?: string
  readonly subject: string
  readonly grade: number
}
```

#### 3.1.6: PromptConfig 확장

기존 `PromptConfig`에 `imageParts` optional 필드 추가 (하위 호환 — Backward Compatibility).

```typescript
export interface PromptConfig {
  readonly systemInstruction: string
  readonly userPrompt: string
  readonly responseSchema: unknown
  readonly temperature: number
  readonly maxOutputTokens: number
  readonly imageParts?: readonly ImagePart[]  // 신규 — 이미지 포함 요청 시
}
```

#### 3.1.7: AIProvider 인터페이스 확장 (OCP)

기존 `processOCR` 유지 + 새 메서드 2개 추가.

```typescript
export interface AIProvider {
  readonly name: ProviderType

  generateQuestions(params: GenerateQuestionParams): Promise<readonly GeneratedQuestion[]>
  gradeAnswer(params: GradeAnswerParams): Promise<GradingResult>
  processOCR(params: OCRParams): Promise<OCRResult>  // 유지 (Phase 3)
  analyzeTrends(params: AnalyzeTrendsParams): Promise<ExamTrendAnalysis>

  // 신규 — 기출 추출
  // ⚠️ 구현 순서: 인터페이스 + GeminiProvider stub(throw 'Not implemented')를 가장 먼저 추가
  //    → 기존 테스트 컴파일 통과 → 이후 실제 구현으로 교체
  extractQuestions(params: ExtractQuestionParams): Promise<ExtractQuestionResult>
  reanalyzeQuestion(params: ReanalyzeQuestionParams): Promise<ExtractedQuestion>
}
```

---

### Task 3.2: Zod 스키마 — `src/lib/ai/extraction-validation.ts` 신규

기존 패턴: `validation.ts`와 동일 구조 (Zod 스키마 → JSON Schema 변환 → 2단계 검증).

```typescript
import { z } from 'zod'
import type { ExtractedQuestion, ExtractQuestionResult } from './types'
import { AIValidationError } from './errors'

// ─── Zod 스키마 ──────────────────────────────────────────

/** bounding box 스키마 (normalized 0~1) */
export const boundingBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
})

/** 그래프/그림 정보 스키마 */
export const figureInfoSchema = z.object({
  description: z.string().min(1),
  boundingBox: boundingBoxSchema,
  pageNumber: z.number().int().min(1),
  confidence: z.number().min(0).max(1),
})

/** AI가 추출한 단일 문제 스키마 */
export const extractedQuestionSchema = z.object({
  questionNumber: z.number().int().min(1),
  questionText: z.string().min(1),
  questionType: z.enum(['multiple_choice', 'short_answer', 'essay']),
  options: z.array(z.string()).optional(),
  answer: z.string().optional(),
  confidence: z.number().min(0).max(1),
  hasFigure: z.boolean(),
  figures: z.array(figureInfoSchema).optional(),
})

/** AI 추출 응답 전체 스키마 */
export const extractionResponseSchema = z.object({
  questions: z.array(extractedQuestionSchema),
})

// ─── JSON Schema 변환 (Gemini responseJsonSchema용) ──────

export const extractionJsonSchema = extractionResponseSchema.toJSONSchema()

// ─── 검증 함수 ───────────────────────────────────────────

/**
 * AI 추출 응답을 2단계로 검증하여 ExtractQuestionResult를 반환한다.
 *
 * 1단계: Zod safeParse (구문적 검증)
 * 2단계: 비즈니스 규칙 (객관식 보기, figures 일관성 등)
 */
export function validateExtractedQuestions(
  data: unknown,
): ExtractQuestionResult {
  // 1단계: Zod 구문적 검증
  const parsed = extractionResponseSchema.safeParse(data)

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }))
    throw new AIValidationError(
      'AI 추출 응답이 예상 형식과 일치하지 않습니다',
      details,
    )
  }

  // 2단계: 비즈니스 규칙 검증 + 결과 매핑
  const questions: ExtractedQuestion[] = parsed.data.questions.map((q) => {
    // 객관식인데 보기가 없으면 에러
    if (q.questionType === 'multiple_choice' && (!q.options || q.options.length === 0)) {
      throw new AIValidationError(
        `문제 ${q.questionNumber}: 객관식인데 보기가 없습니다`,
      )
    }

    // hasFigure=true인데 figures가 없으면 경고 (에러는 아님 — 부분 성공 허용)
    return {
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      questionType: q.questionType,
      options: q.options,
      answer: q.answer,
      confidence: q.confidence,
      hasFigure: q.hasFigure,
      figures: q.figures?.map((f) => ({
        url: null,  // crop 전이므로 null — Step 5에서 채움
        description: f.description,
        boundingBox: f.boundingBox,
        pageNumber: f.pageNumber,
        confidence: f.confidence,
      })),
    }
  })

  // overallConfidence: 전체 문제의 평균 confidence
  const totalConfidence = questions.reduce((sum, q) => sum + q.confidence, 0)
  const overallConfidence = questions.length > 0
    ? totalConfidence / questions.length
    : 0

  return {
    questions,
    totalQuestions: questions.length,
    overallConfidence,
  }
}
```

---

### Task 3.3: 추출 프롬프트 빌더 — `src/lib/ai/prompts/question-extraction.ts` 신규

기존 패턴: `question-generation.ts`와 동일 구조 (상수 분리, 헬퍼 함수, PromptConfig 반환).

```typescript
import type {
  ExtractQuestionParams,
  ReanalyzeQuestionParams,
  PromptConfig,
} from '../types'
import { extractionJsonSchema } from '../extraction-validation'

// ─── 상수 ──────────────────────────────────────────────────

const EXTRACTION_TEMPERATURE = 0.2  // 정확성 우선 (생성 0.7/0.8과 다름)
const DEFAULT_MAX_OUTPUT_TOKENS = 8192  // 다중 이미지 + 다수 문제 추출 시 충분한 토큰

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
```

---

### Task 3.4: 프롬프트 배럴 — `src/lib/ai/prompts/index.ts` 수정

기존 2개 export에 신규 2개 추가:

```typescript
export { buildQuestionGenerationPrompt } from './question-generation'
export { buildPastExamGenerationPrompt } from './past-exam-generation'
export { buildExtractionPrompt, buildReanalyzePrompt } from './question-extraction'
```

---

### Task 3.5: GeminiProvider 확장 — `src/lib/ai/gemini.ts` 수정

기존 패턴: `withRetry`, `convertSdkError`, `AIError` 계열 에러 처리, `prompt.userPrompt` → `contents`.

#### 3.5.1: import 추가

```typescript
import type {
  // 기존 import 유지
  ExtractQuestionParams,
  ExtractQuestionResult,
  ReanalyzeQuestionParams,
  ExtractedQuestion,
} from './types'
import { validateExtractedQuestions } from './extraction-validation'
import { buildExtractionPrompt, buildReanalyzePrompt } from './prompts/question-extraction'
```

#### 3.5.2: imageParts 분기 헬퍼 (private)

```typescript
/**
 * PromptConfig로부터 Gemini SDK의 contents를 구성한다.
 *
 * imageParts가 있으면 Part 배열 (이미지 + 텍스트),
 * 없으면 기존 동작 유지 (문자열).
 */
private buildContents(prompt: PromptConfig): string | Array<Record<string, unknown>> {
  if (!prompt.imageParts || prompt.imageParts.length === 0) {
    return prompt.userPrompt  // 기존 동작 유지
  }

  // imageParts가 있으면 Part 배열로 구성
  return [
    ...prompt.imageParts.map((img) => ({
      inlineData: { mimeType: img.mimeType, data: img.data },
    })),
    { text: prompt.userPrompt },
  ]
}
```

#### 3.5.3: 기존 generateQuestions 리팩토링

`contents: prompt.userPrompt` → `contents: this.buildContents(prompt)` 로 변경.
기존 호출에서 `imageParts`가 없으므로 기존 동작 그대로 유지.

#### 3.5.4: extractQuestions 메서드 (의사코드)

```typescript
async extractQuestions(
  params: ExtractQuestionParams,
): Promise<ExtractQuestionResult> {
  const prompt = buildExtractionPrompt(params)

  return withRetry(
    async () => {
      try {
        const response = await this.client.models.generateContent({
          model: this.model,
          contents: this.buildContents(prompt),  // imageParts 분기
          config: {
            systemInstruction: prompt.systemInstruction,
            responseMimeType: 'application/json',
            responseJsonSchema: prompt.responseSchema,
            temperature: prompt.temperature,
            maxOutputTokens: prompt.maxOutputTokens,
          },
          // SDK timeout 설정
          // requestOptions: { timeout: 120_000 },
        })

        const text = response.text
        if (text === undefined || text === null) {
          throw new AIValidationError('Gemini 응답에 텍스트가 없습니다')
        }

        let parsed: unknown
        try {
          parsed = JSON.parse(text)
        } catch {
          throw new AIValidationError('Gemini 응답을 JSON으로 파싱할 수 없습니다')
        }

        return validateExtractedQuestions(parsed)
      } catch (error) {
        if (error instanceof AIError) {
          throw error
        }
        throw convertSdkError(error)
      }
    },
    { maxRetries: this.maxRetries },
  )
}
```

#### 3.5.5: reanalyzeQuestion 메서드 (의사코드)

```typescript
async reanalyzeQuestion(
  params: ReanalyzeQuestionParams,
): Promise<ExtractedQuestion> {
  const prompt = buildReanalyzePrompt(params)

  return withRetry(
    async () => {
      try {
        const response = await this.client.models.generateContent({
          model: this.model,
          contents: this.buildContents(prompt),
          config: {
            systemInstruction: prompt.systemInstruction,
            responseMimeType: 'application/json',
            responseJsonSchema: prompt.responseSchema,
            temperature: prompt.temperature,
            maxOutputTokens: prompt.maxOutputTokens,
          },
        })

        const text = response.text
        if (text === undefined || text === null) {
          throw new AIValidationError('Gemini 응답에 텍스트가 없습니다')
        }

        let parsed: unknown
        try {
          parsed = JSON.parse(text)
        } catch {
          throw new AIValidationError('Gemini 응답을 JSON으로 파싱할 수 없습니다')
        }

        const result = validateExtractedQuestions(parsed)

        // 재분석은 1개 문제만 반환해야 함
        if (result.questions.length !== 1) {
          throw new AIValidationError(
            `재분석 결과에 ${result.questions.length}개 문제가 반환됨 (1개 기대)`,
          )
        }

        return result.questions[0]
      } catch (error) {
        if (error instanceof AIError) {
          throw error
        }
        throw convertSdkError(error)
      }
    },
    { maxRetries: this.maxRetries },
  )
}
```

---

### Task 3.6: 테스트 케이스 목록

#### 3.6.1: `extraction-validation.test.ts` (신규)

| # | 테스트 케이스 | 기대 결과 |
|---|------------|----------|
| 1 | 유효한 추출 응답 (객관식 + 단답형 + 서술형 혼합) | ExtractQuestionResult 반환 |
| 2 | 빈 questions 배열 | overallConfidence = 0, totalQuestions = 0 |
| 3 | confidence 범위 검증 (0.0, 0.5, 1.0 유효) | 통과 |
| 4 | confidence 범위 초과 (-0.1, 1.1) | AIValidationError |
| 5 | questionType 무효 값 ('fill_blank') | AIValidationError |
| 6 | 객관식인데 options 누락 | AIValidationError |
| 7 | figures 포함 (유효한 boundingBox) | figures 배열 반환, url = null |
| 8 | boundingBox 범위 초과 (x: 1.5) | AIValidationError |
| 9 | hasFigure = true, figures 없음 | 경고 없이 통과 (부분 성공) |
| 10 | overallConfidence 계산 정확도 | 문제별 confidence 평균 일치 |
| 11 | questionNumber 비정수 (1.5) | AIValidationError |
| 12 | pageNumber 비정수 (0) | AIValidationError |

#### 3.6.2: `prompts/question-extraction.test.ts` (신규)

| # | 테스트 케이스 | 기대 결과 |
|---|------------|----------|
| 1 | buildExtractionPrompt: 이미지 N장 지시 포함 | userPrompt에 "N장" 포함 |
| 2 | buildExtractionPrompt: 과목/학년 포함 | userPrompt에 과목/학년 문자열 포함 |
| 3 | buildExtractionPrompt: examType optional 생략 시 | userPrompt에 시험 유형 미포함 |
| 4 | buildExtractionPrompt: temperature = 0.2 | 반환값 temperature === 0.2 |
| 5 | buildExtractionPrompt: imageParts 전달 확인 | 반환값 imageParts === params.imageParts |
| 6 | buildExtractionPrompt: systemInstruction에 필수 키워드 | '페이지 경계', '학생', 'bounding box', 'LaTeX', 'confidence' 포함 |
| 7 | buildReanalyzePrompt: questionNumber 포함 | userPrompt에 "N번 문제" 포함 |
| 8 | buildReanalyzePrompt: 현재 추출 결과 포함 | userPrompt에 currentQuestion 내용 포함 |
| 9 | buildReanalyzePrompt: userFeedback 포함 | userPrompt에 피드백 문자열 포함 |
| 10 | buildReanalyzePrompt: userFeedback 없으면 섹션 생략 | '사용자 피드백' 미포함 |
| 11 | buildReanalyzePrompt: imageParts 전달 확인 | 반환값 imageParts === params.imageParts |

#### 3.6.3: `gemini.test.ts` (수정 — 기존 테스트에 추가)

| # | 테스트 케이스 | 기대 결과 |
|---|------------|----------|
| 1 | extractQuestions: multi-image mock → 정상 응답 | ExtractQuestionResult 반환 |
| 2 | extractQuestions: imageParts 있으면 inlineData Part 배열 구성 | SDK 호출 시 contents가 배열 |
| 3 | extractQuestions: AI 빈 응답 | AIValidationError |
| 4 | extractQuestions: JSON 파싱 실패 | AIValidationError |
| 5 | extractQuestions: Zod 검증 실패 | AIValidationError |
| 6 | extractQuestions: SDK 에러 (429) | AIRateLimitError |
| 7 | extractQuestions: SDK 에러 (500) | AIServiceError |
| 8 | extractQuestions: withRetry 재시도 동작 | 첫 실패 → 재시도 → 성공 |
| 9 | reanalyzeQuestion: 단일 문제 반환 | ExtractedQuestion 반환 |
| 10 | reanalyzeQuestion: 2개 문제 반환 시 에러 | AIValidationError |
| 11 | reanalyzeQuestion: AI 오류 처리 | AIServiceError |
| 12 | **기존 generateQuestions 무영향 확인** | imageParts 없으면 기존 동작 그대로 (문자열 contents) |
| 13 | buildContents: imageParts 없으면 문자열 반환 | typeof === 'string' |
| 14 | buildContents: imageParts 있으면 배열 반환 + 마지막 요소 text | Array.isArray + 마지막 요소에 text 포함 |

---

## 완료 기준 체크리스트

- [ ] `types.ts`: ImagePart, FigureInfo, ExtractedQuestion, ExtractQuestionParams, ExtractQuestionResult, ReanalyzeQuestionParams 6개 타입 추가
- [ ] `types.ts`: PromptConfig.imageParts optional 필드 추가 (하위 호환)
- [ ] `types.ts`: AIProvider에 extractQuestions, reanalyzeQuestion 메서드 추가
- [ ] `extraction-validation.ts`: Zod 스키마 4개 (boundingBox, figureInfo, extractedQuestion, extractionResponse) + JSON Schema + 검증 함수
- [ ] `prompts/question-extraction.ts`: buildExtractionPrompt, buildReanalyzePrompt 2개 함수
- [ ] `prompts/index.ts`: 신규 빌더 re-export 추가
- [ ] `gemini.ts`: extractQuestions, reanalyzeQuestion 2개 메서드 + buildContents 헬퍼
- [ ] `gemini.ts`: 기존 generateQuestions에 buildContents 적용 (기존 동작 무영향)
- [ ] 테스트: extraction-validation 12개 + prompts 11개 + gemini 14개 = 총 37개 이상
- [ ] 모든 테스트 통과 (`npx vitest run src/lib/ai/`)
- [ ] temperature 0.2 확인 (추출 전용 — 정확성 우선)

---

## 리스크

| 리스크 | 영향 | 확률 | 완화 방안 |
|--------|------|------|----------|
| Gemini Vision multi-image 실제 동작 미검증 | High | Medium | Mock 테스트로 인터페이스 검증 + Step 5 통합 시 실제 API 테스트 |
| inlineData base64 크기 제한 | Medium | Medium | Step 4에서 이미지 수 20장/개별 5MB/총 100MB 사전 검증 |
| `response.text`가 null인 경우 | Medium | Low | AIValidationError로 명시적 처리 |
| Zod toJSONSchema() 호환성 | Low | Low | 기존 validation.ts에서 동일 패턴 사용 중 (검증 완료) |
| AIProvider 인터페이스 변경 → 기존 테스트 깨짐 | Medium | 확정 | GeminiProvider에 stub 메서드 추가로 컴파일 통과시킨 후 구현 |
