# 기출문제 추출 계획 v9 — 기술 리뷰

> 리뷰어: technical-reviewer
> 대상: docs/plan/20260308-past-exam-extraction.md (v9)
> 일자: 2026-03-20
> 이전 리뷰: docs/reviews/past-exam-extraction-tech-review-v8.md

---

## 요약

v8 Tech Review의 SHOULD FIX 2건 + CONSIDER 2건이 v9에 모두 반영되었음을 확인했다. 특히 Storage 삭제 Non-blocking 처리, 재업로드 시 Storage 파일 삭제 순서, reanalyze 전체 이미지 전달 이유 명시, Storage RLS 경로 호환성 주석 추가, 테스트 파일 분리 등 v8에서 제기된 모든 이슈가 v9 PLAN에 반드시 반영되었다.

v9에서 새롭게 발견된 기술적 이슈는 다음과 같다: createPastExamAction의 재업로드 Storage 삭제가 Non-blocking으로 처리되지만 DB DELETE와의 순서 보장 방식이 불명확하고, Storage 버킷의 기존 `allowed_mime_types` 제약이 신규 crop 이미지(JPEG) 저장과 완전히 호환되는지 명시가 부족하며, extractQuestionsAction의 `try/finally` 내에서 `past_exam_details INSERT`와 `extraction_status UPDATE`가 원자성 없이 순차 실행되는 부분 성공 시나리오의 실제 방어 방안이 검토 필요하다. MUST FIX 이슈는 없으며, 신규 발견된 이슈는 모두 SHOULD FIX 1건 + CONSIDER 2건이다.

---

## v8 이슈 반영 확인

| v8 이슈 | 분류 | v9 반영 여부 | 확인 위치 |
|---------|------|------------|---------|
| `resetExtractionAction` Storage 삭제 실패 시 처리 방안 미명시 | SHOULD FIX 1 | ✅ 반영 | Step 5 `resetExtractionAction` 3단계: "Storage 삭제 실패 시 Non-blocking으로 처리. 삭제 실패를 무시하고 4단계(DB DELETE)로 계속 진행. orphan 파일은 Phase 2 cleanup job으로 처리." + 결정사항 표 "`(v9 반영) Storage 삭제 실패 처리: Non-blocking`" |
| `createPastExamAction` 재업로드 시 Storage 파일도 함께 삭제해야 함 | SHOULD FIX 2 | ✅ 반영 | Step 4 `createPastExamAction` 6단계: "6a. 기존 past_exam_images 조회 → source_image_url 목록 수집 / 6b. Storage에서 기존 원본 이미지 삭제(admin 클라이언트, Non-blocking) / 6c. past_exam_images DELETE(DB) / 6d. 새 이미지 업로드 + INSERT" |
| `reanalyzeQuestionAction` 전체 이미지 전달 이유 미명시 + 대기시간 대응 | CONSIDER 3 | ✅ 반영 | 아키텍처 결정 4 주석: "전체 이미지 전달 이유 — 페이지 경계를 넘는 문제 가능성 + AI 컨텍스트 일관성 보장. maxDuration = 60 적용 + Step 7 UI에 로딩 표시 필수." |
| `past_exam_images` Storage RLS 경로 호환성 주석 부족 | CONSIDER 4 | ✅ 반영 | Step 1 작업 11번: "Storage RLS 정책이 `split_part(name, '/', 1)` 기반 → 신규 경로 구조(`{academyId}/{pastExamId}/...`)에서도 1번째 경로 컴포넌트(academyId)를 기준으로 검증하므로 동일하게 동작. crop 이미지도 같은 `past-exams` 버킷 사용하므로 동일 RLS 적용." |

---

## 새로운 이슈 목록

---

### [SHOULD FIX] 1. `createPastExamAction` 재업로드 Storage 삭제 Non-blocking 처리와 DB DELETE 순서의 일관성 문제

**위치**: Step 4 / `createPastExamAction` 6단계

**문제**:

v9에서 재업로드 순서가 다음과 같이 명시되었다:
```
6a. 기존 past_exam_images 조회 → source_image_url 목록 수집
6b. Storage에서 기존 원본 이미지 삭제 (admin 클라이언트, Non-blocking — 삭제 실패 시 무시)
6c. past_exam_images DELETE (DB)
6d. 새 이미지 Storage 업로드 → past_exam_images INSERT
```

이 순서에는 다음 시나리오에서 일관성 문제가 발생한다:

**시나리오**: 6b Storage 삭제는 성공했으나, 6c DB DELETE가 실패한 경우.
- Storage에서는 파일이 삭제되었지만, `past_exam_images` 행은 여전히 존재한다.
- 해당 행의 `source_image_url`은 이미 삭제된 Storage 파일을 가리키는 dangling reference가 된다.
- 이후 이 record를 조회하면 Signed URL 생성에 성공하지만 실제 파일이 없어 404가 발생한다.

