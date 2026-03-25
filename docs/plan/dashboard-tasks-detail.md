# 단계 2-3: 역할별 대시보드 — Task별 상세 계획

> 마스터 PLAN: `docs/plan/dashboard-by-role.md` v2
> 리뷰 판정: READY (MUST FIX 0건)
> 별도 리뷰 없이 구현 진행 (MEMORY.md 규칙)

---

## Task 1: Server Action (`getDashboardStats`) + 테스트

### 소유 파일
- `src/lib/actions/dashboard.ts` (신규)
- `src/lib/actions/__tests__/dashboard.test.ts` (신규)

### 반환 타입

```typescript
// ─── 공통 ────────────────────────────────────────────

interface RecentPastExam {
  readonly id: string
  readonly subject: string
  readonly grade: number
  readonly examType: string       // midterm, final, mock, diagnostic
  readonly extractionStatus: string  // pending, processing, completed, failed
  readonly createdAt: string
}

// ─── 역할별 (discriminated union) ─────────────────────

interface AdminStats {
  readonly role: 'admin'
  readonly totalUsers: number
  readonly teacherCount: number
  readonly studentCount: number
  readonly pastExamCount: number
  readonly questionCount: number
  readonly recentPastExams: readonly RecentPastExam[]
}

interface TeacherStats {
  readonly role: 'teacher'
  readonly myPastExamCount: number
  readonly myQuestionCount: number
  readonly extractionCompleted: number
  readonly extractionPending: number
  readonly recentPastExams: readonly RecentPastExam[]
}

interface StudentStats {
  readonly role: 'student'
}

interface SystemAdminStats {
  readonly role: 'system_admin'
  readonly academyCount: number
  readonly totalUsers: number
  readonly totalPastExams: number
  readonly activeStandardsCount: number
}

type DashboardStats = AdminStats | TeacherStats | StudentStats | SystemAdminStats

interface DashboardResult {
  readonly error?: string
  readonly stats?: DashboardStats
}
```

### 쿼리 설계

**admin (6쿼리 → Promise.all 병렬)**:
```typescript
const supabase = await createClient()

const [usersRes, teachersRes, studentsRes, examsRes, questionsRes, recentRes] =
  await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('past_exams').select('*', { count: 'exact', head: true }),
    supabase.from('questions').select('*', { count: 'exact', head: true }),
    supabase.from('past_exams')
      .select('id, subject, grade, exam_type, extraction_status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ])
// RLS가 academy_id 자동 필터 → 같은 학원 데이터만 반환
```

**teacher (5쿼리 → Promise.all 병렬)**:
```typescript
const userId = profile.id

const [examsRes, questionsRes, completedRes, pendingRes, recentRes] =
  await Promise.all([
    supabase.from('past_exams').select('*', { count: 'exact', head: true }).eq('created_by', userId),
    supabase.from('questions').select('*', { count: 'exact', head: true }).eq('created_by', userId),
    supabase.from('past_exams').select('*', { count: 'exact', head: true })
      .eq('created_by', userId).eq('extraction_status', 'completed'),
    supabase.from('past_exams').select('*', { count: 'exact', head: true })
      .eq('created_by', userId).eq('extraction_status', 'pending'),
    supabase.from('past_exams')
      .select('id, subject, grade, exam_type, extraction_status, created_at')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])
```

**system_admin (4쿼리 → createAdminClient 사용)**:
```typescript
const adminClient = createAdminClient()

const [academiesRes, usersRes, examsRes, standardsRes] =
  await Promise.all([
    adminClient.from('academies').select('*', { count: 'exact', head: true }),
    adminClient.from('profiles').select('*', { count: 'exact', head: true }),
    adminClient.from('past_exams').select('*', { count: 'exact', head: true }),
    adminClient.from('achievement_standards').select('*', { count: 'exact', head: true })
      .eq('is_active', true),
  ])
```

**student**: 쿼리 없음. 즉시 `{ stats: { role: 'student' } }` 반환.

### 에러 처리

```typescript
try {
  // Promise.all 쿼리
} catch {
  return { error: '대시보드 데이터를 불러올 수 없습니다.' }
}
```

개별 count 에러는 0으로 폴백 (`res.count ?? 0`).

### 테스트 케이스 (~10개)

| # | 케이스 | 예상 결과 |
|---|--------|----------|
| 1 | 미인증 | `{ error: '인증이 필요합니다.' }` |
| 2 | academyId null (admin) | `{ error: '소속 학원이 없습니다.' }` |
| 3 | admin 정상 | `AdminStats` 반환 (count 값 + recentPastExams) |
| 4 | admin 데이터 0건 | `AdminStats` 반환 (모든 count 0, recentPastExams []) |
| 5 | teacher 정상 | `TeacherStats` 반환 |
| 6 | teacher 데이터 0건 | `TeacherStats` 반환 (모든 count 0) |
| 7 | student | `StudentStats` 반환 |
| 8 | system_admin | `SystemAdminStats` 반환 (createAdminClient 사용 확인) |
| 9 | DB 에러 | `{ error: '대시보드 데이터를 불러올 수 없습니다.' }` |
| 10 | recentPastExams snake→camelCase 변환 | `examType`, `extractionStatus`, `createdAt` |

### mock 패턴

