# COMPASS 프로젝트 핸드오프 문서

> **최종 업데이트**: 2026-02-12 (단계 1-4 Step 2 구현 완료, 다음: Step 3 UI 컴포넌트)
> **대상**: 이 프로젝트를 이어받는 새로운 에이전트

---

## 1. Goal (목표)

**COMPASS**는 한국 학원을 위한 AI 기반 학교별 예상시험 생성 플랫폼이다.

- **비즈니스 모델**: B2B2C (학원 → 학생)
- **핵심 가치**: 학교별 맞춤 시험 예측으로 학원의 경쟁력 강화
- **현재 Phase**: 단계 1 진행 중 (1-1~1-3 완료, 1-4 Step 1~2/5 완료)
- **워크플로우**: 순차 실행 (스텝별로 하나씩 완료 후 다음 진행)
- **사용자 학습 목표**: 코드 구현뿐 아니라 개념 이해가 핵심. 자동 구현 후 반드시 리뷰 세션 진행

기술스택: Next.js 16.1.6 + React 19 + Supabase + Google Gemini + Vercel

---

## 2. Current Progress (현재 진행 상황)

### Phase 0 (100% 완료)

- **0-1~0-4**: Next.js + Supabase + 레이아웃 + 공통 UI 컴포넌트
- **0-5**: AI 추상화 레이어 (Factory + Strategy 패턴, GeminiProvider, 94개+ 테스트)

### 단계 1: 기출 기반 문제 생성 + 인증 (38% 완료)

| 스텝 | 작업 | 상태 |
|------|------|------|
| 1-1 | 인증 시스템 [F010] (로그인/회원가입/비번재설정/미들웨어) | ✅ 완료 |
| 1-2 | 기출문제 업로드 [F005] (Storage 버킷 + 업로드 폼) | ✅ 완료 |
| 1-3 | 학교 관리 CRUD [F008] (목록/생성/수정/삭제) | ✅ 완료 |
| **1-4** | **학원 관리 CRUD [F007]** (Step 1~2 완료) | **⏳ Step 3 진행 예정** |
| 1-5 | 사용자 관리 CRUD [F009] | 미시작 |
| 1-6 | 기출문제 조회 [F006] | 미시작 |
| 1-7 | 기출 기반 AI 문제 생성 [F011] | 미시작 |
| 1-8 | 생성된 문제 저장 [F003] | 미시작 |

### 이번 세션에서 한 일

- **단계 1-4 Step 2 구현 완료: Server Actions (TDD + 삭제 후 재구현)**
  - `src/lib/actions/academies.ts` — 사용자가 직접 타이핑으로 구현
  - `src/lib/actions/__tests__/academies.test.ts` — 13개 테스트 모두 PASS
  - `checkAdminRole()` — admin/system_admin만 허용, academy_id 반환
  - `getMyAcademy()` — 인증 → profiles → academies → snake→camel 변환
  - `updateMyAcademy()` — RBAC → FormData → Zod → DB update → revalidatePath
  - 빌드 성공 확인

- **학습 세션 프로세스 개선**
  - CLAUDE.md "학습 지향" 섹션 강화 (MANDATORY, 생략 불가)
  - 직접 구현 추천 기준 추가 (🔴 CRITICAL / 🟡 RECOMMENDED / 🟢 ROUTINE)
  - 삭제 후 재구현 프로세스 CLAUDE.md에 문서화
  - MEMORY.md에 "학습 세션 자주 생략" 패턴 기록 + 해결책

- **settings.local.json 정리**
  - permissions.allow 간략화 (32줄 → 20줄, `Bash(git:*)` 등 와일드카드)
  - hooks 추가: `learning-reminder` (Task 도구 사용 후 학습 리뷰 리마인더)

