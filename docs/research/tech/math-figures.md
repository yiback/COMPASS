# 수학 도형/그래프 렌더링 기술 비교

> **작성일**: 2026-03-22
> **작성자**: tech-researcher
> **목적**: Phase 2에서 AI가 도형을 새로 생성하는 방향(SVG → PNG)에 필요한 기술 옵션 선정
> **배경**: Phase 1에서 sharp bounding box crop 방식이 정확도 부족으로 제거됨. 이제 AI가 도형 정보를 생성 → 클라이언트 또는 서버에서 렌더링하는 방향 검토 필요.

---

## 요약

**추천 조합: C12(JSON 도형 스키마 + 커스텀 SVG 렌더러)를 핵심으로, A5(Mafs)를 보조 수단으로 활용한다.** AI가 구조화된 JSON(`{ type: "triangle", vertices: [...] }`)을 출력하고 React Server Component에서 SVG로 변환하는 방식이 AI 생성 안정성, SSR 호환성, 번들 크기, 편집 가능성 모두에서 가장 균형이 잡혀 있다. 통계 차트는 Recharts로 분리 처리하고, 인터랙티브 탐색이 필요한 고급 함수 그래프에만 Mafs를 제한 적용한다.

---

## 한국 수학 시험 도형 유형 분류

| # | 유형 | 세부 예시 | 출현 빈도 |
|---|------|---------|---------|
| 1 | 좌표 평면 + 함수 그래프 | 이차함수, 삼각함수, 지수·로그, 교점·꼭짓점 표시 | 매우 높음 |
| 2 | 기하 도형 | 삼각형, 원, 사각형, 다각형, 내접·외접, 접선 | 높음 |
| 3 | 벡터 | 화살표, 방향, 크기 표시 | 중간 |
| 4 | 통계 그래프 | 정규분포 곡선, 히스토그램, 상자수염 | 중간 |
| 5 | 수직선 | 점 표시, 구간, 범위 | 높음 |
| 6 | 3D 도형 (고등) | 원뿔, 구, 직육면체, 전개도, 단면 | 낮음 |
| 7 | 선택지 내 소형 도형 | 사지선다 각 보기에 서로 다른 작은 도형 | 높음 |

---

## 접근 방식별 비교표

| 옵션 | AI 생성 난이도 | 렌더링 품질 | 번들 크기 | SSR/RSC | React 19 | 커버리지 | 편집 가능 | 저장 포맷 | Vercel 호환 |
|------|-------------|-----------|---------|---------|---------|---------|---------|---------|---------|
| A1 SVG 직접 생성 | 중간-높음 | 높음 | 0 KB | ✅ 완전 | ✅ | 전체 | 어려움 | SVG 문자열 | ✅ |
| A2 TikZ→SVG | 낮음 | 매우 높음 | 서버 의존 | ⚠️ 서버만 | ✅ | 전체 | 어려움 | SVG 문자열 | ❌ 불가 |
| A3 Mermaid/D2 | 낮음 | 낮음 | ~180 KB | ❌ 클라이언트 | ⚠️ | 흐름도만 | 불가 | Mermaid 코드 | ⚠️ |
| A4 Recharts | 낮음 | 중간 | ~130 KB | ⚠️ 클라이언트 | ✅ | 통계만 | 불가 | JSON 데이터 | ✅ |
| A5 Mafs | 중간 | 높음 | ~130 KB | ❌ 클라이언트 | ⚠️ | 함수·기하 | 불가 | JSON 데이터 | ✅ |
| A6 JSXGraph | 낮음 | 높음 | ~200 KB | ❌ 클라이언트 | ⚠️ | 전체 | 인터랙티브 | JS 코드 | ✅ |
| A7 Desmos API | 낮음 | 매우 높음 | CDN 의존 | ❌ iframe | ⚠️ | 함수·기하 | 인터랙티브 | 외부 의존 | ⚠️ |
| A8 GeoGebra API | 낮음 | 매우 높음 | CDN 의존 | ❌ iframe | ⚠️ | 전체 | 인터랙티브 | 외부 의존 | ⚠️ 라이선스 |
| B9 Gemini 이미지 생성 | 매우 낮음 | 중간 | 0 KB | ✅ (서버) | ✅ | 전체 | 불가 | PNG URL | ✅ |
| B10 서버 Canvas | 낮음 | 높음 | 0 KB | ✅ (서버) | ✅ | 전체 | 불가 | PNG URL | ⚠️ native addon |
| B11 Puppeteer | 낮음 | 매우 높음 | 0 KB | ✅ (서버) | ✅ | 전체 | 불가 | PNG URL | ❌ 크기 초과 |
| C12 JSON 스키마 | **낮음** | **높음** | **0 KB** | **✅ 완전** | **✅** | **전체** | **✅** | **JSON** | **✅** |
| C13 react-konva | 낮음 | 높음 | ~180 KB | ❌ ssr:false | ⚠️ | 전체 | ✅ | JSON 데이터 | ✅ |

