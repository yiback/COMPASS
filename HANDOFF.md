# COMPASS 프로젝트 핸드오프 문서

> **최종 업데이트**: 2026-03-20 (세션 25: 기출문제 추출 구현 + 코드 리뷰 + 회고 + ROADMAP/PLAN 업데이트)
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

### 단계 1: 기출 기반 문제 생성 + 인증 (100% 완료 + 버그 수정 완료)

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
| 버그 | 학년 필터링 버그 수정 | 완료 (6 Steps, 548 tests) |
| 버그 | 기출문제 업로드 버그 수정 | 완료 |

### 기출문제 추출 기능 (구현 완료 — 1235 tests)

| Wave | Step | 작업 | 상태 |
|------|------|------|------|
| 1 | Step 1 | 3계층 스키마 마이그레이션 + RLS + 인덱스 | 완료 |
| 1 | Step 3 | AI 타입 + 프롬프트 빌더 + GeminiProvider 확장 | 완료 (8개 파일, 38 tests) |
| 2 | Step 2 | 기존 코드 리팩토링 (past_exam_questions → 3계층) | 완료 (10개 파일) |
| 2 | Step 4 | 시험 생성 + 이미지 업로드 Server Action | 완료 (4개 파일, 64 tests) |
| 3 | Step 5 | 추출 + crop + 재추출 + 재분석 Action | 완료 (5개 파일, 35 tests) |
| 3 | Step 6 | 업로드 UI (다중 이미지 + DnD 순서 변경) | 완료 (3개 파일) |
| 4 | Step 7 | 편집 UI (리뷰 + AI 재분석 + 확정) | 완료 (3개 파일) |
| 5 | Step 8 | 빌드 검증 | 완료 (1235 tests, 빌드 성공) |

### 현재 세션 요약 (2026-03-20, 세션 25)

**기출문제 추출 전체 구현 완료 (PLAN v9 → Wave 1~5)**:

1. **PLAN v7→v8→v9 수립 + 리뷰 (Agent Team 6회)**:
   - v7 Tech Review: MUST FIX 3건 → v8 반영
   - v7 Scope Review: SHOULD FIX 1건 + CONSIDER 4건 → v8 반영
   - v8 Tech Review: SHOULD FIX 2건 + CONSIDER 2건 → v9 반영
   - v8 Scope Review: SHOULD FIX 1건 + CONSIDER 3건 → v9 반영
   - v9 상세 Task 리뷰 (3팀: tech + scope + consistency): MUST FIX 5건 → 반영
   - v9 상세 Task 리뷰 v2 (3팀): MUST FIX 3건 → 구현 중 해결

2. **Step별 상세 계획 8개 작성**: `docs/plan/extraction-step1~8.md`

3. **Wave 1~5 병렬 구현 (34개 파일)**:
   - Wave 1: db-schema (마이그레이션) ∥ ai-integration (AI 레이어)
   - Wave 2: step2-refactor (17개 파일 리팩토링) ∥ step4-exam-mgmt (5개 Action)
   - Wave 3: step5-extraction (추출+crop+재분석) ∥ step6-upload-ui (DnD)
   - Wave 4: step7-edit-ui (편집 UI)
   - Wave 5: step8-verification (빌드 검증 — 3건 수정)

4. **빌드 에러 3건 수정**:
   - `'use server'` 파일에서 `export const runtime` 무효 → page.tsx로 이동
   - Zod v4: `errorMap` → `error` 키 변경
   - `supabase gen types` stderr 오염 → 첫 줄 제거

### 이전 세션 (세션 11-24)

- 세션 24: PLAN v7 수립 + 리뷰 READY 판정
- 세션 23: PLAN v6 리뷰 + 확정 (Tech+Scope 리뷰 2팀)
- 세션 19-22: 기출문제 추출 계획 v1→v5 수립
- 세션 18: 학년 필터링 구현 완료 + 업로드 버그 수정 (548 tests)
- 세션 17: 학년 필터링 학습 리뷰
- 세션 16: 학년 필터링 버그 연구 + 구현 계획 완료
- 세션 15: 1-8 Step 1~5 전체 구현 완료 (535 tests)
- 세션 14: 1-8 계획 문서 NOTE 리뷰
- 세션 13: TypeScript 학습
- 세션 12: NOTE 12/12 리뷰 완료
- 세션 11: 학습 리뷰 + NOTE 순차 리뷰

---

## 3. 다음 작업

### 즉시 해야 할 일 (우선순위순)

1. **수동 E2E 테스트** — 실제 브라우저에서 전체 플로우 검증:
   - 시험 생성 → 이미지 업로드 → DnD 순서 변경 → AI 추출 → 편집 → 재분석 → 확정
   - 샘플 이미지: `docs/sampleImage/` (5장)

2. **단계 1 Phase 회고** — `docs/retrospective/phase-1-retro.md` 작성:
   - 성공 패턴, 실패 패턴, 개선 사항 정리
   - CLAUDE.md, MEMORY.md에 교훈 반영

3. **단계 2 계획 수립** — ROADMAP.md 참조하여 2-1 RBAC 시스템부터 시작

---

## 4. 성공한 접근 (재사용할 패턴)

