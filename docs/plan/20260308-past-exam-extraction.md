# 기출문제 이미지 → 개별 문제 자동 추출 계획

> **상태**: ✅ 구현 완료 (2026-03-20, 1238 tests PASS, 빌드 성공, 코드 리뷰 MUST FIX 4건 수정)
> **범위**: 단계 1 보완 — 3계층 테이블 + 다중 이미지 + AI 추출
> **의존**: 0-5 AI 추상화 레이어, 1-2 업로드 기능
> **변경**: v1→v2→v3→v4→v5→v6→v7→v8→v9(Tech Review v8 4건+Scope Review v8 4건 반영)

---

## v8→v9 변경 요약

총 8건의 리뷰 이슈를 반영했다 (실질 7건 — Scope CONSIDER 2는 Tech SHOULD FIX 1과 동일 결정). 주요 변경점:

### Storage 처리 명확화
1. **resetExtractionAction Storage 삭제 Non-blocking 확정**: Storage 삭제 실패 시 무시하고 계속 진행. orphan 파일은 Phase 2 cleanup job으로 처리 (Tech SHOULD FIX 1 + Scope CONSIDER 2)
2. **createPastExamAction 재업로드 시 Storage 파일 삭제 순서 구체화**: 기존 이미지 조회 → Storage 삭제(Non-blocking) → DB DELETE → 새 이미지 업로드 + INSERT (Tech SHOULD FIX 2)

### 주석/설명 추가
3. **reanalyzeQuestionAction 전체 이미지 전달 이유 명시**: 페이지 경계를 넘는 문제 가능성 + AI 컨텍스트 일관성 보장. maxDuration 60초 적용 + UI 로딩 표시 추가 (Tech CONSIDER 3)
4. **Storage RLS 경로 주석 보강**: 기존 RLS 정책이 split_part(name, '/', 1) 기반 → 신규 경로 구조에서도 동일 동작 확인 주석 (Tech CONSIDER 4)
5. **@dnd-kit 의존성 추가 타이밍 명시**: Step 6 착수 전 리드가 package.json에 추가 (Scope CONSIDER 3)
6. **exam-management.ts 배치 근거 주석**: 파일 크기 밸런싱 목적 명시 (Scope CONSIDER 4)

### 테스트 분리
7. **reanalyzeQuestionAction 테스트 별도 파일**: `reanalyze-question.test.ts` 신규 파일로 분리 (Scope SHOULD FIX 1)

---

## 문제 정의

현재 기출문제 이미지 1장을 업로드하면 DB에 1행만 저장되며,
이미지 안의 **개별 문제를 추출·구조화하는 로직이 없다**.

```
현재:  이미지 1장 → past_exam_questions 1행 (extracted_content: NULL)

목표:  시험 생성 (기말고사) → 이미지 N장 업로드 → AI 일괄 분석
       → 문제 M개 구조화 → 사용자 리뷰(수정/삭제/AI 재분석) → 확정 저장
```

### 데이터 관계 (3계층)

```
past_exams (시험 단위) — 신규
  │  "2025 1학기 기말고사 수학 중3"
  │
  ├── past_exam_images (이미지 단위) — 신규
  │     ├── page 1: 시험지_1.jpg
  │     ├── page 2: 시험지_2.jpg
  │     └── page 3: 시험지_3.jpg
  │
  └── past_exam_details (문제 단위) — 신규
        ├── Q1: 객관식 (confidence: 0.95 🟢)
        ├── Q2: 서술형 (이미지 1~2에 걸침, confidence: 0.72 🟡)
        ├── Q3: 단답형 (confidence: 0.88 🟢)
        └── ...
```

- 1 시험 → N 이미지 (page_number 순서)
- 1 시험 → M 문제 (AI가 모든 이미지를 한 번에 분석)
- 1 문제가 2 이미지에 걸칠 수 있음 (AI가 자동 인식)
- 이미지에 학생 풀이 흔적이 있을 수 있음 → AI가 무시하고 원본 문제만 추출

---

## 요구사항

| # | 요구사항 | 세부 |
|---|---------|------|
| R1 | API 교체 가능 | 현재 Gemini Vision, 향후 다른 API 교체 또는 사용자 선택 가능 |
| R2 | 자동 추출 + 편집 | 업로드 후 자동 추출 → 사용자 리뷰(수정/삭제) → 저장 |
| R3 | 3계층 테이블 | past_exams(시험) → past_exam_images(이미지) → past_exam_details(문제) |
| R4 | 다중 이미지 | 시험 단위로 모든 이미지를 업로드하고 일괄 처리 |
| R5 | AI 재분석 | 추출된 특정 문제에 대해 AI에게 재분석 요청 가능 |
| R6 | 리뷰 워크플로우 | 추출 결과 → 사용자에게 표시 → 직접 편집/삭제/AI 재분석 → 확정 저장 |
| R7 | 접근 제어 | teacher/admin/system_admin만 리스트·상세 조회 가능 (RLS) |
| R8 | 이미지 미리보기 + 순서 변경 | 업로드 시 썸네일 미리보기 + dnd-kit DnD 순서 조정 |
| R9 | 그래프/그림 crop 저장 | AI가 bounding box 반환 → sharp로 crop → Storage 저장 |

---

## 아키텍처 결정

### 1. 3계층 테이블 구조

```sql
-- 1계층: past_exams (시험 단위)
CREATE TABLE past_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES academies(id),
  school_id UUID NOT NULL REFERENCES schools(id),
  created_by UUID REFERENCES profiles(id),
  year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  semester INTEGER NOT NULL CHECK (semester IN (1, 2)),
  exam_type TEXT NOT NULL CHECK (exam_type IN ('midterm','final','mock','diagnostic')),
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 12),
  subject TEXT NOT NULL,
  extraction_status TEXT DEFAULT 'pending'
    CHECK (extraction_status IN ('pending','processing','completed','failed')),
  raw_ai_response TEXT,          -- AI 원본 응답 백업 (결정 3: A)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2계층: past_exam_images (이미지 단위)
-- (v8 반영) RLS 정책은 직접 보유한 academy_id를 사용 (JOIN 불필요)
CREATE TABLE past_exam_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  past_exam_id UUID NOT NULL REFERENCES past_exams(id) ON DELETE CASCADE,
  academy_id UUID NOT NULL REFERENCES academies(id),
  page_number INTEGER NOT NULL,
  source_image_url TEXT NOT NULL,  -- Storage 경로
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(past_exam_id, page_number)  -- (v8 반영) Tech MUST FIX 2: 동일 시험 동일 page_number 중복 삽입 방어
);

-- 3계층: past_exam_details (문제 단위)
-- (v8 반영) RLS 정책은 직접 보유한 academy_id를 사용 (JOIN 불필요)
CREATE TABLE past_exam_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  past_exam_id UUID NOT NULL REFERENCES past_exams(id) ON DELETE CASCADE,
  academy_id UUID NOT NULL REFERENCES academies(id),
  question_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL
    CHECK (question_type IN ('multiple_choice','short_answer','essay')),
  options JSONB,                   -- 객관식 보기 배열
  answer TEXT,                     -- 정답 (없을 수 있음)
  has_figure BOOLEAN DEFAULT false, -- 그래프/그림 포함 여부
  figures JSONB,                   -- crop된 그래프/그림 정보 배열
  -- confidence: AI가 해당 문제 추출의 정확도를 자체 평가한 수치
  --   🟢 >= 0.8: 높은 신뢰도 (추출 정확)
  --   🟡 0.5~0.8: 중간 (사용자 검토 권장)
  --   🔴 < 0.5: 낮은 신뢰도 (수동 확인 필수)
  confidence NUMERIC CHECK (confidence BETWEEN 0 AND 1),
  is_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### extraction_status 상태 전이 규칙 (v6 추가)

```
유효한 전이:
  pending    → processing   (추출 시작)
  processing → completed    (추출 성공)
  processing → failed       (추출 실패/타임아웃)
  completed  → pending      (전체 재추출 요청)
  failed     → pending      (재시도 요청)

무효한 전이 (방어):
  processing → processing   (Optimistic Lock으로 차단)
  completed  → processing   (pending 거쳐야 함)
  failed     → processing   (pending 거쳐야 함)
```

### 기존 past_exam_questions 처리 (v8 변경)

기존 테이블은 deprecated. **(v8 변경) Scope CONSIDER 3 반영: 기존 데이터는 개발 데이터이므로 이관하지 않고 새 테이블만 생성.**

```sql
-- (v8 변경) 데이터 이관 제거 — 기존 past_exam_questions 데이터는 개발 데이터이므로 삭제 후 시작
-- 새 테이블만 생성. past_exam_questions는 유지하되 deprecated 주석.
-- 기존 questions.source_metadata.pastExamId 참조도 개발 데이터이므로 무시.

