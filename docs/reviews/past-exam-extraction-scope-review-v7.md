# 기출문제 추출 계획 v7 — 범위 리뷰

> 리뷰어: scope-reviewer
> 대상: docs/plan/20260308-past-exam-extraction.md (v7)
> 일자: 2026-03-19

---

## 요약

v6 범위 리뷰의 MUST FIX 2건이 모두 v7에 반영되었다.
- MUST FIX 1 (sharp를 Step 4에서 제거): Step 5에만 명시, 확정된 결정사항 표에도 명시됨
- MUST FIX 2 (reanalyzeQuestionAction을 Step 7로 이동): Step 7로 이동하고 Step 5 상단에 "v7 변경" 주석 명시

SHOULD FIX 3건 중 2건 반영, 1건(SHOULD FIX 5 — Step 2 변경 유형 구체화)은 Step 2 파일 목록 테이블에 Low/Medium/High 컬럼이 추가되어 반영되었다.

전체 범위는 MVP 단계에 적합하며, 단일 Phase 안에 8개 Step이 잘 분해되어 있다. 새로운 범위 이슈는 1건의 SHOULD FIX와 3건의 CONSIDER 수준으로 경미하다.

---

## v6 이슈 반영 확인

| v6 이슈 | 분류 | v7 반영 여부 |
|---------|------|------------|
| Step 4와 Step 5의 sharp 의존 위치 혼재 | MUST FIX | ✅ 반영 — Step 4 주석 제거, Step 5에만 sharp + runtime = 'nodejs' 명시. 확정 결정사항에도 기술 |
| Step 5에 reanalyzeQuestionAction 포함 — 단계 크기 과도 | MUST FIX | ✅ 반영 — Step 7로 이동. 의존성 그래프 Wave에도 반영 |
| R9 crop 부분 실패 처리 방식 미명시 | SHOULD FIX | ✅ 반영 — figure.url = null (부분 성공), 타입 정의에 url: string \| null 명시, 확정 결정사항에 포함 |
| Step 6의 Step 2 의존이 의존성 그래프에 누락 | SHOULD FIX | ✅ 반영 — Step 6 의존성 "Step 4 + Step 2"로 업데이트, Wave 3 의존성 그래프에도 반영 |
| Step 2 영향 파일의 변경 유형 구체화 부족 | SHOULD FIX | ✅ 반영 — Step 2 파일 목록 테이블에 "변경 유형(Low/Medium/High)" 컬럼 추가 |
| R8 DnD 구현 실패 시 fallback 전략 부재 | CONSIDER | ✅ 반영 — image-sorter.tsx 독립 컴포넌트 분리 + 위/아래 버튼 fallback 명시 |
| maxDuration = 60이 Vercel Pro 플랜 전제 | CONSIDER | ✅ 반영 — "Vercel Pro 기준 60초, Hobby 10초" 주석 명시, 리스크 테이블 항목 추가 |
| 전체 재추출 시 past_exam_details 삭제 방식 미명시 | CONSIDER | ⚠️ 부분 반영 — 재추출 시 "기존 데이터 삭제 + extraction_status = 'pending'" 워크플로우에 언급되나, 명시적 DELETE 순서와 Storage orphan cleanup 전략은 여전히 누락 |

---

## 새로운 이슈 목록

### [SHOULD FIX] 1. 전체 재추출 시 Storage orphan 이미지 cleanup 전략 여전히 미명시

- **위치**: Step 5 / Step 7 (전체 재추출 흐름)
- **문제**: [전체 재추출] 클릭 시 `past_exam_details`를 DELETE하고 재추출하면, 이전 추출에서 crop하여 Storage에 저장된 figure 이미지들이 orphan 상태로 남는다. v6 CONSIDER 8에서 제기된 이슈인데, v7에서 "기존 데이터 삭제 + extraction_status = 'pending'" 흐름이 Step 7에 언급되었으나 Storage cleanup은 여전히 기술되지 않았다.
- **제안**: Step 7(또는 Step 5)의 전체 재추출 흐름에 다음 중 하나를 명시:
  1. 재추출 전 기존 `past_exam_details.figures[].url` 목록을 조회 → Storage에서 삭제 후 DELETE (정합 보장)
  2. 또는 orphan cleanup 전략을 "MVP에서 미처리, Phase 2에서 정기 cleanup job 추가"로 명시적 결정으로 기록
<!-- NOTE: 전체 삭제후 재추출 -->
---

### [CONSIDER] 2. Step 7 편집 UI의 reanalyzeQuestionAction — 파일 소유권 명확화 필요

