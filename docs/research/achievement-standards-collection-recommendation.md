# 성취기준 관리 시스템 — 리서치 종합 추천안 v3 (최종)

> 작성일: 2026-03-24
> 리서치 팀: tech-researcher + feasibility-analyst + devil-advocate (v1 → v2 → v3)
> 상태: **사용자 의사결정 대기**

---

## 리서치 히스토리

| 라운드 | 초점 | 결과 |
|--------|------|------|
| v1 | 자동 수집 vs 수동 관리 | 자동 수집 YAGNI → 이연 확정 |
| v2 | CRUD 범위 + 8개 설계 의사결정 | 8개 모두 "적용" 승인 |
| v3 | 사용자 NOTE 3가지 (출처/코드관리/시점관리) | 아래 참조 |

---

## v3 리서치 — 사용자 NOTE 3가지 분석

### 3명의 결론 비교

| NOTE | tech-researcher | feasibility-analyst | devil-advocate |
|------|----------------|-------------------|----------------|
| 1. 출처 | 참조 테이블 sources (FK) | questions.source_metadata 패턴 재사용, S | REJECT — 소비자 0 |
| 2. unit 코드화 | 참조 테이블 curriculum_units (parent_id) | 하이브리드(컬럼 추가) S / 참조 테이블 M | REJECT — 13개 단원에 과도 |
| 3. 시점 관리 | effective_from/until DATE | M (마이그레이션 + 필터) | REJECT — curriculum_version 충분 |

### 리드 절충안

사용자가 명시적으로 요청했으므로 REJECT는 부적절. **최소 비용으로 충족**하는 절충안 채택.

---

### NOTE 1: 출처 → source_name TEXT 추가

| 방식 | 판정 | 근거 |
|------|------|------|
| ~~참조 테이블 sources (FK)~~ | ❌ 과도 | 출처 10개 미만 예상 |
| ~~JSONB~~ | ❌ | 검색 불편 |
| **source_name TEXT** | ✅ 채택 | 최소 비용, 10개 미만이면 TEXT 충분 |

```sql
ALTER TABLE achievement_standards ADD COLUMN source_name TEXT;
-- 예: '교육부', '해법수학', '개념원리'
```

### NOTE 2: unit/sub_unit 코드화 → Autocomplete + 시딩 표준화

| 방식 | 판정 | 근거 |
|------|------|------|
| ~~참조 테이블 curriculum_units~~ | ❌ YAGNI | 13개 단원에 FK/JOIN 과도 |
| ~~unit_code 컬럼 추가~~ | ❌ | AI 프롬프트에 코드 무의미 |
| **기존 TEXT + Autocomplete + 시딩 표준화** | ✅ 채택 | 데이터 품질이 핵심 |

구현:
- 시딩 마이그레이션에서 교육부 공식 단원명 통일
- CRUD UI에서 `SELECT DISTINCT unit` → Combobox 옵션 자동 생성
- 새 단원 자유입력도 허용 (Combobox = Select + 자유입력)

### NOTE 3: 시점 관리 → effective_year INTEGER 추가

| 방식 | 판정 | 근거 |
|------|------|------|
| ~~effective_from/until DATE~~ | ❌ 과도 | 교육과정은 연 단위 변경 |
| ~~불필요~~ | ❌ | 사용자 명시 요청 |
| **effective_year INTEGER** | ✅ 채택 | 최소 비용, "2023년부터 적용" 표현 |

```sql
ALTER TABLE achievement_standards ADD COLUMN effective_year INTEGER;
-- 예: 2023 (2022 교육과정은 2023년 3월부터 적용)
```

`curriculum_version = '2022'` + `effective_year = 2023` → "2022 개정, 2023년부터 적용"

---

## 최종 마이그레이션 컬럼 확정

| 컬럼 | 타입 | 근거 |
|------|------|------|
| `source_url` | TEXT | v2 확정 — 출처 URL |
| `source_name` | TEXT | v3 추가 — 출처 이름 |
| `order_in_semester` | INTEGER | v2 확정 — 진도 순서 |
| `effective_year` | INTEGER | v3 추가 — 적용 시작 연도 |

**총 4개 컬럼 추가. 참조 테이블 0개. unit/sub_unit은 기존 TEXT 유지 + Autocomplete.**

---

## 최종 의사결정 11개 (v2 8개 + v3 3개)

| # | 항목 | 결정 |
|---|------|------|
| 1 | RLS 권한 | system_admin만 CRUD. admin/teacher는 조회만 |
| 2 | 업로드 | 수동 폼만 (MVP). CSV는 Phase 2 |
| 3 | 편집 필드 | content, keywords, unit, sub_unit, source_name, source_url |
| 4 | 삭제 정책 | 삭제 금지 — is_active=false 비활성화만 |
| 5 | 다과목 | UI 다과목 대응, 시딩 수학만 |
| 6 | 패턴 | schools.ts CRUD 100% 재사용 |
| 7 | 진도 순서 | order_in_semester INTEGER |
| 8 | 자동 수집 | Phase 3+ 이연 (확정) |
| 9 | 출처 | source_name TEXT (참조 테이블 불필요) |
| 10 | unit 관리 | 기존 TEXT 유지 + UI Autocomplete + 시딩 표준화 |
| 11 | 시점 관리 | effective_year INTEGER + curriculum_version 유지 |

---

## 작업량 평가

**M (1~1.5주)** — v2와 동일 (참조 테이블 제거로 복잡도 감소)

| 구성 | 작업 |
|------|------|
| 마이그레이션 | 4개 컬럼 추가 + 중등 수학 시딩 (~80개) |
| Zod 스키마 | 필터 + 생성/수정 스키마 |
| Server Action | CRUD (5개 Action) + 단원 Autocomplete |
| UI | DataTable + Dialog + Toolbar (캐스케이딩 필터) |
| RBAC | route-permissions + menu 수정 |
| 테스트 | ~25-30개 |

---

## 주요 리스크

| 등급 | 리스크 | 완화 |
|------|--------|------|
| 🟡 MEDIUM | 교육과정 데이터 정확성 | 교육부 고시 기반 + UPSERT 멱등성 |
| 🟢 LOW | 단원명 불일치 | 시딩 표준화 + UI Autocomplete |
| 🟢 LOW | 다과목 데이터 부재 | 스키마 유연, 데이터만 추가 |

---

## 리서치 파일 목록

| 파일 | 내용 |
|------|------|
| `docs/research/tech/achievement-standards-collection.md` | v1: 자동 수집 기술 비교 |
| `docs/research/feasibility/achievement-standards-collection.md` | v1: 자동 수집 실현가능성 |
| `docs/research/tech/achievement-standards-crud.md` | v2: CRUD UI 기술 비교 |
| `docs/research/feasibility/achievement-standards-crud.md` | v2: CRUD 실현가능성 |
| `docs/research/achievement-standards-collection-recommendation.md` | **종합 추천안 v3 (이 파일)** |

---

## 의사결정 요청

11개 항목 확인 후 PLAN v2 작성으로 진행합니다.
