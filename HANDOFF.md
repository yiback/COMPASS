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
| 버그 | 학년 필터링 + 업로드 버그 | 완료 |
| E2E | 단계 1 통합 테스트 | 완료 (Chrome DevTools MCP) |

### 현재 세션 요약 (2026-03-22, 세션 28)

**단계 1.5-1 LaTeX 수식 렌더링 전체 구현 완료**:

1. **리서치 (6개 주제, 15개 문서)**: LaTeX 렌더링, 편집 미리보기, 도형/그래프, 도형 위치, 텍스트 중간 도형
2. **PLAN v2 + Wave 1~4 상세 계획**: 8 Tasks, 파일 소유권 명시, 병렬 구현 설계
3. **PLAN 리뷰 2회**: 마스터 리뷰 + 상세 리뷰 (MUST FIX 4건 수정 후 READY)
4. **구현**: katex 설치, parseLatexText 파서 (4종 세그먼트), LatexRenderer 컴포넌트 (React.memo + figure 폴백), ReadMode 11곳 적용, EditMode Live Preview Below
5. **코드 리뷰**: security + perf + test 3명 리뷰, HIGH 3건 수정 (React.memo, CSS 이동, catch XSS), 테스트 6개 추가
6. **테스트**: 31 tests ALL PASS (파서 22 + 렌더러 9)
7. **E2E**: Chrome DevTools MCP로 ReadMode/EditMode 수식 렌더링 시각 검증
8. **커밋 2건**: `e847cd0` feat + `a9046d3` docs

### 이전 세션 요약 (2026-03-22, 세션 27)

**figure crop 제거 + figure Signed URL 버그 수정 + 커밋 2건 + 문서 업데이트**:

1. **커밋 2건 (세션 26 미커밋 분)**:
   - `490d003` 🐛 fix: E2E 버그 수정 4건 — Route Handler 업로드, useRef guard, 추출 에러 핸들링, 상세 시트 편집 버튼
   - `86c4ab0` 📝 docs: 단계 1 완료 반영 — ROADMAP/HANDOFF/PLAN 문서 업데이트

2. **figure Signed URL 버그 수정** (미커밋):
   - **원인**: crop 이미지의 `fig.url`(Storage 경로)을 Signed URL로 변환하지 않고 `<img src>`에 직접 사용
   - **해결**: `figureSignedUrls` 상태 + useEffect 추가 → Signed URL 생성 후 렌더링

3. **figure crop 제거** (미커밋):
   - **문제**: AI bounding box 부정확 (21번 문제인데 23번 영역 crop) + 학생 필기 흔적 포함
   - **결정**: crop 로직 전체 제거, AI 텍스트 설명만 표시
   - **Phase 2**: AI가 도형을 새로 생성 (SVG → PNG) — crop 불필요
   - **제거 파일**: `extract-questions.ts` (sharp crop ~70줄), `question-card.tsx` (crop 이미지 렌더링 → 텍스트 설명), `extraction-editor.tsx` (figureSignedUrls 제거)

4. **ROADMAP/PLAN 문서 업데이트**:
   - ROADMAP: 단계 1 통합 테스트 ✅ 체크
   - extraction-step1~8: 완료 기준 체크, 중복 상태 라인 제거

### 미커밋 변경사항 (세션 27)

| 파일 | 변경 내용 |
|------|---------|
| `src/lib/actions/extract-questions.ts` | sharp crop + Storage 업로드 로직 제거 (~70줄), figure.url = null 고정 |
| `src/app/(dashboard)/past-exams/[id]/edit/question-card.tsx` | FigurePreview → crop 이미지 제거, AI 텍스트 설명만 표시 |
| `src/app/(dashboard)/past-exams/[id]/edit/extraction-editor.tsx` | figureSignedUrls 상태/useEffect 제거 |

### 이전 세션 (세션 11-26)

- 세션 26: E2E 테스트 전체 통과 + 버그 수정 4건 + UI 개선
- 세션 25: 기출문제 추출 전체 구현 (34개 파일, 1235 tests, 빌드 성공)
- 세션 24: PLAN v7 수립 + 리뷰 READY 판정
- 세션 23: PLAN v6 리뷰 + 확정
- 세션 19-22: 기출문제 추출 계획 v1→v5 수립
- 세션 18: 학년 필터링 구현 완료 + 업로드 버그 수정
- 세션 17: 학년 필터링 학습 리뷰
- 세션 16: 학년 필터링 버그 연구 + 구현 계획 완료
- 세션 15: 1-8 전체 구현 완료
- 세션 11-14: 학습 리뷰 + NOTE 순차 리뷰

---

## 3. 다음 작업

### 즉시 해야 할 일 (우선순위순)

1. **미커밋 변경사항 커밋** — 세션 27에서 수정한 3개 파일 (위 표 참조)

2. **기본 모델 코드 업데이트** — `src/lib/ai/config.ts`의 기본값을 `gemini-2.5-flash`로 변경 (현재 `.env.local`에서만 설정)

