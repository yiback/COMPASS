# 기출문제 추출 — 코드 리뷰 최종 리포트

> 리드: 리뷰 종합
> 일자: 2026-03-20
> 대상: 세션 25 기출문제 추출 구현 (34개 파일, 1235 tests)

---

## 요약

3명의 리뷰어(security, perf, test)가 병렬로 코드 리뷰를 수행했다.
전반적으로 기존 패턴(Defense in Depth, Zod 검증, 'use server' 선언)이 일관되게 적용되어 있으나,
보안 2건 + 성능 2건의 MUST FIX가 발견되었다.

---

## MUST FIX (4건 — 배포 전 필수)

### 1. [Security HIGH] IDOR — UPDATE 쿼리에 academy_id 필터 누락

- **파일**: `src/lib/actions/extract-questions.ts`
- **문제**: `extractQuestionsAction`, `resetExtractionAction`, `reanalyzeQuestionAction`의 UPDATE/DELETE 쿼리에 `.eq('academy_id', profile.academyId)` 누락
- **영향**: RLS가 비활성화된 환경에서 다른 학원의 시험 상태 변조 가능
- **수정**: 모든 UPDATE/DELETE 쿼리에 `.eq('academy_id', profile.academyId)` 추가

### 2. [Security HIGH] 파일 MIME 타입 클라이언트 신뢰

- **파일**: `src/lib/actions/exam-management.ts`, `src/lib/validations/exam-management.ts`
- **문제**: `file.type`은 브라우저가 제공하는 선언값으로 위조 가능
- **영향**: `.js` 파일을 `image/jpeg`로 위장하여 Storage 업로드 후 XSS 가능
- **수정**: 파일 확장자 whitelist 체크 추가 (`.jpg`, `.jpeg`, `.png`, `.webp`)

### 3. [Perf HIGH] crop 단계 중복 fetch

- **파일**: `src/lib/actions/extract-questions.ts` (crop 처리 부분)
- **문제**: 5b 단계에서 이미 fetch한 이미지를 crop 시 figure마다 재download
- **영향**: 20장 × 3 figures = 60회 추가 Storage 호출, 30-60초 추가
- **수정**: 5b 단계에서 `pageNumber → Buffer` 맵 구성 → crop에서 재사용

### 4. [Perf HIGH] Signed URL 직렬 생성

- **파일**: `src/lib/actions/past-exams.ts`, `extraction-editor.tsx`
- **문제**: 이미지 N장의 Signed URL을 순차 생성 (N × 50ms)
- **영향**: 20장 기준 ~1초 지연
- **수정**: `Promise.all` 병렬화

---

## SHOULD FIX (8건 — 조기 수정 권장)

| # | 출처 | 이슈 | 파일 |
|---|------|------|------|
| 1 | Security | options/answer/questionText Zod `max()` 누락 | `exam-management.ts` validation |
| 2 | Security | feedback 프롬프트 인젝션 sanitize 부재 | `extract-questions.ts` |
| 3 | Security | reanalyzeQuestionAction academy_id 비교 미사용 | `extract-questions.ts` |
| 4 | Perf | reanalyze 전체 이미지 전달 (해당 페이지만 전달 가능) | `extract-questions.ts` |
| 5 | Perf | 이미지 업로드 순차 → chunked 병렬 | `exam-management.ts` |
| 6 | Perf | Signed URL 만료 시간 불일치 (60초 vs 300초) | 여러 파일 |
| 7 | Test | try/finally 롤백 Mock 설계 결함 | `extract-questions.test.ts` |
| 8 | Test | INSERT 실패 시 롤백 테스트 누락 | `extract-questions.test.ts` |

---

## CONSIDER (9건 — Phase 2에서 검토)

| # | 출처 | 이슈 |
|---|------|------|
| 1 | Security | `raw_ai_response` SELECT 기본 제외 유지 필요 |
| 2 | Security | images INSERT 실패 시 exam 레코드 롤백 |
| 3 | Perf | `ilike` 검색 필터 인덱스 미활용 (pg_trgm) |
| 4 | Perf | sharp dynamic import 패턴 유지 |
| 5 | Perf | raw_ai_response TEXT 컬럼 대용량 |
| 6 | Test | buildImageParts non-null assertion 테스트 |
| 7 | Test | 이미지 0장 에러 + 롤백 흐름 테스트 |
| 8 | Test | reanalyze DB UPDATE 실패 테스트 |
| 9 | Test | gemini reanalyzeQuestion 0개 문제 반환 테스트 |

---

## 상세 리뷰 문서

| 리뷰어 | 산출물 |
|--------|--------|
| security-reviewer | `docs/reviews/extraction-security-review.md` |
| perf-reviewer | `docs/reviews/extraction-perf-review.md` |
| test-reviewer | `docs/reviews/extraction-test-review.md` |
