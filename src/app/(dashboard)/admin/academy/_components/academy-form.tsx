'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  academyUpdateSchema,
  type AcademyUpdateInput,
} from '@/lib/validations/academies'
import { updateMyAcademy, type AcademyData } from '@/lib/actions/academies'

interface AcademyFormProps {
  readonly initialData: AcademyData
}

export function AcademyForm({ initialData }: AcademyFormProps) {
  const router = useRouter()

  // ─── 빈칸 1: useTransition 훅 ─────────────────────────
  // isPending과 startTransition을 가져오세요
  // 힌트: const [???, ???] = useTransition()
  const [isPending, startTransition] = useTransition()


  // ─── 빈칸 2: useForm 설정 ─────────────────────────────
  // React Hook Form + Zod 연동
  // 힌트: useForm<AcademyUpdateInput>({
  //   resolver: ???(???),
  //   defaultValues: { name: ???, address: ???, ... }
  // })
  // 주의: initialData의 null 값은 '' 로 변환해야 합니다
  const form = useForm<AcademyUpdateInput>({
    resolver: zodResolver(academyUpdateSchema),
    defaultValues: {
      name: initialData.name,
      address: initialData.address ?? '',
      phone: initialData.phone ?? '',
      logoUrl: initialData.logoUrl ?? '',
    },
  })


  // ─── 빈칸 3: 초대 코드 복사 함수 ──────────────────────
  // navigator.clipboard.writeText() 사용
  // 성공: toast.success('초대 코드가 복사되었습니다.')
  // 실패: toast.error('복사에 실패했습니다.')
  async function copyInviteCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('초대코드가 복사 되었습니다.')
    } catch {
      toast.error('복사가 실패했습니다.')
    }
  }


  // ─── 빈칸 4: 폼 제출 함수 ─────────────────────────────
  // 1. startTransition으로 감싸기
  // 2. FormData 구성 (name, address, phone, logoUrl)
  // 3. updateMyAcademy(null, formData) 호출
  // 4. 실패: toast.error(result.error)
  // 5. 성공: toast.success + router.refresh()
  // 힌트: function onSubmit(values: AcademyUpdateInput) { ... }
  function onSubmit(values: AcademyUpdateInput) {
    startTransition ( async() => {
      const formData = new FormData()
      formData.append('name', values.name)
      formData.append('address', values.address ?? '')
      formData.append('phone', values.phone ?? '')
      formData.append('logoUrl', values.logoUrl ?? '')

      const result = await updateMyAcademy(null, formData)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('학원 정보가 수정되었습니다.')
      router.refresh()
    })
  }


  return (
    <div className="space-y-6">
      {/* 학원 상태 카드 (읽기 전용) */}
      <Card>
        <CardHeader>
          <CardTitle>학원 상태</CardTitle>
          <CardDescription>학원의 현재 상태 정보입니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                초대 코드
              </p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono">
                  {initialData.inviteCode ?? '미설정'}
                </p>
                {initialData.inviteCode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyInviteCode(initialData.inviteCode!)}
                    disabled={isPending}
                  >
                    복사
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">상태</p>
              <div>
                <Badge variant={initialData.isActive ? 'default' : 'secondary'}>
                  {initialData.isActive ? '활성' : '비활성'}
                </Badge>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                등록일
              </p>
              <p className="text-sm">
                {initialData.createdAt
                  ? new Date(initialData.createdAt).toLocaleDateString('ko-KR')
                  : '-'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                수정일
              </p>
              <p className="text-sm">
                {initialData.updatedAt
                  ? new Date(initialData.updatedAt).toLocaleDateString('ko-KR')
                  : '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* 학원 정보 수정 폼 */}
      <Card>
        <CardHeader>
          <CardTitle>학원 정보 수정</CardTitle>
          <CardDescription>학원의 기본 정보를 수정합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* ─── 빈칸 5: Form + form.handleSubmit 연결 ─── */}
          {/* 힌트: <Form {...form}> */}
          {/*         <form onSubmit={form.handleSubmit(onSubmit)}> */}
          {/* TODO: 아래 주석을 실제 코드로 교체하세요 */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* 학원명 필드 (필수) */}
            {/* ─── 빈칸 6: FormField 작성 ─── */}
            {/* 힌트: <FormField control={form.control} name="name" render={...} /> */}
            {/* render 안에: FormItem > FormLabel + FormControl > Input + FormMessage */}
            {/* TODO: 여기에 작성 */}
            <FormField
              control={form.control}
              name = "name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>학원명 *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="학원명을 입력하세요"
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 주소 필드 */}
            {/* TODO: name="address" FormField 작성 */}
            <FormField
              control={form.control}
              name = "address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>주소</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="주소를 입력하세요"
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 전화번호 필드 */}
            {/* TODO: name="phone" FormField 작성 */}
            <FormField
              control = {form.control}
              name = "phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>전화번호</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="전화번호를 입력하세요"
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 로고 URL 필드 */}
            {/* TODO: name="logoUrl" FormField 작성 */}
            <FormField
              control={form.control}
              name = "logoUrl"
              render= {({ field }) => (
                <FormItem>
                  <FormLabel>로고 URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="로고 URL을 입력하세요."
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 저장 버튼 */}
            {/* ─── 빈칸 7: 버튼 ─── */}
            {/* 힌트: isPending 상태에 따라 '저장 중...' / '저장' 텍스트 분기 */}
            {/* TODO: 여기에 작성 */}
            <div className="flex justify-end">
              <Button type = "submit" disabled={isPending}>
                {isPending ? '저장 중...' : '저장'}
              </Button>
            </div>

          {/* Form 닫기 */}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
