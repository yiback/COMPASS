# 도형 렌더링 상세 구현 계획 (단계 1.5-2)

> 작성일: 2026-03-23
> 기반 PLAN: `docs/plan/figure-rendering.md` (v2)
> 버전: v2
> 반영 피드백: v3 리뷰 MUST FIX 4건 + SHOULD FIX 7건 + CONSIDER 5건 전부 반영

**변경 이력**:
- v1 → v2 (2026-03-23): 리뷰 피드백 17개 반영
  - MUST 1: validateFigureIndices duck typing 시그니처 적용
  - MUST 2: renderSegment 클로저 → 매개변수 방식 전환 (React.memo 최적화 유지)
  - MUST 3: Task 7 → 7a(coordinate_plane)/7b(function_graph) 분리 + CoordinatePlaneContent 분리
  - MUST 4: Wave 3 → 3a/3b 직렬 분리 (figure-renderer.tsx 병렬 충돌 해소)
  - SHOULD 5: 각 SVG `<defs>` 자체 포함 패턴 에이전트 가이드 추가
  - SHOULD 6: Task 9 선택지 렌더링 파일 경로 명시
  - SHOULD 7: Task 10a Gemini E2E 수동 검증 단계 추가
  - SHOULD 8: className 전달 체인(LatexRenderer→FigureRenderer→SVG) 명시
  - SHOULD 9: Task 1 `supabase gen types` 실행 금지 추가
  - SHOULD 10: 마스터 PLAN Task 10 → 10a/10b 명칭 동기화 NOTE 추가
  - SHOULD 11: ROADMAP.md `{{fig:0}}` → `{{fig:1}}` 수정 (별도)
  - CONSIDER 12: Wave 4 에이전트 할당표 추가
  - CONSIDER 13: Task 2 완료 직후 Zod 테스트 선행 작성 권장 추가
  - CONSIDER 14: MEMORY.md 교훈 체크리스트에 race condition/dangerouslySetInnerHTML N/A 명시
  - CONSIDER 15: 사전 작업 + Wave 1 병렬 가능 명시
  - CONSIDER 16: Task 11 CSS import 처리 가이드 추가
  - CONSIDER 17: Task 1 `has_figure: boolean` NOT NULL 주의 명시

---

## 사전 작업: 리드 선행 — `src/lib/ai/types.ts` FigureData 추가

**Wave 2 시작 전에 리드가 직접 수행 (에이전트 없음)**

> **[CONSIDER 15] 병렬 가능**: 이 사전 작업(types.ts)과 Wave 1 Task 1(DB 마이그레이션), Task 2(Zod 스키마)는 서로 독립이므로 병렬 진행 가능. Task 3(FigureRenderer)는 Task 2 완료 후 시작.

### 작업 내용

파일: `src/lib/ai/types.ts`

1. `FigureData` discriminated union 타입 추가 (PLAN 섹션 3의 정의 그대로):
   ```typescript
   export type FigureData =
     | { type: 'coordinate_plane'; xRange: [number, number]; yRange: [number, number]; gridStep: number; displaySize: 'large' | 'small'; description: string }
     | { type: 'function_graph'; points: [number, number][]; domain: [number, number]; xRange: [number, number]; yRange: [number, number]; gridStep: number; color?: string; displaySize: 'large' | 'small'; description: string }
     | { type: 'polygon'; vertices: [number, number][]; labels?: string[]; displaySize: 'large' | 'small'; description: string }
     | { type: 'circle'; center: [number, number]; radius: number; displaySize: 'large' | 'small'; description: string }
     | { type: 'vector'; from: [number, number]; to: [number, number]; label?: string; displaySize: 'large' | 'small'; description: string }
     | { type: 'number_line'; min: number; max: number; points: { value: number; label: string }[]; displaySize: 'large' | 'small'; description: string }
   ```

2. `GeneratedQuestion` 인터페이스에 필드 추가:
   ```typescript
   export interface GeneratedQuestion {
     // 기존 필드 유지
     readonly hasFigure?: boolean   // 추가
     readonly figures?: readonly FigureData[]  // 추가
   }
   ```

### 완료 조건
- `FigureInfo` 인터페이스 및 `ExtractedQuestion.figures?: readonly FigureInfo[]` 변경 없음 확인
- `npm run build` 타입 에러 없음 확인
- Wave 2 에이전트에게 "types.ts 수정 완료" 통보

---

## Wave 1: 기반 (직렬)

> **[CONSIDER 15] 참고**: Task 1(DB 마이그레이션)과 Task 2(Zod 스키마)는 서로 독립 + 리드 선행 작업과도 독립이므로 병렬 진행 가능. Task 3만 Task 2 완료 후 시작.

### Task 1: DB 마이그레이션 — questions 테이블 확장

**Wave**: 1 | **소유**: db-schema | **작업량**: XS
**의존**: 없음

#### Step 1: SQL 마이그레이션 파일 작성
- 파일: `supabase/migrations/20260322_questions_figures.sql` (신규)
- 작업:
  ```sql
  -- questions 테이블에 도형 관련 컬럼 추가
  -- past_exam_details 테이블의 동일 컬럼과 구조 일치 (패턴 일관성)
  ALTER TABLE questions
    ADD COLUMN IF NOT EXISTS has_figure BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS figures JSONB;
  ```
- 주의사항:
  - `DEFAULT false` → 기존 rows에 영향 없음 (null 아닌 false로 채워짐)
  - `figures JSONB` → nullable (기존 rows는 null)
  - `past_exam_details`의 동일 컬럼 구조를 `supabase/migrations/20260315_past_exam_restructure.sql`에서 확인하여 패턴 일치시킬 것
  - RLS 정책(`00002_rls_policies.sql`)은 변경 불필요 — 기존 academy_id 기반 정책이 새 컬럼에도 적용됨

#### Step 2: Supabase 타입 업데이트
- 파일: `src/types/supabase.ts` (기존, 단일 수정자)
- 작업: `questions` 테이블의 `Row`, `Insert`, `Update` 타입에 필드 추가
  ```typescript
  // Row에 추가
  has_figure: boolean    // NOT NULL — null 없음 ([CONSIDER 17])
  figures: Json | null

  // Insert에 추가
  has_figure?: boolean
  figures?: Json | null

  // Update에 추가
  has_figure?: boolean
  figures?: Json | null
  ```
- 주의사항:
  - 자동 생성 타입 파일이므로 기존 형식 그대로 유지. `Json` 타입은 이미 파일 상단에 정의되어 있음
  - `has_figure`는 `boolean` (NOT NULL) — `boolean | null`로 작성 금지

#### 빌드 체크
- `npm run build` 실행
- 예상 결과: 성공 (타입 추가이며 사용처 없음)

#### Supabase Cloud 수동 적용 안내
- Supabase Dashboard → SQL Editor에서 마이그레이션 파일 내용 실행
- 기존 패턴: MEMORY.md "마이그레이션 00005 수동 적용 완료" 참조

#### 에이전트 프롬프트 가이드
- "기존 패턴 확인": `supabase/migrations/20260315_past_exam_restructure.sql`의 `has_figure`, `figures` 컬럼 패턴
- "금지 사항":
  - RLS 정책 파일(`00002_rls_policies.sql`) 수정 금지
  - 기존 컬럼 타입 변경 금지
  - **`supabase gen types` CLI 실행 금지** — stdout에 npm warn이 혼입되어 타입 파일 오염됨 (MEMORY.md 교훈). `src/types/supabase.ts`를 직접 수동 수정할 것 ([SHOULD 9])

---

### Task 2: FigureData Zod 스키마

