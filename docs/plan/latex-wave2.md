# Wave 2: ReadMode + Dialog + Sheet 적용 (병렬)

> 마스터 PLAN: docs/plan/latex-rendering.md
> 의존: Wave 1 완료
> 담당: frontend-ui
> Task 4, 5, 6은 서로 다른 파일 → 병렬 가능

---

## 변경 파일

| 파일 | 유형 | 라인 수 |
|------|------|---------|
| `question-card.tsx` | 수정 | +5줄 |
| `generate-questions-dialog.tsx` | 수정 | +5줄 |
| `question-detail-sheet.tsx` | 수정 | +5줄 |

---

## Task 4: ReadMode 적용 (question-card.tsx)

### 변경 지점

| 라인 | 변경 전 | 변경 후 |
|------|---------|---------|
| 11 (신규) | — | `import { LatexRenderer } from '@/components/ui/latex-renderer'` |
| 160 | `<p className="whitespace-pre-wrap text-sm">{question.questionText}</p>` | `<LatexRenderer text={question.questionText} className="text-sm" />` |
| 166 | `{i + 1}. {option}` | `{i + 1}. <LatexRenderer text={option} />` |
| 177 | `<p className="text-sm">{question.answer}</p>` | `<LatexRenderer text={question.answer} className="text-sm" />` |

### 완료 기준
- [ ] import 추가 + 3곳 교체
- [ ] `npm run build` 성공
- [ ] 브라우저에서 `$x^2$` 수식 렌더링 확인

---

## Task 5: generate-questions-dialog 적용

### 변경 지점

| 라인 | 변경 전 | 변경 후 |
|------|---------|---------|
| ~15 (신규) | — | `import { LatexRenderer } from '@/components/ui/latex-renderer'` |
| 149 | `{question.content}` | `<LatexRenderer text={question.content} className="text-sm" />` |
| 155 | `{option}` | `<LatexRenderer text={option} />` |
| 167 | `{question.answer}` | `<LatexRenderer text={question.answer} className="text-sm" />` |
| 174 | `{question.explanation}` | `<LatexRenderer text={question.explanation} className="text-sm" />` |

### 완료 기준
- [ ] import 추가 + 4곳 교체
- [ ] `npm run build` 성공

---

## Task 6: question-detail-sheet 적용

### 변경 지점

| 라인 | 변경 전 | 변경 후 |
|------|---------|---------|
| ~5 (신규) | — | `import { LatexRenderer } from '@/components/ui/latex-renderer'` |
| 163-165 | `<p ...>{detail.content}</p>` | `<LatexRenderer text={detail.content} className="text-sm font-normal leading-relaxed" />` |
| 172-174 | `{option}` (li 내부) | `<LatexRenderer text={option} />` |
| 183 | `<span ...>{detail.answer}</span>` | `<LatexRenderer text={detail.answer} className="font-semibold text-primary" />` |
| 189-191 | `<p ...>{detail.explanation}</p>` | `<LatexRenderer text={detail.explanation} className="text-sm font-normal leading-relaxed" />` |

### 완료 기준
- [ ] import 추가 + 4곳 교체
- [ ] `npm run build` 성공

---

## Wave 2 완료 기준
- [ ] Task 4, 5, 6 모두 완료
- [ ] `npm run build` 전체 빌드 에러 없음
- [ ] 수동 확인: ReadMode, Dialog, Sheet에서 수식 렌더링
- [ ] Wave 3 진입 가능 (question-card.tsx Task 4 완료)
