# 기술 리뷰: 기출문제 이미지 → 개별 문제 자동 추출

> 리뷰 대상: `docs/plan/20260308-past-exam-extraction.md`
> 리뷰어: technical-reviewer
> 날짜: 2026-03-15

## 요약

PLAN은 전체적으로 기존 코드베이스와 높은 일관성을 유지하며 기술적으로 실현 가능하다. 그러나 **sharp 의존성 누락, 기존 past_exam_questions FK 참조 체인 처리, 동시 추출 방어, base64 메모리 제한** 등 구현 전 반드시 해결해야 할 이슈가 있다.

---

## 이슈 목록

### [MUST FIX] 1. sharp 의존성이 package.json에 없음

- **문제**: PLAN Step 5에서 `sharp`로 이미지 crop을 수행하지만, `package.json`에 `sharp` 의존성이 없다. sharp는 네이티브 모듈(libvips)이므로 설치/배포 시 바이너리 호환성 검증이 필요하다.
- **근거**: `package.json:1-48` — dependencies/devDependencies 어디에도 `sharp` 없음
- **제안**:
  1. `sharp`를 dependencies에 추가하고, 배포 환경(Vercel 등)에서 네이티브 바이너리 동작 확인
  2. 대안: Vercel Edge에서는 sharp 사용 불가 → Node.js Runtime 명시 필요 (`export const runtime = 'nodejs'`)
  3. 또 다른 대안: sharp 대신 Canvas API 또는 서버리스 이미지 처리 서비스 검토
  <!-- NOTE: Sharp로 진행 --> 

### [MUST FIX] 2. 기존 past_exam_questions FK 참조 체인 미처리

- **문제**: PLAN은 `past_exam_questions`를 "deprecated 주석"으로 남기고 데이터를 새 테이블로 이관한다고 하지만, 기존 테이블에 `questions.question_id → past_exam_questions` FK가 없다. 대신 `past_exam_questions.question_id → questions(id)` FK가 존재한다 (`00001_initial_schema.sql:209`). 이 FK와 `save-questions.ts`의 `source_metadata.pastExamId`가 구 테이블 ID를 참조하고 있어, 마이그레이션 후 정합성이 깨진다.
- **근거**:
  - `00001_initial_schema.sql:209` — `question_id UUID REFERENCES questions(id)`
  - `src/lib/actions/save-questions.ts:138` — `source_metadata: { pastExamId: meta.pastExamId }`
  - `src/lib/actions/generate-questions.ts:103` — `.from('past_exam_questions').select(...).eq('id', pastExamId)`
- **제안**:
  1. 마이그레이션 SQL에 `past_exam_questions.id` → `past_exams.id` 매핑 테이블 생성 또는 동일 UUID 유지 (현재 PLAN의 INSERT INTO past_exams에서 id를 그대로 복사하므로 OK, 명시적으로 문서화 필요)
  2. `questions.source_metadata.pastExamId`가 이미 저장된 기존 데이터에 대한 마이그레이션 전략 추가 (ID가 동일하게 유지되면 문제 없지만, 이를 명확히 보장하는 코드가 PLAN에 필요)
  3. `past_exam_questions.question_id` FK를 deprecated 처리하는 동시에 새 테이블에서의 대체 관계를 명시
<!-- NOTE: 진행-->

### [MUST FIX] 3. 동시 추출 Race Condition 방어 누락

- **문제**: PLAN Step 5의 `extractQuestionsAction`에서 `extraction_status`를 `'pending'/'failed'`만 허용한다고 했으나, 두 명의 사용자가 동시에 같은 시험에 대해 추출을 트리거하면 중복 INSERT가 발생할 수 있다.
- **근거**: PLAN Step 7 — `useEffect: extraction_status === 'pending' 시 자동 추출 트리거`. 여러 탭/사용자가 같은 편집 페이지를 열면 동시 호출 가능.
- **제안**:
  1. `extractQuestionsAction` 시작 시 `UPDATE past_exams SET extraction_status = 'processing' WHERE id = ? AND extraction_status IN ('pending', 'failed')` → 영향 행 0이면 조기 반환 (Optimistic Lock 패턴)
  2. 또는 DB 레벨에서 `extraction_status`에 대한 Advisory Lock 사용
<!-- NOTE: 진행-->

### [SHOULD FIX] 4. base64 메모리 폭발 방어 구체화 부족

