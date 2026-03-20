# 기출문제 추출 상세 계획 — 범위 리뷰

> 리뷰어: scope-reviewer
> 대상: docs/plan/extraction-step1~8.md (v9 상세)
> 일자: 2026-03-20

---

## 요약

8개 Step 상세 계획 전반은 마스터 PLAN(v9)과 일관되게 작성되었으며, Task 분해 크기·파일 소유권·역할 경계·Wave 구조 모두 대체로 적절하다. MUST FIX 이슈는 없고, 구현 전에 명확히 해두면 좋은 SHOULD FIX 3건과 CONSIDER 4건을 발견했다.

**전체 판정: READY** (SHOULD FIX는 구현자가 착수 전 확인 수준)

---

## Step별 이슈

---

### Step 1 — 3계층 스키마

#### SHOULD FIX 1: `past_exam_images` UPDATE RLS가 실제로 필요한가

`Task 1.5`에 `past_exam_images_update_teacher` 정책이 정의되어 있다. 그러나 현재 계획 어디에도 `past_exam_images`를 직접 UPDATE하는 Action이 없다 (`createPastExamAction`은 DELETE → INSERT 패턴, 이미지 순서 변경도 DnD 후 FormData 재전송). UPDATE 정책이 없어도 동작하지만, 있으면 미래 확장을 위한 것임을 명시하지 않으면 혼란의 여지가 있다.

- **권고**: 정책 주석에 "현재 Action에서 직접 사용하지 않음. page_number 갱신 등 미래 확장을 위해 선제적으로 추가." 한 줄 추가.

#### CONSIDER 1: `supabase gen types` 실행 주체가 불명확

Step 1 완료 직후 `npx supabase gen types typescript --local > src/types/supabase.ts` 실행이 필요하다. 이 명령은 db-schema 역할의 완료 기준(체크리스트 마지막 항목)에 포함되어 있으나, 실제 로컬 Supabase 컨테이너 기동 여부·Cloud 적용 타이밍(기존 마이그레이션 00005처럼 수동 적용 필요)은 명시되지 않았다. Step 1 리스크 표에 "Supabase Cloud 미적용 → 수동 적용 필요" 항목이 있으나, db-schema 워커가 이 작업을 수행할 수 있는지 리드 판단이 필요하다.

---

### Step 2 — 기존 코드 리팩토링

#### SHOULD FIX 2: 역할 경계 — 복합 역할 Task가 병렬 구현 시 충돌 위험

`Step 2`의 소유 역할이 "복합 (backend-actions, frontend-ui, tester)"으로 표기되어 있다. 마스터 PLAN의 Wave 구조에서 Step 2는 Wave 2에서 단독 Step으로 배치되어 있어 실질적으로 단일 워커가 처리하는 구조다. 그런데 상세 계획의 Phase A→B→C→D 순서를 보면 Action → Test → Validation → UI 순서로 이어지며, 이를 별도 워커에게 병렬 할당하면 `PastExamListItem` 타입 변경 연쇄로 충돌이 발생한다.

- **권고**: Step 2는 반드시 단일 워커(또는 리드)가 Phase 순서를 따라 순차 처리함을 명시. "병렬 불가 — 단일 워커 전담" 주석을 상세 문서 상단에 추가.

#### CONSIDER 2: `uploadPastExamAction` deprecated → Step 6까지 유지 기간 명시

Step 2에서 `uploadPastExamAction`은 deprecated 주석만 추가하고 Step 6 완료까지 유지한다. 이 결정은 합리적이나, 유지 기간이 Wave 3 완료 시점임을 명시해 두지 않으면 다른 워커가 조기 삭제를 시도할 수 있다.

- **권고**: `uploadPastExamAction` deprecated 주석에 `@deprecated Step 6(upload-form.tsx createPastExamAction 전환) 완료 후 삭제 예정. Wave 3 완료 전까지 유지.` 명시.

---

### Step 3 — AI 타입 + 프롬프트 + GeminiProvider

#### CONSIDER 3: `figureInfoSchema`에 `url` 필드 부재 — 의도적 설계지만 주석 필요

