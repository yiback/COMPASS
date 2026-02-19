# 1-6 Step 1: Zod 필터 스키마 (TDD) 상세 계획

## 상태: ✅ 완료 (2026-02-19)

---

## 개요

`pastExamFilterSchema`를 기존 `src/lib/validations/past-exams.ts`에 추가하고, TDD 방식으로 테스트를 먼저 작성한 뒤 구현한다. 기존 `userFilterSchema` (1-5)의 패턴을 따르되, 기출문제 특유의 6개 필터 + 페이지네이션을 반영한다.

---

## 기존 코드 분석

### 재사용 패턴: `userFilterSchema` (`src/lib/validations/users.ts`)

| 패턴 | 설명 |
|------|------|
| `z.string().optional()` | 텍스트 검색 필드 (search) |
| `z.enum([...]).optional().default('all')` | 드롭다운 필터에 'all' 기본값 |
| `z.coerce.number().int().min(1).optional().default(1)` | 페이지네이션 (문자열 -> 숫자 coerce) |
| Zod 기본 `.strip()` 동작 | 스키마에 없는 필드 자동 제거 |

### 기존 `pastExamUploadSchema` (`src/lib/validations/past-exams.ts`)

- 이미 `EXAM_TYPES = ['midterm', 'final', 'mock', 'diagnostic']` 상수가 정의되어 있음
- `year`, `semester`, `grade`, `subject` 검증 로직이 업로드 스키마에 존재
- 필터 스키마는 업로드 스키마와 **같은 파일에 추가** (같은 도메인)

### DB 스키마 (`supabase/migrations/00001_initial_schema.sql`)

```sql
past_exam_questions:
  exam_type TEXT NOT NULL CHECK (exam_type IN ('midterm', 'final', 'mock', 'diagnostic'))
  year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100)
  semester INTEGER NOT NULL CHECK (semester IN (1, 2))
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 12)
  subject TEXT NOT NULL
  school_id UUID NOT NULL REFERENCES schools(id)
```

---

## 스키마 설계

### 파일: `src/lib/validations/past-exams.ts` (기존 파일 끝에 추가)

```typescript
export const pastExamFilterSchema = z.object({
  school: z.string().optional(),
  grade: z.coerce.number().int().min(1).max(12).optional(),
  subject: z.string().optional(),
  examType: z.enum(['midterm', 'final', 'mock', 'diagnostic', 'all'])
    .optional().default('all'),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  semester: z.enum(['1', '2', 'all']).optional().default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
})

export type PastExamFilterInput = z.infer<typeof pastExamFilterSchema>
```

### 설계 결정 근거

| 결정 | 근거 |
|------|------|
| `school`은 `z.string().optional()` | 학교명은 FK JOIN 후 ilike 검색. UUID가 아닌 텍스트 입력 |
| `examType`에 `'all'` 추가 | 업로드 스키마의 `EXAM_TYPES`와 달리, 필터에는 "전체" 옵션 필요 |
| `semester`를 문자열 enum | URL searchParams는 항상 문자열. `userFilterSchema`의 `isActive: z.enum(['true', 'false', 'all'])` 패턴과 동일 |
| `grade`, `year`에 `default` 없음 | 숫자 필드에 'all' 문자열을 섞는 것보다 `undefined = 전체`가 깔끔 |

---

## TDD 테스트 케이스 (17개)

### 파일: `src/lib/validations/__tests__/past-exams-filter.test.ts`

```
describe('pastExamFilterSchema')
  describe('기본값 적용')
    1. 빈 객체면 기본값 적용 (examType='all', semester='all', page=1)

  describe('school 필터')
    2. 학교명 문자열 허용 (school='한국고')
    3. 빈 문자열 허용 (school='')

  describe('grade 필터')
    4. 유효 학년 통과 (grade=10, 문자열 '3' -> 3 coerce)
    5. 범위 초과 거부 (grade=0, grade=13)
    6. 소수점 거부 (grade=1.5)

  describe('subject 필터')
    7. 과목 문자열 허용 (subject='수학')

  describe('examType 필터')
    8. 유효 시험유형 전체 순회 (it.each: 5종)
    9. 유효하지 않은 시험유형 거부 (examType='quiz')

  describe('year 필터')
    10. 유효 연도 통과 + coerce ('2024' -> 2024)
    11. 범위 초과 거부 (year=1999, year=2101)

  describe('semester 필터')
    12. 유효 학기 순회 (it.each: '1', '2', 'all')
    13. 유효하지 않은 학기 거부 (semester='3')

  describe('page 필터')
    14. 문자열 -> 숫자 coerce ('5' -> 5)
    15. 0 이하/음수/소수점 거부

  describe('복합 필터')
    16. 모든 필터 동시 적용

  describe('악의적 입력 방어')
    17. 스키마에 없는 필드 제거 (academy_id, is_admin 등)
```

