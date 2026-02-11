'use client'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'

export function SchoolsToolbar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') ?? '')

  // 검색어 디바운싱
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (search) {
        params.set('search', search)
      } else {
        params.delete('search')
      }
      params.delete('page') // 검색 시 첫 페이지로
      router.push(`/admin/schools?${params.toString()}`)
    }, 300)

    return () => clearTimeout(timer)
  }, [search, router, searchParams])

  const handleTypeChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set('schoolType', value)
    } else {
      params.delete('schoolType')
    }
    params.delete('page') // 필터 변경 시 첫 페이지로
    router.push(`/admin/schools?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        placeholder="학교명 검색..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      <Select
        defaultValue={searchParams.get('schoolType') ?? 'all'}
        onValueChange={handleTypeChange}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="학교 유형" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체</SelectItem>
          <SelectItem value="elementary">초등학교</SelectItem>
          <SelectItem value="middle">중학교</SelectItem>
          <SelectItem value="high">고등학교</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
