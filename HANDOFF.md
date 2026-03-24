# COMPASS 프로젝트 핸드오프 문서

> **최종 업데이트**: 2026-03-24 (세션 31: 단계 2-1 RBAC 시스템 구현 완료)
> **규칙·워크플로우**: `CLAUDE.md` | **반복 실수·교훈**: `MEMORY.md`

---

## 1. 프로젝트 개요

**COMPASS** — 한국 학원을 위한 AI 기반 학교별 예상시험 생성 플랫폼 (B2B2C)

기술스택: Next.js 16.1.6 + React 19 + Supabase + Google Gemini + Vercel

---

## 2. 현재 진행 상황

### Phase 0 (100% 완료)
- 0-1~0-4: Next.js + Supabase + 레이아웃 + 공통 UI
- 0-5: AI 추상화 레이어 (Factory + Strategy, GeminiProvider, 94개+ 테스트)

### 단계 1: 기출 기반 문제 생성 + 인증 (100% 완료 + E2E 통과)

| 스텝 | 작업 | 상태 |
|------|------|------|
| 1-1 | 인증 시스템 [F010] | 완료 |
| 1-2 | 기출문제 업로드 [F005] | 완료 |
| 1-3 | 학교 관리 CRUD [F008] | 완료 |
| 1-4 | 학원 관리 CRUD [F007] | 완료 |
| 1-5 | 사용자 관리 CRUD [F009] | 완료 |
| 1-6 | 기출문제 조회 [F006] | 완료 (5/5 Steps, 347 tests) |
| 1-7 | 기출 기반 AI 문제 생성 [F011] | 완료 (5/5 Steps, 404 tests) |
| 1-8 | 생성된 문제 저장 [F003] | 완료 (5/5 Steps, 535 tests) |
| 1-9 | 기출문제 추출 | 완료 (8 Steps, 1235 tests, E2E 통과) |

### 단계 1.5-1: LaTeX 수식 렌더링 [F020] (100% 완료) ✅

8 Tasks, 31 tests, E2E 통과 (세션 28)

### 단계 1.5-2: 도형/그래프 렌더링 [F021] (100% 완료) ✅

11 Task + 코드 리뷰 + E2E, 1367 tests (세션 30)

### 단계 2-1: RBAC 시스템 (100% 완료) ✅

| Task | 작업 | 상태 |
|------|------|------|
| Task 1 | 권한 정의 모듈 (roles.ts, route-permissions.ts, index.ts) | 완료 |
| Task 2 | 공유 인증 유틸 (get-current-user.ts + require-role.ts + React 19 cache) | 완료 |
| Task 3 | page.tsx 역할 체크 9개 + layout 수정 + unauthorized 페이지 | 완료 |
| Task 4 | 사이드바/모바일네비 역할별 메뉴 필터링 | 완료 |
| Task 5 | 단위 테스트 23개 (requireRole, getCurrentProfile, ROUTE_PERMISSIONS) | 완료 |
| 코드 리뷰 | security/perf/test 3명 — CRITICAL 0, HIGH 4건 수정 | 완료 |
| E2E | Chrome DevTools MCP 시각적 검증 8개 여정, 콘솔 에러 0건 | 완료 |

### 세션 31 작업 요약

```
1. RBAC 기술 리서치 (3명 병렬: tech/feasibility/devil-advocate)
   → 방식 C(page.tsx 개별 체크) 만장일치 채택
2. PLAN v1 → v2 → v2.1 (리뷰 3회 제한 준수, MUST FIX 4건 반영)
3. Task별 상세 계획 5개 작성
4. Wave 1~4 구현 (Task 1 직렬 → Task 2+4 병렬 → Task 3 직렬 → Task 5)
5. 코드 리뷰: security/perf/test 3명 — HIGH 4건 수정 (런타임 role 가드 + 테스트 4개)
6. E2E 시각적 검증: 8개 여정, 콘솔 에러 0건
7. ROADMAP/PLAN 완료 반영
```

