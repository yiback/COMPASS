# 1-6 Step 2: Server Actions (getPastExamList, getPastExamDetail) 상세 계획

## 상태: 완료 ✅ (2026-02-19)

---

## 1. 요구사항 재진술

Step 1에서 완성한 `pastExamFilterSchema`를 사용하여, 기출문제 목록 조회(`getPastExamList`)와 상세 조회(`getPastExamDetail`) 두 Server Action을 구현한다.

핵심 요구사항:
- **목록 조회**: 6개 필터(학교명, 학년, 과목, 시험유형, 연도, 학기) + 서버사이드 페이지네이션(pageSize=10)
- **FK JOIN**: `schools!inner(name, school_type)`, `profiles!uploaded_by(name)` — 학교명, 업로드자 이름 포함
- **상세 조회**: UUID ID 기반 단건 조회 + Storage Signed URL 생성(60초 만료)
- **권한**: 인증된 사용자면 조회 가능 (student 포함). RLS가 academy_id로 자동 격리
- **빈 문자열 처리**: URL searchParams에서 빈 문자열(`''`)이 넘어오면 `undefined`로 변환 후 스키마 파싱
- **camelCase 변환**: DB snake_case 응답을 프론트엔드 camelCase 인터페이스로 변환

**기존 코드에 추가**: `src/lib/actions/past-exams.ts` (현재 125줄, `uploadPastExamAction`만 존재)

---

## 2. 구현할 함수 시그니처 (타입만)

### 2-1. 반환 타입

```typescript
// 기존 PastExamActionResult 와 별도 — 목록/상세 전용
export interface PastExamListItem {
  readonly id: string
  readonly schoolName: string        // JOIN: schools.name
  readonly schoolType: string        // JOIN: schools.school_type
  readonly year: number
  readonly semester: number
  readonly examType: string
  readonly grade: number
  readonly subject: string
  readonly extractionStatus: string
  readonly uploadedByName: string | null  // JOIN: profiles.name (nullable)
  readonly sourceImageUrl: string | null
  readonly createdAt: string
}

export interface PastExamDetail extends PastExamListItem {
  readonly signedImageUrl: string | null  // Storage Signed URL (60초)
  readonly extractedContent: string | null
}

export interface PastExamListResult {
  readonly error?: string
  readonly data?: readonly PastExamListItem[]
  readonly meta?: {
    readonly total: number
    readonly page: number
    readonly pageSize: number
  }
}

export interface PastExamDetailResult {
  readonly error?: string
  readonly data?: PastExamDetail
}
```

### 2-2. 함수 시그니처

```typescript
// 목록 조회
export async function getPastExamList(
  filters?: PastExamFilterInput
): Promise<PastExamListResult>

// 상세 조회
export async function getPastExamDetail(
  id: string
): Promise<PastExamDetailResult>
```

### 2-3. 헬퍼 함수 (내부)

```typescript
// searchParams 빈 문자열 → undefined 변환
function sanitizeFilters(
  raw: Record<string, string | undefined>
): Record<string, string | undefined>

// DB row (snake_case + FK JOIN) → PastExamListItem (camelCase)
function toPastExamListItem(dbRow: any): PastExamListItem
```

---

## 3. TDD 테스트 케이스 목록 (~18개)

테스트 파일: `src/lib/actions/__tests__/past-exams-list.test.ts` (신규)

### 3-1. getPastExamList 테스트 (13개)

```
describe('getPastExamList')

  describe('인증')
    1. 비인증 사용자 → 에러 '인증이 필요합니다.'
    2. 프로필 없음 → 에러 '프로필을 찾을 수 없습니다.'
    3. academy_id 없음 → 에러 '소속 학원이 없습니다.'

  describe('기본 조회')
    4. 필터 없이 호출 → 목록 + meta(total, page=1, pageSize=10) 반환
    5. 데이터 없으면 빈 배열 + meta.total=0

  describe('필터 적용')
    6. school 필터 → ilike 호출 확인 (schools 테이블의 name 필터링)
    7. grade 필터 → eq('grade', N) 호출 확인
    8. examType 필터 ('midterm') → eq('exam_type', 'midterm') 호출 확인
    9. examType='all' → eq 호출 안 함 확인
    10. 복합 필터 (grade + examType + year) → 여러 eq 호출 확인

  describe('페이지네이션')
    11. page=2 → range(10, 19) 호출 확인

  describe('빈 문자열 처리')
    12. school='' → ilike 호출 안 함 확인 (undefined 변환)

  describe('snake_case → camelCase 변환')
    13. DB 응답의 schools.name → schoolName, profiles.name → uploadedByName 변환 확인
```

