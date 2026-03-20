# 기출문제 추출 — 성능 리뷰 v2 (MUST FIX 수정 후 재리뷰)

> 리뷰어: perf-reviewer v2
> 일자: 2026-03-20
> 선행 리뷰: `docs/reviews/extraction-perf-review.md`

---

## 요약

MUST FIX 2건 모두 완전히 수정되었음을 확인했다.
수정 과정에서 새로운 성능 이슈는 발생하지 않았다.
SHOULD FIX 3건 중 2건은 미적용(의도적 유보) 상태이며, 1건(Signed URL 만료 시간)은 부분 개선되었다.

MUST FIX: 0건 (기존 2건 → 모두 해소)
SHOULD FIX: 3건 (기존과 동일, 상태 업데이트)
CONSIDER: 3건 (변동 없음)

---

## MUST FIX 수정 확인

---

### [RESOLVED] crop 단계 — 중복 fetch 제거 확인

- **파일**: `src/lib/actions/extract-questions.ts` : 232–247, 282–287
- **수정 내용**: `imageBufferMap = new Map<number, Buffer>()`를 5b 단계에서 구성하고,
  5d crop 단계에서 `imageBufferMap.get(figure.pageNumber)`로 재사용한다.
  중복 `createSignedUrl` + `fetch` + `arrayBuffer` 호출이 완전히 제거되었다.
- **코드 확인**:
  ```typescript
  // 5b: Buffer 맵 구성 (1회)
  const imageBufferMap = new Map<number, Buffer>()
  const buffer = Buffer.from(arrayBuffer)
  imageBufferMap.set(image.page_number, buffer)  // ← 캐시

  // 5d: crop에서 맵 재사용 (0회 추가 fetch)
  const imgBuffer = imageBufferMap.get(figure.pageNumber)
  if (!imgBuffer) { figureUrls.set(i, null); continue }
  ```
- **주석**: "pageNumber로 5b에서 캐싱한 Buffer 재사용 (중복 fetch 방지)" — 의도 명확히 문서화됨
- **판정**: FULLY RESOLVED

---

### [RESOLVED] Signed URL 직렬 생성 루프 — 병렬화 확인

#### `src/lib/actions/past-exams.ts` (430–454)

```typescript
// 수정 후: Promise.all 병렬화
const signedUrlResults = await Promise.all(
  rawImages.map(async (img: any) => {
    if (!img.source_image_url) return null
    const { data: signedData } = await supabase.storage
      .from('past-exams')
      .createSignedUrl(img.source_image_url, 60)
    return signedData?.signedUrl ?? null
  })
)
```

주석: "Promise.all 병렬화 — 직렬 대비 N배 빠른 Signed URL 생성" — 명확히 기술됨.

#### `src/app/(dashboard)/past-exams/[id]/edit/extraction-editor.tsx` (100–108)

```typescript
// 수정 후: Promise.all 병렬화
const results = await Promise.all(
  initialImages.map(async (img) => {
    const { data } = await supabase.storage
      .from('past-exams')
      .createSignedUrl(img.sourceImageUrl, 300)
    return { pageNumber: img.pageNumber, signedUrl: data?.signedUrl ?? null }
  })
)
```

주석: "Promise.all 병렬화 — 직렬 대비 N배 빠른 Signed URL 생성" — 명확히 기술됨.

- **판정**: FULLY RESOLVED (두 파일 모두)

---

## SHOULD FIX 현재 상태

---

### [SHOULD FIX — 미적용] `reanalyzeQuestion` — 전체 이미지 전달

- **파일**: `src/lib/actions/extract-questions.ts` : 540, `src/lib/actions/extract-questions.ts` : 484–485
- **현재 상태**: 변경 없음. `buildImageParts(supabase, detail.past_exams.id)`로 전체 이미지를 여전히 전달.
- **주석에서 의도 확인**: 함수 JSDoc에 "전체 이미지를 전달하는 이유: 페이지 경계를 넘는 문제 가능성 / AI 컨텍스트 일관성 보장 / 특정 페이지만 전달하면 앞뒤 맥락 부족으로 정확도 저하 우려"라고 명시됨.
  → 의도적 유보임을 주석으로 문서화했으므로 현재 상태 수용 가능.
- **리스크**: Gemini Vision API 비용 및 응답 시간 측면에서 여전히 개선 여지 있음.
  재분석 빈도가 높아지면 Phase 2에서 재검토 권장.
- **판정**: INTENTIONALLY DEFERRED (의도적 유보, 수용 가능)

---

### [SHOULD FIX — 미적용] 이미지 업로드 순차 처리

