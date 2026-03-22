# 도형 텍스트 중간 산재 패턴 — `{{fig:N}}` 통일 방식 실현 가능성 분석

> **작성일**: 2026-03-22
> **작성자**: feasibility-analyst
> **목적**: `placement: block_before/block_after` 방식의 한계를 분석하고, `{{fig:N}}` 통일 방식으로 전환 시 코드 영향을 평가
> **선행 문서**:
> - `docs/research/figure-placement-recommendation.md`
> - `docs/research/feasibility/figure-placement.md`
> - `docs/plan/latex-rendering.md`

---

## 요약

`placement: block_before/block_after` 방식은 **텍스트 중간에 도형이 산재하는 실제 시험 패턴을 처리하지 못한다**. 예를 들어 아래 패턴에서:

```
문제 텍스트 서론~~~
[도형1]
문제 텍스트 이어서~~~
[도형2][도형3]  ← 연속 도형
문제 텍스트 계속~~~
[도형4]
[도형5]
문제 텍스트 결론~~~
```

`block_before`는 "모든 도형을 텍스트 앞에" 배치하므로 도형1~5를 서론 앞에 몰아넣게 된다. 이는 원본 레이아웃과 완전히 다른 독해 흐름을 만들어 학생에게 혼란을 준다.

**핵심 결론**: 모든 도형에 `{{fig:N}}` 구분자를 쓰는 통일 방식으로 전환하는 것이 올바르다. 기존 LaTeX PLAN(`docs/plan/latex-rendering.md`)의 파서 설계와 호환되며, 변경 범위는 **제한적**이다. 단, AI 프롬프트와 파서 설계에 구체적인 수정이 필요하다.

---

## 1. `placement: block_before/block_after` 방식의 한계

### 1-1. 처리 불가 시나리오

현재 `docs/research/figure-placement-recommendation.md`의 추천안(라인 10):

> 핵심 원칙: **블록 도형은 구분자 없이 `placement` 필드로, 인라인/선택지 도형은 `{{fig:N}}` 구분자로**

이 원칙의 전제는 블록 도형이 "항상 텍스트 전체의 앞 또는 뒤에만 위치한다"는 것이다. 그러나 실제 한국 수학 시험에서는 다음 패턴이 빈번하다:

**패턴 1 — 도형 중간 삽입**:
```
삼각형 ABC에서 변 AB 위의 점 D를 다음과 같이 잡는다.
[도형: 삼각형 ABC + 점 D 표시]
위 그림에서 AD = 3, DB = 2일 때, ∠ACD의 값을 구하시오.
```
→ `block_before`로는 도형을 "삼각형 ABC에서..." 앞에 배치 → **"위 그림에서"가 가리키는 그림이 없어 보이는 문제 발생**

**패턴 2 — 연속 도형 나란히**:
```
아래 그림 (가)와 (나)에서
[도형(가)]  [도형(나)]
...
```
→ `block_before`로는 두 도형이 연속 세로 배치되고 "(가)", "(나)" 라벨과 불일치 가능

**패턴 3 — 도형 후 추가 텍스트**:
```
[좌표평면 그래프]
위 그래프에서 x > 0인 영역의 넓이를
[수식 블록]
을 이용하여 구하시오.
```
→ `block_before/after` 중 어느 것도 "그래프 아래 수식 위" 위치를 표현하지 못함

### 1-2. 구조적 한계 원인

`docs/research/figure-placement-recommendation.md` 라인 149에 이미 주석이 있다:

```html
<!– NOTE: 도형이나 그래프는 문제 사이사이에 나올수 있다. 이 부분은 고려된거야?–>
```

이 주석은 현재 추천안이 이 케이스를 **미해결로 남겨두었음**을 명시한다. `placement: block_before/block_after`는 단일 도형이 텍스트 전체의 상단/하단에 위치하는 가장 단순한 케이스만 처리 가능하다.

---

## 2. `{{fig:N}}` 통일 방식 — LaTeX 파서 영향 분석

### 2-1. 현재 파서 설계 (`docs/plan/latex-rendering.md` Task 2, 라인 113-143)

```typescript
type LatexSegment =
  | { type: 'text'; content: string }
  | { type: 'inline'; content: string }  // $...$
  | { type: 'block'; content: string }   // $$...$$
```

