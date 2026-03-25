# 기술 리뷰: dashboard-tasks-detail.md

> **검토 대상**: `docs/plan/dashboard-tasks-detail.md`
> **검토자**: technical-reviewer
> **검토 일시**: 2026-03-25
> **참조 파일**:
> - `supabase/migrations/00001_initial_schema.sql`
> - `supabase/migrations/00002_rls_policies.sql`
> - `supabase/migrations/20260315_past_exam_restructure.sql`
> - `supabase/migrations/20260324_achievement_standards_v2.sql`
> - `src/lib/supabase/admin.ts`
> - `src/lib/actions/helpers.ts`

---

## 판정: READY (MUST FIX 0건)

MUST FIX 이슈가 없으므로 구현 단계로 진행 가능.
아래 HIGH/MEDIUM/LOW 이슈는 구현 중 처리한다.

---

## 검토 결과

### 1. Supabase count 쿼리 패턴

**판정: 정상**

`select('*', { count: 'exact', head: true })` 패턴은 supabase-js SDK에서 공식 지원된다.
- `head: true` → HTTP HEAD 요청으로 body 없이 `Content-Range` 헤더에서 count를 읽어온다.
- `count: 'exact'` → `SELECT COUNT(*) OVER()` 방식으로 정확한 카운트를 반환한다.
- 결과에서 `res.count`로 접근하는 패턴도 올바르다.

---

### 2. RLS 호환성 — admin 쿼리

**판정: 정상**

`profiles` SELECT RLS 정책 (`profiles_select_same_academy`):
```sql
USING (
  academy_id = get_user_academy_id()
  OR id = auth.uid()
)
```

admin이 `profiles` 카운트를 조회하면, RLS가 `academy_id = get_user_academy_id()`로 필터링하므로 자동으로 **같은 학원 소속 프로필만** 반환한다.
- `totalUsers`, `teacherCount`, `studentCount` 모두 같은 학원 데이터만 집계 → 올바른 멀티테넌시 격리

`past_exams` SELECT RLS 정책 (`past_exams_select_same_academy`):
```sql
USING (
  academy_id = get_user_academy_id()
  AND has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
)
```
admin은 `has_any_role` 통과 → 같은 학원 기출만 집계. 정상.

`questions` SELECT RLS 정책 (`questions_select_same_academy`):
```sql
USING (academy_id = get_user_academy_id())
```
admin은 같은 학원 문제만 집계. 정상.

---

### 3. system_admin + createAdminClient — 보안

**판정: HIGH (구현 시 처리 권장)**

`createAdminClient()`는 `SUPABASE_SERVICE_ROLE_KEY`를 사용하여 **RLS를 완전히 우회**한다.
즉, `system_admin`이 전체 테넌트 통계를 조회하는 용도로는 올바른 설계다.

그러나 한 가지 보안 고려사항이 있다:

현재 PLAN에 `createAdminClient()` 호출 전 role 체크 코드가 명시되어 있지 않다.
`getDashboardStats`가 `system_admin` 분기를 처리하기 전에 **반드시 role 확인을 선행**해야 한다.
`getCurrentUser()`가 role을 반환하므로 구현 시 `if (profile.role !== 'system_admin')` 가드를 먼저 세우고, 그 안에서만 `createAdminClient()`를 호출해야 한다.

PLAN 쿼리 설계 자체에 이 흐름이 암묵적으로 포함되어 있으나, **명시적 코드 스니펫이 없어서 구현자가 놓칠 수 있다**.

> **HIGH**: 구현 시 `createAdminClient()` 호출이 `system_admin` role 분기 내부에만 위치하도록 반드시 확인할 것.

---

### 4. teacher의 created_by 필터

**판정: 정상**

`past_exams` 테이블 스키마 (`20260315_past_exam_restructure.sql`, 16번 줄):
```sql
created_by UUID REFERENCES profiles(id),
```
→ `created_by` 컬럼이 존재한다. teacher 쿼리의 `.eq('created_by', userId)` 필터는 올바르다.

