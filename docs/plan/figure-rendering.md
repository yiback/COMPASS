# PLAN: 도형/그래프 렌더링 (단계 1.5-2, F021)

> 작성일: 2026-03-22
> 버전: v2
> 리서치 기반:
> - docs/research/math-figures-recommendation.md
> - docs/research/figure-placement-recommendation.md (v2)
> 상태: ✅ **구현 완료** (2026-03-23, 1367 tests, E2E 통과)
>
> **변경 이력**:
> - v1 → v2 (2026-03-23): 기술 리뷰 + 범위 리뷰 피드백 17개 전부 반영
> - v2 → 구현 완료 (2026-03-23): 11 Task + 코드 리뷰 HIGH 3건 수정 + E2E 검증

---

## 1. 개요

AI가 생성한 JSON 도형 데이터를 커스텀 SVG 렌더러로 변환하여 문제 텍스트 내에 도형을 표시한다.
현재 `[도형 N]` 플레이스홀더로 표시되는 `{{fig:N}}` 세그먼트를 실제 SVG 도형으로 교체하고,
AI 추출/생성 프롬프트가 구조화된 도형 JSON을 출력하도록 변경한다.

**현재 인프라 상태**:
- `parseLatexText`에 `{{fig:N}}` 세그먼트 **이미 파싱됨**
- `LatexSegment`에 `display: 'block' | 'inline'` 필드 **이미 존재** (determineFigureDisplay 함수)
- `LatexRenderer`에 figure `[도형 N]` 플레이스홀더 **이미 존재**
- `past_exam_details` 테이블에 `has_figure`, `figures` **이미 존재**
- `questions` 테이블에 도형 컬럼 **없음** — 마이그레이션 필요

**DB 스키마 변경**: questions 테이블에 `has_figure`, `figures` 컬럼 추가 (마이그레이션 1회)

---

## 2. 확정된 기술 결정 (변경 불가)

| 결정 항목 | 선택 | 근거 |
|----------|------|------|
| 렌더링 방식 | JSON 스키마 + 커스텀 SVG 렌더러 | AI SVG 직접 생성 금지 (XSS + 좌표 부정확) |
| 도형 위치 | `{{fig:N}}` 구분자 통일 | block_before/after 제거 (중간 도형 60% 미처리) |
| 렌더링 크기 | `displaySize: 'large' \| 'small'` | large=블록 가운데, small=인라인 |
| 함수 그래프 | `points` 배열 직접 출력 | eval 위험 회피 |
| 외부 라이브러리 | 0개 | 순수 SVG JSX (번들 0KB) |
| **FigureInfo 불변** | `FigureInfo` (기존) 변경 금지 | 기출 추출 전용 — boundingBox/pageNumber/confidence 구조 유지 |
| **FigureData 신규** | `FigureData`를 `src/lib/ai/types.ts`에 별도 추가 | FigureInfo와 혼용 시 TypeScript 타입 에러 발생 |
| **레이아웃 우선순위** | `segment.display` (파서 판단) 우선 | 구현된 `determineFigureDisplay` 재활용; `displaySize`는 SVG 내부 크기 힌트로만 사용 |
| **coordinate_plane 오버레이** | MVP에서 합성 렌더링 미구현 | 각 도형은 독립 SVG; 필요 시 Phase 3에서 composite 타입 도입 |

---

## 3. 요구사항

### 6가지 도형 타입 (JSON 스키마)

