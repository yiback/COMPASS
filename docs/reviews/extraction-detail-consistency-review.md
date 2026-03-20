# 기출문제 추출 상세 계획 — 정합성 리뷰

> 리뷰어: consistency-reviewer
> 대상: docs/plan/extraction-step1~8.md (v9 상세)
> 일자: 2026-03-20
> 참조: ROADMAP.md, HANDOFF.md, src/types/supabase.ts, supabase/migrations/, MEMORY.md

---

## 요약

PLAN v9 상세 계획(Step 1~8)이 ROADMAP, HANDOFF, 기존 스키마, 기존 AI 인터페이스와 전반적으로 잘 정합하고 있다. 9개 문서를 검토한 결과 **MUST FIX 2건, SHOULD FIX 3건, CONSIDER 3건**을 발견했다.

주요 발견사항:
- ROADMAP의 단계 1 기능 번호(F005 기출문제 업로드)와 PLAN의 "3계층 전환" 범위 간 불일치가 있으며, 명확한 문서화가 필요하다.
- 기존 `AIProvider` 인터페이스에 `extractQuestions`/`reanalyzeQuestion` 메서드가 없어 Step 3 구현 시 인터페이스 변경이 불가피하다 — 계획은 이를 이미 인지하고 있으나, 기존 stub 메서드 추가 시점이 명시되지 않아 Wave 1/2에서 타입 에러가 발생할 수 있다.
- Storage RLS는 `split_part(name, '/', 1)::UUID` 패턴으로 academyId를 검증한다. 신규 경로 `{academyId}/{pastExamId}/...`는 호환되지만, 기존 `buckets`의 `allowed_mime_types`에 crop 이미지(image/jpeg) 외 새 형식이 필요한 경우 마이그레이션이 별도로 필요하다.
- HANDOFF의 "다음 작업 1번"이 v7 MUST FIX 3건 사용자 결정인데, 마스터 PLAN은 이미 v9로 반영되어 있다. HANDOFF 업데이트가 필요하다.

---

## Step별 이슈

### Step 1: 3계층 스키마

#### [CONSIDER 1] `past_exam_images`에 `updated_at` 컬럼 없음 — 이미지 재업로드 추적 불가

- **위치**: `extraction-step1-schema.md` Task 1.8
- **내용**: `past_exam_images`는 `updated_at` 없다는 이유로 트리거가 없다. 그러나 Step 4 `createPastExamAction`은 재업로드 시 `past_exam_images`를 DELETE 후 INSERT한다. 현재 구조에서는 재업로드 기록이 없어 디버깅이 어렵다.
- **판단**: CONSIDER — MVP에서 재업로드 기록 추적은 비필수. Phase 2 audit trail 도입 시 검토.

#### [CONSIDER 2] 마이그레이션 타임스탬프(`20260315`) — 미래 날짜

- **위치**: `extraction-step1-schema.md` 파일 이름
- **내용**: 현재 날짜(2026-03-20)보다 5일 앞선 `20260315`를 사용한다. 실제 적용 날짜와 불일치하지만 기능에는 영향 없다. Supabase Cloud 적용 시 타임스탬프 주의.
- **판단**: CONSIDER — 기능 이슈 아님, 팀 컨벤션에 따라 조정 가능.

---

### Step 2: 기존 코드 리팩토링

#### [MUST FIX 1] HANDOFF.md "다음 작업 1번"이 이미 해결된 v7 이슈를 가리킴

- **위치**: `HANDOFF.md` 3절 "즉시 해야 할 일" + `extraction-step2-refactor.md`
- **내용**: HANDOFF는 "PLAN v7 MUST FIX 3건 사용자 결정"을 즉시 해야 할 1번 작업으로 기록하고 있다. 그러나 마스터 PLAN은 이미 v9로 업데이트되어 해당 이슈들이 전부 반영되었다. 구현자가 HANDOFF를 보고 v7 결정이 아직 미해결이라고 오해할 수 있다.
- **완화**: HANDOFF의 "즉시 해야 할 일" 1번을 "PLAN v9 기준 구현 시작"으로 업데이트 필요. (HANDOFF는 리드 only 수정 대상)
- **판단**: MUST FIX — 다음 세션에서 구현 착수 시 혼선 유발.

