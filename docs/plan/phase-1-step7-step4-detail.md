# 1-7 Step 4 상세 구현 계획: UI — 생성 다이얼로그 + 결과 표시

> **상위 계획**: `docs/plan/phase-1-step7-ai-question-generation.md` Step 4
> **작성일**: 2026-02-21
> **상태**: ✅ 완료 (2026-02-26)
> **선행 완료**: Step 1 (타입 + Zod, 369 tests), Step 2 (프롬프트 빌더, 383 tests), Step 3 (Server Action, 404 tests)

---

## 1. 개요

기출문제 상세 Sheet에 "AI 문제 생성" 버튼을 추가하고(교사/관리자만), 클릭 시 Dialog에서 생성 옵션(문제 유형, 난이도, 문제 수)을 선택한 뒤 `generateQuestionsFromPastExam` Server Action을 호출하여 결과를 카드 형태로 표시한다. DB 저장은 1-8에서 구현하며, 이 Step에서는 화면 표시만 다룬다.

### 핵심 변경

| 구분 | 파일 | 변경량 |
|------|------|--------|
| 수정 | `src/app/(dashboard)/past-exams/_components/past-exam-columns.tsx` | 정적 배열 → 팩토리 함수 (~10줄 변경) |
| 수정 | `src/app/(dashboard)/past-exams/page.tsx` | callerRole을 팩토리 함수에 전달 (~3줄 변경) |
| 수정 | `src/app/(dashboard)/past-exams/_components/past-exam-detail-sheet.tsx` | callerRole props + "AI 문제 생성" 버튼 + Dialog 연동 (~25줄 추가) |
| 신규 | `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` | 생성 다이얼로그 + 결과 카드 (~250줄) |

### 의존성

| Step 3 결과물 | 사용 위치 |
|--------------|----------|
| `generateQuestionsFromPastExam` (actions) | Dialog에서 Server Action 호출 |
| `GenerateQuestionsResult` (actions) | 반환 타입 참조 |

| Step 1 결과물 | 사용 위치 |
|--------------|----------|
| `GeneratedQuestion` (ai/types.ts) | 결과 카드 렌더링 타입 |
| `MAX_QUESTION_COUNT` (validations) | 문제 수 Select 옵션 상한 |

| 기존 인프라 | 사용 위치 |
|------------|----------|
| `Dialog` 관련 컴포넌트 (components/ui/dialog.tsx) | 다이얼로그 UI |
| `Select` 관련 컴포넌트 (components/ui/select.tsx) | 옵션 선택 UI |
| `Card` 관련 컴포넌트 (components/ui/card.tsx) | 결과 카드 UI |
| `Badge` (components/ui/badge.tsx) | 난이도/유형 표시 |
| `Separator` (components/ui/separator.tsx) | 카드 내부 구분선 |
| `Button` (components/ui/button.tsx) | 버튼 |
| `toast` (sonner) | 에러/성공 알림 |
| `PastExamDetail` (actions/past-exams) | Sheet에서 Dialog로 전달하는 기출 정보 |

---

## 2. Phase 분리 및 의존관계

```
Phase A: callerRole 전달 경로 수정
  ├── past-exam-columns.tsx: 정적 배열 → 팩토리 함수
  └── page.tsx: createPastExamColumns(callerRole) 호출

Phase B: GenerateQuestionsDialog 신규 생성 (핵심 UI)
  └── generate-questions-dialog.tsx: 폼 + 결과 표시

Phase C: PastExamDetailSheet에 버튼 + Dialog 연동
  ├── past-exam-detail-sheet.tsx: callerRole props + 버튼 + Dialog
  └── (Phase A에서 전달된 callerRole 사용)
```

**의존관계**:
- Phase A와 Phase B는 **독립** — 병렬 실행 가능
- Phase C는 Phase A + Phase B **모두 완료** 후 진행
- 병렬 에이전트 할당 시: Phase A 에이전트와 Phase B 에이전트로 분리 가능 (파일 충돌 없음)

---

## 3. Phase A: callerRole 전달 경로 수정

### 목표

현재 `pastExamColumns`는 정적 배열이므로 `callerRole`을 전달할 방법이 없다. `user-columns.tsx`의 `createUserColumns` 패턴을 따라 팩토리 함수로 변환하고, `page.tsx`에서 `callerRole`을 주입한다.

