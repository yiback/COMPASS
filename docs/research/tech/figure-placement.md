# 도형 위치(Placement) 데이터 모델 및 렌더링 방식 비교

> **작성일**: 2026-03-22
> **작성자**: tech-researcher
> **목적**: 수학 시험 문제에서 도형이 텍스트 중간에 인라인으로 등장하는 경우의 데이터 모델과 렌더링 방식 비교
> **선행 리서치**: `docs/research/tech/math-figures.md` (렌더링 기술), `docs/research/feasibility/math-figures.md` (실현 가능성), `docs/research/math-figures-recommendation.md` (추천안)

---

## 요약

**추천: 옵션 E (하이브리드) — 블록 도형은 별도 `figures[]` 배열 + 인라인 도형은 구분자 `{{fig:N}}`.**

한국 수학 시험에서 도형 위치는 크게 4가지 유형으로 나뉜다. 이 중 실제 구현 우선순위가 높은 것은 유형 1(블록 도형)과 유형 3(선택지 도형)이며, 유형 2(인라인 도형)는 존재 빈도가 낮다. 옵션 E는 기존 `questionText: string` + `options: string[]` 구조를 최소 수정으로 확장할 수 있으며, LaTeX 파서와 통합이 가장 자연스럽다.

---

## 배경 — 이전 리서치의 누락점

`docs/research/tech/math-figures.md`에서 렌더링 기술(JSON 스키마 + 커스텀 SVG 렌더러)은 확정했으나, 도형의 **위치(placement)** — 즉 텍스트 흐름에서 도형이 어디에 들어가는지 — 를 다루지 않았다.

이전 리서치에서 결정된 내용:
- AI는 **JSON 도형 데이터**를 출력 (SVG 직접 생성 아님)
- 커스텀 SVG 렌더러가 JSON → SVG 변환
- DB에 `figures JSONB` 컬럼에 배열로 저장

이번 리서치의 질문:
- `figures[0]`, `figures[1]`이 문제 텍스트의 **어느 위치**에 들어가는가?
- `questionText` 문자열과 `figures[]` 배열의 **연결 방식**은?
- `options: string[]` 내부에 도형이 필요하면 어떻게 처리하는가?

---

## 한국 수학 시험 도형 출현 유형 분류

### 유형 1: 블록 도형 — 문제 텍스트 위/아래에 독립 블록으로 배치

```
다음 함수의 그래프를 보고 물음에 답하시오.

[좌표 평면 + 함수 그래프]

위 그래프에서 x = 2일 때의 함수값을 구하시오.
```

- **출현 빈도**: 매우 높음 (수능·내신 기출에서 가장 일반적)
- **특징**: 도형이 "단락 수준"에서 분리됨. 텍스트와 도형이 명확히 구분.
- **현재 COMPASS 구조와의 관계**: `figures[]`가 항상 이 방식을 가정하고 있음

### 유형 2: 인라인 도형 — 문장 안에 도형이 삽입

```
오른쪽 그림과 같이 원 O 위의 점 A에서의 접선이 [원+접선 도형] 직선 l과 만나는 점을 B라 할 때...
```

- **출현 빈도**: 중간 ("오른쪽 그림과 같이" 문구 후 별도 참조 또는 직접 삽입)
- **특징**: 텍스트 줄 사이에 도형이 끼어든다. 실제 한국 시험지에서 "오른쪽 그림"으로 표기하고 실제 도형은 우측 여백에 별도 배치하는 경우가 많음.
- **주의**: 진짜 인라인(텍스트 흐름 중간 삽입) vs. "오른쪽 그림 참조"(블록이지만 글과 같은 줄)는 다르다.

### 유형 3: 선택지 도형 — 사지/오지선다 보기 자체가 도형

```
다음 중 y = x²의 그래프로 옳은 것은?
① [포물선 그래프 A]
② [포물선 그래프 B]
③ [포물선 그래프 C]
④ [포물선 그래프 D]
```

- **출현 빈도**: 높음 (고등 수학 특히 함수/기하 단원)
- **특징**: `options: string[]`에서 문자열 대신 도형 데이터가 들어가야 함. 기존 타입 구조와 가장 큰 충돌.

### 유형 4: 혼합 — 블록 도형 + 인라인 도형 + 선택지 도형 동시 출현

```
그림과 같이 삼각형 ABC에서 [삼각형 도형] 변 AB 위의 점 D에 대하여...

[더 큰 상세 도형]

① BD = 1/2   ② BD = [수직선 도형]   ③ ...
```

- **출현 빈도**: 낮음 (주로 고난도 고3 문제)
- **특징**: 유형 1+2+3이 모두 섞인 최복잡 케이스
- **MVP 적용 여부**: 단계적 접근 대상 — 초기 구현 범위에서 제외 가능

