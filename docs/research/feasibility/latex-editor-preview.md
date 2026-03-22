# LaTeX 편집+미리보기 UI 실현 가능성 분석

> **작성일**: 2026-03-22
> **역할**: feasibility-analyst
> **컨텍스트**: Next.js 16 + React 19 + Supabase + KaTeX 확정 + Vercel
> **평가 대상**: 수학 문제 편집 화면에 LaTeX 편집+미리보기 동시 UI 도입

---

## 요약

LaTeX 편집+미리보기 동시 UI 도입은 **M(2-3일)** 수준이다. 기존 EditMode가 단순 `<Textarea>` 기반이므로 구조 변경 없이 Textarea 우측(또는 하단)에 미리보기 패널을 추가하면 된다. 핵심 난이도는 레이아웃 공간 확보이며, 기존 `grid grid-cols-3` 좌우 분할 레이아웃이 이미 존재하므로 Accordion 내부에서만 공간을 재배분하면 된다. DB 스키마 변경, Server Action 변경, 상태 관리 변경은 불필요하다.

---

## 현재 편집 UI 구조

### ReadMode / EditMode 전환 방식

`question-card.tsx` 378~433행에서 `isEditing` prop으로 두 모드를 조건부 렌더링한다:

```
AccordionItem
  └─ AccordionContent
       ├─ [isEditing=true]  → <EditMode>
       └─ [isEditing=false] → <ReadMode> + 액션 버튼
```

- `editingId` 단일 값으로 한 번에 1개 카드만 편집 가능 (`extraction-editor.tsx` 76행)
- 편집 시작: `handleStartEdit(questionId)` → `setEditingId(questionId)` (175~177행)
- 편집 취소: `handleCancelEdit()` → `setEditingId(null)` (179~181행)
- 편집 저장: `handleSaveEdit(questionId, data)` → Server Action 호출 → 로컬 상태 불변 업데이트 (183~251행)

### 편집 필드 구성 (EditMode — question-card.tsx 232~315행)

| 필드 | 컴포넌트 | LaTeX 포함 가능성 |
|------|----------|-----------------|
| `questionType` | `<Select>` | 없음 |
| `questionText` | `<Textarea rows={3}>` | 높음 (AI 출력 포함) |
| `options[i]` (객관식) | `<Input>` × N | 높음 |
| `answer` | `<Input>` | 중간 |

현재 EditMode는 `resize-none text-sm` Textarea에 raw LaTeX를 그대로 표시한다. 미리보기 없이 수식 코드 그대로 노출.

### 상태 관리 흐름

EditMode는 로컬 `useState`로 폼 상태를 관리한다 (`question-card.tsx` 201~206행):

```typescript
const [questionText, setQuestionText] = useState(question.questionText)
const [questionType, setQuestionType] = useState(question.questionType)
const [options, setOptions] = useState<string[]>(...)
const [answer, setAnswer] = useState(question.answer ?? '')
```

- `debounce` 없음 — onChange → 즉시 state 업데이트, 저장은 명시적 버튼 클릭 시
- 저장 흐름: `handleSave()` → `onSave(data)` prop → `extraction-editor.tsx`의 `handleSaveEdit` → Server Action 호출

---

## 편집 지점 전수 조사

LaTeX 편집+미리보기가 필요한 UI 지점:

| # | 파일 | 컴포넌트 | 편집 가능 여부 | 미리보기 필요 여부 |
|---|------|----------|--------------|-----------------|
| 1 | `src/app/(dashboard)/past-exams/[id]/edit/question-card.tsx` | `EditMode` — `questionText` Textarea | 편집 가능 | **필요** (핵심) |
| 2 | `src/app/(dashboard)/past-exams/[id]/edit/question-card.tsx` | `EditMode` — `options[i]` Input | 편집 가능 | **필요** |
| 3 | `src/app/(dashboard)/past-exams/[id]/edit/question-card.tsx` | `EditMode` — `answer` Input | 편집 가능 | 선택 (단순 텍스트 多) |
| 4 | `src/app/(dashboard)/past-exams/[id]/edit/question-card.tsx` | `ReadMode` — questionText, options, answer | 읽기 전용 | KaTeX 렌더링만 (편집 없음) |
| 5 | `src/app/(dashboard)/past-exams/_components/generate-questions-dialog.tsx` | `QuestionCard` | 읽기 전용 (수정 불가) | KaTeX 렌더링만 |
| 6 | `src/app/(dashboard)/questions/_components/question-detail-sheet.tsx` | `QuestionDetailSheet` | 읽기 전용 | KaTeX 렌더링만 |

