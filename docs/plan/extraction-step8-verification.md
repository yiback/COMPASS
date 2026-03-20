# Step 8: 빌드 검증 + 학습 리뷰 상세 구현 계획 ✅

> **상태**: ✅ 구현 완료 (2026-03-20, 1238 tests PASS, 빌드 성공, 빌드 에러 3건 수정)
> **의존성**: Step 1-7 전부 완료 후 실행
> **참조**: 마스터 PLAN `docs/plan/20260308-past-exam-extraction.md` Step 8

---

## 1. 전체 테스트 (npm run test:run)

### 신규 테스트 파일 목록

| # | 파일 | Step | 테스트 항목 |
|---|------|------|------------|
| 1 | `src/lib/ai/__tests__/extraction-validation.test.ts` | 3 | Zod 스키마 검증 (유효/무효, enum, confidence, figures, url=null) |
| 2 | `src/lib/ai/__tests__/prompts/question-extraction.test.ts` | 3 | 다중 이미지 프롬프트, 재분석 프롬프트 |
| 3 | `src/lib/ai/__tests__/gemini.test.ts` (수정) | 3 | multi-image mock, imageParts 분기, 기존 generateQuestions 무영향 |
| 4 | `src/lib/actions/__tests__/exam-management.test.ts` | 4 | 시험 생성, 다중 파일 업로드, 편집/삭제/확정, 권한, 이미지 제한 |
| 5 | `src/lib/validations/__tests__/exam-management.test.ts` | 4 | Zod 스키마 유효/무효 |
| 6 | `src/lib/actions/__tests__/extract-questions.test.ts` | 5 | 추출, 상태 전이, Optimistic Lock, try/finally 롤백, crop, resetExtraction |
| 7 | `src/lib/actions/__tests__/reanalyze-question.test.ts` | 5 | 단일 문제 재분석, AI 오류 처리, 전체 이미지 전달 확인 |
| 8 | `src/lib/validations/__tests__/extract-questions.test.ts` | 5 | 추출 Zod 스키마 유효/무효 |

### 기존 테스트 파일 수정 목록

| # | 파일 | Step | 변경 내용 |
|---|------|------|----------|
| 1 | `src/lib/actions/__tests__/past-exams.test.ts` | 2 | 3계층 쿼리 mock 업데이트 |
| 2 | `src/lib/actions/__tests__/generate-questions.test.ts` | 2 | past_exams JOIN + past_exam_details JOIN 반영 |
| 3 | `src/lib/actions/__tests__/save-questions.test.ts` | 2 | source_metadata 변경 반영 |
| 4 | `src/lib/validations/__tests__/past-exams.test.ts` | 2 | 업로드 스키마 변경 반영 |

### 검증 명령

```bash
# 전체 테스트 실행
npm run test:run

# 신규 파일만 개별 확인
npx vitest run src/lib/ai/__tests__/extraction-validation.test.ts
npx vitest run src/lib/ai/__tests__/prompts/question-extraction.test.ts
npx vitest run src/lib/ai/__tests__/gemini.test.ts
npx vitest run src/lib/actions/__tests__/exam-management.test.ts
npx vitest run src/lib/actions/__tests__/extract-questions.test.ts
npx vitest run src/lib/actions/__tests__/reanalyze-question.test.ts
npx vitest run src/lib/validations/__tests__/exam-management.test.ts
npx vitest run src/lib/validations/__tests__/extract-questions.test.ts

# 기존 테스트 회귀 확인
npx vitest run src/lib/actions/__tests__/past-exams.test.ts
npx vitest run src/lib/actions/__tests__/generate-questions.test.ts
npx vitest run src/lib/actions/__tests__/save-questions.test.ts
npx vitest run src/lib/validations/__tests__/past-exams.test.ts
```

**목표**: 전체 테스트 PASS + 커버리지 80% 이상

---

## 2. 빌드 검증 (npm run build)

```bash
npm run build
```

