# 기출문제 추출 계획 v6 — 범위 리뷰

> 리뷰어: scope-reviewer
> 대상: docs/plan/20260308-past-exam-extraction.md (v6)
> 일자: 2026-03-19

## 요약

v5 리뷰의 MUST FIX 2건(Step 2 파일 수 정정, R9 MVP 포함 여부)과 주요 CONSIDER 2건(Step 3+4 병합, Step 6+7 순차 전환)이 모두 v6에 반영되었다. 그러나 Step 4와 Step 5 사이에 sharp 의존 위치가 혼재되어 있고, Step 5에 `extractQuestionsAction` + `reanalyzeQuestionAction`이 함께 들어가 단계 크기가 과도하다. v5 BLOCKED였던 이슈는 사용자 결정으로 대부분 해소되었으며, v6은 조건부 READY 수준에 도달했다.

---

## 이슈 목록

### [MUST FIX] 1. Step 4와 Step 5의 sharp 의존 위치 혼재

- **위치**: Step 4, Step 5
- **문제**: `export const runtime = 'nodejs'` 및 sharp 의존성 추가 주석이 Step 4(`exam-management.ts`) 헤더에 명시되어 있으나, sharp를 실제로 사용하는 코드(이미지 crop)는 Step 5(`extract-questions.ts`)에 있다. `createPastExamAction`(시험 생성 + 이미지 업로드)은 Storage에 파일을 저장하지 crop은 하지 않으므로 sharp가 불필요하다.
- **제안**: sharp와 `export const runtime = 'nodejs'`를 Step 5(`extract-questions.ts`)에만 명시. Step 4에서 해당 주석 제거.

### [MUST FIX] 2. Step 5에 `reanalyzeQuestionAction` 포함 — 단계 크기 과도

- **위치**: Step 5 / 요구사항 R5
- **문제**: Step 5에는 이미 Optimistic Lock -> 직렬 base64 변환 -> Gemini Vision 호출 -> Zod 파싱 -> sharp crop x N -> Storage 업로드 x N -> DB INSERT -> 상태 업데이트로 구성된 `extractQuestionsAction`이 있다. 여기에 `reanalyzeQuestionAction`(문제 조회 -> 이미지 재조회 -> AI 재분석 프롬프트 -> UPDATE)까지 포함하면 단일 Step이 Large를 넘는다.
- **제안**: `reanalyzeQuestionAction`을 Step 7(편집 UI)에 포함. [AI 재분석] 버튼과 해당 Action은 동시에 필요하며, 편집 UI와 함께 구현하는 것이 더 자연스럽다.

---

### [SHOULD FIX] 3. R9 그래프 crop: sharp 부분 실패 처리 방식 미명시

- **위치**: Step 5 / 요구사항 R9
- **문제**: `figures` 배열의 일부 crop이 실패할 경우(sharp 오류, bounding box 변환 오차, Storage 업로드 실패) 전체 추출을 실패로 처리할지, 부분 성공으로 처리할지 PLAN에 명시되지 않았다. 또한 전체 재추출 시 이전 crop 이미지 Storage cleanup 전략이 없다.
- **제안**:
  1. Step 5에 명시: crop 개별 실패 시 `figure.url = null`로 저장하고 나머지는 계속 진행(부분 성공)
  2. 전체 재추출 Action에 기존 crop 이미지 Storage 삭제 로직 추가 또는 orphan cleanup 전략 명시

### [SHOULD FIX] 4. Step 6의 Step 2 의존이 의존성 그래프에 누락

- **위치**: 의존성 그래프 Wave 3 / Step 6
- **문제**: `upload/upload-form.tsx`와 `upload/page.tsx`는 Step 2 리팩토링 대상(3계층 전환)이기도 하고, Step 6에서 "대폭 변경" 대상이기도 하다. Wave 2에서 Step 2가 해당 파일을 수정하고, Wave 3에서 Step 6이 다시 수정하는 구조이므로 Step 6은 암묵적으로 Step 2 완료를 전제한다.
- **제안**: Step 6 의존성을 "Step 4 + Step 2"로 업데이트.

