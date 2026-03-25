# 기술 리뷰: 단계 2-3 역할별 대시보드 [F018]

> 작성일: 2026-03-25
> 리뷰어: technical-reviewer
> 대상: docs/plan/dashboard-by-role.md
> 판정: **READY** (조건부 — MUST FIX 0, SHOULD FIX 2)

---

## 검토 범위

1. DB 스키마 호환성 (컬럼명, 테이블명)
2. RLS 정책과 쿼리 호환성
3. 기존 Server Action 패턴 일관성
4. 엣지 케이스 누락 여부
5. 반환 타입 설계
6. past_exam_details COUNT 접근 방식

---

## 실제 스키마 확인 결과

### past_exams 테이블 (20260315_past_exam_restructure.sql)

| PLAN 표현 | 실제 컬럼명 | 판정 |
|----------|-----------|------|
| `uploaded_by` | **`created_by`** | ⚠️ 불일치 |
| `extraction_status` | `extraction_status` | OK |
| `academy_id` | `academy_id` | OK |
| `created_at` | `created_at` | OK |

**핵심 불일치**: PLAN section 2에서 teacher 대시보드 쿼리에
`past_exams WHERE uploaded_by = userId`라고 명시하였으나,
실제 `past_exams` 테이블의 컬럼명은 **`created_by`**이다.

```sql
-- 실제 DDL (20260315_past_exam_restructure.sql, line 16)
CREATE TABLE past_exams (
  ...
  created_by UUID REFERENCES profiles(id),
  ...
);
```

`past_exam_questions`(deprecated) 테이블에는 `uploaded_by`가 존재하지만,
3계층 구조의 `past_exams`에는 존재하지 않는다.

### questions 테이블 (00001_initial_schema.sql)

| PLAN 표현 | 실제 컬럼명 | 판정 |
|----------|-----------|------|
| `created_by` | `created_by` | OK |
| `academy_id` | `academy_id` | OK |

### profiles 테이블

| PLAN 표현 | 실제 컬럼명 | 판정 |
|----------|-----------|------|
| `academy_id` | `academy_id` | OK |
| `role` | `role` | OK |

### academies 테이블

| PLAN 표현 | 실제 컬럼명 | 판정 |
|----------|-----------|------|
| COUNT 전체 | `academies` 테이블 존재 | OK |

### achievement_standards 테이블

| PLAN 표현 | 실제 컬럼명 | 판정 |
|----------|-----------|------|
| `is_active` | `is_active` | OK |

---

## RLS 정책 분석

### system_admin의 전체 통계 접근

**academies 테이블 RLS**:
```sql
-- 00002_rls_policies.sql, line 48-50
CREATE POLICY "academies_select_own"
  ON academies FOR SELECT
  USING (id = get_user_academy_id());
```

`get_user_academy_id()`는 `profiles.academy_id`를 반환하는데,
`system_admin`은 `academy_id = NULL`이다.
따라서 `academies.id = NULL`은 항상 false → **system_admin은 academies를 조회할 수 없다.**

PLAN D6에서 "system_admin은 RLS 우회 불필요 — 모든 테이블 접근 가능"이라고 명시했으나,
이는 **실제 RLS와 다르다**.

**past_exams, questions, profiles 테이블**의 RLS도 동일 문제:
- `past_exams` SELECT 정책: `academy_id = get_user_academy_id()` → system_admin은 NULL이므로 0건 반환
- `questions` SELECT 정책: `academy_id = get_user_academy_id()` → 동일하게 0건
- `profiles` SELECT 정책: `academy_id = get_user_academy_id() OR id = auth.uid()` → 자신의 프로필만 조회 가능

이는 **기존 구현에서도 동일한 문제**이므로 새로운 버그가 아니다.
그러나 PLAN이 이 현실을 무시하고 "system_admin은 전체 통계 조회 가능"이라고 가정한 점은 수정이 필요하다.

### admin/teacher의 COUNT 쿼리 RLS 필터

- `past_exams` SELECT: `academy_id = get_user_academy_id() AND has_any_role(['teacher','admin','system_admin'])`
  → admin, teacher는 자신의 학원 데이터만 COUNT → PLAN D5 정확
- `questions` SELECT: `academy_id = get_user_academy_id()`
  → 동일하게 학원 필터 자동 적용 → 정확
- `profiles` SELECT: `academy_id = get_user_academy_id() OR id = auth.uid()`
  → admin이 학원 내 사용자 COUNT 가능 → 정확

### teacher의 `uploaded_by` 필터

PLAN에서 teacher가 `past_exams WHERE uploaded_by = userId`로 본인 업로드만 조회하려 했으나:
1. 컬럼명이 `created_by`로 달라 쿼리 실패
2. RLS 자체는 학원 전체를 허용하므로 teacher가 같은 학원 전체 past_exams를 볼 수 있음
3. teacher의 "내 기출문제" = `past_exams WHERE created_by = userId AND academy_id = X`

---

## 이슈 분류

### SHOULD FIX

#### [S-T1] PLAN의 `uploaded_by` → `created_by` 컬럼명 수정 필요

**위치**: PLAN section 2, teacher 대시보드 표, Task 1 설명
**현재**: `past_exams WHERE uploaded_by = userId`
**실제**: `past_exams WHERE created_by = userId`

`past_exam_questions`(deprecated)에는 `uploaded_by`가 있었으나,
3계층 구조의 `past_exams`에는 `created_by`만 존재한다.
구현자가 PLAN 그대로 따르면 런타임 에러 또는 빈 결과가 발생한다.

