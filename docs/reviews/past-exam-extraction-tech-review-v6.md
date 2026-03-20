# 기출문제 추출 계획 v6 — 기술 리뷰

> 리뷰어: technical-reviewer
> 대상: docs/plan/20260308-past-exam-extraction.md (v6)
> 일자: 2026-03-19
> 이전 리뷰: docs/reviews/past-exam-extraction-tech-review.md (v5 기준)

## 요약

v5 기술 리뷰에서 제기된 MUST FIX 3건(sharp 의존성, FK 참조 체인, 동시 추출 Race Condition)과 SHOULD FIX 4건이 v6 PLAN에 모두 반영되었다. 전반적으로 구현 준비가 갖춰진 상태이나, **Storage RLS 경로와 업로드 클라이언트 명시 누락**, **finally 블록의 상태 추적 방식 불명확**, **generate-questions.ts의 `extracted_content` 컬럼 소실** 등 구현 착수 전 반드시 해결해야 할 이슈가 있다.

---

## 이슈 목록

### [MUST FIX] 1. figures crop 업로드 클라이언트 미명시 — Storage RLS 충돌 위험

- **위치**: Step 5 / 추출 프로세스 3d단계
- **문제**: PLAN은 crop 이미지를 `past-exams/{academyId}/figures/` 경로에 저장한다고 명시하지만, Storage 업로드에 `createAdminClient()`를 쓸지 `createClient()`를 쓸지 명시가 없다. `supabase/migrations/00005_storage_buckets.sql`의 INSERT 정책은 `has_any_role(ARRAY['teacher', 'admin', 'system_admin'])`을 요구하는데, Server Action은 인증된 사용자 컨텍스트로 실행되므로 일반 클라이언트로도 정책을 통과할 수 있다. 그러나 기존 원본 이미지 업로드(`src/lib/actions/past-exams.ts:238`)는 `createAdminClient()`를 사용하여 RLS를 명시적으로 우회한다. 일관성 없는 패턴이 혼용되면 권한 관련 버그를 디버깅하기 어렵다.
- **제안**: Step 5에 "crop 업로드는 원본 이미지와 동일하게 `createAdminClient()` 사용"을 명시.

### [MUST FIX] 2. finally 블록의 상태 변수 출처 불명확

- **위치**: Step 5 / `extractQuestionsAction` try/finally 코드 스니펫
- **문제**: PLAN의 finally 블록은 `if (extraction_status !== 'completed')` 조건으로 실패 롤백 여부를 판단한다. `extraction_status`가 로컬 변수인지 DB에서 재조회하는 값인지 명확하지 않다. 성공 경로에서 DB에 `completed`를 기록한 후 finally가 실행되면 `extraction_status`가 무엇을 가리키는지 구현자가 혼란에 빠진다.
- **제안**: Step 5에 `let isCompleted = false` 로컬 플래그 패턴을 명시:
  ```typescript
  let isCompleted = false
  try {
    // ... 추출 작업 ...
    // DB UPDATE extraction_status = 'completed'
    isCompleted = true
  } finally {
    if (!isCompleted) {
      // DB UPDATE extraction_status = 'failed'
    }
  }
  ```

### [MUST FIX] 3. generate-questions.ts의 `extracted_content` 컬럼이 3계층 전환 후 소실

- **위치**: Step 2 영향 파일 표 / Step 1 스키마
- **문제**: `src/lib/actions/generate-questions.ts:106`은 `.from('past_exam_questions').select('..., extracted_content, ...')`를 사용한다. Step 2에서 이 쿼리가 `past_exams`로 전환되면, `past_exams` 스키마에는 `extracted_content` 컬럼이 없으므로 조회가 실패한다. `PastExamContext.extractedContent`를 채울 수 없어 AI 문제 생성 기능 전체가 깨진다.
- **근거**: PLAN Step 1 `past_exams` 스키마(line 68~84) — `extracted_content` 없음. `generate-questions.ts:106` — `extracted_content` SELECT 및 `PastExamContext`에 전달.
- **제안** (선택):
  1. (가장 단순) Step 1 `past_exams` 스키마에 `extracted_content TEXT` 컬럼 추가
  2. Step 2에서 `generate-questions.ts`가 `past_exam_details`로 JOIN하여 `question_text`를 집합으로 조합하는 로직 명시
  3. `raw_ai_response` 파싱 방식 명시

---

### [SHOULD FIX] 4. Optimistic Lock UPDATE 결과 검증 방법 미명시

- **위치**: Step 5 / Optimistic Lock 설명
- **문제**: PLAN은 "영향 행 0이면 조기 반환"하라고 명시하지만, Supabase JS Client의 `.update().eq()` 체이닝만으로는 영향 행 수를 직접 확인할 수 없다. `WHERE id = ? AND extraction_status IN ('pending', 'failed')` 조건을 충족하지 않을 때 빈 배열이 반환되는지 명시가 없어 구현자가 추측에 의존해야 한다.
- **제안**: Step 5에 다음 패턴 명시:
  ```typescript
  const { data: locked } = await supabase
    .from('past_exams')
    .update({ extraction_status: 'processing' })
    .eq('id', pastExamId)
    .in('extraction_status', ['pending', 'failed'])
    .select('id')
  if (!locked || locked.length === 0) {
    return { error: '이미 처리 중입니다.' }
  }
  ```

### [SHOULD FIX] 5. sharp 의존성과 `runtime = 'nodejs'` 명시 위치 오류

