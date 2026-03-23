# Detail Consistency Review: 도형 렌더링 상세 PLAN

> 리뷰어: consistency-reviewer
> 리뷰 일자: 2026-03-23
> 검토 대상:
> - 마스터 PLAN: `docs/plan/figure-rendering.md` (v2)
> - 상세 PLAN: `docs/plan/figure-rendering-detail.md`
> - 비교 기준: `ROADMAP.md`, `docs/retrospective/phase-1-retro.md`, `src/types/supabase.ts`, MEMORY.md

---

## 1. ROADMAP.md와의 일치 검토

### 결과: 전반적으로 일치

ROADMAP.md 단계 1.5-2 항목에서 확인한 내용과 상세 PLAN의 일치 여부:

| ROADMAP 항목 | 상세 PLAN | 판정 |
|-------------|----------|------|
| Phase 2a: FigureRenderer + description 폴백 | Task 3 (Wave 1) ✅ | 일치 |
| Phase 2b: AI 추출 프롬프트 {{fig:N}} 삽입 지시 | Task 6 (Wave 2) ✅ | 일치 |
| Phase 2c: 커스텀 SVG 렌더러 — 수직선→좌표평면→기하도형 | Task 5,7,8 (Wave 2~3) ✅ | 일치 |
| Phase 2d: 연속 도형 수평 배치 + 선택지 도형 | Task 9 (Wave 4) ✅ | 일치 |
| Phase 3 (선택): 통계 차트 Recharts, 인터랙티브 Mafs | 범위 외 (명시적 제외) ✅ | 일치 |
| 단계 1.5 통합 테스트: `{{fig:0}}` → FigureRenderer 렌더링 확인 | Task 11 테스트에 포함 ✅ | 일치 |

**경미한 불일치 발견**:

ROADMAP의 통합 테스트 항목에 `{{fig:0}}`이라고 표기되어 있으나, 상세 PLAN과 마스터 PLAN 전체에서 `{{fig:N}}`는 1-based(1부터 시작)로 정의되어 있습니다. `{{fig:0}}`는 유효하지 않은 인덱스입니다.

---

## 이슈 목록

### [MUST FIX] #1: ROADMAP 통합 테스트 항목의 `{{fig:0}}` 표기 오류

**위치**: `ROADMAP.md` 단계 1.5 통합 테스트 섹션
```
- [ ] (1.5-2 완료 후) `{{fig:0}}` → FigureRenderer 렌더링 확인
```

**문제**: 상세 PLAN Task 2 (`validateFigureIndices`), Task 4 (`segment.index - 1` 배열 접근), Task 11 테스트 케이스 전체에서 `{{fig:N}}`은 1-based(N≥1)로 정의됨. `{{fig:0}}`은 유효하지 않은 인덱스이며, 실제로 figures[-1]을 참조하게 되어 항상 `undefined` → 플레이스홀더 표시. 통합 테스트로서 의미 없음.

**영향**: E2E 통합 테스트 시나리오가 실제 렌더링 검증 없이 통과하거나, 테스트 담당자가 혼란.

**권고 수정**: ROADMAP.md의 해당 항목을 `{{fig:1}}`로 수정.

> 단, 본 리뷰어는 ROADMAP.md를 직접 수정하지 않음 (docs/plan/ 직접 수정 금지 규칙 준용, ROADMAP.md는 리드 only).
<!-- NOTE: ROADMAP.md 수정 -->>
---

### [SHOULD FIX] #2: Task 6 교차 검증 — 타입 불일치 처리 방식 불명확

**위치**: 상세 PLAN Task 6 Step 2

```typescript
const warnings = validateFigureIndices(q.questionText, q.figures ? [...q.figures] : undefined)
```

**문제**: `validateFigureIndices`는 `FigureData[] | undefined`를 받도록 설계되어 있으나 (Task 2 정의), Task 6에서의 `q.figures`는 `figureInfoSchema[]` 타입 (FigureInfo — 변경 금지). 스프레드(`[...q.figures]`)로 복사해도 타입 불일치는 해소되지 않음.

상세 PLAN에서 이를 인식하고 있음("길이만 확인하는 별도 헬퍼 함수 사용 또는 오버로드 고려"라고 언급) — 그러나 최종 코드 예시는 타입 에러를 유발하는 방식으로 작성되어 있음. 에이전트가 그대로 구현하면 TypeScript 타입 에러 또는 `as any` 캐스팅 발생.

**권고**: Task 2의 `validateFigureIndices` 시그니처를 `figures: { length: number } | undefined`(duck typing)로 변경하거나, `figures.length`만 확인하는 별도 `validateFigureCount(questionText: string, figureCount: number): string[]` 함수를 Task 2에 추가하고 Task 6/Task 10a에서 각각 적합한 함수를 사용하도록 명시.
<!-- NOTE: Task 2의 `validateFigureIndices` 시그니처를 `figures: { length: number } | undefined`(duck typing)로 변경--> >
---