파싱 우선순위 (라인 133):
1. `$$...$$` 블록 수식
2. `$...$` 인라인 수식
3. 나머지 텍스트

`docs/research/feasibility/figure-placement.md` 라인 117-127은 이미 4번째 세그먼트 타입 추가를 제안했다:

```typescript
| { type: 'figure'; index: number }  // {{fig:N}}
```

### 2-2. `{{fig:N}}` 파싱 시 정규식 설계

`{{fig:N}}` 패턴의 정규식:

```typescript
// 정규식: {{fig:\d+}} — 중괄호 2겹 + fig: + 숫자
const FIG_PATTERN = /\{\{fig:(\d+)\}\}/g
```

**연속 구분자 `{{fig:1}}{{fig:2}}` 분리 가능성 검증**:

```
입력: "{{fig:1}}{{fig:2}}"
정규식 /\{\{fig:(\d+)\}\}/g 매칭:
  - 매칭 1: "{{fig:1}}", 그룹(1) = "1", 시작 위치 0, 끝 10
  - 매칭 2: "{{fig:2}}", 그룹(1) = "2", 시작 위치 10, 끝 20
```

두 매칭 사이에 텍스트 없음(시작=이전 끝) → 빈 `text` 세그먼트 삽입 스킵 → **`[figure(1), figure(2)]` 정확히 분리됨**.

**결론**: 연속 구분자는 정규식이 올바르게 두 개를 분리한다. 빈 문자열 세그먼트 처리 로직(`content.length > 0`으로 필터링)만 추가하면 된다.

### 2-3. 파서 우선순위 설계 수정 필요성

`{{fig:N}}`을 추가할 때 우선순위 배치가 중요하다. `$`와 `{`의 충돌 가능성:

- LaTeX에서 `\frac{1}{2}`는 `{`, `}`를 포함하나, `{{`(이중 중괄호)는 표준 LaTeX에서 사용하지 않음
- KaTeX에서 `\{\{`는 이중 중괄호 문자를 출력하는 명령어이나, 실제 수식에서 `{{fig:N}}` 패턴과 혼동될 가능성은 낮음

**권장 파싱 우선순위**:
1. `$$...$$` 블록 수식 (가장 긴 매칭 우선)
2. `{{fig:N}}` 도형 구분자 (수식 파싱 전에 처리 — `$`와 충돌 없음)
3. `$...$` 인라인 수식
4. 나머지 텍스트

이 순서는 `docs/research/feasibility/figure-placement.md` 라인 195-200에서 제안한 것과 동일하다.

### 2-4. 기존 LaTeX PLAN 파서 수정 필요 여부

`docs/plan/latex-rendering.md` Task 2(라인 113-143)의 세그먼트 타입 정의에 **`figure` 타입 1개 추가**만 필요하다. 기존 테스트 케이스 13개(라인 254-266)는 영향을 받지 않는다.

**Task 2 수정 범위** (`src/lib/utils/latex-parser.ts` 신규 파일):
- 세그먼트 타입 union에 `{ type: 'figure'; index: number }` 추가: +1줄
- FIG_PATTERN 정규식 상수 추가: +1줄
- 파싱 루프에서 `{{fig:N}}` 처리 케이스 추가: +5줄
- 빈 세그먼트 필터링 로직: +1줄

**총 변경: +8줄** (기존 PLAN에서 "+5줄"로 추정했으나 실제로는 약간 더 많음, 여전히 XS 수준)

---

## 3. `placement` 필드 — 위치 지정에서 렌더링 힌트로 재정의

### 3-1. `placement`가 중복 정보가 되는 이유

`{{fig:N}}` 통일 방식에서는:
- **도형의 위치**: `questionText`/`options[i]` 문자열 안에서 `{{fig:N}}`의 위치가 완전히 결정
- **`placement: block_before`**: 이 정보가 있어도 실제 렌더링 위치는 `{{fig:N}}`이 결정 → 무시됨

따라서 `placement`의 "위치 지정" 역할은 완전히 제거된다.

### 3-2. `placement`를 렌더링 크기 힌트로 재정의하는 타당성

