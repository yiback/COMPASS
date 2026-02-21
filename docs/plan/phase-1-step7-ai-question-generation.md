# 1-7 기출 기반 AI 문제 생성 [F011] 구현 계획

> **진행률**: 3/5 Steps (60%)
> **마지막 업데이트**: 2026-02-21
> **상태**: 🚧 진행 중

| Step | 내용 | 상태 |
|------|------|------|
| Step 1 | 타입 확장 + Zod 스키마 (TDD) | ✅ 완료 (369 tests PASS) |
| Step 2 | 프롬프트 빌더 — buildPastExamGenerationPrompt (TDD) | ✅ 완료 (383 tests PASS) |
| Step 3 | Server Action + GeminiProvider 통합 (TDD) | ✅ 완료 (404 tests PASS) |
| Step 4 | UI — 생성 다이얼로그 + 결과 표시 | 미시작 |
| Step 5 | 빌드 검증 + 학습 리뷰 (~404+ tests 예상) | 미시작 |

---

## Context

0-5에서 AI 추상화 레이어(Factory + Strategy, GeminiProvider, retry, validation, prompts)를 완성했고, 1-6에서 기출문제 CRUD(목록/상세 조회, Signed URL)를 완성했다. 이 두 인프라를 **결합**하여, 기출문제 상세 화면에서 "AI 문제 생성" 버튼을 누르면 해당 기출의 메타데이터(+ extracted_content가 있으면 활용)를 기반으로 AI가 유사 문제를 생성하는 기능을 구현한다.

**핵심 설계 결정 (확정)**:
1. Gemini Vision(이미지 직접 분석)은 Phase 3 OCR로 연기 — MVP에서는 **텍스트 기반만**
2. `GenerateQuestionParams`에 optional `pastExamContext` 추가 — **하위 호환**
3. 생성 결과는 **화면 표시만**, DB 저장은 1-8에서 구현
4. **교사/관리자만** 문제 생성 가능
5. `extracted_content`가 있으면 활용, 없으면 메타데이터만으로 생성

---

## MVP 범위

| 포함 | 제외 (후순위) |
|------|-------------|
| 기출문제 상세 Sheet에서 "AI 문제 생성" 버튼 | 생성 결과 DB 저장 (1-8) |
| 문제 유형/난이도/문제 수 선택 다이얼로그 | 성취기준 기반 생성 (Phase 2 F001) |
| 메타데이터 + extracted_content 기반 프롬프트 | Gemini Vision/이미지 분석 (Phase 3) |
| 생성 결과 카드 형태 표시 | 문제 편집/수정 UI |
| 교사/관리자 권한 체크 | 학생/학부모 접근 |
| 최대 10문제 제한 (API 비용 관리) | 대량 생성 |

---

## Step 1: 타입 확장 + Zod 스키마 (TDD)

### 개요

기존 AI 타입 시스템에 `PastExamContext` 인터페이스를 추가하고, `GenerateQuestionParams`에 optional `pastExamContext` 필드를 추가한다. 별도로 문제 생성 요청 검증용 Zod 스키마를 신규 파일에 생성한다.

### 수정 파일

**1. `src/lib/ai/types.ts`** — PastExamContext 인터페이스 + GenerateQuestionParams 확장

```typescript
// ─── 기출 컨텍스트 (1-7 추가) ────────────────────────────

/** 기출문제 참고 AI 문제 생성 시 전달되는 컨텍스트 */
export interface PastExamContext {
  readonly pastExamId: string
  readonly schoolName: string
  readonly year: number
  readonly semester: number
  readonly examType: string
  readonly extractedContent?: string   // OCR 추출 또는 수동 입력된 기출 내용
}
```

`GenerateQuestionParams`에 추가:
```typescript
export interface GenerateQuestionParams {
  // ... 기존 필드 유지
  readonly pastExamContext?: PastExamContext  // 1-7 추가: 기출 기반 생성 시
}
```

**2. `src/lib/ai/index.ts`** — PastExamContext export 추가

```typescript
export type {
  // ... 기존 export
  PastExamContext,   // 1-7 추가
} from './types'
```

### 새로 생성

**3. `src/lib/validations/generate-questions.ts`** — 문제 생성 요청 Zod 스키마

```typescript
import { z } from 'zod'

/** 문제 생성 요청 최대 문제 수 (API 비용 관리) */
export const MAX_QUESTION_COUNT = 10

export const generateQuestionsRequestSchema = z.object({
  pastExamId: z.string().uuid('기출문제 ID가 유효하지 않습니다.'),
  questionType: z.enum(['multiple_choice', 'short_answer', 'essay'], {
    errorMap: () => ({ message: '문제 유형을 선택해주세요.' }),
  }),
  difficulty: z.enum(['easy', 'medium', 'hard'], {
    errorMap: () => ({ message: '난이도를 선택해주세요.' }),
  }),
  count: z.coerce
    .number()
    .int()
    .min(1, '최소 1문제 이상이어야 합니다.')
    .max(MAX_QUESTION_COUNT, `최대 ${MAX_QUESTION_COUNT}문제까지 생성 가능합니다.`),
})

export type GenerateQuestionsRequest = z.infer<typeof generateQuestionsRequestSchema>
```

