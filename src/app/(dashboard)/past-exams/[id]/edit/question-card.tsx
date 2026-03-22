'use client'

/**
 * 문제 카드 컴포넌트 — 읽기/편집 모드 전환
 *
 * Accordion 기반. editingId로 단일 편집 모드 관리.
 * confidence 색상: 🟢>=0.8 / 🟡0.5~0.8 / 🔴<0.5
 */

import { useState, useEffect } from 'react'
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Pencil,
  Trash2,
  RefreshCw,
  Check,
  X,
  Loader2,
  ImageIcon,
} from 'lucide-react'
import { LatexRenderer } from '@/components/ui/latex-renderer'
import type { QuestionData, FigureData } from './page'

// ─── 타입 ────────────────────────────────────────────────

interface QuestionCardProps {
  readonly question: QuestionData
  readonly isEditing: boolean
  readonly isReanalyzing: boolean
  readonly reanalyzingDisabled: boolean
  readonly onEdit: () => void
  readonly onCancelEdit: () => void
  readonly onSaveEdit: (data: EditFormData) => void
  readonly onReanalyze: () => void
  readonly onDelete: () => void
}

/** 편집 폼 데이터 */
export interface EditFormData {
  readonly questionText: string
  readonly questionType: string
  readonly options: string[] | null
  readonly answer: string
}

// ─── 상수 ────────────────────────────────────────────────

const QUESTION_TYPE_OPTIONS = [
  { value: 'multiple_choice', label: '객관식' },
  { value: 'short_answer', label: '단답형' },
  { value: 'essay', label: '서술형' },
] as const

const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: '객관식',
  short_answer: '단답형',
  essay: '서술형',
}

// ─── confidence 색상 헬퍼 ─────────────────────────────────

function getConfidenceStyle(confidence: number | null): {
  text: string
  bg: string
  border: string
  label: string
} {
  if (confidence === null) {
    return {
      text: 'text-gray-600',
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      label: '—',
    }
  }
  if (confidence >= 0.8) {
    return {
      text: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
      label: `${Math.round(confidence * 100)}%`,
    }
  }
  if (confidence >= 0.5) {
    return {
      text: 'text-yellow-600',
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      label: `${Math.round(confidence * 100)}%`,
    }
  }
  return {
    text: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    label: `${Math.round(confidence * 100)}%`,
  }
}

// ─── 그래프/그림 미리보기 ──────────────────────────────────

interface FigurePreviewProps {
  readonly figures: FigureData[] | null
}