### a-1. past-exam-columns.tsx 변경

**변경 파일**: `src/app/(dashboard)/past-exams/_components/past-exam-columns.tsx` (현재 122줄)

**변경 내용**: 정적 배열 `pastExamColumns` → 팩토리 함수 `createPastExamColumns(callerRole: string)`

```typescript
// ─── 변경 전 ──────────────────────────────────────────
// 조회 전용이므로 정적 배열 (팩토리 함수 불필요)
export const pastExamColumns: ColumnDef<PastExamListItem>[] = [
  // ... 9개 컬럼
  {
    id: 'actions',
    cell: function ActionsCell({ row }) {
      const [sheetOpen, setSheetOpen] = useState(false)
      const exam = row.original

      return (
        <>
          <Button variant="ghost" size="sm" onClick={() => setSheetOpen(true)}>
            <Eye className="mr-1 h-4 w-4" />
            상세
          </Button>
          <PastExamDetailSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            examId={exam.id}
          />
        </>
      )
    },
  },
]

// ─── 변경 후 ──────────────────────────────────────────
/**
 * 기출문제 DataTable 컬럼 정의 — 팩토리 함수
 *
 * 이전: 정적 배열 (조회 전용이므로 팩토리 불필요)
 * 변경: callerRole 전달 필요 (PastExamDetailSheet에서 AI 문제 생성 버튼 조건부 표시)
 *
 * @see user-columns.tsx createUserColumns — 동일 패턴
 */
export function createPastExamColumns(
  callerRole: string,
): ColumnDef<PastExamListItem>[] {
  return [
    // 1~8번 컬럼: 기존과 완전히 동일 (변경 없음)
    // ...

    // 9. 액션 (상세 보기)
    {
      id: 'actions',
      cell: function ActionsCell({ row }) {
        const [sheetOpen, setSheetOpen] = useState(false)
        const exam = row.original

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
            <PastExamDetailSheet
              open={sheetOpen}
              onOpenChange={setSheetOpen}
              examId={exam.id}
              callerRole={callerRole}   // 1-7 추가: AI 문제 생성 버튼 조건부 표시
            />
          </>
        )
      },
    },
  ]
}
```

**변경 사항 요약**:
1. `export const pastExamColumns` → `export function createPastExamColumns(callerRole: string)`
2. `return [...]`으로 감싸기
3. `PastExamDetailSheet`에 `callerRole={callerRole}` prop 추가
4. 주석 업데이트 ("정적 배열" → "팩토리 함수")

**예상 줄 수**: 122줄 → ~130줄 (함수 선언 + return 래핑 + callerRole prop)

### a-2. page.tsx 변경

**변경 파일**: `src/app/(dashboard)/past-exams/page.tsx` (현재 119줄)

**변경 내용**: 정적 배열 import → 팩토리 함수 호출

```typescript
// ─── 변경 전 ──────────────────────────────────────────
import { pastExamColumns } from './_components/past-exam-columns'

// ...

<DataTable
  columns={pastExamColumns}
  data={exams}
  // ...
/>

// ─── 변경 후 ──────────────────────────────────────────
import { createPastExamColumns } from './_components/past-exam-columns'

// ...

// callerRole 기반 컬럼 생성 (AI 문제 생성 버튼 조건부 표시)
const columns = createPastExamColumns(callerRole)

<DataTable
  columns={columns}
  data={exams}
  // ...
/>
```

**변경 사항 요약**:
1. import 문: `pastExamColumns` → `createPastExamColumns`
2. `const columns = createPastExamColumns(callerRole)` 추가 (isTeacherOrAbove 계산 아래)
3. `<DataTable columns={columns} ...>` 로 변경

**예상 줄 수**: 119줄 → ~121줄 (순증가 2줄)

### 설계 결정 근거

| 결정 | 근거 |
|------|------|
| 정적 배열 → 팩토리 함수 변환 | callerRole을 `ActionsCell` 내부 `PastExamDetailSheet`에 전달해야 한다. 정적 배열은 외부 변수에 접근할 수 없으므로 팩토리 함수(클로저)가 필요 |
| `user-columns.tsx`의 `createUserColumns` 패턴 동일 | 프로젝트 컨벤션 일관성. MEMORY.md에 "정적 컬럼 배열 vs 팩토리 함수: 권한별 분기 없으면 정적, 있으면 팩토리"로 기록됨 |
| `callerRole`을 Server Component(page.tsx)에서 결정 | 클라이언트에서 역할을 재조회하지 않음. DevTools 우회 방지 (Server에서 결정) |

