# 수학 도형/그래프 실현 가능성 분석

작성일: 2026-03-22
분석자: feasibility-analyst

---

## 요약

수학 시험 문제에 포함되는 그래프·도형 렌더링 기능의 도입 가능성을 평가한다.

**핵심 결론:**
- 기출문제 추출 경로(`past_exam_details.figures`)는 이미 인프라가 갖춰져 있으며, 도형 **텍스트 설명(description)**은 현재도 저장·표시된다.
- 도형 **시각적 렌더링**은 아직 구현되지 않았으며, 기출 추출용과 AI 신규 생성용 두 경로를 각각 접근해야 한다.
- 전체 데이터 흐름(AI → DB → UI)에 걸쳐 변경이 필요하나, 기존 코드가 이미 확장 지점을 예비해 두었기 때문에 단계적 도입이 가능하다.
- 총 작업량은 **L(약 1주)** 수준이다.

---

## 현재 도형 관련 코드 현황

### 1. DB 스키마 (`past_exam_details` 테이블)

파일: `supabase/migrations/20260315_past_exam_restructure.sql` (50~71번 줄)

```sql
has_figure BOOLEAN DEFAULT false,   -- 그래프/그림 포함 여부 플래그
figures    JSONB,                    -- FigureInfo[] 배열 (crop 후 url + description + boundingBox)
```

`figures` JSONB 컬럼에 저장되는 구조(`FigureInfo` 타입, `src/lib/ai/types.ts` 114~125번 줄):
```typescript
{
  url: string | null,      // Storage 경로 (crop 이미지), crop 제거 후 항상 null
  description: string,     // AI가 생성한 자연어 설명
  boundingBox: { x, y, width, height },  // normalized 0~1
  pageNumber: number,
  confidence: number
}
```

`questions` 테이블(`supabase/migrations/00001_initial_schema.sql` 151~183번 줄)에는 도형 관련 컬럼이 **전혀 없다**. AI 생성 문제는 도형 정보를 저장할 위치가 없다.

### 2. AI 추출 프롬프트 (`question-extraction.ts`)

파일: `src/lib/ai/prompts/question-extraction.ts` (23~43번 줄)

- 시스템 인스트럭션 규칙 4항: bounding box(normalized) 반환, 내용 설명, `hasFigure = true` 설정 지시
- `extractionJsonSchema`에 `figures` 배열 포함 (`figureInfoSchema`)
- Gemini는 현재도 도형을 감지하면 `description + boundingBox + pageNumber + confidence`를 반환한다

### 3. AI 생성 프롬프트 (`question-generation.ts`, `past-exam-generation.ts`)

파일: `src/lib/ai/prompts/question-generation.ts` (45~52번 줄)
파일: `src/lib/ai/prompts/past-exam-generation.ts` (39~48번 줄)

두 파일 모두 시스템 인스트럭션 규칙 2항:
> "그래프나 그림이 필요한 문제는 텍스트로 상황을 설명하여 대체하세요."

즉, **현재 AI 문제 생성은 도형을 의도적으로 회피**하도록 설계되어 있다.
`generatedQuestionSchema` (`src/lib/ai/validation.ts` 21~28번 줄)에도 `figures` 필드가 없다.

### 4. UI 렌더링 포인트

**기출 추출 편집 페이지** (`src/app/(dashboard)/past-exams/[id]/edit/question-card.tsx` 114~147번 줄):
- `FigurePreview` 컴포넌트: `description`이 있는 figure만 `<p>` 텍스트로 표시
- `url` 필드가 있어도 `<img>`로 렌더링하는 코드 없음 — **이미지 표시 구현 미완**
- 편집 모드에서 "그래프/그림은 편집할 수 없습니다" 안내만 표시

**질문 상세 Sheet** (`src/app/(dashboard)/questions/_components/question-detail-sheet.tsx`):
- `questions` 테이블 기반으로 동작하며 도형 관련 필드 표시 없음

**AI 문제 생성 다이얼로그** (`src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx`):
- `GeneratedQuestion` 타입에 도형 필드 없음, 도형 표시 UI 없음