`questions` 테이블 스키마 (`00001_initial_schema.sql`, 155번 줄):
```sql
created_by UUID REFERENCES profiles(id),
```
→ `created_by` 컬럼이 존재한다. teacher의 `myQuestionCount` 쿼리도 정상.

**추가 주의사항 (MEDIUM)**:

teacher의 RLS는 `academy_id = get_user_academy_id()`만 체크한다. 즉, `.eq('created_by', userId)` 없이도 같은 학원 모든 기출이 조회된다. PLAN의 쿼리는 추가로 `created_by` 필터를 붙여서 "내가 올린 기출"만 집계하는 의도인데, 이것이 비즈니스 요구사항과 일치하는지 확인 필요.
- teacher 대시보드가 "내 기출만" 보여주는 게 맞다면 현재 설계 OK.
- "학원 전체 기출" 중 "내 기출 비율"을 보여주는 게 맞다면 추가 컬럼 필요.

---

### 5. Promise.all 에러 처리 — reject 후 폴백 동작

**판정: HIGH (구현 시 처리 필요)**

PLAN의 에러 처리 의도:
```typescript
try {
  // Promise.all 쿼리
} catch {
  return { error: '대시보드 데이터를 불러올 수 없습니다.' }
}
// 개별 count 에러는 0으로 폴백 (res.count ?? 0)
```

**문제**: `Promise.all`은 하나의 Promise가 reject되면 **즉시 catch 블록으로 진입**한다.
supabase-js 쿼리는 네트워크 오류가 아닌 이상 reject가 아닌 `{ data, error }` 형태로 resolve된다. 따라서 Supabase RLS 에러나 DB 에러는 `res.error`로 반환되며, `res.count ?? 0` 폴백이 정상 동작한다.

그러나 `createAdminClient()`가 `SUPABASE_SERVICE_ROLE_KEY` 미설정으로 throw할 경우, 또는 네트워크 에러 시에는 `Promise.all`이 reject → `catch` 블록 진입 → `{ error }` 반환. 이 경우에는 `res.count ?? 0` 폴백은 동작하지 않는다.

이는 의도된 동작이다. **개별 쿼리 에러에서의 폴백(0)**과 **전체 실패에서의 에러 반환**이 구분된다.

> **HIGH**: PLAN의 설명이 오해를 유발할 수 있다. "개별 count 에러는 0으로 폴백"이라는 설명은 Supabase DB 에러(`res.error` 존재, `res.count === null`)에만 해당한다. 구현 시 `res.count ?? 0`가 `res.error` 있을 때도 동작하는 건지 명확히 인지하고 작성할 것.

실제로는 문제없다: `supabase.from(...).select(..., { count: 'exact', head: true })`가 RLS 거부되면 `{ count: null, error: {...} }`로 resolve → `res.count ?? 0 = 0`. 의도대로 동작.

---

### 6. RecentPastExam snake→camelCase 변환 누락

**판정: HIGH (구현 시 반드시 처리)**

`past_exams` 테이블의 실제 컬럼명:
- `exam_type` (snake_case)
- `extraction_status` (snake_case)
- `created_at` (snake_case)

PLAN의 `RecentPastExam` 인터페이스:
```typescript
interface RecentPastExam {
  readonly examType: string       // camelCase
  readonly extractionStatus: string
  readonly createdAt: string
}
```

Supabase JS SDK는 쿼리 결과를 **snake_case 그대로 반환**한다. camelCase로 자동 변환하지 않는다.

따라서 쿼리 결과를 `RecentPastExam[]` 타입으로 사용하려면 **명시적 변환이 필요**하다.

PLAN의 테스트 케이스 10번이 이를 검증하도록 되어 있으나, **구현 코드 스니펫에 변환 코드가 없다**.

구현 시 반드시 아래와 같은 변환을 추가해야 한다:
```typescript
const recentPastExams = (recentRes.data ?? []).map((item) => ({
  id: item.id,
  subject: item.subject,
  grade: item.grade,
  examType: item.exam_type,
  extractionStatus: item.extraction_status,
  createdAt: item.created_at,
}))
```

또는 Supabase TypeScript 타입에서 자동으로 타입 추론을 이용한다면, `Database['public']['Tables']['past_exams']['Row']` 타입은 snake_case이므로 타입 에러가 발생한다.