---

## 4. Phase B: GenerateQuestionsDialog 신규 생성 (핵심 UI)

### 목표

문제 유형/난이도/문제 수를 선택하고 AI 문제를 생성하는 Dialog 컴포넌트를 신규 작성한다. 생성 결과는 카드 형태로 표시한다.

### 신규 파일

**파일**: `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` (~250줄)

### 컴포넌트 구조

```
GenerateQuestionsDialog
├── DialogHeader (제목 + 기출 정보 요약)
├── 폼 영역 (결과 없을 때만 표시)
│   ├── Select: 문제 유형
│   ├── Select: 난이도
│   ├── Select: 문제 수 (1~MAX_QUESTION_COUNT)
│   └── Button: "AI 문제 생성" (useTransition + isPending)
├── 로딩 상태 표시 (isPending일 때)
│   └── "AI가 문제를 생성하고 있습니다... (최대 30초 소요)"
├── 결과 영역 (generatedQuestions 있을 때)
│   ├── 결과 헤더 ("생성된 문제 N개")
│   ├── div[overflow-y-auto, max-h-96]
│   │   └── QuestionCard x N
│   │       ├── 문제 번호 + 유형 Badge + 난이도 Badge
│   │       ├── 문제 내용 (content)
│   │       ├── 보기 (options — multiple_choice일 때만)
│   │       ├── Separator
│   │       ├── 정답 (answer)
│   │       └── 해설 (explanation — 있을 때만)
│   └── Button: "다시 생성" (폼으로 복귀)
└── DialogFooter
    └── Button: "닫기"
```

### 상세 구현 코드