### 3-2. getPastExamDetail 테스트 (5개)

```
describe('getPastExamDetail')

  describe('인증')
    14. 비인증 사용자 → 에러

  describe('조회')
    15. 유효 ID → 상세 데이터 + signedImageUrl 반환
    16. 존재하지 않는 ID → 에러 '기출문제를 찾을 수 없습니다.'
    17. source_image_url 없으면 signedImageUrl = null

  describe('Signed URL')
    18. createSignedUrl 호출 확인 (path, 60초 만료)
```

**총 18개 테스트** (기존 9개 upload 테스트는 별도 파일에 유지)

---

## 4. Supabase 쿼리 패턴

### 4-1. 목록 조회 쿼리

```typescript
supabase
  .from('past_exam_questions')
  .select(`
    id, year, semester, exam_type, grade, subject,
    source_image_url, extraction_status, created_at,
    schools!inner ( name, school_type ),
    profiles!uploaded_by ( name )
  `, { count: 'exact' })
  .order('created_at', { ascending: false })
  .range(from, to)
```

**FK JOIN 설명**:
- `schools!inner ( name, school_type )`: `past_exam_questions.school_id` FK로 `schools` 테이블 INNER JOIN. 학교가 삭제되면 기출문제도 안 보임 (합리적)
- `profiles!uploaded_by ( name )`: `past_exam_questions.uploaded_by` FK로 `profiles` 테이블 LEFT JOIN. `uploaded_by`가 nullable이므로 LEFT JOIN 기본 적용

**반환 형태** (PostgREST):
```json
{
  "id": "uuid",
  "year": 2024,
  "schools": { "name": "한국고등학교", "school_type": "high" },
  "profiles": { "name": "김교사" }
}
```

### 4-2. 필터 적용 패턴

```typescript
// 학교명 검색 — FK 관계 필터링 (PostgREST 지원)
if (school) {
  query = query.ilike('schools.name', `%${school}%`)
}

// 학년 (직접 컬럼)
if (grade) {
  query = query.eq('grade', grade)
}

// 과목 (직접 컬럼, 부분 검색)
if (subject) {
  query = query.ilike('subject', `%${subject}%`)
}

// 시험유형 ('all'이면 필터 안 함)
if (examType && examType !== 'all') {
  query = query.eq('exam_type', examType)
}

// 연도 (직접 컬럼)
if (year) {
  query = query.eq('year', year)
}

// 학기 ('all'이면 필터 안 함)
if (semester && semester !== 'all') {
  query = query.eq('semester', Number(semester))
}
```

### 4-3. 페이지네이션

```typescript
const pageSize = 10
const from = (page - 1) * pageSize
const to = from + pageSize - 1
// query.range(from, to) + { count: 'exact' }
```

### 4-4. 상세 조회 쿼리

```typescript
supabase
  .from('past_exam_questions')
  .select(`
    id, year, semester, exam_type, grade, subject,
    source_image_url, extracted_content, extraction_status, created_at,
    schools!inner ( name, school_type ),
    profiles!uploaded_by ( name )
  `)
  .eq('id', id)
  .single()
```

---

## 5. Signed URL 생성 전략

### 생성 시점
- **상세 조회(`getPastExamDetail`) 시에만** Signed URL 생성
- 목록 조회에서는 Signed URL 불필요 (이미지 미리보기는 Sheet에서만)

### 구현 방식
```typescript
// source_image_url이 있으면 Signed URL 생성
if (row.source_image_url) {
  const { data: signedData } = await supabase.storage
    .from('past-exams')
    .createSignedUrl(row.source_image_url, 60) // 60초 만료
  signedImageUrl = signedData?.signedUrl ?? null
}
```

