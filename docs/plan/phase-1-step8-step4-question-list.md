# 1-8 Step 4 상세 구현 계획: 문제 목록 DataTable + 사이드바 메뉴

> **상위 계획**: `docs/plan/phase-1-step8-save-generated-questions.md` Step 4
> **작성일**: 2026-02-28
> **상태**: ✅ 완료
> **선행 완료**: Step 1 (타입 매핑 유틸 + 저장 Zod 스키마) — 병렬 가능 (독립적)

---

## 1. 개요

저장된 문제를 조회하는 `/questions` 페이지를 구현한다.
1-6(기출문제 목록 `past-exams/page.tsx`)의 DataTable 패턴을 **재활용**하여
같은 구조(Server Component → DataTable → 서버사이드 페이지네이션)로 빠르게 만든다.
사이드바에 "문제 관리" 메뉴도 추가한다.

### 핵심 변경

| 구분  | 파일                                                                | 변경량                        |
| --- | ----------------------------------------------------------------- | -------------------------- |
| 신규  | `src/lib/utils/grade-filter-utils.ts`                             | 학년 필터 유틸 (~60줄)            |
| 신규  | `src/lib/validations/questions.ts`                                | Zod 필터 스키마 (~40줄)          |
| 신규  | `src/lib/actions/questions.ts`                                    | Server Action + 타입 (~150줄) |
| 신규  | `src/app/(dashboard)/questions/_components/constants.ts`          | 문제 UI 상수 (~50줄)            |
| 신규  | `src/app/(dashboard)/questions/_components/question-columns.tsx`  | DataTable 컬럼 (~100줄)       |
| 신규  | `src/app/(dashboard)/questions/_components/questions-toolbar.tsx` | 필터 Toolbar (~130줄)         |
| 신규  | `src/app/(dashboard)/questions/page.tsx`                          | Server Component (~80줄)    |
| 수정  | `src/lib/constants/menu.ts`                                       | "문제 관리" 메뉴 추가 (~8줄)        |

### 의존성

```
Step 1 결과물 (병렬 가능 — 공유 파일 없음)
  └── fromDifficultyNumber() — 목록 조회 결과 변환 시 사용
      (Step 1이 완료되지 않았으면 인라인으로 작성 후 교체)

기존 인프라 (이미 존재)
  ├── DataTable, DataTableServerPagination (components/data-table)
  ├── DataTableColumnHeader (components/data-table/data-table-column-header)
  ├── Badge, Button, Input, Select (components/ui/)
  └── createClient (lib/supabase/server)
```

---

## 2. Phase 분리 및 의존관계

```
Phase A: 유틸 + 스키마 + Action (테스트 가능한 순수 로직)
  ├── grade-filter-utils.ts   ← Task 1
  ├── questions.ts (validation) ← Task 2 (Task 1 독립적)
  └── questions.ts (actions)  ← Task 3 (Task 1, 2 완료 후)

Phase B: UI 컴포넌트 (Phase A 완료 후)
  ├── constants.ts            ← Task 4
  ├── question-columns.tsx    ← Task 5 (Task 4 완료 후)
  └── questions-toolbar.tsx   ← Task 6 (Task 4 완료 후)

Phase C: 페이지 + 메뉴 통합 (Phase A, B 완료 후)
  ├── questions/page.tsx      ← Task 7-A
  └── menu.ts 수정            ← Task 7-B (독립적)
```

**병렬 실행 가능**:
- Task 1과 Task 2는 독립 (병렬 가능)
- Task 4와 Task 7-B는 독립 (병렬 가능)

---

## 3. Task 1: grade-filter-utils.ts (학년 필터 유틸)

### 목표

학교유형(schoolType)에 따라 학년 옵션을 동적으로 생성하는 유틸 함수.
Toolbar에서 schoolType Select를 변경하면 grade Select 옵션이 연동된다.

**왜 별도 파일인가?**
- Toolbar(Client Component)와 Action(Server)에서 모두 사용
- 순수 함수라 테스트하기 쉬움
- SRP: 학년 범위 계산만 담당

### 파일 위치

```
src/lib/utils/grade-filter-utils.ts
src/lib/utils/__tests__/grade-filter-utils.test.ts
```

### RED — 테스트 먼저

