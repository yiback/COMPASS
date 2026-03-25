/**
 * ROLES 상수 및 ROUTE_PERMISSIONS 매핑 검증 테스트
 *
 * 순수 상수 검증 — mock 불필요
 */

import { describe, it, expect } from 'vitest'
import { ROLES } from '../roles'
import type { Role } from '../roles'
import { ROUTE_PERMISSIONS } from '../route-permissions'

describe('ROLES', () => {
  it('4개 역할이 정의되어 있다', () => {
    expect(ROLES).toHaveLength(4)
  })

  it('student, teacher, admin, system_admin을 포함한다', () => {
    expect(ROLES).toContain('student')
    expect(ROLES).toContain('teacher')
    expect(ROLES).toContain('admin')
    expect(ROLES).toContain('system_admin')
  })
})

describe('ROUTE_PERMISSIONS', () => {
  // 유효한 Role 집합 — 타입 안전 검증용
  const validRoles = new Set<Role>(ROLES)

  it('보호 대상 경로 7개가 정의되어 있다', () => {
    expect(ROUTE_PERMISSIONS).toHaveLength(7)
  })

  it('모든 경로의 roles에 유효한 Role 값만 포함된다', () => {
    for (const permission of ROUTE_PERMISSIONS) {
      for (const role of permission.roles) {
        expect(validRoles.has(role)).toBe(true)
      }
    }
  })

  it('/admin/academy는 admin만 접근할 수 있다', () => {
    const entry = ROUTE_PERMISSIONS.find((p) => p.pattern === '/admin/academy')
    expect(entry).toBeDefined()
    expect(entry?.roles).toEqual(['admin'])
  })

  it('/past-exams는 admin, teacher만 접근할 수 있다', () => {
    const entry = ROUTE_PERMISSIONS.find((p) => p.pattern === '/past-exams')
    expect(entry).toBeDefined()
    expect(entry?.roles).toContain('admin')
    expect(entry?.roles).toContain('teacher')
    expect(entry?.roles).not.toContain('student')
    expect(entry?.roles).not.toContain('system_admin')
  })

  it('/questions는 admin, teacher, student가 접근할 수 있다', () => {
    const entry = ROUTE_PERMISSIONS.find((p) => p.pattern === '/questions')
    expect(entry).toBeDefined()
    expect(entry?.roles).toContain('admin')
    expect(entry?.roles).toContain('teacher')
    expect(entry?.roles).toContain('student')
  })

  it('system_admin은 어떤 경로의 roles에도 포함되지 않는다 (requireRole에서 별도 처리)', () => {
    for (const permission of ROUTE_PERMISSIONS) {
      expect(permission.roles).not.toContain('system_admin')
    }
  })

  // T-H4: ROUTE_PERMISSIONS와 실제 page.tsx requireRole 인자 일치 검증
  it('각 보호 경로의 역할 매핑이 page.tsx requireRole 인자와 일치한다', () => {
    // page.tsx에서 실제 사용하는 requireRole 인자 (코드 리뷰에서 추출)
    const pageRequireRoles: Record<string, string[]> = {
      '/admin/academy': ['admin'],
      '/admin/users': ['admin', 'teacher'],
      '/admin/schools': ['admin', 'teacher'],
      '/past-exams': ['admin', 'teacher'],
      '/generate': ['admin', 'teacher'],
      '/questions': ['admin', 'teacher', 'student'],
      '/achievement-standards': ['admin', 'teacher', 'student'],
    }

    for (const permission of ROUTE_PERMISSIONS) {
      const expected = pageRequireRoles[permission.pattern]
      expect(expected).toBeDefined()
      expect(permission.roles).toEqual(expected)
    }
  })
})
