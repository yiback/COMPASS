# Step 5: 문제 상세 Sheet + 빌드 검증

> **진행률**: 3/3 Tasks (100%)
> **마지막 업데이트**: 2026-03-01
> **상태**: ✅ 완료
> **의존성**: Step 4 완료 후 (question-columns.tsx에 Sheet 연결 대상 존재 필요)

---

## Context

Step 4에서 `questions` DataTable과 `question-columns.tsx`가 구현되었다. 현재 "상세" 버튼은 렌더링되지만 클릭해도 아무 일도 일어나지 않는다. Step 5에서는:

1. `getQuestionDetail` Server Action을 `questions.ts`에 추가한다.
2. `question-detail-sheet.tsx` 컴포넌트를 신규 생성한다.
3. `question-columns.tsx`의 액션 셀에 Sheet를 연결한다.
4. 전체 테스트 + lint + Next.js 빌드 검증으로 1-8 기능을 완성한다.

**핵심 패턴**: `past-exam-detail-sheet.tsx`와 동일한 패턴을 재활용한다. 차이점은 Signed URL이 불필요하다는 것이다 (`questions` 테이블에는 Storage 경로가 없음).

**참조 파일**:
- `src/lib/actions/past-exams.ts` — `getPastExamDetail` 패턴
- `src/app/(dashboard)/past-exams/_components/past-exam-detail-sheet.tsx` — Sheet 패턴
- `src/app/(dashboard)/past-exams/_components/past-exam-columns.tsx` — columns 패턴

---

## TDD 구현 순서 (RED → GREEN → REFACTOR)

---

### Task 1: `getQuestionDetail` Action (`src/lib/actions/questions.ts`에 추가)

#### RED: 테스트 작성

파일: `src/lib/actions/__tests__/questions-detail.test.ts` (신규)

