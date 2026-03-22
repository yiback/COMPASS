# COMPASS 프로젝트 핸드오프 문서

> **최종 업데이트**: 2026-03-22 (세션 28: 단계 1.5-1 LaTeX 수식 렌더링 완료 — 31 tests, E2E 통과)
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

| Task | 작업 | 상태 |
|------|------|------|
| Task 1 | katex 설치 + CSS | 완료 |
| Task 2 | parseLatexText 유틸 (4종 세그먼트: $$, {{fig:N}}, $, text) | 완료 |
| Task 3 | LatexRenderer 컴포넌트 (React.memo + figure 폴백) | 완료 |
| Task 4 | ReadMode 적용 (question-card.tsx 3곳) | 완료 |
| Task 5 | generate-questions-dialog 적용 (4곳) | 완료 |
| Task 6 | question-detail-sheet 적용 (4곳) | 완료 |
| Task 7 | EditMode Live Preview Below (300ms debounce) | 완료 |
| Task 8 | 단위 테스트 31개 (파서 22 + 렌더러 9) | 완료 |

**구현 파일**: `latex-parser.ts`, `latex-renderer.tsx`, `question-card.tsx`, `generate-questions-dialog.tsx`, `question-detail-sheet.tsx`
**커밋**: `e847cd0` feat + `a9046d3` docs + `15c2226` docs

### 세션 28 워크플로우 요약

```
리서치 (6주제, 15문서) → PLAN v2 + Wave 1~4 → PLAN 리뷰 2회 (MUST FIX 4건 수정)
→ 병렬 구현 (4 에이전트) → 코드 리뷰 (3명) → HIGH 3건 수정 + 테스트 6개 추가
→ E2E 시각 검증 → 커밋 3건 → HANDOFF 업데이트
```

### 이전 세션 (세션 11-27)

- 세션 27: figure crop 제거 + 문서 업데이트
- 세션 26: E2E 테스트 전체 통과 + 버그 수정 4건
- 세션 25: 기출문제 추출 전체 구현 (34개 파일, 1235 tests)
- 세션 19-24: 기출문제 추출 계획 v1→v7
- 세션 11-18: 학습 리뷰 + 학년 필터링 + 1-6~1-8 구현

---

## 3. 다음 작업

### 즉시 해야 할 일 (우선순위순)

1. **단계 1.5-2: 도형/그래프 렌더링 PLAN 작성**
   - 리서치 완료: `docs/research/math-figures-recommendation.md`, `docs/research/figure-placement-recommendation.md` (v2)
   - 확정된 기술: JSON 스키마 + 커스텀 SVG 렌더러, `{{fig:N}}` 구분자 통일, `displaySize: 'large' | 'small'`
   - `parseLatexText`에 `{{fig:N}}` 세그먼트 이미 통합됨 → `FigureRenderer` 컴포넌트만 구현하면 연결

2. **기본 모델 코드 업데이트** — `src/lib/ai/config.ts`의 기본값을 `gemini-2.5-flash`로 변경

3. **sharp 의존성 제거 검토** — crop 제거로 미사용

4. **단계 1 Phase 회고** — `docs/retrospective/phase-1-retro.md` 작성

5. **단계 2 계획 수립** — ROADMAP.md 참조하여 2-1 RBAC 시스템부터 시작

---

## 4. 성공한 접근 (재사용할 패턴)

### 개발 패턴
- **Defense in Depth**: RLS + Server Action + Zod 3중 권한 체크
- **Self-referencing ID**: academy_id를 profile에서 추출 → URL 조작 방지
- **TDD RED→GREEN→REFACTOR** 철저 준수
- **Signed URL 패턴**: 경로만 DB 저장, 상세 조회 시에만 생성
- **useEffect race condition 방지**: `let cancelled = false` + cleanup 패턴
- **Optimistic Lock**: `.update().in().select('id')` + 빈 배열 체크
- **Route Handler 우회**: Server Action bodySizeLimit 미적용 시 API Route 대체
- **E2E 테스트**: Chrome DevTools MCP로 실제 브라우저 자동화
- **정규식 Single Pass 파싱**: 통합 COMBINED_PATTERN으로 `$$`/`{{fig}}`/`$` 한 번에 스캔
- **React.memo**: 순수 렌더링 컴포넌트(LatexRenderer)에 필수 적용
- **CSS import 위치 최적화**: 전역 layout.tsx 대신 사용 컴포넌트 내부 import
- **인라인 debounce 패턴**: 기존 toolbar 코드와 일관성 유지 (커스텀 훅 분리는 리팩토링 시)
- **`{{fig:N}}` 선제 파서 통합**: 도형 PLAN 전에 LaTeX 파서에 +8줄 추가 → 후속 PLAN에서 파서 재수정 불필요
- **마스터 PLAN ↔ 상세 PLAN 동기화**: 리뷰 결정 변경 시 양쪽 즉시 업데이트

