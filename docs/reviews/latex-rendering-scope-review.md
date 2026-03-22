# Scope Review: PLAN v2 — LaTeX 수식 렌더링

> **리뷰 대상**: `docs/plan/latex-rendering.md` (v2)
> **작성일**: 2026-03-22
> **리뷰어 역할**: scope-reviewer
> **판정**: READY (이슈 1건 SHOULD FIX, 1건 CONSIDER)

---

## 요약

PLAN v2는 전반적으로 범위가 적절하다. Task 분해 크기, 의존성 순서, 병렬화 전략 모두 합리적이다. 단, 두 가지 범위 관련 사항을 지적한다.

---

## 이슈 목록

---

### [SHOULD FIX] Task 7: `useDebounce` 커스텀 훅 분리가 불필요

**이슈**: PLAN v2 Task 7은 `src/lib/hooks/use-debounce.ts`를 신규 파일로 생성한다. 그러나 현재 프로젝트의 debounce 패턴은 **인라인 `useEffect + setTimeout`** 방식으로 일관되게 사용되고 있다.

**근거 (코드 분석)**:
- `questions-toolbar.tsx` — `useEffect(() => { const timer = setTimeout(...) })` 인라인 패턴
- `past-exams-toolbar.tsx` — 동일 인라인 패턴 (2개 Input)
- `users-toolbar.tsx` — 동일 인라인 패턴
- 기존 `src/lib/hooks/` 디렉토리 자체가 존재하지 않음 (아직 훅 파일 0개)

**MEMORY.md 교훈**: `useDebounce` 훅 분리가 권장 패턴으로 기록되어 있고, `patterns.md`에도 커스텀 훅 패턴이 있다. 그러나 이미 인라인 패턴이 3곳에서 일관되게 사용되는 상황에서, 이 PLAN 하나를 위해 훅 분리를 추가하면:

1. **기존 3곳과 불일치** — `questions-toolbar`, `past-exams-toolbar`, `users-toolbar`는 여전히 인라인 패턴으로 남음
2. **YAGNI 위반** — EditMode는 debounce 사용처가 `questionText` 1개뿐(options는 포커스 시에만 조건부 표시)
3. **범위 비대** — 훅 분리는 기존 코드 전체 리팩토링 시 함께 해야 일관성이 생기는 작업

**권장 수정**: Task 7에서 `use-debounce.ts` 신규 파일 생성 없이 기존 인라인 `useEffect + setTimeout` 패턴으로 구현. `src/lib/hooks/use-debounce.ts` 생성은 기존 toolbar 3곳과 함께 리팩토링할 Phase 2+ 시점으로 이관.

---

### [CONSIDER] `{{fig:N}}` 파서 통합 — Phase 1.5-2에서 해도 되는가?

**이슈**: PLAN v2가 `{{fig:N}}` 세그먼트를 LaTeX 파서에 지금 포함하는 것이 YAGNI 위반인지 검토.

**분석**: YAGNI 위반이 **아니다**. 도형 PLAN(1.5-2)의 리서치 문서(`figure-placement-recommendation.md v2`)가 명시하고 있다:

> "LaTeX PLAN과 동시 — 파서에 `{{fig:N}}` 세그먼트 추가 (+8줄)"

또한:
- `parseLatexText`는 1.5-2에서 수정이 필요한 파일임. 지금 `{{fig:N}}` 지원을 빠뜨리면 1.5-2에서 파서를 재수정해야 함
- 변경 비용이 +8줄(정규식 1개 + 타입 1개 + 폴백 1개)로 매우 낮음
- **플레이스홀더 표시는 graceful degradation** — 현재 `question-card.tsx`의 `FigurePreview` 컴포넌트가 `description` 텍스트만 표시하는 것과 수준이 동일함
- 파서가 `{{fig:N}}`을 텍스트로 raw 노출하는 것이 더 나쁜 사용자 경험

**결론**: v2의 `{{fig:N}}` 통합은 YAGNI 위반이 아니라 **선제적 호환성(forward compatibility)** 확보가 타당한 경우다. 범위 유지 권장.

---

## 총 작업량 현실성

**M (2-3일) 추정은 현실적이다.**

| Task | 추정 | 판단 |
|------|------|------|
| Task 1 (설치) | XS | 적절 |
| Task 2 (파서) | S | 적절. `{{fig:N}}` 포함해도 단순 정규식 파싱 |
| Task 3 (컴포넌트) | S | 적절. ~50줄 |
| Task 4+5+6 (적용 3곳) | XS×3 | 적절. 기존 파일 변경 최소 (각 `<LatexRenderer>` 교체) |
| Task 7 (EditMode) | S | `useDebounce` 훅 분리 제거 시 XS~S로 감소 |
| Task 8 (테스트) | S | 17개 케이스는 적절한 양 |

---

## Wave 2 병렬 가능성 (1인 개발 기준)

Wave 2에서 Task 4+5+6를 병렬로 표기했으나, **1인 개발에서 병렬은 의미 없다**. 그러나 이 세 Task는 각각 다른 파일을 수정하며 상호 의존성이 없으므로, 순서에 관계없이 독립적으로 수행 가능하다. 병렬/직렬 표기가 구현에 영향을 주지 않으므로 이슈 없음.

---

## 범위 누락 항목

없음. PLAN v2는 ReadMode 10곳 + EditMode 1곳 전체를 커버하며 누락 지점이 없다.

---

## Plan Review Completion Checklist 재판정

| 항목 | 상태 | 비고 |
|------|------|------|
| 모든 Task의 파일 소유권 명확 | ✅ | |
| Task 간 의존성 순서 정의 | ✅ | |
| 외부 의존성 명시 | ✅ | katex, @types/katex |
| 에러 처리 방식 정해짐 | ✅ | throwOnError:false + 폴백 |
| 테스트 전략 있음 | ✅ | 17 단위 + 8 E2E |
| 이전 Phase 회고 교훈 반영 | ✅ | |
| 병렬 구현 시 파일 충돌 없음 | ✅ | |

**판정: READY** — SHOULD FIX 적용 여부와 관계없이 구현 진입 가능.
SHOULD FIX는 구현 중 Task 7 시점에 처리.
