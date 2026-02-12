# COMPASS 프로젝트 핸드오프 문서

> **최종 업데이트**: 2026-02-12 (단계 1-4 Step 1 완료)
> **대상**: 이 프로젝트를 이어받는 새로운 에이전트

---

## 1. Goal (목표)

**COMPASS**는 한국 학원을 위한 AI 기반 학교별 예상시험 생성 플랫폼이다.

- **비즈니스 모델**: B2B2C (학원 → 학생)
- **핵심 가치**: 학교별 맞춤 시험 예측으로 학원의 경쟁력 강화
- **현재 Phase**: 단계 1 진행 중 (1-1~1-3 완료, 1-4 Step 1/5 완료)
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
| **1-4** | **학원 관리 CRUD [F007]** (Step 1/5 완료) | **⏳ Step 2 진행 중** |
| 1-5 | 사용자 관리 CRUD [F009] | 미시작 |
| 1-6 | 기출문제 조회 [F006] | 미시작 |
| 1-7 | 기출 기반 AI 문제 생성 [F011] | 미시작 |
| 1-8 | 생성된 문제 저장 [F003] | 미시작 |

### 이번 세션에서 한 일

- **단계 1-4 Step 1 완료: Zod 검증 스키마 (TDD)**
  - `docs/plan/phase-1-step4-academy-crud.md` — 전체 5단계 계획 문서
  - `docs/plan/phase-1-step4-1-zod-schema.md` — Step 1 상세 계획
  - `src/lib/validations/academies.ts` — academyUpdateSchema 구현
  - `src/lib/validations/__tests__/academies.test.ts` — 14개 테스트 모두 통과
  - `.or(z.literal(''))` 패턴으로 logoUrl 유효성 검증 (URL 또는 빈 문자열)
  - TDD RED→GREEN→REFACTOR 사이클 완벽 준수

- **학습 리뷰 세션 진행**
  - Multi-tenancy 개념: 학원=테넌트(빌딩), 사용자는 테넌트 내 엔터티
  - `.or(z.literal(''))` 패턴: URL 검증 + 빈 문자열 허용
  - 경계값 테스트: off-by-one 에러 방지 (100자 vs 101자)
  - Zod strip 모드: 수정 불가 필드(invite_code) 보호의 1차 방어선

- **설계 개선 논의 및 문서화**
  - Grade 시스템: 1-12 (K-12) vs 한국 초중고 시스템 불일치 발견
  - 해결책: MVP는 UI conversion 함수, Phase 2+에서 스키마 재설계
  - 학교 교사 관리: Phase 2+에서 school_teachers 테이블 + 정규화 계획
  - `ROADMAP.md` 업데이트: "알려진 설계 제약 및 개선 계획" 섹션 추가

---

## 3. What Worked (성공한 접근)

### 개발 패턴
- **`useActionState` + Server Actions**: React 19 표준 패턴으로 폼 처리
- **Defense in Depth**: RLS(DB 계층) + Server Action(앱 계층) 이중 권한 체크
- **Storage RLS 역할 기반**: 교사/관리자만 업로드, 소유자/관리자만 삭제
- **Server-side 파일 업로드**: Client 직접 업로드 보안 취약점 방지
- **TDD RED→GREEN→REFACTOR** 철저 준수

### 도구 활용
- **`/everything-claude-code:plan` + sequential thinking MCP**: 복잡한 설계 결정 사전 분석 (Step 1에서 6단계 사고 과정)
- **학습 워크플로우**: (1) 자동 구현 완료 → (2) 핵심 개념 리뷰 설명 → (3) 이해 부족 시 삭제 후 재구현 → (4) 학습 포인트 문서 정리
- **nextjs-supabase-expert 에이전트**: TDD 사이클 자동화, 테스트 먼저 → 구현 → 리팩토링 순서 철저히 준수

### Step 1에서 성공한 패턴
- **`.or(z.literal(''))` 패턴**: 선택적 URL 필드에서 "유효한 URL 또는 빈 문자열" 허용
- **경계값 테스트**: 100자/101자, 200자/201자 등 정확한 경계 검증
- **수정 불가 필드 보호**: Zod strip 모드로 invite_code, settings 자동 제거
- **상세 계획 문서**: 구현 전 청사진 작성으로 방향성 명확화

---

## 4. What Didn't Work (실패/주의사항)

### Supabase placeholder 타입 문제 (현재 진행 중)
- `.insert()`, `.update()` 메서드에서 타입 불일치 → `as any` 캐스팅으로 우회 중
- **근본 해결**: `npx supabase gen types typescript --project-id <ID> > src/types/supabase.ts` 실행 필요

### TypeScript 튜플 타입 이슈
- `as const`로 선언한 배열이 Zod `.enum()`과 호환 안 됨
- `.refine()` + `.includes()` 패턴으로 우회

