# 연구: 학교유형별 학년 필터링 현황 분석

> **작성일**: 2026-03-01
> **목적**: 기출문제 업로드 폼에서 학년 1~12가 모두 표시되는 버그 원인 분석 및 수정 방향 제시

---

## 1. 문제 정의`

기출문제 업로드 폼(`/past-exams/upload`)에서 학교를 선택한 후에도 **학년이 1~12 전부 표시**된다.
초등학교를 선택하면 1~6만, 중학교는 7~9만, 고등학교는 10~12만 표시되어야 한다.

---

## 2. 한국 교육과정 학년 체계 (프로젝트 기준)

| 학교유형 (`school_type`) | DB 값 | 학년 범위 | 한국식 표기 |
|---|---|---|---|
| 초등학교 | `elementary` | 1~6 | 초1 ~ 초6 |
| 중학교 | `middle` | 7~9 | 중1 ~ 중3 |
| 고등학교 | `high` | 10~12 | 고1 ~ 고3 |

- DB에서 grade는 미국식 K-12 (1~12 연속 정수)로 저장
- UI에서는 `formatGradeLabel()`로 한국식 변환 (예: 7 → "중1")
- ROADMAP 기록: "Phase 2+에서 스키마 개선 또는 school_type별 grade 재설계 검토"

---

## 3. 기존 구현 현황 (파일별 분석)

### 3.1 유틸리티 함수 — 완벽 구현됨

**파일**: `src/lib/utils/grade-filter-utils.ts`

| 함수 | 역할 | 상태 |
|---|---|---|
| `getGradeOptions(schoolType)` | schoolType에 따른 학년 배열 반환 | 완벽 |
| `formatGradeLabel(grade)` | 숫자 → 한국식 레이블 ("초1", "중1", "고1") | 완벽 |
| `isValidGradeForSchoolType(grade, schoolType)` | 학년이 해당 schoolType에 유효한지 검사 | 완벽 |

```typescript
// 핵심 상수
const GRADE_RANGES: Record<SchoolType, { min: number; max: number; prefix: string }> = {
  elementary: { min: 1, max: 6, prefix: '초' },
  middle: { min: 7, max: 9, prefix: '중' },
  high: { min: 10, max: 12, prefix: '고' },
}
```

**테스트**: `src/lib/utils/__tests__/grade-filter-utils.test.ts` — 12개 케이스 전체 통과

---

### 3.2 문제 관리 필터 (questions) — 완벽 구현됨

**파일**: `src/app/(dashboard)/questions/_components/questions-toolbar.tsx`

- `getGradeOptions(schoolType)` 호출하여 **동적 학년 옵션** 생성
- `formatGradeLabel(grade)` 사용하여 한국식 표기
- schoolType 변경 시 `isValidGradeForSchoolType()`로 현재 grade 유효성 검증 후 자동 초기화
- **참고 패턴**: 이 컴포넌트가 "올바른 구현"의 레퍼런스

---

### 3.3 기출문제 업로드 폼 — 버그 존재

**파일**: `src/app/(dashboard)/past-exams/upload/upload-form.tsx` (라인 123~140)

```tsx
{/* 버그: 항상 1~12 전체를 하드코딩 */}
<SelectContent>
  {Array.from({ length: 12 }, (_, i) => i + 1).map((grade) => (
    <SelectItem key={grade} value={String(grade)}>
      {grade}학년
    </SelectItem>
  ))}
</SelectContent>
```

**문제점**:
1. `Array.from({ length: 12 })` — 정적 배열 1~12 하드코딩
2. 선택한 학교(`schoolId`)의 `school_type`을 조회하지 않음
3. `grade-filter-utils.ts` 유틸 함수를 import하지 않음
4. `formatGradeLabel()` 미사용 — "1학년" 대신 "초1"이어야 함

---

### 3.4 기출문제 필터 (past-exams toolbar) — 부분적 문제

**파일**: `src/app/(dashboard)/past-exams/_components/past-exams-toolbar.tsx`

```tsx
{/* 정적 배열 사용 */}
{GRADE_OPTIONS.map((g) => (
  <SelectItem key={g} value={String(g)}>
    {g}학년
  </SelectItem>
))}
```

**상수 파일**: `src/app/(dashboard)/past-exams/_components/constants.ts`

```typescript
export const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1)
// → [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
```

