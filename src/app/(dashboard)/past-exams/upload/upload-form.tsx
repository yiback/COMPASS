/**
 * 기출문제 업로드 폼 (Client Component)
 *
 * 다중 이미지 선택 + 메타데이터 입력 + createPastExamAction 제출
 * 클라이언트 이미지 검증: 20장/5MB/100MB
 * 성공 시 /past-exams/${pastExamId}/edit 리다이렉트
 */

'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createPastExamAction,
  type ExamManagementResult,
} from '@/lib/actions/exam-management'
import {
  MAX_IMAGE_COUNT,
  MAX_IMAGE_SIZE,
  MAX_TOTAL_SIZE,
} from '@/lib/validations/exam-management'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  getGradeOptions,
  formatGradeLabel,
  type SchoolType,
} from '@/lib/utils/grade-filter-utils'
import { ImageSorter } from './image-sorter'

// ─── 타입 ───────────────────────────────────────────────

interface School {
  readonly id: string
  readonly name: string
  readonly school_type: string
}

interface UploadFormProps {
  readonly schools: readonly School[]
}

// ─── 상수 ───────────────────────────────────────────────

const EXAM_TYPE_LABELS: Record<string, string> = {
  midterm: '중간고사',
  final: '기말고사',
  mock: '모의고사',
  diagnostic: '진단평가',
}

const CURRENT_YEAR = new Date().getFullYear()

const MAX_IMAGE_SIZE_MB = MAX_IMAGE_SIZE / (1024 * 1024)
const MAX_TOTAL_SIZE_MB = MAX_TOTAL_SIZE / (1024 * 1024)

// ─── 클라이언트 이미지 검증 ──────────────────────────────

interface ValidationResult {
  readonly valid: boolean
  readonly error?: string
}

/** 클라이언트 사전 검증 (서버 검증 전 빠른 피드백) */
function validateFilesClient(files: readonly File[]): ValidationResult {
  if (files.length > MAX_IMAGE_COUNT) {
    return {
      valid: false,
      error: `이미지는 최대 ${MAX_IMAGE_COUNT}장까지 업로드할 수 있습니다.`,
    }
  }

  const oversized = files.find((f) => f.size > MAX_IMAGE_SIZE)
  if (oversized) {
    return {
      valid: false,
      error: `${oversized.name}의 크기가 ${MAX_IMAGE_SIZE_MB}MB를 초과합니다.`,
    }
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0)
  if (totalSize > MAX_TOTAL_SIZE) {
    return {
      valid: false,
      error: `전체 이미지 크기가 ${MAX_TOTAL_SIZE_MB}MB를 초과합니다.`,
    }
  }

  return { valid: true }
}

// ─── 컴포넌트 ────────────────────────────────────────────

