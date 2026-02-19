import {
  LayoutDashboard,
  FileText,
  Sparkles,
  Building2,
  Users,
  GraduationCap,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface MenuItem {
  title: string
  href: string
  icon: LucideIcon
  description?: string
}

/**
 * 대시보드 메뉴 아이템
 * 향후 역할별로 메뉴를 필터링할 수 있도록 확장 가능
 */
export const MENU_ITEMS: MenuItem[] = [
  {
    title: '대시보드',
    href: '/',
    icon: LayoutDashboard,
    description: '주요 지표 및 요약',
  },
  {
    title: '기출문제',
    href: '/past-exams',
    icon: FileText,
    description: '기출문제 관리',
  },
  {
    title: '문제 생성',
    href: '/generate',
    icon: Sparkles,
    description: 'AI 기반 문제 생성',
  },
  {
    title: '학원 관리',
    href: '/admin/academy',
    icon: Building2,
    description: '학원 정보 조회 및 수정',
  },
  {
    title: '사용자 관리',
    href: '/admin/users',
    icon: Users,
    description: '사용자 역할 관리 및 조회',
  },
  {
    title: '학교 관리',
    href: '/admin/schools',
    icon: GraduationCap,
    description: '학교 목록 관리',
  },
  {
    title: '설정',
    href: '/settings',
    icon: Settings,
    description: '계정 및 시스템 설정',
  },
]
