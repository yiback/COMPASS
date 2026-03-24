import {
  LayoutDashboard,
  FileText,
  Sparkles,
  Building2,
  Users,
  GraduationCap,
  Settings,
  BookOpen,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '@/lib/auth'

export interface MenuItem {
  title: string
  href: string
  icon: LucideIcon
  description?: string
  /** 접근 허용 역할. undefined이면 모든 역할 허용 */
  roles?: Role[]
}

/**
 * 대시보드 메뉴 아이템
 * roles 필드로 역할별 메뉴 필터링 지원
 */
export const MENU_ITEMS: MenuItem[] = [
  {
    title: '대시보드',
    href: '/',
    icon: LayoutDashboard,
    description: '주요 지표 및 요약',
    // roles 미지정 → 모든 역할 허용
  },
  {
    title: '기출문제',
    href: '/past-exams',
    icon: FileText,
    description: '기출문제 관리',
    roles: ['admin', 'teacher'],
  },
  {
    title: '문제 생성',
    href: '/generate',
    icon: Sparkles,
    description: 'AI 기반 문제 생성',
    roles: ['admin', 'teacher'],
  },
  {
    title: '문제 관리',
    href: '/questions',
    icon: BookOpen,
    description: '저장된 문제 조회 및 관리',
    roles: ['admin', 'teacher', 'student'],
  },
  {
    title: '학원 관리',
    href: '/admin/academy',
    icon: Building2,
    description: '학원 정보 조회 및 수정',
    roles: ['admin'],
  },
  {
    title: '사용자 관리',
    href: '/admin/users',
    icon: Users,
    description: '사용자 역할 관리 및 조회',
    roles: ['admin', 'teacher'],
  },
  {
    title: '학교 관리',
    href: '/admin/schools',
    icon: GraduationCap,
    description: '학교 목록 관리',
    roles: ['admin', 'teacher'],
  },
  {
    title: '설정',
    href: '/settings',
    icon: Settings,
    description: '계정 및 시스템 설정',
    // roles 미지정 → 모든 역할 허용
  },
]
