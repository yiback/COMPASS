# 기술 리뷰: LaTeX 렌더링 PLAN v2

> **리뷰 대상**: `docs/plan/latex-rendering.md` (v2)
> **작성일**: 2026-03-22
> **작성자**: technical-reviewer
> **판정**: READY (MUST FIX 0, SHOULD FIX 3, CONSIDER 5)

---

## 요약

PLAN v2는 전반적으로 탄탄하다. 리서치와의 일치성이 높고, 타입 설계와 에러 처리 전략도 적절하다. 단, `figure` 세그먼트 타입 불일치 1건(SHOULD FIX), debounce 구현 방식 불일치 1건(SHOULD FIX), 테스트 누락 케이스 1건(SHOULD FIX)이 발견되었다. 구현을 막는 MUST FIX 이슈는 없다.

---

## [SHOULD FIX] #1 — `figure` 세그먼트 타입에 `display` 필드 누락

**위치**: PLAN v2 Task 2 (라인 92-98) `LatexSegment` 타입 정의

**문제**:
PLAN v2의 `figure` 세그먼트는 다음과 같이 정의되어 있다:

```typescript
| { type: 'figure'; index: number }     // {{fig:N}} [v2 추가]
```

그러나 `docs/research/tech/figure-mid-text.md`의 Q4(라인 165-174)와 `docs/research/feasibility/figure-mid-text.md`의 3-4절(라인 165-175)에서 명확히 확정한 타입은 다음과 같다:

```typescript
| { type: 'figure'; index: number; display: 'block' | 'inline' }
```

`display` 필드는 파서 레벨에서 구분자 전후 컨텍스트(줄바꿈 유무)를 보고 결정하며, 이를 통해 `FigureRenderer`가 블록/인라인 렌더링을 자동으로 선택할 수 있다. 이 필드가 없으면 Phase 2a에서 `FigureRenderer` 구현 시 타입을 다시 수정해야 한다(OCP 위반, 불필요한 재작업).

**수정 방향**: Task 2의 `LatexSegment` 타입에 `display: 'block' | 'inline'` 필드를 추가하고, 파서 구현 시 전후 컨텍스트 판단 로직을 포함한다. Task 8의 테스트 케이스 14-17도 `display` 필드 포함 형태로 기대값을 업데이트한다.

---

## [SHOULD FIX] #2 — `useDebounce` 훅 신규 생성이 기존 패턴과 불일치

**위치**: PLAN v2 Task 7 (라인 162-171)

**문제**:
PLAN은 `src/lib/hooks/use-debounce.ts` 신규 파일 생성을 지시한다. 그러나 기존 코드베이스의 debounce 구현 방식은 **커스텀 훅이 아닌 컴포넌트 내부 `useEffect + setTimeout` 패턴**을 사용한다:

- `src/app/(dashboard)/questions/_components/questions-toolbar.tsx` (라인 48-62): `useEffect(() => { const timer = setTimeout(..., 300); return () => clearTimeout(timer) }, [subject, ...])`
- `src/app/(dashboard)/past-exams/_components/past-exams-toolbar.tsx`: 동일 패턴 반복

MEMORY.md에 "debounce Input 2개: 각각 별도 useState + useEffect (users-toolbar 패턴 반복 적용)"라는 교훈이 있다. 즉, 현재 코드베이스는 debounce를 공유 훅으로 추상화하지 않고 인라인으로 반복 구현하는 패턴을 채택하고 있다.

**수정 방향**: 두 가지 접근이 모두 유효하다.
- 옵션 A (현상 유지): Task 7에서 `use-debounce.ts` 신규 파일 없이, `EditMode` 내부에 `useEffect + setTimeout` 패턴 직접 사용. 기존 코드베이스와 일관성 유지.
- 옵션 B (훅 도입): `use-debounce.ts` 신규 파일 생성 후, 기존 toolbar 파일들도 함께 리팩토링. 작업량 증가.

PLAN에서 선택한 옵션 B를 유지할 경우, 기존 toolbar 파일 3개도 함께 리팩토링하거나, 향후 일관성 문제를 명시적으로 문서화해야 한다. 의사결정을 PLAN에 명시할 것.

---

## [SHOULD FIX] #3 — `dangerouslySetInnerHTML` 사용 시 XSS 리스크 평가 기준 명확화 필요

**위치**: PLAN v2 Task 3 (라인 126-128)

**문제**:
PLAN과 리서치 추천안 모두 "AI 출력이므로 XSS 위험 낮음"이라고 언급하며 `dangerouslySetInnerHTML` 사용을 승인하고 있다. 그러나 현재 시스템에서 LaTeX 문자열은 두 가지 경로로 입력된다:

