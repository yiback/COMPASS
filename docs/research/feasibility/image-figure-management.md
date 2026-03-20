# 그래프·도형 이미지 관리 방식 실현 가능성 평가

> **작성일**: 2026-03-19
> **역할**: feasibility-analyst
> **컨텍스트**: Next.js 16 + React 19 + Supabase + Google Gemini + Vercel
> **평가 대상**: 기출 추출(PLAN v6) + 문제 생성(generate-questions) 통합 그래프/도형 관리 패턴

---

## 1. 기존 코드베이스 분석 요약

### 현재 AI 추상화 레이어

`src/lib/ai/types.ts`에서 **Strategy 패턴** 기반 `AIProvider` 인터페이스를 사용:

```typescript
interface PromptConfig {
  readonly systemInstruction: string
  readonly userPrompt: string
  readonly responseSchema: unknown
  readonly temperature: number
  readonly maxOutputTokens: number
  // PLAN v6 추가 예정:
  // readonly imageParts?: readonly ImagePart[]
}
```

`GeminiProvider`는 `generateQuestions`에서 `prompt.userPrompt`를 문자열로 직접 Gemini SDK에 전달. PLAN v6에서 `imageParts` 분기를 추가할 예정 — 이미 설계 확정.

### Storage 패턴

`past-exams.ts`에서 `createAdminClient()`로 RLS 우회 후 Storage 업로드:
- 경로 구조: `{academyId}/{schoolId}/{year}-{semester}-{examType}/{fileId}.{ext}`
- DB에는 경로(String)만 저장 → 조회 시 Signed URL 생성(60초 만료)
- 이 패턴이 그래프 crop 저장에도 그대로 적용 가능

### questions 테이블 구조

`supabase/migrations/00001_initial_schema.sql` 기준:
- `content TEXT NOT NULL` — 문제 내용 (현재 텍스트 전용)
- `options JSONB` — 객관식 보기 배열
- `source_metadata JSONB DEFAULT '{}'` — 출처 스냅샷 (비정규화)
- `is_ai_generated`, `ai_model`, `ai_review_status` 등 AI 메타데이터

`save-questions.ts`에서 `source_metadata`에 `{ pastExamId, schoolId, schoolName, year, ... }`를 저장하는 패턴 확인.
**현재 `questions` 테이블에 그래프/도형 URL을 저장하는 컬럼이 없다.**

### PLAN v6의 FigureInfo 타입

```typescript
interface FigureInfo {
  readonly url: string             // Storage 경로 (crop 후)
  readonly description: string     // AI가 생성한 설명
  readonly boundingBox: {
    readonly x: number             // normalized 0~1
    readonly y: number
    readonly width: number
    readonly height: number
  }
  readonly pageNumber: number
  readonly confidence: number
}
```

`past_exam_details.figures JSONB` 컬럼에 배열로 저장. 기출 추출 전용 설계.

### generate-questions 흐름

`generate-questions.ts` → `createAIProvider()` → `provider.generateQuestions(params)` → `buildPastExamGenerationPrompt` or `buildQuestionGenerationPrompt`.

현재 생성된 문제(`GeneratedQuestion`)에는 **이미지/도형 필드가 없다**:
```typescript
interface GeneratedQuestion {
  readonly content: string
  readonly type: QuestionType
  readonly difficulty: 'easy' | 'medium' | 'hard'
  readonly answer: string
  readonly explanation?: string
  readonly options?: readonly string[]
  // figures 없음
}
```

---

## 2. 5가지 방식 실현 가능성 평가

---

### 방식 A: AI bounding box + sharp crop (현재 PLAN v6 방식)

**개요**: Gemini Vision이 이미지에서 그래프/도형의 bounding box(normalized 0~1) 좌표를 반환 → `sharp`로 crop → Supabase Storage 업로드 → `FigureInfo.url`에 경로 저장.

#### 기존 아키텍처 호환성

