# Scope Review: LaTeX 상세 PLAN (Wave 1~4)

> **리뷰 대상**: `docs/plan/latex-wave1.md`, `latex-wave2.md`, `latex-wave3.md`, `latex-wave4.md`
> **참조**: `docs/plan/latex-rendering.md` (마스터 PLAN v2), `docs/reviews/latex-rendering-scope-review.md`
> **작성일**: 2026-03-22
> **리뷰어 역할**: scope-reviewer
> **판정**: READY (MUST FIX 0건, SHOULD FIX 2건, CONSIDER 1건)

---

## 요약

상세 Wave PLAN은 마스터 PLAN v2를 충실히 분해하였으며, Task 크기·파일 소유권·병렬 안전성 모두 양호하다. 단, 마스터 PLAN과 상세 Wave PLAN 간 **명세 불일치** 2건이 발견되었으며, 테스트 범위에 한 가지 누락이 있다.

---

## 이슈 목록

---

### [SHOULD FIX] 이슈 1: `LatexSegment.figure` 타입에 `display` 필드 불일치

**위치**: `latex-rendering.md` (마스터) vs `latex-wave1.md` (상세)

**내용**:

마스터 PLAN v2 (`latex-rendering.md`) 97번 줄의 타입 정의:
```typescript
| { type: 'figure'; index: number }     // {{fig:N}} — display 필드 없음
```

상세 Wave 1 PLAN (`latex-wave1.md`) 53번 줄의 타입 정의:
```typescript
| { type: 'figure'; index: number; display: 'block' | 'inline' }  // — display 있음
```

**두 문서가 서로 다른 타입을 정의한다.** Wave 4 (`latex-wave4.md`) 테스트 헬퍼도 `display` 포함 버전을 사용한다:
```typescript
const figure = (index: number, display: 'block' | 'inline'): LatexSegment => ({
  type: 'figure', index, display,
})
```

마스터 PLAN v2의 변경 요약표 (`latex-rendering.md` 257-265줄)는 v2의 변경 사항으로 `figure` 타입 추가만 기재하며 `display` 필드를 언급하지 않는다. 이전 scope-review에서 S1 이슈로 `display` 추가가 요청되었고, Wave 1은 이를 반영했으나 마스터 PLAN이 동기화되지 않았다.

**영향**: 구현 워커가 마스터 PLAN을 참조하면 `display` 없는 타입을 구현할 수 있다. Wave 4 테스트는 `display` 포함 타입을 검증하므로 테스트 실패가 발생한다.

**권장 수정**: 마스터 PLAN의 타입 정의를 Wave 1과 동일하게 `display: 'block' | 'inline'` 포함으로 업데이트. (단, 리뷰어는 PLAN 직접 수정 금지 — 리드에게 전달.)

---

### [SHOULD FIX] 이슈 2: `use-debounce.ts` 신규 파일 — 마스터 PLAN과 Wave 3 PLAN 불일치

**위치**: `latex-rendering.md` (마스터) vs `latex-wave3.md` (상세)

**내용**:

마스터 PLAN v2 (`latex-rendering.md`):
- 162번 줄: `파일: question-card.tsx, src/lib/hooks/use-debounce.ts (신규)`
- 209번 줄 소유권 테이블: `src/lib/hooks/use-debounce.ts (신규) | frontend-ui | 3`

Wave 3 PLAN (`latex-wave3.md`):
- 16번 줄: `**src/lib/hooks/use-debounce.ts 생성 취소** (S2).`
- 17번 줄: `기존 questions-toolbar.tsx 48-62줄과 동일한 인라인 useEffect + setTimeout 패턴 사용.`

**Wave 3이 마스터 PLAN에 없는 "취소" 결정을 포함한다.** 마스터 PLAN 소유권 테이블에는 여전히 해당 파일이 있다. 이전 scope-review에서 SHOULD FIX로 지적하여 Wave 3이 반영했으나, 마스터 PLAN 업데이트가 누락된 상태다.

**영향**: 구현 후 마스터 PLAN 소유권 테이블과 실제 파일 구조가 불일치하여 혼란을 일으킨다. 리드가 마스터 PLAN을 기준으로 진행 상황을 추적할 경우 없는 파일을 기대할 수 있다.

**권장 수정**: 마스터 PLAN의 Task 7 파일 목록과 섹션 6 소유권 테이블에서 `src/lib/hooks/use-debounce.ts` 제거. (리드에게 전달.)

---

### [CONSIDER] 이슈 3: Wave 4 — `useDebounce` 인라인 패턴 테스트 부재