- **문제**: PLAN은 "이미지 5MB + 총 20장 제한"이라고 언급하지만, 20장 × 5MB × 1.37(base64 오버헤드) ≈ 137MB를 서버 메모리에 동시 보유하게 된다. Vercel Serverless Function의 메모리 기본 한도(1GB)에서 다수의 동시 요청이 겹치면 OOM 위험이 있다.
- **근거**: PLAN 아키텍처 결정 3, 리스크 테이블 "다중 이미지 base64 크기"
- **제안**:
  1. 최대 이미지 수를 줄이거나 (예: 10장), Step 5에서 배치 분할 로직을 1차 구현에 포함
  2. base64 변환을 스트리밍으로 처리하거나, 이미지별로 fetch → base64 → API 호출을 직렬화하여 피크 메모리 억제
  3. PLAN에 구체적인 메모리 제한 방어 코드 위치 명시 (현재는 리스크 테이블에만 언급)
<!-- NOTE: 2,3 진행 -->

### [SHOULD FIX] 5. Gemini API 타임아웃 처리 미비

- **문제**: 기존 `withRetry`(`src/lib/ai/retry.ts`)는 재시도 로직만 있고, HTTP 요청 자체의 타임아웃 설정이 없다. 20장 이미지를 한 번에 보내면 Gemini API 응답이 30초 이상 걸릴 수 있으며, Vercel Serverless Function의 기본 타임아웃(10초 Hobby / 60초 Pro)에 걸린다.
- **근거**: `src/lib/ai/retry.ts:63-105` — 타임아웃 옵션 없음. `src/lib/ai/gemini.ts:99` — generateContent에 timeout 미설정.
- **제안**:
  1. `@google/genai` SDK의 `requestOptions.timeout` 활용
  2. Next.js Route/Action에 `maxDuration` 설정 추가 (PLAN Step 5 파일에 명시)
  3. 타임아웃 시 `extraction_status = 'failed'`로 확실히 롤백되도록 try/finally 구조 보강
<!-- NOTE: 타이아웃 시간을 늘릴것. 또한 제안 반영 -->

### [SHOULD FIX] 6. AIProvider 인터페이스 Breaking Change

- **문제**: PLAN은 `processOCR → extractQuestions` 리네이밍을 제안하지만, `AIProvider` 인터페이스(`src/lib/ai/types.ts:102-116`)에서 `processOCR`을 제거하면 `GeminiProvider`의 stub 구현도 함께 변경해야 한다. `processOCR`과 `extractQuestions`는 의미가 다르므로(OCR = 텍스트 추출 vs 문제 추출), 기존 `processOCR`을 유지하면서 `extractQuestions`를 추가하는 것이 더 안전하다.
- **근거**:
  - `src/lib/ai/types.ts:112` — `processOCR(params: OCRParams): Promise<OCRResult>` (Phase 3 예정)
  - `src/lib/ai/gemini.ts:142-144` — stub 구현
  - PLAN Step 3 — "processOCR → extractQuestions 리네이밍"
- **제안**:
  1. `processOCR`을 유지하고, `extractQuestions`를 새 메서드로 추가 (OCP 준수)
  2. 또는 의도적 Breaking Change라면 PLAN에 영향 범위(테스트 포함)를 명시
<!-- NOTE: 진행 -->

### [SHOULD FIX] 7. PromptConfig에 imageParts 추가 시 기존 generateQuestions 호환성

- **문제**: PLAN은 `PromptConfig`에 `imageParts?: readonly ImagePart[]`를 추가하지만, 기존 `GeminiProvider.generateQuestions`(`src/lib/ai/gemini.ts:89-136`)는 `contents: prompt.userPrompt` (문자열)을 직접 전달한다. `imageParts`가 있을 때 `contents`를 Part 배열로 바꾸는 분기 로직이 필요하며, 이에 대한 구체적인 구현 방법이 PLAN에 빠져 있다.
- **근거**: `src/lib/ai/gemini.ts:101` — `contents: prompt.userPrompt` (string 타입)
- **제안**:
  1. Step 4에서 `GeminiProvider` 수정 시 `contents` 구성 로직을 명시: `imageParts`가 있으면 `[...imageParts.map(toPart), { text: userPrompt }]` 형태로 변환
  2. 기존 `generateQuestions`가 영향받지 않도록 `imageParts` 미제공 시 기존 동작 유지 확인 테스트 추가
<!-- NOTE: 진행 -->

### [SHOULD FIX] 8. RLS 정책 패턴 불일치 — student 접근 차단