---

## 비교할 데이터 모델 옵션 상세 분석

### 옵션 A: 구분자 기반 — `{{fig:N}}`

**방식**:
```
"questionText": "오른쪽 그림과 같이 {{fig:0}} 원 O 위의 점 A에서...",
"figures": [
  { "type": "circle", "center": [0, 0], "radius": 3 }
]
```

**LaTeX 파서와의 통합**

COMPASS에서 이미 `$...$` LaTeX 렌더링을 사용 중이다 (`docs/research/tech/latex-rendering.md` 참조). 기존 텍스트 파싱 흐름:

```
"문자열 $x^2$ 와 같이"
  → 텍스트 파싱
  → ["문자열 ", { latex: "x^2" }, " 와 같이"]
  → 렌더링
```

구분자 추가 시:
```
"문자열 $x^2$ 와 {{fig:0}} 같이"
  → 확장 파싱
  → ["문자열 ", { latex: "x^2" }, " 와 ", { figRef: 0 }, " 같이"]
  → 렌더링 (figRef → FigureRenderer 컴포넌트)
```

**장점**
- 기존 `questionText: string` 타입 변경 없음
- LaTeX 파서(정규식 또는 토크나이저)에 추가 규칙 하나만 삽입
- DB 스키마 변경 없음 (figures 배열은 이미 있음)
- 하위 호환: 구분자 없는 기존 문제는 파서가 무시

**단점**
- AI가 `{{fig:0}}`를 정확한 위치에 생성해야 함 — AI 출력 안정성 의문
- 구분자 인덱스(`fig:0`, `fig:1`)와 배열 순서가 일치해야 함 → 버그 취약
- 편집 UX 복잡: 선생님이 텍스트 편집 중 구분자를 삭제하거나 순서를 바꾸면 렌더링 깨짐
- 인덱스 기반이라 중간 도형 삭제 시 모든 이후 인덱스 재계산 필요

**AI 생성 안정성 평가**

Gemini Structured Output 사용 시, 텍스트 필드 내에 `{{fig:0}}`를 정확히 삽입하는 것은 **불안정**하다:
- 구조화 JSON 출력이어도 텍스트 내용물 자체는 자유 형식
- AI가 `{{fig:0}}`를 문장 맥락상 적절한 위치에 배치할 보장 없음
- 같은 도형을 여러 번 참조하는 경우(`{{fig:0}}`가 두 번 등장) 렌더러 처리 복잡

---

### 옵션 B: 리치 콘텐츠 블록 — Notion/ProseMirror 스타일

**방식**:
```json
"content": [
  { "type": "text", "value": "오른쪽 그림과 같이" },
  { "type": "figure", "figureIndex": 0 },
  { "type": "text", "value": "원 O 위의 점 A에서..." }
]
```

**장점**
- 렌더링 단순: 배열 순회 → 타입별 컴포넌트 렌더링
- 도형 위치가 명시적 (인덱스 의존 없음, 위치 자체가 배열 순서)
- Notion, ProseMirror 등 검증된 업계 패턴

**단점**
- 기존 `questionText: string` 타입 완전 대체 필요
- DB 스키마 변경: `question_text TEXT` → `content JSONB`
- 기존 모든 UI, Server Action, 타입, 쿼리 수정 필요 — **마이그레이션 비용 매우 높음**
- AI가 블록 배열 구조를 정확히 출력해야 함 (텍스트 중간에 figure 블록 삽입)
- 선생님 편집 UI: 텍스트 에디터 + 도형 블록 삽입 — WYSIWYG 에디터 구현 필요
- LaTeX 텍스트도 블록으로 분리해야 하는지 모호 (LaTeX + Figure 중첩 처리)

**COMPASS 현황과의 충돌 규모 평가**

`questionText`를 사용하는 파일:
- `src/app/(dashboard)/past-exams/[id]/edit/question-card.tsx` (표시 + 편집)
- `src/app/(dashboard)/questions/_components/question-detail-sheet.tsx` (표시)
- `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` (생성 후 표시)
- `src/lib/actions/save-questions.ts` (저장)
- `src/lib/actions/questions.ts` (조회)
- `src/lib/ai/types.ts` (`ExtractedQuestion.questionText`, `GeneratedQuestion.content`)
- `src/lib/ai/validation.ts` (스키마 검증)
- `supabase/migrations/` 테이블 정의

전수 수정 규모: **L (1주+)**. MVP 단계에서 채택 부적합.

---

### 옵션 C: 마크다운 확장 — `![figure](fig:0)`

**방식**:
```
"questionText": "오른쪽 그림과 같이 ![figure](fig:0) 원 O 위의 점..."
```