```typescript
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * getQuestionDetail Server Action 테스트
 *
 * 테스트 대상:
 * - getQuestionDetail(): 단건 조회 (8개)
 *
 * Mock 전략: past-exams-list.test.ts와 동일한 from() 테이블 분기 패턴
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getQuestionDetail } from '../questions'

// ============================================================================
// Mock Setup
// ============================================================================

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}))

// ============================================================================
// Mock 헬퍼 함수
// ============================================================================

/** 인증 실패 Mock */
function mockAuthFailed() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'Not authenticated' },
  } as any)
}

/** 역할별 인증 성공 Mock */
function mockAuthAs(
  role: string,
  id = '11111111-1111-4111-8111-111111111111',
  academyId = 'academy-uuid-1'
) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id } },
    error: null,
  } as any)

  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id, role, academy_id: academyId },
      error: null,
    }),
  }
}

/** 단건 조회 쿼리 Mock */
function mockQuestionDetailQuery(item: any | null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: item,
      error: item ? null : { message: 'Not found', code: 'PGRST116' },
    }),
  }
}

/** DB Row Mock (questions 테이블 + FK JOIN) */
const mockQuestionDbRow = {
  id: 'question-uuid-1',
  content: '이차방정식 x² - 5x + 6 = 0의 근을 구하시오.',
  type: 'multiple_choice',
  difficulty: 3,
  subject: '수학',
  grade: 10,
  answer: '1',
  explanation: 'x = 2 또는 x = 3이므로 답은 보기 1번이다.',
  options: ['2, 3', '-2, -3', '1, 6', '-1, -6', '2, -3'],
  unit: '이차방정식',
  is_ai_generated: true,
  ai_review_status: 'pending',
  ai_model: 'gemini',
  source_type: 'ai_generated',
  source_metadata: {
    pastExamId: 'exam-uuid-1',
    schoolName: '한국고등학교',
    year: 2024,
    semester: 1,
    examType: 'midterm',
  },
  created_at: '2024-01-15T00:00:00Z',
  profiles: { name: '김교사' }, // profiles!created_by FK JOIN
}

// ============================================================================
// getQuestionDetail 테스트 (8개)
// ============================================================================

describe('getQuestionDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1. 비인증
  it('비인증 사용자 → 에러 "인증이 필요합니다."', async () => {
    mockAuthFailed()

    const result = await getQuestionDetail('question-uuid-1')

    expect(result.error).toBe('인증이 필요합니다.')
    expect(result.data).toBeUndefined()
  })

  // 2. 유효 ID → 상세 데이터 반환
  it('유효 ID → 상세 데이터 반환 (answer, explanation 포함)', async () => {
    const profileQuery = mockAuthAs('student')
    const detailQuery = mockQuestionDetailQuery(mockQuestionDbRow)

    mockSupabaseClient.from
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(detailQuery)

    const result = await getQuestionDetail('question-uuid-1')

    expect(result.error).toBeUndefined()
    expect(result.data).toBeDefined()
    expect(result.data?.answer).toBe('1')
    expect(result.data?.explanation).toBe('x = 2 또는 x = 3이므로 답은 보기 1번이다.')
  })

  // 3. 존재하지 않는 ID
  it('존재하지 않는 ID → 에러 "문제를 찾을 수 없습니다."', async () => {
    const profileQuery = mockAuthAs('student')
    const detailQuery = mockQuestionDetailQuery(null)

    mockSupabaseClient.from
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(detailQuery)

    const result = await getQuestionDetail('nonexistent-uuid')

    expect(result.error).toBe('문제를 찾을 수 없습니다.')
    expect(result.data).toBeUndefined()
  })

  // 4. answer, explanation 필드 존재 확인
  it('answer, explanation 포함 → QuestionDetail에 정상 매핑', async () => {
    const profileQuery = mockAuthAs('teacher')
    const detailQuery = mockQuestionDetailQuery(mockQuestionDbRow)

    mockSupabaseClient.from
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(detailQuery)

    const result = await getQuestionDetail('question-uuid-1')

    expect(result.data?.answer).toBe('1')
    expect(result.data?.explanation).toBe('x = 2 또는 x = 3이므로 답은 보기 1번이다.')
    expect(result.data?.unit).toBe('이차방정식')
    expect(result.data?.aiModel).toBe('gemini')
  })

  // 5. options JSONB → TypeScript 배열 확인
  it('options JSONB → 배열로 반환', async () => {
    const profileQuery = mockAuthAs('student')
    const detailQuery = mockQuestionDetailQuery(mockQuestionDbRow)

    mockSupabaseClient.from
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(detailQuery)

    const result = await getQuestionDetail('question-uuid-1')

    expect(Array.isArray(result.data?.options)).toBe(true)
    expect(result.data?.options).toHaveLength(5)
    expect(result.data?.options?.[0]).toBe('2, 3')
  })

  // 6. difficulty 숫자 → difficultyLabel 변환 확인
  it('difficulty 숫자(3) → difficultyLabel("보통") 변환', async () => {
    const profileQuery = mockAuthAs('student')
    const detailQuery = mockQuestionDetailQuery(mockQuestionDbRow)

    mockSupabaseClient.from
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(detailQuery)

    const result = await getQuestionDetail('question-uuid-1')

    // toQuestionListItem 내부에서 변환: 3 → '보통'
    expect(result.data?.difficultyLabel).toBe('보통')
  })

  // 7. profiles!created_by FK JOIN → createdByName 매핑
  it('profiles!created_by FK JOIN → createdByName 정상 매핑', async () => {
    const profileQuery = mockAuthAs('student')
    const detailQuery = mockQuestionDetailQuery(mockQuestionDbRow)

    mockSupabaseClient.from
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(detailQuery)

    const result = await getQuestionDetail('question-uuid-1')

    expect(result.data?.createdByName).toBe('김교사')
  })

  // 8. DB 에러 → 에러 메시지
  it('DB 에러 → 에러 "문제 상세 조회에 실패했습니다."', async () => {
    const profileQuery = mockAuthAs('student')
    mockSupabaseClient.from.mockReturnValueOnce(profileQuery)

    // DB 쿼리가 throw 하도록 Mock
    mockSupabaseClient.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockRejectedValue(new Error('DB connection error')),
    })

    const result = await getQuestionDetail('question-uuid-1')

    expect(result.error).toBe('문제 상세 조회에 실패했습니다.')
    expect(result.data).toBeUndefined()
  })
})
```

#### 검증 명령어 (RED 확인)

```bash
# 테스트 FAIL 확인 — getQuestionDetail 미구현 상태
npx vitest run src/lib/actions/__tests__/questions-detail.test.ts
```

---

#### GREEN: 최소 구현

파일: `src/lib/actions/questions.ts` (신규 생성)

> **주의**: `getCurrentUserProfile` 헬퍼는 `past-exams.ts`와 동일하게 작성한다. 현재 별도 공유 모듈이 없으므로 복사하여 사용한다 (미래에 `src/lib/actions/shared.ts`로 추출 가능).

