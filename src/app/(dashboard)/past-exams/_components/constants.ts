// ─── 기출문제 UI 상수 ────────────────────────────────────
// 컬럼(Badge), Toolbar(Select 옵션), 상세 Sheet에서 공통 사용

// 시험유형 한국어 레이블
export const EXAM_TYPE_LABELS: Record<string, string> = {
  midterm: '중간고사',
  final: '기말고사',
  mock: '모의고사',
  diagnostic: '진단평가',
}

// 시험유형 Badge variant
export const EXAM_TYPE_BADGE_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  midterm: 'default',
  final: 'secondary',
  mock: 'outline',
  diagnostic: 'destructive',
}

// 추출 상태 한국어 레이블 + Badge variant
export const EXTRACTION_STATUS_MAP: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  pending: { label: '대기', variant: 'secondary' },
  processing: { label: '처리중', variant: 'outline' },
  completed: { label: '완료', variant: 'default' },
  failed: { label: '실패', variant: 'destructive' },
}

// 학기 레이블
export const SEMESTER_LABELS: Record<string, string> = {
  '1': '1학기',
  '2': '2학기',
}

// 필터용 연도 범위 (현재 연도부터 최근 5년)
export const CURRENT_YEAR = new Date().getFullYear()
export const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)

// 필터용 학년 배열
export const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1)
