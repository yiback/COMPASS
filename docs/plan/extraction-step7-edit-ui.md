# Step 7: 편집 UI 상세 구현 계획 ✅

> **상태**: ✅ 구현 완료 (2026-03-20, 3개 파일, 편집/재분석/재추출/확정 UI)

> **상태**: 계획 수립 완료
> **소유 역할**: frontend-ui
> **의존성**: Step 5 (추출+재추출+재분석 Action), Step 6 (업로드 UI) — 순차 진행
> **참조**: 마스터 PLAN `docs/plan/20260308-past-exam-extraction.md` Step 7

---

## 파일 목록

| 파일 | 유형 | 예상 크기 |
|------|------|----------|
| `src/app/(dashboard)/past-exams/[id]/edit/page.tsx` | 서버 컴포넌트 (신규) | ~80줄 |
| `src/app/(dashboard)/past-exams/[id]/edit/extraction-editor.tsx` | 클라이언트 컴포넌트 (신규) | ~600줄 |

**분리 기준**: 600줄 초과 시 아래 단위로 추출 검토
- `question-card.tsx` — 개별 문제 카드 (읽기/편집 모드)
- `image-sidebar.tsx` — 좌측 이미지 썸네일 패널
- `editor-toolbar.tsx` — 하단 액션 버튼 (수동 추가, 전체 재추출, 확정 저장)

---

## Task 분해

### Task 7.1: page.tsx — 서버 컴포넌트 데이터 패칭

**파일**: `src/app/(dashboard)/past-exams/[id]/edit/page.tsx`

서버 컴포넌트에서 초기 데이터를 패칭하여 클라이언트 컴포넌트에 전달한다.

```
1. params에서 pastExamId 추출
2. Supabase 서버 클라이언트 생성 (await cookies() 필수 — Next.js 16 비동기)
3. past_exams 조회 (id, extraction_status, subject, grade, exam_type 등)
4. past_exam_images 조회 (page_number ASC 정렬)
5. past_exam_details 조회 (question_number ASC 정렬)
6. 권한 검증: teacher/admin/system_admin만 접근 (RLS가 1차 방어, Action 레벨 2차)
7. notFound() 처리: 시험이 없거나 접근 권한 없는 경우
8. <ExtractionEditor> 클라이언트 컴포넌트에 props 전달
```

**참조 패턴**: `src/app/(dashboard)/past-exams/page.tsx` — 서버 컴포넌트 데이터 패칭 패턴

---

### Task 7.2: extraction-editor.tsx — 상태 관리

**파일**: `src/app/(dashboard)/past-exams/[id]/edit/extraction-editor.tsx`

#### useState 목록

| state | 타입 | 초기값 | 용도 |
|-------|------|--------|------|
| `questions` | `ExtractedQuestionUI[]` | 서버에서 전달받은 details | 문제 목록 (로컬 상태) |
| `editingId` | `string \| null` | `null` | 현재 편집 중인 문제 ID (단일 값 — 한 번에 하나만 편집) |
| `editForm` | `EditFormData` | `{}` | 편집 중인 문제의 임시 데이터 |
| `reanalyzingId` | `string \| null` | `null` | AI 재분석 진행 중인 문제 ID |
| `isExtracting` | `boolean` | `false` | 자동 추출 진행 중 여부 |
| `isConfirming` | `boolean` | `false` | 확정 저장 진행 중 여부 |
| `isResetting` | `boolean` | `false` | 전체 재추출 진행 중 여부 |
| `resetDialogOpen` | `boolean` | `false` | 전체 재추출 확인 Dialog 열림 상태 |
| `extractionStatus` | `ExtractionStatus` | 서버에서 전달받은 값 | 현재 추출 상태 |

#### useEffect 목록

| effect | 의존성 | 목적 |
|--------|--------|------|
| 자동 추출 트리거 | `[extractionStatus]` | `status === 'pending'` 시 `extractQuestionsAction` 자동 호출 + `cancelled` 플래그 패턴 |
| Signed URL 생성 | `[images]` | 이미지 Signed URL 생성 (60초 만료) — race condition 방지: `cancelled` 플래그 |

**참조 패턴**:
- `past-exam-detail-sheet.tsx` 74~102행: `useEffect` + `cancelled` 플래그로 race condition 방지
- `generate-questions-dialog.tsx` 224~228행: `useEffect`로 생성 완료 시 초기 상태 설정

---

### Task 7.3: 좌우 분할 레이아웃