```typescript
import { getCurrentUser } from '../helpers'
vi.mock('../helpers', () => ({ getCurrentUser: vi.fn() }))

// createClient mock — count 쿼리 체인
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}))

// createAdminClient mock — system_admin 전용
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminSupabase),
}))

// count 쿼리 mock 헬퍼
function mockCount(count: number) {
  return { count, data: null, error: null }
}
```

### 검증
```bash
npx vitest run src/lib/actions/__tests__/dashboard.test.ts
```

---

## Task 2: 역할별 대시보드 컴포넌트 + page.tsx 교체

### 소유 파일
- `src/components/dashboard/admin-dashboard.tsx` (신규)
- `src/components/dashboard/teacher-dashboard.tsx` (신규)
- `src/app/(dashboard)/page.tsx` (수정)

### AdminDashboard (`src/components/dashboard/admin-dashboard.tsx`)

**Props**: `{ stats: AdminStats }`

**레이아웃**:
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ 전체 사용자  │   교사 수    │   학생 수    │  기출문제    │
│    12명      │    3명       │    8명       │    5건      │
└─────────────┴─────────────┴─────────────┴─────────────┘
┌─────────────────────────────────────────────────────────┐
│ 생성된 문제: 24개                                        │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ 최근 기출 업로드                                         │
│ ─────────────────────────────────────────────            │
│ 수학 | 중3 | 중간고사 | ● 추출 완료 | 2026-03-25         │
│ 영어 | 중2 | 기말고사 | ○ 추출 대기 | 2026-03-24         │
└─────────────────────────────────────────────────────────┘
```

**구현**:
- `grid gap-4 md:grid-cols-2 lg:grid-cols-4` (상단 카드 4개)
- shadcn/ui `Card`, `CardHeader`, `CardTitle`, `CardContent`
- 최근 활동: `div` 리스트 (테이블 불필요 — 5건뿐)
- 빈 상태: `recentPastExams.length === 0` → "아직 기출문제가 없습니다"

**추출 상태 뱃지**:
```typescript
const STATUS_MAP = {
  completed: { label: '추출 완료', className: 'bg-green-100 text-green-800' },
  pending: { label: '추출 대기', className: 'bg-yellow-100 text-yellow-800' },
  processing: { label: '추출 중', className: 'bg-blue-100 text-blue-800' },
  failed: { label: '추출 실패', className: 'bg-red-100 text-red-800' },
} as const
```

**시험 유형 한국어**:
```typescript
const EXAM_TYPE_MAP = {
  midterm: '중간고사',
  final: '기말고사',
  mock: '모의고사',
  diagnostic: '진단평가',
} as const
```

### TeacherDashboard (`src/components/dashboard/teacher-dashboard.tsx`)

**Props**: `{ stats: TeacherStats }`

AdminDashboard와 동일 패턴. 카드 4개 (내 기출, 내 문제, 추출완료, 추출대기) + 최근 활동.

### page.tsx 교체

```typescript
import { getCurrentProfile } from '@/lib/auth'
import { getDashboardStats } from '@/lib/actions/dashboard'
import { AdminDashboard } from '@/components/dashboard/admin-dashboard'
import { TeacherDashboard } from '@/components/dashboard/teacher-dashboard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import Link from 'next/link'

export default async function DashboardPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const { error, stats } = await getDashboardStats()

  if (error || !stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">대시보드</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{error ?? '데이터를 불러올 수 없습니다.'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">
        안녕하세요, {profile.name}님!
      </h1>

      {stats.role === 'admin' && <AdminDashboard stats={stats} />}
      {stats.role === 'teacher' && <TeacherDashboard stats={stats} />}

      {/* student — 인라인 */}
      {stats.role === 'student' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">아직 배정된 시험이 없습니다.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                선생님이 시험을 배정하면 여기에 표시됩니다.
              </p>
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Link href="/questions">
              <Card className="hover:bg-accent transition-colors cursor-pointer">
                <CardHeader><CardTitle>문제 은행</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">저장된 문제를 탐색합니다</p></CardContent>
              </Card>
            </Link>
            <Link href="/achievement-standards">
              <Card className="hover:bg-accent transition-colors cursor-pointer">
                <CardHeader><CardTitle>성취기준</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">교육과정 성취기준을 확인합니다</p></CardContent>
              </Card>
            </Link>
          </div>
        </div>
      )}

      {/* system_admin — 인라인 */}
      {stats.role === 'system_admin' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* 4개 카드: academyCount, totalUsers, totalPastExams, activeStandardsCount */}
        </div>
      )}
    </div>
  )
}
```

### 검증
- `npx tsc --noEmit` (타입 체크)
- 수동: 각 역할로 로그인 → 대시보드 UI 확인

---

## Task 3: 전체 검증 + 정리

### 내용
1. `npx vitest run` — 전체 테스트 (1449+ tests PASS)
2. `npx tsc --noEmit` — 타입 에러 0건
3. E2E (수동 또는 Vercel Agent Browser):
   - admin 로그인 → 통계 카드 5개 + 최근 활동
   - teacher 로그인 → 내 통계 4개 + 최근 활동
   - student 로그인 → 빈 상태 + 바로가기 2개
4. HANDOFF.md + ROADMAP.md 업데이트
