# Detail Consistency Review v2: 도형 렌더링 상세 PLAN v2

> 리뷰어: consistency-reviewer
> 리뷰 회차: 3/3 (최종)
> 리뷰 일자: 2026-03-23
> 검토 대상:
> - 마스터 PLAN: `docs/plan/figure-rendering.md` (v2)
> - 상세 PLAN: `docs/plan/figure-rendering-detail.md` (v2)
> - 비교 기준: `ROADMAP.md`, `docs/retrospective/phase-1-retro.md`, `src/types/supabase.ts`, MEMORY.md

---

## v1 이슈 반영 확인

v1 리뷰에서 제기된 이슈 6건(MUST 1, SHOULD 4, CONSIDER 3)의 반영 여부를 항목별로 확인합니다.

| v1 이슈 | 내용 | 상세 PLAN v2 반영 | ROADMAP 반영 | 판정 |
|---------|------|-----------------|-------------|------|
| MUST #1 | ROADMAP `{{fig:0}}` → `{{fig:1}}` 수정 | — (ROADMAP 대상) | ROADMAP.md 214행 `{{fig:1}}` 확인 ✅ | **반영됨** |
| SHOULD #2 | Task 6 교차 검증 duck typing 시그니처 | Task 2 Step 2: `figures: { length: number } \| undefined` 명시 ✅ | — | **반영됨** |
| SHOULD #3 | MEMORY 체크리스트 useEffect race condition N/A 명시 | 하단 체크리스트: `useEffect race condition → 해당 없음 (N/A)` 명시 ✅ | — | **반영됨** |
| SHOULD #4 | Task 1 `supabase gen types` 실행 금지 명시 | Task 1 에이전트 프롬프트 가이드에 `[SHOULD 9]` 항목으로 명시 ✅ | — | **반영됨** |
| SHOULD #5 | 마스터 PLAN Task 10 → 10a/10b 명칭 동기화 | Task 10a 상단 `[SHOULD 10] NOTE` 추가 ✅ | — | **반영됨** |
| CONSIDER #6 | `dangerouslySetInnerHTML` XSS 교훈 N/A 명시 | MEMORY 체크리스트: `해당 없음 — 순수 SVG JSX, innerHTML 미사용 (N/A)` ✅ | — | **반영됨** |

**결론**: v1 MUST FIX 1건 + SHOULD FIX 4건 + CONSIDER 1건 모두 반영 확인.

---

## 신규 이슈

### ROADMAP.md와의 일치 검토

| ROADMAP 항목 | 상세 PLAN v2 | 판정 |
|-------------|-------------|------|
| Phase 2a: FigureRenderer + description 폴백 | Task 3 (Wave 1) | 일치 |
| Phase 2b: AI 추출 프롬프트 `{{fig:N}}` 삽입 지시 | Task 6 (Wave 2) | 일치 |
| Phase 2c: 커스텀 SVG 렌더러 (수직선→좌표평면→기하도형) | Task 5, 7a, 7b, 8 (Wave 2~3) | 일치 |
| Phase 2d: 연속 도형 수평 배치 + 선택지 도형 | Task 9 (Wave 4) | 일치 |
| Phase 3 (선택): 통계 차트, 인터랙티브 Mafs | 범위 외 명시 | 일치 |
| 단계 1.5 통합 테스트: `{{fig:1}}` → FigureRenderer 렌더링 확인 | Task 11 테스트 케이스 포함 | 일치 |

**신규 불일치 없음.** `{{fig:0}}` → `{{fig:1}}` 수정 확인.

---

### Phase 1 회고 교훈 반영 검토

| 회고 교훈 | 상세 PLAN v2 | 판정 |
|---------|------------|------|
| PLAN 리뷰 최대 3회 | 마스터 PLAN 섹션 10 명시 (이 리뷰가 3회차 — 최종) | 준수됨 |
| Step 단위 빌드 체크 | 각 Task 완료 시 `npm run build` 섹션 ✅ | 반영됨 |
| academy_id IDOR 방지 | Task 10b Step 2 및 MEMORY 체크리스트 ✅ | 반영됨 |
| 에이전트 "기존 패턴 확인 + 일관성 유지" | 모든 Task 에이전트 프롬프트 가이드 ✅ | 반영됨 |
| 마스터 PLAN ↔ 상세 PLAN 동기화 | 상단 "기반 PLAN" 명시 + [SHOULD 10] NOTE ✅ | 반영됨 |
| `/g` 플래그 `lastIndex = 0` 리셋 | Task 2 코드 예시에 `pattern.lastIndex = 0` 직접 명시 ✅ | 반영됨 |
| React.memo 필수 | Task 3, 5, 7a, 7b, 8 전체 명시 ✅ | 반영됨 |
| `// @vitest-environment jsdom` | Task 11 테스트 주의사항 ✅ | 반영됨 |
| useEffect race condition | MEMORY 체크리스트에 N/A 명시 ✅ | 반영됨 |
| `supabase gen types` stderr 오염 | Task 1 에이전트 가이드 `[SHOULD 9]` ✅ | 반영됨 |
| `dangerouslySetInnerHTML` XSS | MEMORY 체크리스트에 N/A 명시 ✅ | 반영됨 |

