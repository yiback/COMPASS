# 1-8 생성된 문제 저장 [F003] 구현 계획

> **진행률**: 5/5 Steps (100%)
> **마지막 업데이트**: 2026-03-01
> **상태**: ✅ 완료

| Step   | 내용                                              | 상태  | 의존성 |
| ------ | ----------------------------------------------- | --- | --- |
| Step 1 | 타입 매핑 유틸 + 저장 Zod 스키마 (TDD)                     | ✅ | 없음 (시작점) |
| Step 2 | 저장 Server Action — saveGeneratedQuestions (TDD) | ✅ | Step 1 완료 후 |
| Step 3 | UI — 저장 버튼 + 개별 선택 저장                           | ✅ | Step 2 완료 후 |
| Step 4 | 문제 목록 조회 DataTable + 사이드바 메뉴                    | ✅ | ⚡ Step 1과 병렬 가능 |
| Step 5 | 문제 상세 Sheet + 빌드 검증 + 학습 리뷰                     | ✅ | Step 4 완료 후 |
---

## Context

1-7에서 기출 기반 AI 문제 생성이 완료되었다. AI가 생성한 문제(`GeneratedQuestion[]`)는 현재 클라이언트 메모리(React state)에만 존재하고, 브라우저를 닫거나 페이지를 이동하면 사라진다. 1-8에서는 이 결과를 DB `questions` 테이블에 저장하고, 저장된 문제를 목록/상세로 조회하는 기능을 구현한다.

**핵심**: 이미 DB 스키마(`questions` 테이블)와 RLS 정책이 존재하므로 마이그레이션은 불필요하다. AI 타입(`GeneratedQuestion`)과 DB 컬럼 사이의 **타입 변환(매핑)**이 핵심 작업이다.

---

## MVP 범위

| 포함                                       | 제외 (후순위)                |
| ---------------------------------------- | ----------------------- |
| 생성된 문제 DB 저장 (Bulk INSERT Server Action) | 문제 수정/편집 UI (단계 2 F004) |
| "저장" 버튼 + 저장 완료 피드백                      | 문제 삭제 (단계 2)            |
| 중복 저장 방지 (한 번 저장하면 버튼 비활성화)              | 성취기준 연결 (단계 2 F002)     |
| 저장된 문제 목록 DataTable (필터 + 페이지네이션)        | 검수 승인/반려 (단계 2 F004)    |
| 저장된 문제 상세 Sheet (내용/정답/해설)               | 수동 문제 생성 (단계 2)         |
| 사이드바 메뉴 "문제 관리" 추가                       | 문제 통계/분석                |

---

## 타입 매핑 분석

### AI 타입 → DB 컬럼 매핑

AI가 생성하는 `GeneratedQuestion`의 필드와 `questions` 테이블 컬럼은 1:1로 대응되지 않는다. 아래 표가 전체 매핑을 보여준다.

```
AI에서 온 데이터 (GeneratedQuestion)          DB에 넣을 데이터 (questions 테이블)
─────────────────────────────────            ────────────────────────────────
content: "이차방정식..."                  →   content: "이차방정식..."        (그대로)
type: 'essay'                            →   type: 'descriptive'             (변환 필요!)
difficulty: 'medium'                     →   difficulty: 3                   (변환 필요!)
answer: "x = -1"                         →   answer: "x = -1"               (그대로)
explanation: "풀이..."                    →   explanation: "풀이..."          (그대로)
options: ['1','2','3','4','5']            →   options: ["1","2","3","4","5"]  (JSONB로 자동)

(AI에 없는 필드 — Server Action에서 채워야 함)
                                         →   academy_id: 사용자의 학원 ID
                                         →   created_by: 현재 사용자 ID
                                         →   subject: 기출문제의 과목
                                         →   grade: 기출문제의 학년
                                         →   is_ai_generated: true
                                         →   ai_review_status: 'pending'
                                         →   ai_model: 'gemini'
                                         →   source_type: 'ai_generated'
                                         →   source_metadata: { pastExamId, schoolId, schoolName, year, semester, examType }
```
> **`ai_model` 필드 설명**
> MVP에서는 단일 모델명(`'gemini'`)을 문자열로 저장한다.
> 향후 여러 AI가 협업하는 구조(예: Gemini가 초안 → Claude가 검수)에서는
> 단일 모델명 대신 **pipeline ID**(예: `'gemini-claude-review-v1'`)로 확장할 수 있다.
> 이 확장은 `ai_model` 컬럼의 문자열 값만 바꾸면 되므로 스키마 변경 불필요.
> → ROADMAP 향후 과제로 등록: "AI 파이프라인 ID 체계 설계"

> **왜 school_id FK가 아닌 source_metadata인가?**
> `questions`는 범용 문제 뱅크(AI 생성 + 교사 자작 + 교재 추출)이므로 school_id가 항상 존재하지는 않는다.
> AI 생성 문제는 항상 기출 기반이므로 source_metadata에 학교 정보를 포함한다.
>
> **향후 과제**: 학교 기출이 부족한 경우의 AI 소스 우선순위 전략
> 1순위: 해당 학교 기출 (학교의 출제 문화/스타일)
> 2순위: 같은 지역/유사 학교 기출
> 3순위: 학원 교사 자작 문제 참고
> ※ 학교 시험은 여러 선생님이 협의하여 출제하므로, 출제 스타일의 주체는 "선생님 개인"이 아니라 "학교(학과)"임

### 변환이 필요한 2개 필드 설명

**1. type 변환 — 왜 필요한가?**

AI 프롬프트에서는 '서술형'을 `essay`라고 부르지만, DB에서는 `descriptive`라고 저장한다. 이유는:
- AI 세계에서 `essay`가 더 보편적인 용어 (영어 프롬프트에서 자주 씀)
- DB는 한국 교육과정 용어를 따름 (`descriptive` = 서술형)
- 이미 `toDbQuestionType()` 함수가 존재 (0-5에서 구현)

```typescript
// src/lib/ai/types.ts 에 이미 있는 함수
// AI에서 오는 'essay' → DB에 넣을 'descriptive' 로 바꿔줌
function toDbQuestionType(type: QuestionType): DbQuestionType {
  // 내부적으로 이 맵을 사용:
  // { multiple_choice → multiple_choice, short_answer → short_answer, essay → descriptive }
  return AI_TO_DB_MAP[type]
}
```

**2. difficulty 변환 — 왜 필요한가?**

AI는 난이도를 글자(`'easy'`, `'medium'`, `'hard'`)로 주지만, DB는 숫자(1~5)로 저장한다.

```
AI 난이도 (문자열)     DB 난이도 (숫자 1~5)
─────────────         ──────────────────
'easy'           →    2   (매우 쉬움=1은 사용하지 않음)
'medium'         →    3   (가운데 값)
'hard'           →    4   (매우 어려움=5는 사용하지 않음)
```

왜 1,3,5가 아니라 2,3,4인가?
- 나중에 'very_easy'(1)와 'very_hard'(5)를 추가할 여지를 남김
- 현재 MVP에서는 AI가 3단계만 생성하므로 중간값 사용

```typescript
// 새로 만들 함수 (Step 1에서 구현)
const DIFFICULTY_TO_NUMBER = {
  easy: 2,     // 쉬움
  medium: 3,   // 보통
  hard: 4,     // 어려움
} as const

function toDifficultyNumber(difficulty: 'easy' | 'medium' | 'hard'): number {
  return DIFFICULTY_TO_NUMBER[difficulty]
}
```
> **왜 DB가 아닌 코드에서 관리하는가?**
> | 기준 | 코드 관리 (TypeScript const) | DB 관리 (lookup table) |
> |------|---------------------------|----------------------|
> | 타입 안전성 | 컴파일 타임 체크 | 런타임에서만 확인 |
> | 변경 절차 | 코드 수정 → 배포 | DB UPDATE (배포 불필요) |
> | 성능 | 추가 쿼리 없음 | 매번 DB 조회 필요 |
> | 적합한 경우 | 값이 적고 변경 드묾 (현재) | 관리자가 UI에서 수정 필요 (향후) |
>
> 현재 type 3개, difficulty 3개로 값이 극히 적고 변경 빈도가 낮다.
> **전환 시점**: 관리자가 새 타입을 UI에서 추가해야 할 때 DB 관리로 전환 (YAGNI 원칙).

---

## Step 1: 타입 매핑 유틸 + 저장 Zod 스키마 (TDD)

### 개요

AI 생성 결과(`GeneratedQuestion`)를 DB `questions` 테이블에 맞게 변환하는 유틸리티 함수와, 저장 요청 검증용 Zod 스키마를 구현한다.

### 왜 이것부터 하는가?

DB에 저장하려면 먼저 "AI 데이터를 어떤 형태로 변환해서 넣을 것인가"가 정해져야 한다. 이 변환 로직이 Step 2(Server Action)와 Step 3(UI)의 기반이 된다.

### 수정 파일

**1. `src/lib/ai/types.ts`** — difficulty 매핑 함수 추가 (~15줄)

기존에 `toDbQuestionType` 함수(AI type → DB type 변환)가 있다. 같은 파일에 `toDifficultyNumber`를 추가한다. 이유: 둘 다 "AI 타입 → DB 타입 변환"이라는 **같은 관심사**에 속하기 때문이다.

```typescript
// ─── 난이도 매핑 (1-8 추가) ──────────────────────────────

/** AI 난이도 문자열 타입 */
export type DifficultyLevel = 'easy' | 'medium' | 'hard'

/**
 * Record 기반 매핑 — 새 난이도 추가 시 TypeScript가 컴파일 에러로 알려줌
 * (예: 'very_hard'를 DifficultyLevel에 추가하면 여기서 에러 발생)
 *
 * as const satisfies Record<...> 패턴:
 *   - as const: 값을 리터럴 타입(2, 3, 4)으로 고정
 *   - satisfies: Record의 모든 키가 빠짐없이 있는지 컴파일 타임 검증
 */
const DIFFICULTY_TO_NUMBER = {
  easy: 2,     // 쉬움 (1은 'very_easy' 확장용 예비)
  medium: 3,   // 보통
  hard: 4,     // 어려움 (5는 'very_hard' 확장용 예비)
} as const satisfies Record<DifficultyLevel, number>

const NUMBER_TO_DIFFICULTY: Record<number, DifficultyLevel> = {
  2: 'easy',
  3: 'medium',
  4: 'hard',
}

/** AI 난이도 → DB 난이도(숫자) 변환 */
export function toDifficultyNumber(difficulty: DifficultyLevel): number {
  return DIFFICULTY_TO_NUMBER[difficulty]
}

/** DB 난이도(숫자) → AI 난이도 변환 (조회 시 사용) */
export function fromDifficultyNumber(num: number): DifficultyLevel {
  return NUMBER_TO_DIFFICULTY[num] ?? 'medium'
  // ?? 'medium': 매핑에 없는 숫자(1, 5 등)가 오면 기본값 'medium' 반환
  // DB에서 직접 수정된 경우를 방어
}
```