| 항목 | 평가 | 설명 |
|------|------|------|
| `AIProvider` 인터페이스 | ✅ 호환 | `PromptConfig.imageParts` 추가(PLAN v6 이미 설계)로 Vision 지원 |
| `PromptConfig` | ✅ 호환 | `imageParts?: ImagePart[]` 추가로 기존 코드 무영향 (Optional) |
| Storage 패턴 | ✅ 동일 | `createAdminClient()` + 경로 저장 패턴 그대로 재사용 |
| Signed URL 패턴 | ✅ 동일 | 조회 시 생성, 만료 제어 — 기존과 동일 |
| `figures JSONB` | ✅ 설계됨 | `past_exam_details.figures`에 `FigureInfo[]` 배열 저장 |
| `questions` 테이블 | ⚠️ 변경 필요 | `figures JSONB` 컬럼 없음 → 문제 생성 연동 시 추가 필요 |

#### 변경 범위

**기출 추출 전용 (PLAN v6 범위)**:
- `src/lib/ai/types.ts` (수정) — `FigureInfo`, `ExtractedQuestion.figures` 추가
- `src/lib/actions/extract-questions.ts` (신규) — sharp crop 로직 포함
- `supabase/migrations/20260315_*.sql` (신규) — `past_exam_details.figures JSONB`

**문제 생성 연동 (추가 필요)**:
- `src/lib/ai/types.ts` — `GeneratedQuestion.figures?: FigureInfo[]` 추가
- `supabase/migrations/` — `questions.figures JSONB` 컬럼 추가
- `src/lib/actions/save-questions.ts` — `figures` 저장 로직 추가

#### 예상 작업량: **M (기출 추출) + S (문제 생성 연동)**

`sharp`는 Node.js native 모듈 — `export const runtime = 'nodejs'` 필수. package.json에 의존성 추가 필요(현재 없음).

#### 기존 패턴 일관성: 높음

- Admin Storage 업로드 → 경로 DB 저장 → 조회 시 Signed URL 생성 패턴과 완전히 동일
- `JSONB` 컬럼 활용은 `questions.options`, `questions.source_metadata`와 동일

#### DB 스키마 변경

- `past_exam_details.figures JSONB` — PLAN v6에 이미 포함
- `questions.figures JSONB` — 문제 생성 연동 시 신규 마이그레이션 필요

#### 통합 FigureInfo 타입 설계 가능성

기출 추출과 문제 생성 모두 동일한 `FigureInfo` 타입 재사용 가능:
```typescript
// src/lib/ai/types.ts에 단일 정의
interface FigureInfo {
  readonly url: string
  readonly description: string
  readonly boundingBox: { x: number; y: number; width: number; height: number }
  readonly pageNumber: number
  readonly confidence: number
}
```
`ExtractedQuestion.figures`, `GeneratedQuestion.figures` 모두 이 타입 참조.

**주요 리스크**:
- AI bounding box 정확도 의존 (normalize 좌표 오차 가능)
- sharp native module — Vercel 함수 환경에서 지원 확인 필요
- 기출 원본 이미지가 없으면 crop 불가 → 문제 생성 시 원본 이미지 필요

---

### 방식 B: AI가 SVG/코드로 직접 생성

**개요**: Gemini에게 그래프/도형을 SVG 코드나 수식으로 직접 생성하도록 프롬프트 설계. Storage 업로드 없이 텍스트 형태로 DB 저장.

#### 기존 아키텍처 호환성

| 항목 | 평가 | 설명 |
|------|------|------|
| `AIProvider` 인터페이스 | ✅ 호환 | Vision API 불필요. 기존 텍스트 생성 흐름 그대로 |
| `PromptConfig` | ✅ 무변경 | `imageParts` 없이 프롬프트만 확장 |
| Storage 패턴 | ✅ 불필요 | 파일 저장 없음 |
| `questions.content` | ⚠️ 확장 필요 | SVG 코드를 content에 포함하거나 별도 JSONB 필드 필요 |
| `questions` 테이블 | ⚠️ 변경 필요 | `figure_svg TEXT` 또는 기존 `content`에 마크업 포함 |

#### 변경 범위

**영향 파일 (최소)**:
- `src/lib/ai/types.ts` (수정) — `GeneratedQuestion.figureSvg?: string` 추가
- `src/lib/ai/prompts/` (수정) — SVG 생성 프롬프트 추가
- `src/lib/actions/save-questions.ts` (수정) — SVG 저장
- 프론트엔드 렌더링: `dangerouslySetInnerHTML` 또는 SVG 파서 필요