```
┌──────────────────────────────────────────────────────────┐
│ 헤더: 시험 제목 (학교명 학년 과목 시험유형 연도/학기)       │
├──────────────────┬───────────────────────────────────────┤
│ 좌측 (w-1/3)     │ 우측 (w-2/3)                          │
│                  │                                       │
│ 이미지 썸네일     │ 문제 카드 목록 (Accordion)              │
│ page 1: 시험지_1 │ Q1 🟢 95%  [편집] [AI재분석] [삭제]     │
│ page 2: 시험지_2 │ Q2 🟡 72%  [편집] [AI재분석] [삭제]     │
│ page 3: 시험지_3 │ Q3 🟢 88%  [편집] [AI재분석] [삭제]     │
│                  │ ...                                   │
├──────────────────┴───────────────────────────────────────┤
│ 하단: [+ 문제 수동 추가] [전체 재추출] [확정 저장]          │
└──────────────────────────────────────────────────────────┘
```

- Tailwind `grid grid-cols-3` 또는 `flex` 기반 레이아웃
- 좌측: `overflow-y-auto max-h-[calc(100vh-200px)]` 스크롤
- 우측: `overflow-y-auto` 스크롤

**이미지 썸네일**:
- `past_exam_images`를 `page_number` 순으로 표시
- Signed URL로 `<img>` 렌더링 (외부+동적 URL → `next/image` 대신 `<img>` 사용 + eslint-disable)
- 클릭 시 확대 모달 (선택 사항, MVP에서는 단순 표시)

---

### Task 7.4: 문제 카드 — 읽기/편집 모드 전환

**editingId 단일 값 패턴**: 한 번에 하나의 문제만 편집 가능. 다른 문제 편집 클릭 시 기존 편집 취소 + 새 편집 시작.

#### 읽기 모드
```
┌────────────────────────────────────────┐
│ Q1  🟢 95%                    [✏️ 편집]│
│ 다음 중 올바른 것은?                    │
│ ① 보기1  ② 보기2  ③ 보기3  ④ 보기4     │
│ 정답: ③                                │
│ [📊 그래프] (hasFigure=true 시)         │
│ [AI 재분석]  [🗑️ 삭제]                 │
└────────────────────────────────────────┘
```

#### 편집 모드 (editingId === question.id)
```
┌────────────────────────────────────────┐
│ Q1  🟢 95%           [취소] [💾 저장]   │
│ 문제 유형: [Select: 객관식/단답형/서술형] │
│ 문제 내용: [Textarea]                   │
│ 보기 1: [Input]  보기 2: [Input]        │
│ 보기 3: [Input]  보기 4: [Input]        │
│ 정답: [Input]                           │
│ [📊 그래프] (읽기 전용)                  │
└────────────────────────────────────────┘
```

**confidence 색상**:
| 범위 | 색상 | Tailwind 클래스 |
|------|------|----------------|
| >= 0.8 | 🟢 녹색 | `text-green-600 bg-green-50 border-green-200` |
| 0.5 ~ 0.8 | 🟡 노란색 | `text-yellow-600 bg-yellow-50 border-yellow-200` |
| < 0.5 | 🔴 빨간색 | `text-red-600 bg-red-50 border-red-200` |

**편집 저장**: `updateExtractedQuestion(detailId, data)` (Step 4에서 구현, `exam-management.ts`)

**참조 패턴**: `generate-questions-dialog.tsx` AccordionItem 구조 (109~179행)

---

### Task 7.5: 그래프/그림 미리보기

- `hasFigure === true` && `figures` 배열이 있을 때 표시
- 각 figure에 대해:
  - `figure.url !== null`: Signed URL 생성 → `<img>` 썸네일 표시
  - `figure.url === null`: "추출 실패" 텍스트 + 경고 아이콘 표시
  - `figure.description`: 툴팁 또는 하단 캡션으로 AI 설명 표시
  - `figure.confidence`: bounding box 정확도 Badge
- 원본 대조: figure 클릭 시 해당 `pageNumber`의 원본 이미지와 나란히 표시 (또는 오버레이)

---

### Task 7.6: AI 재분석

- `[AI 재분석]` 버튼 클릭 → `reanalyzingId = question.id` 설정
- `reanalyzeQuestionAction(detailId, feedback?)` 호출 (Step 5에서 구현, `extract-questions.ts`에서 import)
- **로딩 표시** (v9 반영 — 전체 이미지 전달로 수십 초 대기 가능):
  - 해당 카드에 스피너 오버레이
  - "AI가 문제를 다시 분석하고 있습니다..." 메시지
  - 버튼 비활성화 (`disabled={reanalyzingId !== null}`)
  - 다른 문제의 AI 재분석 버튼도 비활성화 (동시 재분석 방지)
