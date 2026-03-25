'use client'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { ExternalLink } from 'lucide-react'
import { gradeToLabel, type AchievementStandard } from './columns'

// ─── 타입 ──────────────────────────────────────────────

interface DetailSheetProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly standard: AchievementStandard | null
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
 * 성취기준 상세 Sheet (오른쪽 사이드 패널)
 *
 * - Server Action 호출 없음 — prop으로 받은 데이터만 표시
 * - 전체 content 텍스트, 키워드 전체 Badge, 출처 링크 등
 */
export function DetailSheet({
  open,
  onOpenChange,
  standard,
}: DetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {standard ? `[${standard.code}] 성취기준 상세` : '성취기준 상세'}
          </SheetTitle>
          <SheetDescription>
            성취기준의 상세 정보를 확인합니다.
          </SheetDescription>
        </SheetHeader>

        {standard && (
          <div className="flex flex-col gap-4 p-4">
            {/* 내용 — 전체 텍스트 */}
            <InfoRow label="내용">
              <p className="whitespace-pre-wrap text-sm font-normal leading-relaxed">
                {standard.content}
              </p>
            </InfoRow>

            {/* 과목 */}
            <InfoRow label="과목">{standard.subject}</InfoRow>

            {/* 학년 */}
            <InfoRow label="학년">{gradeToLabel(standard.grade)}</InfoRow>

            {/* 학기 */}
            <InfoRow label="학기">
              {standard.semester ? `${standard.semester}학기` : '-'}
            </InfoRow>

            {/* 단원 */}
            <InfoRow label="단원">{standard.unit ?? '-'}</InfoRow>

            {/* 소단원 */}
            <InfoRow label="소단원">{standard.sub_unit ?? '-'}</InfoRow>

            {/* 키워드 — 전체 Badge 표시 */}
            <InfoRow label="키워드">
              {standard.keywords.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {standard.keywords.map((keyword) => (
                    <Badge key={keyword} variant="secondary" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              ) : (
                '-'
              )}
            </InfoRow>

            {/* 출처 */}
            <InfoRow label="출처">
              {standard.source_name ? (
                standard.source_url ? (
                  <a
                    href={standard.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {standard.source_name}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  standard.source_name
                )
              ) : (
                '-'
              )}
            </InfoRow>

            {/* 진도 순서 */}
            <InfoRow label="진도 순서">
              {standard.order_in_semester != null
                ? `${standard.order_in_semester}번째`
                : '-'}
            </InfoRow>

            {/* 교육과정 버전 */}
            <InfoRow label="교육과정 버전">
              {standard.curriculum_version ?? '-'}
            </InfoRow>

            {/* 적용 연도 */}
            <InfoRow label="적용 연도">
              {standard.effective_year != null
                ? `${standard.effective_year}년`
                : '-'}
            </InfoRow>

            {/* 상태 */}
            <InfoRow label="상태">
              <Badge variant={standard.is_active ? 'default' : 'secondary'}>
                {standard.is_active ? '활성' : '비활성'}
              </Badge>
            </InfoRow>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
