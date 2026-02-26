'use client'

import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-react'
import type { PastExamListItem } from '@/lib/actions/past-exams'
import {
  EXAM_TYPE_LABELS,
  EXAM_TYPE_BADGE_VARIANT,
  EXTRACTION_STATUS_MAP,
} from './constants'
import { PastExamDetailSheet } from './past-exam-detail-sheet'

// ─── 기출문제 DataTable 컬럼 정의 (9개) ──────────────────
// 팩토리 함수: callerRole을 PastExamDetailSheet에 전달 (AI 문제 생성 버튼 조건부 표시)
// @see user-columns.tsx createUserColumns — 동일 패턴

export function createPastExamColumns(
  callerRole: string,
): ColumnDef<PastExamListItem>[] {
  return [
  // 1. 학교
  {
    accessorKey: 'schoolName',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="학교" />
    ),
  },

  // 2. 학년
  {
    accessorKey: 'grade',
    header: '학년',
    cell: ({ row }) => `${row.original.grade}학년`,
  },

  // 3. 과목
  {
    accessorKey: 'subject',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="과목" />
    ),
  },

  // 4. 시험유형
  {
    accessorKey: 'examType',
    header: '시험유형',
    cell: ({ row }) => {
      const examType = row.original.examType
      return (
        <Badge variant={EXAM_TYPE_BADGE_VARIANT[examType] ?? 'secondary'}>
          {EXAM_TYPE_LABELS[examType] ?? examType}
        </Badge>
      )
    },
  },

  // 5. 연도/학기 (가상 컬럼)
  {
    id: 'yearSemester',
    header: '연도/학기',
    accessorFn: (row) => `${row.year}년 ${row.semester}학기`,
  },

  // 6. 추출 상태
  {
    accessorKey: 'extractionStatus',
    header: '상태',
    cell: ({ row }) => {
      const status = row.original.extractionStatus
      const info = EXTRACTION_STATUS_MAP[status] ?? {
        label: status,
        variant: 'secondary' as const,
      }
      return <Badge variant={info.variant}>{info.label}</Badge>
    },
  },

  // 7. 업로드자
  {
    accessorKey: 'uploadedByName',
    header: '업로드',
    cell: ({ row }) => row.original.uploadedByName ?? '—',
  },

  // 8. 등록일
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="등록일" />
    ),
    cell: ({ row }) =>
      new Date(row.original.createdAt).toLocaleDateString('ko-KR'),
  },

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
            callerRole={callerRole}
          />
        </>
      )
    },
  },
  ]
}