**장점**
- 마크다운 이미지 문법을 활용 — 기존 마크다운 파서에 커스텀 핸들러 추가 가능
- `string` 타입 유지 (DB 변경 없음)

**단점**
- COMPASS는 마크다운 렌더러를 사용하지 않음 — 도입 시 `react-markdown` 등 추가 의존성
- LaTeX(`$...$`)와 마크다운이 혼재 → 충돌 가능성 (마크다운 파서가 `$`를 특수처리)
- AI 생성 안정성: `![figure](fig:0)` 문법이 옵션 A `{{fig:0}}`보다 더 verbose함
- 옵션 A 대비 이점 없음

**결론**: 옵션 A의 마크다운 변형이므로, 장점 없이 단점만 추가. 제외.

---

### 옵션 D: HTML/JSX 임베드 — `<Figure id="0" />`

**방식**:
```
"questionText": "오른쪽 그림과 같이 <Figure id=\"0\" /> 원 O 위의..."
```

**장점**: 없음.

**단점**
- DB에 HTML 문자열 저장 → XSS 위험 (설령 컴포넌트명이어도)
- AI가 JSX 태그를 텍스트 내에 정확히 생성할 신뢰성 없음
- React 서버 컴포넌트에서 `dangerouslySetInnerHTML` 없이 문자열 안의 JSX 실행 불가
- 옵션 A보다 구문이 복잡하고 이점이 없음

**결론**: 보안 + 구현 관점에서 최악의 선택. 제외.

---

### 옵션 E: 하이브리드 ⭐ 추천

**방식**:
- 블록 도형 (유형 1): 기존 `figures[]` 배열 + 텍스트에 구분자 불필요 (위치 = 텍스트 앞 또는 뒤)
- 인라인 도형 (유형 2): 텍스트 내 `{{fig:N}}` 구분자 (필요한 경우만)
- 선택지 도형 (유형 3): `options` 배열의 원소를 `string | OptionFigure` 혼합 타입으로 확장
- 큰 블록 도형은 `figurePlacement: 'before' | 'after' | 'inline'` 메타 추가

**핵심 아이디어**: 대부분의 한국 수학 도형은 블록 방식(유형 1)이다. 이 경우 텍스트와 도형 배열은 단순히 **순서 관계**만 있으면 된다 — 굳이 구분자가 필요 없다.

**구체적 데이터 구조**:

```typescript
interface FigureData {
  // 이전 리서치에서 확정된 JSON 도형 스키마
  type: 'coordinate_plane' | 'function_graph' | 'polygon' | 'circle' | 'vector' | 'number_line'
  // ... 각 타입별 데이터

  // 추가: 위치 힌트
  placement: 'block_before' | 'block_after' | 'inline'
  // 인라인인 경우만 사용: questionText 내 {{fig:N}} 의 N
  inlineIndex?: number
  // 선택지 도형인 경우
  optionIndex?: number  // options[N]에 대응
}
```

**블록 도형 렌더링 예시** (유형 1 — 구분자 불필요):

```
DB: questionText = "다음 그래프를 보고 물음에 답하시오.\n위 그래프에서 x = 2일 때..."
    figures = [{ type: "coordinate_plane", placement: "block_before", ... }]

렌더링:
  1. figures에서 placement === 'block_before' 인 것 먼저 렌더링
  2. questionText 렌더링
  3. figures에서 placement === 'block_after' 인 것 렌더링
```

**인라인 도형 렌더링 예시** (유형 2):

```
DB: questionText = "오른쪽 그림과 같이 {{fig:0}} 원 O 위의..."
    figures = [{ type: "circle", placement: "inline", inlineIndex: 0, ... }]

렌더링:
  1. questionText를 파싱: ["오른쪽 그림과 같이 ", { figRef: 0 }, " 원 O 위의..."]
  2. figRef:0 → figures[0]의 SVG 렌더러로 치환
```

**선택지 도형 렌더링 예시** (유형 3):

```
DB: options = ["① 텍스트", "② 텍스트", ...]
    figures = [
      { type: "parabola", placement: "option", optionIndex: 0, ... },
      { type: "parabola", placement: "option", optionIndex: 1, ... },
    ]

렌더링:
  1. options를 순회
  2. 각 optionIndex에 해당하는 figure가 있으면 텍스트 대신 SVG 렌더
  3. 없으면 텍스트 그대로 표시
```

---

## 복수 도형 — 하나의 문제에 도형이 여러 개 등장하는 경우

### 실제 시험 예시

```
그림 (가)와 같이 삼각형 ABC에서 {{fig:0}} 변 AB 위의 점 D에 대하여,
그림 (나)와 같이 원 O에서 {{fig:1}} 접선을 그을 때...

[도형2: 큰 상세 도형 — block_after]

① 1/2   ② {{fig:3}}(수직선)   ③ {{fig:4}}(그래프)   ④ 3
```

