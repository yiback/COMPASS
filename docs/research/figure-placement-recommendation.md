# 도형 위치(Placement) 데이터 모델 — 추천안 v2

> **리서치 기반**: tech/figure-placement.md, feasibility/figure-placement.md, tech/figure-mid-text.md, feasibility/figure-mid-text.md
> **작성일**: 2026-03-22 (v2 — 텍스트 중간 도형 산재 케이스 반영)

---

## 추천: `{{fig:N}}` 구분자로 통일 + `displaySize` 렌더링 힌트

**모든 도형의 위치는 `{{fig:N}}` 구분자로 결정한다.**
`block_before/block_after`는 제거 — 텍스트 중간 도형을 표현할 수 없기 때문.

---

## 데이터 구조

```typescript
interface FigureData {
  // JSON 도형 스키마 (이전 리서치 확정)
  type: 'coordinate_plane' | 'polygon' | 'circle' | 'function_graph' | 'vector' | 'number_line'
  // ... 각 타입별 데이터

  // 렌더링 크기 힌트 (위치는 구분자가 결정)
  displaySize: 'large' | 'small'  // large=블록(가운데 정렬), small=인라인(텍스트 흐름)
  description: string  // 텍스트 설명 (폴백용)
}
```

- `displaySize: 'large'` → 블록 렌더링 (큰 도형, `display:block`, 가운데 정렬)
- `displaySize: 'small'` → 인라인 렌더링 (작은 도형, `display:inline`, 텍스트 흐름)
- 위치: 100% 구분자 `{{fig:N}}`이 결정 (텍스트 어디든 배치 가능)

---

## v1에서 변경된 점

| 항목 | v1 | v2 |
|------|----|----|
| 블록 도형 위치 | `placement: block_before/after` (구분자 없음) | `{{fig:N}}` 구분자 (통일) |
| `placement` 역할 | 위치 지정 | **제거** → `displaySize` 렌더링 크기 힌트로 대체 |
| 텍스트 중간 도형 | 불가 | **가능** (`\n{{fig:0}}\n문제계속\n{{fig:1}}\n`) |
| 연속 도형 | 미고려 | **가능** (`{{fig:1}}{{fig:2}}` → flex 수평 배치) |

### 변경 이유
실제 한국 수학 시험에서 도형은 텍스트 **앞/뒤**뿐 아니라 **중간 여러 곳에 산재**한다:
```
문제 서론~~~
[도형1]
문제 계속~~~
[도형2][도형3]  ← 연속 도형
문제 계속~~~
[도형4]
[도형5]
문제 결론~~~
```
`block_before/after`로는 이 중 약 40%만 처리 가능. 나머지 60%를 커버하려면 구분자 통일이 필수.

---

## 핵심 예시

### 텍스트 중간에 도형이 산재하는 경우
```json
{
  "questionText": "다음 함수의 그래프를 보고 물음에 답하시오.\n{{fig:0}}\n위 그래프에서 직선 l이\n{{fig:1}}{{fig:2}}\n그림과 만나는 점 A에 대하여\n{{fig:3}}\n이때 점 A의 좌표를 구하시오.",
  "figures": [
    { "type": "coordinate_plane", "displaySize": "large", ... },
    { "type": "line", "displaySize": "small", ... },
    { "type": "circle", "displaySize": "small", ... },
    { "type": "composite", "displaySize": "large", ... }
  ]
}
```

### 선택지 도형
```json
{
  "options": ["$\\frac{1}{2}$", "{{fig:4}}", "{{fig:5}}", "3"],
  "figures": [
    ...,
    { "type": "number_line", "displaySize": "large", ... },
    { "type": "graph", "displaySize": "large", ... }
  ]
}
```

### 연속 도형 렌더링 규칙
- `{{fig:1}}{{fig:2}}` (사이에 텍스트 없음) → 인접 figure 감지 → `flex-row` 수평 배치
- `{{fig:3}}\n{{fig:4}}` (줄바꿈 분리) → 각각 독립 블록 → 수직 배치

---

## LaTeX 파서 통합

`parseLatexText`에 **+8줄 추가**:

```typescript
type LatexSegment =
  | { type: 'text'; content: string }
  | { type: 'inline'; content: string }   // $...$
  | { type: 'block'; content: string }    // $$...$$
  | { type: 'figure'; index: number }     // {{fig:N}}
```

파싱 우선순위: `$$` > `{{fig:N}}` > `$` > 텍스트

- 연속 `{{fig:1}}{{fig:2}}` → `[{figure,1}, {figure,2}]` 두 세그먼트로 분리 (정규식 OK)
- 빈 text 세그먼트 필터링 추가 (빈 문자열 제거)

---

## 변경 범위 요약 (v1과 동일)

| 항목 | 내용 |
|------|------|
| DB 스키마 | `questions` 테이블에 `has_figure, figures` 추가 (마이그레이션 1회) |
| `questionText` 타입 | **string 유지** |
| `options` 타입 | **string[] 유지** |
| LaTeX 파서 수정 | +8줄 |
| AI 프롬프트 수정 | 추출: +10줄, 생성: Phase 2에서 변경 |
| 새 컴포넌트 | `FigureRenderer` 1개 |
| 기존 파일 직접 수정 | **0개** |

---

## 단계적 도입 순서

| Phase | 내용 | 작업량 |
|-------|------|-------|
| **LaTeX PLAN과 동시** | 파서에 `{{fig:N}}` 세그먼트 추가 | XS (+8줄) |
| **Phase 2a** | FigureRenderer 컴포넌트 + description 텍스트 표시 | S (1-2일) |
| **Phase 2b** | AI 추출 프롬프트에 `{{fig:N}}` 삽입 지시 추가 | S (0.5일) |
| **Phase 2c** | 커스텀 SVG 렌더러 (수직선 → 좌표평면 → 기하도형) | M (3-5일) |
| **Phase 2d** | 연속 도형 수평 배치 + 선택지 도형 | S (1일) |

---

## 주요 리스크 3가지

1. **AI 구분자 위치 정확도** (HIGH): AI가 `{{fig:N}}`을 텍스트 흐름의 정확한 위치에 삽입하기 어려움 → 선생님 검수 편집 단계 유지 (이미 구현됨)
2. **복수 도형 인덱스 불일치** (MEDIUM): AI가 figures 배열 순서와 구분자 인덱스를 불일치시킬 수 있음 → Zod 교차 검증 추가
3. **연속 도형 수평/수직 판단** (LOW): `{{fig:1}}{{fig:2}}` vs `{{fig:1}}\n{{fig:2}}` 구분 → 파서에서 인접 figure 감지 로직

---

## 참고: Khan Academy 선례

Khan Academy의 [Perseus 프레임워크](https://github.com/Khan/perseus)가 `{{figure}}` 구분자 패턴을 사용 — **동일 도메인(수학 교육)에서 검증된 패턴**.
