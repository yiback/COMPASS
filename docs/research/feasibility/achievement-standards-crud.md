# 성취기준 CRUD 관리 시스템 — 실현 가능성 평가

> 작성일: 2026-03-24
> 역할: feasibility-analyst (v2)
> 상태: 완료

---

## 1. 호환성: 🟢 HIGH

- schools.ts CRUD 패턴 100% 재사용 가능
- DataTable + Dialog + Form 기존 컴포넌트 활용
- Zod 스키마, Server Action 패턴 동일

## 2. 스키마 호환성

- achievement_standards 테이블 이미 존재
- subject TEXT (CHECK 없음) → 다과목 확장 자유
- RLS: 인증 사용자 SELECT, system_admin INSERT/UPDATE
- 마이그레이션 비용: S (컬럼 추가만)

## 3. 작업량 재평가: M (1~1.5주)

| 작업 | 파일수 | 난이도 | 일수 |
|------|--------|--------|------|
| Zod 스키마 | 1 | S | 0.5 |
| DB 마이그레이션 | 1 | S | 0.25 |
| Server Actions (CRUD) | 1 | S | 1 |
| page.tsx + 레이아웃 | 1 | S | 0.25 |
| 컬럼 정의 | 1 | S | 0.5 |
| Toolbar 필터 | 1 | S | 0.5 |
| 생성/수정 Form + Dialog | 2 | M | 1.5 |
| 시딩 마이그레이션 | 1 | M | 1 |
| 테스트 | 2 | M | 1.5 |
| **합계** | **11** | | **~7일** |

## 4. 리스크: 🟢 LOW

| 리스크 | 완화 |
|--------|------|
| RLS 정책 추가 | 기존 패턴 따라감 |
| 다과목 필터 성능 | 복합 인덱스 추가 |
| keywords 배열 편집 UI | Badge + Input 커스텀 (중간 복잡도) |

## 5. 최종 판정

**✅ 즉시 구현 가능** — 기존 패턴 반복, 신규 기술 없음
