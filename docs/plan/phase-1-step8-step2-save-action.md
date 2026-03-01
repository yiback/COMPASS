# Step 2: 저장 Server Action (TDD)

> **전제**: Step 1 완료 — `toDifficultyNumber`, `toDbQuestionType`, `saveQuestionsRequestSchema`, `QuestionToSave` 타입이 모두 존재해야 한다.
> **목표**: `saveGeneratedQuestions` Server Action을 TDD로 구현한다.

---

## Context

### 무엇을 만드는가?

`src/lib/actions/save-questions.ts` — AI가 생성한 문제 배열(`GeneratedQuestion[]`)을 DB `questions` 테이블에 Bulk INSERT하는 Server Action.

### 전체 흐름

```
클라이언트
  │  rawInput: { pastExamId: UUID, questions: QuestionToSave[] }
  ▼
Server Action: saveGeneratedQuestions(rawInput)
  │
  ├─ 1. checkTeacherOrAdmin()        → 교사/관리자가 아니면 { error } 반환
  ├─ 2. saveQuestionsRequestSchema.safeParse(rawInput)  → 잘못된 입력이면 { error } 반환
  ├─ 3. past_exam_questions 조회      → 없으면 { error } 반환
  ├─ 4. toQuestionInsertRow() 변환   → AI 타입 → DB 타입 변환
  └─ 5. supabase.from('questions').insert([rows]).select('id')
           성공 → { data: { savedCount, questionIds } }
           실패 → { error }
```

### 의존성 맵

```
src/lib/validations/save-questions.ts   ← Step 1 구현 완료 필요
  saveQuestionsRequestSchema
  QuestionToSave

src/lib/ai/types.ts                     ← Step 1 구현 완료 필요
  toDifficultyNumber
  toDbQuestionType (기존 존재)

src/lib/supabase/server.ts              ← 기존 존재
  createClient
```

### Mock 전략 (테스트용)

`generate-questions.test.ts`와 동일 패턴이지만 테이블이 3개(`profiles`, `past_exam_questions`, `questions`)로 늘어난다.

```
mockSupabaseClient.from() 분기:
  'profiles'            → mockProfileQuery    (auth 확인)
  'past_exam_questions' → mockPastExamQuery   (기출 메타데이터)
  'questions'           → mockQuestionsQuery  (INSERT)
```

---

## TDD 구현 순서 (RED → GREEN → REFACTOR)

### Task 1: 테스트 파일 Mock 설정 + 헬퍼 함수 + 픽스처

#### RED: 테스트 파일 뼈대 작성

**파일: `src/lib/actions/__tests__/save-questions.test.ts`**