### 주의사항
- **서버 클라이언트 사용**: `createClient()` (anon key + RLS 적용)
- `source_image_url` 값은 Storage 경로 (예: `academy-id/school-id/2024-1-midterm/file.jpg`)
- 목록 조회에서 `sourceImageUrl` 필드는 경로만 반환 (Signed URL 아님)

---

## 6. searchParams 빈 문자열 처리

### 문제
URL `?school=&grade=&examType=all`에서 `school`과 `grade`가 빈 문자열(`''`)로 전달됨.

- `z.string().optional()`에 `''` 전달 → 빈 문자열 통과 (의도하지 않은 필터링)
- `z.coerce.number()`에 `''` 전달 → `0`으로 변환 → `.min(1)` 실패 → **Zod 에러 throw** (Step 1 학습 교훈)

### 해결: sanitizeFilters 헬퍼 함수

**변환 위치**: Server Action 내부, Zod 파싱 **전에** 실행

```typescript
function sanitizeFilters(
  raw: Record<string, string | undefined>
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      value === '' ? undefined : value,
    ])
  )
}
```

**호출 순서**:
1. page.tsx에서 `searchParams` 전달 → `getPastExamList(rawFilters)`
2. `sanitizeFilters(rawFilters)` → 빈 문자열 제거
3. `pastExamFilterSchema.safeParse(sanitized)` → 안전한 파싱

### 대안 검토 (채택하지 않음)
- `z.preprocess`: 스키마 자체를 복잡하게 만듦. Step 1에서 결정한 "스키마는 깔끔하게, 전처리는 Action에서" 원칙에 반함
- page.tsx에서 전처리: Server Component에서 하면 Action 단독 호출 시 방어 안 됨

---

## 7. 기존 코드 재사용 계획

### `users.ts`에서 가져올 패턴

| 패턴 | users.ts 위치 | past-exams.ts 적용 |
|------|-------------|-------------------|
| `getCurrentUserProfile()` 헬퍼 | 64-100줄 | **동일 구조 복사** (인증+프로필+academy_id 확인) |
| `safeParse` + 기본값 처리 | 131-139줄 | `pastExamFilterSchema.safeParse(sanitized ?? {})` |
| 페이지네이션 계산 | 137-139줄 | `from = (page-1) * pageSize`, `to = from + pageSize - 1` |
| `let query = supabase...` 체이닝 | 154-178줄 | 동일 패턴. 단, FK JOIN SELECT 문자열 다름 |
| `toUserProfile()` 변환 | 106-117줄 | `toPastExamListItem()` — FK JOIN 결과 추가 변환 필요 |
| 에러 핸들링 + try/catch | 180-199줄 | 동일 구조 |

### `past-exams.ts` 기존 코드와의 관계

- 기존 `uploadPastExamAction`은 **formData 기반** Server Action (useActionState용)
- 신규 `getPastExamList`/`getPastExamDetail`은 **일반 async 함수** (Server Component에서 직접 호출)
- 같은 파일에 추가 (같은 도메인). `'use server'` 이미 선언됨
- 기존 import는 유지. `pastExamFilterSchema`, `PastExamFilterInput` import 추가

### 테스트 파일 분리 결정

**별도 파일 생성**: `past-exams-list.test.ts`

이유:
- 기존 upload 테스트가 `vi.mock` + dynamic import (`mockResolvedValue` 비동기 반환) 사용
- 신규 테스트는 `users.test.ts` 패턴 (동기 반환)이 더 깔끔
- 같은 파일에서 두 패턴 혼합은 복잡도 증가

---

## 8. 구현 순서 (TDD)

### Phase 1: 테스트 작성 (RED)

**파일**: `src/lib/actions/__tests__/past-exams-list.test.ts` (신규)

1. Mock 설정 (Supabase 서버 클라이언트 + Storage)
2. `getPastExamList` 테스트 13개 작성
3. `getPastExamDetail` 테스트 5개 작성
4. `npx vitest run src/lib/actions/__tests__/past-exams-list.test.ts` → 전체 FAIL 확인

### Phase 2: 타입 + 헬퍼 구현 (GREEN - 부분)

**파일**: `src/lib/actions/past-exams.ts`