-- ROLLBACK 절차 (v7 추가):
-- Step 1. DROP TABLE IF EXISTS past_exam_details;
-- Step 2. DROP TABLE IF EXISTS past_exam_images;
-- Step 3. DROP TABLE IF EXISTS past_exams;
-- Step 4. past_exam_questions의 deprecated 주석 제거
-- (CASCADE 제약 때문에 자식 테이블부터 삭제해야 함)
```

**영향 범위 (v6 정정)**: `src/` 내 `past_exam_questions` 직접 참조 **7개 파일** + UI 타입 변경 영향 **8개 파일** + validations **2개 파일** = **약 17개 파일**.

직접 참조 7개:

| 카테고리 | 파일 |
|---------|------|
| Action | `src/lib/actions/past-exams.ts` |
| Action | `src/lib/actions/generate-questions.ts` |
| Action | `src/lib/actions/save-questions.ts` |
| Test | `src/lib/actions/__tests__/past-exams.test.ts` |
| Test | `src/lib/actions/__tests__/save-questions.test.ts` |
| Test | `src/lib/actions/__tests__/generate-questions.test.ts` |
| Type | `src/types/supabase.ts` |

UI 타입 변경 영향 8개:

| 파일 |
|------|
| `src/app/(dashboard)/past-exams/page.tsx` |
| `src/app/(dashboard)/past-exams/_components/past-exams-toolbar.tsx` |
| `src/app/(dashboard)/past-exams/_components/past-exams-table.tsx` |
| `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` |
| `src/app/(dashboard)/past-exams/_components/past-exam-detail-sheet.tsx` |
| `src/app/(dashboard)/past-exams/_components/past-exam-columns.tsx` |
| `src/app/(dashboard)/past-exams/upload/upload-form.tsx` |
| `src/app/(dashboard)/past-exams/upload/page.tsx` |

Validations 2개:

| 파일 |
|------|
| `src/lib/validations/past-exams.ts` |
| `src/lib/validations/__tests__/past-exams.test.ts` |

### 2. AIProvider OCP 준수 (v6 변경: 리네이밍 → 새 메서드 추가)

- `AIProvider`: `processOCR` **유지** + `extractQuestions` **새 메서드 추가** (OCP)
- `OCRParams` / `OCRResult` 유지 (Phase 3 예정)
- `ExtractQuestionParams` / `ExtractQuestionResult` 신규 추가
- `ReanalyzeQuestionParams` 신규 추가

> v5에서는 `processOCR → extractQuestions` 리네이밍이었으나, Tech Review [SHOULD FIX] 6에 따라
> Breaking Change를 피하고 OCP를 준수하여 기존 메서드 유지 + 새 메서드 추가로 변경.

### 3. 이미지 → 텍스트 변환 (Vision API 상세 프로세스)

```
┌─────────────────────────────────────────────────────────────────────┐
│  이미지 → 구조화된 문제 추출 프로세스                                 │
└─────────────────────────────────────────────────────────────────────┘

1. Optimistic Lock (v6 추가)
   UPDATE past_exams SET extraction_status = 'processing'
     WHERE id = ? AND extraction_status IN ('pending', 'failed')
   → 영향 행 0이면 조기 반환 (다른 탭/사용자가 이미 처리 중)
   ↓
2. 이미지 수집
   past_exam_images에서 page_number 순으로 조회
   ↓
3. 이미지 → base64 변환 (v6 보강: 직렬 변환)
   각 이미지의 Signed URL 생성 (300초 만료)
   ⚠️ 이미지별 직렬 변환: fetch → base64 → imageParts 배열에 push
   (한 번에 모든 이미지를 메모리에 올리지 않고 순차 처리하여 피크 메모리 억제)
   위치: extractQuestionsAction 내 for...of 루프
   ↓
4. Gemini Vision API 호출
   ┌─────────────────────────────────────────────┐
   │  contents: [                                │
   │    { inlineData: { mimeType, data: b64_1 } }│  ← 이미지 1 (page 1)
   │    { inlineData: { mimeType, data: b64_2 } }│  ← 이미지 2 (page 2)
   │    { inlineData: { mimeType, data: b64_3 } }│  ← 이미지 3 (page 3)
   │    { text: systemPrompt + userPrompt }      │  ← 추출 지시
   │  ]                                          │
   │                                             │
   │  systemPrompt:                              │
   │    "한국 학교 시험지 이미지 분석 전문가.      │
   │     N장의 시험지를 순서대로 분석하세요.       │
   │     페이지 경계에 걸친 문제는 하나로 합치세요. │
   │     수식은 LaTeX 형태로 변환하세요.           │
   │     학생의 필기/답안 표시/풀이 흔적은 무시.    │
   │     그래프/그림/도형은 bounding box 좌표를    │
   │       normalized(0~1)로 반환 + 상세 설명.    │
   │     각 문제의 추출 신뢰도를 0.0~1.0으로 평가."│
   │                                             │
   │  config:                                    │
   │    temperature: 0.2 (정확성 우선)            │
   │    responseMimeType: 'application/json'     │
   │    responseSchema: extractionJsonSchema     │
   │    timeout: SDK requestOptions.timeout      │
   └─────────────────────────────────────────────┘
   ↓
5. AI 응답 파싱
   JSON 응답 → Zod 스키마 검증 (extractedQuestionSchema[])
   ↓
6. 신뢰도 계산
   각 문제별 confidence + 전체 overallConfidence (평균)
   ↓
7. DB 저장
   past_exam_details에 INSERT (문제별 1행)
   past_exams.raw_ai_response에 원본 백업
   past_exams.extraction_status = 'completed'
   ↓
8. 그래프 crop (R9)
   figures 배열의 각 항목에 대해:
   - pageNumber로 해당 이미지 선택
   - bounding box (normalized) → 실제 픽셀 좌표 변환
   - sharp로 crop → Buffer
   - createAdminClient()로 Storage에 업로드
     (v8 반영) Storage 경로: {academyId}/{pastExamId}/figures/{detailId}-{figureIndex}.jpg
   - figure.url에 Storage 경로 저장
   ⚠️ crop 개별 실패 시 (v7 SHOULD FIX 8 반영):
     figure.url = null 로 저장하고 나머지 crop은 계속 진행 (부분 성공)

⚠️ try/finally (v6 추가 / v7 isCompleted 패턴 명시):
   let isCompleted = false
   try {
     // ... 추출 작업 (1~8 단계) ...
     // DB UPDATE extraction_status = 'completed'
     isCompleted = true
   } finally {
     if (!isCompleted) {
       // DB UPDATE extraction_status = 'failed' (롤백 보장)
     }
   }
```

### 4. AI 재분석 기능 (R5)

특정 문제에 대해 AI에게 재분석을 요청하는 기능:

```
사용자: "3번 문제의 보기가 잘못된 것 같아" → [AI 재분석] 버튼 클릭

→ Server Action: reanalyzeQuestion(detailId, feedback?)
  1. 해당 문제가 속한 시험의 모든 이미지를 다시 조회
  2. AI에게 "3번 문제를 다시 분석해주세요. 사용자 피드백: ..." 전달
  3. AI 응답으로 해당 문제만 UPDATE
  4. confidence 재계산
```

> **(v9 반영) Tech CONSIDER 3**: 재분석 시 전체 이미지를 전달하는 이유 —
> 페이지 경계를 넘는 문제 가능성 + AI 컨텍스트 일관성 보장을 위해 전체 이미지 전달.
> 특정 페이지만 전달하면 앞뒤 맥락이 부족해 추출 정확도가 떨어질 수 있다.
> 대기시간이 수십 초에 달할 수 있으므로 Step 7 UI에 로딩 표시 필수.
> reanalyzeQuestionAction에도 `maxDuration = 60` 적용 필요 (extractQuestionsAction과 동일).
>
> **v7 변경**: `reanalyzeQuestionAction`은 Step 5에서 **Step 7(편집 UI)**로 이동.
> [AI 재분석] 버튼과 해당 Action은 동시에 필요하며, 편집 UI와 함께 구현하는 것이 자연스럽다.
>
> **(v8 반영) Scope CONSIDER 2**: `reanalyzeQuestionAction`은 `src/lib/actions/extract-questions.ts`에 배치 (backend-actions 소유). Step 7 UI는 이 Action을 import하여 호출.

**사용자 직접 편집**: AI 재분석 외에도, 사용자가 각 문제를 직접 수정할 수 있다 (문제 텍스트, 보기, 정답, 문제 유형 등). Step 7 편집 UI에서 인라인 편집 + `updateExtractedQuestion` Action으로 처리.

### 5. PromptConfig 확장 (결정 2: A) + imageParts 분기 (v6 보강)

```typescript
interface PromptConfig {
  readonly systemInstruction: string
  readonly userPrompt: string
  readonly responseSchema: unknown
  readonly temperature: number
  readonly maxOutputTokens: number
  readonly imageParts?: readonly ImagePart[]  // 신규
}