- **학습 리뷰 세션 진행**
  - `'use server'` 디렉티브: 서버에서만 실행되는 함수 선언
  - `await`: 시간이 걸리는 작업의 결과를 기다림
  - 구조 분해 `{data:{user}}`: 중첩 객체에서 값을 꺼냄
  - `&` 타입 합치기: 두 타입을 합침
  - RBAC: Role-Based Access Control (역할 기반 접근 제어)
  - profile vs auth.users: auth.users는 Supabase 관리(컬럼 추가 불가), profiles는 비즈니스 데이터용
  - `(x as string) || ''`: 타입 캐스팅 + 기본값, 괄호 위치 중요

### 이전 세션 완료 작업

- **단계 1-4 Step 1 완료: Zod 검증 스키마 (TDD)**
  - `src/lib/validations/academies.ts` — academyUpdateSchema 구현
  - `src/lib/validations/__tests__/academies.test.ts` — 14개 테스트 모두 통과

---

## 3. What Worked (성공한 접근)

### 개발 패턴
- **`useActionState` + Server Actions**: React 19 표준 패턴으로 폼 처리
- **Defense in Depth**: RLS(DB 계층) + Server Action(앱 계층) + Zod(검증 계층) 3중 권한 체크
- **Self-referencing ID 패턴**: academy_id를 파라미터가 아닌 profile에서 추출 → URL 조작 방지
- **TDD RED→GREEN→REFACTOR** 철저 준수

### 학습 방법
- **삭제 후 재구현 (빈칸 채우기 방식)**: 전체 삭제가 아닌 핵심 로직만 빈칸 → 구조는 보면서 보안 로직만 직접 작성
  - 타입 정의 → checkAdminRole() → getMyAcademy() → updateMyAcademy() 순서로 블록별 진행
  - 사용자가 모르는 개념은 즉시 설명 (`await`, 구조분해, RBAC 등)
  - 오타/에러도 학습 기회로 활용 (`|` vs `||`, 괄호 위치, 테이블명 복수형)
- **학습 리뷰 MANDATORY**: 구현 후 반드시 개념 리뷰 → 이해도 체크 → 직접 구현 추천 순서

### 도구 활용
- **`/everything-claude-code:plan` + Sequential Thinking MCP**: 복잡한 설계를 단계별 사고로 분석
- **nextjs-supabase-expert 에이전트**: TDD 사이클 자동화 (초기 구현용)
- **hooks**: `learning-reminder` (Task 도구 사용 후 학습 리뷰 자동 리마인더)

---

## 4. What Didn't Work (실패/주의사항)

### 학습 세션 생략 문제 (해결됨)
- 구현 완료 후 학습 리뷰를 자주 생략하고 다음 단계 바로 제안
- **해결**: CLAUDE.md에 MANDATORY 명시 + hooks에 learning-reminder 추가
- **직접 구현 추천 기준**: 🔴 보안/핵심로직/새패턴 → 반드시 직접 구현 추천

### 삭제 후 재구현 — "통째로 삭제" 방식 실패
- 파일 전체를 삭제하고 처음부터 작성하라는 방식 → 사용자가 막막해함
- **해결**: "빈칸 채우기" 방식으로 전환 → 구조는 제공하고 핵심 로직만 작성

### Supabase placeholder 타입 문제 (현재 진행 중)
- `.insert()`, `.update()` 메서드에서 타입 불일치 → `as any` 캐스팅으로 우회 중
- **근본 해결**: `npx supabase gen types typescript --project-id <ID> > src/types/supabase.ts` 실행 필요

### Next.js / Supabase 주의사항
- `next.config.ts`에서 `import.meta.url` 사용 불가 → `__dirname` 사용
- handle_new_user 트리거에서 role 항상 `'student'` 고정
- seed.sql UUID `s0000000-...` 유효하지 않음 → `b0000000-...` 사용
- `await cookies()` 필수 (Next.js 16 비동기)
- 마이그레이션 00004, 00005는 Supabase Cloud에 **아직 미적용** (로컬 파일만 생성)

### MCP 도구 주의사항
- Sequential Thinking MCP와 zen MCP를 혼동하기 쉬움
- **반드시** ToolSearch로 `select:mcp__sequential-thinking__sequentialthinking` 확인 후 사용

---

## 5. Next Steps (다음 단계)