**확인 사항**:
- [ ] TypeScript 컴파일 에러 없음
- [ ] `export const runtime = 'nodejs'` (extract-questions.ts) — sharp 호환
- [ ] `export const maxDuration = 60` (extract-questions.ts) — Vercel Pro 기준
- [ ] dynamic route `[id]/edit/page.tsx` 정상 빌드
- [ ] 빌드 경고: unused imports, unused variables 없음

---

## 3. 린트

```bash
npx next lint
```

**확인 사항**:
- [ ] eslint 에러 없음
- [ ] `<img>` 태그 사용 시 `eslint-disable-next-line @next/next/no-img-element` 주석 존재 (Signed URL → `next/image` 부적합)
- [ ] `console.log` 잔류 없음

---

## 4. 수동 테스트 시나리오 (8개)

### 시나리오 A: Happy Path (생성 → 추출 → 확정)

```
1. /past-exams/upload 접속
2. 메타데이터 입력 (학교, 학년 3, 과목 수학, 2025, 1학기, 기말고사)
3. 시험지 이미지 3장 업로드 (docs/sampleImage/ 사용)
4. 이미지 순서 확인 (DnD 미리보기)
5. [업로드] 클릭 → /past-exams/{id}/edit 리다이렉트
6. 자동 추출 시작 확인 (스피너 + 메시지)
7. 추출 완료 → 문제 카드 목록 표시
8. confidence 색상 확인 (🟢/🟡/🔴)
9. [확정 저장] 클릭
10. /past-exams 목록에서 확인
```

**예상 소요**: 2-3분 (AI 추출 대기 포함)

### 시나리오 B: 편집 + AI 재분석

```
1. 시나리오 A 완료 후 /past-exams/{id}/edit 접속
2. 문제 1 [편집] 클릭 → 편집 모드 진입
3. 문제 내용 수정 → [저장] 클릭
4. 문제 2 [AI 재분석] 클릭
5. 로딩 표시 확인 (스피너 + "AI가 문제를 다시 분석하고 있습니다...")
6. 재분석 완료 → 문제 2 카드 갱신 확인
7. confidence 변경 확인
```

### 시나리오 C: 삭제 + 수동 추가

```
1. /past-exams/{id}/edit 접속 (추출 완료 상태)
2. 문제 3 [삭제] 클릭 → 카드 제거 확인
3. [+ 문제 수동 추가] 클릭 → 빈 카드 추가 (편집 모드)
4. 문제 내용 입력 → [저장] 클릭
5. temp-ID → 실제 ID 교체 확인
6. [확정 저장] 클릭
```

### 시나리오 D: 전체 재추출

```
1. /past-exams/{id}/edit 접속 (추출 완료 + 편집 완료 상태)
2. [전체 재추출] 클릭
3. 확인 Dialog 표시: "기존 추출 결과와 수동 편집 내용이 모두 삭제됩니다."
4. [재추출] 클릭
5. 기존 문제 목록 초기화 확인
6. 자동 추출 재시작 확인 (스피너)
7. 새 추출 결과 표시
```

### 시나리오 E: 추출 실패 + 재시도

```
1. (네트워크 차단 또는 AI API 오류 상황 시뮬레이션)
2. 추출 실패 → extraction_status = 'failed'
3. 에러 메시지 표시 확인
4. [재시도] 버튼 클릭
5. extraction_status → 'pending' → 자동 추출 재시작
```

### 시나리오 F: 이미지 검증

```
1. /past-exams/upload 접속
2. 이미지 21장 선택 → 에러 메시지 확인 (최대 20장)
3. 개별 6MB 이미지 선택 → 에러 메시지 확인 (최대 5MB)
4. 총 용량 100MB 초과 → 에러 메시지 확인
5. DnD로 이미지 순서 변경 → 미리보기 순서 반영 확인
```

### 시나리오 G: 권한 검증

```
1. student 계정으로 /past-exams/{id}/edit 접속 시도
2. 404 또는 접근 거부 확인
3. teacher 계정 → 본인 생성분만 편집 가능 확인
4. admin 계정 → 같은 academy 모든 시험 편집 가능 확인
```

### 시나리오 H: 그래프/그림