```typescript
/**
 * 문제 Server Actions
 *
 * - getQuestionList: 문제 목록 조회 + 필터 + 페이지네이션 (Step 4에서 구현)
 * - getQuestionDetail: 문제 상세 조회 (Step 5)
 */

'use server'

import { createClient } from '@/lib/supabase/server'

// ─── 타입 정의 ──────────────────────────────────────────

/** 난이도 숫자 → 레이블 매핑 */
const DIFFICULTY_LABELS: Record<number, string> = {
  1: '매우 쉬움',
  2: '쉬움',
  3: '보통',
  4: '어려움',
  5: '매우 어려움',
}

/** 목록/상세 공통 항목 */
export interface QuestionListItem {
  readonly id: string
  readonly content: string
  readonly type: string
  readonly difficulty: number
  readonly difficultyLabel: string
  readonly subject: string
  readonly grade: number
  readonly isAiGenerated: boolean
  readonly aiReviewStatus: string
  readonly createdByName: string | null
  readonly createdAt: string
}

/** 상세 조회 전용 추가 항목 */
export interface QuestionDetail extends QuestionListItem {
  readonly answer: string
  readonly explanation: string | null
  readonly options: readonly string[] | null
  readonly unit: string | null
  readonly aiModel: string | null
  readonly sourceMetadata: Record<string, unknown> | null
}

export interface QuestionDetailResult {
  readonly error?: string
  readonly data?: QuestionDetail
}

// ─── 내부 타입 ────────────────────────────────────────

interface CurrentUserProfile {
  readonly id: string
  readonly role: string
  readonly academyId: string
}

interface GetCurrentUserResult {
  readonly error?: string
  readonly profile?: CurrentUserProfile
}

// ─── 헬퍼 함수 ────────────────────────────────────────

/**
 * 현재 사용자 프로필 조회 (인증 + 프로필 + academy_id 확인)
 * 역할 체크는 각 Action에서 수행
 */
async function getCurrentUserProfile(): Promise<GetCurrentUserResult> {
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

  return {
    profile: {
      id: profile.id,
      role: profile.role,
      academyId: profile.academy_id,
    },
  }
}

/**
 * DB 응답(snake_case + FK JOIN) → QuestionListItem(camelCase) 변환
 * 상세/목록 양쪽에서 공유하는 변환 함수
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 생성 타입 미생성
function toQuestionListItem(dbRow: any): QuestionListItem {
  return {
    id: dbRow.id,
    content: dbRow.content,
    type: dbRow.type,
    difficulty: dbRow.difficulty,
    difficultyLabel: DIFFICULTY_LABELS[dbRow.difficulty as number] ?? String(dbRow.difficulty),
    subject: dbRow.subject,
    grade: dbRow.grade,
    isAiGenerated: dbRow.is_ai_generated ?? false,
    aiReviewStatus: dbRow.ai_review_status ?? 'pending',
    createdByName: dbRow.profiles?.name ?? null,
    createdAt: dbRow.created_at,
  }
}

// ─── (Step 4에서 구현된 getQuestionList는 이곳에 위치) ──

// ─── 상세 조회 Action ─────────────────────────────────

/**
 * 문제 상세 조회
 * 권한: 인증된 사용자 전체 — RLS가 academy_id로 자동 격리
 * Signed URL 불필요 — questions 테이블에 Storage 경로 없음
 *
 * 주의: questions 테이블에 created_by, reviewed_by 두 FK가 있으므로
 * profiles!created_by 로 명시하여 PostgREST가 올바른 FK를 선택하게 한다.
 */
export async function getQuestionDetail(id: string): Promise<QuestionDetailResult> {
  // 1. 인증 + 프로필 확인
  const { error: profileError, profile } = await getCurrentUserProfile()
  if (profileError || !profile) {
    return { error: profileError }
  }

  const supabase = await createClient()

  try {
    const { data: row, error: dbError } = (await supabase
      .from('questions')
      .select(
        `
        id, content, type, difficulty, subject, grade,
        answer, explanation, options, unit,
        is_ai_generated, ai_review_status, ai_model,
        source_type, source_metadata, created_at,
        profiles!created_by ( name )
      `
      )
      .eq('id', id)
      .single()) as { data: any | null; error: unknown }

    if (dbError || !row) {
      return { error: '문제를 찾을 수 없습니다.' }
    }

    return {
      data: {
        ...toQuestionListItem(row),
        answer: row.answer,
        explanation: row.explanation ?? null,
        options: row.options ?? null,
        unit: row.unit ?? null,
        aiModel: row.ai_model ?? null,
        sourceMetadata: row.source_metadata ?? null,
      },
    }
  } catch {
    return { error: '문제 상세 조회에 실패했습니다.' }
  }
}
```