**2. `src/lib/ai/index.ts`** — 새 함수/타입 export 추가 (~3줄)

```typescript
export type {
  // ... 기존 export
  DifficultyLevel,     // 1-8 추가
} from './types'

export {
  // 기존 있는 export에 추가
  toDifficultyNumber,   // 1-8 추가
  fromDifficultyNumber, // 1-8 추가
} from './types'
```

### 새로 생성

**3. `src/lib/validations/save-questions.ts`** — 저장 요청 Zod 스키마 (~60줄)

왜 새 파일인가? `generate-questions.ts`는 "AI 생성 요청" 검증이고, 이 파일은 "DB 저장 요청" 검증이다. 관심사가 다르므로 분리한다.

```typescript
/**
 * 생성된 문제 저장 요청 검증
 *
 * 클라이언트에서 보내는 데이터 형태:
 * {
 *   pastExamId: "uuid",          // 어떤 기출에서 생성했는지
 *   questions: [                  // AI가 생성한 문제 배열
 *     { content, type, difficulty, answer, explanation, options }
 *   ]
 * }
 *
 * 이 스키마는 Server Action에서 입력값을 검증한다.
 * 악의적인 필드(academy_id 조작 등)는 .strip()으로 자동 제거된다.
 */

import { z } from 'zod'

/** 저장할 문제 1개의 스키마 */
export const questionToSaveSchema = z.object({
  // content: 문제 내용 (빈 문자열 방지)
  content: z.string().min(1, '문제 내용이 비어있습니다.'),

  // type: AI가 보내는 문제 유형 ('essay' 포함)
  // DB 변환(essay→descriptive)은 Server Action에서 수행
  type: z.enum(['multiple_choice', 'short_answer', 'essay'], {
    message: '유효하지 않은 문제 유형입니다.',
  }),

  // difficulty: 문자열 난이도 → Server Action에서 숫자 변환
  difficulty: z.enum(['easy', 'medium', 'hard'], {
    message: '유효하지 않은 난이도입니다.',
  }),

  // answer: 정답 (빈 문자열 방지)
  answer: z.string().min(1, '정답이 비어있습니다.'),

  // explanation: 해설 (없을 수도 있음)
  explanation: z.string().optional(),

  // options: 객관식 보기 (없을 수도 있음, 있으면 문자열 배열)
  options: z.array(z.string()).optional(),
})

/** 전체 저장 요청 스키마 */
export const saveQuestionsRequestSchema = z.object({
  // pastExamId: 기출문제 ID (출처 추적용)
  pastExamId: z.string().uuid('기출문제 ID가 유효하지 않습니다.'),

  // questions: 최소 1개, 최대 10개
  questions: z
    .array(questionToSaveSchema)
    .min(1, '저장할 문제가 없습니다.')
    .max(10, '한 번에 최대 10개까지 저장할 수 있습니다.'),
})

export type SaveQuestionsRequest = z.infer<typeof saveQuestionsRequestSchema>
export type QuestionToSave = z.infer<typeof questionToSaveSchema>
```

> **questions 테이블 PK/FK 구조 참고**
> ```
> questions 테이블:
> ├── id         UUID PK (gen_random_uuid() 자동 생성 → Server Action에서 넣지 않음)
> ├── academy_id UUID FK → academies (Server Action에서 profile.academy_id로 채움)
> ├── created_by UUID FK → profiles (Server Action에서 현재 사용자 ID로 채움)
> ├── grade      INTEGER (1~12, CHECK 제약) — FK 아님, 직접값
> ├── subject    TEXT — FK 아님, 직접값
> └── ...나머지 컬럼
> ```
> grade와 subject가 FK가 아닌 이유: grades/subjects 별도 테이블이 없음 (MVP 설계).
> 학원별로 관리하는 학교/학년/과목이 다양하므로, 범용 정수/문자열로 저장.

### TDD 테스트

**4. `src/lib/ai/__tests__/types-difficulty.test.ts`** — 난이도 매핑 테스트 (~8개)

왜 별도 파일인가? 기존 `types.test.ts`에 추가해도 되지만, `types.test.ts`가 이미 11개 테스트로 하나의 관심사(PastExamContext 호환성)를 다루고 있다. difficulty 매핑은 별도 관심사이므로 분리한다.

```
describe('toDifficultyNumber')
  1. 'easy' → 2
  2. 'medium' → 3
  3. 'hard' → 4

describe('fromDifficultyNumber')
  4. 2 → 'easy'
  5. 3 → 'medium'
  6. 4 → 'hard'
  7. 매핑에 없는 숫자(1) → 'medium' (기본값)
  8. 매핑에 없는 숫자(5) → 'medium' (기본값)
```

**5. `src/lib/validations/__tests__/save-questions.test.ts`** — 저장 스키마 테스트 (~15개)

```
describe('questionToSaveSchema')
  1. 모든 필수 필드가 있는 유효한 문제 → 통과
  2. content 빈 문자열 → 거부
  3. answer 빈 문자열 → 거부
  4. type 유효하지 않은 값 ('quiz') → 거부
  5. difficulty 유효하지 않은 값 ('extreme') → 거부
  6. explanation 없어도 → 통과
  7. options 없어도 → 통과
  8. 스키마에 없는 필드(academy_id 등) → strip 제거

describe('saveQuestionsRequestSchema')
  9.  유효한 pastExamId + 문제 1개 → 통과
  10. 유효하지 않은 pastExamId → 거부
  11. 빈 questions 배열 → 거부
  12. 11개 문제 → 거부 (최대 10)
  13. questions가 배열이 아님 → 거부
  14. 복합: pastExamId + 문제 3개 (객관식/단답/서술형 혼합) → 통과

describe('타입 export')
  15. SaveQuestionsRequest 타입이 스키마와 일치 (컴파일 타임 체크용)
```
> **`saveQuestionsRequestSchema` 구조 설명**
> 이 스키마는 클라이언트가 Server Action에 보내는 요청의 형태를 정의한다:
> - `pastExamId` (UUID): 어떤 기출문제를 기반으로 생성했는지 — 서버에서 기출의 subject/grade/school 정보를 재조회하는 키
> - `questions` (배열, 1~10개): AI가 생성한 문제 목록. 각 문제는 `{ content, type, difficulty, answer, explanation?, options? }` 구조
>
> 클라이언트는 AI 타입(`'essay'`, `'medium'`)을 그대로 보내고, DB 타입 변환(`'descriptive'`, `3`)은 서버 책임이다.
> 이렇게 분리하면 클라이언트가 DB 스키마를 알 필요가 없고, 변환 로직이 서버 한 곳에만 존재한다.

### 설계 결정 근거

| 결정                                   | 근거                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `toDifficultyNumber`를 `types.ts`에 배치 | 기존 `toDbQuestionType`과 동일 관심사(AI↔DB 변환). 같은 파일에 모아두면 변환 함수를 한 곳에서 관리          |
| difficulty 매핑 2/3/4 (1과 5 건너뜀)       | 확장성: 나중에 5단계 난이도로 확장 시 1과 5를 사용. 현재 3단계에서 중간값 배치                              |
| `fromDifficultyNumber` 역방향 변환 추가     | Step 4 목록 조회 시 DB 숫자를 UI 문자열로 표시해야 함                                          |
| 저장 스키마를 별도 파일로 분리                    | `generate-questions.ts`는 "AI 생성 요청", `save-questions.ts`는 "DB 저장 요청" — 관심사 분리 |
| 저장 스키마에서 type을 AI 타입('essay')으로 받음   | 클라이언트는 AI 결과를 그대로 전송. DB 변환(essay→descriptive)은 서버 책임                         |
| `.strip()` 대신 `z.object` 기본 동작 활용    | Zod v3의 `.object()`는 기본적으로 알려지지 않은 키를 strip. 별도 호출 불필요                        |
|                                      |                                                                               |
> **`strip()` / Zod unknown key 자동 제거 설명**
> Zod v3의 `z.object()`는 기본적으로 **알려지지 않은 키를 자동 제거(strip)** 한다.
> 예: 스키마에 `{ name, age }`만 정의했는데 입력에 `{ name, age, isAdmin: true }`가 오면,
> Zod 파싱 결과는 `{ name, age }`만 남고 `isAdmin`은 제거된다.
> 이것이 보안에 중요한 이유: 악의적 사용자가 `isAdmin`, `role`, `academy_id` 같은 필드를 추가 전송해도
> 서버에서 자동으로 무시되므로 **필드 인젝션(IDOR 변종)** 을 방지할 수 있다.
> 별도로 `.strip()`을 호출할 필요 없이 `z.object()` 기본 동작으로 충분하다.

### 리스크

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| `types.ts` 수정 시 기존 테스트 영향 | **낮음** | 새 함수 추가만. 기존 코드 무변경 |
| difficulty 1, 5를 DB에서 직접 입력한 경우 | **낮음** | `fromDifficultyNumber`에서 기본값 'medium' 반환 |

### 파일 변경 요약

| 작업 | 파일 | 변경 |
|------|------|------|
| 수정 | `src/lib/ai/types.ts` | toDifficultyNumber, fromDifficultyNumber, DifficultyLevel (~25줄) |
| 수정 | `src/lib/ai/index.ts` | export 추가 (~3줄) |
| 신규 | `src/lib/validations/save-questions.ts` | Zod 스키마 (~60줄) |
| 신규 | `src/lib/ai/__tests__/types-difficulty.test.ts` | 난이도 테스트 ~8개 (~60줄) |
| 신규 | `src/lib/validations/__tests__/save-questions.test.ts` | 스키마 테스트 ~15개 (~150줄) |

### 성공 기준

- [ ] `npx vitest run src/lib/ai/__tests__/types-difficulty.test.ts` — 8개 전체 PASS
- [ ] `npx vitest run src/lib/validations/__tests__/save-questions.test.ts` — 15개 전체 PASS
- [ ] `npx vitest run src/lib/ai/__tests__/types.test.ts` — 기존 11개 회귀 없음
- [ ] `toDifficultyNumber('medium')` === 3 확인
- [ ] `fromDifficultyNumber(4)` === 'hard' 확인
<!-- 1,5는 테스트 안해도 되나? -->

---

## Step 2: 저장 Server Action — saveGeneratedQuestions (TDD)

### 개요

AI가 생성한 문제 배열을 `questions` 테이블에 Bulk INSERT하는 Server Action을 구현한다. 클라이언트에서 `pastExamId` + `GeneratedQuestion[]`을 보내면, 서버에서 인증 확인 → Zod 검증 → 타입 변환 → DB INSERT를 수행한다.

### 왜 Bulk INSERT인가?

AI가 한 번에 1~10개의 문제를 생성한다. 이걸 하나씩 INSERT하면 DB 왕복이 10번이지만, Bulk INSERT(`.insert([배열])`)하면 1번이다. 네트워크 비용과 트랜잭션 일관성을 위해 한 번에 넣는다.

