# COMPASS 프로젝트 핸드오프 문서

> **최종 업데이트**: 2026-02-14 (단계 1-4 완료, 다음: 1-5 사용자 관리 CRUD)
> **대상**: 이 프로젝트를 이어받는 새로운 에이전트

---

## 1. Goal (목표)

**COMPASS**는 한국 학원을 위한 AI 기반 학교별 예상시험 생성 플랫폼이다.

- **비즈니스 모델**: B2B2C (학원 → 학생)
- **핵심 가치**: 학교별 맞춤 시험 예측으로 학원의 경쟁력 강화
- **현재 Phase**: 단계 1 진행 중 (1-1~1-4 완료, 다음: 1-5 사용자 관리 CRUD)
- **워크플로우**: 순차 실행 (스텝별로 하나씩 완료 후 다음 진행)
- **사용자 학습 목표**: 코드 구현뿐 아니라 개념 이해가 핵심. 자동 구현 후 반드시 리뷰 세션 진행

기술스택: Next.js 16.1.6 + React 19 + Supabase + Google Gemini + Vercel

---

## 2. Current Progress (현재 진행 상황)

### Phase 0 (100% 완료)

- **0-1~0-4**: Next.js + Supabase + 레이아웃 + 공통 UI 컴포넌트
- **0-5**: AI 추상화 레이어 (Factory + Strategy 패턴, GeminiProvider, 94개+ 테스트)

### 단계 1: 기출 기반 문제 생성 + 인증 (50% 완료)

| 스텝 | 작업 | 상태 |
|------|------|------|
| 1-1 | 인증 시스템 [F010] (로그인/회원가입/비번재설정/미들웨어) | ✅ 완료 |
| 1-2 | 기출문제 업로드 [F005] (Storage 버킷 + 업로드 폼) | ✅ 완료 |
| 1-3 | 학교 관리 CRUD [F008] (목록/생성/수정/삭제) | ✅ 완료 |
| 1-4 | 학원 관리 CRUD [F007] (조회/수정, 초대코드) | ✅ 완료 |
| **1-5** | **사용자 관리 CRUD [F009]** | **⏳ 시작 대기** |
| 1-5 | 사용자 관리 CRUD [F009] | 미시작 |
| 1-6 | 기출문제 조회 [F006] | 미시작 |
| 1-7 | 기출 기반 AI 문제 생성 [F011] | 미시작 |
| 1-8 | 생성된 문제 저장 [F003] | 미시작 |

### 이번 세션에서 한 일

- **단계 1-4 완료: 학원 관리 CRUD [F007]** ✅
  - Step 5 Phase A: 빌드 검증 완료 (테스트 235/235, 빌드 성공, 린트 에러 0)
  - Step 5 Phase B: 학습 리뷰 완료 (6개 토픽 완전 이해)
  - Step 5 Phase C: 문서 업데이트 완료
  - `docs/plan/phase-1-step4-5-build-verification.md` 계획 문서 생성

- **학습 리뷰 6개 토픽 완료**
  1. Defense in Depth (3중 방어: Server Action + Zod strip + RLS)
  2. Self-referencing ID 패턴 (IDOR 공격 방지)
  3. Server Actions + FormData (파일 업로드 지원, 미래 확장 용이)
  4. useTransition + React Hook Form (직접 결과 핸들링, 중복 클릭 방지)
  5. Zod 스키마 설계 (strip 모드, .or(z.literal('')) 패턴)
  6. Server Component 역할 분기 (번들 크기 14배 차이, DevTools 우회 방지)

