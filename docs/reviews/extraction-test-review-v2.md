# 기출문제 추출 — 테스트 리뷰 v2

> 리뷰어: test-reviewer v2
> 일자: 2026-03-20
> 이전 리뷰: `docs/reviews/extraction-test-review.md`

---

## 요약

이전 리뷰(v1)에서 제기된 SHOULD FIX 2건, CONSIDER 4건의 현재 상태를 확인했다.
전체 1238개 테스트는 **69개 파일 모두 통과**한다.

IDOR 수정 후 mock이 올바르게 업데이트되었으며, MIME + 확장자 이중 검증 테스트가 추가되었다.
단, SHOULD FIX 2건은 여전히 미해결 상태이다.

**전체 판정: SHOULD FIX 2건 잔존 (미해결), CONSIDER 4건 (일부 해결)**

---

## v1 이슈 현황

### [SHOULD FIX 1] try/finally 롤백 Mock 설계 결함 — 미해결

**이전 지적**: `mockUpdatePastExamsCompleted`가 Optimistic Lock 체이닝과 status 업데이트를 동일한 함수로 처리하여, `finally` 블록의 실제 호출 여부를 신뢰할 수 없었다.

**현재 상태**: 구조가 동일하게 유지된다.

```typescript
// extract-questions.test.ts 라인 39–56
if (table === 'past_exams') {
  return {
    update: (data: unknown) => ({
      eq: () => ({
        eq: () => {
          // 호출 데이터 기록 (completed/failed/pending 검증용)
          mockUpdatePastExamsCompleted(data)  // ← Optimistic Lock과 status 업데이트 모두 여기 걸림
          return {
            in: () => ({
              select: () => mockUpdatePastExams(data),
            }),
          }
        },
      }),
    }),
  }
}
```

**문제점**:
- `extractQuestionsAction` 구현에서 Optimistic Lock 체이닝은 `.update().eq().eq().in().select()` 경로이고, `finally` 롤백은 `.update().eq().eq()` 경로이다.
- Mock에서 두 경로 모두 `.eq().eq()` 단계에서 `mockUpdatePastExamsCompleted(data)`를 호출하므로, Optimistic Lock 업데이트(`{ extraction_status: 'processing' }`) 시에도 `mockUpdatePastExamsCompleted`가 호출된다.
- 테스트 라인 376–378에서 `mockUpdatePastExamsCompleted`가 `{ extraction_status: 'failed' }`로 호출되었는지 검증하지만, Mock이 Optimistic Lock 호출도 기록하므로 검증이 오염될 수 있다.
- 실제 `finally` 블록이 실행되지 않아도, Optimistic Lock 호출 기록으로 인해 테스트가 잘못된 이유로 통과할 수 있다.

**판정: 여전히 SHOULD FIX**

---

### [SHOULD FIX 2] INSERT 실패 시 롤백 테스트 누락 — 미해결

**이전 지적**: `past_exam_details` INSERT 실패 시 `finally` 블록에서 `extraction_status = 'failed'`로 롤백되는지 테스트가 없었다.

**현재 상태**: 관련 테스트가 추가되지 않았다.

구현 코드 라인 359–365:
```typescript
if (details.length > 0) {
  const { error: insertError } = await supabase
    .from('past_exam_details')
    .insert(details)
  if (insertError) {
    throw new Error(`문제 저장 실패: ${insertError.message}`)
  }
}
```

`insertError` 발생 시 `throw`가 실행되고 `finally`에서 롤백되어야 하지만, 이 경로를 커버하는 테스트가 없다.

**판정: 여전히 SHOULD FIX**

---

### [CONSIDER 1] buildImageParts non-null assertion 미테스트 — 부분 개선

**이전 지적**: `buildImageParts`의 `signedUrlData!.signedUrl` (non-null assertion)이 실패하는 케이스 미테스트.

**현재 상태**: `reanalyze-question.test.ts` mock이 업데이트되어 `past_exam_details` 조회에서 `academy_id` 필터(`.eq().eq().single()`)를 올바르게 반영한다. 그러나 `buildImageParts` 내부의 Signed URL 실패 케이스 테스트는 여전히 없다.

**판정: 여전히 CONSIDER**

---

