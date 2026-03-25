# 대시보드 보안 리뷰

**리뷰 대상 파일:**
- `src/lib/actions/dashboard.ts` (신규)
- `src/components/dashboard/admin-dashboard.tsx` (신규)
- `src/components/dashboard/teacher-dashboard.tsx` (신규)
- `src/app/(dashboard)/page.tsx` (수정)

**리뷰 날짜:** 2026-03-25

---

## 요약

전반적으로 보안 구조가 견고하다. Defense in Depth(미들웨어 → Server Action 인증 → RLS)가 올바르게 적용되어 있다. 단, HIGH 이슈 1건과 MEDIUM 이슈 2건이 발견되었다.

---

## MUST FIX

### [HIGH] fetchSystemAdminStats — `await` 누락

**파일:** `src/lib/actions/dashboard.ts` L128

```typescript
// 현재 (버그)
if (role === 'system_admin') {
  return fetchSystemAdminStats()   // await 없음
}
```

`fetchSystemAdminStats()`는 `async` 함수이므로 `await` 없이 반환하면 `Promise<DashboardResult>`가 `DashboardResult`로 처리된다. TypeScript가 `return fetchSystemAdminStats()`의 타입을 `Promise<DashboardResult>`로 추론하고, 이를 `getDashboardStats()`의 반환 타입과 호환 가능하다고 처리하기 때문에 컴파일 에러가 나지 않는다. 그러나 런타임에서 `result.stats`는 `undefined`이고 `result.error`도 `undefined`인 상태가 된다. 결과적으로 `DashboardPage`에서 `result.error || !result.stats` 조건이 true가 되어 ErrorCard를 렌더링한다.

system_admin 대시보드가 항상 에러 화면만 표시됨 — **기능 불능 버그이자 잘못된 에러 경로 노출.**

**수정:**
```typescript
if (role === 'system_admin') {
  return await fetchSystemAdminStats()
}
```

---

## SHOULD FIX

### [MEDIUM-1] student 역할의 questions 테이블 RLS — 학원 격리 확인 필요

**파일:** `supabase/migrations/00002_rls_policies.sql` L201-204

```sql
CREATE POLICY "questions_select_same_academy"
  ON questions FOR SELECT
  USING (academy_id = get_user_academy_id());
```

`questions` SELECT 정책은 `has_any_role()` 체크 없이 `academy_id` 일치만 확인한다. 즉, student 역할도 같은 학원의 `questions` 전체를 SELECT할 수 있다. `page.tsx`의 StudentDashboard는 `/questions` 링크를 노출하므로 접근 의도가 있다고 볼 수 있지만, 이 대시보드 구현 범위와 직접 관련은 없다.

단, `past_exams` SELECT 정책은 명시적으로 `has_any_role(ARRAY['teacher', 'admin', 'system_admin'])`을 요구하므로, student가 `getDashboardStats()`를 직접 호출하면 `{ stats: { role: 'student' } }`를 즉시 반환하고 DB 쿼리를 실행하지 않아 이 경로는 안전하다. 다만 student가 직접 Server Action을 호출하면 통계 카드 대신 student 분기가 반환되어 데이터 누출은 없다.

**권고:** `questions` SELECT 정책에 역할 제한이 없는 것이 의도된 설계인지 확인하고, PRD에서 student의 questions 접근 범위를 명시적으로 문서화할 것.

### [MEDIUM-2] 에러 메시지 정보 노출 가능성

**파일:** `src/app/(dashboard)/page.tsx` L125

```typescript
return <ErrorCard message={result.error ?? '데이터를 불러올 수 없습니다.'} />
```

현재 `getDashboardStats()`가 반환하는 에러 메시지는 `'인증이 필요합니다.'`, `'소속 학원이 없습니다.'`, `'유효하지 않은 역할입니다.'` 등 모두 적절히 추상화되어 있다. 그러나 향후 이 패턴에 Supabase 에러 메시지(DB 스키마 정보 포함 가능)가 직접 전달될 경우 정보 누출 위험이 있다. 현재 코드는 catch 블록에서 고정 문자열 `'대시보드 데이터를 불러올 수 없습니다.'`를 반환하므로 즉각적 위험은 없다.

**권고:** 향후 에러 메시지 추가 시 Supabase 원본 에러를 그대로 클라이언트에 전달하지 않도록 팀 내 규약을 문서화할 것.

---

## CONSIDER (개선 제안)

### [LOW-1] admin 쿼리에서 createAdminClient 미사용 확인 — 올바름

`fetchAdminStats()`는 `createClient()`(anon key + 세션)를 사용하므로 RLS가 그대로 적용된다. admin 역할의 쿼리는 `academy_id = get_user_academy_id()` 조건으로 자동 필터된다. `createAdminClient()`는 `fetchSystemAdminStats()`에서만 사용되며 이것은 의도된 설계이다. **이 부분은 정상.**

### [LOW-2] teacher 쿼리의 `.eq('created_by', userId)` — profile.id 기반 — 올바름

`fetchTeacherStats(profile.id)`에서 `userId`는 `getCurrentUser()`가 `supabase.auth.getUser()`로 검증한 JWT에서 추출한 `user.id`를 `profile.id`로 반환한 값이다. RLS의 `auth.uid()` 기반 필터와 동일하게 동작하므로 IDOR 위험 없음. **이 부분은 정상.**

### [LOW-3] XSS 검토 — 안전

`AdminDashboard`, `TeacherDashboard` 모두:
- 숫자값(`totalUsers`, `count`)은 JSX에서 안전하게 렌더됨
- 문자열값(`exam.subject`, `exam.examType`, `exam.extractionStatus`)은 `dangerouslySetInnerHTML` 없이 `{}`로 렌더됨
- `EXAM_TYPE_LABELS[exam.examType] ?? exam.examType` 패턴에서 fallback으로 DB 원본값을 렌더하지만, React는 이를 텍스트 노드로 처리하므로 HTML 인젝션 불가

**XSS 위험 없음.**

### [LOW-4] `profiles_select_same_academy` RLS — admin 카운트 쿼리 범위

`fetchAdminStats()`의 profiles 쿼리는 RLS에 의해 `academy_id = get_user_academy_id() OR id = auth.uid()` 조건이 적용된다. system_admin이 `createAdminClient()`를 사용하지 않고 `createClient()`를 사용했다면 자기 자신(1명)만 카운트되는 문제가 발생했을 것이다. 그러나 admin 분기는 올바르게 `createClient()`(세션 기반 RLS)를 사용하므로 academy 범위 내 profiles만 카운트된다. **정상.**

---

## 보안 검토 결론

| 항목 | 결과 |
|------|------|
| 인증 체크 (`getCurrentUser`) | 통과 — `auth.getUser()` + `profiles` 조회 + 런타임 role 가드 |
| 역할 분기 안전성 | 통과 — `ROLES.includes()` 런타임 가드, 알 수 없는 역할 방어 코드 존재 |
| `createAdminClient` 사용 범위 | 통과 — `fetchSystemAdminStats()`에서만 호출 |
| RLS 의존 | 통과 — admin/teacher 모두 `createClient()`(세션 기반) 사용 |
| `academy_id` null 처리 | 통과 — `role !== 'system_admin' && !profile.academyId` 방어 |
| XSS | 통과 — `dangerouslySetInnerHTML` 미사용, React 텍스트 노드로 처리 |
| `await` 누락 버그 | **HIGH — MUST FIX** |

**판정: READY (HIGH 이슈 수정 후 배포 가능)**

HIGH 이슈(`await fetchSystemAdminStats()`) 1건만 수정하면 보안상 블로커 없음.