- 성공 시: `questions` state에서 해당 문제 교체 (불변 패턴: `questions.map(q => q.id === detailId ? updated : q)`)
- 실패 시: `toast.error` + `reanalyzingId = null`
- 선택적: feedback textarea (사용자 피드백 입력 → AI에게 전달)

---

### Task 7.7: 전체 재추출

- `[전체 재추출]` 버튼 클릭 → `resetDialogOpen = true`
- **확인 Dialog** (v6 추가):
  ```
  제목: 전체 재추출
  내용: "기존 추출 결과와 수동 편집 내용이 모두 삭제됩니다. 계속하시겠습니까?"
  버튼: [취소] [재추출]
  ```
- 확인 클릭 → `resetExtractionAction(pastExamId)` 호출 (Step 5에서 구현)
  - Storage orphan cleanup + details 삭제 + extraction_status = 'pending'
- 성공 시:
  - `questions = []` (로컬 상태 초기화)
  - `extractionStatus = 'pending'` → useEffect가 자동 추출 트리거
- 실패 시: `toast.error`

**참조 패턴**: AlertDialog 또는 Dialog 컴포넌트 사용

---

### Task 7.8: 확정 저장

- `[확정 저장]` 버튼 클릭 → `confirmExtractedQuestions(pastExamId)` 호출 (Step 4에서 구현, `exam-management.ts`)
- 로딩: `isConfirming = true` + 버튼 비활성화
- 성공 시: `toast.success` + `router.push('/past-exams')` 또는 성공 상태 표시
- 실패 시: `toast.error`
- 비활성 조건: `questions.length === 0` 또는 `extractionStatus !== 'completed'`

---

### Task 7.9: 수동 추가 + 자동 추출 useEffect

#### 수동 추가
- `[+ 문제 수동 추가]` 버튼 클릭 → 빈 문제 카드 추가
- **temp-ID 패턴**: `temp-${Date.now()}` 형태의 임시 ID 할당
  - DB 저장 시 서버에서 UUID 생성 → 로컬 temp-ID를 실제 ID로 교체
  - temp-ID인 문제는 `[AI 재분석]` 버튼 비활성화 (DB에 없으므로)
- 새 문제의 기본값:
  ```typescript
  {
    id: `temp-${Date.now()}`,
    questionNumber: questions.length + 1,
    questionText: '',
    questionType: 'short_answer',
    options: null,
    answer: '',
    hasFigure: false,
    figures: null,
    confidence: 1.0,  // 수동 입력이므로 최대 신뢰도
    isConfirmed: false,
  }
  ```
- 추가 즉시 편집 모드 진입: `editingId = tempId`

#### 자동 추출 useEffect (extraction_status === 'pending')
```typescript
useEffect(() => {
  if (extractionStatus !== 'pending') return

  let cancelled = false

  setIsExtracting(true)

  extractQuestionsAction(pastExamId)
    .then((result) => {
      if (cancelled) return
      if (result.error) {
        toast.error(result.error)
        setExtractionStatus('failed')
      } else {
        // ⚠️ extractQuestionsAction은 { totalQuestions, overallConfidence }만 반환
        // 문제 목록은 router.refresh()로 서버 컴포넌트 재패칭하여 갱신
        router.refresh()
        setExtractionStatus('completed')
        toast.success('문제 추출이 완료되었습니다.')
      }
    })
    .catch(() => {
      if (!cancelled) {
        setExtractionStatus('failed')
        toast.error('문제 추출 중 오류가 발생했습니다.')
      }
    })
    .finally(() => {
      if (!cancelled) setIsExtracting(false)
    })

  return () => {
    cancelled = true
  }
}, [extractionStatus, pastExamId])
```

**참조 패턴**: `past-exam-detail-sheet.tsx` 74~102행 — cancelled 플래그 패턴

---

## UI 상태별 렌더링 분기 표

| extractionStatus | isExtracting | questions.length | 렌더링 |
|-----------------|-------------|-----------------|--------|
| `pending` | `true` | 0 | 스피너 + "시험지를 분석하고 있습니다..." + 예상 소요시간 |
| `pending` | `false` | 0 | "추출 대기 중..." (useEffect 트리거 직전) |
| `processing` | `true` | 0 | 스피너 + "시험지를 분석하고 있습니다..." |
| `completed` | `false` | > 0 | 문제 카드 목록 + 액션 버튼 (정상 상태) |
| `completed` | `false` | 0 | "추출된 문제가 없습니다." + [전체 재추출] + [수동 추가] |
| `failed` | `false` | 0 | 에러 메시지 + [재시도] 버튼 (extraction_status → 'pending' 전환) |
| `failed` | `false` | > 0 | 이전 결과 표시 + 경고 배너 + [재시도] 버튼 |

