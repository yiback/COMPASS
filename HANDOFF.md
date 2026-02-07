# COMPASS 프로젝트 핸드오프 문서

> **최종 업데이트**: 2026-02-07
> **대상**: 이 프로젝트를 이어받는 새로운 에이전트

---

## 1. Goal (목표)

**COMPASS**는 한국 학원을 위한 AI 기반 학교별 예상시험 생성 플랫폼이다.

- **비즈니스 모델**: B2B2C (학원 → 학생)
- **핵심 가치**: 학교별 맞춤 시험 예측으로 학원의 경쟁력 강화
- **타겟**: 소형~중형 보습학원, 중등 수학부터 시작
- **현재 Phase**: 0-4 (공통 UI 컴포넌트 완료), **Supabase 연동 완료**

기술스택: Next.js 16.1.6 + React 19 + Supabase + Google Gemini + Vercel

---

## 2. Current Progress (현재 진행 상황)

### 완료된 작업

#### 기획 문서 (12개, ~7,000줄)
- PRD 요약 + 상세, 개발요구사항, 기술스택
- 개발 가이드 5종 (컴포넌트 패턴, 폼, 스타일링, Next.js 15, 프로젝트 구조)
- 개발 로드맵 (`ROADMAP.md`)

#### 시스템 아키텍처 설계
- `docs/design/시스템아키텍처.md` - 5개 레이어 아키텍처, RBAC, AI Provider Pattern
- `supabase/migrations/00001_initial_schema.sql` - 15개 테이블 + 트리거
- `supabase/migrations/00002_rls_policies.sql` - 멀티테넌시 RLS 정책
- `supabase/migrations/00003_indexes.sql` - 성능 인덱스 (부분/복합 포함)
- `supabase/seed.sql` - 개발용 시드 데이터 (학원 2개, 학교 5개, 성취기준 24개)

#### DB 리뷰 반영 (보안 + 무결성)
- `handle_new_user()` 트리거: role을 `'student'`로 고정 (권한 상승 방지)
- questions/past_exams RLS에 `admin` 역할 추가
- profiles.academy_id NOT NULL 제약 (system_admin 제외)
- CHECK 제약: score >= 0, year BETWEEN 2000-2100, order_number > 0

#### Phase 0-1: 프로젝트 초기화 (완료)
- **Next.js 16.1.6 + React 19 + TypeScript** 프로젝트 셋업
- **TailwindCSS v4 + shadcn/ui** (New York 스타일, Neutral base, CSS variables)
- **추가 의존성**: @supabase/supabase-js, @supabase/ssr, react-hook-form, @hookform/resolvers, zod
- **Prettier** 설정 (semi: false, singleQuote: true, tailwind 플러그인)
- **ESLint** flat config (core-web-vitals + typescript)
- **프로젝트 구조**: `src/components/{ui,layout,providers}`, `src/lib/supabase`, `src/hooks`, `src/types`
- **홈페이지**: COMPASS 제목 + shadcn Button 렌더링 (동작 확인용)
- **검증**: `npm run build` 에러 0, `npm run lint` 에러 0

#### Phase 0-2: Supabase 연동 (완료)
- **Supabase Cloud 프로젝트 생성**: Docker 없이 클라우드 프로젝트 사용
- **환경변수 설정**: `.env.local` (NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY)
- **마이그레이션 실행**: 15개 테이블 + RLS 정책 + 인덱스 (Supabase SQL Editor)
- **시드 데이터**: academies 2개, schools 5개, achievement_standards 24개
- **Supabase 클라이언트 코드**:
  - `src/lib/supabase/client.ts` - 브라우저 클라이언트 (Client Components)
  - `src/lib/supabase/server.ts` - 서버 클라이언트 (Server Components, Actions)
  - `src/lib/supabase/admin.ts` - Admin 클라이언트 (RLS 우회, service_role)
  - `src/lib/supabase/types.ts` - TypeScript 타입 정의 (placeholder)
