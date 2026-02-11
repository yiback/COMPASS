/**
 * 인증 레이아웃
 * 로그인/가입/비밀번호 재설정 페이지용 심플 레이아웃
 * 중앙 정렬, 최대 너비 제한
 */

interface AuthLayoutProps {
  children: React.ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* 로고/타이틀 */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">COMPASS</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI 기반 학교별 예상시험 생성 플랫폼
          </p>
        </div>

        {/* 페이지 콘텐츠 */}
        {children}
      </div>
    </div>
  )
}