```typescript
// FigureInfo (기존 — 변경 금지): 기출 추출 전용 (boundingBox + pageNumber + confidence)
// FigureData (신규 — src/lib/ai/types.ts에 추가): AI 생성 도형 데이터

type FigureData =
  | { type: 'coordinate_plane'; xRange: [number, number]; yRange: [number, number]; gridStep: number; displaySize: 'large' | 'small'; description: string }
  | { type: 'function_graph'; points: [number, number][]; domain: [number, number]; xRange: [number, number]; yRange: [number, number]; gridStep: number; color?: string; displaySize: 'large' | 'small'; description: string }
  | { type: 'polygon'; vertices: [number, number][]; labels?: string[]; displaySize: 'large' | 'small'; description: string }
  | { type: 'circle'; center: [number, number]; radius: number; displaySize: 'large' | 'small'; description: string }
  | { type: 'vector'; from: [number, number]; to: [number, number]; label?: string; displaySize: 'large' | 'small'; description: string }
  | { type: 'number_line'; min: number; max: number; points: { value: number; label: string }[]; displaySize: 'large' | 'small'; description: string }
```

> **function_graph**: `xRange`, `yRange`, `gridStep`을 포함하여 coordinate_plane 합성 시 좌표축 범위를 AI가 명시적으로 지정. points 자동 추론 방식보다 viewBox 일관성 확보.

### 핵심 기능
1. 6가지 도형 타입 SVG 렌더링
2. `segment.display`(파서 판단) 기반 블록/인라인 레이아웃 결정; `displaySize`는 SVG 내부 크기 힌트
3. `description` 텍스트 폴백 (SVG 렌더링 실패 또는 미구현 타입 시)
4. 연속 도형 수평 배치 (`{{fig:1}}{{fig:2}}`)
5. 선택지 내 도형: `options` 타입은 `string[]` 그대로 유지하며, 선택지 내 `{{fig:N}}` 구분자를 `LatexRenderer`로 렌더링 시 `figures`를 전달하는 방식으로 처리 — 기존 타입 변경 없음
6. AI 추출/생성 프롬프트에 도형 JSON 출력 지시

---

## 4. Task 분해

### 의존성 그래프

```
Task 1 (DB 마이그레이션) ──┐
Task 2 (Zod 스키마) ───────┤
Task 3 (FigureRenderer) ───┘
         │
  ┌──────┼──────┐
  │      │      │
Task 4  Task 5  Task 6
(Latex   (SVG   (AI 추출
 교체)   유틸)   프롬프트)
         │
  ┌──────┼──────┐
Task 7         Task 8
(좌표평면+      (다각형+
 함수그래프)    원+벡터)
         │
  ┌──────┘
Task 9  Task 10
(연속    (AI생성
 도형)   프롬프트)
         │
      Task 11
      (테스트)
```

---

### Task 1: DB 마이그레이션 — questions 테이블 확장

**소유**: db-schema
**파일**: `supabase/migrations/20260322_questions_figures.sql` (신규), `src/types/supabase.ts`
**작업**: `questions` 테이블에 `has_figure BOOLEAN DEFAULT false`, `figures JSONB` 컬럼 추가
**참고**: `past_exam_details` 테이블에 동일 컬럼 이미 존재 (패턴 일관성)
**리스크**: Supabase Cloud 수동 적용 필요 (기존 패턴)
**의존**: 없음 | **작업량**: XS

---

### Task 2: FigureData Zod 스키마

**소유**: backend-actions
**파일**: `src/lib/validations/figure-schema.ts` (신규)
**작업**:
- 6타입 discriminated union Zod 스키마
- `displaySize: z.enum(['large', 'small']).default('large')` — AI 미전송 시 기본값 'large' 자동 적용
- `description: z.string().min(1)` (폴백용)
- 각 타입별 좌표 범위 검증:
  - `coordinate_plane`: `gridStep > 0`, `xRange[0] < xRange[1]`
  - `function_graph`: `points` 배열 최소 2개 최대 50개 `.max(50)`, `domain[0] < domain[1]`, `xRange[0] < xRange[1]`
  - `polygon`: `vertices` 최소 3개
  - `circle`: `radius > 0`
  - `vector`: Zod `.refine((v) => v.from[0] !== v.to[0] || v.from[1] !== v.to[1], { message: '제로 벡터 불가' })` — 배열은 참조 비교 불가이므로 좌표값 직접 비교
  - `number_line`: `min < max`, `points` 최소 1개
