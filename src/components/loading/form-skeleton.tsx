import { Skeleton } from '@/components/ui/skeleton'

interface FormSkeletonProps {
  /** 필드 수 */
  fieldCount?: number
}

export function FormSkeleton({ fieldCount = 4 }: FormSkeletonProps) {
  return (
    <div className="space-y-6">
      {Array.from({ length: fieldCount }, (_, i) => (
        <div key={i} className="space-y-2">
          {/* 라벨 */}
          <Skeleton className="h-4 w-24" />
          {/* 인풋 */}
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      {/* 제출 버튼 */}
      <Skeleton className="h-9 w-24" />
    </div>
  )
}