### Next.js / Supabase 주의사항
- `next.config.ts`에서 `import.meta.url` 사용 불가 → `__dirname` 사용
- handle_new_user 트리거에서 role 항상 `'student'` 고정
- seed.sql UUID `s0000000-...` 유효하지 않음 → `b0000000-...` 사용
- `await cookies()` 필수 (Next.js 16 비동기)
- 마이그레이션 00004, 00005는 Supabase Cloud에 **아직 미적용** (로컬 파일만 생성)

### 병렬 트랙 (이제 중단됨)
- tmux send-keys로 Claude Code 선택형 프롬프트 조작 불가
- 의도치 않은 입력 전달 문제 발생
- → **순차 실행으로 전환 완료** (2026-02-12)

### Step 1에서 발견된 이슈들
- **MCP 도구 혼동**: sequential thinking MCP와 zen MCP를 2번 혼동함
  - ToolSearch로 `mcp__sequential-thinking__sequentialthinking` 정확히 확인 필요
- **학습 설명 누락**: 처음에는 구현만 하고 학습 리뷰를 빠뜨림 (사용자 지적 후 보완)
- **개념 혼동**: 학원 교사 vs 학교 교사 개념을 설명에서 혼동
- **현지화 미고려**: Grade 1-12 시스템이 한국 초중고 시스템과 불일치 (사용자 지적으로 발견)
  - MVP: UI conversion 함수로 해결, Phase 2+: 스키마 재설계 예정

---

## 5. Next Steps (다음 단계)

### 즉시 해야 할 일

#### 1. 단계 1-4 Step 2: Server Actions (TDD)

상세 계획: `docs/plan/phase-1-step4-academy-crud.md` → Step 2

**RED (테스트 먼저)**:
- `src/lib/actions/__tests__/academies.test.ts` 작성
- 테스트 케이스:
  - `getMyAcademy()`: 성공/실패 케이스 (미인증, admin 아님, 학원 없음)
  - `updateMyAcademy()`: 성공/실패 케이스 (권한, 검증 에러, DB 에러)

**GREEN (구현)**:
- `src/lib/actions/academies.ts` 작성
  - `getMyAcademy()`: 현재 사용자의 학원 정보 조회
  - `updateMyAcademy(formData)`: 학원 정보 수정 (admin 전용)
  - Defense in Depth: 권한 체크 + Zod 검증 + RLS

**학습 포인트**:
- RBAC 패턴 (admin 역할 체크)
- Server Actions 에러 처리
- FormData → Zod → DB 변환 흐름

#### 2. 단계 1-4 나머지 Step (3~5)

- Step 3: 페이지 + UI 컴포넌트 (`src/app/(dashboard)/admin/academy/page.tsx`)
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

---

## 7. 개발 명령어

```bash
npm run dev            # 개발 서버 (Turbopack)
npm run build          # 프로덕션 빌드
npm run lint           # ESLint
npm run test:run       # Vitest 단일 실행

# 단일 테스트 파일 실행
npx vitest run src/lib/actions/__tests__/auth.test.ts
```

---

## 8. 핵심 참조 문서 (우선순위 순)

1. `CLAUDE.md` — 프로젝트 개발 지침 (역할, 원칙, 아키텍처)
2. `ROADMAP.md` — 순차 스텝별 개발 로드맵
3. `docs/plan/phase-1-round2.md` — 라운드 2 상세 계획 (Step 1~7)
4. `docs/plan/phase-1-round1.md` — 라운드 1 상세 계획 (완료)
5. `docs/design/시스템아키텍처.md` — 아키텍처, DB 스키마, 데이터 흐름
6. `docs/prd/PRD-v0.1-detailed.md` — 기능 명세 및 페이지별 상세

---

## 9. 알려진 제약 (의도적 MVP 제한)

- DB 타입: placeholder (`supabase gen types` 미실행 → `as any` 우회 중)
- `questions.content = TEXT`: 수식은 LaTeX 마크업, 그래프/이미지 미지원
- 지문형 문제 미지원 (영어 지문+복수문제 구조 없음)
- 소셜 로그인 미지원 (이메일/비밀번호만)

### Step 1에서 발견된 설계 제약 (Phase 2+ 개선 예정)

- **Grade 표기**: 1-12 (K-12 시스템) vs 한국 초중고 (초1-6, 중1-3, 고1-3)
  - MVP: UI conversion 함수로 해결
  - Phase 2+: grade_level (elementary/middle/high) + grade_number (1-6) 스키마 재설계
- **학교 교사 관리 미지원**: 현재는 학원 교사만 관리
  - Phase 2+: school_teachers 테이블 + 문제 출제 패턴 분석용
- **배열 필드 정규화**: teachers.subjects[], teachers.grades[] 비정규화
  - Phase 2+: teacher_subjects, teacher_grades junction 테이블로 전환

상세 내용: `ROADMAP.md` → "알려진 설계 제약 및 개선 계획"