반면 `resetExtractionAction`에서는 Storage 삭제를 Non-blocking으로 처리하고 "삭제 실패해도 계속 진행"하는 방식을 명시하여, Storage orphan은 Phase 2 cleanup으로 위임하는 전략이 명확하다.

`createPastExamAction`에서도 동일한 위임 전략을 사용한다면, **6b와 6c의 순서를 바꾸는 것**이 더 안전하다:
```
6a. 기존 past_exam_images 조회 → source_image_url 목록 수집
6b. past_exam_images DELETE (DB) — DB 삭제 먼저
6c. Storage에서 기존 원본 이미지 삭제 (Non-blocking — 실패 시 무시, orphan은 Phase 2 cleanup)
6d. 새 이미지 Storage 업로드 → past_exam_images INSERT
```

이 순서라면 DB 일관성이 먼저 보장되고, Storage orphan은 Phase 2 cleanup으로 일관되게 위임할 수 있다.

**제안**:
Step 4에 순서 변경 이유를 명시: "DB DELETE 먼저 실행하여 dangling reference 방지. Storage 삭제는 Non-blocking으로 후속 처리."

---

### [CONSIDER] 2. Storage 버킷 `allowed_mime_types` — crop JPEG 이미지 호환성 확인 필요

**위치**: Step 1 / `supabase/migrations/00005_storage_buckets.sql` (기존)

**문제**:

기존 `00005_storage_buckets.sql`에 정의된 `past-exams` 버킷의 `allowed_mime_types`:
```sql
ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
```

v9 PLAN에서 crop 이미지 경로가 `{academyId}/{pastExamId}/figures/{detailId}-{figureIndex}.jpg`이고, `sharp`로 crop → JPEG 저장한다. `image/jpeg`는 이미 허용 목록에 있으므로 기능적으로는 문제가 없다.

그러나 `sharp().jpeg().toBuffer()`로 생성한 Buffer를 Storage에 업로드할 때 `contentType: 'image/jpeg'`을 명시적으로 전달해야 버킷의 MIME 타입 검증을 통과한다. PLAN에는 crop 이미지 업로드 시 `contentType` 명시 여부가 기술되어 있지 않다.

`createAdminClient()`를 사용하더라도 버킷 레벨 `allowed_mime_types` 제약은 admin 클라이언트에도 적용되는지 확인이 필요하다. (Storage 정책과 달리 버킷 레벨 제약은 서비스 키로도 우회되지 않을 수 있음)

현재 원본 이미지 업로드(`createPastExamAction`) 코드 패턴에서는 `validFile.type`을 `contentType`으로 전달하고 있다. crop 이미지 업로드에서도 동일하게 `'image/jpeg'` 또는 `'image/png'`을 명시해야 한다.

**제안**:
Step 5의 crop 처리 설명에 다음을 추가:
- "Storage 업로드 시 `contentType: 'image/jpeg'` 명시 (sharp 기본 출력 포맷)"
- 또는 "crop 이미지 포맷: JPEG 고정 (파일 크기 vs 품질 트레이드오프에서 JPEG 선택)"

---

### [CONSIDER] 3. `extractQuestionsAction`의 `past_exam_details INSERT`와 `extraction_status UPDATE` 원자성 부재 — 실제 방어 경로 재확인

**위치**: Step 5 / `extractQuestionsAction` 4e~4f 단계 + try/finally 패턴

**문제**:

v8에서 SHOULD FIX 4로 "INSERT 성공 + UPDATE 실패 부분 성공 방어"를 다루었고, v8 PLAN에서 "재추출 시 기존 details DELETE 후 재삽입"으로 방어하기로 결정되었다.

그러나 `extractQuestionsAction`의 현재 흐름을 정확히 따라가면:

```
4e. 성공: past_exam_details INSERT + extraction_status='completed'
    isCompleted = true
finally:
    if (!isCompleted) → extraction_status = 'failed'
```

4e 단계에서 `past_exam_details INSERT`는 성공했지만 `extraction_status = 'completed'` UPDATE가 실패한 경우:
- `isCompleted = true` 대입은 UPDATE 성공 후에 실행되어야 한다. 그런데 PLAN에는 INSERT와 UPDATE의 순서, 그리고 `isCompleted = true` 대입 시점이 명시되어 있지 않다.
- UPDATE 실패 시 `isCompleted`가 false이므로 finally에서 `extraction_status = 'failed'`로 롤백된다.
- 그러나 `past_exam_details` 행들은 INSERT된 채로 남아 있다.
- 이 상태에서 사용자가 재추출을 시도하면 `extractQuestionsAction`에서 "기존 details DELETE 후 재삽입" 방어가 동작해야 한다.

v9 PLAN에서 이 방어 경로가 테스트 항목에 포함되어 있는지 확인:
- `extract-questions.test.ts` 테스트 항목: "기존 details DELETE 후 재삽입 확인" — 포함됨.

