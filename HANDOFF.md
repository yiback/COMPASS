# COMPASS 프로젝트 핸드오프 문서

> **최종 업데이트**: 2026-03-23 (세션 30: 단계 1.5-2 도형 렌더링 전체 구현 완료)
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

| Task | 작업 | 상태 |
|------|------|------|
| Task 1 | DB 마이그레이션 (questions.has_figure + figures) | 완료 |
| Task 2 | FigureData Zod 스키마 (6타입 discriminatedUnion + 교차 검증) | 완료 |
| Task 3 | FigureRenderer 기본 컴포넌트 (description 폴백) | 완료 |
| Task 4 | LatexRenderer figure 케이스 (segment.display 우선) | 완료 |
| Task 5 | SVG 유틸 + NumberLine 렌더러 | 완료 |
| Task 6 | AI 추출 프롬프트 {{fig:N}} + 교차 검증 | 완료 |
| Task 7a | CoordinatePlane + CoordinatePlaneContent 분리 | 완료 |
| Task 7b | FunctionGraph (단일 SVG 합성) | 완료 |
| Task 8 | PolygonShape + CircleShape + VectorArrow | 완료 |
| Task 9 | 연속 도형 수평 배치 + 선택지 내 도형 | 완료 |
| Task 10a | AI 생성 프롬프트 도형 출력 + generatedQuestionSchema | 완료 |
| Task 10b | save-questions validation/action 확장 | 완료 |
| Task 11 | 전체 테스트 103개 | 완료 |
| 코드 리뷰 | HIGH 3건 수정 (마커 ID + 테스트 7개 추가) | 완료 |
| E2E | Chrome DevTools MCP 시각적 검증 | 완료 |

### 세션 30 작업 요약

```
1. 도형 렌더링 PLAN v1 → v2 리뷰 (마스터 PLAN 2회, 상세 PLAN 3회)
2. 전체 구현: Wave 1~5 (사전작업 + 11 Task 병렬/직렬)
3. 코드 리뷰: security/perf/test 3명 × 2회차
4. HIGH 3건 수정: SVG 마커 ID 고유화 + validation/extraction 테스트 추가
5. E2E 시각적 검증: 7개 사용자 여정, 콘솔 에러 0건
6. ROADMAP/PLAN 완료 반영
```

### 이전 세션 (세션 11-29)

- 세션 29: 정리 작업 3건 + 도형 렌더링 PLAN v1 작성
- 세션 28: LaTeX 수식 렌더링 구현 (31 tests, E2E 통과)
- 세션 27: figure crop 제거 + 문서 업데이트
- 세션 26: E2E 테스트 전체 통과 + 버그 수정 4건
- 세션 25: 기출문제 추출 전체 구현 (34개 파일, 1235 tests)
- 세션 19-24: 기출문제 추출 계획 v1→v7
- 세션 11-18: 학습 리뷰 + 학년 필터링 + 1-6~1-8 구현

---

## 3. 다음 작업

### 즉시 해야 할 일 (우선순위순)

1. **단계 1.5-2 회고 작성**
   - `docs/retrospective/phase-1.5-retro.md` 작성
   - PLAN 리뷰 프로세스, Wave 병렬 구현, 코드 리뷰 2회차 패턴 교훈 정리

2. **마이그레이션 20260322 Supabase Cloud 적용**
   - `supabase/migrations/20260322_questions_figures.sql`
   - Dashboard SQL Editor에서 수동 실행 (기존 패턴)

3. **단계 2 계획 수립** — ROADMAP.md 참조하여 2-1 RBAC 시스템부터 시작
   - 역할 정의 (학원장, 강사, 학생, 학부모)
   - 역할별 권한 매트릭스
   - 보호된 라우트 미들웨어

### 코드 리뷰 잔여 이슈 (MEDIUM/LOW — 구현 중 처리 가능)

