# COMPASS 프로젝트 핸드오프 문서

> **최종 업데이트**: 2026-02-21 (1-7 Step 3 구현 완료, 404 tests)
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

### 단계 1: 기출 기반 문제 생성 + 인증 (80% 완료)

| 스텝 | 작업 | 상태 |
|------|------|------|
| 1-1 | 인증 시스템 [F010] | ✅ 완료 |
| 1-2 | 기출문제 업로드 [F005] | ✅ 완료 |
| 1-3 | 학교 관리 CRUD [F008] | ✅ 완료 |
| 1-4 | 학원 관리 CRUD [F007] | ✅ 완료 |
| 1-5 | 사용자 관리 CRUD [F009] | ✅ 완료 |
| 1-6 | 기출문제 조회 [F006] | ✅ 완료 (5/5 Steps, 347 tests, 빌드 성공) |
| **1-7** | **기출 기반 AI 문제 생성 [F011]** | **🚧 Step 3/5 완료 (404 tests) ← Step 4 UI 대기** |
| 1-8 | 생성된 문제 저장 [F003] | 미시작 |

### 최근 세션 요약 (2026-02-21, 세션 5)

1. **1-7 Step 3 구현 완료** (Server Action + GeminiProvider 통합, TDD):
   - Phase A: gemini.ts 분기 — 3개 테스트 추가, import 1줄 + 분기 3줄 (21 PASS)
   - Phase B: Server Action — 18개 테스트 + ~150줄 구현 (404 전체 PASS)
   - 핵심 Mock 패턴: `vi.importActual` (AIError instanceof), `from()` mockImplementation (테이블 분기)
2. **학습 리뷰 완료**:
   - 3개 핵심 개념 설명 (vi.importActual, from() mockImplementation, 조건부 스프레드)
   - 빈칸 채우기 실습 완료 (4개 빈칸, 수정 후 18 tests PASS)
   - 2개 스킬 추출: `~/.claude/skills/learned/vi-import-actual-partial-mock.md`, `supabase-from-mock-implementation.md`
3. 워킹 트리: origin/main 대비 **4 커밋 ahead** (미푸시) + **미커밋 파일 있음** (구현 + 문서)

---

## 3. 다음 작업

### 즉시: 1-7 Step 4 구현 (UI — 생성 다이얼로그)

**상위 계획**: `docs/plan/phase-1-step7-ai-question-generation.md` Step 4

**구현 내용**:
- 기출문제 상세 페이지에서 "AI 문제 생성" 버튼 추가
- 생성 다이얼로그 UI (문제 유형, 난이도, 개수 선택)
- `generateQuestionsFromPastExam` Server Action 호출
- 생성 결과 표시 (DB 저장은 1-8에서)

**미커밋 파일** (Step 3 구현 + 문서):
- `src/lib/ai/gemini.ts` (수정)
- `src/lib/ai/__tests__/gemini.test.ts` (수정)
- `src/lib/actions/generate-questions.ts` (신규)
- `src/lib/actions/__tests__/generate-questions.test.ts` (신규)
- `docs/plan/phase-1-step7-step3-detail.md` (신규)
- `docs/plan/phase-1-step7-ai-question-generation.md` (수정)
- `ROADMAP.md` (수정)
- `HANDOFF.md` (수정)

**미푸시 커밋 4개** (origin/main 대비):
- `15b60a7` ✨ feat: 1-7 Step 1 PastExamContext 타입 확장 + Zod 스키마
- `2124450` 📝 docs: 1-7 Step 1 완료
- `af368d8` ✨ feat: 1-7 Step 2 프롬프트 빌더
- `bc5b3d8` 📝 docs: 1-7 Step 2 완료

### 이후: 1-7 Step 5 (빌드 검증 + 학습 리뷰)

| Step | 내용 | 예상 테스트 |
|------|------|------------|
| Step 5 | 빌드 검증 + 학습 리뷰 | 전체 ~404+ |

### 그 다음: 1-8 생성된 문제 저장 [F003]

**핵심 설계 결정 (확정)**:
1. Gemini Vision → Phase 3 연기 (MVP: 텍스트 기반만)
2. `GenerateQuestionParams`에 optional `pastExamContext` 추가 (하위 호환)
3. 생성 결과 화면 표시만, DB 저장은 1-8
4. 교사/관리자만 문제 생성 가능
5. `MAX_QUESTION_COUNT = 10` (API 비용 관리)

---

## 4. 성공한 접근 (재사용할 패턴)

