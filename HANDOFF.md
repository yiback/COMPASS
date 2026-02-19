# COMPASS 프로젝트 핸드오프 문서

> **최종 업데이트**: 2026-02-19 (1-6 기출문제 조회 [F006] 완료)
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

### 단계 1: 기출 기반 문제 생성 + 인증 (75% 완료)

| 스텝 | 작업 | 상태 |
|------|------|------|
| 1-1 | 인증 시스템 [F010] | ✅ 완료 |
| 1-2 | 기출문제 업로드 [F005] | ✅ 완료 |
| 1-3 | 학교 관리 CRUD [F008] | ✅ 완료 |
| 1-4 | 학원 관리 CRUD [F007] | ✅ 완료 |
| 1-5 | 사용자 관리 CRUD [F009] | ✅ 완료 |
| 1-6 | 기출문제 조회 [F006] | ✅ 완료 (5/5 Steps, 347 tests, 빌드 성공) |
| **1-7** | **기출 기반 AI 문제 생성 [F011]** | **미시작 ← 다음 작업** |
| 1-8 | 생성된 문제 저장 [F003] | 미시작 |

### 최근 세션 요약 (2026-02-19)

1. 1-6 Step 5 빌드 검증 — 347 tests PASS, lint 0 errors, build 성공
2. 빌드 수정 2건: eslint-disable 위치 조정 (기능 변경 없음)
3. 1-6 완료 처리 — ROADMAP/HANDOFF/MEMORY/계획 문서 7개 업데이트
4. 미커밋 상태 — 커밋·푸시 필요

---

## 3. 다음 작업

### 즉시: 미커밋 변경사항 커밋·푸시

변경 파일:
- `HANDOFF.md`, `ROADMAP.md` — 1-6 완료 반영
- `docs/plan/phase-1-step6-5-build-verify.md` — 신규 (Step 5 계획)
- `docs/plan/phase-1-step6-*.md` (5개) — 성공 기준 체크
- `src/app/(dashboard)/past-exams/_components/past-exam-detail-sheet.tsx` — eslint-disable 추가
- `src/lib/actions/past-exams.ts` — eslint-disable 위치 이동

### 이후: 1-7 기출 기반 AI 문제 생성 [F011] 계획 수립

**활용할 기존 인프라**:
- **AI 추상화 레이어 (0-5)**: `src/lib/ai/` — Factory + Strategy, GeminiProvider, retry, validation, prompts
- **기출문제 조회 (1-6)**: `src/lib/actions/past-exams.ts` — `getPastExamList`, `getPastExamDetail`
- **프롬프트 시스템**: `src/lib/ai/prompts/` — 템플릿 빌더 + 배럴 파일

**ROADMAP 기준 범위**:
- 기출문제 분석 프롬프트 설계
- 기출 기반 유사 문제 생성
- 기출 스타일 반영 옵션

### 그 다음: 1-8 생성된 문제 저장 [F003]
- 문제 저장 및 관리, 문제 목록/상세 조회

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
| 4 | `PRD.md` — 기능 명세 |
| 5 | `supabase/migrations/` — DB 스키마·RLS 정책 |
| 6 | `docs/guides/architecture-reference.md` — 아키텍처 |

### 1-7 참고용: 기존 구현 패턴

| 재사용 대상 | 출처 파일 |
|------------|----------|
| AI 추상화 레이어 (Factory + Strategy) | `src/lib/ai/index.ts` — 공개 API |
| GeminiProvider 구현체 | `src/lib/ai/gemini.ts` |
| 프롬프트 빌더 + 템플릿 | `src/lib/ai/prompts/` |
| 응답 파싱/검증 (Zod 이중 검증) | `src/lib/ai/validation.ts` |
| 재시도 유틸리티 (지수 백오프) | `src/lib/ai/retry.ts` |
| 기출문제 조회 액션 | `src/lib/actions/past-exams.ts` — `getPastExamList`, `getPastExamDetail` |
| 기출문제 DataTable UI | `src/app/(dashboard)/past-exams/_components/` |
| Server Action + 페이지네이션 | `src/lib/actions/users.ts` |
| 테스트 패턴 (Mock Supabase) | `src/lib/actions/__tests__/past-exams-list.test.ts` |

### ⚠️ 진행 중 이슈

- Supabase placeholder 타입: `as any` + `eslint-disable`로 우회 중 (`supabase gen types`로 해결 가능)
- 마이그레이션 00004, 00005: Supabase Cloud에 **미적용** (로컬 파일만 존재)
- `await cookies()` 필수 (Next.js 16 비동기)