---

## 구현 순서 (TDD)

### Phase 1: 테스트 작성 (RED)
1. `past-exams-filter.test.ts` 생성 (17개 테스트)
2. `npx vitest run` → FAIL 확인

### Phase 2: 스키마 구현 (GREEN)
3. `past-exams.ts` 끝에 `pastExamFilterSchema` + 타입 추가 (~15행)
4. `npx vitest run` → PASS 확인

### Phase 3: 리팩토링 (IMPROVE)
5. `z.coerce.number()` + `optional()` 빈 문자열 엣지 케이스 확인
6. 기존 업로드 스키마 테스트 회귀 확인

---

## 리스크

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| `z.coerce.number()` + `optional()`에서 빈 문자열(`''`)이 `0`으로 변환 → `min(1)` 실패 | **중간** | TDD에서 빈 문자열 케이스 테스트. 필요 시 `z.preprocess` 래핑 |
| `examType`에서 기존 `EXAM_TYPES` 상수 미사용 | **낮음** | 필터용에 'all' 필요. 코드 리뷰 시 상수 확장 여부 결정 |

---

## 파일 변경 요약

| 작업 | 파일 | 변경 내용 |
|------|------|-----------|
| 신규 | `src/lib/validations/__tests__/past-exams-filter.test.ts` | 필터 스키마 테스트 17개 |
| 수정 | `src/lib/validations/past-exams.ts` | `pastExamFilterSchema` + `PastExamFilterInput` 추가 (~15행) |

---

## 성공 기준

- [x] `npx vitest run src/lib/validations/__tests__/past-exams-filter.test.ts` — 전체 PASS (29/29)
- [x] `npx vitest run src/lib/validations/__tests__/past-exams.test.ts` — 기존 테스트 회귀 없음 (29/29)
- [x] URL searchParams 문자열 값 coerce 정상 변환
- [x] 악의적 필드 strip 제거 확인
- [x] 기존 파일 800줄 미만 유지 (112줄)

---

## 완료 요약

- **TDD 순서 준수**: RED(테스트 19개 실패) → GREEN(스키마 구현) → IMPROVE(엣지 케이스 확인)
- **테스트 29개 전부 PASS** (`it.each`로 실제 실행 수 증가)
- **빈 문자열 엣지 케이스**: `z.coerce.number('')` → `0` → `.min(1)` 실패 (에러 throw) — `z.preprocess` 불필요
- **빈칸 채우기 재구현 완료**: 사용자가 직접 스키마 작성. `'midterm'` 오타 + `z.coerce` 누락 2개를 테스트로 직접 발견·수정
- **Step 2에서 주의**: Server Action에서 URL searchParams 빈 문자열을 `undefined`로 변환하는 처리 필요

---

## 학습 리뷰 (구현 완료 후 MANDATORY)

### 핵심 개념

| 개념 | 등급 | 설명 |
|------|------|------|
| 업로드 스키마 vs 필터 스키마 차이 | 🟡 | 같은 도메인이지만 검증 목적이 다름 — 업로드는 필수+엄격, 필터는 선택+관대 |
| `z.coerce` + `optional()` 조합 | 🟡 | URL searchParams(문자열) → 숫자 변환의 엣지 케이스 이해 |
| `z.enum`에 'all' 추가 패턴 | 🟢 | 1-5 userFilterSchema에서 이미 사용한 패턴 복습 |
| strip() 악의적 필드 방어 | 🟢 | 1-5에서 학습 완료. 동일 패턴 적용 |

### 이해도 질문 (사용자 답변 대기)

1. 업로드 스키마(`pastExamUploadSchema`)에서 `grade`는 `z.coerce.number().min(1).max(12)` (필수)인데, 필터 스키마에서는 `.optional()`을 추가했다. **왜 필터에서는 optional이어야 하는가?**
2. `semester`를 업로드 스키마에서는 `z.coerce.number()` (숫자)로, 필터 스키마에서는 `z.enum(['1', '2', 'all'])` (문자열)로 정의했다. **왜 필터에서는 문자열 enum을 사용하는가?**
3. `z.coerce.number()`에 빈 문자열(`''`)을 넣으면 어떤 값으로 변환되는가? 이것이 왜 문제가 될 수 있는가?

### 직접 구현 추천 판단

- 🟡 유틸리티/검증 로직 — 재구현 권장
- 1-5에서 `userFilterSchema`를 이미 경험했으므로, 이번에는 참고하되 직접 작성하면 coerce + optional 조합을 체화할 수 있음
