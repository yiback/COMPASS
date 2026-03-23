# Detail Scope Review v2: 도형 렌더링 상세 PLAN v2

> 리뷰어: scope-reviewer
> 리뷰 일자: 2026-03-23
> 리뷰 회차: 3/3 (최종)
> 검토 대상: `docs/plan/figure-rendering-detail.md` (v2)
> 기반 PLAN: `docs/plan/figure-rendering.md` (v2)

---

## v1 이슈 반영 확인

### MUST FIX 1: Wave 3 figure-renderer.tsx 충돌 → ✅ 반영 완료

Wave 3a(Task 7a + 7b)와 Wave 3b(Task 8)로 직렬 분리되었다.
Task 8 Step 4에서 `figure-renderer.tsx` 연결을 Wave 3b 완료 후 1회 수정으로 명시했다.
Wave 3a → Wave 3b 순서가 "Wave 3b는 Wave 3a 완료 + `npm run build` 통과 확인 후 시작"으로 명기되어 있다.
파일 충돌 위험 해소 확인.

### MUST FIX 2: Task 6 validateFigureIndices 타입 불일치 → ✅ 반영 완료

`validateFigureIndices` 시그니처를 `figures: { length: number } | undefined`로 변경하여 duck typing 적용.
Task 6 Step 2에서 `FigureInfo[]`를 타입 캐스팅 없이 직접 전달 가능하도록 설계되었다.
Task 10a에서도 동일 duck typing 패턴으로 `FigureData[]`를 전달한다.
Task 2의 코드 예시에서 `pattern.lastIndex = 0` 리셋, 1-based 인덱스 처리, 경고 반환 방식이 명확히 기술되어 있다.

### SHOULD FIX 3: Task 7 → 7a/7b 분리 → ✅ 반영 완료

Task 7a(coordinate-plane.tsx + CoordinatePlaneContent 분리)와 Task 7b(function_graph SVG 합성)로 분리되었다.
각 Task에 별도 빌드 체크, 에이전트 프롬프트 가이드가 포함되어 있다.
Task 7b에서 `CoordinatePlane`(외부 svg 포함)이 아닌 `CoordinatePlaneContent`(내부 요소만)를 import하도록 금지 사항에 명시되어 있다.

### SHOULD FIX 4: Task 9 Step 2 선택지 파일 경로 미특정 → ✅ 반영 완료

Task 9 Step 2에 실제 파일 경로 2개가 명시되었다.
- `src/app/(dashboard)/questions/_components/question-detail-sheet.tsx` (줄 174 근처)
- `src/app/(dashboard)/past-exams/[id]/edit/question-card.tsx` (줄 168 근처)

### SHOULD FIX 5: Wave 4 에이전트 할당표 → ✅ 반영 완료

Wave 4 섹션 상단에 "[CONSIDER 12] Wave 4 에이전트 할당"으로 명시:
- Task 9 = frontend-ui
- Task 10a = ai-integration
- Task 10b = backend-actions

### CONSIDER 6: Task 2 완료 직후 Zod 테스트 선행 작성 권장 → ✅ 반영 완료

Task 2 상단에 `[CONSIDER 13]`으로 선행 작성 권장이 추가되었다.
Task 11(Wave 5) 상단에도 동일 권장 사항이 반복 기재되어 일관성이 있다.

---

## 신규 이슈

### [CONSIDER] Task 9 Step 2 — props drilling 범위 미명시

**위치**: Wave 4, Task 9 Step 2

**관찰**: 선택지 렌더링 파일 2개에서 `<LatexRenderer text={option} figures={figures} />`로 호출을 변경하는 것이 명시되어 있다. 그런데 상위 컴포넌트에서 `figures`를 props로 전달받아야 한다고 기술되어 있으며 "상위 컴포넌트에서 figures를 전달받는 props drilling이 필요할 수 있음"이라고 주의사항에 적혀 있다.

두 파일 모두 frontend-ui 소유권 범위(`src/app/`, `src/components/`) 내에 있으므로 역할 경계 위반은 없다. 다만 에이전트가 상위 컴포넌트 시그니처 수정 범위를 파악하지 못해 props drilling 경로를 중간에서 끊어버릴 위험이 있다.