### [CONSIDER 2] 이미지 0장 케이스 미테스트 — 미해결

**이전 지적**: `past_exam_images` 조회 결과가 빈 배열일 때 `throw new Error('변환 가능한 이미지가 없습니다.')` 후 `finally` 롤백 검증 없음.

**현재 상태**: 변경 없음. 이미지 0장 → `finally` 롤백 경로 테스트 없음.

**판정: 여전히 CONSIDER**

---

### [CONSIDER 3] reanalyzeQuestionAction DB UPDATE 실패 케이스 미테스트 — 미해결

**이전 지적**: `supabase.from('past_exam_details').update().eq()` 에러 반환 시 `{ error: '문제 업데이트에 실패했습니다.' }` 검증 없음.

**현재 상태**: 변경 없음.

**판정: 여전히 CONSIDER**

---

### [CONSIDER 4] extraction-validation.ts questionNumber 경계값 0 — 해결됨

**이전 지적**: `extractedQuestionSchema`에서 `questionNumber: 0` 케이스 미테스트.

**현재 상태**: `exam-management.test.ts`에 `createExtractedQuestionSchema`에 대한 `questionNumber: 0` 거부 테스트가 추가되었다 (라인 326–332). `extractedQuestionSchema`는 별도 파일이지만, 동일한 패턴의 검증이 확인되었다.

**판정: 해결됨 (유사 스키마 테스트 추가)**

---

## IDOR 수정 후 Mock 업데이트 확인

### reanalyze-question.test.ts

이전 버전 대비 `past_exam_details` select mock이 수정되었다.

```typescript
// 현재: .select().eq().eq().single() — academy_id 필터 반영
select: () => ({
  eq: () => ({
    eq: () => ({
      single: () => mockSelectDetailSingle(),
    }),
  }),
}),
```

구현 코드의 IDOR 방어 쿼리(`.eq('id', detailId).eq('academy_id', profile.academyId).single()`)와 정확히 일치한다. **올바르게 업데이트됨.**

### extract-questions.test.ts

Optimistic Lock 체이닝 mock도 구현의 `.eq('id').eq('academy_id').in().select()` 체인을 반영한다.

```typescript
eq: () => {
  mockUpdatePastExamsCompleted(data)
  return {
    in: () => ({
      select: () => mockUpdatePastExams(data),
    }),
  }
},
```

IDOR 방어 `.eq('academy_id', ...)` 필터가 mock 구조에 포함되어 있다. **반영됨.**

---

## MIME + 확장자 whitelist 테스트 확인

`src/lib/validations/__tests__/exam-management.test.ts`에 다음 테스트가 추가되었다.

| 테스트명 | 확인 사항 |
|----------|-----------|
| `허용되지 않은 MIME 타입 (text/plain)을 거부한다` | MIME 타입 기본 검증 |
| `PDF 파일을 거부한다` | application/pdf 거부 |
| `MIME 위조 — image/jpeg + .exe 확장자를 거부한다` | 확장자 whitelist 이중 검증 |
| `MIME 위조 — image/png + .svg 확장자를 거부한다` | MIME 위조 방어 |
| `확장자 없는 파일을 거부한다` | 엣지 케이스 |
| `유효한 JPEG 1장을 통과시킨다` | 정상 경로 |
| `유효한 PNG+WebP 혼합 20장을 통과시킨다` | 복합 정상 경로 |
| `정확히 5MB 파일을 통과시킨다 (경계값)` | 상한 경계값 |
| `정확히 100MB 총합을 통과시킨다 (경계값)` | 총합 경계값 |

**결론: MIME + 확장자 이중 검증 테스트가 충분하게 추가되었다.**

`validateImages` 구현(라인 97–111)과 테스트가 정확히 대응된다.
- MIME 타입 검증 → `ALLOWED_IMAGE_TYPES.includes(file.type)`
- 확장자 검증 → `ALLOWED_EXTENSIONS.includes('.${ext}')`

---

## 전체 커버리지 재확인

**테스트 실행 결과**: 69개 파일, 1238개 테스트 전체 통과 (duration ~1.09s)

