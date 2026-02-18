# COMPASS 프로젝트 핸드오프 문서

> **최종 업데이트**: 2026-02-18 (1-5 Step 2 학습 리뷰 완료, **Step 3 시작 대기**)
> **대상**: 이 프로젝트를 이어받는 새로운 에이전트

---

## 1. Goal (목표)

**COMPASS**는 한국 학원을 위한 AI 기반 학교별 예상시험 생성 플랫폼이다.

- **비즈니스 모델**: B2B2C (학원 → 학생)
- **핵심 가치**: 학교별 맞춤 시험 예측으로 학원의 경쟁력 강화
- **현재 Phase**: 단계 1 진행 중 (1-1~1-4 완료, **1-5 Step 2 완료 + 학습 리뷰 완료**)
- **워크플로우**: 순차 실행 (스텝별로 하나씩 완료 후 다음 진행)
- **사용자 학습 목표**: 코드 구현뿐 아니라 개념 이해가 핵심. 자동 구현 후 반드시 리뷰 세션 진행

기술스택: Next.js 16.1.6 + React 19 + Supabase + Google Gemini + Vercel

---

## 2. Current Progress (현재 진행 상황)

### Phase 0 (100% 완료)

- **0-1~0-4**: Next.js + Supabase + 레이아웃 + 공통 UI 컴포넌트
- **0-5**: AI 추상화 레이어 (Factory + Strategy 패턴, GeminiProvider, 94개+ 테스트)

### 단계 1: 기출 기반 문제 생성 + 인증 (55% 완료)

| 스텝 | 작업 | 상태 |
|------|------|------|
| 1-1 | 인증 시스템 [F010] (로그인/회원가입/비번재설정/미들웨어) | ✅ 완료 |
| 1-2 | 기출문제 업로드 [F005] (Storage 버킷 + 업로드 폼) | ✅ 완료 |
| 1-3 | 학교 관리 CRUD [F008] (목록/생성/수정/삭제) | ✅ 완료 |
| 1-4 | 학원 관리 CRUD [F007] (조회/수정, 초대코드) | ✅ 완료 |
| **1-5** | **사용자 관리 CRUD [F009]** | **🚧 Step 2 완료, Step 3 대기** |
| 1-6 | 기출문제 조회 [F006] | 미시작 |
| 1-7 | 기출 기반 AI 문제 생성 [F011] | 미시작 |
| 1-8 | 생성된 문제 저장 [F003] | 미시작 |

### 이번 세션에서 한 일 (2026-02-18)

1. **Step 2 학습 리뷰 완료** ✅
   - 이해도 체크 질문 4개 → 사용자 답변 → 피드백 제공
   - **삭제 후 재구현(빈칸 채우기)** 완료 — 5개 빈칸 모두 채움, 28개 테스트 PASS
   - 체화한 개념: Fail-fast 패턴, Defense in Depth, RBAC 매트릭스

2. **문서 업데이트 + 커밋**
   - ROADMAP.md, docs/plan/ 진행 상황 업데이트
   - 4개 분할 커밋 생성 + push 완료

### 1-5 구현 Steps (5단계)

| Step | 내용 | 학습 등급 | 상태 |
|------|------|----------|------|
| 1 | Zod 검증 스키마 (TDD) | 🟢 ROUTINE | ✅ 완료 (Step 2에 통합) |
| 2 | Server Actions (TDD) — 역할 변경 핵심 | 🔴 CRITICAL | ✅ 구현 + 학습 리뷰 완료 |
| **3** | **DataTable + 목록 페이지 UI** | **🟡 RECOMMENDED** | **⏳ 다음 작업** |
| 4 | 역할 변경 Dialog + 상세 Sheet | 🟡 RECOMMENDED | 미시작 |
| 5 | 메뉴 + 빌드 검증 + 학습 리뷰 | - | 미시작 |

---

## 3. What Worked (성공한 접근)

