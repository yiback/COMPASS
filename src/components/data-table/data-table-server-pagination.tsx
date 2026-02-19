'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface DataTableServerPaginationProps {
  /** 전체 데이터 수 (서버에서 제공) */
  readonly total: number
  /** 현재 페이지 (1-based) */
  readonly page: number
  /** 페이지당 항목 수 */
  readonly pageSize: number
}

/**
 * 서버사이드 페이지네이션 컴포넌트
 *
 * URL searchParams 기반으로 페이지를 전환합니다.
 * - 기존 필터 파라미터를 보존하면서 `page` 파라미터만 변경
 * - page=1이면 URL에서 `page` 파라미터 삭제 (깔끔한 URL)
 * - 1페이지 이하면 미렌더링
 */
export function DataTableServerPagination({
  total,
  page,
  pageSize,
}: DataTableServerPaginationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const totalPages = Math.ceil(total / pageSize)

  // 1페이지 이하면 페이지네이션 불필요
  if (totalPages <= 1) {
    return null
  }

  const canGoPrevious = page > 1
  const canGoNext = page < totalPages

  /**
   * 지정한 페이지로 이동
   * - 기존 searchParams(필터)를 모두 보존
   * - page=1이면 URL에서 page 파라미터 삭제
   */
  function goToPage(targetPage: number) {
    const params = new URLSearchParams(searchParams.toString())

    if (targetPage <= 1) {
      params.delete('page')
    } else {
      params.set('page', String(targetPage))
    }

    const queryString = params.toString()
    router.push(queryString ? `${pathname}?${queryString}` : pathname)
  }

  return (
    <div className="flex items-center justify-end px-2 py-4">
      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex w-[100px] items-center justify-center text-sm font-medium">
          {page} / {totalPages} 페이지
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="hidden size-8 p-0 lg:flex"
            onClick={() => goToPage(1)}
            disabled={!canGoPrevious}
          >
            <span className="sr-only">첫 페이지</span>
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="size-8 p-0"
            onClick={() => goToPage(page - 1)}
            disabled={!canGoPrevious}
          >
            <span className="sr-only">이전 페이지</span>
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="size-8 p-0"
            onClick={() => goToPage(page + 1)}
            disabled={!canGoNext}
          >
            <span className="sr-only">다음 페이지</span>
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden size-8 p-0 lg:flex"
            onClick={() => goToPage(totalPages)}
            disabled={!canGoNext}
          >
            <span className="sr-only">마지막 페이지</span>
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
