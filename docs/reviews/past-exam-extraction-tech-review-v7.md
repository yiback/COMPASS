# 기출문제 추출 계획 v7 — 기술 리뷰

> 리뷰어: technical-reviewer
> 대상: docs/plan/20260308-past-exam-extraction.md (v7)
> 일자: 2026-03-19
> 이전 리뷰: docs/reviews/past-exam-extraction-tech-review-v6.md

---

## 요약

v6 기술 리뷰의 MUST FIX 3건과 SHOULD FIX 4건이 v7 PLAN에 모두 반영되었다. 이 중 일부는 v7 자체에서 추가 이슈를 제기하여 재반영(MUST FIX 1, 4, 5; SHOULD FIX 6, 7, 8, 9)한 것으로 확인된다. 전반적으로 v7은 구현 착수 가능 수준에 근접했으나, **새 마이그레이션과 기존 테이블의 UNIQUE 제약 충돌 가능성**, **Storage 경로 구조 변경 미반영**, **`reanalyzeQuestionAction`의 테스트 커버리지 공백**이 구현 착수 전 검토되어야 한다.

---

## v6 이슈 반영 확인

| v6 이슈 | 분류 | v7 반영 여부 | 비고 |
|---------|------|------------|------|
| figures crop 업로드 클라이언트 미명시 | MUST FIX 1 | ✅ 반영 | Step 5에 `createAdminClient()` 명시, 결정사항 표에도 기록 |
| finally 블록 상태 변수 출처 불명확 | MUST FIX 2 | ✅ 반영 | `isCompleted` 플래그 패턴 Step 5에 코드 스니펫으로 명시 |
| `extracted_content` 컬럼 소실 | MUST FIX 3 | ✅ 반영 | Step 2에서 `past_exam_details JOIN + question_text 집합` 방식 결정 및 코드 스니펫 포함 |
| Optimistic Lock 구현 패턴 미명시 | SHOULD FIX 4 | ✅ 반영 | `.update().in().select('id')` + 빈 배열 체크 패턴 Step 5에 명시 |
| sharp 의존성 위치 오류 | SHOULD FIX 5 | ✅ 반영 | Step 4에서 제거, Step 5로 이동. 결정사항 표에 명시 |
| Wave 2 타입 업데이트 타이밍 미명시 | SHOULD FIX 6 | ✅ 반영 | Wave 1 마지막 작업으로 `supabase gen types` 명시 |
| LaTeX 렌더링 결정 누락 | CONSIDER 7 | ✅ 반영 | "MVP: raw LaTeX 표시 / Phase 2: KaTeX" 결정사항 표에 기록 |
| raw_ai_response 크기 제한 미설정 | CONSIDER 8 | ✅ 반영 | "Phase 2 회고 시 재검토" 결정사항 표에 기록 |
| 마이그레이션 롤백 SQL 미포함 | CONSIDER 9 | ✅ 반영 | Step 1에 DROP TABLE 순서를 주석으로 기술 |

---

## 새로운 이슈 목록

---

### [MUST FIX] 1. Storage 경로 구조가 신규 3계층에서 달라져야 하나 명시 없음

**위치**: Step 4 / `createPastExamAction` 작업 설명 / Step 5 아키텍처 결정 섹션

**문제**:
기존 `past-exams.ts:235`의 Storage 경로 구조는 다음과 같다:
```
{academyId}/{schoolId}/{year}-{semester}-{examType}/{fileId}.{ext}
```
그런데 3계층 구조에서는 1 시험(past_exams)에 N개의 이미지(past_exam_images)가 속한다. PLAN v7은 "crop 이미지는 `past-exams/{academyId}/figures/`에 저장"한다고 명시하지만, **원본 시험 이미지의 경로 구조가 달라지는지(pastExamId 포함 여부, page_number 포함 여부)를 명시하지 않는다**.

기존 경로는 파일별 UUID였으나, 신규 구조에서는 여러 이미지가 같은 시험에 속한다. 경로가 기존 패턴을 그대로 따르면 시험과 이미지 간의 경로 연계가 불분명해지고, 나중에 시험 단위로 파일을 일괄 삭제하거나 찾을 때 어려움이 있다.