이 문제에는 도형 5개가 등장한다:
- `fig:0` — 인라인, 삼각형 ABC (유형 2)
- `fig:1` — 인라인, 원 O + 접선 (유형 2)
- `fig:2` — 블록(block_after), 두 그림을 합친 상세 도형 (유형 1)
- `fig:3` — 선택지 ②, 수직선 도형 (유형 3)
- `fig:4` — 선택지 ③, 그래프 도형 (유형 3)

### 옵션별 복수 도형 수용 능력

#### 옵션 A (구분자 `{{fig:N}}`) — 복수 도형 지원 가능하나 취약점 있음

```json
{
  "questionText": "그림 (가)와 같이 {{fig:0}} 변 AB 위의 점 D,\n그림 (나)와 같이 {{fig:1}} 접선을 그을 때...",
  "figures": [
    { "type": "polygon", "figIndex": 0 },
    { "type": "circle",  "figIndex": 1 },
    { "type": "composite", "figIndex": 2, "placement": "block_after" }
  ]
}
```

**취약점 1 — 인덱스 정렬 의존성**
- `figures[0]`가 반드시 `{{fig:0}}`에 대응한다는 보장이 필요
- 도형 삽입 순서(figIndex)와 배열 순서(index)가 불일치하면 버그 발생
- AI가 `figures[]`를 텍스트 구분자 순서와 다른 순서로 생성할 가능성 있음

**취약점 2 — 같은 텍스트 내 복수 구분자 파싱**

```
"{{fig:0}} ... {{fig:1}}"
```

정규식 `/\{\{fig:(\d+)\}\}/g`로 모두 매칭 가능하므로 파싱 자체는 어렵지 않다.
단, AI가 두 번째 구분자 `{{fig:1}}`를 텍스트 흐름 중 올바른 위치에 삽입하는 것이 어렵다.
5개 구분자가 섞인 텍스트를 AI가 정확히 생성할 확률은 낮다.

**취약점 3 — 블록 도형과 인라인 도형의 혼재**

블록 도형(`fig:2`)은 텍스트 안에 구분자가 없어야 하는데, 이를 `figures[]` 배열에서 어떻게 구분하는가?
- `figIndex`가 없는(구분자 없음) 도형은 블록으로, 있는 것은 인라인으로 처리 가능하지만 규칙이 복잡해진다.

**취약점 4 — 선택지 도형 인덱스 관리**

선택지 도형(`fig:3`, `fig:4`)이 `options` 배열 내에 구분자로 들어가면:
```json
{
  "options": ["① 1/2", "② {{fig:3}}", "③ {{fig:4}}", "④ 3"]
}
```
`options`를 파싱하는 별도 로직이 필요하고, `figures[]` 전체 인덱스와 `options[]` 인덱스가 충돌할 위험이 있다.
`{{fig:3}}`의 3은 `figures[3]`을 가리키는 것인지 `options[3]`을 가리키는 것인지 모호해진다.

#### 옵션 B (리치 블록 배열) — 복수 도형 수용에 가장 유리

```json
{
  "content": [
    { "type": "text",   "value": "그림 (가)와 같이" },
    { "type": "figure", "data": { "type": "polygon", ... } },
    { "type": "text",   "value": "변 AB 위의 점 D,\n그림 (나)와 같이" },
    { "type": "figure", "data": { "type": "circle", ... } },
    { "type": "text",   "value": "접선을 그을 때..." },
    { "type": "figure", "data": { "type": "composite", ... } },
    { "type": "options", "items": [
      { "type": "text",   "value": "① 1/2" },
      { "type": "text",   "value": "② " },
      { "type": "figure", "data": { "type": "number_line", ... } },
      { "type": "text",   "value": "③ " },
      { "type": "figure", "data": { "type": "graph", ... } },
      { "type": "text",   "value": "④ 3" }
    ]}
  ]
}
```

- 인덱스 없음 → 인덱스 불일치 버그 없음
- 블록/인라인/선택지 도형이 모두 동일한 구조로 표현됨
- **단점**: 마이그레이션 비용 L, AI가 이 복잡한 중첩 구조를 생성해야 함

#### 옵션 E (하이브리드) — 복수 도형 수용, 단 설계 세밀화 필요

옵션 E에서 5개 도형을 처리하는 방식:

```json
{
  "questionText": "그림 (가)와 같이 {{fig:inline-0}} 변 AB 위의 점 D,\n그림 (나)와 같이 {{fig:inline-1}} 접선을 그을 때...",
  "figures": [
    { "id": "inline-0", "type": "polygon",   "placement": "inline" },
    { "id": "inline-1", "type": "circle",    "placement": "inline" },
    { "id": "block-0",  "type": "composite", "placement": "block_after" },
    { "id": "option-1", "type": "number_line","placement": "option", "optionIndex": 1 },
    { "id": "option-2", "type": "graph",     "placement": "option", "optionIndex": 2 }
  ]
}
```