```typescript
// src/lib/utils/__tests__/grade-filter-utils.test.ts

import { describe, expect, it } from 'vitest'
import {
  getGradeOptions,
  formatGradeLabel,
  isValidGradeForSchoolType,
  type SchoolType,
} from '../grade-filter-utils'

describe('getGradeOptions', () => {
  // 1. all: 1~12 전체 반환
  it('all이면 1~12 전체 12개를 반환한다', () => {
    const result = getGradeOptions('all')
    expect(result).toHaveLength(12)
    expect(result[0]).toBe(1)
    expect(result[11]).toBe(12)
  })

  // 2. elementary: 1~6
  it('elementary면 1~6 총 6개를 반환한다', () => {
    const result = getGradeOptions('elementary')
    expect(result).toHaveLength(6)
    expect(result[0]).toBe(1)
    expect(result[5]).toBe(6)
  })

  // 3. middle: 7~9
  it('middle이면 7~9 총 3개를 반환한다', () => {
    const result = getGradeOptions('middle')
    expect(result).toHaveLength(3)
    expect(result[0]).toBe(7)
    expect(result[2]).toBe(9)
  })

  // 4. high: 10~12
  it('high면 10~12 총 3개를 반환한다', () => {
    const result = getGradeOptions('high')
    expect(result).toHaveLength(3)
    expect(result[0]).toBe(10)
    expect(result[2]).toBe(12)
  })
})

describe('formatGradeLabel', () => {
  // 5. 초등 학년 레이블
  it('1학년을 "초1"로 반환한다', () => {
    expect(formatGradeLabel(1)).toBe('초1')
  })

  it('6학년을 "초6"으로 반환한다', () => {
    expect(formatGradeLabel(6)).toBe('초6')
  })

  // 6. 중학 학년 레이블 (7→중1, 8→중2, 9→중3)
  it('7학년을 "중1"로 반환한다', () => {
    expect(formatGradeLabel(7)).toBe('중1')
  })

  it('9학년을 "중3"으로 반환한다', () => {
    expect(formatGradeLabel(9)).toBe('중3')
  })

  // 7. 고등 학년 레이블 (10→고1, 11→고2, 12→고3)
  it('10학년을 "고1"로 반환한다', () => {
    expect(formatGradeLabel(10)).toBe('고1')
  })

  it('12학년을 "고3"으로 반환한다', () => {
    expect(formatGradeLabel(12)).toBe('고3')
  })
})

describe('isValidGradeForSchoolType', () => {
  // 8. all: 모든 학년 유효
  it('all이면 어떤 학년도 유효하다', () => {
    expect(isValidGradeForSchoolType(1, 'all')).toBe(true)
    expect(isValidGradeForSchoolType(12, 'all')).toBe(true)
  })

  // 9. elementary 경계값
  it('elementary에서 1은 유효하다', () => {
    expect(isValidGradeForSchoolType(1, 'elementary')).toBe(true)
  })

  it('elementary에서 6은 유효하다', () => {
    expect(isValidGradeForSchoolType(6, 'elementary')).toBe(true)
  })

  it('elementary에서 7은 유효하지 않다', () => {
    expect(isValidGradeForSchoolType(7, 'elementary')).toBe(false)
  })

  // 10. middle 경계값
  it('middle에서 7은 유효하다', () => {
    expect(isValidGradeForSchoolType(7, 'middle')).toBe(true)
  })

  it('middle에서 6은 유효하지 않다', () => {
    expect(isValidGradeForSchoolType(6, 'middle')).toBe(false)
  })

  it('middle에서 10은 유효하지 않다', () => {
    expect(isValidGradeForSchoolType(10, 'middle')).toBe(false)
  })

  // 11. high 경계값
  it('high에서 10은 유효하다', () => {
    expect(isValidGradeForSchoolType(10, 'high')).toBe(true)
  })

  it('high에서 9는 유효하지 않다', () => {
    expect(isValidGradeForSchoolType(9, 'high')).toBe(false)
  })

  it('high에서 12는 유효하다', () => {
    expect(isValidGradeForSchoolType(12, 'high')).toBe(true)
  })
})
```

실행: `npx vitest run src/lib/utils/__tests__/grade-filter-utils.test.ts`
→ 모두 FAIL (파일 없음)

### GREEN — 최소 구현

```typescript
// src/lib/utils/grade-filter-utils.ts

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
```

실행: `npx vitest run src/lib/utils/__tests__/grade-filter-utils.test.ts`
→ 20/20 PASS

### REFACTOR — 개선

- 추가 개선 불필요 (상수 분리, 순수 함수 구조 이미 적용됨)
- `src/lib/utils/index.ts`가 존재한다면 `export * from './grade-filter-utils'` 추가

---

## 4. Task 2: questions.ts (Zod 필터 스키마)

### 목표

`/questions` 페이지 URL searchParams를 검증하는 Zod 스키마.
패턴: `pastExamFilterSchema` (past-exams.ts) 재활용.

**왜 별도 파일인가?**
- `src/lib/validations/past-exams.ts`는 이미 업로드 + 필터 스키마가 혼재
- questions는 독립적인 도메인 → 파일 분리 (High Cohesion)

### 파일 위치

```
src/lib/validations/questions.ts
src/lib/validations/__tests__/questions.test.ts
```

### RED — 테스트 먼저

```typescript
// src/lib/validations/__tests__/questions.test.ts

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
```

실행: `npx vitest run src/lib/validations/__tests__/questions.test.ts`
→ 모두 FAIL (파일 없음)

### GREEN — 최소 구현

```typescript
// src/lib/validations/questions.ts

/**
 * 문제 목록 필터 Zod 스키마
 *
 * 패턴: pastExamFilterSchema (past-exams.ts) 재활용
 * - URL searchParams는 항상 문자열 → z.coerce 사용
 * - 'all'을 각 Select의 기본값으로 사용 (빈 문자열 → undefined 패턴 대신)
 */

import { z } from 'zod'

export const questionFilterSchema = z.object({
  // 과목 텍스트 검색 (debounce Input)
  subject: z.string().optional(),

  // 학교유형 Select (schoolType 변경 시 grade Select 연동)
  schoolType: z
    .enum(['elementary', 'middle', 'high', 'all'])
    .optional()
    .default('all'),

  // 학년 Select (schoolType에 따라 동적 옵션)
  grade: z.coerce.number().int().min(1).max(12).optional(),

  // 문제유형 Select (DB 타입 기준 — essay 아닌 descriptive)
  type: z
    .enum(['multiple_choice', 'short_answer', 'descriptive', 'all'])
    .optional()
    .default('all'),

  // 난이도 Select (1~5)
  difficulty: z.coerce.number().int().min(1).max(5).optional(),

  // 출처유형 Select
  sourceType: z
    .enum(['past_exam', 'textbook', 'self_made', 'ai_generated', 'all'])
    .optional()
    .default('all'),

  // 페이지 번호
  page: z.coerce.number().int().min(1).optional().default(1),
})

export type QuestionFilterInput = z.infer<typeof questionFilterSchema>
```

