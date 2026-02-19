# 1-6 Step 3: DataTable UI 구현 계획

> **상위 계획**: `docs/plan/phase-1-step6-past-exam-list.md` Step 3 섹션
> **선행 완료**: Step 1 (Zod 필터 스키마), Step 2 (Server Actions)
> **작성일**: 2026-02-19
> **상태**: ✅ 완료 (2026-02-19)
> **완료 요약**: 5개 파일 ~500줄 구현. constants.ts, toolbar(6필터), detail-sheet(SignedURL+race condition방지), columns(9개정적배열), page.tsx(Server Component+업로드버튼). 학습: useEffect `let cancelled = false` 빈칸채우기 완료.

---

## 1. 요구사항 재정의

### 목표
기출문제 목록을 DataTable로 렌더링하고, 6개 필터(학교명, 과목, 학년, 시험유형, 연도, 학기)로 검색하며, 행 클릭 시 Sheet에서 상세 정보 + 이미지 미리보기를 제공한다.

### 범위 (Step 3만)
| 포함 | 제외 (Step 4~5 또는 후순위) |
|------|---------------------------|
| DataTable 컬럼 정의 | 서버사이드 페이지네이션 UI (Step 4) |
| 6개 필터 Toolbar (URL searchParams) | 기출문제 수정/삭제 |
| 상세 Sheet + Signed URL 이미지 미리보기 | 빌드 검증 (Step 5) |
| page.tsx Server Component 구현 | 성취기준 매핑 UI |
| 교사/관리자용 업로드 버튼 | 일괄 다운로드 |

### 페이지네이션 전략 (Step 3)
Step 3에서는 `DataTable`의 기본 클라이언트 pagination을 **비활성화**한다 (`showPagination={false}`).
서버가 10건만 반환하므로 기본 pagination은 "1/1 페이지"로 보이는 문제가 있다.
Step 4에서 URL searchParams 기반 서버사이드 페이지네이션 컴포넌트를 별도 구현하여 교체한다.

---

## 2. 파일별 상세 설계

### 2-1. 상수 파일 (신규)

**파일**: `src/app/(dashboard)/past-exams/_components/constants.ts`

**역할**: 기출문제 UI에서 사용하는 한국어 레이블 매핑 상수. 컬럼(Badge), Toolbar(Select 옵션), 상세 Sheet에서 공통 사용.

**이유**: `upload-form.tsx`에 `EXAM_TYPE_LABELS`가 이미 있지만, 업로드 폼에서 import하면 의존 방향이 역전된다. 조회 UI 전용 상수 파일로 분리하고, 추가 상수(EXTRACTION_STATUS, GRADE_OPTIONS 등)도 함께 정의한다. 향후 upload-form의 상수도 이 파일로 통합 가능.

**내용**:
```typescript
// 시험유형 한국어 레이블
export const EXAM_TYPE_LABELS: Record<string, string> = {
  midterm: '중간고사',
  final: '기말고사',
  mock: '모의고사',
  diagnostic: '진단평가',
}

// 시험유형 Badge variant
export const EXAM_TYPE_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  midterm: 'default',
  final: 'secondary',
  mock: 'outline',
  diagnostic: 'destructive',
}

// 추출 상태 한국어 레이블 + Badge variant
export const EXTRACTION_STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
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
```

**참조 패턴**: `src/app/(dashboard)/admin/users/_components/user-columns.tsx`의 `ROLE_MAP`, `ROLE_BADGE_VARIANT`, `STATUS_BADGE`

---

### 2-2. 컬럼 정의 (신규)

**파일**: `src/app/(dashboard)/past-exams/_components/past-exam-columns.tsx`

**역할**: `PastExamListItem` 타입의 DataTable 컬럼 정의. 기출문제는 조회 전용이므로 정적 배열(팩토리 함수 불필요).

**`'use client'` 필요**: DataTable이 클라이언트 컴포넌트이므로 컬럼 정의 파일도 'use client' 필요.

**참조 패턴**: `src/app/(dashboard)/admin/users/_components/user-columns.tsx`

**주요 시그니처**:
```typescript
'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { PastExamListItem } from '@/lib/actions/past-exams'

export const pastExamColumns: ColumnDef<PastExamListItem>[]
```

**컬럼 정의 (9개)**:

| # | accessorKey / id | 헤더 | cell 렌더링 | DataTableColumnHeader 사용 |
|---|-----------------|------|------------|--------------------------|
| 1 | `schoolName` | 학교 | 텍스트 그대로 | O (정렬 가능) |
| 2 | `grade` | 학년 | `${grade}학년` 포맷 | X (정렬 불필요) |
| 3 | `subject` | 과목 | 텍스트 그대로 | O (정렬 가능) |
| 4 | `examType` | 시험유형 | `Badge` + `EXAM_TYPE_LABELS`/`EXAM_TYPE_BADGE_VARIANT` | X |
| 5 | (가상) `yearSemester` | 연도/학기 | `${year}년 ${semester}학기` 포맷 — accessorFn 사용 | X |
| 6 | `extractionStatus` | 상태 | `Badge` + `EXTRACTION_STATUS_MAP` | X |
| 7 | `uploadedByName` | 업로드 | `uploadedByName ?? '—'` | X |
| 8 | `createdAt` | 등록일 | `toLocaleDateString('ko-KR')` | O (정렬 가능) |
| 9 | (id) `actions` | (빈 헤더) | "상세" 버튼 → Sheet 열기 | X |

**actions 컬럼 설계**:

```typescript
{
  id: 'actions',
  cell: function ActionsCell({ row }) {
    const [sheetOpen, setSheetOpen] = useState(false)
    const exam = row.original

    return (
      <>
        <Button variant="ghost" size="sm" onClick={() => setSheetOpen(true)}>
          <Eye className="mr-1 h-4 w-4" />
          상세
        </Button>
        <PastExamDetailSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          examId={exam.id}
        />
      </>
    )
  },
}
```

**설계 결정**:
- **정적 배열 vs 팩토리 함수**: 정적 배열 선택. 기출문제는 권한별 컬럼 분기가 없음 (모든 인증된 사용자가 동일한 컬럼 확인). `user-columns.tsx`와 달리 DropdownMenu/역할변경/비활성화 같은 관리 액션이 없음.
- **상세 버튼 vs DropdownMenu**: DropdownMenu 대신 단일 "상세" 버튼. 사용 가능한 액션이 "상세보기" 하나뿐이므로 DropdownMenu는 과도함.
- **yearSemester 가상 컬럼**: `accessorFn: (row) => \`${row.year}년 ${row.semester}학기\`` — year와 semester를 합쳐서 표시. 정렬은 불필요 (서버에서 created_at DESC 정렬).

---

### 2-3. 필터 Toolbar (신규)

**파일**: `src/app/(dashboard)/past-exams/_components/past-exams-toolbar.tsx`

**역할**: 6개 필터를 URL searchParams로 관리하는 Client Component. 필터 변경 시 `page` 파라미터를 삭제하여 첫 페이지로 초기화.

**참조 패턴**: `src/app/(dashboard)/admin/users/_components/users-toolbar.tsx` (필터 3개 → 6개로 확장)

**주요 시그니처**:
```typescript
'use client'

export function PastExamsToolbar(): JSX.Element
```

**필터 레이아웃**:
```
[학교명 검색...] [과목 검색...] [학년 v] [시험유형 v] [연도 v] [학기 v]
```
- 컨테이너: `flex flex-wrap items-center gap-2`
- 텍스트 Input 2개: 학교명, 과목 (debounce 300ms)
- Select 4개: 학년(1~12+전체), 시험유형(4종+전체), 연도(최근5년+전체), 학기(1/2+전체)

**searchParams 매핑**:

| 필터 | URL key | 컴포넌트 | 값이 'all' 또는 빈값일 때 |
|------|---------|---------|----------------------|
| 학교명 | `school` | `Input` (debounce) | params에서 삭제 |
| 과목 | `subject` | `Input` (debounce) | params에서 삭제 |
| 학년 | `grade` | `Select` | params에서 삭제 |
| 시험유형 | `examType` | `Select` | params에서 삭제 |
| 연도 | `year` | `Select` | params에서 삭제 |
| 학기 | `semester` | `Select` | params에서 삭제 |

**구현 세부사항**:
1. `useRouter()` + `useSearchParams()` 사용
2. 텍스트 필터: `useState`로 로컬 상태 관리 + `useEffect` 내 `setTimeout` 300ms debounce (users-toolbar.tsx 패턴 그대로)
3. Select 필터: `onValueChange`에서 즉시 `router.push()` (debounce 불필요)
4. 모든 필터 변경 시 `params.delete('page')` — 첫 페이지로 리셋
5. `router.push(\`/past-exams?${params.toString()}\`)` — 경로 주의: `/admin/users`가 아닌 `/past-exams`
6. Select `defaultValue`는 `searchParams.get('key') ?? 'all'`

**debounce 패턴 (2개 Input 공유)**:
학교명과 과목 각각에 별도 `useState` + `useEffect` 사용. users-toolbar의 검색 패턴을 2번 반복 적용.