다만, `extractQuestionsAction` 내부에서 "INSERT 성공 + UPDATE 실패" 시의 동작을 명시적으로 기술하면 구현자 혼란을 방지할 수 있다.

**제안**:
Step 5 `extractQuestionsAction` 4e 단계에 다음 순서를 명시:
```
4e-1. past_exam_details INSERT (배치)
4e-2. extraction_status = 'completed' UPDATE
4e-3. raw_ai_response 백업 저장 (4f 통합)
// 위 3단계 모두 성공 시에만:
isCompleted = true
```
"INSERT 성공 + UPDATE 실패 시 finally에서 'failed' 롤백 → details는 남아 있음 → 재추출 시 기존 DELETE 후 재삽입으로 방어"를 주석으로 명시.

---

## Plan Review Completion Checklist

- [x] 모든 Task의 파일 소유권이 명확하다
  - Step 1: db-schema (`supabase/migrations/20260315_past_exam_restructure.sql`)
  - Step 2: 카테고리별 소유권 표에 명시 (17개 파일)
  - Step 3: ai-integration (AI 타입 + 프롬프트 + Gemini)
  - Step 4: backend-actions (`exam-management.ts`)
  - Step 5: backend-actions (`extract-questions.ts` — 3개 Action)
  - Step 6: frontend-ui (`upload-form.tsx`, `image-sorter.tsx`)
  - Step 7: frontend-ui (`edit/page.tsx`, `extraction-editor.tsx`)
  - @dnd-kit 의존성: 리드 only (Wave 3 착수 전 package.json 추가 명시)
- [x] Task 간 의존성 순서가 정의되었다 — Wave 1~5 + 의존성 그래프 명확히 명시
- [x] 외부 의존성(라이브러리, API)이 명시되었다
  - `sharp` (Step 5 전용, `runtime = 'nodejs'` + `maxDuration = 60` 명시)
  - `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (Step 6, 리드 추가)
  - Gemini Vision SDK (`@google/genai` 기존 사용)
  - `reanalyzeQuestionAction`에도 `maxDuration = 60` 적용 (v9 반영)
- [x] 에러 처리 방식이 정해졌다
  - `isCompleted` 플래그 + try/finally (`extraction_status = 'failed'` 롤백 보장)
  - Optimistic Lock (`.update().in().select('id')` + 빈 배열 체크)
  - crop 개별 실패: `figure.url = null` (부분 성공)
  - Storage 삭제 실패: Non-blocking (v9 신규 반영, `resetExtractionAction` + `createPastExamAction` 모두)
  - INSERT + UPDATE 부분 성공: 재추출 시 DELETE 후 재삽입
- [x] 테스트 전략이 있다
  - 각 Step별 테스트 파일과 테스트 항목 명시
  - `reanalyze-question.test.ts` 별도 파일 분리 (v9 반영)
  - Storage 삭제 Non-blocking 동작 테스트 케이스 (`resetExtractionAction`) 포함
  - 이미지 수/용량 제한 초과 거부, Optimistic Lock, 기존 details DELETE 후 재삽입 등 핵심 케이스 커버
- [ ] 이전 Phase 회고(`docs/retrospective/`)의 교훈이 반영되었다
  - `docs/retrospective/` 디렉토리 미존재 — 진행 중인 Phase이므로 회고 문서 없음 (v7/v8 리뷰와 동일 상태, 조건부 PASS)
- [x] 병렬 구현 시 파일 충돌 가능성이 없다
  - Wave 설계 기준 Step 간 파일 소유권 명확히 분리
  - Step 6+7 순차 진행으로 layout/공통 import 충돌 방지
  - @dnd-kit 의존성은 Wave 3 착수 전 리드만 추가하도록 명시

**판정: READY**

v8에서 제기된 SHOULD FIX 2건 + CONSIDER 2건이 모두 v9에 반영되었으며, 새로운 MUST FIX 이슈는 발견되지 않았다. 새로 발견된 이슈는 SHOULD FIX 1건(재업로드 Storage와 DB 삭제 순서)과 CONSIDER 2건(crop 업로드 contentType 명시, extractQuestionsAction INSERT+UPDATE 순서 명시)으로, 모두 구현 중 코드 주석 수준에서 처리 가능하다.

구현 착수 전 확인 권장 사항:

1. **SHOULD FIX 1**: `createPastExamAction` 재업로드 시 "DB DELETE 먼저, Storage 삭제 후" 순서로 변경하여 dangling reference 방지. PLAN 또는 코드 주석에 순서 이유 명시.
2. **CONSIDER 2**: Step 5 crop 이미지 업로드 시 `contentType: 'image/jpeg'` 명시를 구현 코드에 포함. PLAN 명시는 선택적.
3. **CONSIDER 3**: `extractQuestionsAction` 4e 단계에서 INSERT → UPDATE → isCompleted = true 순서를 코드 주석으로 명시.