#### [SHOULD FIX 1] `past-exams-list.test.ts` 파일명 — Step 2에서 언급되나 마스터 PLAN에 없음

- **위치**: `extraction-step2-refactor.md` 테스트 파일 목록 15번 항목
- **내용**: `src/lib/actions/__tests__/past-exams-list.test.ts`를 별도 파일로 참조하지만, 마스터 PLAN의 "변경/신규 파일 목록"과 "영향 파일 17개" 표에는 `past-exams.test.ts`만 언급된다. 실제 파일이 둘로 나뉘어 있는지 확인이 필요하다.
- **판단**: SHOULD FIX — 구현 시 파일 존재 여부를 먼저 확인하고 진행.

#### [CONSIDER 3] `uploadPastExamAction` deprecated 처리 범위 불명확

- **위치**: `extraction-step2-refactor.md` Action 파일 1번
- **내용**: `uploadPastExamAction`을 "Step 6 이후 삭제 예정"으로 deprecated 처리한다. 그러나 Step 2 완료 후 Step 6 전(Wave 2~3)에 이 Action을 통해 새 업로드가 발생하면 `past_exam_questions`에만 저장된다. 해당 데이터는 개발 데이터로 간주하고 버릴 것인지 명시가 없다.
- **판단**: CONSIDER — 개발 환경 한정이므로 "개발 데이터, 이관 불필요" 주석으로 처리 가능.

---

### Step 3: AI 타입 + 프롬프트 + GeminiProvider

#### [MUST FIX 2] `AIProvider` 인터페이스 변경 시점 미명시 — Wave 1/2 타입 에러 위험

- **위치**: `extraction-step3-ai-layer.md` Task 3.1.7, `src/lib/ai/types.ts`
- **내용**: 현재 `AIProvider` 인터페이스에는 `extractQuestions`, `reanalyzeQuestion` 메서드가 없다. Step 3은 Wave 1(Step 1과 병렬)에서 수행되며, Step 3이 완료되기 전에 Wave 2(Step 4)의 `exam-management.ts`가 `createAIProvider()`를 import할 경우 타입 에러가 발생할 수 있다.
  - `extraction-step3-ai-layer.md`의 리스크 항목에 "GeminiProvider에 stub 메서드 추가로 컴파일 통과"라고만 언급되어 있고, **stub 추가 시점이 Wave 1 중인지 Wave 2 시작 전인지 명시가 없다**.
  - Step 4는 `extractQuestions`를 직접 호출하지 않지만, `src/lib/ai/types.ts`의 `AIProvider` 인터페이스가 수정되면 기존 GeminiProvider가 인터페이스를 구현하지 못해 전체 빌드가 깨진다.
- **완화**: Step 3 착수 시 가장 먼저 `AIProvider` 인터페이스에 메서드 시그니처만 추가 + `GeminiProvider`에 throw stub 추가 → 이후 구체 구현. 이 순서를 Step 3 상세 계획에 명시.
- **판단**: MUST FIX — Wave 1 병렬 구현 시 Step 1/Step 3 완료 순서에 따라 빌드 깨짐 가능.

---

### Step 4: 시험 생성 + 이미지 업로드

#### [SHOULD FIX 2] `isValidGradeForSchoolType` import 경로 — 기존 유틸 함수 경로 확인 필요

- **위치**: `extraction-step4-exam-management.md` Task 4.2 의사코드
- **내용**: `import { isValidGradeForSchoolType, type SchoolType } from '@/lib/utils/grade-filter-utils'`를 사용한다. 해당 함수가 실제로 이 경로에 export되어 있는지, 그리고 `SchoolType`이 동일 파일에서 export되는지 확인이 필요하다. HANDOFF에는 `src/lib/utils/grade-filter-utils.ts`가 존재한다고 명시되어 있어 경로는 맞지만, `SchoolType` 타입 export 여부는 미확인.
- **판단**: SHOULD FIX — 구현 전 해당 파일의 export 목록 확인 필요.

#### [SHOULD FIX 3] `createPastExamAction`에서 Storage 업로드 실패 시 고아 `past_exams` 레코드 cleanup 로직 미구체화