---

### 기존 타입 호환성 검토

**FigureInfo 격리**: `extractedQuestionSchema.figures`는 `figureInfoSchema[]` 유지, `FigureData`는 별도 추가. Task 6 에이전트 가이드에 `extractedQuestionSchema`, `figureInfoSchema`, `extractionJsonSchema` 수정 금지 명시. 타입 충돌 위험 없음.

**questions 테이블 supabase.ts**: 현재 `src/types/supabase.ts`의 questions 테이블 Row에 `has_figure`, `figures` 컬럼 없음 — Task 1 마이그레이션 후 수동 추가 필요. 상세 PLAN 분석 정확.

**has_figure 타입 정밀도**: 마이그레이션 SQL에 `NOT NULL DEFAULT false` 명시 → Row 타입은 `boolean` (not null). `past_exam_details`의 동일 컬럼은 `boolean | null`로 기존 정의되어 있으나, 새 questions 컬럼은 Task 1 Step 2에서 `has_figure: boolean` (NOT NULL)으로 명시. [CONSIDER #8 from v1] 올바르게 반영됨.

**Wave 의존성 타입 안전**: Task 10b(`toQuestionInsertRow` 확장)는 Task 1(supabase.ts 업데이트) 완료 후 TypeScript 에러 없이 빌드 가능. 의존성 그래프에 명시.

---

### 신규 발견 이슈

신규 이슈 없음.

검토 중 주의 깊게 살펴본 항목들:

1. **`segment.index` 1-based 변환**: Task 4 Step 2에 `figures[segment.index - 1]` 명시 ✅ — 기존 파서의 `{{fig:N}}` N이 1-based임을 코드 예시에서 명확히 처리.

2. **Wave 3 직렬화 (`[MUST 4]`)**: `figure-renderer.tsx` 병렬 충돌 해소를 위해 Wave 3a(Task 7a → 7b 직렬) + Wave 3b(Task 8 — 3개 신규 파일 병렬 + figure-renderer.tsx 1회 수정) 구조. 파일 충돌 없음.

3. **CoordinatePlaneContent 분리 (`[MUST 3]`)**: `coordinate-plane.tsx`에서 내부 `<g>` 엘리먼트(`CoordinatePlaneContent`)와 외부 `<svg>` 래퍼(`CoordinatePlane`)를 분리하여 `function-graph.tsx`가 단일 `<svg>` 안에 합성. 설계 일관성 있음.

4. **Task 9 선택지 파일 경로**: `[SHOULD 6]` 반영으로 `question-detail-sheet.tsx`, `question-card.tsx` 구체 경로 명시. 에이전트 실행 가능.

5. **Gemini discriminated union 호환성 E2E (`[SHOULD 7]`)**: Task 10a Step 4에 수동 검증 단계(questionsJsonSchema 출력 + 실제 API 전송) 추가. 단위 테스트 한계를 명시적으로 보완.

---

## Plan Review Completion Checklist

| 항목 | 상태 |
|------|------|
| 모든 Task의 파일 소유권이 명확하다 | ✅ (Wave 4 에이전트 할당표 포함) |
| Task 간 의존성 순서가 정의되었다 | ✅ (Wave 3a → 3b 직렬, Task 4 → 9 직렬) |
| 외부 의존성(라이브러리, API)이 명시되었다 | ✅ (0개, 순수 SVG JSX) |
| 에러 처리 방식이 정해졌다 | ✅ (displaySize default, description 폴백, 경고 로그) |
| 테스트 전략이 있다 | ✅ (~68개 케이스, Wave 5 독립, 6개 파일) |
| 이전 Phase 회고(`docs/retrospective/phase-1-retro.md`)의 교훈이 반영되었다 | ✅ (전 항목 반영 확인) |
| 병렬 구현 시 파일 충돌 가능성이 없다 | ✅ (Wave 3a/3b 직렬 분리, Task 9/10a/10b 파일 분리) |

---

## 결론: READY

v1 MUST FIX 1건(ROADMAP `{{fig:0}}` → `{{fig:1}}`)이 반영되었고, SHOULD FIX 4건 및 CONSIDER 3건도 모두 상세 PLAN v2에 반영 확인.

신규 MUST FIX 또는 SHOULD FIX 없음.

Plan Review Completion Checklist 7개 항목 전부 충족. **구현 진행 가능.**
