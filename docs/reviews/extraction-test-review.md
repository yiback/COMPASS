# 기출문제 추출 — 테스트 리뷰

> 리뷰어: test-reviewer
> 일자: 2026-03-20

---

## 요약

기출문제 추출 기능(세션 25)의 구현 코드 10개 파일과 테스트 코드 11개 파일을 대조 분석한 결과, 전반적으로 테스트 커버리지가 양호하다. 핵심 흐름(Optimistic Lock, try/finally 롤백, crop 부분 실패, Non-blocking Storage, 재분석 AI 에러 처리)은 모두 테스트되어 있다. 그러나 일부 에러 분기와 엣지 케이스가 누락되어 있으며, 특히 `extractQuestionsAction`의 Mock 설계 결함으로 인해 `try/finally` 롤백 테스트가 실제로는 검증되지 않는 심각한 문제가 있다.

**전체 판정: SHOULD FIX 2건, CONSIDER 4건**

---

## 커버리지 매트릭스

| 구현 파일 | 테스트 파일 | 커버 상태 |
|-----------|-------------|-----------|
| `src/lib/actions/extract-questions.ts` | `extract-questions.test.ts`, `reanalyze-question.test.ts` | 부분 커버 (MUST FIX 포함) |
| `src/lib/actions/exam-management.ts` | `exam-management.test.ts` | 양호 |
| `src/lib/actions/past-exams.ts` | `past-exams.test.ts` | 범위 외 (리팩토링 기존 테스트) |
| `src/lib/actions/generate-questions.ts` | `generate-questions.test.ts` | 범위 외 (리팩토링 기존 테스트) |
| `src/lib/actions/save-questions.ts` | `save-questions.test.ts` | 양호 |
| `src/lib/ai/extraction-validation.ts` | `extraction-validation.test.ts` | 우수 |
| `src/lib/ai/prompts/question-extraction.ts` | `question-extraction.test.ts` | 양호 |
| `src/lib/ai/gemini.ts` | `gemini.test.ts` | 양호 |
| `src/lib/validations/exam-management.ts` | `exam-management.test.ts` (validations) | 양호 |
| `src/lib/validations/extract-questions.ts` | `extract-questions.test.ts` (validations) | 우수 |

---

## 이슈 목록

---

### [severity: high] SHOULD FIX — `try/finally` 롤백 테스트가 Mock 설계 결함으로 실제 검증 불가

- **구현 위치**: `src/lib/actions/extract-questions.ts` 라인 383–391
- **테스트 파일**: `src/lib/actions/__tests__/extract-questions.test.ts` 라인 328–367
- **누락된 테스트**: `extractQuestionsAction`의 Mock 설계에서 `mockUpdatePastExamsCompleted`가 Optimistic Lock 체이닝(`update().eq('id').in().select()`)과 status 업데이트(`update().eq('id')`)를 동일한 `mockReturnValue`로 처리한다. 구체적으로, `eq('id', ...)` 콜백 내부에서 두 갈래가 구분되지 않아 `finally` 블록의 실제 업데이트 호출 여부를 올바르게 단정할 수 없다. 현재 테스트에서 `mockUpdatePastExamsCompleted`가 `{ extraction_status: 'failed' }`로 호출되었는지 확인하지만, Mock 구조상 Optimistic Lock 업데이트 경로와 status 업데이트 경로가 혼재한다.
- **영향**: AI API 에러 발생 시 `extraction_status`가 실제로 `'failed'`로 롤백되지 않아도 테스트가 통과할 수 있음. 프로덕션에서 처리 중 상태가 영구적으로 유지될 위험.

---

### [severity: high] SHOULD FIX — `extractQuestionsAction` INSERT 실패 시 `try/finally` 롤백 테스트 누락

- **구현 위치**: `src/lib/actions/extract-questions.ts` 라인 364–391
- **테스트 파일**: `src/lib/actions/__tests__/extract-questions.test.ts`
- **누락된 테스트**: `past_exam_details` INSERT가 실패(`insertError` 반환)했을 때 `finally` 블록에서 `extraction_status = 'failed'`로 롤백되는지 테스트가 없다. 현재 AI 에러 케이스만 테스트되어 있고, DB INSERT 실패 케이스는 누락되어 있다.
- **영향**: INSERT 실패 시 `extraction_status`가 `'processing'` 상태로 영구 고착될 수 있음. 이 경우 사용자가 재추출을 시도해도 Optimistic Lock에 의해 차단됨.

---

### [severity: medium] CONSIDER — `buildImageParts` 내부 Signed URL 생성 실패 시 동작 미테스트