### TDD 테스트

**4. `src/lib/validations/__tests__/generate-questions.test.ts`** (~15개)

```
describe('generateQuestionsRequestSchema')

  describe('pastExamId')
    1. 유효 UUID 통과
    2. 유효하지 않은 UUID 거부
    3. 빈 문자열 거부

  describe('questionType')
    4. 유효한 문제 유형 전체 순회 (it.each: 3종)
    5. 유효하지 않은 문제 유형 거부 (questionType='quiz')

  describe('difficulty')
    6. 유효한 난이도 전체 순회 (it.each: 3종)
    7. 유효하지 않은 난이도 거부 (difficulty='extreme')

  describe('count')
    8. 유효 문제 수 통과 (count=5)
    9. 문자열 -> 숫자 coerce ('3' -> 3)
    10. 0 이하 거부 (count=0, count=-1)
    11. 최대값 초과 거부 (count=11)
    12. 소수점 거부 (count=2.5)

  describe('복합 검증')
    13. 모든 필드 동시 유효
    14. 스키마에 없는 필드 strip 제거 (userId, role 등)

  describe('MAX_QUESTION_COUNT')
    15. 상수 값이 10이어야 함
```

**5. `src/lib/ai/__tests__/types.test.ts`** — 기존 테스트에 PastExamContext 타입 테스트 추가 (~3개)

```
describe('PastExamContext 타입 호환성')
  16. pastExamContext가 없는 GenerateQuestionParams가 유효해야 함 (하위 호환)
  17. pastExamContext가 있는 GenerateQuestionParams가 유효해야 함
  18. extractedContent가 없는 PastExamContext가 유효해야 함
```

### 설계 결정 근거

| 결정 | 근거 |
|------|------|
| `PastExamContext`를 별도 인터페이스로 분리 | `GenerateQuestionParams`의 필드 수가 과도하게 늘어나는 것 방지. 관심사 분리 |
| `pastExamContext`를 optional | 기존 성취기준 기반 생성(Phase 2)과 하위 호환. 기존 테스트 영향 없음 |
| Zod 스키마를 `validations/generate-questions.ts`에 신규 생성 | `past-exams.ts`는 업로드/필터 도메인. 문제 생성은 별도 도메인 |
| `MAX_QUESTION_COUNT = 10` 상수 export | UI에서도 참조하여 Select 옵션 제한에 사용 |
| `questionType`에 AI 타입(`essay`) 사용 | AI 프롬프트에는 `essay`, DB 저장(1-8)에서 `toDbQuestionType`으로 변환 |

### 리스크

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| `types.ts` 수정 시 기존 테스트 영향 | **낮음** | optional 필드 추가이므로 기존 코드 무영향 |
| `z.coerce.number()` + 빈 문자열 | **낮음** | 1-6에서 학습한 패턴. Server Action에서 sanitize 처리 |

### 파일 변경 요약

| 작업 | 파일 | 변경 |
|------|------|------|
| 수정 | `src/lib/ai/types.ts` | PastExamContext + GenerateQuestionParams.pastExamContext? (~15줄) |
| 수정 | `src/lib/ai/index.ts` | PastExamContext export 추가 (~1줄) |
| 신규 | `src/lib/validations/generate-questions.ts` | Zod 스키마 + 상수 (~30줄) |
| 신규 | `src/lib/validations/__tests__/generate-questions.test.ts` | 테스트 ~15개 (~120줄) |
| 수정 | `src/lib/ai/__tests__/types.test.ts` | PastExamContext 호환성 테스트 ~3개 추가 (~20줄) |

### 성공 기준

- [x] `npx vitest run src/lib/validations/__tests__/generate-questions.test.ts` — 19개 전체 PASS
- [x] `npx vitest run src/lib/ai/__tests__/types.test.ts` — 11개 전체 PASS (기존 8 + 신규 3)
- [x] `npx vitest run src/lib/ai/__tests__/` — 기존 AI 테스트 회귀 없음
- [x] 기존 `GenerateQuestionParams` 사용처에서 타입 에러 없음

**완료 요약**: PastExamContext 인터페이스 + GenerateQuestionParams 확장 + generateQuestionsRequestSchema Zod 스키마 구현. `z.enum`의 `errorMap` → `message` 파라미터로 수정 (Zod 최신 버전 호환). 전체 369 tests PASS, 회귀 없음.

---

## Step 2: 프롬프트 빌더 — buildPastExamGenerationPrompt (TDD)

### 개요

기출문제 기반 문제 생성 전용 프롬프트 빌더를 신규 파일에 구현한다. 기존 `buildQuestionGenerationPrompt`와 **별도 함수**로 분리하되, `questionsJsonSchema` (Zod 기반 응답 스키마)는 재사용한다.

