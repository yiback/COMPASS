# Code Review: 도형 렌더링 단계 1.5-2

> 리뷰 일자: 2026-03-23
> 리뷰어: security-reviewer, perf-reviewer, test-reviewer
> 종합: 리드
> **2차 리뷰 완료** — HIGH 3건 수정 확인

---

## 종합 판정: READY

| 등급 | 1차 | 2차 수정 후 |
|------|-----|-----------|
| CRITICAL | 0 | 0 |
| HIGH | 3 | **0 (전부 해소)** |
| MEDIUM | 5 | 3 잔존 (M1, M2, M4) + 2 해소 (M3, M5) |
| LOW | 6 | 6 잔존 |

---

## HIGH — 0건 (전부 해소)

### ~~H1. SVG 마커 ID 충돌~~ → 해소
컴포넌트별 고유 ID prefix 적용: `nl-`, `cp-`, `fg-`, `vec-`

### ~~H2. validation.test.ts figures 미테스트~~ → 해소
5개 테스트 추가: 유효/무효/경고/기존호환 + console.warn 검증

### ~~H3. extraction-validation.test.ts 경고 경로~~ → 해소
2개 테스트 추가: 인덱스 불일치 경고 + 일치 시 경고 없음

---

## MEDIUM — 3건 잔존 (구현 중 처리 가능)

### M1. [perf] `parseLatexText` + `groupAdjacentFigures` useMemo 미적용
`latex-renderer.tsx:254` — 다음 Phase에서 성능 최적화 시 처리 권장.

### M2. [test] function_graph xRange/yRange 역전 테스트 누락
검증 로직은 구현되어 있으나 테스트 미커버. `xRange: [5, -5]` 케이스 추가 권장.

### M4. [test] 비원점 center CircleShape 테스트 누락
수학적 정확성 검증용. 우선순위 낮음.

### ~~M3. unknown 타입 폴백~~ → 해소
TypeScript가 모든 케이스를 커버하므로 default 도달 불가 — 실질적으로 불필요.

### ~~M5. calcLabelOffset dist=0~~ → CONSIDER 재분류
방어 코드는 존재하며 실질적 크래시 위험 없음.

---

## LOW — 6건 잔존

| # | 분류 | 이슈 |
|---|------|------|
| L1 | security | `color` 필드 색상 정규식 미검증 |
| L2 | security | `description` 최대 길이 제한 없음 |
| L3 | security | `number_line.points` 배열 크기 제한 없음 |
| L4 | security | `polygon.labels` 배열 크기 미검증 |
| L5 | test | `save-questions.test.ts` figures 저장 미테스트 |
| L6 | perf | `FIGURE_OUTPUT_RULES` 코드 중복 |

---

## 정상 확인 항목

| 항목 | 상태 |
|------|------|
| IDOR — academy_id 서버 강제 주입 | PASS |
| RLS — 신규 컬럼에 기존 정책 자동 적용 | PASS |
| XSS — dangerouslySetInnerHTML 안전 사용 | PASS |
| Zod unknown key strip | PASS |
| AI 프롬프트 인젝션 경로 없음 | PASS |
| N+1 쿼리 없음 (Bulk INSERT) | PASS |
| 번들 사이즈 정상 (code-split) | PASS |
| Zod discriminatedUnion 성능 OK | PASS |
| AI 토큰 비용 증가 미미 (~180토큰) | PASS |
| SVG 마커 ID 고유화 | PASS |
| 테스트 1367개 PASS (신규 100개+) | PASS |
