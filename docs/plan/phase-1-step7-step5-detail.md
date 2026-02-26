# 1-7 Step 5 상세 계획: 빌드 검증 + 학습 리뷰

> **상위 계획**: `docs/plan/phase-1-step7-ai-question-generation.md` Step 5
> **작성일**: 2026-02-26
> **상태**: ✅ 완료
> **선행 완료**: Step 1 (타입 + Zod, 369 tests), Step 2 (프롬프트 빌더, 383 tests), Step 3 (Server Action, 404 tests), Step 4 (UI, 404 tests + 빌드 성공)

---

## 1. 개요

1-7의 마지막 단계. **코드 작성·파일 수정 없음** (순수 검증 + 학습).

### 목표

1. 전체 빌드 무결성 확인 (테스트, lint, 빌드)
2. 1-7에서 학습한 핵심 개념 5가지 정리 및 리뷰
3. 이해도 질문 5개 (사용자 답변 대기)
4. 직접 구현 추천 판단 전달
5. 문서 업데이트 (HANDOFF, ROADMAP, 계획 문서, MEMORY)

### 핵심 원칙

- **코드 작성·파일 수정 절대 없음** — 검증 명령어 실행 + 학습 리뷰 + 문서 업데이트만 수행
- 빌드 실패 시에만 예외적으로 수정 허용 (build-error-resolver 에이전트 사용)

---

## 2. Phase A: 빌드 검증

### 검증 명령어 3개

```bash
# 1. 전체 테스트 — 404+ tests PASS 예상
npx vitest run

# 2. lint 에러 0개 확인
npm run lint

# 3. Next.js 빌드 성공 확인
npm run build
```

### 성공 기준

| 명령어 | 기대 결과 |
|--------|----------|
| `npx vitest run` | 404+ tests 전체 PASS, 실패 0개 |
| `npm run lint` | 에러 0개 (경고는 허용) |
| `npm run build` | `✓ Compiled successfully` + 빌드 완료 |

### 실패 시 대응

| 실패 유형 | 대응 |
|----------|------|
| 테스트 실패 | Step 4에서 이미 404 PASS 확인됨. 변경 없으므로 회귀 가능성 극히 낮음. 실패 시 build-error-resolver 에이전트로 원인 분석 후 최소 수정 |
| Lint 에러 | 이전에 lint 별도 실행하지 않았을 수 있으므로 확인 필요. 에러 발생 시 해당 파일만 수정 후 재검증 |
| 빌드 실패 | Step 4에서 빌드 성공 확인됨. 실패 시 build-error-resolver 에이전트 사용 |

---

## 3. Phase B: 1-7 전체 학습 리뷰 (5개 핵심 개념)

### 리뷰 대상 개요

| # | 개념 | 등급 | 핵심 |
|---|------|------|------|
| 1 | Factory + Strategy 패턴 실전 적용 | 🔴 | `createAIProvider` → `generateQuestions` 흐름. 새 프로바이더 추가 시 기존 코드 수정 없음 (OCP) |
| 2 | 프롬프트 엔지니어링 (기출 컨텍스트) | 🔴 | `systemInstruction`(역할)=고정, `userPrompt`(요청)=가변. `extractedContent` 유무 분기. `temperature` 0.8 |
| 3 | Server Action에서 AI 호출 패턴 | 🟡 | 인증→Zod검증→DB조회→AI호출→결과반환 파이프라인. `AIError` catch → `{ error }` 패턴 |
| 4 | useTransition + Server Action | 🟢 | 1-5에서 학습 완료. 복습 |
| 5 | Zod 스키마와 AI 타입 연동 | 🟡 | `QuestionType`(AI)↔`z.enum`(사용자입력). `z.coerce.number()` HTML form 대응 |

### 개념 1: Factory + Strategy 패턴 실전 적용 (🔴)

**한 줄 설명**: 0-5에서 만든 AI 추상화 레이어를 1-7에서 **실제로 사용**한 첫 번째 기능. `createAIProvider('gemini')` → `provider.generateQuestions(params)` 흐름.

**비유**: 레스토랑 주문 시스템.
- Factory = "주방장 배정 시스템" — `createAIProvider('gemini')`은 "한식 주방장 배정해주세요"
- Strategy = "요리법" — 각 주방장(Provider)는 같은 주문서(params)를 받아 자기 방식으로 요리
- 새 주방장(Claude, GPT)을 추가해도 주문서 양식이나 홀 시스템은 변경 불필요 (OCP)

**1-7에서의 실전 적용 포인트**:
- `src/lib/actions/generate-questions.ts`에서 `createAIProvider` 호출
- Server Action이 "홀 직원" 역할 — 손님(UI) 주문 받아 주방(AI)에 전달
- 프로바이더가 바뀌어도 Server Action 코드 변경 없음

