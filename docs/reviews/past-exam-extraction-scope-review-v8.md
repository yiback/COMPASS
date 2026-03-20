# 기출문제 추출 계획 v8 — 범위 리뷰

> 리뷰어: scope-reviewer
> 대상: docs/plan/20260308-past-exam-extraction.md (v8)
> 일자: 2026-03-19
> 이전 리뷰: docs/reviews/past-exam-extraction-scope-review-v7.md

---

## 요약

v7 Scope Review의 SHOULD FIX 1건과 CONSIDER 4건이 모두 v8에 반영되었다. Storage orphan cleanup이 `resetExtractionAction`에 명시되었고, `reanalyzeQuestionAction`의 파일 소유권이 `extract-questions.ts`(backend-actions)로 확정되었으며, 데이터 이관 제거와 `imageParts` 타입 경계 명확화도 완료되었다. 새로운 이슈는 MUST FIX 없음, SHOULD FIX 1건, CONSIDER 3건으로 경미한 수준이며 전체적으로 구현 진입에 차단 사유가 없다.

---

## v7 이슈 반영 확인

| v7 이슈 | 분류 | v8 반영 여부 |
|---------|------|------------|
| 전체 재추출 시 Storage orphan 이미지 cleanup 전략 미명시 | SHOULD FIX 1 | ✅ 반영 — `resetExtractionAction`에 figures[].url Storage 삭제 → details DELETE → status 'pending' 순서 명시. 리스크 표 및 확정 결정사항에도 기술 |
| Step 7 편집 UI의 reanalyzeQuestionAction — 파일 소유권 명확화 | CONSIDER 2 | ✅ 반영 — `extract-questions.ts`(backend-actions 소유)에 배치 확정, Step 7은 import 후 호출만 담당. 확정 결정사항 표 및 v7→v8 변경 요약에도 반영 |
| Step 1 마이그레이션 — 기존 데이터 이관 후 검증 쿼리 부재 | CONSIDER 3 | ✅ 반영 (다른 방식) — 이관 로직 자체를 전부 제거. 개발 데이터이므로 이관 불필요 결정, 검증 쿼리 문제 근본적으로 해소 |
| Step 3과 Step 5의 이미지→base64 변환 책임 소재 중복 | CONSIDER 4 | ✅ 반영 — `ExtractQuestionParams.imageParts: readonly ImagePart[]`로 타입 경계 확정. Step 3/Step 5 모두 "Action에서 변환 완료 후 imageParts 전달" 패턴으로 일관되게 기술 |

---

## 새로운 이슈 목록

### [SHOULD FIX] 1. Step 5 단일 파일의 책임 과중 — 3개 Action 테스트 전략 분리 필요

- **위치**: Step 5 (`extract-questions.ts`) / 테스트 전략 표
- **문제**: v8에서 `extract-questions.ts` 하나에 `extractQuestionsAction` + `resetExtractionAction` + `reanalyzeQuestionAction` 3개 Action이 배치된다. 각 Action이 수십 라인 규모이며 테스트 케이스도 대폭 증가한다. 현재 PLAN에는 `extract-questions.test.ts` 단일 파일에 모든 테스트를 통합하도록 기술되어 있는데, 이 경우 테스트 파일이 300줄 이상으로 커질 가능성이 높다(코딩 스타일 가이드: 200-400줄 권장, 800줄 최대).
- **우려점**: `reanalyzeQuestionAction`은 `extractQuestionsAction`과 독립된 AI 호출 + 단일 UPDATE 로직으로, 테스트 목적과 mocking 대상이 다르다. 하나의 테스트 파일에 혼재하면 mock 충돌이 발생할 수 있다.
- **제안**: 테스트 전략 표에서 `reanalyzeQuestionAction` 테스트를 별도 파일(`reanalyze-question.test.ts`)로 분리하거나, 또는 현재 설계를 유지하되 PLAN에 "파일 크기 초과 시 분리 가능" 주석을 추가하여 구현자가 인지하도록 명시.
<!-- NOTE: 제안대로 진행 -->
---

### [CONSIDER] 2. `resetExtractionAction`의 Storage orphan cleanup 실패 시 처리 방식 미명시

- **위치**: Step 5 — `resetExtractionAction` 의사코드
- **문제**: `resetExtractionAction` 흐름은 "Storage 파일 삭제 → details DELETE → status 'pending' UPDATE" 순서인데, Storage 삭제 실패(네트워크 오류, Storage 권한 문제) 시 어떻게 처리하는지 PLAN에 기술되지 않았다. Storage 삭제 실패 후 details DELETE를 계속 진행하면 orphan이 남고, Storage 삭제 실패 시 전체를 중단하면 사용자 UX가 나빠진다.
- **제안**: 다음 중 하나를 PLAN에 명시:
  1. Storage 삭제 실패는 무시하고 계속 진행 (orphan 허용, 추후 cleanup job) — MVP 단순화
  2. Storage 삭제 실패 시 에러 반환 (안전하지만 UX 복잡)