**Wave**: 1 | **소유**: backend-actions | **작업량**: S
**의존**: 없음

> **[CONSIDER 13] 권장**: Task 2 완료 직후 `src/lib/validations/__tests__/figure-schema.test.ts`의 Zod 스키마 단위 테스트 선행 작성 권장. Wave 5 전체 테스트 전에 스키마 검증을 조기에 확보할 수 있음.

#### Step 1: Zod discriminated union 스키마 작성
- 파일: `src/lib/validations/figure-schema.ts` (신규)
- 작업: 6타입 discriminated union + 각 타입별 검증
  ```typescript
  // z.discriminatedUnion('type', [...]) 사용
  // 각 타입별 .refine() 또는 z.number().positive() 활용
  ```
- 타입별 검증 규칙:
  | 타입 | 검증 조건 |
  |------|----------|
  | coordinate_plane | `gridStep: z.number().positive()`, `xRange` / `yRange` `[0] < [1]` |
  | function_graph | `points: z.array(...).min(2).max(50)`, `domain[0] < domain[1]`, `xRange`/`yRange` `[0] < [1]` |
  | polygon | `vertices: z.array(...).min(3)` |
  | circle | `radius: z.number().positive()` |
  | vector | `.refine((v) => v.from[0] !== v.to[0] \|\| v.from[1] !== v.to[1], { message: '제로 벡터 불가' })` — 배열 참조 비교 불가이므로 좌표값 직접 비교 |
  | number_line | `min < max` → `.refine`, `points: z.array(...).min(1)` |
- 공통 필드: `displaySize: z.enum(['large', 'small']).default('large')`, `description: z.string().min(1)`
- 기존 코드 패턴: `src/lib/validations/save-questions.ts`의 Zod 스키마 작성 방식 참조

#### Step 2: 교차 검증 유틸 작성 ([MUST 1] duck typing 적용)
- 파일: `src/lib/validations/figure-schema.ts` (동일 파일 내 추가)
- 함수: `validateFigureIndices(questionText: string, figures: { length: number } | undefined): string[]`
  - **시그니처**: `figures: { length: number } | undefined` — duck typing 적용
  - 이렇게 하면 `FigureInfo[]`도 `FigureData[]`도 모두 전달 가능 (둘 다 `length` 프로퍼티 있음)
  - Task 6 추출 검증과 Task 10a 생성 검증에서 타입 캐스팅 없이 직접 호출 가능
- 로직:
  ```typescript
  // figures가 undefined이면 교차 검증 건너뜀 (early return)
  if (!figures) return []

  // questionText에서 {{fig:N}} 패턴의 N 추출 (1-based)
  const pattern = /\{\{fig:(\d+)\}\}/g
  const warnings: string[] = []
  let match: RegExpExecArray | null
  pattern.lastIndex = 0  // /g 플래그 stateful → 리셋 필수

  while ((match = pattern.exec(questionText)) !== null) {
    const figIndex = parseInt(match[1], 10)  // 1-based
    if (figIndex > figures.length) {
      warnings.push(`{{fig:${figIndex}}}가 있지만 figures 배열 길이는 ${figures.length}입니다`)
    }
  }
  return warnings
  ```
- 주의사항:
  - `/g` 플래그 정규식은 stateful → 함수 진입 시 `pattern.lastIndex = 0` 리셋 필수 (MEMORY.md 교훈)
  - 경고만 반환 (throw 아님) — 부분 성공 허용
  - 인덱스 {{fig:1}}은 1-based → figures[0]에 대응 → `figIndex > figures.length`로 범위 초과 감지

#### 빌드 체크
- `npm run build` 실행
- 예상 결과: 성공 (신규 파일, import하는 곳 없음)

#### 에이전트 프롬프트 가이드
- "기존 패턴 확인": `src/lib/validations/save-questions.ts` (Zod 스키마 패턴), `src/lib/ai/extraction-validation.ts` (figureInfoSchema 작성 방식)
- "금지 사항":
  - `figureInfoSchema` (extraction-validation.ts)와 이름/구조 혼동 금지 — 이 파일은 별도 FigureData용
  - 교차 검증에서 throw 금지 (경고 배열 반환)
  - `/g` 플래그 정규식 `lastIndex` 리셋 누락 금지
  - `validateFigureIndices` 시그니처를 `FigureData[]`로 좁히지 말 것 — duck typing `{ length: number }` 유지

---

### Task 3: FigureRenderer 기본 컴포넌트

**Wave**: 1 | **소유**: frontend-ui | **작업량**: S
**의존**: Task 2 (FigureData 타입 참조, Zod 스키마에서 추론된 타입)

#### Step 1: 기본 컴포넌트 구조 작성
- 파일: `src/components/ui/figure-renderer.tsx` (신규)
- 작업:
  - Props: `{ figure: FigureData; className?: string }`
  - Wave 1 구현: 모든 타입에서 `FigurePlaceholder` 폴백 렌더링
  - `FigurePlaceholder` 내부 컴포넌트: 점선 테두리 + 타입 텍스트 + description
    ```tsx
    // 스타일: "flex items-center gap-2 rounded border border-dashed border-muted-foreground p-2 text-sm text-muted-foreground"
    // 내용: [도형: {figure.type}] {figure.description}
    ```
  - switch(figure.type)으로 미리 분기 구조 준비 (Wave 3에서 SVG 컴포넌트로 교체 예정)
  - `React.memo` 적용

#### Step 2: Wave 3 확장을 위한 switch 구조 예비
- 파일: `src/components/ui/figure-renderer.tsx` (동일)
- 작업: switch 구조를 미리 작성하되 모든 case는 `FigurePlaceholder` 반환
  ```tsx
  switch (figure.type) {
    case 'number_line':
      // TODO Wave 2: NumberLine 컴포넌트 교체
      return <FigurePlaceholder figure={figure} />
    case 'coordinate_plane':
      // TODO Wave 3a: CoordinatePlane 컴포넌트 교체
      return <FigurePlaceholder figure={figure} />
    case 'function_graph':
      // TODO Wave 3a: FunctionGraph 컴포넌트 교체
      return <FigurePlaceholder figure={figure} />
    // ... 나머지 타입
    default:
      return <FigurePlaceholder figure={figure} />
  }
  ```
- 주의사항:
  - 레이아웃(블록/인라인) 결정은 이 컴포넌트 내부에서 하지 않음 — LatexRenderer가 segment.display로 결정
  - `displaySize` prop은 Wave 3에서 SVG 컴포넌트에 전달하기 위해 미리 구조에 반영
  - `React.memo` 래핑: `export const FigureRenderer = memo(function FigureRenderer(...) {...})`
  - **className 전달**: `className` prop을 SVG 컴포넌트에 그대로 전달 (체인: LatexRenderer 래퍼 → FigureRenderer → SVG `<svg className={...}>`)

#### 빌드 체크
- `npm run build` 실행
- 예상 결과: 성공

#### 에이전트 프롬프트 가이드
- "기존 패턴 확인": `src/components/ui/latex-renderer.tsx`의 `React.memo` 래핑 패턴
- "금지 사항":
  - 이 컴포넌트에서 블록/인라인 레이아웃 결정 금지 (LatexRenderer 담당)
  - `displaySize`를 CSS 레이아웃에 사용 금지 (SVG 내부 크기 힌트 전용)
  - `className` prop 누락 금지 (SVG 컴포넌트까지 전달되어야 함) ([SHOULD 8])

---

## Wave 2: 병렬 독립 작업

> **전제**: 리드 선행 작업(types.ts FigureData 추가) 완료 확인 후 시작

### Task 4: LatexRenderer figure 케이스 업데이트

