# auth-helper 통합 리팩토링 보안 리뷰

**리뷰어**: security-reviewer
**검토 일자**: 2026-03-25
**대상**: `src/lib/actions/helpers.ts` 신규 + 10개 파일 통합 리팩토링

---

## 요약 판정

**전반적으로 안전하다.** 통합 패턴은 기존 MEMORY.md 교훈(Defense in Depth 3중 방어, IDOR academy_id 필터)을 잘 따르고 있다. 다만 아래 3개 이슈는 수정 필요.

---

## 이슈 목록

### MUST FIX (CRITICAL)

없음.

---

### MUST FIX (HIGH)

#### H-1: `users.ts` — getUserList에 academy_id 명시 필터 누락

**파일**: `src/lib/actions/users.ts`, 99~111번 줄

**근거**: `getUserList` 쿼리가 `profiles` 테이블을 조회할 때 `.eq('academy_id', profile.academyId)` 필터가 없다.

```typescript
// 현재 코드
let query = supabase
  .from('profiles')
  .select('id, email, name, role, is_active, ...', { count: 'exact' })
  .order('created_at', { ascending: false })
  .range(from, to)
// academy_id 필터 없음!
```

**왜 문제인가**: RLS `profiles_select_same_academy` 정책이 `academy_id = get_user_academy_id() OR id = auth.uid()`로 설정되어 있어, 현재는 RLS가 방어한다. 그러나 코드만 보면 의도가 불명확하고, **system_admin 계정으로 호출 시 RLS의 `get_user_academy_id()`가 NULL을 반환** → `NULL = NULL`은 PostgreSQL에서 FALSE → RLS 정책이 아무 행도 반환하지 않는다. 이는 기능 버그이면서 동시에 암묵적 보안 의존이다.

같은 파일의 `changeUserRole`(185번 줄)과 `toggleUserActive`(309번 줄) UPDATE 쿼리도 `.eq('academy_id', ...)` 없이 `.eq('id', userId)`만 사용. RLS `profiles_update_admin` 정책이 `academy_id = get_user_academy_id()`를 체크하므로 타 학원 UPDATE는 차단되지만, **Defense in Depth 원칙** 위반 — 코드 레벨 방어 누락.

**권고**: `getUserList`에 `.eq('academy_id', profile.academyId)` 추가 (system_admin 예외 처리 포함). `changeUserRole`, `toggleUserActive` UPDATE 쿼리에도 `.eq('academy_id', caller.academyId)` 추가.

---

#### H-2: `schools.ts` — `getSchoolList`, `getSchoolById`에 인증 체크 누락

**파일**: `src/lib/actions/schools.ts`, 81~146번 줄

**근거**:

```typescript
// getSchoolList — 인증 확인 없음
export async function getSchoolList(filters?) {
  const parsed = schoolFilterSchema.safeParse(filters ?? {})
  // getCurrentUser() 호출 없음
  const supabase = await createClient()
  let query = supabase.from('schools').select('*', ...)
  ...
}

// getSchoolById — 인증 확인 없음
export async function getSchoolById(id: string) {
  if (!id) { return { error: '...' } }
  const supabase = await createClient()
  const { data } = await supabase.from('schools').select('*').eq('id', id)...
}
```

**왜 문제인가**: RLS `schools_select_authenticated`는 `auth.uid() IS NOT NULL`을 체크하므로 미인증 클라이언트가 직접 Supabase를 호출하면 차단된다. 그러나 **Server Action 레벨에서 인증을 확인하지 않으면**, 만료된 세션 쿠키를 가진 사용자나 쿠키 위조 시도 시 서버 측 인증 검증을 우회할 수 있다. `createPastExamAction`을 포함한 모든 쓰기 Actions는 인증 체크를 하는데, 같은 파일의 읽기 Actions는 누락되어 **일관성 없는 보안 경계**가 형성된다.

**권고**: `getSchoolList`와 `getSchoolById` 상단에 `getCurrentUser()` 호출 추가.

---

### SHOULD FIX (MEDIUM)

#### M-1: `exam-management.ts` — `confirmExtractedQuestionsAction`의 academy_id 교차검증 누락

**파일**: `src/lib/actions/exam-management.ts`, 317~359번 줄

**근거**:

```typescript
// past_exams 조회 시 academy_id 필터 없음
const { data: exam } = await supabase
  .from('past_exams')
  .select('id, extraction_status')
  .eq('id', pastExamId)  // academy_id 필터 없음
  .single()
```

그 후 `past_exam_details`의 `UPDATE`도 `pastExamId`만으로 필터링한다.

RLS가 `past_exams_select_same_academy`로 보호하므로 실제 타 학원 시험 접근은 차단된다. 그러나 동일 파일의 `extractQuestionsAction`(extract-questions.ts 122번 줄)은 `.eq('academy_id', profile.academyId)`를 명시적으로 추가하여 **일관성이 없다**.

**권고**: `confirmExtractedQuestionsAction`의 `past_exams` 조회에 `.eq('academy_id', profile.academyId)` 추가.