```typescript
'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Sparkles, RotateCcw } from 'lucide-react'
import { generateQuestionsFromPastExam } from '@/lib/actions/generate-questions'
import type { GeneratedQuestion } from '@/lib/ai'
import type { PastExamDetail } from '@/lib/actions/past-exams'
import { MAX_QUESTION_COUNT } from '@/lib/validations/generate-questions'

// ─── Props ──────────────────────────────────────────────

interface GenerateQuestionsDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly pastExamId: string
  readonly pastExamDetail: PastExamDetail | null
}

// ─── 상수 ───────────────────────────────────────────────

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

const COUNT_OPTIONS = Array.from(
  { length: MAX_QUESTION_COUNT },
  (_, i) => i + 1
)

const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: '객관식',
  short_answer: '단답형',
  essay: '서술형',
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '쉬움',
  medium: '보통',
  hard: '어려움',
}

const DIFFICULTY_BADGE_VARIANT: Record<
  string,
  'secondary' | 'default' | 'destructive'
> = {
  easy: 'secondary',
  medium: 'default',
  hard: 'destructive',
}

// ─── 결과 카드 컴포넌트 ─────────────────────────────────

interface QuestionCardProps {
  readonly question: GeneratedQuestion
  readonly index: number
}

function QuestionCard({ question, index }: QuestionCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">문제 {index + 1}</CardTitle>
          <Badge variant="outline">
            {QUESTION_TYPE_LABELS[question.type] ?? question.type}
          </Badge>
          <Badge variant={DIFFICULTY_BADGE_VARIANT[question.difficulty] ?? 'secondary'}>
            {DIFFICULTY_LABELS[question.difficulty] ?? question.difficulty}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 문제 내용 */}
        <p className="text-sm whitespace-pre-wrap">{question.content}</p>

        {/* 객관식 보기 */}
        {question.options && question.options.length > 0 && (
          <div className="space-y-1 pl-2">
            {question.options.map((option, i) => (
              <p key={i} className="text-sm text-muted-foreground">
                {i + 1}. {option}
              </p>
            ))}
          </div>
        )}

        <Separator />

        {/* 정답 */}
        <div>
          <p className="text-xs font-medium text-muted-foreground">정답</p>
          <p className="text-sm">{question.answer}</p>
        </div>

        {/* 해설 */}
        {question.explanation && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">해설</p>
            <p className="text-sm whitespace-pre-wrap">
              {question.explanation}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── 메인 Dialog 컴포넌트 ────────────────────────────────

export function GenerateQuestionsDialog({
  open,
  onOpenChange,
  pastExamId,
  pastExamDetail,
}: GenerateQuestionsDialogProps) {
  // 폼 상태
  const [questionType, setQuestionType] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [count, setCount] = useState('')

  // 결과 상태
  const [generatedQuestions, setGeneratedQuestions] = useState<
    readonly GeneratedQuestion[]
  >([])

  // 로딩 상태
  const [isPending, startTransition] = useTransition()

  // 폼 유효성
  const isFormValid = questionType !== '' && difficulty !== '' && count !== ''

  // ─── 핸들러 ─────────────────────────────────────────

  /** AI 문제 생성 요청 */
  function handleGenerate() {
    if (!isFormValid) return

    startTransition(async () => {
      const result = await generateQuestionsFromPastExam({
        pastExamId,
        questionType,
        difficulty,
        count,   // z.coerce.number()가 문자열 -> 숫자 변환
      })

      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        setGeneratedQuestions(result.data)
        toast.success(`${result.data.length}개의 문제가 생성되었습니다.`)
      }
    })
  }

  /** "다시 생성" — 결과 초기화 후 폼으로 복귀 */
  function handleRetry() {
    setGeneratedQuestions([])
  }

  /** Dialog 닫힐 때 상태 초기화 */
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setQuestionType('')
      setDifficulty('')
      setCount('')
      setGeneratedQuestions([])
    }
    onOpenChange(nextOpen)
  }

  // ─── 렌더링 ─────────────────────────────────────────

  const hasResults = generatedQuestions.length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI 문제 생성
          </DialogTitle>
          <DialogDescription>
            {pastExamDetail
              ? `${pastExamDetail.schoolName} ${pastExamDetail.grade}학년 ${pastExamDetail.subject} 기출을 기반으로 유사 문제를 생성합니다.`
              : '기출문제를 기반으로 AI가 유사 문제를 생성합니다.'}
          </DialogDescription>
        </DialogHeader>

        {/* 폼 영역 — 결과가 없을 때만 표시 */}
        {!hasResults && !isPending && (
          <div className="space-y-4 py-2">
            {/* 문제 유형 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">문제 유형</label>
              <Select value={questionType} onValueChange={setQuestionType}>
                <SelectTrigger>
                  <SelectValue placeholder="문제 유형을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 난이도 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">난이도</label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger>
                  <SelectValue placeholder="난이도를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 문제 수 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                문제 수 (최대 {MAX_QUESTION_COUNT}개)
              </label>
              <Select value={count} onValueChange={setCount}>
                <SelectTrigger>
                  <SelectValue placeholder="문제 수를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {COUNT_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}문제
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 생성 버튼 */}
            <Button
              onClick={handleGenerate}
              disabled={!isFormValid || isPending}
              className="w-full"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              AI 문제 생성
            </Button>
          </div>
        )}

        {/* 로딩 상태 */}
        {isPending && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              AI가 문제를 생성하고 있습니다...
            </p>
            <p className="text-xs text-muted-foreground">
              최대 30초 정도 소요될 수 있습니다.
            </p>
          </div>
        )}

        {/* 결과 영역 */}
        {hasResults && !isPending && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                생성된 문제 {generatedQuestions.length}개
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
              >
                <RotateCcw className="mr-1 h-4 w-4" />
                다시 생성
              </Button>
            </div>

            <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
              {generatedQuestions.map((question, index) => (
                <QuestionCard
                  key={index}
                  question={question}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### 설계 결정 근거

| # | 결정 | 근거 |
|---|------|------|
| 1 | Dialog (Sheet가 아닌) | Sheet 안에서 다시 Sheet를 여는 것은 UX 혼란. Dialog는 Radix Portal 사용으로 Sheet 위에 z-index 자동 처리 |
| 2 | `useTransition` 사용 | Server Action 호출 + 중복 클릭 방지. 기존 `role-change-dialog.tsx` 패턴 (1-5에서 학습) |
| 3 | 문제 수를 Select로 구현 (Input 아닌) | 1~10 고정 범위. 자유 입력 시 유효성 검사 복잡도 증가. Select가 실수 방지에 효과적 |
| 4 | `QuestionCard`를 같은 파일에 배치 | 이 파일에서만 사용. 별도 파일로 분리하면 파일 수 불필요 증가. 전체 250줄 이내로 800줄 제한 충분 |
| 5 | `div + overflow-y-auto` 사용 (ScrollArea 아닌) | `scroll-area.tsx` 미설치 상태. 새 컴포넌트 설치보다 기본 CSS로 해결. MVP 수준에서 충분 |
| 6 | Dialog 닫힐 때 모든 상태 초기화 | 다시 열 때 이전 결과가 남아있으면 UX 혼란. `handleOpenChange`에서 일괄 초기화 |
| 7 | `count`를 문자열로 관리 | Select의 value는 항상 문자열. Server Action 측 `z.coerce.number()`가 문자열 -> 숫자 변환 처리. 클라이언트에서 parseInt 불필요 |
| 8 | 결과 표시와 폼을 토글 (`hasResults`) | 작은 Dialog 안에서 폼과 결과를 동시에 보여주면 과밀. 결과 표시 후 "다시 생성" 버튼으로 폼 복귀 |
| 9 | `Sparkles` 아이콘 사용 | AI/마법 느낌을 전달. lucide-react에 포함된 아이콘 |
| 10 | `sm:max-w-2xl` Dialog 크기 | 기본 `sm:max-w-lg`으로는 문제 카드 표시 시 좁음. `2xl` (672px)로 확장 |

### UI 상태 흐름

```
[Dialog 열림]
    │
    ▼