실행: `npx vitest run src/lib/validations/__tests__/questions.test.ts`
→ 12/12 PASS

### REFACTOR — 개선

추가 개선 불필요. 스키마가 단순하고 명확함.

---

## 5. Task 3: questions.ts (getQuestionList Server Action)

### 목표

`questions` 테이블을 조회하는 Server Action.
패턴: `getPastExamList` (past-exams.ts) 재활용.

**DB JOIN 주의사항**:
- `profiles!created_by`: `questions` 테이블에 `created_by`, `reviewed_by` 두 개의 FK가 `profiles`를 참조 → `!created_by`로 PostgREST에 어떤 FK인지 명시
- `!inner` 사용 안 함: `created_by`가 null일 수 있음 (LEFT JOIN 유지)

### 파일 위치

```
src/lib/actions/questions.ts
src/lib/actions/__tests__/questions-list.test.ts
```

### RED — 테스트 먼저

```typescript
// src/lib/actions/__tests__/questions-list.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * getQuestionList Server Action 테스트
 *
 * 테스트 대상: 12개
 * - 인증 실패 (3개)
 * - 필터 적용 (5개)
 * - 응답 변환 (3개)
 * - 에러 처리 (1개)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getQuestionList } from '../questions'

// ─── Mock 설정 ────────────────────────────────────────

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}))

// ─── Mock 헬퍼 ────────────────────────────────────────

function mockAuthFailed() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'Not authenticated' },
  } as any)
}

function mockAuthAs(
  role: string,
  id = 'user-uuid-1',
  academyId = 'academy-uuid-1'
) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id } },
    error: null,
  } as any)

  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id, role, academy_id: academyId },
      error: null,
    }),
  }
}

function mockProfileNotFound() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'some-user-id' } },
    error: null,
  } as any)

  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    }),
  }
}

/** 목록 조회 Mock 헬퍼 */
function mockQuestionListQuery(rows: any[], total: number) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({
      data: rows,
      count: total,
      error: null,
    }),
  }
}

const SAMPLE_ROW = {
  id: 'question-uuid-1',
  content: '이차방정식 x² - 5x + 6 = 0의 해는?',
  type: 'multiple_choice',
  difficulty: 3,
  subject: '수학',
  grade: 10,
  is_ai_generated: true,
  ai_review_status: 'pending',
  source_type: 'ai_generated',
  created_at: '2026-02-28T00:00:00.000Z',
  profiles: { name: '홍길동' },
}

// ─── 테스트 ───────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getQuestionList', () => {
  // ─── 인증 실패 ──────────────────────────────────────

  describe('인증 실패', () => {
    it('인증되지 않은 사용자는 에러를 반환한다', async () => {
      mockAuthFailed()
      mockSupabaseClient.from.mockReturnValue(mockProfileNotFound())

      const result = await getQuestionList()

      expect(result.error).toBeDefined()
      expect(result.data).toBeUndefined()
    })

    it('프로필이 없으면 에러를 반환한다', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'some-user-id' } },
        error: null,
      } as any)
      mockSupabaseClient.from.mockReturnValue(mockProfileNotFound())

      const result = await getQuestionList()

      expect(result.error).toBeDefined()
    })

    it('소속 학원이 없으면 에러를 반환한다', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-no-academy' } },
        error: null,
      } as any)
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'user-no-academy', role: 'teacher', academy_id: null },
          error: null,
        }),
      })

      const result = await getQuestionList()

      expect(result.error).toBeDefined()
    })
  })

  // ─── 필터 적용 ──────────────────────────────────────

  describe('필터 적용', () => {
    beforeEach(() => {
      const profileQuery = mockAuthAs('teacher')
      const listQuery = mockQuestionListQuery([SAMPLE_ROW], 1)

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'questions') return listQuery
        return listQuery
      })
    })

    it('필터 없이 목록을 조회한다', async () => {
      const result = await getQuestionList()

      expect(result.error).toBeUndefined()
      expect(result.data).toHaveLength(1)
    })

    it('subject 필터를 적용한다', async () => {
      const result = await getQuestionList({ subject: '수학' })

      expect(result.error).toBeUndefined()
    })

    it('grade 필터를 적용한다', async () => {
      const result = await getQuestionList({ grade: '10' })

      expect(result.error).toBeUndefined()
    })

    it('type 필터를 적용한다', async () => {
      const result = await getQuestionList({ type: 'multiple_choice' })

      expect(result.error).toBeUndefined()
    })

    it('sourceType 필터를 적용한다', async () => {
      const result = await getQuestionList({ sourceType: 'ai_generated' })

      expect(result.error).toBeUndefined()
    })
  })

  // ─── 응답 변환 ──────────────────────────────────────

  describe('응답 변환', () => {
    beforeEach(() => {
      const profileQuery = mockAuthAs('teacher')
      const listQuery = mockQuestionListQuery([SAMPLE_ROW], 5)

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        if (table === 'questions') return listQuery
        return listQuery
      })
    })

    it('DB row를 QuestionListItem으로 변환한다', async () => {
      const result = await getQuestionList()

      const item = result.data?.[0]
      expect(item?.id).toBe('question-uuid-1')
      expect(item?.content).toBe('이차방정식 x² - 5x + 6 = 0의 해는?')
      expect(item?.difficulty).toBe(3)
      expect(item?.isAiGenerated).toBe(true)
      expect(item?.createdByName).toBe('홍길동')
    })

    it('페이지네이션 메타를 반환한다', async () => {
      const result = await getQuestionList({ page: '1' })

      expect(result.meta?.total).toBe(5)
      expect(result.meta?.page).toBe(1)
      expect(result.meta?.pageSize).toBe(10)
    })

    it('profiles.name이 null이면 createdByName은 null이다', async () => {
      const profileQuery = mockAuthAs('teacher')
      const listQuery = mockQuestionListQuery(
        [{ ...SAMPLE_ROW, profiles: null }],
        1
      )

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        return listQuery
      })

      const result = await getQuestionList()

      expect(result.data?.[0]?.createdByName).toBeNull()
    })
  })

  // ─── 에러 처리 ──────────────────────────────────────

  describe('에러 처리', () => {
    it('DB 조회 실패 시 에러를 반환한다', async () => {
      const profileQuery = mockAuthAs('teacher')
      const errorQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: null,
          count: null,
          error: { message: 'DB Error' },
        }),
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery
        return errorQuery
      })

      const result = await getQuestionList()

      expect(result.error).toBeDefined()
      expect(result.data).toBeUndefined()
    })
  })
})
```

