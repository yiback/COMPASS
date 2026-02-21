# 1-7 Step 3 상세 구현 계획: Server Action + GeminiProvider 통합 (TDD)

> **상위 계획**: `docs/plan/phase-1-step7-ai-question-generation.md` Step 3
> **작성일**: 2026-02-20
> **상태**: ✅ 완료 (404 tests PASS)
> **선행 완료**: Step 1 (타입 + Zod, 369 tests), Step 2 (프롬프트 빌더, 383 tests)
> **완료일**: 2026-02-21

---

## 1. 개요

### 목표

기출문제 기반 AI 문제 생성의 **백엔드 핵심**을 완성한다. 두 가지 작업으로 구성된다.

1. **GeminiProvider 분기 (~3줄)**: `gemini.ts`의 `generateQuestions` 메서드에서 `pastExamContext` 유무에 따라 프롬프트 빌더를 분기한다.
2. **Server Action 신규 (~120줄)**: `generateQuestionsFromPastExam` Server Action을 신규 파일에 구현한다. 인증 → 검증 → DB 조회 → AI 호출 → 결과 반환 흐름.

### 핵심 변경

| 구분 | 파일 | 변경량 |
|------|------|--------|
| 수정 | `src/lib/ai/gemini.ts` | import 1줄 + 분기 3줄 (기존 1줄 → 3줄) |
| 신규 | `src/lib/actions/generate-questions.ts` | ~120줄 |
| 신규 | `src/lib/actions/__tests__/generate-questions.test.ts` | ~300줄 (18개 테스트) |
| 수정 | `src/lib/ai/__tests__/gemini.test.ts` | ~50줄 추가 (3개 테스트) |

### 의존성

| Step 1 결과물 | 사용 위치 |
|--------------|----------|
| `PastExamContext` (types.ts) | Server Action에서 조립, gemini.ts에서 분기 판단 |
| `generateQuestionsRequestSchema` (validations) | Server Action 입력 검증 |
| `GenerateQuestionsRequest` 타입 | 타입 참조 |

| Step 2 결과물 | 사용 위치 |
|--------------|----------|
| `buildPastExamGenerationPrompt` (prompts) | gemini.ts에서 pastExamContext 있을 때 호출 |

| 기존 인프라 | 사용 위치 |
|------------|----------|
| `createAIProvider` (ai/index.ts) | Server Action에서 AI 호출 |
| `AIError` 계층 (ai/errors.ts) | Server Action에서 catch → 메시지 변환 |
| `createClient` (supabase/server) | 인증 + DB 조회 |

---

## 2. TDD 구현 순서

### 서브스텝 흐름도

```
Phase A: gemini.ts 분기 (작은 변경부터)
  a-1. 테스트 작성 (RED)     — gemini.test.ts에 3개 추가
  a-2. 구현 (GREEN)          — gemini.ts 분기 코드 3줄
  a-3. 회귀 검증             — 기존 16개 + 신규 3개 = 19개 PASS

Phase B: Server Action (핵심)
  b-1. 테스트 작성 (RED)     — generate-questions.test.ts 신규 (18개)
  b-2. 구현 (GREEN)          — generate-questions.ts 신규 (~120줄)
  b-3. 리팩터 (REFACTOR)     — 코드 품질 점검
  b-4. 전체 회귀 검증        — 전체 ~404개 PASS
```

**Phase A를 먼저 하는 이유**: gemini.ts 변경이 기존 AI 테스트 16개에 영향을 줄 수 있으므로, 먼저 분기를 확인하고 회귀를 검증한 후 Server Action에 진입한다. Server Action 테스트에서 `createAIProvider`를 mock하므로 gemini.ts 분기 자체는 Server Action 테스트에 직접 영향이 없지만, 전체 안정성을 위해 순서를 지킨다.

---

## 3. Phase A: gemini.ts pastExamContext 분기

### a-1. 테스트 작성 (RED)

**변경 파일**: `src/lib/ai/__tests__/gemini.test.ts` (기존 327줄 끝에 추가)

기존 파일의 `describe('GeminiProvider')` 블록 내부, 마지막 `describe('미구현 메서드')` 아래에 새 describe 블록을 추가한다.