- **Middleware**: `src/middleware.ts` - Supabase 세션 갱신
- **연결 테스트**: `src/app/test/page.tsx` - academies 데이터 조회 성공
- **검증**: `npm run build` 성공, Supabase 연결 확인

#### 프로젝트 표준 문서 생성 (완료)
- **shrimp-rules.md**: AI 에이전트용 프로젝트 개발 표준 문서 자동 생성
- **내용**: 12개 섹션 (아키텍처, Supabase 규칙, Next.js 16 특화, 보안, 금지 사항 등)
- **특징**: DO/DON'T 예시, 의사결정 플로우차트, 명령형 언어
- **목적**: 새로운 AI 에이전트의 자율 작업 실행을 위한 명확한 가이드라인

#### Phase 0-3: Route Groups 및 기본 레이아웃 (완료)
- **Route Groups 생성**: `(dashboard)`, `(auth)` 디렉토리 구조
- **대시보드 레이아웃**: `app/(dashboard)/layout.tsx` - 사이드바 + 헤더 (반응형)
- **대시보드 페이지**: `/` (홈), `/past-exams`, `/generate`, `/settings`
- **shadcn/ui 컴포넌트 추가**: Sheet (모바일 메뉴), Avatar, Separator
- **네비게이션**: `src/lib/constants/menu.ts` - 메뉴 항목 정의
- **컴포넌트**:
  - `src/components/layout/dashboard-sidebar.tsx` - 데스크톱 사이드바
  - `src/components/layout/dashboard-header.tsx` - 헤더 (프로필 + 모바일 메뉴)
  - `src/components/layout/mobile-nav.tsx` - 모바일 Sheet 네비게이션
- **검증**: 빌드/린트 성공, 반응형 동작 확인

#### Phase 0-4: 공통 UI 컴포넌트 (완료)
- **shadcn/ui 15개 컴포넌트 설치**: form, input, textarea, select, checkbox, label, radio-group, table, card, badge, dialog, alert-dialog, dropdown-menu, sonner, skeleton
- **DataTable 컴포넌트** (TanStack Table 기반):
  - `src/components/data-table/data-table.tsx` - 메인 (정렬, 필터, 페이지네이션, 행 선택)
  - `src/components/data-table/data-table-column-header.tsx` - 컬럼 헤더 (정렬/숨기기)
  - `src/components/data-table/data-table-pagination.tsx` - 페이지네이션 UI
  - `src/components/data-table/data-table-toolbar.tsx` - 검색/필터 툴바
  - `src/components/data-table/index.ts` - 배럴 export
- **Loading/Skeleton 컴포넌트**:
  - `src/components/loading/card-skeleton.tsx` - 카드 스켈레톤
  - `src/components/loading/table-skeleton.tsx` - 테이블 스켈레톤
  - `src/components/loading/form-skeleton.tsx` - 폼 스켈레톤
  - `src/components/loading/spinner.tsx` - 로딩 스피너 (sm/md/lg)
  - `src/components/loading/index.ts` - 배럴 export
- **Toast 시스템**: Sonner 전역 설정 (layout.tsx) + `src/lib/toast.ts` 헬퍼 (showActionResult, showPromiseToast)
- **검증**: `npm run build` 성공, `npm run lint` 에러 0

### 미완료 작업

- **PRD-v0.1-detailed.md의 상대경로 오류**: `./기술스택.md` → `../design/기술스택.md` (3곳 미수정)
- **TypeScript 타입 자동 생성**: `supabase gen types`로 실제 DB 스키마에서 타입 생성 (현재는 placeholder)

---

## 3. What Worked (성공한 접근)