```
1. 그래프가 포함된 시험지 이미지 업로드
2. 추출 완료 후 hasFigure=true 문제 확인
3. crop 이미지 미리보기 표시 확인
4. figure.url=null (crop 실패) 시 "추출 실패" 표시 확인
5. figure.description AI 설명 표시 확인
```

---

## 5. 기존 기능 회귀 확인 표

| # | 기존 기능 | 확인 경로 | 확인 항목 |
|---|----------|----------|----------|
| 1 | 기출문제 목록 조회 | `/past-exams` | 3계층 전환 후 목록 정상 표시, 필터링 동작 |
| 2 | 기출문제 상세 Sheet | 목록에서 행 클릭 | 상세 정보 + 이미지 미리보기 (Signed URL) |
| 3 | AI 문제 생성 Dialog | 상세 Sheet → [AI 문제 생성] | 폼 입력 → AI 생성 → 결과 표시 → 저장 |
| 4 | 학년 필터링 (학교유형별) | `/past-exams` 필터 | 초등(1-6)/중등(7-9)/고등(10-12) 정상 동작 |
| 5 | 기출문제 업로드 (기존) | `/past-exams/upload` | 기존 단일 업로드 → 다중 업로드로 전환 확인 |
| 6 | 사용자 관리 | `/users` | 영향 없음 확인 |
| 7 | 학원 관리 | `/academies` | 영향 없음 확인 |
| 8 | 문제은행 | `/questions` | source_metadata 참조 변경 영향 확인 |
| 9 | 대시보드 | `/dashboard` | 영향 없음 확인 |

---

## 6. 파일 크기 검증

```bash
# 신규 파일 줄 수 확인 (800줄 이하)
wc -l src/lib/actions/exam-management.ts
wc -l src/lib/actions/extract-questions.ts
wc -l src/lib/ai/extraction-validation.ts
wc -l src/lib/ai/prompts/question-extraction.ts
wc -l src/app/\(dashboard\)/past-exams/\[id\]/edit/page.tsx
wc -l src/app/\(dashboard\)/past-exams/\[id\]/edit/extraction-editor.tsx
wc -l src/app/\(dashboard\)/past-exams/upload/image-sorter.tsx
```

| 파일 | 예상 줄 수 | 최대 허용 |
|------|----------|----------|
| `exam-management.ts` | ~300 | 800 |
| `extract-questions.ts` | ~400 | 800 |
| `extraction-validation.ts` | ~100 | 800 |
| `question-extraction.ts` | ~150 | 800 |
| `[id]/edit/page.tsx` | ~80 | 800 |
| `[id]/edit/extraction-editor.tsx` | ~500-600 | 800 |
| `upload/image-sorter.tsx` | ~200 | 800 |

---

## 학습 리뷰 토픽 10개

| # | 토픽 | 난이도 | 직접 구현 권장 | 이유 |
|---|------|--------|--------------|------|
| 1 | Optimistic Lock 패턴 (`.update().in().select('id')` + 빈 배열 체크) | 🔴 높음 | 삭제 후 재구현 필수 | 동시성 제어 핵심 패턴, 보안/데이터 정합성 직결 |
| 2 | `isCompleted` 플래그 + `try/finally` 롤백 보장 | 🔴 높음 | 삭제 후 재구현 필수 | 에러 발생 시 상태 일관성 보장, 새 패턴 |
| 3 | extraction_status 상태 전이 규칙 | 🟡 중간 | 재구현 권장 | 유한 상태 기계(FSM) 개념, 비즈니스 로직 핵심 |
| 4 | `useEffect` + `cancelled` 플래그 (자동 추출 트리거) | 🟡 중간 | 재구현 권장 | race condition 방지 — 이전 학습 복습 + 새 적용 |
| 5 | 이미지별 직렬 base64 변환 (메모리 방어) | 🟡 중간 | 재구현 권장 | `for...of` 직렬 처리 vs `Promise.all` 병렬 처리 차이 이해 |
| 6 | sharp crop (bounding box normalized → pixel 변환) | 🟡 중간 | 재구현 권장 | 이미지 처리 + 좌표계 변환, 새 라이브러리 |
| 7 | temp-ID 패턴 (수동 추가 → DB 저장 → ID 교체) | 🟢 낮음 | AI 자동 구현 OK | 반복 패턴, 개념 단순 |
| 8 | dnd-kit SortableContext (DnD 순서 변경) | 🟡 중간 | 재구현 권장 | 새 라이브러리, 드래그 이벤트 핸들링 |
| 9 | Non-blocking Storage 삭제 (orphan cleanup 전략) | 🟢 낮음 | AI 자동 구현 OK | 개념은 단순, Phase 2에서 cleanup job 구현 예정 |
| 10 | `editingId` 단일 값 패턴 (한 번에 하나만 편집) | 🟢 낮음 | AI 자동 구현 OK | 기존 패턴 반복 적용 |

