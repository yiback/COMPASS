# 단계 1-4: 학원 관리 CRUD [F007] 상세 계획

> **상태**: 🚧 진행 중 (Step 1/5 완료)
> **작성일**: 2026-02-12
> **마지막 업데이트**: 2026-02-12
> **진행률**: 1/5 Steps 완료 (20%)
> **모델**: Sonnet (구현), Opus (계획)
> **전제 조건**: 1-1 인증, 1-2 기출업로드, 1-3 학교관리 완료

---

## 1. 요구사항 재정의

### PRD 요구사항 (F008: 학원 등록/관리)

- 학원 기본 정보 관리 (이름, 주소, 연락처)
- 브랜딩 설정 (로고) → MVP: logo_url 직접 입력
- 초대 코드 표시 (읽기 전용, 복사 버튼)

### ROADMAP 요구사항

- 학원 정보 조회/수정
- 초대 코드 표시 (읽기 전용)

### 핵심 차이점: 학교 관리(1-3)와 비교

| 측면 | 학교 관리 (schools) | 학원 관리 (academies) |
|------|---------------------|----------------------|
| 데이터 범위 | 전체 목록 (여러 학교) | **자기 학원 1개만** |
| 페이지 구조 | DataTable 목록 + 생성/수정 페이지 | **단일 정보/수정 페이지** |
| CRUD 범위 | 생성/조회/수정/삭제 전체 | **조회(R) + 수정(U)만** |
| 수정 권한 | admin + teacher | **admin만** (teacher는 조회만) |
| 특수 필드 | - | invite_code(읽기전용), logo_url, settings(JSONB) |

---

## 2. DB 스키마 확인

### academies 테이블 (00001 + 00004 마이그레이션)

```sql
CREATE TABLE academies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  invite_code TEXT UNIQUE,  -- 00004에서 추가
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 기존 RLS 정책

| 정책 | 대상 | 조건 |
|------|------|------|
| `academies_select_own` | SELECT | `id = get_user_academy_id()` |
| `academies_update_admin` | UPDATE | 자기 학원 + admin/system_admin |
| `academies_insert_system_admin` | INSERT | system_admin만 |

→ RLS가 이미 적절히 설정되어 있음. 추가 마이그레이션 불필요.

### 확인 필요: 00004 마이그레이션 Cloud 적용 여부

- `invite_code` 컬럼이 Supabase Cloud에 존재하는지 확인
- 미적용 시 Supabase Dashboard에서 SQL 실행 필요

---

## 3. 보안 분석

### Defense in Depth (이중 방어)

1. **1차 방어 — RLS**: `academies_update_admin` 정책이 DB 레벨에서 admin만 수정 허용
2. **2차 방어 — Server Action**: 앱 레벨에서도 역할 체크 (`checkAdminRole()`)

### invite_code 보안

- **노출 범위**: admin + teacher (학생에게 코드를 알려줘야 하므로 teacher도 조회 필요)
- **수정 방지**: Server Action에서 invite_code를 업데이트 대상에서 제외
- **재생성**: MVP 제외 (Phase 2+)

### 수정 불가 필드 (Server Action에서 차단)

- `id`: 기본키
- `invite_code`: 읽기 전용
- `settings`: MVP에서 미사용 (확장 예약)
- `is_active`: system_admin 전용
- `created_at`, `updated_at`: 자동 관리

---

## 4. 구현 계획 (5 Steps)

### Step 1: Zod 검증 스키마 (TDD) ✅

**상태**: ✅ 완료 (2026-02-12)

**완료 요약**:
- ✅ `src/lib/validations/academies.ts` — academyUpdateSchema 구현
- ✅ `src/lib/validations/__tests__/academies.test.ts` — 14개 테스트 모두 통과
- ✅ `.or(z.literal(''))` 패턴으로 logoUrl 유효성 검증 (URL 또는 빈 문자열)
- ✅ TDD RED→GREEN→REFACTOR 사이클 완벽 준수
- ✅ 경계값 테스트 (100자/200자/20자 정확한 경계 검증)
- ✅ Zod strip 모드로 수정 불가 필드(invite_code, settings) 자동 제거

**파일:**
- `src/lib/validations/academies.ts` [완료]
- `src/lib/validations/__tests__/academies.test.ts` [완료]

**스키마:**
```typescript
// 학원 수정 스키마 (생성은 system_admin 영역이므로 MVP 제외)
export const academyUpdateSchema = z.object({
  name: z.string().min(1, '학원명을 입력해주세요.').max(100, '학원명은 100자 이하여야 합니다.'),
  address: z.string().max(200, '주소는 200자 이하여야 합니다.').optional().or(z.literal('')),
  phone: z.string().max(20, '전화번호는 20자 이하여야 합니다.').optional().or(z.literal('')),
  logoUrl: z.string().url('올바른 URL 형식이 아닙니다.').or(z.literal('')).optional(),
})
```

**검증 완료:**
- [x] name 필수 검증 (빈 문자열 → 에러)
- [x] name 100자 초과 → 에러
- [x] address 선택적 (빈 문자열 허용)
- [x] logoUrl URL 형식 검증
- [x] invite_code, settings 등 수정 불가 필드가 스키마에 없는지 확인

---

### Step 2: Server Actions (TDD)

**파일:**
- `src/lib/actions/academies.ts`
- `src/lib/actions/__tests__/academies.test.ts`

**Actions:**

```typescript
// 1. getMyAcademy(): 현재 사용자의 학원 정보 조회
export async function getMyAcademy(): Promise<AcademyActionResult>