interface ImagePart {
  readonly mimeType: string
  readonly data: string  // base64
}
```

**GeminiProvider contents 구성 분기 (v6 추가)**:
```typescript
// imageParts가 있으면 Part 배열로 구성
const contents = prompt.imageParts
  ? [...prompt.imageParts.map(img => ({
      inlineData: { mimeType: img.mimeType, data: img.data }
    })), { text: prompt.userPrompt }]
  : prompt.userPrompt  // 기존 동작 유지 (문자열)
```

기존 `generateQuestions`는 `imageParts` 미제공 → 기존 동작 그대로 유지.
`extractQuestions`는 `imageParts` 제공 → Part 배열로 변환.

### Storage 경로 구조 (v8 반영)

**(v8 반영) Tech MUST FIX 1: 원본/crop Storage 경로 구조를 pastExamId 기반으로 통일.**

```
원본 이미지: {academyId}/{pastExamId}/{page_number}-{fileId}.{ext}
crop 이미지: {academyId}/{pastExamId}/figures/{detailId}-{figureIndex}.jpg
```

- pastExamId 기반 디렉토리 구조로 시험 단위 일괄 삭제/조회 용이
- page_number 접두사로 파일명만으로 순서 파악 가능
- fileId는 UUID로 파일명 충돌 방지

### 이미지 순서 보장

`past_exam_images.page_number`로 정렬하여 배열 순서를 보장한다:

```
1. DB 조회: SELECT ... FROM past_exam_images WHERE past_exam_id = ? ORDER BY page_number ASC
2. JavaScript: images.map(img => toBase64(img)) → 배열 인덱스 = page_number 순서
3. Gemini SDK: contents Part 배열에 순서대로 삽입 → AI가 "1번째 이미지, 2번째 이미지..." 인식
```

`page_number`는 업로드 시 사용자가 DnD로 정한 최종 순서로 할당. PostgreSQL `ORDER BY page_number ASC`가 JavaScript 배열 순서와 일치.

**업로드 시 이미지 관리 (R8)**:
- 다중 이미지 한 번에 선택 (`<input type="file" multiple>`)
- `URL.createObjectURL(file)` → 썸네일 미리보기
- dnd-kit으로 드래그 순서 변경 → page_number 재정렬
- 순서 변경 시 실시간 미리보기 업데이트

### 6. 추출 트리거: 편집 페이지에서 useEffect

```
시험 생성 + 이미지 업로드 완료
  → router.push(`/past-exams/${pastExamId}/edit`)
  → useEffect: extraction_status === 'pending' 시 자동 추출 트리거
```

### 7. generate-questions.ts의 extracted_content 대체 방안 (v7 MUST FIX 5 반영)

`generate-questions.ts:106`은 현재 `past_exam_questions.extracted_content`를 SELECT하여
`PastExamContext.extractedContent`에 전달한다. 3계층 전환 시 이 컬럼이 소실되는 문제.

**결정: Step 2에서 `generate-questions.ts`가 `past_exam_details`를 JOIN하여 `question_text`를 집합으로 조합**

```typescript
// Step 2 변경 후 generate-questions.ts 쿼리 패턴
const { data: pastExam } = await supabase
  .from('past_exams')
  .select(`
    id, year, semester, exam_type, grade, subject,
    schools!inner ( name ),
    past_exam_details ( question_text )
  `)
  .eq('id', pastExamId)
  .single()

// question_text 목록을 하나의 문자열로 결합
const extractedContent = pastExam.past_exam_details
  ?.map((d) => d.question_text)
  .join('\n\n') ?? null

const pastExamContext: PastExamContext = {
  pastExamId: pastExam.id,
  schoolName: pastExam.schools.name,
  year: pastExam.year,
  semester: pastExam.semester,
  examType: pastExam.exam_type,
  ...(extractedContent ? { extractedContent } : {}),
}
```

이 방식이 가장 단순하며 추가 컬럼 없이 기존 `past_exam_details` 데이터를 재사용한다.
추출 전(details 없음)에는 `extractedContent`가 null → 기존 동작(컨텍스트 없이 생성)과 동일.

---

## 타입 정의

```typescript
/** 그래프/그림 crop 정보
 *
 * NOTE (v7 리서치 반영): 이 타입은 기출 추출 + 향후 AI 문제 생성(Phase 2)의
 * 통합 인터페이스다. 두 케이스 모두 FigureInfo.url (Storage 경로)로 통일된다.
 * - 기출 추출: sharp crop → Storage 업로드 → url 저장
 * - AI 문제 생성(Phase 2): AI SVG 생성 → sharp PNG 변환 → Storage 업로드 → url 저장
 *
 * Phase 2에서 boundingBox/pageNumber는 optional 또는 기본값으로 처리 예정.
 */
interface FigureInfo {
  readonly url: string | null      // Storage 경로 (crop 후), 실패 시 null
  readonly description: string     // AI가 생성한 설명
  readonly boundingBox: {
    readonly x: number             // 좌상단 x (normalized 0~1)
    readonly y: number             // 좌상단 y (normalized 0~1)
    readonly width: number         // 폭 (normalized 0~1)
    readonly height: number        // 높이 (normalized 0~1)
  }
  readonly pageNumber: number      // 원본 이미지 page_number
  readonly confidence: number      // bounding box 정확도
}

/** AI가 이미지에서 추출한 개별 문제 */
interface ExtractedQuestion {
  readonly questionNumber: number
  readonly questionText: string
  readonly questionType: QuestionType
  readonly options?: readonly string[]
  readonly answer?: string
  readonly confidence: number      // 0.0 ~ 1.0
  readonly hasFigure: boolean      // 그래프/그림 포함 여부
  readonly figures?: readonly FigureInfo[]  // crop된 그래프 정보
}

/** (v8 변경) 추출 요청 — Action에서 base64 변환 완료 후 imageParts로 전달 */
interface ExtractQuestionParams {
  readonly imageParts: readonly ImagePart[]  // (v8 변경) Scope CONSIDER 4: imageUrls → imageParts
  readonly subject: string
  readonly grade: number
  readonly examType?: string
}

/** 추출 결과 */
interface ExtractQuestionResult {
  readonly questions: readonly ExtractedQuestion[]
  readonly totalQuestions: number
  readonly overallConfidence: number
}

