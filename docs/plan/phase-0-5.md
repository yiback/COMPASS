# Phase 0-5: AI 추상화 레이어

> **상태**: 🚧 진행 중
> **시작일**: 2026-02-07
> **진행률**: 5/12 Steps 완료 (42%)
> **마지막 업데이트**: 2026-02-08

---

## 개요

### 목적

AI Provider 패턴(Factory + Strategy)을 구현하여, 향후 AI 엔진 교체를 최소한의 코드 변경으로 가능하게 합니다. Phase 0-5에서는 Google Gemini를 첫 번째 구현체로 연동하고, `generateQuestions`(문제 생성) 기능 하나만 완전 구현합니다.

### 범위

- AI Provider 인터페이스 + GeminiProvider 구현체
- 프롬프트 템플릿 시스템 (문제 생성)
- 응답 파싱/검증 (Zod 스키마 이중 활용)
- 에러 핸들링 (커스텀 에러 계층) + 재시도 로직 (지수 백오프)
- 환경변수 검증 + 설정 관리

### 기대 결과

```typescript
import { createAIProvider } from '@/lib/ai'

const provider = createAIProvider()
const questions = await provider.generateQuestions({
  subject: '수학', grade: 9, unit: '이차방정식',
  difficulty: 3, count: 2, questionType: 'multiple_choice'
})
```

---

## 진행 상태 요약

| Step | 이름 | 상태 | 파일 |
|------|------|------|------|
| 1 | 패키지 설치 및 Vitest 설정 | ✅ | `vitest.config.ts`, `package.json` |
| 2 | errors.ts (커스텀 에러 계층) | ✅ | `src/lib/ai/errors.ts` |
| 3 | config.ts (환경변수 검증) | ✅ | `src/lib/ai/config.ts` |
| 4 | types.ts (인터페이스/타입) | ✅ | `src/lib/ai/types.ts` |
| 5 | retry.ts (재시도 유틸리티) | ✅ | `src/lib/ai/retry.ts` |
| 6 | validation.ts (응답 검증) | ⏸️ | `src/lib/ai/validation.ts` |
| 7 | prompts/question-generation.ts | ⏸️ | `src/lib/ai/prompts/question-generation.ts` |
| 8 | prompts/index.ts (내보내기) | ⏸️ | `src/lib/ai/prompts/index.ts` |
| 9 | gemini.ts (GeminiProvider) | ⏸️ | `src/lib/ai/gemini.ts` |
| 10 | provider.ts (Factory) | ⏸️ | `src/lib/ai/provider.ts` |
| 11 | index.ts (공개 API) | ⏸️ | `src/lib/ai/index.ts` |
| 12 | 환경변수 템플릿 업데이트 | ⏸️ | `.env.example` |

---

## 기술 결정 및 설계 포인트

### SDK 선택: `@google/genai` (v1.40.0+)

- Google 공식 권장 최신 SDK (GA 상태). 구 SDK `@google/generative-ai`는 legacy화 진행 중
- **Structured Output 내장**: `responseMimeType: 'application/json'` + `responseJsonSchema`
- **Zod 연동**: `zod-to-json-schema`로 Zod 스키마를 Gemini responseSchema에 직접 전달 가능

### 아키텍처 패턴: Factory + Strategy

- `AIProvider` 인터페이스 (Strategy 패턴) - 모든 AI 기능 메서드 정의
- `createAIProvider()` 팩토리 함수 - 환경변수 기반 엔진 선택
- `GeminiProvider` 구현체 - `generateQuestions`만 완전 구현
- 향후 OpenAI/Claude 등 엔진 교체를 Factory에 case 추가만으로 해결

### Zod 스키마 이중 활용 (DRY 원칙)

1. `zodToJsonSchema()` → Gemini `responseJsonSchema` (API 레벨 구조화)
2. `schema.parse()` → 응답 후 추가 검증 (비즈니스 로직)
3. "구조화된 출력은 구문적 정확성만 보장, 의미적 정확성은 별도 검증" (Google 공식 문서)

### 미구현 메서드 처리 전략

