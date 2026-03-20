'use client'

/**
 * 기출문제 추출 편집기 — 클라이언트 컴포넌트
 *
 * 좌우 분할 레이아웃: 좌측 이미지 썸네일(1/3) + 우측 문제 카드(2/3)
 * 상태별 분기: pending → 자동 추출, completed → 카드 편집, failed → 재시도
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Accordion } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Plus,
  RefreshCw,
  Check,
  Loader2,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react'
import { extractQuestionsAction } from '@/lib/actions/extract-questions'
import { resetExtractionAction } from '@/lib/actions/extract-questions'
import { reanalyzeQuestionAction } from '@/lib/actions/extract-questions'
import { updateExtractedQuestionAction } from '@/lib/actions/exam-management'
import { deleteExtractedQuestionAction } from '@/lib/actions/exam-management'
import { confirmExtractedQuestionsAction } from '@/lib/actions/exam-management'
import { createExtractedQuestionAction } from '@/lib/actions/exam-management'
import { createClient } from '@/lib/supabase/client'
import { EXTRACTION_STATUS_MAP } from '../../_components/constants'
import { QuestionCard } from './question-card'
import type { EditFormData } from './question-card'
import type { ExamMeta, ImageData, QuestionData } from './page'

// ─── Props ────────────────────────────────────────────────

interface ExtractionEditorProps {
  readonly examMeta: ExamMeta
  readonly initialImages: readonly ImageData[]
  readonly initialQuestions: readonly QuestionData[]
}

// ─── 시험유형 레이블 ──────────────────────────────────────

const EXAM_TYPE_LABELS: Record<string, string> = {
  midterm: '중간고사',
  final: '기말고사',
  mock: '모의고사',
  diagnostic: '진단평가',
}

// ─── 컴포넌트 ─────────────────────────────────────────────

export function ExtractionEditor({
  examMeta,
  initialImages,
  initialQuestions,
}: ExtractionEditorProps) {
  const router = useRouter()

  // ─── 상태 ─────────────────────────────────────────────

  const [questions, setQuestions] = useState<QuestionData[]>([
    ...initialQuestions,
  ])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [extractionStatus, setExtractionStatus] = useState(
    examMeta.extractionStatus,
  )

  // 이미지 Signed URL 캐시 (pageNumber → signedUrl)
  const [imageSignedUrls, setImageSignedUrls] = useState<
    Record<number, string>
  >({})

  // ─── useEffect: 이미지 Signed URL 생성 ─────────────────

  useEffect(() => {
    if (initialImages.length === 0) return

    let cancelled = false
    const supabase = createClient()

    async function loadSignedUrls() {
      // Promise.all 병렬화 — 직렬 대비 N배 빠른 Signed URL 생성
      const results = await Promise.all(
        initialImages.map(async (img) => {
          const { data } = await supabase.storage
            .from('past-exams')
            .createSignedUrl(img.sourceImageUrl, 300)
          return { pageNumber: img.pageNumber, signedUrl: data?.signedUrl ?? null }
        })
      )

      if (cancelled) return

      const urls: Record<number, string> = {}
      for (const { pageNumber, signedUrl } of results) {
        if (signedUrl) {
          urls[pageNumber] = signedUrl
        }
      }
      setImageSignedUrls(urls)
    }

    loadSignedUrls()

    return () => {
      cancelled = true
    }
  }, [initialImages])

  // ─── useEffect: 자동 추출 (pending 상태) ─────────────────

  useEffect(() => {
    if (extractionStatus !== 'pending') return
    if (isExtracting) return

    let cancelled = false

    // eslint-disable-next-line react-hooks/set-state-in-effect -- race condition 방지 패턴: cancelled 플래그와 함께 사용
    setIsExtracting(true)

    extractQuestionsAction(examMeta.id)
      .then((result) => {
        if (cancelled) return
        if (result.error) {
          toast.error(result.error)
          setExtractionStatus('failed')
        } else {
          router.refresh()
          setExtractionStatus('completed')
          toast.success('문제 추출이 완료되었습니다.')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExtractionStatus('failed')
          toast.error('문제 추출 중 오류가 발생했습니다.')
        }
      })
      .finally(() => {
        if (!cancelled) setIsExtracting(false)
      })

    return () => {
      cancelled = true
    }
  }, [extractionStatus, examMeta.id, router, isExtracting])

  // ─── 핸들러: 편집 ────────────────────────────────────────

  function handleStartEdit(questionId: string) {
    setEditingId(questionId)
  }

  function handleCancelEdit() {
    setEditingId(null)
  }

  async function handleSaveEdit(questionId: string, data: EditFormData) {
    const isTemp = questionId.startsWith('temp-')

    if (isTemp) {
      // 수동 추가 문제 → DB 생성
      const result = await createExtractedQuestionAction(examMeta.id, {
        questionNumber:
          questions.find((q) => q.id === questionId)?.questionNumber ?? 1,
        questionText: data.questionText,
        questionType: data.questionType,
        options: data.options,
        answer: data.answer,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      // temp-ID → 실제 ID로 교체 (불변 패턴)
      if (result.data?.id) {
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === questionId
              ? {
                  ...q,
                  id: result.data!.id,
                  questionText: data.questionText,
                  questionType: data.questionType,
                  options: data.options,
                  answer: data.answer,
                }
              : q,
          ),
        )
      }
    } else {
      // 기존 문제 → DB 업데이트
      const result = await updateExtractedQuestionAction(questionId, {
        questionText: data.questionText,
        questionType: data.questionType,
        options: data.options,
        answer: data.answer,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      // 로컬 상태 업데이트 (불변 패턴)
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? {
                ...q,
                questionText: data.questionText,
                questionType: data.questionType,
                options: data.options,
                answer: data.answer,
              }
            : q,
        ),
      )
    }

    setEditingId(null)
    toast.success('문제가 저장되었습니다.')
  }

  // ─── 핸들러: AI 재분석 ──────────────────────────────────

  async function handleReanalyze(detailId: string) {
    setReanalyzingId(detailId)

    try {
      const result = await reanalyzeQuestionAction(detailId)

      if (result.error) {
        toast.error(result.error)
      } else {
        // 서버 데이터로 갱신 (router.refresh로 서버 컴포넌트 재패칭)
        router.refresh()
        toast.success('AI 재분석이 완료되었습니다.')
      }
    } catch {
      toast.error('AI 재분석 중 오류가 발생했습니다.')
    } finally {
      setReanalyzingId(null)
    }
  }

  // ─── 핸들러: 삭제 ────────────────────────────────────────

  async function handleDelete(questionId: string) {
    const isTemp = questionId.startsWith('temp-')

    if (isTemp) {
      // 로컬에서만 제거 (불변 패턴)
      setQuestions((prev) => prev.filter((q) => q.id !== questionId))
      return
    }

    const result = await deleteExtractedQuestionAction(questionId)

    if (result.error) {
      toast.error(result.error)
      return
    }

    // 로컬 상태에서 제거 (불변 패턴)
    setQuestions((prev) => prev.filter((q) => q.id !== questionId))
    toast.success('문제가 삭제되었습니다.')
  }

  // ─── 핸들러: 전체 재추출 ──────────────────────────────────

  async function handleReset() {
    setIsResetting(true)

    try {
      const result = await resetExtractionAction(examMeta.id)

      if (result.error) {
        toast.error(result.error)
        return
      }

      // 로컬 상태 초기화 → useEffect가 자동 추출 트리거
      setQuestions([])
      setEditingId(null)
      setExtractionStatus('pending')
      setResetDialogOpen(false)
      toast.success('전체 재추출을 시작합니다.')
    } catch {
      toast.error('전체 재추출 중 오류가 발생했습니다.')
    } finally {
      setIsResetting(false)
    }
  }

  // ─── 핸들러: 확정 저장 ──────────────────────────────────

  async function handleConfirm() {
    setIsConfirming(true)

    try {
      const result = await confirmExtractedQuestionsAction(examMeta.id)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(
        `${result.data?.confirmedCount ?? 0}개 문제가 확정되었습니다.`,
      )
      router.push('/past-exams')
    } catch {
      toast.error('확정 저장 중 오류가 발생했습니다.')
    } finally {
      setIsConfirming(false)
    }
  }

  // ─── 핸들러: 수동 추가 ──────────────────────────────────

  function handleManualAdd() {
    const tempId = `temp-${Date.now()}`
    const newQuestion: QuestionData = {
      id: tempId,
      questionNumber: questions.length + 1,
      questionText: '',
      questionType: 'short_answer',
      options: null,
      answer: '',
      hasFigure: false,
      figures: null,
      confidence: 1.0,
      isConfirmed: false,
    }

    // 불변 패턴: 새 배열 생성
    setQuestions((prev) => [...prev, newQuestion])
    setEditingId(tempId)
  }

  // ─── 핸들러: 재시도 (failed → pending) ─────────────────

  function handleRetry() {
    setExtractionStatus('pending')
  }

  // ─── 추출 상태 정보 ────────────────────────────────────

  const statusInfo = EXTRACTION_STATUS_MAP[extractionStatus] ?? {
    label: extractionStatus,
    variant: 'secondary' as const,
  }

  // 확정 저장 비활성 조건
  const confirmDisabled =
    questions.length === 0 ||
    extractionStatus !== 'completed' ||
    isConfirming ||
    questions.some((q) => q.id.startsWith('temp-'))

  // ─── 렌더링 ─────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/past-exams')}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            목록
          </Button>
          <div>
            <h1 className="text-xl font-bold">
              {examMeta.schoolName} {examMeta.grade}학년 {examMeta.subject}{' '}
              {EXAM_TYPE_LABELS[examMeta.examType] ?? examMeta.examType}
            </h1>
            <p className="text-sm text-muted-foreground">
              {examMeta.year}년 {examMeta.semester}학기
            </p>
          </div>
        </div>
        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
      </div>

      {/* 추출 중 상태 */}
      {(extractionStatus === 'pending' || extractionStatus === 'processing') &&
        isExtracting && (
          <div className="flex flex-col items-center gap-3 rounded-lg border py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              시험지를 분석하고 있습니다...
            </p>
            <p className="text-xs text-muted-foreground">
              이미지 수에 따라 1~2분 정도 소요될 수 있습니다.
            </p>
          </div>
        )}

      {/* 대기 상태 (useEffect 트리거 직전) */}
      {extractionStatus === 'pending' && !isExtracting && (
        <div className="flex flex-col items-center gap-3 rounded-lg border py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">추출 대기 중...</p>
        </div>
      )}

      {/* 실패 상태 */}
      {extractionStatus === 'failed' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-destructive bg-destructive/10 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">
                문제 추출에 실패했습니다.
              </p>
              <p className="text-xs text-destructive/80">
                다시 시도하거나, 문제를 수동으로 추가할 수 있습니다.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleRetry}>
              <RefreshCw className="mr-1 h-4 w-4" />
              재시도
            </Button>
            <Button variant="outline" onClick={handleManualAdd}>
              <Plus className="mr-1 h-4 w-4" />
              문제 수동 추가
            </Button>
          </div>

          {/* 이전 결과가 남아있는 경우 표시 */}
          {questions.length > 0 && (
            <QuestionsPanel
              questions={questions}
              imageSignedUrls={imageSignedUrls}
              initialImages={initialImages}
              editingId={editingId}
              reanalyzingId={reanalyzingId}
              onEdit={handleStartEdit}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={handleSaveEdit}
              onReanalyze={handleReanalyze}
              onDelete={handleDelete}
            />
          )}
        </div>
      )}

      {/* 완료 상태: 좌우 분할 레이아웃 */}
      {extractionStatus === 'completed' && !isExtracting && (
        <>
          {questions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border py-12">
              <p className="text-sm text-muted-foreground">
                추출된 문제가 없습니다.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setResetDialogOpen(true)}
                >
                  <RefreshCw className="mr-1 h-4 w-4" />
                  전체 재추출
                </Button>
                <Button onClick={handleManualAdd}>
                  <Plus className="mr-1 h-4 w-4" />
                  문제 수동 추가
                </Button>
              </div>
            </div>
          ) : (
            <QuestionsPanel
              questions={questions}
              imageSignedUrls={imageSignedUrls}
              initialImages={initialImages}
              editingId={editingId}
              reanalyzingId={reanalyzingId}
              onEdit={handleStartEdit}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={handleSaveEdit}
              onReanalyze={handleReanalyze}
              onDelete={handleDelete}
            />
          )}

          {/* 하단 액션 버튼 */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleManualAdd}>
                <Plus className="mr-1 h-4 w-4" />
                문제 수동 추가
              </Button>
              <Button
                variant="outline"
                onClick={() => setResetDialogOpen(true)}
              >
                <RefreshCw className="mr-1 h-4 w-4" />
                전체 재추출
              </Button>
            </div>
            <Button
              onClick={handleConfirm}
              disabled={confirmDisabled}
            >
              {isConfirming ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-1 h-4 w-4" />
              )}
              확정 저장 ({questions.length}문제)
            </Button>
          </div>
        </>
      )}

      {/* 전체 재추출 확인 Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>전체 재추출</DialogTitle>
            <DialogDescription>
              기존 추출 결과와 수동 편집 내용이 모두 삭제됩니다.
              계속하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetDialogOpen(false)}
              disabled={isResetting}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={isResetting}
            >
              {isResetting ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-4 w-4" />
              )}
              재추출
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── 좌우 분할 패널 (문제 목록 + 이미지 썸네일) ─────────────

interface QuestionsPanelProps {
  readonly questions: readonly QuestionData[]
  readonly imageSignedUrls: Record<number, string>
  readonly initialImages: readonly ImageData[]
  readonly editingId: string | null
  readonly reanalyzingId: string | null
  readonly onEdit: (id: string) => void
  readonly onCancelEdit: () => void
  readonly onSaveEdit: (id: string, data: EditFormData) => void
  readonly onReanalyze: (id: string) => void
  readonly onDelete: (id: string) => void
}

function QuestionsPanel({
  questions,
  imageSignedUrls,
  initialImages,
  editingId,
  reanalyzingId,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onReanalyze,
  onDelete,
}: QuestionsPanelProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* 좌측: 이미지 썸네일 */}
      <div className="col-span-1 space-y-2 overflow-y-auto rounded-lg border p-3" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <p className="text-xs font-medium text-muted-foreground">
          원본 이미지 ({initialImages.length}페이지)
        </p>
        {initialImages.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            이미지가 없습니다.
          </p>
        ) : (
          initialImages.map((img) => {
            const signedUrl = imageSignedUrls[img.pageNumber]
            return (
              <div key={img.id} className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {img.pageNumber}페이지
                </p>
                {signedUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- Signed URL 동적 이미지 */
                  <img
                    src={signedUrl}
                    alt={`시험지 ${img.pageNumber}페이지`}
                    className="w-full rounded-md border object-contain"
                  />
                ) : (
                  <div className="flex h-24 items-center justify-center rounded-md border bg-muted">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* 우측: 문제 카드 목록 */}
      <div className="col-span-2 overflow-y-auto rounded-lg border p-3" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          추출된 문제 ({questions.length}개)
        </p>
        <Accordion type="multiple" className="space-y-1">
          {questions.map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              isEditing={editingId === question.id}
              isReanalyzing={reanalyzingId === question.id}
              reanalyzingDisabled={reanalyzingId !== null}
              onEdit={() => onEdit(question.id)}
              onCancelEdit={onCancelEdit}
              onSaveEdit={(data) => onSaveEdit(question.id, data)}
              onReanalyze={() => onReanalyze(question.id)}
              onDelete={() => onDelete(question.id)}
            />
          ))}
        </Accordion>
      </div>
    </div>
  )
}