---

## Import 의존성 정리

### page.tsx

| import | 출처 | 용도 |
|--------|------|------|
| `createClient` | `@/lib/supabase/server` | 서버 Supabase 클라이언트 |
| `cookies` | `next/headers` | Next.js 16 비동기 쿠키 |
| `notFound` | `next/navigation` | 404 처리 |
| `ExtractionEditor` | `./extraction-editor` | 클라이언트 컴포넌트 |

### extraction-editor.tsx

| import | 출처 | 용도 |
|--------|------|------|
| `useState`, `useEffect` | `react` | 상태 관리 |
| `useRouter` | `next/navigation` | 확정 후 리다이렉트 |
| `Accordion`, `AccordionContent`, `AccordionItem`, `AccordionTrigger` | `@/components/ui/accordion` | 문제 카드 |
| `Button` | `@/components/ui/button` | 버튼 |
| `Badge` | `@/components/ui/badge` | confidence 표시 |
| `Textarea` | `@/components/ui/textarea` | 문제 내용 편집 |
| `Input` | `@/components/ui/input` | 보기/정답 편집 |
| `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` | `@/components/ui/select` | 문제 유형 선택 |
| `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle` | `@/components/ui/dialog` | 전체 재추출 확인 |
| `toast` | `sonner` | 알림 |
| `Pencil`, `Trash2`, `Plus`, `RefreshCw`, `Check`, `Loader2` | `lucide-react` | 아이콘 |
| `extractQuestionsAction` | `@/lib/actions/extract-questions` | 자동 추출 |
| `resetExtractionAction` | `@/lib/actions/extract-questions` | 전체 재추출 |
| `reanalyzeQuestionAction` | `@/lib/actions/extract-questions` | AI 재분석 |
| `updateExtractedQuestion` | `@/lib/actions/exam-management` | 문제 편집 저장 |
| `deleteExtractedQuestion` | `@/lib/actions/exam-management` | 문제 삭제 |
| `confirmExtractedQuestions` | `@/lib/actions/exam-management` | 확정 저장 |

---

## 파일 크기 예상 + 분리 기준

| 파일 | 예상 줄 수 | 분리 트리거 |
|------|----------|-----------|
| `page.tsx` | ~80줄 | 분리 불필요 |
| `extraction-editor.tsx` | ~500-600줄 | 600줄 초과 시 분리 |

**600줄 초과 시 분리 대상**:
1. `question-card.tsx` (~150줄) — AccordionItem 읽기/편집 모드
2. `image-sidebar.tsx` (~80줄) — 좌측 이미지 썸네일 패널
3. `editor-toolbar.tsx` (~60줄) — 하단 액션 버튼 영역

---

## 완료 기준

- [ ] page.tsx: 서버 데이터 패칭 + 권한 검증 + notFound 처리
- [ ] extraction-editor.tsx: 모든 useState/useEffect 구현
- [ ] 좌우 분할 레이아웃 렌더링
- [ ] 문제 카드 읽기/편집 모드 전환 (editingId 패턴)
- [ ] confidence 색상 표시 (🟢/🟡/🔴)
- [ ] 그래프/그림 미리보기 (hasFigure + figures 배열)
- [ ] AI 재분석: 로딩 표시 + 결과 반영 + 에러 처리
- [ ] 전체 재추출: 확인 Dialog + resetExtractionAction + 자동 재추출
- [ ] 확정 저장: confirmExtractedQuestions + 리다이렉트
- [ ] 수동 추가: temp-ID 패턴 + 즉시 편집 모드
- [ ] 자동 추출: useEffect + cancelled 플래그 (pending 상태)
- [ ] UI 상태별 렌더링 분기 (pending/processing/completed/failed)
- [ ] 파일 크기 800줄 이하
- [ ] TypeScript 타입 에러 없음
- [ ] 불변 패턴 준수 (mutation 없음)

---

## 리스크

| 리스크 | 영향 | 완화 방안 |
|--------|------|----------|
| extraction-editor.tsx 600줄 초과 | Medium | 문제 카드/이미지 사이드바/툴바 분리 |
| Signed URL 만료 (60초) | Low | useEffect에서 주기적 갱신 또는 사용자 액션 시 재생성 |
| 편집 중 AI 재분석 결과 충돌 | Medium | editingId !== reanalyzingId 검증 + 재분석 결과는 편집 취소 후 반영 |
| 자동 추출 useEffect 이중 호출 | Medium | cancelled 플래그 + React.StrictMode 대응 (isExtracting 체크) |
| temp-ID → 실제 ID 동기화 | Low | 서버 응답에서 새 ID 수신 → 로컬 상태 교체 |