**핵심 개선: 정수 인덱스 대신 문자열 ID 사용**

- `{{fig:0}}`, `{{fig:1}}` 대신 `{{fig:inline-0}}`, `{{fig:inline-1}}` 또는 UUID 사용
- `figures[]` 배열 순서가 바뀌어도 `id` 매핑으로 정확히 연결
- 블록 도형(`block_after`)은 텍스트에 구분자 없음 → 혼재 문제 없음
- 선택지 도형은 `optionIndex`로 `options[]`와 독립적으로 관리

**복수 인라인 구분자 파싱 안정성**

```typescript
// 정규식: {{fig:xxx}} 패턴 (xxx = 영숫자와 하이픈)
const INLINE_FIG_PATTERN = /\{\{fig:([a-z0-9-]+)\}\}/g

// 파싱 결과: 토큰 배열
[
  { type: 'text', value: '그림 (가)와 같이 ' },
  { type: 'figRef', id: 'inline-0' },
  { type: 'text', value: ' 변 AB 위의 점 D,\n그림 (나)와 같이 ' },
  { type: 'figRef', id: 'inline-1' },
  { type: 'text', value: ' 접선을 그을 때...' },
]
```

여러 구분자가 섞여 있어도 정규식 `/g` 플래그로 전체 탐색. 파싱 복잡도는 선형(O(n)).

**AI 생성 시 복수 인라인 도형의 현실적 위험**

2개 이상의 인라인 구분자를 AI가 정확히 생성하는 것은 여전히 불안정하다. 5개 도형이 있는 문제에서 AI가 `{{fig:inline-0}}`과 `{{fig:inline-1}}`을 올바른 위치에 삽입하면서 동시에 `figures[]` 배열의 `id`와 일치시키는 것은 오류 가능성이 높다.

**권장 완화 전략 (Phase 2 적용)**:
1. 인라인 도형이 필요한 위치에서도 AI 프롬프트에 "블록 방식 우선" 지시
   - 예: "(가) 그림 [block_before]. 그림 (가)에서 삼각형 ABC의 변 AB 위의 점 D에 대하여..."
2. 인라인 구분자는 선생님이 직접 편집 UI에서 삽입하도록 제한
3. Phase 2a~2b에서는 인라인 도형 미지원. 모든 도형을 블록 또는 선택지 도형으로만 처리.

### 복수 도형 인덱싱 방식 결론

| 방식 | 장점 | 단점 | 권장 여부 |
|------|------|------|----------|
| **정수 인덱스** (`fig:0`, `fig:1`) | 단순 | 배열 순서 의존, 삭제 시 재계산 | ❌ |
| **UUID** (`fig:abc-123`) | 충돌 없음, 삭제 안전 | AI 생성 시 UUID 생성 어색 | 인라인 지원 시 권장 |
| **의미 기반 ID** (`fig:inline-0`, `fig:option-1`) | 역할이 명확 | 약간 verbose | ✅ Phase 2c 인라인 지원 시 |
| **배열 내 `id` 필드 + placement 분리** | 블록은 인덱스 불필요 | 다소 복잡 | ✅ 옵션 E 핵심 설계 |

---

## 기준별 옵션 비교표

| 기준 | A (구분자) | B (블록 배열) | C (마크다운) | D (HTML/JSX) | E (하이브리드) |
|------|----------|------------|------------|------------|-------------|
| **LaTeX 파서 통합** | ✅ 파서에 규칙 추가 | ⚠️ 별도 렌더러 필요 | ❌ 마크다운+LaTeX 충돌 | ❌ 실행 불가 | ✅ 파서에 규칙 추가 |
| **DB 스키마 호환** | ✅ 변경 없음 | ❌ 완전 재설계 | ✅ 변경 없음 | ✅ 변경 없음 | ✅ figures에 placement만 추가 |
| **AI 생성 안정성** | ⚠️ 구분자 위치 불안정 | ⚠️ 블록 구조 생성 가능 | ⚠️ verbose | ❌ 매우 낮음 | ✅ 블록은 위치 생성 불필요 |
| **렌더링 복잡도** | 중간 (파서 필요) | 낮음 (순회) | 높음 (의존성 추가) | 매우 높음 | 중간 (블록=간단, 인라인=파서) |
| **선택지 도형 처리** | ❌ options 별도 처리 | ✅ 배열에 figure 블록 추가 | ❌ 별도 처리 필요 | ❌ 별도 처리 필요 | ✅ figures에 optionIndex 추가 |
| **복수 도형 (5개+)** | ⚠️ 인덱스 불일치 위험 | ✅ 배열 순서로 자연스럽게 지원 | ⚠️ 인덱스 불일치 위험 | ❌ | ✅ ID 기반으로 안전하게 지원 |
| **편집 UX** | ⚠️ 구분자 직접 편집 위험 | ✅ 블록 단위 편집 | ⚠️ 구분자 직접 편집 | ❌ 불가 | ✅ 블록=간단, 인라인=주의 필요 |
| **하위 호환성** | ✅ 구분자 없으면 무시 | ❌ 기존 데이터 마이그레이션 | ✅ | ✅ | ✅ placement 없으면 기본값 사용 |
| **전환 비용** | S | L | S | S | S~M |

