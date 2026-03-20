# 기출문제 추출 — 보안 리뷰

> 리뷰어: security-reviewer
> 일자: 2026-03-20

---

## 요약

기출문제 추출 기능(세션 25)의 7개 파일을 점검한 결과, **전반적인 보안 수준은 양호**하다. 기존 패턴(Defense in Depth: Server Action + Zod + RLS 3중 방어, academy_id 자동 격리)이 신규 코드에도 일관되게 적용되어 있다. 다만 보안에 직접 영향을 미치는 **HIGH 이슈 2건**, 보완이 권장되는 **MEDIUM 이슈 3건**, 개선 검토 대상 **LOW 이슈 2건**을 발견했다.

---

## 이슈 목록

### [HIGH] IDOR — extractQuestionsAction의 pastExamId academy_id 교차 검증 부재

> **MUST FIX**

- **파일**: `src/lib/actions/extract-questions.ts:178-199`
- **문제**: `extractQuestionsAction`은 Optimistic Lock UPDATE 쿼리를 실행할 때 `academy_id = profile.academyId` 조건을 붙이지 않는다. RLS가 있으므로 실제 다른 학원의 시험은 접근되지 않지만, UPDATE 쿼리에 명시적 academy_id 필터가 없어 **RLS 단독 의존** 상태가 된다.
  ```typescript
  // 현재 코드 (178-193)
  const { data: locked } = await supabase
    .from('past_exams')
    .update({ extraction_status: 'processing' })
    .eq('id', pastExamId)
    .in('extraction_status', ['pending', 'failed'])
    // ← .eq('academy_id', profile.academyId) 없음
    .select('id, subject, grade, exam_type, academy_id')
  ```
- **영향**: RLS 정책이 잘못 설정되거나 비활성화된 경우(dev 환경, 마이그레이션 오류 등) 다른 학원의 기출문제를 강제로 'processing' 상태로 전환하는 DoS 성격의 상태 변조 공격 가능. `createPastExamAction`(exam-management.ts)은 INSERT 시 `academy_id: profile.academyId`를 명시하는데, UPDATE에서 일관성이 결여되어 있다.
- **제안**: UPDATE 조건에 `.eq('academy_id', profile.academyId)` 추가. `resetExtractionAction`(ln 456-468)과 `reanalyzeQuestionAction`(ln 566-585)의 UPDATE도 동일하게 적용. 기존 `exam-management.ts`의 `confirmExtractedQuestionsAction`(ln 396-407)도 같은 패턴으로 보완 필요.

---

### [HIGH] 파일 확장자 기반 Content-Type 신뢰 — MIME 타입 스니핑 우회 가능

> **MUST FIX**

- **파일**: `src/lib/actions/exam-management.ts:234`
- **문제**: Storage 업로드 시 `contentType: file.type`을 그대로 사용한다. 브라우저가 제공하는 `File.type`은 클라이언트 선언값으로, 공격자가 `.js` 파일을 `image/jpeg`로 선언하면 검증을 통과한다. `validateImages()`에서 `file.type`으로 MIME 검사를 하지만 이 역시 동일한 클라이언트 제공값이다.
  ```typescript
  // exam-management.ts:234 — file.type이 클라이언트 선언값
  const { error: uploadError } = await admin.storage
    .from('past-exams')
    .upload(storagePath, file, { contentType: file.type, upsert: false })
  ```
- **영향**: SVG 등 스크립트 실행 가능한 파일 타입을 이미지로 위장하여 업로드 후 Signed URL로 렌더링 시 XSS 가능. 단, 현재 코드가 `ALLOWED_IMAGE_TYPES`(jpeg/png/webp)만 허용하므로 실제 공격 가능 Surface는 제한적.
- **제안**:
  1. **단기**: 확장자를 추출해 허용 확장자(jpg, jpeg, png, webp)와 대조 검증 추가. `file.name.split('.').pop()`을 활용한 whitelist 체크.
  2. **중기**: `sharp`로 이미지 처리 시 실제 픽셀 데이터를 읽으므로 비이미지 파일은 sharp 에러로 걸러지나, 이는 추출 단계에서만 발견된다. 업로드 단계에서 `file-type` 라이브러리로 magic bytes 검사 추가 권장.
  3. Storage 버킷의 `Content-Type` 응답 헤더에 `X-Content-Type-Options: nosniff` 설정 확인(Supabase 버킷 설정).

---