### 학습 방법
- **빈칸 채우기 방식 재구현**: 전체 삭제가 아닌 핵심 로직만 빈칸
- **사용자 수준**: JavaScript 기초(`const`, `await`)부터 설명 필요. 간결하게

### 실패한 접근 (반복하지 말 것)
- **계획 파일 없이 코드 작성**: 반드시 `docs/plan/` 파일 먼저 생성
- **체크리스트 없는 응답**: 모든 응답 첫 줄에 체크리스트 필수
- **useEffect dependency에 내부 설정 state 포함**: self-cancellation 발생
- **Server Action에서 에러 throw**: `{ error }` 반환이 안정적
- **`gemini-2.0-flash` 모델**: 사용 불가 → `gemini-2.5-flash` 사용
- **AI bounding box 기반 sharp crop**: 정확도 부족 → AI 도형 생성으로 대체
- **`block_before/block_after` 도형 위치**: 텍스트 중간 도형 60% 미커버 → `{{fig:N}}` 구분자 통일
- **`/g` 플래그 정규식 lastIndex 미리셋**: 두 번째 호출부터 잘못된 위치에서 탐색
- **`dangerouslySetInnerHTML` catch 폴백 미이스케이프**: XSS 위험 → HTML 특수문자 이스케이프 필수

---

## 5. 핵심 참조 문서

| 우선순위 | 문서 |
|---------|------|
| 1 | `CLAUDE.md` — 규칙·워크플로우 |
| 2 | `MEMORY.md` — 반복 실수·기술 교훈 |
| 3 | `ROADMAP.md` — 순차 스텝별 로드맵 (단계 1.5 포함) |
| 4 | `docs/plan/latex-rendering.md` — LaTeX 렌더링 마스터 PLAN v2 (완료) |
| 5 | `docs/research/math-figures-recommendation.md` — 도형 렌더링 추천안 |
| 6 | `docs/research/figure-placement-recommendation.md` — 도형 위치 추천안 v2 |

### 주요 파일 참조

| 기능 | 파일 |
|------|------|
| **LaTeX 파서** | `src/lib/utils/latex-parser.ts` |
| **LaTeX 렌더러** | `src/components/ui/latex-renderer.tsx` |
| **업로드 API Route** | `src/app/api/past-exams/upload/route.ts` |
| 편집 UI | `src/app/(dashboard)/past-exams/[id]/edit/extraction-editor.tsx` |
| 문제 카드 | `src/app/(dashboard)/past-exams/[id]/edit/question-card.tsx` |
| 추출 Action | `src/lib/actions/extract-questions.ts` |
| AI 설정 | `src/lib/ai/config.ts` |

### 환경 설정 (.env.local)

```
GEMINI_API_KEY=... (유료 결제 활성화된 Google Cloud 프로젝트의 키)
GEMINI_MODEL=gemini-2.5-flash (gemini-2.0-flash는 새 프로젝트에서 사용 불가)
```

### 진행 중 이슈

- 마이그레이션 00004: Supabase Cloud에 **미적용** (로컬 파일만 존재)
- 마이그레이션 00005: **수동 적용 완료** (Dashboard SQL Editor에서 실행)
- 마이그레이션 20260315: **수동 적용 완료** (3계층 구조)
- `await cookies()` 필수 (Next.js 16 비동기)
- 시드 데이터 UUID가 비표준 → Zod `.uuid()` 대신 `.min(1)` 사용 중
- ~~LaTeX 수식 미렌더링~~ → **단계 1.5-1에서 해결 완료** ✅
