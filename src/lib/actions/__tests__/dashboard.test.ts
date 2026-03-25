/**
 * 대시보드 통계 Server Action 테스트
 *
 * 테스트 대상: getDashboardStats
 * - 미인증, academyId null, admin/teacher/student/system_admin 분기
 * - DB 에러, snake→camelCase 변환
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDashboardStats } from '../dashboard'
import { getCurrentUser } from '../helpers'

// ─── Mock Setup ─────────────────────────────────────────

vi.mock('../helpers', () => ({
  getCurrentUser: vi.fn(),
}))

// count 쿼리 결과 헬퍼
function mockCountResult(count: number) {
  return { count, data: null, error: null }
}

// select 쿼리 결과 헬퍼
function mockSelectResult(data: unknown[]) {
  return { count: null, data, error: null }
}

// ─── Supabase 체인 mock ─────────────────────────────────

/**
 * Supabase 쿼리 체인 mock 생성
 *
 * 각 from() 호출이 반환하는 쿼리 빌더 체인을 설정한다.
 * callIndex로 Promise.all 내 순서를 구분한다.
 *
 * Proxy를 사용해 모든 체인 메서드를 자동 처리하고,
 * await 시 then()으로 결과를 반환한다.
 */
function createChainMock(results: Array<{ count: number | null; data: unknown; error: unknown }>) {
  let callIndex = 0

  function makeThenableProxy(resultIdx: number): unknown {
    const handler: ProxyHandler<object> = {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => void) => {
            resolve(results[resultIdx] ?? { count: 0, data: null, error: null })
          }
        }
        // select, eq, order, limit 등 모든 체인 메서드 → 같은 proxy 반환
        return vi.fn(() => makeThenableProxy(resultIdx))
      },
    }
    return new Proxy({}, handler)
  }

  return {
    from: vi.fn(() => {
      const idx = callIndex
      callIndex++
      return makeThenableProxy(idx)
    }),
  }
}

let mockSupabase: ReturnType<typeof createChainMock>
let mockAdminSupabase: ReturnType<typeof createChainMock>

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminSupabase),
}))

// ─── 인증 헬퍼 ──────────────────────────────────────────

function mockAuthFailed() {
  vi.mocked(getCurrentUser).mockResolvedValue({
    error: '인증이 필요합니다.',
  })
}

function mockAuthAsAdmin(academyId: string | null = 'academy-1') {
  vi.mocked(getCurrentUser).mockResolvedValue({
    profile: { id: 'admin-id', role: 'admin', academyId },
  })
}

function mockAuthAsTeacher(academyId: string | null = 'academy-1') {
  vi.mocked(getCurrentUser).mockResolvedValue({
    profile: { id: 'teacher-id', role: 'teacher', academyId },
  })
}

function mockAuthAsStudent() {
  vi.mocked(getCurrentUser).mockResolvedValue({
    profile: { id: 'student-id', role: 'student', academyId: 'academy-1' },
  })
}

function mockAuthAsSystemAdmin() {
  vi.mocked(getCurrentUser).mockResolvedValue({
    profile: { id: 'sa-id', role: 'system_admin', academyId: null },
  })
}

// ─── 테스트 데이터 ───────────────────────────────────────

const MOCK_RAW_PAST_EXAMS = [
  {
    id: 'exam-1',
    subject: '수학',
    grade: 9,
    exam_type: 'midterm',
    extraction_status: 'completed',
    created_at: '2026-03-25T10:00:00Z',
  },
  {
    id: 'exam-2',
    subject: '영어',
    grade: 8,
    exam_type: 'final',
    extraction_status: 'pending',
    created_at: '2026-03-24T10:00:00Z',
  },
]

// ─── beforeEach ──────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── 테스트 ──────────────────────────────────────────────