### 개발 패턴
- **Defense in Depth**: RLS + Server Action + Zod 3중 권한 체크
- **Self-referencing ID**: academy_id를 profile에서 추출 → URL 조작 방지
- **TDD RED→GREEN→REFACTOR** 철저 준수
- **URL searchParams 기반 상태 관리**: 북마크/공유/뒤로가기 자연 지원
- **Supabase FK JOIN**: `schools!inner` (JOIN방식), `profiles!uploaded_by` (FK구분자)
- **Signed URL 패턴**: 경로만 DB 저장, 상세 조회 시에만 생성
- **sanitizeFilters**: Zod 파싱 전 빈 문자열 → undefined 변환, Action 내부 처리
- **useEffect race condition 방지**: `let cancelled = false` + cleanup 패턴
- **DataTableServerPagination**: 공용 서버사이드 페이지네이션 (URL searchParams 기반)
- **정적 컬럼 배열 vs 팩토리 함수**: 권한별 분기 없으면 정적, 있으면 팩토리
- **Sequential Thinking MCP + planner 에이전트**: 복잡한 계획 수립 시 MCP로 분석 후 에이전트로 정형화
- **DRY 판단 기준**: "같은 이유로 변경되는가?" — 우연한 중복(Accidental Duplication)은 합치지 않음
- **프롬프트 빌더 분리 패턴**: SRP/OCP 기반 — 기존 함수 수정 대신 별도 함수 추가

### 학습 방법
- **빈칸 채우기 방식 재구현**: 전체 삭제가 아닌 핵심 로직만 빈칸
- **사용자 수준**: JavaScript 기초(`const`, `await`)부터 설명 필요. 간결하게
- **에이전트 커맨드 준수**: `/plan`, `/tdd` 등 명시된 경우 반드시 해당 서브에이전트 실행

### 실패한 접근 (반복하지 말 것)
- **계획 파일 없이 코드 작성**: 반드시 `docs/plan/` 파일 먼저 생성
- **체크리스트 없는 응답**: 모든 응답 첫 줄에 체크리스트 필수
- **학습 리뷰 생략**: 계획/구현 완료 후 학습 리뷰 빠뜨림 → 반드시 포함
- **계획 요청에서 코드 읽기/수정**: "계획" 요청 시 계획만 수행
- **병렬 에이전트에 동일 파일 할당**: 충돌 발생

---

## 5. 핵심 참조 문서

| 우선순위 | 문서 |
|---------|------|
| 1 | `CLAUDE.md` — 규칙·워크플로우 |
| 2 | `MEMORY.md` — 반복 실수·기술 교훈 |
| 3 | `ROADMAP.md` — 순차 스텝별 로드맵 |
| 4 | `docs/plan/phase-1-step7-ai-question-generation.md` — **1-7 전체 계획 (3/5 Steps 완료)** |
| 5 | `docs/plan/phase-1-step7-step3-detail.md` — 1-7 Step 3 상세 계획 (✅ 완료) |
| 6 | `docs/plan/phase-1-step7-step2-detail.md` — 1-7 Step 2 상세 계획 (✅ 완료) |
| 7 | `docs/plan/phase-1-step7-step1-detail.md` — 1-7 Step 1 상세 계획 (✅ 완료) |
| 8 | `docs/PRD.md` — 기능 명세 |
| 9 | `supabase/migrations/` — DB 스키마·RLS 정책 |
| 10 | `docs/guides/architecture-reference.md` — 아키텍처 |

### 1-7 참고용: 기존 구현 패턴

| 재사용 대상 | 출처 파일 |
|------------|----------|
| AI 추상화 레이어 (Factory + Strategy) | `src/lib/ai/index.ts` — 공개 API |
| GeminiProvider 구현체 | `src/lib/ai/gemini.ts` |
| 기존 프롬프트 빌더 패턴 | `src/lib/ai/prompts/question-generation.ts` |
| **신규** 기출 기반 프롬프트 빌더 | `src/lib/ai/prompts/past-exam-generation.ts` |
| 응답 파싱/검증 (Zod 이중 검증) | `src/lib/ai/validation.ts` |
| 재시도 유틸리티 (지수 백오프) | `src/lib/ai/retry.ts` |
| 기출문제 조회 액션 | `src/lib/actions/past-exams.ts` — `getPastExamList`, `getPastExamDetail` |
| 기출문제 DataTable UI | `src/app/(dashboard)/past-exams/_components/` |
| Server Action 인증 패턴 | `src/lib/actions/past-exams.ts` — `getCurrentUserProfile` |
| 테스트 패턴 (Mock Supabase) | `src/lib/actions/__tests__/past-exams-list.test.ts` |
| **신규** 문제 생성 Zod 스키마 | `src/lib/validations/generate-questions.ts` |

### ⚠️ 진행 중 이슈

- Supabase placeholder 타입: `as any` + `eslint-disable`로 우회 중 (`supabase gen types`로 해결 가능)
- 마이그레이션 00004, 00005: Supabase Cloud에 **미적용** (로컬 파일만 존재)
- `await cookies()` 필수 (Next.js 16 비동기)