### 이전 세션 (세션 11-30)

- 세션 30: 도형 렌더링 전체 구현 (11 Task, 1367 tests)
- 세션 29: 정리 작업 + 도형 렌더링 PLAN v1
- 세션 28: LaTeX 수식 렌더링 구현 (31 tests, E2E 통과)
- 세션 27: figure crop 제거 + 문서 업데이트
- 세션 26: E2E 테스트 전체 통과 + 버그 수정 4건
- 세션 25: 기출문제 추출 전체 구현 (34개 파일, 1235 tests)
- 세션 19-24: 기출문제 추출 계획 v1→v7
- 세션 11-18: 학습 리뷰 + 학년 필터링 + 1-6~1-8 구현

---

## 3. 다음 작업

### 즉시 해야 할 일 (우선순위순)

1. **단계 2-1 회고 작성**
   - `docs/retrospective/phase-2.1-retro.md` 작성
   - 리서치 팀 3명 병렬, PLAN 리뷰 3회 제한, 방식 C 채택 프로세스 교훈

2. **단계 2-2 성취기준 DB 구축** — ROADMAP.md 참조
   - 성취기준 데이터 스키마
   - 성취기준 데이터 시딩 (교육과정 데이터)
   - 성취기준 검색/필터 API
   - 학년/학기/과목별 조회

3. **Server Action 리팩토링** (독립 이슈 — RBAC에서 분리)
   - getCurrentUserProfile 7가지 변형 → `getCurrentUser()` + `requireRole()` 통합
   - 9개 Action 파일 점진적 교체

### 코드 리뷰 잔여 이슈 (MEDIUM/LOW — 구현 중 처리 가능)

| 등급 | 이슈 |
|------|------|
| MEDIUM | admin/academy `canEdit = true` 하드코딩 → `profile.role === 'admin'` 명시적 계산 권장 |
| MEDIUM | admin/academy `getMyAcademy()` cache() 밖 중복 쿼리 (요청당 5쿼리) → Action 리팩토링과 함께 |
| MEDIUM | `parseLatexText` + `groupAdjacentFigures` useMemo 캐싱 권장 |
| LOW | `color` 필드 색상 정규식, `description` 길이 제한 등 |

---

## 4. 성공한 접근 (재사용할 패턴)

### 개발 패턴
- **Defense in Depth 4중 방어**: page.tsx(requireRole) + 사이드바(UX) + Server Action + RLS
- **React 19 cache()**: layout + page 간 DB 조회 1회 최적화
- **requireRole() Gateway 패턴**: 인증 + 프로필 + 역할 체크를 1줄로 통합
- **ROLES.includes() 런타임 가드**: DB에서 잘못된 role이 와도 타입 안전
- **props drilling (role)**: 소비자 2개일 때 Context보다 단순
- **방식 C (page.tsx 개별 체크)**: Layout pathname 문제 해소, Next.js 공식 권장
- **리서치 팀 3명 병렬**: tech-researcher + feasibility-analyst + devil-advocate → 1페이지 추천안
- **devil-advocate YAGNI 비판**: 8 Task → 5 Task, 30파일 → 17파일 축소
- **Self-referencing ID**: academy_id를 profile에서 추출 → URL 조작 방지
- **TDD RED→GREEN→REFACTOR** 철저 준수
- **PLAN 리뷰 3회 제한**: v1→v2→v2.1 마지막, 과도 반복 방지
- **Wave 병렬 구현**: 파일 소유권 명확 → 충돌 0건
- **E2E 테스트**: Chrome DevTools MCP로 실제 브라우저 자동화

### 학습 방법
- **빈칸 채우기 방식 재구현**: 전체 삭제가 아닌 핵심 로직만 빈칸
- **사용자 수준**: JavaScript 기초(`const`, `await`)부터 설명 필요. 간결하게

