# LaTeX 편집+미리보기 UI 기술 비교

## 요약

수학 선생님(비개발자) 대상 서비스에서는 **Live Preview Below(에디터 아래 실시간 미리보기)** 패턴이 최적이다. 기존 `<Textarea>` 기반 `EditMode` 구조를 최소 수정으로 수용하면서 UX 직관성과 구현 단순성을 동시에 달성할 수 있으며, 추가 에디터 라이브러리 없이 `katex` 코어(이미 확정)만으로 구현 가능하다.

---

## UI 패턴 비교표

| 기준 | Split View (좌우 분할) | Toggle Tab (탭 전환) | WYSIWYG 하이브리드 | Live Preview Below (상하 분할) |
|---|---|---|---|---|
| **UX 직관성 (비개발자)** | 중 — 화면이 좁아 보임 | 중 — 전환 비용 있음 | 낮음 — 학습 비용 높음 | **높음 — 즉각적 피드백** |
| **구현 복잡도** | 낮음 | 매우 낮음 | 매우 높음 | **낮음** |
| **모바일/반응형** | 나쁨 — 좁은 화면에서 깨짐 | **좋음** — 탭 전환으로 해결 | 나쁨 — 터치 조작 복잡 | 보통 — 세로 스크롤로 수용 |
| **성능 (타이핑 중)** | debounce 권장 | 탭 전환 시만 렌더링 | 복잡한 상태 동기화 | **debounce 300ms로 충분** |
| **접근성** | 보통 | 보통 | 낮음 | **보통~좋음** |
| **추가 라이브러리 필요** | 없음 | 없음 | TipTap / ProseMirror | **없음** |
| **기존 코드 전환 비용** | 낮음 | **매우 낮음** | 높음 — Textarea 완전 교체 | **낮음** |
| **LaTeX 오류 피드백** | 즉각적 | 탭 전환 시만 | 즉각적 | **즉각적** |

---

## 각 패턴 상세 분석

### 1. Split View (좌우 분할)

**개요**
왼쪽 절반에 `<Textarea>`, 오른쪽 절반에 실시간 렌더링 미리보기. VSCode의 Markdown Preview와 동일한 방식.

**UX 적합성**
- 장점: 입력과 결과를 동시에 볼 수 있어 개발자에게는 직관적
- 단점: COMPASS 편집 화면은 이미 좌측 이미지 썸네일(1/3) + 우측 문제 카드(2/3)로 구성됨. `question-card.tsx`의 `AccordionContent` 내부에서 다시 좌우 분할을 적용하면 실제 편집 영역이 화면의 1/3 수준으로 축소됨 → 가독성 심각하게 저하
- 수학 선생님에게 "에디터 패널"과 "미리보기 패널"의 구분이 낯설 수 있음

**구현 복잡도**
- `flex flex-row gap-4` 레이아웃 추가 + debounce로 구현 가능
- katex 코어만으로 충분, 추가 라이브러리 불필요

**모바일/반응형**
- 태블릿(768px) 이하에서 좌우 분할이 의미 없어짐 → `flex-col`로 폴백 필요
- COMPASS의 편집 화면이 이미 3단 구조(이미지+카드)이므로 반응형 조정 비용이 큼

**성능**
- `useEffect` + `useState`로 debounce 구현, 300ms 지연으로 타이핑 중 불필요한 렌더링 방지 가능
- katex 동기 렌더링이므로 성능 문제 없음

**접근성**
- 두 영역이 독립적이므로 `aria-label`로 구분 표시 필요

**결론**: 현재 화면 레이아웃과 충돌하여 UX 저하 우려. 비추천.

---

### 2. Toggle Tab (탭 전환 / Inline Preview)

**개요**
"편집" / "미리보기" 두 탭을 전환하는 방식. GitHub Issue 편집기, StackOverflow 질문 작성 화면과 동일한 UX.

**UX 적합성**
- 장점: 탭이라는 UI 패턴은 비개발자에게도 매우 친숙함
- 단점: 탭 전환 없이는 수식이 올바른지 확인 불가 → "타이핑 → 탭 전환 → 확인 → 탭 전환 → 수정" 반복이 번거로움
- LaTeX 문법 오류를 즉각 피드백받지 못함 (잘못 작성하고 저장 후 읽기 모드에서 발견하는 상황)

**구현 복잡도**
- 매우 낮음: `activeTab` 상태 변수 1개 + 조건부 렌더링
- 기존 `EditMode` 컴포넌트에 탭 UI만 추가하면 되므로 전환 비용 최소

**모바일/반응형**
- 탭 전환 방식이므로 화면 크기와 무관하게 동작
- 모바일 대응이 가장 자연스러운 패턴

