# 1-6 기출문제 조회 [F006] 구현 계획

> **진행률**: 5/5 Steps 완료 (100%)
> **마지막 업데이트**: 2026-02-19
> **상태**: ✅ 완료

| Step | 내용 | 상태 |
|------|------|------|
| Step 1 | Zod 필터 스키마 (TDD) | ✅ 완료 |
| Step 2 | Server Actions (getPastExamList, getPastExamDetail) | ✅ 완료 |
| Step 3 | DataTable UI (columns, toolbar, detail-sheet) | ✅ 완료 |
| Step 4 | 서버사이드 페이지네이션 UI | ✅ 완료 |
| Step 5 | 빌드 검증 + 학습 리뷰 | ✅ 완료 |

---

## Context

1-2에서 기출문제 업로드 기능이 완성되었으나, 업로드된 기출문제를 **조회·검색하는 UI가 없음** (placeholder 상태). DataTable로 기출문제 목록을 보고, 상세 Sheet에서 이미지 미리보기를 제공하는 기능을 구현한다.

1-5 사용자 관리에서 완성된 **Server Component + searchParams + DataTable** 패턴을 재사용하되, 기출문제 특유의 **다중 필터(6개)**, **FK JOIN(학교명/업로드자)**, **Signed URL(이미지 미리보기)** 을 추가한다.

---

## MVP 범위

| 포함 | 제외 (후순위) |
|------|-------------|
| DataTable 목록 (서버사이드 페이지네이션) | 기출문제 수정/삭제 |
| 6개 필터 (학교명, 학년, 과목, 시험유형, 연도, 학기) | 성취기준 매핑 UI |
| 학교명·업로드자 JOIN 표시 | OCR 추출 결과 표시 |
| 상세 Sheet + 이미지 미리보기 (Signed URL) | 별도 상세 페이지 |
| 업로드 버튼 (교사/관리자만) | 일괄 다운로드 |

---

## Step 1: Zod 필터 스키마 (TDD) ✅ 완료 (2026-02-19)

### 수정 파일
- `src/lib/validations/past-exams.ts` — `pastExamFilterSchema` 추가

### 새로 생성
- `src/lib/validations/__tests__/past-exams-filter.test.ts`

### 스키마 설계

```typescript
export const pastExamFilterSchema = z.object({
  school: z.string().optional(),                    // 학교명 텍스트 검색
  grade: z.coerce.number().int().min(1).max(12).optional(),
  subject: z.string().optional(),                   // 과목 텍스트 검색
  examType: z.enum(['midterm', 'final', 'mock', 'diagnostic', 'all']).optional().default('all'),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  semester: z.enum(['1', '2', 'all']).optional().default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
})
```

### TDD 테스트 (~10개)
- 기본값 검증 (page=1, examType='all', semester='all')
- 유효 필터 (grade=10, year=2024)
- 범위 초과 (grade=13, year=1999)
- coerce 변환 ('3' -> 3)

---

## Step 2: Server Actions (TDD) ✅ 완료 (2026-02-19)

### 수정 파일
- `src/lib/actions/past-exams.ts` — `getPastExamList()`, `getPastExamDetail()` 추가 (미커밋 빈칸 채우기 상태)

### 새로 생성
- `src/lib/actions/__tests__/past-exams-list.test.ts` — 조회 테스트 18개 (past-exams.test.ts와 별도 파일)

### 타입 정의

```typescript
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
  readonly uploadedByName: string | null  // JOIN: profiles.name
  readonly sourceImageUrl: string | null
  readonly createdAt: string
}
```

### getPastExamList(filters?)

핵심 쿼리 (Supabase FK JOIN):
```typescript
supabase
  .from('past_exam_questions')
  .select(`
    id, year, semester, exam_type, grade, subject,
    source_image_url, extraction_status, created_at,
    schools!inner ( name, school_type ),
    profiles!uploaded_by ( name )
  `, { count: 'exact' })
```

- `schools!inner`: school_id FK → INNER JOIN
- `profiles!uploaded_by`: uploaded_by FK → LEFT JOIN (nullable)
- 필터: school(학교명 ilike) / grade(eq) / subject(ilike) / examType(eq) / year(eq) / semester(eq)
- 페이지네이션: `range(from, to)`, pageSize=10
- 정렬: `created_at DESC`

### getPastExamDetail(id)

- UUID 검증 → 같은 JOIN 쿼리 + `.eq('id', id).single()`
- Signed URL 생성: `supabase.storage.from('past-exams').createSignedUrl(path, 60)`
- **서버 클라이언트 사용** (SELECT RLS에 `has_any_role()` 미사용 → anon key OK)