- `figures` 배열 + `questionText` 내 `{{fig:N}}` 인덱스 교차 검증 유틸
**의존**: 없음 | **작업량**: S

---

### Task 3: FigureRenderer 기본 컴포넌트

**소유**: frontend-ui
**파일**: `src/components/ui/figure-renderer.tsx` (신규)
**작업**:
- Props: `figure: FigureData`
- 초기 구현: `description` 텍스트 + 아이콘으로 폴백 표시
- 레이아웃은 `LatexRenderer`가 `segment.display`를 보고 결정 (이 컴포넌트 내부에서 블록/인라인 결정 안 함)
- SVG 렌더러는 Wave 2~3에서 점진적 추가
- `React.memo` 적용
**의존**: Task 2 (타입 참조) | **작업량**: S

---

### Task 4: LatexRenderer figure 케이스 업데이트

**소유**: frontend-ui
**파일**: `src/components/ui/latex-renderer.tsx` (기존)
**작업**:
- `renderSegment`의 `case 'figure'`에서 `[도형 N]` → `<FigureRenderer>` 교체
- `LatexRenderer` Props에 `figures?: FigureData[]` 추가 (optional — 하위 호환)
- `figures` 없으면 기존 `[도형 N]` 플레이스홀더 유지 (graceful degradation)
- **레이아웃 결정**: `segment.display === 'block'` → `<div className="flex justify-center my-4">`, `'inline'` → `<span className="inline-flex">` 래퍼. `FigureData.displaySize`는 `FigureRenderer`에 prop으로 전달하여 SVG 내부 크기 힌트로만 사용
- **past_exam_details 하위 호환**: `past_exam_details` 페이지에서는 `LatexRenderer`에 `figures`를 전달하지 않음 — 기존 FigureInfo[] 구조를 FigureData[]로 캐스팅하지 않으며 플레이스홀더 유지
**의존**: Task 3 | **작업량**: S

---

### Task 5: SVG 유틸 + number_line 렌더러

**소유**: frontend-ui
**파일**: `src/components/ui/svg/svg-utils.ts` (신규), `src/components/ui/svg/number-line.tsx` (신규)
**작업**:
- `svg-utils.ts`: 좌표 → SVG viewBox 변환, 선형 보간, 화살표 마커, 눈금 생성
- `number-line.tsx`: 수직선 SVG 렌더링 (가장 단순한 도형 — 첫 번째 SVG 구현)
- viewBox 계산: 데이터 범위 + 여백(padding) 자동 계산
- 눈금(tick mark) + 레이블 배치
**의존**: Task 3 | **작업량**: M

---

### Task 6: AI 추출 프롬프트 figures JSON 출력

**소유**: ai-integration
**파일**: `src/lib/ai/prompts/question-extraction.ts` (기존), `src/lib/ai/extraction-validation.ts` (기존), `src/lib/ai/types.ts` (공유 파일 — 리드 승인 필요)
**작업**:
- **`FigureInfo` 변경 금지**: `src/lib/ai/types.ts`의 기존 `FigureInfo` 인터페이스 및 `ExtractedQuestion.figures?: readonly FigureInfo[]`는 그대로 유지
- **`FigureData` 신규 추가**: `src/lib/ai/types.ts`에 `FigureData` discriminated union 타입을 별도로 추가 (FigureInfo와 별개)
- `FigureInfo` 기존 사용처 영향 없음 확인 (FigureInfo를 변경하지 않으므로 연쇄 타입 에러 없음)
- 추출 시스템 지시: bounding box → JSON 도형 데이터 + `{{fig:N}}` 구분자
- `extractedQuestionSchema`에 `figures` 필드를 FigureData Zod 스키마로 교체
- `questionText`에 `{{fig:N}}` 삽입 지시 추가
- `validateExtractedQuestions`에 figures 인덱스 교차 검증 추가
**의존**: Task 2 | **작업량**: M