```typescript
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 생성된 문제 저장 Server Action 테스트
 *
 * 테스트 대상: saveGeneratedQuestions
 * Mock 전략:
 * - Supabase: from() mockImplementation 테이블명 분기 (profiles / past_exam_questions / questions)
 * - 인증 헬퍼: generate-questions.test.ts와 동일 패턴 재사용
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Supabase Mock ───────────────────────────────────────

/** profiles 테이블 쿼리 체인 Mock */
const mockProfileQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
}

/** past_exam_questions 테이블 쿼리 체인 Mock */
const mockPastExamQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
}

/** questions 테이블 쿼리 체인 Mock (insert + select 체인) */
const mockQuestionsQuery = {
  insert: vi.fn().mockReturnThis(),
  select: vi.fn(),
}

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}))

// ─── Mock 후 import ───────────────────────────────────────
import { saveGeneratedQuestions } from '../save-questions'

// ─── 테스트 픽스처 ──────────────────────────────────────

/** 기출문제 DB 행 Mock */
const MOCK_PAST_EXAM_ROW = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  subject: '수학',
  grade: 10,
  year: 2024,
  semester: 1,
  exam_type: 'midterm',
  school_id: 'school-uuid-1',
  schools: { name: '한국고등학교' },
}

/** 저장할 문제 1개 (AI 타입 그대로) */
const MOCK_QUESTION_MULTIPLE_CHOICE = {
  content: '이차방정식 x²-5x+6=0의 해를 구하시오.',
  type: 'multiple_choice',
  difficulty: 'medium',
  answer: 'x=2 또는 x=3',
  explanation: '인수분해: (x-2)(x-3)=0',
  options: ['x=1 또는 x=5', 'x=2 또는 x=3', 'x=-2 또는 x=-3', 'x=2 또는 x=-3', 'x=-2 또는 x=3'],
}

/** 서술형 문제 Mock (type: 'essay') */
const MOCK_QUESTION_ESSAY = {
  content: '이차방정식을 이용하여 풀이 과정을 서술하시오.',
  type: 'essay',
  difficulty: 'hard',
  answer: '풀이 참조',
  explanation: '인수분해 또는 근의 공식 사용',
}

/** 단답형 문제 Mock */
const MOCK_QUESTION_SHORT_ANSWER = {
  content: '1 + 1 = ?',
  type: 'short_answer',
  difficulty: 'easy',
  answer: '2',
  explanation: '1과 1을 더하면 2이다.',
}

/** DB INSERT 결과 Mock (id 배열) */
const MOCK_INSERTED_IDS = [
  { id: 'question-uuid-1' },
  { id: 'question-uuid-2' },
  { id: 'question-uuid-3' },
]

/** 유효한 기본 입력값 (객관식 1개) */
const VALID_INPUT_ONE = {
  pastExamId: '550e8400-e29b-41d4-a716-446655440000',
  questions: [MOCK_QUESTION_MULTIPLE_CHOICE],
}

/** 유효한 입력값 (3개: 객관식/단답/서술형 혼합) */
const VALID_INPUT_THREE = {
  pastExamId: '550e8400-e29b-41d4-a716-446655440000',
  questions: [
    MOCK_QUESTION_MULTIPLE_CHOICE,
    MOCK_QUESTION_SHORT_ANSWER,
    MOCK_QUESTION_ESSAY,
  ],
}

// ─── Mock 헬퍼 함수 ─────────────────────────────────────

/** 비인증 사용자 Mock */
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
  academyId: string | null = 'academy-uuid-1',
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

/** INSERT 성공 Mock */
function mockInsertSuccess(insertedRows = MOCK_INSERTED_IDS) {
  mockQuestionsQuery.select.mockResolvedValue({
    data: insertedRows,
    error: null,
  })
}

/** INSERT 에러 Mock (DB 에러 객체 반환) */
function mockInsertError() {
  mockQuestionsQuery.select.mockResolvedValue({
    data: null,
    error: { message: 'DB constraint violation', code: '23514' },
  })
}

/** INSERT 예외 Mock (throw) */
function mockInsertThrows() {
  mockQuestionsQuery.select.mockRejectedValue(new Error('Connection timeout'))
}

/** 전체 성공 경로 Mock (인증 + 기출 + INSERT) */
function mockFullSuccess(
  role = 'teacher',
  insertedRows = MOCK_INSERTED_IDS,
) {
  mockAuthAs(role)
  mockPastExamFound()
  mockInsertSuccess(insertedRows)
}
```

#### REFACTOR

Mock 헬퍼 함수들이 완성되면 테스트가 선언적으로 읽혀야 한다:

```typescript
// 좋은 테스트: given/when/then이 한눈에 보임
it('teacher 역할 → 인증 통과', async () => {
  mockFullSuccess('teacher')  // given
  const result = await saveGeneratedQuestions(VALID_INPUT_ONE)  // when
  expect(result.error).toBeUndefined()  // then
})
```

#### 검증 명령어

```bash
# 파일만 존재하면 (describe 블록 없어도) import 에러 확인
npx vitest run src/lib/actions/__tests__/save-questions.test.ts
# 예상: "Cannot find module '../save-questions'" 에러 → RED 확인
```

---

### Task 2: 인증 + 권한 테스트 (6개)

#### RED: 인증/권한 테스트 작성

`describe('saveGeneratedQuestions')` 안에 추가:

```typescript
describe('saveGeneratedQuestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // from() 테이블 분기 — 3개 테이블
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') return mockProfileQuery
      if (table === 'past_exam_questions') return mockPastExamQuery
      if (table === 'questions') return mockQuestionsQuery
      throw new Error(`예상치 못한 테이블: ${table}`)
    })
  })

  // ─── 그룹 1: 인증 + 권한 ────────────────────────────────

  describe('인증 + 권한', () => {
    it('비인증 사용자 → 에러 "인증이 필요합니다."', async () => {
      mockAuthFailed()

      const result = await saveGeneratedQuestions(VALID_INPUT_ONE)

      expect(result.error).toBe('인증이 필요합니다.')
      expect(result.data).toBeUndefined()
    })

    it('프로필 없음 → 에러 "프로필을 찾을 수 없습니다."', async () => {
      mockProfileNotFound()

      const result = await saveGeneratedQuestions(VALID_INPUT_ONE)

      expect(result.error).toBe('프로필을 찾을 수 없습니다.')
      expect(result.data).toBeUndefined()
    })

    it('academy_id 없음 → 에러 "소속 학원이 없습니다."', async () => {
      mockAuthAs('teacher', undefined, null)

      const result = await saveGeneratedQuestions(VALID_INPUT_ONE)

      expect(result.error).toBe('소속 학원이 없습니다.')
    })

    it('student 역할 → 에러 "문제 저장 권한이 없습니다."', async () => {
      mockAuthAs('student')

      const result = await saveGeneratedQuestions(VALID_INPUT_ONE)

      expect(result.error).toContain('문제 저장 권한이 없습니다')
    })

    it('teacher 역할 → 인증 통과 (에러 없음)', async () => {
      mockFullSuccess('teacher', [{ id: 'question-uuid-1' }])

      const result = await saveGeneratedQuestions(VALID_INPUT_ONE)

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
    })

    it('admin 역할 → 인증 통과 (에러 없음)', async () => {
      mockFullSuccess('admin', [{ id: 'question-uuid-1' }])

      const result = await saveGeneratedQuestions(VALID_INPUT_ONE)

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
    })
  })
```