**Wave**: 2 | **소유**: frontend-ui | **작업량**: S
**의존**: Task 3 (FigureRenderer import)

> **중요**: Task 4 완료 + 빌드 통과 확인 → Wave 4 Task 9 시작 가능. latex-renderer.tsx는 Task 9에서도 수정되므로 직렬 처리.

#### Step 1: Props 확장 (하위 호환)
- 파일: `src/components/ui/latex-renderer.tsx` (기존)
- 작업:
  ```typescript
  // 기존
  interface LatexRendererProps {
    readonly text: string | null | undefined
    readonly className?: string
  }
  // 변경 후
  interface LatexRendererProps {
    readonly text: string | null | undefined
    readonly className?: string
    readonly figures?: readonly FigureData[]  // optional — 하위 호환
  }
  ```
- `FigureData` import: `import type { FigureData } from '@/lib/ai/types'`
- `FigureRenderer` import: `import { FigureRenderer } from '@/components/ui/figure-renderer'`

#### Step 2: renderSegment 함수 매개변수 방식으로 확장 ([MUST 2])
- 파일: `src/components/ui/latex-renderer.tsx` (동일)
- **방식**: 모듈 레벨 함수 유지 — `figures`를 매개변수로 전달 (클로저 이동 금지)
  - 클로저로 이동하면 컴포넌트 리렌더마다 함수 재생성 → `React.memo` 최적화 무력화
  ```tsx
  // 모듈 레벨 함수 (기존 위치 유지)
  function renderSegment(
    segment: LatexSegment,
    index: number,
    figures: readonly FigureData[] | undefined,  // 추가된 매개변수
  ): React.ReactNode {
    switch (segment.type) {
      // ...기존 케이스들...
      case 'figure': {
        // {{fig:N}}의 N은 1-based → 배열 인덱스는 0-based
        const figure = figures?.[segment.index - 1]

        if (!figure) {
          // figures 없거나 인덱스 초과 → 기존 플레이스홀더 유지 (graceful degradation)
          return (
            <span key={index} className="inline-flex items-center rounded bg-muted px-1 text-xs text-muted-foreground">
              {`[도형 ${segment.index}]`}
            </span>
          )
        }

        // segment.display로 레이아웃 결정 (displaySize는 FigureRenderer에 전달)
        if (segment.display === 'block') {
          return (
            <div key={index} className="flex justify-center my-4">
              <FigureRenderer figure={figure} />
            </div>
          )
        }
        return (
          <span key={index} className="inline-flex">
            <FigureRenderer figure={figure} />
          </span>
        )
      }
    }
  }
  ```
- **중요**: `segment.index`는 1-based (`{{fig:1}}` → index=1). 배열 접근 시 `figures[segment.index - 1]`

#### Step 3: LatexRenderer 컴포넌트에서 figures 인자 전달
- 파일: `src/components/ui/latex-renderer.tsx` (동일)
- 작업: LatexRenderer 컴포넌트에서 `renderSegment` 호출 시 `figures` 인자 추가
  ```tsx
  export const LatexRenderer = memo(function LatexRenderer({
    text,
    className,
    figures,
  }: LatexRendererProps) {
    const segments = parseLatexText(text)
    return (
      <span className={...}>
        {segments.map((segment, idx) => renderSegment(segment, idx, figures))}
      </span>
    )
  })
  ```
- 주의사항:
  - `past_exam_details` 페이지의 기존 `<LatexRenderer text={...} />` 호출은 변경 없음 (figures 미전달 → 플레이스홀더 유지)
  - 기존 테스트 파일에서 LatexRenderer 테스트하는 경우 figures 미전달 시 기존 동작 유지 확인

#### 빌드 체크
- `npm run build` 실행
- 예상 결과: 성공. TypeScript 타입 에러 없음 (figures?: optional)

#### 에이전트 프롬프트 가이드
- "기존 패턴 확인": 현재 `src/components/ui/latex-renderer.tsx`의 renderSegment 함수 구조
- "금지 사항":
  - `renderSegment`를 컴포넌트 내부로 이동 금지 — 모듈 레벨 유지 + 매개변수 추가만 허용 ([MUST 2])
  - `segment.index`를 그대로 배열 인덱스로 사용 금지 (`[segment.index - 1]`로 접근)
  - `displaySize`로 CSS 레이아웃 결정 금지 (`segment.display`로 결정)
  - past_exam_details 하위 호환 파괴 금지 (figures 미전달 시 플레이스홀더 유지)
- **className 전달 체인** ([SHOULD 8]): LatexRenderer의 `className`은 최외부 `<span>`에 적용. figure 래퍼 div/span은 레이아웃 전용. FigureRenderer의 `className`은 SVG `<svg>` 태그에 적용됨.

---

### Task 5: SVG 유틸 + number_line 렌더러

**Wave**: 2 | **소유**: frontend-ui | **작업량**: M
**의존**: Task 3

#### Step 1: SVG 유틸 함수 작성
- 파일: `src/components/ui/svg/svg-utils.ts` (신규, 디렉토리도 신규)
- 작업: 좌표 변환 + SVG 헬퍼 함수들
  ```typescript
  /**
   * 데이터 값을 SVG 픽셀 좌표로 선형 변환
   */
  export function mapToSVG(value: number, dataMin: number, dataMax: number, svgMin: number, svgMax: number): number

  /**
   * SVG 뷰박스 계산 (데이터 범위 + 여백)
   */
  export function calcViewBox(min: number, max: number, padding: number): { svgMin: number; svgMax: number; size: number }

  /**
   * 숫자 포맷: 정수면 정수, 아니면 소수점 1자리
   */
  export function formatNumber(n: number): string

  /**
   * 화살표 마커 공통 ID (각 SVG 컴포넌트의 <defs>에서 직접 정의)
   */
  export const ARROWHEAD_MARKER_ID = 'arrowhead'
  ```
- 주의사항:
  - 순수 계산 함수 (React 없음, 타입스크립트만)
  - `mapToSVG`에서 `dataMax === dataMin`인 경우 division by zero 방지

#### Step 2: number_line SVG 렌더러 작성
- 파일: `src/components/ui/svg/number-line.tsx` (신규)
- 작업: 수직선 SVG 렌더링
  - Props: `{ figure: Extract<FigureData, { type: 'number_line' }>; className?: string }`
  - SVG 구조:
    - **`<defs>`**: 화살표 마커 포함 — 각 SVG가 자체 `<defs>` 보유 (다른 SVG와 ID 충돌 방지) ([SHOULD 5])
    - viewBox: `min` ~ `max` 범위 + 여백 40px (좌우)
    - 높이: displaySize='large' → 80px, 'small' → 60px
    - 수평선: `<line>` + 양쪽 화살표 (`<polygon>` 또는 `<path>`)
    - 눈금(tick mark): 정수 간격 또는 지정 간격
    - 지정 points: `<circle r=4>` + 레이블 텍스트 (위 또는 아래)
  - React.memo 적용
- 주의사항:
  - `FigureData`에서 특정 타입만 추출: `Extract<FigureData, { type: 'number_line' }>`
  - y좌표는 중앙 고정 (SVG height의 절반)
  - 레이블이 겹치지 않도록 짝수 인덱스는 위, 홀수 인덱스는 아래 배치 (기본 전략)
  - `className` prop을 `<svg>` 태그에 적용: `<svg className={cn('...', className)}>` ([SHOULD 8])

