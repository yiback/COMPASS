/**
 * pastExamFilterSchema 테스트
 * TDD RED → GREEN → IMPROVE
 */

import { describe, expect, it } from 'vitest'
import { pastExamFilterSchema } from '../past-exams'

describe('pastExamFilterSchema', () => {
  // ─── 기본값 적용 ──────────────────────────────────────

  describe('기본값 적용', () => {
    it('빈 객체면 기본값이 적용된다', () => {
      const result = pastExamFilterSchema.parse({})

      expect(result.examType).toBe('all')
      expect(result.semester).toBe('all')
      expect(result.page).toBe(1)
    })
  })

  // ─── school 필터 ───────────────────────────────────────

  describe('school 필터', () => {
    it('학교명 문자열을 허용한다', () => {
      const result = pastExamFilterSchema.parse({ school: '한국고' })
      expect(result.school).toBe('한국고')
    })

    it('빈 문자열도 허용한다', () => {
      const result = pastExamFilterSchema.parse({ school: '' })
      expect(result.school).toBe('')
    })
  })

  // ─── grade 필터 ───────────────────────────────────────

  describe('grade 필터', () => {
    it('유효한 학년 숫자를 통과시킨다', () => {
      const result = pastExamFilterSchema.parse({ grade: 10 })
      expect(result.grade).toBe(10)
    })

    it('문자열 학년을 숫자로 coerce한다', () => {
      const result = pastExamFilterSchema.parse({ grade: '3' })
      expect(result.grade).toBe(3)
    })

    it('0 이하 학년을 거부한다', () => {
      expect(() => pastExamFilterSchema.parse({ grade: 0 })).toThrow()
    })

    it('13 이상 학년을 거부한다', () => {
      expect(() => pastExamFilterSchema.parse({ grade: 13 })).toThrow()
    })

    it('소수점 학년을 거부한다', () => {
      expect(() => pastExamFilterSchema.parse({ grade: 1.5 })).toThrow()
    })
  })

  // ─── subject 필터 ─────────────────────────────────────

  describe('subject 필터', () => {
    it('과목 문자열을 허용한다', () => {
      const result = pastExamFilterSchema.parse({ subject: '수학' })
      expect(result.subject).toBe('수학')
    })
  })

  // ─── examType 필터 ────────────────────────────────────

  describe('examType 필터', () => {
    it.each(['midterm', 'final', 'mock', 'diagnostic', 'all'])(
      '유효한 시험유형 "%s"를 허용한다',
      (type) => {
        const result = pastExamFilterSchema.parse({ examType: type })
        expect(result.examType).toBe(type)
      }
    )

    it('유효하지 않은 시험유형을 거부한다', () => {
      expect(() => pastExamFilterSchema.parse({ examType: 'quiz' })).toThrow()
    })
  })

  // ─── year 필터 ────────────────────────────────────────

  describe('year 필터', () => {
    it('유효한 연도를 통과시킨다', () => {
      const result = pastExamFilterSchema.parse({ year: 2024 })
      expect(result.year).toBe(2024)
    })

    it('문자열 연도를 숫자로 coerce한다', () => {
      const result = pastExamFilterSchema.parse({ year: '2024' })
      expect(result.year).toBe(2024)
    })

    it('1999 이하 연도를 거부한다', () => {
      expect(() => pastExamFilterSchema.parse({ year: 1999 })).toThrow()
    })

    it('2101 이상 연도를 거부한다', () => {
      expect(() => pastExamFilterSchema.parse({ year: 2101 })).toThrow()
    })
  })

  // ─── semester 필터 ────────────────────────────────────

  describe('semester 필터', () => {
    it.each(['1', '2', 'all'])(
      '유효한 학기 "%s"를 허용한다',
      (semester) => {
        const result = pastExamFilterSchema.parse({ semester })
        expect(result.semester).toBe(semester)
      }
    )

    it('유효하지 않은 학기를 거부한다', () => {
      expect(() => pastExamFilterSchema.parse({ semester: '3' })).toThrow()
    })
  })

  // ─── page 필터 ────────────────────────────────────────

  describe('page 필터', () => {
    it('문자열 페이지 번호를 숫자로 coerce한다', () => {
      const result = pastExamFilterSchema.parse({ page: '5' })
      expect(result.page).toBe(5)
    })

    it('0 이하 페이지를 거부한다', () => {
      expect(() => pastExamFilterSchema.parse({ page: 0 })).toThrow()
    })

    it('음수 페이지를 거부한다', () => {
      expect(() => pastExamFilterSchema.parse({ page: -1 })).toThrow()
    })

    it('소수점 페이지를 거부한다', () => {
      expect(() => pastExamFilterSchema.parse({ page: 1.5 })).toThrow()
    })
  })

  // ─── 복합 필터 ────────────────────────────────────────

  describe('복합 필터', () => {
    it('모든 필터를 동시에 적용할 수 있다', () => {
      const input = {
        school: '한국고',
        grade: '10',
        subject: '수학',
        examType: 'midterm',
        year: '2024',
        semester: '1',
        page: '2',
      }

      const result = pastExamFilterSchema.parse(input)

      expect(result.school).toBe('한국고')
      expect(result.grade).toBe(10)
      expect(result.subject).toBe('수학')
      expect(result.examType).toBe('midterm')
      expect(result.year).toBe(2024)
      expect(result.semester).toBe('1')
      expect(result.page).toBe(2)
    })
  })

  // ─── 악의적 입력 방어 ─────────────────────────────────

  describe('악의적 입력 방어', () => {
    it('스키마에 없는 필드를 자동으로 제거한다', () => {
      const input = {
        school: '한국고',
        academy_id: 'malicious-id',   // 악의적 필드
        is_admin: true,               // 악의적 필드
        role: 'system_admin',         // 악의적 필드
      }

      const result = pastExamFilterSchema.parse(input)

      expect(result.school).toBe('한국고')
      expect('academy_id' in result).toBe(false)
      expect('is_admin' in result).toBe(false)
      expect('role' in result).toBe(false)
    })
  })
})