### 프롬프트 설계 전략

기존 `buildQuestionGenerationPrompt`와의 차이:

| 항목 | 기존 (성취기준 기반) | 신규 (기출 기반) |
|------|---------------------|-----------------|
| systemInstruction | "시험 출제 전문가" | "기출문제 분석 + 유사 문제 생성 전문가" |
| 컨텍스트 | 과목/학년/단원 | 학교명/연도/학기/시험유형 + extracted_content |
| 핵심 지시 | "교육과정에 맞는 문제" | "기출 스타일·난이도·범위를 반영한 유사 문제" |
| temperature | 0.7 | 0.8 (기출 참고하되 다양성 확보) |
| responseSchema | questionsJsonSchema | questionsJsonSchema (동일) |

### 새로 생성

**1. `src/lib/ai/prompts/past-exam-generation.ts`**

```typescript
import type { GenerateQuestionParams, PromptConfig, QuestionType } from '../types'
import { questionsJsonSchema } from '../validation'

const DEFAULT_TEMPERATURE = 0.8    // 기출 참고 + 다양성
const DEFAULT_MAX_OUTPUT_TOKENS = 4096

const QUESTION_TYPE_LABELS = {
  multiple_choice: '객관식(5지선다형)',
  short_answer: '단답형',
  essay: '서술형',
} as const satisfies Record<QuestionType, string>

const SYSTEM_INSTRUCTION = [
  '당신은 한국 중·고등학교 기출문제 분석 및 유사 문제 생성 전문가입니다.',
  '아래 기출문제 정보를 분석하고, 해당 학교 시험 스타일에 맞는 유사 문제를 생성하세요.',
  '다음 규칙을 반드시 준수하세요:',
  '1. 수식은 반드시 LaTeX 문법을 사용하세요 (인라인: $...$, 블록: $$...$$).',
  '2. 그래프나 그림이 필요한 문제는 텍스트로 상황을 설명하여 대체하세요.',
  '3. 기출문제와 유사한 난이도, 출제 범위, 스타일을 유지하되, 동일한 문제를 반복하지 마세요.',
  '4. 각 문제에 정답과 상세한 풀이를 반드시 포함하세요.',
  '5. 해당 학교 시험의 출제 경향(문제 길이, 보기 스타일, 서술 난이도)을 반영하세요.',
].join('\n')

const EXAM_TYPE_LABELS: Record<string, string> = {
  midterm: '중간고사',
  final: '기말고사',
  mock: '모의고사',
  diagnostic: '진단평가',
}

/**
 * 기출 기반 문제 생성용 PromptConfig를 빌드한다.
 *
 * pastExamContext가 있으면 기출 스타일 반영 프롬프트를 생성하고,
 * extractedContent가 있으면 기출 내용을 직접 참고할 수 있도록 프롬프트에 포함한다.
 */
export function buildPastExamGenerationPrompt(
  params: GenerateQuestionParams,
): PromptConfig {
  const { pastExamContext } = params

  const lines: string[] = [
    '=== 기출문제 참고 정보 ===',
  ]

  if (pastExamContext) {
    lines.push(`학교: ${pastExamContext.schoolName}`)
    lines.push(`연도: ${pastExamContext.year}년`)
    lines.push(`학기: ${pastExamContext.semester}학기`)
    lines.push(`시험유형: ${EXAM_TYPE_LABELS[pastExamContext.examType] ?? pastExamContext.examType}`)
  }

  lines.push('')
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

  // extractedContent가 있으면 기출 내용 직접 참고
  if (pastExamContext?.extractedContent) {
    lines.push('')
    lines.push('=== 기출문제 내용 (참고) ===')
    lines.push(pastExamContext.extractedContent)
    lines.push('')
    lines.push('위 기출문제의 스타일, 난이도, 문제 형식을 참고하여 유사하지만 새로운 문제를 생성하세요.')
  } else {
    lines.push('')
    lines.push('기출문제 원본 내용이 없으므로, 위 메타데이터(학교, 학년, 시험유형)를 참고하여')
    lines.push('해당 학교 수준에 적합한 문제를 생성하세요.')
  }

  return {
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt: lines.join('\n'),
    responseSchema: questionsJsonSchema,
    temperature: DEFAULT_TEMPERATURE,
    maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
  }
}
```

**2. `src/lib/ai/prompts/index.ts`** — export 추가

```typescript
export { buildQuestionGenerationPrompt } from './question-generation'
export { buildPastExamGenerationPrompt } from './past-exam-generation'
```

### TDD 테스트

**3. `src/lib/ai/__tests__/prompts/past-exam-generation.test.ts`** (~14개)