#### Step 3: FigureRenderer에 number_line 연결
- 파일: `src/components/ui/figure-renderer.tsx` (Task 3에서 생성)
- 작업: `case 'number_line'`을 FigurePlaceholder → NumberLine 컴포넌트로 교체
  ```tsx
  import { NumberLine } from '@/components/ui/svg/number-line'
  // ...
  case 'number_line':
    return <NumberLine figure={figure} className={className} />
  ```

#### 빌드 체크
- `npm run build` 실행
- 예상 결과: 성공

#### 에이전트 프롬프트 가이드
- "기존 패턴 확인": `src/lib/utils/latex-parser.ts`의 `/g` 플래그 정규식 `lastIndex = 0` 리셋 패턴
- "금지 사항":
  - svg-utils.ts에 React import 금지 (순수 유틸)
  - `mapToSVG`에서 0 나누기 미처리 금지 (`dataMax === dataMin` 예외 처리 필수)
  - 외부 SVG 라이브러리 import 금지 (순수 SVG JSX)
  - **`<defs>` 생략 금지** — 각 SVG 컴포넌트는 자체 `<defs>` 포함 (다른 SVG 인스턴스와 마커 ID 충돌 방지) ([SHOULD 5])
  - `className` prop 누락 금지 (SVG `<svg>` 태그에 적용) ([SHOULD 8])

---

### Task 6: AI 추출 프롬프트 figures JSON 출력

**Wave**: 2 | **소유**: ai-integration | **작업량**: M
**의존**: Task 2 (validateFigureIndices 참조), 리드 선행 작업 (types.ts)

> **핵심 제약**: `extractedQuestionSchema.figures`는 `figureInfoSchema` **유지**. FigureData 교체 대상은 `generatedQuestionSchema`만 (Task 10a).
> **가드레일**: `extractionJsonSchema` 변경 금지 (figureInfoSchema 유지 → 자동으로 불변).

#### Step 1: 추출 프롬프트에 {{fig:N}} 삽입 지시 추가
- 파일: `src/lib/ai/prompts/question-extraction.ts` (기존)
- 작업: `EXTRACTION_SYSTEM_INSTRUCTION` 4번 규칙 수정
  ```
  // 기존 규칙 4:
  '4. 그래프, 그림, 도형이 있는 경우:'
  '   - bounding box 좌표를 normalized(0~1)로 반환하세요.'
  // ...

  // 추가 내용:
  '   - questionText에서 도형이 위치하는 곳에 {{fig:N}} 구분자를 삽입하세요 (N은 1부터 시작, figures 배열 순서와 일치).'
  '   - 예: "다음 {{fig:1}}에서 각도 x를 구하시오."'
  '   - 도형이 문제 문두에 단독으로 있으면: 문장 앞뒤를 각각 \\n으로 감싸세요.'
  ```
- 주의사항:
  - `REANALYZE_SYSTEM_INSTRUCTION`에도 동일 규칙 추가
  - 기존 bounding box 지시는 유지 (figureInfoSchema는 boundingBox 계속 사용)

#### Step 2: 교차 검증 추가 (extraction-validation.ts) ([MUST 1] duck typing 활용)
- 파일: `src/lib/ai/extraction-validation.ts` (기존)
- 작업: `validateExtractedQuestions` 함수 내 2단계 비즈니스 규칙에 figures 교차 검증 추가
  ```typescript
  import { validateFigureIndices } from '@/lib/validations/figure-schema'

  // 기존 q.questionType === 'multiple_choice' 검증 다음에 추가:
  // validateFigureIndices의 figures 인자 타입이 { length: number } | undefined 이므로
  // FigureInfo[] 직접 전달 가능 (타입 캐스팅 불필요) — duck typing 덕분
  const warnings = validateFigureIndices(
    q.questionText,
    q.figures  // FigureInfo[] — length 프로퍼티 있으므로 그대로 전달 가능
  )
  if (warnings.length > 0) {
    // 경고 로그 (throw 아님 — 부분 성공 허용)
    console.warn(`문제 ${q.questionNumber} figures 인덱스 불일치:`, warnings)
  }
  ```
- **절대 변경 금지** (에이전트 가드레일):
  - `figureInfoSchema` — 변경 금지
  - `extractedQuestionSchema` — 변경 금지
  - `extractionJsonSchema` — 변경 금지 (figureInfoSchema 유지로 자동 불변)
- 주의사항:
  - `figures` 타입은 여전히 `figureInfoSchema[]` (FigureData 아님)
  - duck typing으로 `validateFigureIndices`에 FigureInfo[]를 직접 전달 가능 (length 프로퍼티만 사용)

#### 빌드 체크
- `npm run build` 실행
- 예상 결과: 성공

#### 에이전트 프롬프트 가이드
- "기존 패턴 확인": `src/lib/ai/extraction-validation.ts`의 `validateExtractedQuestions` 함수, `figureInfoSchema` 구조
- "금지 사항":
  - `figureInfoSchema`, `extractedQuestionSchema`, `extractionJsonSchema` 수정 절대 금지
  - FigureData Zod 스키마로 figures 필드 교체 금지 — 기출 추출 crop 파이프라인 파손 원인
  - figures 교차 검증에서 throw 금지 (경고 로그만)
  - `validateFigureIndices` 호출 시 FigureInfo[]를 FigureData[]로 캐스팅 금지 — duck typing 그대로 활용

---

## Wave 3: 단계적 SVG 렌더러 확장

> **[MUST 4] Wave 3a/3b 직렬 분리**: `figure-renderer.tsx` 병렬 충돌 해소를 위해 Wave 3를 3a(coordinate_plane/function_graph)와 3b(polygon/circle/vector)로 분리.
> Wave 3b는 Wave 3a 완료 후 시작.

### Wave 3a: coordinate_plane + function_graph

#### Task 7a: coordinate-plane.tsx + CoordinatePlaneContent 분리 ([MUST 3])

**Wave**: 3a | **소유**: frontend-ui | **작업량**: M
**의존**: Task 5 (svg-utils)

> [MUST 3] CoordinatePlaneContent를 내부 컴포넌트로 분리하여 Task 7b의 function_graph가 단일 `<svg>` 안에 합성할 수 있도록 함.

##### Step 1: CoordinatePlaneContent 내부 컴포넌트 작성
- 파일: `src/components/ui/svg/coordinate-plane.tsx` (신규)
- 작업: SVG 내부 엘리먼트만 렌더링 (`<svg>` 태그 없음)
  ```tsx
  // SVG 내부 그룹만 반환 — <svg> 없음
  interface CoordinatePlaneContentProps {
    xRange: [number, number]
    yRange: [number, number]
    gridStep: number
    pixelWidth: number    // 실제 SVG 픽셀 폭 (좌표 변환에 필요)
    pixelHeight: number   // 실제 SVG 픽셀 높이
  }

  export function CoordinatePlaneContent({
    xRange, yRange, gridStep, pixelWidth, pixelHeight
  }: CoordinatePlaneContentProps): React.ReactElement {
    return (
      <g>
        {/* 그리드, 축, 눈금, 원점 라벨 */}
      </g>
    )
  }
  ```
- 렌더링 구성 요소:
  1. **그리드**: `gridStep` 간격으로 수평/수직 점선 (`stroke-dasharray="2,2" stroke="#e0e0e0"`)
  2. **x축**: y=0 위치에 수평선 + 우측 화살표
  3. **y축**: x=0 위치에 수직선 + 상단 화살표
  4. **원점 라벨**: "O" 텍스트 (원점 좌하단)
  5. **눈금**: gridStep 간격으로 작은 tick mark + 숫자 레이블 (0 제외)

