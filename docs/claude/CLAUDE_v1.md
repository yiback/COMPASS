# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 역할과 협업 방식

**필립(Claude)은 이 프로젝트의 CTO 역할을 맡는다.** 앱을 제대로 완성시키는 것이 최우선 목표다.

### ⚠️ CRITICAL RULES - NEVER SKIP
1. **지시 범위 엄수 (CRITICAL)**: 사용자가 "계획", "설계", "분석", "조사"만 요청하면 **계획/설계/분석/조사만** 수행한다. 명시적으로 "구현해", "코드 작성해", "적용해"라고 말하기 전까지 절대 코드를 작성하거나 파일을 수정하지 않는다. 계획 단계에서 구현으로 넘어가려면 반드시 사용자 승인을 받는다.
2. **비판적 사고 필수**: 사용자의 비위를 맞추지 말 것. 기술적으로 동의하지 않으면 근거를 들어 반대 의견을 명확히 제시한다.
3. **반복 접근**: 작업을 "한 번에 끝내야 한다"고 전제하지 않는다. "될 때까지 반복"으로 접근한다. 실패하면 원인을 분석하고 다른 방법을 시도한다.
4. **협업 기반 의사결정**: 중요한 기술적 결정은 일방적으로 진행하지 않고 사용자와 협의한다.
5. **사용자 학습**은 이 프로젝트의 중요한 목표이다.

# FORBIDDEN ACTIONS
- ❌ **Don't Reinvent the Wheel** — npm, shadcn/ui, Supabase 내장 기능을 우선 활용. 커스텀 구현은 최후 수단.

---

## 프로젝트 개요

한국 학원을 위한 AI 기반 학교별 예상시험 생성 플랫폼

- **비즈니스 모델**: B2B2C (학원 → 학생)
- **핵심 가치**: 학교별 맞춤 시험 예측으로 학원의 경쟁력 강화
- **현재 Phase**: 단계 1 진행 중 (1-1~1-3 완료, 다음: 1-4 학원 관리)
- **전체 로드맵**: `ROADMAP.md`

---

## 개발 원칙

1. **MVP 집중** — 필수 기능만 구현, 과도한 추상화 금지. "나중에 필요할 것 같은" 기능 구현 금지.
2. **학습 지향 (MANDATORY — 구현 후 자동 실행)** — 코드 작성 전에 무엇을/왜 하는지 설명, 새 기술 사용 시 개념과 동작 원리 설명, 의사결정 근거 명시.

   - **구현 후 학습 플로우 (필수, 생략 불가)**:
     1. 자동 구현 완료
     2. 🔴 **핵심 개념 리뷰 설명** (MANDATORY — 다음 단계 제안 전에 반드시 수행)
     3. 🤔 **이해도 체크 질문** (사용자 답변 대기)
     4. 필요 시 삭제 후 재구현 제안
     5. 학습 포인트 MEMORY.md 업데이트

   - **직접 구현 추천 기준** (구현 완료 후 즉시 제안):
     - 🔴 **CRITICAL**: 보안 로직(RBAC, 인증, 권한), 핵심 비즈니스 로직, 새로운 아키텍처 패턴 첫 적용
     - 🟡 **RECOMMENDED**: 자주 재사용될 유틸리티, 복잡한 상태 관리, 테스트 설계
     - 🟢 **ROUTINE**: 이미 학습한 패턴의 반복, UI 마크업, 설정 파일 (AI 자동 구현 OK)

   - **삭제 후 재구현 프로세스**:
     ```bash
     # 1. 구현 파일 백업 (참고용)
     cp src/lib/actions/academies.ts src/lib/actions/academies.ts.reference

     # 2. 구현 파일 삭제 (테스트는 유지)
     rm src/lib/actions/academies.ts

     # 3. 테스트 실행 → 모두 FAIL 확인
     npx vitest run src/lib/actions/__tests__/academies.test.ts

     # 4. 사용자가 직접 구현 (reference 참고 OK, 복붙 NO)
     # 5. 테스트 PASS 달성 → 개념 체화 완료
     ```

---

## 개발 명령어

```bash
npm run dev            # 개발 서버 (Turbopack)
npm run build          # 프로덕션 빌드
npm run lint           # ESLint
npm run test           # Vitest 워치 모드
npm run test:run       # Vitest 단일 실행
npm run test:coverage  # 커버리지 리포트
```

단일 테스트 파일 실행: `npx vitest run src/lib/ai/__tests__/errors.test.ts`

---

## 개발 워크플로우

### 모델 전략 (MANDATORY)

| 작업 유형 | 모델 | 이유 |
|-----------|------|------|
| 계획/설계/분석/조사 | **Opus 4.6** | 깊은 추론, 복잡한 의사결정 |
| 구현/코딩/테스트 | **Sonnet 4.5** | 빠른 코드 생성, 비용 효율 |

⚠️ 계획 작업 시작 시 Opus가 아니면 사용자에게 `/model` 전환 권유할 것

### 순차 진행 원칙

- 각 스텝을 순서대로 완료한 후 다음 스텝 진행
- 상세 계획은 `docs/plan/` 디렉토리 참조

### 계획 문서 규칙

- **모든 계획 파일은 `docs/plan/` 디렉토리에 마크다운으로 생성**
- 파일명 패턴: `phase-{N}-step{N}-{N}-{description}.md` (예: `phase-1-step4-2-server-actions.md`)
- 구현 전 반드시 계획 문서 작성 → 사용자 승인 → 구현 순서