---

## 각 옵션 상세 분석

### A1. SVG 직접 생성

**개요**: AI(Gemini)가 SVG XML 마크업 전체를 직접 출력. React에서 `dangerouslySetInnerHTML` 또는 파싱 후 JSX로 렌더링.

**AI 생성 특성**
- 2025년 3월 arXiv 논문("From Text to Visuals")에 따르면, 수학 hint 다이어그램 생성 시 LLM이 직접 SVG를 출력하는 방식이 가능하지만 좌표 정밀도 오류(예: 삼각형 꼭짓점 위치 어긋남)가 빈번하게 발생
- 긴 SVG 마크업(200~800 bytes)은 Gemini 출력 토큰 낭비 + 파싱 실패 위험
- 단순 도형(직선, 원, 점)은 품질 양호, 복잡 도형(접선 포함 원, 정확한 각도 삼각형)은 정확도 저하

**장점**
- 클라이언트 번들 추가 없음 (0 KB)
- Server Component에서 `dangerouslySetInnerHTML`로 바로 렌더링 가능
- 저장: SVG 문자열을 DB에 직접 저장

**단점**
- XSS 위험: `dangerouslySetInnerHTML` + AI 생성 SVG → 서버사이드 sanitize 필수 (`DOMPurify` 등)
- AI 오류 시 broken SVG → 렌더링 실패
- 좌표 정밀도 보장 어려움 (수학 시험 수준 정확성 부족)

**결론**: 단순 보조 도형(수직선, 점 표시)에는 적용 가능하나 메인 방식으로 채택 불가.

---

### A2. TikZ/PGFPlots → SVG 변환

**개요**: AI가 TikZ 코드를 출력 → 서버에서 LaTeX → SVG 변환 (mathjax-node, TikZJax, 또는 실제 LaTeX 서버 설치).

**AI 생성 특성**
- TikZ는 수학 도형 표현에 최적화된 언어. Gemini가 TikZ 코드 생성 품질이 높음
- 그러나 실제 LaTeX 컴파일(`pdflatex` + `pdf2svg` 또는 `dvisvgm`)은 서버에 LaTeX 풀 설치 필요

**Vercel 호환성**: 완전 불가
- LaTeX 바이너리(~1.5GB)를 Vercel Function에 설치 불가능
- TikZJax(브라우저 내 WebAssembly)는 번들 크기 ~15 MB → 실사용 불가
- 별도 전용 LaTeX 렌더링 서버(Railway 등) 운영 필요 → 인프라 복잡도 급증

**결론**: Vercel 배포 환경에서 현실적으로 도입 불가. 제외.

---

### A3. Mermaid/D2 다이어그램

**개요**: AI가 Mermaid 문법으로 다이어그램 출력 → 클라이언트에서 `mermaid.js`로 렌더링.

**수학 교육 커버리지**: 매우 제한적
- Mermaid는 flowchart, sequence diagram, gantt chart에 특화. 좌표 평면, 기하 도형, 함수 그래프 지원 없음
- 수학 시험 도형 7가지 유형 중 어느 것도 제대로 표현 불가

**번들**: mermaid.js ~180 KB gzip

**결론**: 수학 시험 도형 용도로 부적합. 제외.