**판단**: 이 작업에 대해 상세 PLAN에서 "우선 파일을 열어 현재 컴포넌트 시그니처 확인 후 figures 전달 경로 파악"이라고 에이전트에게 조사를 위임하고 있다. questions의 경우 `QuestionDetailSheet`가 `question` 객체 전체를 받을 가능성이 높으므로 `question.figures`를 바로 전달할 수 있을 것이다. 구현 전에 리드가 두 파일의 컴포넌트 시그니처를 미리 확인해두면 에이전트 작업이 더 안전하다. 그러나 PLAN 자체를 블로킹할 수준은 아니다.

---

### [CONSIDER] Task 5 Step 3 + Task 7a Step 3 + Task 7b Step 2 + Task 8 Step 4 — figure-renderer.tsx 수정 누적

**위치**: Wave 2 Task 5 Step 3, Wave 3a Task 7a Step 3, Wave 3a Task 7b Step 2, Wave 3b Task 8 Step 4

**관찰**: `figure-renderer.tsx`는 Wave 1(생성), Wave 2(number_line 연결), Wave 3a Task 7a(coordinate_plane 연결), Wave 3a Task 7b(function_graph 연결), Wave 3b Task 8(polygon/circle/vector 연결)까지 총 5회 수정된다. 각 수정은 직렬로 강제되어 있어 파일 충돌은 없다.

**판단**: 직렬 수정이므로 실제 충돌은 없다. 다만 에이전트 프롬프트에 "이전 Task에서 작성된 switch case를 삭제하거나 교체하지 말 것"이 각 Step의 금지 사항에 이미 포함되어 있으므로 현재 PLAN으로 충분하다. 블로킹 이슈 아님.

---

## 파일 소유권 충돌 매트릭스 (v2)

| 파일 | Wave 1 | 리드 선행 | Wave 2 | Wave 3a | Wave 3b | Wave 4 | Wave 5 |
|------|--------|----------|--------|---------|---------|--------|--------|
| `figure-renderer.tsx` | Task 3 (생성) | - | Task 5 Step 3 | Task 7a Step 3, 7b Step 2 (직렬) | Task 8 Step 4 | - | - |
| `latex-renderer.tsx` | - | - | Task 4 | - | - | Task 9 (직렬) | - |
| `svg/number-line.tsx` | - | - | Task 5 (생성) | - | - | - | - |
| `svg/coordinate-plane.tsx` | - | - | - | Task 7a (생성) | - | - | - |
| `svg/function-graph.tsx` | - | - | - | Task 7b (생성) | - | - | - |
| `svg/polygon.tsx` | - | - | - | - | Task 8 (생성) | - | - |
| `svg/circle-shape.tsx` | - | - | - | - | Task 8 (생성) | - | - |
| `svg/vector-arrow.tsx` | - | - | - | - | Task 8 (생성) | - | - |
| `figure-schema.ts` | Task 2 (생성) | - | - | - | - | - | - |
| `supabase.ts` | Task 1 | - | - | - | - | - | - |
| `ai/types.ts` | - | 리드 단독 | - | - | - | - | - |
| `extraction-validation.ts` | - | - | Task 6 | - | - | - | - |
| `ai/prompts/question-extraction.ts` | - | - | Task 6 | - | - | - | - |
| `ai/validation.ts` | - | - | - | - | - | Task 10a | - |
| `ai/prompts/question-generation.ts` | - | - | - | - | - | Task 10a | - |
| `ai/prompts/past-exam-generation.ts` | - | - | - | - | - | Task 10a | - |
| `validations/save-questions.ts` | - | - | - | - | - | Task 10b | - |
| `actions/save-questions.ts` | - | - | - | - | - | Task 10b | - |

**충돌 없음**: 동일 Wave 내 동일 파일 동시 수정 0건.

---

## CLAUDE.md 역할 경계 일치 검토 (v2)