**수정안**: PLAN의 모든 `uploaded_by` → `created_by`로 변경
(단, 인터페이스 레벨 `uploadedByName` 필드는 UX 표현이므로 별도)

---

#### [S-T2] system_admin 전체 통계: RLS 우회 방안 명시 필요

**위치**: PLAN section 2 system_admin 표, section 3 D6
**현재**: "RLS 우회 불필요 — 모든 테이블 접근 가능"
**실제**: `academies`, `profiles`, `past_exams`, `questions`의 RLS가
`get_user_academy_id()`에 의존하며, system_admin(academy_id=NULL)은 0건 반환

**영향**: system_admin 대시보드의 전체 학원 수, 전체 사용자 수 등이 모두 0으로 표시됨

**수정 옵션**:
- **옵션 A**: `createAdminClient()`(service_role 키) 사용 — RLS bypass, 전체 데이터 접근 가능
  - 이미 `past-exams.ts`에서 `createAdminClient` 임포트하여 사용 중
  - system_admin은 인증 확인 후 adminClient로 집계 쿼리 실행
- **옵션 B**: system_admin 통계를 간소화 — academies 대신 접근 가능한 데이터만 표시
  - YAGNI 원칙에 부합하나 기능 축소

옵션 A가 기존 패턴(extract-questions.ts의 createAdminClient 활용)과 일치하므로 권장.
PLAN에 `system_admin 분기에서 createAdminClient() 사용` 명시 필요.

---

### CONSIDER

#### [C-T1] past_exam_details COUNT: PLAN에 포함되지 않음 — 의도적인가?

**위치**: PLAN section 2 전체
PLAN에서 `past_exam_details` 테이블을 통계 소스로 활용하지 않는다.
기출 업로드 현황은 `past_exams` COUNT로 충분하며, 추출된 문제 수는 별도 필요성이 낮아 보인다.
의도적 YAGNI 판단이라면 적절하다.

#### [C-T2] teacher 대시보드: `extraction_status` GROUP BY는 Supabase JS SDK로 직접 지원 안 됨

**위치**: PLAN section 2 teacher 표, "추출 완료 / 대기" 항목
Supabase JS SDK `.from('past_exams').select('extraction_status', { count: 'exact' }).eq('created_by', userId)` 패턴으로
상태별 COUNT를 한 번에 할 수 없다. 개별 쿼리 2개(completed, pending+failed) 또는 전체 조회 후 클라이언트 집계가 필요하다.
구현 시 고려할 것.

#### [C-T3] page.tsx의 `getCurrentProfile()` 호출 — Task 4 설명

PLAN Task 4에서 "getCurrentProfile()로 role 확인"이라고 명시.
이는 `src/lib/auth/get-current-user.ts`의 `getCurrentProfile`(React cache 적용)로,
`getCurrentUser()`(helpers.ts, Server Action 전용)와 다르다.
page.tsx는 Server Component이므로 `getCurrentProfile()` 사용이 올바르다. 패턴 일치.

---

## 기존 패턴 일관성

| 항목 | 기존 패턴 | PLAN 준수 여부 |
|------|----------|--------------|
| Server Action 인증 | `getCurrentUser()` from helpers.ts | 준수 |
| 에러 반환 | `{ error: string }` 반환 | 준수 |
| page.tsx 사용자 조회 | `getCurrentProfile()` from lib/auth | 준수 |
| 타입: `readonly` 필드 | 모든 인터페이스에 `readonly` | PLAN에 명시 없으나 기존 코드 패턴 따를 것 |
| `'use server'` 선언 | 파일 최상단 | 기존 패턴 — 구현자 준수 필요 |

---

## 엣지 케이스 검토

| 케이스 | PLAN 처리 여부 | 평가 |
|--------|--------------|------|
| 인증 실패 | getCurrentUser() 에러 반환 | 적절 |
| academy_id null (system_admin) | student 역할은 아님, system_admin 분기 별도 | 부분적 (S-T2 참조) |
| 데이터 0건 | RecentActivity에 빈 상태 처리 명시 | 적절 |
| 새 사용자 (첫 로그인) | 0건과 동일 처리 — 빈 상태 UI | 적절 |
| student의 대시보드 | 빈 상태 + 바로가기 | 적절 (exams 미구현 인정) |
| admin이 teacher이기도 한 경우 | 역할 1개만 존재 (DB CHECK) — 분기 충분 | 적절 |

---

## Plan Review Completion Checklist 판정

| 항목 | 충족 여부 |
|------|---------|
| 모든 Task의 파일 소유권이 명확하다 | YES |
| Task 간 의존성 순서가 정의되었다 | YES (Task 1 완료 후 Task 2-4) |
| 외부 의존성(라이브러리, API)이 명시되었다 | YES (shadcn/ui Card, 기존 Server Action 패턴) |
| 에러 처리 방식이 정해졌다 | YES (`{ error }` 반환) |
| 테스트 전략이 있다 | YES (5케이스 + npx vitest) |
| 이전 Phase 회고 교훈이 반영되었다 | YES (IDOR 방지, cache() 활용, system_admin null 처리) |
| 병렬 구현 시 파일 충돌 가능성이 없다 | YES (backend-actions / frontend-ui 분리) |

## 최종 판정: **READY (조건부)**

MUST FIX가 없으며, SHOULD FIX 2건은 구현 전 PLAN 텍스트 수정으로 해결 가능하다.
S-T1(컬럼명 오기)과 S-T2(system_admin RLS 우회 방안)를 PLAN에 반영한 후 구현 진행을 권장한다.
