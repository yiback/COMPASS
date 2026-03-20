# 기출문제 추출 — 성능 리뷰

> 리뷰어: perf-reviewer
> 일자: 2026-03-20

---

## 요약

기출문제 추출 기능(세션 25)의 7개 대상 파일을 전수 분석했다.
전체적으로 메모리 방어(직렬 변환)와 인덱스 설계는 양호하나,
**이미지별 Signed URL 생성 루프(N+1 패턴)**와 **crop 단계의 중복 fetch**,
**reanalyzeQuestion 전체 이미지 전달**, **Signed URL 만료 시간 불일치**가
주요 성능/비용 이슈로 발견되었다.

이슈 수: MUST FIX 2건 / SHOULD FIX 3건 / CONSIDER 3건

---

## 이슈 목록

---

### [MUST FIX] crop 단계 — 동일 이미지 중복 fetch

- **파일**: `src/lib/actions/extract-questions.ts` : 280–292
- **문제**:
  `extractQuestionsAction`의 5b 단계에서 모든 이미지를 이미 base64로 변환해 `imageParts`에 보유 중임에도,
  crop이 필요한 figure마다 `createSignedUrl` → `fetch` → `Buffer` 변환을 **재실행**한다.
  같은 페이지에 figure가 n개 있으면 해당 페이지 이미지를 n번 내려받는다.
  ```
  // 5b: 이미지 fetch (1회)
  for (const image of imageList) {
    const response = await fetch(signedUrlData.signedUrl)   // ← 이미 완료
    imageParts.push({ data: Buffer.from(buffer).toString('base64'), ... })
  }
  // 5d: crop을 위해 또 fetch (N회)
  const figResponse = await fetch(figSignedUrl.signedUrl)   // ← 중복
  const imgBuffer = Buffer.from(await figResponse.arrayBuffer())
  ```
- **영향**:
  - 이미지 20장 × figure 페이지 평균 3개 → Supabase Storage API 최대 60회 추가 호출
  - 네트워크 왕복 × 이미지 크기(~3MB) → crop 단계 추가 지연 최대 30–60초
  - Supabase Storage 요청 비용 증가
- **제안**:
  5b 단계에서 `pageNumber → Buffer` 맵을 함께 구성해 재사용한다.
  ```typescript
  const imageBufferMap = new Map<number, Buffer>()
  for (const image of imageList) {
    const response = await fetch(signedUrlData.signedUrl)
    const buffer = Buffer.from(await response.arrayBuffer())
    imageBufferMap.set(image.page_number, buffer)  // ← crop에서 재사용
    imageParts.push({ mimeType: ..., data: buffer.toString('base64') })
  }
  // crop 단계에서 imageBufferMap.get(figure.pageNumber) 사용
  ```

---

### [MUST FIX] Signed URL 직렬 생성 루프 — `getPastExamDetail` + `extraction-editor.tsx`

- **파일**:
  - `src/lib/actions/past-exams.ts` : 435–451
  - `src/app/(dashboard)/past-exams/[id]/edit/extraction-editor.tsx` : 99–115
- **문제**:
  두 곳 모두 이미지 목록을 `for...of`로 순회하며 Supabase Storage `createSignedUrl`을 **직렬 호출**한다.
  이미지 20장이면 20회 순차 왕복(~20 × 50ms = ~1초 이상 블로킹).
  `buildImageParts` 헬퍼도 같은 패턴(extract-questions.ts : 119–138).
  ```typescript
  // past-exams.ts
  for (const img of rawImages) {
    const { data: signedData } = await supabase.storage.createSignedUrl(...)  // 직렬
  }
  // extraction-editor.tsx
  for (const img of initialImages) {
    const { data } = await supabase.storage.createSignedUrl(...)  // 직렬
  }
  ```
- **영향**:
  - 이미지 20장 기준: 직렬 1,000ms vs 병렬 50ms → 최대 **20배 차이**
  - 상세 페이지 초기 로딩 지연 1초 이상
  - 편집기 이미지 썸네일이 순차적으로 1장씩 나타남 (UX 저하)
- **제안**:
  `Promise.all`로 병렬화한다. 메모리 피크는 Signed URL 메타데이터(수십 바이트)에 불과하므로 안전하다.
  ```typescript
  // 병렬 Signed URL 생성
  const signedResults = await Promise.all(
    rawImages.map((img) =>
      supabase.storage.from('past-exams').createSignedUrl(img.source_image_url, 60)
    )
  )
  ```
  단, `buildImageParts`(추출 Action 내부)는 이미지 본문을 fetch하므로
  메모리 피크(20장 × ~3MB = ~60MB)를 고려해 **직렬 유지**가 맞다.
  Signed URL 생성만 병렬로 분리하고, fetch는 직렬로 유지한다.

---

### [SHOULD FIX] `reanalyzeQuestion` — 단일 문제 재분석에 전체 이미지 전달

- **파일**:
  - `src/lib/actions/extract-questions.ts` : 532–533
  - `src/lib/ai/prompts/question-extraction.ts` : 99–138
