# Step 2: 기존 코드 리팩토링 상세 구현 계획 ✅

> **상태**: ✅ 구현 완료 (2026-03-20, 10개 파일 리팩토링, past_exam_questions → 3계층 전환)
> **소유 역할**: 복합 (backend-actions, frontend-ui, tester)
> **의존성**: Step 1 (3계층 스키마 + `supabase gen types` → `src/types/supabase.ts` 업데이트 완료 필수)
> **마스터 PLAN**: `docs/plan/20260308-past-exam-extraction.md` Step 2

---

## 목표

`past_exam_questions` 단일 테이블 참조를 3계층(`past_exams` + `past_exam_images` + `past_exam_details`)으로 전환한다. 기존 테스트 전부 통과 + `past_exam_questions` 직접 참조 0개(deprecated 주석만 잔존)가 완료 기준이다.

---

## 영향 파일 17개 — 각각의 변경 내용

### Action 파일 (3개)

#### 1. `src/lib/actions/past-exams.ts` (backend-actions)

**현재 쿼리 패턴**:
- `uploadPastExamAction`: `past_exam_questions`에 단일 행 INSERT (academy_id, school_id, uploaded_by, year, semester, exam_type, grade, subject, source_image_url, extraction_status)
- `getPastExamList`: `past_exam_questions`에서 FK JOIN (`schools!inner`, `profiles!uploaded_by`) + 필터 + 페이지네이션
- `getPastExamDetail`: `past_exam_questions`에서 FK JOIN + `extracted_content` SELECT + Storage Signed URL 생성

**변경 후 쿼리 패턴**:
- `uploadPastExamAction`: **deprecated 주석 추가** — 즉시 삭제하지 않고 Step 6 완료까지 유지. 함수 상단에 `@deprecated Step 6 이후 삭제 예정. createPastExamAction으로 대체.` JSDoc 추가
- `getPastExamList`:
  ```
  .from('past_exams')
  .select(`
    id, year, semester, exam_type, grade, subject,
    extraction_status, created_at, created_by,
    schools!inner ( name, school_type ),
    profiles!created_by ( name )
  `, { count: 'exact' })
  ```
  - `source_image_url` 제거 (3계층에서는 past_exam_images에 분산)
  - `uploaded_by` → `created_by` FK 변경
  - `profiles!uploaded_by` → `profiles!created_by` FK 힌트 변경
  - 주석 변경: "권한: student 포함" → "권한: teacher/admin/system_admin만 (RLS 적용)"
- `getPastExamDetail`:
  ```
  .from('past_exams')
  .select(`
    id, year, semester, exam_type, grade, subject,
    extraction_status, created_at, created_by,
    schools!inner ( name, school_type ),
    profiles!created_by ( name ),
    past_exam_images ( id, page_number, source_image_url ),
    past_exam_details ( id, question_number, question_text, question_type, confidence, is_confirmed )
  `)
  .eq('id', id)
  .single()
  ```
  - `extracted_content` 제거 → `past_exam_details` JOIN으로 대체
  - Signed URL: 단일 이미지 → 이미지 배열의 첫 번째 이미지만 (기존 UI 호환)
  - 반환 타입 `PastExamDetail` 업데이트: `extractedContent` 제거, `images` / `details` 배열 추가
- `toPastExamListItem` 변환 함수 업데이트:
  - `sourceImageUrl` 필드 제거
  - `uploadedByName` → `profiles!created_by` 경로 변경
- `PastExamListItem` 타입 변경:
  - `sourceImageUrl` 제거
  - `uploadedByName` 유지 (FK 경로만 변경)
- `PastExamDetail` 타입 변경:
  - `extractedContent` 제거
  - `images?: readonly PastExamImage[]` 추가
  - `details?: readonly PastExamDetailItem[]` 추가

#### 2. `src/lib/actions/generate-questions.ts` (backend-actions)

**현재 쿼리 패턴** (line 102-123):
```
.from('past_exam_questions')
.select(`id, year, semester, exam_type, grade, subject, extracted_content, schools!inner ( name )`)
.eq('id', pastExamId)
.single()
```
→ `extracted_content`를 직접 SELECT하여 `PastExamContext.extractedContent`에 전달

