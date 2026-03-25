'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X } from 'lucide-react'
import { achievementStandardCreateSchema } from '@/lib/validations/achievement-standards'
import {
  createAchievementStandard,
  updateAchievementStandard,
} from '@/lib/actions/achievement-standards'
import type { AchievementStandard } from './columns'

// ─── 타입 ──────────────────────────────────────────────

interface FormDialogBaseProps {
  readonly mode: 'create' | 'edit'
  readonly initialData?: AchievementStandard
}

/** 트리거 기반 (생성용) */
interface TriggerFormDialogProps extends FormDialogBaseProps {
  readonly trigger: React.ReactNode
  readonly open?: never
  readonly onOpenChange?: never
}

/** 제어 모드 (수정용) */
interface ControlledFormDialogProps extends FormDialogBaseProps {
  readonly trigger?: never
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

type FormDialogProps = TriggerFormDialogProps | ControlledFormDialogProps

// ─── 학년 옵션 ─────────────────────────────────────────

const GRADE_OPTIONS = [
  { value: '7', label: '중1' },
  { value: '8', label: '중2' },
  { value: '9', label: '중3' },
] as const

// ─── FormDialog 컴포넌트 ───────────────────────────────

export function FormDialog(props: FormDialogProps) {
  const { mode, initialData } = props
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [keywords, setKeywords] = useState<string[]>(
    initialData?.keywords ?? []
  )
  const [keywordInput, setKeywordInput] = useState('')

  const isEdit = mode === 'edit'

  // 제어/비제어 모드 분기
  const isControlled = props.open !== undefined
  const dialogOpen = isControlled ? props.open : internalOpen
  const setDialogOpen = isControlled
    ? props.onOpenChange
    : setInternalOpen

  const form = useForm({
    resolver: zodResolver(achievementStandardCreateSchema),
    defaultValues: {
      code: initialData?.code ?? '',
      content: initialData?.content ?? '',
      subject: initialData?.subject ?? '수학',
      grade: initialData?.grade ?? 7,
      semester: initialData?.semester ?? undefined,
      unit: initialData?.unit ?? '',
      sub_unit: '',
      keywords: initialData?.keywords ?? [],
      curriculum_version: '2022',
    },
  })

  // Dialog 열릴 때 폼 초기화
  useEffect(() => {
    if (dialogOpen) {
      form.reset({
        code: initialData?.code ?? '',
        content: initialData?.content ?? '',
        subject: initialData?.subject ?? '수학',
        grade: initialData?.grade ?? 7,
        semester: initialData?.semester ?? undefined,
        unit: initialData?.unit ?? '',
        sub_unit: '',
        keywords: initialData?.keywords ?? [],
        curriculum_version: '2022',
      })
      setKeywords(initialData?.keywords ?? [])
      setKeywordInput('')
    }
  }, [dialogOpen, initialData, form])

  // ─── keywords Badge 관리 ───────────────────────────

  function handleKeywordAdd(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()

    const trimmed = keywordInput.trim()
    if (!trimmed) return
    // 중복 방지
    if (keywords.includes(trimmed)) {
      setKeywordInput('')
      return
    }

    const updated = [...keywords, trimmed]
    setKeywords(updated)
    form.setValue('keywords', updated)
    setKeywordInput('')
  }

  function handleKeywordRemove(target: string) {
    const updated = keywords.filter((k) => k !== target)
    setKeywords(updated)
    form.setValue('keywords', updated)
  }

  // ─── 폼 제출 ───────────────────────────────────────

  function onSubmit(data: Record<string, unknown>) {
    startTransition(async () => {
      // FormData 구성 — zodResolver가 이미 검증 완료한 데이터
      const formData = new FormData()
      formData.append('code', String(data.code ?? ''))
      formData.append('content', String(data.content ?? ''))
      formData.append('subject', String(data.subject ?? ''))
      formData.append('grade', String(data.grade ?? ''))
      if (data.semester) formData.append('semester', String(data.semester))
      if (data.unit) formData.append('unit', String(data.unit))
      if (data.sub_unit) formData.append('sub_unit', String(data.sub_unit))
      formData.append('keywords', JSON.stringify(keywords))
      if (data.source_name) formData.append('source_name', String(data.source_name))
      if (data.source_url) formData.append('source_url', String(data.source_url))
      if (data.order_in_semester) {
        formData.append('order_in_semester', String(data.order_in_semester))
      }
      if (data.effective_year) {
        formData.append('effective_year', String(data.effective_year))
      }
      if (data.curriculum_version) {
        formData.append('curriculum_version', String(data.curriculum_version))
      }

      let result

      if (isEdit && initialData) {
        result = await updateAchievementStandard(initialData.id, null, formData)
      } else {
        result = await createAchievementStandard(null, formData)
      }

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(
        isEdit ? '성취기준이 수정되었습니다.' : '성취기준이 추가되었습니다.'
      )
      setDialogOpen(false)
      router.refresh()
    })
  }

  // ─── 렌더링 ────────────────────────────────────────

  const dialogContent = (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>
          {isEdit ? '성취기준 수정' : '성취기준 추가'}
        </DialogTitle>
        <DialogDescription>
          {isEdit
            ? '성취기준 내용, 키워드, 단원 등을 수정할 수 있습니다.'
            : '새로운 성취기준을 등록합니다.'}
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* 코드 */}
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>성취기준 코드 *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="예: 9수01-01"
                    disabled={isPending || isEdit}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 내용 */}
          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>내용 *</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="성취기준 내용을 입력하세요"
                    disabled={isPending}
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 과목 + 학년 + 학기 (한 줄) */}
          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>과목 *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isPending || isEdit}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="과목" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="수학">수학</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="grade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>학년 *</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(parseInt(v))}
                    defaultValue={String(field.value)}
                    disabled={isPending || isEdit}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="학년" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {GRADE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="semester"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>학기</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(parseInt(v))}
                    defaultValue={
                      field.value ? String(field.value) : undefined
                    }
                    disabled={isPending || isEdit}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="학기" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">1학기</SelectItem>
                      <SelectItem value="2">2학기</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* 단원 */}
          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>단원</FormLabel>
                <FormControl>
                  <Input
                    placeholder="예: 수와 연산"
                    disabled={isPending}
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 키워드 Badge Input */}
          <div className="space-y-2">
            <FormLabel>키워드</FormLabel>
            <div className="flex min-h-[32px] flex-wrap gap-1">
              {keywords.map((keyword) => (
                <Badge key={keyword} variant="secondary" className="gap-1">
                  {keyword}
                  <button
                    type="button"
                    onClick={() => handleKeywordRemove(keyword)}
                    className="ml-1 rounded-full outline-none hover:bg-muted"
                    disabled={isPending}
                  >
                    <X className="h-3 w-3" />
                    <span className="sr-only">삭제</span>
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              placeholder="키워드 입력 후 Enter"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={handleKeywordAdd}
              disabled={isPending}
            />
          </div>

          {/* 제출 버튼 */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
            >
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? '처리 중...'
                : isEdit
                  ? '수정 완료'
                  : '추가'}
            </Button>
          </div>
        </form>
      </Form>
    </DialogContent>
  )

  // 트리거 모드 (생성용)
  if (!isControlled) {
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>{props.trigger}</DialogTrigger>
        {dialogContent}
      </Dialog>
    )
  }

  // 제어 모드 (수정용)
  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {dialogContent}
    </Dialog>
  )
}