---

### 2-4. 상세 Sheet (신규)

**파일**: `src/app/(dashboard)/past-exams/_components/past-exam-detail-sheet.tsx`

**역할**: 기출문제 상세 정보 표시 + Signed URL 이미지 미리보기. 조회 전용 (관리 액션 없음).

**참조 패턴**: `src/app/(dashboard)/admin/users/_components/user-detail-sheet.tsx` (단순화 — 액션 버튼 없음)

**주요 시그니처**:
```typescript
'use client'

interface PastExamDetailSheetProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly examId: string
}

export function PastExamDetailSheet({
  open,
  onOpenChange,
  examId,
}: PastExamDetailSheetProps): JSX.Element
```

**설계 결정 — Props로 `examId`만 전달하는 이유**:
- Sheet 열릴 때 `getPastExamDetail(examId)` 호출 → Signed URL 생성 (60초 만료)
- 목록 데이터(`PastExamListItem`)에는 Signed URL이 없음 → 상세 조회 필수
- `useEffect`에서 `open && examId` 조건으로 데이터 패칭
- `useTransition`은 불필요 (Server Action 직접 호출 + await)

**내부 상태 관리**:
```typescript
const [detail, setDetail] = useState<PastExamDetail | null>(null)
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)

useEffect(() => {
  if (!open || !examId) return
  let cancelled = false
  setLoading(true)
  setError(null)
  getPastExamDetail(examId)
    .then((result) => {
      if (cancelled) return
      if (result.error) setError(result.error)
      else setDetail(result.data ?? null)
    })
    .catch(() => {
      if (!cancelled) setError('상세 조회에 실패했습니다.')
    })
    .finally(() => {
      if (!cancelled) setLoading(false)
    })
  return () => { cancelled = true }
}, [open, examId])
```

**InfoRow 패턴 재사용**:
`user-detail-sheet.tsx`에 정의된 `InfoRow` 컴포넌트를 동일하게 로컬 정의.
(현재 공통 컴포넌트로 추출되어 있지 않으므로 복사. 향후 리팩토링 시 공용화 가능.)

**표시 정보 (InfoRow 목록)**:

| 레이블 | 값 |
|--------|-----|
| 학교 | `detail.schoolName` (schoolType 추가 가능) |
| 학년 | `${detail.grade}학년` |
| 과목 | `detail.subject` |
| 시험유형 | Badge + `EXAM_TYPE_LABELS` |
| 연도/학기 | `${detail.year}년 ${detail.semester}학기` |
| 추출 상태 | Badge + `EXTRACTION_STATUS_MAP` |
| 업로드 | `detail.uploadedByName ?? '—'` |
| 등록일 | `toLocaleDateString('ko-KR')` |

**이미지 미리보기**:
```typescript
{detail.signedImageUrl && (
  <div className="space-y-2">
    <p className="text-xs text-muted-foreground">원본 이미지</p>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={detail.signedImageUrl}
      alt="기출문제 원본"
      className="max-h-[400px] w-full rounded-md border object-contain"
    />
  </div>
)}
```
- Signed URL 60초 만료 → Sheet 열 때마다 새로 생성
- `next/image` 대신 `<img>` 사용: Signed URL은 외부 도메인 + 동적 URL이므로 next/image의 remote patterns 설정이 복잡. MVP에서는 `<img>` 사용.
- PDF 파일의 경우 `<img>`로 표시 불가 → "PDF 파일은 미리보기를 지원하지 않습니다" 메시지 표시

**로딩/에러 상태**:
- 로딩 중: "상세 정보를 불러오는 중..." 텍스트 (Skeleton 대신 단순 텍스트)
- 에러: destructive 스타일 메시지 표시

---

### 2-5. 페이지 컴포넌트 (수정)

**파일**: `src/app/(dashboard)/past-exams/page.tsx`

**역할**: placeholder → Server Component + searchParams + DataTable 렌더링

**참조 패턴**: `src/app/(dashboard)/admin/users/page.tsx`

**주요 시그니처**:
```typescript
interface PastExamsPageProps {
  searchParams: Promise<{
    school?: string
    subject?: string
    grade?: string
    examType?: string
    year?: string
    semester?: string
    page?: string
  }>
}

export default async function PastExamsPage({ searchParams }: PastExamsPageProps): Promise<JSX.Element>
```

**구현 흐름**:

