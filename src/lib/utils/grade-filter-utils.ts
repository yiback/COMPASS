/**
 * 학교유형(schoolType) 연동 학년 필터 유틸
 *
 * 한국 교육과정 학년 체계:
 * - 초등: 1~6학년
 * - 중등: 7~9학년 (중1~중3)
 * - 고등: 10~12학년 (고1~고3)
 *
 * Toolbar에서 schoolType이 변경되면 grade Select 옵션을 동적으로 갱신한다.
 */

export type SchoolType = 'elementary' | 'middle' | 'high'

/** 학교유형별 학년 범위 상수 */
const GRADE_RANGES: Record<
  SchoolType,
  { readonly min: number; readonly max: number; readonly prefix: string }
> = {
  elementary: { min: 1, max: 6, prefix: '초' },
  middle: { min: 7, max: 9, prefix: '중' },
  high: { min: 10, max: 12, prefix: '고' },
}

/**
 * 학교유형에 따른 학년 배열 반환
 * @param schoolType - 'all' | 'elementary' | 'middle' | 'high'
 * @returns 해당 범위의 학년 숫자 배열 (오름차순)
 */
export function getGradeOptions(schoolType: SchoolType | 'all'): number[] {
  if (schoolType === 'all') {
    return Array.from({ length: 12 }, (_, i) => i + 1)
  }

  const range = GRADE_RANGES[schoolType]
  return Array.from(
    { length: range.max - range.min + 1 },
    (_, i) => range.min + i
  )
}

/**
 * 학년 숫자를 한국 교육과정 레이블로 변환
 * @example 1 → "초1", 7 → "중1", 10 → "고1"
 */
export function formatGradeLabel(grade: number): string {
  if (grade <= 6) {
    return `초${grade}`
  }
  if (grade <= 9) {
    return `중${grade - 6}`
  }
  return `고${grade - 9}`
}

/**
 * 주어진 학년이 해당 학교유형에 유효한지 검사
 * schoolType 변경 시 현재 선택된 grade가 유효한지 확인할 때 사용
 */
export function isValidGradeForSchoolType(
  grade: number,
  schoolType: SchoolType | 'all'
): boolean {
  if (schoolType === 'all') return true

  const range = GRADE_RANGES[schoolType]
  return grade >= range.min && grade <= range.max
}