---

### A4. Recharts (React Chart 라이브러리)

**개요**: AI가 데이터 포인트 배열 출력 → React 차트 컴포넌트로 렌더링.

**npm 현황 (2025)**
- 주간 다운로드: ~1,715만 건 (Chart.js ~655만 건보다 많음)
- 번들: ~130 KB gzip (D3 서브모듈 사용으로 최적화)

**AI 생성 특성**
- `{ x: number, y: number }[]` 배열 형태로 AI 출력 → 비교적 안정적
- 함수 그래프: 샘플 포인트 생성 후 `LineChart`로 렌더링 가능
- 기하 도형, 좌표 평면 눈금 커스터마이징이 매우 제한적

**SSR 호환성**: 클라이언트 전용 (`'use client'` 필요)

**수학 교육 커버리지**
- 통계 그래프(히스토그램, 분포 곡선): ✅ 우수
- 함수 그래프(이차, 삼각): 포인트 기반 가능하지만 정밀도 제한
- 기하 도형, 벡터: 불가

**결론**: 통계 차트 전용으로 제한 채택. 다른 유형은 커버 불가.

---

### A5. Mafs (mafs.dev)

**개요**: React 수학 시각화 전용 라이브러리. 좌표 평면, 함수 그래프, 기하 도형(점, 선, 원, 다각형) 특화.

**npm 현황 (2025)**
- 주간 다운로드: ~4,376건 (소규모 니치 라이브러리)
- 최신 버전: 0.21.0
- 마지막 업데이트: 2024년 (약 1년 전) — 유지보수 활동 감소 우려
- 번들: ~445 KB(raw) / 약 130 KB gzip 추정

**AI 생성 특성**
- `<Mafs>`, `<Plot.OfX>`, `<Circle>`, `<Polygon>` 등 선언적 컴포넌트 형태
- AI가 `{ type: "plot", fn: "x => Math.sin(x)" }` 구조화 데이터를 출력하면 렌더링 가능

**SSR 호환성**: 클라이언트 전용 (canvas + D3 의존)
- Next.js App Router에서 `'use client'` 필수
- React 19와 peer dependency 경고 가능

**수학 교육 커버리지**
- 좌표 평면 + 함수 그래프: ✅ 매우 우수
- 기하 도형(삼각형, 원, 다각형): ✅
- 벡터 화살표: ✅
- 통계 그래프: ❌
- 3D 도형: ❌

**편집 가능성**: 인터랙티브(드래그 포인트 등) 지원하나 선생님 편집 UI 별도 구현 필요

**결론**: 함수 그래프·기하 도형에 강점이나 유지보수 활동 둔화 + 클라이언트 전용이 약점. 인터랙티브 탐색 전용으로 제한 사용.

---

### A6. JSXGraph

**개요**: 독일 바이로이트 대학교 개발. 인터랙티브 기하, 함수 플로팅, 데이터 시각화. GeoGebra의 경량 오픈소스 대안.

**npm 현황 (2025)**
- 번들: 약 200 KB (자체 설명에서 "200 KByte 임베드" 언급)
- 꾸준한 유지보수 중 (대학 연구소 지원)
- `jsxgraph-react-js` React 래퍼 존재하나 비공식

**AI 생성 특성**
- JavaScript 코드 형태로 출력(`board.create('point', ...)`) → AI가 코드를 생성해야 함
- 구조화 데이터 기반이 아닌 명령형 코드 → AI 오류 시 실행 에러

**SSR 호환성**: 클라이언트 전용 (DOM 직접 조작)

**수학 교육 커버리지**: 7가지 유형 모두 커버 가능 (함수, 기하, 벡터, 통계, 3D 일부)

**결론**: 커버리지는 넓지만 AI가 JS 코드를 직접 출력해야 하는 구조 → `eval()` 위험 또는 코드 파싱 복잡도 높음. 채택 부적합.

---

### A7. Desmos API

**개요**: Desmos의 그래프 계산기를 iframe 또는 API로 임베드.