```
개별 INSERT (느림):                    Bulk INSERT (빠름):
──────────────────                    ─────────────────
INSERT 문제1 → DB 왕복 1              INSERT [문제1, 문제2, ..., 문제10]
INSERT 문제2 → DB 왕복 2                 → DB 왕복 1번으로 끝
...
INSERT 문제10 → DB 왕복 10
```

### 새로 생성

**1. `src/lib/actions/save-questions.ts`** — Server Action (~150줄)
> **왜 저장 시 기출을 다시 조회하는가?**
> AI 문제 생성(1-7)과 저장(1-8)은 별개의 Server Action이다. 생성 시 이미 기출 정보를 조회했지만,
> 저장 시 다시 조회하는 이유 3가지:
> 1. **보안 재검증** — 클라이언트가 보내는 `pastExamId`가 실제 존재하고 사용자의 학원 소속인지 서버에서 재확인. 클라이언트에서 오는 데이터는 항상 의심 (Defense in Depth)
> 2. **데이터 무결성** — 생성과 저장 사이에 기출이 삭제/수정될 수 있음. 최신 데이터로 `source_metadata`를 채움
> 3. **최소 전송 원칙** — 클라이언트는 `pastExamId`만 보내고, subject/grade/school 정보는 서버가 DB에서 직접 가져옴. 클라이언트가 보낸 subject/grade를 신뢰하면 조작 가능

> **왜 `source_metadata`에 `schoolName`을 저장하는가? (비정규화 스냅샷)**
> 학교 이름은 `schools` 테이블에 이미 있지만, `source_metadata`에 중복 저장하는 이유:
> - **시점 기록(스냅샷)**: 문제 생성 당시의 학교명을 보존. 나중에 학교명이 변경되어도 "이 문제는 OO고 기출 기반"이라는 기록은 유지
> - **JOIN 불필요**: 문제 상세 조회 시 `source_metadata.schoolName`을 바로 표시. `questions → past_exams → schools` 3단 JOIN 불필요
> - **비정규화 트레이드오프**: 학교명이 바뀌면 이미 저장된 `source_metadata`는 옛날 이름을 유지. 이것은 의도된 동작 (생성 시점의 기록)

```typescript
'use server'

/**
 * 생성된 문제 저장 Server Action
 *
 * 전체 흐름:
 * ┌──────────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐
 * │ 인증 확인 │ → │ Zod 검증 │ → │ 기출 조회  │ → │ 타입 변환 │ → │ DB 저장  │
 * └──────────┘    └──────────┘    └───────────┘    └──────────┘    └──────────┘
 *
 * 인증: checkTeacherOrAdmin() — 교사/관리자만 저장 가능
 * 검증: saveQuestionsRequestSchema — 입력값 형태 확인
 * 기출 조회: pastExamId로 subject, grade 등 메타데이터 가져옴
 * 타입 변환: AI 타입 → DB 타입 (type, difficulty)
 * DB 저장: Supabase .insert([배열]) — Bulk INSERT
 */

import { createClient } from '@/lib/supabase/server'
import { saveQuestionsRequestSchema } from '@/lib/validations/save-questions'
import type { QuestionToSave } from '@/lib/validations/save-questions'
import { toDbQuestionType, toDifficultyNumber } from '@/lib/ai'

// ─── 반환 타입 ──────────────────────────────────────────

export interface SaveQuestionsResult {
  readonly error?: string
  readonly data?: {
    readonly savedCount: number   // 실제 저장된 문제 수
    readonly questionIds: readonly string[]  // 저장된 문제 ID 배열
  }
}

// ─── 내부 타입 ──────────────────────────────────────────

interface AuthorizedUser {
  readonly id: string
  readonly role: string
  readonly academyId: string
}

interface AuthCheckResult {
  readonly error?: string
  readonly user?: AuthorizedUser
}

// ─── 헬퍼: 인증 + 권한 확인 ────────────────────────────
// (generate-questions.ts와 동일 패턴 — 3회 반복 미달이므로 아직 추출하지 않음)

async function checkTeacherOrAdmin(): Promise<AuthCheckResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: '인증이 필요합니다.' }
  }

  const { data: profile, error: profileError } = (await supabase
    .from('profiles')
    .select('id, role, academy_id')
    .eq('id', user.id)
    .single()) as {
    data: { id: string; role: string; academy_id: string | null } | null
    error: unknown
  }

  if (profileError || !profile) {
    return { error: '프로필을 찾을 수 없습니다.' }
  }

  if (!profile.academy_id) {
    return { error: '소속 학원이 없습니다.' }
  }

  if (!['teacher', 'admin', 'system_admin'].includes(profile.role)) {
    return { error: '문제 저장 권한이 없습니다. 교사 또는 관리자만 사용할 수 있습니다.' }
  }

  return {
    user: {
      id: profile.id,
      role: profile.role,
      academyId: profile.academy_id,
    },
  }
}

// ─── 변환 함수 ──────────────────────────────────────────

/**
 * AI 생성 문제 1개 → DB INSERT용 객체로 변환
 *
 * 여기서 일어나는 변환:
 * 1. type: 'essay' → 'descriptive' (toDbQuestionType)
 * 2. difficulty: 'medium' → 3 (toDifficultyNumber)
 * 3. options: string[] → JSONB (Supabase가 자동 처리)
 * 4. 메타데이터 필드 추가 (academy_id, created_by, is_ai_generated 등)
 */
function toQuestionInsertRow(
  question: QuestionToSave,
  meta: {
    readonly academyId: string
    readonly userId: string
    readonly subject: string
    readonly grade: number
    readonly pastExamId: string
    readonly schoolId: string
    readonly schoolName: string
    readonly year: number
    readonly semester: number
    readonly examType: string
  },
) {
  return {
    // === DB 필수 필드 ===
    academy_id: meta.academyId,
    created_by: meta.userId,
    content: question.content,
    type: toDbQuestionType(question.type as 'multiple_choice' | 'short_answer' | 'essay'),
    answer: question.answer,
    subject: meta.subject,
    grade: meta.grade,

    // === 변환이 필요한 필드 ===
    difficulty: toDifficultyNumber(question.difficulty as 'easy' | 'medium' | 'hard'),

    // === 선택 필드 ===
    explanation: question.explanation ?? null,
    options: question.options ?? null,  // Supabase가 JSONB로 자동 변환

    // === AI 관련 메타데이터 ===
    is_ai_generated: true,
    ai_review_status: 'pending',  // 교사 검수 대기 상태
    ai_model: 'gemini',
    source_type: 'ai_generated',
    source_metadata: {
      pastExamId: meta.pastExamId,
      schoolId: meta.schoolId,
      schoolName: meta.schoolName,
      year: meta.year,
      semester: meta.semester,
      examType: meta.examType,
      generatedAt: new Date().toISOString(),
    },

    // === 기본값 (DB default 활용) ===
    // id: gen_random_uuid() — DB가 자동 생성
    // points: 1 — DB default
    // created_at: now() — DB default
    // updated_at: now() — DB default
  }
}

// ─── Server Action ──────────────────────────────────────

export async function saveGeneratedQuestions(
  rawInput: Record<string, unknown>,
): Promise<SaveQuestionsResult> {
  // 1. 인증 + 권한
  const { error: authError, user } = await checkTeacherOrAdmin()
  if (authError || !user) {
    return { error: authError }
  }

  // 2. 입력값 검증
  const parsed = saveQuestionsRequestSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }
  }

  const { pastExamId, questions } = parsed.data

  // 3. 기출문제 메타데이터 조회 (subject, grade, 학교 정보 가져오기)
  const supabase = await createClient()
  const { data: pastExam, error: dbError } = (await supabase
    .from('past_exam_questions')
    .select('id, subject, grade, year, semester, exam_type, school_id, schools!inner ( name )')
    .eq('id', pastExamId)
    .single()) as {
    data: {
      id: string
      subject: string
      grade: number
      year: number
      semester: number
      exam_type: string
      school_id: string
      schools: { name: string }
    } | null
    error: unknown
  }

  if (dbError || !pastExam) {
    return { error: '기출문제를 찾을 수 없습니다.' }
  }

  // 4. AI 타입 → DB 타입 변환 (Bulk INSERT용 배열 생성)
  const insertRows = questions.map((q) =>
    toQuestionInsertRow(q, {
      academyId: user.academyId,
      userId: user.id,
      subject: pastExam.subject,
      grade: pastExam.grade,
      pastExamId,
      schoolId: pastExam.school_id,
      schoolName: pastExam.schools.name,
      year: pastExam.year,
      semester: pastExam.semester,
      examType: pastExam.exam_type,
    }),
  )

  // 5. Bulk INSERT
  try {
    const { data: inserted, error: insertError } = await supabase
      .from('questions')
      .insert(insertRows)
      .select('id')

    if (insertError || !inserted) {
      return { error: '문제 저장에 실패했습니다. 다시 시도해주세요.' }
    }

    return {
      data: {
        savedCount: inserted.length,
        questionIds: (inserted as { id: string }[]).map((row) => row.id),
      },
    }
  } catch {
    return { error: '문제 저장 중 오류가 발생했습니다.' }
  }
}
```

### TDD 테스트

**2. `src/lib/actions/__tests__/save-questions.test.ts`** (~20개)

Mock 전략: `generate-questions.test.ts`와 동일 패턴 (Supabase from() 테이블 분기)

```
describe('saveGeneratedQuestions')

  describe('인증 + 권한')
    1. 비인증 사용자 → 에러 '인증이 필요합니다.'
    2. 프로필 없음 → 에러 '프로필을 찾을 수 없습니다.'
    3. academy_id 없음 → 에러 '소속 학원이 없습니다.'
    4. student 역할 → 에러 '문제 저장 권한이 없습니다.'
    5. teacher 역할 → 인증 통과
    6. admin 역할 → 인증 통과

  describe('입력값 검증')
    7. 유효하지 않은 pastExamId → 에러
    8. 빈 questions 배열 → 에러
    9. 11개 문제 → 에러 (최대 10개)
    10. content 빈 문자열 → 에러

  describe('기출문제 조회')
    11. 존재하지 않는 pastExamId → 에러 '기출문제를 찾을 수 없습니다.'

  describe('타입 변환 검증')
    12. type 'essay' → DB에 'descriptive'로 저장 확인
    13. difficulty 'medium' → DB에 3으로 저장 확인
    14. is_ai_generated: true 확인
    15. source_metadata에 pastExamId, schoolId, schoolName, year, semester, examType 포함 확인
    16. academy_id가 사용자의 학원 ID와 일치 확인

  describe('DB 저장 성공')
    17. 유효 입력 → savedCount와 questionIds 반환
    18. 3개 문제 → savedCount === 3 확인

  describe('부분 선택 저장')
    19. 10개 중 3번째만 선택 → savedCount === 1 확인
    20. 10개 중 1,4,7번째 선택 → savedCount === 3, 선택된 문제만 DB 전달 확인
    21. 1개만 선택 → 최소 선택 정상 동작 확인

  describe('DB 저장 실패')
    22. insert 에러 → '문제 저장에 실패했습니다.'
    23. 예외 발생 → '문제 저장 중 오류가 발생했습니다.'
```

