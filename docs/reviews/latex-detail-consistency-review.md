# LaTeX 렌더링 상세 PLAN 정합성 리뷰 (Consistency Review)

> **작성일**: 2026-03-22
> **담당**: consistency-reviewer
> **검토 대상**:
> - `docs/plan/latex-wave1.md` ~ `latex-wave4.md` (상세 PLAN)
> - `docs/plan/latex-rendering.md` (마스터 PLAN v2)
> - `ROADMAP.md` 단계 1.5-1
> - `MEMORY.md` 반복 실수·기술 교훈
> - `src/lib/ai/types.ts` (FigureInfo, ExtractedQuestion)
> - `docs/research/figure-placement-recommendation.md` v2

---

## 요약

전체적으로 Wave 1~4 상세 PLAN과 마스터 PLAN의 정합성은 높지만,
**마스터 PLAN v2와 상세 PLAN(Wave 1, 4) 사이에 `LatexSegment` 타입 불일치가 1건** 발견되었다.
또한 ROADMAP의 Task 8 테스트 수 불일치, MEMORY.md 교훈 반영 누락, useDebounce 훅 처리 불일치가
추가로 확인된다.

---

## 이슈 목록

---

### [MUST FIX] #1: `LatexSegment` figure 타입 불일치 — 마스터 PLAN vs 상세 PLAN

**발견 위치**: `docs/plan/latex-rendering.md` (마스터 PLAN v2) vs `docs/plan/latex-wave1.md` (Task 2) + `docs/plan/latex-wave4.md` (Task 8)

**문제**:

마스터 PLAN v2 (`latex-rendering.md` 97~98줄)에 정의된 `LatexSegment` figure 타입:
```typescript
| { type: 'figure'; index: number }     // {{fig:N}} [v2 추가]
```

Wave 1 상세 PLAN (`latex-wave1.md` 53줄)에 정의된 `LatexSegment` figure 타입:
```typescript
| { type: 'figure'; index: number; display: 'block' | 'inline' }  // {{fig:N}}
```

Wave 1에는 `display: 'block' | 'inline'` 필드가 추가되어 있고,
마스터 PLAN에는 이 필드가 없다.

**영향**:
- Wave 4 테스트 헬퍼(`latex-wave4.md` 27~29줄)에서도 `display` 파라미터를 포함한 `figure()` 함수를 사용함:
  ```typescript
  const figure = (index: number, display: 'block' | 'inline'): LatexSegment => ({
    type: 'figure', index, display,
  })
  ```
- `figure-placement-recommendation.md` v2의 `LatexSegment` 정의(`{ type: 'figure'; index: number }`)는 `display` 필드 없이 정의됨 — 마스터 PLAN과는 일치하지만 Wave 1과 불일치
- 구현 시 어느 정의를 따를지 명확하지 않아 타입 오류 또는 런타임 불일치 가능

**필요 조치**: 마스터 PLAN (`latex-rendering.md`) Task 2의 `LatexSegment` 정의를 Wave 1과 일치하도록 `display` 필드를 추가하거나, Wave 1 상세 PLAN에서 `display` 필드를 제거하는 방향으로 단일화. `display` 필드 추가가 합리적임 (블록/인라인 구분이 렌더링에 필요하므로).

---

### [MUST FIX] #2: useDebounce 훅 처리 방식 — 마스터 PLAN vs Wave 3 불일치

**발견 위치**: `docs/plan/latex-rendering.md` (마스터 PLAN) Task 7 vs `docs/plan/latex-wave3.md` 헤더

**문제**:

마스터 PLAN Task 7 (162~165줄):
```
**파일**: `question-card.tsx`, `src/lib/hooks/use-debounce.ts` (신규)
**작업**:
1. `useDebounce<T>(value, 300)` 커스텀 훅 생성
```