```typescript
// ─── 그룹 6: pastExamContext 분기 ─────────────────────

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
```

**검증 포인트**: `callArgs.config.systemInstruction` 내용으로 어떤 프롬프트 빌더가 사용되었는지 확인한다. 기존 `buildQuestionGenerationPrompt`는 `'시험 출제 전문가'`를, `buildPastExamGenerationPrompt`는 `'기출문제 분석'`을 systemInstruction에 포함한다.

**실행 및 예상 결과**:

```bash
npx vitest run src/lib/ai/__tests__/gemini.test.ts
```

**FAIL** — 테스트 2번: pastExamContext가 있어도 기존 `buildQuestionGenerationPrompt`가 호출되므로 `'기출문제 분석'`이 없어 실패.

---

### a-2. 구현 (GREEN)

**변경 파일**: `src/lib/ai/gemini.ts`

**변경 1**: import 추가 (29줄 아래)

```typescript
import { buildPastExamGenerationPrompt } from './prompts/past-exam-generation'
```

**변경 2**: 91줄의 프롬프트 빌드 분기 (1줄 → 3줄)

```typescript
// 변경 전 (91줄):
const prompt = buildQuestionGenerationPrompt(params)

// 변경 후:
const prompt = params.pastExamContext
  ? buildPastExamGenerationPrompt(params)
  : buildQuestionGenerationPrompt(params)
```

**총 변경**: import 1줄 추가 + 기존 1줄 → 3줄 변경 = **순증가 3줄** (91줄 → 94줄)

**실행 및 예상 결과**:

```bash
npx vitest run src/lib/ai/__tests__/gemini.test.ts
```

**PASS** — 기존 16개 + 신규 3개 = **19개 PASS**

---

### a-3. 회귀 검증

```bash
# AI 모듈 전체 테스트
npx vitest run src/lib/ai/__tests__/

# 특히 기존 프롬프트 빌더 테스트
npx vitest run src/lib/ai/__tests__/prompts/question-generation.test.ts
npx vitest run src/lib/ai/__tests__/prompts/past-exam-generation.test.ts
```

**예상**: 전체 AI 테스트 회귀 없음 (기존 동작은 `pastExamContext` 없는 경우이므로 else 분기로 기존 `buildQuestionGenerationPrompt` 호출).

---

## 4. Phase B: Server Action

### b-1. 테스트 작성 (RED)

**신규 파일**: `src/lib/actions/__tests__/generate-questions.test.ts` (~300줄, 18개 테스트)

#### Mock 전략 상세

##### 4-1. Supabase Mock (from() 테이블 분기)

Server Action은 `createClient()`를 **두 번** 호출한다 (checkTeacherOrAdmin 1번 + 기출 조회 1번). 그러나 `vi.mock`은 모듈 레벨에서 한 번만 설정되므로 **같은 mockSupabaseClient 객체가 반환**된다.

핵심 문제: `from()` 호출이 2개 테이블에 걸친다.
- **1차**: `profiles` (checkTeacherOrAdmin 내부)
- **2차**: `past_exam_questions` (기출 조회)

**해결: `from()` mockImplementation으로 테이블명 분기**

```typescript
const mockProfileQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
}

const mockPastExamQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
}

mockSupabaseClient.from.mockImplementation((table: string) => {
  if (table === 'profiles') return mockProfileQuery
  if (table === 'past_exam_questions') return mockPastExamQuery
  throw new Error(`예상치 못한 테이블: ${table}`)
})
```

기존 `past-exams-list.test.ts`는 `mockReturnValueOnce` 체인으로 순서 기반 분기했다. 이번에는 **테이블명 기반 분기**를 사용하는데, 이유는:
- `checkTeacherOrAdmin`과 기출 조회가 **같은 `createClient()` 호출**에서 나온다
- `mockImplementation` 방식이 더 명시적이고, 테스트 의도가 명확하다

##### 4-2. AI Provider Mock (vi.importActual 패턴)

```typescript
// AIError 계층은 실제 클래스 유지 (instanceof 체크 필요)
vi.mock('@/lib/ai', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai')>('@/lib/ai')
  return {
    ...actual,                      // AIError, AIServiceError 등 실제 클래스 유지
    createAIProvider: vi.fn(),      // 팩토리만 mock
  }
})
```

