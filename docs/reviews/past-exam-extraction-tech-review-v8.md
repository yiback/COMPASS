# 기출문제 추출 계획 v8 — 기술 리뷰

> 리뷰어: technical-reviewer
> 대상: docs/plan/20260308-past-exam-extraction.md (v8)
> 일자: 2026-03-19
> 이전 리뷰: docs/reviews/past-exam-extraction-tech-review-v7.md

---

## 요약

v7 Tech Review의 MUST FIX 3건 + SHOULD FIX 6건 + CONSIDER 2건 총 8건이 v8에 모두 반영되었음을 확인했다. Storage 경로 구조, UNIQUE 제약, reanalyzeQuestionAction 테스트, INSERT+UPDATE 부분 성공 방어, resetExtractionAction 위치, RLS 직접 academy_id 사용, supabase.ts 타입 업데이트 순서, crop 개별 실패 처리, upload-form.tsx 의존성 명시 등 이전에 제기된 모든 기술적 이슈가 v8 PLAN에 명확히 반영되었다. 단, v8에서 새롭게 추가된 imageParts 타입 경계, resetExtractionAction 구현 상세, 이미지 검증 로직에서 세 가지 새로운 기술적 검토 사항이 발견되었다.

---

## v7 이슈 반영 확인

| v7 이슈 | 분류 | v8 반영 여부 | 확인 위치 |
|---------|------|------------|---------|
| Storage 경로 구조 신규 3계층에서 미명시 | MUST FIX 1 | ✅ 반영 | 아키텍처 결정 "Storage 경로 구조" 섹션 + Step 4/5에 경로 패턴 명시 |
| `past_exam_images` UNIQUE 제약 미정의 | MUST FIX 2 | ✅ 반영 | Step 1 DDL에 `UNIQUE(past_exam_id, page_number)` 추가 + Step 4 재업로드 DELETE 전략 명시 |
| `reanalyzeQuestionAction` 테스트 전략 불완전 | MUST FIX 3 | ✅ 반영 | Step 5 테스트 항목에 reanalyzeQuestionAction 단위 테스트 케이스 명시 |
| INSERT + UPDATE 트랜잭션 부재 부분 성공 처리 미명시 | SHOULD FIX 4 | ✅ 반영 | Step 5에 "기존 details DELETE 후 재삽입" 방어 방안 명시 + 결정사항 표 등재 |
| 전체 재추출 Action 위치 불명확 | SHOULD FIX 5 | ✅ 반영 | `resetExtractionAction`을 `extract-questions.ts`에 배치 확정 (결정사항 표) |
| RLS 정책에 JOIN 불필요 명시 누락 | SHOULD FIX 6 | ✅ 반영 | Step 1 DDL 주석 "(v8 반영) RLS 정책은 직접 보유한 academy_id 사용 (JOIN 불필요)" 추가 |
| Wave 2 타입 업데이트 타이밍 — Step 1 완료 직후 명시 | SHOULD FIX 7 | ✅ 반영 | "Step 1 완료 직후 supabase gen types 실행" 절차 명시 |
| crop 개별 실패 처리 명시 필요 | SHOULD FIX 8 | ✅ 반영 | Step 5 crop 처리에 "figure.url = null (부분 성공)" 명시 + FigureInfo 타입 `url: string | null` |
| upload-form.tsx Step 2 의존성 미명시 | SHOULD FIX 9 | ✅ 반영 | Step 6 의존성에 "Step 4 + Step 2 (upload-form.tsx는 Step 2 리팩토링 대상)" 추가 |
| source_page_numbers 컬럼 생략 결정 타당성 | CONSIDER 7 | ✅ 반영 | 결정사항 표에 "figures[].pageNumber + 문제 순서상 앞 페이지로 추적 가능" 명시 |
| Gemini Vision API 이미지 토큰 한도 대응 불충분 | CONSIDER 8 | ✅ 반영 | Zod 스키마에 이미지 수 20장/개별 5MB/총 100MB 검증 + Step 4/6에 명시 |

---

## 새로운 이슈 목록

---

### [SHOULD FIX] 1. `resetExtractionAction` Storage 삭제 실패 시 처리 방안 미명시

**위치**: Step 5 / `resetExtractionAction` 작업 설명 3단계

**문제**:
`resetExtractionAction`은 다음 순서로 동작한다:
```
1. 인증 + 권한
2. 기존 past_exam_details 조회 → figures[].url 목록 수집
3. Storage orphan cleanup: figures[].url Storage 파일 삭제
4. past_exam_details DELETE
5. past_exams.extraction_status = 'pending' UPDATE
```

3단계 Storage 삭제는 여러 파일을 삭제하는 작업이다. Supabase Storage의 `remove()` API는 배열을 받아 일괄 삭제하지만, 일부 파일이 이미 삭제되었거나 경로 오류가 있을 경우 부분 성공/실패가 발생한다. PLAN에는 "Storage 파일 삭제" 지시만 있고, 삭제 실패 시 전체 재추출을 중단해야 하는지 계속 진행해야 하는지의 에러 처리 전략이 없다.

