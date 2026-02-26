'use client'

/**
 * AI 문제 생성 다이얼로그
 *
 * 기출문제 상세 Sheet에서 "AI 문제 생성" 버튼 클릭 시 열린다.
 * 문제 유형/난이도/문제 수를 선택하고, generateQuestionsFromPastExam Server Action을 호출한다.
 * 결과는 카드 형태로 표시하며, DB 저장은 1-8에서 구현한다.
 *
 * UI 상태 흐름: [폼] → [로딩] → [결과 or 에러] → [다시 생성 → 폼]
 */

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
  (_, i) => i + 1,
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
          <Badge
            variant={
              DIFFICULTY_BADGE_VARIANT[question.difficulty] ?? 'secondary'
            }
          >
            {DIFFICULTY_LABELS[question.difficulty] ?? question.difficulty}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 문제 내용 */}
        <p className="whitespace-pre-wrap text-sm">{question.content}</p>

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
            <p className="whitespace-pre-wrap text-sm">
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
        count, // z.coerce.number()가 문자열 -> 숫자 변환
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
              <Button variant="outline" size="sm" onClick={handleRetry}>
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