**왜 vi.importActual이 필수인가**:

Server Action의 catch 블록에서 `error instanceof AIError` 체크를 수행한다. 만약 `vi.mock('@/lib/ai', ...)`으로 `AIError`까지 mock하면, mock된 `AIError`와 실제 `AIError`가 다른 클래스가 되어 `instanceof` 체크가 항상 `false`를 반환한다. 그러면 모든 AI 에러가 `'알 수 없는 오류'`로 처리되어 테스트 15~17번이 실패한다.

`vi.importActual`로 실제 모듈을 가져온 후 스프레드하면:
- `AIError`, `AIServiceError`, `AIValidationError`, `AIRateLimitError` → 실제 클래스 유지
- `createAIProvider` → mock 함수로 대체
- `instanceof` 체크가 정상 동작

##### 4-3. mockAIProvider 객체

```typescript
const mockGenerateQuestions = vi.fn()

const mockAIProvider = {
  name: 'gemini' as const,
  generateQuestions: mockGenerateQuestions,
  gradeAnswer: vi.fn(),
  processOCR: vi.fn(),
  analyzeTrends: vi.fn(),
}
```

`createAIProvider`가 이 mock 객체를 반환하도록 설정:

```typescript
import { createAIProvider } from '@/lib/ai'

const mockCreateAIProvider = createAIProvider as ReturnType<typeof vi.fn>
mockCreateAIProvider.mockReturnValue(mockAIProvider)
```

##### 4-4. schools FK JOIN Mock

DB 응답에서 `schools!inner ( name )`의 결과는 중첩 객체 형태로 반환된다:

```typescript
const MOCK_PAST_EXAM_ROW = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  year: 2024,
  semester: 1,
  exam_type: 'midterm',
  grade: 10,
  subject: '수학',
  extracted_content: null,
  schools: { name: '한국고등학교' },  // FK JOIN 결과
}
```

#### 테스트 파일 구조

```typescript
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * AI 문제 생성 Server Action 테스트
 *
 * 테스트 대상: generateQuestionsFromPastExam
 * Mock 전략:
 * - Supabase: from() mockImplementation 테이블명 분기
 * - AI Provider: vi.importActual + createAIProvider mock
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── AI Provider Mock (vi.importActual 필수) ─────────────
vi.mock('@/lib/ai', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai')>('@/lib/ai')
  return {
    ...actual,
    createAIProvider: vi.fn(),
  }
})

// ─── Supabase Mock ───────────────────────────────────────
const mockProfileQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
}

const mockPastExamQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
}

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}))

// ─── Mock 후 import (호이스팅 활용) ──────────────────────
import { generateQuestionsFromPastExam } from '../generate-questions'
import {
  createAIProvider,
  AIServiceError,
  AIValidationError,
  AIRateLimitError,
} from '@/lib/ai'

// ─── AI Provider Mock 설정 ───────────────────────────────
const mockGenerateQuestions = vi.fn()
const mockAIProvider = {
  name: 'gemini' as const,
  generateQuestions: mockGenerateQuestions,
  gradeAnswer: vi.fn(),
  processOCR: vi.fn(),
  analyzeTrends: vi.fn(),
}

const mockCreateAIProvider = createAIProvider as ReturnType<typeof vi.fn>
```

#### Mock 헬퍼 함수

```typescript
/** 인증 실패 Mock */
function mockAuthFailed() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'Not authenticated' },
  })
}

/** 역할별 인증 성공 Mock */
function mockAuthAs(
  role: string,
  id = '11111111-1111-4111-8111-111111111111',
  academyId: string | null = 'academy-uuid-1'
) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id } },
    error: null,
  })

  mockProfileQuery.single.mockResolvedValue({
    data: { id, role, academy_id: academyId },
    error: null,
  })
}

/** 프로필 없음 Mock */
function mockProfileNotFound() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'some-user-id' } },
    error: null,
  })

  mockProfileQuery.single.mockResolvedValue({
    data: null,
    error: { message: 'Not found' },
  })
}

/** 기출 조회 성공 Mock */
function mockPastExamFound(row = MOCK_PAST_EXAM_ROW) {
  mockPastExamQuery.single.mockResolvedValue({
    data: row,
    error: null,
  })
}

/** 기출 조회 실패 Mock */
function mockPastExamNotFound() {
  mockPastExamQuery.single.mockResolvedValue({
    data: null,
    error: { message: 'Not found', code: 'PGRST116' },
  })
}

/** AI 생성 성공 Mock */
function mockAISuccess(questions = MOCK_GENERATED_QUESTIONS) {
  mockGenerateQuestions.mockResolvedValue(questions)
}

/** 전체 성공 경로 Mock (인증 + 기출 + AI) */
function mockFullSuccess(role = 'teacher') {
  mockAuthAs(role)
  mockPastExamFound()
  mockAISuccess()
}
```