- **계획 문서 생성 규칙 준수**
  - Step 4 → 계획 문서 누락으로 지적 받음
  - Step 5 → 계획 문서 먼저 생성 후 구현 (CRITICAL RULE #1 엄수)
  - Sequential Thinking MCP 활용

### 단계 1-4 전체 요약 (5 Steps)

- ✅ Step 1: Zod 검증 스키마 (14개 테스트, TDD)
- ✅ Step 2: Server Actions (13개 테스트, TDD + 삭제 후 재구현 학습)
- ✅ Step 3: UI 컴포넌트 (academy-form, academy-info-card, 삭제 후 재구현 학습)
- ✅ Step 4: 사이드바 메뉴 연결 (SSOT 패턴)
- ✅ Step 5: 빌드 검증 + 학습 리뷰 (Phase A/B/C 모두 완료)

---

## 3. What Worked (성공한 접근)

### 개발 패턴
- **`useTransition` + Server Actions**: React Hook Form과 통합 용이, 직접 결과 핸들링
- **Defense in Depth**: RLS(DB 계층) + Server Action(앱 계층) + Zod(검증 계층) 3중 권한 체크
- **Self-referencing ID 패턴**: academy_id를 파라미터가 아닌 profile에서 추출 → URL 조작 방지
- **Server Component에서 역할 분기**: DevTools 우회 방지, 불필요한 코드 클라이언트 전송 방지
- **TDD RED→GREEN→REFACTOR** 철저 준수

### 학습 방법
- **삭제 후 재구현 (빈칸 채우기 방식)**: 전체 삭제가 아닌 핵심 로직만 빈칸 → 구조는 보면서 직접 작성
  - Step 2: 타입 정의 → checkAdminRole() → getMyAcademy() → updateMyAcademy() 순서
  - Step 3: useTransition → useForm → copyInviteCode → onSubmit → FormField → Button 순서
  - 사용자가 모르는 개념은 즉시 설명 (`const`, `await`, `!`, `??`, `try/catch` 등)
  - 오타/문법 에러도 학습 기회로 활용 (스펠링, 대소문자, 괄호 닫기)
- **학습 리뷰 MANDATORY**: 구현 후 반드시 개념 리뷰 → 이해도 체크 → 직접 구현 추천 순서
- **사용자 수준에 맞춘 설명**: JavaScript 기초(`const`, `await`)부터 설명 필요. 간결하게.

### 도구 활용
- **Sequential Thinking MCP**: 계획 수립 시 반드시 사용 (CLAUDE.md 규칙). `select:mcp__sequential-thinking__sequentialthinking`
- **병렬 에이전트 실행**: ui-markup-specialist (마크업) + nextjs-supabase-expert (로직) 동시 실행
- **모델 전략**: Opus (계획/설계), Sonnet (구현/코딩)

---

## 4. What Didn't Work (실패/주의사항)

### 계획 문서 누락 (이번 세션에서 발생)
- Step 4 구현 시 `docs/plan/phase-1-step4-4-sidebar-menu.md` 계획 문서를 생성하지 않음
- MEMORY.md CRITICAL RULE #1 위반 — 사용자 지적 받음
- **교훈**: 아무리 단순한 작업이라도 계획 문서를 먼저 생성한 후 구현

### Sequential Thinking MCP 누락 문제 (이전 세션)
- 계획 수립 시 Sequential Thinking MCP를 사용하지 않고 바로 진행하려 함
- **교훈**: 계획 수립 시 반드시 Sequential Thinking MCP 활용. CLAUDE.md 규칙 엄수

### 병렬 에이전트 파일 충돌 (이전 세션)
- nextjs-supabase-expert와 ui-markup-specialist가 동일 파일(academy-info-card.tsx)을 각각 생성
- 후속 에이전트가 덮어써서 일부 필드(logoUrl, updatedAt) 누락
- **교훈**: 병렬 에이전트에 동일 파일 할당 금지. 명확히 파일 분리할 것

### 삭제 후 재구현 — "통째로 삭제" 방식 실패 (이전 세션)
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
- **계획 수립 시 Sequential Thinking MCP 사용은 필수** (CLAUDE.md 규칙)

---

## 5. Next Steps (다음 단계)

### 즉시 해야 할 일

#### 1. 단계 1-5: 사용자 관리 CRUD [F009]

**작업 내용**:
- 사용자 목록 DataTable (profiles 테이블)
- 역할 변경 기능 (admin 전용, admin 클라이언트 사용)
- 사용자 상세 조회
- RBAC: admin/system_admin만 접근

**참고 패턴**:
- 학교 관리(1-3) DataTable 패턴 재사용
- admin 클라이언트로 RLS 우회 (역할 변경 시)

#### 2. 이어서 순차 진행

- 1-5: 사용자 관리 CRUD [F009] — 역할 변경 (admin 클라이언트)
- 1-6: 기출문제 조회 [F006] — DataTable + 검색/필터
- 1-7: 기출 기반 AI 문제 생성 [F011] — `createAIProvider()` 연동
- 1-8: 생성된 문제 저장 [F003] — 문제 CRUD

#### 3. Supabase 타입 생성 (선택)

- `npx supabase gen types typescript --project-id <ID> > src/types/supabase.ts`
- `as any` 캐스팅 제거 가능 (MVP 범위 외이므로 선택 사항)

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
| Server Component에서 역할 분기 | 보안 강화 (DevTools 우회 방지) + 불필요한 코드 전송 방지 |
| useTransition (useActionState 미사용) | React Hook Form 통합 용이, 직접 결과 핸들링 |

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
4. `docs/plan/phase-1-step4-3-ui-components.md` — Step 3 상세 계획 (구현 완료)
   - **주의**: Step 4 계획 문서(`phase-1-step4-4-sidebar-menu.md`)는 미생성 상태
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