### 5. crop 제거 이후 상태

HANDOFF.md 및 `extraction-validation.ts` 100번 줄 주석에 따르면:
```typescript
url: null, // crop 전이므로 null — Step 5에서 채움
```
crop 기능이 제거되었으므로 `url`은 **항상 null**로 저장된다. `description`(텍스트 설명)만 실제로 활용 중이다.

---

## 데이터 흐름 분석

### 경로 A: 기출문제 추출 → 편집 → 표시

```
시험지 이미지 업로드
  ↓
[extractQuestionsAction] → Gemini extractQuestions()
  → AI 응답: figures[].{description, boundingBox, pageNumber, confidence}
  → url: null (crop 없음)
  ↓
past_exam_details.figures JSONB에 저장
  ↓
[edit/page.tsx] DB 조회 → figures 필드 포함하여 클라이언트 전달
  ↓
[question-card.tsx] FigurePreview → description만 텍스트로 표시
```

**갭**: boundingBox 정보가 DB에 있으나, 원본 이미지 위에 오버레이하거나 별도 렌더링하는 UI가 없다.

### 경로 B: AI 문제 생성 → 저장 → 표시

```
[generateQuestionsFromPastExam / generateQuestions]
  → Gemini: 도형을 텍스트 설명으로 대체 (현재 정책)
  → GeneratedQuestion: figures 필드 없음
  ↓
questions 테이블에 저장
  ↓
[question-detail-sheet.tsx] 도형 없음
```

**갭**: 생성 프롬프트가 도형을 회피하도록 설계되어 있으며, 저장 스키마에도 도형 컬럼이 없다.

---

## DB 스키마 변경 평가

### `past_exam_details` 테이블

현재 `figures JSONB` 컬럼이 이미 존재한다. 도형 시각화 방식에 따라 추가 컬럼이 필요할 수 있다.

| 도형 방식 | 스키마 변경 필요 | 비고 |
|---------|--------------|-----|
| 텍스트 설명만 표시 | 불필요 | 현재 구현됨 |
| bounding box 오버레이 | 불필요 | `figures.boundingBox` 이미 저장 중 |
| SVG 도형 저장 | `figure_svg TEXT` 컬럼 추가 | AI가 SVG 생성 시 |
| 별도 Storage 이미지 저장 | 불필요 (기존 `url` 필드 재활용) | crop 방식 복원 시 |

### `questions` 테이블

도형 지원을 추가하려면 새 컬럼이 필요하다:
```sql
has_figure BOOLEAN DEFAULT false,
figures    JSONB,   -- FigureInfo[] (description, svg, url 등)
```

**마이그레이션 비용**: 중간(M). `questions` 테이블은 광범위하게 사용되므로, 기존 코드(Server Actions, UI)와의 하위 호환성을 신중하게 검토해야 한다.

---

## 선택지(options) 내 도형 처리 방안

현재 `options`는 `string[]` 형태로 저장된다.

```sql
-- past_exam_details
options JSONB  -- 현재: ["보기1", "보기2", ...]

-- questions
options JSONB  -- 현재: ["보기1", "보기2", ...]
```

선택지에 도형이 포함되는 경우(예: "다음 그래프 중 옳은 것은?")를 지원하려면 구조 변경이 필요하다:

**방안 1: 혼합 배열 (추천)**
```json
[
  "① 텍스트 보기",
  { "type": "figure", "description": "y = x² 그래프", "svg": "<svg>...</svg>" }
]
```
- 기존 `string[]` 코드와 호환을 위해 런타임 타입 검사 필요
- DB 스키마 변경 없음, 타입스크립트 타입 변경 필요

**방안 2: 별도 컬럼 추가**
```sql
option_figures JSONB  -- { optionIndex: FigureInfo }
```
- 기존 `options` 컬럼 불변, 도형 정보 분리
- 렌더링 시 인덱스로 매핑

