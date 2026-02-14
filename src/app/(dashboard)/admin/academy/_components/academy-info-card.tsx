'use client'

import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { AcademyData } from '@/lib/actions/academies'

interface AcademyInfoCardProps {
  readonly data: AcademyData
}

export function AcademyInfoCard({ data }: AcademyInfoCardProps) {
  async function copyInviteCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('초대 코드가 복사되었습니다.')
    } catch {
      toast.error('복사에 실패했습니다.')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>학원 정보</CardTitle>
          <CardDescription>학원의 기본 정보를 확인합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                학원명
              </p>
              <p className="text-sm">{data.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">상태</p>
              <div>
                <Badge variant={data.isActive ? 'default' : 'secondary'}>
                  {data.isActive ? '활성' : '비활성'}
                </Badge>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">주소</p>
              <p className="text-sm">{data.address ?? '-'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                전화번호
              </p>
              <p className="text-sm">{data.phone ?? '-'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                로고 URL
              </p>
              <p className="text-sm">{data.logoUrl ?? '-'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                초대 코드
              </p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono">{data.inviteCode ?? '미설정'}</p>
                {data.inviteCode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyInviteCode(data.inviteCode!)}
                  >
                    복사
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                등록일
              </p>
              <p className="text-sm">
                {data.createdAt
                  ? new Date(data.createdAt).toLocaleDateString('ko-KR')
                  : '-'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                수정일
              </p>
              <p className="text-sm">
                {data.updatedAt
                  ? new Date(data.updatedAt).toLocaleDateString('ko-KR')
                  : '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
