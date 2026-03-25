# 성취기준 상세 Sheet — 리뷰 종합

> 리뷰일: 2026-03-25
> 리뷰어: technical-reviewer + scope-reviewer
> 대상: `docs/plan/achievement-detail-sheet.md`

---

## 종합 이슈 리스트

| 등급 | 이슈 | 출처 | 리드 판단 |
|------|------|------|----------|
| **MUST FIX** | `AchievementStandard` 타입에 5개 필드 누락 (source_name, source_url, order_in_semester, effective_year, curriculum_version) | tech | 구현 시 columns.tsx 타입 확장 |
| SHOULD FIX | 마스터 PLAN Task 4 산출물에 detail-sheet 미포함 | scope | 구현 후 PLAN 일괄 업데이트 |
| SHOULD FIX | GRADE_LABEL_MAP export 여부 | tech | detail-sheet 내부 로컬 정의 (YAGNI) |
| CONSIDER | table 상태 관리 통합 (3개 독립 state) | tech | 현재 독립 유지 |

## 판정: **[READY] — MUST FIX 1건 구현 시 함께 처리**
