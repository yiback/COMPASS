# 1-6 Step 4: 서버사이드 페이지네이션 UI 구현 계획

> **상태**: ✅ 완료
> **작성일**: 2026-02-19
> **완료일**: 2026-02-19

---

## 1. 요구사항 재정리

### 현재 문제

DataTable의 기본 페이지네이션(`DataTablePagination`)은 **클라이언트 사이드**로 동작. `useReactTable`의 `getPaginationRowModel()`을 사용하므로, 전달받은 `data` 배열 내에서만 페이지를 나눔. 서버가 `pageSize=10`으로 10건만 반환하면 "1/1 페이지"로 표시되어 다음 페이지로 이동 불가.

현재 `page.tsx`에서는 `showPagination={false}`로 클라이언트 페이지네이션을 비활성화한 상태.

### 해결 목표

URL searchParams 기반의 **서버사이드 페이지네이션 컴포넌트**를 만들어 DataTable 아래에 배치. `getPastExamList`가 이미 반환하는 `meta: { total, page, pageSize }`를 활용.

### 핵심 요구사항

1. **URL 기반 페이지 이동**: `?page=N` searchParams로 페이지 전환 (뒤로가기/북마크 지원)
2. **기존 필터 보존**: 페이지 이동 시 학교명, 과목 등 기존 필터 searchParams 유지
3. **재사용 가능**: 기출문제 외에도 다른 목록 페이지에서도 활용 가능한 공용 컴포넌트
4. **기존 DataTablePagination과 시각적 일관성**: 동일한 UI 패턴(아이콘, 버튼 크기, 레이아웃)

---

## 2. 기존 코드 분석 결과

### `data-table-pagination.tsx` (클라이언트 사이드)

- **파일**: `src/components/data-table/data-table-pagination.tsx`
- TanStack Table의 `Table<TData>` 인스턴스에 의존
- `table.getCanPreviousPage()`, `table.getCanNextPage()`, `table.setPageIndex()` 등 사용
- UI: "페이지당 행" Select + "N / M 페이지" 텍스트 + 4개 네비게이션 버튼 (첫/이전/다음/마지막)
- **문제**: 서버가 10건만 반환하면 table은 1페이지만 인식

### `data-table.tsx`

- `showPagination` prop (기본값 `true`)
- `showPagination={false}`일 때 `DataTablePagination` 미렌더링
- 서버사이드 페이지네이션 컴포넌트는 DataTable **외부**에 배치 (DataTable의 props에 추가하지 않음)

### `page.tsx` (기출문제)

- `getPastExamList` 호출 후 `result.meta`에서 `total`, `page`, `pageSize` 접근 가능
- 현재 `<DataTable showPagination={false} />` 다음에 별도 컴포넌트 배치 예정

### `getPastExamList` 반환값 (`meta`)

- `meta: { total: number, page: number, pageSize: number }` 반환
- `pageSize`는 10 고정
- `page`는 Zod 스키마에서 `z.coerce.number().int().min(1).default(1)`

### `users-toolbar.tsx` (URL searchParams 조작 패턴)

- `useRouter()` + `useSearchParams()` 조합
- `new URLSearchParams(searchParams.toString())`으로 기존 params 복사 후 수정
- `router.push()` 호출로 URL 갱신

---

## 3. 아키텍처 설계 결정

### 3-1. 컴포넌트 배치 위치

**결정**: `src/components/data-table/data-table-server-pagination.tsx`

**이유**: DataTable 관련 공용 컴포넌트 디렉토리에 배치 → 재사용성. `data-table-pagination.tsx`(클라이언트)와 대칭적 네이밍.

### 3-2. 라우팅 방식

**결정**: `'use client'` + `useRouter` + `useSearchParams` + `usePathname`

**이유**:
1. Toolbar와 동일한 패턴 일관성
2. `useSearchParams()`로 현재 필터 파라미터를 자연스럽게 보존
3. 버튼 disabled 상태 제어가 직관적

### 3-3. "페이지당 행" 기능

**결정**: Step 4에서는 **제외**. `pageSize=10` 고정.

**이유**: 서버 Action의 `pageSize`가 10으로 하드코딩. 가변으로 만들려면 Server Action 수정 필요 → 범위 초과.

### 3-4. Props 인터페이스

```typescript
interface DataTableServerPaginationProps {
  readonly total: number      // 전체 데이터 수
  readonly page: number       // 현재 페이지 (1-based)
  readonly pageSize: number   // 페이지당 항목 수
}
```

### 3-5. 네비게이션 버튼 구성

기존 `DataTablePagination`과 동일한 4개 버튼:
1. **첫 페이지** (`ChevronsLeft`) — `page=1` (lg 이상에서만 표시)
2. **이전 페이지** (`ChevronLeft`) — `page=현재-1`
3. **다음 페이지** (`ChevronRight`) — `page=현재+1`
4. **마지막 페이지** (`ChevronsRight`) — `page=총페이지수` (lg 이상에서만 표시)

비활성화 조건:
- 첫/이전: `page <= 1`
- 다음/마지막: `page >= totalPages`

### 3-6. 페이지 이동 시 기존 필터 보존

```typescript
const searchParams = useSearchParams()
const pathname = usePathname()

function goToPage(targetPage: number) {
  const params = new URLSearchParams(searchParams.toString()) // 기존 필터 복사
  if (targetPage <= 1) {
    params.delete('page') // page=1이면 URL에서 제거 (깔끔)
  } else {
    params.set('page', String(targetPage))
  }
  router.push(`${pathname}?${params.toString()}`)
}
```