##### Step 2: CoordinatePlane 외부 컴포넌트 작성
- 파일: `src/components/ui/svg/coordinate-plane.tsx` (동일)
- 작업: `<svg>` + `<defs>` + `CoordinatePlaneContent`로 구성
  ```tsx
  export const CoordinatePlane = memo(function CoordinatePlane({
    figure,
    className,
  }: {
    figure: Extract<FigureData, { type: 'coordinate_plane' }>
    className?: string
  }) {
    const pixelSize = figure.displaySize === 'large' ? 240 : 160
    return (
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox={`...`}
        className={cn('...', className)}
      >
        <defs>
          {/* 화살표 마커 — 자체 <defs> 포함 (다른 SVG와 ID 충돌 방지) */}
          <marker id="arrowhead" ...>...</marker>
        </defs>
        <CoordinatePlaneContent
          xRange={figure.xRange}
          yRange={figure.yRange}
          gridStep={figure.gridStep}
          pixelWidth={pixelSize}
          pixelHeight={pixelSize}
        />
      </svg>
    )
  })
  ```
- React.memo 적용
- 주의사항:
  - 그리드가 축보다 먼저 렌더링 (z-order: 그리드 → 축 → 라벨)
  - 숫자 레이블이 SVG 경계 밖으로 나가지 않도록 viewBox에 여백 추가
  - `className` prop을 `<svg>` 태그에 적용 ([SHOULD 8])

##### Step 3: FigureRenderer에 coordinate_plane 연결
- 파일: `src/components/ui/figure-renderer.tsx` (기존)
- 작업:
  ```tsx
  import { CoordinatePlane } from '@/components/ui/svg/coordinate-plane'
  // ...
  case 'coordinate_plane':
    return <CoordinatePlane figure={figure} className={className} />
  ```

##### 빌드 체크
- `npm run build` 실행 (Task 7a 완료 후)
- 예상 결과: 성공

##### 에이전트 프롬프트 가이드
- "기존 패턴 확인": `src/components/ui/svg/number-line.tsx`의 `Extract<FigureData, ...>` Props 패턴, `mapToSVG` 활용법
- "금지 사항":
  - 외부 SVG/차트 라이브러리 import 금지
  - **`<defs>` 생략 금지** — CoordinatePlane의 `<svg>`에 화살표 마커 `<defs>` 포함 필수 ([SHOULD 5])
  - `CoordinatePlaneContent`의 `<g>` 내부에 `<svg>` 중첩 금지 (SVG 내부 요소만)
  - `className` prop 누락 금지 ([SHOULD 8])

---

#### Task 7b: function_graph SVG 합성 ([MUST 3])

**Wave**: 3a | **소유**: frontend-ui | **작업량**: M
**의존**: Task 7a (CoordinatePlaneContent)

> Wave 3a 내에서 Task 7a 완료 후 시작. function_graph는 CoordinatePlaneContent를 단일 `<svg>` 안에 합성.

##### Step 1: function_graph SVG 렌더러 작성
- 파일: `src/components/ui/svg/function-graph.tsx` (신규)
- 작업: 단일 `<svg>` 안에 `CoordinatePlaneContent` + `<polyline>` 합성
  ```tsx
  import { CoordinatePlaneContent } from '@/components/ui/svg/coordinate-plane'

  export const FunctionGraph = memo(function FunctionGraph({
    figure,
    className,
  }: {
    figure: Extract<FigureData, { type: 'function_graph' }>
    className?: string
  }) {
    const pixelSize = figure.displaySize === 'large' ? 240 : 160
    // points를 SVG 픽셀 좌표로 변환 (mapToSVG 활용)
    const polylinePoints = figure.points
      .map(([x, y]) => `${mapToSVG(x, ...)},${mapToSVG(y, ...)}`)
      .join(' ')

    return (
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox={`...`}
        className={cn('...', className)}
      >
        <defs>
          {/* 화살표 마커 — 자체 <defs> 포함 ([SHOULD 5]) */}
          <marker id="arrowhead" ...>...</marker>
          {/* domain 클리핑 */}
          <clipPath id="graph-clip">...</clipPath>
        </defs>
        {/* 좌표평면 내부 엘리먼트 합성 */}
        <CoordinatePlaneContent
          xRange={figure.xRange}
          yRange={figure.yRange}
          gridStep={figure.gridStep}
          pixelWidth={pixelSize}
          pixelHeight={pixelSize}
        />
        {/* 함수 그래프 polyline */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke={figure.color ?? 'currentColor'}
          strokeWidth="2"
          clipPath="url(#graph-clip)"
        />
      </svg>
    )
  })
  ```
- points → SVG 픽셀 변환: `mapToSVG` 활용, `xRange`/`yRange` 기준
- domain 외 points 클리핑: SVG `clipPath` 사용
- React.memo 적용

##### Step 2: FigureRenderer에 function_graph 연결
- 파일: `src/components/ui/figure-renderer.tsx` (기존)
- 작업:
  ```tsx
  import { FunctionGraph } from '@/components/ui/svg/function-graph'
  // ...
  case 'function_graph':
    return <FunctionGraph figure={figure} className={className} />
  ```

##### 빌드 체크
- `npm run build` 실행 (Task 7b 완료 후)
- 예상 결과: 성공

##### 에이전트 프롬프트 가이드
- "기존 패턴 확인": `src/components/ui/svg/coordinate-plane.tsx`의 `CoordinatePlaneContent` Props
- "금지 사항":
  - `CoordinatePlane` 컴포넌트(외부 svg 포함) 임포트 금지 — `CoordinatePlaneContent`(내부 엘리먼트만)를 사용할 것 ([MUST 3])
  - 두 개의 `<svg>` 중첩 금지 — 단일 `<svg>` 안에 합성
  - eval() 또는 수식 문자열 실행 금지 (points 배열 직접 사용)
  - 외부 SVG/차트 라이브러리 import 금지
  - **`<defs>` 생략 금지** ([SHOULD 5])

---

### Wave 3b: polygon + circle + vector (Wave 3a 완료 후)

> **[MUST 4]**: Wave 3a(Task 7a + 7b) 완료 + `npm run build` 통과 확인 후 Wave 3b 시작.
> Task 8 내 polygon/circle/vector 3개 신규 파일은 서로 독립이므로 병렬 구현 가능.
> figure-renderer.tsx 연결(Step 4)은 모든 신규 파일 완료 후 1회 수정.

#### Task 8: polygon + circle + vector SVG 렌더러

**Wave**: 3b | **소유**: frontend-ui | **작업량**: M
**의존**: Task 5 (svg-utils), Wave 3a 완료

#### Step 1: polygon SVG 렌더러
- 파일: `src/components/ui/svg/polygon.tsx` (신규)
- 작업:
  - Props: `{ figure: Extract<FigureData, { type: 'polygon' }>; className?: string }`
  - **`<defs>`**: 필요 시 마커 포함 — 각 SVG가 자체 `<defs>` 보유 ([SHOULD 5])
  - viewBox: vertices 좌표 min/max 계산 + 여백 (라벨 공간 확보)
  - 렌더링:
    - `<polygon points="x1,y1 x2,y2 ...">` — vertices를 픽셀 좌표로 변환
    - 꼭짓점 라벨: `labels[i]`를 꼭짓점 근처에 배치
    - 라벨 오프셋: 꼭짓점 중심에서 바깥 방향으로 10px (중심점 대비 방향 계산)
  - `className` prop을 `<svg>` 태그에 적용 ([SHOULD 8])
  - React.memo 적용