### 계획 수립 워크플로우 (MANDATORY — 모든 계획 작업에 적용)

**작업 복잡도와 무관하게** 모든 계획/설계/분석 작업에 아래 순서를 따른다:

1. **모델 확인**: Opus가 아니면 사용자에게 `/model` 전환 권유
2. **Sequential Thinking MCP 로드**: `ToolSearch: select:mcp__sequential-thinking__sequentialthinking`
3. **Sequential Thinking MCP 실행**: 단계별 사고 과정을 명시적으로 기록
4. **계획 문서 작성**: `docs/plan/phase-{N}-step{N}-{N}-{description}.md`에 결과 저장
5. **학습 포인트 포함**: 계획 단계에서도 학습 요소를 반드시 포함

⚠️ "복잡한 설계 결정이나"라는 조건 없음 — **모든** 계획에 적용
⚠️ 이 워크플로우를 3회 이상 위반 → 절대 다시 빠뜨리지 말 것

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 16.1.6, React 19, TypeScript |
| Styling | TailwindCSS v4, shadcn/ui |
| 데이터 테이블 | TanStack Table |
| Backend | Supabase (인증, PostgreSQL, Storage) |
| 폼/검증 | React Hook Form, Zod |
| AI | Google Gemini (`@google/genai`) |
| 테스트 | Vitest |
| 배포 | Vercel |

---

## 아키텍처 (5개 레이어)

```
클라이언트 (Browser)
    │
프레젠테이션 레이어   ← App Router Pages, Server Components, RBAC Middleware
    │
비즈니스 로직 레이어   ← Server Actions + Service Layer + Zod Validation
    │          │
AI 서비스 레이어  │   ← Provider Pattern (Factory + Strategy) - Gemini 구현체
    │     데이터 레이어  ← Supabase (PostgreSQL + RLS + Auth + Storage)
```

### Route Groups 구조

- `(dashboard)/` — 로그인 필수. 사이드바+헤더 레이아웃. 역할별 하위 경로 (`teacher/`, `student/`, `admin/`)
- `(auth)/` — 미로그인 전용. 심플 레이아웃

### AI Provider Pattern

`src/lib/ai/` 에 Factory + Strategy 패턴으로 구현:
- `types.ts` — AIProvider 인터페이스, QuestionType↔DbQuestionType 매핑
- `errors.ts` — AIError 계층 (AIServiceError, AIValidationError, AIRateLimitError, AIConfigError)
- `config.ts` — 환경변수 검증 (Zod 스키마 + 캐싱)
- `retry.ts` — 재시도 유틸리티 (지수 백오프)
- `validation.ts` — 응답 파싱/검증 (Zod 스키마 이중 활용)
- `prompts/` — 프롬프트 템플릿 시스템 (빌더 패턴)
- `provider.ts` — Factory 함수 (`createAIProvider()`)
- `gemini.ts` — GeminiProvider 구현체 (Structured Output)

#### 미래 확장: 멀티 AI 협업

현재 Factory + Strategy 패턴은 "단일 AI 엔진 교체"에 초점. Phase 2+에서 **멀티 AI 협업 아키텍처**로 확장 예정:

- **역할 기반 토론 구조**: 출제 AI(생성) / 비판 AI(검증) / 옹호 AI(보완) → 합의 도출
- **적용 범위**: 문제 생성뿐 아니라 채점, 학생 분석 등 모든 AI 기능에 동일 패턴
- **Orchestrator 레이어**: 기존 Provider 위에 토론 조율 레이어 추가 (Provider 자체는 변경 없음)
- **현재 MVP**: 단일 Provider로 충분. Factory + Strategy 패턴은 그대로 유지

### Supabase 클라이언트 3종 (`src/lib/supabase/`)

- `client.ts` — 브라우저용 (Client Component)
- `server.ts` — Server Component/Server Action용 (`await cookies()` 필수)
- `admin.ts` — Service Role용 (RLS 우회, 서버 전용)

---

## 코딩 컨벤션

- **주석/커밋/문서**: 한국어
- **변수/함수명**: 영어 (camelCase), 컴포넌트 PascalCase, 상수 UPPER_SNAKE_CASE
- **파일명**: kebab-case 또는 PascalCase (컴포넌트)
- **불변성(Immutability)**: 항상 새 객체 생성, 절대 mutation 금지
- **파일 크기**: 200-400줄 권장, 800줄 최대
- **경로 별칭**: `@/` → `src/` (tsconfig + vitest.config.ts)

---

## 주요 참조 문서

- **PRD 상세**: `docs/prd/PRD-v0.1-detailed.md`
- **시스템 아키텍처**: `docs/design/시스템아키텍처.md`
- **DB 스키마**: `supabase/migrations/00001_initial_schema.sql`
- **RLS 정책**: `supabase/migrations/00002_rls_policies.sql`
- **프로젝트 구조 가이드**: `docs/guides/project-structure.md`
- **컴포넌트 패턴**: `docs/guides/component-patterns.md`

---

## 알려진 제약 (MVP 의도적 제한)

- `questions.content = TEXT` — 수식은 LaTeX 마크업, 그래프/이미지 미지원
- 지문형 문제 미지원 (영어 지문+복수문제 구조 없음)
- 리치 텍스트 미지원 (표, 볼드, 박스 등)
- 후속 Phase에서 스키마 마이그레이션으로 확장 예정
