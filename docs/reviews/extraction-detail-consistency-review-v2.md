# 기출문제 추출 상세 계획 — 정합성 리뷰 v2

> 리뷰어: consistency-reviewer
> 대상: `docs/plan/extraction-step1~8.md` (v9 상세) + 마스터 PLAN v9
> 일자: 2026-03-20
> 이전 리뷰: `docs/reviews/extraction-detail-consistency-review.md`
> 참조: `ROADMAP.md`, `HANDOFF.md`, `src/types/supabase.ts`, `supabase/migrations/`, `MEMORY.md`

---

## 요약

이전 리뷰(v1)에서 제기한 **MUST FIX 2건**의 반영 상태를 확인하고, SHOULD FIX 3건 및 CONSIDER 3건의 반영 여부를 검토했다. Step 1~8 상세 계획 9개 문서를 전부 정독했다.

**이전 MUST FIX 2건 반영 결과**:
- MF1 (HANDOFF.md v7 이슈 → 미업데이트): **미반영** — HANDOFF.md가 여전히 "PLAN v7 MUST FIX 3건 사용자 결정"을 즉시 해야 할 1번 작업으로 기록하고 있다. 실제 PLAN은 v9까지 반영되었으며 기술 리뷰 v8(4건) + 범위 리뷰 v8(4건)까지 반영 완료 상태다.
- MF2 (AIProvider 확장 stub 순서 미명시): **반영됨** — `extraction-step3-ai-layer.md` Task 3.1.7에 `// ⚠️ 구현 순서: 인터페이스 + GeminiProvider stub(throw 'Not implemented')를 가장 먼저 추가` 주석이 명시되었다. Wave 1 병렬 구현 시 타입 에러 위험이 명확히 해소되었다.

**신규 발견 이슈**: MUST FIX 1건, SHOULD FIX 2건, CONSIDER 2건

---

## 이전 이슈 반영 확인

### 이전 MUST FIX 2건

| ID | 이전 이슈 | 반영 상태 | 판단 |
|----|----------|----------|------|
| MF1 | HANDOFF.md "다음 작업 1번"이 이미 해결된 v7 이슈를 가리킴 | **미반영** — HANDOFF.md에 여전히 "PLAN v7 MUST FIX 3건 사용자 결정"이 1번 작업으로 기록됨 | 🔴 **여전히 MUST FIX** |
| MF2 | `AIProvider` 인터페이스 변경 시점 미명시 | **반영됨** — Step 3 Task 3.1.7에 stub 추가 순서 주석 명시 | ✅ 해소 |

### 이전 SHOULD FIX 3건

| ID | 이전 이슈 | 반영 상태 |
|----|----------|----------|
| SF1 | `past-exams-list.test.ts` 파일명 — Step 2에서 언급되나 마스터 PLAN 파일 목록과 불일치 | **반영됨** — Step 2 상세에 `past-exams-list.test.ts`가 명시되고 마스터 PLAN 파일 목록에는 `past-exams.test.ts (3개)`로 통합 기재. Step 2 상세 문서가 더 구체적 명칭을 사용하므로 실제 파일 존재 확인됨(테스트 파일 목록 `past-exams-list.test.ts` 실재 확인) |
| SF2 | `isValidGradeForSchoolType` import 경로 확인 필요 | **반영됨** — `src/lib/utils/grade-filter-utils.ts`에 `SchoolType` 타입과 `isValidGradeForSchoolType` 함수 모두 export됨. Step 4 의사코드의 import 경로 정확 |
| SF3 | `createPastExamAction` Storage 업로드 실패 시 cleanup 로직 미구체화 | **반영됨** — Step 4 의사코드에 `uploadedPaths` 추적 + 실패 시 `admin.storage.remove(uploadedPaths)` + `past_exams.delete()` cleanup 명시. MUST FIX 반영으로 기재됨 |

### 이전 CONSIDER 3건

| ID | 이전 이슈 | 반영 상태 |
|----|----------|----------|
| C1 | `past_exam_images`에 `updated_at` 없음 — 재업로드 추적 불가 | MVP 범위 외로 유지, 미반영 — 정상 |
| C2 | 마이그레이션 타임스탬프 `20260315` — 미래 날짜 | 의도적 사용(타임스탬프 기반 네이밍 컨벤션), 미반영 — 정상 |
| C3 | `uploadPastExamAction` deprecated 처리 범위 불명확 | **반영됨** — Step 2에서 "기존 데이터는 개발 데이터이므로 이관 불필요"로 확정 |

