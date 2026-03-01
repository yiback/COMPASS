# COMPASS 프로젝트 핸드오프 문서

> **최종 업데이트**: 2026-03-01 (세션 15: 1-8 Step 1~5 전체 구현 완료)
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

### 단계 1: 기출 기반 문제 생성 + 인증 (100% 완료 ✅)

| 스텝 | 작업 | 상태 |
|------|------|------|
| 1-1 | 인증 시스템 [F010] | ✅ 완료 |
| 1-2 | 기출문제 업로드 [F005] | ✅ 완료 |
| 1-3 | 학교 관리 CRUD [F008] | ✅ 완료 |
| 1-4 | 학원 관리 CRUD [F007] | ✅ 완료 |
| 1-5 | 사용자 관리 CRUD [F009] | ✅ 완료 |
| 1-6 | 기출문제 조회 [F006] | ✅ 완료 (5/5 Steps, 347 tests, 빌드 성공) |
| 1-7 | 기출 기반 AI 문제 생성 [F011] | ✅ 완료 (5/5 Steps, 404 tests, 빌드 성공) |
| 1-8 | 생성된 문제 저장 [F003] | ✅ 완료 (5/5 Steps, 535 tests, 빌드 성공) |

### 현재 세션 요약 (2026-03-01, 세션 15)

**1-8 Step 1~5 전체 구현 완료** — 3-Wave 병렬 실행:

| Wave | Steps | 결과 |
|------|-------|------|
| Wave 1 (병렬) | Step 1 (타입 매핑) + Step 4 (문제 목록) | 504 tests PASS |
| Wave 2 (병렬) | Step 2 (저장 Action) + Step 5 (문제 상세) | 추가 31 tests PASS |
| Wave 3 | Step 3 (저장 UI + Accordion) | 빌드 성공 |

**최종 결과**: 31 test files, 535 tests ALL PASS, Next.js 빌드 성공, `/questions` 라우트 등록

### 이전 세션 (세션 11-14)

- 세션 14: 1-8 계획 문서 NOTE 4개 리뷰 + 수정 완료
- 세션 13: TypeScript 학습 (`as const`, `satisfies`, `z.infer`) + 개념 문서 생성
- 세션 12: NOTE 12/12 리뷰 완료 + 계획 문서 수정 완료
- 세션 11: 학습 리뷰 6개 + NOTE 12개 순차 리뷰 + 사용자 결정 확정 2건

---

## 3. 다음 작업

### 즉시 해야 할 일

1. **학습 리뷰 완료** — 세션 15에서 제시한 이해도 질문 5개 답변 대기 중
2. **커밋** — 1-8 구현 결과물 커밋 (미커밋 상태)
3. **ROADMAP.md 업데이트** — 1-8 완료 반영

### 이후 작업

1. **단계 1 통합 테스트** — E2E 테스트로 전체 플로우 검증
2. **단계 2 시작** — 다음 Phase 계획 수립

### 세션 15에서 구현된 파일 목록

**Step 1 — 타입 매핑 + Zod 스키마** (10 files, 37 tests)
| 파일 | 상태 |
|------|------|
| `src/lib/constants/questions.ts` | NEW — MAX_QUESTION_COUNT 공통 상수 |
| `src/lib/ai/types.ts` | MODIFIED — DifficultyLevel, 매핑 함수 |
| `src/lib/ai/index.ts` | MODIFIED — 새 export 추가 |
| `src/lib/validations/save-questions.ts` | NEW — 저장 Zod 스키마 |
| `src/lib/validations/generate-questions.ts` | MODIFIED — import 경로 변경 |
| `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` | MODIFIED — import 경로 변경 |

**Step 2 — 저장 Server Action** (2 files, 23 tests)
| 파일 | 상태 |
|------|------|
| `src/lib/actions/save-questions.ts` | NEW — saveGeneratedQuestions Action |
| `src/lib/actions/__tests__/save-questions.test.ts` | NEW — 23 tests |

**Step 3 — 저장 UI (Accordion + Checkbox)** (2 files)
| 파일 | 상태 |
|------|------|
| `src/components/ui/accordion.tsx` | NEW — shadcn Accordion |
| `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` | MODIFIED — 351→516 lines |

