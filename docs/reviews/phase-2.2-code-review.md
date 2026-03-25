# 단계 2-2 성취기준 DB 구축 — 코드 리뷰 종합

> 리뷰일: 2026-03-25
> 리뷰어: security-reviewer + perf-reviewer + test-reviewer
> 대상: Task 1~5 구현 코드 (11개 신규 + 4개 수정)

---

## 리뷰어별 요약

| 리뷰어 | CRITICAL | HIGH | MEDIUM | LOW |
|--------|----------|------|--------|-----|
| security | 2 | 2 | 3 | 1 |
| perf | 1 | 3 | 3 | 2 |
| test | 1 | 3 | 2 | 1 |

---

## 리드 판단 — CRITICAL/HIGH 이슈 종합 (중복 제거)

### CRITICAL → 수정 필요

| # | 출처 | 이슈 | 리드 판단 |
|---|------|------|----------|
| C1 | security | 메뉴 student 누락 (menu.ts roles) | **의도적 설계.** 학생은 메뉴 미노출, URL 직접 접근만 가능 (의사결정 #5). NOT A BUG. |
| C2 | security | Zod strip() 미명시 | **CONSIDER.** Zod v4는 기본 strip. 명시적 추가는 가독성 개선일 뿐. |
| C3 | perf | getDistinctUnits 중복 호출 | **SHOULD FIX.** useEffect 의존성으로 인한 다중 호출. debounce 또는 조건부 호출 추가. |
| C4 | test | updateAchievementStandard Zod 실패 테스트 누락 | **SHOULD FIX.** 테스트 1개 추가. |

### HIGH → 수정 권장

| # | 출처 | 이슈 | 리드 판단 |
|---|------|------|----------|
| H1 | security | JSON.parse 에러 미처리 (keywords) | **MUST FIX.** try/catch 추가 필요. |
| H2 | security | 글로벌 데이터 의도 주석 없음 | **CONSIDER.** 주석 추가 권장. |
| H3 | perf | 전체 로드 확장성 (~76개 OK, 500개+ 리스크) | **CONSIDER.** 현재 OK. PLAN 범위 외 기록. |
| H4 | perf | getDistinctUnits 중복 제거 비효율 | **CONSIDER.** ~76개에서 성능 문제 없음. |
| H5 | perf | Toolbar 콜백 메모이제이션 없음 | **CONSIDER.** DOM 노드 <20개. |
| H6 | test | isActive='false' 필터 테스트 누락 | **SHOULD FIX.** 테스트 1개 추가. |
| H7 | test | getDistinctUnits DB 에러 테스트 누락 | **SHOULD FIX.** 테스트 1개 추가. |
| H8 | test | keywords JSON 파싱 에러 테스트 누락 | **SHOULD FIX.** H1 수정 후 테스트 추가. |

---

## 수정 계획

### MUST FIX (1건)

**H1: JSON.parse 에러 미처리** — `src/lib/actions/achievement-standards.ts`
```typescript
// 현재: JSON.parse(keywordsRaw) — 에러 시 500
// 수정: try/catch 추가
let keywords = []
if (keywordsRaw) {
  try { keywords = JSON.parse(keywordsRaw) }
  catch { return { error: '키워드 형식이 잘못되었습니다.' } }
}
```

### SHOULD FIX (4건)

1. **C3**: toolbar.tsx getDistinctUnits 중복 호출 방지
2. **C4 + H6 + H7 + H8**: 테스트 4개 추가
   - updateAchievementStandard Zod 실패
   - isActive='false' 필터
   - getDistinctUnits DB 에러
   - keywords JSON 파싱 에러

### CONSIDER (5건 — 구현 중 처리 가능)

- Zod strip() 명시 (보안 가독성)
- 글로벌 데이터 주석
- 전체 로드 확장성 기록
- getDistinctUnits 비효율
- Toolbar useCallback

---

## 최종 판정

**MUST FIX 1건 (JSON.parse) + SHOULD FIX 4건 (테스트 + toolbar)**

수정 후 커밋 진행 가능.

---

## 2차 코드 리뷰 (수정 후)

| 리뷰어 | 판정 | CRITICAL |
|--------|------|----------|
| security-reviewer | **PASS** | 0 — JSON.parse try/catch 양쪽 확인 |
| perf-reviewer | **PASS** | 0 — cancelled 패턴 유효, 규모 내 허용 |
| test-reviewer | **PASS** | 0 — 27개 테스트 전체 통과, mock 구조 정확 |

### 최종 수치
- 신규 파일: 11개
- 수정 파일: 4개
- 테스트: 1431 PASS (신규 41개)
- 빌드: 성공
- CRITICAL: 0건

### 최종 판정: **PASS — 커밋 진행 가능**

---

## 3차 코드 리뷰 (detail-sheet 추가 포함 — 최종)

| 리뷰어 | 판정 | CRITICAL |
|--------|------|----------|
| security | **PASS** | 0 — XSS 안전, rel="noopener noreferrer", JSON.parse try/catch 양쪽 확인 |
| perf | **PASS** | 0 — detail-sheet Server Action 호출 없음, useMemo 유지, 리렌더 안전 |
| test | **PASS** | 0 — 41개 테스트 완전, detail-sheet는 E2E로 충분 (읽기 전용) |

### 최종 수치
- 신규 파일: 12개
- 수정 파일: 4개
- 테스트: 1431 PASS (신규 41개)
- E2E: 콘솔 에러 0건, 필터/검색/Sheet 정상
- CRITICAL: 0건 (3차 만장일치)

### 최종 판정: **PASS — 커밋 진행**
