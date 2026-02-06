import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold tracking-tight">COMPASS</h1>
      <p className="text-muted-foreground">AI 기반 학교별 예상시험 생성 플랫폼</p>
      <Button>시작하기</Button>
    </div>
  )
}
