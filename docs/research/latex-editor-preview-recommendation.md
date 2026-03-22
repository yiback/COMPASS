# LaTeX 편집+미리보기 UI — 추천안

> **리서치 기반**: `docs/research/tech/latex-editor-preview.md` + `docs/research/feasibility/latex-editor-preview.md`
> **작성일**: 2026-03-22

---

## 추천: Live Preview Below (Textarea 아래 실시간 미리보기)

추가 라이브러리 없음 — 이미 확정된 `katex` 코어만 사용. Plain `<Textarea>` 유지.

---

## 비채택 옵션과 이유

| 패턴 | 비채택 이유 |
|------|-----------|
| Split View (좌우) | 기존 이미지(1/3)+카드(2/3) 레이아웃과 충돌, 편집 영역 1/3로 축소 |
| Tab Toggle (탭 전환) | 실시간 피드백 없음 — 수학 편집에서 치명적 |
| WYSIWYG (TipTap 등) | TipTap ~300KB, Textarea 완전 교체, MVP 범위 초과 |
| CodeMirror 6 | ~160KB 추가, 비개발자에게 구문 강조 이점 미미 |

---

## 핵심 근거

1. **"입력 → 즉시 아래에서 확인"이 비개발자 선생님에게 가장 직관적** — Overleaf, Mathpix Snip 등 교육 서비스에서도 이 패턴 채택
2. **기존 코드 최소 수정** — EditMode의 `questionText` state + `useDebounce(300ms)` + `<LatexPreview>` 컴포넌트 1개 추가
3. **추가 라이브러리 0개** — katex는 이미 확정된 의존성, Tabs/ResizablePanel 설치 불필요
4. **AccordionContent `space-y-3` 세로 스택과 자연스럽게 호환** — 레이아웃 변경 없음

---

## 편집+미리보기 적용 범위

| 지점 | 편집+미리보기 | KaTeX 렌더링만 |
|------|:-----------:|:------------:|
| `question-card.tsx` EditMode (questionText, options, answer) | **O** | |
| `question-card.tsx` ReadMode | | **O** |
| `generate-questions-dialog.tsx` QuestionCard | | **O** |
| `question-detail-sheet.tsx` | | **O** |

**편집+미리보기가 필요한 곳은 `question-card.tsx` EditMode 단 1곳.**
나머지는 읽기 전용이므로 `<LatexRenderer>` 렌더링만 적용.

---

## 구현 스케치

```
EditMode 내부 (question-card.tsx)
├── <Textarea> questionText
├── <LatexPreview text={debouncedQuestionText} />  ← 미리보기 (max-h-32 overflow-y-auto)
├── options[i] <Input> × N
│   └── 포커스 시에만 <LatexPreview> 표시 (공간 효율화)
├── answer <Input>
└── 저장/취소 버튼
```

- `useDebounce(questionText, 300)` — 이미 `users-toolbar.tsx`에서 사용 중인 패턴
- 미리보기 영역 `max-h-32 overflow-y-auto`로 Accordion 높이 폭주 방지
- options는 Input 포커스 시에만 미리보기 표시 → 2열 grid 레이아웃 유지

---

## 변경 범위

- **신규 파일**: `latex-renderer.tsx` (~60줄) — 파싱 유틸 + 렌더링 컴포넌트
- **수정 파일**: `question-card.tsx` EditMode +30줄, ReadMode +8줄
- **읽기 전용 적용**: `generate-questions-dialog.tsx` +12줄, `question-detail-sheet.tsx` +12줄
- **CSS**: `layout.tsx` — `import 'katex/dist/katex.min.css'` 1줄
- **총 작업량**: **M (2-3일)** — 편집 미리보기는 공통 `LatexRenderer` 재사용으로 추가 비용 미미

---

## 주요 리스크 3가지

1. **`$...$` 파서 엣지 케이스**: 중첩 `$`, 이스케이프 `\$`, `$$` vs `$` 우선순위 → 별도 유틸 + 단위 테스트 필수
2. **Accordion 내 높이 동적 변화**: 미리보기 영역이 길면 카드 높이 폭주 → `max-h-32 overflow-y-auto`로 제한
3. **객관식 보기 4개 공간**: 각 Input 아래 미리보기 시 레이아웃 복잡 → Input 포커스 시에만 표시