- **구현 위치**: `src/lib/actions/extract-questions.ts` 라인 127–128 (`buildImageParts`)
- **테스트 파일**: `src/lib/actions/__tests__/reanalyze-question.test.ts`
- **누락된 테스트**: `reanalyzeQuestionAction`에서 `buildImageParts` 호출 시 `createSignedUrl`이 `null`이나 에러를 반환하는 경우 테스트가 없다. `extractQuestionsAction`에서는 `signedUrlData?.signedUrl` 없으면 `continue` 처리하지만, `buildImageParts` 코드(`signedUrlData!.signedUrl` — non-null assertion)에서는 예외가 발생할 수 있다.
- **영향**: Signed URL 생성 실패 시 `reanalyzeQuestionAction`이 런타임 에러를 던질 수 있음. `catch` 블록에서 처리되지만 테스트로 검증되지 않음.

---

### [severity: medium] CONSIDER — `extractQuestionsAction`에서 이미지 0장(빈 배열) 케이스 미테스트

- **구현 위치**: `src/lib/actions/extract-questions.ts` 라인 241–243
- **테스트 파일**: `src/lib/actions/__tests__/extract-questions.test.ts`
- **누락된 테스트**: `past_exam_images` 조회 결과가 빈 배열(`[]`)일 때 `throw new Error('변환 가능한 이미지가 없습니다.')` 후 `finally`에서 `'failed'` 롤백이 올바르게 수행되는지 테스트가 없다. 현재 이미지 데이터가 항상 1장 이상 존재하는 케이스만 테스트되어 있다.
- **영향**: 이미지 없는 시험 데이터가 DB에 존재할 경우 에러 흐름 검증 부재.

---

### [severity: medium] CONSIDER — `reanalyzeQuestionAction` DB UPDATE 실패 케이스 미테스트

- **구현 위치**: `src/lib/actions/extract-questions.ts` 라인 586–589
- **테스트 파일**: `src/lib/actions/__tests__/reanalyze-question.test.ts`
- **누락된 테스트**: `supabase.from('past_exam_details').update().eq()` 호출이 에러를 반환했을 때 `{ error: '문제 업데이트에 실패했습니다.' }` 응답을 반환하는 테스트가 없다. 현재 AI 에러(catch) 케이스만 테스트되어 있다.
- **영향**: DB UPDATE 실패 시 클라이언트에 올바른 에러가 반환되는지 검증 불가.

---

### [severity: low] CONSIDER — `extraction-validation.ts`에서 `questionNumber` 0인 경우 테스트 누락

- **구현 위치**: `src/lib/ai/extraction-validation.ts` 라인 35 (`z.number().int().min(1)`)
- **테스트 파일**: `src/lib/ai/__tests__/extraction-validation.test.ts`
- **누락된 테스트**: `extractedQuestionSchema`에서 `questionNumber: 0`인 경우 `AIValidationError`를 던지는 테스트가 없다. `questionNumber: 1.5` (비정수) 케이스는 있지만 경계값 0은 누락.
- **영향**: 영향도 낮음. Zod 스키마가 올바르게 정의되어 있으므로 실제 버그 발생 가능성은 낮지만, 경계값 커버리지 미비.

---

### [severity: low] CONSIDER — `gemini.test.ts`에서 `reanalyzeQuestion` 0개 문제 반환 케이스 미테스트

- **구현 위치**: `src/lib/ai/gemini.ts` 라인 250–253
- **테스트 파일**: `src/lib/ai/__tests__/gemini.test.ts`
- **누락된 테스트**: `reanalyzeQuestion`에서 AI가 빈 배열(`questions: []`)을 반환했을 때의 `AIValidationError` 처리 테스트가 없다. 현재 2개 문제 반환(초과) 케이스는 있지만 0개(미달) 케이스는 없다.
- **영향**: `result.questions[0]`에 `undefined`가 반환될 수 있으나 `AIValidationError`가 먼저 던져지므로 실제 위험도는 낮음.

---

## 커버리지 요약

| 점검 항목 | 상태 |
|-----------|------|
| 에러 경로 — 인증 실패 | 커버됨 |
| 에러 경로 — Zod 검증 실패 | 커버됨 |
| 에러 경로 — DB 에러 (일부) | 부분 커버 (INSERT 실패 롤백 미테스트) |
| 에러 경로 — AI API 에러 | 커버됨 |
| 엣지 케이스 — 이미지 0장/20장/21장 | 부분 커버 (0장 추출 롤백 미테스트) |
| Optimistic Lock 테스트 | 커버됨 |
| try/finally 롤백 테스트 | Mock 설계 결함으로 완전 검증 불확실 |
| crop 부분 실패 테스트 | 커버됨 |
| Non-blocking Storage 테스트 | 커버됨 |
| 구현/테스트 불일치 | buildImageParts non-null assertion 미테스트 |
