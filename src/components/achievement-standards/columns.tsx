'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Pencil, Ban } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ─── 타입 ──────────────────────────────────────────────

export interface AchievementStandard {
  readonly id: string
  readonly code: string
  readonly content: string
  readonly subject: string
  readonly grade: number
  readonly semester: number | null
  readonly unit: string | null
  readonly sub_unit: string | null
  readonly keywords: string[]
  readonly is_active: boolean
  readonly created_at: string
  readonly source_name: string | null
  readonly source_url: string | null
  readonly order_in_semester: number | null
  readonly curriculum_version: string | null
  readonly effective_year: number | null
}

// ─── 학년 변환 맵 ──────────────────────────────────────

export const GRADE_LABEL_MAP: Record<number, string> = {
  7: '중1',
  8: '중2',
  9: '중3',
} as const

export function gradeToLabel(grade: number): string {
  return GRADE_LABEL_MAP[grade] ?? `${grade}학년`
}

// ─── 컬럼 팩토리 ───────────────────────────────────────

interface ColumnsConfig {
  readonly isSystemAdmin: boolean
  readonly onView?: (standard: AchievementStandard) => void
  readonly onEdit?: (standard: AchievementStandard) => void
  readonly onDeactivate?: (standard: AchievementStandard) => void
}

/**
 * 성취기준 DataTable 컬럼 팩토리
 *
 * isSystemAdmin이면 작업(수정/비활성화) 컬럼 포함
 */
export function createAchievementStandardColumns({
  isSystemAdmin,
  onView,
  onEdit,
  onDeactivate,
}: ColumnsConfig): ColumnDef<AchievementStandard>[] {
  const baseColumns: ColumnDef<AchievementStandard>[] = [
    {
      accessorKey: 'code',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="코드" />
      ),
      cell: ({ row }) => (
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
          {row.original.code}
        </code>
      ),
    },
    {
      accessorKey: 'content',
      header: '내용',
      cell: ({ row }) => {
        const content = row.original.content
        // 100자 truncate — 클릭 시 상세 Sheet 열기
        return (
          <button
            type="button"
            className="line-clamp-2 max-w-[300px] text-left hover:text-primary hover:underline"
            title={content}
            onClick={() => onView?.(row.original)}
          >
            {content.length > 100 ? `${content.slice(0, 100)}...` : content}
          </button>
        )
      },
    },
    {
      accessorKey: 'grade',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="학년" />
      ),
      cell: ({ row }) => gradeToLabel(row.original.grade),
    },
    {
      accessorKey: 'semester',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="학기" />
      ),
      cell: ({ row }) => {
        const semester = row.original.semester
        return semester ? `${semester}학기` : '-'
      },
    },
    {
      accessorKey: 'unit',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="단원" />
      ),
      cell: ({ row }) => row.original.unit ?? '-',
    },
    {
      accessorKey: 'keywords',
      header: '키워드',
      cell: ({ row }) => {
        const keywords = row.original.keywords ?? []
        if (keywords.length === 0) return '-'

        // 최대 3개 표시 + 더보기
        const visible = keywords.slice(0, 3)
        const remaining = keywords.length - 3

        return (
          <div className="flex flex-wrap gap-1">
            {visible.map((keyword) => (
              <Badge key={keyword} variant="secondary" className="text-xs">
                {keyword}
              </Badge>
            ))}
            {remaining > 0 && (
              <Badge variant="outline" className="text-xs">
                +{remaining}
              </Badge>
            )}
          </div>
        )
      },
    },
  ]

  // system_admin만 작업 컬럼 추가
  if (!isSystemAdmin) return baseColumns

  return [
    ...baseColumns,
    {
      id: 'actions',
      cell: function ActionsCell({ row }) {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">메뉴 열기</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(row.original)}>
                <Pencil className="mr-2 h-4 w-4" />
                수정
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDeactivate?.(row.original)}
                className="text-destructive"
              >
                <Ban className="mr-2 h-4 w-4" />
                비활성화
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}
