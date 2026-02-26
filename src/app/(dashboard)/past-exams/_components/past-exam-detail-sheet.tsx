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
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { getPastExamDetail } from '@/lib/actions/past-exams'
import type { PastExamDetail } from '@/lib/actions/past-exams'
import { GenerateQuestionsDialog } from './generate-questions-dialog'
import {
  EXAM_TYPE_LABELS,
  EXAM_TYPE_BADGE_VARIANT,
  EXTRACTION_STATUS_MAP,
} from './constants'

// ─── 타입 정의 ────────────────────────────────────────

interface PastExamDetailSheetProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly examId: string
  readonly callerRole?: string // 1-7 추가: 교사/관리자만 AI 문제 생성 버튼 표시
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
 * 기출문제 상세 Sheet (오른쪽 사이드 패널)
 *
 * - Sheet 열릴 때 getPastExamDetail(examId) 호출 → Signed URL 생성 (60초 만료)
 * - useEffect race condition 방지: `let cancelled = false` + cleanup 패턴
 * - 조회 전용 (관리 액션 없음)
 */
export function PastExamDetailSheet({
  open,
  onOpenChange,
  examId,
  callerRole,
}: PastExamDetailSheetProps) {
  const [detail, setDetail] = useState<PastExamDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false) // 1-7 추가: Dialog 열림 상태

  // 교사/관리자 여부 (AI 문제 생성 버튼 표시 조건)
  const isTeacherOrAbove = ['teacher', 'admin', 'system_admin'].includes(
    callerRole ?? '',
  )

  // Sheet 열릴 때 상세 데이터 패칭 (race condition 방지: cancelled 플래그)
  useEffect(() => {
    if (!open || !examId) return

    let cancelled = false

    // eslint-disable-next-line react-hooks/set-state-in-effect -- race condition 방지 패턴: cancelled 플래그와 함께 사용
    setLoading(true)
    setError(null)

    getPastExamDetail(examId)
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
  }, [open, examId])

  // 추출 상태 정보
  const statusInfo = detail
    ? EXTRACTION_STATUS_MAP[detail.extractionStatus] ?? {
        label: detail.extractionStatus,
        variant: 'secondary' as const,
      }
    : null

  // PDF 파일 여부 판단
  const isPdf = detail?.signedImageUrl?.toLowerCase().includes('.pdf')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>기출문제 상세</SheetTitle>
          <SheetDescription>기출문제 정보를 확인합니다.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 p-4">
          {/* 로딩 상태 */}
          {loading && (
            <p className="text-sm text-muted-foreground">
              상세 정보를 불러오는 중...
            </p>
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
              <InfoRow label="학교">{detail.schoolName}</InfoRow>

              <InfoRow label="학년">{detail.grade}학년</InfoRow>

              <InfoRow label="과목">{detail.subject}</InfoRow>

              <InfoRow label="시험유형">
                <Badge
                  variant={
                    EXAM_TYPE_BADGE_VARIANT[detail.examType] ?? 'secondary'
                  }
                >
                  {EXAM_TYPE_LABELS[detail.examType] ?? detail.examType}
                </Badge>
              </InfoRow>

              <InfoRow label="연도/학기">
                {detail.year}년 {detail.semester}학기
              </InfoRow>

              <InfoRow label="추출 상태">
                {statusInfo && (
                  <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                )}
              </InfoRow>

              <InfoRow label="업로드">{detail.uploadedByName ?? '—'}</InfoRow>

              <InfoRow label="등록일">
                {new Date(detail.createdAt).toLocaleDateString('ko-KR')}
              </InfoRow>

              {/* 이미지 미리보기 */}
              {detail.signedImageUrl && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">원본 이미지</p>
                  {isPdf ? (
                    <p className="text-sm text-muted-foreground">
                      PDF 파일은 미리보기를 지원하지 않습니다.
                    </p>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={detail.signedImageUrl}
                      alt="기출문제 원본"
                      className="max-h-[400px] w-full rounded-md border object-contain"
                    />
                  )}
                </div>
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