```
describe('buildPastExamGenerationPrompt')

  describe('반환 형식')
    1. PromptConfig의 5개 필드를 모두 포함해야 한다

  describe('systemInstruction')
    2. 기출문제 분석 전문가 역할 정의를 포함해야 한다
    3. LaTeX 수식 사용 지시를 포함해야 한다
    4. '유사 문제' 또는 '유사한' 키워드를 포함해야 한다
    5. 출제 경향 반영 지시를 포함해야 한다

  describe('userPrompt - 기출 컨텍스트')
    6. pastExamContext가 있으면 학교명을 포함해야 한다
    7. pastExamContext가 있으면 연도/학기를 포함해야 한다
    8. pastExamContext가 있으면 시험유형을 한글로 포함해야 한다 (midterm → 중간고사)
    9. extractedContent가 있으면 기출 내용을 포함해야 한다
    10. extractedContent가 없으면 메타데이터 기반 안내 메시지를 포함해야 한다

  describe('userPrompt - 생성 조건')
    11. 과목/학년/문제유형/난이도/문제수를 포함해야 한다
    12. unit이 있으면 포함해야 한다

  describe('기본값')
    13. temperature는 0.8이어야 한다 (기존 0.7과 차이)
    14. responseSchema는 questionsJsonSchema와 같아야 한다
```

### 설계 결정 근거

| 결정 | 근거 |
|------|------|
| 별도 프롬프트 빌더 함수 분리 | 기존 `buildQuestionGenerationPrompt`를 변경하면 0-5의 테스트 18개에 영향. SRP 원칙 |
| temperature 0.8 | 기출 참고하되 동일 문제 반복 방지를 위한 약간 높은 다양성 |
| `EXAM_TYPE_LABELS` 별도 정의 | UI constants.ts의 것과 용도가 다름 (프롬프트용 한글). 재사용보다 독립성 우선 |
| extractedContent 유무에 따른 분기 | 기출 원본이 없어도 메타데이터만으로 적절한 문제 생성 가능하도록 |

### 파일 변경 요약

| 작업 | 파일 | 변경 |
|------|------|------|
| 신규 | `src/lib/ai/prompts/past-exam-generation.ts` | 프롬프트 빌더 (~80줄) |
| 수정 | `src/lib/ai/prompts/index.ts` | export 추가 (~1줄) |
| 신규 | `src/lib/ai/__tests__/prompts/past-exam-generation.test.ts` | 테스트 ~14개 (~140줄) |

### 성공 기준

- [x] `npx vitest run src/lib/ai/__tests__/prompts/past-exam-generation.test.ts` — 14개 전체 PASS
- [x] `npx vitest run src/lib/ai/__tests__/prompts/question-generation.test.ts` — 16개 기존 회귀 없음
- [x] extractedContent 유무에 따른 프롬프트 분기 테스트 통과
- [x] temperature가 0.8로 설정됨 확인

**완료 요약**: `buildPastExamGenerationPrompt` 함수를 신규 파일에 구현. 기존 `buildQuestionGenerationPrompt`와 별도 분리(SRP). `questionsJsonSchema` 재사용, temperature 0.8, EXAM_TYPE_LABELS 독립 정의, extractedContent 유무 분기. TDD RED→GREEN→REFACTOR 준수. 전체 383 tests PASS, 회귀 없음.

---

## Step 3: Server Action + GeminiProvider 통합 (TDD)

### 개요

기출문제 기반 AI 문제 생성 Server Action(`generateQuestionsFromPastExam`)을 신규 파일에 구현한다. 기존 `getPastExamDetail`로 기출 데이터를 조회하고, `createAIProvider`로 AI를 호출하여 결과를 반환한다.

GeminiProvider의 `generateQuestions` 메서드에서 `pastExamContext` 유무에 따라 프롬프트 빌더를 분기한다.

### 수정 파일

**1. `src/lib/ai/gemini.ts`** — pastExamContext 분기 로직 추가

```typescript
import { buildPastExamGenerationPrompt } from './prompts/past-exam-generation'

async generateQuestions(
  params: GenerateQuestionParams,
): Promise<readonly GeneratedQuestion[]> {
  // pastExamContext 유무에 따라 프롬프트 빌더 분기
  const prompt = params.pastExamContext
    ? buildPastExamGenerationPrompt(params)
    : buildQuestionGenerationPrompt(params)

  // 이하 기존 로직 동일 (withRetry + API 호출 + 검증)
  ...
}
```

변경 범위: import 1줄 추가 + 프롬프트 빌드 라인 1줄 → 3줄 (3줄 순증가, 기존 동작 무영향)

### 새로 생성

**2. `src/lib/actions/generate-questions.ts`** — Server Action

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { generateQuestionsRequestSchema } from '@/lib/validations/generate-questions'
import { createAIProvider } from '@/lib/ai'
import type { GeneratedQuestion, PastExamContext } from '@/lib/ai'
import { AIError } from '@/lib/ai'

// ─── 반환 타입 ──────────────────────────────────────────

export interface GenerateQuestionsResult {
  readonly error?: string
  readonly data?: readonly GeneratedQuestion[]
}

// ─── 헬퍼 함수 ──────────────────────────────────────────

interface AuthorizedUser {
  readonly id: string
  readonly role: string
  readonly academyId: string
}

