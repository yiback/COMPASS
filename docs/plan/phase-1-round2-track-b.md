# 단계 1 — 라운드 2 트랙 B: CRUD UI

> **상태**: 미시작
> **모델**: Sonnet (병렬 실행 — tmux 트랙 B)
> **전제 조건**: 라운드 1 인증 시스템 완료

---

## 목표

관리자가 학교/사용자/학원 정보를 관리할 수 있는 CRUD UI를 구현한다.

---

## 학습 포인트 (구현 전 설명)

### Server Actions CRUD 패턴
- 표준 구조: `createX`, `getXList`, `getXById`, `updateX`, `deleteX`
- Zod 검증 → Supabase 쿼리 → 에러 처리 → revalidatePath

### DataTable + Server Actions 연동
- Server Component에서 데이터 조회 → DataTable에 props 전달
- 필터/정렬은 searchParams 기반 (서버 사이드)
- 페이지네이션: range() 쿼리

### RBAC 패턴
- Server Action 내에서 역할 체크
- `profiles.role`이 'admin' 또는 'teacher'인지 확인
- 권한 없으면 `{ error: '권한이 없습니다.' }` 반환

---

## B-1: 학교 관리 CRUD [F008]

### 파일

| 파일 | 신규/수정 | 설명 |
|------|-----------|------|
| `src/lib/validations/schools.ts` | 신규 | 학교 Zod 스키마 |
| `src/lib/actions/schools.ts` | 신규 | CRUD Server Actions |
| `src/app/(dashboard)/admin/schools/page.tsx` | 신규 | 학교 목록 DataTable |
| `src/app/(dashboard)/admin/schools/new/page.tsx` | 신규 | 학교 생성 폼 |
| `src/app/(dashboard)/admin/schools/[id]/edit/page.tsx` | 신규 | 학교 수정 폼 |

### Zod 스키마

```typescript
export const schoolSchema = z.object({
  name: z.string().min(1, '학교명을 입력해주세요.').max(100),
  schoolType: z.enum(['elementary', 'middle', 'high']),
  region: z.string().optional(),
  district: z.string().optional(),
  address: z.string().optional(),
})
```

### Server Actions

```typescript
// 접근 권한: 조회 = 모든 인증 사용자, 생성/수정/삭제 = admin, teacher
export async function createSchool(formData: FormData)
export async function getSchoolList(params?: { search?: string; page?: number })
export async function getSchoolById(id: string)
export async function updateSchool(id: string, formData: FormData)
export async function deleteSchool(id: string)
```

### DataTable 컬럼

| 컬럼 | 필드 | 정렬 | 필터 |
|------|------|------|------|
| 학교명 | name | ✅ | ✅ (검색) |
| 학교유형 | school_type | - | ✅ (select) |
| 지역 | region | ✅ | ✅ |
| 등록일 | created_at | ✅ | - |
| 작업 | - | - | 수정/삭제 버튼 |

---

## B-2: 사용자 관리 CRUD [F009]

### 파일

| 파일 | 신규/수정 | 설명 |
|------|-----------|------|
| `src/lib/validations/users.ts` | 신규 | 사용자 Zod 스키마 |
| `src/lib/actions/users.ts` | 신규 | 목록/역할 변경 Server Actions |
| `src/app/(dashboard)/admin/users/page.tsx` | 신규 | 사용자 목록 DataTable |
| `src/app/(dashboard)/admin/users/[id]/page.tsx` | 신규 | 사용자 상세/수정 |

### 핵심: 역할 변경

```typescript
// admin 전용 — admin 클라이언트로 RLS 우회
export async function updateUserRole(userId: string, role: string) {
  // 1. 현재 사용자가 admin인지 확인
  // 2. admin 클라이언트로 profiles.role 업데이트
  const admin = createAdminClient()
  await admin.from('profiles').update({ role }).eq('id', userId)
}
```

### Zod 스키마

```typescript
export const updateUserRoleSchema = z.object({
  role: z.enum(['student', 'teacher', 'admin']),
})

export const userFilterSchema = z.object({
  search: z.string().optional(),
  role: z.enum(['student', 'teacher', 'admin', 'all']).optional(),
  page: z.number().int().min(1).optional(),
})
```

### DataTable 컬럼

| 컬럼 | 필드 | 정렬 | 필터 |
|------|------|------|------|
| 이름 | name | ✅ | ✅ (검색) |
| 이메일 | email | ✅ | - |
| 역할 | role | - | ✅ (select) |
| 상태 | is_active | - | ✅ |
| 가입일 | created_at | ✅ | - |
| 작업 | - | - | 역할 변경 |

### 역할 변경 UI

- 드롭다운 + 확인 다이얼로그
- `student ↔ teacher ↔ admin` 변경 가능
- `system_admin`은 변경 불가 (UI에서 비활성화)

---

## B-3: 학원 정보 관리 [F007]

### 파일

| 파일 | 신규/수정 | 설명 |
|------|-----------|------|
| `src/lib/validations/academies.ts` | 신규 | 학원 Zod 스키마 |
| `src/lib/actions/academies.ts` | 신규 | 조회/수정 Server Actions |
| `src/app/(dashboard)/admin/academy/page.tsx` | 신규 | 학원 정보 표시/수정 |

### Zod 스키마

```typescript
export const updateAcademySchema = z.object({
  name: z.string().min(1, '학원명을 입력해주세요.').max(100),
  address: z.string().optional(),
  phone: z.string().optional(),
  // invite_code는 읽기 전용으로 표시 (수정 불가)
})
```

### Server Actions

```typescript
// admin 전용 — 자기 학원만 조회/수정
export async function getMyAcademy()
export async function updateMyAcademy(formData: FormData)
```

### UI 구조

```
┌─────────────────────────────────┐
│ 학원 정보                        │
│                                  │
│ 학원명: [수정 가능]              │
│ 주소:   [수정 가능]              │
│ 전화:   [수정 가능]              │
│ 초대코드: ABC123 (읽기 전용)     │
│                                  │
│ [저장] 버튼                      │
└─────────────────────────────────┘
```

---

## 메뉴 수정

`src/lib/constants/menu.ts`에 관리 메뉴 추가:

```typescript
// 관리자 메뉴 (role='admin' 시 표시)
{
  title: '학교 관리',
  href: '/admin/schools',
  icon: School,
  description: '학교 정보 관리',
},
{
  title: '사용자 관리',
  href: '/admin/users',
  icon: Users,
  description: '사용자 역할 관리',
},
{
  title: '학원 정보',
  href: '/admin/academy',
  icon: Building,
  description: '학원 정보 관리',
},
```

**충돌 방지**: 트랙 A도 menu.ts를 수정하므로, 트랙 B에서만 menu.ts 수정하고
트랙 A의 메뉴 추가는 트랙 B 완료 후 병합한다.

---

## 테스트

| 파일 | 내용 |
|------|------|
| `src/lib/actions/__tests__/schools.test.ts` | 학교 CRUD + 권한 체크 |
| `src/lib/actions/__tests__/users.test.ts` | 역할 변경 + 권한 체크 |
| `src/lib/actions/__tests__/academies.test.ts` | 학원 조회/수정 + 권한 체크 |

---

## 리스크

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 트랙 A와 menu.ts 충돌 | 저 | 트랙 B에서만 수정, A는 나중에 추가 |
| admin 클라이언트 남용 | 중 | 역할 변경에서만 사용, 나머지는 RLS |
| 역할 변경 보안 | 중 | Server Action에서 현재 사용자 admin 확인 필수 |