**실행 및 예상 결과**:

```bash
npx vitest run src/lib/actions/__tests__/generate-questions.test.ts
```

**FAIL** — `Cannot find module '../generate-questions'`

---

### b-2. 구현 (GREEN)

**신규 파일**: `src/lib/actions/generate-questions.ts` (~120줄)

#### 구현 코드 설계

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { generateQuestionsRequestSchema } from '@/lib/validations/generate-questions'
import { createAIProvider, AIError } from '@/lib/ai'
import type { GeneratedQuestion, PastExamContext } from '@/lib/ai'

// ─── 반환 타입 ──────────────────────────────────────────

export interface GenerateQuestionsResult {
  readonly error?: string
  readonly data?: readonly GeneratedQuestion[]
}

// ─── 내부 타입 ──────────────────────────────────────────

interface AuthorizedUser {
  readonly id: string
  readonly role: string
  readonly academyId: string
}

interface AuthCheckResult {
  readonly error?: string
  readonly user?: AuthorizedUser
}

// ─── 헬퍼: 인증 + 권한 확인 ────────────────────────────

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

  // 3. 기출문제 조회
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

#### 설계 결정 상세

| # | 결정 | 근거 |
|---|------|------|
| 1 | Server Action 별도 파일 (`generate-questions.ts`) | `past-exams.ts`는 이미 425줄. 관심사 다름 (조회/업로드 vs AI 생성). 800줄 제한 준수 |
| 2 | `checkTeacherOrAdmin` 헬퍼 (getCurrentUserProfile 재사용 X) | 역할 체크까지 포함해야 하므로 결합. `getCurrentUserProfile`은 역할 체크 미포함. 3회 반복 규칙 미달이므로 복사 허용 |
| 3 | `getPastExamDetail` 재사용 X → 직접 DB 조회 | Signed URL 불필요, SELECT 컬럼 다름 (`extracted_content` 필요, `source_image_url` 불필요). 불필요한 Storage 호출 방지 |
| 4 | AIError catch → `{ error: string }` 반환 (throw X) | Server Action에서 throw하면 Next.js가 500 에러를 반환하고 클라이언트에서 처리 어려움. `{ error }` 패턴으로 사용자 친화적 메시지 전달 |
| 5 | `rawInput: Record<string, unknown>` 타입 | FormData나 object 모두 수용. Zod `safeParse`가 타입 안전성 보장 |
| 6 | `extractedContent` 조건부 spread | `null`을 `undefined`로 변환하기 위한 패턴. `PastExamContext`에서 `extractedContent`는 optional이므로 key 자체가 없어야 함 |

**실행 및 예상 결과**:

```bash
npx vitest run src/lib/actions/__tests__/generate-questions.test.ts
```

**PASS** — 18개 전체 통과

---

### b-3. 리팩터 (REFACTOR)

**점검 항목**:
- [ ] 함수 < 50줄: `checkTeacherOrAdmin` ~25줄, `generateQuestionsFromPastExam` ~55줄 → 경계선. 필요 시 DB 조회 헬퍼 추출
- [ ] 파일 < 800줄: ~120줄 → 충분
- [ ] 중복 코드: `checkTeacherOrAdmin`이 `past-exams.ts`의 `getCurrentUserProfile`과 유사하나 역할 체크가 추가됨. 3회 반복 미달이므로 수용
- [ ] 에러 메시지 일관성: 한국어, 사용자 친화적

---

### b-4. 전체 회귀 검증