**성능**
- 탭 전환 시에만 렌더링 → 성능 부담 가장 적음

**접근성**
- ARIA `role="tablist"`, `role="tab"`, `role="tabpanel"` 패턴으로 접근성 구현 용이

**결론**: 구현이 가장 단순하고 모바일 친화적이지만, 실시간 피드백 부재가 수학 문제 편집에서 치명적 단점. 보조 옵션으로는 유효.

---

### 3. WYSIWYG 하이브리드

**개요**
수식 부분은 렌더링된 상태로 보여주고, 클릭하면 LaTeX 소스로 전환되는 방식. Notion 수식 블록과 유사.

**UX 적합성**
- 장점: 최종 결과물처럼 보이는 편집 환경 → 이상적인 UX
- 단점: "수식 영역 클릭 → 편집 모드 전환 → 다른 곳 클릭 → 닫힘"의 동작 방식이 비개발자에게 직관적이지 않음
- 수식과 텍스트의 경계를 선택 커서로 탐색하기 어려움 (특히 `$수식$`이 텍스트 중간에 삽입된 경우)
- 수식 블록 단위가 아닌 인라인 수식(`$...$`)이 많은 수학 시험 문제에서는 UX가 복잡해짐

**구현 복잡도**
- 매우 높음: ProseMirror 또는 TipTap 기반의 커스텀 노드 확장 필요
- `@tiptap/extension-mathematics` 또는 `prosemirror-math` 같은 별도 라이브러리 추가 필요
- 기존 `<Textarea>` 기반 EditMode 완전 교체 필요 → 전환 비용 최대

**모바일/반응형**
- 터치 환경에서 수식 블록 선택 및 편집이 매우 어려움

**에디터 라이브러리 옵션**

| 라이브러리 | 번들 크기 | React 19 호환 | LaTeX 지원 | 학습 비용 |
|---|---|---|---|---|
| TipTap 2.x | ~300 KB | 공식 지원 | `extension-mathematics` 플러그인 (katex 기반) | 높음 |
| ProseMirror | ~100 KB | 직접 통합 필요 | `prosemirror-math` | 매우 높음 |
| Slate.js | ~120 KB | React 의존 (호환성 주의) | 직접 구현 필요 | 높음 |

- TipTap의 `@tiptap/extension-mathematics`는 katex를 내부적으로 사용하며, 수식 클릭 시 LaTeX 소스 편집기를 팝업으로 표시하는 패턴을 제공
- 단, TipTap 자체 번들이 크고, Next.js SSR과의 통합이 복잡함 (`'use client'` + dynamic import 필요)

**결론**: 장기적 UX 이상이지만 현재 MVP 단계에서는 과도한 구현 비용. 추후 로드맵 항목으로 적합.

---

### 4. Live Preview Below (상하 분할 — **추천**)

**개요**
`<Textarea>` 아래에 실시간 렌더링 미리보기가 표시되는 방식. 에디터와 미리보기가 항상 함께 보임.

**UX 적합성**
- 장점: "쓰면 바로 아래에 나타난다"는 가장 직관적인 피드백 루프
- 비개발자에게도 "입력 → 즉각 확인" 흐름이 자연스러움
- Overleaf, 일부 수식 편집기(Mathpix Snip, Typst) 등 교육 서비스에서 이 패턴 채택
- LaTeX 오류 발생 시 미리보기에서 즉시 빨간색으로 표시됨 (`throwOnError: false` 옵션)

**구현 복잡도**
- 낮음: 기존 `<Textarea>` 유지 + 아래에 katex 렌더링 컴포넌트 추가
- 추가 라이브러리 불필요 (katex 코어만 사용)
- `questionText` state를 debounce 처리하여 미리보기에 전달

**현재 코드와의 통합**

`question-card.tsx`의 `EditMode` 컴포넌트에서 `questionText` state가 이미 존재:

```
// 현재 구조 (EditMode 내부)
const [questionText, setQuestionText] = useState(question.questionText)

// 추가 필요한 것:
// 1. useDebounce 훅으로 debouncedText 생성 (300ms)
// 2. <Textarea> 아래에 <LatexPreview text={debouncedText} /> 추가
// 3. LatexPreview: Client Component — $...$ 파싱 + katex.renderToString()
```

- `EditMode`가 이미 `'use client'` 파일 내에 있으므로 클라이언트 컴포넌트로 katex 직접 사용 가능
- `$...$` 패턴 파싱 유틸 함수 1개 + 미리보기 컴포넌트 1개 추가로 구현 완료

**모바일/반응형**
- 상하 배치는 좁은 화면에서도 자연스럽게 동작
- 기존 `AccordionContent`의 `space-y-3` 패턴과 완벽히 호환