**위치**: `latex-wave4.md`, `latex-rendering.md` 8절 테스트 전략

**내용**:

마스터 PLAN의 테스트 전략 (`latex-rendering.md` 239번 줄):
```
- **useDebounce**: vi.useFakeTimers() (Vitest)
```

Wave 3에서 `use-debounce.ts` 생성이 취소되어 인라인 `useEffect + setTimeout` 패턴으로 변경되었다. 그러나 Wave 4 PLAN은 이 변경을 반영하지 않았고, 마스터 PLAN의 `useDebounce` 테스트 항목도 그대로다.

**분석**:

인라인 debounce 패턴은 `question-card.tsx` EditMode 내부에 존재한다. `question-card.tsx`는 React 컴포넌트이므로 직접 Vitest 단위 테스트가 어렵다 (DOM, Event, Timer 모두 필요). 기존 프로젝트에서도 컴포넌트 단위 테스트(`.tsx`)는 존재하지 않는다 — `src/lib/utils/__tests__/`와 `src/lib/actions/__tests__/`만 있다.

이 패턴은 현재 `questions-toolbar.tsx`, `past-exams-toolbar.tsx`, `users-toolbar.tsx`에서도 테스트 없이 사용 중이다. 일관성 관점에서 추가하지 않아도 무방하다. 단, debounce 동작이 사용자 경험에 직접 영향을 미치므로 E2E 체크포인트(Wave 4 수동 확인 3, 4번)로 검증하는 현재 전략은 적절하다.

**권장**: `useDebounce vi.useFakeTimers()` 항목을 마스터 PLAN 테스트 전략에서 삭제 처리. Wave 4 PLAN은 현재 그대로 유지 가능 (변경 없음). (리드에게 전달.)

---

## Task 크기 평가

| Task | Wave | 담당 역할 | 추정 크기 | 평가 |
|------|------|-----------|-----------|------|
| Task 1: katex 설치 + CSS | 1 | frontend-ui | XS | 적절. 2개 커맨드 + 1줄 |
| Task 2: parseLatexText | 1 | frontend-ui | S (~90줄) | 적절. 단일 파일 신규 생성 |
| Task 3: LatexRenderer | 1 | frontend-ui | S (~60줄) | 적절. 단일 컴포넌트 |
| Task 4: ReadMode 적용 | 2 | frontend-ui | XS (3곳 교체) | 적절 |
| Task 5: Dialog 적용 | 2 | frontend-ui | XS (4곳 교체) | 적절 |
| Task 6: Sheet 적용 | 2 | frontend-ui | XS (4곳 교체) | 적절 |
| Task 7: EditMode 미리보기 | 3 | frontend-ui | S (~35줄 추가) | 적절. Wave 3 후 ~473줄 (800줄 이내) |
| Task 8: 단위 테스트 | 4 | tester | S (~210줄) | 적절. 17+8개 케이스 |

**각 Task는 orchestrate 워커 하나로 처리 가능한 크기다.**

---

## 파일 소유권 충돌 검토

### Wave 1 (직렬)
- `package.json` → 리드 only (명시됨)
- `src/app/layout.tsx` → frontend-ui
- `src/lib/utils/latex-parser.ts` → frontend-ui
- `src/components/ui/latex-renderer.tsx` → frontend-ui

Wave 1은 직렬 실행이므로 충돌 없음.

### Wave 2 (병렬)
- Task 4: `question-card.tsx` (ReadMode 3곳)
- Task 5: `generate-questions-dialog.tsx`
- Task 6: `question-detail-sheet.tsx`

**3개 파일이 서로 완전히 다르다. 병렬 충돌 없음.** 단, CLAUDE.md 파일 소유권 테이블에 이 세 파일이 명시되지 않았으나, 모두 `src/app/` 하위이므로 frontend-ui 역할 범위 내다.

### Wave 3 (직렬)
- Task 7: `question-card.tsx` — Task 4가 이미 이 파일을 수정했으므로 Wave 2 완료 후에만 진행 가능.
- Wave 3 PLAN에 `의존: Wave 2 완료 (Task 4 — question-card.tsx 동일 파일)` 명시됨. **직렬 필수 지점이 올바르게 정의되어 있다.**

### Wave 4 (독립)
- `src/lib/utils/__tests__/latex-parser.test.ts` → tester 역할
- `src/components/ui/__tests__/latex-renderer.test.tsx` → tester 역할

**Wave 1만 완료되면 Wave 4를 Wave 2~3과 병렬로 진행 가능하다.** 마스터 PLAN의 의존성 그래프(`Task 8 → Task 2, 3`)와 일치한다. 현재 Wave 4가 Wave 3 이후로 배치된 것은 안전하지만, Wave 2와 병렬로 당겨도 충돌이 없다. (최적화 여지, 이슈 없음)