**핵심 질문**: "새로운 AI 프로바이더(예: Claude)를 추가할 때, `generateQuestionsFromPastExam` Server Action의 코드를 수정해야 하는가? 수정이 필요 없다면 그 이유는?"

### 개념 2: 프롬프트 엔지니어링 — 기출 컨텍스트 (🔴)

**한 줄 설명**: AI에게 "너는 무엇이다"(systemInstruction)와 "이걸 해줘"(userPrompt)를 분리하여 전달하는 패턴. 기출 내용(`extractedContent`) 유무에 따라 프롬프트가 달라진다.

**비유**: 과외 선생님에게 요청하기.
- `systemInstruction` = "당신은 한국 고등학교 수학 전문 출제위원입니다" (한 번 정하면 안 바뀜)
- `userPrompt` = "이 기출문제를 참고해서 비슷한 문제 5개 만들어주세요" (매번 바뀜)
- `extractedContent`가 있으면 = "여기 기출 원문이 있으니 참고하세요" (있으면 더 정확)
- `temperature` 0.8 = "좀 창의적으로 만들어도 돼요" (0에 가까울수록 정답만, 1에 가까울수록 자유롭게)

**1-7에서의 실전 적용 포인트**:
- `src/lib/ai/prompts/past-exam-generation.ts` — `buildPastExamGenerationPrompt`
- `extractedContent`가 있으면 프롬프트에 "기출 원문" 섹션 추가
- 기존 `buildQuestionGenerationPrompt`와 합치지 않고 별도 함수로 분리 (SRP)

**핵심 질문**: "`extractedContent`가 없는 기출문제에서 AI 문제를 생성할 때, 프롬프트에 어떤 정보가 포함되고 어떤 정보가 빠지는가?"

### 개념 3: Server Action에서 AI 호출 패턴 (🟡)

**한 줄 설명**: 인증 → Zod 검증 → DB 조회 → AI 호출 → 결과 반환. 5단계 파이프라인. AI 에러는 throw하지 않고 `{ error: string }`으로 반환.

**비유**: 은행 창구.
1. 신분증 확인 (인증 — `checkTeacherOrAdmin`)
2. 신청서 검증 (Zod — `generateQuestionsRequestSchema.safeParse`)
3. 계좌 조회 (DB — Supabase에서 기출문제 정보 조회)
4. 송금 실행 (AI 호출 — `provider.generateQuestions`)
5. 영수증 발급 (결과 반환 — `{ data: questions }`)
6. 실패 시 → "죄송합니다, 잠시 후 다시 시도해주세요" (`{ error: '...' }`) — 은행 직원이 패닉하지 않음 (throw하지 않음)

**1-7에서의 실전 적용 포인트**:
- `src/lib/actions/generate-questions.ts` — `generateQuestionsFromPastExam`
- `AIError`를 catch하여 사용자 친화적 메시지로 변환
- throw하면 UI에서 try/catch 필요 → `{ error }`로 반환하면 `if (result.error)` 패턴으로 깔끔

**핵심 질문**: "Server Action에서 `throw new Error()`하면 클라이언트에서 어떤 일이 일어나는가? `{ error: string }`으로 반환하는 것과 비교하여 UX 차이는?"

### 개념 4: useTransition + Server Action (🟢 — 복습)

**한 줄 설명**: 1-5 사용자 관리에서 학습한 패턴. `isPending`으로 로딩 표시 + 중복 클릭 방지. `startTransition` 내에서 Server Action 호출.

**1-7에서의 실전 적용 포인트**:
- `generate-questions-dialog.tsx`에서 `handleGenerate` 함수
- `isPending`일 때 스피너 표시 + 버튼 비활성화
- `startTransition(async () => { ... })` 패턴 그대로 재사용

**핵심 질문**: "`useTransition`의 `isPending`과 `useState`로 직접 `loading` 상태를 관리하는 것의 차이는? (1-5에서 이미 답변했으므로 간단히 복습)"

### 개념 5: Zod 스키마와 AI 타입 연동 (🟡)

**한 줄 설명**: AI 타입 시스템(`QuestionType`, `Difficulty`)과 사용자 입력 검증(Zod `z.enum`)이 같은 값을 공유. `z.coerce.number()`로 HTML Select의 문자열 값을 숫자로 자동 변환.

**비유**: 번역 중개소.
- AI 세계에서는 `'multiple_choice'`라는 영어 단어 사용 (타입)
- 사용자 세계에서는 드롭다운에서 "객관식" 선택 → 실제 value는 `'multiple_choice'` (문자열)
- Zod = 번역 중개소 — 사용자 입력을 AI가 이해하는 형식으로 검증+변환
- `z.coerce.number()` = "3"이라는 글자를 숫자 3으로 바꿔주는 자동 변환기