5. 타입 정의 추가 (`PastExamListItem`, `PastExamDetail`, `PastExamListResult`, `PastExamDetailResult`)
6. `sanitizeFilters()` 헬퍼 추가
7. `toPastExamListItem()` 변환 함수 추가
8. `npx vitest run` → 여전히 FAIL (함수 미구현)

### Phase 3: getPastExamList 구현 (GREEN)

9. `getCurrentUserProfile()` 헬퍼 추가 (users.ts에서 복사)
10. `getPastExamList()` 구현 (필터 + 페이지네이션 + FK JOIN)
11. `npx vitest run` → getPastExamList 테스트 PASS 확인

### Phase 4: getPastExamDetail 구현 (GREEN)

12. `getPastExamDetail()` 구현 (UUID 검증 + 단건 조회 + Signed URL)
13. `npx vitest run` → 전체 PASS 확인

### Phase 5: 리팩토링 (IMPROVE)

14. `getCurrentUserProfile()` 중복 제거 검토 (3회 반복 규칙 — 아직 2회이므로 복사 유지)
15. 기존 upload 테스트 회귀 확인: `npx vitest run src/lib/actions/__tests__/past-exams.test.ts`
16. 파일 크기 확인 (800줄 미만)

---

## 9. Mock 구조 설계

### Supabase 서버 클라이언트 Mock (`users.test.ts` 패턴)

```typescript
const mockSupabaseClient = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
  storage: {
    from: vi.fn().mockReturnValue({
      createSignedUrl: vi.fn(),
    }),
  },
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}))
```

### FK JOIN 쿼리 결과 Mock

```typescript
function mockPastExamListQuery(items: any[], count: number) {
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((resolve) =>
      resolve({ data: items, error: null, count })
    ),
  }
}
```

### FK JOIN DB 응답 Mock 데이터

```typescript
const mockDbRow = {
  id: 'exam-uuid-1',
  year: 2024,
  semester: 1,
  exam_type: 'midterm',
  grade: 10,
  subject: '수학',
  source_image_url: 'academy/school/2024-1-midterm/file.jpg',
  extraction_status: 'pending',
  created_at: '2024-01-15T00:00:00Z',
  schools: { name: '한국고등학교', school_type: 'high' },
  profiles: { name: '김교사' },
}
```

---

## 10. getCurrentUserProfile 중복 문제

### 현재 상태
- `users.ts` 64-100줄에 `getCurrentUserProfile()` 존재 (private — export 안 됨)
- `past-exams.ts`에도 동일 로직 필요

### 선택지

| 방안 | 장점 | 단점 |
|------|------|------|
| A. 복사 | 단순, 독립적 | 코드 중복 |
| B. 공통 모듈 추출 (`src/lib/actions/helpers.ts`) | DRY | 리팩토링 범위 확대 |

### 결정: **방안 A (복사)** — 이유:
1. Step 2 범위를 최소화 (MVP 원칙)
2. 함수가 짧음 (~35줄)
3. 향후 1-7, 1-8에서 패턴이 더 반복되면 그때 공통 모듈 추출 (3회 반복 규칙)
4. users.ts에서 export하면 기존 테스트에 영향 줄 수 있음

---

## 11. 권한 모델 분석

### past_exam_questions SELECT RLS

```sql
CREATE POLICY "past_exams_select_same_academy"
  ON past_exam_questions FOR SELECT
  USING (academy_id = get_user_academy_id());
```

- **모든 역할 허용** (student 포함) — `has_any_role` 없음
- `academy_id` 기반 격리만 적용
- 따라서 Server Action에서 **역할 체크 불필요** — 인증 + 프로필(academy_id 존재) 확인만

### schools SELECT RLS

```sql
CREATE POLICY "schools_select_authenticated"
  ON schools FOR SELECT
  USING (auth.uid() IS NOT NULL);
```

- 인증된 사용자면 모든 학교 조회 가능 (공개 데이터)
- `schools!inner` JOIN 시 RLS 충돌 없음

### profiles SELECT RLS

```sql
CREATE POLICY "profiles_select_same_academy"
  ON profiles FOR SELECT
  USING (
    academy_id = get_user_academy_id()
    OR id = auth.uid()
  );
```