1. **AI 자동 추출**: `question-extraction.ts`의 Gemini 프롬프트 → AI 생성 → DB 저장 → 렌더링
2. **선생님 직접 편집**: `question-card.tsx` EditMode의 Textarea → DB 저장 → 렌더링

경로 2에서 선생님이 악의적이거나 부주의하게 HTML 특수 문자(`<`, `>`, `&`, `"`)를 포함한 LaTeX를 입력하면, `katex.renderToString()`이 해당 문자를 LaTeX 내용으로 처리하려 시도한다.

**실제 위험 수준**: KaTeX는 내부적으로 HTML을 생성하며, `throwOnError: false` 설정 시 잘못된 입력을 에러 텍스트로 표시한다. 그러나 KaTeX가 생성하는 HTML 자체는 이미 이스케이프 처리되어 있으므로, KaTeX의 출력물에 `dangerouslySetInnerHTML`을 사용하는 것은 KaTeX 라이브러리 자체를 신뢰하는 것과 동일하다. 업계 표준 관행이므로 MUST FIX는 아니다.

**수정 방향**: PLAN의 에러 처리 표(섹션 7)에 "사용자 입력 HTML 특수문자 → KaTeX가 LaTeX 파싱 단계에서 처리, HTML 인젝션 불가"라는 근거를 1줄 추가하여 의도적 결정임을 문서화한다.

---

## [CONSIDER] #4 — `useDebounce` 훅의 `useEffect` 자기 취소 패턴 적용 여부

**위치**: PLAN v2 Task 7

MEMORY.md에 "useEffect 자기 취소(self-cancellation): effect 내부에서 설정한 state를 dependency에 포함하면, state 변경 → cleanup(cancelled=true) → 비동기 완료 시 핸들러 무시"라는 교훈이 있다. `useDebounce`는 단순 지연이므로 비동기 작업이 없어 self-cancellation 문제가 발생하지 않는다. 그러나 guard용 값을 `useRef`로 분리하는 패턴을 `useDebounce` 내부에서도 고려할 수 있다. 현재 설계(300ms setTimeout)에서는 불필요하다.

---

## [CONSIDER] #5 — `focusedOptionIndex` 상태가 EditMode 파일 크기에 미치는 영향

**위치**: PLAN v2 Task 7 (라인 167)

`question-card.tsx`는 현재 438줄이다. Task 4(ReadMode 적용 +8줄), Task 7(EditMode 미리보기 +30줄) 완료 후 약 476줄로 증가한다. 800줄 제한 내이므로 문제없다. 다만 `focusedOptionIndex` 상태(options 포커스 추적) 추가 시, 4개 Input 각각에 `onFocus`/`onBlur` 핸들러가 필요하다. 이 로직을 EditMode 내부에 유지할지, 별도 컴포넌트로 분리할지 구현 단계에서 결정할 것.

---

## [CONSIDER] #6 — `parseLatexText`의 빈 text 세그먼트 필터링 명시 여부

**위치**: PLAN v2 Task 2

`docs/research/feasibility/figure-mid-text.md`(라인 121-123)는 "빈 문자열 세그먼트 처리 로직(`content.length > 0`으로 필터링)만 추가하면 된다"고 명시한다. PLAN v2의 엣지 케이스 목록(라인 108-113)에는 이 필터링이 명시적으로 언급되지 않았다. `{{fig:0}}{{fig:1}}`에서 두 figure 사이의 빈 text 세그먼트가 필터링되지 않으면 렌더러에서 불필요한 `<span></span>` 요소가 생성된다. 테스트 케이스 15번이 이를 간접적으로 커버하지만, 파서 명세에 "빈 text 세그먼트 제거" 조건을 명시적으로 추가할 것을 권장한다.

---

## [CONSIDER] #7 — `katex` 번들 크기와 code splitting 전략

**위치**: PLAN v2 섹션 2, Task 3

리서치 추천안에서 "번들 크기 ~50KB(gzip), code splitting으로 최적화 가능"이라고 언급하지만 PLAN에는 code splitting 적용 여부가 명시되지 않았다. `LatexRenderer`는 `'use client'` Client Component이므로 Next.js의 dynamic import를 활용하여 `LatexRenderer`를 lazy load하는 선택이 가능하다. 10개 표시 지점이 모두 Dashboard 내부(인증 필요)이므로 공개 페이지 성능에는 영향이 없다. MVP 범위에서는 필수가 아니지만, 구현 후 번들 분석(`next build` 결과)을 확인할 것을 권장한다.

---

## [CONSIDER] #8 — EditMode에서 `{{fig:N}}` raw 문자열 노출 UX

**위치**: PLAN v2 Task 7, 리서치 문서의 R4

`docs/research/feasibility/figure-mid-text.md`(라인 412-416)에서 이미 분석된 리스크: "EditMode Textarea에서 `{{fig:0}}`이 raw 문자열로 보인다. 완화: Textarea 상단 안내 문구 추가 권장."