**방안 3: YAGNI — 현 시점 보류**
- 한국 중고등 수학 시험에서 선택지 도형은 상대적으로 드묾
- Phase 1에서는 문제 본문 도형만 지원하고, 선택지 도형은 후순위

---

## 변경 범위 평가

| 영역 | 파일 | 변경 내용 | 작업량 |
|-----|------|---------|-------|
| AI 추출 프롬프트 | `src/lib/ai/prompts/question-extraction.ts` | 변경 없음 (이미 figures 지원) | — |
| AI 생성 프롬프트 | `src/lib/ai/prompts/question-generation.ts` | 규칙 2항 변경: 텍스트 대체 → SVG/descriptor 출력 지시 | S |
| AI 생성 프롬프트 | `src/lib/ai/prompts/past-exam-generation.ts` | 동일 변경 | S |
| AI 생성 응답 스키마 | `src/lib/ai/validation.ts` | `generatedQuestionSchema`에 `figures` 필드 추가 | S |
| AI 타입 | `src/lib/ai/types.ts` | `GeneratedQuestion`에 `figures` 필드 추가 | S |
| DB 마이그레이션 | `supabase/migrations/` | `questions` 테이블에 `has_figure, figures` 컬럼 추가 | S |
| Server Action (저장) | `src/lib/actions/save-questions.ts` | `figures` 필드 DB 저장 처리 | S |
| Server Action (조회) | `src/lib/actions/questions.ts` | `figures` 필드 조회·반환 | S |
| 도형 렌더러 | `src/components/figure-renderer.tsx` (신규) | SVG/description 렌더링 컴포넌트 | M |
| 기출 편집 UI | `src/app/(dashboard)/past-exams/[id]/edit/question-card.tsx` | `FigurePreview` → 실제 렌더러 연결 | S |
| 질문 상세 Sheet | `src/app/(dashboard)/questions/_components/question-detail-sheet.tsx` | 도형 표시 섹션 추가 | S |
| AI 생성 다이얼로그 | `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` | 생성된 문제 내 도형 표시 | S |
| Zod 검증 | `src/lib/validations/` | 도형 관련 스키마 추가 | S |

---

## 단계적 도입 전략

### Phase 1: 텍스트 설명 + bounding box 시각화 (기출 추출 경로만)

**작업량: S (1~2일)**

이미 `past_exam_details.figures`에 `description`과 `boundingBox`가 저장되어 있다.

- `question-card.tsx`의 `FigurePreview` 컴포넌트를 확장: description 텍스트 옆에 원본 이미지 위에 boundingBox를 오버레이하여 표시
- 별도 렌더링 라이브러리 불필요 (CSS absolute positioning + 이미지 비율 계산)
- DB 스키마 변경 없음
- AI 프롬프트 변경 없음
- **한계**: 시각적 도형이 아닌 "위치 강조 + 텍스트 설명"에 그침

### Phase 2: AI 생성 도형 — SVG descriptor 방식 (신규 생성 경로)

**작업량: M (3~4일)**

Gemini에게 SVG 코드를 직접 생성하도록 프롬프트를 변경한다. 한국 중고등 수학에 자주 등장하는 도형(직선 그래프, 원, 삼각형, 좌표계)은 SVG로 표현 가능하다.

변경 사항:
1. `question-generation.ts`, `past-exam-generation.ts` 프롬프트 수정: 도형이 필요하면 SVG 코드 반환 지시
2. `generatedQuestionSchema`에 `figures` 배열 추가 (description + svgCode 필드)
3. `questions` 테이블 마이그레이션 (has_figure, figures 컬럼)
4. `save-questions.ts` Server Action 업데이트
5. `FigureRenderer` 컴포넌트 신규 생성: `<div dangerouslySetInnerHTML={{ __html: svgCode }}>`
   - XSS 방지: DOMPurify 또는 서버사이드 sanitize 필수
6. 모든 UI 렌더링 포인트에 `FigureRenderer` 연결

**주요 리스크**: Gemini의 SVG 생성 품질 (복잡한 그래프는 부정확할 수 있음)

### Phase 3: 수학 특화 도형 라이브러리 도입