실행: `npx vitest run src/lib/actions/__tests__/questions-list.test.ts`
→ 모두 FAIL (파일 없음)

### GREEN — 최소 구현

```typescript
// src/lib/actions/questions.ts

/**
 * 문제(questions) Server Actions
 *
 * - getQuestionList: 목록 조회 + 필터 + 서버사이드 페이지네이션
 *
 * 패턴: getPastExamList (past-exams.ts) 재활용
 * 주의:
 * - profiles!created_by: questions 테이블에 created_by, reviewed_by 두 FK가
 *   모두 profiles를 참조하므로 컬럼명을 명시해야 PostgREST가 구분 가능
 * - created_by는 nullable → LEFT JOIN (profiles!inner 사용 안 함)
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { questionFilterSchema } from '@/lib/validations/questions'

// ─── 타입 정의 ────────────────────────────────────────

/** 목록에 표시할 문제 정보 */
export interface QuestionListItem {
  readonly id: string
  readonly content: string
  readonly type: string
  readonly difficulty: number
  readonly subject: string
  readonly grade: number
  readonly isAiGenerated: boolean
  readonly aiReviewStatus: string
  readonly sourceType: string | null
  readonly createdByName: string | null
  readonly createdAt: string
}

export interface QuestionListResult {
  readonly error?: string
  readonly data?: readonly QuestionListItem[]
  readonly meta?: {
    readonly total: number
    readonly page: number
    readonly pageSize: number
  }
}

// ─── 내부 타입 ────────────────────────────────────────

interface CurrentUserProfile {
  readonly id: string
  readonly role: string
  readonly academyId: string
}

interface GetCurrentUserResult {
  readonly error?: string
  readonly profile?: CurrentUserProfile
}

// ─── 상수 ────────────────────────────────────────────

const PAGE_SIZE = 10

// ─── 헬퍼 함수 ───────────────────────────────────────

/** 현재 사용자 프로필 조회 (인증 + academy_id 확인) */
async function getCurrentUserProfile(): Promise<GetCurrentUserResult> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: '인증이 필요합니다.' }
  }

  const { data: profile, error: profileError } = (await supabase
    .from('profiles')
    .select('id, role, academy_id')
    .eq('id', user.id)
    .single()) as {
    data: { id: string; role: string; academy_id: string | null } | null
    error: unknown
  }

  if (profileError || !profile) {
    return { error: '프로필을 찾을 수 없습니다.' }
  }

  if (!profile.academy_id) {
    return { error: '소속 학원이 없습니다.' }
  }

  return {
    profile: {
      id: profile.id,
      role: profile.role,
      academyId: profile.academy_id,
    },
  }
}

/** 빈 문자열 → undefined 변환 (Zod 파싱 전 sanitize) */
function sanitizeFilters(raw: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      value === '' ? undefined : value,
    ])
  )
}

/**
 * DB row(snake_case + FK JOIN) → QuestionListItem(camelCase) 변환
 * profiles!created_by JOIN으로 등록자 이름 포함
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 생성 타입 미생성
function toQuestionListItem(dbRow: any): QuestionListItem {
  return {
    id: dbRow.id,
    content: dbRow.content,
    type: dbRow.type,
    difficulty: dbRow.difficulty,
    subject: dbRow.subject,
    grade: dbRow.grade,
    isAiGenerated: dbRow.is_ai_generated ?? false,
    aiReviewStatus: dbRow.ai_review_status ?? 'none',
    sourceType: dbRow.source_type ?? null,
    createdByName: dbRow.profiles?.name ?? null,
    createdAt: dbRow.created_at,
  }
}

// ─── Server Action ────────────────────────────────────

/**
 * 문제 목록 조회
 *
 * @param rawFilters - URL searchParams (문자열 값 허용, sanitize 후 Zod 검증)
 * @returns QuestionListResult (data, meta, error)
 */
export async function getQuestionList(
  rawFilters?: Record<string, unknown>
): Promise<QuestionListResult> {
  // 1. 인증 확인
  const { error: profileError, profile } = await getCurrentUserProfile()
  if (profileError || !profile) {
    return { error: profileError ?? '인증 실패' }
  }

  // 2. 필터 검증
  const sanitized = sanitizeFilters(rawFilters ?? {})
  const parsed = questionFilterSchema.safeParse(sanitized)
  if (!parsed.success) {
    return { error: '잘못된 필터 값입니다.' }
  }
  const filters = parsed.data

  // 3. DB 쿼리 구성
  const supabase = await createClient()
  const page = filters.page ?? 1
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  // profiles!created_by: FK 컬럼명 명시 (reviewed_by와 구분)
  let query = supabase
    .from('questions')
    .select('id, content, type, difficulty, subject, grade, is_ai_generated, ai_review_status, source_type, created_at, profiles!created_by ( name )', { count: 'exact' })
    .eq('academy_id', profile.academyId)
    .order('created_at', { ascending: false })

  // 4. 필터 적용 (전부 선택적)
  if (filters.subject) {
    query = query.ilike('subject', `%${filters.subject}%`)
  }

  if (filters.grade) {
    query = query.eq('grade', filters.grade)
  }

  if (filters.type && filters.type !== 'all') {
    query = query.eq('type', filters.type)
  }

  if (filters.difficulty) {
    query = query.eq('difficulty', filters.difficulty)
  }

  if (filters.sourceType && filters.sourceType !== 'all') {
    query = query.eq('source_type', filters.sourceType)
  }

  // schoolType → grade 범위 필터 (grade가 없을 때만 적용)
  if (filters.schoolType && filters.schoolType !== 'all' && !filters.grade) {
    const ranges: Record<string, { min: number; max: number }> = {
      elementary: { min: 1, max: 6 },
      middle: { min: 7, max: 9 },
      high: { min: 10, max: 12 },
    }
    const range = ranges[filters.schoolType]
    if (range) {
      query = query.gte('grade', range.min).lte('grade', range.max)
    }
  }

  // 5. 페이지네이션 + 실행
  const { data, count, error } = await query.range(from, to)

  if (error) {
    return { error: '문제 목록 조회에 실패했습니다.' }
  }

  return {
    data: (data ?? []).map(toQuestionListItem),
    meta: {
      total: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
    },
  }
}
```