// 2. updateMyAcademy(): 학원 정보 수정 (admin만)
export async function updateMyAcademy(
  _prevState: AcademyActionResult | null,
  formData: FormData
): Promise<AcademyActionResult>
```

**RBAC 헬퍼:**
```typescript
// 학교 관리의 checkAdminOrTeacherRole()과 달리 admin만 허용
async function checkAdminRole(): Promise<{ error?: string; role?: string }>
```

**TDD 테스트 케이스:**
- `getMyAcademy`: 인증 안 됨 → 에러
- `getMyAcademy`: 정상 조회 → academy 데이터 반환
- `getMyAcademy`: academy_id가 null (system_admin) → 적절한 응답
- `updateMyAcademy`: admin → 성공
- `updateMyAcademy`: teacher → 권한 에러
- `updateMyAcademy`: 잘못된 입력 → Zod 검증 에러
- `updateMyAcademy`: 성공 시 revalidatePath 호출 확인

---

### Step 3: 페이지 + UI 컴포넌트

**파일:**

```
src/app/(dashboard)/admin/academy/
├── page.tsx                           # Server Component (데이터 조회)
└── _components/
    ├── academy-info-card.tsx           # 학원 정보 카드 (읽기 전용)
    └── academy-form.tsx               # 수정 폼 (Client Component)
```

#### page.tsx (Server Component)

- `getMyAcademy()` 호출하여 학원 데이터 조회
- 현재 사용자 역할 확인 (admin → 수정 폼, teacher → 읽기 전용)
- 에러 상태 처리

#### academy-info-card.tsx

- 학원 정보 표시: name, address, phone, logo_url, is_active
- invite_code: 읽기 전용 + 복사 버튼 (navigator.clipboard)
- created_at, updated_at 표시

#### academy-form.tsx (Client Component)

- React Hook Form + Zod 검증
- `useTransition` + Server Action 패턴 (학교 폼과 동일)
- 필드: name(필수), address, phone, logoUrl
- 성공 시 toast + router.refresh()
- admin 역할일 때만 렌더링

---

### Step 4: 사이드바 메뉴 연결

**파일:** `src/lib/constants/menu.ts`

**현재 상태:** MENU_ITEMS에 admin 관련 메뉴가 없음 (학교 관리도 미등록)

**변경 사항:**
- `MENU_ITEMS`에 "관리" 섹션 추가 (학원 관리, 학교 관리 포함)
- 또는 MenuItem에 `role` 필드 추가하여 역할별 필터링 준비

```typescript
// 옵션 A: 단순 추가
{ title: '학원 관리', href: '/admin/academy', icon: Building2 }
{ title: '학교 관리', href: '/admin/schools', icon: GraduationCap }