[폼 표시] ←─────────── [다시 생성 클릭]
    │                        ▲
    │ [생성 클릭]              │
    ▼                        │
[로딩 상태]                   │
    │                        │
    │ [성공]     [실패]       │
    ▼            │            │
[결과 표시] ─────┘       [toast.error]
    │
    │ [닫기 클릭]
    ▼
[Dialog 닫힘 + 상태 초기화]
```

---

## 5. Phase C: PastExamDetailSheet에 버튼 + Dialog 연동

### 목표

Sheet에 `callerRole` prop을 추가하고, 교사/관리자일 때만 "AI 문제 생성" 버튼을 표시하며, 버튼 클릭 시 `GenerateQuestionsDialog`를 연다.

### 변경 파일

**파일**: `src/app/(dashboard)/past-exams/_components/past-exam-detail-sheet.tsx` (현재 186줄)

### 변경 내용

**변경 1**: import 추가

```typescript
// 기존 import 아래에 추가
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GenerateQuestionsDialog } from './generate-questions-dialog'
```

**변경 2**: Props 타입에 `callerRole` 추가

```typescript
// ─── 변경 전 ──────────────────────────────────────────
interface PastExamDetailSheetProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly examId: string
}

// ─── 변경 후 ──────────────────────────────────────────
interface PastExamDetailSheetProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly examId: string
  readonly callerRole?: string   // 1-7 추가: 교사/관리자만 AI 문제 생성 버튼 표시
}
```

**변경 3**: 컴포넌트 내부에 Dialog 상태 + 권한 판단 추가

```typescript
export function PastExamDetailSheet({
  open,
  onOpenChange,
  examId,
  callerRole,           // 1-7 추가
}: PastExamDetailSheetProps) {
  const [detail, setDetail] = useState<PastExamDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)   // 1-7 추가: Dialog 열림 상태

  // 교사/관리자 여부 (AI 문제 생성 버튼 표시 조건)
  const isTeacherOrAbove = ['teacher', 'admin', 'system_admin'].includes(
    callerRole ?? ''
  )

  // ... 기존 useEffect 그대로 유지 ...
