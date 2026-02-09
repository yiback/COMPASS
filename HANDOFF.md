# COMPASS 프로젝트 핸드오프 문서

> **최종 업데이트**: 2026-02-09
> **대상**: 이 프로젝트를 이어받는 새로운 에이전트

---

## 1. Goal (목표)

**COMPASS**는 한국 학원을 위한 AI 기반 학교별 예상시험 생성 플랫폼이다.

- **비즈니스 모델**: B2B2C (학원 → 학생)
- **핵심 가치**: 학교별 맞춤 시험 예측으로 학원의 경쟁력 강화
- **타겟**: 소형~중형 보습학원, 중등 수학부터 시작
- **현재 Phase**: 0-5 (AI 추상화 레이어, 9/12 Steps 완료 — 75%)

기술스택: Next.js 16.1.6 + React 19 + Supabase + Google Gemini + Vercel

---

## 2. Current Progress (현재 진행 상황)

### 완료된 작업

#### 기획 문서 (12개, ~7,000줄)
- PRD 요약 + 상세, 개발요구사항, 기술스택
- 개발 가이드 5종 (컴포넌트 패턴, 폼, 스타일링, Next.js 15, 프로젝트 구조)
- 개발 로드맵 (`ROADMAP.md`)

#### 시스템 아키텍처 설계
- `docs/design/시스템아키텍처.md` - 5개 레이어 아키텍처, RBAC, AI Provider Pattern
- `supabase/migrations/` - 15개 테이블 + RLS 정책 + 인덱스
- `supabase/seed.sql` - 개발용 시드 데이터

#### Phase 0-1 ~ 0-4 (모두 완료)
- **0-1**: Next.js 16.1.6 + React 19 + TypeScript + TailwindCSS v4 + shadcn/ui
- **0-2**: Supabase Cloud 연동 (3종 클라이언트 + 미들웨어)
- **0-3**: Route Groups 레이아웃 (대시보드 사이드바/헤더, 반응형)
- **0-4**: 공통 UI 컴포넌트 (shadcn/ui 19개 + DataTable + Loading/Skeleton + Toast)

#### Phase 0-5: AI 추상화 레이어 (9/12 Steps 완료)

| Step | 파일 | 테스트 | 상태 |
|------|------|--------|------|
| 1 | Vitest 설정 | - | ✅ |
| 2 | `errors.ts` (커스텀 에러 계층) | 9개 | ✅ |
| 3 | `config.ts` (환경변수 검증) | 5개 | ✅ |
| 4 | `types.ts` (인터페이스/타입) | 8개 | ✅ |
| 5 | `retry.ts` (재시도 유틸리티) | 13개 | ✅ |
| 6 | `validation.ts` (응답 검증) | 17개 | ✅ |
| 7 | `prompts/question-generation.ts` | 16개 | ✅ |
| 8 | `prompts/index.ts` (배럴) | - | ✅ |
| 9 | `gemini.ts` (GeminiProvider) | 18개 | ✅ |
| 10 | `provider.ts` (Factory) | - | ⏸️ |
| 11 | `index.ts` (공개 API) | - | ⏸️ |
| 12 | `.env.example` 업데이트 | - | ⏸️ |

**전체 테스트: 86개 통과, 빌드/린트 OK**

### 미완료 작업

- **Phase 0-5 Step 10-12**: Factory 함수 + 공개 API + 환경변수 템플릿
- **TypeScript 타입 자동 생성**: `supabase gen types`로 실제 DB 스키마에서 타입 생성 (placeholder 상태)

---

## 3. What Worked (성공한 접근)

### 프로젝트 셋업
- **`create-next-app --yes`**: React Compiler 인터랙티브 프롬프트 회피
- **`shadcn init --defaults`**: 인터랙티브 없이 설정
- **`turbopack.root = path.resolve(__dirname)`**: 절대경로 필수
- **Supabase Cloud**: Docker Desktop 없이 빠른 시작

### AI 추상화 레이어 (Phase 0-5)
- **TDD RED→GREEN→REFACTOR 흐름 철저 준수**: 매 Step마다 테스트 먼저 → 실패 확인 → 구현 → 통과
- **Zod v4 `toJSONSchema()` 내장 활용**: `zod-to-json-schema` 외부 패키지 불필요
- **`z.coerce.number()` 대신 커스텀 `coerceNumber` 헬퍼**: NaN → undefined → `.default()` 기본값 fallback
- **fake timer 패턴**: `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync()` → withRetry 재시도 대기 시간 0ms로 단축
- **unhandled rejection 방지**: `promise.catch()` 먼저 등록 후 타이머 전진
- **SDK 모킹**: `vi.fn(function(this) { ... })` 사용 (arrow function은 `new` 불가)
- **SDK 에러 duck typing**: `error.name === 'ApiError' && 'status' in error` → vi.mock 환경에서 instanceof 불안정 우회
- **AIError 재변환 방지**: catch 블록에서 `instanceof AIError` 체크 후 즉시 re-throw

### 일반
- **database-reviewer 에이전트**: SQL 리뷰에서 CRITICAL 보안 이슈 3건 발견
- **code-reviewer 에이전트**: 코드 리뷰로 `expect.fail()` → `expect.assertions()` 개선 등

---

## 4. What Didn't Work (실패/주의사항)