// 옵션 B: 역할 필드 추가 (확장성)
interface MenuItem {
  // ... 기존
  roles?: string[]  // 빈 배열 = 전체 공개
}
```

→ **옵션 A** 채택 (MVP 단순화). 역할별 필터링은 2-1 RBAC 시스템에서 처리

---

### Step 5: 빌드 검증 + 학습 리뷰

1. `npm run build` 통과 확인
2. `npm run test:run` 전체 테스트 통과 확인
3. 학습 리뷰 세션 진행

---

## 5. 학습 포인트

### 5-1. CRUD 전체 vs 부분 CRUD 패턴

| 전체 CRUD (학교 관리) | 부분 CRUD (학원 관리) |
|----------------------|---------------------|
| DataTable 목록 페이지 | 단일 레코드 상세 페이지 |
| 생성/수정/삭제 페이지 분리 | 조회+수정 한 페이지 |
| 여러 레코드 관리 | 자기 소속 1개만 |
| 범용 RBAC (admin+teacher) | 역할별 다른 UI (admin=수정, teacher=읽기) |

**핵심 질문**: "왜 학원 관리에는 생성/삭제가 없는가?"
→ 학원은 **테넌트(멀티테넌시의 최상위 단위)**이므로, 생성은 시스템 관리자 영역이고 삭제는 비즈니스적으로 위험한 행위

### 5-2. 동일 페이지에서 역할별 다른 UI

```
Server Component에서 role 확인
  → admin: <AcademyForm /> (수정 가능)
  → teacher: <AcademyInfoCard /> (읽기 전용)
```

**핵심 개념**: Server Component에서 역할을 확인하고, 적절한 Client Component를 조건부 렌더링
→ 클라이언트에서 역할 체크하면 보안 취약 (DevTools로 우회 가능)

### 5-3. invite_code: 민감 정보의 읽기 전용 처리

- UI: `readOnly` input + 복사 버튼
- Server: 업데이트 대상에서 제외
- RLS: admin/system_admin만 학원 수정 가능 (teacher는 SELECT만)

**학습**: 민감 정보는 "보여주되 수정 불가"로 처리. 3중 방어 (UI + Server + DB)

### 5-4. Schools 폼과 비교: 동일 패턴의 변형 적용

학교 관리에서 배운 패턴을 변형 적용:
- `useForm` + `zodResolver` → 동일
- `useTransition` + Server Action → 동일
- FormData 변환 → 동일
- **차이**: mode='create'/'edit' 분기 대신 update 전용

---

## 6. 리스크 평가

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| 00004 마이그레이션 미적용 (invite_code 컬럼 없음) | **중간** | 구현 전 Cloud 확인, 미적용 시 SQL 실행 |
| Supabase placeholder 타입 | 낮음 | `as any` 캐스팅으로 우회 (기존 패턴) |
| 미들웨어에 역할 기반 라우트 보호 없음 | 낮음 | Server Action에서 RBAC 처리 (기존 패턴) |
| logo_url Storage 업로드 미연동 | 낮음 | MVP에서 URL 직접 입력, Storage 업로드는 Phase 2+ |

---

## 7. 파일 변경 요약

### 새로 생성 (6개)

| 파일 | 설명 |
|------|------|
| `src/lib/validations/academies.ts` | 학원 수정 Zod 스키마 |
| `src/lib/validations/__tests__/academies.test.ts` | 스키마 테스트 |
| `src/lib/actions/academies.ts` | 학원 조회/수정 Server Actions |
| `src/lib/actions/__tests__/academies.test.ts` | Actions 테스트 |
| `src/app/(dashboard)/admin/academy/page.tsx` | 학원 관리 페이지 |
| `src/app/(dashboard)/admin/academy/_components/academy-form.tsx` | 학원 수정 폼 |

### 수정 (1개)

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/constants/menu.ts` | 학원 관리 + 학교 관리 메뉴 추가 |

### 삭제: 없음

---

## 8. 사용자 승인 대기 항목

1. **academy-info-card를 별도 컴포넌트로 분리할지?** → admin이 아닌 경우 읽기 전용 카드, admin인 경우 폼을 보여주는 구조에서 카드 컴포넌트를 분리할 가치가 있는지
2. **옵션 A (단순 메뉴 추가) vs 옵션 B (역할 필드 추가)** → 사이드바 메뉴 확장 방식
3. **00004 마이그레이션 Cloud 적용 확인** → 사용자가 Supabase Dashboard에서 확인 필요
