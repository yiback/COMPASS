# 단계 2-2 성취기준 DB PLAN v2 — 리뷰 종합

> 리뷰일: 2026-03-24
> 리뷰어: technical-reviewer + scope-reviewer + consistency-reviewer
> 대상: `docs/plan/achievement-standards-db.md` (PLAN v2)

---

## 리뷰어별 판정

| 리뷰어 | 판정 | MUST FIX | SHOULD FIX | CONSIDER |
|--------|------|----------|------------|----------|
| technical-reviewer | SHOULD FIX 후 READY | 1 | 1 | 2 |
| scope-reviewer | BLOCKED (2건) | 2 | 2 | 1 |
| consistency-reviewer | MUST FIX 2건 | 2 | 2 | 1 |

---

## MUST FIX 이슈 종합 (중복 제거)

### MF-1: route-permissions.ts에 라우트 패턴 미등록

**발견**: technical-reviewer + scope-reviewer
**문제**: PLAN에서 page.tsx `requireRole(['admin', 'teacher', 'student'])`를 명시했으나, route-permissions.ts에 패턴 미등록.
**근거**: 세션 31 RBAC 회고 "라우트 패턴 ↔ page.tsx 동기화" 규칙.
**해결**: PLAN Task 4에 route-permissions.ts 추가 내용 명시. 이미 "+1줄" 명시되어 있으므로 **실질적으로는 PLAN에 포함됨**. 구현 시 누락만 주의.
**리드 판단**: PLAN에 이미 명시됨 (`route-permissions.ts +1줄`). **구현 시 주의 사항으로 처리. PLAN 수정 불필요.**

### MF-2: supabase gen types 실행 누락

**발견**: consistency-reviewer
**문제**: Task 1 마이그레이션 후 `supabase gen types` 실행을 명시하지 않음. src/types/supabase.ts 갱신 필요.
**해결**: Task 1 산출물에 "마이그레이션 실행 후 `supabase gen types` 실행" 추가.
**리드 판단**: **PLAN 수정 필요** — Task 1에 타입 생성 단계 추가.

### MF-3: Task 2→3 의존성 Wave 표기 모호

**발견**: scope-reviewer
**문제**: Wave 1에서 Task 1 + Task 2를 "병렬"로 표기. Task 2→Task 3 직렬 의존은 Wave 2에 있지만, 같은 역할(backend-actions)이 병렬 실행하는 것처럼 보임.
**해결**: Wave 표기에 "Task 2 완료 후 Task 3 시작" 명확히.
**리드 판단**: **현재 PLAN이 이미 올바름** — Wave 1은 Task 1+2 병렬, Wave 2는 Task 3 (Task 2 의존). 표기 자체가 정확. 구현 시 Wave 순서 준수만 확인.

### MF-4: 권한 범위 모호 (schools.ts 100% 재사용 vs 차이)

**발견**: consistency-reviewer
**문제**: schools.ts는 admin/teacher CRUD, achievement_standards는 system_admin CRUD → "100% 재사용"이 권한까지 동일한 것인지 모호.
**해결**: PLAN에 이미 Action별 권한 명시 (Task 3 Action 목록). "패턴 100% 재사용"은 코드 구조를 의미, 권한 값은 다름.
**리드 판단**: **PLAN에 이미 명시됨**. 혼동 없음. PLAN 수정 불필요.

---

## SHOULD FIX 이슈 종합

### SF-1: Zod 필터 semester 'all' 처리

**발견**: technical-reviewer
**해결**: Action에서 `if (semester) query.eq('semester', semester)` 패턴 (기존 schools.ts와 동일). 빈값/undefined이면 필터 미적용.
**리드 판단**: 구현 시 처리. PLAN 수정 불필요.

### SF-2: 수정 스키마에 source_url 누락

**발견**: consistency-reviewer
**해결**: 의사결정 #3에 source_url이 편집 필드로 명시됨. Task 2 수정 스키마에 포함해야 함.
**리드 판단**: **PLAN 수정 필요** — Task 2 수정 스키마에 source_url 추가.

### SF-3: Task 4 UI 규모 (Combobox Autocomplete)

**발견**: scope-reviewer
**해결**: shadcn/ui Combobox(Command+Popover)는 공식 패턴. schools.ts와 유사 규모 (~740줄).
**리드 판단**: 구현 시 확인. PLAN 수정 불필요.

### SF-4: 시딩 데이터 출처 문서화

**발견**: scope-reviewer
**해결**: 교육부 고시 제2022-33호 기반. Task 1 SQL 주석에 출처 포함.
**리드 판단**: 구현 시 처리. PLAN 수정 불필요.

---

## CONSIDER 이슈 종합

### C-1: keywords @> 연산자 지원 확인
### C-2: code UNIQUE 에러 메시지 정교화
### C-3: Shared 파일 승인 프로세스

모두 구현 시 선택적 처리.

---

## 리드 최종 판정

### PLAN 수정 필요 항목 (2건만)

1. **MF-2**: Task 1에 "마이그레이션 후 `supabase gen types` 실행" 단계 추가
2. **SF-2**: Task 2 수정 스키마에 `source_url` 추가

나머지 MUST FIX/SHOULD FIX는 **PLAN에 이미 포함**되어 있거나, **구현 시 처리 가능**.

### Plan Review Completion Checklist

- [x] 모든 Task의 파일 소유권이 명확하다
- [x] Task 간 의존성 순서가 정의되었다
- [x] 외부 의존성이 명시되었다
- [x] 에러 처리 방식이 정해졌다
- [x] 테스트 전략이 있다
- [x] 이전 Phase 회고 교훈이 반영되었다
- [x] 병렬 구현 시 파일 충돌 가능성이 없다

### 1차 판정: **[BLOCKED] — 2건 수정 필요** (MF-2, SF-2)

---

## 2차 리뷰 (PLAN v2.1 — MF-2 반영 후)

| 리뷰어 | 판정 | MUST FIX |
|--------|------|----------|
| technical-reviewer | **READY** | 0 |
| scope-reviewer | **READY** | 0 |
| consistency-reviewer | **READY** | 0 |

### 확인 사항
- MF-2 (supabase gen types): Task 1에 명시적 추가 확인 완료
- SF-2 (source_url 수정 스키마): 오탐 — 이미 줄 219에 포함됨
- ROADMAP 목표 4개: 모두 포함
- 리서치 v3 의사결정 11개: 모두 추적 가능
- Plan Review Completion Checklist: 7/7 충족

### 최종 판정: **[READY] 구현 진행 가능 — 3명 만장일치**

---

## 3차 리뷰 — 상세 계획 (Task 1~5) 리뷰

| 리뷰어 | 판정 | MUST FIX | SHOULD FIX |
|--------|------|----------|------------|
| technical-reviewer | **READY** | 0 | 2 |
| scope-reviewer | **READY** | 0 | 3 |
| consistency-reviewer | **READY** | 0 | 1 |

### SHOULD FIX 종합 (구현 시 처리)

1. Task 3: keywords FormData `JSON.stringify/parse` 명시
2. Task 1 완료 후 `supabase gen types` 실행 + 커밋 필수
3. Task 3: getDistinctUnits `.order('grade').order('unit')` 추가
4. Task 4: shadcn command/popover 설치 리드 사전 승인

### 상세 계획 최종 판정: **[READY] 구현 진행 가능 — MUST FIX 0건**