- **문제**:
  단일 문제 1개를 재분석할 때 시험지 전체 이미지를 AI에 전달한다.
  20장짜리 시험지면 재분석 1회에 이미지 20장 전부를 Gemini Vision API로 전송한다.
  코드 주석에 "페이지 경계를 넘는 문제 가능성"으로 정당화하고 있으나,
  대부분의 문제는 1–2페이지 범위 내에 있다.
  ```typescript
  // reanalyzeQuestionAction
  const imageParts = await buildImageParts(supabase, detail.past_exams.id)  // 전체 이미지
  ```
- **영향**:
  - Gemini Vision API 토큰 비용: 이미지 20장 × 재분석 10회 = 200장 분량 비용
  - 재분석 응답 시간: 전체 이미지 로딩 + API 처리로 전체 추출과 동일한 지연
  - 예상 비용: 이미지당 약 258 토큰(1MP 기준) → 20장 × 258 = 5,160 토큰 vs 2장 × 258 = 516 토큰
- **제안**:
  `past_exam_details`에 `page_number` 필드(혹은 figures[0].pageNumber)가 있다면
  해당 문제 페이지 ±1 범위만 전달한다.
  페이지 정보가 없는 경우에만 전체 이미지 fallback.
  ```typescript
  // figures[0].pageNumber 기준 ±1 페이지만 선택
  const relevantPages = getRelevantPages(detail.figures, imageList)
  const imageParts = await buildImagePartsForPages(supabase, relevantPages)
  ```

---

### [SHOULD FIX] 이미지 업로드 — 순차 업로드로 인한 병목

- **파일**: `src/lib/actions/exam-management.ts` : 232–264
- **문제**:
  `createPastExamAction`에서 다중 이미지를 `for` 루프로 **순차 업로드**한다.
  20장 이미지를 1장씩 올리면 총 업로드 시간이 직렬로 누적된다.
  ```typescript
  for (let i = 0; i < files.length; i++) {
    const { error: uploadError } = await admin.storage.from('past-exams').upload(...)
    // 실패 시 롤백 로직 포함 — 이 때문에 직렬
  }
  ```
  롤백 로직이 직렬 업로드를 강제한다는 점은 이해되나,
  실패 확률이 낮은 경우 병렬 업로드 후 실패 시 전체 롤백이 더 효율적이다.
- **영향**:
  - 이미지 20장 × 업로드 200ms = 4초 순차 vs 병렬 ~500ms
  - 사용자가 업로드 완료를 기다리는 시간 증가
- **제안 (단계적 접근)**:
  - 단기: 5장씩 chunked 병렬 업로드 (`Promise.all(chunk)`)
  - 장기: Supabase Storage presigned URL을 클라이언트에서 직접 병렬 업로드 (서버 부하 제거)
  - 롤백은 `uploadedPaths` 배열로 추적하여 실패 시 일괄 삭제 — 현재 구조와 호환

---

### [SHOULD FIX] Signed URL 만료 시간 불일치

- **파일**:
  - `src/lib/actions/past-exams.ts` : 440 — 60초
  - `src/lib/actions/extract-questions.ts` : 129, 286 — 300초 (5분)
  - `src/app/(dashboard)/past-exams/[id]/edit/extraction-editor.tsx` : 106 — 300초
- **문제**:
  목적에 따라 만료 시간이 60초(상세 조회)와 300초(추출 처리)로 혼재한다.
  `getPastExamDetail`의 60초 URL은 편집기에서 이미지를 표시하는 용도로 사용되는데,
  편집기 세션이 60초를 초과하면 이미지가 만료된다.
  편집기(`extraction-editor.tsx`)는 300초 URL을 별도로 생성하나,
  `getPastExamDetail`의 `signedImageUrls`도 프론트로 전달되어 혼용 가능성이 있다.
  ```typescript
  // past-exams.ts (60초) — 상세 조회용
  .createSignedUrl(img.source_image_url, 60)
  // extraction-editor.tsx (300초) — 편집기 표시용
  .createSignedUrl(img.sourceImageUrl, 300)
  ```
- **영향**:
  - 60초 이상 편집 시 이미지 만료 → 404 오류
  - 불필요한 이중 Signed URL 생성 (상세 조회 + 편집기에서 각각 생성)
- **제안**:
  편집기 용도는 **최소 600–1800초(10–30분)** 만료가 적절하다.
  `getPastExamDetail`의 `signedImageUrls`를 편집기에서 사용하지 않는다면
  상세 조회에서 Signed URL 생성을 제거하고 편집기에서만 생성하도록 단일화한다.

---

### [CONSIDER] `sharp` dynamic import — 문제 없으나 매 호출마다 모듈 로딩

- **파일**: `src/lib/actions/extract-questions.ts` : 256
- **문제**:
  ```typescript
  const sharp = (await import('sharp')).default
  ```
  `'use server'` 파일이므로 클라이언트 번들 포함 위험은 없다. 양호.
  그러나 `extractQuestionsAction` 호출마다 dynamic import가 실행된다.
  Node.js 모듈 캐시가 있어 실제로는 두 번째 호출부터 비용이 0에 가깝지만,
  첫 호출 시 모듈 로딩 오버헤드가 발생할 수 있다.
