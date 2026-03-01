// ─── 문제 유형 ────────────────────────────────────────

/** 문제 유형 한국어 레이블 (DB 타입 기준) */
export const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: '객관식',
  short_answer: '단답형',
  descriptive: '서술형',
}

/** 문제 유형 Badge variant */
export const QUESTION_TYPE_BADGE_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  multiple_choice: 'default',
  short_answer: 'secondary',
  descriptive: 'outline',
}

// ─── 난이도 ───────────────────────────────────────────

/** 난이도 한국어 레이블 (1~5 숫자 → 레이블) */
export const DIFFICULTY_LABELS: Record<number, string> = {
  1: '매우 쉬움',
  2: '쉬움',
  3: '보통',
  4: '어려움',
  5: '매우 어려움',
}

/** 난이도 Badge variant */
export const DIFFICULTY_BADGE_VARIANT: Record<
  number,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  1: 'outline',
  2: 'secondary',
  3: 'default',
  4: 'secondary',
  5: 'destructive',
}

// ─── AI 검수 상태 ──────────────────────────────────────

/** AI 검수 상태 한국어 레이블 */
export const REVIEW_STATUS_LABELS: Record<string, string> = {
  none: '해당없음',
  pending: '검수대기',
  approved: '승인',
  rejected: '반려',
}

/** AI 검수 상태 Badge variant */
export const REVIEW_STATUS_BADGE_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  none: 'outline',
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
}

// ─── 출처 유형 ────────────────────────────────────────

/** 출처 유형 한국어 레이블 */
export const SOURCE_TYPE_LABELS: Record<string, string> = {
  past_exam: '기출',
  textbook: '교재',
  self_made: '자작',
  ai_generated: 'AI생성',
}