- **우선순위**: MVP 동작에는 영향 없으므로 CONSIDER. 팀 결정으로 옵션 1("MVP에서 무시 + Phase 2 cleanup")로 명시하면 충분.
<!-- NOTE: 1로 진행 -->
---

### [CONSIDER] 3. Step 6 DnD 의존성(`@dnd-kit`) 추가 시 기존 shadcn/ui 패턴과 충돌 가능성

- **위치**: Step 6 (업로드 UI) — 새 의존성
- **문제**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` 3개 패키지를 신규 추가한다. 현재 프로젝트는 shadcn/ui 기반이며 이미 Radix UI + TailwindCSS가 내장되어 있다. dnd-kit은 headless이므로 충돌이 발생하지는 않으나, Shared Files 규칙상 `package.json` 수정은 "리드 only"다.
- **확인 필요**: PLAN에 "`package.json` 변경은 Step 6 착수 전 리드가 의존성 추가 처리" 문구가 명시되어 있지 않다. 병렬 구현 시 `package.json` 수정 타이밍이 불명확하면 다른 Step 구현자가 `package.json` 없이 작업하게 되는 문제가 생긴다.
- **제안**: Step 6 의존성 항목에 "착수 전 리드가 `package.json`에 `@dnd-kit/*` 추가 후 Wave 3 시작" 주석 명시.
<!-- NOTE: 제안대로 진행 -->
---

### [CONSIDER] 4. `createPastExamAction`에 `updateExtractedQuestion` / `deleteExtractedQuestion` / `confirmExtractedQuestions` 혼재 — 파일 책임 분리 검토

- **위치**: Step 4 (`exam-management.ts`) — 작업 항목 2, 3, 4
- **문제**: `exam-management.ts`는 "시험 생성 + 이미지 업로드"가 주 책임이나, `updateExtractedQuestion`(문제 편집), `deleteExtractedQuestion`(문제 삭제), `confirmExtractedQuestions`(확정)가 같은 파일에 배치된다. 이 Actions는 개념적으로 "추출 결과 관리"에 해당하며 `extract-questions.ts`(추출 Action)와 더 밀접하다. 현재 배치는 파일명(`exam-management`)과 내용의 불일치를 만든다.
- **반론**: `extract-questions.ts`에 추가하면 파일이 더 비대해진다는 우려도 있다. 현재 Step 4 규모(Low-Medium)를 유지하기 위해 의도적으로 분산시킨 것일 수 있다.
- **제안**: PLAN에 배치 근거(파일 크기 밸런싱 vs 개념 응집)를 주석으로 명시하면 구현자가 혼란 없이 진행할 수 있다. 변경이 필요하다면 `confirmExtractedQuestions`와 `updateExtractedQuestion`을 `extract-questions.ts`로 이동하고 `exam-management.ts`는 시험 생성/이미지 업로드만 담당하는 방향이 더 응집도가 높다.
<!-- NOTE: 제안대로 진행 -->
---

## Plan Review Completion Checklist

- [x] 모든 Task의 파일 소유권이 명확하다 — `reanalyzeQuestionAction`의 위치가 `extract-questions.ts`(backend-actions)로 확정됨. `updateExtractedQuestion` 등 위치 분리 근거는 CONSIDER 수준
- [x] Task 간 의존성 순서가 정의되었다 — Wave 기반 의존성 그래프, Step 6의 "Step 4 + Step 2" 의존 포함, 명확
- [x] 외부 의존성(라이브러리, API)이 명시되었다 — sharp, dnd-kit, Vercel 플랜 조건, `package.json` 리드 소유 규칙 (CONSIDER 3은 타이밍 명시 부족)
- [x] 에러 처리 방식이 정해졌다 — isCompleted 패턴, crop 부분 실패 null 처리, Optimistic Lock, try/finally 명시됨
- [x] 테스트 전략이 있다 — 각 Step TDD 명시, 테스트 전략 테이블 존재. SHOULD FIX 1 (테스트 파일 크기 위험)은 인지 필요
- [ ] 이전 Phase 회고(`docs/retrospective/`)의 교훈이 반영되었다 — 디렉토리 미존재 (v7과 동일 상태, 프로젝트 최초 Phase이므로 해당 없음으로 간주)
- [x] 병렬 구현 시 파일 충돌 가능성이 없다 — Wave 기반 분리, Step 6+7 순차 진행, `reanalyzeQuestionAction` 소유권 확정으로 v7의 충돌 가능성 해소

**판정: READY**

v7 Scope Review의 모든 이슈(SHOULD FIX 1건, CONSIDER 4건)가 v8에 반영되었다. 새로운 이슈는 MUST FIX 없음, SHOULD FIX 1건(테스트 파일 분리 권장), CONSIDER 3건(Storage cleanup 실패 처리, dnd-kit 의존성 추가 타이밍, exam-management 파일 응집도)이다. SHOULD FIX 1건은 구현 중 코드 크기 초과 시 대응하는 것으로도 충분하며 선행 차단 사유가 아니다. 구현 단계 진입에 차단 사유 없음.
