# 그래프·도형 이미지 관리 기술 리서치

> **작성일**: 2026-03-19
> **작성자**: tech-researcher (Claude)
> **대상 PLAN**: `docs/plan/20260308-past-exam-extraction.md` (v6) — R9 crop 저장
> **목적**: 기출문제 추출 + AI 문제 생성 두 케이스를 동일 패턴으로 관리하는 최적 방법 선정

---

## 배경 및 컨텍스트

### 현재 상태 (PLAN v6 R9 결정)

PLAN v6에서 이미 R9에 대한 결정이 내려져 있다:

```
결정: B: crop 저장 (sharp + normalized bounding box)
이유: 시각 정보 완전 보존
```

구체적으로는:
1. Gemini Vision API가 bounding box (normalized 0~1 좌표)를 JSON으로 반환
2. **sharp**로 원본 이미지를 crop → Buffer 생성
3. Supabase Storage에 업로드 (`past-exams/{academyId}/figures/`)
4. `FigureInfo.url`에 Storage 경로 저장

### 두 가지 케이스

| 케이스 | 현재 상태 | 이미지 관리 필요 |
|--------|----------|----------------|
| 기출 추출 | PLAN v6 완료, R9 결정됨 | crop된 이미지를 Storage 저장 후 URL 참조 |
| AI 문제 생성 | 향후 (Phase 2+) | AI가 그래프/도형을 **새로 생성**해야 함 |

> **핵심 과제**: "AI가 새 그래프/도형을 생성하는 케이스"를 기출 추출과 같은 아키텍처 패턴(Storage + URL 참조)으로 통합할 수 있는가?

---

## 한국 중·고등 수학 시험 그래프·도형 유형

리서치 기준으로 삼을 실제 출제 유형:

| 분류 | 세부 유형 | 특징 |
|------|---------|------|
| 함수 그래프 | 이차함수, 삼각함수, 지수·로그 | 교점, 꼭짓점, 점근선 표시 |
| 좌표평면 | 수직선, xy평면, 점·직선·곡선 | 좌표 레이블, 격자선 |
| 도형 | 삼각형, 원, 사각형, 다각형 | 각도, 변의 길이, 수직이등분선 |
| 통계 그래프 | 히스토그램, 상자수염, 도수분포표 | 빈도수, 사분위수 레이블 |
| 벡터·행렬 | 벡터 화살표, 행렬 배열 | 방향, 크기 표현 |
| 3D 도형 | 정육면체, 직육면체, 구, 원뿔 | 전개도, 단면 |

---

## 기술 옵션 분석

### 옵션 A: AI bounding box + sharp crop (현재 PLAN v6 방식)

**개요**: Gemini Vision이 이미지 내 그래프/도형 위치를 bounding box로 반환 → `sharp`로 해당 영역 crop → Storage 저장

**라이브러리**:
- `sharp` v0.34.x (2025년 현재 최신)
- 주간 다운로드 약 1,500만 회 (npm 최고 인기 이미지 처리 라이브러리 중 하나)
- libvips 기반 — C++ native module

**장점**:
- ✅ 기출 추출에 완벽히 최적화 — 원본 이미지 정보를 100% 보존
- ✅ 한국 수학 시험 특성 완전 커버 — AI가 어떤 그래프/도형이든 인식 가능
- ✅ 이미 PLAN v6에서 결정된 아키텍처 — 추가 설계 불필요
- ✅ Storage URL 참조 패턴 — 두 케이스 통일 가능 (AI 생성물도 Storage에 저장)
- ✅ 서버사이드 처리 — 클라이언트 부담 없음
- ✅ TypeScript 타입 완비 (`@types/sharp`)
- ✅ Next.js Node.js 런타임과 완전 호환

**단점**:
- ❌ AI 문제 생성 케이스에서는 "crop할 원본이 없음" — 새 이미지를 **생성**해야 하므로 이 방식만으로는 불완전
- ❌ Edge Runtime 불가 (`runtime = 'nodejs'` 필수) — Vercel Edge Function 사용 불가
- ❌ bounding box 정확도에 의존 — AI 오류 시 crop 결과물 품질 저하
- ❌ 이미지 원본 없는 환경(텍스트 전용 API 응답)에서는 사용 불가

