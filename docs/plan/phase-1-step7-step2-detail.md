# 1-7 Step 2 상세 구현 계획: 프롬프트 빌더 — buildPastExamGenerationPrompt (TDD)

> **상태**: ✅ 완료
> **마지막 업데이트**: 2026-02-20
> **상위 계획**: `docs/plan/phase-1-step7-ai-question-generation.md`

---

## 1. 개요

기출문제 기반 문제 생성 전용 프롬프트 빌더 `buildPastExamGenerationPrompt`를 신규 파일(`src/lib/ai/prompts/past-exam-generation.ts`)에 구현한다. 기존 `buildQuestionGenerationPrompt`(성취기준 기반)와 **별도 함수**로 분리하되, `questionsJsonSchema`(Zod 기반 응답 스키마)는 공유 재사용한다.

전체 과정을 TDD RED → GREEN → REFACTOR → 회귀 검증의 4개 서브스텝(a~d)에 걸쳐 진행한다.

**핵심 원칙**: 기존 `buildQuestionGenerationPrompt`와 테스트 18개에 영향 없음. 신규 파일 추가 + index.ts export 1줄 변경뿐.

---

## 2. 의존성

### Step 1 결과물 (완료)

| 파일 | 제공하는 것 |
|------|-----------|
| `src/lib/ai/types.ts` | `PastExamContext` 인터페이스, `GenerateQuestionParams.pastExamContext?`, `QuestionType`, `PromptConfig` |
| `src/lib/ai/index.ts` | `PastExamContext` export |
| `src/lib/validations/generate-questions.ts` | `generateQuestionsRequestSchema`, `MAX_QUESTION_COUNT` |

### 기존 파일 (참조/재사용)

| 파일 | 역할 | 이번 Step에서 |
|------|------|-------------|
| `src/lib/ai/prompts/question-generation.ts` (~91줄) | 기존 프롬프트 빌더. 구조·패턴 참조 대상 | **읽기만** (수정 없음) |
| `src/lib/ai/__tests__/prompts/question-generation.test.ts` (~168줄, 18개) | 기존 프롬프트 빌더 테스트. 회귀 검증 대상 | **읽기만** (수정 없음) |
| `src/lib/ai/validation.ts` (~92줄) | `questionsJsonSchema` — responseSchema로 재사용 | **import만** |
| `src/lib/ai/prompts/index.ts` (~5줄) | 프롬프트 배럴 export | **1줄 추가** |

---

## 3. TDD 서브스텝 (a~d)

### 서브스텝 흐름도

```
a. 테스트 작성 (RED)
    ↓ past-exam-generation.test.ts 신규 생성 → 모듈 없어서 FAIL
b. 최소 구현 (GREEN)
    ↓ past-exam-generation.ts 신규 + index.ts export → 전체 PASS
c. 리팩터 (REFACTOR)
    ↓ 코드 정리 (필요 시)
d. 회귀 검증
    ↓ 기존 question-generation.test.ts + 전체 테스트 (~384)
```

---

### 서브스텝 a: 테스트 작성 (RED)

**목표**: `buildPastExamGenerationPrompt`에 대한 테스트 14개를 신규 파일에 작성한다. 아직 구현 모듈이 없으므로 import 에러로 **FAIL(RED)**하는 것이 정상이다.

**변경 파일**:

| 작업 | 파일 | 변경 내용 |
|------|------|----------|
| 신규 | `src/lib/ai/__tests__/prompts/past-exam-generation.test.ts` | 테스트 14개 (~160줄) |

**실행 및 예상 결과**:

```bash
npx vitest run src/lib/ai/__tests__/prompts/past-exam-generation.test.ts
```

→ **FAIL** — `Cannot find module '../../prompts/past-exam-generation'`

---

### 서브스텝 b: 최소 구현 (GREEN)

**목표**: `buildPastExamGenerationPrompt` 함수를 신규 파일에 구현하고 index.ts에 export를 추가한다. 서브스텝 a의 테스트가 **PASS(GREEN)**해야 한다.

**변경 파일**:

| 작업 | 파일 | 변경 내용 |
|------|------|----------|
| 신규 | `src/lib/ai/prompts/past-exam-generation.ts` | 프롬프트 빌더 함수 (~80줄) |
| 수정 | `src/lib/ai/prompts/index.ts` | export 1줄 추가 |

**실행 및 예상 결과**:

```bash
npx vitest run src/lib/ai/__tests__/prompts/past-exam-generation.test.ts
```

→ **PASS** — 14개 전체 통과

---

### 서브스텝 c: 리팩터 (REFACTOR)

**목표**: 코드 품질 점검. 함수 < 50줄, 파일 < 800줄, 중복 제거, 네이밍 개선 등.

**예상 변경**: 크지 않음. 기존 패턴을 충실히 따르므로 리팩터 필요성 낮음.

---

### 서브스텝 d: 회귀 검증

**목표**: 기존 프롬프트 빌더 테스트 + 전체 테스트를 실행하여 회귀가 없음을 확인한다.

**실행 명령어**:

```bash
# 1. 신규 테스트 재확인
npx vitest run src/lib/ai/__tests__/prompts/past-exam-generation.test.ts

# 2. 기존 프롬프트 빌더 회귀 검증
npx vitest run src/lib/ai/__tests__/prompts/question-generation.test.ts

# 3. AI 모듈 전체 회귀 검증
npx vitest run src/lib/ai/__tests__/

# 4. 전체 프로젝트 테스트
npx vitest run
```

**예상 결과**:
- past-exam-generation.test.ts: 14개 PASS
- question-generation.test.ts: 18개 PASS (회귀 없음)
- AI 전체: 회귀 없음
- 전체: 기존 369 + 신규 14 = ~383개 PASS

---

## 4. 테스트 목록 (상세)

### 테스트 팩토리

```typescript
/** 기본 테스트 파라미터 생성 (오버라이드 가능) */
function createTestParams(
  overrides?: Partial<GenerateQuestionParams>,
): GenerateQuestionParams {
  return {
    subject: '수학',
    grade: 2,
    questionType: 'multiple_choice',
    count: 5,
    difficulty: 'medium',
    pastExamContext: {
      pastExamId: '550e8400-e29b-41d4-a716-446655440000',
      schoolName: '한국중학교',
      year: 2025,
      semester: 1,
      examType: 'midterm',
    },
    ...overrides,
  }
}
```

기존 `question-generation.test.ts`의 `createTestParams`와 구조 동일하되, `pastExamContext`가 기본 포함된다는 차이가 있다.

### 테스트 14개

| # | describe | 테스트명 | 검증 내용 | 핵심 assert |
|---|----------|---------|----------|------------|
| 1 | 반환 형식 | PromptConfig의 5개 필드를 모두 포함해야 한다 | 반환 객체 구조 확인 | `toHaveProperty` × 5 |
| 2 | systemInstruction | 기출문제 분석 전문가 역할 정의를 포함해야 한다 | '기출문제 분석' 키워드 | `toContain('기출문제 분석')` |
| 3 | systemInstruction | LaTeX 수식 사용 지시를 포함해야 한다 | LaTeX 규칙 포함 | `toContain('LaTeX')` |
| 4 | systemInstruction | '유사' 키워드를 포함해야 한다 | 기존 프롬프트와의 핵심 차이 | `toContain('유사')` |
| 5 | systemInstruction | 출제 경향 반영 지시를 포함해야 한다 | 학교 시험 스타일 반영 지시 | `toContain('출제 경향')` |
| 6 | userPrompt - 기출 컨텍스트 | pastExamContext가 있으면 학교명을 포함해야 한다 | schoolName 반영 | `toContain('한국중학교')` |
| 7 | userPrompt - 기출 컨텍스트 | pastExamContext가 있으면 연도/학기를 포함해야 한다 | year, semester 반영 | `toContain('2025')`, `toContain('1학기')` |
| 8 | userPrompt - 기출 컨텍스트 | pastExamContext가 있으면 시험유형을 한글로 포함해야 한다 | EXAM_TYPE_LABELS 매핑 | `toContain('중간고사')` |
| 9 | userPrompt - 기출 컨텍스트 | extractedContent가 있으면 기출 내용을 포함해야 한다 | extractedContent 삽입 | `toContain('기출문제 내용')` |
| 10 | userPrompt - 기출 컨텍스트 | extractedContent가 없으면 메타데이터 기반 안내 메시지를 포함해야 한다 | 원본 없음 안내 | `toContain('원본 내용이 없')` |
| 11 | userPrompt - 생성 조건 | 과목/학년/문제유형/난이도/문제수를 포함해야 한다 | 기본 생성 조건 반영 | `toContain` × 5 |
| 12 | userPrompt - 생성 조건 | unit이 있으면 포함, topics가 있으면 포함해야 한다 | optional 필드 반영 | `toContain('이차방정식')`, `toContain('근의 공식')` |
| 13 | 기본값 | temperature는 0.8이어야 한다 | 기존 0.7과 차이 | `toBe(0.8)` |
| 14 | 기본값 | responseSchema는 questionsJsonSchema와 같아야 한다 | 공유 스키마 재사용 확인 | `toBe(questionsJsonSchema)` |

