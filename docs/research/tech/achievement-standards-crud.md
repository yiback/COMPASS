# 성취기준 CRUD 관리 시스템 — 기술 리서치

> 작성일: 2026-03-24
> 역할: tech-researcher (v2)
> 상태: 완료

---

## 1. CRUD UI 패턴 비교

| 패턴 | DataTable+Dialog (A) | 트리뷰 (B) | 탭 기반 (C) |
|------|---------------------|-----------|------------|
| 기존 패턴 일관성 | ✅ 최고 | ❌ 신규 | ❌ 신규 |
| 계층 탐색 | ❌ 검색만 | ✅ | △ |
| 모바일 | ✅ | ✅ | ✗ |
| shadcn/ui 호환 | ✅ 기존 컴포넌트 | △ 커스텀 | ✅ Tabs |
| **추천** | **⭐ 채택** | 고려X | 고려X |

**방식 A 채택 근거**: schools/users/past-exams 모두 동일 패턴 → 일관성 최고

## 2. 필터 UI — 캐스케이딩 Select

```
[과목 Select] → [학년 Select] → [학기 Select] → [단원 Combobox] → [검색 Input]
                                                      ↓
                                             DataTable (성취기준 목록)
```

- 과목 변경 시 학년 목록 갱신 (useEffect)
- 기존 toolbar 렌더 prop 패턴 재사용

## 3. 데이터 업로드 방식

| 방식 | 우선순위 | 비용 | 비고 |
|------|---------|------|------|
| 수동 폼 입력 | 🔴 MVP 필수 | S | Dialog 생성/수정 |
| CSV 업로드 | 🟡 Phase 2 | M | papaparse 추천 |
| 엑셀(.xlsx) | ❌ 제외 | H | SheetJS 번들 부담 |

## 4. keywords 관리 — AI 품질 핵심

- keywords[]가 풍부할수록 AI 문제 정확도/다양성 향상
- inline Badge + Input 패턴 (Enter로 추가, X로 삭제)
- 최소 3개 키워드 권장 (Zod `.refine()`)

## 5. 최종 추천

| 항목 | 선택 | 근거 |
|------|------|------|
| UI 패턴 | DataTable + Dialog | 기존 패턴 일관성 |
| 필터 | 캐스케이딩 Select | 5단계 계층 순차 선택 |
| 업로드 | 수동 폼 (MVP), CSV (Phase 2) | 단계적 구현 |
| keywords | inline Badge | AI 프롬프트 품질 핵심 |
| 페이지 경로 | /achievement-standards | 관리 메뉴 |