```bash
# 1. 신규 Server Action 테스트
npx vitest run src/lib/actions/__tests__/generate-questions.test.ts

# 2. gemini.ts 분기 테스트
npx vitest run src/lib/ai/__tests__/gemini.test.ts

# 3. 기존 Server Action 회귀 (past-exams, users, schools, academies, auth)
npx vitest run src/lib/actions/__tests__/

# 4. AI 모듈 전체 회귀
npx vitest run src/lib/ai/__tests__/

# 5. 전체 프로젝트
npx vitest run
```

**예상 결과**:
- generate-questions.test.ts: 18개 PASS
- gemini.test.ts: 19개 PASS (기존 16 + 신규 3)
- 전체: 기존 383 + 신규 21 = **~404개 PASS**

---

## 5. 테스트 목록 (전체 21개)

### Phase A: gemini.test.ts 추가 (3개)

| # | describe | 테스트명 | 검증 내용 | 핵심 assert |
|---|----------|---------|----------|------------|
| 1 | pastExamContext 분기 | pastExamContext가 없으면 기존 systemInstruction을 사용한다 | 기존 동작 유지 확인 | `toContain('시험 출제 전문가')` + `not.toContain('기출문제 분석')` |
| 2 | pastExamContext 분기 | pastExamContext가 있으면 기출 기반 systemInstruction을 사용한다 | 분기 동작 확인 | `toContain('기출문제 분석')` + `not.toContain('시험 출제 전문가')` |
| 3 | pastExamContext 분기 | pastExamContext가 있어도 응답 형식은 동일하다 | GeneratedQuestion[] 반환 | `toHaveLength(2)` + `toHaveProperty('content')` |

### Phase B: generate-questions.test.ts 신규 (18개)

| # | describe | 테스트명 | 검증 내용 | 핵심 assert |
|---|----------|---------|----------|------------|
| 4 | 인증 + 권한 | 비인증 사용자 → 에러 '인증이 필요합니다.' | auth.getUser 실패 | `expect(result.error).toBe('인증이 필요합니다.')` |
| 5 | 인증 + 권한 | 프로필 없음 → 에러 '프로필을 찾을 수 없습니다.' | profile null | `toBe('프로필을 찾을 수 없습니다.')` |
| 6 | 인증 + 권한 | academy_id 없음 → 에러 '소속 학원이 없습니다.' | academy_id null | `toBe('소속 학원이 없습니다.')` |
| 7 | 인증 + 권한 | student 역할 → 에러 'AI 문제 생성 권한이 없습니다...' | 역할 거부 | `toContain('권한이 없습니다')` |
| 8 | 인증 + 권한 | teacher 역할 → 인증 통과 (에러 없음) | 정상 진행 | `expect(result.error).toBeUndefined()` |
| 9 | 인증 + 권한 | admin 역할 → 인증 통과 (에러 없음) | 정상 진행 | `expect(result.error).toBeUndefined()` |
| 10 | 입력값 검증 | 유효하지 않은 pastExamId → 에러 | UUID 검증 실패 | `expect(result.error).toBeDefined()` |
| 11 | 입력값 검증 | 유효하지 않은 questionType → 에러 | enum 검증 실패 | `expect(result.error).toBeDefined()` |
| 12 | 입력값 검증 | count 범위 초과(11) → 에러 | max 검증 실패 | `toContain('최대')` |
| 13 | 기출문제 조회 | 존재하지 않는 pastExamId → 에러 '기출문제를 찾을 수 없습니다.' | DB 조회 실패 | `toBe('기출문제를 찾을 수 없습니다.')` |
| 14 | AI 문제 생성 성공 | 유효 입력 → GeneratedQuestion[] 반환 | 전체 성공 플로우 | `expect(result.data).toBeDefined()` + `toHaveLength` |
| 15 | AI 문제 생성 성공 | pastExamContext에 schoolName, year, semester 포함 확인 | generateQuestions 호출 인자 검증 | `toMatchObject({ pastExamContext: { schoolName: '한국고등학교' } })` |
| 16 | AI 문제 생성 성공 | extracted_content가 있으면 pastExamContext.extractedContent에 포함 | extractedContent 전달 확인 | `toMatchObject({ pastExamContext: { extractedContent: '...' } })` |
| 17 | AI 문제 생성 성공 | extracted_content가 null이면 pastExamContext.extractedContent 없음 | undefined 확인 | `expect(...extractedContent).toBeUndefined()` |
| 18 | AI 에러 처리 | AIServiceError → 'AI 문제 생성 실패: ...' 메시지 반환 | instanceof AIError 분기 | `toContain('AI 문제 생성 실패')` |
| 19 | AI 에러 처리 | AIValidationError → 'AI 문제 생성 실패: ...' 메시지 반환 | AIError 하위 클래스도 catch | `toContain('AI 문제 생성 실패')` |
| 20 | AI 에러 처리 | AIRateLimitError → 'AI 문제 생성 실패: ...' 메시지 반환 | 요청 한도 초과 | `toContain('AI 문제 생성 실패')` |
| 21 | AI 에러 처리 | 일반 Error → '알 수 없는 오류' 메시지 반환 | instanceof AIError가 false | `toContain('알 수 없는 오류')` |

