# 계획: 학교유형별 학년 필터링 버그 수정

> **리서치 문서**: `docs/research/grade-filter-by-school-type.md`
> **작성일**: 2026-03-02
> **복잡도**: MEDIUM (6 Steps, 약 8개 파일 수정)
> **접근법**: 접근 B (grade 범위 변환) + `getGradeRange()` 공통 분리

---

## 요구사항 재정의

기출문제 업로드 폼에서 학교 선택 후에도 **학년이 1~12 전부 표시**되는 버그 수정.
초등학교 → 초1~초6, 중학교 → 중1~중3, 고등학교 → 고1~고3만 표시되어야 한다.

### 채택: 접근 B (grade 범위 변환) + `getGradeRange()` 공통 분리

### 수정 범위

| 위치 | 파일 | 현재 상태 | 목표 |
|---|---|---|---|
| 유틸 함수 | `grade-filter-utils.ts` (67줄) | GRADE_RANGES 미export | `getGradeRange()` 공통 함수 추가 |
| Zod 스키마 | `validations/past-exams.ts` (113줄) | schoolType 필드 없음 | schoolType 추가 |
| Server Action | `actions/past-exams.ts` (425줄) | schoolType 필터 없음 | 범위 필터+교차 검증 |
| Server Action | `actions/questions.ts` | ranges 하드코딩 | `getGradeRange()` 사용으로 리팩터 |
| 업로드 폼 | `upload-form.tsx` (219줄) | 1~12 하드코딩 | schoolId→school_type 파생→동적 학년 |
| 기출 필터 | `past-exams-toolbar.tsx` (167줄) | 정적 GRADE_OPTIONS | schoolType 셀렉트+동적 학년 |
| 상수 | `past-exams/_components/constants.ts` (46줄) | 정적 GRADE_OPTIONS | 제거 |

### 재사용 가능한 기존 유틸 (변경 불필요)

**`src/lib/utils/grade-filter-utils.ts`** — 이미 완벽 구현 + 테스트 통과

```typescript
getGradeOptions(schoolType)          // schoolType별 학년 배열 반환
formatGradeLabel(grade)              // 숫자→"초1","중1","고1"
isValidGradeForSchoolType(grade, st) // 유효성 검사
```

### 레퍼런스 패턴

**`src/app/(dashboard)/questions/_components/questions-toolbar.tsx`** — "올바른 구현"의 레퍼런스

---

## 의존성 그래프

```
Step 1 (유틸) → Step 2 (Zod) → Step 3 (Server Action) → Step 4 (업로드 폼, 독립)
                                                       → Step 5 (필터 Toolbar, 독립)
                                                                → Step 6 (빌드 검증)
```

- Step 1 (유틸 공통 함수) → Step 3 (Server Action)이 의존
- Step 2 (Zod) → Step 3 (Server Action)이 의존
- Step 4 (업로드 폼)과 Step 5 (필터 Toolbar)는 **서로 독립** — 병렬 가능
- Step 6 (빌드 검증)는 모든 Step 완료 후

---

## Step 1: 공통 유틸 함수 추가 + 테스트 (TDD)

### 수정 파일

| 파일 | 변경 |
|---|---|
| `src/lib/utils/grade-filter-utils.ts` | `getGradeRange()` 함수 추가 |
| `src/lib/utils/__tests__/grade-filter-utils.test.ts` | `getGradeRange()` 테스트 추가 |

### 변경 내용

**`grade-filter-utils.ts`** — GRADE_RANGES 캡슐화 함수 추가

```typescript
// 현재: GRADE_RANGES는 모듈 내부 상수 (export 안 됨)
const GRADE_RANGES: Record<
  SchoolType,
  { readonly min: number; readonly max: number; readonly prefix: string }
> = { ... }

// 추가: 학교유형별 학년 범위를 반환하는 공통 함수
/**
 * 학교유형의 학년 범위(min, max) 반환
 * Server Action에서 schoolType → grade 범위 필터에 사용
 * @example getGradeRange('high') → { min: 10, max: 12 }
 */
export function getGradeRange(schoolType: SchoolType): { min: number; max: number } {
  const { min, max } = GRADE_RANGES[schoolType]
  return { min, max }
}
```

> **설계 결정**: GRADE_RANGES 자체를 export하지 않고 함수로 감싼 이유
> - `prefix`(초/중/고)는 UI 전용 — Server Action에 노출할 필요 없음
> - 필요한 정보(`min`, `max`)만 반환하여 관심사 분리

