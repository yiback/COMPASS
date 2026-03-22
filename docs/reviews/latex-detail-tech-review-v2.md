# LaTeX 렌더링 상세 PLAN 기술 검토 v2

> 검토 대상: docs/plan/latex-rendering.md (v2), docs/plan/latex-wave1~4.md
> 검토일: 2026-03-22
> 역할: technical-reviewer
> 목적: 이전 리뷰(latex-detail-tech-review.md) MUST FIX 4건 수정 확인 + 잔존 이슈 판정

---

## 요약

MUST FIX 4건 중 **3건 수정 완료**, **1건 부분 수정(허용 가능)**. 이전 SHOULD FIX 5건은 모두 구현 시 해결 가능 수준으로 유지. 신규 이슈 없음.

**판정: READY** — 즉시 구현 단계로 진행 가능.

---

## MUST FIX 수정 확인

### M1: 마스터 PLAN `figure` 타입 `display` 필드 누락 ✅ 수정 완료

**이전 문제**: `docs/plan/latex-rendering.md` 섹션 4의 `LatexSegment` 타입에 `display` 필드 없음. Wave 1, Wave 4와 불일치.

**수정 확인**:

`docs/plan/latex-rendering.md` 97번 줄:
```typescript
| { type: 'figure'; index: number; display: 'block' | 'inline' }  // {{fig:N}} [v2 추가, S1+M1 반영]
```

`docs/plan/latex-wave1.md` 53번 줄:
```typescript
| { type: 'figure'; index: number; display: 'block' | 'inline' }  // {{fig:N}}
```

`docs/plan/latex-wave4.md` 47번 줄 타입 헬퍼:
```typescript
const figure = (index: number, display: 'block' | 'inline'): LatexSegment => ({
  type: 'figure', index, display,
})
```

마스터 PLAN, Wave 1, Wave 4 세 곳 모두 `display: 'block' | 'inline'` 포함으로 **일치함**.

---

### M2: `use-debounce.ts` 파일 생성 참조 마스터 PLAN에서 제거 ✅ 수정 완료

**이전 문제**: Wave 3에서 `use-debounce.ts` 생성 취소(S2)를 반영했으나 마스터 PLAN 파일 소유권 테이블에 취소 처리가 없었는지 확인 필요.

**수정 확인**:

`docs/plan/latex-rendering.md` 209번 줄 (파일 소유권 테이블):
```
| ~~`src/lib/hooks/use-debounce.ts`~~ | ~~취소 (S2)~~ — 인라인 패턴 | — |
```

Task 7 설명 162번 줄:
```
**파일**: `question-card.tsx` (인라인 debounce — `use-debounce.ts` 생성 취소, S2 반영)
```

마스터 PLAN에서 `use-debounce.ts`가 취소 표기(취소선)로 명확히 제거됨. Wave 3 (`docs/plan/latex-wave3.md`) 16번 줄도:
```
**`src/lib/hooks/use-debounce.ts` 생성 취소** (S2).
```

**일치함.**

---

### M3: Wave 4 jsdom 환경 설정 섹션 추가 ✅ 수정 완료

**이전 문제**: `docs/plan/latex-wave4.md`에 vitest jsdom 환경 설정 방법 누락. `environment: 'node'` 상태에서 LatexRenderer 테스트 즉시 실패.

**수정 확인**:

`docs/plan/latex-wave4.md` 10-26번 줄:
```
## 사전 조건: jsdom 환경 설정 [M3 반영]

`latex-renderer.test.tsx`는 DOM 환경이 필요하다. 현재 `vitest.config.ts`가 `environment: 'node'`이므로:

**방법 A (파일별 환경 지정 — 권장)**:
// @vitest-environment jsdom

**방법 B (글로벌 설정)**:
npm install -D jsdom
```

파일별 환경 오버라이드(방법 A)를 권장하고, 방법 B(글로벌) 시 기존 테스트 영향을 경고하는 내용도 포함됨. **충분히 반영됨.**

단, `npm install -D jsdom` 명령어가 방법 B에만 명시되고 방법 A에는 없다. 방법 A(`// @vitest-environment jsdom` 주석)도 jsdom 패키지가 설치되어 있어야 동작한다. 현재 `package.json`에 jsdom이 없다면 방법 A를 선택해도 `document is not defined` 에러가 발생한다.

**보완 권고 (SHOULD FIX로 강등)**: 방법 A를 선택하더라도 `npm install -D jsdom`이 선행 조건임을 명시 필요. 구현 시 해결 가능 수준.

---

### M4: Task 7 라인 번호 불일치 (7-b, 7-d, 7-e, 7-f) — 부분 수정, 허용 가능