```
1. const params = await searchParams
2. 현재 사용자 역할 조회 (Supabase auth + profiles) → callerRole 결정
3. getPastExamList({
     school: params.school,
     grade: params.grade,
     subject: params.subject,
     examType: params.examType ?? 'all',
     year: params.year,
     semester: params.semester ?? 'all',
     page: params.page ?? '1',
   })
4. 에러 처리 (result.error → 에러 UI)
5. DataTable 렌더링
```

**업로드 버튼 조건부 표시**:
```typescript
const isTeacherOrAbove = ['teacher', 'admin', 'system_admin'].includes(callerRole)

// JSX 내:
{isTeacherOrAbove && (
  <Link href="/past-exams/upload">
    <Button>
      <Plus className="mr-2 h-4 w-4" />
      기출문제 업로드
    </Button>
  </Link>
)}
```

**DataTable 설정**:
```typescript
<DataTable
  columns={pastExamColumns}
  data={exams}
  toolbar={<PastExamsToolbar />}
  noResultsMessage="등록된 기출문제가 없습니다."
  showPagination={false}  // Step 4에서 서버사이드 페이지네이션으로 교체
/>
```

**callerRole 조회 패턴** (users/page.tsx와 동일):
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()

let callerRole = 'student'

if (user) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile) {
    callerRole = (profile as { role: string }).role
  }
}
```

---

## 3. TDD 테스트 계획

### UI 컴포넌트 테스트 판단

**결론: Step 3에서는 UI 단위 테스트를 작성하지 않는다.**

**근거**:
1. **컬럼 정의**: 정적 배열 + Badge 렌더링만 수행. 로직이 거의 없어 단위 테스트의 가치가 낮음.
2. **Toolbar**: URL searchParams 조작은 `useRouter`/`useSearchParams` 의존 → React Testing Library + Next.js router mock이 복잡하고 비용 대비 효과 낮음.
3. **Sheet**: `getPastExamDetail` Server Action 호출 → Server Action 자체는 Step 2에서 18개 테스트로 검증 완료.
4. **page.tsx**: Server Component → RSC 테스트는 현재 생태계에서 안정적이지 않음.
5. **검증 대안**: Step 5에서 `npm run build` 성공 + 수동 E2E 검증으로 충분.

**향후**: 프로젝트 규모가 커지면 Playwright E2E 테스트로 필터링/Sheet 열기/이미지 표시 흐름을 자동화.

---

## 4. 구현 순서 (의존 관계 기반)

```
Step 3-1: constants.ts          (의존 없음)
Step 3-2: past-exam-columns.tsx (constants.ts 의존)
Step 3-3: past-exam-detail-sheet.tsx (constants.ts 의존, getPastExamDetail 호출)
Step 3-4: past-exams-toolbar.tsx (constants.ts 의존, URL searchParams 조작만)
Step 3-5: page.tsx 수정          (모든 컴포넌트 의존)
```

### 실용적 구현 순서 (권장)

의존 관계를 고려하면 다음 순서가 가장 효율적:

```
1. constants.ts
2. past-exams-toolbar.tsx
3. past-exam-detail-sheet.tsx
4. past-exam-columns.tsx (Sheet import 가능)
5. page.tsx
```

### 세부 순서

#### Step 3-1: `constants.ts` (신규)
- **파일**: `src/app/(dashboard)/past-exams/_components/constants.ts`
- **의존**: 없음
- **리스크**: 낮음
- **예상 라인 수**: ~35줄

#### Step 3-2: `past-exams-toolbar.tsx` (신규)
- **파일**: `src/app/(dashboard)/past-exams/_components/past-exams-toolbar.tsx`
- **의존**: constants.ts (YEAR_OPTIONS, GRADE_OPTIONS 등)
- **리스크**: 중간 — 2개 debounce Input의 useEffect 독립성 확인 필요
- **예상 라인 수**: ~150줄

#### Step 3-3: `past-exam-detail-sheet.tsx` (신규)
- **파일**: `src/app/(dashboard)/past-exams/_components/past-exam-detail-sheet.tsx`
- **의존**: constants.ts, getPastExamDetail, PastExamDetail 타입
- **리스크**: 중간 — useEffect 내 비동기 호출 + 클린업 처리
- **예상 라인 수**: ~130줄

#### Step 3-4: `past-exam-columns.tsx` (신규)
- **파일**: `src/app/(dashboard)/past-exams/_components/past-exam-columns.tsx`
- **의존**: constants.ts, PastExamListItem 타입, PastExamDetailSheet
- **리스크**: 낮음
- **예상 라인 수**: ~120줄

#### Step 3-5: `page.tsx` 수정
- **파일**: `src/app/(dashboard)/past-exams/page.tsx`
- **의존**: 모든 Step 3-1~3-4 컴포넌트
- **리스크**: 낮음 — users/page.tsx 패턴 그대로
- **예상 라인 수**: ~65줄

---

## 5. 리스크 분석

| # | 리스크 | 심각도 | 대응 |
|---|--------|--------|------|
| 1 | **useEffect race condition** — Sheet 빠르게 열었다 닫으면 stale 데이터 표시 | 중간 | `let cancelled = false` + cleanup 패턴 |
| 2 | **Signed URL 만료 (60초)** — Sheet를 60초 이상 열어두면 이미지 로드 실패 | 낮음 | MVP에서는 무시. 필요 시 만료 시간 연장 |
| 3 | **6개 필터 모바일 UX** — 좁은 화면에서 필터 UI가 길어짐 | 낮음 | `flex-wrap gap-2`로 줄바꿈 |
| 4 | **PDF 파일 미리보기 불가** — `<img>` 태그는 PDF 렌더링 불가 | 낮음 | "PDF는 미리보기 지원 안됨" 메시지 표시 |
| 5 | **ESLint next/image 경고** | 낮음 | `eslint-disable-next-line` 주석 추가 |
| 6 | **debounce useEffect dependency** — 무한 루프 위험 | 중간 | users-toolbar 검증된 패턴 그대로 사용 |

---

## 6. 검증 방법

### 빌드 검증 (Step 5에서 수행)
```bash
npm run build   # TypeScript 컴파일 + 빌드 성공
npm run lint    # ESLint 에러 0개
```

### 수동 검증 (Step 3 완료 직후)
1. `/past-exams` 접속 → DataTable이 기출문제 목록을 렌더링하는지 확인
2. 필터 입력/선택 → URL searchParams가 변경되고, 목록이 서버에서 재조회되는지 확인
3. "상세" 버튼 클릭 → Sheet가 열리고, 상세 정보 + 이미지 미리보기가 표시되는지 확인
4. 교사/관리자 계정 → "기출문제 업로드" 버튼이 표시되는지 확인
5. 학생 계정 → "기출문제 업로드" 버튼이 숨겨져 있는지 확인
6. 기출문제가 없을 때 → "등록된 기출문제가 없습니다." 메시지 확인

### 성공 기준
- [x] DataTable에 기출문제 목록 렌더링
- [x] 6개 필터 모두 URL searchParams 기반으로 동작
- [x] 필터 변경 시 page 파라미터 초기화
- [x] 상세 Sheet에서 메타데이터 + 이미지 미리보기 표시
- [x] 교사/관리자만 업로드 버튼 표시
- [x] 빈 목록 시 적절한 메시지 표시
- [x] 빌드 성공 (Step 5에서 검증 완료 — 2026-02-19)

---

## 7. 파일 변경 요약

### 신규 생성 (4개)
| 파일 | 설명 | 예상 라인 |
|------|------|----------|
| `src/app/(dashboard)/past-exams/_components/constants.ts` | UI 상수 매핑 | ~35 |
| `src/app/(dashboard)/past-exams/_components/past-exam-columns.tsx` | 컬럼 정의 (9개) | ~120 |
| `src/app/(dashboard)/past-exams/_components/past-exams-toolbar.tsx` | 6개 필터 Toolbar | ~150 |
| `src/app/(dashboard)/past-exams/_components/past-exam-detail-sheet.tsx` | 상세 Sheet + 이미지 미리보기 | ~130 |

### 수정 (1개)
| 파일 | 변경 | 예상 라인 |
|------|------|----------|
| `src/app/(dashboard)/past-exams/page.tsx` | placeholder → Server Component + DataTable | ~65 |

**총: 4개 신규 + 1개 수정 = 5개 파일, ~500줄**

---

## 8. 재사용 패턴 참조 (파일 대응표)

| 기출문제 UI 파일 | 참조 원본 | 주요 차이 |
|-----------------|----------|----------|
| `constants.ts` | `user-columns.tsx`의 ROLE_MAP 등 | 기출문제 전용 상수 (시험유형, 추출상태) |
| `past-exam-columns.tsx` | `user-columns.tsx` | 정적 배열 (팩토리 불필요), DropdownMenu 대신 단일 버튼 |
| `past-exams-toolbar.tsx` | `users-toolbar.tsx` | 필터 3개 → 6개 (Input 2개 + Select 4개) |
| `past-exam-detail-sheet.tsx` | `user-detail-sheet.tsx` | 액션 버튼 없음, 이미지 미리보기 추가, examId로 데이터 패칭 |
| `page.tsx` | `admin/users/page.tsx` | 경로 `/past-exams`, showPagination=false, 업로드 버튼 |