- **영향**: 첫 추출 호출 시 ~50ms 추가 지연 (미미한 수준)
- **제안**:
  파일 최상단에서 조건부 import 대신, 모듈 레벨 싱글턴으로 캐시하는 것을 고려한다.
  단, `'use server'` 파일에서 top-level await 사용 불가이므로
  현재 패턴(dynamic import on first call + Node.js cache)이 실용적으로 적절하다.
  우선순위 낮음.

---

### [CONSIDER] `getPastExamList` — `ilike` 필터가 인덱스 미활용

- **파일**: `src/lib/actions/past-exams.ts` : 344–347
- **문제**:
  ```typescript
  if (school) {
    query = query.ilike('schools.name', `%${school}%`)
  }
  if (subject) {
    query = query.ilike('subject', `%${subject}%`)
  }
  ```
  `%검색어%` 형태의 LIKE 쿼리는 앞에 `%`가 붙으면 B-tree 인덱스를 사용하지 못한다.
  현재 `idx_pe_grade_subject`와 `idx_pe_search`는 이 필터 패턴을 커버하지 않는다.
  `schools.name` 필터는 JOIN된 테이블 컬럼에 대한 필터이므로 PostgREST 내부적으로
  WHERE school.name ILIKE 형태로 변환되어 인덱스를 전혀 사용하지 못할 수 있다.
- **영향**:
  - 데이터 수 적을 때(수백 건)는 무시 가능한 수준
  - 학원당 기출문제가 수천 건 이상 축적되면 full scan 비용 증가
  - academy_id 필터(RLS)가 선행되므로 실제 스캔 범위는 academy 내로 제한됨
- **제안**:
  단기적으로는 현재 구조 유지 (MVP 단계).
  데이터 증가 시 PostgreSQL `pg_trgm` 확장 + GIN 인덱스 적용을 검토한다.
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX idx_pe_subject_trgm ON past_exams USING GIN (subject gin_trgm_ops);
  CREATE INDEX idx_schools_name_trgm ON schools USING GIN (name gin_trgm_ops);
  ```

---

### [CONSIDER] `raw_ai_response` TEXT 컬럼 — 대용량 JSON 저장

- **파일**: `supabase/migrations/20260315_past_exam_restructure.sql` : 31–32
- **문제**:
  ```sql
  raw_ai_response TEXT,  -- AI 원본 응답 백업 (디버깅 + 재분석 시 참조)
  ```
  Gemini Vision API의 원본 응답을 `TEXT`로 `past_exams` 행에 직접 저장한다.
  20문제 × 이미지 설명 포함 시 JSON 크기가 수십~수백 KB에 달할 수 있다.
  `getPastExamList`의 `count: 'exact'` 쿼리는 이 컬럼을 select하지 않으나,
  목록 조회 시 PostgreSQL이 페이지네이션 전 전체 행을 scan할 때 heap 크기에 영향을 준다.
  `past_exams` 행 크기가 커질수록 sequential scan 비용 증가.
- **영향**:
  - 행 크기 증가 → buffer pool 효율 감소
  - 현재 MVP 단계에서는 미미한 수준
- **제안**:
  `raw_ai_response`를 별도 테이블로 분리하거나 Supabase Storage에 JSON 파일로 저장한다.
  `past_exams` 기본 쿼리 성능을 보호할 수 있다.
  단, 디버깅/재분석 용도가 명확하므로 Phase 2 이후 데이터 증가 시 검토.

---

## 점검 항목별 최종 판정

| 점검 항목 | 판정 | 심각도 |
|-----------|------|--------|
| N+1 쿼리 | crop 단계 중복 fetch 발견 | MUST FIX |
| 메모리 | 직렬 변환 적용됨 (양호) | — |
| 번들 사이즈 | `'use server'` + dynamic import 확인 (양호) | — |
| 인덱스 커버리지 | `ilike` 필터 미커버 (허용) | CONSIDER |
| 불필요한 재렌더링 | 재렌더링 이슈 없음 (양호) | — |
| API 호출 효율 | reanalyze 전체 이미지 전달 | SHOULD FIX |
| Signed URL 생성 | 직렬 루프 + 만료 시간 불일치 | MUST FIX / SHOULD FIX |

---

## 우선순위 요약

| 순위 | 이슈 | 예상 개선 효과 |
|------|------|----------------|
| 1 | crop 중복 fetch 제거 | 추출 시간 ~30–60초 단축, Storage 비용 절감 |
| 2 | Signed URL 병렬 생성 | 상세 페이지 로딩 ~1초 단축 |
| 3 | Signed URL 만료 시간 단일화 | 편집기 이미지 만료 버그 예방 |
| 4 | reanalyze 페이지 범위 최적화 | Gemini API 비용 ~90% 절감 |
| 5 | 이미지 업로드 병렬화 | 업로드 시간 ~4초 → ~500ms |
