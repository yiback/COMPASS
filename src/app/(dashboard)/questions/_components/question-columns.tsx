'use client'

import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-react'
import type { QuestionListItem } from '@/lib/actions/questions'
import {
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_BADGE_VARIANT,
  DIFFICULTY_LABELS,
  DIFFICULTY_BADGE_VARIANT,
  SOURCE_TYPE_LABELS,
} from './constants'
import { QuestionDetailSheet } from './question-detail-sheet'

// ─── 문제 DataTable 컬럼 정의 (7개) ──────────────────
// 정적 배열: 권한별 컬럼 분기 없음 (모든 역할 동일)
// 팩토리 함수가 필요해지는 시점: 역할별 액션 버튼이 달라질 때

export const questionColumns: ColumnDef<QuestionListItem>[] = [
  // 1. 과목
  {
    accessorKey: 'subject',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="과목" />
    ),
  },

  // 2. 학년 (formatGradeLabel 사용)
  {
    accessorKey: 'grade',
    header: '학년',
    cell: ({ row }) => {
      const grade = row.original.grade
      // 초등(1-6), 중등(7-9), 고등(10-12) 레이블
      if (grade <= 6) return `초${grade}`
      if (grade <= 9) return `중${grade - 6}`
      return `고${grade - 9}`
    },
  },

  // 3. 문제유형 (Badge)
  {
    accessorKey: 'type',
    header: '유형',
    cell: ({ row }) => {
      const type = row.original.type
      return (
        <Badge variant={QUESTION_TYPE_BADGE_VARIANT[type] ?? 'secondary'}>
          {QUESTION_TYPE_LABELS[type] ?? type}
        </Badge>
      )
    },
  },

  // 4. 난이도 (Badge)
  {
    accessorKey: 'difficulty',
    header: '난이도',
    cell: ({ row }) => {
      const diff = row.original.difficulty
      return (
        <Badge variant={DIFFICULTY_BADGE_VARIANT[diff] ?? 'secondary'}>
          {DIFFICULTY_LABELS[diff] ?? `${diff}단계`}
        </Badge>
      )
    },
  },

  // 5. 출처
  {
    accessorKey: 'sourceType',
    header: '출처',
    cell: ({ row }) => {
      const sourceType = row.original.sourceType
      if (!sourceType) return '—'
      return SOURCE_TYPE_LABELS[sourceType] ?? sourceType
    },
  },

  // 6. 등록일
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="등록일" />
    ),
    cell: ({ row }) =>
      new Date(row.original.createdAt).toLocaleDateString('ko-KR'),
  },

  // 7. 액션 (상세 보기) — QuestionDetailSheet 연결
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
  },
]