### [SHOULD FIX] #3: 상세 PLAN에 useEffect race condition 교훈 적용 위치 미명시

**위치**: 상세 PLAN MEMORY.md 교훈 체크리스트

MEMORY.md에는 `useEffect race condition: let cancelled = false + cleanup` 교훈이 있으나, 상세 PLAN의 MEMORY.md 교훈 체크리스트에 포함되지 않음. 마스터 PLAN 섹션 10(Phase 1 회고 교훈)에도 누락되어 있음.

**적용 여부 분석**: 이번 구현(SVG 렌더링, Zod 검증, AI 프롬프트)에는 비동기 useEffect 패턴이 없어 직접 적용 대상이 아님. 단, Task 9(연속 도형 그룹화)나 Task 4(LatexRenderer 클로저 이동)에서 향후 확장 시 유의가 필요한 교훈.

**권고**: 체크리스트에 `| useEffect race condition (비동기 없으면 해당 없음 — N/A) |`와 같이 명시적으로 N/A 처리하여 리뷰어가 누락과 의도적 제외를 구분할 수 있도록 표기.
<!-- NOTE: 적용 -->
---

### [SHOULD FIX] #4: questions 테이블 supabase.ts에 has_figure/figures 컬럼이 이미 존재

**위치**: `src/types/supabase.ts` questions 테이블 → Task 1 Step 2

현재 `src/types/supabase.ts`의 `questions` 테이블 Row/Insert/Update에 `has_figure`, `figures` 컬럼이 **없음** (검토 결과, 현재 Row에는 해당 컬럼 없음). 그러나 **`past_exam_details` 또는 다른 테이블에 해당 컬럼이 이미 존재**하는 것을 확인 (`figures: Json | null`, `has_figure: boolean | null`이 라인 508~541에 있음 — 이는 `past_exam_details` 테이블의 컬럼).

questions 테이블 (라인 820~932)에는 `has_figure`, `figures` 컬럼이 현재 없음. Task 1의 DB 마이그레이션 + Task 1 Step 2의 타입 업데이트는 정확히 필요한 작업. **상세 PLAN의 분석이 정확하며 이슈 없음.**

> 단, supabase.ts가 "자동 생성 타입 파일"이라고 명시되어 있으나 이 프로젝트에서는 수동으로 유지됨(MEMORY.md: "`supabase gen types` stderr 오염" 교훈). 에이전트가 자동 재생성 명령을 실행할 경우 기존 타입이 손실될 위험이 있음. **Task 1 에이전트 프롬프트에 "supabase gen types 명령 실행 금지, 수동으로 타입 추가" 명시 필요.**
<!-- NOTE: 적용 -->
---

### [SHOULD FIX] #5: 마스터 PLAN ↔ 상세 PLAN 동기화 — Task 번호 명칭 차이

**위치**: 마스터 PLAN 섹션 4 Task 분해 vs. 상세 PLAN Wave 4

마스터 PLAN에서는 Task 10이 단일 Task로 기술되어 있으나, 상세 PLAN에서는 Task 10a(ai-integration)와 Task 10b(backend-actions)로 분리됨. 마스터 PLAN 섹션 6 파일 소유권 표에는 여전히 "Task 10"으로 표기.

**영향**: 미미함 (내용은 동일하게 반영됨). 단, 구현 중 에이전트 간 소통에서 "Task 10 완료"의 의미가 모호해질 수 있음.

**권고**: 마스터 PLAN 섹션 4 Task 10의 표제를 "Task 10a/10b"로 업데이트하거나, 상세 PLAN에서 분리 이유를 명시. (마스터 PLAN은 리드가 직접 수정 — 에이전트 금지.)
<!-- NOTE: 적용 -->
---

### [CONSIDER] #6: `dangerouslySetInnerHTML` + KaTeX 교훈의 상세 PLAN 적용 확인

**위치**: MEMORY.md "LaTeX 렌더링 기술 교훈 (세션 28)" vs. 상세 PLAN

MEMORY.md: "catch 폴백에서 원본 content를 직접 삽입하면 XSS 위험 → HTML 특수문자 이스케이프 필수"

상세 PLAN에서 `FigurePlaceholder`(Task 3)는 `description` 텍스트를 JSX 텍스트 노드로 렌더링(`{figure.description}`)하므로 React가 자동 이스케이프함. `dangerouslySetInnerHTML` 미사용 → 이 교훈의 적용 필요 없음. SVG 컴포넌트들도 모두 JSX 속성으로 값을 전달하므로 XSS 위험 없음.