interface AuthCheckResult {
  readonly error?: string
  readonly user?: AuthorizedUser
}

/**
 * 현재 사용자 인증 + 교사/관리자 권한 확인
 */
async function checkTeacherOrAdmin(): Promise<AuthCheckResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: '인증이 필요합니다.' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, academy_id')
    .eq('id', user.id)
    .single() as {
      data: { id: string; role: string; academy_id: string | null } | null
      error: unknown
    }

  if (profileError || !profile) {
    return { error: '프로필을 찾을 수 없습니다.' }
  }

  if (!profile.academy_id) {
    return { error: '소속 학원이 없습니다.' }
  }

  if (!['teacher', 'admin', 'system_admin'].includes(profile.role)) {
    return { error: 'AI 문제 생성 권한이 없습니다. 교사 또는 관리자만 사용할 수 있습니다.' }
  }

  return {
    user: {
      id: profile.id,
      role: profile.role,
      academyId: profile.academy_id,
    },
  }
}

// ─── Server Action ──────────────────────────────────────

/**
 * 기출문제 기반 AI 문제 생성
 *
 * 흐름:
 * 1. 인증 + 권한 확인 (교사/관리자만)
 * 2. 입력값 검증 (Zod)
 * 3. 기출문제 상세 조회 (메타데이터 + extractedContent)
 * 4. PastExamContext 조립
 * 5. AI Provider 호출 (createAIProvider → generateQuestions)
 * 6. 결과 반환 (GeneratedQuestion[])
 *
 * DB 저장은 1-8에서 구현. 이 Action은 생성 결과만 반환한다.
 */
export async function generateQuestionsFromPastExam(
  rawInput: Record<string, unknown>
): Promise<GenerateQuestionsResult> {
  // 1. 인증 + 권한
  const { error: authError, user } = await checkTeacherOrAdmin()
  if (authError || !user) {
    return { error: authError }
  }

  // 2. 입력값 검증
  const parsed = generateQuestionsRequestSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }
  }

  const { pastExamId, questionType, difficulty, count } = parsed.data

  // 3. 기출문제 조회 (직접 DB 쿼리 — getPastExamDetail은 signedUrl 불필요)
  const supabase = await createClient()
  const { data: pastExam, error: dbError } = await supabase
    .from('past_exam_questions')
    .select(`
      id, year, semester, exam_type, grade, subject, extracted_content,
      schools!inner ( name )
    `)
    .eq('id', pastExamId)
    .single() as {
      data: {
        id: string
        year: number
        semester: number
        exam_type: string
        grade: number
        subject: string
        extracted_content: string | null
        schools: { name: string }
      } | null
      error: unknown
    }

  if (dbError || !pastExam) {
    return { error: '기출문제를 찾을 수 없습니다.' }
  }

  // 4. PastExamContext 조립
  const pastExamContext: PastExamContext = {
    pastExamId: pastExam.id,
    schoolName: pastExam.schools.name,
    year: pastExam.year,
    semester: pastExam.semester,
    examType: pastExam.exam_type,
    ...(pastExam.extracted_content
      ? { extractedContent: pastExam.extracted_content }
      : {}),
  }

  // 5. AI Provider 호출
  try {
    const provider = createAIProvider()
    const questions = await provider.generateQuestions({
      subject: pastExam.subject,
      grade: pastExam.grade,
      questionType,
      difficulty,
      count,
      schoolName: pastExam.schools.name,
      pastExamContext,
    })

    return { data: questions }
  } catch (error) {
    if (error instanceof AIError) {
      return { error: `AI 문제 생성 실패: ${error.message}` }
    }
    return { error: 'AI 문제 생성 중 알 수 없는 오류가 발생했습니다.' }
  }
}
```

### TDD 테스트

**3. `src/lib/actions/__tests__/generate-questions.test.ts`** (~18개)

```
describe('generateQuestionsFromPastExam')

  describe('인증 + 권한')
    1. 비인증 사용자 → 에러 '인증이 필요합니다.'
    2. 프로필 없음 → 에러 '프로필을 찾을 수 없습니다.'
    3. academy_id 없음 → 에러 '소속 학원이 없습니다.'
    4. student 역할 → 에러 'AI 문제 생성 권한이 없습니다.'
    5. teacher 역할 → 인증 통과
    6. admin 역할 → 인증 통과

  describe('입력값 검증')
    7. 유효하지 않은 pastExamId → 에러
    8. 유효하지 않은 questionType → 에러
    9. count 범위 초과(11) → 에러

  describe('기출문제 조회')
    10. 존재하지 않는 pastExamId → 에러 '기출문제를 찾을 수 없습니다.'

  describe('AI 문제 생성 성공')
    11. 유효 입력 → GeneratedQuestion[] 반환
    12. pastExamContext에 schoolName, year, semester 포함 확인
    13. extracted_content가 있으면 pastExamContext.extractedContent에 포함
    14. extracted_content가 없으면 pastExamContext.extractedContent 없음

  describe('AI 에러 처리')
    15. AIServiceError → 에러 메시지 반환 (throw하지 않음)
    16. AIValidationError → 에러 메시지 반환
    17. AIRateLimitError → 에러 메시지 반환
    18. 일반 Error → '알 수 없는 오류' 메시지 반환