### 설계 결정 근거

| 결정 | 근거 |
|------|------|
| `checkTeacherOrAdmin` 복사 (추출 안 함) | generate-questions.ts와 합쳐도 2회. 3회 반복 시 공통 모듈로 추출 예정 |
| 기출문제 조회로 subject/grade 가져옴 | 클라이언트에서 subject/grade를 보내면 조작 가능. 서버에서 DB 조회가 안전 (Defense in Depth) |
| `toQuestionInsertRow` 분리 | 변환 로직이 복잡(7+ 필드). 함수로 분리하면 테스트하기 쉽고 읽기 좋음 |
| `source_metadata`에 pastExamId + 학교 정보 저장 | 나중에 "이 문제가 어떤 기출에서 생성되었는가" + 학교 출제 스타일 추적 가능 |
| `ai_review_status: 'pending'` | MVP에서는 검수 UI 없지만, 나중에 F004(검수 시스템)에서 바로 활용 가능 |

### 리스크

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| Bulk INSERT 일부 실패 시 전체 롤백 | **낮음** | Supabase `.insert()` 기본 동작이 전체 성공 또는 전체 실패 (트랜잭션) |
| RLS가 INSERT를 차단할 수 있음 | **중간** | RLS 정책 이미 존재: `academy_id = get_user_academy_id() AND 교사/관리자` |
| 동일 문제 중복 저장 | **중간** | UI에서 `savedIndices`로 이미 저장된 문제는 체크박스 비활성화. DB 레벨 유니크 제약은 없음 — 같은 내용이라도 다른 시점에 생성된 별개 문제일 수 있으므로. MVP에서는 사용자가 눈으로 확인. 향후 embedding 기반 유사도 검사(ROADMAP 향후 과제) |
| Bulk INSERT 실패 시 데이터 일관성 | **낮음** | Supabase `.insert([배열])` = PostgreSQL 트랜잭션. **All or Nothing** — 10개 중 1개라도 실패하면 전체 롤백. 부분 저장 없음. 실패 시 React state의 `savedIndices`는 변경되지 않으므로(불변) 사용자가 동일 선택으로 재시도 가능. toast.error로 알림 |

### 파일 변경 요약

| 작업 | 파일 | 변경 |
|------|------|------|
| 신규 | `src/lib/actions/save-questions.ts` | Server Action (~150줄) |
| 신규 | `src/lib/actions/__tests__/save-questions.test.ts` | 테스트 ~23개 (~400줄) |

### 성공 기준

- [ ] `npx vitest run src/lib/actions/__tests__/save-questions.test.ts` — 23개 전체 PASS
- [ ] 교사/관리자만 저장 가능 확인 (테스트 1~6)
- [ ] type/difficulty 변환 정확성 확인 (테스트 12~13)
- [ ] Bulk INSERT로 여러 문제 한 번에 저장 확인 (테스트 17~18)
- [ ] 부분 선택 저장 정확성 확인 (테스트 19~21)
- [ ] source_metadata에 pastExamId 포함 확인 (테스트 15)

---

## Step 3: UI — 저장 버튼 + 개별 선택 저장

### 개요

생성된 문제 결과 화면에 **개별 선택 체크박스**와 "선택 저장" 버튼을 추가한다. 교사가 품질을 확인하고 원하는 문제만 골라서 저장할 수 있다.

### 현재 UI 상태 (1-7 완료 시점)

```
┌─── GenerateQuestionsDialog ──────────────────┐
│  AI 문제 생성                                 │
│                                               │
│  [생성 완료 시]                                │
│  생성된 문제 3개         [다시 생성] 버튼       │
│                                               │
│  ┌─ QuestionCard 1 ─┐                        │
│  │ 문제 1  객관식  보통                        │
│  │ 내용...                                    │
│  │ 정답 / 해설                                │
│  └──────────────────┘                        │
│  ┌─ QuestionCard 2 ─┐                        │
│  │ ...                                       │
│  └──────────────────┘                        │
│                                               │
│                              [닫기] 버튼       │
└───────────────────────────────────────────────┘
```

### 변경 후 UI

```
┌─── GenerateQuestionsDialog ──────────────────┐
│  AI 문제 생성                                 │
│                                               │
│  [생성 완료 시]                                │
│  생성된 문제 3개  [전체 선택] [선택 저장(2)]    │  ← 선택된 개수 표시
│                                               │
│  ☑ ┌─ QuestionCard 1 ─┐                      │  ← 체크박스
│    │ 내용...                                  │
│    └──────────────────┘                       │
│  ☑ ┌─ QuestionCard 2 ─┐                      │
│    │ ...                                      │
│    └──────────────────┘                       │
│  ☐ ┌─ QuestionCard 3 ─┐                      │  ← 미선택
│    │ ...                                      │
│    └──────────────────┘                       │
│                                               │
│  [저장 완료 시]                                │
│  ✅ 2개 문제가 저장되었습니다.                  │
│  저장된 문제 2개  [저장됨 ✓]  [다시 생성]      │
│                              [닫기] 버튼       │
└───────────────────────────────────────────────┘
```

### 수정 파일

**1. `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx`** — 저장 기능 추가 (~40줄 추가)

변경 요약:
- `savedIndices` 상태 추가 (`Set<number>`): 이미 저장된 문제의 인덱스 추적 (부분 저장 지원)
- `isSaving` 로딩 상태 (useTransition 별도 인스턴스 또는 별도 state)
- `selectedIndices` 상태 추가 (`Set<number>`): 현재 선택된(저장할) 문제 인덱스
- 초기값: 전체 선택 (생성된 모든 문제 인덱스)
- "전체 선택/해제" 토글 버튼 추가 — 이미 저장된 문제는 토글 대상에서 제외
- "선택 저장(N)" 버튼 추가 — N=0이면 비활성화, 전체 저장 완료 시에도 비활성화
- 각 QuestionCard에 체크박스 래핑 — 저장 완료된 문제는 ✅ 표시 + 체크박스 비활성화
- `handleSave` 핸들러: 선택된 문제만 필터링 → `saveGeneratedQuestions` Server Action 호출
- **저장 성공 시**: `savedIndices`에 선택된 인덱스 추가 (불변: `new Set([...prev, ...selected])`), 선택 초기화 → 미저장 문제만 다시 선택 가능, toast 알림
- **저장 실패 시**: `savedIndices` 변경 없음 (불변 유지), `selectedIndices`도 그대로 → 동일 선택으로 재시도 가능, toast.error로 알림
- "다시 생성" 클릭 시: `savedIndices` 초기화 (`new Set()`), `selectedIndices` 리셋
- **부분 저장 시나리오**: 10개 생성 → 3개 선택 저장(성공) → savedIndices={0,1,2} → 나머지 7개 중 2개 선택 → 추가 저장 가능

```typescript
import { saveGeneratedQuestions } from '@/lib/actions/save-questions'

// 추가할 상태들
const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set())  // 이미 저장된 문제 인덱스
const [isSaving, setIsSaving] = useState(false)    // 저장 중인지
const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())  // 현재 선택된 인덱스

// 전체 저장 완료 여부 (파생 상태 — 별도 state 불필요)
const allSaved = savedIndices.size === generatedQuestions.length && generatedQuestions.length > 0
// 저장 가능한(미저장 + 선택된) 문제 수
const savableCount = [...selectedIndices].filter((i) => !savedIndices.has(i)).length

// 생성 완료 시 전체 선택 초기화
// → generatedQuestions가 업데이트되면 모든 인덱스를 selectedIndices에 추가
useEffect(() => {
  if (generatedQuestions.length > 0) {
    setSelectedIndices(new Set(generatedQuestions.map((_, i) => i)))
  }
}, [generatedQuestions])

// 왜 Set<number>인가?
// → 인덱스 기반 O(1) lookup. 체크박스 토글이 빈번하므로 성능 중요.
// → 불변성: toggle 시 new Set([...prev]) 생성

/** 선택된 문제 중 미저장 문제만 DB 저장 */
async function handleSave() {
  if (!generatedQuestions || !pastExamId) return

  // 선택된 인덱스 중 아직 저장되지 않은 것만 필터링
  const indicesToSave = [...selectedIndices].filter((i) => !savedIndices.has(i))
  if (indicesToSave.length === 0) return

  setIsSaving(true)
  try {
    const questionsToSave = indicesToSave.map((i) => generatedQuestions[i])
    const result = await saveGeneratedQuestions({
      pastExamId,
      questions: questionsToSave,
    })
    if (result.error) {
      // 실패 시: savedIndices 변경 없음 (불변 유지) → 재시도 가능
      toast.error(result.error)
    } else {
      // 성공 시: 저장된 인덱스를 savedIndices에 추가 (불변: 새 Set 생성)
      setSavedIndices((prev) => new Set([...prev, ...indicesToSave]))
      // 선택 초기화: 미저장 문제만 다시 선택 가능하도록
      setSelectedIndices((prev) => {
        const next = new Set(prev)
        indicesToSave.forEach((i) => next.delete(i))
        return next
      })
      toast.success(`${questionsToSave.length}개 문제가 저장되었습니다.`)
    }
  } catch {
    // 예외 시에도 savedIndices 변경 없음 → 재시도 가능
    toast.error('저장 중 오류가 발생했습니다.')
  } finally {
    setIsSaving(false)
  }
}

/** 개별 체크박스 토글 — 이미 저장된 문제는 토글 불가 */
function toggleQuestion(index: number) {
  if (savedIndices.has(index)) return  // 저장 완료된 문제는 무시
  setSelectedIndices((prev) => {
    const next = new Set(prev)
    if (next.has(index)) {
      next.delete(index)
    } else {
      next.add(index)
    }
    return next
  })
}

/** 전체 선택/해제 토글 — 저장되지 않은 문제만 대상 */
function toggleAll() {
  const unsavedIndices = generatedQuestions
    .map((_, i) => i)
    .filter((i) => !savedIndices.has(i))

  const allUnsavedSelected = unsavedIndices.every((i) => selectedIndices.has(i))
  if (allUnsavedSelected) {
    // 미저장 문제 전체 해제
    setSelectedIndices((prev) => {
      const next = new Set(prev)
      unsavedIndices.forEach((i) => next.delete(i))
      return next
    })
  } else {
    // 미저장 문제 전체 선택
    setSelectedIndices((prev) => new Set([...prev, ...unsavedIndices]))
  }
}

// "다시 생성" 시 모든 상태 리셋
function handleRetry() {
  setGeneratedQuestions([])
  setSavedIndices(new Set())    // 1-8 추가: 새로운 생성이므로 저장 상태 초기화
  setSelectedIndices(new Set())
}

// Dialog 닫힐 때도 리셋
function handleOpenChange(nextOpen: boolean) {
  if (!nextOpen) {
    // ... 기존 리셋
    setSavedIndices(new Set())  // 1-8 추가
    setSelectedIndices(new Set())
  }
  onOpenChange(nextOpen)
}
```