---

## AI 생성 안정성 심층 분석

### 블록 도형 (유형 1) — AI 부담 최소

옵션 E에서 블록 도형은 AI가 텍스트 위치에 구분자를 삽입하지 않아도 된다:

```json
{
  "content": "다음 함수의 그래프를 보고 물음에 답하시오.",
  "figures": [
    {
      "type": "coordinate_plane",
      "placement": "block_before",
      "xRange": [-3, 3],
      "yRange": [-2, 4]
    }
  ]
}
```

AI는 단순히 `placement: "block_before"` 값을 지정하면 된다. **Gemini Structured Output의 열거형(enum) 필드**로 강제할 수 있어 오류 위험이 낮다.

### 인라인 도형 (유형 2) — AI 부담 높음

텍스트 내 정확한 위치에 `{{fig:0}}`를 삽입하는 것은 AI에게 어렵다. 완화 전략:

1. **프롬프트 전략**: 인라인 도형 대신 "문장 뒤에 별도 블록으로 배치"를 기본 정책으로 설정
   - 예: "원 O 위의 점 A에서의 접선이 직선 l과 만나는 점을 B라 할 때 [블록 도형]..."으로 재구성
2. **후처리 fallback**: AI가 `placement: "inline"`을 지정해도 `{{fig:0}}`가 텍스트에 없으면 `placement: "block_after"`로 자동 강등
3. **Phase 2 초기**: 인라인 도형 지원 비활성화, 모든 도형을 블록 처리

### 선택지 도형 (유형 3) — 중간 부담

AI가 `options[]` 대신 `figures[].optionIndex`로 선택지 도형을 표현하면:

```json
{
  "content": "다음 중 y = x²의 그래프로 옳은 것은?",
  "options": ["①", "②", "③", "④"],
  "figures": [
    { "type": "parabola", "placement": "option", "optionIndex": 0, ... },
    { "type": "parabola", "placement": "option", "optionIndex": 1, ... },
    { "type": "parabola", "placement": "option", "optionIndex": 2, ... },
    { "type": "parabola", "placement": "option", "optionIndex": 3, ... }
  ]
}
```

`options`는 번호 기호만 남기고 도형은 `figures`로 분리. Structured Output으로 안정적 생성 가능.

---

## DB 스키마 전환 비용 분석

### 현재 COMPASS 구조

```sql
-- past_exam_details: figures JSONB 이미 존재
figures JSONB  -- FigureInfo[] (description, boundingBox, url, ...)

-- questions: 도형 컬럼 없음
question_text TEXT
options JSONB  -- string[]
```

### 옵션 E 적용 시 변경 범위

**`past_exam_details` 테이블**: 변경 없음
- 기존 `figures JSONB` 컬럼에 `placement` 필드 추가는 스키마 변경 없이 JSON 내부 필드 추가로 처리

**`questions` 테이블**: 최소 변경 (권장)
```sql
ALTER TABLE questions
  ADD COLUMN has_figure BOOLEAN DEFAULT false,
  ADD COLUMN figures JSONB;  -- FigureData[] with placement
```
- `question_text` 컬럼 유지 (블록 도형은 구분자 불필요)
- `options` 컬럼 유지 (선택지 도형은 figures[].optionIndex로 처리)

**TypeScript 타입 변경** (`src/lib/ai/types.ts`):
- `FigureInfo`에 `placement` 필드 추가
- `GeneratedQuestion`에 `figures` 배열 추가
- `options` 타입은 여전히 `string[]` 유지

---

## 렌더링 구현 복잡도

### 블록 도형 렌더러 (낮음)

```tsx
// src/components/question-renderer.tsx
function QuestionRenderer({ question }: { question: QuestionWithFigures }) {
  const blockBefore = question.figures?.filter(f => f.placement === 'block_before') ?? []
  const blockAfter = question.figures?.filter(f => f.placement === 'block_after') ?? []

  return (
    <div>
      {blockBefore.map((fig, i) => <FigureRenderer key={i} figure={fig} />)}
      <MathText text={question.questionText} figures={question.figures} />
      {blockAfter.map((fig, i) => <FigureRenderer key={i} figure={fig} />)}
    </div>
  )
}
```