**1-7에서의 실전 적용 포인트**:
- `src/lib/validations/generate-questions.ts` — `z.enum(['multiple_choice', 'short_answer', 'essay'])`
- Select의 value는 항상 문자열 → `count`는 `z.coerce.number()`로 변환
- `MAX_QUESTION_COUNT` 상수로 count 상한 제한 (API 비용 관리)

**핵심 질문**: "Select 컴포넌트에서 `count`를 `'3'`(문자열)으로 보내는데, Server Action의 Zod 스키마에서 숫자로 변환되는 과정을 설명하라. 만약 `z.coerce`가 없으면 어떤 에러가 발생하는가?"

---

## 4. Phase C: 이해도 질문 5개 (사용자 답변 대기)

각 질문은 Phase B의 핵심 질문을 정리한 것이다. 사용자가 답변한 후 피드백을 제공한다.

| # | 질문 | 관련 개념 |
|---|------|----------|
| 1 | `buildPastExamGenerationPrompt`와 `buildQuestionGenerationPrompt`를 하나로 합치지 않고 분리한 이유는? | 개념 2 (프롬프트 엔지니어링) |
| 2 | Server Action에서 `AIError`를 `throw`하지 않고 `{ error: string }`으로 반환하는 이유는? | 개념 3 (Server Action 패턴) |
| 3 | `GenerateQuestionParams`에 `pastExamContext`를 optional로 추가한 것은 어떤 원칙을 지키기 위한 것인가? | 개념 1 (Factory + Strategy) |
| 4 | `temperature`를 기존 0.7에서 0.8로 올린 이유는? | 개념 2 (프롬프트 엔지니어링) |
| 5 | `getPastExamDetail`을 재사용하지 않고 Server Action 내부에서 직접 DB 조회하는 이유는? | 개념 3 (Server Action 패턴) |

### 기대 답변 방향 (채점 기준)

**질문 1**: SRP(단일 책임 원칙) — 기출 기반과 일반 생성은 "다른 이유로 변경"되므로 분리. DRY의 "우연한 중복" 판단. OCP — 기존 함수 수정 없이 새 함수 추가.

**질문 2**: throw하면 클라이언트에서 `try/catch` 필요 + Next.js가 에러를 삼킬 수 있음. `{ error }`로 반환하면 `if (result.error)` 패턴으로 깔끔한 분기. 사용자에게 의미 있는 메시지 전달 가능.

**질문 3**: 하위 호환(Backward Compatibility) — optional이므로 기존 사용처(`buildQuestionGenerationPrompt`, GeminiProvider 테스트 등)에서 타입 에러 없음. OCP — 기존 인터페이스 확장이지 수정이 아님.

**질문 4**: 기출 기반 문제는 원본과 "유사하되 다른" 문제가 필요. temperature가 높을수록 다양성 증가. 0.7은 일반 생성용(정확성 중시), 0.8은 기출 기반(변형 중시).

**질문 5**: `getPastExamDetail`은 Signed URL 생성 + 포맷팅을 포함하여 UI 표시 최적화. Server Action에서는 DB 원시 데이터(school_name, extracted_content 등)만 필요. 불필요한 Signed URL 생성 방지 + 관심사 분리.

---

## 5. Phase D: 직접 구현 추천 판단

| 대상 | 등급 | 추천 방법 | 근거 |
|------|------|----------|------|
| 프롬프트 빌더 (Step 2) | 🔴 | 삭제 후 재구현 (`reference` 참고, 복붙 NO) | 새 패턴. `systemInstruction` vs `userPrompt` 분리, `extractedContent` 조건부 포함을 직접 작성해야 체화 |
| Server Action (Step 3) | 🟡 | 빈칸 채우기 방식 재구현 | 인증/검증 파이프라인은 기존과 유사하나, AI 에러 처리(`AIError` catch → `{ error }`)가 새로움 |
| Zod 스키마 (Step 1) | 🟡 | 빈칸 채우기 방식 | 기존 패턴 확장. `z.coerce.number()`, `z.enum` errorMap 작성을 직접 |
| UI (Step 4) | 🟢 | AI 자동 구현 OK | 기존 패턴(useTransition, Dialog, Select) 조합. 새로운 개념 없음 |

### 삭제 후 재구현 프로세스 (🔴 대상)

```bash
# 1. 백업
cp src/lib/ai/prompts/past-exam-generation.ts src/lib/ai/prompts/past-exam-generation.ts.reference

# 2. 삭제 (테스트는 유지)
rm src/lib/ai/prompts/past-exam-generation.ts

# 3. 테스트 FAIL 확인
npx vitest run src/lib/ai/__tests__/prompts/past-exam-generation.test.ts

# 4. 사용자 직접 구현 (reference 참고 OK, 복붙 NO)

# 5. 테스트 PASS → 개념 체화 완료
npx vitest run src/lib/ai/__tests__/prompts/past-exam-generation.test.ts
```