저장 버튼 JSX (결과 영역 내, "다시 생성" 왼쪽):

```tsx
{/* 저장 현황 + 전체 선택 + 선택 저장 버튼 */}
<div className="flex items-center justify-between">
  <span className="text-sm text-muted-foreground">
    생성된 문제 {generatedQuestions.length}개
    {savedIndices.size > 0 && ` (${savedIndices.size}개 저장됨)`}
  </span>
  <div className="flex gap-2">
    <Button variant="outline" size="sm" onClick={toggleAll} disabled={allSaved}>
      {/* 미저장 문제 기준으로 전체 선택/해제 */}
      전체 선택/해제
    </Button>
    <Button
      size="sm"
      onClick={handleSave}
      disabled={allSaved || isSaving || savableCount === 0}
    >
      {allSaved
        ? '전체 저장됨 ✓'
        : isSaving
          ? '저장 중...'
          : `선택 저장(${savableCount})`}
    </Button>
  </div>
</div>

{/* 체크박스 + 문제 카드 */}
{generatedQuestions.map((question, index) => (
  <div key={index} className="flex items-start gap-3">
    <Checkbox
      checked={savedIndices.has(index) || selectedIndices.has(index)}
      onCheckedChange={() => toggleQuestion(index)}
      disabled={savedIndices.has(index)}  {/* 저장 완료된 문제는 체크박스 비활성화 */}
      className="mt-4"
    />
    <div className={`flex-1 ${savedIndices.has(index) ? 'opacity-60' : ''}`}>
      <QuestionCard question={question} index={index} />
      {savedIndices.has(index) && (
        <span className="text-xs text-green-600 font-medium">저장됨 ✓</span>
      )}
    </div>
  </div>
))}
```

### 설계 결정 근거

| 결정 | 근거 |
|------|------|
| `savedIndices` Set\<number\> 상태 | boolean(isSaved)보다 정밀한 제어. 어떤 문제가 저장됐는지 개별 추적 → 부분 저장 + 추가 저장 지원 |
| `isSaving` 별도 state (useTransition 대신) | 생성 isPending과 독립적 관리. 두 액션이 동시에 발생하지 않도록 |
| `allSaved` / `savableCount` 파생 상태 | 별도 state가 아닌 `savedIndices`로부터 계산. 단일 진실 공급원(Single Source of Truth) |
| `readonly` 배열을 `[...spread]`로 변환 | Server Action은 직렬화 가능한 plain object만 전달 가능. readonly는 직렬화 시 문제 가능 |
| 저장된 문제에 "저장됨 ✓" + opacity 표시 | 비활성화만 하면 "왜 안 눌러지지?" 혼란. 명시적 시각 피드백 |
| "다시 생성" 시 savedIndices 초기화 | 새로운 결과가 나오면 당연히 저장 가능해야 함 |
| 실패 시 savedIndices 불변 | 트랜잭션 All or Nothing → 실패하면 아무것도 저장 안 됨 → savedIndices 변경 불필요 → 동일 선택 재시도 가능 |
| `selectedIndices` Set<number> | 인덱스 기반 O(1) lookup. 체크박스 토글이 빈번하므로 성능 중요 |
| 초기값 전체 선택 | 사용자가 직접 "제외"하는 UX가 더 자연스러움 (대부분의 경우 대부분 저장) |
| `selectedIndices.size === 0`이면 버튼 비활성화 | Zod `.min(1)` 제약과 일관성 — 최소 1개 필요 |

### 리스크

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| 저장 후 Dialog 닫고 다시 열면? | **낮음** | Dialog 닫을 때 모든 상태 리셋. 결과도 사라지므로 저장 버튼 없음 |
| 네트워크 실패로 저장 실패 | **낮음** | savedIndices 변경 없음 (불변) → 동일 선택 재시도 가능. toast.error로 사용자 알림 |
| 빠른 더블 클릭 | **낮음** | isSaving 중에는 disabled. 첫 클릭 즉시 isSaving=true |

### 파일 변경 요약

| 작업 | 파일 | 변경 |
|------|------|------|
| 수정 | `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` | 저장 버튼 + 개별 선택 + savedIndices 상태 (~100줄 추가) |

### 성공 기준

- [ ] 생성 결과가 있을 때 "저장" 버튼이 표시됨
- [ ] "저장" 클릭 시 saveGeneratedQuestions Server Action 호출
- [ ] 저장 성공 시 해당 문제에 "저장됨 ✓" 표시 + toast 성공 알림
- [ ] 저장된 문제 체크박스 비활성화 (중복 저장 방지)
- [ ] 부분 저장 후 미저장 문제 추가 저장 가능
- [ ] 전체 저장 완료 시 "전체 저장됨 ✓" 표시 + 저장 버튼 비활성화
- [ ] 저장 실패 시 savedIndices 불변 + 재시도 가능
- [ ] "다시 생성" 클릭 시 savedIndices + selectedIndices 초기화
- [ ] 저장 실패 시 toast.error + 재시도 가능
- [ ] 기존 생성 기능(폼 → 로딩 → 결과) 회귀 없음
- [ ] 개별 문제 체크박스 선택/해제 동작
- [ ] "전체 선택/해제" 토글 동작
- [ ] 선택된 문제만 저장 (미선택 문제는 저장 안 됨)
- [ ] 선택 0개일 때 "선택 저장" 버튼 비활성화

---

## Step 4: 문제 목록 조회 DataTable + 사이드바 메뉴

### 개요

저장된 문제를 조회하는 `/questions` 페이지를 구현한다. 1-6(기출문제 목록)의 DataTable 패턴을 **재활용**하여, 같은 구조(Server Component → DataTable → 서버사이드 페이지네이션)로 빠르게 만든다.

### 1-6 패턴과의 비교

```
1-6 기출문제 목록                          1-8 문제 목록
────────────────                          ─────────────
past-exams/page.tsx (Server Component)    questions/page.tsx (Server Component)
past-exams/_components/                   questions/_components/
  ├── constants.ts          재활용 →        ├── constants.ts
  ├── past-exam-columns.tsx 참고 →          ├── question-columns.tsx
  ├── past-exams-toolbar.tsx 참고 →         ├── questions-toolbar.tsx
  └── past-exam-detail-sheet.tsx           └── (Step 5에서 추가)

getPastExamList (Server Action)           getQuestionList (Server Action)
pastExamFilterSchema (Zod)                questionFilterSchema (Zod)
DataTable + DataTableServerPagination     DataTable + DataTableServerPagination (재사용)
```
> **왜 past_exam_questions과 questions가 별도 테이블인가?**
>
> - `past_exam_questions` = **"참고 자료 서랍"** — 기출 원본 보관 (이미지, OCR, 학교/년도)
> - `questions` = **"출제 문제 서랍"** — 실제 시험에 쓸 문제들
>
> ```
> past_exam_questions (입력/원본) → AI 분석 → questions (출력/생성) → exam_questions (시험 배치)
> ```
>
> 분리 이유:
> 1. **관심사 분리** — 기출 "원본"과 "생성된 문제"는 생명주기가 다름
> 2. **스키마 충돌** — past_exam_questions에는 year/semester/exam_type/school_id 필수, questions에는 불필요
> 3. **역할 구분** — 하나는 "AI의 입력", 다른 하나는 "AI의 출력"


### 새로 생성 — Server Action + Zod

**1. `src/lib/validations/question-filter.ts`** — 문제 목록 필터 Zod 스키마 (~30줄)

```typescript
/**
 * 문제 목록 필터 스키마
 *
 * URL searchParams에서 오는 값을 검증한다.
 * 모든 필터는 optional (필터 미적용 = 전체 조회).
 * URL searchParams는 항상 문자열이므로 z.coerce 사용.
 */
import { z } from 'zod'

export const questionFilterSchema = z.object({
  // 과목: 부분 일치 검색
  subject: z.string().optional(),

  // 학교 유형: 학년 필터와 연동 (선택 시 학년 옵션이 동적으로 변경)
  schoolType: z
    .enum(['elementary', 'middle', 'high', 'all'])
    .optional()
    .default('all'),

  // 학년: 1~12 정수 (schoolType에 따라 UI에서 유효 범위 제한)
  // elementary: 1~6, middle: 7~9, high: 10~12
  grade: z.coerce.number().int().min(1).max(12).optional(),

  // 문제 유형: DB 타입 사용 (descriptive, 'all'은 필터 미적용)
  type: z
    .enum(['multiple_choice', 'short_answer', 'descriptive', 'all'])
    .optional()
    .default('all'),

  // 난이도: DB 숫자 사용 (2=쉬움, 3=보통, 4=어려움)
  difficulty: z.coerce.number().int().min(1).max(5).optional(),

  // 출처: ai_generated 또는 전체
  sourceType: z
    .enum(['past_exam', 'textbook', 'self_made', 'ai_generated', 'all'])
    .optional()
    .default('all'),

  // 페이지
  page: z.coerce.number().int().min(1).optional().default(1),
})

export type QuestionFilterInput = z.infer<typeof questionFilterSchema>
```
> **학년 필터 — schoolType 연동 설계**
> 한국 교육과정에서 학년은 학교 유형에 따라 범위가 다르다:
> - 초등학교(elementary): 1~6학년
> - 중학교(middle): 7~9학년 (중1=7, 중2=8, 중3=9)
> - 고등학교(high): 10~12학년 (고1=10, 고2=11, 고3=12)
>
> UI 동작: `schoolType` 선택 시 `grade` 드롭다운의 옵션이 동적으로 변경된다.
> 예: 고등학교 선택 → 학년 옵션에 10, 11, 12만 표시 (1~9는 표시 안 됨)
>
> 이 로직은 `src/lib/utils/grade-filter-utils.ts`에 분리한다 (아래 신규 파일 참조).

**신규 유틸: `src/lib/utils/grade-filter-utils.ts`** (~30줄)

