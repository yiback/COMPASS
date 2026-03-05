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
  EXAM_TYPE_LABELS,
  YEAR_OPTIONS,
} from './constants'
import {
  getGradeOptions,
  formatGradeLabel,
  isValidGradeForSchoolType,
  type SchoolType,
} from '@/lib/utils/grade-filter-utils'

/**
 * 기출문제 목록 필터 Toolbar
 *
 * 6개 필터를 URL searchParams로 관리하는 Client Component
 * - 텍스트 Input 2개: 학교명, 과목 (debounce 300ms)
 * - Select 4개: 학년, 시험유형, 연도, 학기 (즉시 반영)
 * 필터 변경 시 page 파라미터 삭제 → 첫 페이지로 초기화
 */
export function PastExamsToolbar() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 텍스트 필터 로컬 상태 (debounce용)
  const [school, setSchool] = useState(searchParams.get('school') ?? '')
  const [subject, setSubject] = useState(searchParams.get('subject') ?? '')

  // schoolType 필터 상태
  const [schoolType, setSchoolType] = useState<SchoolType | 'all'>(
    (searchParams.get('schoolType') as SchoolType | 'all') ?? 'all'
  )

  // 파생 상태: schoolType에서 학년 옵션 계산
  const gradeOptions = getGradeOptions(schoolType)

  // 학교명 디바운싱 (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (school) {
        params.set('school', school)
      } else {
        params.delete('school')
      }
      params.delete('page')
      router.push(`/past-exams?${params.toString()}`)
    }, 300)

    return () => clearTimeout(timer)
  }, [school, router, searchParams])

  // 과목 디바운싱 (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (subject) {
        params.set('subject', subject)
      } else {
        params.delete('subject')
      }
      params.delete('page')
      router.push(`/past-exams?${params.toString()}`)
    }, 300)

    return () => clearTimeout(timer)
  }, [subject, router, searchParams])

  // schoolType 변경 핸들러 (grade 유효성 검증 포함)
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
    router.push(`/past-exams?${params.toString()}`)
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
    router.push(`/past-exams?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 학교명 검색 */}
      <Input
        placeholder="학교명 검색..."
        value={school}
        onChange={(e) => setSchool(e.target.value)}
        className="w-[180px]"
      />

      {/* 과목 검색 */}
      <Input
        placeholder="과목 검색..."
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="w-[150px]"
      />

      {/* 학교유형 */}
      <Select
        defaultValue={searchParams.get('schoolType') ?? 'all'}
        onValueChange={(v) => handleSchoolTypeChange(v as SchoolType | 'all')}
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
        <SelectTrigger className="w-[120px]">
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

      {/* 시험유형 */}
      <Select
        defaultValue={searchParams.get('examType') ?? 'all'}
        onValueChange={(v) => handleSelectChange('examType', v)}
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="시험유형" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 유형</SelectItem>
          {Object.entries(EXAM_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 연도 */}
      <Select
        defaultValue={searchParams.get('year') ?? 'all'}
        onValueChange={(v) => handleSelectChange('year', v)}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="연도" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 연도</SelectItem>
          {YEAR_OPTIONS.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}년
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 학기 */}
      <Select
        defaultValue={searchParams.get('semester') ?? 'all'}
        onValueChange={(v) => handleSelectChange('semester', v)}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="학기" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 학기</SelectItem>
          <SelectItem value="1">1학기</SelectItem>
          <SelectItem value="2">2학기</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