| Task | 소유 역할 | CLAUDE.md 역할 경계 | 일치 여부 |
|------|----------|-------------------|----------|
| Task 1 (DB 마이그레이션) | db-schema | `supabase/migrations/`, `src/types/supabase.ts` | ✅ |
| Task 2 (Zod 스키마) | backend-actions | `src/lib/validations/` | ✅ |
| Task 3 (FigureRenderer) | frontend-ui | `src/components/ui/` | ✅ |
| Task 4 (LatexRenderer) | frontend-ui | `src/components/ui/` | ✅ |
| Task 5 (SVG 유틸 + number_line) | frontend-ui | `src/components/ui/svg/` | ✅ |
| Task 6 (AI 추출 프롬프트) | ai-integration | `src/lib/ai/` | ✅ |
| Task 7a (coordinate_plane) | frontend-ui | `src/components/ui/svg/` | ✅ |
| Task 7b (function_graph) | frontend-ui | `src/components/ui/svg/` | ✅ |
| Task 8 (polygon + circle + vector) | frontend-ui | `src/components/ui/svg/` | ✅ |
| Task 9 (연속 도형 + 선택지) | frontend-ui | `src/app/`, `src/components/ui/` | ✅ |
| Task 10a (AI 생성 프롬프트) | ai-integration | `src/lib/ai/` | ✅ |
| Task 10b (save-questions) | backend-actions | `src/lib/actions/`, `src/lib/validations/` | ✅ |
| Task 11 (테스트) | tester | `__tests__/` 디렉토리 | ✅ |
| 리드 선행 (types.ts) | 리드 | 공유 파일 리드 단독 | ✅ |

역할 경계 위반 없음. 공유 파일 `src/lib/ai/types.ts`는 리드 선행 작업으로 올바르게 격리되어 있다.

---

## 워커 크기 적절성 평가 (v2)

| Task | 작업량 | 신규 파일 수 | 기존 파일 수정 | 평가 |
|------|-------|------------|-------------|-----|
| Task 1 | XS | 1 | 1 | 적절 |
| Task 2 | S | 1 | 0 | 적절 |
| Task 3 | S | 1 | 0 | 적절 |
| Task 4 | S | 0 | 1 | 적절 |
| Task 5 | M | 2 | 1 | 적절 |
| Task 6 | M | 0 | 2 | 적절 |
| Task 7a | M | 1 | 1 | 적절 (CoordinatePlaneContent 분리 설계 포함) |
| Task 7b | M | 1 | 1 | 적절 |
| Task 8 | M | 3 (상호 독립) | 1 | 적절 |
| Task 9 | S | 0 | 2~3 | 적절 (props drilling 범위 불확실 — CONSIDER) |
| Task 10a | M | 0 | 3 | 적절 |
| Task 10b | S | 0 | 2 | 적절 |
| Task 11 | M | 5 | 0 | 적절 |

---

## Wave 병렬 구조 실현 가능성 평가 (v2)

| Wave | 병렬 구조 | 실현 가능 여부 |
|------|----------|--------------|
| Wave 1 | Task 1, Task 2 병렬 + 리드 선행 병렬 가능 | ✅ (CONSIDER 15 반영) |
| Wave 2 | Task 4, Task 5, Task 6 병렬 | ✅ (각 파일 독립) |
| Wave 3a | Task 7a → Task 7b 직렬 | ✅ (CoordinatePlaneContent 의존성 처리) |
| Wave 3b | Wave 3a 완료 후 Task 8 (3개 파일 병렬 가능, figure-renderer.tsx 연결은 마지막 1회) | ✅ |
| Wave 4 | Task 9 (frontend-ui), Task 10a (ai-integration), Task 10b (backend-actions) 병렬 | ✅ (에이전트 할당표 명시됨) |
| Wave 5 | Task 11 직렬 | ✅ |

---

## 결론: READY

**MUST FIX 이슈 없음. 신규 이슈 모두 CONSIDER 수준.**

v1의 MUST FIX 2건, SHOULD FIX 4건이 v2에서 전부 반영되었다.
파일 소유권 충돌 0건, CLAUDE.md 역할 경계 위반 0건, Wave 병렬 구조 실현 가능성 전 Wave 확인.

신규 발견된 CONSIDER 2건은 구현을 블로킹하지 않는다.
- Task 9 props drilling 범위는 에이전트가 파일 조사 후 처리하도록 위임 허용 가능.
- figure-renderer.tsx 누적 수정은 직렬 강제로 충돌 없음.

**구현 단계(orchestrate) 진행 가능.**