**변경 후 쿼리 패턴** (마스터 PLAN 아키텍처 결정 7):
```
.from('past_exams')
.select(`
  id, year, semester, exam_type, grade, subject,
  schools!inner ( name ),
  past_exam_details ( question_text )
`)
.eq('id', pastExamId)
.single()
```
- `extracted_content` → `past_exam_details.question_text` 목록을 `'\n\n'`으로 결합
- `extractedContent`가 빈 배열이면 null → 기존 동작 유지 (컨텍스트 없이 생성)
- 타입 캐스팅 업데이트: `past_exam_details: { question_text: string }[]` 추가

#### 3. `src/lib/actions/save-questions.ts` (backend-actions)

**현재 쿼리 패턴** (line 177-193):
```
.from('past_exam_questions')
.select('id, subject, grade, year, semester, exam_type, school_id, schools!inner ( name )')
.eq('id', pastExamId)
.single()
```

**변경 후 쿼리 패턴**:
```
.from('past_exams')
.select('id, subject, grade, year, semester, exam_type, school_id, schools!inner ( name )')
.eq('id', pastExamId)
.single()
```
- 테이블명만 변경 (`past_exam_questions` → `past_exams`)
- 컬럼 구조 동일 (past_exams도 동일 컬럼 보유)
- `source_metadata.pastExamId`는 past_exams의 id를 가리키게 됨 (자연 전환)

### Validation 파일 (2개)

#### 4. `src/lib/validations/past-exams.ts` (backend-actions)

- `pastExamUploadSchema` → **deprecated 주석** 추가 (Step 6까지 유지)
- `pastExamFilterSchema` 유지 (필터 로직 변경 없음 — schoolType/grade 범위 필터 등)
- `validateFile` / `getFileExtension` 유지 (Step 4 exam-management.ts에서 재사용 가능)
- `PastExamListItem` 관련 필터가 `past_exams` 테이블 기준으로 동작하도록 주석 업데이트

#### 5. `src/lib/validations/__tests__/past-exams.test.ts` (tester)

- `pastExamUploadSchema` 테스트 → deprecated 주석만 추가, 기존 테스트 유지 (uploadPastExamAction이 Step 6까지 존재하므로)
- 나머지 테스트 (validateFile, getFileExtension, 상수) → 변경 없음

### UI 파일 (8개)

#### 6. `src/app/(dashboard)/past-exams/page.tsx` (frontend-ui)

- `import { PastExamListItem }` → 타입 변경 반영 (sourceImageUrl 제거)
- 나머지 로직 동일 (getPastExamList 호출 + PastExamsTable 렌더링)

#### 7. `src/app/(dashboard)/past-exams/_components/past-exam-columns.tsx` (frontend-ui)

- `ColumnDef<PastExamListItem>` → `sourceImageUrl` 컬럼이 기존에 없으므로 컬럼 정의 변경 없음
- `PastExamListItem` import 타입 변경만 자동 반영
- 기타 변경 없음

#### 8. `src/app/(dashboard)/past-exams/_components/past-exams-table.tsx` (frontend-ui)

- `PastExamListItem` 타입 변경만 자동 반영
- 변경 없음 (import 경로 동일)

#### 9. `src/app/(dashboard)/past-exams/_components/past-exams-toolbar.tsx` (frontend-ui)

- 타입 변경 영향 없음 (필터 로직은 searchParams 기반, PastExamListItem 직접 참조 안 함)
- 변경 없음

#### 10. `src/app/(dashboard)/past-exams/_components/past-exam-detail-sheet.tsx` (frontend-ui)

- `PastExamDetail` 타입 변경 반영:
  - `extractedContent` 제거 → 관련 렌더링 제거
  - `signedImageUrl` → `images` 배열의 첫 번째 이미지 Signed URL로 대체
  - `detail.signedImageUrl` 참조 → `detail.images?.[0]?.signedImageUrl` 등으로 변경