| `placement` 값 | 현재 의미 | 재정의 의미 |
|--------------|---------|-----------|
| `block_before` | 텍스트 앞 블록 배치 | → **삭제** (위치는 `{{fig:N}}`이 결정) |
| `block_after` | 텍스트 뒤 블록 배치 | → **삭제** |
| `inline` | 텍스트 흐름 내 인라인 | → `block: false` (작은 도형) |
| `option` | 선택지 안 배치 | → `block: false` (작은 도형) |

**재정의 제안**:

```typescript
interface FigureData {
  // ... 도형 데이터
  displaySize: 'large' | 'small'  // 렌더링 힌트
  description: string
}
```

또는 더 단순하게:

```typescript
interface FigureData {
  // ... 도형 데이터
  isLarge: boolean  // true = 블록 전체 너비, false = 인라인 크기
  description: string
}
```

### 3-3. 권장 결론

**`placement` 필드를 제거하고 `displaySize: 'large' | 'small'`로 대체**하는 것이 가장 명확하다.

- AI에게 enum 값 1개 선택(위치 결정)이 아닌 크기 힌트(large/small) 선택으로 부담 감소
- 렌더러에서 `displaySize === 'large'` → `width: 100%` 블록, `'small'` → `max-width: 300px` 제한
- `{{fig:N}}`이 줄 단독으로 나올 때도 `displaySize`로 크기 제어

---

## 4. AI 프롬프트 영향 분석

### 4-1. 추출 프롬프트 수정 범위

`src/lib/ai/prompts/question-extraction.ts` 23-43번 줄의 `EXTRACTION_SYSTEM_INSTRUCTION`:

**현재 규칙 4** (라인 31-36):
```
4. 그래프, 그림, 도형이 있는 경우:
   - bounding box 좌표를 normalized(0~1)로 반환하세요.
   - bounding box는 그림 전체를 넉넉히 포함해야 합니다. 여백을 약간 포함하세요.
   - x, y는 그림 영역의 좌상단 꼭짓점이고, width, height는 그림 영역의 전체 너비와 높이입니다.
   - 그래프/그림의 내용을 상세히 설명하세요.
   - hasFigure를 true로 설정하세요.
```

**추가 필요 내용 (약 +10줄)**:
```
   - 도형의 questionText 내 위치를 {{fig:N}} 구분자로 정확히 표시하세요.
     N은 figures 배열의 0-based 인덱스입니다.
   - 예: "삼각형 ABC를 보면\n{{fig:0}}\n위 그림에서 AD = 3일 때..."
   - 연속 도형: "{{fig:0}}{{fig:1}}" (같은 줄 나란히)
   - 세로 배치 도형: "{{fig:0}}\n{{fig:1}}" (줄바꿈으로 분리)
   - 도형이 선택지 안에 있으면 options[i]에 "{{fig:N}}" 삽입
   - figures 배열 순서와 {{fig:N}} 인덱스가 반드시 일치해야 합니다.
   - displaySize는 큰 도형(좌표평면, 복잡한 그래프 등) → "large",
     작은 도형(기하학적 도형, 수직선 등) → "small"로 설정하세요.
```

**AI 부담 증가 평가**: 추출 AI(temperature=0.2)는 이미 bounding box 좌표를 정확하게 반환해야 하므로 정밀도가 요구된다. `{{fig:N}}` 삽입 위치 결정은 이미지를 보면서 텍스트 흐름을 파악하는 것으로, 시험지 이미지가 명확하면 어렵지 않다. **부담 증가는 중간(MEDIUM) 수준**으로, 명확한 예시를 포함하면 완화 가능하다.

### 4-2. 생성 프롬프트 영향

`src/lib/ai/prompts/question-generation.ts` 45-52번 줄의 `SYSTEM_INSTRUCTION`:

**현재 규칙 2** (라인 49):
```
2. 그래프나 그림이 필요한 문제는 텍스트로 상황을 설명하여 대체하세요.
```

생성 AI는 **의도적으로 도형 생성을 회피**하도록 설계되어 있다. 이 방침은 Phase 2 이후에도 유지하는 것이 적절하다. 이유:

- 생성 AI가 존재하지 않는 도형을 `{{fig:0}}`으로 참조해도 `figures[]`에 실제 데이터가 없으면 렌더링 불가
- 기출 기반 문제 생성(`pastExamContext`)도 기출 도형을 재사용하지 않고 텍스트 설명으로 대체하는 현재 방침이 안전함

