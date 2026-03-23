# Security Review: 도형 렌더링 단계 1.5-2 (2차)

> 리뷰 일자: 2026-03-23
> 리뷰어: security-reviewer
> 대상: H1 수정(SVG 마커 ID 고유화) 이후 보안 재점검

---

## 종합 판정

| 등급 | 건수 |
|------|------|
| CRITICAL | 0 |
| HIGH | 0 |
| NEW MEDIUM | 0 |
| LOW (잔존) | 3 |
| LOW (해소) | 1 |

**판정: READY** — 신규 HIGH/CRITICAL 없음. 잔존 LOW는 방어적 검증 강화 권장 수준이며 구현 블로커 아님.

---

## H1 수정 검증 — 완료 확인

### 확인 사항

| 파일 | 이전 ID | 현재 ID | 상태 |
|------|---------|---------|------|
| `svg-utils.ts` | `ARROWHEAD_MARKER_ID = 'arrowhead'` | `NUMBERLINE_MARKER_ID = 'nl-arrowhead'` 외 4개 분리 | FIXED |
| `number-line.tsx` | `arrowhead` | `nl-arrowhead` | FIXED |
| `coordinate-plane.tsx` | `arrowhead` | `cp-arrowhead` / `cp-arrowhead-rev` | FIXED |
| `function-graph.tsx` | `arrowhead` | `fg-arrowhead` / `fg-arrowhead-rev` | FIXED |
| `vector-arrow.tsx` | `arrowhead` | `vec-arrowhead` | FIXED |

**추가 관찰**: `coordinate-plane.tsx`는 `CoordinatePlane`(독립 SVG)과 `CoordinatePlaneContent`(<g>)로 분리되어 있다. `CoordinatePlaneContent`가 `function-graph.tsx` 내부에서 사용될 때 마커 `<defs>`는 `function-graph.tsx`의 SVG 안에 선언된 `FUNCGRAPH_MARKER_ID`를 사용하며, `CoordinatePlaneContent`의 `markerEnd` 속성도 `COORDPLANE_MARKER_ID`를 참조한다.

**신규 이슈 없음**: 동일 페이지에 두 컴포넌트가 공존해도 각 ID가 고유하므로 마커 충돌 없음. XSS 경로 없음(마커 ID는 하드코딩 상수).

---

## 1차 LOW 이슈 잔존 현황

### L1. `color` 필드 미검증 — 잔존

**파일**: `src/lib/validations/figure-schema.ts:78`

```typescript
color: z.string().optional(),  // 형식 제한 없음
```

**현황**: 미수정. `FunctionGraph` 컴포넌트에서 `color ?? DEFAULT_GRAPH_COLOR`로 폴백하며, React가 JSX 속성값을 이스케이프하므로 XSS 불가.

**판단**: LOW 유지. CSS 색상 정규식(`/^#[0-9A-Fa-f]{6}$|^[a-z]+$/`) 추가 시 방어 강화 가능하나 렌더링 안전성 문제는 없음.

### L2. `description` 최대 길이 제한 없음 — 잔존

**파일**: `src/lib/validations/figure-schema.ts:23`

```typescript
const descriptionSchema = z.string().min(1, '도형 설명이 비어있습니다.')
```

**현황**: 미수정. `aria-label`에 삽입되며 DOM 속성이므로 HTML 인젝션 불가.

**판단**: LOW 유지. `.max(500)` 추가 시 비정상적으로 긴 AI 응답 방어 가능.

### L3. `number_line.points` 배열 크기 제한 없음 — 잔존

**파일**: `src/lib/validations/figure-schema.ts:137-144`

```typescript
points: z.array(...).min(1, ...)  // max() 없음
```

**현황**: 미수정. `function_graph.points`는 `.max(50)` 있으나 수직선 points에 없음. 과도한 점 렌더링 시 SVG 성능 저하 가능.

**판단**: LOW 유지. `.max(20)` 추가 권장.

### L4. `polygon.labels` 배열 크기 미검증 — 해소 판단 가능

**파일**: `src/lib/validations/figure-schema.ts:93`

```typescript
labels: z.array(z.string()).optional(),
```

**현황**: 미수정. `polygon.tsx` 렌더러가 `vertices` 범위 내 인덱스만 접근(`vertices.map(...)`)하므로 labels 초과 시 단순 무시됨. 실제 보안 리스크 없음.

**판단**: 1차 LOW → 실질적으로 무해함. 관심사가 일치성 검증(CONSIDER 수준) 재분류.

---

## 신규 발견 이슈

없음.

---

## 정상 확인 항목 (재확인)

| 항목 | 상태 |
|------|------|
| SVG 마커 ID 고유화 — H1 수정 완료 | PASS |
| XSS — dangerouslySetInnerHTML(KaTeX) 안전 | PASS |
| aria-label 인젝션 불가 (DOM 속성) | PASS |
| Zod unknown key strip | PASS |
| 마커 ID 하드코딩 — 사용자 입력 경로 없음 | PASS |
| IDOR — academy_id 서버 강제 주입 | PASS |