### TDD 테스트 (~15개)
- 인증 안 됨 → 에러
- 기본 조회 → 목록 + meta
- 학교명 검색 → ilike 필터
- 복합 필터 (학년 + 시험유형)
- 페이지네이션 → range 호출 확인
- 상세 조회 → signedImageUrl 포함
- 존재하지 않는 ID → 에러

---

## Step 3: DataTable UI ✅ 완료 (2026-02-19)

**완료 요약**: constants.ts(UI상수) + past-exams-toolbar.tsx(6필터) + past-exam-detail-sheet.tsx(상세Sheet+SignedURL) + past-exam-columns.tsx(9컬럼) + page.tsx(Server Component) — 5개 파일 ~500줄. 학습 리뷰: useEffect race condition `let cancelled = false` 패턴 (🟡 빈칸채우기 완료).

### 새로 생성 (4개 — constants.ts 포함)
- `src/app/(dashboard)/past-exams/_components/past-exam-columns.tsx`
- `src/app/(dashboard)/past-exams/_components/past-exams-toolbar.tsx`
- `src/app/(dashboard)/past-exams/_components/past-exam-detail-sheet.tsx`

### 수정 (1개)
- `src/app/(dashboard)/past-exams/page.tsx` — placeholder → DataTable 목록

### past-exam-columns.tsx

정적 배열 (조회 전용, 팩토리 불필요):

| 컬럼 | 표시 | 비고 |
|------|------|------|
| schoolName | 학교 | JOIN |
| grade | 학년 | `N학년` 포맷 |
| subject | 과목 | |
| examType | 시험유형 | Badge (중간/기말/모의/진단) |
| yearSemester | 연도/학기 | `2024년 1학기` 포맷 |
| extractionStatus | 상태 | Badge (대기/처리중/완료/실패) |
| uploadedByName | 업로드 | JOIN, null → '-' |
| createdAt | 등록일 | ko-KR 날짜 |
| actions | 상세 | Sheet 열기 버튼 |

### past-exams-toolbar.tsx

패턴: `users-toolbar.tsx` 재사용 (URL searchParams + debounce)

```
[학교명 검색...] [과목 검색...] [학년 v] [시험유형 v] [연도 v] [학기 v]
```

- 텍스트 입력 2개: 학교명, 과목 (debounce 300ms)
- Select 4개: 학년(1~12+전체), 시험유형(4종+전체), 연도(최근5년+전체), 학기(1/2+전체)
- 필터 변경 시 `page` 파라미터 초기화
- 레이아웃: `flex flex-wrap gap-2`

### past-exam-detail-sheet.tsx

패턴: `user-detail-sheet.tsx` 재사용 (단순화 — 액션 버튼 없음)

- Sheet 열릴 때 `getPastExamDetail(id)` 호출 → Signed URL 획득
- 메타데이터 표시 (InfoRow 패턴)
- 이미지 미리보기: `<img>` 태그 (Signed URL, 60초 만료)
- 액션 버튼 없음 (조회 전용)

### page.tsx

패턴: `admin/users/page.tsx` 재사용

```typescript
export default async function PastExamsPage({ searchParams }) {
  const params = await searchParams
  const result = await getPastExamList({ ... })
  // callerRole 조회 (업로드 버튼 표시용)
  return (
    <div>
      <h1>기출문제</h1>
      <p>총 {total}건</p>
      {isTeacherOrAbove && <Link href="/past-exams/upload">업로드</Link>}
      <DataTable columns={pastExamColumns} data={exams} toolbar={<Toolbar />} />
    </div>
  )
}
```

---

## Step 4: 서버사이드 페이지네이션 UI ✅ 완료 (2026-02-19)

**완료 요약**: `DataTableServerPagination` 공용 컴포넌트 신규 생성 (~100줄). URL searchParams 기반 페이지 전환, 기존 필터 보존, 1페이지 이하 시 미렌더링. `basePath` prop 제거 → `usePathname()`으로 동적 처리.

### 새로 생성 (1개)
- `src/components/data-table/data-table-server-pagination.tsx`

### 수정 (2개)
- `src/components/data-table/index.ts` — export 추가
- `src/app/(dashboard)/past-exams/page.tsx` — 컴포넌트 배치

### 설계 결정
- `useRouter` + `useSearchParams` + `usePathname` (toolbar과 동일 패턴)
- `page=1`이면 URL에서 `page` 파라미터 삭제 (기본값 생략 관례)
- `pageSize=10` 고정 ("페이지당 행" Select 제외)
- 기존 `DataTablePagination`과 동일한 4버튼 UI (첫/이전/다음/마지막)