`Task 3.2`의 `figureInfoSchema`에는 `url` 필드가 없다. 이는 AI 응답에서는 url이 존재하지 않고(crop 전이므로), Step 5에서 crop 후 `url`을 채우는 설계이기 때문이다. 이 결정은 `validateExtractedQuestions` 함수 내에서 `url: null`로 초기화하는 코드로 구현된다. 의도적인 설계이나 구현자가 "왜 스키마에 url이 없는가?"를 오해하지 않도록 Zod 스키마 상단에 주석이 필요하다.

- **권고**: `figureInfoSchema` 정의 위에 `// url은 AI 응답에 포함되지 않음 — crop 전이므로 null로 초기화 (Step 5 extractQuestionsAction에서 채움)` 주석 추가.

---

### Step 4 — 시험 생성 Action

#### SHOULD FIX 3: `createPastExamAction` — 이미지 업로드 실패 시 고아(orphan) exam 레코드 cleanup 로직이 의사코드에서 "간략화" 처리됨

Task 4.2 의사코드의 이미지 업로드 실패 처리 부분에:
```
// 업로드 실패 시 이미 업로드된 파일 정리 + exam 삭제
// (간략화: 실제 구현 시 cleanup 로직 추가)
return { error: '이미지 업로드에 실패했습니다. 다시 시도해주세요.' }
```
라고 명시되어 있다. 리스크 표에도 "past_exams INSERT 후 이미지 업로드 실패 시 고아 exam 레코드"가 Low 리스크로 표기되어 있다.

문제는 cleanup 로직을 "실제 구현 시 추가"로 미루면, 구현자가 누락할 가능성이 높다. 특히 테스트 케이스 11번("Storage 업로드 실패 → 에러 + cleanup")이 이미 요구하고 있어 구현 시 반드시 처리해야 한다.

- **권고**: 의사코드에서 "간략화" 주석을 제거하고, 구체적인 cleanup 흐름을 명시:
  ```
  // 업로드 실패 시:
  // 1. 이미 업로드된 Storage 파일 삭제 (adminClient, Non-blocking)
  // 2. past_exams DELETE (exam 레코드 삭제)
  // 3. 에러 반환
  ```

---

### Step 5 — 추출 + crop + 재추출 + 재분석

**이슈 없음.** 파일 소유권(backend-actions 단일), 테스트 2파일 분리, Optimistic Lock, try/finally, Non-blocking Storage 삭제, buildImageParts 공유 함수 패턴 모두 적절하다.

파일 크기 예상: extract-questions.ts ~400줄, reanalyze-question.test.ts ~100줄 — 상한(800줄) 내에 있다.

---

### Step 6 — 업로드 UI

#### CONSIDER 4: Vercel body size limit (4.5MB default) — 리스크 표에 있으나 해결 방법 미명시

Step 6 리스크 표에 "20장 이미지 한 번에 FormData 전송 용량 → Vercel body size limit (4.5MB default) 확인 필요 — 필요 시 next.config.js에서 bodyParser 설정"이 언급되어 있다. 그러나 이미지 개별 5MB + 총 100MB 상한은 Vercel 기본 body limit(4.5MB)을 이미 훨씬 초과한다. 즉, 이 제약을 해결하지 않으면 MVP 자체가 동작하지 않는다.

- **권고**: "Vercel body size limit" 이슈를 CONSIDER가 아닌 구현 전 반드시 해결할 사항으로 격상. 상세 계획에 해결 방법 명시:
  ```javascript
  // next.config.js
  experimental: {
    serverActions: {
      bodySizeLimit: '110mb',  // 총 100MB + 오버헤드 여유
    },
  }
  ```
  또는 Server Action 대신 API Route(`/api/upload`) + `FormData` 스트리밍 방식으로 전환 검토.

  이 이슈가 해결되지 않으면 Step 6 자체가 동작하지 않으므로 Wave 3 착수 전 리드 확인 필수.

---

### Step 7 — 편집 UI