---

#### M-2: `exam-management.ts` — `updateExtractedQuestionAction` 및 `deleteExtractedQuestionAction`의 academy_id 명시 필터 누락

**파일**: `src/lib/actions/exam-management.ts`, 246~312번 줄

**근거**:

```typescript
// updateExtractedQuestionAction — detail 조회 시 academy_id 없음
const { data: detail } = await supabase
  .from('past_exam_details')
  .select('id')
  .eq('id', detailId)  // academy_id 없음

// UPDATE도 academy_id 없음
await supabase
  .from('past_exam_details')
  .update({...})
  .eq('id', detailId)  // academy_id 없음
```

`deleteExtractedQuestionAction`도 동일. RLS가 보호하지만 코드 레벨 명시 방어가 없어 **Defense in Depth** 원칙에 반한다.

**권고**: `past_exam_details` 조회/수정/삭제 쿼리에 `.eq('academy_id', profile.academyId)` 추가.

---

#### M-3: `generate-questions.ts` — pastExamId 기출문제 조회 시 academy_id 필터 누락

**파일**: `src/lib/actions/generate-questions.ts`, 46~68번 줄

**근거**:

```typescript
const { data: pastExam } = await supabase
  .from('past_exams')
  .select('id, subject, grade, year, ...')
  .eq('id', pastExamId)  // academy_id 필터 없음
  .single()
```

`save-questions.ts`의 `saveGeneratedQuestions`도 동일 패턴(125번 줄). RLS `past_exams_select_same_academy`가 보호하나 코드 레벨 방어 미비.

**권고**: `.eq('academy_id', profile.academyId)` 추가.

---

### CONSIDER (LOW)

#### L-1: `helpers.ts` — `academyId null` 허용이 system_admin 전용임을 타입으로 강제하지 않음

**파일**: `src/lib/actions/helpers.ts`, 19번 줄

**근거**:

```typescript
readonly academyId: string | null // system_admin은 null — 에러가 아님
```

`academyId`가 null인 경우 system_admin임을 보장하는 코드가 없다. 만약 DB에 `academy_id IS NULL`인 비-system_admin 프로필이 존재하면(잘못된 시드 데이터, 마이그레이션 오류 등), `academyId`를 체크하지 않고 통과할 수 있다.

**현재 완화책**: DB CHECK 제약조건 `role = 'system_admin' OR academy_id IS NOT NULL` (MEMORY.md에 기록됨)이 이를 방어한다.

**권고(선택)**: 런타임 명시성을 높이려면 `getCurrentUser`에서 `if (!profile.academy_id && profile.role !== 'system_admin') return { error: '프로필 데이터 오류' }` 추가 가능. 단, DB 제약이 이미 보호하므로 필수는 아님.

---

#### L-2: `users.ts` — teacher가 getUserList 호출 시 system_admin까지 조회 가능

**파일**: `src/lib/actions/users.ts`, 91~93번 줄

**근거**: 역할 체크 로직이 student만 차단한다. `teacher`가 같은 학원의 `admin` 정보를 볼 수 있는 것은 현재 설계 기준 허용된 것으로 보인다. 그러나 teacher가 `role=admin` 필터로 관리자 목록을 조회할 수 있다는 점은 정보 노출 관점에서 재검토 여지가 있다.

**권고**: 비즈니스 요구사항 확인 후, 필요 시 teacher는 student/teacher만 조회 가능하도록 제한.

---

#### L-3: `extract-questions.ts` — buildImageParts에 인증 없음

**파일**: `src/lib/actions/extract-questions.ts`, 53~77번 줄

**근거**: `buildImageParts`는 내부 헬퍼 함수로 외부에 export되지 않으므로 직접 호출 불가. 호출부(`extractQuestionsAction`, `reanalyzeQuestionAction`)에서 이미 인증을 처리한다. 현재 구조는 안전하나, 향후 이 함수가 별도 파일로 분리되면 인증 체크가 없음을 인지해야 한다.

**권고**: 함수 주석에 "호출부에서 인증 완료 후 호출할 것" 명시.

---

## 전체 평가

| 항목 | 상태 | 비고 |
|------|------|------|
| `helpers.ts` 인증 로직 | 안전 | `auth.getUser()` + 런타임 role 가드 |
| `academy_id` IDOR 방어 | 대부분 안전 | users.ts, exam-management.ts 일부 미흡 |
| system_admin null 처리 | 안전 | DB CHECK + 코드 분기 일치 |
| `schools.ts` 글로벌 데이터 | 부분 취약 | 읽기 Actions에 인증 없음 (H-2) |
| `achievement-standards.ts` | 안전 | 조회=인증만, CUD=system_admin 정확 |
| RLS 3중 방어 | 유지됨 | DB RLS 최후 방어선 정상 |

**MUST FIX 이슈**: 2개 (H-1, H-2)
**SHOULD FIX 이슈**: 3개 (M-1, M-2, M-3)
**CONSIDER 이슈**: 3개 (L-1, L-2, L-3)