```typescript
/**
 * schoolType별 유효 학년 범위를 반환하는 유틸리티
 *
 * DB에서는 1~12 정수로 통일 저장하되,
 * UI 필터에서는 schoolType에 따라 유효 범위를 제한한다.
 */

export type SchoolType = 'elementary' | 'middle' | 'high'

// schoolType별 학년 범위 매핑
const GRADE_RANGES: Record<SchoolType, { min: number; max: number; label: string }> = {
  elementary: { min: 1, max: 6, label: '초등학교' },
  middle: { min: 7, max: 9, label: '중학교' },
  high: { min: 10, max: 12, label: '고등학교' },
}

/**
 * schoolType에 해당하는 학년 옵션 배열 반환
 * 'all'이면 1~12 전체 반환
 */
export function getGradeOptions(schoolType: SchoolType | 'all'): number[] {
  if (schoolType === 'all') {
    return Array.from({ length: 12 }, (_, i) => i + 1)
  }
  const { min, max } = GRADE_RANGES[schoolType]
  return Array.from({ length: max - min + 1 }, (_, i) => min + i)
}

/**
 * 학년 숫자를 한국어 표시용 문자열로 변환
 * 예: 7 → '중1', 10 → '고1'
 */
export function formatGradeLabel(grade: number): string {
  if (grade >= 1 && grade <= 6) return `초${grade}`
  if (grade >= 7 && grade <= 9) return `중${grade - 6}`
  if (grade >= 10 && grade <= 12) return `고${grade - 9}`
  return `${grade}학년`
}

/**
 * 학년이 schoolType 범위에 유효한지 확인
 */
export function isValidGradeForSchoolType(
  grade: number,
  schoolType: SchoolType | 'all',
): boolean {
  if (schoolType === 'all') return grade >= 1 && grade <= 12
  const { min, max } = GRADE_RANGES[schoolType]
  return grade >= min && grade <= max
}
```

**신규 테스트: `src/lib/utils/__tests__/grade-filter-utils.test.ts`** (~20개)

```
describe('getGradeOptions')
  1. 'all' → [1,2,...,12] 전체 반환
  2. 'elementary' → [1,2,3,4,5,6]
  3. 'middle' → [7,8,9]
  4. 'high' → [10,11,12]

describe('formatGradeLabel')
  5. 1 → '초1'
  6. 6 → '초6'
  7. 7 → '중1'
  8. 9 → '중3'
  9. 10 → '고1'
  10. 12 → '고3'

describe('isValidGradeForSchoolType')
  11. grade=3, schoolType='elementary' → true
  12. grade=7, schoolType='elementary' → false
  13. grade=8, schoolType='middle' → true
  14. grade=6, schoolType='middle' → false
  15. grade=11, schoolType='high' → true
  16. grade=6, schoolType='high' → false
  17. grade=1, schoolType='all' → true
  18. grade=12, schoolType='all' → true
  19. grade=0, schoolType='all' → false
  20. grade=13, schoolType='all' → false
```

**2. `src/lib/actions/questions.ts`** — 문제 조회 Server Action (~120줄)

```typescript
'use server'

/**
 * 문제 조회 Server Actions
 *
 * - getQuestionList: 목록 조회 + 필터 + 페이지네이션
 *
 * 패턴: getPastExamList (1-6)와 동일
 * 권한: 인증된 사용자 전체 (student 포함) — RLS가 academy_id로 자동 격리
 */

import { createClient } from '@/lib/supabase/server'
import { questionFilterSchema } from '@/lib/validations/question-filter'
import { fromDifficultyNumber } from '@/lib/ai'
import type { DifficultyLevel } from '@/lib/ai'

// ─── 조회 타입 ──────────────────────────────────────────

export interface QuestionListItem {
  readonly id: string
  readonly content: string            // 문제 내용 (목록에서는 앞 100자만 표시)
  readonly type: string               // DB 타입: 'multiple_choice' | 'short_answer' | 'descriptive'
  readonly difficulty: number         // DB 숫자: 2, 3, 4
  readonly difficultyLabel: DifficultyLevel  // UI 표시용: 'easy', 'medium', 'hard'
  readonly subject: string
  readonly grade: number
  readonly isAiGenerated: boolean
  readonly aiReviewStatus: string     // 'none' | 'pending' | 'approved' | 'rejected'
  readonly sourceType: string | null
  readonly createdByName: string | null
  readonly createdAt: string
}

export interface QuestionListResult {
  readonly error?: string
  readonly data?: readonly QuestionListItem[]
  readonly meta?: {
    readonly total: number
    readonly page: number
    readonly pageSize: number
  }
}

// ─── 내부 헬퍼 ──────────────────────────────────────────

interface CurrentUserProfile {
  readonly id: string
  readonly role: string
  readonly academyId: string
}

interface GetCurrentUserResult {
  readonly error?: string
  readonly profile?: CurrentUserProfile
}

async function getCurrentUserProfile(): Promise<GetCurrentUserResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: '인증이 필요합니다.' }
  }

  const { data: profile, error: profileError } = (await supabase
    .from('profiles')
    .select('id, role, academy_id')
    .eq('id', user.id)
    .single()) as {
    data: { id: string; role: string; academy_id: string | null } | null
    error: unknown
  }

  if (profileError || !profile) {
    return { error: '프로필을 찾을 수 없습니다.' }
  }

  if (!profile.academy_id) {
    return { error: '소속 학원이 없습니다.' }
  }

  return {
    profile: {
      id: profile.id,
      role: profile.role,
      academyId: profile.academy_id,
    },
  }
}

/**
 * DB 응답(snake_case + FK JOIN) → QuestionListItem(camelCase) 변환
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toQuestionListItem(dbRow: any): QuestionListItem {
  return {
    id: dbRow.id,
    content: dbRow.content,
    type: dbRow.type,
    difficulty: dbRow.difficulty,
    difficultyLabel: fromDifficultyNumber(dbRow.difficulty),
    subject: dbRow.subject,
    grade: dbRow.grade,
    isAiGenerated: dbRow.is_ai_generated ?? false,
    aiReviewStatus: dbRow.ai_review_status ?? 'none',
    sourceType: dbRow.source_type,
    createdByName: dbRow.profiles?.name ?? null,
    createdAt: dbRow.created_at,
  }
}

function sanitizeFilters(raw: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      value === '' ? undefined : value,
    ]),
  )
}

// ─── 목록 조회 Action ───────────────────────────────────

export async function getQuestionList(
  rawFilters?: Record<string, unknown>,
): Promise<QuestionListResult> {
  // 1. 인증 + 프로필 확인
  const { error: profileError, profile } = await getCurrentUserProfile()
  if (profileError || !profile) {
    return { error: profileError }
  }

  // 2. 빈 문자열 제거 → Zod 파싱
  const sanitized = sanitizeFilters(rawFilters ?? {})
  const parsed = questionFilterSchema.safeParse(sanitized)
  if (!parsed.success) {
    return { error: '잘못된 필터 값입니다.' }
  }

  const { subject, grade, type, difficulty, sourceType, page } = parsed.data
  const pageSize = 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const supabase = await createClient()

  try {
    // 3. FK JOIN 쿼리 구성
    let query = supabase
      .from('questions')
      .select(
        `
          id, content, type, difficulty, subject, grade,
          is_ai_generated, ai_review_status, source_type,
          created_at,
          profiles!created_by ( name )
        `,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, to)

    // 4. 필터 적용
    if (subject) {
      query = query.ilike('subject', `%${subject}%`)
    }
    if (grade) {
      query = query.eq('grade', grade)
    }
    if (type && type !== 'all') {
      query = query.eq('type', type)
    }
    if (difficulty) {
      query = query.eq('difficulty', difficulty)
    }
    if (sourceType && sourceType !== 'all') {
      query = query.eq('source_type', sourceType)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error, count } = await (query as any)

    if (error) {
      return { error: '문제 목록 조회에 실패했습니다.' }
    }

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: (data ?? []).map((row: any) => toQuestionListItem(row)),
      meta: {
        total: count ?? 0,
        page,
        pageSize,
      },
    }
  } catch {
    return { error: '문제 목록 조회에 실패했습니다.' }
  }
}
```

### 새로 생성 — UI 컴포넌트

**3. `src/app/(dashboard)/questions/_components/constants.ts`** — 문제 UI 상수 (~40줄)

```typescript
// ─── 문제 목록 UI 상수 ──────────────────────────────────

// 문제 유형 한국어 레이블 (DB 타입 기준)
export const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: '객관식',
  short_answer: '단답형',
  descriptive: '서술형',
}

// 문제 유형 Badge variant
export const QUESTION_TYPE_BADGE_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline'
> = {
  multiple_choice: 'default',
  short_answer: 'secondary',
  descriptive: 'outline',
}

// 난이도 한국어 레이블 (DB 숫자 기준)
export const DIFFICULTY_LABELS: Record<number, string> = {
  2: '쉬움',
  3: '보통',
  4: '어려움',
}

// 난이도 Badge variant
export const DIFFICULTY_BADGE_VARIANT: Record<
  number,
  'secondary' | 'default' | 'destructive'
> = {
  2: 'secondary',
  3: 'default',
  4: 'destructive',
}

// 검수 상태 한국어 레이블
export const REVIEW_STATUS_LABELS: Record<string, string> = {
  none: '—',
  pending: '검수 대기',
  approved: '승인',
  rejected: '반려',
}

export const REVIEW_STATUS_BADGE_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  none: 'secondary',
  pending: 'outline',
  approved: 'default',
  rejected: 'destructive',
}

> **`DIFFICULTY_BADGE_VARIANT` 설명**
> shadcn/ui의 `<Badge>` 컴포넌트는 `variant` prop으로 색상을 제어한다.
> 난이도별로 직관적인 색상을 매핑한 것:
> - `2(쉬움)` → `'secondary'` (회색 계열) — 쉬운 문제는 눈에 덜 띄게
> - `3(보통)` → `'default'` (기본 색상) — 가장 일반적인 난이도
> - `4(어려움)` → `'destructive'` (빨간 계열) — 주의가 필요한 어려운 문제
>
> 같은 패턴이 `QUESTION_TYPE_BADGE_VARIANT`(문제 유형)와 `REVIEW_STATUS_BADGE_VARIANT`(검수 상태)에도 적용된다.
> 이 상수를 컬럼 정의와 분리하면 디자인 변경 시 상수 파일만 수정하면 된다.

// 필터용 학년 배열 — grade-filter-utils의 getGradeOptions() 사용
// schoolType 변경 시 동적으로 옵션 갱신 (questions-toolbar에서 처리)
// 여기서는 전체 범위 기본값만 제공
export { getGradeOptions } from '@/lib/utils/grade-filter-utils'
```

**4. `src/app/(dashboard)/questions/_components/question-columns.tsx`** — DataTable 컬럼 정의 (~120줄)

정적 배열로 구현한다. 이유: 현재 MVP에서는 권한별로 컬럼이 달라지지 않으므로 팩토리 함수가 불필요하다. (기출문제는 "AI 문제 생성" 버튼이 교사/관리자만 보여야 해서 팩토리가 필요했지만, 문제 목록은 순수 조회만.)

```typescript
'use client'

// 컬럼 구성 (7개):
// 1. 과목
// 2. 학년
// 3. 유형 (Badge)
// 4. 난이도 (Badge)
// 5. 출처 (AI생성/수동)
// 6. 등록일
// 7. 액션 (상세 버튼 — Step 5에서 Sheet 연결)
```

**5. `src/app/(dashboard)/questions/_components/questions-toolbar.tsx`** — 필터 Toolbar (~100줄)