#### GREEN: 최소 구현 — checkTeacherOrAdmin + 함수 시그니처

**파일: `src/lib/actions/save-questions.ts`** (새 파일)

```typescript
'use server'

/**
 * 생성된 문제 저장 Server Action
 *
 * 전체 흐름:
 * ┌──────────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐
 * │ 인증 확인 │ → │ Zod 검증 │ → │ 기출 조회  │ → │ 타입 변환 │ → │ DB 저장  │
 * └──────────┘    └──────────┘    └───────────┘    └──────────┘    └──────────┘
 */

import { createClient } from '@/lib/supabase/server'
import { saveQuestionsRequestSchema } from '@/lib/validations/save-questions'
import type { QuestionToSave } from '@/lib/validations/save-questions'
import { toDbQuestionType, toDifficultyNumber } from '@/lib/ai'

// ─── 반환 타입 ──────────────────────────────────────────

export interface SaveQuestionsResult {
  readonly error?: string
  readonly data?: {
    readonly savedCount: number
    readonly questionIds: readonly string[]
  }
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
// generate-questions.ts와 동일 패턴 (3회 반복 미달로 아직 공통 모듈 추출 안 함)

async function checkTeacherOrAdmin(): Promise<AuthCheckResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: '인증이 필요합니다.' }
  }

  const { data: profile, error: profileError } = (await supabase
    .from('profiles')
    .select('id, role, academy_id')
    .eq('id', user.id)
    .single()) as {
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
    return { error: '문제 저장 권한이 없습니다. 교사 또는 관리자만 사용할 수 있습니다.' }
  }

  return {
    user: {
      id: profile.id,
      role: profile.role,
      academyId: profile.academy_id,
    },
  }
}

// ─── Server Action (임시 뼈대) ───────────────────────────

export async function saveGeneratedQuestions(
  rawInput: Record<string, unknown>,
): Promise<SaveQuestionsResult> {
  // 1. 인증 + 권한
  const { error: authError, user } = await checkTeacherOrAdmin()
  if (authError || !user) {
    return { error: authError }
  }

  // 2~5: 이후 Task에서 구현
  return { error: '미구현' }
}
```

#### 검증 명령어

```bash
npx vitest run src/lib/actions/__tests__/save-questions.test.ts --reporter=verbose 2>&1 | head -60
# 예상: 인증/권한 6개 중 4개 PASS (teacher, admin 통과 테스트는 '미구현' 에러로 FAIL)
```

---

### Task 3: 입력값 검증 테스트 (4개)

#### RED: 입력값 검증 테스트 추가

```typescript
  // ─── 그룹 2: 입력값 검증 ────────────────────────────────

  describe('입력값 검증', () => {
    it('유효하지 않은 pastExamId (not-a-uuid) → 에러', async () => {
      mockAuthAs('teacher')

      const result = await saveGeneratedQuestions({
        ...VALID_INPUT_ONE,
        pastExamId: 'not-a-uuid',
      })

      expect(result.error).toBeDefined()
      expect(result.data).toBeUndefined()
    })

    it('빈 questions 배열 → 에러 "저장할 문제가 없습니다."', async () => {
      mockAuthAs('teacher')

      const result = await saveGeneratedQuestions({
        ...VALID_INPUT_ONE,
        questions: [],
      })

      expect(result.error).toBe('저장할 문제가 없습니다.')
    })

    it('11개 문제 → 에러 (최대 10개)', async () => {
      mockAuthAs('teacher')

      const result = await saveGeneratedQuestions({
        pastExamId: '550e8400-e29b-41d4-a716-446655440000',
        questions: Array.from({ length: 11 }, () => MOCK_QUESTION_MULTIPLE_CHOICE),
      })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('10')
    })

    it('content 빈 문자열 → 에러', async () => {
      mockAuthAs('teacher')

      const result = await saveGeneratedQuestions({
        pastExamId: '550e8400-e29b-41d4-a716-446655440000',
        questions: [{ ...MOCK_QUESTION_MULTIPLE_CHOICE, content: '' }],
      })

      expect(result.error).toBeDefined()
    })
  })
```