- **위치**: Step 4 / 새 의존성 섹션
- **문제**: PLAN Step 4(`exam-management.ts`)에 `export const runtime = 'nodejs'`와 sharp 의존성을 명시하고 있으나, 실제로 `sharp`를 사용하는 것은 Step 5의 `extract-questions.ts`(그래프 crop 로직)이다. `exam-management.ts`는 파일 메타데이터 저장만 담당하므로 sharp가 불필요하다.
- **제안**: `sharp` 의존성과 `export const runtime = 'nodejs'`를 Step 4에서 Step 5(`extract-questions.ts`)로 이동하여 명시.

### [SHOULD FIX] 6. Wave 2 병렬 실행 시 supabase.ts 수정 타이밍 미명시

- **위치**: 의존성 그래프 / Wave 2
- **문제**: Step 2(기존 코드 리팩토링)는 `src/types/supabase.ts`를 수정하고, Step 4(시험생성 Action)는 이 타입을 참조한다. Wave 2에서 병렬 실행 시 Step 4 구현자가 타입 정의 전에 구현을 시작하면 TypeScript 오류가 발생한다.
- **제안**: Step 1 완료 직후 `supabase gen types` 실행 → `supabase.ts` 업데이트를 Wave 1 마지막 작업으로 분리하거나, Wave 2 시작 조건에 명시.

---

### [CONSIDER] 7. LaTeX 수식 렌더링 라이브러리 결정 누락

- **위치**: Step 7 편집 UI
- **문제**: PLAN 프롬프트에서 "수식은 LaTeX 형태로 변환하세요"라고 명시하나, Step 7 UI 의존성에 KaTeX/MathJax 등 렌더링 라이브러리가 없다. 추출된 문제 카드에 `$\frac{a}{b}$` 등 LaTeX 문자열이 raw 텍스트로 표시된다.
- **제안**: "MVP에서는 raw LaTeX 표시 허용, Phase 2에서 KaTeX 도입"으로 명시적 결정을 PLAN에 기록.

### [CONSIDER] 8. raw_ai_response 컬럼 크기 제한 미설정

- **위치**: Step 1 / `past_exams` 스키마
- **문제**: `raw_ai_response TEXT`에 AI 원본 응답 전체를 저장한다. 30문제 x LaTeX + bounding box 좌표의 경우 수십 KB에 달할 수 있다. PostgreSQL TEXT는 크기 제한이 없으나, 디버깅 목적 외 사용하지 않는 컬럼에 대량 데이터가 누적되면 테이블 bloat이 발생한다.
- **제안**: Storage 저장 또는 일정 크기 초과 시 자동 삭제(TTL) 정책을 검토하거나, 개발 중에는 허용하고 Phase 2 회고 시 재검토.

### [CONSIDER] 9. 마이그레이션 롤백 SQL 미포함

- **위치**: Step 1 / 리스크 섹션
- **문제**: 대규모 스키마 변경 + 데이터 이관을 포함하는 마이그레이션은 롤백 경로가 없으면 운영 환경에서 위험하다.
- **제안**: 마이그레이션 파일 내 주석으로라도 `DROP TABLE` 순서 및 `ROLLBACK` 절차를 기술.

---

## v5 리뷰 대비 개선 확인

| v5 이슈 | 상태 |
|---------|------|
| [MUST FIX] sharp 의존성 누락 | 반영 (단, 위치 오류 -> SHOULD FIX 5) |
| [MUST FIX] FK UUID 동일 유지 | 반영 |
| [MUST FIX] 동시 추출 Race Condition | 반영 |
| [SHOULD FIX] base64 메모리 방어 | 반영 |
| [SHOULD FIX] Gemini API 타임아웃 | 반영 |
| [SHOULD FIX] AIProvider Breaking Change | 반영 (OCP 준수) |
| [SHOULD FIX] PromptConfig imageParts 분기 | 반영 |
| [SHOULD FIX] RLS student 차단 결정 | 반영 |
| [CONSIDER] source_page_numbers | 생략 결정 명시 |
| [CONSIDER] dnd-kit 의존성 | MVP 포함 결정 명시 |
| [CONSIDER] 마이그레이션 번호 충돌 | 타임스탬프 기반 전환 |
| [CONSIDER] 전체 재추출 확인 Dialog | Step 7에 추가 |

---

## Plan Review Completion Checklist

- [x] 모든 Task의 파일 소유권이 명확하다
- [x] Task 간 의존성 순서가 정의되었다
- [x] 외부 의존성(라이브러리, API)이 명시되었다 — LaTeX 렌더링은 결정 필요(CONSIDER 7)
- [ ] 에러 처리 방식이 정해졌다 — finally 블록 상태 변수 출처 불명확(MUST FIX 2), Optimistic Lock 구현 패턴 미명시(SHOULD FIX 4)
- [x] 테스트 전략이 있다
- [ ] 이전 Phase 회고(`docs/retrospective/`)의 교훈이 반영되었다 — `docs/retrospective/` 디렉토리 미존재
- [x] 병렬 구현 시 파일 충돌 가능성이 없다

**판정: READY (조건부)**

MUST FIX 3건을 PLAN에 반영한 후 구현 착수 가능:
1. figures crop 업로드 클라이언트(`createAdminClient`) 명시
2. finally 블록 `isCompleted` 로컬 플래그 패턴 명시
3. `generate-questions.ts`의 `extracted_content` 대체 방안 결정 및 명시