#### 예상 작업량: **S (저장/백엔드) + M (프론트엔드 렌더링 + 보안 처리)**

#### 주요 리스크

1. **AI SVG 생성 품질**: Gemini가 수학적으로 정확한 SVG를 일관되게 생성하지 못할 가능성 높음. 좌표 계산 오류, 레이아웃 오류 빈발.
2. **XSS 보안**: SVG를 DOM에 직접 삽입하면 `<script>`, `onload` 등 XSS 공격 벡터. DOMPurify 등 sanitize 필수 → 의존성 추가.
3. **기출 추출과 미연결**: 기출 이미지에서 실제 그래프를 SVG로 역변환하는 것은 현재 AI 능력으로 정확도 낮음.
4. **렌더링 일관성**: SVG 뷰포트, 폰트, 브라우저별 차이 존재.

**기출 추출(이미지 기반)에는 적용 불가** — 이미지 안 도형을 SVG로 역변환하는 것은 별개 문제.

---

### 방식 C: LaTeX + tikz/pgfplots 수식·그래프 통합 렌더링

**개요**: 수식은 `$...$`, 그래프는 `tikz` 코드로 표현. 렌더링은 KaTeX(수식) + tikzjax 또는 서버사이드 LaTeX 컴파일러 사용.

#### 기존 아키텍처 호환성

| 항목 | 평가 | 설명 |
|------|------|------|
| `AIProvider` 인터페이스 | ✅ 호환 (부분) | 수식 LaTeX는 기존 텍스트 생성으로 가능 |
| tikz 렌더링 | ❌ 미지원 | tikzjax는 WebAssembly 기반, Vercel Edge/Node 불가 |
| 서버사이드 LaTeX | ❌ 불가 | pdflatex/xelatex은 서버 바이너리 필요 — Vercel Serverless 환경 불가 |
| `questions.content` | ⚠️ 마크업 혼재 | LaTeX 코드를 content에 포함하거나 별도 필드 |
| 기존 Storage 패턴 | ✅ 불필요 (또는 렌더링 결과 저장) | |

#### 예상 작업량: **L (렌더링 인프라) + M (AI 프롬프트)**

#### 주요 리스크

1. **Vercel 환경 제약**: 서버사이드 LaTeX 컴파일 불가. tikzjax 클라이언트 렌더링은 초기 로드 지연(WASM 수십 MB).
2. **AI LaTeX 생성 품질**: Gemini는 LaTeX 수식(KaTeX 범위)은 잘 생성하지만 tikz 코드는 복잡한 그래프에서 오류 빈발.
3. **한국 교과서 그래프**: 좌표 평면, 함수 그래프 등은 tikz로 표현 가능하나, 복잡한 도형(그림 문제 등)은 불가.
4. **기출 추출과의 괴리**: 기출 이미지의 실제 그래프를 tikz 코드로 역변환하는 파이프라인이 별도 필요.
5. **의존성**: `katex`, `tikzjax` 등 신규 의존성 다수 추가.

**현재 Vercel 기반 배포 환경에서 실질적으로 구현 불가.**

---

### 방식 D: Canvas/SVG 클라이언트 렌더링 (Konva.js, Fabric.js 등)

**개요**: 클라이언트에서 Canvas API 또는 라이브러리로 그래프/도형을 인터랙티브하게 그리고 저장. AI는 도형 데이터(좌표, 형태) 생성, 클라이언트가 렌더링.

#### 기존 아키텍처 호환성

| 항목 | 평가 | 설명 |
|------|------|------|
| `AIProvider` 인터페이스 | ⚠️ 대폭 변경 | 이미지 대신 도형 데이터 JSON 반환하도록 응답 스키마 변경 |
| Storage 패턴 | ⚠️ 변경 | Canvas toDataURL() → blob → Storage 업로드 (선택적) |
| `questions.content` | ⚠️ 변경 | 도형 데이터 JSONB 필드 추가 |
| 기출 추출 연동 | ❌ 어려움 | 기출 이미지 → 도형 데이터 역변환 정확도 낮음 |

#### 예상 작업량: **L**