### [MEDIUM] `reanalyzeQuestionAction` — detailId의 소속 학원 교차검증 미흡

> **SHOULD FIX**

- **파일**: `src/lib/actions/extract-questions.ts:503-529`
- **문제**: `detailId`로 `past_exam_details`를 조회할 때 RLS가 `academy_id` 격리를 보장하므로 실제 다른 학원 데이터를 읽을 수 없다. 그러나 detail 조회 후 얻은 `past_exams.id`로 `buildImageParts`를 호출할 때, 해당 `past_exams`가 현재 사용자의 학원 소속인지 명시적으로 재검증하지 않는다. `getCurrentUserWithRole()`에서 `profile`을 받아와도 이후 쿼리에서 사용하지 않는다.
  ```typescript
  // ln 486-489: profile을 받지만 이후에 사용하지 않음
  const { error: authError } = await getCurrentUserWithRole()
  if (authError) { return { error: authError } }
  // profile을 버림 → 이후 academy_id 비교 없음
  ```
- **영향**: RLS 의존도가 높으나 `resetExtractionAction`도 동일. 보안은 유지되지만 단독 방어선이 취약해지는 구조.
- **제안**: `getCurrentUserWithRole()` 반환값의 `profile`을 수신하고, detail 조회 후 `detail.academy_id === profile.academyId` 명시적 확인 추가.

---

### [MEDIUM] `updateExtractedQuestionSchema` — options 배열 항목 길이 제한 없음

> **SHOULD FIX**

- **파일**: `src/lib/validations/exam-management.ts:115-122`
- **문제**: `options: z.array(z.string()).optional()` 에서 배열 개수 상한과 개별 문자열 길이 제한이 없다. 공격자가 수천 개의 옵션 항목이나 매우 긴 문자열을 전송할 수 있다.
  ```typescript
  options: z.array(z.string()).optional(),   // 상한 없음
  answer: z.string().optional(),              // 길이 제한 없음
  ```
  `createExtractedQuestionSchema`(ln 130-138)도 동일.
- **영향**: 대용량 payload로 DB 쓰기 부하 또는 응답 사이즈 폭발 가능. JSONB 컬럼에 수십 MB 데이터 저장 시도.
- **제안**:
  ```typescript
  options: z.array(z.string().max(500)).max(10).optional(),
  answer: z.string().max(1000).optional(),
  questionText: z.string().min(1).max(5000, '문제는 5000자 이하여야 합니다.'),
  ```

---

### [MEDIUM] `feedback` 파라미터 — XSS/프롬프트 인젝션 방어 부재

> **SHOULD FIX**

- **파일**: `src/lib/validations/extract-questions.ts:32-34`, `src/lib/actions/extract-questions.ts:556-563`
- **문제**: `feedback: z.string().max(500).optional()`으로 500자 제한은 있으나, HTML/스크립트 태그나 프롬프트 인젝션 패턴(`Ignore previous instructions...`)에 대한 sanitize가 없다. 이 feedback이 AI 프롬프트에 직접 삽입된다.
  ```typescript
  // extract-questions.ts:556-563
  const result = await aiProvider.reanalyzeQuestion({
    userFeedback: feedback,  // ← 사용자 입력이 AI 프롬프트에 직접 삽입
    ...
  })
  ```
- **영향**:
  1. **프롬프트 인젝션**: 공격자가 AI 시스템 프롬프트를 우회하거나 의도치 않은 응답 유도 가능.
  2. **비용 공격**: 반복적인 긴 feedback으로 AI API 호출 비용 증가.
- **제안**:
  1. feedback에 HTML 태그 및 특수 패턴 strip (간단한 정규식 또는 `dompurify` 서버 사이드).
  2. AI Provider 레이어에서 사용자 입력을 시스템 프롬프트와 명확히 분리하는 구조 확인.
  3. 사용자당 재분석 호출 rate limiting 추가 검토.

---

### [LOW] `raw_ai_response` — 민감 정보 저장 위험

> **CONSIDER**

