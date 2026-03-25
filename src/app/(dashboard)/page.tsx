/**
 * 대시보드 홈 페이지
 *
 * Server Component: getCurrentProfile()로 인증 확인 (React 19 cache — layout과 동일 호출 1회)
 * 역할별 대시보드 컴포넌트 분기:
 * - admin → AdminDashboard
 * - teacher → TeacherDashboard
 * - student → 인라인 (바로가기 링크)
 * - system_admin → 인라인 (플랫폼 통계)
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentProfile } from '@/lib/auth'
import { getDashboardStats } from '@/lib/actions/dashboard'
import type { DashboardStats } from '@/lib/actions/dashboard'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AdminDashboard } from '@/components/dashboard/admin-dashboard'
import { TeacherDashboard } from '@/components/dashboard/teacher-dashboard'

// ─── system_admin 인라인 렌더링 ────────────────────────

interface SystemAdminStats {
  readonly stats: Extract<DashboardStats, { role: 'system_admin' }>
}

function SystemAdminDashboard({ stats }: SystemAdminStats) {
  const cards = [
    { title: '학원 수', value: stats.academyCount },
    { title: '사용자 수', value: stats.totalUsers },
    { title: '기출문제 수', value: stats.totalPastExams },
    { title: '성취기준 수', value: stats.activeStandardsCount },
  ] as const

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">플랫폼 관리</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── student 인라인 렌더링 ─────────────────────────────

function StudentDashboard() {
  const links = [
    { href: '/questions', label: '문제 풀기' },
    { href: '/achievement-standards', label: '성취기준 보기' },
  ] as const

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>학습을 시작하세요</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            아래 바로가기를 통해 학습을 시작할 수 있습니다.
          </p>
          <div className="flex gap-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── 에러 상태 ─────────────────────────────────────────

function ErrorCard({ message }: { readonly message: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-destructive">오류</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}

// ─── 메인 페이지 ───────────────────────────────────────

export default async function DashboardPage() {
  // 인증 확인 (React cache — layout과 동일 호출, DB 1회)
  const profile = await getCurrentProfile()
  if (!profile) {
    redirect('/login')
  }

  // 대시보드 통계 조회
  const result = await getDashboardStats()

  // 에러 상태
  if (result.error || !result.stats) {
    return <ErrorCard message={result.error ?? '데이터를 불러올 수 없습니다.'} />
  }

  const { stats } = result

  // 역할별 분기
  switch (stats.role) {
    case 'admin':
      return <AdminDashboard stats={stats} />
    case 'teacher':
      return <TeacherDashboard stats={stats} />
    case 'student':
      return <StudentDashboard />
    case 'system_admin':
      return <SystemAdminDashboard stats={stats} />
    default:
      return <ErrorCard message="대시보드 데이터를 불러올 수 없습니다." />
  }
}
