# 범위 리뷰: 기출문제 이미지 → 개별 문제 자동 추출

> 리뷰 대상: `docs/plan/20260308-past-exam-extraction.md` (v5)
> 리뷰어: scope-reviewer
> 날짜: 2026-03-15

## 요약

PLAN은 핵심 워크플로우(3계층 스키마 + AI 추출 + 리뷰 UI)가 명확하나, **그래프 crop(R9)**, **DnD 순서 변경(R8)**, **AI 재분석(R5)**, **sharp 의존성** 등이 MVP 범위를 과도하게 넓히고 있으며, Step 2의 "36개 파일 리팩토링" 주장이 실제와 불일치(실제 7개)하여 작업량 추정이 왜곡되어 있다.

---

## 이슈 목록

### [MUST FIX] Step 2 "36개 파일" 리팩토링 주장이 사실과 불일치

- **문제**: PLAN에서 "src/ 내 36개 파일이 past_exam_questions를 참조"라고 기술하지만, 실제 `grep`으로 확인한 결과 `src/` 내 참조 파일은 **7개**(actions 3개, tests 3개, types 1개)에 불과하다. UI 컴포넌트(`past-exams/_components/*.tsx`)는 `past_exam_questions` 테이블명을 직접 참조하지 않고 Action의 반환 타입에만 의존한다.
- **근거**: `grep -r "past_exam_questions" src/` 결과 7개 파일. docs, migrations, worktrees를 포함해도 소스 코드 36개에는 도달하지 않음.
- **제안**: Step 2의 영향 범위를 **실제 7개 파일 + UI 컴포넌트 타입 변경 ~5개 = 약 12개**로 정정. 이렇게 하면 Step 2의 리스크가 High → Medium으로 하향 조정 가능. 작업량 추정 왜곡은 일정 계획에 직접 영향을 미치므로 반드시 수정 필요.
<!-- NOTE: 다시 한번 확인해보고 수정할것 -->

### [MUST FIX] R9 그래프 crop 저장은 MVP 필수가 아님

- **문제**: `sharp`를 사용한 서버사이드 이미지 crop은 새로운 native dependency 추가, bounding box 좌표 변환 로직, Storage 별도 경로 관리 등 복잡도가 크게 증가한다. 현재 `package.json`에 `sharp`가 없으므로 완전히 새로운 의존성이다.
- **근거**:
  - MVP 핵심 가치는 "이미지에서 문제 텍스트를 추출하여 구조화"이지, "그래프를 잘라서 별도 저장"이 아님
  - AI가 반환하는 bounding box 좌표의 정확도는 보장되지 않음 (PLAN 리스크 테이블에서도 "Medium" 확률로 인정)
  - sharp는 native module로 배포 환경(Vercel)에서 추가 설정이 필요할 수 있음
  - `has_figure: true` + `figures JSONB`에 bounding box 좌표와 설명만 저장하고, **실제 crop은 Phase 2로 연기** 가능
- **제안**: Step 5에서 그래프 crop 로직 제거. `FigureInfo`에서 `url` 필드를 optional로 변경, bounding box 좌표와 description만 저장. crop은 Phase 2에서 사용자가 실제로 필요로 할 때 구현.
<!-- NOTE: MVP에 포함해서 진행 -->

### [SHOULD FIX] R8 DnD 순서 변경은 MVP 과잉 — 번호 입력으로 대체 가능