**결론**: 생성 프롬프트는 **수정 불필요**. `{{fig:N}}` 통일 방식의 영향 범위 밖이다.

---

## 5. 연속 도형 렌더링 처리

### 5-1. 두 가지 연속 패턴 구분

| 패턴 | 데이터 표현 | 의미 |
|------|-----------|------|
| `{{fig:1}}{{fig:2}}` | 구분자가 연속 (줄바꿈 없음) | 가로 나란히 배치 |
| `{{fig:3}}\n{{fig:4}}` | 줄바꿈으로 분리 | 세로 순서 배치 |

### 5-2. 파서 레벨에서 구분 방법

`\n`은 `text` 세그먼트로 파싱된다. 따라서 렌더러가 세그먼트 배열을 순회할 때:

```typescript
// 세그먼트 배열 예시
[
  { type: 'figure', index: 1 },
  { type: 'figure', index: 2 },           // figure 직후 figure → 가로 배치
  { type: 'text', content: '\n' },
  { type: 'figure', index: 3 },
  { type: 'text', content: '\n' },
  { type: 'figure', index: 4 },           // text('\n') 사이 figure → 세로 배치
]
```

**렌더러에서 인접 figure 그룹화 로직**:

```typescript
// LatexRenderer에서 세그먼트를 "라인 단위"로 그룹화
// 연속 figure 세그먼트들 → <div className="flex flex-row gap-2"> 래핑
// 줄바꿈 text 세그먼트 → 그룹 분리 신호
```

### 5-3. CSS 처리 방안

**가로 나란히** (`{{fig:1}}{{fig:2}}`):
```tsx
<div className="flex flex-row gap-4 my-2">
  <FigureRenderer figure={figures[1]} />
  <FigureRenderer figure={figures[2]} />
</div>
```

**세로 배치** (`{{fig:3}}\n{{fig:4}}`):
```tsx
<FigureRenderer figure={figures[3]} className="my-2" />
{/* \n → 줄바꿈 처리 (기존 text 세그먼트와 동일) */}
<FigureRenderer figure={figures[4]} className="my-2" />
```

**`displaySize` 연동**:
- `displaySize === 'large'` → `width: 100%`, `max-height: 400px`
- `displaySize === 'small'` → `max-width: 280px`, inline flex

### 5-4. 구현 난이도 평가

파서 레벨 변경: **XS** (세그먼트 타입 추가만)
렌더러 레벨 변경: **S** (인접 figure 그룹화 로직 추가, 약 20-30줄)

가장 복잡한 케이스는 "연속 figure 사이에 공백 텍스트만 있는 경우"(`{{fig:1}} {{fig:2}}`) 처리이나, 공백 text 세그먼트를 무시하거나 연속 figure로 처리하는 단순 규칙으로 충분하다.

---

## 6. `figure-placement-recommendation.md` 수정 필요 사항

### 6-1. 수정이 필요한 항목

`docs/research/figure-placement-recommendation.md` 기준:

| 항목 | 현재 내용 | 수정 필요 여부 |
|------|---------|-------------|
| 핵심 원칙 (라인 10) | "블록 도형은 구분자 없이 placement 필드로" | **수정 필요**: "모든 도형은 {{fig:N}} 구분자로" |
| FigureData 인터페이스 (라인 17-27) | `placement: 'block_before' \| 'block_after' \| 'inline' \| 'option'` | **수정 필요**: `displaySize: 'large' \| 'small'`로 대체 |
| 블록 도형 예시 (라인 29-39) | 구분자 없이 `placement: block_before` 사용 | **수정 필요**: `questionText`에 `{{fig:0}}` 삽입 |
| 단계적 도입 (라인 130-138) | Phase 2a = 블록 도형(구분자 없음) | **수정 필요**: 모든 Phase에서 `{{fig:N}}` 통일 |
| 비채택 이유 (라인 84-93) | "순수 A(구분자만)" 비채택 | **수정 필요**: 통일 방식이 올바름을 명시 |

### 6-2. 수정 후 추천안 요약