- `getPastExamDetail` 반환 타입에 맞춰 이미지 미리보기 로직 수정
- AI 문제 생성 버튼 로직 → `pastExamId` 참조 변경 없음 (past_exams.id 동일)

#### 11. `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` (frontend-ui)

- `PastExamDetail` 타입 변경 반영
  - `pastExamDetail.extractedContent` 참조 없음 (현재 UI에서 사용하지 않음) → 변경 없음
- `pastExamId` → past_exams의 id (자연 전환)
- 실질 변경 없음

#### 12. `src/app/(dashboard)/past-exams/upload/upload-form.tsx` (frontend-ui)

- `uploadPastExamAction` import 유지 (deprecated이지만 Step 6까지 동작)
- `PastExamActionResult` 타입 유지
- Step 6에서 `createPastExamAction`으로 교체 시 대폭 변경 예정 (다중 이미지 + DnD)
- **이 Step에서는 변경 없음** (deprecated Action 유지)

#### 13. `src/app/(dashboard)/past-exams/upload/page.tsx` (frontend-ui)

- 변경 없음 (upload-form.tsx 변경 없으므로)

### 테스트 파일 (3개 Action 테스트)

#### 14. `src/lib/actions/__tests__/past-exams.test.ts` (tester)

**현재 mock**: `from('past_exam_questions')` 분기
**변경 후 mock**:
- `uploadPastExamAction` 테스트 → 유지 (deprecated Action 테스트 유지)
- mock 테이블 분기에 deprecated 주석 추가

#### 15. `src/lib/actions/__tests__/past-exams-list.test.ts` (tester)

**현재 mock**: `mockPastExamListQuery` → `from('past_exam_questions')` 기반
**변경 후 mock**:
- `from('past_exam_questions')` → `from('past_exams')` 분기 변경
- `mockDbRow` 변경:
  - `source_image_url` 제거
  - `uploaded_by` 관련 → `created_by` 관련으로 FK 힌트 변경
  - `profiles` mock → `profiles!created_by` 경로 반영
- `mockDbDetailRow` 변경:
  - `extracted_content` 제거
  - `past_exam_images` / `past_exam_details` 중첩 배열 추가
- camelCase 변환 검증 테스트 업데이트: `sourceImageUrl` 제거, `images`/`details` 추가
- Signed URL 테스트: 단일 → 배열 첫 번째 이미지 기반으로 변경

#### 16. `src/lib/actions/__tests__/generate-questions.test.ts` (tester)

**현재 mock**: `from('past_exam_questions')` → `mockPastExamQuery` 분기
**변경 후 mock**:
- `from('past_exam_questions')` → `from('past_exams')` 분기 변경
- `MOCK_PAST_EXAM_ROW` 변경:
  - `extracted_content: null | string` 제거
  - `past_exam_details: { question_text: string }[]` 추가
- `extracted_content가 있으면 pastExamContext.extractedContent에 포함` 테스트 → `past_exam_details에 question_text가 있으면` 으로 변경:
  ```typescript
  mockPastExamFound({
    ...MOCK_PAST_EXAM_ROW,
    past_exam_details: [
      { question_text: '1번 문제: 이차방정식 x²+2x+1=0의 해를 구하시오.' },
    ],
  })
  ```
- `extracted_content가 null이면 extractedContent 없음` 테스트 → `past_exam_details가 빈 배열이면` 으로 변경

#### 17. `src/lib/actions/__tests__/save-questions.test.ts` (tester)

**현재 mock**: `from('past_exam_questions')` → `mockPastExamQuery` 분기
**변경 후 mock**:
- `from('past_exam_questions')` → `from('past_exams')` 분기 변경
- `MOCK_PAST_EXAM_ROW` 구조 변경 없음 (save-questions.ts의 SELECT 컬럼은 동일)
- `예상치 못한 테이블` throw 분기에서 `'past_exam_questions'` → `'past_exams'` 반영

### 타입 파일 (1개)

#### 18. `src/types/supabase.ts` (db-schema — Step 1 완료 시 자동 생성)