- **문제**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` 3개 의존성을 새로 추가하여 이미지 순서를 변경하는 것은 과도한 설계. 시험지 이미지는 보통 1~5장 수준이며, 파일 선택 시 순서대로 선택하면 대부분 올바른 순서가 된다.
- **근거**:
  - 새 의존성 3개 추가 (`package.json`에 없음)
  - DnD는 모바일/터치에서 추가 테스트 필요
  - shadcn/ui에 DnD 내장 패턴 없음 → 커스텀 구현 필요
  - "Don't Reinvent the Wheel" 원칙에 비추어, 단순 번호 입력이나 위/아래 버튼으로 충분
- **제안**: MVP에서는 파일 선택 순서 = page_number로 자동 할당 + 간단한 위/아래 버튼(swap). DnD는 사용자 피드백 후 Phase 2에서 도입.
<!-- NOTE: MVP에 포함해서 진행 -->

### [SHOULD FIX] R5 AI 재분석은 MVP에서 직접 편집으로 충분

- **문제**: AI 재분석은 동일 이미지를 다시 API에 전송 + 특정 문제만 재분석하는 별도 프롬프트 빌더 + Server Action이 필요. 이는 추가 API 비용과 복잡도를 수반한다.
- **근거**:
  - PLAN에서 "사용자 직접 편집"도 이미 포함 (Step 7의 인라인 편집 + `updateExtractedQuestion`)
  - 직접 편집만으로 MVP 핵심 가치(추출 결과 교정)를 달성 가능
  - 재분석이 반드시 더 나은 결과를 보장하지 않음 (같은 이미지 + 같은 모델)
  - "전체 재추출" 기능이 이미 존재 — 단일 문제 재분석 없이도 전체 재시도 가능
- **제안**: Step 4에서 `reanalyzeQuestion` 프롬프트 빌더 제거, Step 5에서 `reanalyzeQuestionAction` 제거, Step 7 UI에서 [AI 재분석] 버튼 제거. 직접 편집 + 전체 재추출만 유지. Phase 2에서 대화형 Chat UI와 함께 도입.
<!-- NOTE: MVP에 포함해서 진행 -->

### [SHOULD FIX] 3계층이 반드시 필요한지 재검토 — 2계층 대안

- **문제**: `past_exams` → `past_exam_images` → `past_exam_details` 3계층 구조에서, `past_exam_images`가 독립적으로 쿼리되는 시나리오가 제한적이다. 이미지는 항상 시험(past_exams)의 context에서만 조회된다.
- **근거**:
  - `past_exam_images`는 `page_number` + `source_image_url`만 저장 — 매우 얇은 테이블
  - 2계층 대안: `past_exams`에 `images JSONB` 컬럼 (`[{page: 1, url: "..."}, ...]`)으로 충분
  - 이미지 개수가 1~10장 수준으로 JSONB의 성능 한계에 도달하지 않음
  - 3계층 → RLS 정책 3세트, 인덱스 3세트, JOIN 복잡도 증가
- **제안**: 그러나 **사용자가 명시적으로 3계층을 요구**(PLAN의 "확정된 결정사항" 참조)했으므로, 이 이슈는 **사용자 확인 후** 결정. 2계층 대안의 장단점을 사용자에게 설명하고 최종 판단 위임.
<!-- NOTE: MVP에 포함해서 진행 -->

### [CONSIDER] Step 3과 Step 4의 분리 필요성

- **문제**: Step 3(AI 타입 리네이밍 + Zod 스키마)과 Step 4(프롬프트 빌더 + GeminiProvider)가 밀접하게 연관되어 있으며, 타입 정의와 그 타입을 사용하는 구현체를 별도 Step으로 분리하면 반복적인 context switching이 발생한다.
- **근거**: Step 3은 순수 타입/스키마 정의, Step 4는 해당 타입을 사용하는 로직 — 한 번에 구현하는 것이 자연스러움
- **제안**: Step 3+4를 단일 Step으로 병합 고려. 대신 테스트 파일 수준에서는 분리 유지. 7 Steps가 됨.
<!-- NOTE: 병합할것 -->

### [CONSIDER] Step 6과 Step 7의 병렬 가능성에 대한 파일 충돌 위험

- **문제**: PLAN의 의존성 그래프에서 Step 6(업로드 UI)과 Step 7(편집 UI)은 Step 5 완료 후 병렬 가능으로 표시되어 있으나, 두 Step 모두 `past-exams` 라우트 하위 파일을 다루므로 routing/layout 충돌 가능성이 있다.
- **근거**:
  - Step 6: `past-exams/upload/` 경로
  - Step 7: `past-exams/[id]/edit/` 경로
  - 공유 파일: layout, 공통 타입 import
- **제안**: 실제로는 다른 경로를 다루므로 병렬 가능하지만, **layout.tsx나 공통 import를 수정하는 에이전트는 1개만** 할당할 것. 파일 소유권을 Step 분해에 명시 필요.
<!-- NOTE: 순차적 진행으로 수정 -->

### [CONSIDER] `extraction_status` 상태 머신의 전이 규칙 명시 필요

- **문제**: `pending → processing → completed/failed` 상태 전이가 PLAN에 다이어그램으로 있지만, "전체 재추출" 시 `completed → pending` 역전이나, `failed → pending` 재시도 전이에 대한 명확한 규칙이 없다.
- **근거**: 상태 전이 규칙이 불명확하면 동시성 문제(두 번 추출 트리거) 발생 가능
- **제안**: 유효한 전이를 명시적으로 정의. 예: `{pending→processing, processing→completed, processing→failed, completed→pending(재추출), failed→pending(재시도)}`
<!-- NOTE: 명시적으로 정의할것 -->

---

## MVP vs 나중으로 미룰 것

| 기능 | MVP 필수? | 이유 |
|------|-----------|------|
| 3계층 스키마 (R3) | ✅ 예 | 사용자 명시 요구, 핵심 데이터 구조 |
| 다중 이미지 업로드 (R4) | ✅ 예 | 시험지가 여러 장인 것은 기본 |
| AI 자동 추출 (R2) | ✅ 예 | 핵심 가치 제안 |
| 사용자 직접 편집 (R6 일부) | ✅ 예 | 추출 오류 교정 필수 |
| 확정 저장 (R6 일부) | ✅ 예 | 워크플로우 완결 |
| 접근 제어 RLS (R7) | ✅ 예 | 보안 필수 |
| API 교체 가능 (R1) | ✅ 예 | Factory 패턴 이미 존재 |
| **그래프 crop 저장 (R9)** | ❌ 연기 | sharp 의존성 + bounding box 정확도 미보장, 좌표/설명만 저장으로 충분 |
| **DnD 순서 변경 (R8)** | ❌ 연기 | 3개 의존성 추가, 위/아래 버튼으로 대체 가능 |
| **AI 재분석 (R5)** | ❌ 연기 | 직접 편집 + 전체 재추출로 MVP 충분, Phase 2 Chat UI와 함께 |
| 이미지 미리보기 (R8 일부) | ✅ 예 | `URL.createObjectURL`만으로 가능, 의존성 불필요 |

**연기 시 절감 효과**:
- 의존성: `@dnd-kit/*` 3개 + `sharp` 1개 = **4개 신규 의존성 제거**
- Step 4: 재분석 프롬프트 빌더 제거 → 코드 ~50줄 절감
- Step 5: 그래프 crop 로직 + 재분석 Action 제거 → 코드 ~100줄 절감
- Step 6: DnD 컴포넌트 제거 → `image-sorter.tsx` 불필요 → 코드 ~150줄 절감
- Step 7: [AI 재분석] 버튼 + 그래프 crop 미리보기 제거 → 코드 ~80줄 절감

---

## Step 분해 적절성

### Step 크기 평가

| Step | 예상 크기 | 평가 |
|------|----------|------|
| Step 1 (스키마) | M | ✅ 적절 — 마이그레이션 + RLS + 데이터 이관 |
| Step 2 (리팩토링) | **L → M** | ⚠️ 36개 → 실제 ~12개로 축소 시 적절 |
| Step 3 (AI 타입) | S | ⚠️ 너무 작음 — Step 4와 병합 권장 |
| Step 4 (프롬프트+Gemini) | M | ✅ 적절 (Step 3 병합 시) |
| Step 5 (Server Action) | L | ⚠️ 6개 Action이 한 Step에 — createPastExam과 extractQuestions 분리 고려 |
| Step 6 (업로드 UI) | M | ✅ 적절 (DnD 제거 시 S로 축소) |
| Step 7 (편집 UI) | L | ⚠️ 큼 — 2-panel 레이아웃 + 카드 편집 + 상태 관리가 한 Step |
| Step 8 (검증) | S | ✅ 적절 |
<!-- NOTE: Step5 분히 -->

### 의존성 그래프 검증

```
Step 1 (스키마) ──→ Step 2 (리팩토링) ──→ Step 5 (Server Action)
                                              │
Step 3 (타입) ──→ Step 4 (프롬프트)  ──────────┘
                                              │
                                              ├──→ Step 6 (업로드 UI)
                                              │
                                              └──→ Step 7 (편집 UI)
                                                      │
                                                      └──→ Step 8 (검증)
```

**검증 결과**: 의존성 순서 자체는 합리적. 단, Step 2 → Step 5 의존이 불필요하게 직렬화되어 있음:
- Step 5의 `createPastExamAction`은 새 테이블(past_exams)에만 의존 → Step 1 완료 후 바로 가능
- Step 5의 `extractQuestionsAction`은 Step 2(기존 코드 리팩토링)에 의존하지 않음 (새 테이블 + 새 Action)
- **제안**: Step 2와 Step 5를 병렬 가능으로 재분류하면 전체 일정 단축 가능

---

## 병렬 구현 가능성

### 현재 병렬 가능 (PLAN 기준)
- Step 1 + Step 3 (독립)
- Step 6 + Step 7 (Step 5 완료 후)

### 추가 병렬 가능 (개선안)
- Step 2 + Step 5 (Step 1 완료 후, 서로 독립 파일 수정)
  - Step 2: 기존 `src/lib/actions/past-exams.ts` 등 수정
  - Step 5: 신규 `src/lib/actions/extract-questions.ts` 생성
  - 파일 충돌 없음

### 병렬 구현 시 파일 충돌 위험

| 조합 | 충돌 위험 | 공유 파일 |
|------|----------|----------|
| Step 1 + Step 3 | ❌ 없음 | 없음 |
| Step 2 + Step 5 | ⚠️ 낮음 | `src/types/supabase.ts` (Step 2가 수정, Step 5가 참조) |
| Step 6 + Step 7 | ⚠️ 낮음 | 라우트 layout은 별도 경로 |
| Step 2 + Step 6 | ❌ 없음 | Step 2=actions, Step 6=UI (소유권 분리) |

---

## Plan Review Completion Checklist 판정

- [x] 모든 Task의 파일 소유권이 명확하다 — 각 Step에 파일 목록 기재됨
- [x] Task 간 의존성 순서가 정의되었다 — 의존성 그래프 존재
- [ ] 외부 의존성(라이브러리, API)이 명시되었다 — `sharp` 버전 미명시, Vercel 호환성 미확인
- [x] 에러 처리 방식이 정해졌다 — `extraction_status` 상태 전이 + `{ error }` 반환
- [x] 테스트 전략이 있다 — 테스트 전략 테이블 존재
- [ ] 이전 Phase 회고(`docs/retrospective/`)의 교훈이 반영되었다 — 회고 문서 존재하지 않음 (단계 1 회고 미작성)
- [ ] 병렬 구현 시 파일 충돌 가능성이 없다 — `src/types/supabase.ts` 충돌 가능성 존재

**판정: BLOCKED** — MUST FIX 2건 해결 필요:
1. Step 2 영향 범위 정정 (36개 → 실제 수치)
2. R9 그래프 crop의 MVP 포함 여부 재확인 (SHOULD FIX 3건도 사용자 결정 권장)