실행: `npx vitest run src/lib/actions/__tests__/questions-list.test.ts`
→ 12/12 PASS

### REFACTOR — 개선

`query` 변수에 `let` 재할당이 반복된다. 가독성은 충분하며 현재 패턴(getPastExamList와 동일)을 유지한다. 추가 분리 불필요.

---

## 6. Task 4: constants.ts (문제 UI 상수)

### 목표

문제 목록 DataTable의 Badge, Toolbar Select에서 공통으로 사용하는 상수.
패턴: `past-exams/_components/constants.ts` 재활용.

### 파일 위치

```
src/app/(dashboard)/questions/_components/constants.ts
```

### 구현 (테스트 불필요 — 상수 데이터)

```typescript
// src/app/(dashboard)/questions/_components/constants.ts

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
```

---

## 7. Task 5: question-columns.tsx (DataTable 컬럼 — 정적 배열)

### 목표

`/questions` DataTable의 컬럼 정의.
**정적 배열**로 정의 (팩토리 함수 불필요 — 권한별 분기 없음).

**왜 정적 배열인가?**
- `createPastExamColumns(callerRole)`: callerRole에 따라 "AI 문제 생성" 버튼 표시 여부가 달라짐 → 팩토리 함수
- `questionColumns`: 모든 역할에서 동일한 컬럼 구성 → 정적 배열
- 규칙: "권한별 분기가 있을 때만 팩토리 함수"

### 파일 위치

```
src/app/(dashboard)/questions/_components/question-columns.tsx
```

### 구현