- **문제**: 기존 `past_exam_questions` RLS 정책(`00002_rls_policies.sql:235-237`)은 같은 academy의 **모든 사용자**(student 포함)에게 SELECT를 허용한다. 반면 PLAN은 "student ❌"로 차단한다고 한다. 이는 기존 패턴과의 **의도적 불일치**이지만, 기존 코드(`src/lib/actions/past-exams.ts:282` 주석: "student 포함")와 충돌한다.
- **근거**:
  - `00002_rls_policies.sql:235-237` — `USING (academy_id = get_user_academy_id())` (역할 제한 없음)
  - `src/lib/actions/past-exams.ts:281` — "권한: 인증된 사용자 전체 (student 포함)"
  - PLAN 접근 제어 테이블 — "student ❌"
- **제안**:
  1. 기존 past_exam_questions의 student 접근을 유지할지 차단할지 명확히 결정
  2. 차단한다면 기존 `getPastExamList` Action의 주석과 동작도 3계층 전환 시 업데이트 필요
  3. 기존 데이터(past_exam_questions)의 RLS와 새 테이블(past_exams)의 RLS가 과도기에 공존하는 시나리오도 고려
<!-- NOTE: 진행 -->

### [CONSIDER] 9. past_exam_details에 source_page_numbers 컬럼 미포함

- **문제**: PLAN은 "1 문제가 2 이미지에 걸칠 수 있음 (AI가 자동 인식)"이라고 명시했지만, `past_exam_details` 스키마에는 해당 문제가 어떤 페이지에서 추출되었는지 추적하는 컬럼이 없다. 추후 이미지 ↔ 문제 연결 UI 구현 시 필요해질 수 있다.
- **근거**: PLAN 데이터 관계 설명 "1 문제가 2 이미지에 걸칠 수 있음" vs `past_exam_details` 스키마 (page 정보 없음)
- **제안**: `source_page_numbers INTEGER[]` 또는 `source_pages JSONB` 컬럼 추가 검토. 또는 `figures[].pageNumber`로 간접 추적 가능하므로 지금은 생략 가능하나, 그래프가 없는 문제의 출처 페이지는 추적 불가.
<!-- NOTE: 추적시에는 앞 페이지만 존재해도 가능하므로 생략 -->  

### [CONSIDER] 10. dnd-kit 의존성 3개 패키지 추가