describe('getDashboardStats', () => {
  // 1. 미인증
  it('미인증 시 에러를 반환한다', async () => {
    mockAuthFailed()

    const result = await getDashboardStats()

    expect(result).toEqual({ error: '인증이 필요합니다.' })
  })

  // 2. admin — academyId null
  it('admin의 academyId가 null이면 에러를 반환한다', async () => {
    mockAuthAsAdmin(null)

    const result = await getDashboardStats()

    expect(result).toEqual({ error: '소속 학원이 없습니다.' })
  })

  // 3. admin 정상
  it('admin은 6개 통계를 반환한다', async () => {
    mockAuthAsAdmin()
    mockSupabase = createChainMock([
      mockCountResult(12),  // profiles 전체
      mockCountResult(3),   // teachers
      mockCountResult(8),   // students
      mockCountResult(5),   // past_exams
      mockCountResult(24),  // questions
      mockSelectResult(MOCK_RAW_PAST_EXAMS), // 최근 5건
    ])

    const result = await getDashboardStats()

    expect(result.error).toBeUndefined()
    expect(result.stats).toEqual({
      role: 'admin',
      totalUsers: 12,
      teacherCount: 3,
      studentCount: 8,
      pastExamCount: 5,
      questionCount: 24,
      recentPastExams: [
        {
          id: 'exam-1',
          subject: '수학',
          grade: 9,
          examType: 'midterm',
          extractionStatus: 'completed',
          createdAt: '2026-03-25T10:00:00Z',
        },
        {
          id: 'exam-2',
          subject: '영어',
          grade: 8,
          examType: 'final',
          extractionStatus: 'pending',
          createdAt: '2026-03-24T10:00:00Z',
        },
      ],
    })
  })

  // 4. admin 데이터 0건
  it('admin — 데이터 0건이면 모든 count 0, recentPastExams []', async () => {
    mockAuthAsAdmin()
    mockSupabase = createChainMock([
      mockCountResult(0),
      mockCountResult(0),
      mockCountResult(0),
      mockCountResult(0),
      mockCountResult(0),
      mockSelectResult([]),
    ])

    const result = await getDashboardStats()

    expect(result.stats).toEqual({
      role: 'admin',
      totalUsers: 0,
      teacherCount: 0,
      studentCount: 0,
      pastExamCount: 0,
      questionCount: 0,
      recentPastExams: [],
    })
  })

  // 5. teacher 정상
  it('teacher는 5개 통계를 반환한다', async () => {
    mockAuthAsTeacher()
    mockSupabase = createChainMock([
      mockCountResult(10),  // myPastExamCount
      mockCountResult(30),  // myQuestionCount
      mockCountResult(7),   // extractionCompleted
      mockCountResult(2),   // extractionPending
      mockSelectResult(MOCK_RAW_PAST_EXAMS),
    ])

    const result = await getDashboardStats()

    expect(result.error).toBeUndefined()
    expect(result.stats).toEqual({
      role: 'teacher',
      myPastExamCount: 10,
      myQuestionCount: 30,
      extractionCompleted: 7,
      extractionPending: 2,
      recentPastExams: [
        {
          id: 'exam-1',
          subject: '수학',
          grade: 9,
          examType: 'midterm',
          extractionStatus: 'completed',
          createdAt: '2026-03-25T10:00:00Z',
        },
        {
          id: 'exam-2',
          subject: '영어',
          grade: 8,
          examType: 'final',
          extractionStatus: 'pending',
          createdAt: '2026-03-24T10:00:00Z',
        },
      ],
    })
  })

  // 6. teacher 데이터 0건
  it('teacher — 데이터 0건이면 모든 count 0', async () => {
    mockAuthAsTeacher()
    mockSupabase = createChainMock([
      mockCountResult(0),
      mockCountResult(0),
      mockCountResult(0),
      mockCountResult(0),
      mockSelectResult([]),
    ])

    const result = await getDashboardStats()

    expect(result.stats).toEqual({
      role: 'teacher',
      myPastExamCount: 0,
      myQuestionCount: 0,
      extractionCompleted: 0,
      extractionPending: 0,
      recentPastExams: [],
    })
  })

  // 7. student
  it('student는 즉시 { role: student }를 반환한다', async () => {
    mockAuthAsStudent()

    const result = await getDashboardStats()

    expect(result).toEqual({ stats: { role: 'student' } })
  })

  // 8. system_admin
  it('system_admin은 createAdminClient로 4개 통계를 반환한다', async () => {
    mockAuthAsSystemAdmin()
    mockAdminSupabase = createChainMock([
      mockCountResult(3),   // academies
      mockCountResult(50),  // profiles
      mockCountResult(20),  // past_exams
      mockCountResult(76),  // achievement_standards (active)
    ])

    const result = await getDashboardStats()

    expect(result.error).toBeUndefined()
    expect(result.stats).toEqual({
      role: 'system_admin',
      academyCount: 3,
      totalUsers: 50,
      totalPastExams: 20,
      activeStandardsCount: 76,
    })
  })

  // 9. DB 에러 — try/catch
  it('DB 에러 시 일반 에러 메시지를 반환한다', async () => {
    mockAuthAsAdmin()

    // createClient가 reject하는 경우
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockRejectedValueOnce(new Error('DB connection failed'))

    const result = await getDashboardStats()

    expect(result).toEqual({ error: '대시보드 데이터를 불러올 수 없습니다.' })
  })

  // 10. snake→camelCase 변환 확인
  it('recentPastExams가 snake_case에서 camelCase로 변환된다', async () => {
    mockAuthAsAdmin()
    mockSupabase = createChainMock([
      mockCountResult(1),
      mockCountResult(0),
      mockCountResult(0),
      mockCountResult(1),
      mockCountResult(5),
      mockSelectResult([
        {
          id: 'test-id',
          subject: '과학',
          grade: 10,
          exam_type: 'mock',
          extraction_status: 'processing',
          created_at: '2026-01-01T00:00:00Z',
        },
      ]),
    ])

    const result = await getDashboardStats()

    const stats = result.stats as { recentPastExams: readonly unknown[] }
    const exam = stats.recentPastExams[0] as Record<string, unknown>

    // camelCase 키 존재
    expect(exam).toHaveProperty('examType', 'mock')
    expect(exam).toHaveProperty('extractionStatus', 'processing')
    expect(exam).toHaveProperty('createdAt', '2026-01-01T00:00:00Z')

    // snake_case 키 부재
    expect(exam).not.toHaveProperty('exam_type')
    expect(exam).not.toHaveProperty('extraction_status')
    expect(exam).not.toHaveProperty('created_at')
  })

  // 11. teacher — academyId null
  it('teacher의 academyId가 null이면 에러를 반환한다', async () => {
    mockAuthAsTeacher(null)

    const result = await getDashboardStats()

    expect(result).toEqual({ error: '소속 학원이 없습니다.' })
  })
})
