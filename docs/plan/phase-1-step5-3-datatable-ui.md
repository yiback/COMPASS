# 1-5 Step 3: DataTable + 목록 페이지 UI 구현 계획

## Context

Step 1(Zod 스키마)과 Step 2(Server Actions + TDD)가 완료되었다. 이제 **프레젠테이션 레이어**를 구현하여 `getUserList` Server Action을 DataTable UI에 연결한다. 1-3 학교 관리 DataTable 패턴을 재사용하되, 역할별 Badge + 권한 기반 액션 컬럼이 추가된다.

---

## 범위

### IN (Step 3)
- 사용자 목록 DataTable (이름, 이메일, 역할Badge, 상태Badge, 가입일)
- 검색 (이름/이메일 debounce 300ms)
- 역할 필터 (전체/학생/교사/관리자) + 활성 상태 필터 (전체/활성/비활성)
- 액션 DropdownMenu (admin/system_admin만 표시)
- toggleUserActive 동작 (confirm + Server Action)
- 역할 변경은 placeholder만 (Step 4에서 AlertDialog 구현)

### OUT
- 역할 변경 AlertDialog → Step 4
- 사용자 상세 Sheet → Step 4
- 사이드바 메뉴 추가 → Step 5

---

## 파일별 구현 명세

### 1. `src/app/(dashboard)/admin/users/_components/user-columns.tsx` (~140줄)

**역할**: DataTable 컬럼 정의. 호출자 역할에 따라 액션 컬럼을 조건부 포함하는 **팩토리 함수**.

**학교 관리와 차이**: schoolColumns는 상수 배열 → userColumns는 `createUserColumns(callerRole, callerId)` 함수. 이유: admin/system_admin만 액션 표시 + 자기 자신 행 비활성화 필요.

**상수 매핑**:
```
ROLE_MAP: student→학생, teacher→교사, admin→관리자, system_admin→시스템관리자
ROLE_BADGE_VARIANT: student→secondary, teacher→default, admin→outline, system_admin→destructive
STATUS_BADGE: active→{label:활성, variant:default}, inactive→{label:비활성, variant:secondary}
```

**컬럼 6개**:

| accessorKey | 헤더 | 정렬 | 셀 렌더러 |
|-------------|------|------|-----------|
| `name` | 이름 | DataTableColumnHeader | 텍스트 |
| `email` | 이메일 | DataTableColumnHeader | 텍스트 |
| `role` | 역할 | 텍스트 | Badge + ROLE_MAP |
| `isActive` | 상태 | 텍스트 | Badge (활성/비활성) |
| `createdAt` | 가입일 | DataTableColumnHeader | `toLocaleDateString('ko-KR')` |
| `actions` | - | - | DropdownMenu (조건부) |

**accessorKey 주의**: UserProfile은 camelCase (`isActive`, `createdAt`). 학교 관리는 snake_case (`school_type`, `created_at`) — DB 직접 vs toUserProfile 변환 차이.

**액션 컬럼 조건**:
- `callerRole`이 admin/system_admin일 때만 컬럼 포함
- 각 행에서: 자기 자신(`row.original.id === callerId`) → 비활성화
- 각 행에서: 대상이 system_admin → 비활성화
- **비활성화/활성화**: `confirm()` → `toggleUserActive()` → `toast` → `router.refresh()`
- **역할 변경**: `toast.info('역할 변경 기능은 곧 추가됩니다.')` (Step 4 placeholder)

**의존성**: `@tanstack/react-table`, `DataTableColumnHeader`, `Badge`, `Button`, `DropdownMenu`, `toggleUserActive`, `UserProfile`, `sonner`, `useRouter`, `lucide-react`

---

### 2. `src/app/(dashboard)/admin/users/_components/users-toolbar.tsx` (~85줄)

**역할**: 검색 Input + 역할 필터 Select + 활성 상태 필터 Select.

**패턴**: schools-toolbar.tsx 그대로 재사용 (URL만 `/admin/users`로 변경, 필터 1개 → 2개).

**흐름**:
1. `useSearchParams()` → 현재 URL 파라미터
2. `useState(searchParams.get('search') ?? '')` → 검색어 로컬 상태
3. Input: 300ms debounce → `router.push('/admin/users?...')`
4. Select(역할): 즉시 `router.push()`
5. Select(상태): 즉시 `router.push()`
6. 모든 변경 시 `params.delete('page')` → 첫 페이지 리셋

**Select 옵션**:
- 역할: 전체(all) / 학생(student) / 교사(teacher) / 관리자(admin)
- 상태: 전체(all) / 활성(true) / 비활성(false)

**레이아웃**: `[ 이름 또는 이메일 검색... ] [ 역할 ▼ ] [ 상태 ▼ ]`

**의존성**: `Input`, `Select` (shadcn/ui), `useRouter`, `useSearchParams`, `useState`, `useEffect`

---

### 3. `src/app/(dashboard)/admin/users/page.tsx` (~75줄)