**문제점**:
1. 정적 `GRADE_OPTIONS` 배열 사용 (1~12 전체)
2. 학교유형(`schoolType`) 필터 셀렉트 자체가 없음
3. `formatGradeLabel()` 미사용

**참고**: Server Action(`getQuestionList`)에는 schoolType→grade 범위 필터가 구현되어 있으나, UI에서 선택지를 제한하지 않아 UX 불일치

---

### 3.5 AI 문제 생성 — 문제 없음

**파일**: `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx`

- 학년 선택 UI 없음 (기출문제의 grade를 자동 사용)
- `generateQuestionsFromPastExam()`에서 `pastExam.grade` 직접 전달

---

### 3.6 DB 스키마 — 제약 조건 확인

**파일**: `supabase/migrations/00001_initial_schema.sql`

```sql
-- schools 테이블
school_type TEXT NOT NULL CHECK (school_type IN ('elementary', 'middle', 'high'))

-- 아래 테이블 모두 동일한 grade 제약
-- students, achievement_standards, questions, past_exam_questions, exams
grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 12)
```

- DB 레벨에서는 school_type과 grade 간 **교차 검증(cross-validation) 없음**
- 초등학교 기출문제에 grade=10 저장이 가능한 상태 (DB 레벨 방어 없음)

---

### 3.7 Zod 스키마 — 교차 검증 없음

**기출문제 업로드**: `src/lib/validations/past-exams.ts`

```typescript
export const pastExamUploadSchema = z.object({
  schoolId: z.string().uuid('학교를 선택해주세요.'),
  grade: z.coerce.number().int().min(1).max(12),
  // ... schoolId와 grade 간 교차 검증 없음
})
```

**기출문제 필터**: 같은 파일

```typescript
export const pastExamFilterSchema = z.object({
  grade: z.coerce.number().int().min(1).max(12).optional(),
  // ... schoolType 필드 자체가 없음
})
```

---

## 4. 전체 현황 요약

| 위치 | 파일 | schoolType 연동 | 동적 학년 | formatGradeLabel | 상태 |
|---|---|---|---|---|---|
| 유틸 함수 | `grade-filter-utils.ts` | - | - | - | 완벽 |
| 문제 필터 | `questions-toolbar.tsx` | 있음 | 있음 | 있음 | 완벽 |
| 기출 업로드 폼 | `upload-form.tsx` | **없음** | **없음** | **없음** | 버그 |
| 기출 필터 | `past-exams-toolbar.tsx` | **없음** | **없음** | **없음** | 부분적 |
| AI 문제 생성 | `generate-questions-dialog.tsx` | 자동 | 자동 | - | 정상 |
| DB 스키마 | `00001_initial_schema.sql` | **없음** | - | - | 개선 가능 |
| Zod 스키마 (업로드) | `past-exams.ts` | **없음** | - | - | 개선 가능 |
| Zod 스키마 (필터) | `past-exams.ts` | **없음** | - | - | 개선 가능 |
| Server Action | `questions.ts` | 있음 | - | - | 완벽 |

---

## 5. 버그 원인 분석

### 근본 원인

기출문제 업로드 폼은 **문제 관리 필터보다 먼저 구현**(Step 6)되었고,
학년 필터 유틸(`grade-filter-utils.ts`)은 **이후(Step 8-4)**에 만들어졌다.
기존 코드가 새 유틸로 업데이트되지 않은 것이 원인.

### 영향 범위

1. **UX 혼란**: 초등학교 선택 후 "10학년" 선택 가능 → 사용자 실수 유발
2. **데이터 무결성**: DB에 school_type과 불일치하는 grade 저장 가능 (방어 없음)
3. **검색 결과 왜곡**: 필터에서 1~12 전체 표시 → 불필요한 옵션 노출

---

## 6. 수정 방향 (구현 시 참고)

### 6.1 기출문제 업로드 폼 (`upload-form.tsx`)

**핵심 과제**: schoolId 선택 → schools 테이블에서 school_type 조회 → 학년 옵션 동적 변경

**고려사항**:
- 학교 목록을 이미 가져오는 로직이 있다면, school_type을 함께 조회
- schoolId 변경 시 선택된 grade가 새 school_type에 유효하지 않으면 초기화
- `getGradeOptions()` + `formatGradeLabel()` 활용
- `isValidGradeForSchoolType()`로 변경 시 검증

**참고 구현**: `questions-toolbar.tsx`의 `handleSchoolTypeChange()` 패턴