단순 배열 필터링 + 순서 렌더링. 파서 불필요.

### 인라인 도형 파서 (중간)

`{{fig:N}}` 파싱은 단순 정규식으로 가능:

```typescript
// LaTeX 파서 확장 (기존 $...$ 토크나이저와 통합)
function parseContent(text: string): ContentToken[] {
  // 정규식: LaTeX($...$) + 구분자({{fig:N}}) 동시 처리
  const pattern = /(\$[^$]+\$|\{\{fig:(\d+)\}\})/g
  // ...
}
```

기존 LaTeX 파서(`$...$`)와 동일한 정규식 기반 토크나이저에 패턴 하나 추가. 구현 난이도 낮음.

### 선택지 도형 렌더러 (낮음)

```tsx
function OptionsRenderer({ options, figures }: { options: string[]; figures?: FigureData[] }) {
  return options.map((opt, i) => {
    const optFigure = figures?.find(f => f.placement === 'option' && f.optionIndex === i)
    return optFigure ? <FigureRenderer figure={optFigure} /> : <span>{opt}</span>
  })
}
```

인덱스 매핑이므로 로직이 단순하다.

---

## 편집 UX 고려

### 선생님이 도형 위치를 수정하는 시나리오

**블록 도형**: 드롭다운(`block_before` / `block_after`)으로 위치 변경 → 간단한 select UI
**인라인 도형**: 텍스트 에디터 내 `{{fig:0}}` 직접 편집 → 잘못 삭제하면 도형 사라짐 → 경고 필요
**선택지 도형**: `optionIndex` 숫자 필드 수정 → 간단한 number input

### 편집 UX 위험 요소

- 인라인 구분자(`{{fig:0}}`)를 선생님이 실수로 삭제: 렌더링 시 도형 누락 → fallback 필요
  - 권장: 편집 UI에서 `placement: 'inline'` 도형은 "도형 이동" 버튼으로만 위치 변경 가능하도록 제한
- 구분자 인덱스 불일치 (도형 삭제 후 인덱스 재계산 누락): 잘못된 도형 표시
  - 권장: 도형 삭제 시 텍스트 내 구분자도 동시 제거하는 트랜잭션 처리

---

## 하위 호환성 분석

| 상황 | 옵션 E 처리 방식 |
|------|--------------|
| `figures === null` (기존 문제) | 렌더러가 null 체크 후 텍스트만 렌더링 |
| `placement` 필드 없는 기존 figures | `placement` 없으면 `block_before` 기본값으로 처리 |
| `options: string[]` 선택지에 도형 없음 | `figures`에 `optionIndex`가 없으면 텍스트 그대로 렌더링 |
| 인라인 구분자 없는 텍스트 | 파서가 매칭 없으면 텍스트 전체를 단일 토큰으로 반환 |

기존 데이터 마이그레이션 불필요. 새 코드가 null/undefined 처리를 포함하면 된다.

---

## 유사 서비스 패턴과의 비교

| 서비스 | 방식 | COMPASS 적용 가능성 |
|--------|-----|------------------|
| **Notion** | Block 배열 (paragraph/image 별도 블록) | 옵션 B와 유사. 완전 재설계 필요. |
| **Google Docs** | 인라인 이미지 + 블록 이미지 혼용 | 옵션 E와 가장 유사한 모델 |
| **Quill (Delta)** | `ops` 배열 (`insert: {image: url}`) | 옵션 B와 유사. 마이그레이션 비용 높음. |
| **ProseMirror** | Node 트리 (`paragraph > text | image`) | 완전 재설계. WYSIWYG 에디터 구현 포함. |
| **Khan Academy** | `{{figure}}` 구분자 + 별도 figures 객체 | 옵션 A/E와 동일한 패턴. |

**주목**: Khan Academy가 `{{figure}}` 구분자 방식을 사용한다. 수학 교육 플랫폼에서 검증된 패턴이다.

---

## 추천: 옵션 E (하이브리드) — 단계별 적용 전략

### Phase 2a: 블록 도형만 지원 (우선순위 최고, 즉시 구현 가능)

변경 범위:
1. `FigureData` 타입에 `placement: 'block_before' | 'block_after' | 'inline' | 'option'` 필드 추가
2. `questions` 테이블에 `has_figure`, `figures` 컬럼 추가 (마이그레이션)
3. `QuestionRenderer` 컴포넌트: `block_before` → figure → text → `block_after` → figure 순서 렌더링
4. AI 프롬프트: `placement: "block_before"` 또는 `"block_after"` 출력 지시