- **임시 디렉토리에 create-next-app 후 복사**: 기존 docs/, supabase/, .claude/ 파일을 안전하게 보존하면서 Next.js 초기화 성공
- **shadcn init --defaults**: 인터랙티브 프롬프트 없이 New York/Neutral/CSS variables로 자동 설정
- **create-next-app --yes 플래그**: React Compiler 질문 등 인터랙티브 프롬프트 자동 스킵
- **turbopack.root 설정**: 상위 디렉토리 package-lock.json으로 인한 경고를 `path.resolve(__dirname)`으로 해결
- **database-reviewer 에이전트로 SQL 리뷰**: CRITICAL 보안 이슈 3건 발견 (트리거 권한 상승, admin 역할 누락, RLS 성능)
- **Service Layer 분리 패턴**: Server Actions → Service Layer 구조로 Phase 2+ NestJS 전환 비용 최소화
- **Supabase Cloud 선택**: Docker Desktop 없이도 빠른 시작. SQL Editor로 마이그레이션 직접 실행
- **seed.sql UUID 형식 수정**: `s0000000-...` → `b0000000-...` (s는 16진수가 아님)
- **RLS 테스트용 admin 클라이언트**: 로그인 없이 데이터 확인 시 service_role 키 사용
- **init project rules 도구**: MCP `mcp__shrimp-task-manager__init_project_rules` 사용하여 프로젝트 자동 분석 및 표준 문서 생성
- **shrimp-task-manager 활용**: `plan_task` → `analyze_task` → `reflect_task` → `split_tasks` 플로우로 Phase 0-4 계획 수립
- **TanStack Table + shadcn/ui 조합**: DataTable 구현 시 shadcn/ui 공식 가이드 패턴 준수 (커스텀 구현보다 검증된 패턴)
- **Sonner (Toast)**: shadcn/ui toast보다 Sonner 선택 (더 현대적, API 단순, 스택 관리 자동)

---

## 4. What Didn't Work (실패/주의사항)

- **create-next-app 인터랙티브 프롬프트**: `--yes` 플래그 없이 실행하면 React Compiler 질문에서 멈춤. 반드시 `--yes` 추가.
- **next.config.ts에서 import.meta.url 사용 불가**: `fileURLToPath(import.meta.url)` 패턴이 Next.js config 컴파일에서 `exports is not defined` 에러 발생. `__dirname`은 사용 가능.
- **turbopack.root에 상대경로('.') 사용 불가**: 절대경로 필요. `path.resolve(__dirname)` 사용.
- **handle_new_user() 트리거에서 role을 사용자 입력으로 읽으면 안 됨**: 공격자가 `raw_user_meta_data`에 `role: 'admin'`을 넣어 권한 상승 가능. 반드시 `'student'` 고정.
- **RLS 정책에서 admin 역할 누락하기 쉬움**: 교사 권한 정책 작성 시 `['teacher', 'system_admin']`만 넣고 `'admin'`을 빠뜨린 곳이 6군데. 항상 `['teacher', 'admin', 'system_admin']`으로.

---

## 5. Next Steps (다음 단계)

### 🚨 즉시 해야 할 일 (Phase 0-5: AI 추상화 레이어)

1. **AI Provider 인터페이스 설계** - Factory + Strategy 패턴
2. **Google Gemini 연동** - 첫 번째 Provider 구현체
3. **프롬프트 템플릿 시스템** - 문제 생성용 프롬프트 구조화
4. **응답 파싱/검증 유틸리티** - AI 응답을 구조화된 데이터로 변환
5. **에러 핸들링 및 재시도 로직** - 안정적인 AI 호출

### 그 다음 (ROADMAP.md 단계 1 참조)

6. **단계 1 트랙 B: 인증 시스템** - Supabase Auth + 로그인/회원가입 페이지
7. **단계 1 트랙 B: 기본 CRUD UI** - 학원/학교/사용자 관리
8. **단계 1 트랙 A: 기출문제 업로드** - 이미지/PDF 업로드 + Storage
9. **RBAC 미들웨어 강화**: 역할별 라우트 가드 (Middleware에서 검증)

---

## 6. Architecture Decisions (주요 아키텍처 결정)