1-6의 `past-exams-toolbar.tsx` 패턴 재활용:
- 과목 Input (debounce 300ms)
- 학년 Select
- 유형 Select (객관식/단답형/서술형/전체)
- 난이도 Select (쉬움/보통/어려움/전체)

**6. `src/app/(dashboard)/questions/page.tsx`** — 문제 목록 페이지 (~80줄)

1-6의 `past-exams/page.tsx`와 동일한 Server Component 패턴:

```typescript
// Server Component — 데이터 조회 + DataTable 렌더링
export default async function QuestionsPage({ searchParams }: QuestionsPageProps) {
  const params = await searchParams

  // 문제 목록 조회
  const result = await getQuestionList({
    subject: params.subject,
    grade: params.grade,
    type: params.type ?? 'all',
    difficulty: params.difficulty,
    sourceType: params.sourceType ?? 'all',
    page: params.page ?? '1',
  })

  // ... DataTable 렌더링 (1-6 패턴 동일)
}
```

### 사이드바 메뉴 추가

**7. `src/lib/constants/menu.ts`** — "문제 관리" 항목 추가 (~10줄)

```typescript
import { ClipboardList } from 'lucide-react'  // 추가

// '문제 생성' 다음에 삽입:
{
  title: '문제 관리',
  href: '/questions',
  icon: ClipboardList,         // 체크리스트 아이콘 — 문제 목록/관리를 연상
  description: '저장된 문제 조회 및 관리',
},
```

왜 이 위치인가? 사용자 여정이 "기출문제 → 문제 생성 → **문제 관리**"이므로 '문제 생성' 바로 다음이 자연스럽다.

### TDD 테스트

**8. `src/lib/validations/__tests__/question-filter.test.ts`** (~12개)

```
describe('questionFilterSchema')
  1. 모든 필터 없이 → 기본값(page=1, type='all', sourceType='all')
  2. subject 필터 → 통과
  3. grade 범위 내(7) → 통과
  4. grade 범위 밖(0) → 거부
  5. type 유효 enum → 통과 (it.each: 4종)
  6. type 유효하지 않은 값 → 거부
  7. difficulty 유효(2,3,4) → 통과
  8. sourceType 유효 enum → 통과 (it.each: 5종)
  9. page 문자열 → 숫자 coerce
  10. page 0 → 거부
  11. 빈 문자열 sanitize 후 → 통과 (undefined 취급)
  12. 복합: 모든 필터 동시 → 통과
```

**9. `src/lib/actions/__tests__/questions-list.test.ts`** (~12개)

```
describe('getQuestionList')
  describe('인증')
    1. 비인증 → 에러
    2. 프로필 없음 → 에러
    3. academy_id 없음 → 에러

  describe('필터')
    4. 필터 없이 → 전체 조회 (page=1, pageSize=10)
    5. subject 필터 → ilike 호출 확인
    6. type 필터 → eq 호출 확인
    7. difficulty 필터 → eq 호출 확인
    8. 잘못된 필터 → '잘못된 필터 값입니다.'

  describe('응답 변환')
    9. DB snake_case → camelCase 변환 확인
    10. difficulty 숫자 → difficultyLabel 문자열 변환 확인
    11. profiles FK JOIN → createdByName 매핑 확인

  describe('에러')
    12. DB 에러 → '문제 목록 조회에 실패했습니다.'
```

### 설계 결정 근거

| 결정 | 근거 |
|------|------|
| 정적 컬럼 배열 (팩토리 아님) | 권한별 분기 없음. 단순 조회 목록 |
| `getCurrentUserProfile` 복사 | past-exams.ts, questions.ts 모두 사용. 3회 시 추출 검토 |
| `difficultyLabel` 필드 추가 | DB 숫자(3)를 UI 문자열('medium')로 매번 변환하면 비효율. 변환 결과를 필드에 포함 |
| `content` 전체를 목록에 포함 | 컬럼 cell에서 `content.slice(0, 50) + '...'`로 잘라서 표시 |
| 메뉴에 ClipboardList 아이콘 | lucide-react에서 "문제 목록"과 가장 유사한 아이콘. FileText는 기출문제에서 사용 중 |

### 리스크

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| `profiles!created_by` FK 이름 | **중간** | `questions.created_by`가 `profiles.id`를 참조. PostgREST가 자동 감지하지만 FK가 여러 개면 명시 필요 (`reviewed_by`도 profiles FK). `!created_by`로 명시 |
| 문제가 아직 0건인 경우 | **낮음** | noResultsMessage="저장된 문제가 없습니다." |
| 대량 데이터 성능 | **낮음** | 서버사이드 페이지네이션(10건/페이지). 인덱스는 DB 기본 |

### 파일 변경 요약

| 작업 | 파일 | 변경 |
|------|------|------|
| 신규 | `src/lib/utils/grade-filter-utils.ts` | schoolType별 학년 필터 유틸 (~30줄) |
| 신규 | `src/lib/utils/__tests__/grade-filter-utils.test.ts` | 학년 필터 유틸 테스트 ~20개 (~120줄) |
| 신규 | `src/lib/validations/question-filter.ts` | 필터 Zod 스키마 (~35줄, schoolType 추가) |
| 신규 | `src/lib/actions/questions.ts` | getQuestionList Server Action (~120줄) |
| 신규 | `src/app/(dashboard)/questions/_components/constants.ts` | UI 상수 (~40줄) |
| 신규 | `src/app/(dashboard)/questions/_components/question-columns.tsx` | DataTable 컬럼 (~120줄) |
| 신규 | `src/app/(dashboard)/questions/_components/questions-toolbar.tsx` | 필터 Toolbar (~120줄, schoolType 연동 학년 드롭다운) |
| 신규 | `src/app/(dashboard)/questions/page.tsx` | 목록 페이지 (~80줄) |
| 수정 | `src/lib/constants/menu.ts` | "문제 관리" 메뉴 추가 (~10줄) |
| 신규 | `src/lib/validations/__tests__/question-filter.test.ts` | 필터 테스트 ~12개 (~100줄) |
| 신규 | `src/lib/actions/__tests__/questions-list.test.ts` | 목록 테스트 ~12개 (~200줄) |

### 성공 기준

- [ ] `npx vitest run src/lib/utils/__tests__/grade-filter-utils.test.ts` — 20개 PASS
- [ ] `npx vitest run src/lib/validations/__tests__/question-filter.test.ts` — 12개 PASS
- [ ] `npx vitest run src/lib/actions/__tests__/questions-list.test.ts` — 12개 PASS
- [ ] `/questions` 페이지에서 DataTable 표시
- [ ] 필터(과목/학년/유형/난이도/학교유형) 동작 확인
- [ ] schoolType 선택 시 학년 드롭다운 동적 변경 확인
- [ ] 서버사이드 페이지네이션 동작 확인
- [ ] 사이드바에 "문제 관리" 메뉴 표시

---

## Step 5: 문제 상세 Sheet + 빌드 검증 + 학습 리뷰

### 개요

문제 목록에서 "상세" 버튼 클릭 시 오른쪽 Sheet로 문제 상세 정보를 표시한다. 기출문제 상세 Sheet(`past-exam-detail-sheet.tsx`) 패턴을 재활용한다.

### 새로 생성

**1. `src/lib/actions/questions.ts`에 추가** — `getQuestionDetail` (~40줄)

```typescript
// ─── 상세 조회 타입 ──────────────────────────────────────

export interface QuestionDetail extends QuestionListItem {
  readonly answer: string
  readonly explanation: string | null
  readonly options: readonly string[] | null   // JSONB → 배열
  readonly unit: string | null
  readonly aiModel: string | null
  readonly sourceMetadata: Record<string, unknown> | null
}

export interface QuestionDetailResult {
  readonly error?: string
  readonly data?: QuestionDetail
}

// ─── 상세 조회 Action ───────────────────────────────────

export async function getQuestionDetail(id: string): Promise<QuestionDetailResult> {
  // 인증 확인
  const { error: profileError, profile } = await getCurrentUserProfile()
  if (profileError || !profile) {
    return { error: profileError }
  }

  const supabase = await createClient()

  try {
    const { data: row, error: dbError } = (await supabase
      .from('questions')
      .select(`
        id, content, type, difficulty, subject, grade, answer, explanation,
        options, unit, is_ai_generated, ai_review_status, ai_model,
        source_type, source_metadata, created_at,
        profiles!created_by ( name )
      `)
      .eq('id', id)
      .single()) as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: any | null
      error: unknown
    }

    if (dbError || !row) {
      return { error: '문제를 찾을 수 없습니다.' }
    }

    return {
      data: {
        ...toQuestionListItem(row),
        answer: row.answer,
        explanation: row.explanation,
        options: row.options,
        unit: row.unit,
        aiModel: row.ai_model,
        sourceMetadata: row.source_metadata,
      },
    }
  } catch {
    return { error: '문제 상세 조회에 실패했습니다.' }
  }
}
```

**2. `src/app/(dashboard)/questions/_components/question-detail-sheet.tsx`** — 상세 Sheet (~150줄)

기출문제 상세 Sheet와 동일 패턴:
- Sheet 열릴 때 `getQuestionDetail(id)` 호출
- useEffect race condition 방지 (`let cancelled = false`)
- 로딩/에러/상세 정보 표시

표시 항목:
- 과목, 학년, 유형(Badge), 난이도(Badge)
- 문제 내용 (whitespace-pre-wrap)
- 객관식이면 보기 표시
- 정답, 해설
- 출처 (AI 생성 여부, 검수 상태)
- 생성자, 등록일

```typescript
'use client'

import { useState, useEffect } from 'react'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { getQuestionDetail } from '@/lib/actions/questions'
import type { QuestionDetail } from '@/lib/actions/questions'
import {
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_BADGE_VARIANT,
  DIFFICULTY_LABELS,
  DIFFICULTY_BADGE_VARIANT,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_BADGE_VARIANT,
} from './constants'

// ... useEffect로 상세 데이터 패칭 (past-exam-detail-sheet 패턴 동일)
```

**3. `question-columns.tsx` 수정** — 상세 버튼에 Sheet 연결

Step 4에서 만든 "액션" 컬럼에 `QuestionDetailSheet`를 연결한다.

### TDD 테스트

**4. `src/lib/actions/__tests__/questions-detail.test.ts`** (~8개)

```
describe('getQuestionDetail')
  1. 비인증 → 에러
  2. 유효 ID → 상세 데이터 반환
  3. 존재하지 않는 ID → 에러 '문제를 찾을 수 없습니다.'
  4. answer, explanation 포함 확인
  5. options JSONB → 배열 변환 확인
  6. difficulty 숫자 → difficultyLabel 변환 확인
  7. profiles!created_by FK JOIN → createdByName 매핑 확인
  8. DB 에러 → '문제 상세 조회에 실패했습니다.'
```

### 빌드 검증 명령