- 4개 메서드 모두 인터페이스에 정의 (Strategy 패턴 정석)
- `generateQuestions`만 완전 구현
- `gradeAnswer`, `extractFromImage`, `analyzePastExamTrends` → `AIServiceError('NOT_IMPLEMENTED')` throw
- 해당 기능 Phase에서 구현체만 채우면 됨

### Zod v4 발견사항

- Zod v4에는 `toJSONSchema`가 내장되어 있어 `zod-to-json-schema` 패키지가 불필요할 수 있음 (호환성을 위해 둘 다 유지)
- `z.coerce.number()`로 문자열에서 숫자 변환 동작 확인

---

## 의존성 그래프

```
Step 1: 패키지 설치 ──────────────────────────────────────┐
Step 2: errors.ts (독립) ─────┬──────────────────────────┐ │
Step 3: config.ts ────────────┤                          │ │
Step 4: types.ts (독립) ──────┤                          │ │
Step 5: retry.ts ─────────────┘                          │ │
                                                         ▼ ▼
Step 6: validation.ts ──→ types.ts, errors.ts            │
Step 7: prompts/question-generation.ts ──→ types.ts      │
Step 8: prompts/index.ts ──→ Step 7                      │
                                                         │
Step 9: gemini.ts ──→ config, types, retry, validation,  │
                      prompts (모든 모듈)                 │
Step 10: provider.ts ──→ gemini.ts                       │
Step 11: index.ts ──→ provider.ts, types.ts, errors.ts   │
Step 12: .env.example (독립) ────────────────────────────┘
```

**병렬 가능 그룹**:
- 그룹 A (독립): Step 2, Step 4, Step 12
- 그룹 B (errors.ts 의존): Step 3, Step 5
- 그룹 C (types.ts 의존): Step 6, Step 7
- 순차: Step 8 → Step 9 → Step 10 → Step 11

---

## 파일 구조 (10개 소스 + 6개 테스트)

```
src/lib/ai/
├── types.ts                (~140줄) - 인터페이스/타입 [완료]
├── errors.ts               (~70줄)  - 커스텀 에러 [완료]
├── config.ts               (~62줄)  - 환경변수 검증 [완료]
├── retry.ts                (~105줄) - 재시도 유틸리티 [완료]
├── validation.ts           (~80줄)  - 응답 검증
├── gemini.ts               (~100줄) - GeminiProvider
├── provider.ts             (~30줄)  - Factory 함수
├── index.ts                (~15줄)  - 공개 API
├── prompts/
│   ├── question-generation.ts  (~60줄) - 문제 생성 프롬프트
│   └── index.ts                (~5줄)  - 내보내기
└── __tests__/
    ├── errors.test.ts       [완료 - 9 tests]
    ├── config.test.ts       [완료 - 5 tests]
    ├── types.test.ts        [완료 - 8 tests]
    ├── retry.test.ts        [완료 - 13 tests]
    ├── validation.test.ts   [대기]
    ├── provider.test.ts     [대기]
    └── prompts/
        └── question-generation.test.ts  [대기]
```

---

## Step 1: 패키지 설치 및 Vitest 설정

**상태**: ✅ completed

**관련 파일**:
- 수정: `package.json` (의존성 + scripts 추가)
- 생성: `vitest.config.ts`

**의존성**: 없음

**목적**: Google Gemini SDK, Zod-to-JSON-Schema 변환 라이브러리, Vitest 테스트 프레임워크 설치

**구현 가이드**:

```bash
npm install @google/genai zod-to-json-schema
npm install -D vitest
```

설치된 패키지 버전:
- `@google/genai`: ^1.40.0
- `zod-to-json-schema`: ^3.25.1
- `vitest`: ^4.0.18
- `zod`: 이미 설치됨 (v4.3.6)

`package.json` scripts 추가:
```json
"test": "vitest",
"test:run": "vitest run",
"test:coverage": "vitest run --coverage"
```

`vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

**검증 기준**:
- [x] `@google/genai`, `zod-to-json-schema` 설치 확인
- [x] `vitest` dev dependency 설치 확인
- [x] `npx vitest run` 실행 시 v4.0.18 동작 확인
- [x] `vitest.config.ts` 경로 alias 설정 (`@` → `./src`)

**완료 요약**: 모든 패키지 설치 완료. Vitest v4.0.18로 `vitest.config.ts` 생성하여 globals, node 환경, 경로 alias 설정. `npm run test:run` 실행 시 정상 동작 확인 (테스트 파일 없으므로 exit code 1은 정상).

---

## Step 2: errors.ts (커스텀 에러 계층)

**상태**: ✅ completed

**관련 파일**:
- 생성: `src/lib/ai/errors.ts` (~70줄)
- 생성: `src/lib/ai/__tests__/errors.test.ts` (9개 테스트)

**의존성**: 없음

**목적**: AI 서비스 전용 커스텀 에러 클래스 계층 구현. 에러 종류별 `isRetryable` 플래그로 재시도 유틸리티(`retry.ts`)가 자동 판단할 수 있도록 함.

**구현 가이드**:

에러 클래스 계층:
```
AIError (기본 클래스)
├── code: string
├── isRetryable: boolean
│
├── AIServiceError    // API 호출 실패 (isRetryable: true)
├── AIValidationError // 응답 형식 불일치 (isRetryable: false)
├── AIRateLimitError  // 요청 한도 초과 (isRetryable: true, 긴 대기)
└── AIConfigError     // 환경변수 누락 (isRetryable: false)
```

**검증 기준**:
- [x] `AIError` 기본 클래스: message, code, isRetryable, cause 속성
- [x] `AIServiceError`: isRetryable=true, statusCode 포함 가능
- [x] `AIValidationError`: isRetryable=false, details 배열 포함 가능
- [x] `AIRateLimitError`: isRetryable=true, retryAfterMs 포함 가능
- [x] `AIConfigError`: isRetryable=false
- [x] 9개 테스트 모두 통과

**완료 요약**: TDD RED→GREEN 흐름으로 구현. `errors.test.ts` 9개 테스트 작성 후 `Cannot find module '../errors'`로 RED 확인. `errors.ts` 5개 에러 클래스 구현 후 9/9 테스트 통과 (2ms).

---

## Step 3: config.ts (환경변수 검증)

**상태**: ✅ completed

**관련 파일**:
- 생성: `src/lib/ai/config.ts` (62줄)
- 수정: `src/lib/ai/__tests__/config.test.ts` (5개 테스트)

**의존성**: `errors.ts` (Step 2)

**목적**: Zod 스키마로 환경변수를 검증하고 AI 설정 객체를 반환. 기존 `admin.ts` 패턴 참조.

**구현 가이드**:

환경변수 설정:
| 변수 | 필수 | 기본값 |
|------|------|--------|
| `GEMINI_API_KEY` | 필수 | - |
| `GEMINI_MODEL` | 선택 | `gemini-2.0-flash` |
| `AI_PROVIDER` | 선택 | `gemini` |
| `AI_MAX_RETRIES` | 선택 | `3` |
| `AI_TIMEOUT_MS` | 선택 | `30000` |

핵심 구현:
- `coerceNumber` 커스텀 헬퍼: `z.coerce.number()`는 NaN을 에러로 처리하므로 기본값 fallback 불가 → `transform`에서 NaN → undefined → `.pipe()` + `.default()` 패턴 사용
- `safeParse` + `AIConfigError` 래핑: Zod 에러를 프로젝트 에러 계층으로 변환
- 모듈 스코프 `cachedConfig`로 최초 1회만 검증

**검증 기준**:
- [x] `GEMINI_API_KEY` 없으면 `AIConfigError` throw
- [x] 기본값 적용 확인 (model, provider, maxRetries, timeoutMs)
- [x] 환경변수 커스텀 값 적용 확인
- [x] 숫자가 아닌 값 → 기본값 fallback
- [x] 캐싱: 반복 호출 시 동일 객체 반환
- [x] 5개 테스트 모두 통과

**완료 요약**: TDD RED→GREEN 흐름으로 구현. `vi.resetModules()` + `instanceof` 호환성 문제 발견 → 테스트에서 `AIConfigError`를 동적 import로 수정. `z.coerce.number()` 대신 커스텀 `coerceNumber` 헬퍼로 NaN 기본값 fallback 해결. 5/5 테스트 통과, 전체 14/14 회귀 통과, TypeScript 빌드 통과.

---

## Step 4: types.ts (인터페이스/타입 정의)

**상태**: ✅ completed

**관련 파일**:
- 생성: `src/lib/ai/types.ts` (~140줄)
- 생성: `src/lib/ai/__tests__/types.test.ts` (8개 테스트)

**의존성**: 없음

**목적**: 시스템아키텍처.md 설계 기반 `AIProvider` 인터페이스 + 모든 AI 관련 타입 정의

**설계 결정**:

1. **DB `descriptive` vs AI `essay` 불일치 처리**: DB 스키마(이미 배포됨)는 `descriptive`, AI 프롬프트에서는 `essay`가 더 명확. `Record` 기반 매핑 함수 2개(`toDbQuestionType`, `fromDbQuestionType`)로 안전한 변환 제공. `as const satisfies Record<...>` 패턴으로 타입 체크 + 리터럴 추론 + 불변성 동시 확보
2. **Zod 스키마 분리**: types.ts는 순수 TypeScript 타입만 포함 (zod 의존성 없음). Zod 스키마는 validation.ts(Step 6)에 배치
3. **모든 필드에 `readonly` 적용**: 불변성 원칙 준수. `z.infer`(mutable) → `readonly` 인터페이스는 TypeScript 구조적 타이핑에서 호환됨
4. **미구현 타입도 DB 스키마 기반 의미있는 구조 정의**: 빈 인터페이스(`{}`) 대신 Phase 2-3 구현 시 수정 범위 최소화

**검증 기준**:
- [x] `AIProvider` 인터페이스: 4개 메서드 (generateQuestions, gradeAnswer, processOCR, analyzeTrends)
- [x] `QuestionType` ↔ `DbQuestionType` 매핑 함수 정합성 (Roundtrip 테스트 포함)
- [x] 모든 인터페이스 필드에 `readonly` 적용
- [x] `as const satisfies` 패턴으로 매핑 테이블 타입 안전성 확보
- [x] TypeScript 빌드 통과 (`tsc --noEmit`)
- [x] 8개 테스트 모두 통과 (매핑 6개 + Roundtrip 2개)
- [x] 전체 회귀 테스트 22개 통과

**완료 요약**: TDD RED→GREEN→REFACTOR 흐름으로 구현. 매핑 함수 테스트 6개 작성 후 RED 확인. types.ts ~140줄 구현 후 GREEN. 코드 리뷰에서 `as const satisfies` 패턴 적용 + Roundtrip 테스트 2개 추가(REFACTOR). 최종 22/22 테스트 통과, TypeScript 빌드/프로덕션 빌드 모두 통과.

---

## Step 5: retry.ts (재시도 유틸리티)

**상태**: ✅ completed

**관련 파일**:
- 생성: `src/lib/ai/retry.ts` (~105줄)
- 생성: `src/lib/ai/__tests__/retry.test.ts` (13개 테스트)

**의존성**: `errors.ts` (Step 2)

**목적**: 지수 백오프(exponential backoff) 재시도 유틸리티. `isRetryable: true`인 에러만 재시도.

**구현 가이드**:

```typescript
export interface RetryOptions {
  readonly maxRetries?: number       // 기본: 3
  readonly baseDelayMs?: number      // 기본: 1000
  readonly maxDelayMs?: number       // 기본: 10000
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T>
```

동작:
- 기본 3회 재시도, 1초 → 2초 → 4초 (최대 10초 캡)
- `isRetryable: true`인 에러만 재시도
- `AIRateLimitError`는 `retryAfterMs`가 양수일 때만 해당 값 사용, 아니면 지수 백오프 폴백
- `AIValidationError`는 재시도 안 함 (isRetryable: false)
- 비-AIError (일반 Error) → 재시도 대상 (네트워크 타임아웃 등 일시적 장애 가능)
- 최대 재시도 초과 시 마지막 에러를 그대로 throw
- 음수 입력값 검증 (maxRetries, baseDelayMs, maxDelayMs)

**설계 결정**:

1. **config.ts 연동 안 함 (독립적 기본값 사용)**: `getAIConfig()`는 `GEMINI_API_KEY` 필수 → 테스트에서 환경변수 의존성 제거. `gemini.ts`에서 `withRetry(fn, { maxRetries: config.maxRetries })` 형태로 주입
2. **비-AIError 처리: 재시도**: 네트워크 타임아웃 등 일반 `Error`도 일시적 장애 → 재시도 대상. `AIError`이면서 `isRetryable: false`인 경우만 즉시 throw
3. **AIRateLimitError 딜레이**: `retryAfterMs`가 양수이면 서버 명시 시간 사용 (지수 백오프 대체). 0이하이거나 없으면 지수 백오프 적용

**테스트 교훈 (Unhandled Promise Rejection)**:

`vi.useFakeTimers()` + 비동기 promise 조합에서, promise가 reject되기 전에 rejection handler를 등록해야 Unhandled Promise Rejection 경고를 방지할 수 있음:

```typescript
// ❌ handler 등록 전에 타이머 전진 → reject 시점에 handler 없음
const promise = withRetry(fn, { maxRetries: 2 })
await vi.advanceTimersByTimeAsync(300)
await expect(promise).rejects.toThrow('에러')  // 이미 늦음!

// ✅ handler를 먼저 등록 후 타이머 전진
const promise = withRetry(fn, { maxRetries: 2 })
const assertion = expect(promise).rejects.toThrow('에러')  // handler 등록
await vi.advanceTimersByTimeAsync(300)
await assertion  // 결과 확인
```

**검증 기준**:
- [x] 첫 번째 시도 성공 시 바로 반환
- [x] 재시도 성공 시 정상 반환
- [x] 최대 재시도 초과 시 마지막 에러 throw
- [x] `isRetryable: false` → 즉시 throw (재시도 안 함)
- [x] `AIRateLimitError` → `retryAfterMs` 양수일 때 대기 후 재시도
- [x] `AIRateLimitError` → `retryAfterMs` 없으면 지수 백오프 사용
- [x] `AIRateLimitError` → `retryAfterMs: 0` → 지수 백오프 폴백
- [x] 지수 백오프 딜레이 2배씩 증가 확인
- [x] `maxDelayMs` 캡 동작 확인
- [x] `maxRetries: 0` → 첫 시도만, 에러 시 즉시 throw
- [x] 비-AIError (일반 Error) → 재시도 대상
- [x] 음수 `maxRetries` → 에러 throw
- [x] 음수 `baseDelayMs` → 에러 throw
- [x] 13개 테스트 모두 통과
- [x] 전체 회귀 테스트 35개 통과
- [x] TypeScript 빌드/프로덕션 빌드 통과

**완료 요약**: TDD RED→GREEN→REFACTOR 흐름으로 구현. 10개 테스트 작성 후 RED 확인 (`Cannot find module`). `retry.ts` ~70줄 구현 후 10/10 GREEN. Unhandled Promise Rejection 해결 (assertion 먼저 등록 패턴). 코드 리뷰 반영: 음수 입력값 검증 + `retryAfterMs: 0` 폴백 처리 → 3개 테스트 추가(REFACTOR). 최종 35/35 테스트 통과, ESLint 에러 0개, 빌드 통과.

---

## Step 6: validation.ts (응답 검증)

**상태**: ⏸️ pending

**관련 파일**:
- 생성 예정: `src/lib/ai/validation.ts` (~80줄)
- 생성 예정: `src/lib/ai/__tests__/validation.test.ts`

**의존성**: `types.ts` (Step 4), `errors.ts` (Step 2)

**목적**: AI 응답을 Zod 스키마로 검증하고 타입 안전한 객체로 변환. Zod 스키마를 Gemini `responseJsonSchema`로도 활용 (DRY).

**구현 가이드**:

```typescript
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { GeneratedQuestion } from './types'
import { AIValidationError } from './errors'

export const generatedQuestionSchema = z.object({
  content: z.string().min(1),
  answer: z.string().min(1),
  explanation: z.string().min(1),
  difficulty: z.number().int().min(1).max(5),
  questionType: z.enum(['multiple_choice', 'short_answer', 'essay']),
  options: z.array(z.string()).optional(),
})

export const generatedQuestionsResponseSchema = z.object({
  questions: z.array(generatedQuestionSchema),
})

// Gemini responseJsonSchema로 변환
export const questionsJsonSchema = zodToJsonSchema(generatedQuestionsResponseSchema)

export function validateGeneratedQuestions(data: unknown): GeneratedQuestion[] {
  // 1. Zod 파싱
  // 2. 객관식이면 보기 5개 확인
  // 3. 실패 시 AIValidationError throw (details 포함)
}
```

검증 규칙:
- 필수 필드: content, answer, explanation, difficulty, questionType
- 객관식(`multiple_choice`) → options 배열 5개 필수
- 난이도 범위: 1~5
- Zod 파싱 실패 → `AIValidationError` (details에 경로+메시지)

**검증 기준**:
- [ ] 유효한 데이터 → `GeneratedQuestion[]` 반환
- [ ] 무효한 데이터 → `AIValidationError` throw
- [ ] 객관식 보기 5개 미만 → 에러
- [ ] 난이도 범위 벗어남 → 에러
- [ ] `questionsJsonSchema` JSON Schema 형식 확인
- [ ] 모든 테스트 통과

---

## Step 7: prompts/question-generation.ts (프롬프트 빌더)

**상태**: ⏸️ pending

**관련 파일**:
- 생성 예정: `src/lib/ai/prompts/question-generation.ts` (~60줄)
- 생성 예정: `src/lib/ai/__tests__/prompts/question-generation.test.ts`

**의존성**: `types.ts` (Step 4)

**목적**: 문제 생성 프롬프트를 동적으로 빌드. 시스템 인스트럭션 + 사용자 프롬프트 + 응답 스키마를 `PromptConfig`로 반환.

**구현 가이드**:

```typescript
import type { GenerateQuestionParams, PromptConfig } from '../types'
import { questionsJsonSchema } from '../validation'

export function buildQuestionGenerationPrompt(
  params: GenerateQuestionParams
): PromptConfig {
  return {
    systemInstruction: `당신은 한국 중학교 시험 출제 전문가입니다.
주어진 과목, 학년, 단원에 맞는 시험 문제를 생성합니다.
문제는 교육과정 성취기준에 부합해야 하며, 난이도가 적절해야 합니다.

수학 기호와 수식은 LaTeX 문법을 사용하세요.
- 인라인 수식: $...$ (예: $x^2 + 3x - 4 = 0$)
- 블록 수식: $$...$$ (예: $$\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$)
- 그래프가 필요한 경우 함수식과 주요 좌표를 텍스트로 설명하세요.`,
    userPrompt: `다음 조건에 맞는 시험 문제를 ${params.count}개 생성해주세요:
- 과목: ${params.subject}
- 학년: ${params.grade}학년
- 단원: ${params.unit}
- 난이도: ${params.difficulty}/5
- 문제 유형: ${formatQuestionType(params.questionType)}

각 문제에는 정답과 상세 해설을 포함해주세요.`,
    responseSchema: questionsJsonSchema,
    temperature: 0.7,
    maxOutputTokens: 4096,
  }
}
```

**검증 기준**:
- [ ] `PromptConfig` 형식 반환 확인
- [ ] `systemInstruction`에 역할 정의 포함
- [ ] `systemInstruction`에 LaTeX 수식 사용 지시 포함 (인라인 `$...$`, 블록 `$$...$$`)
- [ ] `userPrompt`에 params 값 반영 확인
- [ ] `responseSchema`에 JSON Schema 포함
- [ ] temperature, maxOutputTokens 기본값 설정
- [ ] 모든 테스트 통과

---

## Step 8: prompts/index.ts (내보내기)

**상태**: ⏸️ pending

**관련 파일**:
- 생성 예정: `src/lib/ai/prompts/index.ts` (~5줄)

**의존성**: Step 7

**목적**: 프롬프트 빌더 함수들을 re-export

**구현 가이드**:

```typescript
export { buildQuestionGenerationPrompt } from './question-generation'
```

**검증 기준**:
- [ ] `import { buildQuestionGenerationPrompt } from './prompts'` 가능
- [ ] TypeScript 빌드 통과

---

## Step 9: gemini.ts (GeminiProvider 구현체)

**상태**: ⏸️ pending

**관련 파일**:
- 생성 예정: `src/lib/ai/gemini.ts` (~100줄)
- 테스트: `src/lib/ai/__tests__/gemini.test.ts` (SDK 모킹)

**의존성**: `config.ts`, `types.ts`, `retry.ts`, `validation.ts`, `prompts/` (모든 모듈)

**목적**: `AIProvider` 인터페이스의 Gemini 구현체. `@google/genai` SDK를 사용하여 Structured Output으로 문제 생성.

**구현 가이드**:

```typescript
import { GoogleGenAI } from '@google/genai'
import type { AIProvider, GenerateQuestionParams, GeneratedQuestion } from './types'
import { getAIConfig } from './config'
import { withRetry } from './retry'
import { validateGeneratedQuestions, questionsJsonSchema } from './validation'
import { buildQuestionGenerationPrompt } from './prompts'
import { AIServiceError } from './errors'

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini'
  readonly model: string
  private readonly client: GoogleGenAI