Storage 삭제 실패는 DB 데이터와 Storage 파일 간 불일치로 이어질 수 있다. 특히 Storage 삭제가 실패했지만 `past_exam_details` DELETE는 성공하면 orphan 파일이 영구 잔류한다. 반대로 Storage 삭제만 성공하고 DB DELETE가 실패하면 `past_exam_details`가 유효하지 않은 `figures[].url`을 참조하게 된다.

**제안**:
Step 5의 `resetExtractionAction` 작업 설명에 다음 중 하나를 명시:
1. **Storage 삭제 실패는 Non-blocking**: Storage 삭제 실패를 무시하고 4단계(DB DELETE)로 진행. orphan 파일은 주기적 Storage 감사로 처리. (권장 — 재추출 흐름을 Storage 오류로 중단하지 않음)
2. **Storage 삭제 실패는 Blocking**: Storage 오류 시 Action 전체 중단 + `{ error: 'Storage 삭제 실패' }` 반환.

현재 코드베이스의 다른 Action 패턴(`uploadPastExamAction`의 DB 실패 시 Storage rollback)을 고려하면, 방향 1이 더 적합하다 — Storage orphan은 치명적이지 않으나 재추출 실패는 사용자 경험에 직접 영향을 미친다.
<!-- NOTE: 1로 진행 -->
---

### [SHOULD FIX] 2. `createPastExamAction`의 재업로드 전략: 기존 이미지 DELETE 시 Storage 파일도 함께 삭제해야 함

**위치**: Step 4 / `createPastExamAction` 작업 설명 6단계

**문제**:
Step 4, 작업 6단계:
```
(v8 반영) 재업로드 시: UNIQUE 제약으로 중복 방지 + 기존 이미지 DELETE 후 INSERT 전략
```

DB에서 `past_exam_images` 행을 DELETE하면 해당 행의 `source_image_url`(Storage 경로)이 참조하는 파일은 자동으로 삭제되지 않는다. DB ON DELETE CASCADE는 자식 테이블 행만 삭제하며 Storage 파일에는 영향이 없다.

기존 이미지를 DELETE 후 새 이미지를 INSERT하는 재업로드 패턴에서 Storage orphan 파일이 누적된다. 시험 이미지 한 장이 최소 수백 KB~수 MB이므로 Storage 비용과 정리 부담이 발생한다.

이는 `resetExtractionAction`에서 figures Storage 파일을 명시적으로 삭제하는 것과 일관되지 않는다.

**제안**:
Step 4의 재업로드 전략 설명에 다음을 추가:
```
재업로드 시 순서:
1. 기존 past_exam_images 조회 → source_image_url 목록 수집
2. Storage에서 기존 원본 이미지 파일 삭제 (admin 클라이언트)
3. past_exam_images DELETE (DB)
4. 새 이미지 Storage 업로드 → past_exam_images INSERT
```
Storage 삭제 실패 시 Non-blocking으로 처리(orphan 허용)하여 재업로드 흐름을 중단하지 않도록 명시.
<!-- NOTE: 제안대로 진행 -->
---

### [CONSIDER] 3. `reanalyzeQuestionAction` 호출 시 모든 이미지를 재로딩하는 비용

**위치**: Step 5 / `reanalyzeQuestionAction` 작업 설명 3단계 + 아키텍처 결정 섹션 4

**문제**:
`reanalyzeQuestionAction`은 단일 문제를 재분석하기 위해 시험의 **모든 이미지**를 재로딩한다:
```
3. 시험의 모든 이미지 → 직렬 base64 변환 → imageParts
```

시험지가 5~10장일 경우 단일 문제 재분석에 수십 MB의 이미지 전체를 다시 base64 변환하여 AI에게 전달한다. 이는 다음 비용을 수반한다:
- 각 이미지에 대한 Signed URL 생성 + HTTP fetch → 서버 메모리 부담
- Gemini Vision API 토큰 소모 — 전체 이미지 전송 비용이 단일 이미지 전송보다 N배 높음
- 응답 시간 증가

PLAN 내 "아키텍처 결정 4. AI 재분석 기능"에는 "시험의 모든 이미지를 다시 조회"한다고 명시되어 있으나, 재분석하는 문제가 특정 페이지에만 속한다면 해당 페이지의 이미지만 전달하면 충분할 수 있다.

**제안**:
이 결정이 의도적이라면 이유를 PLAN에 명시:
- "전체 이미지 재전달" 이유: 페이지 경계를 넘는 문제 가능성 + AI 컨텍스트 일관성 보장
- 또는 `FigureInfo.pageNumber`를 활용해 해당 문제가 속한 페이지의 이미지만 선별 전달하는 최적화를 CONSIDER로 기록

실제 재분석 빈도와 시험지 분량을 고려할 때 현재 설계도 MVP 범위에서는 허용 가능하나, 10장 이상 시험지에서의 재분석 비용 명시가 구현자에게 도움이 된다.
<!-- NOTE: 전체 삭제로 진행, 문제 추출 대기시간은 늘려야 함. -->
---

