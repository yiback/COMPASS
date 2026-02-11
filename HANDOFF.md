# COMPASS 프로젝트 핸드오프 문서

> **최종 업데이트**: 2026-02-11 (단계 1 라운드 1 완료 반영)
> **대상**: 이 프로젝트를 이어받는 새로운 에이전트

---

## 1. Goal (목표)

**COMPASS**는 한국 학원을 위한 AI 기반 학교별 예상시험 생성 플랫폼이다.

- **비즈니스 모델**: B2B2C (학원 → 학생)
- **핵심 가치**: 학교별 맞춤 시험 예측으로 학원의 경쟁력 강화
- **현재 Phase**: 단계 1 (기출 기반 문제 생성 + 인증)
- **현재 진행**: 라운드 1 (인증 시스템) 완료, 라운드 2 미시작

기술스택: Next.js 16.1.6 + React 19 + Supabase + Google Gemini + Vercel

---

## 2. Current Progress (현재 진행 상황)

### Phase 0 (100% 완료)

- **0-1~0-4**: Next.js + Supabase + 레이아웃 + 공통 UI 컴포넌트
- **0-5**: AI 추상화 레이어 (Factory + Strategy 패턴, GeminiProvider, 97개 테스트)

### 단계 1 라운드 1: 인증 시스템 (100% 완료)

| Step | 작업 | 파일 | 상태 |
|------|------|------|------|
| 1 | DB 마이그레이션 (invite_code + 트리거) | `supabase/migrations/00004_academy_invite_code.sql` | ✅ |
| 2 | Zod 스키마 + Server Actions | `src/lib/validations/auth.ts`, `src/lib/actions/auth.ts` | ✅ |
| 3 | (auth) 레이아웃 + 로그인 | `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx` | ✅ |
| 4 | 회원가입 (학원 코드) | `src/app/(auth)/signup/page.tsx` | ✅ |
| 5 | 비밀번호 재설정 + Callback | `src/app/(auth)/forgot-password/page.tsx`, `src/app/(auth)/auth/callback/route.ts` | ✅ |
| 6 | 미들웨어 확장 (라우트 보호) | `src/middleware.ts` (수정) | ✅ |
| 7 | 대시보드 인증 체크 + 로그아웃 | `src/app/(dashboard)/layout.tsx` (수정), `src/components/layout/logout-button.tsx` (신규), `dashboard-header.tsx` (수정) | ✅ |
| 8 | 테스트 + 빌드 검증 | 테스트 25개 통과, 빌드/린트 OK | ✅ |

**검증 결과**: 122개 테스트 통과, `npm run build` 통과, `npm run lint` 에러 0

### 단계 1 라운드 2: 미시작

- **트랙 A**: 기출문제 업로드 + AI 문제 생성 (A-1 ~ A-4)
- **트랙 B**: CRUD UI — 학교/사용자/학원 관리 (B-1 ~ B-3)
- 상세 계획: `docs/plan/phase-1-round2-track-a.md`, `docs/plan/phase-1-round2-track-b.md`

---

## 3. What Worked (성공한 접근)

### 라운드 1 인증 구현
- **`useActionState` + Server Actions**: React 19 표준 패턴, 점진적 향상
- **`useSearchParams()`는 Suspense 필수**: `LoginMessages` 컴포넌트 분리 + `<Suspense>` 래핑으로 해결
- **handle_new_user 트리거 수정**: metadata에서 `academy_id` 읽어 profiles에 자동 저장. 유효성은 Server Action에서 사전 검증
- **미들웨어 + 레이아웃 이중 보호**: middleware에서 리다이렉트 + dashboard layout에서 `if (!authUser) redirect('/login')`
- **DB placeholder 타입 단언**: Supabase DB 타입이 placeholder이므로 쿼리 결과에 `as { data: { id: string } | null; error: unknown }` 타입 단언 사용

### Phase 0에서 이어온 것
- **TDD RED→GREEN→REFACTOR** 철저 준수
- **Zod v4 `toJSONSchema()` 내장 활용**
- **SDK 에러 duck typing**: `error.name === 'ApiError'` → vi.mock 환경 호환

---

## 4. What Didn't Work (실패/주의사항)

### 라운드 1 빌드 에러 2건 (수정 완료)
- **`academy.id` 타입 `never` 문제**: DB 타입이 placeholder (`[_ in string]`)이므로 Supabase 쿼리 결과가 `never`로 추론됨. 명시적 타입 단언 필요
- **`useSearchParams()` SSG 호환 불가**: 빌드 시 `useSearchParams() should be wrapped in a suspense boundary` 에러. Suspense로 감싸야 함

### 이전 Phase에서의 교훈 (여전히 유효)
- **`next.config.ts`에서 `import.meta.url` 사용 불가**: `__dirname` 사용
- **handle_new_user 트리거에서 role 고정**: 항상 `'student'`, 사용자 입력 금지
- **seed.sql UUID `s0000000-...` 유효하지 않음**: `b0000000-...` 사용
- **RLS 정책에서 admin 역할 누락 주의**: 교사 권한에 admin도 포함

---

## 5. Next Steps (다음 단계)

### 🚨 즉시 해야 할 일: 단계 1 라운드 2 (병렬 실행)

상세 계획은 아래 문서 참조:
- `docs/plan/phase-1-round2-track-a.md` — 트랙 A 상세
- `docs/plan/phase-1-round2-track-b.md` — 트랙 B 상세

#### 트랙 A: 기출문제 + AI 문제 생성