---

## 4. 구현 단계

### Phase 1: 서버사이드 페이지네이션 컴포넌트

#### Step 4-1: `data-table-server-pagination.tsx` (신규)

- **파일**: `src/components/data-table/data-table-server-pagination.tsx`
- **의존**: `useRouter`, `useSearchParams`, `usePathname`, `Button`, lucide-react 아이콘
- **예상 라인 수**: ~80줄

**내부 로직**:
1. `totalPages = Math.ceil(total / pageSize)` 계산
2. 총 건수가 0이거나 1페이지 이하면 미렌더링 (null 반환)
3. `goToPage(n)` 함수: 기존 필터 보존 + page 설정 + `router.push()`
4. 4개 네비게이션 버튼 렌더링 (기존 DataTablePagination UI와 일치)
5. "N / M 페이지" 텍스트 표시

**UI 레이아웃** (기존 DataTablePagination과 일관):
```
                                    [N / M 페이지]  [<<] [<] [>] [>>]
```

#### Step 4-2: `index.ts` 수정

- **파일**: `src/components/data-table/index.ts`
- **변경**: `DataTableServerPagination` export 추가 (+1줄)

### Phase 2: 기출문제 페이지에 적용

#### Step 4-3: `page.tsx` 수정

- **파일**: `src/app/(dashboard)/past-exams/page.tsx`
- **변경**: DataTable 아래에 `DataTableServerPagination` 배치 (+5~7줄)

---

## 5. TDD 테스트 계획

**결론: Step 4에서는 단위 테스트를 작성하지 않는다.**

**근거**:
1. 순수 UI 컴포넌트로 비즈니스 로직이 거의 없음
2. 유일한 로직은 `Math.ceil(total / pageSize)` + `goToPage(n)` — 복잡도 낮음
3. `useRouter`, `useSearchParams`, `usePathname` mock 필요 → 비용 대비 효과 낮음
4. 기존 `DataTablePagination`에도 테스트가 없음 (동일 수준)
5. Step 5에서 `npm run build` + 수동 E2E 검증으로 충분

---

## 6. 생성/수정 파일 목록

### 신규 생성 (1개)

| 파일 | 설명 | 예상 라인 |
|------|------|----------|
| `src/components/data-table/data-table-server-pagination.tsx` | 서버사이드 페이지네이션 UI | ~80 |

### 수정 (2개)

| 파일 | 변경 내용 | 예상 변경 라인 |
|------|----------|--------------|
| `src/components/data-table/index.ts` | export 추가 | +1 |
| `src/app/(dashboard)/past-exams/page.tsx` | 컴포넌트 import 및 배치 | +5~7 |

**총: 1개 신규 + 2개 수정 = 3개 파일, ~90줄 변경**

---

## 7. 리스크 및 의존성

| # | 리스크 | 심각도 | 대응 |
|---|--------|--------|------|
| 1 | Suspense boundary 필요 여부 | 중간 | `PastExamsToolbar`가 이미 `useSearchParams()` 사용 중이므로 기존 페이지에서 이미 처리됨 |
| 2 | page 파라미터 범위 초과 (`?page=999`) | 낮음 | 서버가 빈 배열 반환 + `totalPages` 계산으로 표시. 사용자가 첫 페이지 버튼으로 복구 |
| 3 | URL에 page 파라미터 누락 시 동작 | 낮음 | Zod `default(1)` + page.tsx에서 이미 처리 |

### 의존성

- **선행**: Step 3 완료 ✅ (DataTable + `showPagination={false}` + `meta` 반환)
- **후행**: Step 5 빌드 검증에서 통합 검증

---

## 8. 예상 복잡도

**전체 복잡도: 낮음**

- 신규 파일 1개 (~80줄) + 수정 2개 (1줄, 5줄)
- 기존 `DataTablePagination`의 UI 패턴을 그대로 차용
- 복잡한 비즈니스 로직 없음 (페이지 번호 계산 + URL 조작)

---

## 9. 검증 방법

### 수동 검증 (Step 4 완료 직후)

1. `/past-exams` 접속 → 페이지네이션 UI가 DataTable 아래에 렌더링
2. 데이터 10건 이하 → 페이지네이션 미표시
3. 데이터 11건 이상 → "1 / N 페이지" 표시
4. "다음 페이지" 클릭 → URL에 `?page=2` + DataTable 데이터 갱신
5. "이전 페이지" 클릭 → URL에서 `page` 삭제 (page=1) + 첫 페이지 데이터
6. 필터 적용 상태에서 페이지 이동 → 필터 파라미터 유지
7. 브라우저 뒤로가기 → 이전 페이지 복원
8. 첫 페이지에서 "첫/이전" 버튼 비활성화
9. 마지막 페이지에서 "마지막/다음" 버튼 비활성화

### 성공 기준

- [x] 서버사이드 페이지네이션 컴포넌트 생성
- [x] URL searchParams 기반 페이지 이동
- [x] 기존 필터 파라미터 보존
- [x] 첫/마지막 페이지에서 버튼 비활성화
- [x] 데이터 1페이지 이하 시 페이지네이션 미표시
- [x] 기존 DataTablePagination과 시각적 일관성
- [x] 빌드 성공 (Step 5 검증 완료 — 2026-02-19)