**역할**: Server Component. 현재 사용자 역할 확인 + 데이터 조회 + DataTable 렌더링.

**현재 사용자 역할 가져오기**: page.tsx에서 Supabase 직접 조회.
- `getCurrentUserProfile()`이 users.ts에 이미 존재하지만 private (미export)
- page.tsx에서 `createClient()` → `auth.getUser()` → `profiles.select('id, role')` 직접 호출
- 이유: Server Component에서 Supabase 직접 접근은 정당한 패턴 (RLS 적용됨)

**흐름**:
```
1. const params = await searchParams
2. const supabase = await createClient()
3. 현재 사용자 { id, role } 조회
4. const result = await getUserList({ search, role, isActive, page })
5. 에러 처리 (result.error → 에러 UI)
6. const columns = createUserColumns(callerRole, callerId)
7. <DataTable columns={columns} data={users} toolbar={() => <UsersToolbar />} />
```

**에러 UI**: 학교 관리와 동일 패턴 (`border-destructive bg-destructive/10`)

**참조 파일**: `src/app/(dashboard)/admin/schools/page.tsx` (80줄)

---

## 구현 순서

```
Phase A: 컬럼 정의
  1. user-columns.tsx — 상수 매핑 (ROLE_MAP, Badge variant)
  2. user-columns.tsx — createUserColumns 함수 (5개 기본 컬럼 + 조건부 액션 컬럼)

Phase B: 툴바
  3. users-toolbar.tsx — 검색 debounce + 역할/상태 필터 2개

Phase C: 페이지 조립
  4. page.tsx — Server Component (현재 사용자 조회 + getUserList + DataTable)

Phase D: 검증
  5. npm run build (타입 검증)
  6. npm run lint (코드 품질)
  7. npx vitest run (기존 300개 테스트 회귀 확인)
  8. npm run dev → /admin/users 수동 검증
```

---

## 학습 포인트 (RECOMMENDED)

### 1. URL 기반 상태 관리
- searchParams가 Single Source of Truth (useState 아님)
- 장점: 북마크, 공유, 뒤로가기 지원
- 흐름: 사용자 입력 → router.push → Server Component 재실행 → getUserList → DataTable 리렌더링

### 2. DataTable 커스텀 셀 렌더러
- TanStack Table `cell: ({ row }) => <Badge>` 패턴
- `row.original`로 원본 데이터 접근
- accessorKey는 데이터 객체의 key와 정확히 일치해야 함

### 3. Server/Client Component 경계
- page.tsx(Server): 데이터 조회 + callerRole 확인 → 조작 불가
- columns/toolbar(Client): 상호작용만 담당
- Server에서 권한 정보를 결정하고 Client에 전달 → 보안 강화

### 이해도 체크 질문 (구현 후)
- Q1: 왜 useState가 아니라 URL searchParams를 사용하는가?
- Q2: 필터 변경 시 왜 params.delete('page')를 호출하는가?
- Q3: row.original.role vs row.getValue('role')의 차이는?
- Q4: 왜 callerRole을 Client Component에서 Supabase로 조회하지 않고 Server에서 전달하는가?

---

## 리스크 평가

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| accessorKey camelCase 매핑 오류 | 중간 | UserProfile 타입 키와 일치 확인 (isActive, createdAt) |
| 페이지네이션 이중 적용 | 낮음 | 학교 관리 패턴 동일 유지 (클라이언트 페이지네이션) |
| toolbar 무한 루프 | 낮음 | 학교 관리 패턴 검증됨 (동일 useEffect 구조) |
| 타입 안전성 (role 키) | 낮음 | ROLE_MAP에 system_admin 포함 |

---

## 검증 체크리스트

- [x] DataTable에 사용자 목록 표시됨
- [x] 검색/필터가 URL searchParams와 동기화됨
- [x] Badge variant가 역할/상태별로 올바르게 적용됨
- [x] admin/system_admin만 액션 컬럼 표시
- [x] 자기 자신 + system_admin 대상 액션 비활성화
- [x] toggleUserActive 정상 동작 (confirm → toast → 목록 갱신)
- [x] `npm run build` 성공
- [x] `npm run lint` 에러 0개
- [x] `npx vitest run` 300개+ 통과 (회귀 없음)

---

## 핵심 참조 파일

| 파일 | 용도 |
|------|------|
| `src/app/(dashboard)/admin/schools/page.tsx` | page.tsx 패턴 참조 |
| `src/app/(dashboard)/admin/schools/_components/school-columns.tsx` | columns 패턴 참조 |
| `src/app/(dashboard)/admin/schools/_components/schools-toolbar.tsx` | toolbar 패턴 참조 |
| `src/components/data-table/data-table.tsx` | DataTable 공통 컴포넌트 |
| `src/components/data-table/data-table-column-header.tsx` | 정렬 헤더 |
| `src/components/ui/badge.tsx` | Badge variant 확인 |
| `src/lib/actions/users.ts` | getUserList, toggleUserActive, UserProfile 타입 |
| `src/lib/validations/users.ts` | userFilterSchema |