```

**4. `src/lib/ai/__tests__/gemini.test.ts`** — pastExamContext 분기 테스트 추가 (~3개)

```
describe('generateQuestions - pastExamContext 분기')
  19. pastExamContext가 없으면 기존 프롬프트 빌더 사용 (기존 동작 유지)
  20. pastExamContext가 있으면 기출 기반 프롬프트 빌더 사용
  21. pastExamContext가 있어도 API 응답 형식은 동일 (questionsJsonSchema)
```

### 설계 결정 근거

| 결정 | 근거 |
|------|------|
| Server Action 별도 파일 (`generate-questions.ts`) | `past-exams.ts`는 이미 425줄. 관심사도 다름 (조회 vs 생성) |
| `getPastExamDetail` 재사용 대신 직접 DB 조회 | Signed URL 생성 불필요, SELECT 컬럼도 다름 (extracted_content 필요, source_image_url 불필요) |
| AIError catch → 에러 메시지 반환 (throw하지 않음) | Server Action에서 throw하면 클라이언트에서 처리 어려움. `{ error: string }` 패턴 유지 |
| `checkTeacherOrAdmin` 헬퍼 | `getCurrentUserProfile`과 역할 체크를 결합. 3회 반복 규칙은 아직 미달이므로 복사 |

### 파일 변경 요약

| 작업 | 파일 | 변경 |
|------|------|------|
| 수정 | `src/lib/ai/gemini.ts` | pastExamContext 분기 (~3줄 변경, 1줄 import 추가) |
| 신규 | `src/lib/actions/generate-questions.ts` | Server Action (~120줄) |
| 신규 | `src/lib/actions/__tests__/generate-questions.test.ts` | 테스트 ~18개 (~300줄) |
| 수정 | `src/lib/ai/__tests__/gemini.test.ts` | pastExamContext 분기 테스트 ~3개 추가 (~40줄) |

### 성공 기준

- [x] `npx vitest run src/lib/actions/__tests__/generate-questions.test.ts` — 18개 전체 PASS
- [x] `npx vitest run src/lib/ai/__tests__/gemini.test.ts` — 21개 전체 PASS (기존 18 + 신규 3)
- [x] 교사/관리자만 생성 가능 확인 (테스트 4~6)
- [x] AIError 계열 에러가 사용자 친화적 메시지로 변환됨 확인 (테스트 15~18)
- [x] extracted_content 유무에 따른 정상 동작 확인 (테스트 13~14)

**완료 요약**: gemini.ts에 pastExamContext 분기 3줄 추가 + generateQuestionsFromPastExam Server Action 신규 구현. vi.importActual 부분 mock 패턴, from() mockImplementation 테이블 분기, 조건부 스프레드 null→key부재 변환 패턴 적용. TDD RED→GREEN→REFACTOR 준수. 전체 404 tests PASS, 회귀 없음.

---

## Step 4: UI — 생성 다이얼로그 + 결과 표시

### 개요

기출문제 상세 Sheet에 "AI 문제 생성" 버튼을 추가하고, Dialog에서 생성 옵션을 선택 후 AI 문제를 생성·표시한다. 생성 결과는 **화면에만 표시** (DB 저장은 1-8).

### 수정 파일

**1. `src/app/(dashboard)/past-exams/_components/past-exam-detail-sheet.tsx`**

변경 사항:
- "AI 문제 생성" 버튼 추가 (교사/관리자만 표시 — props로 `callerRole` 전달)
- 버튼 클릭 시 `GenerateQuestionsDialog` 열기

```typescript
interface PastExamDetailSheetProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly examId: string
  readonly callerRole?: string   // 1-7 추가: 교사/관리자만 버튼 표시
}

// 상세 정보 아래에 버튼 추가
{detail && !loading && isTeacherOrAbove && (
  <Button onClick={() => setDialogOpen(true)}>
    AI 문제 생성
  </Button>
)}

// Dialog 연동
<GenerateQuestionsDialog
  open={dialogOpen}
  onOpenChange={setDialogOpen}
  pastExamId={examId}
  pastExamDetail={detail}
/>
```

### 새로 생성

**2. `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx`** (~200줄)

핵심 구성:
- **Dialog 형태**: shadcn/ui Dialog
- **입력 폼**: 문제 유형(Select), 난이도(Select), 문제 수(Select: 1~10)
- **생성 버튼**: `useTransition`으로 중복 클릭 방지 + 로딩 표시
- **결과 표시**: 문제 카드 형태 (ScrollArea 내부)
- **에러 처리**: toast 알림

```typescript
'use client'

