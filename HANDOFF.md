# COMPASS 프로젝트 핸드오프 문서

> **최종 업데이트**: 2026-03-25 (세션 33: 인프라 부채 정리 + 단계 2-3 역할별 대시보드 완료)
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

11개 파일, 1431 tests, E2E 7개 여정 (세션 32)

### 단계 2-3: 역할별 대시보드 [F018] (100% 완료) ✅

5개 파일, 1460 tests, E2E admin 대시보드 통과 (세션 33)

### 세션 33 작업 요약

```
1. 코드 리뷰 잔여 이슈 4건 정리
   - canEdit 명시적 계산, useMemo 캐싱, Zod 검증 강화
2. extract-questions 테스트 실패 2건 수정
   - crop 제거 + { error } 반환 패턴 반영
3. Server Action 인증 헬퍼 통합 (12개 → getCurrentUser() 1개)
   - helpers.ts 신규 + 10개 Action 교체 + 13개 테스트 mock 교체
   - 3개 에이전트 병렬 구현, 코드 리뷰 2차 만장일치 PASS
   - 순수 1118줄 감소, 1449 tests
4. 역할별 대시보드 구현
   - getDashboardStats (역할별 Promise.all 병렬 쿼리)
   - AdminDashboard: 통계 5카드 + 최근 기출 5건
   - TeacherDashboard: 내 통계 4카드 + 최근 활동
   - student/system_admin: page.tsx 인라인
   - 코드 리뷰 2차 만장일치 PASS, E2E 콘솔 에러 0건
5. 회고 + 문서 업데이트
```

---

## 3. 다음 작업

### 즉시 해야 할 일

1. **단계 2-4 성취기준 기반 AI 문제 생성 [F001]** — 2-2의 직접 후속
   - 성취기준 선택 → AI 프롬프트 연동
   - achievement_standard_id FK 활용

2. **단계 2-5 문제 검수 시스템 [F004]**
   - 검수 워크플로우, 승인/수정/반려 UI

### 기술 부채 (CONSIDER — 별도 관리)

| 이슈 | 상태 |
|------|------|
| schools.ts 읽기 Actions에 인증 체크 없음 | RLS 방어 중 |
| users.ts getUserList에 academy_id 코드레벨 필터 없음 | RLS 방어 중 |
| achievement-standards 조회에서 profiles SELECT 강제 실행 | 성능 — MVP 허용 |
| page.tsx 인증 2회 중복 (getCurrentProfile + getCurrentUser) | 향후 profile 주입 패턴으로 개선 |

---

## 4. 성공한 접근 (재사용할 패턴)

### 개발 패턴
- **인프라 부채 먼저 정리 → 기능 개발**: 기술 부채 쌓인 상태에서 기능 추가 = 복잡도 폭발
- **Defense in Depth 4중 방어**: page.tsx + 사이드바 + Server Action + RLS
- **인증 헬퍼 통합**: 12개 중복 → `getCurrentUser()` 1개. 역할 체크는 호출부 (SRP)
- **3 에이전트 병렬 리팩토링**: 파일 소유권 분리 → 충돌 0건
- **Promise.all 병렬 쿼리**: 대시보드 admin 6쿼리, teacher 5쿼리 병렬 실행
- **system_admin createAdminClient**: RLS가 NULL academy_id 차단 → service_role 필요
- **PLAN 리뷰 3회 제한**: 과도 반복 방지
- **Wave 병렬 구현**: 파일 소유권 명확 → 충돌 0건

### 학습 방법
- **빈칸 채우기 방식 재구현**: 전체 삭제가 아닌 핵심 로직만 빈칸
- **사용자 수준**: JavaScript 기초부터 설명 필요. 간결하게

### 실패한 접근 (반복하지 말 것)
- **PLAN에서 전수 검색 미흡**: 인증 헬퍼 7개 → 실제 12개. 함수 정의뿐 아니라 패턴으로도 검색
- **마이그레이션 상태 기록 오류**: "미적용"으로 기록했지만 실제 적용됨 → 적용 즉시 업데이트
- **PLAN v1 YAGNI 과도 적용**: 사용자가 원한 기능 제거 → 복원 요청
- **코드 리뷰 반복 요청**: PASS 후 같은 코드에 재리뷰 = 비효율

---

## 5. 핵심 참조 문서

| 우선순위 | 문서 |
|---------|------|
| 1 | `CLAUDE.md` — 규칙·워크플로우 |
| 2 | `MEMORY.md` — 반복 실수·기술 교훈 |
| 3 | `ROADMAP.md` — 순차 스텝별 로드맵 |
| 4 | `docs/retrospective/session-33-retro.md` — 세션 33 회고 |
| 5 | `docs/plan/auth-helper-consolidation.md` — 인증 헬퍼 통합 PLAN (완료) |
| 6 | `docs/plan/dashboard-by-role.md` — 대시보드 PLAN v2 (완료) |

### 세션 33 핵심 파일

| 기능 | 파일 |
|------|------|
| **인증 헬퍼 (통합)** | `src/lib/actions/helpers.ts` |
| **대시보드 Server Action** | `src/lib/actions/dashboard.ts` |
| **Admin 대시보드** | `src/components/dashboard/admin-dashboard.tsx` |
| **Teacher 대시보드** | `src/components/dashboard/teacher-dashboard.tsx` |
| **대시보드 페이지** | `src/app/(dashboard)/page.tsx` |

### 환경 설정 (.env.local)

```
GEMINI_API_KEY=... (유료 결제 활성화된 Google Cloud 프로젝트의 키)
GEMINI_MODEL=gemini-2.5-flash (gemini-2.0-flash는 새 프로젝트에서 사용 불가)
```

### 진행 중 이슈

- 마이그레이션 00004~20260324: **모두 수동 적용 완료**
- `await cookies()` 필수 (Next.js 16 비동기)
- 시드 데이터 UUID가 비표준 → Zod `.uuid()` 대신 `.min(1)` 사용 중
