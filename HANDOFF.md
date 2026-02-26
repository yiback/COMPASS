# COMPASS 프로젝트 핸드오프 문서

> **최종 업데이트**: 2026-02-26 (1-7 전체 완료 — 5/5 Steps, 404 tests, 빌드 성공)
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

### 단계 1: 기출 기반 문제 생성 + 인증 (93% 완료)

| 스텝 | 작업 | 상태 |
|------|------|------|
| 1-1 | 인증 시스템 [F010] | ✅ 완료 |
| 1-2 | 기출문제 업로드 [F005] | ✅ 완료 |
| 1-3 | 학교 관리 CRUD [F008] | ✅ 완료 |
| 1-4 | 학원 관리 CRUD [F007] | ✅ 완료 |
| 1-5 | 사용자 관리 CRUD [F009] | ✅ 완료 |
| 1-6 | 기출문제 조회 [F006] | ✅ 완료 (5/5 Steps, 347 tests, 빌드 성공) |
| 1-7 | 기출 기반 AI 문제 생성 [F011] | ✅ 완료 (5/5 Steps, 404 tests, 빌드 성공) |
| **1-8** | **생성된 문제 저장 [F003]** | **미시작 ← 다음** |

### 최근 세션 요약 (2026-02-26, 세션 8)

1. **1-7 Step 5 빌드 검증 완료**:
   - `npx vitest run` — 404 tests 전체 PASS
   - `npm run lint` — 에러 0개 (경고 6개)
   - `npm run build` — 빌드 성공
2. **학습 리뷰 완료**:
   - 5개 핵심 개념 설명 (Factory+Strategy, 프롬프트 엔지니어링, Server Action AI 호출, useTransition, Zod+AI 타입)
   - 이해도 질문 5개 답변 + 피드백 (SRP/하위호환/관심사분리 부족 → 추가 설명)
3. **직접 구현 완료**:
   - 프롬프트 빌더(🔴) 빈칸 채우기 5곳 → 14 tests PASS
   - trailing comma 학습 (JS/TS 문법)
4. **1-7 전체 완료** — 5/5 Steps, 404 tests, 빌드 성공

### 이전 세션 요약 (2026-02-26, 세션 7)

1. **문서 상태 확인 + 누락 수정**:
   - 계획 문서 하단 "전체 파일 변경 요약" 테이블에서 Step 3/4 완료 표시 누락 발견
   - 5개 항목 `Step 3`/`Step 4` → `✅ Step 3`/`✅ Step 4`로 수정
   - 요약 라인: `완료: 8/15 (Step 1-2)` → `완료: 15/15 (Step 1-4)`
2. **커밋 2개 생성** (feat/docs 분리 패턴):
   - `9de843c` ✨ feat: 1-7 Step 4 UI — 생성 다이얼로그 + 결과 표시
   - `9048924` 📝 docs: 1-7 Step 4 완료 — HANDOFF/ROADMAP/계획 문서 업데이트
3. **origin/main 대비 8 커밋 ahead** (미푸시):
   - Step 1~4 각각 feat + docs = 8 커밋

### 이전 세션 요약 (2026-02-26, 세션 6)

1. **1-7 Step 4 구현 완료** (UI — 생성 다이얼로그 + 결과 표시):
   - Phase A: `pastExamColumns` 정적 배열 → `createPastExamColumns(callerRole)` 팩토리 함수 변환 + page.tsx 연동
   - Phase B: `generate-questions-dialog.tsx` 신규 생성 (~250줄) — 폼 + 로딩 + 결과 카드
   - Phase C: `past-exam-detail-sheet.tsx`에 callerRole prop + "AI 문제 생성" 버튼 + Dialog 연동
   - 404 tests PASS (회귀 없음), npm run build 성공
2. **학습 리뷰 완료**:
   - 팩토리 함수 + 클로저 개념 설명 + 이해도 질문 3개 (z.coerce.number, Dialog 배치)
   - 개념 문서 생성: `docs/concepts/factory-closure.md` (634줄, 연습 문제 포함)

---

## 3. 다음 작업

### 즉시: 1-8 생성된 문제 저장 [F003]

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
| 4 | `docs/plan/phase-1-step7-ai-question-generation.md` — **1-7 전체 계획 (5/5 Steps 완료)** |
| 5 | `docs/plan/phase-1-step7-step4-detail.md` — 1-7 Step 4 상세 계획 (✅ 완료) |
| 6 | `docs/plan/phase-1-step7-step3-detail.md` — 1-7 Step 3 상세 계획 (✅ 완료) |
| 7 | `docs/plan/phase-1-step7-step2-detail.md` — 1-7 Step 2 상세 계획 (✅ 완료) |
| 8 | `docs/plan/phase-1-step7-step1-detail.md` — 1-7 Step 1 상세 계획 (✅ 완료) |
| 9 | `docs/PRD.md` — 기능 명세 |
| 10 | `supabase/migrations/` — DB 스키마·RLS 정책 |
| 11 | `docs/guides/architecture-reference.md` — 아키텍처 |

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
| **신규** AI 문제 생성 Server Action | `src/lib/actions/generate-questions.ts` |
| **신규** 생성 다이얼로그 UI | `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` |
| **수정** 컬럼 팩토리 함수 | `src/app/(dashboard)/past-exams/_components/past-exam-columns.tsx` — `createPastExamColumns` |
| **수정** Sheet + Dialog 연동 | `src/app/(dashboard)/past-exams/_components/past-exam-detail-sheet.tsx` |

### ⚠️ 진행 중 이슈

- Supabase placeholder 타입: `as any` + `eslint-disable`로 우회 중 (`supabase gen types`로 해결 가능)
- 마이그레이션 00004, 00005: Supabase Cloud에 **미적용** (로컬 파일만 존재)
- `await cookies()` 필수 (Next.js 16 비동기)
- origin/main 대비 **8 커밋 미푸시** (Step 1~4, 각 feat+docs)
