'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { createSchool, updateSchool } from '@/lib/actions/schools'
import { schoolSchema, type SchoolInput } from '@/lib/validations/schools'

interface SchoolFormProps {
  mode: 'create' | 'edit'
  initialData?: {
    id: string
    name: string
    school_type: 'elementary' | 'middle' | 'high'
    region?: string | null
    district?: string | null
    address?: string | null
  }
}

/**
 * 학교 생성/수정 공통 폼 컴포넌트
 * - mode='create': 새 학교 생성
 * - mode='edit': 기존 학교 수정 (initialData 필수)
 */
export function SchoolForm({ mode, initialData }: SchoolFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<SchoolInput>({
    resolver: zodResolver(schoolSchema),
    defaultValues: {
      name: initialData?.name ?? '',
      schoolType: initialData?.school_type ?? '',
      region: initialData?.region ?? '',
      district: initialData?.district ?? '',
      address: initialData?.address ?? '',
    },
  })

  async function onSubmit(data: SchoolInput) {
    startTransition(async () => {
      let result

      if (mode === 'create') {
        const formData = new FormData()
        formData.append('name', data.name)
        formData.append('schoolType', data.schoolType)
        if (data.region) formData.append('region', data.region)
        if (data.district) formData.append('district', data.district)
        if (data.address) formData.append('address', data.address)
        result = await createSchool(null, formData)
      } else {
        if (!initialData?.id) {
          toast.error('학교 ID가 없습니다.')
          return
        }
        const formData = new FormData()
        formData.append('name', data.name)
        formData.append('schoolType', data.schoolType)
        if (data.region) formData.append('region', data.region)
        if (data.district) formData.append('district', data.district)
        if (data.address) formData.append('address', data.address)
        result = await updateSchool(initialData.id, null, formData)
      }

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(
          mode === 'create' ? '학교가 추가되었습니다.' : '학교가 수정되었습니다.'
        )
        router.push('/admin/schools')
        router.refresh()
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>학교명 *</FormLabel>
              <FormControl>
                <Input
                  placeholder="예: 서울고등학교"
                  disabled={isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="schoolType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>학교 유형 *</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                disabled={isPending}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="학교 유형을 선택하세요" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="elementary">초등학교</SelectItem>
                  <SelectItem value="middle">중학교</SelectItem>
                  <SelectItem value="high">고등학교</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="region"
          render={({ field }) => (
            <FormItem>
              <FormLabel>지역</FormLabel>
              <FormControl>
                <Input
                  placeholder="예: 서울특별시"
                  disabled={isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="district"
          render={({ field }) => (
            <FormItem>
              <FormLabel>구/군</FormLabel>
              <FormControl>
                <Input
                  placeholder="예: 강남구"
                  disabled={isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>주소</FormLabel>
              <FormControl>
                <Input
                  placeholder="예: 서울특별시 강남구 테헤란로 123"
                  disabled={isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            취소
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending
              ? '처리 중...'
              : mode === 'create'
                ? '학교 추가'
                : '수정 완료'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
