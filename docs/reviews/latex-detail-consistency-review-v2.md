# LaTeX 렌더링 상세 PLAN 정합성 리뷰 v2 (재검토)

> **작성일**: 2026-03-22
> **담당**: consistency-reviewer
> **v1 리뷰**: `docs/reviews/latex-detail-consistency-review.md`
> **v2 목적**: MUST FIX 3건 수정 완료 후 재검토

---

## MUST FIX 3건 재검토 결과

### M1: `LatexSegment` figure `display` 필드 불일치

**수정 확인**:

`docs/plan/latex-rendering.md` 97줄 (마스터 PLAN v2):
```typescript
| { type: 'figure'; index: number; display: 'block' | 'inline' }  // {{fig:N}} [v2 추가, S1+M1 반영]
```

Wave 1 (`latex-wave1.md` 53줄):
```typescript
| { type: 'figure'; index: number; display: 'block' | 'inline' }  // {{fig:N}}
```

Wave 4 (`latex-wave4.md` 47~49줄) 헬퍼 함수:
```typescript
const figure = (index: number, display: 'block' | 'inline'): LatexSegment => ({
  type: 'figure', index, display,
})
```

**판정**: ✅ RESOLVED — 마스터 PLAN, Wave 1, Wave 4 세 곳 모두 `display: 'block' | 'inline'` 필드로 일치.

---

### M2: `use-debounce.ts` 생성 취소 결정 미반영

**수정 확인**:

마스터 PLAN `latex-rendering.md` 파일 소유권 테이블 (209줄):
```
| ~~`src/lib/hooks/use-debounce.ts`~~ | ~~취소 (S2)~~ — 인라인 패턴 | — |
```

마스터 PLAN Task 7 설명 (162줄):
```
**파일**: `question-card.tsx` (인라인 debounce — `use-debounce.ts` 생성 취소, S2 반영)
```

마스터 PLAN 테스트 전략 섹션 (238줄):
```
- **debounce**: 인라인 패턴이므로 별도 테스트 불필요 (EditMode 수동 E2E로 검증)
```

Wave 3 (`latex-wave3.md` 5~16줄) 와 일치.

**판정**: ✅ RESOLVED — 마스터 PLAN Task 7 파일 목록, 파일 소유권 테이블, 테스트 전략 3곳 모두 인라인 패턴으로 반영됨. `use-debounce.ts` 관련 항목 혼선 없음.

---

### M3: ROADMAP Task 8 테스트 수 13개 → 17개 미반영

**수정 확인**:

`ROADMAP.md` 182줄:
```
- [ ] Task 8: 단위 테스트 (17개 케이스 — figure 4개 포함)
```

마스터 PLAN (`latex-rendering.md` 174줄):
```
### Task 8: 단위 테스트 [v2 변경: 13 → 17개]
```

Wave 4 (`latex-wave4.md` 1줄):
```
# Wave 4: 단위 테스트 17개
```

**판정**: ✅ RESOLVED — ROADMAP, 마스터 PLAN, Wave 4 모두 17개로 일치.

---

## SHOULD FIX 잔존 확인

v1 리뷰의 SHOULD FIX 3건 (#4, #5, #6)은 수정 대상이 아니었으므로 현재 상태를 재확인한다.

### SHOULD FIX #4: `display` (파서 유추) vs `displaySize` (JSONB) 개념 미명시

**현재 상태**: Wave 1 (`latex-wave1.md`)에 주석 추가 여부 확인.

`latex-wave1.md` Task 2 `display` 판단 로직 섹션:
- 텍스트 문맥 기반 `display` 유추 로직만 기술됨
- "1.5-2에서 figures JSONB의 `displaySize`로 대체 예정"이라는 명시 없음

**판정**: 미수정 (SHOULD FIX 잔존). 1.5-1 구현 범위에서 즉각 버그 없으나, 1.5-2 작업 시 재작업 위험 있음.

---

### SHOULD FIX #5: debounce useEffect self-cancellation 검토 근거 미명시

**현재 상태**: Wave 3 (`latex-wave3.md`) Task 7-c debounce useEffect:
```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    setPreviewText(questionText)
  }, 300)
  return () => clearTimeout(timer)
}, [questionText])
```
dependency `[questionText]` — `previewText` 미포함으로 self-cancellation 없음이 구조적으로 안전하나, PLAN 내 한 줄 근거 명시는 없음.

**판정**: 미수정 (SHOULD FIX 잔존). 구현 안전성에 영향 없음.

---

### SHOULD FIX #6: 인라인 debounce 단위 테스트 귀속 범위 미명시

**현재 상태**: 마스터 PLAN 테스트 전략(238줄)에 "인라인 패턴이므로 별도 테스트 불필요 (EditMode 수동 E2E로 검증)"로 명시됨.
Wave 4 (`latex-wave4.md`) 테스트 목록에 debounce 관련 항목 없음.

**판정**: ⚠️ 부분 해소. "수동 E2E로 검증"이 명시되어 귀속 범위는 해소되었으나, v1 SHOULD FIX에서 제안한 `vi.useFakeTimers()` 케이스 추가는 이루어지지 않음. 현재 테스트 전략(수동 E2E)은 수용 가능한 수준임.

---

## 새로운 이슈 여부

추가 검토 결과 새로운 정합성 이슈는 발견되지 않았다.

---

## 판정

| # | 분류 | 이슈 요약 | 상태 |
|---|------|-----------|------|
| 1 | [MUST FIX] | `LatexSegment` figure `display` 필드 불일치 | ✅ RESOLVED |
| 2 | [MUST FIX] | `use-debounce.ts` 생성 취소 결정 미반영 | ✅ RESOLVED |
| 3 | [MUST FIX] | ROADMAP Task 8 테스트 수 13개 (v1 기준) | ✅ RESOLVED |
| 4 | [SHOULD FIX] | `display` vs `displaySize` 개념 미명시 | ⏳ 잔존 (1.5-1 블로커 아님) |
| 5 | [SHOULD FIX] | debounce useEffect self-cancellation 근거 미명시 | ⏳ 잔존 (구현 안전성 영향 없음) |
| 6 | [SHOULD FIX] | 인라인 debounce 테스트 귀속 범위 미명시 | ⚠️ 부분 해소 (수동 E2E로 명시됨) |
| 7 | [CONSIDER] | Wave 2 파일 전체 경로 미명시 | ⏳ 잔존 (구현 블로커 아님) |
| 8 | [CONSIDER] | `figure.index`와 `figures[]` 0-based 매핑 계약 미명시 | ⏳ 잔존 (1.5-2 작업 시 문서화 권장) |

**MUST FIX: 0건 / SHOULD FIX 잔존: 2건 / CONSIDER 잔존: 2건**

---

## 결론

**판정: READY**

MUST FIX 3건 모두 수정 확인됨. 마스터 PLAN, Wave 1~4, ROADMAP 간 정합성이 확보되었다.

잔존 SHOULD FIX 2건(#4, #5)은 1.5-1 구현 범위에서 버그를 유발하지 않는다. SHOULD FIX #4(`display` vs `displaySize`)는 1.5-2 PLAN 작성 시 반드시 처리할 것을 권장한다.

**구현 진행 가능.**
