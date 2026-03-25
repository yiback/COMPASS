'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { ChevronsUpDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDistinctUnits } from '@/lib/actions/achievement-standards'

// ─── 상수 ──────────────────────────────────────────────

const GRADE_OPTIONS = [
  { value: '7', label: '중1' },
  { value: '8', label: '중2' },
  { value: '9', label: '중3' },
] as const

const SEMESTER_OPTIONS = [
  { value: '1', label: '1학기' },
  { value: '2', label: '2학기' },
] as const

// ─── 캐스케이딩 필터 툴바 ──────────────────────────────

export function AchievementStandardsToolbar() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL에서 초기값 읽기
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [units, setUnits] = useState<string[]>([])
  const [unitOpen, setUnitOpen] = useState(false)

  // 검색어 디바운싱 (기존 인라인 패턴 — 300ms)
  useEffect(() => {
    let cancelled = false

    const timer = setTimeout(() => {
      if (cancelled) return
      const params = new URLSearchParams(searchParams.toString())
      if (search) {
        params.set('search', search)
      } else {
        params.delete('search')
      }
      router.push(`/achievement-standards?${params.toString()}`)
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [search, router, searchParams])

  // 학년/과목 변경 시 단원 목록 갱신
  const currentSubject = searchParams.get('subject') ?? undefined
  const currentGrade = searchParams.get('grade') ?? undefined

  useEffect(() => {
    let cancelled = false

    async function fetchUnits() {
      const gradeNum = currentGrade ? parseInt(currentGrade) : undefined
      const result = await getDistinctUnits(currentSubject, gradeNum)
      if (cancelled) return
      if (!result.error && result.data) {
        setUnits(result.data as string[])
      }
    }

    fetchUnits()

    return () => {
      cancelled = true
    }
  }, [currentSubject, currentGrade])

  // ─── 필터 변경 핸들러 ────────────────────────────────

  function handleSubjectChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set('subject', value)
    } else {
      params.delete('subject')
    }
    // 과목 변경 → 학년/학기/단원 초기화
    params.delete('grade')
    params.delete('semester')
    params.delete('unit')
    router.push(`/achievement-standards?${params.toString()}`)
  }

  function handleGradeChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set('grade', value)
    } else {
      params.delete('grade')
    }
    // 학년 변경 → 단원 초기화
    params.delete('unit')
    router.push(`/achievement-standards?${params.toString()}`)
  }

  function handleSemesterChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set('semester', value)
    } else {
      params.delete('semester')
    }
    router.push(`/achievement-standards?${params.toString()}`)
  }

  function handleUnitSelect(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    const currentUnit = searchParams.get('unit')
    // 같은 값 클릭 → 해제
    if (currentUnit === value) {
      params.delete('unit')
    } else {
      params.set('unit', value)
    }
    setUnitOpen(false)
    router.push(`/achievement-standards?${params.toString()}`)
  }

  // ─── 렌더링 ──────────────────────────────────────────

  const selectedUnit = searchParams.get('unit')

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 과목 필터 */}
      <Select
        defaultValue={searchParams.get('subject') ?? 'all'}
        onValueChange={handleSubjectChange}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="과목" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 과목</SelectItem>
          <SelectItem value="수학">수학</SelectItem>
        </SelectContent>
      </Select>

      {/* 학년 필터 */}
      <Select
        defaultValue={searchParams.get('grade') ?? 'all'}
        onValueChange={handleGradeChange}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="학년" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 학년</SelectItem>
          {GRADE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 학기 필터 */}
      <Select
        defaultValue={searchParams.get('semester') ?? 'all'}
        onValueChange={handleSemesterChange}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="학기" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 학기</SelectItem>
          {SEMESTER_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 단원 Combobox */}
      <Popover open={unitOpen} onOpenChange={setUnitOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={unitOpen}
            className="w-[200px] justify-between"
          >
            {selectedUnit ?? '단원 선택...'}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder="단원 검색..." />
            <CommandList>
              <CommandEmpty>단원이 없습니다.</CommandEmpty>
              <CommandGroup>
                {units.map((unit) => (
                  <CommandItem
                    key={unit}
                    value={unit}
                    onSelect={handleUnitSelect}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedUnit === unit ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {unit}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* 검색 */}
      <Input
        placeholder="내용 검색..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-[200px]"
      />
    </div>
  )
}