  constructor() {
    const config = getAIConfig()
    this.model = config.model
    this.client = new GoogleGenAI({ apiKey: config.apiKey })
  }

  async generateQuestions(params: GenerateQuestionParams): Promise<GeneratedQuestion[]> {
    const prompt = buildQuestionGenerationPrompt(params)

    return withRetry(async () => {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: prompt.userPrompt,
        config: {
          systemInstruction: prompt.systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: prompt.responseSchema,
          temperature: prompt.temperature,
          maxOutputTokens: prompt.maxOutputTokens,
        },
      })

      const parsed = JSON.parse(response.text ?? '')
      return validateGeneratedQuestions(parsed)
    })
  }

  async gradeAnswer(): Promise<never> {
    throw new AIServiceError('gradeAnswer는 아직 구현되지 않았습니다')
  }

  async extractFromImage(): Promise<never> {
    throw new AIServiceError('extractFromImage는 아직 구현되지 않았습니다')
  }

  async analyzePastExamTrends(): Promise<never> {
    throw new AIServiceError('analyzePastExamTrends는 아직 구현되지 않았습니다')
  }
}
```

모킹 전략: `@google/genai` SDK를 `vi.mock()`으로 모킹하여 실제 API 호출 없이 단위 테스트

**검증 기준**:
- [ ] `AIProvider` 인터페이스 구현 확인
- [ ] `generateQuestions`: 프롬프트 빌드 → API 호출 → 검증 → 반환 흐름
- [ ] `withRetry` 래핑 확인
- [ ] Structured Output 설정 (`responseMimeType`, `responseSchema`)
- [ ] 미구현 메서드 → `AIServiceError` throw
- [ ] SDK 모킹 기반 테스트 통과

---

## Step 10: provider.ts (Factory 함수)

**상태**: ⏸️ pending

**관련 파일**:
- 생성 예정: `src/lib/ai/provider.ts` (~30줄)
- 생성 예정: `src/lib/ai/__tests__/provider.test.ts`

**의존성**: `gemini.ts` (Step 9)

**목적**: Factory 패턴으로 AI Provider 인스턴스 생성. 환경변수 또는 매개변수 기반 엔진 선택.

**구현 가이드**:

```typescript
import type { AIProvider, ProviderType } from './types'
import { GeminiProvider } from './gemini'
import { AIConfigError } from './errors'