**핵심 편집+미리보기 필요 지점**: `question-card.tsx`의 `EditMode` 1곳.
읽기 전용 지점(4, 5, 6)은 KaTeX 렌더링만 적용하면 되고 Split View 불필요.

---

## 레이아웃 제약 분석

### 기존 편집 페이지 레이아웃 (`extraction-editor.tsx` 614~674행)

```
<div className="grid grid-cols-3 gap-4">   (QuestionsPanel)
  ├─ col-span-1  이미지 썸네일 패널  (1/3)
  └─ col-span-2  문제 카드 목록     (2/3)
       └─ Accordion
            └─ AccordionItem
                 └─ AccordionContent
                      └─ [EditMode] ← 현재 전체 너비 사용
```

문제 카드 영역은 viewport 2/3 너비. AccordionContent는 그 전체를 사용한다.

`QuestionsPanel`에 `maxHeight: 'calc(100vh - 280px)'` 가 적용된 overflow-y-auto 컨테이너 내부이므로, 미리보기 패널이 세로로 너무 길면 스크롤이 발생한다.

### Dashboard 레이아웃 (`layout.tsx` 36~62행)

```
<div className="flex h-screen overflow-hidden">
  <DashboardSidebar />                    (md:ml-64 오프셋)
  <div className="flex flex-1 flex-col overflow-hidden md:ml-64">
    <DashboardHeader />
    <main className="flex-1 overflow-y-auto bg-muted/40 p-4 md:p-6">
      {children}                           ← ExtractionEditor
    </main>
  </div>
</div>
```

편집 페이지는 전체 화면(`h-screen`) 레이아웃 내에서 `flex-1 overflow-y-auto` main 영역을 사용한다. 데스크톱 기준 사이드바(264px) 제외 후 남은 너비를 사용.

### 공간 분석 요약

| 영역 | 사용 가능 너비 | 비고 |
|------|-------------|------|
| 이미지 패널 (col-span-1) | ~25~30% | 고정 |
| 문제 카드 패널 (col-span-2) | ~45~55% | 현재 EditMode 전용 |
| EditMode 내부 가용 공간 | col-span-2 전체 | Split View 추가 가능 |

EditMode 내부에서 `grid grid-cols-2`로 좌/우를 나누면 각각 약 22~27% 너비. 짧은 수식은 충분하나 긴 문제 내용은 줄 바꿈 필요. **좌우 분할보다 상하 탭 전환이 공간 효율이 높음.**

### Dialog/Sheet 내부 공간 제약

- `GenerateQuestionsDialog`: `sm:max-w-2xl` (≈672px) 고정폭. 읽기 전용이므로 Split View 불필요.
- `QuestionDetailSheet`: `<SheetContent>` 기본 너비(~400px). 읽기 전용이므로 Split View 불필요.

### 모바일 대응 현황

현재 `QuestionsPanel`은 `grid-cols-3` 고정이며 모바일 breakpoint 분기 없음. 즉, 현재도 모바일에서 레이아웃이 깨진다. Split View 도입 시 모바일 대응은 `md:grid-cols-2` 분기 추가가 필요하지만, 기존 레이아웃도 모바일 최적화가 안 된 상태이므로 이 이슈는 기존 문제이다.

---

## Shadcn UI 활용 가능 컴포넌트

현재 `src/components/ui/`에 설치된 Shadcn 컴포넌트:

| 컴포넌트 | 파일 | Split View 활용 가능성 |
|---------|------|----------------------|
| Accordion | `accordion.tsx` | 이미 사용 중 |
| Separator | `separator.tsx` | 편집/미리보기 영역 구분선 |
| Tabs | **미설치** | 탭 전환 방식에 필요 |

**중요**: `tabs.tsx`, `resizable.tsx` 모두 **미설치** 상태.

- `Tabs`: `npx shadcn@latest add tabs` 한 명령으로 추가 가능. 작업량 S.
- `ResizablePanel`: Radix UI에 기본 없음 — `react-resizable-panels` 외부 패키지 필요. `shadcn add resizable`로 추가 가능하나 `react-resizable-panels` 의존성 추가됨.

### Split View 구현 방식 비교