Wave 3 상세 PLAN (`latex-wave3.md` 5~17줄):
```
> S2 반영: useDebounce 커스텀 훅 파일 생성 **취소** → 인라인 패턴

**`src/lib/hooks/use-debounce.ts` 생성 취소** (S2).
기존 `questions-toolbar.tsx` 48-62줄과 동일한 인라인 `useEffect + setTimeout` 패턴 사용.
```

**영향**:
- 마스터 PLAN의 파일 소유권 테이블(206~216줄)에는 `src/lib/hooks/use-debounce.ts` (신규) 파일이 frontend-ui 소유로 명시되어 있음
- 마스터 PLAN의 테스트 전략(240줄)에는 `useDebounce: vi.useFakeTimers()` 테스트 계획이 있음
- 마스터 PLAN 참조 시 `use-debounce.ts` 파일이 구현될 것으로 잘못 인식할 수 있어 혼선 발생

**필요 조치**: 마스터 PLAN에서 `use-debounce.ts` 관련 항목 3곳(Task 7 파일 목록, 파일 소유권 테이블, 테스트 전략)을 Wave 3 결정과 일치하도록 수정.

---

### [MUST FIX] #3: ROADMAP Task 8 테스트 케이스 수 불일치

**발견 위치**: `ROADMAP.md` 단계 1.5-1 (182줄) vs 마스터 PLAN + 상세 PLAN

**문제**:

ROADMAP.md 182줄:
```
- [ ] Task 8: 단위 테스트 (13개 케이스)
```

마스터 PLAN (`latex-rendering.md` 174줄):
```
### Task 8: 단위 테스트 [v2 변경: 13 → 17개]
```

Wave 4 상세 PLAN (`latex-wave4.md` 1줄):
```
# Wave 4: 단위 테스트 17개
```

**영향**:
- ROADMAP이 v1 기준(13개)으로 남아 있어 실제 구현 완료 후 ROADMAP 체크 시 혼선 발생
- ROADMAP을 신뢰하는 팀원이 13개로 잘못 이해할 수 있음

**필요 조치**: ROADMAP Task 8 항목을 `17개 케이스`로 수정.

---

### [SHOULD FIX] #4: figure 세그먼트 `display` 판단 로직과 `displaySize` 개념 혼용

**발견 위치**: `docs/plan/latex-wave1.md` Task 2 (62~64줄) vs `docs/research/figure-placement-recommendation.md` v2

**문제**:

Wave 1 상세 PLAN은 파서 수준에서 텍스트 문맥으로 `display: 'block' | 'inline'`을 판단한다:
```
- `{{fig:N}}` 앞: `\n` 또는 문자열 시작 AND 뒤: `\n` 또는 문자열 끝 → 'block'
- 그 외 → 'inline'
```

반면 리서치 문서 `figure-placement-recommendation.md` v2에서 렌더링 힌트는 `displaySize` 필드로 **figures 배열 내 JSON 스키마에 저장**되도록 설계되었다:
```typescript
displaySize: 'large' | 'small'  // large=블록, small=인라인
```

**영향**:
- 파서가 텍스트 문맥으로 `display`를 유추하는 방식(Wave 1)과
  figures JSONB에서 `displaySize`를 읽는 방식(리서치 결론)이 충돌
- 현재 단계 1.5-1에서는 figures JSONB 렌더링 자체가 구현되지 않고 `[도형 N]` 플레이스홀더만 사용하므로 즉각적 버그는 없음
- 단계 1.5-2(FigureRenderer 구현)에서 `display` vs `displaySize` 인터페이스 불일치 문제로 재작업 발생 가능성 있음

**필요 조치**: 마스터 PLAN 또는 Wave 1에 주석으로 "현재 단계에서는 텍스트 문맥 기반 `display` 유추 사용; 1.5-2에서 figures JSONB의 `displaySize`로 대체 예정"임을 명시하여 향후 혼선 방지.

---

### [SHOULD FIX] #5: MEMORY.md `useEffect self-cancellation` 교훈 반영 불명확