- **위치**: `extraction-step4-exam-management.md` Task 4.2 의사코드 (cleanup 주석)
- **내용**: 의사코드에서 업로드 실패 시 "간략화: 실제 구현 시 cleanup 로직 추가"라고만 주석 처리했다. 테스트 케이스 11번(`Storage 업로드 실패 → 에러 + cleanup`)도 명시되어 있으나, 구체적 cleanup 방법(exam DELETE 후 반환 vs extraction_status로 식별)이 계획에 없다.
- **완화**: "업로드 실패 시 `past_exams.id` 삭제 후 에러 반환" 또는 "`extraction_status = 'pending'`으로 남겨두고 사용자 재시도 허용" 중 하나를 Step 4 계획에 명시.
- **판단**: SHOULD FIX — 테스트 케이스가 있지만 구현 방식이 미결.

---

### Step 5: 추출 + crop + 재추출 + 재분석

내용 이슈 없음. Optimistic Lock, isCompleted 플래그, Non-blocking cleanup, buildImageParts 공유 함수 모두 일관되게 기술되어 있다.

---

### Step 6: 업로드 UI

내용 이슈 없음. Vercel `bodyParser` 설정(20장 × 5MB = 최대 100MB)에 대한 리스크가 이미 명시되어 있다.

---

### Step 7: 편집 UI

내용 이슈 없음. `extractQuestionsAction` 반환 타입 불일치 가능성이 있으나(현재 `{ error?: string }` 반환이지만 `result.data?.questions`를 참조), Step 5 구현 시 반환 타입에 questions 포함 여부를 결정해야 한다. 이는 Step 5의 내부 설계 문제이며 이 리뷰 범위 외다.

---

### Step 8: 빌드 검증 + 학습 리뷰

내용 이슈 없음. 수동 테스트 시나리오 8개, 기존 기능 회귀 확인 9개, 학습 리뷰 토픽 10개가 충분히 상세하다.

---

## ROADMAP과의 정합성

| 항목 | ROADMAP | PLAN | 판단 |
|------|---------|------|------|
| 1-2 기출문제 업로드 [F005] | "완료" | Step 2에서 대규모 리팩토링 수행 | ✅ 허용 — "보완" 성격이며 ROADMAP에 "단계 1 보완"으로 명시됨 |
| 기출문제 업로드 범위 | 단일 이미지 업로드 | 3계층 + 다중 이미지로 확장 | ✅ PLAN에 "단계 1 보완" 명시 |
| student 접근 차단 | 기존 1-2에서 student 허용 | 신규 3계층은 student 차단 | ✅ PLAN에 의도적 변경으로 명시 |
| 단계 1 통합 테스트 (E2E) | "[ ] 미완료" | Step 8에서 수동 테스트 | ⚠️ E2E 자동화 미포함 — ROADMAP 체크리스트와 gap |
| 단계 2 계획 수립 | HANDOFF에 "5번 다음 작업" | 본 PLAN 완료 후 예정 | ✅ 정합 |

**관찰**: ROADMAP의 "단계 1 통합 테스트" 항목은 Playwright E2E를 의미하는데, Step 8은 수동 테스트 시나리오만 포함한다. 자동화 E2E는 이 PLAN 범위 외로 명시적 제외가 필요하다.

---

## 기존 스키마 호환성

| 항목 | 기존 스키마 | PLAN | 판단 |
|------|------------|------|------|
| `get_user_academy_id()` 함수 | `00002_rls_policies.sql`에 정의 | Step 1 RLS에서 재사용 | ✅ 호환 |
| `has_any_role()` 함수 | `00002_rls_policies.sql`에 정의 | Step 1 RLS에서 재사용 | ✅ 호환 |
| `update_updated_at_column()` 함수 | `00001_initial_schema.sql`에 정의 | Step 1 트리거에서 재사용 | ✅ 호환 |
| Storage RLS `split_part(name, '/', 1)::UUID` | `00005_storage_buckets.sql` | 신규 경로 `{academyId}/{...}` 1번째 컴포넌트가 academyId → 호환 | ✅ 호환 |
| `past-exams` 버킷 MIME 타입 | `image/jpeg, image/png, image/webp, application/pdf` | crop 이미지(image/jpeg)는 허용됨 | ✅ 호환 |
| `academies`, `schools`, `profiles` FK | 기존 테이블 | 신규 3계층 테이블의 FK로 참조 | ✅ 호환 |

