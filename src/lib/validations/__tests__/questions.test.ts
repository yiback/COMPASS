import { describe, expect, it } from 'vitest'
import { questionFilterSchema } from '../questions'

describe('questionFilterSchema', () => {
  // ─── 기본값 적용 ──────────────────────────────────────

  describe('기본값 적용', () => {
    it('빈 객체면 기본값이 적용된다', () => {
      const result = questionFilterSchema.parse({})
      expect(result.schoolType).toBe('all')
      expect(result.type).toBe('all')
      expect(result.sourceType).toBe('all')
      expect(result.page).toBe(1)
    })
  })

  // ─── subject 필터 ─────────────────────────────────────

  describe('subject 필터', () => {
    it('과목 문자열을 허용한다', () => {
      const result = questionFilterSchema.parse({ subject: '수학' })
      expect(result.subject).toBe('수학')
    })

    it('과목 미입력 시 undefined이다', () => {
      const result = questionFilterSchema.parse({})
      expect(result.subject).toBeUndefined()
    })
  })

  // ─── schoolType 필터 ──────────────────────────────────

  describe('schoolType 필터', () => {
    it.each(['elementary', 'middle', 'high', 'all'])(
      '유효한 학교유형 "%s"를 허용한다',
      (schoolType) => {
        const result = questionFilterSchema.parse({ schoolType })
        expect(result.schoolType).toBe(schoolType)
      }
    )

    it('유효하지 않은 학교유형을 거부한다', () => {
      expect(() =>
        questionFilterSchema.parse({ schoolType: 'university' })
      ).toThrow()
    })
  })

  // ─── grade 필터 ───────────────────────────────────────

  describe('grade 필터', () => {
    it('유효한 학년을 통과시킨다', () => {
      const result = questionFilterSchema.parse({ grade: 7 })
      expect(result.grade).toBe(7)
    })

    it('문자열 학년을 숫자로 coerce한다', () => {
      const result = questionFilterSchema.parse({ grade: '10' })
      expect(result.grade).toBe(10)
    })

    it('0 이하 학년을 거부한다', () => {
      expect(() => questionFilterSchema.parse({ grade: 0 })).toThrow()
    })

    it('13 이상 학년을 거부한다', () => {
      expect(() => questionFilterSchema.parse({ grade: 13 })).toThrow()
    })
  })

  // ─── type 필터 ────────────────────────────────────────

  describe('type 필터', () => {
    it.each(['multiple_choice', 'short_answer', 'descriptive', 'all'])(
      '유효한 문제유형 "%s"를 허용한다',
      (type) => {
        const result = questionFilterSchema.parse({ type })
        expect(result.type).toBe(type)
      }
    )

    it('유효하지 않은 문제유형을 거부한다', () => {
      expect(() => questionFilterSchema.parse({ type: 'essay' })).toThrow()
    })
  })

  // ─── difficulty 필터 ──────────────────────────────────

  describe('difficulty 필터', () => {
    it('유효한 난이도(1~5)를 통과시킨다', () => {
      const result = questionFilterSchema.parse({ difficulty: 3 })
      expect(result.difficulty).toBe(3)
    })

    it('문자열 난이도를 숫자로 coerce한다', () => {
      const result = questionFilterSchema.parse({ difficulty: '2' })
      expect(result.difficulty).toBe(2)
    })

    it('0 이하 난이도를 거부한다', () => {
      expect(() => questionFilterSchema.parse({ difficulty: 0 })).toThrow()
    })

    it('6 이상 난이도를 거부한다', () => {
      expect(() => questionFilterSchema.parse({ difficulty: 6 })).toThrow()
    })
  })

  // ─── sourceType 필터 ──────────────────────────────────

  describe('sourceType 필터', () => {
    it.each(['past_exam', 'textbook', 'self_made', 'ai_generated', 'all'])(
      '유효한 출처유형 "%s"를 허용한다',
      (sourceType) => {
        const result = questionFilterSchema.parse({ sourceType })
        expect(result.sourceType).toBe(sourceType)
      }
    )

    it('유효하지 않은 출처유형을 거부한다', () => {
      expect(() =>
        questionFilterSchema.parse({ sourceType: 'manual' })
      ).toThrow()
    })
  })

  // ─── page 필터 ────────────────────────────────────────

  describe('page 필터', () => {
    it('문자열 페이지 번호를 숫자로 coerce한다', () => {
      const result = questionFilterSchema.parse({ page: '3' })
      expect(result.page).toBe(3)
    })

    it('0 이하 페이지를 거부한다', () => {
      expect(() => questionFilterSchema.parse({ page: 0 })).toThrow()
    })
  })

  // ─── 복합 필터 ────────────────────────────────────────

  describe('복합 필터', () => {
    it('모든 필터를 동시에 적용할 수 있다', () => {
      const input = {
        subject: '수학',
        schoolType: 'high',
        grade: '10',
        type: 'multiple_choice',
        difficulty: '3',
        sourceType: 'ai_generated',
        page: '2',
      }

      const result = questionFilterSchema.parse(input)

      expect(result.subject).toBe('수학')
      expect(result.schoolType).toBe('high')
      expect(result.grade).toBe(10)
      expect(result.type).toBe('multiple_choice')
      expect(result.difficulty).toBe(3)
      expect(result.sourceType).toBe('ai_generated')
      expect(result.page).toBe(2)
    })
  })

  // ─── 악의적 입력 방어 ─────────────────────────────────

  describe('악의적 입력 방어', () => {
    it('스키마에 없는 필드를 자동으로 제거한다 (unknown key strip)', () => {
      const input = {
        subject: '수학',
        academy_id: 'malicious-id',
        role: 'system_admin',
        is_admin: true,
      }

      const result = questionFilterSchema.parse(input)

      expect(result.subject).toBe('수학')
      expect('academy_id' in result).toBe(false)
      expect('role' in result).toBe(false)
      expect('is_admin' in result).toBe(false)
    })
  })
})