#### GREEN: Zod 검증 추가

`saveGeneratedQuestions` 함수에서 `return { error: '미구현' }` 위에 추가:

```typescript
  // 2. 입력값 검증
  const parsed = saveQuestionsRequestSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }
  }

  const { pastExamId, questions } = parsed.data

  return { error: '미구현' }
```

#### 검증 명령어

```bash
npx vitest run src/lib/actions/__tests__/save-questions.test.ts --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|✓|×)"
# 예상: 인증 4개 + 입력값 4개 = 8개 PASS, teacher/admin 통과 2개 + 나머지 FAIL
```

---

### Task 4: 기출문제 조회 테스트 (1개) + DB 조회 구현

#### RED: 기출 조회 테스트 추가

```typescript
  // ─── 그룹 3: 기출문제 조회 ─────────────────────────────

  describe('기출문제 조회', () => {
    it('존재하지 않는 pastExamId → 에러 "기출문제를 찾을 수 없습니다."', async () => {
      mockAuthAs('teacher')
      mockPastExamNotFound()

      const result = await saveGeneratedQuestions(VALID_INPUT_ONE)

      expect(result.error).toBe('기출문제를 찾을 수 없습니다.')
      expect(result.data).toBeUndefined()
    })
  })
```

#### GREEN: 기출 조회 구현

`parsed.data` 아래, `return { error: '미구현' }` 위에 추가:

```typescript
  // 3. 기출문제 메타데이터 조회 (subject, grade, 학교 정보)
  //    클라이언트를 신뢰하지 않음 — pastExamId로 서버에서 직접 조회 (Defense in Depth)
  const supabase = await createClient()
  const { data: pastExam, error: dbError } = (await supabase
    .from('past_exam_questions')
    .select('id, subject, grade, year, semester, exam_type, school_id, schools!inner ( name )')
    .eq('id', pastExamId)
    .single()) as {
    data: {
      id: string
      subject: string
      grade: number
      year: number
      semester: number
      exam_type: string
      school_id: string
      schools: { name: string }
    } | null
    error: unknown
  }

  if (dbError || !pastExam) {
    return { error: '기출문제를 찾을 수 없습니다.' }
  }
```

#### 검증 명령어

```bash
npx vitest run src/lib/actions/__tests__/save-questions.test.ts --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|✓|×)"
# 예상: 인증 4개 + 입력값 4개 + 기출 1개 = 9개 PASS
```

---

### Task 5: 변환 로직 구현 + 타입 변환 검증 테스트 (5개)

#### RED: 타입 변환 검증 테스트 추가

이 테스트들은 `insert()`에 전달된 인자를 검사한다.