**변경 전**: 구분자(A) + placement 힌트(E) 합성 방식
**변경 후**: `{{fig:N}}` 구분자 통일 방식 + `displaySize` 렌더링 힌트

```typescript
// 수정 후 FigureData
interface FigureData {
  type: 'coordinate_plane' | 'polygon' | 'circle' | 'function_graph' | 'vector' | 'number_line'
  // ... 각 타입별 데이터

  displaySize: 'large' | 'small'  // 렌더링 크기 힌트 (위치는 {{fig:N}}이 결정)
  description: string
}

// 모든 케이스에서 questionText에 {{fig:N}} 삽입
{
  "questionText": "문제 텍스트 서론~~~\n{{fig:0}}\n문제 텍스트 이어서~~~\n{{fig:1}}{{fig:2}}\n문제 텍스트 계속~~~\n{{fig:3}}\n{{fig:4}}\n문제 텍스트 결론~~~",
  "figures": [
    { "displaySize": "large", "type": "coordinate_plane", ... },
    { "displaySize": "small", "type": "polygon", ... },
    { "displaySize": "small", "type": "circle", ... },
    { "displaySize": "large", "type": "function_graph", ... },
    { "displaySize": "small", "type": "number_line", ... }
  ]
}
```

---

## 7. 전체 코드 영향 정리

### 7-1. `{{fig:N}}` 통일 방식 전환 시 변경 범위

| 파일 | 현재 상태 | 변경 내용 | 작업량 |
|------|---------|---------|-------|
| `src/lib/utils/latex-parser.ts` (신규) | LaTeX PLAN Task 2에서 신규 생성 예정 | `figure` 세그먼트 타입 + FIG_PATTERN + 파싱 케이스 추가 | XS (+8줄) |
| `src/components/ui/latex-renderer.tsx` (신규) | LaTeX PLAN Task 3에서 신규 생성 예정 | `type === 'figure'` 분기 + 인접 figure 그룹화 로직 | S (+30줄) |
| `src/lib/ai/prompts/question-extraction.ts` | 기존 파일 (라인 31-36) | 규칙 4항 `{{fig:N}}` 위치 지시 + `displaySize` 지시 추가 | S (+10줄) |
| `docs/research/figure-placement-recommendation.md` | 기존 리서치 문서 | `placement` → `displaySize` 재정의, 핵심 원칙 수정 | S |

**DB 스키마**: `figures JSONB` 컬럼은 자유 스키마이므로 `placement` → `displaySize` 필드명 변경은 **마이그레이션 불필요**. 기존 데이터는 `displaySize` 필드가 없으면 렌더러에서 `'large'` 기본값 사용.

**기존 타입 파일 변경**: `src/lib/ai/types.ts`의 `FigureInfo` 인터페이스(라인 추정) 수정 필요. 단, `FigureInfo`는 AI 추출 스키마 전용이며 현재 `placement` 필드가 없을 가능성이 높다.

### 7-2. 변경 불필요 항목

| 항목 | 이유 |
|------|------|
| `questionText: string` 타입 | `{{fig:N}}`은 문자열 안에 포함 → 타입 변경 없음 |
| `options: string[]` 타입 | `{{fig:N}}`은 문자열 안에 포함 → 타입 변경 없음 |
| DB `question_text TEXT` 컬럼 | 문자열 유지 |
| DB `options JSONB` 컬럼 | string[] 유지 |
| `extraction-validation.ts` (라인 34-43) | `questionText: z.string()` 유지 |
| `validation.ts` (라인 21-28) | `content: z.string()` 유지 |
| `EditMode` (라인 199-315 `question-card.tsx`) | raw 문자열 편집 → `{{fig:0}}`이 텍스트로 보임, 변경 불필요 |
| 생성 프롬프트 (`question-generation.ts`) | 도형 회피 방침 유지 |

---

## 8. 리스크 평가

### R1. AI 구분자 삽입 정확도 (HIGH)

AI(temperature=0.2)가 `{{fig:N}}`을 정확한 텍스트 위치에 삽입해야 한다. 도형이 많을수록(5개 이상) 인덱스 불일치 위험이 있다.

**완화**:
- 프롬프트에 구체적 예시 3개 이상 포함 (단독/연속/선택지)
- 추출 결과에서 Zod 교차 검증: `{{fig:N}}` 인덱스 범위 확인
- 기존 선생님 검수 단계 유지 (기출 편집 페이지)