---

## 신규 이슈

### [MUST FIX 1] `next.config.ts` `bodySizeLimit` — 현재 '6mb', 다중 이미지 업로드에 부족

**위치**: `next.config.ts` (현재 운영 중), `docs/plan/extraction-step6-upload-ui.md` 리스크 섹션

**내용**:
- 현재 `next.config.ts`에는 `bodySizeLimit: '6mb'`가 이미 설정되어 있다.
- Step 6 상세 계획에는 `bodySizeLimit: '100mb'`로 변경해야 한다고 명시되어 있다:
  ```typescript
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  }
  ```
- Step 6 계획의 "새 의존성" 섹션에 Wave 3 시작 전 리드가 `next.config.ts`를 수정해야 함이 명시되어 있다.
- 그러나 Wave 3 체크리스트(마스터 PLAN 의존성 그래프)에는 `next.config.ts` 업데이트 항목이 없다. 리드에게 명시적으로 전달되지 않으면 Wave 3 착수 시 다중 이미지 업로드가 6mb 한도로 즉시 실패한다.
- `next.config.ts`는 Shared Files(리드 only 수정). 구현자가 직접 수정 불가.

**완화**: Wave 3 시작 조건에 "리드가 `next.config.ts` `bodySizeLimit: '100mb'` 변경 + `@dnd-kit/*` + `sharp` 추가 완료" 체크를 명시적으로 추가해야 한다. 마스터 PLAN 의존성 그래프의 Wave 3 항목에 반영 필요.

**판단**: MUST FIX — Wave 3 착수 즉시 업로드 기능이 동작하지 않는다. 6mb는 현재 단일 이미지(최대 5MB)를 위한 설정이므로 다중 이미지 시 즉각 차단된다.

---

### [SHOULD FIX 1] `createExtractedQuestionAction` — 마스터 PLAN 파일 목록과 Step 4 상세 간 불일치

**위치**: `docs/plan/20260308-past-exam-extraction.md` 변경/신규 파일 목록 vs `docs/plan/extraction-step4-exam-management.md` Task 4.6

**내용**:
- 마스터 PLAN 변경/신규 파일 목록에는 `exam-management.ts`에 배치되는 Action으로 `createPastExamAction`, `updateExtractedQuestion`, `deleteExtractedQuestion`, `confirmExtractedQuestions` 4개만 명시되어 있다.
- Step 4 상세에는 Task 4.6으로 `createExtractedQuestionAction`(수동 문제 추가)이 추가되어 있으며, "(리뷰 MUST FIX 반영)"으로 표시되어 있다. 이 Action은 기술 리뷰 v8 이후 추가된 것으로 보인다.
- 마스터 PLAN의 "Server Action — 시험 관리" 섹션에 이 Action이 없다. 구현자가 마스터 PLAN만 보면 이 Action의 존재를 모를 수 있다.
- 테스트 케이스 4개도 Step 4 상세에만 명시되어 있고 마스터 PLAN 테스트 전략 표에는 없다.

**판단**: SHOULD FIX — 문서 일관성. 마스터 PLAN과 Step 4 상세 간 기능 목록이 다르면 구현 누락 위험이 있다. Step 4 착수 전 확인 필수.

---

### [SHOULD FIX 2] Step 7 자동 추출 useEffect — `extractQuestionsAction` 반환 타입과 useEffect 처리 불일치

**위치**: `docs/plan/extraction-step7-edit-ui.md` Task 7.9 자동 추출 useEffect, `docs/plan/extraction-step5-extraction.md` Task 5.2

**내용**:
- Step 5의 `extractQuestionsAction` 반환 타입은 `Promise<{ error?: string }>`이다. 성공 시 빈 객체 `{}`를 반환한다.
- Step 7 useEffect 코드에서는:
  ```typescript
  if (result.error) { ... } else {
    router.refresh()
    setExtractionStatus('completed')
    toast.success('문제 추출이 완료되었습니다.')
  }
  ```
  성공 경로에서 `router.refresh()`를 호출하여 서버 컴포넌트 데이터를 재패칭하는 방식을 사용한다. 이는 문제가 없다.