**발견 위치**: `docs/plan/latex-wave3.md` Task 7-c (debounce useEffect) vs MEMORY.md

**문제**:

MEMORY.md에는 다음 교훈이 명시되어 있다:
```
useEffect 자기 취소(self-cancellation): effect 내부에서 설정한 state를 dependency에 포함하면,
state 변경 → cleanup(cancelled=true) → 비동기 완료 시 핸들러 무시.
guard용 값은 `useRef`로 분리
```

Wave 3 Task 7-c의 debounce useEffect는 `setTimeout` 패턴을 사용하므로 비동기 요청의 self-cancellation과는 다른 케이스다. 그러나 PLAN 어디에도 "debounce useEffect는 `previewText` → `setPreviewText` 순환 의존 없음을 확인함"이라는 명시적 근거가 없다.

**구체적 확인 필요 사항**:
```typescript
// Wave 3 Task 7-b: state 추가
const [previewText, setPreviewText] = useState(questionText)

// Wave 3 Task 7-c: useEffect
useEffect(() => {
  const timer = setTimeout(() => {
    setPreviewText(questionText)
  }, 300)
  return () => clearTimeout(timer)
}, [questionText])
```
`dependency`가 `[questionText]`이고 `previewText`는 포함되지 않으므로 self-cancellation 위험은 없다. 다만 PLAN 문서에서 이 검토 근거를 한 줄이라도 명시하면 교훈이 제대로 반영되었음을 확인할 수 있다.

**필요 조치**: Wave 3 Task 7-c에 "dependency: `[questionText]` — `previewText` 미포함으로 self-cancellation 없음" 주석 추가 권장.

---

### [SHOULD FIX] #6: Wave 4 테스트 — `useDebounce` 테스트 항목 잔존

**발견 위치**: `docs/plan/latex-rendering.md` 테스트 전략 섹션 (240줄) vs Wave 3 결정

**문제**:

마스터 PLAN 테스트 전략(240줄):
```
- **useDebounce**: `vi.useFakeTimers()` (Vitest)
```

Wave 3에서 `use-debounce.ts` 파일 생성이 취소되어 인라인 패턴을 사용하기로 결정되었으나,
Wave 4 상세 PLAN에는 `useDebounce` 단독 테스트에 대한 항목이 없다. 이 경우 마스터 PLAN의 테스트 전략과 Wave 4 구현 사이에 누락이 생긴다.

**영향**: 인라인 debounce 패턴은 `question-card.tsx` 컴포넌트 테스트에 포함되어야 하지만, Wave 4 테스트 목록(`latex-renderer.test.tsx` + `latex-parser.test.ts`)에는 포함되지 않아 debounce 동작의 단위 테스트가 부재할 수 있음.

**필요 조치**: Wave 4 또는 마스터 PLAN 테스트 전략에 "인라인 debounce는 `question-card.tsx` 컴포넌트 통합 테스트(또는 수동 E2E) 범위"라고 명시하거나, `vi.useFakeTimers()`로 검증하는 케이스를 `latex-renderer.test.tsx`에 추가.

---

### [CONSIDER] #7: Wave 2 컴포넌트 파일 경로 불완전 명시

**발견 위치**: `docs/plan/latex-wave2.md` 변경 파일 테이블 (11~17줄)

**문제**:

Wave 2 상세 PLAN의 변경 파일 테이블:
```
| `question-card.tsx` | 수정 | +5줄 |
| `generate-questions-dialog.tsx` | 수정 | +5줄 |
| `question-detail-sheet.tsx` | 수정 | +5줄 |
```

전체 경로가 명시되지 않았다. 마스터 PLAN의 파일 소유권 테이블에서도 파일명만 기재되어 있다.