- **`next.config.ts`에서 `import.meta.url` 사용 불가**: `exports is not defined` 에러. `__dirname` 사용
- **`handle_new_user()` 트리거에서 role을 사용자 입력으로 읽으면 안 됨**: 항상 `'student'` 고정 (권한 상승 방지)
- **RLS 정책에서 admin 역할 누락**: 교사 권한에 `['teacher', 'admin', 'system_admin']` 모두 포함
- **`vi.fn().mockImplementation(() => ...)` 으로 class 모킹 불가**: arrow function은 `new` 키워드와 함께 사용 불가. `vi.fn(function(this) { ... })` 사용해야 함
- **seed.sql UUID `s0000000-...` 유효하지 않음**: `s`는 16진수가 아님. `b0000000-...` 사용
- **`responseSchema` vs `responseJsonSchema`**: Gemini SDK v1.40.0에서 JSON Schema 객체는 `responseJsonSchema` 필드 사용. `responseSchema`는 OpenAPI Schema용

---

## 5. Next Steps (다음 단계)

### 🚨 즉시 해야 할 일 (Phase 0-5 완료: 3 Steps 남음)

**Step 10: provider.ts (Factory 함수)**
```typescript
// createAIProvider('gemini') → GeminiProvider 인스턴스 반환
// 환경변수 AI_PROVIDER 기반 선택
// 알 수 없는 타입 → AIConfigError throw
```
- 참조: `docs/plan/phase-0-5.md` Step 10 섹션

**Step 11: index.ts (공개 API)**
```typescript
// export { createAIProvider } from './provider'
// export type { AIProvider, GenerateQuestionParams, ... } from './types'
// export { AIError, AIServiceError, ... } from './errors'
```

**Step 12: .env.example 업데이트**
```bash
GEMINI_API_KEY=          # 필수
GEMINI_MODEL=gemini-2.0-flash  # 선택
AI_PROVIDER=gemini       # 선택
```

### 그 다음 (ROADMAP.md 단계 1 참조)

1. **단계 1 트랙 B: 인증 시스템** - Supabase Auth + 로그인/회원가입
2. **단계 1 트랙 B: 기본 CRUD UI** - 학원/학교/사용자 관리
3. **단계 1 트랙 A: 기출문제 업로드** - 이미지/PDF + Storage

---

## 6. Architecture Decisions (주요 아키텍처 결정)

| 결정 | 이유 |
|------|------|
| 5개 레이어 아키텍처 | 프레젠테이션/비즈니스/AI/데이터/횡단 관심사 분리 |
| Server Actions + Service Layer | MVP 속도 + Phase 2 NestJS 전환 시 재사용 |
| AI Provider Pattern (Factory + Strategy) | Gemini → OpenAI/Claude 교체를 Factory에 case 추가로 해결 |
| Supabase RLS 멀티테넌시 | academy_id 기반 데이터 격리, 3중 보안 |
| Route Groups: (auth)/(dashboard) | URL 영향 없이 레이아웃 분리 |
| Zod 스키마 이중 활용 | Gemini responseJsonSchema + 후검증 (DRY) |
| SDK 에러 duck typing | vi.mock 환경에서 instanceof 불안정 → name/status 판별 |

---

## 7. AI 추상화 레이어 구조 (`src/lib/ai/`)

```
src/lib/ai/
├── types.ts                (~140줄) - AIProvider 인터페이스, 매핑 함수
├── errors.ts               (~70줄)  - AIError 계층 (4종 + 기본)
├── config.ts               (~62줄)  - 환경변수 Zod 검증 + 캐싱
├── retry.ts                (~105줄) - 지수 백오프 재시도
├── validation.ts           (~86줄)  - Zod 2단계 검증 + JSON Schema 변환
├── gemini.ts               (~130줄) - GeminiProvider (generateQuestions 완전 구현)
├── provider.ts             (미구현) - Factory 함수
├── index.ts                (미구현) - 공개 API
├── prompts/
│   ├── question-generation.ts  (~90줄) - 프롬프트 빌더
│   └── index.ts                (~5줄)  - 배럴
└── __tests__/
    ├── errors.test.ts       (9 tests)
    ├── config.test.ts       (5 tests)
    ├── types.test.ts        (8 tests)
    ├── retry.test.ts        (13 tests)
    ├── validation.test.ts   (17 tests)
    ├── gemini.test.ts       (18 tests)
    └── prompts/
        └── question-generation.test.ts  (16 tests)
```

---

## 8. 개발 명령어

```bash
npm run dev            # 개발 서버 (Turbopack)
npm run build          # 프로덕션 빌드
npm run lint           # ESLint
npm run test           # Vitest 워치 모드
npm run test:run       # Vitest 단일 실행
npm run test:coverage  # 커버리지 리포트

# 단일 테스트 파일 실행
npx vitest run src/lib/ai/__tests__/gemini.test.ts
```

---

## 9. 핵심 참조 문서 (우선순위 순)

1. `CLAUDE.md` - 프로젝트 개발 지침 및 기술스택 요약
2. `docs/plan/phase-0-5.md` - Phase 0-5 상세 계획 (Step별 구현 가이드)
3. `docs/design/시스템아키텍처.md` - 아키텍처, DB 스키마, 데이터 흐름
4. `ROADMAP.md` - 단계별 개발 로드맵
5. `docs/prd/PRD-v0.1-detailed.md` - 기능 명세 및 페이지별 상세