```typescript
  // ─── 그룹 4: 타입 변환 검증 ─────────────────────────────

  describe('타입 변환 검증', () => {
    it('type "essay" → DB에 "descriptive"로 변환 확인', async () => {
      mockAuthAs('teacher')
      mockPastExamFound()
      mockInsertSuccess([{ id: 'question-uuid-1' }])

      await saveGeneratedQuestions({
        pastExamId: '550e8400-e29b-41d4-a716-446655440000',
        questions: [MOCK_QUESTION_ESSAY],
      })

      // insert()에 전달된 배열의 첫 번째 요소 검사
      const insertedRows = mockQuestionsQuery.insert.mock.calls[0][0] as any[]
      expect(insertedRows[0].type).toBe('descriptive')
    })

    it('difficulty "medium" → DB에 3으로 변환 확인', async () => {
      mockAuthAs('teacher')
      mockPastExamFound()
      mockInsertSuccess([{ id: 'question-uuid-1' }])

      await saveGeneratedQuestions(VALID_INPUT_ONE)

      const insertedRows = mockQuestionsQuery.insert.mock.calls[0][0] as any[]
      expect(insertedRows[0].difficulty).toBe(3)
    })

    it('is_ai_generated: true 확인', async () => {
      mockFullSuccess('teacher', [{ id: 'question-uuid-1' }])

      await saveGeneratedQuestions(VALID_INPUT_ONE)

      const insertedRows = mockQuestionsQuery.insert.mock.calls[0][0] as any[]
      expect(insertedRows[0].is_ai_generated).toBe(true)
    })

    it('source_metadata에 pastExamId, schoolId, schoolName, year, semester, examType 포함', async () => {
      mockFullSuccess('teacher', [{ id: 'question-uuid-1' }])

      await saveGeneratedQuestions(VALID_INPUT_ONE)

      const insertedRows = mockQuestionsQuery.insert.mock.calls[0][0] as any[]
      const meta = insertedRows[0].source_metadata
      expect(meta).toMatchObject({
        pastExamId: '550e8400-e29b-41d4-a716-446655440000',
        schoolId: 'school-uuid-1',
        schoolName: '한국고등학교',
        year: 2024,
        semester: 1,
        examType: 'midterm',
      })
      // generatedAt은 ISO 문자열인지만 확인
      expect(typeof meta.generatedAt).toBe('string')
    })

    it('academy_id가 인증된 사용자의 학원 ID와 일치', async () => {
      mockAuthAs('teacher', '11111111-1111-4111-8111-111111111111', 'academy-uuid-1')
      mockPastExamFound()
      mockInsertSuccess([{ id: 'question-uuid-1' }])

      await saveGeneratedQuestions(VALID_INPUT_ONE)

      const insertedRows = mockQuestionsQuery.insert.mock.calls[0][0] as any[]
      expect(insertedRows[0].academy_id).toBe('academy-uuid-1')
    })
  })
```

#### GREEN: toQuestionInsertRow 변환 함수 + INSERT 구현

`checkTeacherOrAdmin` 함수 아래에 변환 함수 추가:

```typescript
// ─── 변환 함수 ──────────────────────────────────────────

/**
 * AI 생성 문제 1개 → DB INSERT용 객체로 변환
 *
 * 변환 내용:
 * 1. type: 'essay' → 'descriptive'         (toDbQuestionType)
 * 2. difficulty: 'medium' → 3              (toDifficultyNumber)
 * 3. options: string[] → JSONB             (Supabase가 자동 처리)
 * 4. AI 메타데이터 필드 추가               (is_ai_generated, source_metadata 등)
 * 5. 출처 메타데이터 스냅샷                (schoolName 비정규화 — 생성 시점 기록)
 */
function toQuestionInsertRow(
  question: QuestionToSave,
  meta: {
    readonly academyId: string
    readonly userId: string
    readonly subject: string
    readonly grade: number
    readonly pastExamId: string
    readonly schoolId: string
    readonly schoolName: string
    readonly year: number
    readonly semester: number
    readonly examType: string
  },
) {
  return {
    // === 필수 필드 ===
    academy_id: meta.academyId,
    created_by: meta.userId,
    content: question.content,
    type: toDbQuestionType(question.type as 'multiple_choice' | 'short_answer' | 'essay'),
    answer: question.answer,
    subject: meta.subject,
    grade: meta.grade,

    // === 변환 필드 ===
    difficulty: toDifficultyNumber(question.difficulty as 'easy' | 'medium' | 'hard'),

    // === 선택 필드 ===
    explanation: question.explanation ?? null,
    options: question.options ?? null,  // Supabase가 JSONB로 자동 직렬화

    // === AI 메타데이터 ===
    is_ai_generated: true,
    ai_review_status: 'pending',  // 교사 검수 대기
    ai_model: 'gemini',
    source_type: 'ai_generated',

    // === 출처 스냅샷 (비정규화) ===
    // schoolName을 중복 저장하는 이유: 생성 시점의 학교명을 보존.
    // 나중에 학교명이 바뀌어도 "이 문제는 OO고 기출 기반" 기록 유지.
    source_metadata: {
      pastExamId: meta.pastExamId,
      schoolId: meta.schoolId,
      schoolName: meta.schoolName,
      year: meta.year,
      semester: meta.semester,
      examType: meta.examType,
      generatedAt: new Date().toISOString(),
    },

    // === DB default 활용 (넣지 않음) ===
    // id: gen_random_uuid() — DB 자동 생성
    // points: 1 — DB default
    // created_at: now() — DB default
    // updated_at: now() — DB default
  }
}
```

`return { error: '미구현' }` 을 아래로 교체:

```typescript
  // 4. AI 타입 → DB 타입 변환 (Bulk INSERT용 배열 생성)
  const insertRows = questions.map((q) =>
    toQuestionInsertRow(q, {
      academyId: user.academyId,
      userId: user.id,
      subject: pastExam.subject,
      grade: pastExam.grade,
      pastExamId,
      schoolId: pastExam.school_id,
      schoolName: pastExam.schools.name,
      year: pastExam.year,
      semester: pastExam.semester,
      examType: pastExam.exam_type,
    }),
  )

  // 5. Bulk INSERT
  try {
    const { data: inserted, error: insertError } = await supabase
      .from('questions')
      .insert(insertRows)
      .select('id')

    if (insertError || !inserted) {
      return { error: '문제 저장에 실패했습니다. 다시 시도해주세요.' }
    }

    return {
      data: {
        savedCount: inserted.length,
        questionIds: (inserted as { id: string }[]).map((row) => row.id),
      },
    }
  } catch {
    return { error: '문제 저장 중 오류가 발생했습니다.' }
  }
```

#### 검증 명령어

```bash
npx vitest run src/lib/actions/__tests__/save-questions.test.ts --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|✓|×)"
# 예상: 인증 4개 + 입력값 4개 + 기출 1개 + 변환 5개 = 14개 PASS
# (teacher/admin 통과 2개도 이제 PASS됨)
```

---

### Task 6: DB 저장 성공 + 부분 선택 저장 + 실패 테스트 (9개)

#### RED: 저장 성공/부분선택/실패 테스트 추가

```typescript
  // ─── 그룹 5: DB 저장 성공 ─────────────────────────────

  describe('DB 저장 성공', () => {
    it('유효 입력 → savedCount와 questionIds 반환', async () => {
      mockFullSuccess('teacher', [{ id: 'question-uuid-1' }])

      const result = await saveGeneratedQuestions(VALID_INPUT_ONE)

      expect(result.error).toBeUndefined()
      expect(result.data).toMatchObject({
        savedCount: 1,
        questionIds: ['question-uuid-1'],
      })
    })

    it('3개 문제 → savedCount === 3, questionIds 3개', async () => {
      mockAuthAs('teacher')
      mockPastExamFound()
      mockInsertSuccess(MOCK_INSERTED_IDS)  // 3개 ID

      const result = await saveGeneratedQuestions(VALID_INPUT_THREE)

      expect(result.data?.savedCount).toBe(3)
      expect(result.data?.questionIds).toHaveLength(3)
      expect(result.data?.questionIds).toEqual([
        'question-uuid-1',
        'question-uuid-2',
        'question-uuid-3',
      ])
    })
  })

  // ─── 그룹 6: 부분 선택 저장 ─────────────────────────────
  // UI에서 savedIndices(Set)로 선택된 문제만 필터링하여 Server Action에 전달.
  // Server Action은 받은 questions 배열을 그대로 저장 — 선택 로직은 UI 책임.

  describe('부분 선택 저장', () => {
    it('1개만 선택 → savedCount === 1', async () => {
      mockAuthAs('teacher')
      mockPastExamFound()
      mockInsertSuccess([{ id: 'question-uuid-1' }])

      // UI가 1개만 필터링해서 보낸 상황
      const result = await saveGeneratedQuestions({
        pastExamId: '550e8400-e29b-41d4-a716-446655440000',
        questions: [MOCK_QUESTION_MULTIPLE_CHOICE],
      })

      expect(result.data?.savedCount).toBe(1)
      // insert()에 전달된 배열도 1개인지 확인
      const insertedRows = mockQuestionsQuery.insert.mock.calls[0][0] as any[]
      expect(insertedRows).toHaveLength(1)
    })

    it('3개 중 1개만 선택 → savedCount === 1, insert에 1개만 전달', async () => {
      mockAuthAs('teacher')
      mockPastExamFound()
      mockInsertSuccess([{ id: 'question-uuid-2' }])

      // UI가 중간 1개(단답형)만 선택해서 보낸 상황
      const result = await saveGeneratedQuestions({
        pastExamId: '550e8400-e29b-41d4-a716-446655440000',
        questions: [MOCK_QUESTION_SHORT_ANSWER],
      })

      expect(result.data?.savedCount).toBe(1)
      expect(result.data?.questionIds).toEqual(['question-uuid-2'])
      const insertedRows = mockQuestionsQuery.insert.mock.calls[0][0] as any[]
      expect(insertedRows).toHaveLength(1)
    })

    it('10개 중 3개 선택 → savedCount === 3, insert에 3개만 전달', async () => {
      mockAuthAs('teacher')
      mockPastExamFound()
      mockInsertSuccess([
        { id: 'question-uuid-1' },
        { id: 'question-uuid-4' },
        { id: 'question-uuid-7' },
      ])

      // UI가 1번, 4번, 7번 문제만 선택해서 보낸 상황
      const result = await saveGeneratedQuestions({
        pastExamId: '550e8400-e29b-41d4-a716-446655440000',
        questions: [
          MOCK_QUESTION_MULTIPLE_CHOICE,
          MOCK_QUESTION_SHORT_ANSWER,
          MOCK_QUESTION_ESSAY,
        ],
      })

      expect(result.data?.savedCount).toBe(3)
      expect(result.data?.questionIds).toHaveLength(3)
      const insertedRows = mockQuestionsQuery.insert.mock.calls[0][0] as any[]
      expect(insertedRows).toHaveLength(3)
    })
  })

  // ─── 그룹 7: DB 저장 실패 ─────────────────────────────

  describe('DB 저장 실패', () => {
    it('insert 에러 → "문제 저장에 실패했습니다."', async () => {
      mockAuthAs('teacher')
      mockPastExamFound()
      mockInsertError()

      const result = await saveGeneratedQuestions(VALID_INPUT_ONE)

      expect(result.error).toBe('문제 저장에 실패했습니다. 다시 시도해주세요.')
      expect(result.data).toBeUndefined()
    })

    it('예외 발생 → "문제 저장 중 오류가 발생했습니다."', async () => {
      mockAuthAs('teacher')
      mockPastExamFound()
      mockInsertThrows()

      const result = await saveGeneratedQuestions(VALID_INPUT_ONE)

      expect(result.error).toBe('문제 저장 중 오류가 발생했습니다.')
      expect(result.data).toBeUndefined()
    })
  })
```