### R2. 인접 figure 그룹화 엣지 케이스 (MEDIUM)

렌더러에서 `{{fig:1}} {{fig:2}}`(공백 text 사이)와 `{{fig:1}}{{fig:2}}`(직접 연속)를 동일하게 처리할지 결정이 필요하다.

**완화**: 공백만 있는 text 세그먼트는 figure 그룹화 시 무시하는 규칙 적용

### R3. 기존 데이터 `placement` 필드 하위 호환 (LOW)

현재 DB에 저장된 `figures JSONB`에 `placement` 필드가 있을 수 있다. `displaySize`로 필드명 변경 후 기존 데이터는 렌더러에서 `undefined`를 받게 된다.

**완화**: `displaySize ?? figure.placement === 'inline' ? 'small' : 'large'` 폴백 로직 추가. 또는 `displaySize: 'large'`를 기본값으로 처리.

### R4. `{{fig:N}}`이 텍스트 안에 노출되는 EditMode UX (LOW)

현재 `docs/research/feasibility/figure-placement.md` 라인 366-370에서 이미 분석됨. EditMode Textarea에서 `{{fig:0}}`이 raw 문자열로 보인다.

**완화**: Textarea 상단 안내 문구 "도형 위치는 {{fig:N}}으로 표시됩니다" 추가 (이미 이전 분석에서 권장됨)

---

## 9. 결론 및 권장 사항

### 9-1. 통일 방식 채택 권장

`placement: block_before/block_after` 방식을 **폐기**하고 `{{fig:N}}` 통일 방식으로 전환한다.

이유:
1. 텍스트 중간 도형 산재 패턴 처리 불가 → 실제 한국 수학 시험에서 빈번
2. `{{fig:N}}`만으로 모든 위치 표현 가능 → `placement`는 중복 정보
3. LaTeX PLAN 파서와 동일 확장 방식 → DRY
4. 기존 타입/DB 변경 없음 → 도입 비용 낮음

### 9-2. `placement` → `displaySize` 재정의 권장

| 항목 | 결론 |
|------|------|
| `placement` 필드 제거 | 권장 |
| `displaySize: 'large' \| 'small'` 도입 | 권장 |
| AI에게 크기 힌트 판단 요청 | 가능 (큰 좌표평면 vs 작은 기하 도형 구분 어렵지 않음) |

### 9-3. 구현 순서 권장

```
LaTeX PLAN Task 2 구현 시:
  → {{fig:N}} 세그먼트 타입 처음부터 포함 (XS, 이미 figure-placement.md에서 설계됨)

LaTeX PLAN Task 3 구현 시:
  → 인접 figure 그룹화 로직 포함 (S, +30줄)
  → displaySize에 따른 크기 처리 포함

도형 추출 기능 구현 전:
  → question-extraction.ts 규칙 4항 수정 (+10줄)
  → FigureData 타입에 displaySize 추가 (placement 제거)
```

### 9-4. `figure-placement-recommendation.md` 수정 권장

현재 추천안(`docs/research/figure-placement-recommendation.md`)의 핵심 원칙과 데이터 구조, 단계적 도입 계획을 위 내용에 따라 수정해야 한다. 특히 라인 10의 "블록 도형은 구분자 없이" 원칙과 라인 24의 `placement` 필드 정의를 우선 수정한다.

---

## 참조 파일 목록

- `/Users/yiback10/devlop/compass/docs/research/figure-placement-recommendation.md` (라인 10, 17-27, 84-138, 149)
- `/Users/yiback10/devlop/compass/docs/research/feasibility/figure-placement.md` (라인 117-127, 195-200, 338-358, 366-370)
- `/Users/yiback10/devlop/compass/docs/plan/latex-rendering.md` (Task 2 라인 113-143, Task 3 라인 145-164, Task 8 라인 254-266)
- `/Users/yiback10/devlop/compass/src/lib/ai/prompts/question-extraction.ts` (라인 31-43: 규칙 4항)
- `/Users/yiback10/devlop/compass/src/lib/ai/prompts/question-generation.ts` (라인 45-52: 도형 회피 방침)