**제안**:
Step 4의 작업 설명에 원본 시험 이미지 Storage 경로 구조를 명시:
```
원본 이미지: {academyId}/{pastExamId}/{page_number}-{fileId}.{ext}
crop 이미지: {academyId}/{pastExamId}/figures/{detailId}-{figureIndex}.jpg
```
혹은 기존 패턴 유지 결정이라면 그 이유를 PLAN에 기록.
<!-- NOTE: 제안대로 진행 -->
---

### [MUST FIX] 2. `past_exam_images` UNIQUE 제약 미정의 — 동일 시험 동일 page_number 중복 삽입 가능

**위치**: Step 1 / `past_exam_images` 테이블 DDL

**문제**:
PLAN v7 스키마:
```sql
CREATE TABLE past_exam_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  past_exam_id UUID NOT NULL REFERENCES past_exams(id) ON DELETE CASCADE,
  academy_id UUID NOT NULL REFERENCES academies(id),
  page_number INTEGER NOT NULL,
  source_image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
`(past_exam_id, page_number)` 조합에 UNIQUE 제약이 없다. 이미지 업로드 재시도(네트워크 오류 등) 또는 버그로 인해 동일 시험에 동일 `page_number`를 가진 이미지가 중복 삽입될 수 있다. 이후 AI 추출 시 `ORDER BY page_number ASC` 결과에 중복 row가 포함되어 동일 페이지를 두 번 분석하게 된다.

**제안**:
```sql
UNIQUE(past_exam_id, page_number)
```
추가. 단, 재업로드 시나리오(사용자가 같은 페이지를 다른 이미지로 교체)를 허용하려면 INSERT 전 DELETE 또는 UPSERT 전략을 `createPastExamAction`에 명시.
<-- NOTE: 제안대로 진행 -->
---

### [MUST FIX] 3. `reanalyzeQuestionAction`의 테스트 전략 불완전 — Step 7에서 신규 Server Action이 테스트 없이 구현됨

**위치**: Step 7 / 테스트 전략 섹션

**문제**:
PLAN v7은 `reanalyzeQuestionAction`을 Step 7(편집 UI)로 이동하면서 "Step 7 구현 시 추가"라고만 명시하고 구체적인 테스트 파일과 테스트 항목을 나열하지 않는다. 테스트 전략 표에서도 "extraction-editor 통합 테스트"만 언급되어 단위 테스트가 없다.

현재 코드베이스의 모든 Server Action은 `src/lib/actions/__tests__/` 하위에 단위 테스트를 갖추고 있다(past-exams.test.ts, generate-questions.test.ts, exam-management.test.ts 예정 등). `reanalyzeQuestionAction`만 UI 통합 테스트에 의존하는 것은 기존 테스트 패턴과 불일치하며, Action 레벨 에러(인증 실패, Optimistic Lock, AI 오류) 검증이 빠진다.

**제안**:
- `src/lib/actions/__tests__/extract-questions.test.ts`에 `reanalyzeQuestionAction` 테스트 케이스 추가(파일 공유 또는 별도 파일)를 Step 7에 명시
- 테스트 항목: 인증 확인, 단일 문제 재분석 + UPDATE, AI 오류 처리
<!-- NOTE: 제안대로 진행 -->
---

### [SHOULD FIX] 4. `past_exam_details` INSERT 와 `extraction_status = 'completed'` UPDATE가 트랜잭션 없이 분리됨

**위치**: Step 5 / `extractQuestionsAction` 작업 설명 3e단계

**문제**:
현재 PLAN의 흐름:
```
3e. 성공: past_exam_details INSERT + extraction_status='completed'
```
이 두 작업은 순차적 독립 쿼리로, INSERT 성공 후 status UPDATE가 실패하면 `past_exam_details`에 데이터가 있지만 `extraction_status`는 여전히 `processing`으로 남는다. `isCompleted` 플래그 + `try/finally`는 예외 발생 시 `failed`로 롤백하지만, INSERT 성공 + UPDATE 실패의 부분 성공 케이스는 `isCompleted = false` 경로를 타지 않는다(INSERT가 에러를 throw하지 않았으므로).

Supabase JS Client는 단일 요청 트랜잭션을 지원하지 않는다. 그러나 이 케이스의 처리 방안(재추출 시 기존 details DELETE 후 재삽입 등)을 명시해야 한다.

**제안**:
Step 5에 다음 중 하나를 명시:
1. `past_exam_details INSERT` + `status UPDATE`를 하나의 RPC 함수로 묶어 DB 트랜잭션 보장
2. 또는 "INSERT 성공 후 UPDATE 실패 시 `extraction_status`가 `processing`으로 남는다 → 재추출 시 기존 details 삭제 후 재삽입" 처리 방안을 명시하고 `confirmExtractedQuestions` 또는 재추출 Action에서 이 케이스를 방어
<!-- NOTE: 2로 진행 -->
---

### [SHOULD FIX] 5. 전체 재추출 시 기존 `past_exam_details` 삭제 처리가 어느 Action에서 수행되는지 불명확

**위치**: Step 7 / 사용자 워크플로우 / `[전체 재추출]` 버튼 설명

**문제**:
사용자가 [전체 재추출]을 클릭하면:
1. 기존 `past_exam_details` 삭제
2. `extraction_status = 'pending'`으로 업데이트
3. useEffect가 트리거되어 추출 재시작

1번과 2번이 어떤 Server Action에서 수행되는지 PLAN에 명시가 없다. `extractQuestionsAction`에서 처리하는지, 별도 `resetExtractionAction`을 만드는지, `confirmExtractedQuestions`의 변형인지 불분명하다. 구현자가 파일 소유권(Step 4의 `exam-management.ts` vs Step 5의 `extract-questions.ts`)을 판단하기 어렵다.

**제안**:
Step 7에 `resetExtractionAction(pastExamId)` 또는 이에 상응하는 처리를 명시하고, 해당 Action의 파일 소유권(어느 파일에 위치하는지)을 표에 추가.
<!-- NOTE: 제안대로 진행 -->
---

### [SHOULD FIX] 6. `past_exam_images.academy_id` 중복 컬럼 — 정규화 원칙과 불일치

**위치**: Step 1 / `past_exam_images` 테이블 DDL

**문제**:
`past_exam_images`는 `past_exam_id`를 통해 `past_exams.academy_id`에 접근할 수 있음에도 `academy_id` 컬럼을 중복으로 포함한다. `past_exam_details`도 동일하다. PLAN은 이유로 "RLS 정책 일관성"을 암묵적으로 전제하는 것 같으나 명시적 설명이 없다.

기존 코드베이스에서 `past_exam_questions`, `questions`, `students`, `teachers` 등도 `academy_id`를 각 테이블에 직접 보유하는 패턴을 따르므로 이 패턴 자체는 프로젝트 관행과 일치한다. 그러나 RLS 정책 작성 시 이 컬럼을 사용해야 함을 Step 1 주석에 명시해야 한다. 그렇지 않으면 구현자가 RLS를 `past_exam_id → past_exams.academy_id` 방식으로 작성하여 JOIN 비용이 발생한다.

**제안**:
Step 1 DDL 주석에 "RLS 정책은 직접 보유한 `academy_id`를 사용 (JOIN 불필요)" 설명 추가.
<!-- NoTE: 제안대로 진행 -->
---

### [CONSIDER] 7. `past_exam_details`에 `source_image_numbers` 컬럼 제거 결정 타당성 재확인

**위치**: 결정사항 표 / `source_page_numbers 컬럼 생략` 결정

**문제**:
PLAN은 "figures[].pageNumber + 앞 페이지로 추적 가능, MVP에 불필요"로 이 컬럼을 제거했다. 그러나 `hasFigure = false`인 일반 텍스트 문제(객관식, 단답형)가 페이지 경계에 걸쳐 있을 때(Q5 문제 설명이 page 2, 보기가 page 3), `figures`가 없으면 어느 이미지를 참조해야 하는지 추적 불가하다. 편집 UI에서 "좌측 이미지 + 우측 문제 카드"를 동기화하려면 문제가 속한 페이지 정보가 필요하다.

**제안**:
편집 UI(Step 7) 구현 시 이 정보가 실제로 필요한지 확인 후 결정. 필요하다면 `source_image_numbers INTEGER[]` 또는 최소 `source_page_start INTEGER` 컬럼을 추가. 필요 없다면 편집 UI에서 어떻게 이미지와 문제를 연계하는지 PLAN에 명시 필요.
<!-- NOTE: page no는 앞 페이지를 따른다. -->
---

### [CONSIDER] 8. Gemini Vision API 이미지당 토큰 제한 및 총 입력 한도 대응 방안 불충분

**위치**: 리스크 섹션 / "Gemini API 토큰 제한" 완화 방안

**문제**:
PLAN은 "이미지 수 초과 시 배치 분할"을 완화 방안으로 제시하나, 언제 배치를 분할하는지(이미지 수 기준? 파일 크기 기준?), 배치 분할 후 결과를 어떻게 합치는지(question_number 연속성 보장 방법)가 명시되지 않았다.

Gemini 1.5 Pro 기준 Vision API는 이미지당 약 258 토큰 소모 + 이미지 해상도에 따라 추가 토큰 소모가 있다. 20장 5MB 이미지가 한계라고 PLAN에 명시되어 있으나, 이 한계 초과 시 클라이언트에게 어떤 에러를 반환하는지(업로드 단계에서 차단? 추출 단계에서 오류 반환?) 명시가 없다.

**제안**:
`createPastExamAction`에서 이미지 수와 총 파일 크기를 사전 검증하여 초과 시 업로드 단계에서 차단. Zod 검증 스키마(`exam-management.ts`)에 이미지 수 상한(예: 20장) + 총 용량 상한(예: 100MB) 조건 추가를 명시.
<!-- NoTE: 제안대로 진행 -->
---

## Plan Review Completion Checklist

- [x] 모든 Task의 파일 소유권이 명확하다
  - 단, `reanalyzeQuestionAction`의 테스트 파일 소유권 미명시 (MUST FIX 3)
  - 전체 재추출 Action의 파일 소유권 미명시 (SHOULD FIX 5)
- [x] Task 간 의존성 순서가 정의되었다 — Wave 1~5 명확
- [x] 외부 의존성(라이브러리, API)이 명시되었다 — sharp, dnd-kit, Gemini SDK
- [x] 에러 처리 방식이 정해졌다 — isCompleted 플래그, try/finally, Optimistic Lock 패턴
  - 단, INSERT + UPDATE 부분 성공 케이스 처리 방안 미명시 (SHOULD FIX 4)
- [x] 테스트 전략이 있다
  - 단, `reanalyzeQuestionAction` 단위 테스트 누락 (MUST FIX 3)
- [ ] 이전 Phase 회고(`docs/retrospective/`)의 교훈이 반영되었다
  - `docs/retrospective/` 디렉토리 미존재 — v6 리뷰와 동일한 상태
- [x] 병렬 구현 시 파일 충돌 가능성이 없다 — Wave 설계 기준 충돌 없음

**판정: READY (조건부)**

MUST FIX 3건을 PLAN에 반영한 후 구현 착수 가능:

1. **Storage 경로 구조 명시** — 원본 시험 이미지의 신규 경로 패턴 결정 및 Step 4에 기록 (MUST FIX 1)
2. **`(past_exam_id, page_number)` UNIQUE 제약 추가** — 중복 삽입 방어 (MUST FIX 2)
3. **`reanalyzeQuestionAction` 단위 테스트 파일 및 항목 명시** — Step 7에 테스트 계획 추가 (MUST FIX 3)

SHOULD FIX는 구현 중 처리 가능하나, SHOULD FIX 4(트랜잭션 부재)와 SHOULD FIX 5(재추출 Action 위치)는 구현 착수 전 팀 내 결정 권장.