- **문제**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` 3개 패키지를 추가한다. 현재 프로젝트에 DnD 패턴이 없어 새로운 패턴 도입이다.
- **근거**: `package.json` — 현재 DnD 관련 의존성 없음
- **제안**:
  1. dnd-kit은 headless + shadcn/ui 호환으로 적절한 선택
  2. 단, 업로드 시 이미지 순서 변경이 핵심이 아니라면 MVP에서 DnD를 빼고 숫자 입력으로 순서 지정 → 복잡도 절감 가능
  3. DnD를 유지한다면 접근성(키보드 DnD) 테스트 포함 필요
<!-- NOTE: 진행 -->

### [CONSIDER] 11. 마이그레이션 번호 충돌 가능성

- **문제**: PLAN은 `00006_past_exam_restructure.sql`로 지정했는데, 기존에 `00003_schools_rls_update.sql`과 `00003_indexes.sql`처럼 같은 번호의 마이그레이션이 이미 2개 존재한다. 다른 작업이 먼저 `00006`을 사용하면 충돌한다.
- **근거**: `supabase/migrations/` 디렉토리 — `00003_indexes.sql`, `00003_schools_rls_update.sql` 중복 존재
- **제안**: 타임스탬프 기반 마이그레이션 네이밍 전환 검토 (Supabase 기본: `YYYYMMDDHHMMSS_name.sql`)
<!-- NOTE: 진행 -->

### [CONSIDER] 12. 전체 재추출 시 기존 데이터 처리

- **문제**: Step 7에서 "[전체 재추출]" 기능이 "기존 데이터 삭제 + 처음부터 재추출"이라고 했는데, 사용자가 편집한 내용(수동 수정, 문제 추가)이 모두 사라진다. 확인 Dialog는 있을 수 있지만 PLAN에 명시되지 않았다.
- **근거**: PLAN Step 7 — "[전체 재추출] — 기존 데이터 삭제 + 처음부터 재추출"
- **제안**: 전체 재추출 전 확인 Dialog + 기존 수동 편집분 보존 옵션(또는 최소한 경고) 추가
<!-- NOTE: 진행 -->
---

## 기존 코드 호환성 분석

| 항목 | 호환성 | 비고 |
|------|--------|------|
| **Supabase 스키마** | ✅ 호환 | 새 테이블 추가. 기존 `past_exam_questions` 유지(deprecated) |
| **Action 패턴** | ✅ 높은 일관성 | `getCurrentUserProfile`, `{ error }` 반환, Zod 검증 등 기존 패턴과 동일 |
| **AI 타입** | ⚠️ Breaking Change | `processOCR` → `extractQuestions` 리네이밍이 인터페이스 변경 |
| **PromptConfig** | ✅ 하위 호환 | `imageParts?` 옵셔널 추가 — 기존 호출 영향 없음 |
| **supabase.ts 타입** | ✅ 호환 | 새 테이블 타입 추가만. 기존 타입 변경 없음 (`supabase gen types` 재실행 필요) |
| **Storage 경로** | ✅ 호환 | 기존 `{academy_id}/{school_id}/...` 패턴 유지, figures 하위 경로 추가 |
| **RLS 패턴** | ⚠️ 의도적 변경 | student 접근 차단 (기존: 허용) |
| **테스트** | ⚠️ 대규모 수정 | 36개 파일 중 past_exam 관련 4개 테스트 파일 수정 필요 |

### 참조 파일 영향도 (48개 → 핵심 12개)

| 파일 | 변경 난이도 | 이유 |
|------|-----------|------|
| `src/lib/actions/past-exams.ts` | High | 모든 쿼리 3계층 전환 |
| `src/lib/actions/generate-questions.ts` | Medium | `.from('past_exam_questions')` → `.from('past_exams')` |
| `src/lib/actions/save-questions.ts` | Medium | `source_metadata.pastExamId` 유효성 |
| `src/lib/ai/types.ts` | Medium | 인터페이스 변경 |
| `src/lib/ai/gemini.ts` | Medium | extractQuestions 메서드 추가 |
| `src/types/supabase.ts` | Low | `supabase gen types` 자동 생성 |
| `src/app/.../past-exams/**` (8개) | Medium-High | UI 컴포넌트 전면 수정 |

---

## 엣지 케이스 분석

| 엣지 케이스 | PLAN 대응 | 보완 필요 |
|------------|----------|----------|
| **동시 추출 요청** | 미언급 | ✅ [MUST FIX] Optimistic Lock 필요 |
| **base64 메모리 폭발** | "5MB + 20장 제한" | ✅ [SHOULD FIX] 구체적 방어 코드 위치 |
| **Gemini API 타임아웃** | "로딩 UI" | ✅ [SHOULD FIX] maxDuration + SDK timeout |
| **부분 실패 (crop 일부만 실패)** | 미언급 | ⚠️ figures crop 중 1개 실패 시 전체 실패? 부분 성공? |
| **빈 이미지 (백지)** | 미언급 | AI가 빈 배열 반환 → 정상 처리되나 UX 안내 필요 |
| **이미지 회전/기울어짐** | 미언급 | Gemini Vision이 어느 정도 처리하지만 심한 경우 crop 좌표 오차 |
| **LaTeX 수식 깨짐** | 프롬프트에 지시 | 렌더링 라이브러리(KaTeX/MathJax) 추가 필요 — PLAN 미언급 |
| **전체 재추출 시 편집분 유실** | "기존 삭제 + 재추출" | ⚠️ [CONSIDER] 확인 Dialog 필요 |
| **마이그레이션 롤백** | 미언급 | 3계층 전환 실패 시 rollback SQL 필요 |

---

## Plan Review Completion Checklist

- [x] 모든 Task의 파일 소유권이 명확하다
- [x] Task 간 의존성 순서가 정의되었다
- [ ] 외부 의존성(라이브러리, API)이 명시되었다 — **sharp 누락**
- [ ] 에러 처리 방식이 정해졌다 — **동시 추출, 타임아웃, 부분 실패 미처리**
- [x] 테스트 전략이 있다
- [ ] 이전 Phase 회고(`docs/retrospective/`)의 교훈이 반영되었다 — **회고 문서 미확인**
- [x] 병렬 구현 시 파일 충돌 가능성이 없다

### 판정: **BLOCKED**

MUST FIX 3건(sharp 의존성, FK 참조 체인, 동시 추출 방어)을 해결한 후 구현 단계로 이동 가능.