function FigurePreview({ figures }: FigurePreviewProps) {
  if (!figures || figures.length === 0) return null

  // description이 있는 figure만 표시
  const descriptiveFigures = figures.filter((fig) => fig.description)
  if (descriptiveFigures.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        그래프/그림 설명
      </p>
      <div className="space-y-1">
        {descriptiveFigures.map((fig, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-md border bg-muted/30 p-2"
          >
            <ImageIcon className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {fig.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 읽기 모드 ────────────────────────────────────────────

interface ReadModeProps {
  readonly question: QuestionData
  readonly confidenceStyle: ReturnType<typeof getConfidenceStyle>
}

function ReadMode({ question, confidenceStyle }: ReadModeProps) {
  return (
    <div className="space-y-3">
      {/* 문제 내용 — LaTeX 수식 렌더링 */}
      <LatexRenderer text={question.questionText} className="text-sm" />

      {/* 객관식 보기 — LaTeX 수식 렌더링 */}
      {question.options && question.options.length > 0 && (
        <div className="space-y-1 pl-2">
          {question.options.map((option, i) => (
            <p key={i} className="text-sm text-muted-foreground">
              {i + 1}. <LatexRenderer text={option} />
            </p>
          ))}
        </div>
      )}

      {/* 정답 — LaTeX 수식 렌더링 */}
      {question.answer && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">정답</p>
          <LatexRenderer text={question.answer} className="text-sm" />
        </div>
      )}

      {/* 그래프/그림 미리보기 */}
      {question.hasFigure && (
        <FigurePreview
          figures={question.figures}
        />
      )}
    </div>
  )
}

// ─── 편집 모드 ────────────────────────────────────────────

interface EditModeProps {
  readonly question: QuestionData
  readonly onSave: (data: EditFormData) => void
  readonly onCancel: () => void
}

function EditMode({ question, onSave, onCancel }: EditModeProps) {
  // 편집 폼 로컬 상태 (불변 패턴)
  const [questionText, setQuestionText] = useState(question.questionText)
  const [questionType, setQuestionType] = useState(question.questionType)
  const [options, setOptions] = useState<string[]>(
    question.options ?? ['', '', '', ''],
  )
  const [answer, setAnswer] = useState(question.answer ?? '')

  // LaTeX 미리보기 상태 — 300ms debounce 적용
  const [previewText, setPreviewText] = useState(question.questionText)
  const [focusedOptionIndex, setFocusedOptionIndex] = useState<number | null>(null)
  const [previewAnswer, setPreviewAnswer] = useState(question.answer ?? '')

  // 문제 내용 debounce — 300ms 후 미리보기 업데이트
  useEffect(() => {
    const timer = setTimeout(() => setPreviewText(questionText), 300)
    return () => clearTimeout(timer)
  }, [questionText])

  // 정답 debounce — 300ms 후 미리보기 업데이트
  useEffect(() => {
    const timer = setTimeout(() => setPreviewAnswer(answer), 300)
    return () => clearTimeout(timer)
  }, [answer])

  // 문제 유형 변경 시 보기 배열 초기화
  function handleTypeChange(value: string) {
    setQuestionType(value)
    if (value === 'multiple_choice' && options.length === 0) {
      setOptions(['', '', '', ''])
    }
  }

  // 보기 변경 (불변 패턴)
  function handleOptionChange(index: number, value: string) {
    setOptions((prev) =>
      prev.map((opt, i) => (i === index ? value : opt)),
    )
  }

  function handleSave() {
    onSave({
      questionText,
      questionType,
      options: questionType === 'multiple_choice' ? options : null,
      answer,
    })
  }

  return (
    <div className="space-y-3">
      {/* 문제 유형 */}
      <div className="space-y-1">
        <label className="text-xs font-medium">문제 유형</label>
        <Select value={questionType} onValueChange={handleTypeChange}>
          <SelectTrigger className="h-8">
            <SelectValue />
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

      {/* 문제 내용 */}
      <div className="space-y-1">
        <label className="text-xs font-medium">문제 내용</label>
        <Textarea
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          rows={3}
          className="resize-none text-sm"
        />
        {/* LaTeX 수식이 포함된 경우에만 미리보기 표시 */}
        {previewText && previewText.includes('$') && (
          <div className="max-h-32 overflow-y-auto rounded-md border bg-muted/30 p-2">
            <p className="mb-1 text-xs text-muted-foreground">미리보기</p>
            <LatexRenderer text={previewText} className="text-sm" />
          </div>
        )}
      </div>

      {/* 객관식 보기 */}
      {questionType === 'multiple_choice' && (
        <div className="space-y-1">
          <label className="text-xs font-medium">보기</label>
          <div className="grid grid-cols-2 gap-2">
            {options.map((opt, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">
                    {i + 1}.
                  </span>
                  {/* onFocus/onBlur로 포커스된 보기 인덱스 추적 */}
                  <Input
                    value={opt}
                    onChange={(e) => handleOptionChange(i, e.target.value)}
                    onFocus={() => setFocusedOptionIndex(i)}
                    onBlur={() => setFocusedOptionIndex(null)}
                    className="h-8 text-sm"
                    placeholder={`보기 ${i + 1}`}
                  />
                </div>
                {/* 포커스된 보기에만 LaTeX 미리보기 표시 */}
                {focusedOptionIndex === i && opt.includes('$') && (
                  <div className="rounded-md border bg-muted/30 p-1.5">
                    <LatexRenderer text={opt} className="text-xs" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 정답 */}
      <div className="space-y-1">
        <label className="text-xs font-medium">정답</label>
        <Input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="h-8 text-sm"
          placeholder="정답을 입력하세요"
        />
        {/* LaTeX 수식이 포함된 경우에만 정답 미리보기 표시 */}
        {previewAnswer && previewAnswer.includes('$') && (
          <div className="rounded-md border bg-muted/30 p-2">
            <p className="mb-1 text-xs text-muted-foreground">미리보기</p>
            <LatexRenderer text={previewAnswer} className="text-sm" />
          </div>
        )}
      </div>

      {/* 그래프/그림 (읽기 전용) */}
      {question.hasFigure && question.figures && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <ImageIcon className="h-3 w-3" />
          <span>그래프/그림은 편집할 수 없습니다.</span>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          <X className="mr-1 h-3 w-3" />
          취소
        </Button>
        <Button size="sm" onClick={handleSave}>
          <Check className="mr-1 h-3 w-3" />
          저장
        </Button>
      </div>
    </div>
  )
}

// ─── 메인 QuestionCard 컴포넌트 ───────────────────────────

export function QuestionCard({
  question,
  isEditing,
  isReanalyzing,
  reanalyzingDisabled,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onReanalyze,
  onDelete,
}: QuestionCardProps) {
  const confidenceStyle = getConfidenceStyle(question.confidence)
  const isTemp = question.id.startsWith('temp-')

  return (
    <AccordionItem value={question.id} className="relative">
      {/* 재분석 오버레이 */}
      {isReanalyzing && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-md bg-background/80 backdrop-blur-sm">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">
            AI가 문제를 다시 분석하고 있습니다...
          </p>
          <p className="text-xs text-muted-foreground">
            수십 초 정도 소요될 수 있습니다.
          </p>
        </div>
      )}

      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            Q{question.questionNumber}
          </span>
          <Badge variant="outline" className="text-xs">
            {QUESTION_TYPE_LABELS[question.questionType] ??
              question.questionType}
          </Badge>
          <Badge
            variant="outline"
            className={`text-xs ${confidenceStyle.text} ${confidenceStyle.bg} ${confidenceStyle.border}`}
          >
            {confidenceStyle.label}
          </Badge>
          {question.isConfirmed && (
            <Badge variant="secondary" className="text-xs">
              확정됨
            </Badge>
          )}
          {isTemp && (
            <Badge variant="outline" className="text-xs text-blue-600">
              수동 추가
            </Badge>
          )}
        </div>
      </AccordionTrigger>

      <AccordionContent className="space-y-3 px-1">
        {isEditing ? (
          <EditMode
            question={question}
            onSave={onSaveEdit}
            onCancel={onCancelEdit}
          />
        ) : (
          <>
            <ReadMode
              question={question}
              confidenceStyle={confidenceStyle}
            />

            {/* 액션 버튼 */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit()
                }}
              >
                <Pencil className="mr-1 h-3 w-3" />
                편집
              </Button>

              {/* AI 재분석 — temp-ID 문제는 비활성화 */}
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onReanalyze()
                }}
                disabled={isTemp || reanalyzingDisabled}
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                AI 재분석
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                삭제
              </Button>
            </div>
          </>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}
