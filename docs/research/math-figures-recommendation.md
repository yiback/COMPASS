# 수학 도형/그래프 렌더링 — 추천안

> **리서치 기반**: `docs/research/tech/math-figures.md` + `docs/research/feasibility/math-figures.md`
> **작성일**: 2026-03-22

---

## 추천: JSON 스키마 + 커스텀 SVG 렌더러

AI가 구조화된 JSON 데이터를 출력 → 커스텀 렌더러가 SVG로 변환.
**AI가 SVG를 직접 생성하지 않는다** — XSS 안전 + 좌표 정확도 제어 가능.

---

## 비채택 옵션과 이유

| 옵션 | 비채택 이유 |
|------|-----------|
| AI SVG 직접 생성 | XSS 위험 + 좌표 부정확 (arXiv 논문 확인) |
| TikZ→SVG | Vercel에 LaTeX 바이너리(1.5GB) 설치 불가 |
| Mermaid | 수학 도형 커버리지 없음 |
| JSXGraph | AI가 JS 코드 출력 필요 → eval 위험 |
| Desmos/GeoGebra | 상업 라이선스 필요 |
| Puppeteer | Chromium 280MB > Vercel 50MB 한도 |
| Gemini 이미지 생성 | 수학 시험 수준 정밀도 부족 |

---

## 핵심 근거

1. **AI 생성 안정성**: Gemini Structured Output으로 JSON 강제 — 이미 COMPASS가 사용 중인 패턴
2. **XSS 안전**: AI가 SVG/HTML을 직접 쓰지 않음 → DOMPurify 불필요
3. **편집 가능**: JSON 숫자 수정 = 도형 수정 (선생님 편집 UX)
4. **번들 0KB**: 외부 라이브러리 없이 Server Component에서 `<svg>` JSX 생성
5. **함수 그래프 eval 회피**: AI에게 샘플 포인트 배열을 직접 출력시킴 (수식 eval 금지)

---

## 현재 인프라 현황

| 경로                          | 인프라 상태                                                                  |
| --------------------------- | ----------------------------------------------------------------------- |
| 기출 추출 (`past_exam_details`) | `figures JSONB` + `has_figure` 컬럼 이미 존재. description + boundingBox 저장 중 |
| AI 생성 (`questions`)         | 도형 컬럼 **없음**. 프롬프트가 "도형은 텍스트로 대체" 정책                                    |

---

## JSON 스키마 예시 (AI 출력 포맷)

```typescript
type FigureData =
  | { type: 'coordinate_plane'; xRange: [number, number]; yRange: [number, number]; gridStep: number }
  | { type: 'function_graph'; points: [number, number][]; domain: [number, number]; color?: string }
  | { type: 'polygon'; vertices: [number, number][]; labels?: string[] }
  | { type: 'circle'; center: [number, number]; radius: number }
  | { type: 'vector'; from: [number, number]; to: [number, number]; label?: string }
  | { type: 'number_line'; min: number; max: number; points: { value: number; label: string }[] }
```

- AI가 **숫자 좌표만** 출력 → Zod 스키마로 범위 검증
- 함수 그래프: `expression` 문자열 대신 **`points` 배열** (eval 회피)
- 커스텀 렌더러가 좌표 → SVG viewBox 변환 (선형 보간)

---

## 단계적 도입 전략

### Phase 1: 기출 추출 — description 강화 (즉시, S 1-2일)
- DB/프롬프트 변경 없음. 이미 저장된 `description` 텍스트를 더 잘 표시
- `FigurePreview` 컴포넌트 개선 (아이콘 + 설명 텍스트 강조)
- bounding box 오버레이는 **선택적** (이전 정확도 문제 이력 주의)

### Phase 2: AI 생성 도형 — JSON + 커스텀 SVG 렌더러 (M 3-5일)
- `questions` 테이블 마이그레이션: `has_figure BOOLEAN, figures JSONB` 추가
- AI 프롬프트 변경: "도형 텍스트 대체" → JSON 도형 데이터 출력
- `generatedQuestionSchema`에 `figures` 필드 추가 (Zod 검증)
- `FigureRenderer` 컴포넌트 신규 생성 (커스텀 SVG)
- 단계적 도형 지원: 수직선 → 좌표평면+직선 → 기하도형 → 벡터

### Phase 3: 통계 차트 + 고급 기능 (선택, L 1주+)
- 통계 그래프: Recharts lazy load (~130KB)
- 인터랙티브 탐색: Mafs 제한 도입 (필요 시)
- 3D 도형: orthographic projection (고등 수학)
- 선택지 내 도형: `options` 타입 확장 (YAGNI — 현 시점 보류)

---

## 주요 리스크 3가지

1. **AI 좌표 부정확** (HIGH): 삼각형 꼭짓점, 그래프 포인트 오류 가능 → Zod 범위 검증 + 선생님 검수 유지
2. **커스텀 렌더러 개발 비용** (MEDIUM): 교과서 수준 품질(눈금, 화살표, 각도 마크) 구현에 시간 소요 → 단계적 구현
3. **선택지 내 도형 타입 변경** (MEDIUM): `string[]` → `(string | FigureOption)[]` 전환 시 기존 코드 전수 수정 필요 → Phase 3으로 미룸

---

## 총 작업량

| Phase | 작업량 | 의존성 |
|-------|-------|--------|
| Phase 1 | S (1-2일) | 없음 (즉시 가능) |
| Phase 2 | M (3-5일) | DB 마이그레이션 + AI 프롬프트 |
| Phase 3 | L (1주+) | Phase 2 완료 후 |
| **합계** | **L (약 1-2주)** | |