- **위치**: Step 7 / 파일 목록
- **문제**: `reanalyzeQuestionAction`이 Step 7(편집 UI)에 포함되었으나, 이 Server Action이 `extraction-editor.tsx` 내부에 인라인으로 구현되는지, 또는 별도 `src/lib/actions/` 파일에 위치하는지 PLAN에 명시되지 않았다. frontend-ui 역할은 `src/lib/actions/`를 편집 금지 소유 디렉토리로 갖지 않으므로, 병렬 구현 시 파일 소유권 충돌 가능성이 있다.
- **제안**: Step 7 파일 목록에 `reanalyzeQuestionAction`의 위치를 명시. 권장 방향: `src/lib/actions/extract-questions.ts`에 추가(backend-actions 소유)하고 Step 7 UI가 호출하는 구조로 분리.
<!-- NOTE: 권장방향으로 구현 -->
---

### [CONSIDER] 3. Step 1 마이그레이션 — 기존 past_exam_questions 데이터 이관 후 검증 쿼리 부재

- **위치**: Step 1 (마이그레이션)
- **문제**: `INSERT INTO past_exams ... SELECT id ... FROM past_exam_questions` 패턴으로 이관하지만, 이관 후 row count 검증 쿼리가 PLAN에 없다. 기존 `past_exam_questions`에 데이터가 있는 경우 이관 누락이 발생해도 발견되기 어렵다.
- **제안**: Step 1 작업 목록에 다음 검증 쿼리를 명시:
  ```sql
  -- 이관 후 검증
  SELECT COUNT(*) FROM past_exam_questions;   -- 기준값
  SELECT COUNT(*) FROM past_exams;            -- 동일해야 함
  SELECT COUNT(*) FROM past_exam_images WHERE source_image_url IS NOT NULL;  -- 이미지 이관 확인
  ```
- **우선순위**: 현재 개발 환경(시드 데이터 약 5건)에서는 영향이 적으므로 CONSIDER 수준.
<!-- NOTE: 기존데이타 삭제후 시작-->
---

### [CONSIDER] 4. Step 3과 Step 5의 이미지 → base64 변환 책임 소재 중복

- **위치**: Step 3 (GeminiProvider.extractQuestions) / Step 5 (extractQuestionsAction)
- **문제**: Step 5에서 `for...of` 루프로 이미지별 직렬 base64 변환을 수행하고, 완성된 `imageParts` 배열을 `AIProvider.extractQuestions`에 전달한다. 이 구조에서 `GeminiProvider`는 base64 변환을 담당하지 않고 `imageParts`를 그대로 SDK에 전달하는 역할만 한다. 그러나 Step 3 작업 항목 4번에는 "다중 이미지 → base64 → Gemini SDK contents Part 배열"이라고 기술되어 있어, 변환 책임이 GeminiProvider 내부에 있는 것처럼 읽힌다.
- **제안**: Step 3 설명에서 "Action 레벨에서 base64 변환 완료 후 `imageParts` 수신 → SDK contents 구성"으로 명확화. `ExtractQuestionParams.imageUrls` 타입이 이미 URL 배열인데, Step 5에서 직렬 변환을 완료한 후 `ExtractQuestionParams`에 무엇을 담아 전달하는지(URL인지, base64인지)의 타입 경계를 PLAN에서 일관되게 기술할 것.
<!-- NOTE: 제안으로 진행 -->>
---

## Plan Review Completion Checklist

- [x] 모든 Task의 파일 소유권이 명확하다 — reanalyzeQuestionAction 위치 불명확은 CONSIDER 수준
- [x] Task 간 의존성 순서가 정의되었다 — Wave 기반 의존성 그래프 명확
- [x] 외부 의존성(라이브러리, API)이 명시되었다 — sharp, dnd-kit, Vercel 플랜 조건 포함
- [x] 에러 처리 방식이 정해졌다 — isCompleted 패턴, crop 부분 실패, Optimistic Lock 모두 명시
- [x] 테스트 전략이 있다 — 각 Step TDD 명시, 테스트 전략 테이블 존재
- [ ] 이전 Phase 회고(`docs/retrospective/`)의 교훈이 반영되었다 — 디렉토리 미존재 (v6와 동일 상태)
- [x] 병렬 구현 시 파일 충돌 가능성이 없다 — Wave 기반 분리, Step 6+7 순차 진행

**판정: READY**

v6 MUST FIX 2건이 모두 해소되었고, 새로운 이슈는 SHOULD FIX 1건(Storage orphan cleanup 전략 명시)과 CONSIDER 3건이다. SHOULD FIX 1건은 MVP 동작에 직접 영향을 주지 않으며(crop 이미지가 남아 있을 뿐, 기능 장애 없음), 팀 결정으로 "MVP 미처리 + Phase 2 cleanup job" 형태로 명시하면 충분하다. 구현 단계 진입에 차단 사유 없음.