---

## Step 5: 빌드 검증 + 학습 리뷰 ✅ 완료 (2026-02-19)

**완료 요약**: 347 tests PASS, lint 에러 0개, Next.js 빌드 성공. 학습 리뷰 이해도 질문 8개 완료. 빌드 수정 2건 (eslint-disable 위치 조정만, 기능 변경 없음).

```bash
npx vitest run                     # 전체 테스트 — 347 PASS ✅
npm run lint                       # lint 에러 0개 ✅
npm run build                      # 빌드 성공 ✅
```

### 학습 리뷰 포인트

| 개념 | 등급 | 설명 |
|------|------|------|
| Supabase FK JOIN (`schools!inner`, `profiles!uploaded_by`) | 🔴 | 새 패턴 — 반드시 이해 |
| Signed URL (Storage 보안) | 🔴 | 만료시간 제어, 생성 시점 |
| 다중 필터 URL 상태 관리 | 🟡 | 6개 필터 조합 |
| 서버사이드 페이지네이션 | 🟡 | 기존에 없던 패턴 |

---

## 파일 변경 요약

### 수정 (4개)
| 파일 | 변경 |
|------|------|
| `src/lib/validations/past-exams.ts` | `pastExamFilterSchema` 추가 |
| `src/lib/actions/past-exams.ts` | `getPastExamList()`, `getPastExamDetail()` + 타입 |
| `src/app/(dashboard)/past-exams/page.tsx` | placeholder → DataTable + ServerPagination |
| `src/components/data-table/index.ts` | `DataTableServerPagination` export 추가 |

### 새로 생성 (6개)
| 파일 | 설명 |
|------|------|
| `src/lib/validations/__tests__/past-exams-filter.test.ts` | 필터 스키마 테스트 |
| `src/app/(dashboard)/past-exams/_components/constants.ts` | UI 상수 (Badge 매핑) |
| `src/app/(dashboard)/past-exams/_components/past-exam-columns.tsx` | 컬럼 정의 |
| `src/app/(dashboard)/past-exams/_components/past-exams-toolbar.tsx` | 필터 툴바 |
| `src/app/(dashboard)/past-exams/_components/past-exam-detail-sheet.tsx` | 상세 Sheet |
| `src/components/data-table/data-table-server-pagination.tsx` | 서버 페이지네이션 |

### 새로 생성 테스트 (1개)
| 파일 | 변경 |
|------|------|
| `src/lib/actions/__tests__/past-exams-list.test.ts` | 조회 테스트 18개 (신규 파일) |

> ⚠️ `past-exams.ts` — Step 2 완료 커밋 후 빈칸 채우기 형태로 수정됨 (미커밋 상태)

**총: 4개 수정 + 7개 생성 = 11개 파일**

---

## 재사용 패턴 참조

| 재사용 대상 | 출처 파일 |
|------------|----------|
| Server Component + searchParams | `src/app/(dashboard)/admin/users/page.tsx` |
| Server Action 페이지네이션 | `src/lib/actions/users.ts` |
| URL searchParams 필터 | `src/app/(dashboard)/admin/users/_components/users-toolbar.tsx` |
| DataTable 컴포넌트 | `src/components/data-table/data-table.tsx` |
| Sheet 상세 보기 | `src/app/(dashboard)/admin/users/_components/user-detail-sheet.tsx` |
| Badge 상수 매핑 | `src/app/(dashboard)/admin/users/_components/user-columns.tsx` |
| Zod 필터 패턴 | `src/lib/validations/past-exams.ts` (기존) |

---

## 리스크

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| Supabase FK JOIN 관계 필터 (`schools.name` ilike) | 중간 | PostgREST 관계 필터 지원됨. 실패 시 2단계 쿼리 대안 |
| Signed URL 만료 (60초) | 낮음 | Sheet 열 때마다 새로 생성 |
| 필터 6개 모바일 UX | 낮음 | `flex-wrap`으로 자연스럽게 줄 바꿈 |

---

## 검증 방법

1. `npx vitest run src/lib/validations/__tests__/past-exams-filter.test.ts` — 스키마 테스트
2. `npx vitest run src/lib/actions/__tests__/past-exams.test.ts` — Server Action 테스트
3. `npm run build` — 빌드 성공
4. 수동: `/past-exams` 접속 → DataTable 렌더링 확인
5. 수동: 필터 조합 → URL 파라미터 변경 + 데이터 갱신 확인
6. 수동: 행 클릭 → Sheet 열림 + 이미지 미리보기 확인