---

### Task 7: coordinate_plane + function_graph SVG 렌더러

**소유**: frontend-ui
**파일**: `src/components/ui/svg/coordinate-plane.tsx` (신규), `src/components/ui/svg/function-graph.tsx` (신규)
**작업**:
- `coordinate-plane.tsx`: 축(화살표), 그리드, 눈금, 원점 라벨
- `function-graph.tsx`: `xRange`, `yRange`, `gridStep`으로 coordinate_plane 내부 합성 + points → SVG `<polyline>` 오버레이
- **Wave 3 구현 순서**: coordinate_plane 먼저 → function_graph 다음 (function_graph는 coordinate_plane에 의존)
**의존**: Task 5 (svg-utils) | **작업량**: M

---

### Task 8: polygon + circle + vector SVG 렌더러

**소유**: frontend-ui
**파일**: `src/components/ui/svg/polygon.tsx` (신규), `src/components/ui/svg/circle-shape.tsx` (신규), `src/components/ui/svg/vector-arrow.tsx` (신규)
**작업**:
- `polygon.tsx`: vertices → SVG `<polygon>`, 꼭짓점 라벨
- `circle-shape.tsx`: center + radius → SVG `<circle>`, 중심점 표시
- `vector-arrow.tsx`: from→to → SVG `<line>` + 화살표 마커, 라벨
- **독립 SVG**: 각 도형은 독립 SVG로 렌더링 (합성 미구현 — Task 7 coordinate_plane과 시각적 합성 불가, Phase 3에서 composite 도입 고려)
- polygon/circle/vector 3개는 서로 독립이므로 Wave 3 내 병렬 구현 가능
**의존**: Task 5 (svg-utils) | **작업량**: M

---

### Task 9: 연속 도형 수평 배치 + 선택지 도형

**소유**: frontend-ui
**파일**: `src/components/ui/latex-renderer.tsx` (기존)
**작업**:
- 연속 figure 세그먼트 감지: `segments[i].type === 'figure' && segments[i+1]?.type === 'figure'`
- 연속 figure → `<div className="flex flex-row gap-4 justify-center">` 래퍼
- 선택지 내 `{{fig:N}}`: `options` 배열 내 텍스트를 `LatexRenderer`로 렌더링 시 `figures` 전달 (options 타입 `string[]` 그대로 — 타입 변경 없음)
- **Wave 4 시작 조건**: Wave 2 Task 4 완료 + 빌드 통과 확인 후에만 이 Task 시작 (`latex-renderer.tsx` 동일 파일 연속 수정 — 병렬 불가)
- **Task 10과의 관계**: Task 9(latex-renderer.tsx 수정)와 Task 10(ai/save-questions 파일 수정)은 서로 다른 파일이므로 Wave 4에서 병렬 구현 가능
**의존**: Task 4, 7, 8 | **작업량**: S

---

### Task 10: AI 생성 프롬프트 도형 출력 + save-questions 확장

**소유**: ai-integration (AI 파일), backend-actions (save-questions 파일)
**파일**:
- `src/lib/ai/prompts/question-generation.ts` (기존) — ai-integration
- `src/lib/ai/prompts/past-exam-generation.ts` (기존) — ai-integration
- `src/lib/ai/validation.ts` (기존) — ai-integration
- `src/lib/validations/save-questions.ts` (기존) — backend-actions
- `src/lib/actions/save-questions.ts` (기존) — backend-actions