### 6.2 기출문제 필터 (`past-exams-toolbar.tsx`)

**핵심 과제**: schoolType 셀렉트 추가 → 학년 옵션 동적 연동

**고려사항**:
- 기출문제 필터에는 현재 schoolType 셀렉트가 없음 → 추가 필요
- `pastExamFilterSchema`에 schoolType 필드 추가
- `constants.ts`의 정적 `GRADE_OPTIONS` 제거 → `getGradeOptions()` 사용
- Server Action에 schoolType 기반 범위 필터 추가

### 6.3 Zod 스키마 교차 검증 (선택적 강화)

```typescript
// 가능한 접근: .superRefine()으로 schoolType-grade 교차 검증
pastExamUploadSchema.superRefine((data, ctx) => {
  // schoolId로 school_type 조회 후 grade 범위 검증
  // 단, 비동기 조회 필요 → Server Action 내부에서 처리가 더 적합
})
```

**현실적 판단**: Zod에서 비동기 DB 조회는 복잡 → Server Action 내부에서 검증이 실용적

### 6.4 DB 레벨 방어 (Phase 2+)

```sql
-- 예시: 트리거로 school_type-grade 교차 검증
-- MVP 범위 밖이므로 현재는 Server Action에서 방어
```

---

## 7. 수정 우선순위

| 순위 | 대상 | 이유 | 난이도 |
|---|---|---|---|
| 1 | 업로드 폼 (`upload-form.tsx`) | 데이터 입력 시점 — 잘못된 데이터 방지 | 중 |
| 2 | 기출 필터 (`past-exams-toolbar.tsx`) | UX 개선 — 불필요한 옵션 제거 | 중 |
| 3 | Zod 교차 검증 | 방어 계층 강화 | 하 |
| 4 | DB 트리거 | 최종 방어선 (Phase 2+) | 상 |

---

## 8. 레퍼런스 코드 (이미 올바르게 구현된 패턴)

### questions-toolbar.tsx 핵심 패턴

```tsx
// 1. state로 schoolType 관리
const [schoolType, setSchoolType] = useState<SchoolType | 'all'>('all')

// 2. schoolType 변경 시 grade 유효성 검증
function handleSchoolTypeChange(value: SchoolType | 'all') {
  setSchoolType(value)
  const currentGrade = searchParams.get('grade')
  if (currentGrade) {
    const gradeNum = parseInt(currentGrade, 10)
    if (!isValidGradeForSchoolType(gradeNum, value)) {
      params.delete('grade')  // 유효하지 않으면 초기화
    }
  }
}

// 3. 동적 옵션 생성
const gradeOptions = getGradeOptions(schoolType)

// 4. 렌더링
{gradeOptions.map((grade) => (
  <SelectItem key={grade} value={String(grade)}>
    {formatGradeLabel(grade)}
  </SelectItem>
))}
```

### upload-form.tsx에서의 차이점

업로드 폼은 **schoolId**(UUID)로 학교를 선택하므로, schoolType을 직접 선택하는 것이 아니라
**선택된 학교의 school_type을 조회**해야 한다는 점이 다르다.

가능한 접근:
1. 학교 목록 fetch 시 `school_type` 포함 → 선택 시 로컬에서 참조
2. schoolId 변경 이벤트에서 해당 학교의 school_type 추출
3. 추출한 school_type으로 `getGradeOptions()` 호출

---

## 9. 관련 파일 경로 목록

```
src/lib/utils/grade-filter-utils.ts          — 유틸 함수 (재사용 대상)
src/lib/utils/__tests__/grade-filter-utils.test.ts — 유틸 테스트

src/app/(dashboard)/past-exams/upload/upload-form.tsx  — 버그 위치 (업로드 폼)
src/app/(dashboard)/past-exams/_components/past-exams-toolbar.tsx — 부분 문제 (필터)
src/app/(dashboard)/past-exams/_components/constants.ts — 정적 GRADE_OPTIONS

src/app/(dashboard)/questions/_components/questions-toolbar.tsx — 레퍼런스 구현

src/lib/validations/past-exams.ts             — Zod 스키마 (교차 검증 없음)
src/lib/actions/past-exams.ts                 — Server Action
src/lib/actions/questions.ts                  — Server Action (schoolType 필터 있음)

supabase/migrations/00001_initial_schema.sql  — DB 스키마
```