| 방식 | 필요 컴포넌트 | 설치 필요 | 장점 | 단점 |
|------|------------|---------|------|------|
| **상하 탭 전환 (Tabs)** | `Tabs`, `TabsList`, `TabsContent` | `shadcn add tabs` | 공간 효율 최대, 단순 구현 | 편집/미리보기 동시 노출 불가 |
| **좌우 고정 분할 (CSS grid)** | 없음 (순수 CSS) | 불필요 | 동시 노출, 설치 없음 | 가용 너비 반으로 줄어듦 |
| **드래그 가능 분할 (ResizablePanel)** | `ResizablePanel` | `shadcn add resizable` | 사용자 커스텀, 동시 노출 | 의존성 추가, 구현 복잡도 높음 |
| **토글 버튼 (Show Preview)** | 없음 | 불필요 | 기존 레이아웃 무변경, 단순 | 동시 노출 불가 |

---

## 변경 범위 평가

### MVP 변경 파일 목록

| 영역 | 파일 | 변경 내용 | 예상 변경량 | 작업량 |
|------|------|---------|-----------|--------|
| Shadcn Tabs 설치 | `src/components/ui/tabs.tsx` (신규) | `npx shadcn add tabs` | +100줄 (자동 생성) | XS |
| EditMode 구조 변경 | `src/app/(dashboard)/past-exams/[id]/edit/question-card.tsx` | `EditMode` 함수 내부 — Tabs 구조 추가, 미리보기 패널 삽입 | +30~40줄 수정 | S |
| KaTeX CSS | `src/app/globals.css` 또는 `layout.tsx` | `katex/dist/katex.min.css` 임포트 | +1줄 | XS |
| LatexRenderer 컴포넌트 | `src/components/ui/latex-renderer.tsx` (신규) | 파싱 함수 + 렌더링 컴포넌트 | +60~80줄 | S |
| package.json | `package.json` | `katex` 의존성 추가 | +1줄 | XS |
| ReadMode 적용 | `src/app/(dashboard)/past-exams/[id]/edit/question-card.tsx` | ReadMode 내 3곳 `<LatexRenderer>` 교체 | +8줄 수정 | XS |

**총 변경 파일**: 4~5개 (신규 2 + 수정 3)
**총 변경 라인**: 약 100~130줄
**DB 스키마 변경**: 없음
**Server Action 변경**: 없음
**상태 관리 변경**: `showPreview` boolean state 1개 추가 (탭 방식 선택 시 불필요)

### Full 변경 파일 목록 (ResizablePanel 방식)

| 영역 | 파일 | 변경 내용 | 예상 변경량 | 작업량 |
|------|------|---------|-----------|--------|
| shadcn resizable 설치 | `src/components/ui/resizable.tsx` (신규) | `npx shadcn add resizable` | +50줄 (자동 생성) | XS |
| react-resizable-panels | `package.json` | 의존성 추가 | +1줄 | XS |
| EditMode ResizablePanel | `src/app/(dashboard)/past-exams/[id]/edit/question-card.tsx` | EditMode 내 ResizablePanel 구조 | +40~50줄 수정 | S |
| MVP 항목 포함 | 위 MVP 항목 모두 | 동일 | | M |

---

## 단계적 도입 전략

### MVP (최소 구현) — 탭 전환 방식

**목표**: 편집 탭과 미리보기 탭 전환. 동시 노출은 없으나 빠른 확인 가능.

**구현 패턴**:

```
EditMode 내부
└─ <Tabs defaultValue="edit">
     ├─ <TabsList>
     │    ├─ <TabsTrigger value="edit">편집</TabsTrigger>
     │    └─ <TabsTrigger value="preview">미리보기</TabsTrigger>
     └─ <TabsContent value="edit">
     │    기존 Textarea/Input 구성 그대로
     └─ <TabsContent value="preview">
          <LatexRenderer text={questionText} />
          + options 렌더링
          + answer 렌더링
```

- 기존 EditMode 코드를 `TabsContent value="edit"` 안으로 이동 (줄 수 변화 최소)
- 미리보기 탭은 ReadMode와 유사하지만 로컬 state(`questionText`, `options`, `answer`)를 실시간으로 반영
- **탭 state는 로컬** — 저장/취소 흐름에 영향 없음
- 설치 필요: `shadcn add tabs`, `npm install katex`

**예상 작업량**: S+M (1.5~2일)

### Full (완전 구현) — 좌우 고정 분할 방식

**목표**: 좌측 편집 + 우측 미리보기 동시 노출. 타이핑 즉시 미리보기 업데이트.