**작업량: L (1주+)**

Phase 2에서 SVG 품질이 불충분한 경우, 구조화된 도형 데이터(descriptor JSON)를 기반으로 클라이언트에서 렌더링하는 방식을 사용한다.

후보 라이브러리:
- **JSXGraph**: 수학 그래프·함수 그래프 특화, 한국 교육 커뮤니티에서 사용
- **Desmos API**: 함수 그래프 최고 품질, API 사용 제한 있음
- **React Flow**: 플로우차트·그래프 구조, 수학 도형과는 거리 있음

Gemini는 도형의 구조화된 JSON descriptor를 출력하고, 클라이언트가 이를 라이브러리 API에 전달하는 방식:
```json
{
  "type": "coordinate_plane",
  "functions": ["y = 2x + 1", "y = -x + 3"],
  "points": [{ "x": 1, "y": 3, "label": "A" }],
  "domain": [-5, 5],
  "range": [-5, 5]
}
```

---

## 호환성 리스크

### 1. XSS 취약점 (HIGH)

SVG를 `dangerouslySetInnerHTML`로 삽입하면 XSS 공격에 노출된다.
- **대응**: DOMPurify (`isomorphic-dompurify`)로 서버사이드 sanitize 필수
- Server Action에서 저장 전 sanitize, UI에서 재 sanitize (이중 방어)

### 2. 하위 호환성 — 기존 `figures` 없는 데이터 (LOW)

`figures`가 null인 기존 `past_exam_details` 레코드는 정상 동작 (null 체크 이미 구현됨).
`questions` 테이블의 신규 컬럼도 `DEFAULT false / DEFAULT NULL`로 하위 호환 보장 가능.

### 3. Gemini SVG 생성 품질 (MEDIUM)

Gemini는 텍스트 기반 LLM이므로 복잡한 수학 그래프를 정확한 SVG로 출력하는 데 한계가 있다.
- **대응**: Phase 1에서 텍스트 설명 fallback 유지
- 단순 도형(직선, 원, 삼각형)부터 지원, 복잡한 그래프는 Phase 3으로 이관

### 4. `options` 타입 변경 (MEDIUM)

현재 `options: string[]`를 `(string | FigureOption)[]`로 변경하면 기존 렌더링 코드 전수 수정 필요.
- `question-card.tsx`, `generate-questions-dialog.tsx`, `question-detail-sheet.tsx` 등 선택지 표시 부분 모두 수정
- TypeScript 컴파일러가 타입 오류를 잡아주므로 누락 방지는 가능

### 5. 기출 추출의 bounding box 부정확성 (MEDIUM)

HANDOFF.md에 "AI bounding box 부정확 + 학생 필기 포함 문제"로 crop이 이미 제거된 이력이 있다.
Phase 1에서 bounding box 오버레이를 구현해도 동일한 정확도 문제가 재현될 수 있다.
- **대응**: bounding box 오버레이는 "참고용"으로만 제공, 원본 이미지를 항상 함께 표시

---

## 총 작업량 평가

| Phase | 내용 | 작업량 | 우선순위 |
|-------|-----|-------|--------|
| Phase 1 | 기출 추출 도형 — bounding box 오버레이 + description | **S (1~2일)** | 즉시 시작 가능 |
| Phase 2 | AI 생성 도형 — Gemini SVG + 저장 + 렌더링 | **M (3~4일)** | XSS 대응 포함 |
| Phase 3 | 수학 특화 라이브러리 (JSXGraph 등) | **L (1주+)** | 품질 요구 시 |

**전체 총합 (Phase 1+2): M~L (약 1주)**

Phase 1만 구현해도 현재 사용자가 "어떤 도형이 있는지" 파악할 수 있으며, 즉시 제공 가능한 가치가 있다.
Phase 2는 AI 생성 문제의 도형 지원이므로 수학 과목 문제 생성 품질 향상에 직결된다.
Phase 3은 복잡한 함수 그래프나 기하 도형이 필요한 고난도 문제를 위한 장기 투자이다.