---

## 이해도 질문 5개

### Q1: Optimistic Lock (난이도: 높음)

`extractQuestionsAction`에서 Optimistic Lock을 구현할 때, `.update().in('extraction_status', ['pending', 'failed']).select('id')`를 사용한다. 만약 두 명의 사용자가 동시에 같은 시험의 추출 버튼을 클릭하면 어떤 일이 발생하는지, 그리고 왜 일반적인 `.update().eq('extraction_status', 'pending')` 대신 `.in()`을 사용하는지 설명하시오.

### Q2: try/finally + isCompleted (난이도: 높음)

`try/finally` 블록에서 `isCompleted` 플래그를 사용하는 이유는 무엇인가? `catch` 블록에서 `extraction_status = 'failed'`를 설정하는 것과 비교하여, `finally` 블록에서 `if (!isCompleted)` 체크하는 방식의 장점을 설명하시오.

### Q3: 직렬 base64 변환 (난이도: 중간)

이미지를 base64로 변환할 때 `Promise.all(images.map(toBase64))` 대신 `for...of` 루프로 직렬 변환하는 이유는 무엇인가? 20장의 5MB 이미지를 처리할 때 두 방식의 피크 메모리 차이를 추정하시오.

### Q4: cancelled 플래그 (난이도: 중간)

편집 페이지의 자동 추출 `useEffect`에서 `cancelled` 플래그가 없으면 어떤 문제가 발생하는가? React StrictMode와의 관계를 포함하여 설명하시오.

### Q5: extraction_status 상태 전이 (난이도: 중간)

`completed → processing` 직접 전이가 불가능하고 반드시 `completed → pending → processing` 순서를 거쳐야 하는 이유는 무엇인가? 이 제약이 없으면 어떤 데이터 정합성 문제가 발생할 수 있는지 구체적 시나리오를 들어 설명하시오.

---

## 완료 기준

- [ ] `npm run test:run` — 전체 PASS (기존 548+ 테스트 + 신규 테스트)
- [ ] `npm run build` — 에러 없이 빌드 성공
- [ ] `npx next lint` — 에러 없음
- [ ] 수동 테스트 8개 시나리오 통과
- [ ] 기존 기능 회귀 없음 (9개 항목 확인)
- [ ] 신규 파일 전부 800줄 이하
- [ ] 학습 리뷰 토픽 10개 설명 완료
- [ ] 이해도 질문 5개 사용자 답변 완료
- [ ] 🔴 높음 토픽 (Optimistic Lock, try/finally 롤백) — 삭제 후 재구현 완료
- [ ] 🟡 중간 토픽 (상태 전이, cancelled, 직렬 변환, sharp crop, dnd-kit) — 재구현 권장, 사용자 판단

---

## 리스크

| 리스크 | 영향 | 완화 방안 |
|--------|------|----------|
| 기존 테스트 회귀 (17개 파일 변경) | High | Step 2 완료 시점에서 이미 검증, Step 8에서 재확인 |
| 빌드 실패 (타입 불일치) | Medium | Step별 TypeScript 검증 이미 수행, 최종 통합 확인 |
| 수동 테스트 AI 응답 불안정 | Medium | 복수 시도 + docs/sampleImage/ 이미지 고정 사용 |
| sharp native module 빌드 | Low | `runtime = 'nodejs'` 명시로 Edge Runtime 회피 |
| Vercel maxDuration 제한 | Medium | 로컬 테스트 기준, 배포 전 플랜 확인 필요 |