**Step 4 — 문제 목록 DataTable** (9 files, 63 tests)
| 파일 | 상태 |
|------|------|
| `src/lib/utils/grade-filter-utils.ts` | NEW — schoolType 연동 학년 필터 |
| `src/lib/validations/questions.ts` | NEW — 필터 스키마 |
| `src/lib/actions/questions.ts` | NEW — getQuestionList Action |
| `src/app/(dashboard)/questions/page.tsx` | NEW — 문제 목록 페이지 |
| `src/app/(dashboard)/questions/_components/constants.ts` | NEW — UI 상수 |
| `src/app/(dashboard)/questions/_components/question-columns.tsx` | NEW — DataTable 컬럼 |
| `src/app/(dashboard)/questions/_components/questions-toolbar.tsx` | NEW — 필터 툴바 |
| `src/lib/constants/menu.ts` | MODIFIED — "문제 관리" 메뉴 추가 |

**Step 5 — 문제 상세 Sheet** (3 files, 8 tests)
| 파일 | 상태 |
|------|------|
| `src/lib/actions/questions.ts` | MODIFIED — getQuestionDetail 추가 |
| `src/lib/actions/__tests__/questions-detail.test.ts` | NEW — 8 tests |
| `src/app/(dashboard)/questions/_components/question-detail-sheet.tsx` | NEW — 상세 Sheet |

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
- **NOTE 순차 리뷰 방식**: 계획 문서 리뷰 시 한 번에 전체 반영하지 않고, NOTE 하나씩 설명 → 승인 → 다음 진행
- **공통 상수 분리**: 여러 모듈에서 공유하는 상수는 `src/lib/constants/`에 정의, 각 모듈에서 import
- **3-Wave 병렬 구현**: 의존성 그래프 분석 → 독립 Step 병렬 실행 (Step1+4 → Step2+5 → Step3)
- **`as const satisfies Record<K,V>`**: 리터럴 타입 + 형태 검증 동시 달성
- **Set<number> 부분 저장 추적**: savedIndices로 개별 문제 저장 상태 관리 + 파생 상태(allSaved, savableCount)
- **Accordion UI 패턴**: 긴 문제 카드 접기/펼치기 — `type="multiple"` + `e.stopPropagation()`

### 학습 방법
- **빈칸 채우기 방식 재구현**: 전체 삭제가 아닌 핵심 로직만 빈칸
- **사용자 수준**: JavaScript 기초(`const`, `await`)부터 설명 필요. 간결하게
- **에이전트 커맨드 준수**: `/plan`, `/tdd` 등 명시된 경우 반드시 해당 서브에이전트 실행
- **Supabase `.or()` 문법**: `.or('col1.eq.val,col2.eq.val')` — 함수가 아닌 문자열 패턴
- **개념 문서 방식 학습**: `docs/concepts/` 폴더에 개념별 상세 문서 작성

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
| 4 | `docs/plan/phase-1-step8-save-generated-questions.md` — 1-8 전체 계획 (5/5 Steps 완료) |
| 5 | `docs/plan/phase-1-step7-ai-question-generation.md` — 1-7 전체 계획 (5/5 Steps 완료) |
| 6 | `docs/PRD.md` — 기능 명세 |
| 7 | `supabase/migrations/00001_initial_schema.sql` — DB 스키마 (questions 테이블 포함) |
| 8 | `supabase/migrations/00002_rls_policies.sql` — RLS 정책 |
| 9 | `docs/guides/architecture-reference.md` — 아키텍처 |

### 1-8 구현 완료 — 주요 파일 참조

| 기능 | 파일 |
|------|------|
| 저장 Server Action | `src/lib/actions/save-questions.ts` |
| 저장 Zod 스키마 | `src/lib/validations/save-questions.ts` |
| 생성 다이얼로그 (저장 UI 포함) | `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` |
| 난이도 매핑 함수 | `src/lib/ai/types.ts` — `toDifficultyNumber`/`fromDifficultyNumber` |
| 문제 목록 페이지 | `src/app/(dashboard)/questions/page.tsx` |
| 문제 목록 Action | `src/lib/actions/questions.ts` — `getQuestionList`/`getQuestionDetail` |
| 문제 상세 Sheet | `src/app/(dashboard)/questions/_components/question-detail-sheet.tsx` |
| 학년 필터 유틸 | `src/lib/utils/grade-filter-utils.ts` |
| 공통 상수 | `src/lib/constants/questions.ts` — `MAX_QUESTION_COUNT` |

### ⚠️ 진행 중 이슈

- Supabase placeholder 타입: `as any` + `eslint-disable`로 우회 중 (`supabase gen types`로 해결 가능)
- 마이그레이션 00004, 00005: Supabase Cloud에 **미적용** (로컬 파일만 존재)
- `await cookies()` 필수 (Next.js 16 비동기)
- origin/main과 동기화 완료 (세션 9에서 푸시) — 세션 15 변경사항은 **미커밋/미푸시**