- Konva.js/Fabric.js 학습 곡선
- AI 응답 스키마(도형 JSON) 설계
- 클라이언트 렌더링 컴포넌트 신규 개발
- `questions` 테이블 스키마 대폭 변경

#### 주요 리스크

1. **문제 생성 컨텍스트 부적합**: AI가 임의 도형 데이터를 생성하는 것은 "기출문제 기반 생성" 요구사항과 맞지 않음.
2. **기출 추출 연동 불가**: 기출 이미지의 도형을 좌표 데이터로 역변환하는 파이프라인 없음.
3. **번들 크기**: Konva.js ~700KB, Fabric.js ~1MB+ — 페이지 로드 성능 저하.
4. **인쇄/PDF**: Canvas 기반 콘텐츠는 인쇄 시 깨지는 경우 많음.
5. **기존 패턴과 단절**: 현재 모든 문제 콘텐츠는 텍스트 기반(`content TEXT`) — 아키텍처 대변환.

**MVP 범위 내 적용은 과도한 복잡도.**

---

### 방식 E: 외부 수학 렌더링 서비스 (Desmos API, GeoGebra 등)

**개요**: 그래프는 Desmos API 또는 GeoGebra 임베드로 렌더링. AI가 수식/함수를 생성 → 서비스 URL 또는 파라미터로 저장.

#### 기존 아키텍처 호환성

| 항목 | 평가 | 설명 |
|------|------|------|
| `AIProvider` 인터페이스 | ✅ 부분 호환 | AI는 수식 텍스트(예: `y = 2x + 1`)만 생성 → Desmos URL로 변환 |
| Storage 패턴 | ✅ 불필요 | 외부 서비스 URL 또는 수식 저장 |
| `questions.content` | ⚠️ 확장 | 수식 또는 Desmos URL 저장 필드 추가 |
| 기출 추출 연동 | ❌ 어려움 | 기출 이미지 그래프 → 수식 역변환 정확도 낮음 |

#### 예상 작업량: **M (수식 생성) + M (UI 임베드)**

#### 주요 리스크

1. **외부 서비스 의존성**: Desmos/GeoGebra API 가용성, 약관, 오프라인 동작 불가.
2. **수식 그래프만 가능**: 함수 그래프(y=f(x))는 Desmos로 표현 가능하나, 한국 시험지의 **도형 문제**(삼각형, 원, 비례도 등)는 Desmos로 표현 불가.
3. **기출 추출 미연결**: 기출 이미지 안의 그래프를 Desmos 수식으로 역변환하는 것은 현재 AI 능력 범위 밖.
4. **인쇄/PDF**: 임베드 iframe은 인쇄 시 표시 불안정.
5. **이미지 기반 문제 처리 불가**: 기출 이미지의 도형 문제는 수식으로 환원 불가.

**함수 그래프 전용 케이스에만 제한적 적용 가능. 범용 솔루션 아님.**

---

## 3. 비교 테이블

| 항목 | A (sharp crop) | B (AI SVG 생성) | C (LaTeX/tikz) | D (Canvas 라이브러리) | E (외부 서비스) |
|------|--------------|---------------|--------------|-----------------|--------------|
| 기존 AIProvider 호환 | ✅ 높음 | ✅ 높음 | ⚠️ 부분 | ⚠️ 변경 필요 | ✅ 부분 |
| 기존 Storage 패턴 일관성 | ✅ 동일 패턴 | ✅ 불필요 | ✅ 불필요 | ⚠️ 변형 | ✅ 불필요 |
| DB 스키마 변경 | 최소 (JSONB 1개) | 최소 | 최소 | 대폭 변경 | 소규모 |
| 기출 추출 적용 가능 | ✅ 핵심 기능 | ❌ 불가 | ❌ 불가 | ❌ 어려움 | ❌ 불가 |
| 문제 생성 적용 가능 | ✅ 부분 (원본 이미지 필요) | ⚠️ 품질 불안정 | ✅ 수식 한정 | ⚠️ 과도한 복잡도 | ✅ 함수 그래프 한정 |
| 통합 FigureInfo 타입 설계 | ✅ 가능 | ⚠️ 별도 타입 | ❌ 불일치 | ❌ 완전 다름 | ❌ 불일치 |
| 예상 작업량 | M | S+M | L | L | M+M |
| Vercel 배포 호환 | ✅ Node.js 명시 필요 | ✅ | ❌ 서버 바이너리 불가 | ✅ | ✅ (외부 의존) |
| XSS/보안 리스크 | 낮음 | 높음 (sanitize 필수) | 낮음 | 낮음 | 낮음 (외부 iframe) |
| 신규 의존성 | `sharp` (1개) | DOMPurify (1개) | `katex`, `tikzjax` (2개+) | Konva/Fabric (1개 대형) | 없음 |
| 한국 교과서 도형 지원 | ✅ 이미지 그대로 | ⚠️ 단순 도형만 | ⚠️ 제한적 | ⚠️ 개발 필요 | ❌ 불가 |