| Step | 내용 | 핵심 파일 |
|------|------|-----------|
| A-1 | Storage 버킷 + 기출문제 업로드 | `00005_storage_buckets.sql`, `actions/past-exams.ts`, `past-exams/upload/page.tsx` |
| A-2 | 기출문제 목록/검색/상세 | `past-exams/page.tsx` (수정), `past-exams/[id]/page.tsx` |
| A-3 | AI 문제 생성 페이지 | `generate/page.tsx` (수정), `actions/generate.ts` |
| A-4 | 문제 저장/목록/상세 | `actions/questions.ts`, `questions/page.tsx`, `questions/[id]/page.tsx` |

#### 트랙 B: CRUD UI

| Step | 내용 | 핵심 파일 |
|------|------|-----------|
| B-1 | 학교 관리 CRUD | `actions/schools.ts`, `admin/schools/page.tsx`, `new/page.tsx`, `[id]/edit/page.tsx` |
| B-2 | 사용자 관리 (역할 변경) | `actions/users.ts`, `admin/users/page.tsx`, `[id]/page.tsx` |
| B-3 | 학원 정보 관리 | `actions/academies.ts`, `admin/academy/page.tsx` |

#### 충돌 방지
- 공통 수정 파일: `src/lib/constants/menu.ts`만 — **트랙 B에서만 수정**, 트랙 A 메뉴는 나중에 추가
- 트랙 A: `past-exams/`, `generate/`, `questions/` 경로
- 트랙 B: `admin/` 경로

### 실행 방식
- **모델**: Sonnet (두 워커 모두)
- **방식**: tmux split pane으로 트랙 A/B 동시 실행 (`/orchestrate`)
- **검증**: `npm run build && npm run lint && npm run test:run`

### 그 이후
- 단계 2: 시험지 조합 + 배포 (ROADMAP.md 참조)

---

## 6. Architecture Decisions (주요 아키텍처 결정)

| 결정 | 이유 |
|------|------|
| 5개 레이어 아키텍처 | 프레젠테이션/비즈니스/AI/데이터/횡단 관심사 분리 |
| Server Actions + Service Layer | MVP 속도 + Phase 2 NestJS 전환 시 재사용 |
| AI Provider Pattern (Factory + Strategy) | Gemini → OpenAI/Claude 교체를 Factory에 case 추가로 해결 |
| Supabase RLS 멀티테넌시 | academy_id 기반 데이터 격리, 3중 보안 |
| Route Groups: (auth)/(dashboard) | URL 영향 없이 레이아웃 분리 |
| 이메일/비밀번호 인증만 | MVP. 소셜 로그인은 단계 2+ |
| invite_code 기반 학원 연결 | 가입 시 학원 코드 입력 → academy_id 자동 연결 |
| useActionState + Server Actions | React 19 표준 폼 패턴, 점진적 향상 |

---

## 7. 프로젝트 구조 (인증 추가 후)

```
src/
├── app/
│   ├── (auth)/                    # 인증 라우트 그룹 (신규)
│   │   ├── layout.tsx             # 심플 중앙 레이아웃
│   │   ├── login/page.tsx         # 로그인 폼
│   │   ├── signup/page.tsx        # 회원가입 폼
│   │   ├── forgot-password/page.tsx # 비밀번호 재설정
│   │   └── auth/callback/route.ts # Supabase 토큰 교환
│   ├── (dashboard)/               # 대시보드 (인증 필수)
│   │   ├── layout.tsx             # 사이드바+헤더 (인증 체크 강화)
│   │   ├── page.tsx, generate/, past-exams/, settings/
│   └── layout.tsx, page.tsx
├── components/layout/
│   ├── logout-button.tsx          # 로그아웃 버튼 (신규)
│   ├── dashboard-header.tsx       # 헤더 (로그아웃 추가)
│   └── ...
├── lib/
│   ├── actions/auth.ts            # 인증 Server Actions (신규)
│   ├── validations/auth.ts        # 인증 Zod 스키마 (신규)
│   ├── ai/                        # AI 추상화 레이어
│   └── supabase/                  # Supabase 클라이언트 3종
├── middleware.ts                   # 라우트 보호 (수정)
```

---

## 8. 개발 명령어

```bash
npm run dev            # 개발 서버 (Turbopack)
npm run build          # 프로덕션 빌드
npm run lint           # ESLint
npm run test:run       # Vitest 단일 실행 (122개 테스트)

# 단일 테스트 파일 실행
npx vitest run src/lib/actions/__tests__/auth.test.ts
```

---

## 9. 핵심 참조 문서 (우선순위 순)

1. `CLAUDE.md` — 프로젝트 개발 지침 및 기술스택 요약
2. `docs/plan/phase-1-round1.md` — 라운드 1 상세 계획 (완료)
3. `docs/plan/phase-1-round2-track-a.md` — 트랙 A 상세 계획 (다음)
4. `docs/plan/phase-1-round2-track-b.md` — 트랙 B 상세 계획 (다음)
5. `docs/design/시스템아키텍처.md` — 아키텍처, DB 스키마, 데이터 흐름
6. `ROADMAP.md` — 단계별 개발 로드맵
7. `docs/prd/PRD-v0.1-detailed.md` — 기능 명세 및 페이지별 상세

---

## 10. 알려진 제약 (의도적 MVP 제한)

- DB 타입: placeholder (`supabase gen types` 미실행 상태)
- `questions.content = TEXT`: 수식은 LaTeX 마크업, 그래프/이미지 미지원
- 지문형 문제 미지원 (영어 지문+복수문제 구조 없음)
- 소셜 로그인 미지원 (이메일/비밀번호만)
- 마이그레이션 00004는 Supabase Cloud에 **아직 미적용** (로컬 파일만 생성)