- 그러나 `setExtractionStatus('completed')` 설정 시, 서버 데이터와 로컬 상태(`questions`)가 `router.refresh()` 완료 전에 분리될 수 있다. `router.refresh()`는 비동기 완료를 보장하지 않으며, 상태 업데이트가 refresh 완료 전에 일어나 UI가 일시적으로 빈 문제 목록을 표시할 수 있다.
- 이 패턴이 기존 `generate-questions-dialog.tsx`에서 사용된 것과 동일하다면 문제없지만, page 단위 서버 컴포넌트 데이터 재패칭 시 동작이 다를 수 있다.

**완화**: `router.refresh()` 후 상태 업데이트 순서를 명시하거나, `router.refresh()` 완료를 기다리는 방법을 Step 7에 명시.

**판단**: SHOULD FIX — 구현 시 race condition이 발생할 수 있으며, UI 깜빡임(빈 목록 → 채워진 목록) 이슈로 이어질 수 있다. 명확한 순서 정의가 필요하다.

---

### [CONSIDER 1] Step 5 `figure.url` mutation — 코딩 컨벤션 위반 가능성

**위치**: `docs/plan/extraction-step5-extraction.md` Task 5.2 의사코드 5d

**내용**:
- Step 5 의사코드에서 crop 처리 시 `figure.url = storagePath` / `figure.url = null`로 직접 필드를 변경한다:
  ```typescript
  figure.url = storagePath  // ← 직접 mutation
  ```
- 코딩 컨벤션(`rules/coding-style.md`)은 mutation 금지 + 새 객체 생성을 요구한다.
- `ExtractedQuestion` 인터페이스와 `FigureInfo` 인터페이스는 `readonly` 필드를 사용한다. `aiResult.questions`가 `readonly`이면 이 코드는 TypeScript 에러를 일으킨다.
- `validateExtractedQuestions`에서 반환된 결과가 `readonly`가 아닌 일반 타입이면 문제없지만, `ExtractQuestionResult.questions: readonly ExtractedQuestion[]`로 선언되어 있어 확인 필요.

**완화**: 의사코드에서 crop 처리 부분을 불변 패턴으로 명시하거나 "로컬 mutable 복사본 생성 후 처리" 주석을 추가하면 구현자 혼선을 방지할 수 있다.

**판단**: CONSIDER — TypeScript 컴파일 에러로 즉각 드러나므로 구현 시 자동 발견된다. 사전 명시가 있으면 혼선 최소화.

---

### [CONSIDER 2] ROADMAP.md의 단계 1 완료 상태와 PLAN 추가 범위 간 기대치 관리

**위치**: `ROADMAP.md` 단계 1 섹션, 마스터 PLAN "범위: 단계 1 보완"

**내용**:
- `ROADMAP.md`의 단계 1 진행 상황 요약에 "100% (1-1~1-8 완료, 535 tests) ✅ 완료"로 기재되어 있다.
- 기출문제 추출 PLAN은 "단계 1 보완"으로 분류되어 있으며, 실질적으로 3계층 리팩토링(17개 파일 변경) + 신규 기능(AI 추출, 편집 UI, DnD)이 포함된다.
- ROADMAP의 단계 1 완료 표시와 실제 추가 작업량(8 Steps) 간에 외부 관찰자 기준 불일치가 있다.
- 단계 2 계획 수립(HANDOFF 5번 항목)도 현재 PLAN 완료 후 예정이므로, ROADMAP가 단계 1 100% 완료로 표시된 상태에서 추가 작업이 진행되는 것이 혼란스러울 수 있다.

**완화**: ROADMAP에 "단계 1 보완 진행 중 (기출문제 추출 PLAN)" 항목을 추가하거나, 완료 % 표시 조정. (ROADMAP은 리드 only 수정 대상)

**판단**: CONSIDER — 기능 영향 없음. 프로젝트 가시성 이슈.

---

## Step별 정합성 체크 요약

