# Scope Review v2: LaTeX 상세 PLAN (Wave 1~4)

> **리뷰 대상**: `docs/plan/latex-rendering.md` (마스터 v2 수정본), `docs/plan/latex-wave1.md` ~ `latex-wave4.md`
> **참조**: `docs/reviews/latex-detail-scope-review.md` (이전 리뷰)
> **작성일**: 2026-03-22
> **리뷰어 역할**: scope-reviewer
> **판정**: READY (MUST FIX 0건, SHOULD FIX 0건, CONSIDER 0건)

---

## 이전 리뷰 이슈 재검토

### [SHOULD FIX] 이슈 1: `LatexSegment.figure` 타입 `display` 필드 불일치

확인됨. 마스터 PLAN 97번 줄이 다음과 같이 수정되었다:

```typescript
| { type: 'figure'; index: number; display: 'block' | 'inline' }  // {{fig:N}} [v2 추가, S1+M1 반영]
```

Wave 1 53번 줄, Wave 4 47번 줄 테스트 헬퍼(`figure(index, display)`)와 완전히 일치한다.

---

### [SHOULD FIX] 이슈 2: `use-debounce.ts` 참조 불일치

확인됨. 마스터 PLAN이 두 곳에서 모두 수정되었다:

- 162번 줄: `파일: question-card.tsx (인라인 debounce — use-debounce.ts 생성 취소, S2 반영)`
- 209번 줄 소유권 테이블: `~~src/lib/hooks/use-debounce.ts~~ | ~~취소 (S2)~~ — 인라인 패턴 | —`

Wave 3 16번 줄의 "생성 취소" 결정과 마스터 PLAN이 일치한다.

---

### [CONSIDER] 이슈 3: `useDebounce vi.useFakeTimers()` 테스트 항목 잔존

확인됨. 마스터 PLAN 8절 테스트 전략 238번 줄이 다음과 같이 교체되었다:

```
- **debounce**: 인라인 패턴이므로 별도 테스트 불필요 (EditMode 수동 E2E로 검증)
```

`useDebounce vi.useFakeTimers()` 항목이 제거되어 Wave 4 PLAN과 일관성을 유지한다.

---

## 새로운 이슈 검토

신규 이슈 없음. 이전 리뷰에서 식별된 모든 변경 사항이 반영되었으며, 마스터 PLAN과 상세 Wave PLAN 간 명세가 일치한다.

---

## Plan Review Completion Checklist 재판정

| 항목 | 상태 |
|------|------|
| 모든 Task의 파일 소유권 명확 | ✅ |
| Task 간 의존성 순서 정의 | ✅ |
| 외부 의존성 명시 | ✅ |
| 에러 처리 방식 정해짐 | ✅ |
| 테스트 전략 있음 | ✅ |
| 이전 Phase 회고 교훈 반영 | ✅ |
| 병렬 구현 시 파일 충돌 없음 | ✅ |

**판정: READY — 구현 시작 가능**
