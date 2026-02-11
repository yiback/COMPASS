'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { deleteSchool } from '@/lib/actions/schools'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface School {
  id: string
  name: string
  school_type: 'elementary' | 'middle' | 'high'
  region?: string | null
  district?: string | null
  created_at: string
}

const SCHOOL_TYPE_MAP = {
  elementary: '초등학교',
  middle: '중학교',
  high: '고등학교',
} as const

export const schoolColumns: ColumnDef<School>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="학교명" />
    ),
  },
  {
    accessorKey: 'school_type',
    header: '학교 유형',
    cell: ({ row }) => {
      return SCHOOL_TYPE_MAP[row.original.school_type]
    },
  },
  {
    accessorKey: 'region',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="지역" />
    ),
    cell: ({ row }) => row.original.region || '-',
  },
  {
    accessorKey: 'district',
    header: '구/군',
    cell: ({ row }) => row.original.district || '-',
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="등록일" />
    ),
    cell: ({ row }) =>
      new Date(row.original.created_at).toLocaleDateString('ko-KR'),
  },
  {
    id: 'actions',
    cell: function ActionsCell({ row }) {
      const router = useRouter()

      async function handleDelete() {
        if (!confirm('정말 삭제하시겠습니까?')) return

        const result = await deleteSchool(row.original.id)

        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('학교가 삭제되었습니다.')
          router.refresh()
        }
      }

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">메뉴 열기</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <a href={`/admin/schools/${row.original.id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                수정
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