#### GREEN

Task 5에서 이미 전체 구현 완료. 이 테스트들은 추가 구현 없이 통과해야 한다.

#### REFACTOR

- `toQuestionInsertRow`의 `source_metadata`가 중첩 객체인지 확인
- `inserted.length`와 `.map(row => row.id)` 계산이 `savedCount`와 `questionIds`와 일치하는지 확인
- 불변성: `questions.map()` 사용으로 원본 배열 변경 없음 확인

#### 검증 명령어

```bash
npx vitest run src/lib/actions/__tests__/save-questions.test.ts --reporter=verbose
# 예상: 23개 전체 PASS
```

---

## 파일 변경 요약

| 작업 | 파일 | 변경 내용 |
|------|------|-----------|
| 신규 | `src/lib/actions/save-questions.ts` | Server Action 전체 (~160줄) |
| 신규 | `src/lib/actions/__tests__/save-questions.test.ts` | 23개 테스트 (~400줄) |

---

## 성공 기준

- [ ] `npx vitest run src/lib/actions/__tests__/save-questions.test.ts` — **23개 전체 PASS**
- [ ] 교사/관리자만 저장 가능 (테스트 1~6)
- [ ] Zod 입력값 검증 동작 (테스트 7~10)
- [ ] 존재하지 않는 pastExamId 방어 (테스트 11)
- [ ] type `'essay'` → `'descriptive'` 변환 (테스트 12)
- [ ] difficulty `'medium'` → `3` 변환 (테스트 13)
- [ ] `is_ai_generated: true` 저장 (테스트 14)
- [ ] `source_metadata` 전체 필드 포함 (테스트 15)
- [ ] `academy_id` 사용자 학원과 일치 (테스트 16)
- [ ] Bulk INSERT 결과 `savedCount + questionIds` 반환 (테스트 17~18)
- [ ] 부분 선택 저장 정확성 (테스트 19~21)
- [ ] DB 에러 및 예외 처리 (테스트 22~23)

---

## 최종 검증 명령어

```bash
# Step 2 테스트만
npx vitest run src/lib/actions/__tests__/save-questions.test.ts

# Step 1 테스트 회귀 확인
npx vitest run src/lib/ai/__tests__/types-difficulty.test.ts
npx vitest run src/lib/validations/__tests__/save-questions.test.ts

# generate-questions.test.ts 회귀 확인 (동일 Supabase mock 구조)
npx vitest run src/lib/actions/__tests__/generate-questions.test.ts

# 전체 테스트 (회귀 없음 확인)
npm run test:run

# TypeScript 타입 체크
npx tsc --noEmit
```

---

## 학습 리뷰

### 핵심 개념 4가지

**1. Bulk INSERT와 PostgreSQL 트랜잭션 (All or Nothing)**