**결론**: 해당 교훈이 이번 구현에는 해당 없음. 명시적으로 N/A 처리 권장 (SHOULD FIX #3과 동일한 이유).
<!-- NOTE: 적용 -->
---

### [CONSIDER] #7: Phase 1 회고 "상세 계획 별도 리뷰 생략" 규칙과 현재 리뷰의 관계

**위치**: `docs/retrospective/phase-1-retro.md` 섹션 4 항목 2
```
2. 상세 계획 별도 리뷰 생략: 마스터 PLAN 리뷰 완료 = 구현 진행
```

마스터 PLAN(figure-rendering.md v2)은 이미 리뷰 완료, 사용자 승인 대기 상태로 표기됨. 그러나 현재 상세 PLAN에 대한 별도 리뷰(tech, scope, consistency 3팀)가 진행 중.

**분석**: 회고 교훈은 "상세 계획 별도 리뷰 생략"을 권장하지만, 이는 "완벽한 상세 계획이 아니어도 구현으로 넘어가라"는 의미이지 "상세 계획 리뷰 자체를 금지"하는 것은 아님. 특히 상세 PLAN에서 타입 불일치(SHOULD FIX #2), ROADMAP 인덱스 오류(MUST FIX #1) 등 실질적인 이슈가 발견되었으므로 이번 리뷰는 가치 있음.

**결론**: 현재 리뷰는 규칙을 위반하지 않음. 다만 이번 리뷰 이후 추가 반복 없이 즉시 구현 진행 권장.

---

### [CONSIDER] #8: supabase.ts Task 1 Step 2 — `has_figure: boolean | null` vs `has_figure: boolean`

**위치**: 상세 PLAN Task 1 Step 2

상세 PLAN에서 Row 타입에 `has_figure: boolean`(not null)으로 추가 예정. 그러나 마이그레이션 SQL에는 `NOT NULL DEFAULT false`로 정의되어 있어 DB 레벨에서 null 불가. supabase.ts를 수동으로 업데이트할 때 `boolean`(not null)으로 작성하는 것이 정확함.

`past_exam_details`의 동일 컬럼은 `has_figure: boolean | null`로 정의되어 있음(라인 509). 패턴 일관성을 우선시할지, 실제 스키마 제약을 반영할지 결정 필요.

**권고**: 마이그레이션에 `NOT NULL DEFAULT false`를 명시했으므로 supabase.ts Row 타입도 `has_figure: boolean`(not null)으로 정의하는 것이 타입 안전성 측면에서 올바름. 기존 `past_exam_details` 컬럼이 nullable로 정의된 것은 해당 마이그레이션의 설계 차이이며, questions의 새 컬럼은 올바르게 not null로 설계됨. 에이전트 프롬프트에 이 점을 명시 권장.
<!-- NOTE: 적용 -->
---

## 2. Phase 1 회고 교훈 반영 검토

| 회고 교훈 | 마스터 PLAN 반영 | 상세 PLAN 반영 | 판정 |
|---------|----------------|--------------|------|
| PLAN 리뷰 최대 3회 | 섹션 10에 명시 ✅ | 해당 없음 (상세 PLAN은 리뷰 대상) | 반영됨 |
| Step 단위 빌드 체크 | 섹션 10에 명시 ✅ | 각 Task마다 "빌드 체크" 섹션 ✅ | 반영됨 |
| academy_id 필터 체크리스트 | 섹션 10에 명시 ✅ | Task 10b Step 2 및 MEMORY 체크리스트 ✅ | 반영됨 |
| 에이전트 "기존 패턴 확인 + 일관성 유지" | 섹션 10에 명시 ✅ | 모든 Task에 "에이전트 프롬프트 가이드" 섹션 ✅ | 반영됨 |
| 마스터 PLAN ↔ 상세 PLAN 동기화 | 섹션 10에 명시 ✅ | 상단에 "기반 PLAN" 명시 ✅ | 반영됨 |
| `/g` 플래그 `lastIndex` 리셋 | 섹션 10에 명시 ✅ | Task 2 코드 예시에 `pattern.lastIndex = 0` 명시 ✅ | 반영됨 |
| React.memo 필수 | MEMORY.md 교훈 | Task 3, 5, 7, 8 모두 명시 ✅ | 반영됨 |
| `// @vitest-environment jsdom` | MEMORY.md 교훈 | Task 11 테스트 주의사항에 명시 ✅ | 반영됨 |
| useEffect race condition | MEMORY.md 교훈 | 체크리스트 미포함 ⚠️ | SHOULD FIX #3 |
| `supabase gen types` stderr 오염 | MEMORY.md 교훈 | 에이전트 가이드에 미명시 ⚠️ | SHOULD FIX #4 |

---

## 3. 기존 타입 호환성 검토

### questions 테이블 현재 상태 (src/types/supabase.ts 기준)

현재 `questions` 테이블 Row 타입에는 `has_figure`, `figures` 컬럼이 **존재하지 않음**. Task 1 마이그레이션 + 타입 업데이트가 올바르게 필요한 작업임을 확인.

### save-questions.ts와의 호환성

Task 10b에서 `toQuestionInsertRow`에 `has_figure`, `figures` 추가 예정. Task 1 마이그레이션 완료 후 supabase.ts 타입이 업데이트되지 않으면 Task 10b에서 TypeScript 타입 에러 발생. **Wave 1 Task 1 완료 → supabase.ts 업데이트 → Wave 4 Task 10b 순서가 반드시 지켜져야 함** — 상세 PLAN의 의존성 그래프에 이미 반영되어 있음 (Task 10b의 의존: "Task 1 DB 컬럼 추가"). 정상.

### FigureInfo (변경 금지) 격리 확인

`extractedQuestionSchema`의 `figures` 필드는 `figureInfoSchema[]`로 유지됨. Task 6에서 이를 변경하지 않도록 명시적으로 가드레일을 설정함. 신규 `FigureData`는 `src/lib/ai/types.ts`에 별도 추가. 타입 충돌 위험 없음.

---

## 4. MEMORY.md 교훈 반영 검토 (요약)

| MEMORY.md 교훈 | 상세 PLAN 반영 |
|--------------|--------------|
| `/g` 플래그 lastIndex 리셋 | Task 2 코드 예시에 직접 명시 ✅ |
| useEffect race condition | 이번 구현에 비동기 useEffect 없음 — 체크리스트에 N/A 명시 권장 ⚠️ |
| React.memo | Task 3, 5, 7, 8 전체 ✅ |
| `// @vitest-environment jsdom` | Task 11 테스트 주의사항 ✅ |
| KaTeX `dangerouslySetInnerHTML` XSS | 이번 구현에 해당 없음 — 체크리스트에 N/A 명시 권장 ⚠️ |
| Zod v4 `errorMap → error` 키 | Task 2 Zod 스키마 작성 시 명시 ✅ |
| `supabase gen types` stderr 오염 | Task 1 에이전트 가이드에 미명시 ⚠️ |
| Server Action `{ error }` 반환 | 이번 구현 Server Action 없음 — 해당 없음 ✅ |
| academy_id IDOR 방지 | Task 10b 에이전트 가이드 ✅ |

---

## 5. Plan Review Completion Checklist 판정

| 항목 | 상태 |
|------|------|
| 모든 Task의 파일 소유권이 명확하다 | ✅ |
| Task 간 의존성 순서가 정의되었다 | ✅ |
| 외부 의존성(라이브러리, API)이 명시되었다 | ✅ (0개, 순수 SVG JSX) |
| 에러 처리 방식이 정해졌다 | ✅ |
| 테스트 전략이 있다 | ✅ (~68개, Wave 5 독립) |
| 이전 Phase 회고의 교훈이 반영되었다 | ✅ (일부 N/A 명시 권장 — SHOULD FIX #3) |
| 병렬 구현 시 파일 충돌 가능성이 없다 | ✅ |

---

## 결론: READY (조건부)

**MUST FIX (1건)**:
- #1: ROADMAP.md 통합 테스트 항목 `{{fig:0}}` → `{{fig:1}}`로 수정 (리드가 ROADMAP.md 직접 수정)

**SHOULD FIX (4건)**:
- #2: Task 6 교차 검증 타입 불일치 처리 방법 명시 (별도 헬퍼 함수 또는 시그니처 변경)
- #3: MEMORY.md 체크리스트에 useEffect race condition N/A 명시
- #4: Task 1 에이전트 프롬프트에 "`supabase gen types` 실행 금지, 수동 타입 추가" 명시
- #5: 마스터 PLAN Task 10 → Task 10a/10b 명칭 동기화

**CONSIDER (3건)**:
- #6: `dangerouslySetInnerHTML` XSS 교훈 N/A 명시
- #7: 상세 PLAN 별도 리뷰 진행은 회고 교훈 위반이 아님 — 이후 추가 반복 없이 구현 진행
- #8: `has_figure: boolean` (not null) vs `has_figure: boolean | null` 에이전트 안내 필요

MUST FIX #1은 ROADMAP.md 수정만 필요하며 상세 PLAN 자체를 막지 않음. SHOULD FIX들도 구현 진행을 막는 수준의 이슈가 아님. **리드가 ROADMAP.md 수정 후 즉시 구현 진행 가능.**
