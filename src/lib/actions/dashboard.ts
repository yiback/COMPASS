'use server'

/**
 * 대시보드 통계 Server Action
 *
 * 역할별 대시보드 데이터를 조회한다.
 * - admin: 학원 내 전체 통계 (RLS 활용)
 * - teacher: 본인 데이터 통계 (created_by 필터)
 * - student: 즉시 반환 (쿼리 없음)
 * - system_admin: 전체 플랫폼 통계 (RLS 우회)
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from './helpers'

// ─── 타입 ──────────────────────────────────────────────

interface RecentPastExam {
  readonly id: string
  readonly subject: string
  readonly grade: number
  readonly examType: string
  readonly extractionStatus: string
  readonly createdAt: string
}

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

export type DashboardStats =
  | AdminStats
  | TeacherStats
  | StudentStats
  | SystemAdminStats

export interface DashboardResult {
  readonly error?: string
  readonly stats?: DashboardStats
}

// ─── snake→camelCase 변환 헬퍼 ─────────────────────────

interface RawPastExam {
  readonly id: string
  readonly subject: string
  readonly grade: number
  readonly exam_type: string
  readonly extraction_status: string
  readonly created_at: string
}

function toRecentPastExams(
  rows: readonly RawPastExam[] | null,
): readonly RecentPastExam[] {
  if (!rows || rows.length === 0) return []

  return rows.map((row) => ({
    id: row.id,
    subject: row.subject,
    grade: row.grade,
    examType: row.exam_type,
    extractionStatus: row.extraction_status,
    createdAt: row.created_at,
  }))
}

// ─── getDashboardStats ─────────────────────────────────

export async function getDashboardStats(): Promise<DashboardResult> {
  // 1. 인증 확인
  const { error: authError, profile } = await getCurrentUser()
  if (authError || !profile) {
    return { error: authError ?? '인증이 필요합니다.' }
  }

  const { role } = profile

  // 2. student — 쿼리 없이 즉시 반환
  if (role === 'student') {
    return { stats: { role: 'student' } }
  }

  // 3. admin/teacher — academyId 필수
  if (role !== 'system_admin' && !profile.academyId) {
    return { error: '소속 학원이 없습니다.' }
  }

  try {
    // 4. 역할별 분기
    if (role === 'admin') {
      return await fetchAdminStats()
    }

    if (role === 'teacher') {
      return await fetchTeacherStats(profile.id)
    }

    if (role === 'system_admin') {
      return await fetchSystemAdminStats()
    }

    // 알 수 없는 역할 — 방어
    return { error: '대시보드 데이터를 불러올 수 없습니다.' }
  } catch {
    return { error: '대시보드 데이터를 불러올 수 없습니다.' }
  }
}

// ─── admin 쿼리 ────────────────────────────────────────

async function fetchAdminStats(): Promise<DashboardResult> {
  const supabase = await createClient()

  const [usersRes, teachersRes, studentsRes, examsRes, questionsRes, recentRes] =
    await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'teacher'),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student'),
      supabase.from('past_exams').select('*', { count: 'exact', head: true }),
      supabase.from('questions').select('*', { count: 'exact', head: true }),
      supabase
        .from('past_exams')
        .select('id, subject, grade, exam_type, extraction_status, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

  return {
    stats: {
      role: 'admin',
      totalUsers: usersRes.count ?? 0,
      teacherCount: teachersRes.count ?? 0,
      studentCount: studentsRes.count ?? 0,
      pastExamCount: examsRes.count ?? 0,
      questionCount: questionsRes.count ?? 0,
      recentPastExams: toRecentPastExams(recentRes.data as RawPastExam[] | null),
    },
  }
}

// ─── teacher 쿼리 ──────────────────────────────────────

async function fetchTeacherStats(userId: string): Promise<DashboardResult> {
  const supabase = await createClient()

  const [examsRes, questionsRes, completedRes, pendingRes, recentRes] =
    await Promise.all([
      supabase
        .from('past_exams')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', userId),
      supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', userId),
      supabase
        .from('past_exams')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', userId)
        .eq('extraction_status', 'completed'),
      supabase
        .from('past_exams')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', userId)
        .eq('extraction_status', 'pending'),
      supabase
        .from('past_exams')
        .select('id, subject, grade, exam_type, extraction_status, created_at')
        .eq('created_by', userId)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

  return {
    stats: {
      role: 'teacher',
      myPastExamCount: examsRes.count ?? 0,
      myQuestionCount: questionsRes.count ?? 0,
      extractionCompleted: completedRes.count ?? 0,
      extractionPending: pendingRes.count ?? 0,
      recentPastExams: toRecentPastExams(recentRes.data as RawPastExam[] | null),
    },
  }
}

// ─── system_admin 쿼리 ─────────────────────────────────

async function fetchSystemAdminStats(): Promise<DashboardResult> {
  const adminClient = createAdminClient()

  const [academiesRes, usersRes, examsRes, standardsRes] = await Promise.all([
    adminClient.from('academies').select('*', { count: 'exact', head: true }),
    adminClient.from('profiles').select('*', { count: 'exact', head: true }),
    adminClient.from('past_exams').select('*', { count: 'exact', head: true }),
    adminClient
      .from('achievement_standards')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
  ])

  return {
    stats: {
      role: 'system_admin',
      academyCount: academiesRes.count ?? 0,
      totalUsers: usersRes.count ?? 0,
      totalPastExams: examsRes.count ?? 0,
      activeStandardsCount: standardsRes.count ?? 0,
    },
  }
}
