# COMPASS 프로젝트 핸드오프 문서

> **최종 업데이트**: 2026-03-21 (세션 26: E2E 테스트 전체 통과 + 버그 수정 4건 + UI 개선)
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

### 기출문제 추출 기능 (구현 + E2E 테스트 완료 — 1235 tests)

| Wave | Step | 작업 | 상태 |
|------|------|------|------|
| 1 | Step 1 | 3계층 스키마 마이그레이션 + RLS + 인덱스 | 완료 |
| 1 | Step 3 | AI 타입 + 프롬프트 빌더 + GeminiProvider 확장 | 완료 |
| 2 | Step 2 | 기존 코드 리팩토링 (past_exam_questions → 3계층) | 완료 |
| 2 | Step 4 | 시험 생성 + 이미지 업로드 Server Action | 완료 |
| 3 | Step 5 | 추출 + crop + 재추출 + 재분석 Action | 완료 |
| 3 | Step 6 | 업로드 UI (다중 이미지 + DnD 순서 변경) | 완료 |
| 4 | Step 7 | 편집 UI (리뷰 + AI 재분석 + 확정) | 완료 |
| 5 | Step 8 | 빌드 검증 + E2E 테스트 | 완료 |

### 현재 세션 요약 (2026-03-21, 세션 26)

**E2E 테스트 전체 통과 + 버그 수정 4건 + UI 개선**:

1. **업로드 body size 버그 수정**:
   - Server Action의 `bodySizeLimit` 설정이 Next.js 16 Turbopack에서 무시됨
   - **해결**: API Route Handler(`/api/past-exams/upload`)로 이전 + `proxyClientMaxBodySize: '100mb'` 추가
   - `createPastExamAction`에 `@deprecated` 주석

2. **추출 실패 시 무한 로딩 UX 버그 수정**:
   - **원인**: `useEffect` dependency에 `isExtracting`(내부에서 설정하는 state) 포함 → 자기 취소(self-cancellation)
   - **해결**: `useRef`로 guard 분리 + `isExtracting`을 dependency에서 제거
   - `extractQuestionsAction`에 `catch` 블록 추가 → throw 대신 `{ error }` 반환 + `console.error` 로깅

3. **상세 시트에 "추출 문제 편집" 버튼 추가**:
   - 기출문제 목록 → 상세 → 편집 페이지 이동 경로가 없었음
   - 상세 시트에 "추출 문제 편집" 버튼 추가 (이미지 위에 배치 → 스크롤 없이 접근)

4. **Gemini API 모델 업데이트**:
   - `gemini-2.0-flash` → `gemini-2.5-flash` (`.env.local`의 `GEMINI_MODEL` 설정)
   - `gemini-2.0-flash`가 새 프로젝트에서 더 이상 사용 불가

5. **E2E 테스트 결과 (Chrome DevTools MCP — 전체 통과)**:
   - ✅ 로그인, 목록 조회, 이미지 업로드 + DnD, 학교→학년 연동
   - ✅ 폼 제출(API Route), 편집 페이지 리다이렉트, Signed URL 이미지
   - ✅ AI 추출 성공 (4문제 추출, 100% confidence, 객관식 + 보기 + 정답 + 그래프)
   - ✅ 실패 상태 실시간 전환 + toast 에러 메시지
   - ✅ 재시도, 수동 문제 추가, 확정 저장 → 목록 리다이렉트
   - ✅ 상세 시트 → 추출 문제 편집 버튼 → 편집 페이지 이동

### 미커밋 변경사항 (세션 26)

| 파일 | 변경 내용 |
|------|---------|
| `src/app/api/past-exams/upload/route.ts` | **신규** — Route Handler (Server Action 대체) |
| `src/app/(dashboard)/past-exams/upload/upload-form.tsx` | fetch 전환 (Server Action → API Route) |
| `src/app/(dashboard)/past-exams/[id]/edit/extraction-editor.tsx` | useRef guard + isExtracting dependency 제거 |
| `src/lib/actions/extract-questions.ts` | catch 블록 추가 + console.error 로깅 |
| `src/lib/actions/exam-management.ts` | `createPastExamAction` @deprecated 주석 |
| `src/app/(dashboard)/past-exams/_components/past-exam-detail-sheet.tsx` | "추출 문제 편집" 버튼 추가 (이미지 위 배치) |
| `next.config.ts` | `proxyClientMaxBodySize: '100mb'` 추가 |
| `HANDOFF.md` | 세션 26 업데이트 |

### 이전 세션 (세션 11-25)

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

1. **미커밋 변경사항 커밋** — 세션 26에서 수정한 7개 파일 (위 표 참조)

2. **기본 모델 코드 업데이트** — `src/lib/ai/config.ts`의 기본값을 `gemini-2.5-flash`로 변경 (현재 `.env.local`에서만 설정)

3. **단계 1 Phase 회고** — `docs/retrospective/phase-1-retro.md` 작성

4. **단계 2 계획 수립** — ROADMAP.md 참조하여 2-1 RBAC 시스템부터 시작

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
- **Compensating Transaction**: Storage + DB 분산 작업의 롤백 (uploadedPaths 추적)
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