**인라인 구분자 불필요**: 블록 도형은 텍스트와 도형이 명확히 분리되므로 파서 없이 구현 가능.

### Phase 2b: 선택지 도형 지원 (중간)

변경 범위:
1. `FigureData`에 `optionIndex?: number` 필드 추가 (스키마 변경 없음)
2. `OptionsRenderer` 컴포넌트: `optionIndex` 매핑 렌더링
3. AI 프롬프트: 선택지 도형 출력 지시

### Phase 2c: 인라인 도형 지원 (낮은 우선순위)

변경 범위:
1. LaTeX 파서에 `{{fig:N}}` 정규식 패턴 추가
2. `placement: "inline"` + `inlineIndex: N` 처리 렌더러
3. AI 프롬프트: 인라인 도형 지시 (단, 정확도 낮으므로 Phase 2a block 방식을 기본 정책으로 유지)

---

## 주요 리스크

### R1. 인라인 도형 AI 생성 불안정 [높음]
- 텍스트 내 정확한 위치에 `{{fig:0}}`를 삽입하는 것은 AI에게 어렵다
- **완화**: 블록 도형을 기본 정책으로, 인라인은 Phase 2c로 지연. AI 프롬프트에 "도형은 항상 블록으로 배치" 원칙 명시.

### R2. 선택지 도형 타입 전환 [중간]
- `options: string[]`를 유지하면서 `figures[].optionIndex`로 선택지 도형을 표현하는 방식이 직관적이지 않음
- **완화**: 렌더러 계층에서 투명하게 처리. 편집 UI에서 "이 선택지를 도형으로" 버튼으로 단순화.

### R3. 구분자-인덱스 불일치 [중간]
- 인라인 구분자 `{{fig:0}}`와 `figures[0]`의 인덱스가 맞지 않으면 렌더링 오류
- **완화**: Phase 2a~2b에서 인라인 지원 없음. 인라인 도입 시 인덱스 기반이 아닌 UUID 기반 참조(`{{fig:abc-def}}`)로 전환 검토.

### R4. 복수 도형 인덱스 불일치 [높음]
- 5개 도형이 있는 문제에서 정수 인덱스(`fig:0`~`fig:4`)를 사용하면 도형 삭제/추가 시 인덱스 재계산이 필요하고, AI가 인덱스를 잘못 지정할 가능성이 높다
- 선택지 도형(`fig:3`, `fig:4`)과 `options[]` 배열의 인덱스가 충돌하면 잘못된 도형이 표시될 수 있다
- **완화**: 정수 인덱스 대신 ID 기반 참조(`fig:inline-0`, `fig:option-1`) 사용. 블록 도형은 `placement` 필드로 관리하여 구분자 자체를 불필요하게 만든다.

### R5. 도형 위치 정보 손실 (기출 추출 경로) [낮음]
- 기출 추출에서 AI가 감지한 도형은 `boundingBox`로 위치 정보를 가지고 있음
- 이를 `placement` 필드로 자동 변환하는 로직이 필요 (boundingBox.y가 낮으면 block_before 등)
- **완화**: 기출 추출 경로에서 `placement`는 선생님이 수동으로 지정하거나, 기본값 `block_before` 사용

---

## 결론 요약

| 항목 | 내용 |
|------|------|
| **추천 옵션** | E (하이브리드) |
| **1순위 구현** | 블록 도형 (유형 1) — `placement: block_before/block_after` |
| **2순위 구현** | 선택지 도형 (유형 3) — `figures[].optionIndex` |
| **후순위** | 인라인 도형 (유형 2) — `{{fig:N}}` 파서 |
| **DB 변경** | `questions` 테이블에 `has_figure`, `figures` 컬럼 추가 (마이그레이션 1회) |
| **기존 코드 영향** | `questionText`, `options` 타입 변경 없음. `FigureData` 타입에 `placement` 필드만 추가 |
| **AI 생성 전략** | 블록 도형은 `placement` enum 지정만으로 충분 (구분자 생성 불필요) |
| **참고 선례** | Khan Academy: `{{figure}}` 구분자 패턴 사용 (동일 도메인 검증된 패턴) |

---

## 참고 자료

- [Khan Academy Exercise Framework — Figure Rendering](https://github.com/Khan/perseus)
- [Notion Block Model](https://developers.notion.com/reference/block)
- [ProseMirror Guide — Document Structure](https://prosemirror.net/docs/guide/#doc)
- [Quill Delta Format](https://quilljs.com/docs/delta/)
- 선행 리서치: `docs/research/tech/math-figures.md`
- 선행 리서치: `docs/research/feasibility/math-figures.md`
- 선행 리서치: `docs/research/math-figures-recommendation.md`