---

## 기존 AI 인터페이스 호환성

| 항목 | 현재 상태 | PLAN | 판단 |
|------|----------|------|------|
| `AIProvider.processOCR` | 유지 | OCP 준수 — 삭제 없이 새 메서드 추가 | ✅ Breaking Change 없음 |
| `AIProvider.generateQuestions` | 유지 | 변경 없음 | ✅ |
| `PromptConfig.imageParts` | 현재 없음 | optional 필드 추가 | ✅ 하위 호환 (기존 사용처 영향 없음) |
| `GeminiProvider.buildContents` | 현재 없음 | `imageParts` 분기 신규 추가 | ✅ 기존 `generateQuestions` 경로 그대로 |
| `PastExamContext.extractedContent` | optional | generate-questions.ts에서 past_exam_details JOIN으로 대체 | ✅ 마스터 PLAN 아키텍처 결정 7에 명시 |
| `AIProvider` 인터페이스 변경 시점 | — | **미명시** → MUST FIX 2 참조 | ⚠️ |

---

## MEMORY.md 교훈 반영 확인

| 교훈 | PLAN 반영 여부 |
|------|--------------|
| `strip()` / Zod unknown key 자동 제거 | ✅ Zod 스키마 전반에 적용 |
| 비정규화 스냅샷 (source_metadata) | ✅ Step 2에서 `source_metadata.pastExamId`를 `past_exams.id`로 자연 전환 |
| PostgreSQL 트랜잭션 (`insert([배열])`) | ✅ `past_exam_images` bulk INSERT에 명시 |
| `savedIndices(Set<number>)` 패턴 | 해당 없음 (이번 PLAN은 저장 패턴 아님) |
| Radix Select controlled + FormData 문제 | ✅ Step 6에서 기존 패턴(uncontrolled + key prop) 재사용 |
| Zod `.uuid()` vs `.min(1)` | ✅ Step 5 Zod 스키마에 `.min(1)` 사용 + 주석 명시 |
| Fail Fast 원칙 | ✅ Step 4에서 Zod → school_type 교차검증 → DB INSERT 순서 |
| `useEffect` race condition 방지 (`cancelled` 플래그) | ✅ Step 7 자동 추출 useEffect에 명시 |
| `<img>` vs `next/image` (Signed URL) | ✅ Step 7 이미지 썸네일에 `<img>` + eslint-disable 명시 |
| Mock 테스트 한계 (SQL 오타 → E2E 필요) | ✅ Step 8 수동 테스트로 보완 |

---

## Plan Review Completion Checklist

| 항목 | 상태 | 비고 |
|------|------|------|
| 모든 Task의 파일 소유권이 명확하다 | ✅ | 각 Step에 소유 역할 명시 |
| Task 간 의존성 순서가 정의되었다 | ✅ | Wave 1~5 의존성 그래프 명시 |
| 외부 의존성(라이브러리, API)이 명시되었다 | ✅ | sharp, @dnd-kit/*, Gemini SDK 명시 |
| 에러 처리 방식이 정해졌다 | ✅ | isCompleted + try/finally, Non-blocking, { error? } 반환 |
| 테스트 전략이 있다 | ✅ | 총 8개 신규 테스트 파일 + 케이스 목록 |
| 이전 Phase 회고(`docs/retrospective/`)의 교훈이 반영되었다 | ✅ | retrospective 없음, MEMORY.md 교훈 반영 확인 |
| 병렬 구현 시 파일 충돌 가능성이 없다 | ⚠️ | MUST FIX 2(AIProvider stub 시점) 해결 시 충돌 없음 |

---

**판정: READY (MUST FIX 2건 해결 조건부)**

MUST FIX 1(HANDOFF 업데이트)은 구현 전 리드가 처리해야 하며, MUST FIX 2(AIProvider stub 시점 명시)는 Step 3 착수 시 가장 먼저 인터페이스 + stub 추가 순서를 지키면 해결된다. 두 이슈 모두 코드 설계 오류가 아닌 문서 명확성 이슈이므로 구현 착수 차단 수준은 아니다.
