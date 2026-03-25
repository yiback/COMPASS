# COMPASS 프로젝트 핸드오프 문서

> **최종 업데이트**: 2026-03-25 (세션 32: 단계 2-2 성취기준 DB 구축 완료)
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

11 Task + 코드 리뷰 + E2E, 1367 tests (세션 30)

### 단계 2-1: RBAC 시스템 (100% 완료) ✅

23개 파일, 1390 tests, E2E 8개 여정 (세션 31)

### 단계 2-2: 성취기준 DB 구축 (100% 완료) ✅

| Task | 작업 | 상태 |
|------|------|------|
| Task 1 | 마이그레이션 (4개 컬럼 + 76개 시딩) | 완료 |
| Task 2 | Zod 스키마 (create/update/filter 3종) | 완료 |
| Task 3 | Server Action (CRUD 6개 + Autocomplete) | 완료 |
| Task 4 | UI (DataTable + Dialog + 캐스케이딩 필터 + RBAC) | 완료 |
| Task 5 | 테스트 41개 (Zod 14 + Action 27) | 완료 |
| 추가 | 상세 Sheet (행 클릭 → 전체 정보 표시) | 완료 |
| 코드 리뷰 | security/perf/test 3명 × 3차 — CRITICAL 0 | 완료 |
| E2E | 7개 여정 (필터/검색/Sheet), 콘솔 에러 0건 | 완료 |

### 세션 32 작업 요약

```
1. 리서치 v1→v2→v3 (3명 병렬 × 3라운드 = 9회)
   → v1: 자동 수집 YAGNI → v2: CRUD 필수 → v3: 출처/시점 절충
2. PLAN v1(조회만) → v2(CRUD 추가) → v2.1(리뷰 반영)
3. 11개 의사결정 확정 (RLS/편집필드/삭제정책/다과목 등)
4. Task 1~5 상세 계획 + 리뷰 READY
5. Wave 1~4 구현 (Task 1+2 병렬 → 3 → 4 → 5)
6. detail-sheet 추가 (사용자 피드백 "내용이 다 안 보여")
7. 코드 리뷰 3차 만장일치 PASS
8. E2E 7개 여정, 콘솔 에러 0건
9. ROADMAP/PLAN/HANDOFF 완료 반영 + 회고 작성
```

---

## 3. 다음 작업

### 즉시 해야 할 일 (우선순위순)

1. **단계 2-3 역할별 대시보드 [F018]** — ROADMAP.md 참조
   - 학원장/강사/학생 역할별 현황 요약
   - 대시보드 위젯 시스템

2. **단계 2-4 성취기준 기반 AI 문제 생성 [F001]** — 2-2의 직접 후속
   - 성취기준 선택 → AI 프롬프트 연동
   - achievement_standard_id FK 활용

3. **Server Action 리팩토링** (독립 이슈)
   - getCurrentUserProfile 7가지 변형 → `getCurrentUser()` + `requireRole()` 통합

### 코드 리뷰 잔여 이슈 (MEDIUM/LOW)

| 등급 | 이슈 |
|------|------|
| MEDIUM | admin/academy `canEdit = true` 하드코딩 → 명시적 계산 |
| MEDIUM | admin/academy `getMyAcademy()` cache() 밖 중복 쿼리 |
| MEDIUM | `parseLatexText` + `groupAdjacentFigures` useMemo 캐싱 |
| LOW | `color` 필드 색상 정규식, `description` 길이 제한 |

---

## 4. 성공한 접근 (재사용할 패턴)

### 개발 패턴
- **Defense in Depth 4중 방어**: page.tsx + 사이드바 + Server Action + RLS
- **schools.ts CRUD 패턴 100% 재사용**: 성취기준도 동일 구조 복제
- **thenable mock**: Supabase 동적 체인 → Object.defineProperty('then')
- **트리거 vs 제어 모드 Dialog**: union type props로 생성/수정 통합
- **리서치 3라운드 점진적 정제**: 사용자 피드백 반영하며 반복
- **11개 의사결정 명시적 추적**: 리서치→PLAN→구현까지 번호로 추적
- **PLAN 리뷰 3회 제한**: 과도 반복 방지
- **Wave 병렬 구현**: 파일 소유권 명확 → 충돌 0건