### 테스트 (TDD RED → GREEN)

```typescript
describe('getGradeRange', () => {
  it('elementary → { min: 1, max: 6 }', () => {
    expect(getGradeRange('elementary')).toEqual({ min: 1, max: 6 })
  })

  it('middle → { min: 7, max: 9 }', () => {
    expect(getGradeRange('middle')).toEqual({ min: 7, max: 9 })
  })

  it('high → { min: 10, max: 12 }', () => {
    expect(getGradeRange('high')).toEqual({ min: 10, max: 12 })
  })
})
```

### 학습 포인트

- 🟢 **캡슐화**: 내부 상수(`GRADE_RANGES`)를 직접 노출하지 않고, 필요한 정보만 함수로 제공
- 🟢 **우연한 중복 제거**: questions.ts와 past-exams.ts에서 동일한 ranges 객체를 하드코딩하던 것을 Single Source of Truth로 통합

---

## Step 2: Zod 스키마 수정 + 테스트 (TDD)

### 수정 파일

| 파일 | 변경 |
|---|---|
| `src/lib/validations/past-exams.ts` | `pastExamFilterSchema`에 schoolType 필드 추가 |
| `src/lib/validations/__tests__/past-exams-filter.test.ts` | schoolType 테스트 추가 |

### 변경 내용

**`past-exams.ts`** — pastExamFilterSchema (현재 라인 87~98)

```typescript
// 현재
export const pastExamFilterSchema = z.object({
  school: z.string().optional(),
  grade: z.coerce.number().int().min(1).max(12).optional(),
  subject: z.string().optional(),
  examType: z.enum(['midterm', 'final', 'mock', 'diagnostic', 'all']).optional().default('all'),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  semester: z.enum(['1', '2', 'all']).optional().default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
})

// 변경 후 (schoolType 추가)
export const pastExamFilterSchema = z.object({
  school: z.string().optional(),
  schoolType: z                           // ← 추가
    .enum(['elementary', 'middle', 'high', 'all'])
    .optional()
    .default('all'),
  grade: z.coerce.number().int().min(1).max(12).optional(),
  subject: z.string().optional(),
  examType: z.enum(['midterm', 'final', 'mock', 'diagnostic', 'all']).optional().default('all'),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  semester: z.enum(['1', '2', 'all']).optional().default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
})
```

> **Q: DB에 schoolType도 관리되는것인가?**
>
> **아니다.** `past_exam_questions` 테이블에는 `school_type` 컬럼이 **없다.**
> `school_type`은 `schools` 테이블에만 존재하며, `past_exam_questions`는 `school_id` FK로 JOIN해서 접근한다.
>
> ```
> past_exam_questions.school_id → schools.id → schools.school_type
> ```
>
> 따라서 필터 스키마의 `schoolType`은 **DB 컬럼이 아니라 순수 UI 필터 파라미터**다.
> Server Action에서 이 값을 활용하는 방법은 Step 2에서 두 가지 접근법으로 설명한다.

> **패턴 참조**: `src/lib/validations/questions.ts`의 `questionFilterSchema`와 동일한 schoolType 정의

### 테스트 (TDD RED → GREEN)

**`past-exams-filter.test.ts`** — 새로운 describe 블록 추가

```typescript
// ─── schoolType 필터 ───────────────────────────────────
describe('schoolType 필터', () => {
  it('기본값이 "all"이다', () => {
    const result = pastExamFilterSchema.parse({})
    expect(result.schoolType).toBe('all')
  })

  it.each(['elementary', 'middle', 'high', 'all'])(
    '유효한 학교유형 "%s"를 허용한다',
    (type) => {
      const result = pastExamFilterSchema.parse({ schoolType: type })
      expect(result.schoolType).toBe(type)
    }
  )

  it('유효하지 않은 학교유형을 거부한다', () => {
    expect(() => pastExamFilterSchema.parse({ schoolType: 'university' })).toThrow()
  })
})

// 복합 필터에 schoolType 추가
it('모든 필터를 동시에 적용할 수 있다', () => {
  const input = {
    school: '한국고',
    schoolType: 'high',    // ← 추가
    grade: '10',
    subject: '수학',
    examType: 'midterm',
    year: '2024',
    semester: '1',
    page: '2',
  }
  const result = pastExamFilterSchema.parse(input)
  expect(result.schoolType).toBe('high')
  // ... 기존 assertions 유지
})
```