---

## 6. Mock 전략 총정리

| Mock 대상 | 방식 | 핵심 포인트 |
|----------|------|-----------|
| `@/lib/supabase/server` → `createClient` | `vi.mock` + 동일 객체 반환 | `from()` mockImplementation으로 테이블명 분기 |
| `@/lib/ai` → `createAIProvider` | `vi.mock` + `vi.importActual` | **실제 AIError 클래스 유지** (instanceof 체크 필수) |
| `@google/genai` → `GoogleGenAI` (gemini.test.ts) | 기존 mock 유지 | `mockGenerateContent`로 API 응답 제어 |
| `../config` → `getAIConfig` (gemini.test.ts) | 기존 mock 유지 | test-api-key, gemini-2.0-flash |

---

## 7. 리스크 및 대응

| # | 리스크 | 심각도 | 대응 |
|---|--------|--------|------|
| 1 | **AIError instanceof 체크 실패** — vi.mock이 AIError까지 대체하면 instanceof가 항상 false | **HIGH** | `vi.importActual`로 실제 클래스 유지. 테스트 18~20번에서 검증 |
| 2 | **from() 복수 테이블 mock 순서 오류** — mockReturnValueOnce 사용 시 호출 순서 의존 | **MEDIUM** | `mockImplementation`으로 테이블명 기반 분기. 순서 무관 |
| 3 | **schools FK JOIN mock 불일치** — 중첩 객체 구조 오류 | **LOW** | `MOCK_PAST_EXAM_ROW`에 `schools: { name: '...' }` 명시. 기존 패턴 참조 |
| 4 | **gemini.ts 분기 변경이 기존 테스트에 영향** | **LOW** | `pastExamContext` 없는 기존 테스트는 else 분기 → 기존 동작 무변경 |
| 5 | **createClient 2회 호출** — checkTeacherOrAdmin과 Action 본문 각각 호출 | **LOW** | Mock이 동일 객체 반환. `mockImplementation`이 모든 호출에 적용 |
| 6 | **extractedContent null → undefined 변환 누락** | **MEDIUM** | 조건부 스프레드 패턴 사용. 테스트 17번에서 명시적 검증 |

---

## 8. 성공 기준

- [x] `npx vitest run src/lib/ai/__tests__/gemini.test.ts` — 21개 PASS (기존 18 + 신규 3)
- [x] `npx vitest run src/lib/actions/__tests__/generate-questions.test.ts` — 18개 PASS
- [x] `npx vitest run src/lib/ai/__tests__/` — AI 전체 회귀 없음
- [x] `npx vitest run src/lib/actions/__tests__/` — 기존 Server Action 회귀 없음
- [x] `npx vitest run` — 전체 404개 PASS
- [x] 교사/관리자만 생성 가능 (테스트 7, 8, 9)
- [x] AIError 계열 에러가 `'AI 문제 생성 실패: ...'` 메시지로 변환 (테스트 18~20)
- [x] 일반 Error가 `'알 수 없는 오류'` 메시지로 변환 (테스트 21)
- [x] extracted_content 유무에 따른 PastExamContext 조립 정상 (테스트 16, 17)

---

## 9. 학습 리뷰 (구현 완료 후 실행)