#### 검증 명령어 (GREEN 확인)

```bash
# 8개 테스트 모두 PASS 확인
npx vitest run src/lib/actions/__tests__/questions-detail.test.ts
```

#### REFACTOR

- `DIFFICULTY_LABELS`는 `questions` 페이지의 constants.ts로 이동 가능 (재사용 시)
- `getCurrentUserProfile` 함수가 `past-exams.ts`와 중복 — 향후 `src/lib/actions/shared.ts` 추출 고려
- `toQuestionListItem`은 Step 4의 목록 조회와 공유 → 파일 상단에 위치

---

### Task 2: `question-detail-sheet.tsx` (신규 생성)

파일: `src/app/(dashboard)/questions/_components/question-detail-sheet.tsx`

> `past-exam-detail-sheet.tsx`와 동일한 구조. 차이점: Signed URL 없음, 표시 항목 다름.

#### 구현 코드

```typescript
'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { getQuestionDetail } from '@/lib/actions/questions'
import type { QuestionDetail } from '@/lib/actions/questions'

// ─── 타입 정의 ────────────────────────────────────────

interface QuestionDetailSheetProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly questionId: string
}

// ─── 문제 유형 레이블 ──────────────────────────────────

const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: '객관식',
  short_answer: '단답형',
  descriptive: '서술형',
}

const QUESTION_TYPE_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  multiple_choice: 'default',
  short_answer: 'secondary',
  descriptive: 'outline',
}

// ─── AI 검수 상태 레이블 ────────────────────────────────

const AI_REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: '검수 대기',
  approved: '승인됨',
  rejected: '반려됨',
}

const AI_REVIEW_STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
}

// ─── 정보 행 컴포넌트 ─────────────────────────────────

interface InfoRowProps {
  readonly label: string
  readonly children: React.ReactNode
}

function InfoRow({ label, children }: InfoRowProps) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium">{children}</div>
    </div>
  )
}

// ─── 컴포넌트 ──────────────────────────────────────────

/**
 * 문제 상세 Sheet (오른쪽 사이드 패널)
 *
 * - Sheet 열릴 때 getQuestionDetail(questionId) 호출
 * - useEffect race condition 방지: `let cancelled = false` + cleanup 패턴
 * - Signed URL 없음 (questions 테이블에 Storage 경로 없음)
 * - 표시 항목: 과목, 학년, 유형, 난이도, 문제 내용, 보기(객관식), 정답, 해설, 검수 상태, 생성자, 등록일
 */
export function QuestionDetailSheet({
  open,
  onOpenChange,
  questionId,
}: QuestionDetailSheetProps) {
  const [detail, setDetail] = useState<QuestionDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sheet 열릴 때 상세 데이터 패칭 (race condition 방지: cancelled 플래그)
  useEffect(() => {
    if (!open || !questionId) return

    let cancelled = false

    // eslint-disable-next-line react-hooks/set-state-in-effect -- race condition 방지 패턴: cancelled 플래그와 함께 사용
    setLoading(true)
    setError(null)
    setDetail(null)

    getQuestionDetail(questionId)
      .then((result) => {
        if (cancelled) return
        if (result.error) {
          setError(result.error)
        } else {
          setDetail(result.data ?? null)
        }
      })
      .catch(() => {
        if (!cancelled) setError('상세 조회에 실패했습니다.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, questionId])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>문제 상세</SheetTitle>
          <SheetDescription>저장된 문제의 상세 정보를 확인합니다.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 p-4">
          {/* 로딩 상태 */}
          {loading && (
            <p className="text-sm text-muted-foreground">상세 정보를 불러오는 중...</p>
          )}

          {/* 에러 상태 */}
          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* 상세 정보 */}
          {detail && !loading && (
            <>
              {/* 기본 메타 정보 */}
              <InfoRow label="과목">{detail.subject}</InfoRow>

              <InfoRow label="학년">{detail.grade}학년</InfoRow>

              <InfoRow label="문제 유형">
                <Badge variant={QUESTION_TYPE_VARIANT[detail.type] ?? 'secondary'}>
                  {QUESTION_TYPE_LABELS[detail.type] ?? detail.type}
                </Badge>
              </InfoRow>

              <InfoRow label="난이도">
                {detail.difficultyLabel}
              </InfoRow>

              {/* 문제 내용 */}
              <InfoRow label="문제 내용">
                <p className="whitespace-pre-wrap text-sm font-normal leading-relaxed">
                  {detail.content}
                </p>
              </InfoRow>

              {/* 보기 (객관식만 표시) */}
              {detail.options && detail.options.length > 0 && (
                <InfoRow label="보기">
                  <ol className="list-inside list-decimal space-y-1">
                    {detail.options.map((option, index) => (
                      <li key={index} className="text-sm font-normal">
                        {option}
                      </li>
                    ))}
                  </ol>
                </InfoRow>
              )}

              {/* 정답 */}
              <InfoRow label="정답">
                <span className="font-semibold text-primary">{detail.answer}</span>
              </InfoRow>

              {/* 해설 */}
              {detail.explanation && (
                <InfoRow label="해설">
                  <p className="whitespace-pre-wrap text-sm font-normal leading-relaxed">
                    {detail.explanation}
                  </p>
                </InfoRow>
              )}

              {/* 단원 (있을 때만) */}
              {detail.unit && (
                <InfoRow label="단원">{detail.unit}</InfoRow>
              )}

              {/* AI 검수 상태 */}
              <InfoRow label="검수 상태">
                <Badge
                  variant={AI_REVIEW_STATUS_VARIANT[detail.aiReviewStatus] ?? 'secondary'}
                >
                  {AI_REVIEW_STATUS_LABELS[detail.aiReviewStatus] ?? detail.aiReviewStatus}
                </Badge>
              </InfoRow>

              {/* 출처 메타 (AI 생성인 경우) */}
              {detail.isAiGenerated && detail.sourceMetadata && (
                <InfoRow label="출처 기출">
                  {[
                    (detail.sourceMetadata as any).schoolName,
                    `${(detail.sourceMetadata as any).year}년`,
                    `${(detail.sourceMetadata as any).semester}학기`,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                </InfoRow>
              )}

              {/* 생성자 */}
              <InfoRow label="생성자">{detail.createdByName ?? '—'}</InfoRow>

              {/* 등록일 */}
              <InfoRow label="등록일">
                {new Date(detail.createdAt).toLocaleDateString('ko-KR')}
              </InfoRow>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

---

### Task 3: `question-columns.tsx` 수정 (Sheet 연결)

파일: `src/app/(dashboard)/questions/_components/question-columns.tsx`

Step 4에서 구현된 파일. 액션 셀(`id: 'actions'`)에 `QuestionDetailSheet`를 연결한다.

#### 변경 내역

**추가할 import** (파일 상단):

```typescript
import { QuestionDetailSheet } from './question-detail-sheet'
```

**수정할 액션 셀** (기존 placeholder 교체):

```typescript
// 기존 (Step 4에서 버튼만 있는 상태):
{
  id: 'actions',
  cell: function ActionsCell({ row }) {
    const question = row.original
    return (
      <Button variant="ghost" size="sm" onClick={() => {}}>
        <Eye className="mr-1 h-4 w-4" /> 상세
      </Button>
    )
  },
}