```typescript
// src/app/(dashboard)/questions/_components/question-columns.tsx
'use client'

import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-react'
import type { QuestionListItem } from '@/lib/actions/questions'
import {
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_BADGE_VARIANT,
  DIFFICULTY_LABELS,
  DIFFICULTY_BADGE_VARIANT,
  SOURCE_TYPE_LABELS,
} from './constants'
// TODO: Step 5에서 QuestionDetailSheet 추가

// ─── 문제 DataTable 컬럼 정의 (7개) ──────────────────
// 정적 배열: 권한별 컬럼 분기 없음 (모든 역할 동일)
// 팩토리 함수가 필요해지는 시점: 역할별 액션 버튼이 달라질 때

export const questionColumns: ColumnDef<QuestionListItem>[] = [
  // 1. 과목
  {
    accessorKey: 'subject',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="과목" />
    ),
  },

  // 2. 학년 (formatGradeLabel 사용)
  {
    accessorKey: 'grade',
    header: '학년',
    cell: ({ row }) => {
      const grade = row.original.grade
      // 초등(1-6), 중등(7-9), 고등(10-12) 레이블
      if (grade <= 6) return `초${grade}`
      if (grade <= 9) return `중${grade - 6}`
      return `고${grade - 9}`
    },
  },

  // 3. 문제유형 (Badge)
  {
    accessorKey: 'type',
    header: '유형',
    cell: ({ row }) => {
      const type = row.original.type
      return (
        <Badge variant={QUESTION_TYPE_BADGE_VARIANT[type] ?? 'secondary'}>
          {QUESTION_TYPE_LABELS[type] ?? type}
        </Badge>
      )
    },
  },

  // 4. 난이도 (Badge)
  {
    accessorKey: 'difficulty',
    header: '난이도',
    cell: ({ row }) => {
      const diff = row.original.difficulty
      return (
        <Badge variant={DIFFICULTY_BADGE_VARIANT[diff] ?? 'secondary'}>
          {DIFFICULTY_LABELS[diff] ?? `${diff}단계`}
        </Badge>
      )
    },
  },

  // 5. 출처
  {
    accessorKey: 'sourceType',
    header: '출처',
    cell: ({ row }) => {
      const sourceType = row.original.sourceType
      if (!sourceType) return '—'
      return SOURCE_TYPE_LABELS[sourceType] ?? sourceType
    },
  },

  // 6. 등록일
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="등록일" />
    ),
    cell: ({ row }) =>
      new Date(row.original.createdAt).toLocaleDateString('ko-KR'),
  },

  // 7. 액션 (상세 보기)
  // Step 5에서 QuestionDetailSheet 연동 예정
  {
    id: 'actions',
    cell: function ActionsCell({ row }) {
      // TODO Step 5: sheetOpen 상태 + QuestionDetailSheet 추가
      const [sheetOpen, setSheetOpen] = useState(false)
      const question = row.original

      return (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSheetOpen(true)}
          >
            <Eye className="mr-1 h-4 w-4" />
            상세
          </Button>
          {/* Step 5에서 QuestionDetailSheet 추가 예정 */}
          {sheetOpen && (
            <div className="hidden">{question.id}</div>
          )}
        </>
      )
    },
  },
]
```

> **Step 5 연동 NOTE**: Step 5에서 `QuestionDetailSheet`를 구현하면
> `ActionsCell`에서 `<QuestionDetailSheet open={sheetOpen} onOpenChange={setSheetOpen} questionId={question.id} />`로 교체한다.

---

## 8. Task 6: questions-toolbar.tsx (필터 Toolbar)

### 목표

`/questions` 페이지 필터 Toolbar.
패턴: `past-exams-toolbar.tsx` 재활용.

**추가 기능**: `schoolType` 변경 시 `grade` Select 옵션 동적 갱신.

### 파일 위치

```
src/app/(dashboard)/questions/_components/questions-toolbar.tsx
```

### 구현

```typescript
// src/app/(dashboard)/questions/_components/questions-toolbar.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getGradeOptions,
  formatGradeLabel,
  isValidGradeForSchoolType,
  type SchoolType,
} from '@/lib/utils/grade-filter-utils'
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS, SOURCE_TYPE_LABELS } from './constants'

/**
 * 문제 목록 필터 Toolbar
 *
 * 5개 필터를 URL searchParams로 관리하는 Client Component
 * - 텍스트 Input 1개: 과목 (debounce 300ms)
 * - Select 4개: 학교유형, 학년(동적), 문제유형, 난이도
 *
 * schoolType 변경 시 grade Select 옵션이 연동됨:
 * - elementary: 초1~초6
 * - middle: 중1~중3
 * - high: 고1~고3
 * - all: 전체 학년
 *
 * 필터 변경 시 page 파라미터 삭제 → 첫 페이지로 초기화
 */
export function QuestionsToolbar() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 텍스트 필터 로컬 상태 (debounce용)
  const [subject, setSubject] = useState(searchParams.get('subject') ?? '')

  // schoolType 로컬 상태 (grade 연동에 필요)
  const [schoolType, setSchoolType] = useState<SchoolType | 'all'>(
    (searchParams.get('schoolType') as SchoolType | 'all') ?? 'all'
  )

  // 과목 debounce (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (subject) {
        params.set('subject', subject)
      } else {
        params.delete('subject')
      }
      params.delete('page')
      router.push(`/questions?${params.toString()}`)
    }, 300)

    return () => clearTimeout(timer)
  }, [subject, router, searchParams])

  // schoolType 변경 핸들러 (grade 연동)
  function handleSchoolTypeChange(value: SchoolType | 'all') {
    setSchoolType(value)

    const params = new URLSearchParams(searchParams.toString())

    if (value && value !== 'all') {
      params.set('schoolType', value)
    } else {
      params.delete('schoolType')
    }

    // schoolType 변경 시 현재 grade가 유효하지 않으면 초기화
    const currentGrade = searchParams.get('grade')
    if (currentGrade) {
      const gradeNum = parseInt(currentGrade, 10)
      if (!isValidGradeForSchoolType(gradeNum, value)) {
        params.delete('grade')
      }
    }

    params.delete('page')
    router.push(`/questions?${params.toString()}`)
  }

  // Select 필터 공통 핸들러
  function handleSelectChange(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')
    router.push(`/questions?${params.toString()}`)
  }

  // schoolType에 따른 학년 옵션 (동적)
  const gradeOptions = getGradeOptions(schoolType)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 과목 검색 (debounce) */}
      <Input
        placeholder="과목 검색..."
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="w-[150px]"
      />

      {/* 학교유형 */}
      <Select
        defaultValue={searchParams.get('schoolType') ?? 'all'}
        onValueChange={handleSchoolTypeChange}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="학교유형" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 유형</SelectItem>
          <SelectItem value="elementary">초등</SelectItem>
          <SelectItem value="middle">중등</SelectItem>
          <SelectItem value="high">고등</SelectItem>
        </SelectContent>
      </Select>

      {/* 학년 (schoolType 연동 동적 옵션) */}
      <Select
        defaultValue={searchParams.get('grade') ?? 'all'}
        onValueChange={(v) => handleSelectChange('grade', v)}
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue placeholder="학년" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 학년</SelectItem>
          {gradeOptions.map((grade) => (
            <SelectItem key={grade} value={String(grade)}>
              {formatGradeLabel(grade)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 문제유형 */}
      <Select
        defaultValue={searchParams.get('type') ?? 'all'}
        onValueChange={(v) => handleSelectChange('type', v)}
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue placeholder="유형" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 유형</SelectItem>
          {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 난이도 */}
      <Select
        defaultValue={searchParams.get('difficulty') ?? 'all'}
        onValueChange={(v) => handleSelectChange('difficulty', v)}
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue placeholder="난이도" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 난이도</SelectItem>
          {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 출처 */}
      <Select
        defaultValue={searchParams.get('sourceType') ?? 'all'}
        onValueChange={(v) => handleSelectChange('sourceType', v)}
      >
        <SelectTrigger className="w-[110px]">
          <SelectValue placeholder="출처" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 출처</SelectItem>
          {Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
```

