/**
 * 교사(teacher) 대시보드 컴포넌트
 *
 * 본인의 기출문제/생성 문제 통계 카드 4개 + 최근 기출문제 활동 리스트를 표시한다.
 * props로 TeacherStats를 받아 순수 렌더링만 수행 (Server Component 호환).
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { DashboardStats } from '@/lib/actions/dashboard'

// ─── 타입 ──────────────────────────────────────────────

/** DashboardStats에서 teacher 역할만 추출 */
type TeacherStats = Extract<DashboardStats, { role: 'teacher' }>

interface TeacherDashboardProps {
  readonly stats: TeacherStats
}

// ─── 상수 ──────────────────────────────────────────────

/** 시험 유형 한국어 매핑 */
const EXAM_TYPE_LABELS: Record<string, string> = {
  midterm: '중간고사',
  final: '기말고사',
  mock: '모의고사',
  diagnostic: '진단평가',
}

/** 추출 상태 뱃지 스타일 */
const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  completed: { label: '추출 완료', className: 'bg-green-100 text-green-800' },
  pending: { label: '추출 대기', className: 'bg-yellow-100 text-yellow-800' },
  processing: { label: '추출 중', className: 'bg-blue-100 text-blue-800' },
  failed: { label: '추출 실패', className: 'bg-red-100 text-red-800' },
}

// ─── 통계 카드 정의 ────────────────────────────────────

interface StatCard {
  readonly title: string
  readonly value: number
}

function getStatCards(stats: TeacherStats): readonly StatCard[] {
  return [
    { title: '내 기출문제', value: stats.myPastExamCount },
    { title: '내 생성 문제', value: stats.myQuestionCount },
    { title: '추출 완료', value: stats.extractionCompleted },
    { title: '추출 대기', value: stats.extractionPending },
  ]
}

// ─── 헬퍼 ──────────────────────────────────────────────

/** 학년을 "중1" 형식으로 변환 */
function formatGrade(grade: number): string {
  if (grade >= 1 && grade <= 6) return `초${grade}`
  if (grade >= 7 && grade <= 9) return `중${grade - 6}`
  if (grade >= 10 && grade <= 12) return `고${grade - 9}`
  return `${grade}학년`
}

/** 날짜 문자열을 "YYYY.MM.DD" 형식으로 변환 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}.${month}.${day}`
}

// ─── 컴포넌트 ──────────────────────────────────────────

export function TeacherDashboard({ stats }: TeacherDashboardProps) {
  const statCards = getStatCards(stats)

  return (
    <div className="space-y-6">
      {/* 통계 카드 그리드 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
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

      {/* 최근 활동 */}
      <Card>
        <CardHeader>
          <CardTitle>최근 기출문제</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentPastExams.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              아직 기출문제가 없습니다
            </p>
          ) : (
            <ul className="space-y-3">
              {stats.recentPastExams.map((exam) => {
                const statusStyle = STATUS_STYLES[exam.extractionStatus] ?? {
                  label: exam.extractionStatus,
                  className: 'bg-gray-100 text-gray-800',
                }
                return (
                  <li
                    key={exam.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span>{exam.subject}</span>
                      <span className="text-muted-foreground">|</span>
                      <span>{formatGrade(exam.grade)}</span>
                      <span className="text-muted-foreground">|</span>
                      <span>
                        {EXAM_TYPE_LABELS[exam.examType] ?? exam.examType}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle.className}`}
                      >
                        {statusStyle.label}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      {formatDate(exam.createdAt)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
