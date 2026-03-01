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

    // cleanup: 이전 요청 취소 (race condition 방지)
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

              <InfoRow label="난이도">{detail.difficultyLabel}</InfoRow>

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
              {detail.unit && <InfoRow label="단원">{detail.unit}</InfoRow>}

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
                    (detail.sourceMetadata as Record<string, unknown>).schoolName as string,
                    `${(detail.sourceMetadata as Record<string, unknown>).year}년`,
                    `${(detail.sourceMetadata as Record<string, unknown>).semester}학기`,
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