### 개발 패턴
- **Defense in Depth**: RLS + Server Action + Zod 3중 권한 체크
- **Self-referencing ID**: academy_id를 profile에서 추출 → URL 조작 방지
- **TDD RED→GREEN→REFACTOR** 철저 준수
- **URL searchParams 기반 상태 관리**: 북마크/공유/뒤로가기 자연 지원
- **Supabase FK JOIN**: `schools!inner` (JOIN방식), `profiles!created_by` (FK구분자)
- **Signed URL 패턴**: 경로만 DB 저장, 상세 조회 시에만 생성
- **sanitizeFilters**: Zod 파싱 전 빈 문자열 → undefined 변환, Action 내부 처리
- **useEffect race condition 방지**: `let cancelled = false` + cleanup 패턴
- **5-Wave 병렬 구현**: 의존성 그래프 분석 → Wave별 독립 Step 병렬 실행
- **Agent Team 리뷰**: tech + scope + consistency 3팀 병렬 → 이슈 종합 → 사용자 판단
- **Optimistic Lock**: `.update().in().select('id')` + 빈 배열 체크로 동시 추출 방지
- **isCompleted + try/finally**: 예외/조기 반환 모두에서 extraction_status 롤백 보장
- **Non-blocking Storage cleanup**: 삭제 실패 무시 → orphan은 Phase 2 cleanup job
- **detailId 사전 생성**: `crypto.randomUUID()`로 DB INSERT 전 ID 할당 → crop Storage 경로에 사용
- **buildContents 헬퍼**: imageParts 유무로 텍스트/멀티모달 자동 분기 (OCP)
- **Compensating Transaction**: Storage + DB 분산 작업의 롤백 (uploadedPaths 추적)
- **deprecated 전략**: 기존 Action 즉시 삭제 안 함 → `@deprecated` 주석 + 새 Action 완성 후 삭제
- **useTransition + 직접 FormData**: DnD 순서 반영을 위해 useActionState 대신 사용
- **temp-ID 패턴**: 수동 추가 문제에 `temp-{uuid}` 임시 ID → DB 저장 시 실제 ID로 교체

### 학습 방법
- **빈칸 채우기 방식 재구현**: 전체 삭제가 아닌 핵심 로직만 빈칸
- **사용자 수준**: JavaScript 기초(`const`, `await`)부터 설명 필요. 간결하게
- **에이전트 커맨드 준수**: `/plan`, `/tdd` 등 명시된 경우 반드시 해당 서브에이전트 실행

### 실패한 접근 (반복하지 말 것)
- **계획 파일 없이 코드 작성**: 반드시 `docs/plan/` 파일 먼저 생성
- **체크리스트 없는 응답**: 모든 응답 첫 줄에 체크리스트 필수
- **학습 리뷰 생략**: 계획/구현 완료 후 학습 리뷰 빠뜨림 → 반드시 포함
- **'use server' 파일에서 runtime/maxDuration export**: Server Action 파일에서 무효 → page.tsx에서 설정
- **Zod v4 errorMap**: `errorMap` 대신 `error` 키 사용
- **supabase gen types stderr 오염**: `npx supabase gen types > file` 시 npm warn이 파일에 포함될 수 있음 → 확인 필수

---

## 5. 핵심 참조 문서

| 우선순위 | 문서 |
|---------|------|
| 1 | `CLAUDE.md` — 규칙·워크플로우 |
| 2 | `MEMORY.md` — 반복 실수·기술 교훈 |
| 3 | `ROADMAP.md` — 순차 스텝별 로드맵 |
| 4 | `docs/plan/20260308-past-exam-extraction.md` — **기출문제 추출 마스터 PLAN v9 (구현 완료)** |
| 5 | `docs/plan/extraction-step1~8.md` — **Step별 상세 구현 계획 (구현 완료)** |
| 6 | `docs/reviews/extraction-detail-*-review-v2.md` — 상세 리뷰 (tech + scope + consistency) |

### 기출문제 추출 구현 — 주요 파일 참조

| 기능 | 파일 |
|------|------|
| 3계층 마이그레이션 | `supabase/migrations/20260315_past_exam_restructure.sql` |
| AI 추출 타입 | `src/lib/ai/types.ts` — ImagePart, ExtractedQuestion, FigureInfo 등 |
| 추출 Zod 스키마 | `src/lib/ai/extraction-validation.ts` |
| 추출 프롬프트 | `src/lib/ai/prompts/question-extraction.ts` |
| GeminiProvider 확장 | `src/lib/ai/gemini.ts` — extractQuestions, reanalyzeQuestion |
| 시험 관리 Action | `src/lib/actions/exam-management.ts` — create/update/delete/confirm |
| 추출 Action | `src/lib/actions/extract-questions.ts` — extract/reset/reanalyze |
| 업로드 UI | `src/app/(dashboard)/past-exams/upload/upload-form.tsx` (다중 이미지) |
| DnD 이미지 정렬 | `src/app/(dashboard)/past-exams/upload/image-sorter.tsx` |
| 편집 UI | `src/app/(dashboard)/past-exams/[id]/edit/extraction-editor.tsx` |
| 문제 카드 | `src/app/(dashboard)/past-exams/[id]/edit/question-card.tsx` |

### 이전 구현 — 주요 파일 참조

| 기능 | 파일 |
|------|------|
| 저장 Server Action | `src/lib/actions/save-questions.ts` |
| 생성 다이얼로그 | `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` |
| 문제 목록 Action | `src/lib/actions/questions.ts` |
| 학년 필터 유틸 | `src/lib/utils/grade-filter-utils.ts` |

### 진행 중 이슈

- Supabase placeholder 타입: `as any` + `eslint-disable`로 우회 중 (`supabase gen types`로 해결 완료)
- 마이그레이션 00004: Supabase Cloud에 **미적용** (로컬 파일만 존재)
- 마이그레이션 00005: **수동 적용 완료** (Dashboard SQL Editor에서 실행)
- 마이그레이션 20260315: **수동 적용 완료** (3계층 구조)
- `await cookies()` 필수 (Next.js 16 비동기)
- 시드 데이터 UUID가 비표준 → Zod `.uuid()` 대신 `.min(1)` 사용 중