| 결정 | 이유 |
|------|------|
| 5개 레이어 아키텍처 | 프레젠테이션/비즈니스/AI/데이터/횡단 관심사 분리 |
| Server Actions + Service Layer | MVP 속도 + Phase 2 NestJS 전환 시 Service Layer 재사용 |
| AI Provider Pattern (Factory + Strategy) | Gemini → OpenAI/Claude 엔진 교체를 Factory에 case 추가로 해결 |
| Supabase RLS 멀티테넌시 | academy_id 기반 데이터 격리, 3중 보안 (Middleware + Server Action + RLS) |
| Route Groups: (auth)/(dashboard) | URL 영향 없이 레이아웃 분리 |
| ActionResult<T> 통일 응답 | `{ success: true, data } | { success: false, error }` |

---

## 7. 프로젝트 디렉토리 구조 (현재)

```
compass/
├── CLAUDE.md                          # 개발 지침 (메인 진입점)
├── HANDOFF.md                         # 이 문서
├── ROADMAP.md                         # 개발 로드맵
├── shrimp-rules.md                    # AI 에이전트용 프로젝트 표준 문서 (자동 생성)
├── package.json                       # Next.js 16.1.6, React 19, Supabase, RHF, Zod
├── tsconfig.json                      # TypeScript strict, @/* alias
├── next.config.ts                     # Turbopack root 설정
├── postcss.config.mjs                 # TailwindCSS v4
├── eslint.config.mjs                  # Flat config (core-web-vitals + TS)
├── components.json                    # shadcn/ui (New York, Neutral, CSS vars)
├── .prettierrc                        # semi: false, singleQuote: true
├── .prettierignore
├── .env.local.example                 # 환경변수 템플릿
├── .gitignore
├── docs/
│   ├── PRD.md                         # MVP PRD 요약
│   ├── prd/
│   │   └── PRD-v0.1-detailed.md       # PRD 상세
│   ├── design/
│   │   ├── 시스템아키텍처.md            # 시스템 아키텍처
│   │   ├── 기술스택.md                 # 기술스택 정의
│   │   └── 개발요구사항.md              # 개발 요구사항
│   └── guides/
│       ├── project-structure.md       # 프로젝트 구조
│       ├── component-patterns.md      # 컴포넌트 패턴
│       ├── forms-react-hook-form.md   # 폼 가이드
│       ├── styling-guide.md           # 스타일링 가이드
│       └── nextjs-15.md               # Next.js 15 가이드
├── public/                            # 정적 파일 (favicon만 존재)
├── supabase/
│   ├── migrations/
│   │   ├── 00001_initial_schema.sql   # 15개 테이블 + 트리거
│   │   ├── 00002_rls_policies.sql     # 멀티테넌시 RLS 정책
│   │   └── 00003_indexes.sql          # 성능 인덱스
│   └── seed.sql                       # 개발용 시드 데이터
└── src/
    ├── app/
    │   ├── globals.css                # TailwindCSS v4 + shadcn CSS 변수
    │   ├── layout.tsx                 # 루트 레이아웃 (lang="ko", COMPASS 메타데이터)
    │   ├── page.tsx                   # 홈 리다이렉트 → /dashboard
    │   ├── favicon.ico
    │   ├── (dashboard)/               # Route Group - 대시보드
    │   │   ├── layout.tsx             # 사이드바 + 헤더 레이아웃
    │   │   ├── page.tsx               # 대시보드 홈 (/)
    │   │   ├── past-exams/page.tsx    # 기출문제
    │   │   ├── generate/page.tsx      # 시험 생성
    │   │   └── settings/page.tsx      # 설정
    │   └── middleware.ts              # Supabase 세션 갱신
    ├── components/
    │   ├── ui/                        # shadcn/ui 컴포넌트 (19개)
    │   │   ├── button, sheet, avatar, separator (기존 4개)
    │   │   ├── form, input, textarea, select, checkbox, label, radio-group (폼 7개)
    │   │   ├── table, card, badge (데이터 3개)
    │   │   ├── dialog, alert-dialog, dropdown-menu (오버레이 3개)
    │   │   └── sonner, skeleton (피드백 2개)
    │   ├── data-table/                # DataTable 컴포넌트 (TanStack Table)
    │   │   ├── data-table.tsx         # 메인 (정렬/필터/페이지네이션)
    │   │   ├── data-table-column-header.tsx  # 컬럼 헤더
    │   │   ├── data-table-pagination.tsx     # 페이지네이션
    │   │   ├── data-table-toolbar.tsx        # 검색/필터 툴바
    │   │   └── index.ts
    │   ├── loading/                   # Loading/Skeleton 컴포넌트
    │   │   ├── card-skeleton.tsx, table-skeleton.tsx, form-skeleton.tsx
    │   │   ├── spinner.tsx            # sm/md/lg 스피너
    │   │   └── index.ts
    │   ├── layout/
    │   │   ├── dashboard-sidebar.tsx  # 데스크톱 사이드바
    │   │   ├── dashboard-header.tsx   # 헤더 (프로필 + 모바일)
    │   │   └── mobile-nav.tsx         # 모바일 Sheet 네비게이션
    │   └── providers/                 # (빈 디렉토리)
    ├── lib/
    │   ├── utils.ts                   # cn() 유틸
    │   ├── toast.ts                   # Toast 헬퍼 (showActionResult, showPromiseToast)
    │   ├── constants/
    │   │   └── menu.ts                # 메뉴 항목 정의
    │   └── supabase/
    │       ├── client.ts              # 브라우저 클라이언트
    │       ├── server.ts              # 서버 클라이언트
    │       ├── admin.ts               # Admin 클라이언트 (RLS 우회)
    │       └── types.ts               # TypeScript 타입 (placeholder)
    ├── hooks/                         # (빈 디렉토리)
    └── types/                         # (빈 디렉토리)
```