export function createAIProvider(type?: ProviderType): AIProvider {
  const providerType = type ?? (process.env.AI_PROVIDER as ProviderType) ?? 'gemini'

  switch (providerType) {
    case 'gemini':
      return new GeminiProvider()
    default:
      throw new AIConfigError(`지원하지 않는 AI Provider: ${providerType}`)
  }
}
```

**검증 기준**:
- [ ] `'gemini'` → `GeminiProvider` 인스턴스 반환
- [ ] 알 수 없는 타입 → `AIConfigError` throw
- [ ] 환경변수 `AI_PROVIDER` 기반 선택
- [ ] 매개변수 우선순위: 인자 > 환경변수 > 기본값('gemini')
- [ ] 모든 테스트 통과

---

## Step 11: index.ts (공개 API)

**상태**: ⏸️ pending

**관련 파일**:
- 생성 예정: `src/lib/ai/index.ts` (~15줄)

**의존성**: `provider.ts`, `types.ts`, `errors.ts`

**목적**: `src/lib/ai` 모듈의 공개 API 정의. 외부에서는 `import { ... } from '@/lib/ai'`로만 접근.

**구현 가이드**:

```typescript
// 공개 API
export { createAIProvider } from './provider'

// 타입
export type {
  AIProvider,
  GenerateQuestionParams,
  GeneratedQuestion,
  PromptConfig,
  ProviderType,
  QuestionType,
} from './types'