### 즉시 해야 할 일

#### 1. 단계 1-4 Step 3: UI 컴포넌트

- `src/app/(dashboard)/admin/academy/page.tsx` 구현
- 읽기 전용 UI (teacher) / 수정 폼 UI (admin)
- `useActionState` + `getMyAcademy()` + `updateMyAcademy()` 연동
- 🟢 ROUTINE — UI 마크업이므로 AI 자동 구현 OK

#### 2. 단계 1-4 나머지 Step (4~5)

- Step 4: 사이드바 메뉴 연결
- Step 5: 빌드 검증 + 학습 리뷰

#### 3. 이어서 순차 진행

- 1-5: 사용자 관리 CRUD [F009] — 역할 변경 (admin 클라이언트)
- 1-6: 기출문제 조회 [F006] — DataTable + 검색/필터
- 1-7: 기출 기반 AI 문제 생성 [F011] — `createAIProvider()` 연동
- 1-8: 생성된 문제 저장 [F003] — 문제 CRUD

#### 4. 단계 1 완료 후

- 통합 테스트 (E2E)
- `supabase gen types` 실행 → placeholder 타입 해소
- 학습 리뷰 세션
- 단계 2로 이동 (ROADMAP.md 참조)

#### 5. 정리 작업

- `src/lib/actions/academies.ts.reference` 삭제 (학습용 백업, 더 이상 필요 없음)
- `src/lib/actions/past-exams.ts.bak` 삭제 (불필요한 백업)

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
| 계획 문서 → docs/plan/ | 모든 계획은 마크다운으로 문서화 후 구현 (CLAUDE.md 규칙) |
| 학습 리뷰 MANDATORY | 구현 후 반드시 개념 리뷰 + 이해도 체크 + 직접 구현 추천 |

---

## 7. 개발 명령어

```bash
npm run dev            # 개발 서버 (Turbopack)
npm run build          # 프로덕션 빌드
npm run lint           # ESLint
npm run test:run       # Vitest 단일 실행

# 단일 테스트 파일 실행
npx vitest run src/lib/actions/__tests__/academies.test.ts
```

---

## 8. 핵심 참조 문서 (우선순위 순)

1. `CLAUDE.md` — 프로젝트 개발 지침 (역할, 원칙, 아키텍처, 학습 플로우)
2. `ROADMAP.md` — 순차 스텝별 개발 로드맵
3. `docs/plan/phase-1-step4-academy-crud.md` — 1-4 전체 5단계 계획
4. `docs/plan/phase-1-step4-2-server-actions.md` — Step 2 상세 계획 (구현 완료)
5. `docs/plan/phase-1-round2.md` — 라운드 2 상세 계획 (Step 1~7)
6. `docs/design/시스템아키텍처.md` — 아키텍처, DB 스키마, 데이터 흐름
7. `docs/prd/PRD-v0.1-detailed.md` — 기능 명세 및 페이지별 상세

---

## 9. 알려진 제약 (의도적 MVP 제한)

- DB 타입: placeholder (`supabase gen types` 미실행 → `as any` 우회 중)
- `questions.content = TEXT`: 수식은 LaTeX 마크업, 그래프/이미지 미지원
- 지문형 문제 미지원 (영어 지문+복수문제 구조 없음)
- 소셜 로그인 미지원 (이메일/비밀번호만)

### 설계 제약 (Phase 2+ 개선 예정)

- **Grade 표기**: 1-12 (K-12 시스템) vs 한국 초중고 (초1-6, 중1-3, 고1-3)
  - MVP: UI conversion 함수로 해결
  - Phase 2+: grade_level + grade_number 스키마 재설계
- **학교 교사 관리 미지원**: 현재는 학원 교사만 관리
  - Phase 2+: school_teachers 테이블 + 문제 출제 패턴 분석용
- **배열 필드 정규화**: teachers.subjects[], teachers.grades[] 비정규화
  - Phase 2+: junction 테이블로 전환

상세 내용: `ROADMAP.md` → "알려진 설계 제약 및 개선 계획"