```bash
npx vitest run                     # 전체 테스트 — 404 + Step1~5 ~75개 = ~479+ PASS
npm run lint                       # lint 에러 0개
npm run build                      # Next.js 빌드 성공
```

### 학습 리뷰 포인트

| 개념 | 등급 | 설명 |
|------|------|------|
| AI 타입 ↔ DB 타입 매핑 (양방향) | 🔴 | toDifficultyNumber/fromDifficultyNumber, toDbQuestionType. 왜 중간 변환 레이어가 필요한가 |
| Bulk INSERT | 🟡 | `.insert([배열])` 한 번 vs 개별 `.insert({})` N번. 트랜잭션 일관성 |
| Server Action `{ error }` 패턴 | 🟢 | 1-7에서 학습 완료. 복습 |
| 중복 저장 방지 (savedIndices 상태) | 🟡 | 클라이언트 레벨 방어(Set 기반 개별 추적). DB 레벨 중복 방지와의 차이 |
| DataTable 재활용 패턴 | 🟢 | 1-6 패턴 반복. 필터 스키마 + Server Action + 컬럼 + Toolbar + Page |

### 이해도 질문 (사용자 답변 대기)

1. AI의 `difficulty: 'medium'`을 DB에 `3`으로 저장하고, 조회 시 다시 `'medium'`으로 변환한다. **왜 DB에 문자열('medium')을 그대로 저장하지 않는가?**
2. `checkTeacherOrAdmin` 헬퍼가 `generate-questions.ts`와 `save-questions.ts`에 **복사**되어 있다. 왜 아직 공통 모듈로 추출하지 않는가?
3. 저장 버튼의 `savedIndices` 상태는 **클라이언트에서만** 관리된다. 사용자가 브라우저 새로고침하면 어떻게 되는가? 이것이 문제가 되지 않는 이유는?
4. `source_metadata`에 `pastExamId`를 JSONB로 저장하는 것과, 별도 컬럼(`source_past_exam_id UUID`)으로 분리하는 것의 **장단점**은?
5. `profiles!created_by`에서 `!created_by`를 명시하는 이유는? `profiles`만 쓰면 안 되는가?

### 직접 구현 추천 판단

- 🔴 **타입 매핑 유틸 (Step 1)**: 새 패턴(양방향 변환). 빈칸 채우기 추천
- 🔴 **저장 Server Action (Step 2)**: 기존 패턴 기반이지만 `toQuestionInsertRow` 변환이 새로움. 핵심 로직 직접 구현 추천
- 🟡 **저장 버튼 UI (Step 3)**: savedIndices(Set) + 부분 저장 상태 관리가 새로움. 빈칸 채우기 추천
- 🟢 **문제 목록 DataTable (Step 4)**: 1-6 패턴 반복. AI 자동 구현 OK
- 🟢 **문제 상세 Sheet (Step 5)**: 기존 패턴 조합. AI 자동 구현 OK

### 파일 변경 요약

| 작업 | 파일 | 변경 |
|------|------|------|
| 수정 | `src/lib/actions/questions.ts` | getQuestionDetail 추가 (~40줄) |
| 신규 | `src/app/(dashboard)/questions/_components/question-detail-sheet.tsx` | 상세 Sheet (~150줄) |
| 수정 | `src/app/(dashboard)/questions/_components/question-columns.tsx` | Sheet 연결 (~15줄) |
| 신규 | `src/lib/actions/__tests__/questions-detail.test.ts` | 상세 테스트 ~8개 (~120줄) |

### 성공 기준

- [ ] `npx vitest run src/lib/actions/__tests__/questions-detail.test.ts` — 8개 PASS
- [ ] `npx vitest run` — 전체 테스트 PASS (~479+ 예상)
- [ ] `npm run lint` — 0 errors
- [ ] `npm run build` — 빌드 성공
- [ ] 문제 상세 Sheet에서 정답/해설/보기 표시 확인
- [ ] 사이드바 "문제 관리" → 목록 → 상세 전체 흐름 동작

---

## 전체 파일 변경 요약

### 수정 (4개)

| 파일 | 변경 | Step |
|------|------|------|
| `src/lib/ai/types.ts` | toDifficultyNumber, fromDifficultyNumber, DifficultyLevel | Step 1 |
| `src/lib/ai/index.ts` | export 추가 | Step 1 |
| `src/lib/constants/menu.ts` | "문제 관리" 메뉴 추가 | Step 4 |
| `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` | 저장 버튼 + 개별 선택 + savedIndices 상태 | Step 3 |

### 새로 생성 (12개)

| 파일 | 설명 | Step |
|------|------|------|
| `src/lib/validations/save-questions.ts` | 저장 Zod 스키마 | Step 1 |
| `src/lib/utils/grade-filter-utils.ts` | schoolType별 학년 필터 유틸 | Step 4 |
| `src/lib/validations/question-filter.ts` | 필터 Zod 스키마 | Step 4 |
| `src/lib/actions/save-questions.ts` | 저장 Server Action | Step 2 |
| `src/lib/actions/questions.ts` | 조회 Server Action | Step 4+5 |
| `src/app/(dashboard)/questions/_components/constants.ts` | UI 상수 | Step 4 |
| `src/app/(dashboard)/questions/_components/question-columns.tsx` | DataTable 컬럼 | Step 4 |
| `src/app/(dashboard)/questions/_components/questions-toolbar.tsx` | 필터 Toolbar | Step 4 |
| `src/app/(dashboard)/questions/_components/question-detail-sheet.tsx` | 상세 Sheet | Step 5 |
| `src/app/(dashboard)/questions/page.tsx` | 목록 페이지 | Step 4 |
| `docs/plan/phase-1-step8-save-generated-questions.md` | 이 계획 문서 | — |

### 테스트 파일 (5개 신규)

| 파일 | 테스트 수 | Step |
|------|----------|------|
| `src/lib/ai/__tests__/types-difficulty.test.ts` | ~8개 | Step 1 |
| `src/lib/validations/__tests__/save-questions.test.ts` | ~15개 | Step 1 |
| `src/lib/actions/__tests__/save-questions.test.ts` | ~23개 | Step 2 |
| `src/lib/utils/__tests__/grade-filter-utils.test.ts` | ~20개 | Step 4 |
| `src/lib/validations/__tests__/question-filter.test.ts` | ~12개 | Step 4 |
| `src/lib/actions/__tests__/questions-list.test.ts` | ~12개 | Step 4 |
| `src/lib/actions/__tests__/questions-detail.test.ts` | ~8개 | Step 5 |

**총: 4개 수정 + 13개 생성 + 7개 테스트 = 24개 파일**
**예상 테스트: 404(기존) + ~85(신규) = ~489+ PASS**

---

## 리스크 및 대응

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| RLS INSERT 정책이 Bulk INSERT를 차단할 수 있음 | **중간** | 이미 `questions_insert_teacher` 정책 존재. `academy_id = get_user_academy_id()` + 교사/관리자 조건 충족 |
| `questions.created_by` FK + `questions.reviewed_by` FK → PostgREST 모호 | **중간** | `profiles!created_by` 명시로 해결. 1-6에서 `profiles!uploaded_by` 경험 있음 |
| 동일 문제 중복 저장 (같은 AI 결과를 여러 번) | **낮음** | 클라이언트 `savedIndices` 방어. DB 유니크 제약 없음 (의도적: 같은 내용 문제 가능) |
| `toQuestionInsertRow`의 `as` 캐스팅 | **낮음** | Zod가 이미 타입 검증. `as`는 Zod 결과→ AI 타입 변환용 |
| difficulty 1, 5가 DB에 직접 입력된 경우 | **낮음** | `fromDifficultyNumber`에서 기본값 'medium' 반환 |
| `getCurrentUserProfile` 3회 중복 (past-exams, save-questions, questions) | **낮음** | 1-8 완료 후 공통 모듈 추출 검토. MVP에서는 복사 유지 |

---

## 재사용 패턴 참조

| 재사용 대상 | 출처 파일 |
|------------|----------|
| DataTable + ServerPagination | `src/components/data-table/` 공용 컴포넌트 |
| 기출문제 목록 패턴 | `src/app/(dashboard)/past-exams/page.tsx` |
| 기출문제 DataTable 컬럼 패턴 | `src/app/(dashboard)/past-exams/_components/past-exam-columns.tsx` |
| 기출문제 Toolbar 패턴 | `src/app/(dashboard)/past-exams/_components/past-exams-toolbar.tsx` |
| 기출문제 상세 Sheet 패턴 | `src/app/(dashboard)/past-exams/_components/past-exam-detail-sheet.tsx` |
| Server Action 인증 패턴 | `src/lib/actions/generate-questions.ts` — `checkTeacherOrAdmin` |
| sanitizeFilters 패턴 | `src/lib/actions/past-exams.ts` |
| AI 타입 변환 | `src/lib/ai/types.ts` — `toDbQuestionType`, `fromDbQuestionType` |
| Zod 필터 스키마 패턴 | `src/lib/validations/past-exams.ts` — `pastExamFilterSchema` |
```

---

## 학습 리뷰 (계획 단계)

이번 계획에서 등장하는 새 개념 2가지를 설명합니다.

### 1. 양방향 타입 매핑 (Bidirectional Type Mapping)

AI 세계와 DB 세계에서 같은 것을 다른 이름/형태로 부르는 경우, **변환 함수를 쌍(pair)으로** 만드는 패턴입니다.

```
AI 세계                 변환 함수                  DB 세계
────────                ──────────                 ────────
'essay'     →  toDbQuestionType()  →    'descriptive'
'descriptive'  ←  fromDbQuestionType()  ←  'essay'

'medium'    →  toDifficultyNumber()  →    3
3           ←  fromDifficultyNumber() ←   'medium'
```

왜 필요한가?
- **저장할 때**: AI 데이터를 DB 형태로 변환 (`to___`)
- **조회할 때**: DB 데이터를 UI 형태로 변환 (`from___`)
- 이 변환을 한 곳(`types.ts`)에 모아두면, 나중에 매핑을 바꿀 때 한 파일만 수정하면 됩니다.

### 2. Bulk INSERT vs 개별 INSERT

```typescript
// 개별 INSERT (느림 — N번 왕복)
for (const q of questions) {
  await supabase.from('questions').insert(q)   // DB 왕복 1회
}

// Bulk INSERT (빠름 — 1번 왕복)
await supabase.from('questions').insert(questions)  // DB 왕복 1회로 전부 처리
```

Supabase의 `.insert([배열])`은 내부적으로 하나의 SQL 트랜잭션으로 실행됩니다. 배열 중 하나라도 실패하면 **전부 롤백**(취소)됩니다. 이것은 "10개 중 5개만 저장됨" 같은 불완전한 상태를 방지합니다.

---

이 계획 문서에서 이해가 안 되는 부분이나, 설계 결정에 대해 의견이 있으면 말씀해주세요. 계획 승인 후 구현을 진행하겠습니다.