// 수정 후 (Sheet 연결):
{
  id: 'actions',
  cell: function ActionsCell({ row }) {
    const [sheetOpen, setSheetOpen] = useState(false)
    const question = row.original

    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSheetOpen(true)}
        >
          <Eye className="mr-1 h-4 w-4" />
          상세
        </Button>
        <QuestionDetailSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          questionId={question.id}
        />
      </>
    )
  },
}
```

> **참고**: `past-exam-columns.tsx`와 동일한 패턴. `callerRole` prop이 없는 이유는 MVP에서 문제 상세는 조회 전용이기 때문이다 (삭제/수정은 단계 2 F004).

---

## 파일 변경 요약

| 파일 | 작업 | 내용 |
|------|------|------|
| `src/lib/actions/__tests__/questions-detail.test.ts` | 신규 | `getQuestionDetail` 단위 테스트 8개 |
| `src/lib/actions/questions.ts` | 수정 (추가) | `getQuestionDetail` + 관련 타입 추가 |
| `src/app/(dashboard)/questions/_components/question-detail-sheet.tsx` | 신규 | 문제 상세 Sheet 컴포넌트 |
| `src/app/(dashboard)/questions/_components/question-columns.tsx` | 수정 | 액션 셀에 `QuestionDetailSheet` 연결 |

---

## 성공 기준

- [ ] `questions-detail.test.ts` 8개 테스트 모두 PASS
- [ ] 문제 목록에서 "상세" 버튼 클릭 시 오른쪽 Sheet 열림
- [ ] Sheet 열릴 때 API 호출 → 로딩 → 데이터 표시
- [ ] 빠른 연속 클릭(다른 row) 시 이전 응답이 덮어쓰지 않음 (race condition 방지 확인)
- [ ] 객관식 문제: 보기 목록 표시
- [ ] 단답형/서술형: 보기 없이 정답/해설만 표시
- [ ] `npm run lint` — 0 errors
- [ ] `npm run build` — Next.js 빌드 성공

---

## 최종 검증 명령어 (빌드 포함)

```bash
# 1. Step 5 신규 테스트
npx vitest run src/lib/actions/__tests__/questions-detail.test.ts