---

## 4. 추천안 + 이유

### 추천: **방식 A (AI bounding box + sharp crop)**

단, 문제 생성(generate-questions) 연동을 위한 **단계적 확장 전략** 채택.

---

### 추천 이유

**1. 기존 아키텍처와 가장 높은 일관성**

현재 코드베이스의 Storage 패턴(경로 저장 + Signed URL 조회)과 동일. `createAdminClient()` 패턴 재사용. 신규 패턴 없음.

**2. PLAN v6이 이미 설계를 완료**

`FigureInfo` 타입, `figures JSONB` 컬럼, `imageParts` 분기, `sharp crop 로직`이 모두 v6 PLAN에 포함. 별도 설계 작업 불필요.

**3. 기출 추출 + 문제 생성 통합 가능**

두 케이스 모두 동일한 `FigureInfo` 타입 재사용 가능:
- 기출 추출: `past_exam_details.figures` (이미지에서 crop)
- 문제 생성: `questions.figures` (기출 이미지 참조 시 crop, 또는 null)

`src/lib/ai/types.ts`에 단일 `FigureInfo` 인터페이스를 정의하고 두 흐름에서 참조.

**4. 한국 교과서 도형 완벽 지원**

이미지를 그대로 보존하므로 수식, 좌표 그래프, 삼각형, 원, 기하 도형 등 모든 유형 지원. LaTeX/SVG/Desmos는 도형 문제 처리 불가.

**5. 유일하게 기출 추출에서도 동작**

기출 이미지 안의 실제 도형을 보존하는 방식은 A뿐. B/C/D/E는 기출 이미지 → 코드/수식 역변환이 필요하나 현재 AI 정확도로 신뢰 불가.

---

### 단계적 확장 전략

```
Phase 1 (현재 PLAN v6):
  기출 추출 → AI bounding box → sharp crop → Storage
  past_exam_details.figures JSONB 저장

Phase 2 (문제 생성 연동):
  GeneratedQuestion에 figures 추가
  questions.figures JSONB 컬럼 신규 마이그레이션
  save-questions.ts에 figures 저장 로직 추가
  (작업량: S — PLAN v6 구현 후 자연스럽게 확장)
```

---

### 주요 리스크 및 완화 방안

| 리스크 | 심각도 | 완화 방안 |
|--------|--------|----------|
| `sharp` Vercel 배포 호환 | 중간 | `export const runtime = 'nodejs'` 명시 + Vercel Fluid Compute 확인 |
| AI bounding box 정확도 | 높음 | `confidence` 필드 포함 + 사용자 리뷰 UI + AI 재분석 기능 |
| 기출 원본 없이 문제 생성 시 crop 불가 | 낮음 | 문제 생성은 figures null 허용 (Optional 필드) |
| crop 이미지 Storage 비용 | 낮음 | 그래프 crop은 작은 파일(수 KB) + 중복 방지 로직 |
| sharp 의존성 미포함 | 낮음 | `npm install sharp` 후 package.json 추가 (PLAN v6에 명시됨) |

---

## 5. 결론

**방식 A가 유일하게 기출 추출과 문제 생성 두 케이스를 통합 패턴으로 관리할 수 있다.**

나머지 방식들은 기출 이미지 처리 불가(B/C/D/E)이거나 Vercel 환경 제약(C)이거나 아키텍처 대변환(D)이 필요하다. 방식 A는 PLAN v6의 기존 설계를 활용하면서 `questions.figures JSONB` 컬럼 추가만으로 문제 생성 연동을 완성할 수 있다.