**작업 (AI 파일)**:
- 생성 시스템 지시: "텍스트로 대체" → JSON 도형 데이터 출력 + `{{fig:N}}` 구분자
- AI 프롬프트에 "최대 20개 포인트" 명시 (토큰 비용 제어)
- `generatedQuestionSchema`에 `hasFigure`, `figures` 필드 추가
- `validateGeneratedQuestions`에 figures 검증 로직 추가
- `GeneratedQuestion` 타입에 `hasFigure`, `figures` 추가 — 리드 승인 필요
- **품질 검증 범위**: 프롬프트 구조 검증만 이 Task에서 수행; 실제 Gemini 출력 품질은 E2E/수동 확인

**작업 (save-questions 파일)**:
- `src/lib/validations/save-questions.ts`: `questionToSaveSchema`에 `hasFigure: z.boolean().optional()`, `figures: z.array(figureDataSchema).optional()` 추가
- `src/lib/actions/save-questions.ts`: DB INSERT에 `has_figure`, `figures` 컬럼 포함 (`toQuestionInsertRow` 함수 확장)

**의존**: Task 2, 6 | **작업량**: M

---

### Task 11: 전체 테스트

**소유**: tester
**파일**:
- `src/lib/validations/__tests__/figure-schema.test.ts` (신규)
- `src/components/ui/__tests__/figure-renderer.test.tsx` (신규)
- `src/components/ui/svg/__tests__/` (신규)
- `src/components/ui/__tests__/latex-renderer-figure.test.tsx` (신규)
- `src/lib/ai/__tests__/figure-prompt.test.ts` (신규)

**테스트 케이스 (~68개)**:

| 대상 | 테스트 수 |
|------|----------|
| FigureData Zod (6타입 유효/무효, vector .refine, displaySize default) | ~20 |
| FigureRenderer (description 폴백, displaySize 힌트 전달) | ~6 |
| SVG 렌더러 (각 타입별 viewBox, 좌표, 엘리먼트) | ~24 |
| LatexRenderer figure 통합 (figures 전달, 연속 도형, past_exam_details 미전달) | ~8 |
| AI 프롬프트 figures 파싱 (추출/생성 — 구조 검증만, Mock 기반) | ~4 |
| 교차 검증 (figures 인덱스 불일치) | ~6 |

**의존**: Task 2~10 전체 완료 후 | **작업량**: M

---

## 5. 구현 순서 (Wave)

```
Wave 1 (직렬 — 기반):
  Task 1 (DB 마이그레이션)
  Task 2 (Zod 스키마)
  Task 3 (FigureRenderer 기본)

Wave 2 (병렬 — 독립 작업):
  Task 4 (LatexRenderer 업데이트)  ← frontend-ui (latex-renderer.tsx)
  Task 5 (SVG 유틸 + number_line)  ← frontend-ui (svg/ 디렉토리)
  Task 6 (AI 추출 프롬프트)         ← ai-integration

  ⚠️ Task 4 완료 후 빌드 통과 확인 → Wave 4 Task 9 시작 가능

Wave 3 (단계적 SVG 렌더러 확장):
  1단계: coordinate_plane (Task 7 일부) — 먼저 구현
  2단계: function_graph (Task 7 완성) — coordinate_plane 완료 후
  3단계: polygon + circle + vector (Task 8) — svg-utils 완료 후, Task 7과 병렬 가능

  ✅ 단계적 출시 기준: Wave 3 완료 전에도 number_line(Task 5) + coordinate_plane만으로
     MVP 기능 동작 가능. 미구현 타입은 Task 3의 description 폴백으로 처리됨.

Wave 4 (병렬):
  Task 9 (연속 도형 + 선택지)   ← frontend-ui (latex-renderer.tsx)
  Task 10 (AI 생성 프롬프트      ← ai-integration + backend-actions
           + save-questions 확장)

  ✅ Task 9와 Task 10은 서로 다른 파일을 수정하므로 병렬 구현 가능.
  ⚠️ Task 9는 Wave 2 Task 4 완료 + 빌드 통과 확인 후에만 시작 (latex-renderer.tsx 직렬).

Wave 5 (직렬 — 전체 테스트):
  Task 11 (전체 테스트)  ← tester
  Task 2~10 전체 완료 후 시작
```