### [SHOULD FIX] 5. Step 2 영향 파일의 변경 유형 구체화 부족

- **위치**: Step 2
- **문제**: v6에서 영향 범위를 17개로 정정했으나, "UI 타입 변경 8개"는 각 파일의 수정 범위(props 타입만 수정 vs 컴포넌트 구조 전면 변경)가 구분되지 않아 병렬 에이전트 할당 시 작업량 추정이 부정확하다.
- **제안**: Step 2 파일 목록 테이블에 각 파일별 변경 유형(Low/Medium/High) 추가.

---

### [CONSIDER] 6. R8 DnD: 구현 실패 시 fallback 전략 부재

- **위치**: Step 6 / 요구사항 R8
- **문제**: DnD를 MVP에 포함하기로 결정했으나, Step 6 리스크가 "Medium-High"로 평가된 만큼 실패 시 대안이 없다.
- **제안**: Step 6에 fallback 명시: DnD 실패 시 "위/아래 버튼" 방식으로 전환 가능한 구조.

### [CONSIDER] 7. `maxDuration = 60`이 Vercel Pro 플랜 전제

- **위치**: Step 5
- **문제**: `export const maxDuration = 60`은 Vercel Pro 플랜 이상에서만 지원된다. Hobby 플랜 기본 한도는 10초다.
- **제안**: 리스크 테이블에 "Vercel Hobby 플랜 10초 제한" 항목 추가 또는 배포 환경 명시.

### [CONSIDER] 8. 전체 재추출 시 `past_exam_details` 삭제 방식 미명시

- **위치**: Step 5 / 사용자 워크플로우
- **문제**: "[전체 재추출]" 시 삭제 방식(명시적 DELETE vs ON DELETE CASCADE), 트랜잭션 처리 여부가 PLAN에 없다.
- **제안**: Step 5 재추출 흐름에 명시적 DELETE 순서를 기술.

---

## v5 리뷰 이슈 반영 현황

| v5 이슈 | 분류 | v6 반영 여부 |
|--------|------|------------|
| Step 2 "36개" -> 실제 수치 정정 | MUST FIX | 17개로 정정 |
| R9 그래프 crop MVP 포함 여부 | MUST FIX | 사용자 결정 "MVP 포함" 반영 |
| R5 AI 재분석 연기 | SHOULD FIX | 사용자 결정 "MVP 포함" 반영 |
| R8 DnD 연기 | SHOULD FIX | 사용자 결정 "MVP 포함" 반영 |
| 3계층 vs 2계층 | SHOULD FIX | 사용자 결정 "3계층 유지" |
| Step 3+4 병합 | CONSIDER | v6 Step 3으로 병합 완료 |
| Step 6+7 순차 전환 | CONSIDER | v6 Wave 4 순차 진행으로 변경 |
| extraction_status 상태 전이 규칙 | CONSIDER | v6에 명시적 전이 규칙 추가 |

---

## Plan Review Completion Checklist

- [x] 모든 Task의 파일 소유권이 명확하다 — Step 2 변경 유형 구체화는 SHOULD FIX
- [x] Task 간 의존성 순서가 정의되었다 — Step 6의 Step 2 의존 누락은 SHOULD FIX
- [x] 외부 의존성(라이브러리, API)이 명시되었다 — Vercel 플랜 전제는 CONSIDER
- [x] 에러 처리 방식이 정해졌다 — sharp 부분 실패 처리는 SHOULD FIX
- [x] 테스트 전략이 있다
- [ ] 이전 Phase 회고(`docs/retrospective/`)의 교훈이 반영되었다 — 디렉토리 미존재
- [x] 병렬 구현 시 파일 충돌 가능성이 없다

**판정: READY (조건부)**

MUST FIX 2건 해결 후 구현 단계 진입 권장:
1. Step 4에서 sharp 제거 -> Step 5에만 명시
2. `reanalyzeQuestionAction`을 Step 7로 이동
