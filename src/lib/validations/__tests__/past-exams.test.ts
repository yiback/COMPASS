/**
 * 기출문제 업로드 Zod 스키마 및 파일 검증 테스트
 */

import { describe, it, expect } from 'vitest'
import {
  pastExamUploadSchema,
  validateFile,
  getFileExtension,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
} from '../past-exams'

// ─── pastExamUploadSchema ────────────────────────────────

describe('pastExamUploadSchema', () => {
  const validData = {
    schoolId: '550e8400-e29b-41d4-a716-446655440000',
    year: 2024,
    semester: 1,
    examType: 'midterm' as const,
    grade: 10,
    subject: '수학',
  }

  it('유효한 업로드 데이터를 통과시킨다', () => {
    const result = pastExamUploadSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('잘못된 UUID 형식의 schoolId를 거부한다', () => {
    const result = pastExamUploadSchema.safeParse({
      ...validData,
      schoolId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('2000 미만 연도를 거부한다', () => {
    const result = pastExamUploadSchema.safeParse({
      ...validData,
      year: 1999,
    })
    expect(result.success).toBe(false)
  })

  it('2100 초과 연도를 거부한다', () => {
    const result = pastExamUploadSchema.safeParse({
      ...validData,
      year: 2101,
    })
    expect(result.success).toBe(false)
  })

  it('1 미만 학기를 거부한다', () => {
    const result = pastExamUploadSchema.safeParse({
      ...validData,
      semester: 0,
    })
    expect(result.success).toBe(false)
  })

  it('2 초과 학기를 거부한다', () => {
    const result = pastExamUploadSchema.safeParse({
      ...validData,
      semester: 3,
    })
    expect(result.success).toBe(false)
  })

  it('허용되지 않은 시험 유형을 거부한다', () => {
    const result = pastExamUploadSchema.safeParse({
      ...validData,
      examType: 'invalid',
    })
    expect(result.success).toBe(false)
  })

  it('1 미만 학년을 거부한다', () => {
    const result = pastExamUploadSchema.safeParse({
      ...validData,
      grade: 0,
    })
    expect(result.success).toBe(false)
  })

  it('12 초과 학년을 거부한다', () => {
    const result = pastExamUploadSchema.safeParse({
      ...validData,
      grade: 13,
    })
    expect(result.success).toBe(false)
  })

  it('빈 과목을 거부한다', () => {
    const result = pastExamUploadSchema.safeParse({
      ...validData,
      subject: '',
    })
    expect(result.success).toBe(false)
  })

  it('50자 초과 과목을 거부한다', () => {
    const result = pastExamUploadSchema.safeParse({
      ...validData,
      subject: 'a'.repeat(51),
    })
    expect(result.success).toBe(false)
  })

  it('문자열 숫자를 coerce하여 통과시킨다', () => {
    const result = pastExamUploadSchema.safeParse({
      ...validData,
      year: '2024',
      semester: '1',
      grade: '10',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.year).toBe(2024)
      expect(result.data.semester).toBe(1)
      expect(result.data.grade).toBe(10)
    }
  })
})

// ─── validateFile ───────────────────────────────────────

describe('validateFile', () => {
  // File 객체 생성 헬퍼
  function createMockFile(name: string, size: number, type: string): File {
    const buffer = new ArrayBuffer(size)
    return new File([buffer], name, { type })
  }

  it('File 객체가 아닌 값을 거부한다', () => {
    const result = validateFile(null)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('파일을 선택')
  })

  it('빈 파일을 거부한다', () => {
    const file = createMockFile('empty.jpg', 0, 'image/jpeg')
    const result = validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('빈 파일')
  })

  it('5MB 초과 파일을 거부한다', () => {
    const file = createMockFile('large.jpg', MAX_FILE_SIZE + 1, 'image/jpeg')
    const result = validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('5MB')
  })

  it('허용되지 않은 MIME 타입을 거부한다', () => {
    const file = createMockFile('file.txt', 1000, 'text/plain')
    const result = validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('허용된 파일 형식')
  })

  it('유효한 JPEG 파일을 통과시킨다', () => {
    const file = createMockFile('photo.jpg', 1024 * 1024, 'image/jpeg')
    const result = validateFile(file)
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('유효한 PNG 파일을 통과시킨다', () => {
    const file = createMockFile('photo.png', 1024 * 1024, 'image/png')
    const result = validateFile(file)
    expect(result.valid).toBe(true)
  })

  it('유효한 WebP 파일을 통과시킨다', () => {
    const file = createMockFile('photo.webp', 1024 * 1024, 'image/webp')
    const result = validateFile(file)
    expect(result.valid).toBe(true)
  })

  it('유효한 PDF 파일을 통과시킨다', () => {
    const file = createMockFile('exam.pdf', 1024 * 1024, 'application/pdf')
    const result = validateFile(file)
    expect(result.valid).toBe(true)
  })

  it('5MB 이하 파일을 통과시킨다', () => {
    const file = createMockFile('photo.jpg', MAX_FILE_SIZE, 'image/jpeg')
    const result = validateFile(file)
    expect(result.valid).toBe(true)
  })
})

// ─── getFileExtension ────────────────────────────────────

describe('getFileExtension', () => {
  it('JPEG 확장자를 추출한다', () => {
    expect(getFileExtension('photo.jpg')).toBe('jpg')
    expect(getFileExtension('photo.jpeg')).toBe('jpeg')
  })

  it('PNG 확장자를 추출한다', () => {
    expect(getFileExtension('photo.png')).toBe('png')
  })

  it('PDF 확장자를 추출한다', () => {
    expect(getFileExtension('exam.pdf')).toBe('pdf')
  })

  it('대문자 확장자를 소문자로 변환한다', () => {
    expect(getFileExtension('photo.JPG')).toBe('jpg')
    expect(getFileExtension('exam.PDF')).toBe('pdf')
  })

  it('다중 점이 있는 파일명에서 마지막 확장자를 추출한다', () => {
    expect(getFileExtension('my.test.file.jpg')).toBe('jpg')
  })

  it('확장자가 없는 파일명에서 기본값을 반환한다', () => {
    expect(getFileExtension('file')).toBe('bin')
  })
})

// ─── 상수 검증 ──────────────────────────────────────────

describe('상수', () => {
  it('ALLOWED_MIME_TYPES가 올바른 타입을 포함한다', () => {
    expect(ALLOWED_MIME_TYPES).toContain('image/jpeg')
    expect(ALLOWED_MIME_TYPES).toContain('image/png')
    expect(ALLOWED_MIME_TYPES).toContain('image/webp')
    expect(ALLOWED_MIME_TYPES).toContain('application/pdf')
  })

  it('MAX_FILE_SIZE가 5MB이다', () => {
    expect(MAX_FILE_SIZE).toBe(5 * 1024 * 1024)
  })
})