- **파일**: `src/lib/actions/exam-management.ts` (이번 리뷰 대상 외)
- **현재 상태**: 리뷰 범위 외 파일이므로 이번 재리뷰에서 확인 생략.
  이전 리뷰에서 "롤백 로직이 직렬 업로드를 강제"하는 구조적 이유가 있음을 확인했으며,
  단기 수용 가능한 수준으로 판단됨.
- **판정**: DEFERRED (Phase 2 검토 예정)

---

### [SHOULD FIX — 부분 개선] Signed URL 만료 시간

- **파일**: `src/lib/actions/past-exams.ts` : 437 / `src/app/(dashboard)/past-exams/[id]/edit/extraction-editor.tsx` : 105
- **이전 문제**: `getPastExamDetail`(60초) vs 편집기(300초) 불일치 + 이중 생성.
- **현재 상태**:
  - `getPastExamDetail`: **60초 유지** — 상세 페이지 빠른 조회용으로 적절.
  - `extraction-editor.tsx`: **300초(5분)** — 편집기 전용 URL 별도 생성.
  - 구조: 두 URL이 용도별로 분리되어 있음 (`signedImageUrls`는 상세 조회용, `imageSignedUrls`는 편집기 표시용).
  - 개선점: 기존 `getPastExamDetail.signedImageUrls`를 편집기에서 사용하지 않고 편집기가 별도로 300초 URL을 생성하는 구조로 정리됨. 이중 생성은 유지되나 혼용 가능성이 제거됨.
- **잔존 이슈**:
  - 300초(5분) 편집 세션도 장시간 편집자에게는 여전히 짧을 수 있음.
  - 상세 조회 + 편집기 페이지 로드 시 Signed URL이 2회 생성됨 (비용 소폭 증가).
- **판정**: PARTIALLY IMPROVED (혼용 위험 제거됨, 만료 시간 연장은 미적용)

---

## 새로운 이슈 확인

수정 과정에서 신규 성능 이슈는 발견되지 않았다.

추가로 긍정적으로 확인된 사항:

1. **`imageBufferMap` 메모리 해제**: `extractQuestionsAction` 스코프 내 지역 변수로 선언되어 함수 종료 시 GC 대상이 됨. 메모리 누수 없음.

2. **`Promise.all` 메모리 안전성**: Signed URL 생성은 URL 문자열(수십 바이트)만 병렬 보유하므로 이전 리뷰의 "직렬 유지" 권고(이미지 본문 fetch는 직렬)가 올바르게 준수됨. `buildImageParts`의 본문 fetch는 여전히 `for...of` 직렬이고, Signed URL 생성만 `Promise.all` 처리됨 — 권고와 일치.

3. **race condition 방어**: `extraction-editor.tsx`의 `loadSignedUrls` useEffect에 `let cancelled = false` + cleanup 패턴이 유지됨. 병렬화 후에도 race condition 방어 코드가 보존됨.

---

## CONSIDER 항목 현황 (변동 없음)

| 항목 | 상태 |
|------|------|
| `sharp` dynamic import | 변동 없음. Node.js 모듈 캐시로 두 번째 호출부터 비용 0. MVP에서 수용 가능. |
| `ilike` 인덱스 미커버 | 변동 없음. 데이터 증가 시 `pg_trgm` 검토 예정. |
| `raw_ai_response` TEXT 컬럼 | 변동 없음. Phase 2 이후 별도 테이블 분리 검토 예정. |

---

## 최종 판정표

| 이슈 | v1 상태 | v2 상태 |
|------|---------|---------|
| crop 중복 fetch | MUST FIX | RESOLVED |
| Signed URL 직렬 생성 | MUST FIX | RESOLVED |
| reanalyze 전체 이미지 | SHOULD FIX | INTENTIONALLY DEFERRED |
| 업로드 순차 처리 | SHOULD FIX | DEFERRED (Phase 2) |
| Signed URL 만료 불일치 | SHOULD FIX | PARTIALLY IMPROVED |
| sharp dynamic import | CONSIDER | 유지 |
| ilike 인덱스 | CONSIDER | 유지 |
| raw_ai_response TEXT | CONSIDER | 유지 |

---

## 종합 평가

MUST FIX 2건이 모두 올바르게 구현되었으며, 수정 의도가 코드 주석으로 명확히 문서화되어 있다.
수정 코드의 메모리 안전성과 race condition 방어가 유지되고 있다.
현재 코드는 성능 관점에서 MVP 출시 기준을 충족한다.

SHOULD FIX 잔여 이슈(reanalyze 전체 이미지, 업로드 순차 처리, Signed URL 만료 연장)는
재분석 사용량 및 업로드 파일 수 증가 추세를 모니터링한 뒤 Phase 2에서 우선순위를 결정하도록 권장한다.
