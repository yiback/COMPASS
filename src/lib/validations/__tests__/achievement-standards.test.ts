/**
 * 성취기준 Zod 검증 스키마 단위 테스트
 *
 * 테스트 대상:
 * - achievementStandardCreateSchema: 생성 입력 검증
 * - achievementStandardUpdateSchema: 수정 입력 검증
 * - achievementStandardFilterSchema: 필터 입력 검증
 */

import { describe, it, expect } from 'vitest'
import {
  achievementStandardCreateSchema,
  achievementStandardUpdateSchema,
  achievementStandardFilterSchema,
} from '../achievement-standards'

// ─── achievementStandardCreateSchema ────────────────────

describe('achievementStandardCreateSchema', () => {
  it('유효: 전체 필드 입력', () => {
    const input = {
      code: '수학4-01-01',
      content: '자연수의 덧셈과 뺄셈을 할 수 있다.',
      subject: '수학',
      grade: 4,
      semester: 1,
      unit: '자연수의 연산',
      sub_unit: '덧셈과 뺄셈',
      keywords: ['덧셈', '뺄셈'],
      source_name: '2022 개정 교육과정',
      source_url: 'https://example.com/curriculum',
      order_in_semester: 1,
      effective_year: 2024,
      curriculum_version: '2022',
    }

    const result = achievementStandardCreateSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('유효: 필수 필드만 (optional 생략)', () => {
    const input = {
      code: '수학4-01-01',
      content: '자연수의 덧셈과 뺄셈을 할 수 있다.',
      subject: '수학',
      grade: 4,
    }

    const result = achievementStandardCreateSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.keywords).toEqual([])
      expect(result.data.curriculum_version).toBe('2022')
    }
  })

  it('거부: code 빈 문자열', () => {
    const input = {
      code: '',
      content: '내용',
      subject: '수학',
      grade: 4,
    }

    const result = achievementStandardCreateSchema.safeParse(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        '성취기준 코드를 입력해주세요.'
      )
    }
  })

  it('거부: content 누락', () => {
    const input = {
      code: '수학4-01-01',
      subject: '수학',
      grade: 4,
    }

    const result = achievementStandardCreateSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('거부: grade 범위 초과 (0, 13)', () => {
    const input0 = {
      code: '수학4-01-01',
      content: '내용',
      subject: '수학',
      grade: 0,
    }
    const input13 = {
      code: '수학4-01-01',
      content: '내용',
      subject: '수학',
      grade: 13,
    }

    expect(achievementStandardCreateSchema.safeParse(input0).success).toBe(
      false
    )
    expect(achievementStandardCreateSchema.safeParse(input13).success).toBe(
      false
    )
  })

  it('거부: semester 범위 초과 (0, 3)', () => {
    const input0 = {
      code: '수학4-01-01',
      content: '내용',
      subject: '수학',
      grade: 4,
      semester: 0,
    }
    const input3 = {
      code: '수학4-01-01',
      content: '내용',
      subject: '수학',
      grade: 4,
      semester: 3,
    }

    expect(achievementStandardCreateSchema.safeParse(input0).success).toBe(
      false
    )
    expect(achievementStandardCreateSchema.safeParse(input3).success).toBe(
      false
    )
  })

  it('거부: source_url 잘못된 URL', () => {
    const input = {
      code: '수학4-01-01',
      content: '내용',
      subject: '수학',
      grade: 4,
      source_url: 'not-a-url',
    }

    const result = achievementStandardCreateSchema.safeParse(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        '올바른 URL 형식이 아닙니다.'
      )
    }
  })

  it('통과: source_url 빈 문자열', () => {
    const input = {
      code: '수학4-01-01',
      content: '내용',
      subject: '수학',
      grade: 4,
      source_url: '',
    }

    const result = achievementStandardCreateSchema.safeParse(input)
    expect(result.success).toBe(true)
  })
})

// ─── achievementStandardUpdateSchema ────────────────────

describe('achievementStandardUpdateSchema', () => {
  it('유효: content + keywords 수정', () => {
    const input = {
      content: '수정된 내용',
      keywords: ['키워드1', '키워드2'],
    }

    const result = achievementStandardUpdateSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('거부: content 빈 문자열', () => {
    const input = {
      content: '',
    }

    const result = achievementStandardUpdateSchema.safeParse(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        '성취기준 내용을 입력해주세요.'
      )
    }
  })
})

// ─── achievementStandardFilterSchema ────────────────────

describe('achievementStandardFilterSchema', () => {
  it('유효: 빈 객체 (기본값)', () => {
    const result = achievementStandardFilterSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isActive).toBe('true')
    }
  })

  it('유효: 전체 필터 조합', () => {
    const input = {
      subject: '수학',
      grade: 4,
      semester: 1,
      unit: '자연수의 연산',
      search: '덧셈',
      isActive: 'all',
    }

    const result = achievementStandardFilterSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('통과: isActive 기본값 "true"', () => {
    const result = achievementStandardFilterSchema.safeParse({
      subject: '수학',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isActive).toBe('true')
    }
  })

  it('통과: grade 문자열→숫자 (coerce)', () => {
    const result = achievementStandardFilterSchema.safeParse({
      grade: '7',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.grade).toBe(7)
    }
  })
})