### 빈칸 채우기 방식 (🟡 대상)

```bash
# 핵심 로직만 빈칸으로 만들어 사용자가 채우는 방식
# 예: Server Action의 AI 에러 처리 부분만 빈칸
# 예: Zod 스키마의 z.coerce.number() 체이닝만 빈칸
```

---

## 6. Phase E: 문서 업데이트

### 업데이트 대상 및 내용

| 파일 | 변경 내용 |
|------|----------|
| `HANDOFF.md` | Step 5 완료 표시, 1-7 전체 완료(5/5), 다음 작업 1-8로 변경, 세션 요약 추가 |
| `ROADMAP.md` | 1-7 기출 기반 AI 문제 생성 [F011] 완료 표시 |
| `docs/plan/phase-1-step7-ai-question-generation.md` | Step 5 완료 표시, 진행률 5/5 (100%), 상태: 완료 |
| `MEMORY.md` | 1-7에서 배운 기술 교훈 추가 (아래 목록 참조) |

### MEMORY.md 추가 예정 교훈

- `buildPastExamGenerationPrompt` 분리: SRP/OCP — "같은 이유로 변경되는가?" 판단 기준 (DRY의 우연한 중복 구분)
- `{ error: string }` 반환 패턴: Server Action에서 throw 대신 에러 객체 반환 — 클라이언트 분기 깔끔
- `pastExamContext` optional 추가: 하위 호환(Backward Compatibility) — 기존 사용처 영향 없이 확장
- `temperature` 0.7 vs 0.8: 일반 생성(정확성) vs 기출 기반(다양성) — 용도에 따라 조정
- 정적 배열 → 팩토리 함수 전환: callerRole 전달 필요 시 클로저 활용 (user-columns 패턴 재적용)
- Dialog inside Sheet: Radix Portal 사용 → z-index 자동 처리. `<SheetContent>` 밖, `<Sheet>` 안 배치

### 커밋 계획

```
📝 docs: 1-7 Step 5 완료 — 빌드 검증 + 학습 리뷰, 1-7 전체 완료
```

---

## 7. 성공 기준 체크리스트

- [x] `npx vitest run` — 404 tests 전체 PASS
- [x] `npm run lint` — 에러 0개 (경고 6개)
- [x] `npm run build` — 빌드 성공
- [x] 학습 리뷰 5개 개념 설명 완료
- [x] 이해도 질문 5개 답변 완료 (사용자)
- [x] 직접 구현 추천 전달 완료 (프롬프트 빌더 빈칸 채우기 실행)
- [x] 문서 업데이트 완료 (HANDOFF, ROADMAP, 계획 문서, MEMORY)

---

## 8. 리스크 및 대응

| # | 리스크 | 심각도 | 대응 |
|---|--------|--------|------|
| 1 | 테스트 실패 | LOW | Step 4에서 이미 404 PASS 확인. 코드 변경 없으므로 회귀 가능성 극히 낮음 |
| 2 | Lint 에러 | LOW | Step 1-4 구현 중 lint를 별도 실행하지 않았을 수 있으므로 확인 필요. 발견 시 최소 수정 |
| 3 | 빌드 실패 | LOW | Step 4에서 빌드 성공 확인됨. 환경 변수 등 외부 요인만 리스크 |
| 4 | 학습 리뷰 이해도 부족 | MEDIUM | JS 기초 수준에 맞춰 일상 비유 활용. 필요 시 추가 설명 또는 개념 문서(`docs/concepts/`) 생성 |
| 5 | 직접 구현 시 테스트 실패 | LOW | 테스트는 이미 작성되어 있으므로 RED→GREEN 사이클로 안내. reference 파일 참고 허용 |

---

## 9. 실행 순서 요약

```
1. Phase A: 빌드 검증 (3개 명령어)
   ├── npx vitest run → 404+ PASS
   ├── npm run lint → 에러 0
   └── npm run build → 성공
       ↓
2. Phase B: 학습 리뷰 (5개 개념)
   ├── 개념 1: Factory + Strategy 실전 적용 (🔴)
   ├── 개념 2: 프롬프트 엔지니어링 (🔴)
   ├── 개념 3: Server Action AI 호출 패턴 (🟡)
   ├── 개념 4: useTransition + Server Action (🟢)
   └── 개념 5: Zod + AI 타입 연동 (🟡)
       ↓
3. Phase C: 이해도 질문 5개 (사용자 답변 대기)
       ↓
4. Phase D: 직접 구현 추천 전달
       ↓
5. Phase E: 문서 업데이트 + 커밋
```