### 개발 패턴
- **`useTransition` + Server Actions**: React Hook Form과 통합 용이, 직접 결과 핸들링
- **Defense in Depth**: RLS(DB 계층) + Server Action(앱 계층) + Zod(검증 계층) 3중 권한 체크
- **Self-referencing ID 패턴**: academy_id를 파라미터가 아닌 profile에서 추출 → URL 조작 방지
- **Server Component에서 역할 분기**: DevTools 우회 방지, 불필요한 코드 클라이언트 전송 방지
- **TDD RED→GREEN→REFACTOR** 철저 준수
- **UUID v4 형식 엄수**: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` (4는 버전, y는 8-b)
- **Supabase `or()` 필터**: `query.or('name.ilike.%검색%,email.ilike.%검색%')` — 복수 컬럼 동시 검색

### 학습 방법
- **삭제 후 재구현 (빈칸 채우기 방식)**: 전체 삭제가 아닌 핵심 로직만 빈칸 → 구조는 보면서 직접 작성
- **학습 리뷰 MANDATORY**: 구현 후 반드시 개념 리뷰 → 이해도 체크 → 직접 구현 추천 순서
- **사용자 수준에 맞춘 설명**: JavaScript 기초(`const`, `await`)부터 설명 필요. 간결하게.
- **오타도 학습 기회**: `arror` → `error`, `alert` → `error` 등 키 이름 실수가 타입 안전성의 중요성 체감에 도움

### 도구 활용
- **Sequential Thinking MCP**: 계획 수립 시 반드시 사용. `select:mcp__sequential-thinking__sequentialthinking`
- **병렬 에이전트 실행**: ui-markup-specialist (마크업) + nextjs-supabase-expert (로직) 동시 실행
- **모델 전략**: Opus (계획/설계), Sonnet (구현/코딩)
- **TDD 직접 구현**: Task 에이전트 없이 필립이 직접 RED→GREEN 진행 → 사용자 요청에 부합

---

## 4. What Didn't Work (실패/주의사항)

### 학습 리뷰 생략 (이전 세션)
- **문제**: Step 2 구현 완료 후 학습 리뷰 없이 다음 단계로 넘어가려 함
- **교훈**: **구현 완료 ≠ 작업 완료**. 학습 리뷰는 MANDATORY

### Task 에이전트 vs 직접 구현 혼동
- **교훈**: 사용자가 "직접 구현"을 원하면 Task 에이전트 없이 필립이 직접 수행

### 계획 문서 누락 (이전 세션)
- **교훈**: 아무리 단순한 작업이라도 계획 문서를 먼저 생성한 후 구현

### Sequential Thinking MCP 누락 (이전 세션)
- **교훈**: 계획 수립 시 반드시 Sequential Thinking MCP 활용

### 병렬 에이전트 파일 충돌
- **교훈**: 병렬 에이전트에 동일 파일 할당 금지

### 삭제 후 재구현 — "통째로 삭제" 방식 실패
- **해결**: "빈칸 채우기" 방식으로 전환 (구조 유지, 핵심 로직만 빈칸)

### Supabase placeholder 타입 문제 (진행 중)
- `as any` 캐스팅 + `eslint-disable` 주석으로 우회 중
- `npx supabase gen types typescript --project-id <ID> > src/types/supabase.ts` 실행으로 해결 가능 (선택)

### Next.js / Supabase 주의사항
- `await cookies()` 필수 (Next.js 16 비동기)
- handle_new_user 트리거에서 role 항상 `'student'` 고정
- 마이그레이션 00004, 00005는 Supabase Cloud에 **아직 미적용** (로컬 파일만 생성)

---

## 5. Next Steps (다음 단계)

### 즉시: 1-5 Step 3 — DataTable + 목록 페이지 UI

**계획 수립 필요** (Opus + Sequential Thinking MCP):
- `docs/plan/phase-1-step5-user-crud.md` Step 3 섹션 참조

**구현 대상**:
```
src/app/(dashboard)/admin/users/
├── page.tsx                         # Server Component (데이터 조회)
└── _components/
    ├── user-columns.tsx             # DataTable 컬럼 정의
    └── users-toolbar.tsx            # 필터/검색 툴바
