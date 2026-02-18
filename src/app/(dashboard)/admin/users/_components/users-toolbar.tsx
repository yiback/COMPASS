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

/**
 * 사용자 목록 툴바
 *
 * 학교 관리 toolbar 패턴 재사용 (필터 1개 → 2개로 확장)
 * - 검색: 이름/이메일 debounce 300ms
 * - 역할 필터: 전체/학생/교사/관리자
 * - 상태 필터: 전체/활성/비활성
 */
export function UsersToolbar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') ?? '')

  // 검색어 디바운싱 (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (search) {
        params.set('search', search)
      } else {
        params.delete('search')
      }
      params.delete('page') // 검색 시 첫 페이지로
      router.push(`/admin/users?${params.toString()}`)
    }, 300)

    return () => clearTimeout(timer)
  }, [search, router, searchParams])

  const handleRoleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set('role', value)
    } else {
      params.delete('role')
    }
    params.delete('page') // 필터 변경 시 첫 페이지로
    router.push(`/admin/users?${params.toString()}`)
  }

  const handleStatusChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set('isActive', value)
    } else {
      params.delete('isActive')
    }
    params.delete('page') // 필터 변경 시 첫 페이지로
    router.push(`/admin/users?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        placeholder="이름 또는 이메일 검색..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      <Select
        defaultValue={searchParams.get('role') ?? 'all'}
        onValueChange={handleRoleChange}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="역할" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체</SelectItem>
          <SelectItem value="student">학생</SelectItem>
          <SelectItem value="teacher">교사</SelectItem>
          <SelectItem value="admin">관리자</SelectItem>
        </SelectContent>
      </Select>
      <Select
        defaultValue={searchParams.get('isActive') ?? 'all'}
        onValueChange={handleStatusChange}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="상태" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체</SelectItem>
          <SelectItem value="true">활성</SelectItem>
          <SelectItem value="false">비활성</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