---

## 9. Task 7: questions/page.tsx + menu.ts 수정

### 9-A. questions/page.tsx (Server Component)

패턴: `past-exams/page.tsx` 재활용.
**권한 조회 불필요** — 모든 역할에서 동일한 컬럼 구성 (정적 배열 사용).

```typescript
// src/app/(dashboard)/questions/page.tsx

import { DataTable, DataTableServerPagination } from '@/components/data-table'
import { getQuestionList } from '@/lib/actions/questions'
import type { QuestionListItem } from '@/lib/actions/questions'
import { questionColumns } from './_components/question-columns'
import { QuestionsToolbar } from './_components/questions-toolbar'

interface QuestionsPageProps {
  searchParams: Promise<{
    subject?: string
    schoolType?: string
    grade?: string
    type?: string
    difficulty?: string
    sourceType?: string
    page?: string
  }>
}

/**
 * 문제 목록 페이지
 *
 * Server Component: 데이터 조회 + DataTable 렌더링
 * 권한 조회 불필요: 정적 컬럼 배열 사용 (모든 역할 동일)
 */
export default async function QuestionsPage({
  searchParams,
}: QuestionsPageProps) {
  const params = await searchParams

  const result = await getQuestionList({
    subject: params.subject,
    schoolType: params.schoolType,
    grade: params.grade,
    type: params.type,
    difficulty: params.difficulty,
    sourceType: params.sourceType,
    page: params.page ?? '1',
  })

  if (result.error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">문제 관리</h1>
        </div>
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          에러: {result.error}
        </div>
      </div>
    )
  }

  const questions = (result.data ?? []) as QuestionListItem[]
  const total = result.meta?.total ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">문제 관리</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            총 {total}개의 문제
          </p>
        </div>
      </div>

      <DataTable
        columns={questionColumns}
        data={questions}
        toolbar={<QuestionsToolbar />}
        noResultsMessage="저장된 문제가 없습니다."
        showPagination={false}
      />

      <DataTableServerPagination
        total={total}
        page={result.meta?.page ?? 1}
        pageSize={result.meta?.pageSize ?? 10}
      />
    </div>
  )
}
```

### 9-B. menu.ts 수정 (사이드바 "문제 관리" 추가)

```typescript
// src/lib/constants/menu.ts (수정)

import {
  LayoutDashboard,
  FileText,
  Sparkles,
  Building2,
  Users,
  GraduationCap,
  Settings,
  BookOpen,    // ← 추가
  type LucideIcon,
} from 'lucide-react'

// ... (MenuItem interface 동일)

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
  // ← 여기에 "문제 관리" 추가
  {
    title: '문제 관리',
    href: '/questions',
    icon: BookOpen,
    description: '저장된 문제 조회 및 관리',
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
```

---

## 10. 완료 기준

### 테스트 통과

```bash
# Task 1 테스트 (20개)
npx vitest run src/lib/utils/__tests__/grade-filter-utils.test.ts

# Task 2 테스트 (12개)
npx vitest run src/lib/validations/__tests__/questions.test.ts

# Task 3 테스트 (12개)
npx vitest run src/lib/actions/__tests__/questions-list.test.ts

# 전체 실행 (기존 테스트 회귀 없음 확인)
npm run test:run
```

### 빌드 성공

```bash
npm run build
# TypeScript 에러 없음
# "문제 관리" 메뉴 클릭 시 /questions 페이지 정상 표시
```

### UI 체크리스트

- [ ] 사이드바에 "문제 관리" 메뉴 표시
- [ ] `/questions` 페이지 접속 시 문제 목록 표시
- [ ] 과목 검색 (debounce 300ms) 정상 동작
- [ ] 학교유형 변경 시 학년 Select 옵션 연동
- [ ] 문제유형, 난이도, 출처 필터 정상 동작
- [ ] 페이지네이션 정상 동작
- [ ] "상세" 버튼 클릭 (Step 5 연동 전까지 빈 상태)

---

## 11. 학습 리뷰

### 핵심 개념

**개념 1: schoolType 연동 학년 필터 (동적 옵션)**