**성능**
- debounce 300ms로 타이핑 중 불필요한 렌더링 방지
- katex 동기 렌더링은 CPU 부담이 매우 낮음 (일반적인 문제 1개 기준 <1ms)
- 문제 텍스트 평균 길이(200~500자)에서 성능 이슈 없음

**접근성**
- 미리보기 영역에 `aria-label="수식 미리보기"` + `aria-live="polite"` 적용으로 스크린 리더 지원 가능
- katex 출력에 `aria-label={rawLatex}` 수동 추가 권장 (이전 리서치 결과 반영)

**결론**: COMPASS 기존 구조와 가장 자연스럽게 통합되며, 수학 선생님 UX를 최대화하는 패턴. **추천.**

---

### 5. 기타 주목할 대안

#### 5-1. Overlay Preview (호버/포커스 팝오버)
`<Textarea>` 위에 포커스가 있을 때는 raw 텍스트, 포커스가 없을 때는 렌더링된 미리보기로 전환하는 방식.
- 구현 가능하지만 `onFocus`/`onBlur` 이벤트 처리가 복잡하고, 편집 중 미리보기를 볼 수 없는 문제 발생. 비추천.

#### 5-2. CodeMirror 6 + 미리보기 패널
`<Textarea>` 대신 CodeMirror 6 에디터를 사용하여 LaTeX 구문 강조 + 자동 완성 + Live Preview Below 결합.
- **장점**: `$`, `\frac`, `\sqrt` 등 LaTeX 키워드 구문 강조, 괄호 자동 매칭
- **단점**: CodeMirror 6 번들 크기 약 300 KB, React 19 통합 복잡도 증가
- **번들 크기**: `@codemirror/view` + `@codemirror/state` + `@codemirror/lang-markdown` 조합 시 ~160 KB (gzip)
- 비개발자 대상이므로 구문 강조의 UX 이점이 제한적 — LaTeX에 익숙한 교사에게는 유용
- COMPASS MVP 범위에서는 과도. 향후 고급 편집 기능 요구 시 업그레이드 경로로 적합

---

## 에디터 라이브러리 비교

Live Preview Below 패턴 채택 시 에디터 라이브러리 선택:

| 라이브러리 | 번들 크기 (gzip) | React 19 | LaTeX 구문 강조 | COMPASS 적합도 |
|---|---|---|---|---|
| **Plain Textarea (현재)** | **0 KB 추가** | 완전 호환 | 없음 | **최적** |
| CodeMirror 6 | ~160 KB 추가 | 별도 래퍼 필요 | `@codemirror/lang-markdown` | 고급 UX 필요 시 |
| Monaco Editor | ~2 MB 추가 | 공식 미지원 | 내장 | 과도 (IDE 수준) |
| TipTap | ~300 KB 추가 | 공식 지원 | extension 필요 | WYSIWYG 전환 시 |

**결론**: Plain `<Textarea>` 유지 + Live Preview Below 조합이 최적. 추가 번들 0 KB.

---

## 추천 및 근거

### 추천: **Live Preview Below — Plain Textarea + katex 클라이언트 렌더링**

**이유:**

1. **기존 코드 최소 수정**: `question-card.tsx`의 `EditMode`에서 `questionText` state가 이미 존재. `useDebounce` 훅 + `<LatexPreview>` 컴포넌트 2개 추가만으로 구현 완료. `<Textarea>` 교체 불필요.

2. **수학 선생님 UX 최적**: "입력 → 아래에서 즉시 확인"이 가장 직관적인 피드백 루프. 탭 전환 없이 항상 렌더링 결과 확인 가능.

3. **추가 라이브러리 없음**: katex는 이미 확정된 의존성. 별도 에디터 라이브러리 추가 불필요 → 번들 크기 증가 없음.

4. **현재 레이아웃과 호환**: `AccordionContent`의 `space-y-3` 세로 스택 구조 안에서 `<Textarea>` 바로 아래에 미리보기 영역 삽입. COMPASS의 기존 좌우 분할(이미지 1/3 + 카드 2/3) 레이아웃과 충돌 없음.

5. **debounce로 성능 제어**: `useDebounce(questionText, 300)` 패턴으로 타이핑 중 불필요한 katex 렌더링 방지. 이미 `users-toolbar.tsx`에서 사용 중인 패턴과 일관성 유지 (MEMORY.md 기록).

6. **클라이언트 컴포넌트에서 katex 직접 사용 가능**: `question-card.tsx`가 `'use client'` 파일이므로 Server Component 패턴 불필요. `katex.renderToString()` + `dangerouslySetInnerHTML` 직접 사용. (읽기 모드에서의 katex 렌더링은 Server Component로 적용 가능하지만, 편집 모드의 미리보기는 클라이언트 실시간 렌더링이 필수.)