// 에러
export {
  AIError,
  AIServiceError,
  AIValidationError,
  AIRateLimitError,
  AIConfigError,
} from './errors'
```

**검증 기준**:
- [ ] `import { createAIProvider } from '@/lib/ai'` 가능
- [ ] 타입 re-export 확인
- [ ] 에러 클래스 re-export 확인
- [ ] 내부 모듈 (config, retry, validation, prompts) 직접 노출 안 함
- [ ] TypeScript 빌드 통과

---

## Step 12: 환경변수 템플릿 업데이트

**상태**: ⏸️ pending

**관련 파일**:
- 수정 예정: `.env.example` 또는 `.env.local.example`

**의존성**: 없음

**목적**: AI 관련 환경변수를 팀원이 알 수 있도록 템플릿에 추가

**구현 가이드**:

`.env.example`에 추가:
```bash
# AI 서비스 설정
GEMINI_API_KEY=          # Google Gemini API 키 (필수)
GEMINI_MODEL=gemini-2.0-flash  # Gemini 모델 (선택, 기본: gemini-2.0-flash)
AI_PROVIDER=gemini       # AI 제공자 (선택, 기본: gemini)
```

**검증 기준**:
- [ ] `.env.example` 또는 `.env.local.example`에 AI 환경변수 존재
- [ ] 주석으로 필수/선택 여부 표시
- [ ] 기본값 명시

---

## 최종 검증 방법

### 빌드 검증
```bash
npm run build   # TypeScript 컴파일 통과
npm run lint    # ESLint 통과
```

### 단위 테스트 (TDD)
```bash
npm run test:run  # 모든 테스트 통과
```
각 Step마다 RED → GREEN → REFACTOR 흐름 준수

### 수동 통합 테스트 (선택)
```typescript
import { createAIProvider } from '@/lib/ai'

const provider = createAIProvider()
const questions = await provider.generateQuestions({
  subject: '수학',
  grade: 9,
  unit: '이차방정식',
  difficulty: 3,
  count: 2,
  questionType: 'multiple_choice',
})
console.log(questions)
```

---

## 관련 문서

| 문서 | 경로 | 참조 내용 |
|------|------|-----------|
| 시스템 아키텍처 | `docs/design/시스템아키텍처.md` (Section 5) | AIProvider 인터페이스, 프롬프트 템플릿, 품질 검증 |
| 기술 스택 | `docs/design/기술스택.md` | 구현 순서, 검증 기준 |
| DB 스키마 | `supabase/migrations/00001_initial_schema.sql` | questions 테이블 AI 관련 컬럼 |
| Supabase admin.ts | `src/lib/supabase/admin.ts` | 환경변수 검증 패턴 참조 |
| 개발 로드맵 | `ROADMAP.md` (Phase 0-5) | 전체 프로젝트 맥락 |