| Step | 이슈 | 판단 |
|------|------|------|
| Step 1 (스키마) | 이상 없음. UNIQUE 제약, RLS 정책, Storage RLS 호환성 주석 모두 명시됨 | ✅ |
| Step 2 (리팩토링) | `past-exams-list.test.ts` 파일 실제 존재 확인됨 (v1 SF1 해소) | ✅ |
| Step 3 (AI 레이어) | stub 순서 주석 명시됨 (v1 MF2 해소) | ✅ |
| Step 4 (시험 관리 Action) | `createExtractedQuestionAction` 마스터 PLAN 미반영 (신규 SF1) | ⚠️ |
| Step 5 (추출 Action) | figure.url mutation 코딩 컨벤션 주의 (신규 C1) | ℹ️ |
| Step 6 (업로드 UI) | `next.config.ts` `bodySizeLimit` 6mb → 100mb 변경 Wave 3 체크리스트 미포함 (신규 MF1) | 🔴 |
| Step 7 (편집 UI) | `router.refresh()` + `setExtractionStatus` 순서 불명확 (신규 SF2) | ⚠️ |
| Step 8 (빌드 검증) | 이상 없음. 수동 테스트 8개, 회귀 확인 9개 충분함 | ✅ |

---

## ROADMAP/HANDOFF 정합성

| 항목 | 상태 |
|------|------|
| HANDOFF "즉시 해야 할 일 1번" — v7 MUST FIX 사용자 결정 | 🔴 **미업데이트** — 실제 v9 기준 구현 시작 가능한 상태지만 HANDOFF가 v7 결정 대기를 가리킴 |
| HANDOFF "즉시 해야 할 일 2번" — Wave 순서 | ✅ 정합 — Wave 1~5 순서 명시 |
| HANDOFF "진행 중 이슈" — 마이그레이션 00004/00005 | ✅ 정합 |
| ROADMAP 단계 1 100% 완료 표시 vs 8 Steps 추가 작업 | ℹ️ CONSIDER 2 참조 |

---

## Plan Review Completion Checklist (재평가)

| 항목 | 상태 | 비고 |
|------|------|------|
| 모든 Task의 파일 소유권이 명확하다 | ✅ | 각 Step에 소유 역할 명시 |
| Task 간 의존성 순서가 정의되었다 | ✅ | Wave 1~5 의존성 그래프 명시 |
| 외부 의존성(라이브러리, API)이 명시되었다 | ⚠️ | `next.config.ts` bodySizeLimit 변경이 Wave 3 착수 조건에 미포함 (MUST FIX 1) |
| 에러 처리 방식이 정해졌다 | ✅ | isCompleted + try/finally, Non-blocking, { error? } 반환 |
| 테스트 전략이 있다 | ✅ | 8개 신규 테스트 파일 + 케이스 목록 |
| 이전 Phase 회고(`docs/retrospective/`)의 교훈이 반영되었다 | ✅ | MEMORY.md 교훈 반영 확인 (v1 동일) |
| 병렬 구현 시 파일 충돌 가능성이 없다 | ✅ | v1 MF2 해소 — stub 순서 명시로 충돌 방지 |

---

## 판정: **READY (MUST FIX 1건 해결 조건부)**

### 필수 선행 사항 (구현 착수 전)

1. **HANDOFF.md 업데이트** (MF1 — 리드 only):
   - "즉시 해야 할 일 1번"을 "PLAN v9 기준 구현 시작 (v7 결정 이미 반영됨)"으로 수정
   - 참조 문서 목록에서 v7 관련 항목을 v9로 업데이트

2. **Wave 3 착수 전 리드 체크리스트 명시** (MF1 — 구현자에게 전달):
   - `next.config.ts` `bodySizeLimit: '6mb'` → `'100mb'` 변경 (현재 6mb는 단일 이미지 전용)
   - `package.json`에 `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `sharp` 추가

### 권장 사항 (구현 중 처리 가능)

- **SHOULD FIX 1**: Step 4 착수 시 `createExtractedQuestionAction`이 마스터 PLAN 파일 목록에 없음을 인지하고 포함하여 구현
- **SHOULD FIX 2**: Step 7 구현 시 `router.refresh()` + `setExtractionStatus` 순서를 명시적으로 처리 (refresh 후 상태 업데이트)

두 SHOULD FIX 모두 구현 시점에 자연스럽게 해결 가능하며 구현 착수를 차단하지 않는다.