---

## 6. 파일 소유권

| 파일 | 역할 | Wave |
|------|------|------|
| `supabase/migrations/20260322_questions_figures.sql` (신규) | db-schema | 1 |
| `src/types/supabase.ts` | db-schema | 1 |
| `src/lib/validations/figure-schema.ts` (신규) | backend-actions | 1 |
| `src/components/ui/figure-renderer.tsx` (신규) | frontend-ui | 1 |
| `src/components/ui/latex-renderer.tsx` (기존) | frontend-ui | 2, 4 (직렬) |
| `src/components/ui/svg/svg-utils.ts` (신규) | frontend-ui | 2 |
| `src/components/ui/svg/number-line.tsx` (신규) | frontend-ui | 2 |
| `src/components/ui/svg/coordinate-plane.tsx` (신규) | frontend-ui | 3 |
| `src/components/ui/svg/function-graph.tsx` (신규) | frontend-ui | 3 |
| `src/components/ui/svg/polygon.tsx` (신규) | frontend-ui | 3 |
| `src/components/ui/svg/circle-shape.tsx` (신규) | frontend-ui | 3 |
| `src/components/ui/svg/vector-arrow.tsx` (신규) | frontend-ui | 3 |
| `src/lib/ai/prompts/question-extraction.ts` (기존) | ai-integration | 2 |
| `src/lib/ai/extraction-validation.ts` (기존) | ai-integration | 2 |
| `src/lib/ai/types.ts` (공유) | **리드 승인 필요** (FigureData 추가) | 2 |
| `src/lib/ai/prompts/question-generation.ts` (기존) | ai-integration | 4 |
| `src/lib/ai/prompts/past-exam-generation.ts` (기존) | ai-integration | 4 |
| `src/lib/ai/validation.ts` (기존) | ai-integration | 4 |
| `src/lib/validations/save-questions.ts` (기존) | backend-actions | 4 |
| `src/lib/actions/save-questions.ts` (기존) | backend-actions | 4 |
| `__tests__/` 전체 | tester | **5** |

---

## 7. 에러 처리

| 에러 상황 | 처리 |
|----------|------|
| figures 배열 없음 (null/undefined) | `[도형 N]` 플레이스홀더 유지 |
| figures[N] 인덱스 범위 초과 | description 텍스트 폴백 |
| SVG 렌더링 실패 | try/catch → description 텍스트 폴백 |
| Zod 검증 실패 (좌표 범위 초과, 제로 벡터) | AIValidationError → 사용자 알림 |
| AI figures 인덱스 불일치 | 교차 검증 → 경고 (부분 성공 허용) |
| displaySize 누락 | Zod `.default('large')` — 스키마에서 자동 처리 |
| DB 마이그레이션 실패 | Supabase Cloud 수동 적용 (기존 패턴) |
| 미구현 도형 타입 | description 텍스트 폴백 (Wave 3 단계적 구현 기간 중) |

---

## 8. 테스트 전략 (~68개)

| 대상 | 테스트 수 | 도구 |
|------|----------|------|
| FigureData Zod 스키마 (6타입 유효/무효, vector .refine, displaySize default) | ~20 | Vitest |
| FigureRenderer (description 폴백, displaySize 힌트 전달) | ~6 | Vitest + testing-library |
| SVG 렌더러 (각 타입별 viewBox, 좌표, 엘리먼트) | ~24 | Vitest + testing-library |
| LatexRenderer figure 통합 (figures 전달, 연속 도형, past_exam_details 미전달) | ~8 | Vitest + testing-library |
| AI 프롬프트 figures 파싱 (구조 검증만 — Mock 기반, 출력 품질은 E2E/수동) | ~4 | Vitest |
| 교차 검증 (인덱스 불일치) | ~6 | Vitest |
| **커버리지 목표** | **80%+** | |

