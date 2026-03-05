# COMPASS 프로젝트 핸드오프 문서

> **최종 업데이트**: 2026-03-05 (세션 17: 학년 필터링 계획 학습 리뷰 — 파생 상태 설명 완료)
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

### 현재 세션 요약 (2026-03-05, 세션 17)

**학년 필터링 계획 학습 리뷰** — 코드 변경 없음:

1. **계획 문서 애니메이션 설명**: 6 Steps 전체를 ASCII 다이어그램으로 시각화
2. **학습 리뷰 질문 1번 설명 완료**: "파생 상태(Derived State)" — `schoolType`을 `useState`가 아닌 `schools.find()`로 파생하는 이유 (Single Source of Truth)
3. **학습 리뷰 질문 2, 3번 미완료**: grade 우선 원칙, Defense in Depth

### 이전 세션 (세션 11-16)

- 세션 16: 학년 필터링 버그 연구 + 구현 계획 완료 (Approach B 채택, 6 Steps)

- 세션 15: 1-8 Step 1~5 전체 구현 완료 (3-Wave 병렬, 535 tests, 빌드 성공)
- 세션 14: 1-8 계획 문서 NOTE 4개 리뷰 + 수정 완료
- 세션 13: TypeScript 학습 (`as const`, `satisfies`, `z.infer`) + 개념 문서 생성
- 세션 12: NOTE 12/12 리뷰 완료 + 계획 문서 수정 완료
- 세션 11: 학습 리뷰 6개 + NOTE 12개 순차 리뷰 + 사용자 결정 확정 2건

---

## 3. 다음 작업

### 즉시 해야 할 일 (우선순위순)

1. **학년 필터링 버그 구현** — `docs/plan/phase-1-grade-filter-by-school-type.md` 계획대로 6 Steps 실행
   - Step 1: `getGradeRange()` 공통 유틸 추가 + TDD
   - Step 2: pastExamFilterSchema에 schoolType 추가 + TDD
   - Step 3: Server Action 범위 필터 + 교차 검증 + questions.ts 리팩터
   - Step 4-5: UI 수정 (업로드 폼 + 필터 Toolbar) — 병렬 가능
   - Step 6: 빌드 검증
2. **단계 1 통합 테스트** — E2E 테스트로 전체 플로우 검증
3. **단계 2 계획 수립** — ROADMAP.md 참조하여 2-1 RBAC 시스템부터 시작

### 완료된 항목 (세션 17)

- ✅ 계획 문서 6 Steps 전체 애니메이션 설명
- ✅ 학습 리뷰 질문 1/3 완료: 파생 상태 (Derived State) + Single Source of Truth

### 미완료 학습 리뷰 질문 (다음 세션에서 계속)

- ❌ 질문 2: `getPastExamList`에서 grade가 있을 때 schoolType 범위 필터를 적용하지 않는 이유
- ❌ 질문 3: UI 동적 옵션 방어 후에도 Server Action 교차 검증이 필요한 이유 (Defense in Depth)

### 학년 필터링 구현 계획 — 수정 대상 파일

| Step | 파일 | 변경 |
|------|------|------|
| 1 | `src/lib/utils/grade-filter-utils.ts` | `getGradeRange()` 함수 추가 |
| 1 | `src/lib/utils/__tests__/grade-filter-utils.test.ts` | 테스트 추가 |
| 2 | `src/lib/validations/past-exams.ts` | schoolType 필드 추가 |
| 2 | `src/lib/validations/__tests__/past-exams-filter.test.ts` | 테스트 추가 |
| 3 | `src/lib/actions/past-exams.ts` | schoolType 범위 필터 + 교차 검증 |
| 3 | `src/lib/actions/questions.ts` | ranges 하드코딩 → `getGradeRange()` 리팩터 |
| 3 | `src/lib/actions/__tests__/past-exams-list.test.ts` | 테스트 추가 |
| 4 | `src/app/(dashboard)/past-exams/upload/upload-form.tsx` | controlled + 동적 학년 |
| 5 | `src/app/(dashboard)/past-exams/_components/past-exams-toolbar.tsx` | schoolType 셀렉트 + 동적 학년 |
| 5 | `src/app/(dashboard)/past-exams/_components/constants.ts` | GRADE_OPTIONS 제거 |

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
- **getGradeRange() 공통 분리**: GRADE_RANGES 내부 상수를 캡슐화 — prefix 노출 없이 min/max만 반환 (관심사 분리)
- **Approach A vs B 비교**: FK JOIN(직접 쿼리) vs grade 범위 변환(추론) — 테이블에 FK 없으면 B만 가능

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
| 4 | `docs/plan/phase-1-grade-filter-by-school-type.md` — 학년 필터링 버그 수정 계획 (6 Steps, 미구현) |
| 5 | `docs/research/grade-filter-by-school-type.md` — 학년 필터링 버그 연구 문서 |
| 6 | `docs/plan/phase-1-step8-save-generated-questions.md` — 1-8 전체 계획 (5/5 Steps 완료) |
| 7 | `docs/plan/phase-1-step7-ai-question-generation.md` — 1-7 전체 계획 (5/5 Steps 완료) |
| 8 | `docs/PRD.md` — 기능 명세 |
| 9 | `supabase/migrations/00001_initial_schema.sql` — DB 스키마 (questions 테이블 포함) |
| 10 | `supabase/migrations/00002_rls_policies.sql` — RLS 정책 |
| 11 | `docs/guides/architecture-reference.md` — 아키텍처 |

### 학년 필터링 — 핵심 기술 결정

| 항목 | 결정 |
|------|------|
| 접근법 | **Approach B**: schoolType → grade 범위 변환 (`getGradeRange()`) |
| 이유 | questions.ts와 일관성 유지 (questions 테이블에 school_id FK 없음) |
| 공통 분리 | `getGradeRange()` → `grade-filter-utils.ts`에 추가, 두 Action에서 재사용 |
| DB 구조 | schoolType은 `schools` 테이블에만 존재, `past_exam_questions`에서 `school_id` FK JOIN |
| 레퍼런스 | `questions-toolbar.tsx` — 이미 올바르게 구현된 동적 학년 필터 |

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
- origin/main과 동기화 완료 (세션 15에서 push — `61cd43e`)
- 학년 필터링 버그: 연구+계획 완료, **구현 미시작** (unstaged 상태: 연구 문서 + 계획 문서)