import { useState, useTransition } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { generateQuestionsFromPastExam } from '@/lib/actions/generate-questions'
import type { GeneratedQuestion } from '@/lib/ai'
import type { PastExamDetail } from '@/lib/actions/past-exams'
import { MAX_QUESTION_COUNT } from '@/lib/validations/generate-questions'

// 선택 옵션 상수
const QUESTION_TYPE_OPTIONS = [
  { value: 'multiple_choice', label: '객관식(5지선다)' },
  { value: 'short_answer', label: '단답형' },
  { value: 'essay', label: '서술형' },
] as const

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: '쉬움' },
  { value: 'medium', label: '보통' },
  { value: 'hard', label: '어려움' },
] as const

const DIFFICULTY_BADGE_VARIANT: Record<string, string> = {
  easy: 'secondary',
  medium: 'default',
  hard: 'destructive',
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '쉬움',
  medium: '보통',
  hard: '어려움',
}
```

### 설계 결정 근거

| 결정 | 근거 |
|------|------|
| Dialog (Sheet가 아닌 별도 Dialog) | Sheet 안에서 다시 Sheet를 여는 것은 UX 혼란. Dialog는 Sheet 위에 오버레이 |
| `useTransition` 사용 | Server Action 호출 + 중복 클릭 방지. 기존 패턴 (1-5에서 학습) |
| 문제 수 Select (Input이 아닌) | 1~10 고정 범위. 자유 입력보다 선택이 실수 방지 |
| QuestionCard 같은 파일 | 200줄 이내이고 이 파일에서만 사용. 별도 파일로 분리할 이유 없음 |
| `callerRole` props 전달 | 서버에서 역할 확인 후 클라이언트로 전달. 클라이언트에서 재조회하지 않음 |

### 파일 변경 요약

| 작업 | 파일 | 변경 |
|------|------|------|
| 신규 | `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` | 생성 다이얼로그 (~200줄) |
| 수정 | `src/app/(dashboard)/past-exams/_components/past-exam-detail-sheet.tsx` | "AI 문제 생성" 버튼 + Dialog 연동 (~20줄 추가) |
| 수정 | `src/app/(dashboard)/past-exams/page.tsx` | callerRole 전달 경로 조정 (~5줄 변경) |

### 성공 기준

- [ ] "AI 문제 생성" 버튼이 교사/관리자에게만 표시
- [ ] 생성 옵션 선택 후 생성 버튼 클릭 시 AI 호출
- [ ] 로딩 상태 표시 (버튼 disabled + "생성 중...")
- [ ] 생성 결과가 카드 형태로 표시
- [ ] 에러 시 toast 알림
- [ ] 기존 Sheet 기능(상세 조회, 이미지 미리보기) 회귀 없음

---

## Step 5: 빌드 검증 + 학습 리뷰

### 검증 명령

```bash
npx vitest run                     # 전체 테스트 — 현재 383 + Step 3 ~21 = ~404 PASS
npm run lint                       # lint 에러 0개
npm run build                      # Next.js 빌드 성공
```

### 학습 리뷰 포인트

| 개념 | 등급 | 설명 |
|------|------|------|
| Factory + Strategy 패턴 (실전 적용) | 🔴 | 0-5에서 구축한 패턴을 실제로 **사용**하는 첫 번째 기능. createAIProvider → generateQuestions 흐름 이해 |
| 프롬프트 엔지니어링 (기출 컨텍스트) | 🔴 | systemInstruction vs userPrompt 역할 분리, extractedContent 유무에 따른 분기 |
| Server Action에서 AI 호출 패턴 | 🟡 | 인증 → 검증 → DB 조회 → AI 호출 → 결과 반환. AIError catch → 사용자 메시지 변환 |
| useTransition + Server Action | 🟢 | 1-5에서 이미 학습한 패턴. 복습 |
| Zod 스키마와 AI 타입 연동 | 🟡 | QuestionType(AI)과 generateQuestionsRequestSchema(Zod)의 관계 |

### 이해도 질문 (사용자 답변 대기)

1. `buildPastExamGenerationPrompt`와 `buildQuestionGenerationPrompt`를 **하나의 함수로 합치지 않고 분리한 이유**는 무엇인가?
2. Server Action에서 AIError를 `throw`하지 않고 `{ error: string }`으로 반환하는 **이유**는?
3. `GenerateQuestionParams`에 `pastExamContext`를 **optional로 추가**한 것은 어떤 원칙을 지키기 위한 것인가?
4. `temperature`를 기존 0.7에서 0.8로 올린 이유는?
5. `getPastExamDetail`을 재사용하지 않고 Server Action 내부에서 **직접 DB 조회**하는 이유는?

### 직접 구현 추천 판단

- 🔴 **프롬프트 빌더 (Step 2)**: 새 패턴. 기존 `buildQuestionGenerationPrompt`를 참고하되 직접 작성 추천
- 🟡 **Server Action (Step 3)**: 인증/검증/호출 패턴은 기존과 유사하나, AI 에러 처리가 새로움
- 🟡 **Zod 스키마 (Step 1)**: 기존 패턴 확장. 빈칸 채우기 방식 추천
- 🟢 **UI (Step 4)**: 기존 패턴 조합. AI 자동 구현 OK

---

## 전체 파일 변경 요약

### 수정 (5개)

| 파일 | 변경 | 상태 |
|------|------|------|
| `src/lib/ai/types.ts` | PastExamContext + GenerateQuestionParams 확장 | ✅ Step 1 |
| `src/lib/ai/index.ts` | PastExamContext export 추가 | ✅ Step 1 |
| `src/lib/ai/gemini.ts` | pastExamContext 분기 (~3줄) | ✅ Step 3 |
| `src/lib/ai/prompts/index.ts` | buildPastExamGenerationPrompt export 추가 | ✅ Step 2 |
| `src/app/(dashboard)/past-exams/_components/past-exam-detail-sheet.tsx` | "AI 문제 생성" 버튼 + Dialog 연동 | Step 4 |

### 새로 생성 (5개)

| 파일 | 설명 | 상태 |
|------|------|------|
| `src/lib/validations/generate-questions.ts` | Zod 스키마 + 상수 | ✅ Step 1 |
| `src/lib/ai/prompts/past-exam-generation.ts` | 기출 기반 프롬프트 빌더 | ✅ Step 2 |
| `src/lib/actions/generate-questions.ts` | Server Action | ✅ Step 3 |
| `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` | 생성 다이얼로그 UI | Step 4 |
| `docs/plan/phase-1-step7-ai-question-generation.md` | 이 계획 문서 | ✅ |

### 수정 (테스트, 2개)

| 파일 | 변경 | 상태 |
|------|------|------|
| `src/lib/ai/__tests__/types.test.ts` | PastExamContext 호환성 테스트 추가 | ✅ Step 1 |
| `src/lib/ai/__tests__/gemini.test.ts` | pastExamContext 분기 테스트 추가 | Step 3 |

### 새로 생성 (테스트, 3개)

| 파일 | 설명 | 상태 |
|------|------|------|
| `src/lib/validations/__tests__/generate-questions.test.ts` | Zod 스키마 테스트 | ✅ Step 1 |
| `src/lib/ai/__tests__/prompts/past-exam-generation.test.ts` | 프롬프트 빌더 테스트 | ✅ Step 2 |
| `src/lib/actions/__tests__/generate-questions.test.ts` | Server Action 테스트 | Step 3 |

**총: 7개 수정 + 8개 생성 = 15개 파일 (테스트 포함)**
**완료: 8/15 (Step 1-2) | 남은: 7개 (Step 3-4)**
**테스트: 현재 383개 PASS | Step 3 후 ~404개 예상**

---

## 재사용 패턴 참조

| 재사용 대상 | 출처 파일 |
|------------|----------|
| AI 추상화 레이어 (Factory + Strategy) | `src/lib/ai/index.ts` — 공개 API |
| GeminiProvider 구현체 | `src/lib/ai/gemini.ts` |
| 기존 프롬프트 빌더 패턴 | `src/lib/ai/prompts/question-generation.ts` |
| 응답 파싱/검증 (Zod 이중 검증) | `src/lib/ai/validation.ts` |
| 재시도 유틸리티 (지수 백오프) | `src/lib/ai/retry.ts` |
| Server Action 인증 패턴 | `src/lib/actions/past-exams.ts` — `getCurrentUserProfile` |
| 역할 체크 패턴 | `src/lib/actions/past-exams.ts` — `uploadPastExamAction` |
| useTransition + Server Action | `src/app/(dashboard)/admin/users/_components/user-detail-sheet.tsx` |
| Dialog 패턴 | `src/components/ui/dialog.tsx` (shadcn/ui) |

---

## 리스크 및 대응

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| API 비용 과다 | **HIGH** | `MAX_QUESTION_COUNT = 10` 제한. UI에서 Select 1~10. 서버에서도 Zod max(10) 이중 검증 |
| GeminiProvider 변경 시 기존 테스트 영향 | **MEDIUM** | pastExamContext optional이므로 기존 동작 무영향. 분기 3줄만 변경 |
| extracted_content 없는 기출의 생성 품질 | **MEDIUM** | 프롬프트에서 메타데이터 기반 안내 포함. MVP 수준에서 수용 |
| GEMINI_API_KEY 미설정 환경 | **LOW** | 테스트는 Mock. 개발 시 `.env.local` 필수. `AIConfigError`가 명확한 에러 메시지 제공 |
| Sheet 안에서 Dialog 열기 z-index 이슈 | **LOW** | shadcn/ui Dialog는 portal 사용하여 z-index 자동 관리. 이슈 시 `className` 조정 |
| AI 응답 시간 (10~30초) | **MEDIUM** | `useTransition`으로 로딩 표시. toast로 완료/실패 알림. 타임아웃은 `AI_TIMEOUT_MS` 환경변수 (기본 30초) |