---

## 9. 리스크

| 리스크 | 수준 | 완화 |
|--------|------|------|
| AI 좌표 부정확 (삼각형 꼭짓점, 그래프 포인트) | HIGH | Zod 범위 검증 + 선생님 검수 편집 (기존 UI) |
| 커스텀 SVG 개발 비용 | MEDIUM | 단계적 구현 (number_line → coordinate_plane → function_graph → 기하도형) |
| `questions` 마이그레이션 Cloud 수동 적용 | MEDIUM | SQL 파일 작성 → Dashboard SQL Editor 실행 |
| AI figures 인덱스 ↔ `{{fig:N}}` 불일치 | MEDIUM | 교차 검증 유틸 + 부분 성공 허용 |
| `src/lib/ai/types.ts` 공유 파일 수정 충돌 | LOW | FigureData 추가만 (FigureInfo 불변) → 리드 승인 후 단일 수정자 |
| Task 4, 9 동일 파일 (`latex-renderer.tsx`) | LOW | Wave 2 Task 4 완료 + 빌드 확인 → Wave 4 Task 9 시작 (직렬 강제) |
| Wave 3 SVG 구현 비용 과소 추정 | LOW | 3-4일 여유 일정 확보, 단계적 출시 기준으로 일정 리스크 완화 |

---

## 10. Phase 1 회고 교훈 반영

| 교훈 | 반영 |
|------|------|
| PLAN 리뷰 최대 3회 | 이 PLAN은 2회 리뷰 후 구현 진행 |
| Step 단위 빌드 체크 | 각 Task 완료 즉시 `npm run build` |
| academy_id 필터 체크리스트 | Task 6, 10에서 Server Action 수정 시 적용 |
| 에이전트 "기존 패턴 확인 + 일관성 유지" | 각 에이전트 프롬프트에 명시 |
| 마스터 PLAN ↔ 상세 PLAN 동기화 | 리뷰 변경 시 양쪽 즉시 업데이트 |
| `/g` 플래그 정규식 `lastIndex` 리셋 | SVG 유틸에서 정규식 사용 시 lastIndex = 0 리셋 |

---

## 11. 작업량 추정

| Wave | 작업량 | 기간 |
|------|-------|------|
| Wave 1 (기반) | S | 1-2일 |
| Wave 2 (병렬) | M | 2-3일 |
| Wave 3 (SVG 확장 — 단계적) | M | 3-4일 |
| Wave 4 (마무리 병렬) | S | 1-2일 |
| Wave 5 (전체 테스트) | M | 1-2일 |
| **총계** | **L** | **~8-13일** |

---

## 12. Plan Review Completion Checklist

- [x] 모든 Task의 파일 소유권이 명확하다 — save-questions.ts(action/validation) 포함
- [x] Task 간 의존성 순서가 정의되었다 — Wave 5 분리, Wave 3 내 단계 명시
- [x] 외부 의존성(라이브러리, API)이 명시되었다 — 0개 (순수 SVG JSX)
- [x] 에러 처리 방식이 정해졌다 — displaySize .default('large') Zod 처리, 미구현 타입 폴백
- [x] 테스트 전략이 있다 — ~68개 케이스, Wave 5 독립
- [x] 이전 Phase 회고(`docs/retrospective/phase-1-retro.md`)의 교훈이 반영되었다
- [x] 병렬 구현 시 파일 충돌 가능성이 없다 — Task 9/10 파일 분리 확인, Task 4→9 직렬 강제

**판정: READY**

> **리뷰 반영 요약**: MUST FIX 3개, SHOULD FIX 5개, CONSIDER 4개 전부 수용.
> FigureInfo 불변 + FigureData 신규 추가로 타입 충돌 해소.
> Task 11 Wave 5 독립, Task 9/10 병렬 가능 명시, save-questions 범위 확장.