#### Step 2: circle-shape SVG 렌더러
- 파일: `src/components/ui/svg/circle-shape.tsx` (신규)
- 작업:
  - Props: `{ figure: Extract<FigureData, { type: 'circle' }>; className?: string }`
  - **`<defs>`**: 자체 `<defs>` 포함 (빈 경우라도 구조 일관성) ([SHOULD 5])
  - viewBox: center ± (radius + 여백 20px) 자동 계산
  - 렌더링:
    - `<circle cx cy r>` — 원
    - `<circle cx cy r=3 fill="currentColor">` — 중심점
  - `className` prop을 `<svg>` 태그에 적용 ([SHOULD 8])
  - React.memo 적용

#### Step 3: vector-arrow SVG 렌더러
- 파일: `src/components/ui/svg/vector-arrow.tsx` (신규)
- 작업:
  - Props: `{ figure: Extract<FigureData, { type: 'vector' }>; className?: string }`
  - **`<defs>`**: 화살표 마커 포함 — 자체 `<defs>` 보유 ([SHOULD 5])
  - viewBox: from/to 범위 + 여백
  - 렌더링:
    - `<defs><marker id="arrowhead" ...>` — 화살표 마커 정의
    - `<line x1 y1 x2 y2 marker-end="url(#arrowhead)">` — 벡터 선
    - `label` 텍스트: 벡터 중간 지점에 배치
  - `className` prop을 `<svg>` 태그에 적용 ([SHOULD 8])
  - React.memo 적용

#### Step 4: FigureRenderer에 polygon, circle, vector 연결
- 파일: `src/components/ui/figure-renderer.tsx` (기존 — Wave 3b에서 1회 수정)
- 작업:
  ```tsx
  import { Polygon } from '@/components/ui/svg/polygon'
  import { CircleShape } from '@/components/ui/svg/circle-shape'
  import { VectorArrow } from '@/components/ui/svg/vector-arrow'
  // ...
  case 'polygon':
    return <Polygon figure={figure} className={className} />
  case 'circle':
    return <CircleShape figure={figure} className={className} />
  case 'vector':
    return <VectorArrow figure={figure} className={className} />
  ```

#### 빌드 체크
- 각 파일 완료 후 단계별 `npm run build`
- 예상 결과: 성공

#### 에이전트 프롬프트 가이드
- "기존 패턴 확인": `src/components/ui/svg/number-line.tsx`의 SVG 구조 패턴
- "금지 사항":
  - 외부 라이브러리 import 금지
  - 서로 다른 figures 간 합성 금지 (각 도형은 독립 SVG)
  - circle-shape.tsx 파일명 사용 (circle.tsx는 shadcn/ui 컴포넌트와 충돌 가능)
  - **`<defs>` 생략 금지** — 각 SVG 컴포넌트는 자체 `<defs>` 포함 ([SHOULD 5])
  - `className` prop 누락 금지 ([SHOULD 8])

---

## Wave 4: 병렬 마무리

> **[CONSIDER 12] Wave 4 에이전트 할당**:
> - Task 9 = frontend-ui
> - Task 10a = ai-integration
> - Task 10b = backend-actions

### Task 9: 연속 도형 수평 배치 + 선택지 도형

**Wave**: 4 | **소유**: frontend-ui | **작업량**: S
**의존**: Task 4 (LatexRenderer 기존 수정), Task 7a/7b, Task 8 (SVG 렌더러 완성)

> **Wave 4 시작 조건**: Task 4 완료 + `npm run build` 통과 확인 후 시작 (latex-renderer.tsx 직렬)

#### Step 1: 연속 도형 그룹화 로직
- 파일: `src/components/ui/latex-renderer.tsx` (기존, Task 4에서 이미 수정됨)
- 작업: `groupAdjacentFigures` 헬퍼 함수 추가
  ```typescript
  // segments 배열에서 연속 figure 세그먼트를 그룹으로 묶음
  type SegmentGroup =
    | { kind: 'single'; segment: LatexSegment; index: number }
    | { kind: 'figure_group'; segments: Array<LatexSegment & { type: 'figure' }>; startIndex: number }

  function groupAdjacentFigures(segments: LatexSegment[]): SegmentGroup[]
  ```
- `LatexRenderer` 컴포넌트에서 `segments.map` 대신 `groupAdjacentFigures` 결과를 렌더링:
  ```tsx
  // kind === 'figure_group' → <div className="flex flex-row gap-4 justify-center">
  // kind === 'single' → 기존 renderSegment(segment, idx, figures) 호출
  ```

#### Step 2: 선택지 도형 처리 ([SHOULD 6])
- **실제 파일 경로** (Grep 확인 완료):
  - `src/app/(dashboard)/questions/_components/question-detail-sheet.tsx` — 줄 174 근처: `<LatexRenderer text={option} />`
  - `src/app/(dashboard)/past-exams/[id]/edit/question-card.tsx` — 줄 168 근처: `<LatexRenderer text={option} />`
- 작업: 위 두 파일에서 선택지 렌더링 시 `figures` prop 전달 확인
  - `options` 타입: `string[]` 그대로 유지 (타입 변경 없음)
  - `<LatexRenderer text={option} figures={figures} />`로 호출 — 상위 컴포넌트에서 figures를 props로 전달받아야 함
  - `figures` prop이 없으면 선택지 내 `{{fig:N}}`은 플레이스홀더로 표시 (graceful degradation)
- 주의사항:
  - 상위 컴포넌트에서 figures를 전달받는 props drilling이 필요할 수 있음
  - 우선 파일을 열어 현재 컴포넌트 시그니처 확인 후 figures 전달 경로 파악

#### 빌드 체크
- `npm run build` 실행
- 예상 결과: 성공

#### 에이전트 프롬프트 가이드
- "기존 패턴 확인": Task 4에서 수정된 `src/components/ui/latex-renderer.tsx` 전체 구조
- "금지 사항":
  - Task 4에서 작성한 코드 삭제/교체 금지 (추가만 허용)
  - `options: string[]` 타입 변경 금지

---

### Task 10a: AI 생성 프롬프트 도형 출력 + validation 확장

**Wave**: 4 | **소유**: ai-integration | **작업량**: M
**의존**: Task 2 (figureDataSchema), Task 6 (패턴 참조), 리드 선행 작업 (types.ts)

> Task 10a와 Task 10b는 서로 다른 파일이므로 Wave 4 내 병렬 구현 가능

> **[SHOULD 10] 마스터 PLAN 명칭 동기화 NOTE**: 마스터 PLAN(`docs/plan/figure-rendering.md`)의 Task 10은 상세 PLAN에서 Task 10a(ai-integration)와 Task 10b(backend-actions)로 분리되었음. 마스터 PLAN 파일은 수정하지 않으며, 상세 PLAN에서 10a/10b 명칭을 사용함.

#### Step 1: generatedQuestionSchema 확장
- 파일: `src/lib/ai/validation.ts` (기존)
- 작업:
  ```typescript
  import { figureDataSchema } from '@/lib/validations/figure-schema'

  export const generatedQuestionSchema = z.object({
    // 기존 필드 유지
    content: z.string().min(1),
    answer: z.string().min(1),
    explanation: z.string().min(1),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    questionType: z.enum(['multiple_choice', 'short_answer', 'essay']),
    options: z.array(z.string()).optional(),
    // 추가 필드
    hasFigure: z.boolean().default(false),
    figures: z.array(figureDataSchema).optional(),
  })
  ```
- `questionsJsonSchema`는 `generatedQuestionsResponseSchema.toJSONSchema()`로 자동 재생성됨 → Gemini가 새 스키마를 받아 도형 JSON 출력
- `validateGeneratedQuestions`에 figures 교차 검증 추가 ([MUST 1] duck typing 활용):
  ```typescript
  import { validateFigureIndices } from '@/lib/validations/figure-schema'

  // 기존 객관식 보기 검증 다음에:
  // FigureData[]의 length 프로퍼티를 duck typing으로 전달
  const warnings = validateFigureIndices(q.content, q.figures)
  if (warnings.length > 0) {
    console.warn('AI 생성 문제 figures 인덱스 불일치:', warnings)
  }
  ```