---

## 역할 경계 검토

| Task | CLAUDE.md 역할 | Wave PLAN 명시 역할 | 일치 |
|------|----------------|---------------------|------|
| Task 1~7 | frontend-ui (`src/app/`, `src/components/`) | frontend-ui | ✅ |
| Task 8 파서 테스트 | tester (`src/lib/utils/__tests__/`) | tester | ✅ |
| Task 8 렌더러 테스트 | tester (`src/components/ui/__tests__/`) | tester | ✅ |

`src/lib/utils/latex-parser.ts`는 CLAUDE.md의 frontend-ui 소유 디렉토리(`src/app/`, `src/components/`)에 속하지 않는다. 그러나 `src/lib/utils/`는 backend-actions 역할의 `src/lib/actions/`, `src/lib/validations/`와도 다르다. 마스터 PLAN에 frontend-ui 소유로 명시되어 있고, 이 파서는 클라이언트 사이드 렌더링 유틸리티이므로 frontend-ui 역할 확장이 타당하다.

---

## YAGNI 검토

- **`{{fig:N}}` 파서 통합**: 이전 scope-review에서 이미 YAGNI 위반 아님으로 판정. 유지.
- **Wave 1 Task 1~3 직렬**: Task 2가 Task 1에, Task 3이 Task 2에 의존하므로 직렬이 필수. 과도 분해 없음.
- **17개 테스트 케이스**: 파서의 복잡성(정규식 우선순위, 엣지 케이스)을 감안하면 17개는 과도하지 않다. 오히려 `닫히지 않은 $` 폴백처럼 구현 중 놓치기 쉬운 케이스를 명시적으로 다룬다.

---

## Wave 간 직렬 필수 지점 검증

```
Wave 1 (직렬: Task 1 → 2 → 3) → Wave 2 시작 가능
Wave 2 (병렬: Task 4 + 5 + 6) → Wave 3 시작 조건: Task 4 완료
Wave 3 (직렬: Task 7)         → Wave 4 시작 가능 (Wave 1 완료면 충분)
Wave 4 (병렬 가능: Task 8a + 8b)
```

Wave 3의 `question-card.tsx` 직렬 필수 지점은 Wave 2의 Task 4에만 의존한다. Task 5, 6이 완료되지 않아도 Task 7은 시작 가능하다. Wave 3 PLAN이 `Wave 2 완료`를 전제로 하지만, 실제로는 `Task 4 완료` 후 즉시 진행 가능하다. 안전 측으로 기재된 것이므로 이슈 없음.

---

## 범위 누락 검토

Wave 2의 `generate-questions-dialog.tsx` 실제 파일(149번 줄)을 확인한 결과, `question.content`, `option`, `question.answer`, `question.explanation` 교체 대상이 모두 존재한다. Wave 2 Task 5의 라인 번호 추정(149, 155, 167, 174줄)은 실제와 정확히 일치한다.

`question-detail-sheet.tsx` 실제 파일(163-191번 줄) 확인 결과, `detail.content`, `option`, `detail.answer`, `detail.explanation` 모두 교체 대상이 존재한다.

`question-card.tsx` ReadMode 실제 확인 결과, `question.questionText`(160번 줄), `option`(167번 줄), `question.answer`(178번 줄) 3곳 모두 존재한다.

**범위 누락 없음.**

---

## Plan Review Completion Checklist 재판정

| 항목 | 상태 | 비고 |
|------|------|------|
| 모든 Task의 파일 소유권 명확 | ✅ | |
| Task 간 의존성 순서 정의 | ✅ | Wave 간 직렬 필수 지점 명확 |
| 외부 의존성 명시 | ✅ | katex, @types/katex (Wave 1에 설치 커맨드 포함) |
| 에러 처리 방식 정해짐 | ✅ | throwOnError:false + 폴백 |
| 테스트 전략 있음 | ✅ | 17개 단위 + 8 수동 E2E |
| 이전 Phase 회고 교훈 반영 | ✅ | |
| 병렬 구현 시 파일 충돌 없음 | ✅ | Wave 2 Task 4·5·6 각기 다른 파일 |

**판정: READY**

SHOULD FIX 2건은 마스터 PLAN 문서 동기화 문제이며, 구현에 직접적 방해가 없다. 단, 구현 워커 혼란을 방지하기 위해 마스터 PLAN 업데이트를 구현 시작 전에 리드가 처리할 것을 권장한다.
