# COMPASS 프로젝트 핸드오프 문서

> **최종 업데이트**: 2026-02-19 (1-5 사용자 관리 CRUD 전체 완료, **1-6 시작 대기**)
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

### 단계 1: 기출 기반 문제 생성 + 인증 (63% 완료)

| 스텝 | 작업 | 상태 |
|------|------|------|
| 1-1 | 인증 시스템 [F010] | ✅ 완료 |
| 1-2 | 기출문제 업로드 [F005] | ✅ 완료 |
| 1-3 | 학교 관리 CRUD [F008] | ✅ 완료 |
| 1-4 | 학원 관리 CRUD [F007] | ✅ 완료 |
| 1-5 | 사용자 관리 CRUD [F009] | ✅ 완료 |
| **1-6** | **기출문제 조회 [F006]** | **⏳ 다음 작업** |
| 1-7 | 기출 기반 AI 문제 생성 [F011] | 미시작 |
| 1-8 | 생성된 문제 저장 [F003] | 미시작 |

### 최근 세션 (2026-02-19)
1. Step 4 역할 변경 AlertDialog + 사용자 상세 Sheet 구현 + 학습 리뷰
2. Step 5 사이드바 메뉴 추가 + 빌드 검증 (300개 테스트, lint 에러 0, build 성공)
3. 1-5 전체 학습 리뷰: Defense in Depth, RBAC, AlertDialog vs Dialog, Controlled Dialog
4. 커밋 완료 (`f8f4048`, `6bd1706`)

---

## 3. 다음 작업

### 즉시: 1-6 — 기출문제 조회 [F006]

**기능**: 기출문제 검색 및 목록 조회 (업로드된 기출문제를 DataTable로 조회)

**계획**: `/plan` 커맨드로 계획 수립 후 진행

### 이후
- 1-7: 기출 기반 AI 문제 생성 → 1-8: 생성된 문제 저장

---

## 4. 성공한 접근 (재사용할 패턴)

### 개발 패턴
- **Defense in Depth**: RLS + Server Action + Zod 3중 권한 체크
- **Self-referencing ID**: academy_id를 profile에서 추출 → URL 조작 방지
- **`useTransition` + Server Actions**: 직접 결과 핸들링, isPending으로 중복 클릭 방지
- **Server Component에서 역할 분기**: DevTools 우회 방지, 번들 크기 절감
- **createUserColumns 팩토리 함수**: 호출자 권한에 따라 다른 컬럼 배열 반환
- **URL searchParams 기반 상태 관리**: 북마크/공유/뒤로가기 자연 지원
- **Controlled AlertDialog**: DropdownMenu 외부 Fragment에 배치 → Radix 포커스 충돌 방지
- **TDD RED→GREEN→REFACTOR** 철저 준수

### 학습 방법
- **빈칸 채우기 방식 재구현**: 전체 삭제가 아닌 핵심 로직만 빈칸
- **사용자 수준**: JavaScript 기초(`const`, `await`)부터 설명 필요. 간결하게
- **에이전트 커맨드 준수**: `/plan`, `/tdd` 등 명시된 경우 반드시 해당 서브에이전트 실행

### 도구 활용
- **병렬 에이전트**: ui-markup-specialist + nextjs-supabase-expert 동시 실행
- **TDD 직접 구현**: Task 에이전트 없이 필립이 직접 RED→GREEN (사용자 선호)

---

## 5. 핵심 참조 문서

| 우선순위 | 문서 |
|---------|------|
| 1 | `CLAUDE.md` — 규칙·워크플로우 |
| 2 | `MEMORY.md` — 반복 실수·기술 교훈 |
| 3 | `ROADMAP.md` — 순차 스텝별 로드맵 |
| 4 | `docs/plan/phase-1-step5-user-crud.md` — 1-5 전체 계획 |
| 5 | `docs/design/시스템아키텍처.md` — 아키텍처, DB 스키마 |
| 6 | `PRD.md` — 기능 명세 |

### 1-5 핵심 구현 파일

- `src/lib/actions/users.ts` — Server Actions (390줄)
- `src/lib/actions/__tests__/users.test.ts` — 28개 테스트 (626줄)
- `src/lib/validations/users.ts` — Zod 스키마 (47줄)
- `src/app/(dashboard)/admin/users/page.tsx` — 목록 페이지 (75줄)
- `src/app/(dashboard)/admin/users/_components/user-columns.tsx` — 컬럼 정의 (~170줄)
- `src/app/(dashboard)/admin/users/_components/users-toolbar.tsx` — 필터 툴바 (85줄)
- `src/app/(dashboard)/admin/users/_components/role-change-dialog.tsx` — 역할 변경 AlertDialog (~90줄)
- `src/app/(dashboard)/admin/users/_components/user-detail-sheet.tsx` — 사용자 상세 Sheet (~130줄)