```

**핵심 포인트**:
- `searchParams` 파싱 (Next.js 16 `Promise` 패턴)
- `getUserList(filters)` Server Action 연동
- 역할 Badge (student=회색, teacher=파랑, admin=보라)
- debounce 검색 + router.push로 searchParams 업데이트
- 1-3 학교 관리 DataTable 패턴 재사용

### 이후: 1-5 Step 4~5

- **Step 4**: 역할 변경 AlertDialog + 사용자 상세 Sheet
- **Step 5**: 사이드바 메뉴 + 빌드 검증 + 학습 리뷰

### 1-5 완료 후

- 1-6: 기출문제 조회 [F006] — DataTable + 검색/필터
- 1-7: 기출 기반 AI 문제 생성 [F011] — `createAIProvider()` 연동
- 1-8: 생성된 문제 저장 [F003] — 문제 CRUD

---

## 6. Architecture Decisions (주요 아키텍처 결정)

| 결정 | 이유 |
|------|------|
| 5개 레이어 아키텍처 | 프레젠테이션/비즈니스/AI/데이터/횡단 관심사 분리 |
| Server Actions + Service Layer | MVP 속도 + Phase 2 NestJS 전환 시 재사용 |
| AI Provider Pattern (Factory + Strategy) | Gemini → OpenAI/Claude 교체를 Factory에 case 추가로 해결 |
| Supabase RLS 멀티테넌시 | academy_id 기반 데이터 격리, 3중 보안 |
| Route Groups: (auth)/(dashboard) | URL 영향 없이 레이아웃 분리 |
| 순차 실행 워크플로우 | 병렬 트랙 대비 안정성, 컨텍스트 관리 용이 |
| 계획 문서 → docs/plan/ | 모든 계획은 마크다운으로 문서화 후 구현 |
| 학습 리뷰 MANDATORY | 구현 후 반드시 개념 리뷰 + 이해도 체크 + 직접 구현 추천 |
| useTransition (useActionState 미사용) | React Hook Form 통합 용이, 직접 결과 핸들링 |
| 1-5: 일반 클라이언트 사용 (admin 클라이언트 미사용) | RLS 2중 방어 유지, service role은 RLS 우회 → 코드 버그 시 위험 |

---

## 7. 개발 명령어

```bash
npm run dev            # 개발 서버 (Turbopack)
npm run build          # 프로덕션 빌드
npm run lint           # ESLint
npm run test:run       # Vitest 단일 실행

# 단일 테스트 파일 실행
npx vitest run src/lib/actions/__tests__/users.test.ts
```

---

## 8. 핵심 참조 문서 (우선순위 순)

1. `CLAUDE.md` — 프로젝트 개발 지침 (역할, 원칙, **학습 플로우**)
2. `ROADMAP.md` — 순차 스텝별 개발 로드맵
3. **`docs/plan/phase-1-step5-user-crud.md`** — **1-5 전체 계획 (5단계)**
4. `docs/plan/phase-1-step5-2-server-actions.md` — Step 2 상세 계획 (완료)
5. `docs/plan/phase-1-step5-1-zod-schemas.md` — Step 1 상세 계획 (완료)
6. `docs/plan/phase-1-step4-academy-crud.md` — 1-4 전체 계획 (참고 패턴)
7. `docs/design/시스템아키텍처.md` — 아키텍처, DB 스키마, 데이터 흐름
8. `docs/prd/PRD-v0.1-detailed.md` — 기능 명세 및 페이지별 상세

### 1-5 핵심 구현 파일 (완료)

- `src/lib/actions/users.ts` — 3개 Server Actions + 2개 헬퍼 (300줄)
- `src/lib/actions/__tests__/users.test.ts` — 28개 테스트 (626줄)
- `src/lib/validations/users.ts` — 3개 Zod 스키마 (47줄)

---

## 9. 알려진 제약 (의도적 MVP 제한)

- DB 타입: placeholder (`supabase gen types` 미실행 → `as any` 우회 중)
- `questions.content = TEXT`: 수식은 LaTeX 마크업, 그래프/이미지 미지원
- 지문형 문제 미지원 (영어 지문+복수문제 구조 없음)
- 소셜 로그인 미지원 (이메일/비밀번호만)

### 설계 제약 (Phase 2+ 개선 예정)

- **Grade 표기**: 1-12 (K-12 시스템) vs 한국 초중고
- **학교 교사 관리 미지원**: 현재는 학원 교사만 관리
- **배열 필드 정규화**: teachers.subjects[], teachers.grades[] 비정규화

상세 내용: `ROADMAP.md` → "알려진 설계 제약 및 개선 계획"