- 같은 학원 프로필만 조회 가능
- `profiles!uploaded_by` LEFT JOIN 시: 업로더가 같은 학원이면 이름 보임, 다른 학원이면 null

---

## 12. 리스크 및 주의사항

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| FK 관계 필터 (`schools.name` ilike) 미지원 가능성 | **중간** | PostgREST 공식 문서에서 관계 필터 지원 확인됨 (`table.column` 형식). 실패 시 2단계 쿼리 대안: 먼저 학교 검색 → school_id 배열 → `in('school_id', ids)` |
| Supabase placeholder 타입 (`as any`) | **낮음** | 기존 패턴과 동일하게 `eslint-disable` 사용. `supabase gen types`는 별도 작업 |
| Storage Signed URL 권한 | **낮음** | 서버 클라이언트(anon key)로 Signed URL 생성 가능 |
| 기존 upload 테스트 Mock 충돌 | **낮음** | 별도 테스트 파일로 분리하여 해결 |
| `profiles!uploaded_by` LEFT JOIN 시 profiles가 null인 경우 | **낮음** | `uploaded_by`가 nullable이므로 `profiles`가 `null`일 수 있음. `toPastExamListItem`에서 null 체크 |
| `semester` 타입 불일치: 스키마는 문자열 enum('1', '2', 'all'), DB는 숫자 | **중간** | 필터 적용 시 `Number(semester)` 변환 필요. 테스트에서 명시적 확인 |

---

## 13. 예상 복잡도

| 항목 | 복잡도 | 예상 줄 수 |
|------|--------|-----------|
| 타입 정의 (4개 인터페이스) | 낮음 | ~40줄 |
| `sanitizeFilters` 헬퍼 | 낮음 | ~10줄 |
| `toPastExamListItem` 변환 | 낮음 | ~20줄 |
| `getCurrentUserProfile` 복사 | 낮음 | ~35줄 |
| `getPastExamList` 구현 | **중간** | ~60줄 |
| `getPastExamDetail` 구현 | **중간** | ~45줄 |
| 테스트 (18개) | **중간** | ~250줄 |

**past-exams.ts 예상 최종 줄 수**: 125(기존) + ~170(추가) = ~295줄 (800줄 한도 이내)

---

## 14. 파일 변경 요약

| 작업 | 파일 | 변경 내용 |
|------|------|-----------|
| 수정 | `src/lib/actions/past-exams.ts` | 타입 4개 + 헬퍼 3개 + Action 2개 추가 (~170줄) |
| 신규 | `src/lib/actions/__tests__/past-exams-list.test.ts` | 조회 테스트 18개 (~250줄) |

**총: 1개 수정 + 1개 생성 = 2개 파일**

---

## 15. 성공 기준

- [x] `npx vitest run src/lib/actions/__tests__/past-exams-list.test.ts` — 18개 PASS
- [x] `npx vitest run src/lib/actions/__tests__/past-exams.test.ts` — 기존 9개 회귀 없음
- [x] FK JOIN 결과 camelCase 변환 정상 동작
- [x] 빈 문자열 → undefined 변환 정상 동작
- [x] Signed URL 생성 로직 테스트 통과
- [x] `past-exams.ts` 800줄 미만 유지 (403줄)
- [x] 타입 불변성 (`readonly`) 적용

---

## 16. 학습 리뷰 포인트 (구현 완료 후)

| 개념 | 등급 | 설명 |
|------|------|------|
| Supabase FK JOIN (`schools!inner`, `profiles!uploaded_by`) | 🔴 | 새 패턴. PostgREST 관계 쿼리 문법, INNER vs LEFT JOIN 차이 이해 필수 |
| Signed URL (Storage 보안) | 🔴 | 만료 시간, 생성 시점, 서버/클라이언트 key 차이 |
| sanitizeFilters 전처리 패턴 | 🟡 | URL searchParams의 한계(문자열만), Zod 파싱 전 전처리 위치 판단 |
| camelCase 변환 + FK JOIN 중첩 객체 | 🟢 | users.ts의 `toUserProfile` 확장 (FK JOIN 객체에서 값 추출) |