**라이선스 및 상업 이용**
- 상업적 이용 시 별도 API Key 발급 필요 → `partnerships@desmos.com` 문의
- 무료 데모 Key만 공개 → COMPASS 상업 서비스에 직접 적용 불가

**SSR 호환성**: iframe 임베드 → SSR 의미 없음. CDN 로드 의존.

**AI 생성 특성**: Desmos 수식 문법(`y=sin(x)`)은 단순 → AI 생성 난이도 낮음

**결론**: 상업 라이선스 불확실 + 외부 서비스 의존 → 채택 불가.

---

### A8. GeoGebra API

**개요**: GeoGebra 앱렛을 웹에 임베드. 수학 교육용 최고 수준의 커버리지.

**라이선스 (2025년 11월 업데이트)**
- 비상업적 이용: 자유 사용
- **상업적 목적 이용: 별도 라이선스 계약 필수** (`office@geogebra.org`)
- "use"가 아닌 "user" 기준이 아니라 "사용 목적" 기준 → B2B 학원 플랫폼 = 상업적 목적

**SSR 호환성**: CDN 로드 + iframe → SSR 없음

**결론**: 상업 라이선스 필요 + 외부 CDN 의존 → COMPASS MVP 단계 채택 불가.

---

### B9. Gemini 이미지 생성 (Gemini Imagen / Flash 이미지 출력)

**개요**: Gemini에게 "이 도형을 PNG 이미지로 생성해줘"라고 직접 요청.

**현황 (2025~2026)**
- Gemini 2.0 Flash: 네이티브 이미지 출력 기능 추가 (2024년 말)
- 수학 geometry 벤치마크: 45.0% (1위)
- 그러나 정확한 좌표(눈금, 레이블 위치)가 필요한 수학 시험 도형 품질은 충분하지 않음
- arXiv 논문(2025.03): "DALL-E 3 등 직접 이미지 생성 모델은 hint diagram 생성에 부적합한 품질" 확인

**장점**
- 프롬프트 최단 경로: 별도 렌더링 인프라 불필요
- 서버에서 URL로 받아 Storage 저장 → 기존 아키텍처 그대로 활용

**단점**
- 수학 시험 수준의 정밀도(좌표 눈금, 정확한 각도) 확보 어려움
- 생성 이미지가 틀릴 경우 검증 방법 없음
- 비용: 이미지 생성 = 텍스트 생성보다 훨씬 비싼 API 호출
- Vercel Gemini 호출 타임아웃 주의 (이미지 생성은 느림)

**결론**: 1차 생성 + 사람 검수 구조에서만 사용 가능. 자동화 파이프라인 주 방식으로 불가.

---

### B10. 서버사이드 Canvas (node-canvas / sharp)

**개요**: AI가 구조화 데이터 출력 → 서버에서 `node-canvas`(Cairo 기반)로 PNG 렌더링.

**Vercel 호환성**: 제한적
- `node-canvas`는 네이티브 addon (`canvas` C++ 바인딩) → Vercel Lambda 환경에서 불안정
- `sharp`는 이미 `package.json`에 있으나 도형 그리기 API는 없음 (이미지 처리 전용)

**결론**: 네이티브 addon 의존 + Vercel 호환성 불안 → 채택 부적합.

---

### B11. Puppeteer/Playwright 서버 렌더링

**개요**: HTML+SVG를 headless 브라우저에서 스크린샷 → PNG 생성.

**Vercel 호환성**: 사실상 불가
- Chromium 바이너리 ~280 MB → Vercel Function 크기 한도(50 MB) 초과
- `@sparticuz/chromium` 경량 버전 존재하나 불안정
- 콜드 스타트 수초 → 시험 문제 생성 UX에 치명적

**결론**: Vercel 크기 제한으로 사용 불가. 제외.

---

### C12. JSON 도형 스키마 + 커스텀 SVG 렌더러 ⭐ 추천

**개요**: AI가 구조화된 JSON 도형 데이터를 출력. 서버 또는 클라이언트에서 커스텀 렌더러가 SVG를 생성.