**이슈 없음.** Task 분해(7.1~7.9)가 적절한 크기로 분해되어 있으며, 파일 크기 예상(~500-600줄)도 상한 내다. 600줄 초과 시 분리 대상(question-card.tsx, image-sidebar.tsx, editor-toolbar.tsx)이 미리 정의되어 있어 구현자가 판단 기준을 명확히 알 수 있다.

`extractQuestionsAction` 반환 타입: Task 7.9의 useEffect에서 `result.data?.questions`를 참조하는데, Step 5의 `extractQuestionsAction`은 `{ error?: string }` 형태만 반환하고 `data.questions`를 반환하지 않는다. 추출 완료 후 UI에서 `past_exam_details`를 별도 조회해야 하는지, 아니면 Action 반환에 포함할 것인지가 불명확하다.

**단, 이 이슈는 마스터 PLAN에서도 동일하게 미결이므로 scope-reviewer 범위 외 사항(기술적 API 설계)** — tech-reviewer가 별도 리뷰해야 한다.

---

### Step 8 — 빌드 검증 + 학습 리뷰

**이슈 없음.** 수동 테스트 8개 시나리오, 회귀 확인 9개 항목, 학습 리뷰 10개 토픽, 이해도 질문 5개가 체계적으로 정의되어 있다. 파일 크기 검증 명령도 포함되어 있다.

---

## 이슈 요약 표

| # | Step | 분류 | 이슈 |
|---|------|------|------|
| 1 | Step 1 Task 1.5 | SHOULD FIX | `past_exam_images` UPDATE RLS 존재 이유 주석 미명시 |
| 2 | Step 2 | SHOULD FIX | 복합 역할 Task의 병렬 불가 명시 누락 |
| 3 | Step 4 Task 4.2 | SHOULD FIX | 이미지 업로드 실패 시 orphan exam cleanup 로직 "간략화" 처리 |
| 4 | Step 1 | CONSIDER | `supabase gen types` 실행 주체·환경 불명확 |
| 5 | Step 2 | CONSIDER | `uploadPastExamAction` deprecated 유지 기간 미명시 |
| 6 | Step 3 Task 3.2 | CONSIDER | `figureInfoSchema`에 `url` 미포함 이유 주석 필요 |
| 7 | Step 6 | CONSIDER (격상 권고) | Vercel body size limit(4.5MB) 초과 — 해결 방법 미명시 |

---

## Plan Review Completion Checklist

| 항목 | 상태 | 비고 |
|------|------|------|
| 모든 Task의 파일 소유권이 명확하다 | ✅ | Step별 소유 역할 명시됨 |
| Task 간 의존성 순서가 정의되었다 | ✅ | Wave 1~5 구조 + Phase A→B→C→D 순서 정의됨 |
| 외부 의존성(라이브러리, API)이 명시되었다 | ✅ | sharp, @dnd-kit/*, Gemini Vision API 명시됨 |
| 에러 처리 방식이 정해졌다 | ✅ | `{ error? }` 반환, try/finally 롤백, Non-blocking Storage 삭제 |
| 테스트 전략이 있다 | ✅ | 총 21개 이상 테스트 케이스, 파일 분리 근거 명시됨 |
| 이전 Phase 회고(`docs/retrospective/`)의 교훈이 반영되었다 | ✅ | MEMORY.md 교훈 다수 반영 확인 (`.uuid()` → `.min(1)`, Radix Select uncontrolled, etc.) |
| 병렬 구현 시 파일 충돌 가능성이 없다 | ⚠️ | Step 2 복합 역할이 병렬 불가임을 명시 필요 (SHOULD FIX 2) |

**판정: READY**

SHOULD FIX 3건 중 Step 4의 cleanup 로직(SHOULD FIX 3)과 Step 6의 Vercel body size limit(CONSIDER 4, 격상 권고)은 구현 착수 전 리드 확인이 권장되나, Plan 자체의 구조적 완성도는 충분하다. 구현 단계로 이동 가능.

---

> **추가 권고 (리드에게)**: Step 6 착수 전 `next.config.js`의 `bodySizeLimit` 설정 여부를 반드시 확인할 것. 이 설정이 누락되면 다중 이미지 업로드 자체가 동작하지 않는다.