```typescript
// 1개씩 INSERT (비추천)
for (const question of questions) {
  await supabase.from('questions').insert(question)  // DB 왕복 N번
}

// Bulk INSERT (추천)
await supabase.from('questions').insert(questions)   // DB 왕복 1번
// → PostgreSQL 트랜잭션: 10개 중 1개 실패하면 전체 롤백. 부분 저장 없음.
```

Bulk INSERT가 실패하면 어떻게 되는가? React state의 `savedIndices(Set<number>)`는 변경되지 않는다 — 불변 패턴으로 구현했기 때문이다. 사용자가 동일 선택으로 재시도 가능.

**2. Defense in Depth — 기출 재조회의 이유**

```
[잘못된 생각] 생성 시 이미 조회했으니, 클라이언트가 보낸 subject/grade를 그대로 사용하자.
[올바른 생각] 클라이언트에서 오는 모든 데이터는 조작 가능. pastExamId로 서버에서 재조회.
```

클라이언트가 `{ pastExamId: "...", subject: "영어", grade: 12 }`를 보내면 어떻게 되는가? 서버는 `subject`, `grade`를 무시하고 `pastExamId`로 DB에서 직접 가져온다. 클라이언트 데이터를 신뢰하면 IDOR(Insecure Direct Object Reference) 취약점이 된다.

**3. 비정규화 스냅샷 — schoolName 중복 저장**

```typescript
source_metadata: {
  schoolName: pastExam.schools.name,  // 중복! schools 테이블에도 있음
  // 왜? → 생성 시점의 학교명 보존. 나중에 학교명이 바뀌어도 기록 유지.
}
```

정규화 원칙을 의도적으로 어기는 경우: "이 데이터는 시점을 기록하는 스냅샷이다"라고 판단될 때. 같은 패턴을 영수증, 주문 내역, 로그에서 자주 볼 수 있다.

**4. `{ error }` 반환 패턴 — throw 대신 에러 객체**

```typescript
// throw 패턴 (사용 안 함)
throw new Error('인증이 필요합니다.')
// 문제: Next.js 에러 바운더리가 가로채서 500 페이지 표시 → UX 나쁨

// { error } 반환 패턴 (이 프로젝트의 표준)
return { error: '인증이 필요합니다.' }
// 장점: 클라이언트에서 if (result.error) 분기로 토스트 메시지 표시 가능
```

### 이해도 질문

1. **왜 저장 Server Action에서 기출문제(`past_exam_questions`)를 다시 조회하는가?** 문제 생성(1-7) 시에 이미 조회했는데, 그 데이터를 클라이언트가 저장 요청에 포함해서 보내면 안 되는가? Defense in Depth 관점에서 설명하시오.

2. **Bulk INSERT(`supabase.from('questions').insert([배열])`)가 10개 문제 중 3개째에서 DB 제약 위반으로 실패했다면, DB에는 몇 개가 저장되는가?** 그리고 클라이언트의 `savedIndices(Set<number>)` 상태는 어떻게 되는가?

3. **`source_metadata`에 `schoolName`을 저장하는 것은 비정규화이다.** 정규화 원칙상 중복 데이터는 제거해야 하지만, 이 경우 비정규화를 허용하는 이유는 무엇인가? "시점 기록" 개념과 연결하여 설명하시오.

### 직접 구현 추천

| 대상 | 추천 등급 | 이유 |
|------|-----------|------|
| `checkTeacherOrAdmin()` | 🟢 AI 자동 구현 OK | `generate-questions.ts`와 동일 패턴 — 에러 메시지만 다름. 반복 패턴 |
| `toQuestionInsertRow()` 변환 함수 | 🔴 직접 구현 강력 추천 | 핵심 비즈니스 로직. AI 타입 → DB 타입 매핑, source_metadata 스냅샷 조립. 이 로직을 직접 써봐야 "왜 이렇게 설계했는가"가 체화됨 |
| Server Action 전체 흐름 | 🟡 참고 후 직접 구현 | `generate-questions.ts` 흐름과 유사하지만 INSERT 부분이 새로움. 뼈대 참고 후 직접 작성 권장 |
| 테스트 Mock 설정 | 🟡 참고 후 직접 구현 | 3개 테이블 분기 패턴은 새로움. `from()` mockImplementation 패턴을 직접 작성해봐야 Mock 전략 이해 가능 |

---

> **다음 단계**: Step 2 완료 후 Step 3 (UI — 저장 버튼 + 개별 선택 저장)으로 진행.
> Step 3 계획 파일: `docs/plan/phase-1-step8-step3-save-ui.md` (별도 작성 예정)