**스키마 예시**
```typescript
// AI가 출력하는 JSON 구조 (Zod 스키마로 검증)
type Figure =
  | { type: 'coordinate_plane'; xRange: [number, number]; yRange: [number, number]; gridStep: number }
  | { type: 'function_graph'; expression: string; domain: [number, number]; color?: string }
  | { type: 'polygon'; vertices: [number, number][]; labels?: string[] }
  | { type: 'circle'; center: [number, number]; radius: number }
  | { type: 'vector'; from: [number, number]; to: [number, number]; label?: string }
  | { type: 'number_line'; min: number; max: number; points: { value: number; label: string }[] }
```

**AI 생성 특성**
- Gemini의 Structured Output(JSON Schema 강제) 기능 활용 → 파싱 실패 없음
- 이미 COMPASS에서 `zod-to-json-schema` + `@google/genai` Structured Output을 사용 중 → 동일 패턴 적용
- 숫자 좌표만 생성하면 되므로 AI 오류 위험 최소화

**렌더러 구현**
- React Server Component에서 `<svg>` + JSX로 직접 생성 → 클라이언트 번들 0 KB
- 좌표 → SVG viewBox 변환 수학은 단순 (선형 보간)
- 커스텀 구현이므로 한국 교과서 스타일(눈금, 레이블 폰트, 화살표 방향) 완전 제어 가능

**편집 가능성**
- JSON 데이터 → DB 저장 → 선생님이 숫자 값 수정 가능 (UI 필드 형태)
- SVG 직접 편집보다 훨씬 안전하고 쉬운 편집 UX

**저장 포맷**: JSON → `figures` 컬럼에 `jsonb` 타입으로 저장

**장점**
- 번들 크기 추가 없음 (외부 라이브러리 불필요)
- SSR/RSC 완전 호환
- 수학 시험 7가지 유형 모두 커버 가능 (렌더러 확장으로)
- XSS 안전 (AI 생성 SVG 직접 주입 없음)
- Vercel 배포 제약 없음

**단점**
- 렌더러 직접 개발 필요 (~200-400줄 예상)
- 3D 도형 렌더러 구현 난이도 높음 (orthographic projection 필요)
- 함수 표현식(예: `"x => x*x"`) 실행 시 `eval()` 위험 → 수식 파서 필요 (`math.js` 또는 샘플 포인트 생성 방식)

**함수 표현식 처리 전략 (eval 회피)**
```typescript
// 서버에서 AI가 샘플 포인트를 직접 생성
type FunctionGraph = {
  type: 'function_graph'
  points: [number, number][]  // AI가 미리 계산
  domain: [number, number]
}
```
AI에게 함수 자체가 아닌 샘플 포인트 배열을 출력하게 하면 eval 불필요.

**결론**: Phase 2의 핵심 방식으로 채택. 단계적 구현(수직선 → 기하 도형 → 함수 그래프 → 통계) 권장.

---

### C13. react-konva (Canvas API)

**개요**: React + Canvas 2D 렌더링. `react-konva` 라이브러리.

**SSR 호환성**: 클라이언트 전용
- `dynamic(() => import(...), { ssr: false })` 필수
- Next.js App Router에서 "Canvas not found" prerender 에러 발생 알려진 이슈

**번들**: ~180 KB gzip

**AI 생성 특성**: JSON 좌표 데이터 → Konva Layer/Shape 매핑

**편집 가능성**: 드래그 앤 드롭 편집 가능 (react-konva 강점)

**결론**: SSR 불가 + 번들 크기 부담. C12 JSON 스키마 + SVG 렌더러가 더 나은 선택.

---

## 추천 및 근거

### 1순위: C12 JSON 스키마 + 커스텀 SVG 렌더러 (핵심)

**이유**:
1. **AI 생성 안정성 최고**: Gemini Structured Output으로 JSON 스키마 강제 → 파싱 실패 없음. 이미 COMPASS가 사용 중인 패턴.
2. **번들 크기 0 KB**: 외부 라이브러리 불필요, Server Component 렌더링.
3. **SSR/RSC 완전 호환**: Next.js 16 App Router에서 문제 없음.
4. **편집 가능**: JSON 수정 = 도형 수정. 선생님 편집 UX 구현 용이.
5. **Vercel 배포 제약 없음**: 서버사이드 바이너리/CDN 외존 없음.
6. **XSS 안전**: AI 생성 SVG 직접 주입 없음.
7. **한국 교과서 스타일 완전 제어**: 글꼴, 눈금 간격, 화살표 등 커스터마이징 자유.

