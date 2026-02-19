# COMPASS 프로젝트 핸드오프 문서

> **최종 업데이트**: 2026-02-19 (1-6 Step 2 완료, Step 3 대기)
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

### 단계 1: 기출 기반 문제 생성 + 인증 (63% 완료)

| 스텝 | 작업 | 상태 |
|------|------|------|
| 1-1 | 인증 시스템 [F010] | ✅ 완료 |
| 1-2 | 기출문제 업로드 [F005] | ✅ 완료 |
| 1-3 | 학교 관리 CRUD [F008] | ✅ 완료 |
| 1-4 | 학원 관리 CRUD [F007] | ✅ 완료 |
| 1-5 | 사용자 관리 CRUD [F009] | ✅ 완료 |
| **1-6** | **기출문제 조회 [F006]** | **🚧 Step 2 완료 (2/5), Step 3 대기** |
| 1-7 | 기출 기반 AI 문제 생성 [F011] | 미시작 |
| 1-8 | 생성된 문제 저장 [F003] | 미시작 |

### 현재 세션 (2026-02-19)

1. 1-6 Step 1 구현: `pastExamFilterSchema` + `PastExamFilterInput` 추가 (테스트 29개)
2. 1-6 Step 2 구현: `getPastExamList` + `getPastExamDetail` TDD 완료 (테스트 18개)
3. 빈칸 채우기: FK JOIN 쿼리 + Signed URL 직접 구현 (`subjects`→`subject`, `anme`→`name` 오타 스스로 발견)
4. 전체 347개 테스트 PASS
5. 커밋 완료 (총 4개 커밋)

---

## 3. 다음 작업

### 즉시: 1-6 Step 3 계획 작성 → 구현

**계획 파일 생성 필요**: `docs/plan/phase-1-step6-3-datatable-ui.md`

**구현할 내용** (기존 상위 계획 참조: `docs/plan/phase-1-step6-past-exam-list.md`):
- `src/app/(dashboard)/admin/past-exams/` 페이지 신규 생성
- DataTable 컬럼 정의 (`past-exam-columns.tsx`)
- Toolbar 필터 컴포넌트 (`past-exams-toolbar.tsx`)
- 상세 보기 Sheet (`past-exam-detail-sheet.tsx`)
- **재사용**: `src/app/(dashboard)/admin/users/` 패턴 동일

**참고 파일**:
- `src/components/data-table/data-table.tsx`
- `src/app/(dashboard)/admin/users/_components/`

### 이후 Step 3~5

| Step | 내용 | 계획 파일 |
|------|------|-----------|
| Step 3 | DataTable UI (columns, toolbar, detail-sheet) | 미작성 |
| Step 4 | 서버사이드 페이지네이션 UI | 미작성 |
| Step 5 | 빌드 검증 + 학습 리뷰 | 미작성 |

전체 계획은 `docs/plan/phase-1-step6-past-exam-list.md`에 있음.

---

## 4. 성공한 접근 (재사용할 패턴)

### 개발 패턴
- **Defense in Depth**: RLS + Server Action + Zod 3중 권한 체크
- **Self-referencing ID**: academy_id를 profile에서 추출 → URL 조작 방지
- **`useTransition` + Server Actions**: 직접 결과 핸들링, isPending으로 중복 클릭 방지
- **Server Component에서 역할 분기**: DevTools 우회 방지, 번들 크기 절감
- **createUserColumns 팩토리 함수**: 호출자 권한에 따라 다른 컬럼 배열 반환
- **URL searchParams 기반 상태 관리**: 북마크/공유/뒤로가기 자연 지원
- **Controlled AlertDialog**: DropdownMenu 외부 Fragment에 배치 → Radix 포커스 충돌 방지
- **TDD RED→GREEN→REFACTOR** 철저 준수
- **업로드 vs 필터 스키마**: 업로드=필수+엄격, 필터=선택+관대 (`optional` = "없으면 전체")
- **URL searchParams 필터 enum에 'all' 추가**: 문자열 타입으로 "전체" 상태 표현
- **`z.coerce.number('')`**: `0` → `.min(1)` 실패 (Zod v4 안전 동작 — `z.preprocess` 불필요)
- **`schools!inner`**: INNER JOIN — `!` 뒤 `inner`=JOIN방식, 컬럼명=FK구분자 (혼용 가능)
- **`profiles!uploaded_by`**: FK 컬럼명 명시 — 같은 테이블로의 FK 2개 이상일 때 PostgREST 구분
- **Signed URL 패턴**: 경로만 DB 저장, 상세 조회 시에만 `createSignedUrl(path, 60)` 생성
- **sanitizeFilters**: Zod 파싱 전 빈 문자열(`''`) → `undefined` 변환, Action 내부에서 처리
- **Mock 테스트 한계**: SQL 문자열 오타(`subjects`, `anme`)는 Mock이 잡지 못함 → E2E 필요

### 학습 방법
- **빈칸 채우기 방식 재구현**: 전체 삭제가 아닌 핵심 로직만 빈칸
- **사용자 수준**: JavaScript 기초(`const`, `await`)부터 설명 필요. 간결하게
- **에이전트 커맨드 준수**: `/plan`, `/tdd` 등 명시된 경우 반드시 해당 서브에이전트 실행

### 실패한 접근 (반복하지 말 것)
- **계획 파일 없이 코드 작성**: 반드시 `docs/plan/` 파일 먼저 생성
- **체크리스트 없는 응답**: 모든 응답 첫 줄에 체크리스트 필수
- **계획 요청에서 코드 읽기/수정**: "계획" 요청 시 계획만 수행. 기존 코드를 과도하게 읽지 말 것
- **계획 파일 임의 축약**: 사용자가 제공한 원본 계획을 그대로 저장할 것
- **병렬 에이전트에 동일 파일 할당**: 충돌 발생

---

## 5. 핵심 참조 문서

| 우선순위 | 문서 |
|---------|------|
| 1 | `CLAUDE.md` — 규칙·워크플로우 |
| 2 | `MEMORY.md` — 반복 실수·기술 교훈 |
| 3 | `ROADMAP.md` — 순차 스텝별 로드맵 |
| 4 | `docs/plan/phase-1-step6-past-exam-list.md` — 1-6 전체 계획 |
| 5 | `docs/plan/phase-1-step6-2-server-actions.md` — Step 2 완료 문서 |
| 6 | `PRD.md` — 기능 명세 |
| 7 | `supabase/migrations/` — DB 스키마·RLS 정책 |

### 1-6 참고용: 기존 구현 패턴

| 재사용 대상 | 출처 파일 |
|------------|----------|
| Server Action + 페이지네이션 | `src/lib/actions/users.ts` |
| **기출문제 조회 액션 (완성)** | **`src/lib/actions/past-exams.ts`** — `getPastExamList`, `getPastExamDetail` |
| Server Component + searchParams | `src/app/(dashboard)/admin/users/page.tsx` |
| URL searchParams 필터 | `src/app/(dashboard)/admin/users/_components/users-toolbar.tsx` |
| DataTable 컴포넌트 | `src/components/data-table/data-table.tsx` |
| Sheet 상세 보기 | `src/app/(dashboard)/admin/users/_components/user-detail-sheet.tsx` |
| Badge 상수 매핑 | `src/app/(dashboard)/admin/users/_components/user-columns.tsx` |
| Zod 필터 스키마 (완성) | `src/lib/validations/past-exams.ts` — `pastExamFilterSchema` |
| 조회 테스트 패턴 | `src/lib/actions/__tests__/past-exams-list.test.ts` |