### 핵심 테스트 (9, 10번): extractedContent 분기

이 두 테스트가 이번 Step의 **가장 중요한 테스트**이다. 기존 `buildQuestionGenerationPrompt`에는 없는 새로운 분기 로직.

- **9번 (있음)**: `extractedContent`에 값이 있으면 `=== 기출문제 내용 (참고) ===` 섹션 포함 + "유사하지만 새로운 문제를 생성하세요" 지시
- **10번 (없음)**: `extractedContent`가 undefined이면 "기출문제 원본 내용이 없으므로" 안내 메시지 포함

---

## 5. 구현 설계

### 5-1. `src/lib/ai/prompts/past-exam-generation.ts` (~80줄)

상위 계획 문서 `docs/plan/phase-1-step7-ai-question-generation.md` Step 2 섹션의 코드 초안을 그대로 따른다. 핵심 구조:

```
import 선언 (types, validation)
  ↓
상수 정의
  - DEFAULT_TEMPERATURE = 0.8
  - DEFAULT_MAX_OUTPUT_TOKENS = 4096
  - QUESTION_TYPE_LABELS (Record<QuestionType, string>)
  - SYSTEM_INSTRUCTION (5개 규칙 문자열)
  - EXAM_TYPE_LABELS (Record<string, string>)
  ↓
export function buildPastExamGenerationPrompt(params): PromptConfig
  - lines 배열에 기출 컨텍스트 정보 추가
  - lines 배열에 생성 조건 추가
  - extractedContent 유무 분기
  - PromptConfig 객체 반환
```

### 5-2. `src/lib/ai/prompts/index.ts` (1줄 추가)

```typescript
export { buildPastExamGenerationPrompt } from './past-exam-generation'
```

기존 `export { buildQuestionGenerationPrompt }` 아래에 추가.

---

## 6. 설계 결정 근거

| # | 결정 | 근거 |
|---|------|------|
| 1 | 별도 프롬프트 빌더 함수 분리 | 기존 `buildQuestionGenerationPrompt` 수정 시 0-5의 테스트 18개 영향. SRP 원칙. systemInstruction부터 다름 |
| 2 | temperature 0.8 | 기출 참고하되 동일 문제 반복 방지. "참조 기준"이 있으므로 약간 높여도 품질 유지 |
| 3 | `EXAM_TYPE_LABELS` 독립 정의 | 프롬프트용 한글 레이블과 UI용 레이블의 변경 주기가 다름. AI 출력 품질에 직접 영향 |
| 4 | `QUESTION_TYPE_LABELS` 독립 정의 | 두 프롬프트 빌더는 독립적으로 변경 가능. 중복 3줄 비용 < 결합 리스크 |
| 5 | extractedContent 유무 분기 | MVP에서 OCR 미구현이므로 null인 경우 대부분. 메타데이터만으로도 적절한 문제 생성 |
| 6 | `EXAM_TYPE_LABELS` 미등록 examType → `??` fallback | DB에 새 exam_type 추가 가능. 런타임 에러 방지 |

---