**구현 단계별 우선순위**:
- Phase 2a: 수직선, 점 표시 (가장 단순)
- Phase 2b: 좌표 평면 + 직선/포물선 (함수 샘플 포인트 방식)
- Phase 2c: 기하 도형 (삼각형, 원, 다각형)
- Phase 2d: 벡터, 통계 그래프
- Phase 2e: 3D 도형 (선택적)

### 2순위: A4 Recharts (통계 전용 보조)

**이유**: 히스토그램, 정규분포 그래프 등 통계 차트는 Recharts가 JSON 데이터 → 차트 변환을 이미 완성도 높게 제공. 커스텀 SVG 렌더러로 구현할 필요 없음. 번들 크기(~130 KB)는 통계 문제가 있는 페이지에서만 lazy load로 완화.

### 3순위: A5 Mafs (인터랙티브 탐색용, 선택적)

**이유**: 선생님/학생이 함수 그래프를 드래그하며 탐색하는 인터랙티브 기능이 필요할 경우. 단, 유지보수 활동 감소(마지막 업데이트 1년 전)에 주의. Phase 2c 이후 필요성 평가 후 결정.

---

## 주요 리스크

### R1. AI 생성 좌표 정확도 [높음]
- JSON 스키마 방식이어도 AI가 삼각형 꼭짓점을 잘못 계산하거나 비현실적 좌표를 출력할 수 있음
- **완화**: Zod 스키마로 범위 검증 + UI에서 선생님 검수 단계 유지

### R2. 함수 표현식 실행 안전성 [높음]
- `eval("x*Math.sin(x)")` 형태의 서버사이드 실행 → RCE(원격 코드 실행) 위험
- **완화**: AI에게 샘플 포인트 배열을 직접 출력하도록 프롬프트 설계. eval 절대 금지.

### R3. 커스텀 렌더러 개발 비용 [중간]
- 교과서 수준 품질(화살표, 호, 각도 마크 등)을 SVG로 구현하는 데 시간 소요
- **완화**: 단계적 구현 전략. Phase 2a부터 시작해 필요한 유형만 순서대로 추가.

### R4. Mafs 유지보수 둔화 [중간]
- 마지막 npm 릴리즈 약 1년 전. React 19 peer dependency 경고 가능성.
- **완화**: 핵심 방식 채택 금지. 인터랙티브 전용으로 제한 + 필요시 fork 가능성 열어둠.

### R5. 3D 도형 렌더링 [낮음-중간]
- 2D SVG로 3D 도형(원뿔 단면 등)을 표현하려면 orthographic projection 구현 필요
- **완화**: Phase 2e로 미루고, MVP에서는 3D 도형 텍스트 설명으로 대체.

---

## 참고 자료

- [From Text to Visuals: Using LLMs to Generate Math Diagrams with Vector Graphics (arXiv 2503.07429)](https://arxiv.org/abs/2503.07429)
- [Mafs: React components for interactive math](https://mafs.dev/)
- [Mafs - npm](https://www.npmjs.com/package/mafs)
- [JSXGraph](https://jsxgraph.org/home/)
- [Desmos API Terms of Service](https://www.desmos.com/api-terms)
- [GeoGebra License](https://www.geogebra.org/license)
- [Recharts npm](https://www.npmjs.com/package/recharts)
- [Puppeteer on Vercel — Vercel Knowledge Base](https://vercel.com/kb/guide/deploying-puppeteer-with-nextjs-on-vercel)
- [LLM SVG Generation Benchmark (Simon Willison, 2025)](https://simonwillison.net/2025/Nov/25/llm-svg-generation-benchmark/)
- [How to Create SVGs with Google Gemini (2026)](https://www.svggenie.com/blog/create-svg-with-google-gemini-ai)