### 학습 포인트

- 🟢 기존 패턴 재사용: `questionFilterSchema`와 동일한 schoolType enum
- Zod `.enum()` + `.optional()` + `.default()` 체이닝 순서 이해

---

## Step 3: Server Action 수정 + 테스트 (TDD)

### 수정 파일

| 파일 | 변경 |
|---|---|
| `src/lib/actions/past-exams.ts` | getPastExamList에 schoolType 범위 필터 + uploadPastExamAction 교차 검증 |
| `src/lib/actions/questions.ts` | 기존 ranges 하드코딩 → `getGradeRange()` 사용으로 리팩터 |
| `src/lib/actions/__tests__/past-exams-list.test.ts` | schoolType 필터 테스트 추가 |

### 변경 내용 A: getPastExamList — schoolType 범위 필터 (접근 B 확정)

**`past-exams.ts`** — 필터 적용 블록 (현재 라인 304~322 이후에 추가)

```typescript
import { getGradeRange, type SchoolType } from '@/lib/utils/grade-filter-utils'

// 현재: grade 필터만 존재
if (grade) {
  query = query.eq('grade', grade)
}

// 추가: schoolType → grade 범위 필터 (grade가 없을 때만 적용)
// getGradeRange() 공통 함수 사용 — ranges 하드코딩 제거
const { schoolType } = parsed.data   // ← destructure에 schoolType 추가
if (schoolType && schoolType !== 'all' && !grade) {
  const range = getGradeRange(schoolType as SchoolType)
  query = query.gte('grade', range.min).lte('grade', range.max)
}
```

> **설계 원칙**: grade가 명시되면 grade 우선 (정확한 학년), schoolType만 있으면 범위 필터

### 변경 내용 A-2: questions.ts 리팩터 (기존 ranges 하드코딩 제거)

**`questions.ts`** — 현재 라인 226~237

```typescript
// 현재: ranges 하드코딩
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

// 변경 후: getGradeRange() 사용
import { getGradeRange, type SchoolType } from '@/lib/utils/grade-filter-utils'

if (filters.schoolType && filters.schoolType !== 'all' && !filters.grade) {
  const range = getGradeRange(filters.schoolType as SchoolType)
  query = query.gte('grade', range.min).lte('grade', range.max)
}
```

> 10줄 → 3줄로 축소. Single Source of Truth (GRADE_RANGES).

### 변경 내용 B: uploadPastExamAction — 교차 검증 (Defense in Depth)

**`past-exams.ts`** — 메타데이터 검증 후 (현재 라인 207~212 이후에 추가)

```typescript
// 현재: Zod 파싱 후 바로 Storage 업로드로 진행
const parsed = pastExamUploadSchema.safeParse(raw)
if (!parsed.success) { ... }

// 추가: school_type ↔ grade 교차 검증 (Server-side Defense in Depth)
import { isValidGradeForSchoolType, type SchoolType } from '@/lib/utils/grade-filter-utils'

const { data: school } = await supabase
  .from('schools')
  .select('school_type')
  .eq('id', parsed.data.schoolId)
  .single() as { data: { school_type: string } | null; error: unknown }

if (school && !isValidGradeForSchoolType(parsed.data.grade, school.school_type as SchoolType)) {
  return { error: '선택한 학교 유형에 맞지 않는 학년입니다.' }
}
```

> **학습 포인트 🟡 Defense in Depth**: UI에서 1차 방어 (동적 옵션) + Server Action에서 2차 방어 (교차 검증)
> 공격자가 DevTools로 form 값을 조작해도 서버에서 거부됨

### 테스트

**`past-exams-list.test.ts`** — mockPastExamListQuery에 gte/lte Mock 추가 필요