### [CONSIDER] 4. `past_exam_images` Storage 버킷 파일 크기 제한과 신규 경로 구조의 불일치

**위치**: Step 1 / Step 4 / `supabase/migrations/00005_storage_buckets.sql`

**문제**:
기존 `supabase/migrations/00005_storage_buckets.sql`에는 다음 설정이 있다:
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'past-exams', 'past-exams', false,
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);
```

버킷 레벨 파일 크기 제한이 **5MB**로 설정되어 있다. v8 PLAN에서 이미지 검증 상한 또한 "개별 5MB"로 설정하여 일치한다.

그러나 Storage RLS 정책(같은 마이그레이션 파일)의 경로 주석:
```sql
-- 경로 구조: {academy_id}/{school_id}/{year-semester-type}/{uuid.ext}
```
은 기존 단일 파일 경로 구조를 기준으로 작성되어 있다. v8의 신규 경로 구조(`{academyId}/{pastExamId}/{page_number}-{fileId}.{ext}`)로 변경 시, Storage RLS 정책은 `split_part(name, '/', 1)::UUID = get_user_academy_id()` 패턴을 사용하므로 1번째 경로 컴포넌트(academyId)를 기준으로 검증한다. 이는 신규 경로 구조에서도 동일하게 동작한다.

**제안**:
이 불일치는 기능상 문제가 없으나, 신규 마이그레이션(`20260315_past_exam_restructure.sql`)에 다음을 추가로 명시하면 혼란을 방지할 수 있다:
- Storage RLS 정책이 `split_part(name, '/', 1)` 기반이므로 경로 구조가 변경되어도 RLS는 그대로 동작함을 주석으로 기록
- crop 이미지(`figures/` 하위 경로)도 동일 `past-exams` 버킷을 사용하므로 동일 RLS 적용됨을 확인
<!-- NOTE: 제안대로 진행 -->
---

## Plan Review Completion Checklist

- [x] 모든 Task의 파일 소유권이 명확하다
  - Step 1: db-schema (마이그레이션)
  - Step 2: 카테고리별 소유권 표에 명시 (17개 파일)
  - Step 3: ai-integration (AI 타입 + 프롬프트 + Gemini)
  - Step 4: backend-actions (exam-management.ts)
  - Step 5: backend-actions (extract-questions.ts — extractQuestionsAction, resetExtractionAction, reanalyzeQuestionAction)
  - Step 6: frontend-ui (upload-form.tsx, image-sorter.tsx)
  - Step 7: frontend-ui (edit/page.tsx, extraction-editor.tsx)
- [x] Task 간 의존성 순서가 정의되었다 — Wave 1~5 명확 + 의존성 그래프 명시
- [x] 외부 의존성(라이브러리, API)이 명시되었다
  - sharp (Step 5 전용, runtime = 'nodejs')
  - @dnd-kit/core, sortable, utilities (Step 6)
  - Gemini Vision SDK (Step 3/5)
  - maxDuration 60 (Vercel Pro 기준 명시)
- [x] 에러 처리 방식이 정해졌다
  - isCompleted 플래그 + try/finally (Step 5)
  - Optimistic Lock 패턴 (.update().in().select('id')) 명시
  - crop 개별 실패 시 figure.url = null (부분 성공)
  - INSERT+UPDATE 부분 성공: 재추출 시 DELETE 후 재삽입
- [x] 테스트 전략이 있다
  - 각 Step별 테스트 파일과 테스트 항목 명시
  - reanalyzeQuestionAction 단위 테스트 Step 5에 포함
  - v8 신규 항목(이미지 수/용량 제한, resetExtractionAction, 기존 details DELETE 후 재삽입) 테스트 케이스 추가
- [ ] 이전 Phase 회고(`docs/retrospective/`)의 교훈이 반영되었다
  - `docs/retrospective/` 디렉토리 미존재 — v7 리뷰와 동일한 상태 (진행 중인 Phase이므로 회고 문서 없음)
- [x] 병렬 구현 시 파일 충돌 가능성이 없다
  - Wave 설계 기준 Step 간 파일 소유권 명확히 분리
  - Step 6+7 순차 진행으로 layout 충돌 방지

**판정: READY**

v7에서 제기된 모든 MUST FIX + SHOULD FIX 이슈가 v8에 반영되었으며, 새로운 MUST FIX 이슈는 발견되지 않았다. 새로 발견된 2건의 SHOULD FIX는 Storage orphan 처리 전략에 관한 것으로, 구현 중 처리 가능하다. 구현 착수 조건을 충족한다.

단, 구현 착수 전 팀 내 확인 권장 사항:
1. **SHOULD FIX 1**: `resetExtractionAction` Storage 삭제 실패를 Non-blocking으로 처리하는지 Blocking으로 처리하는지 결정 후 PLAN 또는 코드 주석에 명시
2. **SHOULD FIX 2**: `createPastExamAction` 재업로드 시 기존 Storage 파일 삭제 로직 추가 여부 결정