3. **sharp 의존성 제거 검토** — crop 제거로 `extract-questions.ts`에서 sharp 미사용. `resetExtractionAction`의 Storage cleanup에서도 사용 안 함. package.json에서 제거 가능 여부 확인

4. **단계 1 Phase 회고** — `docs/retrospective/phase-1-retro.md` 작성

5. **단계 2 계획 수립** — ROADMAP.md 참조하여 2-1 RBAC 시스템부터 시작

### LaTeX 렌더링 (Phase 2 또는 즉시)

- 현재 수식이 `$\frac{8\sqrt{3}}{3}\pi$` 같은 raw LaTeX로 표시됨
- `react-katex` 또는 `katex` 패키지로 렌더링 가능
- 수학 시험 서비스이므로 우선순위 높음 — Phase 2 초기 또는 즉시 적용 권장

---

## 4. 성공한 접근 (재사용할 패턴)

### 개발 패턴
- **Defense in Depth**: RLS + Server Action + Zod 3중 권한 체크
- **Self-referencing ID**: academy_id를 profile에서 추출 → URL 조작 방지
- **TDD RED→GREEN→REFACTOR** 철저 준수
- **URL searchParams 기반 상태 관리**: 북마크/공유/뒤로가기 자연 지원
- **Supabase FK JOIN**: `schools!inner` (JOIN방식), `profiles!created_by` (FK구분자)
- **Signed URL 패턴**: 경로만 DB 저장, 상세 조회 시에만 생성
- **useEffect race condition 방지**: `let cancelled = false` + cleanup 패턴
- **useRef guard 패턴**: effect 내부에서 설정하는 값은 dependency 대신 useRef로 분리 (자기 취소 방지)
- **Optimistic Lock**: `.update().in().select('id')` + 빈 배열 체크로 동시 추출 방지
- **isCompleted + try/catch/finally**: catch에서 `{ error }` 반환 + finally에서 DB 롤백 보장
- **Route Handler 우회**: Server Action bodySizeLimit 미적용 시 API Route로 대체
- **temp-ID 패턴**: 수동 추가 문제에 `temp-{uuid}` 임시 ID → DB 저장 시 실제 ID로 교체
- **E2E 테스트**: Chrome DevTools MCP로 실제 브라우저 자동화 테스트

### 학습 방법
- **빈칸 채우기 방식 재구현**: 전체 삭제가 아닌 핵심 로직만 빈칸
- **사용자 수준**: JavaScript 기초(`const`, `await`)부터 설명 필요. 간결하게

### 실패한 접근 (반복하지 말 것)
- **계획 파일 없이 코드 작성**: 반드시 `docs/plan/` 파일 먼저 생성
- **체크리스트 없는 응답**: 모든 응답 첫 줄에 체크리스트 필수
- **useEffect dependency에 내부 설정 state 포함**: self-cancellation 발생 → useRef로 guard 분리
- **Server Action에서 에러 throw**: 클라이언트 `.catch()` 의존 대신 `{ error }` 반환이 안정적
- **`gemini-2.0-flash` 모델 사용**: 새 프로젝트에서 사용 불가 → `gemini-2.5-flash` 사용
- **`experimental.serverActions.bodySizeLimit`**: Next.js 16 Turbopack에서 무시될 수 있음 → Route Handler 우회
- **AI bounding box 기반 sharp crop**: 정확도 부족 (엉뚱한 문제 영역 crop) + 학생 필기 포함 → Phase 2에서 AI 도형 생성으로 대체

---

## 5. 핵심 참조 문서

| 우선순위 | 문서 |
|---------|------|
| 1 | `CLAUDE.md` — 규칙·워크플로우 |
| 2 | `MEMORY.md` — 반복 실수·기술 교훈 |
| 3 | `ROADMAP.md` — 순차 스텝별 로드맵 |
| 4 | `docs/plan/20260308-past-exam-extraction.md` — 기출문제 추출 마스터 PLAN v9 |
| 5 | `docs/plan/extraction-step1~8.md` — Step별 상세 구현 계획 |

### 주요 파일 참조

| 기능 | 파일 |
|------|------|
| **업로드 API Route** | `src/app/api/past-exams/upload/route.ts` |
| 업로드 UI | `src/app/(dashboard)/past-exams/upload/upload-form.tsx` |
| 편집 UI | `src/app/(dashboard)/past-exams/[id]/edit/extraction-editor.tsx` |
| 문제 카드 | `src/app/(dashboard)/past-exams/[id]/edit/question-card.tsx` |
| 추출 Action | `src/lib/actions/extract-questions.ts` |
| 시험 관리 Action | `src/lib/actions/exam-management.ts` |
| 상세 시트 | `src/app/(dashboard)/past-exams/_components/past-exam-detail-sheet.tsx` |
| AI 설정 | `src/lib/ai/config.ts` (기본 모델: gemini-2.0-flash → .env.local에서 gemini-2.5-flash 오버라이드) |

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
- LaTeX 수식 미렌더링 — raw 텍스트로 표시 중 (KaTeX 미적용)