**구현 복잡도**: S (이미 PLAN v6에 상세 명세 존재)

**두 케이스 커버**:
- 기출 추출: ✅ 완전
- AI 문제 생성: ❌ 단독으로는 불가 (다른 옵션과 조합 필요)

---

### 옵션 B: AI가 SVG/코드로 직접 생성

**개요**: Gemini/GPT-4o에게 그래프/도형을 SVG XML 또는 Python matplotlib 코드로 생성하도록 지시 → 서버에서 SVG를 PNG로 렌더링(또는 SVG 그대로 저장)

**라이브러리/도구**:
- `sharp` — SVG → PNG 변환 지원 (`sharp(svgBuffer).png().toBuffer()`)
- `@google/genai` — 이미 프로젝트에 설치됨 (v1.40.0)
- Gemini 1.5 Pro/2.0 Flash: SVG 코드 생성 능력 검증됨 (2024-2025)

**장점**:
- ✅ AI 문제 생성 케이스에 자연스럽게 적합 — 텍스트 프롬프트만으로 그래프 생성
- ✅ 기출 추출과 동일한 Storage 저장 패턴 — `FigureInfo.url` 구조 재사용
- ✅ SVG는 벡터 — 어느 해상도에서도 선명함
- ✅ 추가 라이브러리 최소 — sharp가 SVG → PNG 변환 처리
- ✅ 한국 수학 유형 커버 가능 — 좌표계, 함수, 도형 SVG 모두 표현 가능

**단점**:
- ❌ AI SVG 생성 품질 불안정 — Gemini가 수학적으로 정확한 SVG를 일관되게 생성하지 못할 수 있음 (특히 정확한 좌표값이 필요한 함수 그래프)
- ❌ SVG 검증 복잡 — 악의적 SVG(XSS 벡터) 위험 → DOMPurify 또는 SVGO sanitization 필요
- ❌ 복잡한 수학 그래프는 표현 한계 — 미적분 곡선, 극좌표 등
- ❌ AI가 생성하는 SVG는 수식과 분리 — LaTeX 연동 없으면 좌표 레이블이 이미지화됨
- ❌ 기출 추출 케이스에서는 사용 불가 (원본 이미지 crop이 더 정확함)

**구현 복잡도**: M (SVG 검증 + 에러 처리 필요)

**두 케이스 커버**:
- 기출 추출: ❌ (옵션 A로 처리)
- AI 문제 생성: 🟡 조건부 (단순 도형은 OK, 복잡한 함수 그래프는 불안정)

---

### 옵션 C: LaTeX + tikz/pgfplots 수식·그래프 통합 렌더링

**개요**: 문제 텍스트에 LaTeX 수식을 포함하고, 그래프/도형은 TikZ/pgfplots 코드로 생성 → 서버에서 LaTeX → PDF/PNG 렌더링

**라이브러리/도구**:
- `katex` v0.16.x — 클라이언트 수식 렌더링 (React 컴포넌트, SSR 지원)
- `mathjax-full` v3.x — 서버사이드 수식 렌더링 (SVG 출력 가능)
- `latex.js` — 경량 LaTeX → HTML 변환 (TikZ 미지원)
- `node-latex` — Node.js에서 LaTeX 컴파일 → PDF (pdflatex 바이너리 필요)
- `pdflatex` / `xelatex` — 서버에 TeX 배포판 설치 필요 (TexLive ~4GB)

**장점**:
- ✅ 수식 + 그래프 완벽 통합 — KaTeX으로 인라인 수식 렌더링 중 그래프도 TikZ로 처리
- ✅ 수학적 정확도 최고 — pgfplots는 수학 소프트웨어 수준의 그래프 품질
- ✅ 한국 수능/내신 수준 모든 그래프 표현 가능 — tikz는 3D 도형까지 지원
- ✅ KaTeX는 이미 프론트엔드에서 널리 사용됨 (React 플러그인 존재)