| 등급 | 이슈 |
|------|------|
| MEDIUM | `parseLatexText` + `groupAdjacentFigures` useMemo 캐싱 권장 |
| MEDIUM | figure-schema.test.ts — function_graph xRange/yRange 역전 테스트 추가 |
| LOW | `color` 필드 색상 정규식 추가, `description` 길이 제한 `.max(500)` |
| LOW | `number_line.points` 배열 `.max(50)` 추가 |
| LOW | `FIGURE_OUTPUT_RULES` 코드 중복 → 공유 상수 추출 |

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
- **React.memo**: 순수 렌더링 컴포넌트(LatexRenderer, FigureRenderer)에 필수 적용
- **PLAN 리뷰 3회 제한**: 마스터 2회 + 상세 2회로 효율적 진행
- **Wave 병렬 구현**: orchestrate 패턴으로 독립 Task 동시 실행 (Wave 2: 3개 병렬, Wave 4: 3개 병렬)
- **CoordinatePlaneContent 합성 패턴**: `<g>` 반환 내부 컴포넌트 → function_graph가 단일 `<svg>` 안에서 재조합
- **SVG 마커 ID prefix**: 컴포넌트별 고유 prefix (`nl-`, `cp-`, `fg-`, `vec-`) → 전역 충돌 방지
- **Duck typing 시그니처**: `{ length: number }` → FigureInfo[]와 FigureData[] 모두 수용
- **renderSegment 모듈 레벨**: 컴포넌트 내부 이동 금지 → React.memo 최적화 유지

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
- **`/g` 플래그 정규식 lastIndex 미리셋**: 두 번째 호출부터 잘못된 위치에서 탐색
- **`dangerouslySetInnerHTML` catch 폴백 미이스케이프**: XSS 위험
- **PLAN 9회 반복**: 계획에 6세션 소비 → 3회 제한으로 해결
- **독립 `<svg>` 중첩**: SVG 좌표계가 달라짐 → CoordinatePlaneContent `<g>` 분리로 해결
- **공유 마커 ID `arrowhead`**: 동시 렌더링 시 브라우저 첫 번째 정의만 참조 → 고유 prefix

---

## 5. 핵심 참조 문서

| 우선순위 | 문서 |
|---------|------|
| 1 | `CLAUDE.md` — 규칙·워크플로우 |
| 2 | `MEMORY.md` — 반복 실수·기술 교훈 |
| 3 | `ROADMAP.md` — 순차 스텝별 로드맵 |
| 4 | `docs/plan/figure-rendering.md` — 도형 렌더링 마스터 PLAN v2 (완료) |
| 5 | `docs/plan/figure-rendering-detail.md` — 도형 렌더링 상세 PLAN v2 (완료) |
| 6 | `docs/reviews/figure-rendering-code-review.md` — 코드 리뷰 최종 리포트 |
| 7 | `docs/retrospective/phase-1-retro.md` — Phase 1 전체 회고 |

### 주요 파일 참조

| 기능 | 파일 |
|------|------|
| **FigureData 타입** | `src/lib/ai/types.ts` (6타입 discriminated union) |
| **FigureData Zod** | `src/lib/validations/figure-schema.ts` (스키마 + 교차 검증) |
| **FigureRenderer** | `src/components/ui/figure-renderer.tsx` (switch 분기 + memo) |
| **SVG 컴포넌트** | `src/components/ui/svg/` (7개: utils, number-line, coordinate-plane, function-graph, polygon, circle-shape, vector-arrow) |
| **LaTeX 파서** | `src/lib/utils/latex-parser.ts` |
| **LaTeX 렌더러** | `src/components/ui/latex-renderer.tsx` (figures prop + 연속 도형) |
| **업로드 API Route** | `src/app/api/past-exams/upload/route.ts` |
| 편집 UI | `src/app/(dashboard)/past-exams/[id]/edit/extraction-editor.tsx` |
| 문제 카드 | `src/app/(dashboard)/past-exams/[id]/edit/question-card.tsx` |
| 추출 Action | `src/lib/actions/extract-questions.ts` |
| 저장 Action | `src/lib/actions/save-questions.ts` (figures 지원) |
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
- 마이그레이션 20260322: **미적용** — questions.has_figure/figures (다음 세션에서 수동 적용)
- `await cookies()` 필수 (Next.js 16 비동기)
- 시드 데이터 UUID가 비표준 → Zod `.uuid()` 대신 `.min(1)` 사용 중
- ~~LaTeX 수식 미렌더링~~ → **단계 1.5-1에서 해결 완료** ✅
- 기존 extract-questions.test.ts 실패 2건 — 이번 작업과 무관 (사전 존재)
