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
import {
  getGradeOptions,
  formatGradeLabel,
  isValidGradeForSchoolType,
  type SchoolType,
} from '@/lib/utils/grade-filter-utils'
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS, SOURCE_TYPE_LABELS } from './constants'

/**
 * 문제 목록 필터 Toolbar
 *
 * 5개 필터를 URL searchParams로 관리하는 Client Component
 * - 텍스트 Input 1개: 과목 (debounce 300ms)
 * - Select 4개: 학교유형, 학년(동적), 문제유형, 난이도
 *
 * schoolType 변경 시 grade Select 옵션이 연동됨:
 * - elementary: 초1~초6
 * - middle: 중1~중3
 * - high: 고1~고3
 * - all: 전체 학년
 *
 * 필터 변경 시 page 파라미터 삭제 → 첫 페이지로 초기화
 */
export function QuestionsToolbar() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 텍스트 필터 로컬 상태 (debounce용)
  const [subject, setSubject] = useState(searchParams.get('subject') ?? '')

  // schoolType 로컬 상태 (grade 연동에 필요)
  const [schoolType, setSchoolType] = useState<SchoolType | 'all'>(
    (searchParams.get('schoolType') as SchoolType | 'all') ?? 'all'
  )

  // 과목 debounce (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (subject) {
        params.set('subject', subject)
      } else {
        params.delete('subject')
      }
      params.delete('page')
      router.push(`/questions?${params.toString()}`)
    }, 300)

    return () => clearTimeout(timer)
  }, [subject, router, searchParams])

  // schoolType 변경 핸들러 (grade 연동)
  function handleSchoolTypeChange(value: SchoolType | 'all') {
    setSchoolType(value)

    const params = new URLSearchParams(searchParams.toString())

    if (value && value !== 'all') {
      params.set('schoolType', value)
    } else {
      params.delete('schoolType')
    }

    // schoolType 변경 시 현재 grade가 유효하지 않으면 초기화
    const currentGrade = searchParams.get('grade')
    if (currentGrade) {
      const gradeNum = parseInt(currentGrade, 10)
      if (!isValidGradeForSchoolType(gradeNum, value)) {
        params.delete('grade')
      }
    }

    params.delete('page')
    router.push(`/questions?${params.toString()}`)
  }

  // Select 필터 공통 핸들러
  function handleSelectChange(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')
    router.push(`/questions?${params.toString()}`)
  }

  // schoolType에 따른 학년 옵션 (동적)
  const gradeOptions = getGradeOptions(schoolType)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 과목 검색 (debounce) */}
      <Input
        placeholder="과목 검색..."
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="w-[150px]"
      />

      {/* 학교유형 */}
      <Select
        defaultValue={searchParams.get('schoolType') ?? 'all'}
        onValueChange={handleSchoolTypeChange}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="학교유형" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 유형</SelectItem>
          <SelectItem value="elementary">초등</SelectItem>
          <SelectItem value="middle">중등</SelectItem>
          <SelectItem value="high">고등</SelectItem>
        </SelectContent>
      </Select>

      {/* 학년 (schoolType 연동 동적 옵션) */}
      <Select
        defaultValue={searchParams.get('grade') ?? 'all'}
        onValueChange={(v) => handleSelectChange('grade', v)}
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue placeholder="학년" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 학년</SelectItem>
          {gradeOptions.map((grade) => (
            <SelectItem key={grade} value={String(grade)}>
              {formatGradeLabel(grade)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 문제유형 */}
      <Select
        defaultValue={searchParams.get('type') ?? 'all'}
        onValueChange={(v) => handleSelectChange('type', v)}
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue placeholder="유형" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 유형</SelectItem>
          {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 난이도 */}
      <Select
        defaultValue={searchParams.get('difficulty') ?? 'all'}
        onValueChange={(v) => handleSelectChange('difficulty', v)}
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue placeholder="난이도" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 난이도</SelectItem>
          {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 출처 */}
      <Select
        defaultValue={searchParams.get('sourceType') ?? 'all'}
        onValueChange={(v) => handleSelectChange('sourceType', v)}
      >
        <SelectTrigger className="w-[110px]">
          <SelectValue placeholder="출처" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 출처</SelectItem>
          {Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