## 7. 리스크

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| `QUESTION_TYPE_LABELS` 중복 | **낮음** | 의도적 독립 정의. 수용 |
| extractedContent 토큰 초과 | **낮음** | MVP에서 무시. Gemini 1M+ 토큰 컨텍스트 충분. 추후 truncate 추가 가능 |
| EXAM_TYPE_LABELS 미등록 examType | **낮음** | `??` 연산자 fallback. 프롬프트 품질 약간 저하 가능하나 에러 없음 |
| index.ts 순환 참조 | **매우 낮음** | past-exam-generation.ts → types, validation만 import. 순환 경로 없음 |

---

## 8. 파일 변경 요약

| 서브스텝 | 작업 | 파일 | 변경량 |
|---------|------|------|--------|
| a (RED) | 신규 | `src/lib/ai/__tests__/prompts/past-exam-generation.test.ts` | ~160줄 |
| b (GREEN) | 신규 | `src/lib/ai/prompts/past-exam-generation.ts` | ~80줄 |
| b (GREEN) | 수정 | `src/lib/ai/prompts/index.ts` | +1줄 |
| c | — | — | 정리만 |
| d | — | — | 검증만 |

**총: 1개 수정 + 2개 신규 = 3개 파일**
**신규 테스트: 14개**

---

## 9. 성공 기준

- [x] `npx vitest run src/lib/ai/__tests__/prompts/past-exam-generation.test.ts` — 14개 전체 PASS
- [x] `npx vitest run src/lib/ai/__tests__/prompts/question-generation.test.ts` — 16개 전체 PASS (회귀 없음)
- [x] `npx vitest run src/lib/ai/__tests__/` — AI 전체 114개 테스트 회귀 없음
- [x] `npx vitest run` — 전체 383개 PASS
- [x] temperature가 0.8로 설정됨 (테스트 13번)
- [x] responseSchema가 questionsJsonSchema와 동일 (테스트 14번)
- [x] extractedContent 유무에 따른 프롬프트 분기 정상 (테스트 9, 10번)
- [x] EXAM_TYPE_LABELS 매핑 정상: midterm → 중간고사 (테스트 8번)

---

## 10. 학습 리뷰 (구현 완료 후 실행)

### 핵심 개념

| # | 개념 | 난이도 | 설명 |
|---|------|--------|------|
| 1 | 프롬프트 엔지니어링 구조 (systemInstruction vs userPrompt) | 🟡 | AI에게 "역할"을 부여하는 부분(system)과 "이번 요청"을 전달하는 부분(user)의 분리. 왜 분리하는가? |
| 2 | 빌더 패턴 (lines 배열 조립) | 🟢 | 문자열을 직접 연결하지 않고 배열에 push → join하는 패턴. 가독성·조건부 삽입에 유리 |
| 3 | Nullish Coalescing (`??`) 연산자 | 🟢 | `value ?? fallback` — `null`/`undefined`일 때만 fallback. `||`와의 차이점 |

### 이해도 질문 (3개)

1. **systemInstruction에 "너는 수학 교사다"를 넣는 것과 userPrompt에 넣는 것의 차이는?**
   - 힌트: AI가 여러 번의 대화를 할 때, system은 매번 유지되고 user는 매번 바뀐다

2. **프롬프트를 `lines.push()` → `lines.join('\n')`으로 조립하는 이유는? 그냥 문자열 `+`로 합치면 안 되나?**
   - 힌트: `if (unit) lines.push(...)` 같은 조건부 삽입을 생각해보세요

3. **`examType ?? examType`과 `examType || 'unknown'`의 차이는? `examType = ''`(빈 문자열)일 때 각각 어떤 값이 되나?**
   - 힌트: `??`는 null/undefined만 체크, `||`는 falsy 전체를 체크

### 직접 구현 추천

- 🟢 반복 패턴 — 기존 `buildQuestionGenerationPrompt`와 구조 동일. AI 자동 구현 OK
- 단, 이해도 질문 3개는 반드시 답변 후 다음 단계 진행

---

## 커밋 계획

서브스텝 d 완료 후 단일 커밋:

```
✨ feat: 1-7 Step 2 프롬프트 빌더 — buildPastExamGenerationPrompt (TDD)
```
