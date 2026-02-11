# 단계 1 — 라운드 1: 인증 시스템 상세 계획

> **상태**: ✅ 완료 (Step 1-8 전체 완료, 122개 테스트 통과)
> **마지막 업데이트**: 2026-02-11
> **모델**: Sonnet (순차 실행)
> **전제 조건**: Phase 0 (100% 완료)

---

## 목표

로그인/회원가입/비밀번호 재설정 + 라우트 보호를 구현하여,
라운드 2 (트랙 A/B) 모두가 인증된 사용자 기반으로 동작할 수 있게 한다.

---

## 설계 결정

| 항목 | 결정 | 근거 |
|------|------|------|
| 인증 방식 | 이메일/비밀번호만 | MVP. 소셜 로그인은 단계 2+ |
| 학원 연결 | invite_code 입력 | 가입 시 학원 코드로 academy_id 연결 |
| 역할 부여 | 기본 student, 관리자가 변경 | 보안: 트리거에서 role 고정 |
| 폼 패턴 | useActionState + Server Actions | React 19 표준, 점진적 향상 |

---

## Step 별 상세

### Step 1: DB 마이그레이션 ✅

**파일**: `supabase/migrations/00004_academy_invite_code.sql`

- `academies.invite_code TEXT UNIQUE` 컬럼 추가
- `idx_academies_invite_code` 인덱스 생성
- `handle_new_user()` 트리거 수정: metadata에서 `academy_id` 읽어 profiles에 저장
- 보안: role은 여전히 'student' 고정, academy_id 유효성은 Server Action에서 사전 검증

### Step 2: Zod 검증 스키마 + Server Actions ✅

**파일**:
- `src/lib/validations/auth.ts` — 3개 스키마 (login, signup, forgotPassword)
- `src/lib/actions/auth.ts` — 4개 액션 (login, signup, logout, resetPassword)

**패턴**:
```typescript
// useActionState 호환 시그니처
export async function loginAction(
  _prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult>
```

**핵심 로직 (signup)**:
1. Zod 검증 → 실패 시 에러 반환
2. admin 클라이언트로 invite_code → academy_id 조회
3. `supabase.auth.signUp({ options: { data: { name, academy_id } } })`
4. 트리거가 profiles 자동 생성 (academy_id 포함)
5. `/login?message=signup-success`로 리다이렉트

### Step 3: (auth) 레이아웃 + 로그인 페이지 ✅

**파일**:
- `src/app/(auth)/layout.tsx` — 중앙 정렬 심플 레이아웃
- `src/app/(auth)/login/page.tsx` — 이메일/비밀번호 폼

**재사용**: Card, Input, Button, Label (shadcn/ui)

### Step 4: 회원가입 페이지 ✅

**파일**: `src/app/(auth)/signup/page.tsx`

**폼 필드**: 이름, 이메일, 비밀번호, 비밀번호 확인, 학원 코드

### Step 5: 비밀번호 재설정 + Auth Callback ✅

**파일**:
- `src/app/(auth)/forgot-password/page.tsx` — 이메일 입력 폼
- `src/app/(auth)/auth/callback/route.ts` — Supabase code 교환

**콜백 로직**:
- `type=recovery` → `/settings` (비밀번호 변경 UI)
- 이메일 확인 → `/dashboard`
- code 없음 → `/login`

### Step 6: 미들웨어 확장 ✅

**파일**: `src/middleware.ts` (수정)

**변경 사항**:
- `PUBLIC_ROUTES` 배열로 공개 경로 관리
- 비인증 + 보호 경로 → `/login?redirect=원래경로`
- 인증 + auth 페이지 → `/dashboard`
- `/auth/callback`은 인증 사용자도 접근 허용

### Step 7: 대시보드 인증 체크 + 로그아웃 ✅

**수정 파일**:
- `src/app/(dashboard)/layout.tsx` — `if (!authUser) redirect('/login')` 추가
- `src/components/layout/dashboard-header.tsx` — LogoutButton 추가
- `src/components/layout/logout-button.tsx` — 신규 생성

### Step 8: 테스트 ✅

**파일**:
- `src/lib/validations/__tests__/auth.test.ts` — Zod 스키마 단위 테스트 (14개)
- `src/lib/actions/__tests__/auth.test.ts` — Server Actions 테스트 (11개, 모킹)

**검증 결과**: 122개 테스트 통과, `npm run build` 통과, `npm run lint` 에러 0

---

## 파일 목록 (총 13개 신규, 3개 수정)

| 작업 | 파일 | 신규/수정 |
|------|------|-----------|
| DB | `supabase/migrations/00004_academy_invite_code.sql` | 신규 |
| 검증 | `src/lib/validations/auth.ts` | 신규 |
| Actions | `src/lib/actions/auth.ts` | 신규 |
| 레이아웃 | `src/app/(auth)/layout.tsx` | 신규 |
| 로그인 | `src/app/(auth)/login/page.tsx` | 신규 |
| 가입 | `src/app/(auth)/signup/page.tsx` | 신규 |
| 리셋 | `src/app/(auth)/forgot-password/page.tsx` | 신규 |
| Callback | `src/app/(auth)/auth/callback/route.ts` | 신규 |
| 로그아웃 | `src/components/layout/logout-button.tsx` | 신규 |
| 검증 테스트 | `src/lib/validations/__tests__/auth.test.ts` | 신규 |
| 액션 테스트 | `src/lib/actions/__tests__/auth.test.ts` | 신규 |
| 미들웨어 | `src/middleware.ts` | 수정 |
| 대시보드 | `src/app/(dashboard)/layout.tsx` | 수정 |
| 헤더 | `src/components/layout/dashboard-header.tsx` | 수정 |

---

## 검증 방법

```bash
npm run test:run       # Zod + Server Action 테스트 통과
npm run build          # TypeScript 빌드 통과
npm run lint           # ESLint 통과
```

### 수동 테스트 시나리오

1. 비인증 상태에서 `/dashboard` 접근 → `/login` 리다이렉트
2. 잘못된 학원 코드로 가입 → 에러 메시지
3. 올바른 학원 코드로 가입 → 이메일 확인 안내
4. 이메일 확인 후 로그인 → 대시보드 표시
5. 로그인 상태에서 `/login` 접근 → `/dashboard` 리다이렉트
6. 로그아웃 → `/login`으로 이동