/** 재분석 요청 */
interface ReanalyzeQuestionParams {
  readonly imageParts: readonly ImagePart[]  // (v8 변경) imageUrls → imageParts (일관성)
  readonly questionNumber: number
  readonly currentQuestion: ExtractedQuestion
  readonly userFeedback?: string
  readonly subject: string
  readonly grade: number
}
```

> **샘플 이미지**: `docs/sampleImage/` 폴더에 5장의 실제 시험지 이미지가 있음.
> 개발/테스트 시 이 이미지들을 사용하여 추출 정확도 검증.
> - `1772347878476.jpg`, `1772347878518.jpg`, `1772347878572.jpg`, `1772347878614.jpg`, `1772347878655.jpg`

---

## 사용자 워크플로우

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. 시험 생성 + 이미지 업로드                                       │
│     "2025 1학기 기말고사 수학 중3" 메타데이터 입력                    │
│     시험지 이미지 N장 선택 → 미리보기 확인 → 드래그로 순서 조정 → 업로드│
│     (v8 반영) 이미지 검증: 최대 20장, 개별 5MB, 총 100MB 이하       │
│     past_exams 1행 + past_exam_images N행 INSERT                   │
└─────────────────────┬───────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────────────┐
│  2. AI 자동 추출                                                    │
│     편집 페이지로 이동 → useEffect 자동 트리거                        │
│     Optimistic Lock: extraction_status → processing (실패 시 조기반환)│
│     모든 이미지 → 직렬 base64 변환 → Gemini Vision API 일괄 전달     │
│     extraction_status: pending → processing → completed/failed     │
│     past_exam_details에 M행 INSERT                                 │
│     ⚠️ try/finally: 예외 시 extraction_status = 'failed' 롤백      │
└─────────────────────┬───────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────────────┐
│  3. 사용자 리뷰                                                     │
│     좌측: 시험지 이미지 썸네일 (page 순)                              │
│     우측: 추출된 문제 카드 목록                                       │
│                                                                     │
│     각 문제 카드:                                                    │
│     ┌────────────────────────────────────────┐                      │
│     │ Q1  🟢 95%                        [✏️] │                      │
│     │ 다음 중 올바른 것은?                    │                      │
│     │ ① 보기1  ② 보기2  ③ 보기3  ④ 보기4     │                      │
│     │ 정답: ③                                │                      │
│     │ [AI 재분석]  [🗑️ 삭제]                 │                      │
│     └────────────────────────────────────────┘                      │
│                                                                     │
│     ⚠️ 신뢰도 낮은 문제: 빨간 테두리 + 경고 표시                      │
│                                                                     │
│     [+ 문제 수동 추가]  [전체 재추출]  [확정 저장]                    │
│                                                                     │
│     ⚠️ [전체 재추출] 클릭 시 확인 Dialog 표시 (v6 추가):              │
│        "기존 추출 결과와 수동 편집 내용이 모두 삭제됩니다.              │
│         계속하시겠습니까?"                                            │
└─────────────────────┬───────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────────────┐
│  4. 확정 저장                                                       │
│     past_exam_details에서 is_confirmed = true                      │
│     삭제된 문제는 DELETE                                             │
│     수정된 문제는 UPDATE                                             │
│     extraction_status = 'completed'                                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 구현 단계 (8 Steps — v8 재조정)

### Step 1: 3계층 스키마 (마이그레이션 + RLS + 상태 전이 규칙)

**파일**:
- `supabase/migrations/20260315_past_exam_restructure.sql` (신규 — 타임스탬프 기반)

**작업**:
1. `past_exams` 테이블 생성 (시험 단위)
2. `past_exam_images` 테이블 생성 (이미지 단위)
   - **(v8 반영)** `UNIQUE(past_exam_id, page_number)` 제약 추가 — 동일 시험 동일 page_number 중복 삽입 방어
3. `past_exam_details` 테이블 생성 (문제 단위)
4. 각 테이블 RLS 정책 (SELECT/INSERT/UPDATE/DELETE — 같은 academy_id)
   - **student 차단 확정**: 기존 `past_exam_questions`는 student 허용이었으나, 새 3계층은 의도적으로 teacher/admin/system_admin만 허용
   - **(v8 반영)** Tech SHOULD FIX 6: RLS 정책은 직접 보유한 `academy_id` 사용 (JOIN 불필요) — DDL 주석에 명시
5. 인덱스 생성
6. updated_at 트리거
7. **(v8 변경)** Scope CONSIDER 3 반영: 기존 past_exam_questions 데이터 이관 **제거** — 새 테이블만 생성
   - 기존 데이터는 개발 데이터이므로 이관 불필요
   - FK UUID 동일 유지 로직 불필요
   - 기존 questions.source_metadata.pastExamId 참조도 개발 데이터이므로 무시
8. past_exam_questions는 유지하되 deprecated 주석
9. **extraction_status 상태 전이 규칙** 주석으로 명시 (SQL CHECK는 단일 컬럼 값만 제약, 전이 규칙은 Action 레벨에서 enforce)
10. **rollback 절차** 주석으로 기술 (v7 CONSIDER 13 반영)
11. **(v9 반영) Tech CONSIDER 4: Storage RLS 경로 호환성 주석 추가** — "기존 Storage RLS 정책은 `split_part(name, '/', 1)` 기반 → 신규 경로 구조(`{academyId}/{pastExamId}/...`)에서도 1번째 경로 컴포넌트(academyId)를 기준으로 검증하므로 동일하게 동작. crop 이미지도 같은 `past-exams` 버킷 사용하므로 동일 RLS 적용."

**Step 1 완료 직후 (v7 SHOULD FIX 7 반영)**:
- `supabase gen types` 실행 → `src/types/supabase.ts` 업데이트
- Wave 2(Step 2, Step 4) 시작 전 타입 업데이트 완료 필수

**리스크**: Low (v7의 Medium에서 하향 — 데이터 이관 제거로 마이그레이션 단순화)
**의존성**: 없음

---

### Step 2: 기존 코드 리팩토링 (past_exam_questions → 3계층)

**영향 파일 (v6 정정: 17개)**:

| 카테고리 | 파일 | 변경 유형 | 변경 내용 |
|---------|------|---------|----------|
| Action | `src/lib/actions/past-exams.ts` | Medium | 3계층 쿼리로 전환 + student 주석 업데이트 |
| Action | `src/lib/actions/generate-questions.ts` | Medium | past_exams JOIN + past_exam_details JOIN으로 extractedContent 조합 (v7 MUST FIX 5) |
| Action | `src/lib/actions/save-questions.ts` | Low | source_metadata 업데이트 |
| Validation | `src/lib/validations/past-exams.ts` | Low | 업로드 스키마 변경 |
| UI | `src/app/(dashboard)/past-exams/page.tsx` | Low | 3계층 목록 |
| UI | `past-exams/_components/past-exam-columns.tsx` | Medium | 컬럼 타입 변경 |
| UI | `past-exams/_components/past-exams-table.tsx` | Low | import 타입 변경 |
| UI | `past-exams/_components/past-exams-toolbar.tsx` | Low | 필터 타입 변경 |
| UI | `past-exams/_components/past-exam-detail-sheet.tsx` | Medium | 상세 조회 구조 변경 |
| UI | `past-exams/_components/generate-questions-dialog.tsx` | Low | pastExamId 참조 변경 |
| UI | `upload/upload-form.tsx` | High | 시험 생성 + 다중 이미지 구조 변경 |
| UI | `upload/page.tsx` | Low | import 경로 변경 |
| Test | `__tests__/past-exams.test.ts` | Medium | 쿼리 mock 업데이트 |
| Test | `__tests__/generate-questions.test.ts` | Medium | JOIN 변경 반영 |
| Test | `__tests__/save-questions.test.ts` | Low | source 변경 반영 |
| Test | `__tests__/past-exams.test.ts` (validation) | Low | 스키마 테스트 |
| Type | `src/types/supabase.ts` | High | 타입 추가 (Step 1 직후 업데이트) |

**리스크**: Medium (v5의 High에서 하향 — 실제 17개 파일로 정정)
**의존성**: Step 1 (supabase.ts 타입 업데이트 포함)

---

### Step 3: AI 타입 + 프롬프트 빌더 + GeminiProvider (v6 병합: 구 Step 3+4, TDD)

**파일**:
- `src/lib/ai/types.ts` (수정)
- `src/lib/ai/extraction-validation.ts` (신규)
- `src/lib/ai/prompts/question-extraction.ts` (신규)
- `src/lib/ai/prompts/index.ts` (수정)
- `src/lib/ai/gemini.ts` (수정)
- `src/lib/ai/__tests__/extraction-validation.test.ts` (신규)
- `src/lib/ai/__tests__/prompts/question-extraction.test.ts` (신규)
- `src/lib/ai/__tests__/gemini.test.ts` (수정)

**작업**:

1. **AI 타입 (OCP 준수 — v6 변경)**:
   - `processOCR` **유지** (기존 인터페이스 Breaking Change 방지)
   - `extractQuestions` **새 메서드 추가**
   - **(v8 변경)** `ExtractQuestionParams` 타입 신규: `imageParts: readonly ImagePart[]` (Scope CONSIDER 4 반영 — imageUrls에서 변경)
   - `ExtractQuestionResult` 타입 신규
   - `ExtractedQuestion` 타입 신규 (`hasFigure`, `figures` 포함)
   - `FigureInfo` 타입 신규 (bounding box + description + pageNumber + **url: string | null**)
     > `url`을 `string | null`로 정의: crop 개별 실패 시 null 허용 (v7 SHOULD FIX 8)
     > **NOTE**: FigureInfo는 기출 추출 + AI 문제 생성(Phase 2) 통합 인터페이스 (리서치 방식 A 확정)
   - **(v8 변경)** `ReanalyzeQuestionParams` 타입 신규: `imageParts: readonly ImagePart[]` (imageUrls에서 변경, 일관성)
   - `PromptConfig`에 `imageParts` 추가 (결정 2: A)
   - Zod 스키마 + 검증 함수 (figures 배열 포함)

2. **추출 프롬프트 빌더**:
   - 다중 이미지 분석 지시 (페이지 경계 인식)
   - 학생 풀이 흔적(필기, 답안 표시) 무시 지시
   - 수식 → LaTeX 변환 (MVP에서는 raw LaTeX 표시 허용, Phase 2에서 KaTeX 도입 — v7 CONSIDER 11)
   - 그래프/그림 → bounding box (normalized 0~1) + 상세 설명 반환
   - temperature: 0.2 (정확성 우선, 생성과 다름)

3. **재분석 프롬프트 빌더**:
   - 특정 문제 재분석 지시
   - 사용자 피드백 포함
   - 기존 추출 결과 + 원본 이미지 함께 전달

4. **GeminiProvider.extractQuestions (새 메서드)**:
   - **(v8 변경)** Action에서 base64 변환 완료된 `imageParts` 수신 → SDK contents Part 배열 구성 (Scope CONSIDER 4 반영)
   - **imageParts 분기 (v6 추가)**: `imageParts`가 있으면 `[...imageParts.map(toPart), { text: userPrompt }]`, 없으면 기존 동작 유지
   - 응답 파싱 + Zod 검증
   - withRetry 재시도
   - **SDK timeout 설정 (v6 추가)**: `requestOptions.timeout`

5. **GeminiProvider.reanalyzeQuestion (새 메서드)**:
   - 특정 문제 재분석 (같은 이미지 + 피드백)

**테스트 (TDD)**:
- extraction-validation: 유효/무효, enum, confidence, figures
- question-extraction 프롬프트: 다중 이미지 지시, 재분석 프롬프트
- gemini: multi-image mock, imageParts 분기, 에러, 재시도, 기존 generateQuestions 무영향 확인

**리스크**: Medium — Vision API multi-image 실제 테스트 필요
**의존성**: 없음 (Step 1, 2와 병렬 가능)

---

### Step 4: Server Action — 시험 생성 + 이미지 업로드 (v6 분리: 구 Step 5 전반부, TDD)

**파일**:
- `src/lib/actions/exam-management.ts` (신규)
- `src/lib/validations/exam-management.ts` (신규)
- `src/lib/actions/__tests__/exam-management.test.ts` (신규)
- `src/lib/validations/__tests__/exam-management.test.ts` (신규)

> **v7 변경 (MUST FIX 1 + Scope MUST FIX 1 반영)**:
> `sharp`와 `export const runtime = 'nodejs'`를 이 파일에서 **제거**.
> `exam-management.ts`는 시험 생성 + Storage 업로드만 담당하며 sharp를 사용하지 않는다.
> sharp 의존성은 Step 5(`extract-questions.ts`)에만 명시.

> **(v9 반영) Scope CONSIDER 4: `exam-management.ts`에 `updateExtractedQuestion`, `deleteExtractedQuestion`, `confirmExtractedQuestions`를 배치하는 이유 — 파일 크기 밸런싱 목적. `extract-questions.ts`에 이미 3개 Action(`extractQuestionsAction`, `resetExtractionAction`, `reanalyzeQuestionAction`)이 배치되어 비대화 방지가 필요하다. 편집/삭제/확정 Action은 sharp/AI 의존성이 없으므로 `exam-management.ts`에 배치하여 분산시킨다.**

**작업**:

1. `createPastExamAction(formData)`:
   ```
   1. 인증 + 권한 확인
   2. 메타데이터 검증 (school, year, semester, examType, grade, subject)
   3. (v8 반영) 이미지 검증: Zod 스키마에 이미지 수 상한(20장) + 개별 5MB + 총 100MB 검증
   4. past_exams INSERT (시험 생성)
   5. 다중 파일 → Storage 업로드 → past_exam_images INSERT (page_number)
      (v8 반영) Storage 경로: {academyId}/{pastExamId}/{page_number}-{fileId}.{ext}
   6. (v9 반영) Tech SHOULD FIX 2: 재업로드 시 순서:
      6a. 기존 past_exam_images 조회 → source_image_url 목록 수집
      6b. Storage에서 기존 원본 이미지 삭제 (admin 클라이언트, Non-blocking — 삭제 실패 시 무시, orphan은 Phase 2 cleanup)
      6c. past_exam_images DELETE (DB)
      6d. 새 이미지 Storage 업로드 → past_exam_images INSERT
   7. 결과 반환 (pastExamId)
   ```

2. `updateExtractedQuestion(detailId, data)`:
   - 개별 문제 편집 UPDATE

3. `deleteExtractedQuestion(detailId)`:
   - 문제 삭제 DELETE

4. `confirmExtractedQuestions(pastExamId)`:
   - 모든 문제 is_confirmed = true

**테스트 (TDD)**:
- createPastExamAction: 시험 생성, 다중 파일 업로드, 권한 검증, **(v8 반영)** 이미지 수/용량 제한 초과 시 거부
- updateExtractedQuestion: 편집, Zod 검증
- deleteExtractedQuestion: 삭제, 권한 검증
- confirmExtractedQuestions: 확정, 상태 변경

**리스크**: Low-Medium
**의존성**: Step 1

---

### Step 5: Server Action — 추출 + crop + 재추출 + 재분석 (v8 확장, TDD)

**파일**:
- `src/lib/actions/extract-questions.ts` (신규)
- `src/lib/validations/extract-questions.ts` (신규)
- `src/lib/actions/__tests__/extract-questions.test.ts` (신규)
- `src/lib/actions/__tests__/reanalyze-question.test.ts` (신규 — v9 반영: Scope SHOULD FIX 1 테스트 파일 분리)
- `src/lib/validations/__tests__/extract-questions.test.ts` (신규)

**새 의존성 (v7 MUST FIX 1 반영: Step 4에서 Step 5로 이동)**:
- `sharp` — package.json dependencies에 추가 필수
- `export const runtime = 'nodejs'` 명시 (sharp는 Edge Runtime 불가)
- `export const maxDuration = 60` — Vercel Pro 플랜 기준 (v7 CONSIDER 15 반영: 배포 환경 명시 필요)
  > ⚠️ Vercel Hobby 플랜 기본 한도 10초. 배포 환경에 맞게 조정 필요.

**작업**:

1. `extractQuestionsAction(pastExamId)`:
   ```
   1. 인증 + 권한
   2. ⚠️ Optimistic Lock (v7 SHOULD FIX 6 반영):
      const { data: locked } = await supabase
        .from('past_exams')
        .update({ extraction_status: 'processing' })
        .eq('id', pastExamId)
        .in('extraction_status', ['pending', 'failed'])
        .select('id')
      if (!locked || locked.length === 0) {
        return { error: '이미 처리 중입니다.' }
      }
   3. (v8 반영) 기존 details 존재 시 DELETE 후 진행 (Tech SHOULD FIX 4 방어)
   4. ⚠️ isCompleted 플래그 + try/finally (v7 MUST FIX 4 반영):
      let isCompleted = false
      try {
        4a. past_exam_images 조회 (page_number 순)
        4b. ⚠️ 이미지별 직렬 base64 변환 (v6 메모리 방어):
            for (const image of images) {
              const signedUrl = await createSignedUrl(image.source_image_url)
              const response = await fetch(signedUrl)
              const buffer = await response.arrayBuffer()
              imageParts.push({ mimeType, data: Buffer.from(buffer).toString('base64') })
            }
        4c. (v8 변경) AI Provider.extractQuestions 호출 — imageParts 직접 전달 (Scope CONSIDER 4)
        4d. 그래프 crop 처리 (R9):
            - figures 배열이 있는 문제에 대해
            - pageNumber로 원본 이미지 선택
            - bounding box (normalized) → 실제 픽셀 좌표 변환
            - sharp로 crop → Buffer
            - createAdminClient()로 Storage 업로드 (원본 이미지와 동일 패턴)
            - (v8 반영) Storage 경로: {academyId}/{pastExamId}/figures/{detailId}-{figureIndex}.jpg
            - ⚠️ crop 개별 실패 시 figure.url = null (부분 성공 허용)
        4e. 성공: past_exam_details INSERT + extraction_status='completed'
        4f. raw_ai_response 백업 저장
        isCompleted = true
      } finally {
        if (!isCompleted) {
          // DB UPDATE extraction_status = 'failed' (롤백 보장)
        }
      }
   ```
   **(v8 반영) Tech SHOULD FIX 4 방어 방안**: INSERT 성공 후 UPDATE 실패 시 extraction_status가 processing으로 남음 → 재추출 시 기존 details DELETE 후 재삽입. `resetExtractionAction`과 `extractQuestionsAction` 모두에서 기존 details 존재 시 DELETE 후 진행.

2. **(v8 반영) `resetExtractionAction(pastExamId)` — 전체 재추출 Action (Tech SHOULD FIX 5 + Scope SHOULD FIX 1)**:
   ```
   1. 인증 + 권한
   2. 기존 past_exam_details 조회 → figures[].url 목록 수집
   3. (v8 반영) Storage orphan cleanup (Scope SHOULD FIX 1):
      - figures[].url이 존재하는 항목의 Storage 파일 삭제
      - (v9 반영) Tech SHOULD FIX 1: Storage 삭제 실패 시 Non-blocking으로 처리.
        삭제 실패를 무시하고 4단계(DB DELETE)로 계속 진행한다.
        orphan 파일은 Phase 2 cleanup job으로 처리.
        이유: 재추출 흐름을 Storage 오류로 중단하지 않음 (사용자 경험 우선).
   4. past_exam_details DELETE (해당 pastExamId의 모든 details)
   5. past_exams.extraction_status = 'pending' UPDATE
   6. 결과 반환 (성공/실패)
   ```
   파일: `src/lib/actions/extract-questions.ts` (backend-actions 소유)

3. **(v8 반영) `reanalyzeQuestionAction(detailId, feedback?)` — 단일 문제 재분석 (Scope CONSIDER 2)**:
   ```
   1. 인증 + 권한
   2. 해당 detail + 시험 정보 조회
   3. 시험의 모든 이미지 → 직렬 base64 변환 → imageParts
      (v9 반영) Tech CONSIDER 3: 전체 이미지를 전달하는 이유 —
      페이지 경계를 넘는 문제 가능성 + AI 컨텍스트 일관성 보장.
      특정 페이지만 전달하면 앞뒤 맥락이 부족해 정확도 저하 우려.
   4. AI Provider.reanalyzeQuestion 호출
   5. 해당 detail만 UPDATE (question_text, options, answer, confidence 등)
   6. 결과 반환
   ```
   파일: `src/lib/actions/extract-questions.ts` (backend-actions 소유)
   > **(v9 반영)** `maxDuration = 60` 적용 — extractQuestionsAction과 동일 (전체 이미지 전달로 인한 대기시간 고려)

**테스트 (TDD)**:
- extractQuestionsAction: 추출, 상태 전이, Optimistic Lock (동시 호출 시 두 번째 호출 거부), try/finally 롤백, **(v8 반영)** 기존 details DELETE 후 재삽입 확인
- Optimistic Lock: `.select('id')` 후 빈 배열 체크 패턴 테스트
- crop 부분 실패: 일부 figure.url = null 시 나머지 INSERT 정상 진행 확인
- **(v8 반영)** resetExtractionAction (`extract-questions.test.ts`): Storage 삭제 → details DELETE → status 'pending' 전이 확인, **(v9 반영)** Storage 삭제 실패 시 Non-blocking 동작 확인
- **(v9 변경)** reanalyzeQuestionAction (`reanalyze-question.test.ts` — **별도 파일**): 인증 확인, 단일 문제 재분석 + UPDATE, AI 오류 처리, 전체 이미지 전달 확인 (Scope SHOULD FIX 1: mock 충돌 방지 + 파일 크기 관리)

**리스크**: Medium-High
**의존성**: Step 1, Step 3, Step 4

---

### Step 6: 업로드 UI (시험 생성 + 다중 이미지 + DnD)

**파일**:
- `src/app/(dashboard)/past-exams/upload/upload-form.tsx` (수정 → 대폭 변경)
- `src/app/(dashboard)/past-exams/upload/image-sorter.tsx` (신규 — DnD + 미리보기)
- `src/app/(dashboard)/past-exams/upload/page.tsx` (수정)

**새 의존성**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
> **(v9 반영) Scope CONSIDER 3: 착수 전 리드가 `package.json`에 `@dnd-kit/*` 추가 후 Wave 3 시작.** `package.json`은 Shared Files(리드 only)이므로 구현자가 직접 수정하지 않는다.

**작업**:
1. 시험 메타데이터 입력 폼 (학교, 학년, 과목, 연도, 학기, 시험유형)
2. `<input type="file" multiple>` 다중 이미지 선택
3. **(v8 반영)** 클라이언트 사전 검증: 이미지 수 20장, 개별 5MB, 총 100MB 초과 시 업로드 차단 + 에러 메시지
4. 이미지 미리보기: `URL.createObjectURL(file)` → 썸네일 그리드 표시
5. 이미지 순서 변경: dnd-kit `SortableContext` + 드래그 핸들
   > DnD fallback (v7 CONSIDER 14 반영): DnD 구현 실패 시 "위/아래 버튼" 방식으로 전환 가능한 구조를 유지. `image-sorter.tsx`를 DnD 독립 컴포넌트로 분리하여 fallback 전환 용이하게 설계.
6. 순서 변경 시 page_number 자동 재할당
7. "업로드" 버튼 → createPastExamAction 호출
8. 업로드 완료 → `/past-exams/${pastExamId}/edit`로 리다이렉트

**리스크**: Medium-High — DnD 새 패턴 + 의존성 추가
**의존성**: Step 4 + Step 2 (v7 SHOULD FIX 9 반영: upload-form.tsx는 Step 2 리팩토링 대상이므로 Step 2 완료 후 작업)

---

### Step 7: 편집 UI (리뷰 + AI 재분석 + 확인 Dialog) — Step 6 이후 순차 (v6 변경)

**파일**:
- `src/app/(dashboard)/past-exams/[id]/edit/page.tsx` (신규 — 서버 컴포넌트)
- `src/app/(dashboard)/past-exams/[id]/edit/extraction-editor.tsx` (신규 — 클라이언트)

> v5에서는 Step 6과 병렬 가능이었으나, v6에서 순차 진행으로 변경.
> 이유: 두 Step 모두 `past-exams` 라우트 하위 파일을 다루므로 layout/공통 import 충돌 위험.

**(v8 변경) Scope CONSIDER 2 반영: `reanalyzeQuestionAction`은 Step 5의 `src/lib/actions/extract-questions.ts`에 배치됨.**
Step 7 UI는 이 Action을 import하여 호출한다. Step 7에서는 UI 구현만 담당.

**상태 흐름**:
```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ pending │ --> │ 추출 중  │ --> │ 리뷰     │ --> │ 확정완료  │
└─────────┘     └──────────┘     └──────────┘     └──────────┘
      │                                │
      └ 전체 재추출 ──→ ┌──────────┐ ←─┘ (실패 시)
                       │ failed   │
                       └──────────┘
```

**기능**:
- 좌측: 시험지 이미지 썸네일 (page_number 순, Signed URL)
- 우측: 추출된 문제 카드 목록 (Accordion)
- 자동 추출: useEffect (extraction_status === 'pending')
- 로딩: 스피너 + "시험지를 분석하고 있습니다..." 메시지
- 각 문제 카드:
  - 문제 내용 편집 (textarea)
  - 문제 유형 변경 (select)
  - 보기 편집 (객관식)
  - 정답 편집
  - confidence 색상: 🟢 ≥0.8 / 🟡 0.5~0.8 / 🔴 <0.5
  - 그래프/그림: hasFigure=true 시 crop 이미지 미리보기 (url=null이면 "추출 실패" 표시) + 원본 대조 기능
  - [AI 재분석] 버튼 — `reanalyzeQuestionAction` import하여 호출 (v8: Step 5에서 구현, Step 7에서 사용)
    > **(v9 반영) Tech CONSIDER 3: [AI 재분석] 클릭 시 로딩 표시 필수** (전체 이미지 전달로 대기시간 수십 초 가능). 스피너 + "AI가 문제를 다시 분석하고 있습니다..." 메시지 + 버튼 비활성화.
  - [삭제] 버튼 — 관리 불가 문제 제거
- [+ 문제 수동 추가] — 빈 카드 추가
- **[전체 재추출]** — `resetExtractionAction` 호출 (v8 반영: Step 5에서 구현):
  - 확인 Dialog (v6): "기존 추출 결과와 수동 편집 내용이 모두 삭제됩니다. 계속하시겠습니까?"
  - 확인 → Storage orphan cleanup + details 삭제 + extraction_status = 'pending' + 처음부터 재추출
- [확정 저장] — is_confirmed = true

**리스크**: Medium — 편집 UI 새로운 패턴
**의존성**: Step 5, Step 6 (순차)

---

### 접근 제어 (RLS)

기출문제 3계층 테이블의 RLS 정책:

| 역할 | 리스트 조회 | 상세 조회 | 생성/업로드 | 편집/삭제 |
|------|-----------|----------|-----------|----------|
| teacher (학원강사) | ✅ 같은 academy | ✅ 같은 academy | ✅ | ✅ 본인 생성분 |
| admin | ✅ 같은 academy | ✅ 같은 academy | ✅ | ✅ 같은 academy |
| system_admin | ✅ 전체 | ✅ 전체 | ✅ | ✅ 전체 |
| student | ❌ | ❌ | ❌ | ❌ |

> **v6 확정**: student 차단은 의도적 변경. 기존 `past_exam_questions` RLS(student 허용)와 다름.
> Step 2 리팩토링 시 기존 Action 주석 "student 포함" → "teacher/admin/system_admin만"으로 업데이트.

Step 1의 RLS 정책에 반영.

---

### Step 8: 빌드 검증 + 학습 리뷰

1. 전체 테스트 실행
2. 빌드 검증
3. 린트 확인
4. 수동 테스트: 시험 생성 → 이미지 업로드 → 추출 → 편집 → 재분석 → 확정
5. 학습 리뷰

**의존성**: Step 1-7

---

## 의존성 그래프 (v8 — Wave 기반)

```
Wave 1: Step 1 (스키마)                    ∥ Step 3 (AI 타입+프롬프트+Gemini)
        └ Step 1 완료 직후: supabase.ts 타입 업데이트 (Wave 2 시작 전 필수)
Wave 2: Step 2 (리팩토링, ←Step1+types)    ∥ Step 4 (시험생성 Action, ←Step1+types)
Wave 3: Step 5 (추출+재추출+재분석 Action, ←Step1+3+4)  ∥ Step 6 (업로드 UI, ←Step4+Step2)
        └ (v9 반영) Wave 3 시작 전: 리드가 package.json에 @dnd-kit/* + sharp 추가
Wave 4: Step 7 (편집 UI, ←Step5+6) — 순차
Wave 5: Step 8 (검증, ←Step1-7)
```

**(v8 변경점)**:
- Step 5에 `resetExtractionAction` + `reanalyzeQuestionAction` 추가 (Tech SHOULD FIX 5 + Scope CONSIDER 2)
- Step 5 설명에 "추출+재추출+재분석 Action"으로 확장
- Wave 구조 자체는 변경 없음 (Action이 Step 5에 통합되어 Wave 3에 이미 포함)

---

## 변경/신규 파일 목록

```
마이그레이션:
  supabase/migrations/20260315_past_exam_restructure.sql

리팩토링 (기존 → 3계층):
  src/lib/actions/past-exams.ts
  src/lib/actions/generate-questions.ts
  src/lib/actions/save-questions.ts
  src/lib/validations/past-exams.ts
  src/app/(dashboard)/past-exams/page.tsx
  src/app/(dashboard)/past-exams/_components/*.tsx (5개)
  src/app/(dashboard)/past-exams/upload/*.tsx (2개)
  src/lib/actions/__tests__/*.test.ts (3개)
  src/lib/validations/__tests__/past-exams.test.ts
  src/types/supabase.ts

AI 확장:
  src/lib/ai/types.ts (수정)
  src/lib/ai/gemini.ts (수정)
  src/lib/ai/extraction-validation.ts (신규)
  src/lib/ai/prompts/question-extraction.ts (신규)
  src/lib/ai/prompts/index.ts (수정)

Server Action — 시험 관리:
  src/lib/actions/exam-management.ts (신규)
  src/lib/validations/exam-management.ts (신규)

Server Action — 추출 + 재추출 + 재분석 (v8 확장):
  src/lib/actions/extract-questions.ts (신규, sharp + runtime = 'nodejs')
    → extractQuestionsAction
    → resetExtractionAction (v8 반영)
    → reanalyzeQuestionAction (v8 반영)

UI:
  src/app/(dashboard)/past-exams/upload/image-sorter.tsx (신규 — DnD + 미리보기)
  src/app/(dashboard)/past-exams/[id]/edit/page.tsx (신규)
  src/app/(dashboard)/past-exams/[id]/edit/extraction-editor.tsx (신규)

테스트:
  src/lib/ai/__tests__/extraction-validation.test.ts (신규)
  src/lib/ai/__tests__/prompts/question-extraction.test.ts (신규)
  src/lib/ai/__tests__/gemini.test.ts (수정)
  src/lib/actions/__tests__/exam-management.test.ts (신규)
  src/lib/validations/__tests__/exam-management.test.ts (신규)
  src/lib/actions/__tests__/extract-questions.test.ts (신규)
  src/lib/actions/__tests__/reanalyze-question.test.ts (신규 — v9 반영: 테스트 파일 분리)
  src/lib/validations/__tests__/extract-questions.test.ts (신규)
```

---

## 테스트 전략

| 대상 | 파일 | 테스트 항목 |
|------|------|------------|
| 추출 Zod 스키마 | extraction-validation.test.ts | 유효/무효, enum, confidence, figures, url=null 허용 |
| 프롬프트 빌더 | question-extraction.test.ts | 다중 이미지 지시, 재분석 |
| GeminiProvider | gemini.test.ts | multi-image mock, imageParts 분기, 기존 generateQuestions 무영향, 에러, 재시도 |
| createPastExamAction | exam-management.test.ts | 시험 생성, 다중 파일, 권한, **(v8 반영)** 이미지 수/용량 제한 초과 시 거부 |
| updateExtractedQuestion | exam-management.test.ts | 편집, Zod 검증 |
| extractQuestionsAction | extract-questions.test.ts | 추출, 상태 전이, Optimistic Lock (.select('id') 빈 배열 체크), try/finally 롤백, **(v8 반영)** 기존 details DELETE 후 재삽입 |
| crop 부분 실패 | extract-questions.test.ts | figure.url=null 시 나머지 INSERT 정상 진행 |
| **(v8 반영)** resetExtractionAction | extract-questions.test.ts | Storage orphan cleanup, details DELETE, status 'pending' 전이, **(v9 반영)** Storage 삭제 실패 시 Non-blocking 동작 확인 |
| **(v9 변경)** reanalyzeQuestionAction | **reanalyze-question.test.ts** (별도 파일) | 인증 확인, 단일 문제 재분석 + UPDATE, AI 오류 처리, 전체 이미지 전달 확인 |
| 기존 코드 리팩토링 | past-exams.test.ts 등 | 3계층 쿼리 정상 동작 |

---

## 리스크 & 완화 방안

| 리스크 | 영향 | 확률 | 완화 방안 |
|--------|------|------|----------|
| 기존 코드 리팩토링 범위 (17개 파일) | Medium | 확정 | Step 2에서 집중 처리, 테스트로 검증 |
| Vision API 추출 정확도 | High | Medium | confidence + 사용자 편집 + AI 재분석 |
| 다중 이미지 base64 크기 | High | Medium | 이미지별 직렬 변환으로 피크 메모리 억제 + **(v8 반영)** 업로드 단계에서 이미지 수 20장/개별 5MB/총 100MB 사전 차단 |
| Gemini API 토큰 제한 | High | Medium | **(v8 반영)** 업로드 단계에서 이미지 수/용량 사전 검증으로 차단 (Zod 스키마 + 클라이언트 검증) |
| API 응답 시간 (다중 이미지) | Medium | High | maxDuration + SDK timeout + 로딩 UI + extraction_status |
| AI bounding box 정확도 | High | Medium | confidence 포함 + 사용자 원본 대조 + crop 미리보기 |
| sharp 의존성 (native module) | Medium | Low | package.json dependencies 추가 + `runtime = 'nodejs'` Step 5에 명시 |
| 동시 추출 Race Condition | Medium | Medium | Optimistic Lock (.update().in().select('id') + 빈 배열 체크) + 0행 조기 반환 |
| 추출 중 예외/타임아웃 | Medium | Medium | isCompleted 플래그 + try/finally로 extraction_status = 'failed' 롤백 보장 |
| Vercel 플랜 maxDuration 제한 | High | Medium | Hobby=10초 / Pro=60초 — 배포 환경 사전 확인 필수 |
| DnD 구현 실패 | Medium | Low | image-sorter.tsx 독립 컴포넌트 분리 → 위/아래 버튼 fallback 전환 가능 구조 |
| **(v8 반영)** INSERT 성공 + UPDATE 실패 부분 성공 | Medium | Low | 재추출 시 기존 details DELETE 후 재삽입으로 방어 (Tech SHOULD FIX 4) |
| **(v8 반영)** Storage orphan 잔류 | Low | Medium | resetExtractionAction에서 figures[].url Storage 삭제 후 details DELETE (Scope SHOULD FIX 1) |

---

## 확정된 결정사항

| 결정 | 선택 | 이유 |
|------|------|------|
| 테이블 구조 | 3계층 (past_exams + images + details) | 사용자 명시 요구 |
| PromptConfig | A: imageParts 필드 추가 | 일관성, 확장성 |
| raw_ai_response | A: 백업 유지 | 디버깅 + 재분석 시 참조 (Phase 2 회고 시 크기 정책 재검토) |
| questions 테이블 복사 | 불필요 (Phase 2 시험 출제 시 처리) | 3계층이 최종 저장소 |
| question_id FK | 3계층 전환으로 자연 deprecated | past_exams가 대체 |
| 배점(points) 컬럼 | 제거 | 불필요 (v4) |
| 사용자 직접 편집 | AI 재분석 + 인라인 편집 | 모든 필드 직접 수정 가능 (v4) |
| 접근 제어 | teacher/admin/system_admin (student 차단 확정) | RLS 정책, 의도적 변경 (v6) |
| 그래프/그림 관리 | **방식 A 확정**: sharp crop (bounding box + normalized) | 기출 추출에 최적, Vercel 호환, Storage 패턴 일관성 (v7 리서치 반영) |
| DnD 라이브러리 | dnd-kit (@dnd-kit/core + sortable + utilities) | headless, 경량, shadcn/ui 호환 (v5) |
| 학생 풀이 흔적 | 프롬프트에서 무시 지시 | AI가 원본 문제만 추출 (v5) |
| AIProvider 리네이밍 | 리네이밍 취소 → processOCR 유지 + extractQuestions 새 메서드 추가 | OCP 준수, Breaking Change 방지 (v6) |
| sharp 의존성 위치 | **Step 5(`extract-questions.ts`)에만 명시** | Step 4는 sharp 미사용 (v7 MUST FIX 1) |
| 마이그레이션 네이밍 | 타임스탬프 기반 (`20260315_*.sql`) | 번호 충돌 방지 (v6) |
| source_page_numbers 컬럼 | 생략 | **(v8 업데이트)** figures[].pageNumber + 문제 순서상 앞 페이지로 추적 가능 (Tech CONSIDER 7) |
| 전체 재추출 확인 Dialog | Step 7 UI에 추가 | 수동 편집분 유실 방지를 위한 경고 (v6) |
| Step 6+7 병렬 | 순차 진행으로 변경 | layout/공통 import 충돌 위험 방지 (v6) |
| reanalyzeQuestionAction 위치 | **(v8 변경) Step 5의 `src/lib/actions/extract-questions.ts`** (backend-actions 소유) | 파일 소유권 명확화 + UI와 Action 분리 (Scope CONSIDER 2) |
| finally 블록 상태 추적 | **isCompleted 로컬 플래그 패턴** | DB 재조회 없이 성공/실패 명확히 구분 (v7 MUST FIX 4) |
| crop 업로드 클라이언트 | **createAdminClient()** | 원본 이미지 업로드와 동일 패턴, RLS 일관성 (v7 MUST FIX 3) |
| extracted_content 대체 | **past_exam_details JOIN + question_text 집합** | 추가 컬럼 없이 단순 해결 (v7 MUST FIX 5) |
| Optimistic Lock 구현 | **.update().in().select('id') + 빈 배열 체크** | Supabase JS 영향 행 확인 패턴 (v7 SHOULD FIX 6) |
| supabase.ts 타입 업데이트 | **Step 1 완료 직후 Wave 1에서 처리** | Wave 2 병렬 구현 시 타입 오류 방지 (v7 SHOULD FIX 7) |
| crop 개별 실패 처리 | **figure.url = null (부분 성공)** | 전체 추출 실패로 처리하지 않음 (v7 SHOULD FIX 8) |
| Step 6 의존성 | **Step 4 + Step 2** | upload-form.tsx는 두 Step 모두 수정 대상 (v7 SHOULD FIX 9) |
| LaTeX 렌더링 | **MVP: raw LaTeX 표시 허용 / Phase 2: KaTeX 도입** | MVP 범위 외 의존성 추가 방지 (v7 CONSIDER 11) |
| raw_ai_response 크기 | **Phase 2 회고 시 재검토** | 현재는 허용, 운영 후 bloat 발생 시 Storage 전환 검토 (v7 CONSIDER 12) |
| 마이그레이션 rollback | **마이그레이션 파일 내 주석으로 기술** | 운영 환경 롤백 안전망 (v7 CONSIDER 13) |
| DnD fallback | **위/아래 버튼 전환 가능 구조 유지** | image-sorter.tsx 독립 분리로 구현 (v7 CONSIDER 14) |
| maxDuration 배포 환경 | **Vercel Pro 기준 60초 명시, Hobby 10초 주석** | 배포 환경 확인 필수 사항 명시 (v7 CONSIDER 15) |
| **(v8 반영)** Storage 경로 구조 | **원본: `{academyId}/{pastExamId}/{page_number}-{fileId}.{ext}`, crop: `{academyId}/{pastExamId}/figures/{detailId}-{figureIndex}.jpg`** | pastExamId 기반 디렉토리로 시험 단위 관리 용이 (Tech MUST FIX 1) |
| **(v8 반영)** UNIQUE 제약 | **`UNIQUE(past_exam_id, page_number)`** | 동일 시험 동일 page_number 중복 삽입 방어 (Tech MUST FIX 2) |
| **(v8 반영)** 재업로드 전략 | **기존 이미지 DELETE 후 INSERT** | UNIQUE 제약과 호환, createPastExamAction에서 처리 (Tech MUST FIX 2) |
| **(v8 반영)** 이미지 검증 상한 | **이미지 수 20장 + 개별 5MB + 총 100MB** | Gemini API 토큰 한도 대응 + 업로드 단계에서 사전 차단 (Tech CONSIDER 8) |
| **(v8 반영)** 데이터 이관 | **제거 — 새 테이블만 생성** | 기존 데이터는 개발 데이터, 이관 불필요 (Scope CONSIDER 3) |
| **(v8 반영)** INSERT+UPDATE 부분 성공 방어 | **재추출 시 기존 details DELETE 후 재삽입** | RPC 트랜잭션 없이 Supabase JS로 방어 (Tech SHOULD FIX 4) |
| **(v8 반영)** 전체 재추출 Action | **`resetExtractionAction` in `extract-questions.ts`** | Storage orphan cleanup + details DELETE + status 'pending' (Tech SHOULD FIX 5 + Scope SHOULD FIX 1) |
| **(v8 반영)** base64 변환 책임 | **Action에서 URL→base64 변환 완료 → imageParts로 Provider에 전달** | 타입 경계 명확화 (Scope CONSIDER 4) |
| **(v9 반영)** Storage 삭제 실패 처리 | **Non-blocking (무시하고 계속 진행)** | 재추출/재업로드 흐름을 Storage 오류로 중단하지 않음. orphan은 Phase 2 cleanup job 처리 (Tech SHOULD FIX 1 + Scope CONSIDER 2) |
| **(v9 반영)** reanalyze 전체 이미지 전달 | **유지 — 전체 이미지 전달** | 페이지 경계를 넘는 문제 가능성 + AI 컨텍스트 일관성 보장. maxDuration 60초 + UI 로딩 표시로 대기시간 대응 (Tech CONSIDER 3) |
| **(v9 반영)** reanalyzeQuestionAction 테스트 | **별도 파일 `reanalyze-question.test.ts`로 분리** | mock 충돌 방지 + 파일 크기 관리 (Scope SHOULD FIX 1) |

---

## NOTE 1: 향후 API 선택 (Phase 2+)

Factory 패턴만 유지. DB 연동은 Phase 2+.

## NOTE 2: AI 재분석 범위

이번 구현: 버튼 기반 재분석 (특정 문제 1개)
Phase 3: 대화형 Chat UI (여러 문제 연속 수정)

## NOTE 3: FigureInfo 향후 확장 (Phase 2 — 리서치 방식 A 확정)

현재 MVP에서 `FigureInfo`는 기출 추출 전용으로 구현되지만, Phase 2 AI 문제 생성 시 동일 인터페이스를 재사용한다:
- 기출 추출: sharp로 원본 이미지 crop → Storage 업로드 → `url` 저장
- AI 문제 생성 (Phase 2): Gemini가 SVG 생성 → sharp로 PNG 변환 → Storage 업로드 → `url` 저장
- `questions.figures JSONB` 컬럼 추가 마이그레이션 필요 (Phase 2 시점에 추가)

`FigureInfo.url` 인터페이스를 단일 Storage 경로로 통일하여 프론트엔드 컴포넌트 재사용 가능.