**단점**:
- ❌ **Vercel 배포 불가** — pdflatex 바이너리를 Vercel 서버리스에 포함할 수 없음 (함수 패키지 크기 250MB 제한 초과)
- ❌ 서버 인프라 요구사항 극단적으로 높음 — TexLive 설치 서버 별도 운영 필요 (Docker 이미지 ~4GB)
- ❌ Cold start 문제 — Vercel Serverless와 구조적으로 맞지 않음
- ❌ AI → TikZ 코드 생성: Gemini가 TikZ를 정확히 생성하는 능력 검증 부족
- ❌ 이 프로젝트 스택(Next.js + Vercel + Supabase)과 **심각한 불일치**
- ❌ KaTeX은 수식 렌더링에 적합, TikZ 그래프는 별도 컴파일 파이프라인 필요

**구현 복잡도**: L (인프라 구축 포함 시 XL)

**두 케이스 커버**:
- 기출 추출: 🔴 (원본 이미지 crop이 훨씬 간단)
- AI 문제 생성: 🟡 (수학적 완성도는 높으나 배포 환경 불일치)

---

### 옵션 D: Canvas/SVG 클라이언트 렌더링 (Konva.js, Fabric.js, D3.js)

**개요**: 클라이언트(브라우저)에서 Canvas 또는 SVG API를 통해 그래프/도형을 렌더링

**라이브러리**:
- `konva` v9.x + `react-konva` v18.x — Canvas 기반, 애니메이션/이벤트 처리 강함
- `fabric` v6.x — Canvas 기반, 자유로운 편집(이동/회전/크기조정) 특화
- `d3` v7.x — SVG 기반, 데이터 시각화 최강 (히스토그램, 통계 그래프)
- `recharts` v2.x — React용 D3 래퍼, 선언형 통계 차트

**장점**:
- ✅ D3.js: 통계 그래프(히스토그램, 상자수염) 렌더링 최고 품질
- ✅ 클라이언트 렌더링 — 서버 부담 없음, Vercel Edge와 완전 호환
- ✅ 인터랙티브 기능 — 학생이 그래프를 직접 조작하는 UI 구현 가능 (향후 Phase)
- ✅ SSR/SSG 가능 — D3, Recharts는 React 19 서버 컴포넌트 부분 지원
- ✅ 성숙한 생태계 — D3 v7 주간 다운로드 400만+

**단점**:
- ❌ **기출 추출 케이스에서 사용 불가** — 원본 이미지 crop을 대체할 수 없음
- ❌ 저장 문제 — Canvas/SVG를 Storage에 저장하려면 별도 직렬화 로직 필요 (toDataURL → base64 → Storage)
- ❌ AI 문제 생성 연동 복잡 — AI가 "D3 컴포넌트 props"를 JSON으로 생성해야 함 (추가 프롬프트 설계 필요)
- ❌ AI가 구조화된 데이터(좌표, 계수 등)를 정확히 생성해야 함 — 오류 가능성
- ❌ Konva/Fabric은 인터랙티브 편집기 용도이지 "AI 생성 이미지 저장"과는 거리 있음
- ❌ React 19 + Next.js 16과의 호환성 검증 필요 (`react-konva`는 React 18까지만 공식 지원)

**구현 복잡도**: M-L

**두 케이스 커버**:
- 기출 추출: ❌
- AI 문제 생성: 🟡 (D3 한정으로 통계 그래프에 적합, 좌표계·도형은 별도 처리 필요)

---

### 옵션 E: 외부 수학 렌더링 서비스 (Desmos API, GeoGebra)

**개요**: Desmos Graphing Calculator API 또는 GeoGebra API를 iframe/embed로 사용하거나 REST API로 그래프 이미지를 생성

**서비스**:
- **Desmos API**: 그래프 계산기 임베드 + `calculator.screenshot()` 메서드로 PNG 이미지 추출
  - 가격: Education 무료 / Commercial 유료 (별도 계약)
- **GeoGebra API**: 수학 시각화 임베드 (GGB 파일 기반)
  - 가격: 비상업적 무료 / 상업적 라이선스 필요
- **Mathpix API**: 이미지 → LaTeX 변환 (OCR 방향, 반대 케이스)