```

**변경 4**: 이미지 미리보기 아래에 "AI 문제 생성" 버튼 + Dialog 추가

```typescript
              {/* 이미지 미리보기 (기존 코드) */}
              {detail.signedImageUrl && (
                // ... 기존 코드 그대로 ...
              )}

              {/* AI 문제 생성 버튼 — 교사/관리자만 (1-7 추가) */}
              {isTeacherOrAbove && (
                <Button
                  onClick={() => setDialogOpen(true)}
                  className="w-full"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  AI 문제 생성
                </Button>
              )}
            </>
          )}
        </div>
      </SheetContent>

      {/* AI 문제 생성 Dialog — Sheet 외부에 배치 (1-7 추가) */}
      {isTeacherOrAbove && (
        <GenerateQuestionsDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          pastExamId={examId}
          pastExamDetail={detail}
        />
      )}
    </Sheet>
  )
}
```

**핵심 포인트**: `GenerateQuestionsDialog`를 `<SheetContent>` 밖, `<Sheet>` 안에 배치. Dialog는 Radix Portal을 사용하므로 위치에 관계없이 최상위에 렌더링되지만, Sheet의 자식으로 두어 Sheet가 닫힐 때 Dialog도 자연스럽게 언마운트된다.

### 변경 사항 요약

| 변경 | 줄 수 |
|------|-------|
| import 추가 (Sparkles, Button, GenerateQuestionsDialog) | +3줄 |
| callerRole prop 추가 | +1줄 |
| dialogOpen state + isTeacherOrAbove 계산 | +5줄 |
| AI 문제 생성 버튼 JSX | +8줄 |
| GenerateQuestionsDialog 연동 JSX | +8줄 |

**예상 줄 수**: 186줄 → ~211줄 (+25줄)

### 설계 결정 근거

| 결정 | 근거 |
|------|------|
| `callerRole`을 optional prop으로 | 기존 코드의 하위 호환. callerRole 없으면 버튼 미표시 (기본값 ''이 교사/관리자에 포함되지 않음) |
| `isTeacherOrAbove` 계산을 컴포넌트 내부에서 | page.tsx에서 이미 계산하는 패턴과 동일. callerRole 문자열을 받아 내부 판단 |
| Dialog를 `<Sheet>` 내부에 배치 | Sheet 언마운트 시 Dialog도 함께 정리됨. Sheet 외부에 두면 Sheet 닫힌 후에도 Dialog가 떠 있을 수 있음 |
| `{isTeacherOrAbove && <GenerateQuestionsDialog />}` 조건부 렌더링 | 학생에게는 Dialog 컴포넌트 자체를 렌더링하지 않음 (메모리 절약, 의도 명확) |
| `pastExamDetail`을 Dialog에 전달 | Dialog 헤더에 "OO학교 O학년 OO 기출 기반"을 표시하기 위함. 별도 조회 불필요 |

---

## 6. 전체 파일 변경 요약

| Phase | 작업 | 파일 | 변경량 |
|-------|------|------|--------|
| A | 수정 | `src/app/(dashboard)/past-exams/_components/past-exam-columns.tsx` | 정적 배열 → 팩토리 함수 (~10줄 변경) |
| A | 수정 | `src/app/(dashboard)/past-exams/page.tsx` | import 변경 + 팩토리 호출 (~3줄 변경) |
| B | 신규 | `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` | 생성 다이얼로그 + 결과 카드 (~250줄) |
| C | 수정 | `src/app/(dashboard)/past-exams/_components/past-exam-detail-sheet.tsx` | callerRole + 버튼 + Dialog 연동 (~25줄 추가) |

**총: 3개 수정 + 1개 신규 = 4개 파일**

---

## 7. 테스트 전략

### UI 컴포넌트 테스트

Step 4는 UI 작업이므로 **Unit 테스트보다 수동 검증 + 빌드 검증**이 더 효과적이다.

Server Action(`generateQuestionsFromPastExam`)은 Step 3에서 이미 18개 테스트로 검증 완료. UI에서는 해당 Action을 호출하는 흐름만 확인하면 된다.

### 수동 검증 체크리스트

```
1. 학생으로 로그인 → 기출 상세 Sheet → "AI 문제 생성" 버튼 미표시
2. 교사로 로그인 → 기출 상세 Sheet → "AI 문제 생성" 버튼 표시
3. 버튼 클릭 → Dialog 열림 + 기출 정보 요약 표시
4. 옵션 미선택 → "AI 문제 생성" 버튼 비활성화
5. 모든 옵션 선택 → "AI 문제 생성" 버튼 활성화
6. 생성 클릭 → 로딩 상태 표시 (스피너 + "최대 30초")
7. 생성 완료 → 카드 형태 결과 표시 + toast.success
8. 생성 실패 → toast.error + 폼 유지
9. "다시 생성" 클릭 → 폼 복귀
10. Dialog 닫기 → 상태 초기화
11. Dialog 닫은 후 다시 열기 → 폼 초기 상태
12. 객관식 생성 → 보기(options) 표시 확인
13. 서술형 생성 → 보기 미표시 확인
14. Sheet 닫기 → Dialog도 닫힘 확인
```

### 빌드 검증

```bash
npx vitest run          # 기존 404개 테스트 회귀 없음
npm run lint            # lint 에러 0개
npm run build           # Next.js 빌드 성공 (특히 import 경로 확인)
```

---

## 8. 리스크 및 대응

| # | 리스크 | 심각도 | 대응 |
|---|--------|--------|------|
| 1 | Sheet 위에 Dialog가 열릴 때 z-index 충돌 | MEDIUM | shadcn/ui Dialog는 Radix Portal 사용 → z-50으로 Sheet 위에 렌더링. 테스트에서 확인 후 이슈 시 `className="z-[60]"` 조정 |
| 2 | Dialog 닫힘 시 Sheet도 닫히는 문제 | MEDIUM | Dialog와 Sheet는 별도 open state 관리. Dialog의 `onOpenChange`가 Sheet의 `onOpenChange`를 호출하지 않음. 이슈 시 Dialog의 `onPointerDownOutside`에 `e.preventDefault()` 추가 |
| 3 | AI 호출 시간 30초+ → 사용자 이탈 | LOW | `useTransition`의 `isPending`으로 로딩 표시. AI Provider 측 `AI_TIMEOUT_MS`로 제한. "최대 30초" 안내 |
| 4 | pastExamColumns 팩토리 함수 변환 시 기존 동작 회귀 | LOW | 내부 컬럼 정의는 동일. 빌드 + 테스트로 회귀 확인 |
| 5 | 생성된 문제가 10개일 때 Dialog 내 스크롤 이슈 | LOW | `max-h-96 overflow-y-auto`로 스크롤 영역 제한 |
| 6 | Sparkles, RotateCcw 아이콘 미지원 | LOW | lucide-react v0.4+에서 둘 다 지원. 없으면 대체 아이콘 사용 |

---

## 9. 성공 기준

- [x] "AI 문제 생성" 버튼이 교사/관리자에게만 표시됨
- [x] 학생 로그인 시 버튼 미표시됨
- [x] Dialog에서 3개 옵션(문제 유형, 난이도, 문제 수) 모두 선택 가능
- [x] 옵션 미선택 시 생성 버튼 비활성화됨
- [x] 생성 클릭 시 로딩 상태 표시됨 (스피너 + 안내 문구)
- [x] 생성 성공 시 카드 형태로 결과 표시됨
- [x] 객관식 문제에 보기(options)가 표시됨
- [x] 생성 실패 시 toast.error 표시됨
- [x] "다시 생성" 클릭 시 폼으로 복귀됨
- [x] Dialog 닫힐 때 모든 상태 초기화됨
- [x] 기존 Sheet 기능(상세 조회, 이미지 미리보기) 회귀 없음
- [x] `npx vitest run` — 기존 404개 테스트 회귀 없음
- [x] `npm run build` — 빌드 성공

---

## 10. 구현 순서

Step 4는 UI 작업이므로 TDD RED-GREEN-REFACTOR 대신 다음 순서로 진행한다.

```
1. Phase A: callerRole 전달 경로 수정
   a-1. past-exam-columns.tsx 팩토리 함수 변환
   a-2. page.tsx에서 createPastExamColumns(callerRole) 호출
   a-3. 빌드 확인 (npm run build)

2. Phase B: GenerateQuestionsDialog 신규 생성
   b-1. generate-questions-dialog.tsx 작성 (상수 + QuestionCard + 메인 Dialog)
   b-2. 빌드 확인 (npm run build — import 경로 확인)

3. Phase C: PastExamDetailSheet에 버튼 + Dialog 연동
   c-1. past-exam-detail-sheet.tsx에 callerRole + 버튼 + Dialog 추가
   c-2. 빌드 확인 (npm run build)
   c-3. 전체 테스트 확인 (npx vitest run — 404 tests PASS)

4. 수동 검증 (개발 서버에서)
   - 학생/교사 각각 로그인하여 버튼 표시/비표시 확인
   - 옵션 선택 → 생성 → 결과 확인
   - 에러 케이스 확인
```

---

## 11. 커밋 계획

구현 완료 후 단일 커밋:

```
✨ feat: 1-7 Step 4 UI — 생성 다이얼로그 + 결과 표시
```

문서 업데이트 별도 커밋:

```
📝 docs: 1-7 Step 4 완료 — HANDOFF/ROADMAP/계획 문서 업데이트
```