### 학습 방법
- **빈칸 채우기 방식 재구현**: 전체 삭제가 아닌 핵심 로직만 빈칸
- **사용자 수준**: JavaScript 기초부터 설명 필요. 간결하게

### 실패한 접근 (반복하지 말 것)
- **PLAN v1 YAGNI 과도 적용**: 사용자가 명시적으로 원한 CRUD를 제거 → 복원 요청
- **리서치 전 요구사항 미확인**: v1→v2→v3 반복 원인 = 요구사항 점진적 추가
- **코드 리뷰 반복 요청**: PASS 후 같은 코드에 재리뷰 = 비효율
- **supabase gen types Docker 미확인**: Docker 미실행 시 타입 파일 비워짐
- **AchievementStandard 타입 누락**: 마이그레이션과 동시에 타입 확장 필수

---

## 5. 핵심 참조 문서

| 우선순위 | 문서 |
|---------|------|
| 1 | `CLAUDE.md` — 규칙·워크플로우 |
| 2 | `MEMORY.md` — 반복 실수·기술 교훈 |
| 3 | `ROADMAP.md` — 순차 스텝별 로드맵 |
| 4 | `docs/plan/achievement-standards-db.md` — 성취기준 마스터 PLAN v2.1 (완료) |
| 5 | `docs/plan/achievement-task-{1-5}-*.md` — 성취기준 Task별 상세 (완료) |
| 6 | `docs/reviews/phase-2.2-code-review.md` — 성취기준 코드 리뷰 최종 |
| 7 | `docs/retrospective/phase-2.2-retro.md` — 성취기준 회고 |
| 8 | `docs/research/achievement-standards-collection-recommendation.md` — 리서치 종합 v3 |

### 성취기준 주요 파일 참조

| 기능 | 파일 |
|------|------|
| **마이그레이션** | `supabase/migrations/20260324_achievement_standards_v2.sql` |
| **Zod 스키마** | `src/lib/validations/achievement-standards.ts` |
| **Server Action (CRUD 6개)** | `src/lib/actions/achievement-standards.ts` |
| **목록 페이지** | `src/app/(dashboard)/achievement-standards/page.tsx` |
| **DataTable 컬럼** | `src/components/achievement-standards/columns.tsx` |
| **캐스케이딩 필터** | `src/components/achievement-standards/toolbar.tsx` |
| **생성/수정 Dialog** | `src/components/achievement-standards/form-dialog.tsx` |
| **비활성화 AlertDialog** | `src/components/achievement-standards/deactivate-dialog.tsx` |
| **상세 Sheet** | `src/components/achievement-standards/detail-sheet.tsx` |
| **테이블 래퍼** | `src/components/achievement-standards/achievement-standards-table.tsx` |
| **테스트 (Zod)** | `src/lib/validations/__tests__/achievement-standards.test.ts` |
| **테스트 (Action)** | `src/lib/actions/__tests__/achievement-standards.test.ts` |

### 환경 설정 (.env.local)

```
GEMINI_API_KEY=... (유료 결제 활성화된 Google Cloud 프로젝트의 키)
GEMINI_MODEL=gemini-2.5-flash (gemini-2.0-flash는 새 프로젝트에서 사용 불가)
```

### 진행 중 이슈

- 마이그레이션 00004: Supabase Cloud에 **미적용** (로컬 파일만 존재)
- 마이그레이션 00005: **수동 적용 완료** (Dashboard SQL Editor에서 실행)
- 마이그레이션 20260315: **수동 적용 완료** (3계층 구조)
- 마이그레이션 20260322: **수동 적용 완료** (Dashboard SQL Editor에서 실행)
- 마이그레이션 20260324: **수동 적용 완료** (성취기준 4컬럼 + 76개 시딩)
- `await cookies()` 필수 (Next.js 16 비동기)
- 시드 데이터 UUID가 비표준 → Zod `.uuid()` 대신 `.min(1)` 사용 중
- 기존 extract-questions.test.ts 실패 2건 — 이번 작업과 무관 (사전 존재)
- Server Action 인증 헬퍼 7가지 변형 중복 → 독립 리팩토링 이슈로 관리