**장점**:
- ✅ 수학 그래프 표현력 최고 — Desmos는 함수 그래프, 역함수, 극좌표 모두 지원
- ✅ 한국 수학 커리큘럼에 특화된 시각화 가능
- ✅ AI가 수식(LaTeX)만 생성 → Desmos가 렌더링 — 분리 관심사
- ✅ GeoGebra는 3D 도형, 벡터, 행렬 시각화 지원

**단점**:
- ❌ **외부 서비스 의존** — 서비스 장애 시 기능 전체 중단
- ❌ **라이선스 비용** — 상업적 사용 시 유료 계약 필요 (교육 SaaS인 compass에 해당 가능성)
- ❌ iframe 임베드 방식 — 이미지 저장(Storage) 파이프라인과 연동 복잡
- ❌ `Desmos.screenshot()` 비동기 + 클라이언트 전용 — 서버사이드 이미지 생성 불가
- ❌ 기출 추출 케이스에서 완전히 불필요 (원본 이미지 crop으로 충분)
- ❌ 네트워크 지연 — 외부 API 호출로 응답 속도 저하
- ❌ Supabase Storage 통합 복잡 — screenshot → base64 → Storage 업로드 경로 필요

**구현 복잡도**: M (임베드) / L (Storage 통합 포함)

**두 케이스 커버**:
- 기출 추출: ❌
- AI 문제 생성: 🟡 (함수 그래프 한정 우수, 전체 케이스 커버 불가)

---

## 비교 테이블

| 항목 | A: sharp crop | B: AI→SVG 생성 | C: LaTeX+TikZ | D: Canvas/D3 | E: Desmos/GeoGebra |
|------|:---:|:---:|:---:|:---:|:---:|
| **기출 추출 커버** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **AI 문제 생성 커버** | ❌ | 🟡 | 🟡 | 🟡 | 🟡 |
| **Vercel 호환** | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Next.js 16 호환** | ✅ | ✅ | ❌ | 🟡 | 🟡 |
| **한국 수학 커버** | ✅ | 🟡 | ✅ | 🟡 | ✅ |
| **Storage 통합** | ✅ (완성) | ✅ | ❌ (별도 서버) | 🟡 (복잡) | 🟡 (복잡) |
| **구현 복잡도** | S | M | XL | M-L | M-L |
| **외부 의존** | 없음 | Gemini API | TexLive 서버 | 없음 | 유료 서비스 |
| **추가 비용** | 없음 | 없음 | 서버 운영비 | 없음 | 라이선스 비용 |
| **MVP 적합성** | ✅ | ✅ | ❌ | 🟡 | ❌ |

---

## 핵심 인사이트: 두 케이스의 본질적 차이

```
케이스 1 (기출 추출):
  원본 이미지 존재 → crop → Storage 저장
  → 옵션 A (sharp) 가 유일한 정답

케이스 2 (AI 문제 생성):
  원본 이미지 없음 → AI가 "새 그래프" 생성 → Storage 저장
  → 옵션 B (AI→SVG) 가 가장 현실적
```

**두 케이스를 동일 패턴으로 통합하는 방법**:

```
공통 추상화: FigureInfo.url (Storage 경로)
  ├── 케이스 1: sharp로 crop한 PNG → Storage 업로드 → url 저장
  └── 케이스 2: AI가 생성한 SVG → sharp로 PNG 변환 → Storage 업로드 → url 저장
```

즉, **저장 인터페이스(`FigureInfo.url`)는 동일**하고, Storage에 도달하는 **생성 방법만 다름**.

---

## 추천안

### 1순위 추천: **옵션 A (sharp crop) + 옵션 B (AI→SVG) 조합**

**MVP 단계 (현재 PLAN v6)**:
- 옵션 A만 구현 — 기출 추출에 sharp crop 사용 (이미 PLAN v6 결정)
- `FigureInfo` 타입과 Storage 패턴 확립

**Phase 2 이후 (AI 문제 생성)**:
- 옵션 B 추가 — Gemini에게 SVG 코드 생성 지시
- 생성된 SVG를 `sharp`로 PNG 변환 후 Storage 업로드
- 같은 `FigureInfo.url` 인터페이스 재사용

### 이 조합을 선택하는 이유