- `GeneratedQuestion` 반환 타입에 hasFigure, figures 포함 (리드가 types.ts 수정 완료 전제):
  ```typescript
  return {
    content: q.content,
    type: q.questionType as QuestionType,
    difficulty: q.difficulty,
    answer: q.answer,
    explanation: q.explanation,
    options: q.options,
    hasFigure: q.hasFigure,   // 추가
    figures: q.figures,        // 추가
  }
  ```

#### Step 2: question-generation.ts 프롬프트 수정
- 파일: `src/lib/ai/prompts/question-generation.ts` (기존)
- 작업: `SYSTEM_INSTRUCTION` 수정
  ```
  // 기존 규칙 2: "그래프나 그림이 필요한 문제는 텍스트로 상황을 설명하여 대체하세요."
  // 교체:
  '2. 도형, 그래프가 필요한 문제는 다음 형식으로 JSON 도형 데이터를 포함하세요:',
  '   - content에서 도형 위치에 {{fig:N}} 구분자를 삽입하세요 (N은 1부터 시작)',
  '   - figures 배열에 해당 도형의 JSON 데이터를 포함하세요',
  '   - hasFigure: true로 설정하세요',
  '   - 지원 타입: coordinate_plane, function_graph (최대 20개 포인트), polygon, circle, vector, number_line',
  '   - 도형 없이 텍스트로 충분히 표현 가능하면 hasFigure: false, figures 생략',
  ```

#### Step 3: past-exam-generation.ts 프롬프트 수정
- 파일: `src/lib/ai/prompts/past-exam-generation.ts` (기존)
- 작업: Step 2와 동일한 규칙 2 수정 (독립 상수이므로 별도 수정)

#### Step 4: Gemini discriminated union 호환성 E2E 검증 ([SHOULD 7])
- Task 10a 완료 후 수동 검증 단계:
  1. `questionsJsonSchema`가 올바르게 생성되는지 로컬에서 출력 확인
     ```typescript
     // 임시 스크립트 또는 console.log로 확인
     console.log(JSON.stringify(questionsJsonSchema, null, 2))
     ```
  2. 실제 Gemini API에 프롬프트 전송 → figures 포함 JSON 응답 수동 확인
     - `coordinate_plane` 타입 응답이 정상 파싱되는지 확인
     - `function_graph` 타입의 points가 배열로 반환되는지 확인
  3. 이 검증은 단위 테스트(Task 11)로는 불가 — 수동 E2E 확인 필수

#### 빌드 체크
- `npm run build` 실행
- 예상 결과: 성공. `GeneratedQuestion` 타입에 hasFigure/figures 추가되어 있어야 에러 없음

#### 에이전트 프롬프트 가이드
- "기존 패턴 확인":
  - `src/lib/ai/validation.ts` 전체 구조 (기존 패턴 유지)
  - `src/lib/ai/prompts/question-generation.ts`의 SYSTEM_INSTRUCTION 배열 작성 방식
- "금지 사항":
  - `extractedQuestionSchema` 또는 `figureInfoSchema` 수정 금지 (extraction-validation.ts 파일)
  - figures 검증에서 throw 금지 (경고 로그만)
  - 객관식 보기 5개 검증 로직 제거/변경 금지 (기존 비즈니스 규칙 유지)

---

### Task 10b: save-questions 도형 컬럼 확장

**Wave**: 4 | **소유**: backend-actions | **작업량**: S
**의존**: Task 2 (figureDataSchema), Task 1 (DB 컬럼 추가)

> Task 10a와 병렬 가능 (서로 다른 파일)

#### Step 1: save-questions 검증 스키마 확장
- 파일: `src/lib/validations/save-questions.ts` (기존)
- 작업: `questionToSaveSchema`에 도형 필드 추가
  ```typescript
  import { figureDataSchema } from '@/lib/validations/figure-schema'

  export const questionToSaveSchema = z.object({
    // 기존 필드 유지
    content: z.string().min(1, '문제 내용이 비어있습니다.'),
    type: z.enum(['multiple_choice', 'short_answer', 'essay'], { ... }),
    difficulty: z.enum(['easy', 'medium', 'hard'], { ... }),
    answer: z.string().min(1, '정답이 비어있습니다.'),
    explanation: z.string().optional(),
    options: z.array(z.string()).optional(),
    // 추가 (optional — 하위 호환)
    hasFigure: z.boolean().optional(),
    figures: z.array(figureDataSchema).optional(),
  })
  ```
- 주의사항: 기존 `saveQuestionsRequestSchema`, `SaveQuestionsRequest`, `QuestionToSave` 타입 변경 자동 반영됨

#### Step 2: save-questions Action DB INSERT 확장
- 파일: `src/lib/actions/save-questions.ts` (기존)
- 작업: `toQuestionInsertRow` 함수에 도형 컬럼 추가
  ```typescript
  function toQuestionInsertRow(question: QuestionToSave, meta: {...}) {
    return {
      // 기존 필드 유지 (변경 없음)
      academy_id: meta.academyId,
      // ...

      // 추가: 도형 컬럼 (Task 1 마이그레이션으로 추가된 컬럼)
      has_figure: question.hasFigure ?? false,
      figures: question.figures ?? null,  // Supabase가 JSONB로 자동 직렬화
    }
  }
  ```
- 주의사항:
  - `has_figure`: `question.hasFigure ?? false` (미전달 시 false)
  - `figures`: `question.figures ?? null` (미전달 시 null)
  - DB INSERT의 academy_id 필터가 이미 있음 → IDOR 방지 유지 (MEMORY.md 교훈)

#### 빌드 체크
- `npm run build` 실행
- 예상 결과: 성공

#### 에이전트 프롬프트 가이드
- "기존 패턴 확인": `src/lib/actions/save-questions.ts`의 `toQuestionInsertRow` 함수 전체, `src/lib/validations/save-questions.ts`의 스키마 구조
- "금지 사항":
  - 기존 필드 변경/제거 금지
  - `pastExamId` UUID 검증 로직 변경 금지
  - academy_id 필터 로직 변경 금지 (IDOR 방지)

---

## Wave 5: 전체 테스트

### Task 11: 전체 테스트

**Wave**: 5 | **소유**: tester | **작업량**: M
**의존**: Task 2~10 전체 완료 후

> **[CONSIDER 13] 참고**: Task 2(figure-schema.ts) 완료 직후 `figure-schema.test.ts` 스키마 단위 테스트 선행 작성 가능 (권장). Wave 5에서 전체 통합 시 포함.

#### 테스트 파일 구조 및 케이스 (~68개)

**파일 1**: `src/lib/validations/__tests__/figure-schema.test.ts` (~20개)
```
// @vitest-environment node (DOM 불필요)
- 6타입 유효 케이스 각 1개 (coordinate_plane, function_graph, polygon, circle, vector, number_line)
- 각 타입 무효 케이스:
  - coordinate_plane: gridStep=0 → 실패
  - function_graph: points 1개 → 실패, points 51개 → 실패
  - polygon: vertices 2개 → 실패
  - circle: radius=0 → 실패
  - vector: from===to (제로 벡터) → 실패
  - number_line: min >= max → 실패, points 빈 배열 → 실패
- displaySize 미전달 시 'large' default 적용
- validateFigureIndices: figures=undefined → 빈 배열 반환 (건너뜀)
- validateFigureIndices: {{fig:2}} 있고 figures.length=1 → 경고 반환
- validateFigureIndices: {{fig:1}} 있고 figures.length=1 → 정상 (빈 배열)
```