```typescript
// Toolbar에서 schoolType이 변경될 때 두 가지 일이 동시에 발생한다:
// 1. grade Select의 옵션 목록이 변경됨
// 2. 현재 선택된 grade가 새 schoolType에서 유효하지 않으면 초기화됨

function handleSchoolTypeChange(value: SchoolType | 'all') {
  setSchoolType(value)  // → gradeOptions = getGradeOptions(value) 재계산

  const currentGrade = searchParams.get('grade')
  if (currentGrade && !isValidGradeForSchoolType(parseInt(currentGrade), value)) {
    params.delete('grade')  // 유효하지 않은 grade 초기화
  }
}
```

UX 이유: 학교유형을 "고등"으로 바꾼 후 학년이 여전히 "초3(3)"으로 남아 있으면
쿼리는 `WHERE schoolType='high' AND grade=3`이 되어 결과 0건.
사용자 입장에서 혼란스러우므로 자동 초기화.

---

**개념 2: 정적 컬럼 배열 vs 팩토리 함수**

```typescript
// 정적 배열 — 권한별 분기 없음 (questions)
export const questionColumns: ColumnDef<QuestionListItem>[] = [ ... ]

// 팩토리 함수 — 권한별 분기 있음 (past-exams)
export function createPastExamColumns(callerRole: string): ColumnDef<PastExamListItem>[] {
  return [
    // ...
    { id: 'actions', cell: function ActionsCell({ row }) {
      // callerRole을 클로저로 캡처
      return <PastExamDetailSheet callerRole={callerRole} />
    }}
  ]
}
```

결정 기준: "컬럼 구성이 런타임 값에 따라 달라지는가?"
- NO → 정적 배열
- YES → 팩토리 함수 (클로저로 런타임 값 캡처)

---

**개념 3: `profiles!created_by` FK 명시 (PostgREST 모호성 해결)**

```sql
-- questions 테이블에 profiles를 참조하는 FK가 2개 존재:
created_by  UUID REFERENCES profiles(id)   -- 문제 등록자
reviewed_by UUID REFERENCES profiles(id)   -- 검수자
```

```typescript
// 잘못된 방법 — PostgREST가 어떤 FK를 쓸지 모름 → 에러
.select('..., profiles ( name )')

// 올바른 방법 — FK 컬럼명 명시
.select('..., profiles!created_by ( name )')
```

패턴 일관성: `schools!inner` (JOIN 방식) vs `profiles!created_by` (FK 구분)
→ `!` 뒤에 `inner`가 오면 JOIN 방식, 컬럼명이 오면 FK 구분 (혼용 가능)

---

**개념 4: DataTable 재활용 패턴 체계**

1-6에서 처음 만든 DataTable 패턴이 1-8에서 그대로 재활용된다.
새 페이지를 만들 때마다 동일한 5단계를 반복:

```
Filter Schema (validations/)
    ↓
Server Action (actions/)
    ↓
Columns (page/_components/xxx-columns.tsx)
    ↓
Toolbar (page/_components/xxx-toolbar.tsx)
    ↓
Page (page/page.tsx) — Server Component, searchParams → Action 호출
```

---

### 이해도 질문

**Q1**: 문제 목록 컬럼을 정적 배열(`questionColumns`)로 정의한 이유는 무엇인가?
기출문제 컬럼(`createPastExamColumns`)이 팩토리 함수인 이유와 비교하여 설명하라.

**Q2**: Supabase 쿼리에서 `profiles!created_by`처럼 FK 컬럼명을 명시해야 하는 상황은 언제인가?
`!inner`와 `!created_by`의 차이를 설명하라.

**Q3**: schoolType 변경 시 grade 필터가 자동으로 초기화되어야 하는 이유를 UX 관점에서 설명하라.
`isValidGradeForSchoolType` 함수가 이 로직에서 하는 역할은?

---

### 직접 구현 추천

**🟢 전체 (Step 4)**: 1-6 패턴 반복 → AI 자동 구현 OK

근거:
- `grade-filter-utils.ts`: 순수 함수, 새 알고리즘 없음 (범위 계산만)
- `questions.ts` (validation): `pastExamFilterSchema` 구조 그대로 복사 수준
- `questions.ts` (actions): `getPastExamList` 구조 그대로 복사 + 컬럼명 변경
- `question-columns.tsx`: `past-exam-columns.tsx` 구조 그대로 복사
- `questions-toolbar.tsx`: `past-exams-toolbar.tsx` 구조 + schoolType 연동 로직 추가

새로운 패턴이 없으므로 AI 자동 구현이 적합하다.
다만 구현 완료 후 테스트를 직접 실행하고, schoolType↔grade 연동이 실제로 동작하는지 브라우저에서 확인하는 것을 권장한다.

---

## 12. 참조 파일

| 재활용 파일 | 참조 대상 |
|------------|----------|
| `src/app/(dashboard)/past-exams/page.tsx` | `questions/page.tsx` 구조 |
| `src/app/(dashboard)/past-exams/_components/past-exams-toolbar.tsx` | `questions-toolbar.tsx` 구조 |
| `src/app/(dashboard)/past-exams/_components/past-exam-columns.tsx` | `question-columns.tsx` 구조 |
| `src/app/(dashboard)/past-exams/_components/constants.ts` | `questions/_components/constants.ts` 구조 |
| `src/lib/validations/past-exams.ts` (`pastExamFilterSchema`) | `questions.ts` 스키마 |
| `src/lib/actions/past-exams.ts` (`getPastExamList`) | `questions.ts` Action |
| `src/lib/constants/menu.ts` | "문제 관리" 메뉴 추가 위치 |