```typescript
// Mock 헬퍼 수정: gte, lte 추가
function mockPastExamListQuery(items: any[], count: number) {
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),   // ← 추가
    lte: vi.fn().mockReturnThis(),   // ← 추가
    then: vi.fn().mockImplementation((resolve: any) =>
      resolve({ data: items, error: null, count })
    ),
  }
}

describe('schoolType 필터', () => {
  it('schoolType="high" + grade 없음 → gte(10), lte(12) 호출', async () => {
    const profileQuery = mockAuthAs('student')
    const listQuery = mockPastExamListQuery([], 0)
    mockSupabaseClient.from
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(listQuery)

    await getPastExamList({ schoolType: 'high' })

    expect(listQuery.gte).toHaveBeenCalledWith('grade', 10)
    expect(listQuery.lte).toHaveBeenCalledWith('grade', 12)
  })

  it('schoolType="high" + grade=10 → gte/lte 미호출 (grade 우선)', async () => {
    const profileQuery = mockAuthAs('student')
    const listQuery = mockPastExamListQuery([], 0)
    mockSupabaseClient.from
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(listQuery)

    await getPastExamList({ schoolType: 'high', grade: 10 })

    expect(listQuery.eq).toHaveBeenCalledWith('grade', 10)
    expect(listQuery.gte).not.toHaveBeenCalled()
  })

  it('schoolType="all" → gte/lte 미호출', async () => {
    const profileQuery = mockAuthAs('student')
    const listQuery = mockPastExamListQuery([], 0)
    mockSupabaseClient.from
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(listQuery)

    await getPastExamList({ schoolType: 'all' })

    expect(listQuery.gte).not.toHaveBeenCalled()
    expect(listQuery.lte).not.toHaveBeenCalled()
  })
})
```

### 학습 포인트

- 🟡 **Defense in Depth**: UI 방어(동적 옵션)만으로는 불충분 → Server Action에서 교차 검증 필수
- 🟢 **`getGradeRange()` 공통 함수**: questions.ts와 past-exams.ts에서 동일한 범위 매핑을 Single Source of Truth로 통합
- Mock 체인에 `gte`, `lte` 추가 — Supabase Fluent API 이해

---

## Step 4: 업로드 폼 UI 수정 (upload-form.tsx)

### 수정 파일

| 파일 | 변경 |
|---|---|
| `src/app/(dashboard)/past-exams/upload/upload-form.tsx` | schoolId/grade controlled 전환 + 동적 학년 |

### 현재 코드 분석

```tsx
// 현재 (라인 34~42): School 인터페이스에 이미 school_type 포함!
interface School {
  readonly id: string
  readonly name: string
  readonly school_type: string  // ← 이미 존재!
}

interface UploadFormProps {
  readonly schools: readonly School[]
}

// 현재 (라인 109~120): schoolId Select — uncontrolled
<Select name="schoolId" required disabled={isPending}>
  ...
  {schools.map((school) => (
    <SelectItem key={school.id} value={school.id}>
      {school.name} ({school.school_type})
    </SelectItem>
  ))}
</Select>

// 현재 (라인 128~139): grade Select — uncontrolled, 1~12 하드코딩
<Select name="grade" required disabled={isPending}>
  ...
  {Array.from({ length: 12 }, (_, i) => i + 1).map((grade) => (
    <SelectItem key={grade} value={String(grade)}>
      {grade}학년
    </SelectItem>
  ))}
</Select>
```

### 변경 내용