> **HIGH**: 구현 코드에 snake→camelCase 변환 코드 누락. 반드시 추가 필요.

---

### 7. Task 간 의존성

**판정: 정상**

Task 1 (Server Action + 테스트) → Task 2 (컴포넌트 + page.tsx 교체) 순서:
- Task 2의 `page.tsx`가 `getDashboardStats`를 import한다.
- Task 2의 컴포넌트가 `AdminStats`, `TeacherStats` 타입을 import한다.
- Task 1이 완료되어야 Task 2가 타입 에러 없이 동작한다.

순서가 올바르다. Task 1 → Task 2 직렬 실행 필수.

---

### 8. 추가 발견 이슈

#### 8-1. admin의 profiles count에 system_admin 자신이 포함될 수 있음 (LOW)

admin이 `profiles` 전체 카운트 쿼리를 실행하면, RLS는 `academy_id = get_user_academy_id()`로 필터링한다.
`system_admin`의 `academy_id`는 NULL이므로 이 조건에 걸리지 않는다. 따라서 `system_admin`은 admin의 profiles 카운트에 포함되지 않는다. 정상.

그러나 `admin` 자신은 `academy_id = get_user_academy_id()`를 만족하므로 `totalUsers` 카운트에 포함된다. 이것이 비즈니스 요구사항에 맞는지 확인 권장.

#### 8-2. student가 past_exams를 조회 시도할 경우 (LOW)

`past_exams` RLS:
```sql
USING (
  academy_id = get_user_academy_id()
  AND has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
)
```
student는 `has_any_role` 조건을 만족하지 못해 빈 결과 반환 (에러 아님).
PLAN에서 student는 쿼리를 실행하지 않으므로 해당 없음.

#### 8-3. system_admin의 activeStandardsCount — is_active 컬럼 존재 확인 (LOW)

PLAN:
```typescript
adminClient.from('achievement_standards').select('*', { count: 'exact', head: true })
  .eq('is_active', true),
```

`achievement_standards` 테이블 (`00001_initial_schema.sql`, 137번 줄):
```sql
is_active BOOLEAN DEFAULT true,
```
→ `is_active` 컬럼 존재 확인. 쿼리 정상.

#### 8-4. page.tsx의 system_admin 카드 레이아웃 미완성 (LOW)

Task 2의 `page.tsx` 코드 스니펫에서 system_admin 섹션:
```tsx
{/* 4개 카드: academyCount, totalUsers, totalPastExams, activeStandardsCount */}
```
실제 카드 구현 코드가 없다. 구현자가 채워야 할 TODO 상태. 의도된 것으로 보이나, 구현 누락 위험이 있다.

---

## 이슈 요약

| 등급 | # | 내용 | 구현 시 처리 방법 |
|------|---|------|-----------------|
| HIGH | 1 | `createAdminClient()` 호출이 반드시 `system_admin` 분기 내부에만 위치해야 함 | role 체크 후 분기 내에서만 호출 |
| HIGH | 2 | `Promise.all` 에러 처리 설명 오해 가능 — 실제로는 정상 동작 | 구현자가 `res.error` vs reject 차이 인지 필요 |
| HIGH | 3 | `RecentPastExam` snake→camelCase 변환 코드 누락 | `map()` 변환 코드 반드시 추가 |
| MEDIUM | 4 | teacher의 `created_by` 필터가 비즈니스 요구사항과 일치하는지 확인 필요 | PM/사용자 확인 후 결정 |
| LOW | 5 | admin `totalUsers` 카운트에 admin 자신 포함 여부 | 비즈니스 요구사항 확인 |
| LOW | 6 | system_admin 대시보드 카드 실제 구현 코드 미완성 | 구현자가 AdminDashboard 패턴 참조하여 작성 |

**MUST FIX: 0건 → READY**

HIGH 3건은 구현 단계에서 처리 가능. 특히 이슈 #3(snake→camelCase)은 테스트 케이스 10번이 이미 검증하도록 계획되어 있어 TDD로 자동 발견된다.