export function UploadForm({ schools }: UploadFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // 서버 응답 상태
  const [result, setResult] = useState<ExamManagementResult | null>(null)

  // 선택된 파일 목록 (순서 포함 — 불변 배열)
  const [selectedFiles, setSelectedFiles] = useState<readonly File[]>([])

  // 클라이언트 검증 에러
  const [validationError, setValidationError] = useState<string | null>(null)

  // 학교 선택 추적 (동적 학년 옵션용 — FormData는 uncontrolled Select가 처리)
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('')

  // 파생 상태: schoolType은 selectedSchoolId에서 계산 (Single Source of Truth)
  const selectedSchool = schools.find((s) => s.id === selectedSchoolId)
  const schoolType = selectedSchool?.school_type as SchoolType | undefined
  const gradeOptions = schoolType ? getGradeOptions(schoolType) : []

  // 성공 시 편집 페이지로 이동
  useEffect(() => {
    if (result?.data?.pastExamId) {
      router.push(`/past-exams/${result.data.pastExamId}/edit`)
    }
  }, [result, router])

  // 파일 선택 핸들러
  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])

    if (files.length === 0) {
      setSelectedFiles([])
      setValidationError(null)
      return
    }

    const validation = validateFilesClient(files)
    if (!validation.valid) {
      setValidationError(validation.error ?? null)
      e.target.value = ''
      return
    }

    setValidationError(null)
    setSelectedFiles(files)
  }

  // 이미지 순서 변경 (ImageSorter에서 호출)
  function handleReorder(files: readonly File[]) {
    setSelectedFiles(files)

    // 파일이 모두 삭제된 경우 input 리셋
    if (files.length === 0) {
      setValidationError(null)
    }
  }

  // 폼 제출 핸들러
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (selectedFiles.length === 0) {
      setValidationError('이미지를 1장 이상 선택해주세요.')
      return
    }

    const formElement = e.currentTarget
    const formData = new FormData(formElement)

    // file input의 기본 파일 제거 후 순서가 반영된 파일 추가
    formData.delete('images')
    for (const file of selectedFiles) {
      formData.append('images', file)
    }

    startTransition(async () => {
      const response = await createPastExamAction(formData)
      setResult(response)
    })
  }

  // 에러 메시지 (서버 에러 + 클라이언트 검증 에러)
  const errorMessage = validationError ?? result?.error

  return (
    <Card>
      <CardHeader>
        <CardTitle>시험지 이미지 업로드</CardTitle>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* 에러 메시지 */}
          {errorMessage && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </div>
          )}

          {/* 이미지 파일 선택 */}
          <div className="space-y-2">
            <Label htmlFor="images">
              시험지 이미지 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="images"
              name="images"
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              multiple
              required={selectedFiles.length === 0}
              disabled={isPending}
              onChange={handleFilesChange}
            />
            <p className="text-xs text-muted-foreground">
              허용 형식: JPEG, PNG, WebP — 최대 {MAX_IMAGE_COUNT}장, 개별{' '}
              {MAX_IMAGE_SIZE_MB}MB, 총 {MAX_TOTAL_SIZE_MB}MB
            </p>
          </div>

          {/* 이미지 미리보기 + 순서 변경 */}
          {selectedFiles.length > 0 && (
            <ImageSorter
              files={selectedFiles}
              onReorder={handleReorder}
              disabled={isPending}
            />
          )}

          {/* 학교 선택 */}
          <div className="space-y-2">
            <Label htmlFor="schoolId">
              학교 <span className="text-destructive">*</span>
            </Label>
            <Select
              name="schoolId"
              required
              disabled={isPending}
              onValueChange={setSelectedSchoolId}
            >
              <SelectTrigger id="schoolId">
                <SelectValue placeholder="학교를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {schools.map((school) => (
                  <SelectItem key={school.id} value={school.id}>
                    {school.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 학년 (uncontrolled + key prop 리셋 — MEMORY.md 패턴) */}
          <div className="space-y-2">
            <Label htmlFor="grade">
              학년 <span className="text-destructive">*</span>
            </Label>
            <Select
              key={selectedSchoolId}
              name="grade"
              required
              disabled={isPending || !selectedSchoolId}
            >
              <SelectTrigger id="grade">
                <SelectValue
                  placeholder={
                    selectedSchoolId
                      ? '학년을 선택하세요'
                      : '학교를 먼저 선택하세요'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {gradeOptions.map((grade) => (
                  <SelectItem key={grade} value={String(grade)}>
                    {formatGradeLabel(grade)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 과목 */}
          <div className="space-y-2">
            <Label htmlFor="subject">
              과목 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subject"
              name="subject"
              type="text"
              placeholder="예: 수학, 영어, 국어"
              maxLength={50}
              required
              disabled={isPending}
            />
          </div>

          {/* 연도 */}
          <div className="space-y-2">
            <Label htmlFor="year">
              연도 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="year"
              name="year"
              type="number"
              min={2000}
              max={2100}
              defaultValue={CURRENT_YEAR}
              required
              disabled={isPending}
            />
          </div>

          {/* 학기 */}
          <div className="space-y-2">
            <Label htmlFor="semester">
              학기 <span className="text-destructive">*</span>
            </Label>
            <Select name="semester" required disabled={isPending}>
              <SelectTrigger id="semester">
                <SelectValue placeholder="학기를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1학기</SelectItem>
                <SelectItem value="2">2학기</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 시험 유형 */}
          <div className="space-y-2">
            <Label htmlFor="examType">
              시험 유형 <span className="text-destructive">*</span>
            </Label>
            <Select name="examType" required disabled={isPending}>
              <SelectTrigger id="examType">
                <SelectValue placeholder="시험 유형을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EXAM_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>

        <CardFooter>
          <Button
            type="submit"
            className="w-full"
            disabled={isPending || selectedFiles.length === 0}
          >
            {isPending ? '업로드 중...' : '시험지 업로드'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