**파일 2**: `src/components/ui/__tests__/figure-renderer.test.tsx` (~6개)
```
// @vitest-environment jsdom
- 미구현 타입 (Wave 1 초기) → description 텍스트 표시 확인
- number_line 타입 → NumberLine 컴포넌트 렌더링
- coordinate_plane 타입 → CoordinatePlane 컴포넌트 렌더링
- displaySize='large' → SVG 240px
- displaySize='small' → SVG 160px
- React.memo: 동일 props → 리렌더 없음
```

**파일 3**: `src/components/ui/svg/__tests__/` 디렉토리 (~24개)
```
// @vitest-environment jsdom (각 파일에 주석)
number-line.test.tsx:
  - viewBox가 min/max 범위 포함
  - points가 SVG에 렌더링됨
  - displaySize='large' vs 'small' SVG 크기 차이
  - 레이블 텍스트 표시

coordinate-plane.test.tsx:
  - x축, y축 렌더링 확인
  - 그리드 렌더링 확인 (gridStep 간격)
  - 원점 'O' 라벨

function-graph.test.tsx:
  - <polyline> 엘리먼트 존재
  - points 좌표가 SVG 범위 내
  - CoordinatePlaneContent 합성 확인 (x축 y축 존재)

polygon.test.tsx:
  - <polygon points="..."> 렌더링
  - labels 텍스트 표시

circle-shape.test.tsx:
  - <circle cx cy r> 속성 확인
  - 중심점 렌더링

vector-arrow.test.tsx:
  - <line> 렌더링
  - marker-end 화살표 속성
```

**파일 4**: `src/components/ui/__tests__/latex-renderer-figure.test.tsx` (~8개)
```
// @vitest-environment jsdom
- figures prop 전달 + {{fig:1}} → FigureRenderer 렌더링
- figures prop 없음 + {{fig:1}} → [도형 1] 플레이스홀더
- figures[0] 있고 {{fig:1}} → figures[0] 렌더링 (1-based 인덱스 확인)
- figures 인덱스 초과 {{fig:3}}, figures.length=1 → 플레이스홀더
- 연속 도형 {{fig:1}}{{fig:2}} → flex flex-row 래퍼
- 단독 블록 도형 (줄바꿈으로 감싸진 {{fig:1}}) → justify-center 래퍼
- 인라인 도형 (텍스트 중간 {{fig:1}}) → inline-flex 래퍼
- 기존 LatexRenderer에 figures 없이 호출 → 타입 에러 없음
```

**파일 5**: `src/lib/ai/__tests__/figure-prompt.test.ts` (~4개)
```
// @vitest-environment node
- buildQuestionGenerationPrompt systemInstruction에 '{{fig:N}}' 포함 확인 (문자열 검사)
- buildPastExamGenerationPrompt systemInstruction에 '{{fig:N}}' 포함 확인
- generatedQuestionsResponseSchema: figures 포함 유효 JSON 파싱 성공
- generatedQuestionsResponseSchema: figures 없음 → hasFigure: false, figures undefined
```

**파일 6**: `src/lib/validations/__tests__/figure-schema.test.ts` 내 교차 검증 (~6개)
```
(파일 1에 포함)
- validateFigureIndices: 정상 케이스 (경고 없음)
- validateFigureIndices: figures undefined → 빈 배열
- validateFigureIndices: 인덱스 초과 → 경고 메시지 포함
- validateFigureIndices: {{fig:1}} {{fig:2}} 모두 유효 → 빈 배열
- validateFigureIndices: questionText에 {{fig:N}} 없음 → 빈 배열
- /g 플래그 lastIndex 리셋: 동일 함수 2회 호출 → 두 번째 호출도 정상
```

#### 테스트 환경 주의사항
- React 컴포넌트 테스트 파일 상단: `// @vitest-environment jsdom` 주석 필수 (MEMORY.md 교훈)
- 순수 Zod/유틸 테스트: `// @vitest-environment node`
- 기존 테스트 패턴 참조: `src/lib/ai/__tests__/validation.test.ts` (팩토리 함수 패턴)
- **기존 LatexRenderer 테스트 패턴** ([CONSIDER 16]): `src/components/ui/__tests__/latex-renderer.test.tsx`는 `renderToString` 방식 사용 (jsdom 없이 node 환경). SVG 컴포넌트 테스트는 testing-library 방식 또는 renderToString 방식 중 기존 코드베이스 패턴 따를 것

#### 에이전트 프롬프트 가이드
- "기존 패턴 확인": `src/lib/ai/__tests__/validation.test.ts`의 팩토리 함수 패턴, `src/components/ui/__tests__/latex-renderer.test.tsx`의 renderToString 패턴
- "금지 사항":
  - `// @vitest-environment jsdom` 주석 누락 금지 (React 컴포넌트 테스트)
  - 구현 파일(`src/` 내 `__tests__/` 외) 수정 금지
  - 80% 미만 커버리지 허용 금지
- **CSS import 처리** ([CONSIDER 16]): KaTeX CSS는 `latex-renderer.tsx`에서 이미 import됨. 테스트 환경에서 CSS import 에러 발생 시 `vitest.config.ts`의 css 설정 또는 mock 확인. 기존 `latex-renderer.test.tsx`가 정상 동작하면 동일 패턴 따를 것.

---

## 검증 체크리스트 (Wave별)

| Wave | 완료 조건 |
|------|----------|
| Wave 1 | Task 1~3 완료 + `npm run build` 성공 |
| 리드 선행 | types.ts FigureData 추가 + `npm run build` 성공 |
| Wave 2 | Task 4~6 완료 + `npm run build` 성공 |
| Wave 3a (1단계) | Task 7a(coordinate_plane + CoordinatePlaneContent) 완료 + `npm run build` 성공 |
| Wave 3a (2단계) | Task 7b(function_graph 합성) 완료 + `npm run build` 성공 |
| Wave 3b | Task 8(polygon + circle + vector) 완료 + `npm run build` 성공 |
| Wave 4 | Task 9 + 10a + 10b 완료 + `npm run build` 성공 |
| Wave 5 | 68개 테스트 통과 + 커버리지 80%+ |

---

## MEMORY.md 교훈 체크리스트 (에이전트 공통)

| 교훈 | 적용 위치 |
|------|---------|
| `/g` 플래그 정규식 `lastIndex = 0` 리셋 | Task 2 `validateFigureIndices`, Task 6 교차 검증 |
| React 컴포넌트 테스트 `// @vitest-environment jsdom` | Task 11 모든 컴포넌트 테스트 |
| Step 단위 빌드 확인 | 각 Task 완료 시 `npm run build` |
| "기존 패턴 먼저 확인" | 모든 에이전트 프롬프트에 명시 |
| academy_id IDOR 방지 | Task 10b `toQuestionInsertRow` |
| `Zod v4 errorMap → error 키` | Task 2 Zod 스키마 작성 시 |
| Task 4 완료 전 Task 9 시작 금지 | Wave 4 latex-renderer.tsx 직렬 |
| `supabase gen types` CLI 실행 금지 | Task 1 에이전트 가이드 |
| `useEffect race condition` | **해당 없음** — SVG JSX 렌더링, useEffect 없음 ([CONSIDER 14]) |
| `dangerouslySetInnerHTML` XSS | **해당 없음** — 순수 SVG JSX, innerHTML 미사용 ([CONSIDER 14]) |
