'use client'

import type { Table } from '@tanstack/react-table'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  /** 검색 대상 컬럼 ID */
  searchColumnId?: string
  /** 검색 플레이스홀더 */
  searchPlaceholder?: string
  /** 추가 필터 영역 (children) */
  children?: React.ReactNode
}

export function DataTableToolbar<TData>({
  table,
  searchColumnId,
  searchPlaceholder = '검색...',
  children,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0
  const searchColumn = searchColumnId ? table.getColumn(searchColumnId) : undefined

  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex flex-1 items-center space-x-2">
        {searchColumn && (
          <Input
            placeholder={searchPlaceholder}
            value={(searchColumn.getFilterValue() as string) ?? ''}
            onChange={(event) => searchColumn.setFilterValue(event.target.value)}
            className="h-8 w-[150px] lg:w-[250px]"
          />
        )}
        {children}
        {isFiltered && (
          <Button variant="ghost" onClick={() => table.resetColumnFilters()} className="h-8 px-2 lg:px-3">
            초기화
            <X className="ml-2 size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
