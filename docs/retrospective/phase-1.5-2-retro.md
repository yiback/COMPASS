# 단계 1.5-2 회고 — 도형/그래프 렌더링

> 일자: 2026-03-23
> 범위: 단계 1.5-2 (세션 30, 1 세션 완료)
> 결과: 49 files, 1367 tests, HIGH 0건, E2E 통과

---

## 1. 무엇을 했는가

| Wave | Task | 주요 성과 |
|------|------|----------|
| 사전 | types.ts FigureData 추가 | 6타입 discriminated union, GeneratedQuestion 확장 |
| 1 | Task 1-3 (직렬) | DB 마이그레이션, Zod 스키마, FigureRenderer 기본 |
| 2 | Task 4-6 (병렬 3개) | LatexRenderer 업데이트, SVG유틸+수직선, AI 추출 프롬프트 |
| 3a | Task 7a-7b (직렬) | CoordinatePlane + CoordinatePlaneContent 분리 + FunctionGraph 합성 |
| 3b | Task 8 | Polygon + Circle + Vector SVG 렌더러 |
| 4 | Task 9, 10a, 10b (병렬 3개) | 연속 도형 배치, AI 생성 프롬프트, save-questions 확장 |
| 5 | Task 11 | 테스트 103개 |
| 수정 | HIGH 3건 | SVG 마커 ID 고유화 + validation/extraction 테스트 7개 추가 |

---

## 2. Keep (잘한 것 — 계속할 것)

### K1. PLAN 리뷰 3회 제한이 효과적
- 마스터 PLAN: 2회 (v1→v2)
- 상세 PLAN: 2회 (v1→v2)
- 총 4회 리뷰로 MUST FIX 7건 + SHOULD FIX 12건 해소
- Phase 1의 9회 반복(6세션 소비)과 비교하면 대폭 개선

### K2. Wave 병렬 구현으로 속도 향상
- Wave 2: 3개 Task 병렬 (frontend-ui, frontend-ui-svg, ai-integration)
- Wave 4: 3개 Task 병렬 (frontend-ui, ai-integration, backend-actions)
- 직렬이었다면 6 에이전트 호출 → 병렬로 2 호출로 단축

### K3. 코드 리뷰 2회차 패턴
- 1차에서 HIGH 3건 발견 → 즉시 수정 → 2차에서 해소 확인
- 3명(security/perf/test) 병렬 스폰 → 각자 다른 관점에서 발견

### K4. 리뷰 NOTE 주석으로 의사결정 추적
- 사용자가 리뷰 파일에 `<!-- NOTE: 수용 -->` 직접 표시
- planner가 NOTE를 읽어서 정확히 반영 → 의사결정 누락 없음

### K5. 상세 PLAN의 에이전트 프롬프트 가이드
- "기존 패턴 참조: 파일명:줄" + "금지 사항" 명시
- Phase 1에서 에이전트가 기존 패턴 무시하던 문제 해소

---

## 3. Problem (문제점)

### P1. 상세 PLAN 리뷰에서 코드 스니펫 타입 불일치 발견
- 마스터 PLAN에서 "교차 검증 유틸" 추상화 → 문제 안 보임
- 상세 PLAN에서 `FigureData[] | undefined` vs `FigureInfo[]` 구체화 → 컴파일 에러 발견
- **교훈**: 추상화 수준이 높으면 문제가 숨고, 구체적으로 내려가면 드러남

### P2. SVG 마커 ID 전역 충돌을 구현 중에 못 잡음
- 코드 리뷰(perf-reviewer)에서 발견
- 단위 테스트로는 잡기 어려움 (각 컴포넌트 독립 렌더링이므로)
- **교훈**: SVG `<defs>` id는 HTML 문서 전체에서 고유해야 함 → 컴포넌트별 prefix 필수

### P3. 기존 테스트 실패 2건 방치
- `extract-questions.test.ts`의 기존 실패 2건이 전체 리뷰 내내 언급됨
- 이번 작업과 무관하지만 "기존 실패"라는 말이 반복되면 신뢰도 하락
- **교훈**: 다음 세션에서 기존 실패 원인 조사 필요

### P4. Task 9 선택지 파일 경로를 PLAN에 미명시
- 상세 PLAN에 "선택지 렌더링 컴포넌트 파일을 먼저 확인"으로만 기재
- 에이전트가 파일 탐색에 시간 소비 + 타입 단언(`as unknown as`)으로 우회
- **교훈**: PLAN에 수정 대상 파일 경로를 줄 번호까지 명시해야 함

---

## 4. Try (다음에 시도할 것)

### T1. 상세 PLAN에 "타입 정합성 체크 섹션" 추가
- 각 Task의 import/export 타입 체인을 미리 나열
- "Task A에서 export한 타입 X → Task B에서 import 시 호환 여부" 명시

### T2. SVG 컴포넌트 통합 테스트 추가
- 같은 페이지에 여러 SVG 타입이 동시 렌더링되는 케이스
- 마커 ID 충돌, viewBox 겹침 등 시각적 버그 검증

### T3. 기존 테스트 실패 조사 + 수정
- `extract-questions.test.ts` 실패 2건 원인 분석
- 다음 세션 시작 시 즉시 처리

### T4. Wave 병렬 에이전트에 파일 충돌 가드 추가
- 각 에이전트에 "수정 금지 파일 목록"을 더 구체적으로 명시
- figure-renderer.tsx처럼 여러 Wave에서 수정되는 파일은 Wave 경계를 강제

---

## 5. 기술 교훈 Top 5

1. **CoordinatePlaneContent 합성 패턴**: 독립 `<svg>` 중첩 불가 → `<g>` 반환 내부 컴포넌트로 분리, 부모 `<svg>`에서 재조합
2. **SVG 마커 ID 고유화**: 같은 페이지에 여러 SVG → `<defs>` id가 전역 충돌 → 컴포넌트별 prefix
3. **renderSegment 모듈 레벨 유지**: 컴포넌트 내부 이동 시 매 렌더마다 새 함수 객체 → React.memo 무력화
4. **Duck typing `{ length: number }`**: FigureInfo[]와 FigureData[] 모두 수용하는 시그니처 → 구조적 타입 시스템 활용
5. **`/g` 정규식 lastIndex 리셋**: 모듈 레벨 정규식은 stateful → 함수 진입 시 `pattern.lastIndex = 0` 필수

---

## 6. 수치 요약

| 지표 | 값 |
|------|------|
| 세션 수 | 1 |
| 변경/신규 파일 | 49 |
| 신규 테스트 | 103 + 7 (HIGH 수정) = 110 |
| 전체 테스트 | 1367 PASS |
| PLAN 리뷰 횟수 | 마스터 2 + 상세 2 = 4회 |
| 코드 리뷰 횟수 | 2회 (3명 × 2) |
| MUST FIX 발견 | 마스터 4 + 상세 4 + 코드리뷰 3 = 11건 (전부 해소) |
| E2E 여정 | 7개 (콘솔 에러 0) |