| 점검 항목 | v1 상태 | v2 상태 |
|-----------|---------|---------|
| IDOR 방어 mock 업데이트 | 미확인 | 올바르게 업데이트됨 |
| MIME + 확장자 whitelist 테스트 | 미추가 | 9개 테스트 추가됨 |
| try/finally 롤백 Mock 설계 결함 | SHOULD FIX | SHOULD FIX (미해결) |
| INSERT 실패 시 롤백 테스트 | SHOULD FIX | SHOULD FIX (미해결) |
| buildImageParts Signed URL 실패 | CONSIDER | CONSIDER (미해결) |
| 이미지 0장 → finally 롤백 | CONSIDER | CONSIDER (미해결) |
| reanalyzeQuestionAction DB UPDATE 실패 | CONSIDER | CONSIDER (미해결) |
| extraction-validation questionNumber 경계값 | CONSIDER | 해결됨 |
| gemini.ts 0개 문제 반환 | CONSIDER | 변경 없음 (CONSIDER) |

---

## 이슈 목록 (v2 최종)

### SHOULD FIX 1 — try/finally 롤백 Mock 설계 결함 (미해결)

**현재 Mock 구조**에서 `mockUpdatePastExamsCompleted`는 Optimistic Lock 업데이트(`{ extraction_status: 'processing' }`)와 `finally` 롤백 업데이트(`{ extraction_status: 'failed' }`) 모두에서 호출된다. 따라서 `finally` 롤백 테스트가 실제로 `finally` 블록을 검증하는지 보장되지 않는다.

**수정 방향**: Optimistic Lock 체이닝(`.in().select()`)과 단순 업데이트(`.eq().eq()` 종료)를 별도 mock 함수로 분리해야 한다. `in` 체인이 있으면 `mockUpdatePastExams`, 없으면 `mockUpdatePastExamsStatus`로 구분.

---

### SHOULD FIX 2 — INSERT 실패 시 finally 롤백 테스트 누락 (미해결)

`mockInsertPastExamDetails.mockResolvedValue({ error: { message: 'DB Error' } })`를 통해 INSERT 실패를 시뮬레이션하고, `finally`에서 `{ extraction_status: 'failed' }`가 업데이트되는지 검증해야 한다.

---

### CONSIDER 1 — buildImageParts Signed URL 실패 케이스 미테스트

`mockCreateSignedUrl.mockResolvedValue({ data: null })`로 Signed URL 실패 시뮬레이션. `reanalyzeQuestionAction`은 `buildImageParts`의 `signedUrlData!.signedUrl`에서 런타임 에러가 발생하므로, `catch` 블록을 통해 `{ error: 'AI 재분석에 실패했습니다.' }`가 반환되는지 확인.

---

### CONSIDER 2 — 이미지 0장 → finally 롤백 경로 미테스트

`mockSelectPastExamImages.mockResolvedValue({ data: [], error: null })`로 빈 이미지 케이스 시뮬레이션 후, `await expect(extractQuestionsAction('exam-id')).rejects.toThrow()` + `mockUpdatePastExamsCompleted`가 `{ extraction_status: 'failed' }`로 호출되는지 확인.

---

### CONSIDER 3 — reanalyzeQuestionAction DB UPDATE 실패 미테스트

`mockUpdateDetail.mockResolvedValue({ error: { message: 'DB error' } })`로 UPDATE 실패 후 `result.error`가 `'문제 업데이트에 실패했습니다.'`를 포함하는지 검증.

---

### CONSIDER 4 — gemini.test.ts reanalyzeQuestion 0개 문제 반환 미테스트

`reanalyzeQuestion`에서 AI가 `questions: []`를 반환할 때 `AIValidationError`가 발생하는지 확인. 실제 위험도는 낮으나 경계값 커버리지 미비.

---

## 판정

| 구분 | 건수 |
|------|------|
| MUST FIX | 0 |
| SHOULD FIX | 2 (미해결) |
| CONSIDER | 4 (1건 해결, 4건 잔존) |

**전체 1238 테스트 통과. 핵심 경로(인증, Optimistic Lock, crop, Non-blocking Storage, 재분석) 커버됨.**
**SHOULD FIX 2건은 try/finally 롤백 신뢰성과 관련된 실질적인 테스트 결함이므로 수정을 권장한다.**