```tsx
// 1. import 추가
import { useState } from 'react'  // useActionState 옆에 추가
import {
  getGradeOptions,
  formatGradeLabel,
  type SchoolType,
} from '@/lib/utils/grade-filter-utils'

// 2. 컴포넌트 내부 state 추가
const [selectedSchoolId, setSelectedSchoolId] = useState<string>('')
const [selectedGrade, setSelectedGrade] = useState<string>('')

// 3. school_type 파생 (파생 상태 — 별도 state 불필요)
const selectedSchool = schools.find((s) => s.id === selectedSchoolId)
const schoolType = selectedSchool?.school_type as SchoolType | undefined
const gradeOptions = schoolType ? getGradeOptions(schoolType) : []

// 4. schoolId 변경 핸들러
function handleSchoolChange(schoolId: string) {
  setSelectedSchoolId(schoolId)
  setSelectedGrade('')  // 학교 변경 시 학년 초기화
}

// 5. 학교 Select → controlled
<Select
  name="schoolId"
  required
  disabled={isPending}
  value={selectedSchoolId}
  onValueChange={handleSchoolChange}
>
  <SelectTrigger id="schoolId">
    <SelectValue placeholder="학교를 선택하세요" />
  </SelectTrigger>
  <SelectContent>
    {schools.map((school) => (
      <SelectItem key={school.id} value={school.id}>
        {school.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>

// 6. 학년 Select → controlled + 동적 옵션
<Select
  name="grade"
  required
  disabled={isPending || !selectedSchoolId}  // 학교 미선택 시 disabled
  value={selectedGrade}
  onValueChange={setSelectedGrade}
>
  <SelectTrigger id="grade">
    <SelectValue placeholder={selectedSchoolId ? '학년을 선택하세요' : '학교를 먼저 선택하세요'} />
  </SelectTrigger>
  <SelectContent>
    {gradeOptions.map((grade) => (
      <SelectItem key={grade} value={String(grade)}>
        {formatGradeLabel(grade)}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### 핵심 설계 결정

1. **`schools` prop에 이미 `school_type` 포함** → 추가 DB 쿼리 불필요
2. **파생 상태** (`schoolType`): `selectedSchoolId`에서 `schools.find()`로 파생 — 별도 state가 아님 (Single Source of Truth)
3. **학교 미선택 시 학년 disabled**: `!selectedSchoolId`로 제어
4. **controlled + name 속성 유지**: `<Select value={...} name="...">`으로 native form 제출 호환

### 학습 포인트

- 🟡 **Controlled vs Uncontrolled Component**:
  - Uncontrolled: `<Select name="x">`만으로 form 제출 시 값 자동 수집
  - Controlled: `value` + `onValueChange`로 React가 값을 관리
  - shadcn Select는 **Radix UI 기반**이라 `value` prop이 있으면 controlled
  - controlled여도 `name` 속성이 있으면 hidden input으로 form data에 포함됨
- 🟢 **파생 상태 (Derived State)**: `schoolType`은 `useState`가 아니라 `schools.find()`로 계산 — React 공식 문서 "Choosing the State Structure" 참조
- `formatGradeLabel()` 적용: "10학년" → "고1" (UX 개선)

---

## Step 5: 기출 필터 Toolbar UI 수정 (past-exams-toolbar.tsx)

### 수정 파일

| 파일 | 변경 |
|---|---|
| `src/app/(dashboard)/past-exams/_components/past-exams-toolbar.tsx` | schoolType 셀렉트 추가 + 동적 학년 |
| `src/app/(dashboard)/past-exams/_components/constants.ts` | GRADE_OPTIONS 제거 |

### 현재 코드 분석

```tsx
// 현재 import (라인 14~17)
import {
  EXAM_TYPE_LABELS,
  YEAR_OPTIONS,
  GRADE_OPTIONS,  // ← 정적 1~12
} from './constants'

// 현재: schoolType 셀렉트 없음
// 현재: 학년은 GRADE_OPTIONS (정적)
```

### 변경 내용

**패턴**: `questions-toolbar.tsx` 라인 36~102를 거의 그대로 적용

```tsx
// 1. import 변경
import {
  EXAM_TYPE_LABELS,
  YEAR_OPTIONS,
  // GRADE_OPTIONS 제거
} from './constants'
import {
  getGradeOptions,
  formatGradeLabel,
  isValidGradeForSchoolType,
  type SchoolType,
} from '@/lib/utils/grade-filter-utils'

// 2. schoolType state 추가
const [schoolType, setSchoolType] = useState<SchoolType | 'all'>(
  (searchParams.get('schoolType') as SchoolType | 'all') ?? 'all'
)

// 3. schoolType 변경 핸들러 (grade 유효성 검증 포함)
// 패턴 참조: questions-toolbar.tsx 라인 65~87
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
  router.push(`/past-exams?${params.toString()}`)
}

// 4. 동적 학년 옵션
const gradeOptions = getGradeOptions(schoolType)

// 5. JSX — 학교명 검색과 과목 검색 사이에 schoolType 셀렉트 추가
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

// 6. 학년 Select 변경 — GRADE_OPTIONS → gradeOptions + formatGradeLabel
{/* 학년 (schoolType 연동 동적 옵션) */}
<Select
  defaultValue={searchParams.get('grade') ?? 'all'}
  onValueChange={(v) => handleSelectChange('grade', v)}
>
  <SelectTrigger className="w-[120px]">
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
```

### constants.ts 정리

```typescript
// 제거: GRADE_OPTIONS (더 이상 사용하지 않음)
// export const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1)