# 2. 전체 테스트 (1-8 전체 회귀)
npm run test:run

# 3. Lint 검사
npm run lint

# 4. Next.js 빌드 (TypeScript 컴파일 포함)
npm run build
```

---

## 학습 리뷰

### 핵심 개념 3가지

**1. useEffect race condition 방지 — `let cancelled = false` 패턴**

```
시나리오: 사용자가 행 A를 클릭 → 행 B를 빠르게 클릭

타이밍:
  t=0ms   행 A Sheet 열림 → A의 API 요청 시작
  t=50ms  행 B Sheet 열림 → B의 API 요청 시작
  t=200ms B의 응답 먼저 도착 → detail = B 데이터 ✅
  t=500ms A의 느린 응답 도착 → detail = A 데이터로 덮어씀 ❌

`cancelled` 플래그 없으면: A가 B를 덮어쓰는 "Last Write Wins" 버그 발생
`cancelled = true` cleanup 있으면: Sheet 변경 시 이전 effect 취소 → 올바른 데이터 표시
```

**2. `QuestionDetail extends QuestionListItem` — 타입 확장 전략**

```typescript
// 목록용 (적은 컬럼, 빠른 쿼리)
interface QuestionListItem {
  id, content, type, difficulty, difficultyLabel, subject, grade, ...
}

// 상세용 = 목록 필드 + 추가 필드
interface QuestionDetail extends QuestionListItem {
  answer, explanation, options, unit, aiModel, sourceMetadata
}
```

장점: 상세 페이지에서 목록 타입 함수들을 그대로 사용 가능 (다형성).
별도 인터페이스로 정의하면: 중복 선언 + 동기화 문제 발생.

**3. `profiles!created_by` FK 명시 — PostgREST 다중 FK 구분**

`questions` 테이블에는 동일한 `profiles` 테이블을 참조하는 FK가 두 개 존재한다:
- `created_by` — 문제를 생성한 사용자
- `reviewed_by` — 검수한 사용자 (nullable)

PostgREST는 테이블명만으로는 어느 FK를 쓸지 모름 → `profiles!created_by` 처럼 FK 컬럼명을 명시해야 한다.

```typescript
// 잘못된 예 (ambiguous FK 에러 발생)
.select(`profiles ( name )`)

// 올바른 예 (created_by FK 명시)
.select(`profiles!created_by ( name )`)
```

**4. Signed URL 불필요 이유 — questions vs past_exam_questions 차이**

| 항목 | past_exam_questions | questions |
|------|---------------------|-----------|
| Storage 파일 | 있음 (이미지/PDF) | 없음 |
| Signed URL 필요 | 예 (60초 만료) | 아니오 |
| 상세 조회 비용 | Storage API 1회 추가 | DB 쿼리만 |

`questions` 테이블은 텍스트 데이터만 저장하므로 Storage 접근이 불필요하다.

---

### 이해도 질문

**Q1**: useEffect에서 `let cancelled = false` 패턴이 필요한 이유는? 없으면 어떤 문제가 발생하는가?

**Q2**: `QuestionDetail`이 `QuestionListItem`을 `extends`하는 이유는? 별도 인터페이스로 `QuestionDetailFull`을 정의하면 어떤 문제가 생기는가?

**Q3**: `profiles!created_by`에서 `!` 뒤의 `created_by`는 무엇을 의미하는가? `!inner`와 어떻게 다른가?

---

### 직접 구현 추천

- **🟢 전체 (Step 5)**: `past-exam-detail-sheet.tsx` 패턴의 반복 적용 → AI 자동 구현 OK
  - `getQuestionDetail`: past-exams의 `getPastExamDetail`과 동일 구조, Signed URL만 제거
  - `question-detail-sheet.tsx`: `past-exam-detail-sheet.tsx` 복사 후 항목 변경
  - `question-columns.tsx`: 기존 파일에 import + Sheet 연결만 추가
