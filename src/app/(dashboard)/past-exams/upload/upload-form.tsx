/**
 * 기출문제 업로드 폼 (Client Component)
 * 파일 선택 + 메타데이터 입력 + Server Action 제출
 */

'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  uploadPastExamAction,
  type PastExamActionResult,
} from '@/lib/actions/past-exams'
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

// ─── 컴포넌트 ────────────────────────────────────────────

export function UploadForm({ schools }: UploadFormProps) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState<
    PastExamActionResult | null,
    FormData
  >(uploadPastExamAction, null)

  // 성공 시 목록으로 이동
  useEffect(() => {
    if (state?.data?.id) {
      router.push('/past-exams')
    }
  }, [state, router])

  return (
    <Card>
      <CardHeader>
        <CardTitle>기출문제 파일 업로드</CardTitle>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="space-y-4">
          {/* 에러 메시지 */}
          {state?.error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          )}

          {/* 파일 선택 */}
          <div className="space-y-2">
            <Label htmlFor="file">
              파일 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="file"
              name="file"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              required
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              허용 형식: JPEG, PNG, WebP, PDF (최대 5MB)
            </p>
          </div>

          {/* 학교 선택 */}
          <div className="space-y-2">
            <Label htmlFor="schoolId">
              학교 <span className="text-destructive">*</span>
            </Label>
            <Select name="schoolId" required disabled={isPending}>
              <SelectTrigger id="schoolId">
                <SelectValue placeholder="학교를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {schools.map((school) => (
                  <SelectItem key={school.id} value={school.id}>
                    {school.name} ({school.school_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 학년 */}
          <div className="space-y-2">
            <Label htmlFor="grade">
              학년 <span className="text-destructive">*</span>
            </Label>
            <Select name="grade" required disabled={isPending}>
              <SelectTrigger id="grade">
                <SelectValue placeholder="학년을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((grade) => (
                  <SelectItem key={grade} value={String(grade)}>
                    {grade}학년
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
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? '업로드 중...' : '기출문제 업로드'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