### 핵심 개념

| # | 개념 | 등급 | 설명 |
|---|------|------|------|
| 1 | `vi.importActual` — 부분 mock 패턴 | 🔴 | 모듈 전체를 mock하되 특정 export만 대체. `instanceof` 체크가 있는 에러 클래스는 실제 구현을 유지해야 한다. mock된 클래스와 실제 클래스는 별개 객체이므로 `instanceof`가 `false`를 반환하는 문제를 해결 |
| 2 | `from()` mockImplementation 테이블 분기 | 🟡 | `mockReturnValueOnce` (순서 의존) vs `mockImplementation` (인자 기반 분기). 복수 테이블 접근 시 후자가 더 안정적. 테이블명을 명시적으로 분기하므로 테스트 의도가 명확 |
| 3 | AIError → `{ error: string }` 변환 패턴 | 🟡 | Server Action에서 에러를 throw하지 않고 `{ error }` 객체로 반환하는 패턴. `instanceof`로 에러 타입을 분기하여 사용자 친화적 메시지 생성 |
| 4 | Server Action 인증/권한 흐름 | 🟢 | `getCurrentUserProfile` 패턴의 반복. 1-2, 1-6에서 이미 학습 |
| 5 | 조건부 스프레드로 null → undefined 변환 | 🟡 | `...(value ? { key: value } : {})` 패턴. DB의 `null`을 TypeScript의 optional 필드(key 부재)로 변환 |

### 이해도 질문 (3개 — 구현 완료 후 사용자 답변 대기)

1. **`vi.importActual`을 사용하지 않고 `vi.mock('@/lib/ai', ...)`으로 모든 export를 mock하면 어떤 문제가 발생하나?**
   - 힌트: Server Action의 `catch` 블록에서 `error instanceof AIError`를 사용한다. mock된 `AIError`와 실제 `AIError`가 같은 클래스인가?

2. **`from()` mock에서 `mockReturnValueOnce` 체인 대신 `mockImplementation`을 사용한 이유는?**
   - 힌트: `checkTeacherOrAdmin`과 Action 본문이 각각 `createClient()`를 호출한다. `from('profiles')`와 `from('past_exam_questions')`의 호출 순서가 바뀌면?

3. **`...(pastExam.extracted_content ? { extractedContent: pastExam.extracted_content } : {})`에서 그냥 `extractedContent: pastExam.extracted_content ?? undefined`로 쓰면 안 되나?**
   - 힌트: `{ extractedContent: undefined }`와 `{}`의 차이. `Object.keys()`로 확인해보면?

### 직접 구현 추천 판단

- 🔴 **vi.importActual 패턴** — 새로운 Mock 기법. 테스트 파일의 해당 부분을 직접 작성해볼 것
- 🟡 **Server Action 본문** — 인증/검증 흐름은 기존 반복이나, AI 에러 처리가 새로움. 빈칸 채우기 방식 추천
- 🟢 **gemini.ts 분기** — 3줄 변경. AI 자동 구현 OK

---

## 10. 전체 파일 변경 요약

| 서브스텝 | 작업 | 파일 | 변경량 |
|---------|------|------|--------|
| a-1 (RED) | 수정 | `src/lib/ai/__tests__/gemini.test.ts` | +~50줄 (3개 테스트) |
| a-2 (GREEN) | 수정 | `src/lib/ai/gemini.ts` | +3줄 (import 1 + 분기 2) |
| b-1 (RED) | 신규 | `src/lib/actions/__tests__/generate-questions.test.ts` | ~300줄 (18개 테스트) |
| b-2 (GREEN) | 신규 | `src/lib/actions/generate-questions.ts` | ~120줄 |

**총: 2개 수정 + 2개 신규 = 4개 파일**
**신규 테스트: 21개 (gemini 3 + Server Action 18)**
**예상 전체 테스트: 383 + 21 = ~404개**

---

## 11. 커밋 계획

Phase B 완료 후 단일 커밋:

```
✨ feat: 1-7 Step 3 Server Action + GeminiProvider 통합 (TDD)
```

문서 업데이트 별도 커밋:

```
📝 docs: 1-7 Step 3 완료 — HANDOFF/ROADMAP/계획 문서 업데이트
```