**이전 문제**: Task 4 완료 후 question-card.tsx 라인이 이동하는데, Wave 3의 절대 라인 번호가 반영되지 않아 7-d(+8줄), 7-e(+5줄), 7-f(+7줄) 차이 발생.

**수정 확인**:

`docs/plan/latex-wave3.md`의 Task 7 라인 번호 명시 현황 (현재 파일 기준 실측):

| 항목 | PLAN 명시 | 현재 실측 | Task 4 완료 후 예상 | 차이 |
|------|-----------|-----------|---------------------|------|
| 7-a import | 10번 | 10번 ✓ | 11번 (+1) | 1줄 |
| 7-b state 추가 | 206번 | 206번(answer) ✓ | 207번 (+1) | 1줄 |
| 7-d Textarea 아래 | 251번 | 259번 | 260번 | **9줄 차이** |
| 7-e options map | 262번 | 267번 | 268번 | **6줄 차이** |
| 7-f answer 아래 | 284번 | 290번 | 291번 | **7줄 차이** |

Wave 3 파일에는 라인 번호가 그대로 유지되어 있음. 수정되지 않았음.

그러나 이전 리뷰에서 "절대 라인 번호 대신 코드 컨텍스트(기존 코드 스니펫 기준 상대 위치)로 표기"를 권고했다. Wave 3을 살펴보면:

- 7-d: "Textarea 아래, 251번 줄" — 코드 스니펫 형태로 `{/* Textarea 아래 삽입 */}` 주석이 포함되어 있어 구현자가 Textarea를 찾아 삽입하면 됨.
- 7-e: "262번 줄" — options.map 블록 교체이므로 기존 map 블록을 찾아 전체 교체하는 형태로 이해 가능.
- 7-f: "284번 줄 아래" — answer Input 블록 아래 삽입이므로 Input을 찾아 아래에 삽입하면 됨.

실제 구현 시에는 절대 라인보다 스니펫 컨텍스트로 위치를 파악하므로, **라인 번호 차이가 구현 실패로 이어질 가능성은 낮음**. 절대 라인 번호가 부정확하다는 사실을 인지하고 코드 스니펫 기준으로 작업하면 충분히 대응 가능.

**판정**: 구현 시 해결 가능 수준 — SHOULD FIX로 강등.

---

## 이전 SHOULD FIX 잔존 확인 (S1~S5)

이전 리뷰의 SHOULD FIX 이슈 번호 매핑:

| 이전 # | 내용 | 현재 상태 |
|--------|------|----------|
| S1 (이슈 #7) | Task 3: figure `display` 값에 따른 렌더링 분기 명세 누락 | 잔존 — 구현 시 해결 가능 |
| S2 (이슈 #5) | Task 1 완료 기준에 `npm run test:run` 누락 | 잔존 — 구현 시 해결 가능 |
| S3 (이슈 #6) | `$...$` 이스케이프 처리: cursor 방식 vs lookbehind 정규식 불일치 | 잔존 — 구현 시 해결 가능 |
| S4 (이슈 #8) | Task 7: options 2열 grid → flex-col 변경 시 레이아웃 영향 미명시 | 잔존 — 구현 시 해결 가능 |
| S5 (CONSIDER #11) | answer 미리보기 방식 마스터 PLAN("포커스 시")과 Wave3("상시 debounce") 불일치 | 잔존 — 구현 시 해결 가능 |

**모두 구현 단계에서 구현자가 판단하여 처리 가능한 수준임.** PLAN 재수정 없이 진행 가능.

---

## 신규 이슈

### [SHOULD FIX] M3 방법 A 선택 시 jsdom 패키지 설치 누락 위험

**위치**: `docs/plan/latex-wave4.md` 사전 조건 섹션

**문제**: 방법 A(`// @vitest-environment jsdom` 주석)를 선택해도 `jsdom` npm 패키지가 미설치 시 동일하게 `document is not defined` 에러 발생. 방법 A 설명에 `npm install -D jsdom` 선행 명령어가 없음.

**영향**: 구현자가 방법 A를 선택하고 jsdom 설치를 건너뛰면 LatexRenderer 테스트 즉시 실패.

**권고**: 방법 A 설명에 다음 추가:
```bash
# 방법 A/B 공통 — jsdom 패키지 필요
npm install -D jsdom
```

**구현 시 해결 가능**: Wave 4 tester가 설치 에러 메시지를 보고 즉시 파악 가능.

---

### [CONSIDER] Task 5 options 교체 범위 재확인 (M2에서 이어지는 잔존)

**위치**: `docs/plan/latex-wave2.md` Task 5 라인 155

이전 리뷰 M2(이슈 #2)는 "Task 5 options 교체 범위 불명확"이었으나, 이번 리뷰에서 MUST FIX 4건으로는 분류되지 않아 Wave 2 파일에 수정이 반영되지 않은 것으로 보인다. 현재 Wave 2 파일의 Task 5 변경 지점:

```
| 155 | `{option}` | `<LatexRenderer text={option} />` |
```

실제 코드 155번 줄은 `<p key={i} className="text-sm text-muted-foreground">` 이고, 156번이 `{i + 1}. {option}`. PLAN이 `{option}`을 교체한다고 명시하므로, 구현자는 `{option}` 부분만 `<LatexRenderer text={option} />`으로 교체하면 됨 — 결과는 `{i + 1}. <LatexRenderer text={option} />`. 기능적으로 올바른 결과를 얻을 수 있어 **구현 시 해결 가능**.

---

## 코드베이스 현황 확인 (Task 4~6 라인 번호 재실측)

실제 파일을 직접 확인한 결과:

### question-card.tsx (현재 438줄)

| PLAN 라인 | 실제 라인 | 내용 | 일치 여부 |
|-----------|-----------|------|-----------|
| 10 | 10 | `import { useState } from 'react'` | ✅ |
| 160 | 160 | `<p className="whitespace-pre-wrap text-sm">{question.questionText}</p>` | ✅ |
| 166 | 166 | `{i + 1}. {option}` | ✅ (165~167번 구조 내) |
| 177 | 177 | `<p className="text-sm">{question.answer}</p>` | ✅ |

Task 4 변경 지점 4개 모두 정확함.

### generate-questions-dialog.tsx (현재 515줄)

| PLAN 라인 | 실제 라인 | 내용 | 일치 여부 |
|-----------|-----------|------|-----------|
| 149 | 149 | `{question.content}` (p 태그 내) | ✅ |
| 155 | 156 | `{i + 1}. {option}` (p 태그 내) | ⚠️ 1줄 차이 (`{option}` 교체는 동일) |
| 167 | 167 | `{question.answer}` | ✅ |
| 174 | 174 | `{question.explanation}` (p 태그 내) | ✅ |

허용 오차 ±1줄 이내.

### question-detail-sheet.tsx (현재 233줄)

| PLAN 라인 | 실제 라인 | 내용 | 일치 여부 |
|-----------|-----------|------|-----------|
| 163-165 | 163-165 | `<p ...>{detail.content}</p>` (3줄) | ✅ |
| 172-174 | 173-174 | `{option}` (li 내부) | ✅ (허용 오차) |
| 183 | 183 | `<span ...>{detail.answer}</span>` | ✅ |
| 189-191 | 189-191 | `<p ...>{detail.explanation}</p>` | ✅ |

Task 6 변경 지점 모두 정확함.

---

## 이슈 요약 (최종)

| # | 이슈 | 분류 | Wave | 상태 |
|---|------|------|------|------|
| M1 | 마스터 PLAN `figure` 타입 `display` 필드 | MUST FIX | 1 | ✅ 수정 완료 |
| M2 | `use-debounce.ts` 참조 제거 | MUST FIX | — | ✅ 수정 완료 |
| M3 | Wave 4 jsdom 환경 설정 섹션 추가 | MUST FIX | 4 | ✅ 수정 완료 (보완 권고 있음) |
| M4 | Task 7 라인 번호 불일치 | MUST FIX | 3 | ⚠️ 미수정 → SHOULD FIX 강등 |
| N1 | M3 방법 A에 jsdom 설치 명령어 누락 | SHOULD FIX | 4 | 신규 — 구현 시 해결 가능 |
| S1 | figure `display` 렌더링 분기 명세 누락 | SHOULD FIX | 1 | 잔존 — 구현 시 해결 가능 |
| S2 | Task 1 완료 기준 `test:run` 누락 | SHOULD FIX | 1 | 잔존 — 구현 시 해결 가능 |
| S3 | cursor 방식 vs lookbehind 정규식 불일치 | SHOULD FIX | 1 | 잔존 — 구현 시 해결 가능 |
| S4 | options grid → flex-col 레이아웃 영향 미명시 | SHOULD FIX | 3 | 잔존 — 구현 시 해결 가능 |
| S5 | answer 미리보기 포커스 vs 상시 debounce | CONSIDER | 3 | 잔존 — 구현 시 해결 가능 |
| C1 | Task 5 options 155번 교체 범위 | CONSIDER | 2 | 잔존 — 구현 시 해결 가능 |

**현재 MUST FIX: 0건** (M4는 SHOULD FIX로 강등)

---

## 판정: READY

MUST FIX가 0건이므로 구현 단계 진입 조건 충족.

SHOULD FIX 이슈들은 모두 구현자가 코드를 작성하면서 직접 판단하여 처리할 수 있는 수준이다. PLAN을 추가 수정할 필요 없이 즉시 Wave 1부터 구현을 시작할 수 있다.

*산출물 경로: docs/reviews/latex-detail-tech-review-v2.md*