1. **PLAN v6과의 일관성**: 이미 sharp + Storage 방식이 확정됨. 추가 논의 없이 진행 가능
2. **Vercel 서버리스 완전 호환**: 다른 옵션(C: TexLive, E: 외부 서비스)의 치명적 한계 없음
3. **단일 저장 인터페이스**: `FigureInfo.url`로 두 케이스 통일 — 프론트엔드 컴포넌트 재사용
4. **추가 비용 없음**: sharp는 이미 PLAN에 포함됨. SVG 생성은 기존 Gemini API 활용
5. **한국 수학 커버**: 기출 이미지의 어떤 그래프/도형도 crop 가능. AI 생성도 SVG로 좌표계·함수·도형 표현 가능
6. **점진적 도입**: MVP에서 옵션 A만 구현 → 검증 후 옵션 B 추가

### 2순위 고려: KaTeX (수식 렌더링 별도)

- 그래프/도형 이미지 관리와는 별개로, **수식 텍스트 렌더링**은 KaTeX 도입 가치 있음
- PLAN v6 프롬프트에서 "수식은 LaTeX 형태로 변환"을 이미 지시 → 문제 텍스트에 `$...$` 포함됨
- `katex` React 컴포넌트로 인라인 렌더링 가능 (이미지 없이)
- **단, 이는 이미지 관리와 별개 문제** — 별도 리서치 권장

---

## 주요 리스크

| 리스크 | 영향 | 대응 방안 |
|--------|------|---------|
| AI SVG 생성 품질 불안정 (옵션 B) | High | 생성 후 Zod 검증 + 실패 시 "이미지 없음" 폴백 허용 |
| SVG XSS 취약점 (옵션 B) | High | SVGO sanitize + `DOMPurify` 적용 필수 |
| sharp bounding box 오류 (옵션 A) | Medium | confidence < 0.5 시 crop 스킵 + 원본 이미지 링크 제공 |
| 이미지 저장 비용 (Supabase Storage) | Low | crop 이미지 최적화 (JPEG 품질 85% + 해상도 제한) |
| Phase 2 SVG→Storage 파이프라인 복잡도 | Medium | 옵션 A 아키텍처 확립 후 동일 패턴 확장 |

---

## 구현 시 참고사항 (PLAN v6 보완)

### sharp SVG → PNG 변환 (Phase 2 대비)

```typescript
// AI가 생성한 SVG를 PNG로 변환하는 패턴
// (Phase 2에서 추가 구현 예정 — 현재는 메모용)
import sharp from 'sharp'

async function svgToPng(svgString: string): Promise<Buffer> {
  // sharp는 SVG 입력을 직접 지원함 (libvips SVG 렌더러)
  return sharp(Buffer.from(svgString))
    .png()
    .toBuffer()
}
```

### 현재 PLAN v6 FigureInfo 타입 (변경 불필요)

```typescript
interface FigureInfo {
  readonly url: string             // Storage 경로 — 두 케이스 공통
  readonly description: string     // AI 설명 — 두 케이스 공통
  readonly boundingBox: { ... }    // 기출 추출에서만 의미 있음
  readonly pageNumber: number      // 기출 추출에서만 의미 있음
  readonly confidence: number      // AI 신뢰도 — 두 케이스 공통
}
```

Phase 2 AI 문제 생성 시 `boundingBox`와 `pageNumber`는 기본값(0) 또는 optional로 처리하면 됨. 인터페이스 수정 없이 확장 가능.

---

## 결론

**현재 MVP(PLAN v6)에서는 추가 결정 불필요**. 이미 옵션 A (sharp + bounding box + Storage)로 확정됨.

**향후 Phase 2 AI 문제 생성 시**에는 옵션 B (Gemini → SVG → sharp → Storage)를 추가하되, `FigureInfo.url` 인터페이스를 그대로 재사용하면 두 케이스가 자연스럽게 통합된다.

LaTeX(TikZ), Desmos/GeoGebra, Canvas 라이브러리는 이 프로젝트의 기술 스택(Next.js + Vercel + Supabase)과 맞지 않거나, 기출 추출 케이스를 커버하지 못하므로 채택하지 않는다.