### 핵심 참조 문서 (우선순위 순)

1. **`shrimp-rules.md`** - AI 에이전트용 프로젝트 표준 문서 (자동 생성, DO/DON'T 예시 포함)
2. `CLAUDE.md` - 프로젝트 개발 지침 및 기술스택 요약
3. `docs/design/시스템아키텍처.md` - 아키텍처, DB 스키마, 데이터 흐름
4. `ROADMAP.md` - 단계별 개발 로드맵
5. `docs/design/기술스택.md` - 상세 기술스택 및 Phase 전환 전략
6. `docs/prd/PRD-v0.1-detailed.md` - 기능 명세 및 페이지별 상세

### DB 스키마 (15개 테이블)

| 구분 | 테이블 | 핵심 |
|------|--------|------|
| 인프라 | academies, profiles, schools | 멀티테넌시 기반 |
| 확장 | students, teachers | profiles 1:1 관계 |
| 교육과정 | achievement_standards | 교육부 성취기준 |
| 문제 | questions, past_exam_questions | AI 생성 + 기출 |
| 시험 | exams, exam_questions | M:N 관계 |
| 채점 | exam_submissions, answers | AI 채점 + 교사 검수 |
| 분석 | wrong_answer_notes, grade_appeals | 오답 + 이의제기 |
| 모니터링 | ai_generation_logs | AI 사용 로그 |

---

## 8. 개발 명령어

```bash
# 기본 명령어
npm run dev      # 개발 서버 (Turbopack)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run start    # 프로덕션 서버

# shrimp-task-manager 명령어 (Phase 0-4)
mcp__shrimp-task-manager__list_tasks status=all
mcp__shrimp-task-manager__get_task_detail taskId=<ID>
mcp__shrimp-task-manager__execute_task taskId=<ID>
mcp__shrimp-task-manager__verify_task taskId=<ID> score=<0-100> summary="..."
```

---

## 9. 설치된 패키지 요약

### Dependencies
- `@tanstack/react-table` - DataTable용 (Phase 0-4에서 추가)
- `sonner` - Toast 알림 (shadcn/ui 의존성으로 자동 설치)
- `next-themes` - 테마 관리 (shadcn/ui 의존성으로 자동 설치, 미사용)

### shadcn/ui 컴포넌트 (총 19개)
- 기존: button, sheet, avatar, separator
- Phase 0-4 추가: form, input, textarea, select, checkbox, label, radio-group, table, card, badge, dialog, alert-dialog, dropdown-menu, sonner, skeleton