**구현 패턴**:

```
EditMode 내부
└─ <div className="grid grid-cols-2 gap-3">
     ├─ 좌측: 기존 Textarea/Input 구성
     └─ 우측: 미리보기 패널
          └─ <div className="rounded-md border p-3 min-h-[100px] overflow-y-auto">
               <LatexRenderer text={questionText} />
               + options, answer 미리보기
```

- Accordion 내부에서 `col-span-2`가 반으로 줄어들므로 각 편집 영역은 약 20~25% 뷰포트 너비
- 추가 설치 불필요 (순수 CSS grid)
- `questionText` Textarea는 `rows={3}`에서 `rows={5}` 이상으로 확대 권장

**예상 작업량**: S+M (2~2.5일)

### Full+ (선택 확장) — ResizablePanel 방식

**목표**: 사용자가 편집/미리보기 패널 비율을 드래그로 조절.

- `shadcn add resizable` + `react-resizable-panels` 의존성 추가
- EditMode 내 `ResizablePanelGroup` + `ResizablePanel` + `ResizableHandle` 구조
- 기본 분할비: 50:50 → 사용자 조절 가능
- **예상 작업량**: M (2.5~3일)

---

## 호환성 리스크

### 1. Accordion 내부 레이아웃 공간 (중간)

AccordionContent는 `px-1` 패딩만 있고 너비 제약이 명시적이지 않다. 현재 EditMode가 전체 너비를 사용하므로, `grid grid-cols-2`로 분할 시 각 패널 너비가 약 col-span-2의 절반이 된다. 1280px 이상 화면에서는 약 450~550px → 충분. 1024px 이하에서는 약 350px 이하 → 가독성 저하 가능.

**완화**: 탭 전환 방식(MVP)을 선택하면 이 리스크 없음.

### 2. 기존 EditMode isEditing 단일 값 패턴 (낮음)

`editingId`로 한 번에 1개만 편집 가능한 기존 설계는 그대로 유지된다. Split View는 EditMode 내부에서만 동작하므로 영향 없음.

### 3. react-katex SSR hydration (낮음)

기존 `latex-rendering.md` 분석에서 이미 평가됨. `question-card.tsx`가 `'use client'`이므로 hydration 문제 없음.

### 4. 탭 전환 시 편집 내용 유지 (낮음)

`TabsContent`는 기본적으로 DOM에서 unmount되지 않으므로 탭 전환 시 `useState` 값이 유지된다. Radix Tabs는 `forceMount` prop 없이도 내부 state를 보존한다. 단, `TabsContent`에 `forceMount` 없이 구현하면 미리보기 탭이 숨겨져도 DOM에 남아 있어 성능에 미미한 영향.

### 5. 보기(options) 미리보기 동기화 (중간)

`options` 배열을 실시간으로 미리보기에 반영하려면 `options` state가 변경될 때마다 미리보기 패널이 업데이트되어야 한다. 현재 `handleOptionChange`가 불변 패턴으로 구현되어 있으므로 미리보기 패널에서 `options` state를 직접 읽으면 자동으로 동기화된다.

---

## 총 작업량 평가

| 구현 방식 | 작업량 | 변경 파일 수 | 의존성 추가 | 레이아웃 변경 |
|---------|--------|-----------|----------|------------|
| MVP (탭 전환) | **S (1~1.5일)** | 4개 | katex, (tabs는 shadcn UI만) | 없음 |
| Full (고정 분할) | **M (2~2.5일)** | 4개 | katex | EditMode 내부만 |
| Full+ (ResizablePanel) | **M (2.5~3일)** | 5개 | katex + react-resizable-panels | EditMode 내부만 |

### 권장 순서

1. **먼저**: `latex-renderer.tsx` 공통 컴포넌트 + KaTeX 설치 (기존 `latex-rendering.md` 권장 구현 순서와 동일)
2. **ReadMode/Sheet/Dialog**: 읽기 지점에 `<LatexRenderer>` 교체 (기존 계획 그대로)
3. **EditMode Split View**: MVP(탭 전환) 방식으로 시작 → 사용자 피드백 후 Full(고정 분할)로 전환 가능

전체 LaTeX 도입(읽기 렌더링 + 편집 미리보기) 합산 작업량: **M (2~3일)** — 기존 `latex-rendering.md` 예측(M, 2~3일)과 동일. 편집 미리보기는 공통 `LatexRenderer` 재사용 덕분에 추가 비용이 크지 않음.