- Step 1에서 `supabase gen types` 실행으로 자동 업데이트
- `past_exams`, `past_exam_images`, `past_exam_details` 테이블 타입 추가
- 이 Step에서는 직접 수정 없음 (Step 1 산출물)

---

## 구현 순서

### Phase A: Action 리팩토링 (backend-actions)

1. **A1**: `save-questions.ts` — 테이블명만 변경 (가장 단순, 5분)
2. **A2**: `generate-questions.ts` — 쿼리 패턴 변경 + extractedContent 조합 로직
3. **A3**: `past-exams.ts` — 목록/상세 쿼리 전환 + 타입 변경 + deprecated 주석

### Phase B: 테스트 업데이트 (tester)

4. **B1**: `save-questions.test.ts` — mock 테이블명 변경
5. **B2**: `generate-questions.test.ts` — mock 구조 변경 (extracted_content → past_exam_details)
6. **B3**: `past-exams.test.ts` — deprecated 주석만 추가
7. **B4**: `past-exams-list.test.ts` — mock 구조 대폭 변경 (목록+상세 쿼리)

### Phase C: Validation (backend-actions)

8. **C1**: `past-exams.ts` (validations) — deprecated 주석
9. **C2**: `past-exams.test.ts` (validations) — 변경 없음 (확인만)

### Phase D: UI 타입 반영 (frontend-ui)

10. **D1**: `past-exam-detail-sheet.tsx` — PastExamDetail 타입 변경 + 이미지 렌더링 수정
11. **D2**: `past-exam-columns.tsx` — PastExamListItem 타입 자동 반영 (확인만)
12. **D3**: `past-exams-table.tsx` — 확인만
13. **D4**: `past-exams-toolbar.tsx` — 확인만
14. **D5**: `generate-questions-dialog.tsx` — PastExamDetail 타입 반영 (확인만)
15. **D6**: `page.tsx` — PastExamListItem 타입 자동 반영 (확인만)
16. **D7**: `upload/upload-form.tsx` — 변경 없음
17. **D8**: `upload/page.tsx` — 변경 없음

### Phase E: 전체 검증

18. **E1**: `npm run test:run` — 전체 테스트 통과 확인
19. **E2**: `npm run build` — 빌드 성공 확인
20. **E3**: `past_exam_questions` grep → deprecated 주석 외 직접 참조 0개 확인

---

## 완료 기준

- [ ] 기존 테스트 전부 통과 (`npm run test:run`)
- [ ] 빌드 성공 (`npm run build`)
- [ ] `past_exam_questions` 직접 참조 0개 (deprecated 주석 + uploadPastExamAction만 잔존)
- [ ] `getPastExamList` / `getPastExamDetail` / `generateQuestionsFromPastExam` / `saveGeneratedQuestions`가 `past_exams` 테이블 기반으로 동작
- [ ] `PastExamListItem` / `PastExamDetail` 타입이 3계층 구조 반영
- [ ] UI 컴포넌트가 새 타입으로 정상 렌더링 (TypeScript 에러 없음)

---

## 리스크

| 리스크 | 영향 | 확률 | 완화 방안 |
|--------|------|------|----------|
| 17개 파일 동시 변경으로 인한 타입 에러 연쇄 | Medium | High | Phase A→B→C→D 순서 준수. Action 먼저 변경 후 테스트 통과 확인, 그 다음 UI |
| `past_exam_questions` 참조 누락 | Medium | Medium | Phase E3에서 grep으로 전수 검사 |
| `profiles!created_by` FK 힌트 오류 | Low | Medium | Step 1 마이그레이션에서 FK 컬럼명 확인 후 진행 |
| `PastExamDetail` 타입 변경으로 Detail Sheet 렌더링 깨짐 | Medium | Medium | Signed URL 로직을 이미지 배열 기반으로 변경 시 null 체크 철저히 |
| mock 테스트가 실제 쿼리와 불일치 (mock 한계) | Low | 항상 | E2E 테스트로 실제 DB 연동 검증 (Step 8) |