// 유지: EXAM_TYPE_LABELS, EXAM_TYPE_BADGE_VARIANT, EXTRACTION_STATUS_MAP,
//       SEMESTER_LABELS, CURRENT_YEAR, YEAR_OPTIONS
```

> GRADE_OPTIONS를 import하는 곳이 past-exams-toolbar.tsx뿐인지 확인 후 제거

### 학습 포인트

- 🟢 **questions-toolbar.tsx 패턴 그대로 재사용** — 일관성
- `handleSchoolTypeChange` 내부의 grade 유효성 검증: schoolType 변경 시 선택된 grade가 새 범위 밖이면 자동 초기화
- `isValidGradeForSchoolType()` 활용: 불필요한 범위 계산 대신 유틸 함수 재사용

---

## Step 6: 빌드 검증 + 통합 확인

### 검증 항목

```bash
# 1. 기존 테스트 전체 실행
npm run test:run

# 2. 새로 추가한 테스트만 실행 (빠른 확인)
npx vitest run src/lib/validations/__tests__/past-exams-filter.test.ts
npx vitest run src/lib/actions/__tests__/past-exams-list.test.ts

# 3. TypeScript 타입 체크
npx tsc --noEmit

# 4. 빌드
npm run build
```

### 체크리스트

- [ ] `getGradeRange()` 공통 함수 추가 + 테스트 통과
- [ ] pastExamFilterSchema에 schoolType 추가 + 테스트 통과
- [ ] getPastExamList schoolType 범위 필터 (`getGradeRange()` 사용) + 테스트 통과
- [ ] questions.ts의 ranges 하드코딩 → `getGradeRange()` 리팩터 + 기존 테스트 통과
- [ ] uploadPastExamAction school_type↔grade 교차 검증 + 테스트 통과
- [ ] upload-form.tsx 동적 학년 옵션 (controlled)
- [ ] past-exams-toolbar.tsx schoolType 셀렉트 + 동적 학년
- [ ] constants.ts GRADE_OPTIONS 제거 (미사용 확인 후)
- [ ] `npm run test:run` 전체 통과
- [ ] `npm run build` 성공
- [ ] `npx tsc --noEmit` 에러 없음

---

## 리스크 분석

| 수준 | 리스크 | 대응 |
|---|---|---|
| LOW | shadcn Select controlled 전환 시 `name` 속성 동작 | Radix UI는 hidden input 자동 생성 — native form 호환 |
| LOW | 학교 미선택 시 학년 disabled UX | placeholder 텍스트 변경으로 가이드 |
| MEDIUM | uploadPastExamAction 교차 검증 시 추가 DB 쿼리 | 업로드는 빈도 낮은 작업 — 1회 추가 쿼리 허용 가능 |
| LOW | GRADE_OPTIONS 제거 시 다른 파일에서 import | 제거 전 grep 확인 |

---

## 학습 리뷰 계획 (구현 후)

### 핵심 개념

1. **Controlled vs Uncontrolled Component** 🟡
   - React에서 form 입력을 관리하는 두 가지 방식
   - shadcn/Radix UI Select의 controlled 모드 동작 원리

2. **파생 상태 (Derived State)** 🟢
   - `schoolType`은 `selectedSchoolId`에서 파생 — 별도 state 아님
   - React 공식 가이드: "Don't mirror props in state"

3. **Defense in Depth** 🟡
   - UI 1차 방어 (동적 옵션으로 잘못된 선택 불가) + Server Action 2차 방어 (교차 검증)
   - 왜 UI만으로 부족한가? (DevTools 조작, API 직접 호출)

### 이해도 질문 (구현 후 출제)

1. `upload-form.tsx`에서 `schoolType`을 `useState`가 아닌 `schools.find()`로 파생한 이유는?
2. `getPastExamList`에서 grade 필터가 있을 때 schoolType 범위 필터를 적용하지 않는 이유는?
3. UI에서 동적 옵션으로 1차 방어를 했는데, Server Action에서 교차 검증이 왜 필요한가?

### 직접 구현 추천 판단

- 🟢 Step 1 (공통 유틸): 단순 함수 추가 — AI 자동 구현 OK
- 🟢 Step 2 (Zod 스키마): 패턴 반복 — AI 자동 구현 OK
- 🟢 Step 3 (Server Action 필터 + 리팩터): `getGradeRange()` 적용 — AI 자동 구현 OK
- 🟡 Step 3 (교차 검증): Defense in Depth 개념 — 이해 후 참고 구현 권장
- 🟡 Step 4 (업로드 폼 controlled): Controlled Component 패턴 — 재구현 권장
- 🟢 Step 5 (필터 Toolbar): questions-toolbar 패턴 반복 — AI 자동 구현 OK