- **파일**: `src/lib/actions/extract-questions.ts:377-380`, `supabase/migrations/20260315_past_exam_restructure.sql:31`
- **문제**: AI 원본 응답 전체를 `raw_ai_response TEXT` 컬럼에 백업한다. 현재 AI 응답이 문제 추출 결과만 포함한다면 문제 없으나, 향후 AI 응답에 개인정보나 민감 정보가 포함될 가능성이 있다. 또한 RLS에서 teacher/admin/system_admin이 이 컬럼을 SELECT할 수 있다.
- **영향**: AI 원본 응답이 불필요하게 노출될 수 있으며, 응답에 따라 다른 학원 정보가 간접적으로 포함될 가능성(낮음).
- **제안**: `raw_ai_response`는 디버깅용이므로 SELECT 쿼리에서 기본적으로 제외(명시적 컬럼 선택 시 포함). 현재 `getPastExamList`, `getPastExamDetail`에서 이 컬럼을 SELECT하지 않는 것은 올바른 패턴. `edit/page.tsx`도 동일하게 미포함이므로 현재는 양호.

---

### [LOW] `createPastExamAction` 롤백 불완전 — past_exams 레코드 잔존 가능성

> **CONSIDER**

- **파일**: `src/lib/actions/exam-management.ts:271-273`
- **문제**: `past_exam_images` INSERT 실패 시 `past_exams` 레코드 삭제 롤백이 없다. `past_exams`는 생성되었으나 이미지가 없는 고아 레코드가 남을 수 있다.
  ```typescript
  // ln 267-273
  const { error: imageDbError } = await supabase
    .from('past_exam_images')
    .insert(imageInserts)
  if (imageDbError) {
    return { error: '이미지 정보 저장에 실패했습니다.' }
    // ← past_exams 삭제 없음
  }
  ```
- **영향**: 보안 이슈보다는 데이터 정합성 문제. 다만 고아 레코드는 다른 사용자의 데이터 목록에 노출되지 않도록 RLS가 보호하므로 직접 보안 영향은 낮음.
- **제안**: `imageDbError` 시 `await supabase.from('past_exams').delete().eq('id', pastExamId)` 추가 (개별 이미지 업로드 실패 롤백과 동일 패턴 적용).

---

## 체크리스트

| 항목 | 상태 | 비고 |
|------|------|------|
| RLS 정책 완전성 | ✅ 통과 | 3개 테이블 모두 SELECT/INSERT/UPDATE/DELETE 커버. student 차단 확인. |
| 인증/인가 | ⚠️ 부분 통과 | `'use server'` 선언 ✅, `getUser()` 호출 ✅, academy_id 기반 격리는 RLS 의존 — HIGH 이슈 1 참조 |
| 입력 검증 | ⚠️ 부분 통과 | Zod 스키마 존재, 이미지 MIME/크기 검증 ✅. options 길이 상한 누락 — MEDIUM 이슈 참조 |
| IDOR 방지 | ⚠️ 부분 통과 | RLS 의존. 일부 Action에서 명시적 academy_id 필터 누락 — HIGH 이슈 1 참조 |
| Storage 보안 | ✅ 통과 | 경로 1번째 컴포넌트 = academyId. 기존 Storage RLS 정책 호환 확인. |
| SQL Injection | ✅ 통과 | Supabase JS Client 쿼리 빌더 사용. 파라미터화 쿼리로 방어됨. |
| `'use server'` 선언 | ✅ 통과 | `extract-questions.ts:9`, `exam-management.ts:14`, `past-exams.ts:9` 모두 존재. |
| 에러 정보 노출 없음 | ✅ 통과 | 모든 에러 반환값이 사용자 친화적 메시지. DB 에러 메시지는 throw 전 래핑됨. |
| 프롬프트 인젝션 방어 | ⚠️ 미흡 | feedback 입력 sanitize 없음 — MEDIUM 이슈 참조 |
| 파일 타입 검증 | ⚠️ 부분 통과 | MIME 검증이 클라이언트 선언값 의존 — HIGH 이슈 2 참조 |

---

## 판정: **BLOCKED**

HIGH 이슈 2건이 존재하므로 구현 단계 완료 판정은 보류합니다.

| 우선순위 | 이슈 | 조치 |
|---------|------|------|
| 1순위 | IDOR — academy_id 명시적 필터 누락 | MUST FIX (Server Action 4곳) |
| 2순위 | 파일 MIME 타입 — 클라이언트 선언값 신뢰 | MUST FIX (확장자 whitelist 추가) |
| 3순위 | options/answer/questionText 길이 제한 | SHOULD FIX (Zod 스키마) |
| 4순위 | feedback 프롬프트 인젝션 | SHOULD FIX (sanitize + rate limit) |
| 5순위 | raw_ai_response 노출 범위 | CONSIDER |
| 6순위 | createPastExamAction 롤백 | CONSIDER |