**구현 스케치 (참고용 — 코드 작성 금지):**
```
EditMode 컴포넌트 확장 방향:
1. useDebounce(questionText, 300) → debouncedText
2. <Textarea> 아래에 조건부 미리보기 패널 렌더링
3. 미리보기 패널: parseLatexText(debouncedText) → 각 segment를 텍스트 또는 katex HTML로 렌더링
4. options(보기), answer(정답) 필드도 동일 패턴 적용
5. options는 2열 grid 구조이므로 각 Input 아래에 소형 미리보기 표시
```

---

## 주요 리스크

### 1. `$...$` 파서 엣지 케이스
정규표현식 기반으로 `$...$`를 파싱할 때 중첩 `$` 처리, 이스케이프된 `\$`, `$$...$$`와 `$...$`의 우선순위 처리 등이 복잡할 수 있다. 기존 리서치(`latex-rendering.md`)에서 이미 언급된 리스크. 파서를 별도 유틸 함수로 분리하여 단위 테스트로 엣지 케이스를 검증해야 한다.

### 2. Textarea 크기 조정 충돌
`question-card.tsx`의 `<Textarea rows={3} className="resize-none">` 설정에서, 미리보기가 추가되면 카드 전체 높이가 동적으로 커짐. Accordion 애니메이션과 충돌 가능성 있음. CSS `min-height` 또는 `max-h-32 overflow-y-auto`로 미리보기 영역 크기를 제한해야 함.

### 3. 객관식 보기(options) 필드 처리
객관식 문제에서는 보기 4개 각각에도 LaTeX가 포함될 수 있음. 현재 `2열 grid` 레이아웃에서 각 Input 아래에 미리보기를 추가하면 레이아웃이 복잡해짐. 보기 필드는 미리보기를 "Input 포커스 시 Input 아래에만 표시"하는 방식으로 공간 효율화 고려 필요.

### 4. dangerouslySetInnerHTML XSS
katex 출력은 AI가 생성한 LaTeX 수식을 렌더링하는 것이므로 XSS 위험은 낮으나, 사용자가 직접 편집하는 내용이기 때문에 `throwOnError: false` 옵션과 함께 katex 자체 이스케이핑을 신뢰해야 함. katex는 HTML을 직접 주입하는 방식이 아닌 수식 전용 렌더링이므로 실질적 XSS 위험 없음.

### 5. ReadMode에서의 katex 렌더링 필요
편집 미리보기와는 별도로, `ReadMode`의 `<p className="whitespace-pre-wrap text-sm">{question.questionText}</p>`도 katex 렌더링이 필요함. ReadMode는 Server Component가 아닌 `'use client'` 파일 내에 있으므로, 클라이언트 렌더링 방식이 일관되게 적용됨.

### 6. katex CSS 미로드 시 레이아웃 깨짐
`katex/dist/katex.min.css` 미로드 시 수식 레이아웃이 깨짐. 이전 리서치(`latex-rendering.md`)에서 이미 확인된 리스크. `app/layout.tsx` 또는 해당 페이지 레이아웃에서 CSS import 필수.

---

## 벤치마크 참조

- **Overleaf**: Split View(좌우 분할) 사용. 그러나 Overleaf 사용자는 LaTeX 전문가 대상 — 비개발자 선생님과 다른 컨텍스트.
- **Notion 수식 블록**: WYSIWYG 방식. 블록 단위 수식에 최적화되어 있으나 인라인 수식이 많은 시험 문제에는 부적합.
- **Mathpix Snip / Gradescope**: 수식 입력 후 미리보기를 별도 영역에 표시 — Live Preview Below 패턴과 유사.
- **GitHub Issue 편집기**: Toggle Tab 방식. 코드 블록이 많은 이슈 작성에 최적화 — 수식 편집과는 다른 유즈케이스.
- **Quill + KaTeX 플러그인**: WYSIWYG이지만 인라인 수식 처리 품질이 낮음. 유지보수도 불안정.

---

## 참고 자료

- [KaTeX 공식 문서 — Browser 환경 및 renderToString](https://katex.org/docs/api)
- [TipTap extension-mathematics](https://tiptap.dev/docs/extensions/mathematics)
- [CodeMirror 6 — React 통합](https://codemirror.net/examples/react/)
- [Overleaf 에디터 아키텍처 블로그](https://www.overleaf.com/blog/tag/tech-blog)
- [Mathpix UX 패턴](https://mathpix.com/docs)
- [COMPASS 이전 리서치 — LaTeX 렌더링 라이브러리 비교](./latex-rendering.md)