### 실패한 접근 (반복하지 말 것)
- **Layout pathname 접근 시도** (v1): App Router에서 Layout은 pathname 접근 불가 → page.tsx 방식으로 전환
- **RoleProvider (React Context)**: 소비자 2개뿐인데 Context는 과잉 → props drilling
- **permissions.ts (행동 기반 권한)**: route-permissions.ts와 중복 → YAGNI 제거
- **canAccessRoute() 함수**: 실질 소비자 0곳 → YAGNI 제거
- **RBAC + Action 리팩토링 동시 진행**: 범위 과다 → 독립 이슈로 분리
- **parent 역할 DB 추가**: 소비자 0명일 때 마이그레이션은 YAGNI → 단계 4로 이동
- **계획 파일 없이 코드 작성**: 반드시 `docs/plan/` 파일 먼저 생성
- **체크리스트 없는 응답**: 모든 응답 첫 줄에 체크리스트 필수

---

## 5. 핵심 참조 문서

| 우선순위 | 문서 |
|---------|------|
| 1 | `CLAUDE.md` — 규칙·워크플로우 |
| 2 | `MEMORY.md` — 반복 실수·기술 교훈 |
| 3 | `ROADMAP.md` — 순차 스텝별 로드맵 |
| 4 | `docs/plan/rbac-system.md` — RBAC 마스터 PLAN v2.1 (완료) |
| 5 | `docs/plan/rbac-task-{1-5}-*.md` — RBAC Task별 상세 계획 (완료) |
| 6 | `docs/reviews/rbac-code-review.md` — RBAC 코드 리뷰 최종 리포트 |
| 7 | `docs/research/tech/rbac-route-protection.md` — 라우트 보호 기술 비교 |
| 8 | `docs/retrospective/phase-1-retro.md` — Phase 1 전체 회고 |

### RBAC 주요 파일 참조

| 기능 | 파일 |
|------|------|
| **Role 타입 + 상수** | `src/lib/auth/roles.ts` |
| **경로-역할 매핑** | `src/lib/auth/route-permissions.ts` (문서화 상수) |
| **getCurrentProfile** | `src/lib/auth/get-current-user.ts` (React 19 cache) |
| **requireRole** | `src/lib/auth/require-role.ts` (page.tsx 가드) |
| **배럴 파일** | `src/lib/auth/index.ts` |
| **403 페이지** | `src/app/(dashboard)/unauthorized/page.tsx` |
| **사이드바 필터** | `src/components/layout/dashboard-sidebar.tsx` (role?: Role) |
| **모바일 네비** | `src/components/layout/mobile-nav.tsx` (role?: Role) |
| **헤더 drilling** | `src/components/layout/dashboard-header.tsx` (role?: Role) |
| **메뉴 정의** | `src/lib/constants/menu.ts` (MenuItem.roles) |
| **테스트** | `src/lib/auth/__tests__/roles.test.ts`, `require-role.test.ts` |

### 환경 설정 (.env.local)

```
GEMINI_API_KEY=... (유료 결제 활성화된 Google Cloud 프로젝트의 키)
GEMINI_MODEL=gemini-2.5-flash (gemini-2.0-flash는 새 프로젝트에서 사용 불가)
```

### 진행 중 이슈

- 마이그레이션 00004: Supabase Cloud에 **미적용** (로컬 파일만 존재)
- 마이그레이션 00005: **수동 적용 완료** (Dashboard SQL Editor에서 실행)
- 마이그레이션 20260315: **수동 적용 완료** (3계층 구조)
- 마이그레이션 20260322: **수동 적용 완료** (Dashboard SQL Editor에서 실행)
- `await cookies()` 필수 (Next.js 16 비동기)
- 시드 데이터 UUID가 비표준 → Zod `.uuid()` 대신 `.min(1)` 사용 중
- 기존 extract-questions.test.ts 실패 2건 — 이번 작업과 무관 (사전 존재)
- Server Action 인증 헬퍼 7가지 변형 중복 → 독립 리팩토링 이슈로 관리