**영향**: 구현 담당자가 프로젝트 내에서 파일을 검색해야 하며, 동일한 파일명이 다른 디렉토리에 있을 경우 오작업 가능성이 있음. 실제 이 파일들은 `src/components/` 또는 `src/app/` 하위에 위치하므로 혼선 가능성 낮음.

**필요 조치**: 상세 PLAN에 전체 경로 명시 권장 (예: `src/components/ui/question-card.tsx`). 단, 기존 코드베이스 패턴을 확인 후 작업하므로 구현 블로커는 아님.

---

### [CONSIDER] #8: `figures` JSONB 배열 인덱스와 `{{fig:N}}` 매핑 근거 명시

**발견 위치**: `docs/plan/latex-wave1.md` Task 2, Wave 4 테스트 케이스 vs `src/lib/ai/types.ts`

**문제**:

`past_exam_details.figures[]` JSONB 배열과 `{{fig:N}}`의 `N`이 0-based 인덱스로 매핑됨은 리서치 문서에서 예시로 확인되나, PLAN 어디에도 "N은 `figures` 배열의 0-based index"라는 명시적 계약이 없다.

`src/lib/ai/types.ts`의 `FigureInfo` 타입:
```typescript
export interface FigureInfo {
  readonly url: string | null
  readonly description: string
  readonly boundingBox: { ... }
  readonly pageNumber: number
  readonly confidence: number
}
```
`FigureInfo` 자체에는 `index` 필드가 없다. 즉 순서는 배열 위치(0, 1, 2...)로 결정된다.

`LatexSegment`의 `figure.index`가 이 배열 위치와 매핑된다는 가정이 PLAN에 명시되면, 1.5-2 FigureRenderer 구현 시 근거가 명확해진다.

**필요 조치**: PLAN 또는 Wave 1 Task 2에 "figure.index는 `past_exam_details.figures` 배열의 0-based 인덱스"라는 한 줄 계약 추가 권장.

---

## 판정

| # | 분류 | 이슈 요약 | 구현 블로커 여부 |
|---|------|-----------|---------------|
| 1 | [MUST FIX] | `LatexSegment` figure `display` 필드 — 마스터 PLAN vs Wave 1/4 불일치 | **예** |
| 2 | [MUST FIX] | `use-debounce.ts` 생성 취소 결정 — 마스터 PLAN 반영 안 됨 | **예** (혼선 유발) |
| 3 | [MUST FIX] | ROADMAP Task 8 테스트 수 13개 → 17개 미반영 | 아니오 (트래킹 오류) |
| 4 | [SHOULD FIX] | `display` (파서 유추) vs `displaySize` (JSONB) 개념 미명시 | 아니오 (1.5-2에서 문제) |
| 5 | [SHOULD FIX] | debounce useEffect self-cancellation 검토 근거 미명시 | 아니오 |
| 6 | [SHOULD FIX] | 인라인 debounce 단위 테스트 귀속 범위 미명시 | 아니오 |
| 7 | [CONSIDER] | Wave 2 파일 전체 경로 미명시 | 아니오 |
| 8 | [CONSIDER] | `figure.index`와 `figures[]` 0-based 매핑 계약 미명시 | 아니오 |

**MUST FIX: 3건 / SHOULD FIX: 3건 / CONSIDER: 2건**

---

## 결론

MUST FIX #1(`LatexSegment` 타입 불일치)과 MUST FIX #2(use-debounce.ts 취소 결정 미반영)는
구현 시 타입 오류 또는 불필요한 파일 생성으로 이어질 수 있으므로 **마스터 PLAN 수정 후 구현 진행**을 권장한다.
MUST FIX #3(ROADMAP 테스트 수)은 구현 자체를 블록하지는 않으나 진행 현황 추적 정확성을 위해 함께 수정하는 것이 좋다.

SHOULD FIX 항목들은 현재 구현 범위(1.5-1)에서는 버그를 유발하지 않으나, 이후 1.5-2 구현 또는 코드 리뷰 시 혼선을 예방하기 위해 처리를 권장한다.