PLAN v2에는 이 UX 안내 문구가 Task 7에 명시되지 않았다. 선생님이 `{{fig:0}}`을 임의로 삭제하거나 변경하면 도형 렌더링이 깨질 수 있다. Task 7에 안내 문구 추가를 포함시킬 것을 권장한다. (단, LaTeX PLAN의 현재 범위에서 `figures` 데이터가 아직 존재하지 않으므로, 이 이슈는 Phase 2a 이후에 중요해진다. 현재는 LOW 우선순위.)

---

## 리서치 결과와 PLAN 일치성 검증

| 리서치 결정 | PLAN 반영 | 상태 |
|------------|----------|------|
| `katex` 코어 직접 사용 | Task 1 ✓ | 일치 |
| `react-katex` 미사용 | 섹션 2 ✓ | 일치 |
| `throwOnError: false` 폴백 | 섹션 2, 7 ✓ | 일치 |
| `katex/dist/katex.min.css` 전역 import | Task 1 ✓ | 일치 |
| Live Preview Below (300ms debounce) | Task 7 ✓ | 일치 |
| `{{fig:N}}` 파서 통합 | Task 2 ✓ | 일치 |
| `display: 'block' \| 'inline'` 필드 | **누락** | **불일치** (#1) |
| 빈 text 세그먼트 필터링 | 미명시 | 부분 일치 (#6) |

---

## 기존 코드 패턴 일치성 검증

| 패턴 | 기존 코드 | PLAN | 상태 |
|------|---------|------|------|
| debounce 구현 방식 | 인라인 `useEffect + setTimeout` | `useDebounce` 훅 신규 | **불일치** (#2) |
| `'use client'` 모드 | 모든 대상 파일이 이미 Client Component | Task 3 Client Component 채택 | 일치 |
| `whitespace-pre-wrap` 텍스트 렌더링 | `question-card.tsx` 160줄, `generate-questions-dialog.tsx` 149줄 | `<LatexRenderer>` 교체 예정 | 일치 (교체 필요 지점 식별됨) |
| Accordion `space-y-3` 세로 스택 | `question-card.tsx` 377줄 | Live Preview Below 패턴 호환 | 일치 |

---

## MEMORY.md 교훈 반영 여부

| 교훈 | PLAN 반영 여부 |
|------|--------------|
| 병렬 에이전트 파일 충돌 | Wave 2에서 Task 4/5/6 병렬 — 각 파일 다름 ✓ 충돌 없음 |
| `useEffect` 자기 취소(self-cancellation) | `useDebounce`는 단순 setTimeout — 해당 없음 ✓ |
| Server Action `{ error }` 반환 | LaTeX 렌더링은 Server Action 없음 — 해당 없음 ✓ |
| 에이전트 빌드 에러 (Step 단위 즉시 빌드 확인) | PLAN에 미명시 — 구현 에이전트 프롬프트에 포함 권장 |
| 기존 패턴 먼저 확인 후 일관성 유지 | debounce 패턴에서 불일치 발생 (#2) |

---

## 타입 안전성 검증

| 타입 | 평가 |
|------|------|
| `LatexSegment` union 타입 | 적절. `figure` 타입에 `display` 필드 추가 필요 (#1) |
| `LatexRenderer` Props (`text: string`, `className?: string`) | 적절. `text`가 null/undefined일 경우 컴포넌트 내부에서 처리 필요 — PLAN 에러 처리 표에 명시됨 ✓ |
| `useDebounce<T>(value: T, delay: number): T` | 제네릭 설계 적절 |
| `FigureInfo` (`src/lib/ai/types.ts`) | 현재 `url`, `description`, `boundingBox`, `pageNumber`, `confidence` 필드만 있음. `displaySize` 필드는 Phase 2a에서 추가 예정 — LaTeX PLAN 범위 밖 ✓ |

---

## 성능 리스크 평가

| 리스크 | 평가 |
|--------|------|
| KaTeX 번들 크기 (~50KB gzip) | 수학 시험 서비스 핵심 기능. 정당화됨 ✓ |
| 렌더링 빈도 | ReadMode는 마운트 시 1회. EditMode는 300ms debounce ✓ |
| Accordion 높이 변화 | `max-h-32 overflow-y-auto`로 제한 ✓ |
| 객관식 보기 4개 미리보기 | 포커스 시에만 표시 → 레이아웃 복잡도 제한 ✓ |

---

## 최종 판정

**READY** — MUST FIX 이슈 없음. 구현 시작 가능.

SHOULD FIX #1(`display` 필드 누락)은 구현 단계 Task 2에서 반드시 반영해야 한다. SHOULD FIX #2(debounce 패턴 불일치)는 Task 7 시작 전 구현자가 의사결정 후 진행한다.
