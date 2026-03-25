# technical-reviewer: auth-helper-consolidation.md v2 기술 검토 (2차)

> 검토일: 2026-03-25
> 검토 대상: `docs/plan/auth-helper-consolidation.md` (v2)
> 검토자: technical-reviewer
> 1차 리뷰: `docs/reviews/auth-helper-tech-review.md`

---

## 요약 판정

**READY** — MUST FIX 0건. SHOULD FIX 1건은 구현 중 처리 권장.

---

## 1차 이슈 해소 여부 판정

| 이슈 | 1차 등급 | 해소 여부 | 근거 |
|------|---------|----------|------|
| M1: generate-questions.ts / save-questions.ts / exam-management.ts 누락 | HIGH | **해소** | v2 섹션 1 변형 목록 #4~7에 전체 10개 파일 반영. Task 5~8로 명시 |
| M2: achievement-standards.ts 헬퍼 2개 | MEDIUM | **해소** | Task 10에 `checkAuthenticated()` + `checkSystemAdminRole()` 둘 다 제거 명시. 패턴 A/C 구분도 명시 |
| S2: academyId: string \| null 호출부 영향 | MEDIUM | **해소** | D4 설계 결정으로 공식화. 호출부 패턴 B(`if (!profile.academyId)`)로 명시. 리스크 섹션에도 포함 |
| S3: extract-questions.ts 함수명 정정 | MEDIUM | **해소** | 변형 목록 #4에 `getCurrentUserWithRole()`로 정정 |
| C1: ROLES.includes() 런타임 가드 | LOW | **해소** | D5 설계 결정으로 채택. Task 1 내용에 명시 |

---

## 2차 신규 이슈 목록

### MEDIUM: `schools.ts`의 `checkAdminOrTeacherRole()` — `academyId` 반환 없음 / null 체크 불필요

**등급**: MEDIUM
**근거**: `src/lib/actions/schools.ts:31~59`의 `checkAdminOrTeacherRole()`은 `profiles` 테이블에서 **`role`만 SELECT**하고 `academy_id`를 조회하지 않는다.

```typescript
// schools.ts:46
const { data: profile } = await supabase
  .from('profiles')
  .select('role')    // academy_id 미포함
  .eq('id', user.id)
  .single()
```

`createSchool`, `updateSchool`, `deleteSchool` 등 schools.ts의 Action들은 모두 academy_id 없이 RLS(`academy_id`)에 의존한다. 즉, schools.ts는 `academyId`를 전혀 사용하지 않는 Action 파일이다.

v2 PLAN의 호출부 패턴 B는 `if (!profile.academyId) return { error: '...' }`를 추가한다. 그런데 `getCurrentUser()` 내부에서 이미 `academy_id` null을 조회하므로:

- `system_admin` 계정(academyId = null)이 학교를 생성/수정/삭제하려 할 때 **패턴 B가 차단**한다.
- 1차 리뷰 전 `checkAdminOrTeacherRole()`은 `system_admin`도 허용하는 역할 체크였으나, null 체크 추가로 **system_admin이 차단되는 동작 변화**가 발생한다.

현재 코드에서 `checkAdminOrTeacherRole()`은 `!['admin', 'teacher', 'system_admin'].includes(profile.role)`로 system_admin을 허용한다. 패턴 B 적용 후 system_admin은 `academyId`가 null이므로 `'소속 학원이 없습니다.'` 에러를 받는다.

**schools.ts의 실제 비즈니스 요구사항 확인 필요**: system_admin이 학교를 생성/수정할 수 있어야 하는가?

PLAN Task 9 특이사항에 이 분기 처리가 명시되지 않았다.

**권장 조치**: Task 9 특이사항에 "system_admin의 academyId null 여부와 학교 CUD 권한 관계 확인" 주석 추가. 또는 schools.ts는 패턴 C(역할 체크만, null 체크 생략)를 사용하도록 명시.

---

### LOW: `generate-questions.ts`와 `save-questions.ts`의 오류 메시지 변경

**등급**: LOW
**근거**: 두 파일의 `checkTeacherOrAdmin()`은 역할 미충족 시 각각 고유한 메시지를 반환한다.

- `generate-questions.ts:66`: `'AI 문제 생성 권한이 없습니다. 교사 또는 관리자만 사용할 수 있습니다.'`
- `save-questions.ts:72`: `'문제 저장 권한이 없습니다. 교사 또는 관리자만 사용할 수 있습니다.'`

v2 PLAN의 호출부 패턴 C는 공통 메시지 `'권한이 없습니다.'`를 사용한다.

이 변경은 **동작 변화(에러 메시지 변경)**에 해당한다. PLAN은 "동작 변경 없음"을 전제로 하나(헤더 `유형: 리팩토링 (동작 변경 없음)`), 에러 메시지는 변경된다. 테스트에서 에러 메시지를 검증하는 케이스가 있다면 해당 테스트가 실패한다.

**권장 조치**: Task 7 특이사항에 "역할 미충족 에러 메시지가 각 파일별로 다름 — 공통 메시지로 통일하거나 호출부에서 액션별 메시지 유지" 명시. 테스트 파일에서 에러 메시지 검증 여부 확인 후 조정.

---

### LOW: `academies.ts`의 `getMyAcademy()` — 별도 인라인 인증 코드 존재

**등급**: LOW
**근거**: PLAN Task 8 내용에 "getMyAcademy() 내 인라인 인증도 getCurrentUser로 교체"가 명시되어 있어 인지된 이슈다. 확인 결과 `academies.ts:92~138`의 `getMyAcademy()`는 `checkAdminRole()`과 **별개로** `supabase.auth.getUser()` + `profiles.select` 인라인 호출을 직접 수행한다.

이 패턴은 Task 8 내용에서 인지하고 있으므로 추가 조치는 불필요하다. 구현자가 놓치기 쉬운 지점으로 주의 환기 목적으로 기록한다.

---

### LOW: `uploadPastExamAction` — `@deprecated` 표시 Action의 교체 범위

**등급**: LOW
**근거**: `past-exams.ts:186`의 `uploadPastExamAction`은 `@deprecated` 표시가 되어 있으며, 인라인 인증 코드(supabase.auth.getUser + profiles 직접 조회)를 사용한다. PLAN Task 4에서 이 인라인 코드를 교체 대상으로 명시하고 있다.

`@deprecated` Action이므로 교체 우선순위가 낮을 수 있으나, 교체하지 않으면 중복 패턴이 남는다. PLAN이 이 부분을 Task 4 특이사항에 명시하고 있으므로 문서 수준은 충족한다.

---

## 호출부 패턴 A/B/C 호환성 검토

v2 PLAN의 호출부 패턴 3가지를 각 Action 파일의 실제 코드와 대조한다.

| 파일 | 현재 패턴 | v2 권장 패턴 | 호환 여부 | 비고 |
|------|---------|-------------|---------|------|
| `users.ts` | 인증 + academy_id null 차단 + role 체크 | 패턴 B + 호출부 role 체크 | ✅ | 호출부 3곳 교체 |
| `questions.ts` | 인증 + academy_id null 차단 | 패턴 B | ✅ | —  |
| `past-exams.ts` | 인증 + academy_id null 차단 | 패턴 B | ✅ | 인라인 1곳 추가 |
| `extract-questions.ts` | 인증 + academy_id + ALLOWED_ROLES 체크 | 패턴 C | ✅ | 역할 분기 호출부 이동 |
| `exam-management.ts` | 인증 + academy_id + ALLOWED_ROLES 체크 | 패턴 C | ✅ | 역할 분기 호출부 이동 |
| `generate-questions.ts` | 인증 + academy_id + role 체크 (고유 메시지) | 패턴 C | **조건부** | 에러 메시지 변경 (LOW 이슈) |
| `save-questions.ts` | 인증 + academy_id + role 체크 (고유 메시지) | 패턴 C | **조건부** | 에러 메시지 변경 (LOW 이슈) |
| `academies.ts` | 인증 + admin 역할 + academy_id null 차단 | 패턴 C (admin/system_admin) | ✅ | `getMyAcademy` 인라인 별도 교체 |
| `schools.ts` | 인증 + role 체크만 (academy_id 없음) | 패턴 B? | **주의** | MEDIUM 이슈 참조 |
| `achievement-standards.ts` | 헬퍼 2개 (인증만 / system_admin) | 패턴 A + 패턴 C | ✅ | Task 10 명시 |

---

## `ActionProfile` 타입 커버리지 검토

`getCurrentUser()` 반환 타입 `ActionProfile { id, role, academyId: string | null }`:

| 사용처 | 필요 필드 | 커버 여부 |
|--------|---------|---------|
| users.ts (id로 자기 자신 체크) | id, role, academyId | ✅ |
| questions.ts (academyId로 필터) | academyId | ✅ |
| past-exams.ts (academyId로 Storage 경로) | id, academyId | ✅ |
| extract-questions.ts (academyId로 IDOR 방어) | id, role, academyId | ✅ |
| exam-management.ts (academyId로 INSERT) | id, role, academyId | ✅ |
| generate-questions.ts (academyId 미사용, role만) | role | ✅ |
| save-questions.ts (id, academyId로 INSERT) | id, role, academyId | ✅ |
| academies.ts (academyId로 academy 조회) | role, academyId | ✅ |
| schools.ts (role 체크만) | role | ✅ |
| achievement-standards.ts (CUD: role만) | role | ✅ |

`ActionProfile`은 모든 사용처를 커버한다.

---

## 테스트 파일 13개 실존 확인

| PLAN 기재 테스트 파일 | 실제 존재 여부 |
|---------------------|------------|
| `users.test.ts` | ✅ 존재 |
| `questions-list.test.ts` | ✅ 존재 |
| `questions-detail.test.ts` | ✅ 존재 |
| `past-exams.test.ts` | ✅ 존재 |
| `past-exams-list.test.ts` | ✅ 존재 |
| `extract-questions.test.ts` | ✅ 존재 |
| `reanalyze-question.test.ts` | ✅ 존재 |
| `exam-management.test.ts` | ✅ 존재 |
| `generate-questions.test.ts` | ✅ 존재 |
| `save-questions.test.ts` | ✅ 존재 |
| `academies.test.ts` | ✅ 존재 |
| `schools.test.ts` | ✅ 존재 |
| `achievement-standards.test.ts` | ✅ 존재 |

**13개 전원 실존 확인.**

단, `schools.test.ts`는 목록에 없다. Glob 결과를 확인하면 `__tests__/schools.test.ts`가 실존하므로 schools.ts Task 9 대응 테스트는 커버된다.

---

## Plan Review Completion Checklist 판정

| 항목 | 상태 | 비고 |
|------|------|------|
| 모든 Task의 파일 소유권이 명확하다 | ✅ | 단일 구현자, 순차 처리 |
| Task 간 의존성 순서가 정의되었다 | ✅ | Task 1 → Task 2~10 → Task 11 |
| 외부 의존성(라이브러리, API)이 명시되었다 | ✅ | 없음 (내부 리팩토링) |
| 에러 처리 방식이 정해졌다 | ✅ | `{ error }` 반환 패턴 유지 |
| 테스트 전략이 있다 | ✅ | helpers.test.ts 신규 + 13개 테스트 mock 교체 |
| 이전 Phase 회고 교훈이 반영되었다 | ✅ | ROLES.includes 가드, system_admin null, IDOR 방어 유지 |
| 병렬 구현 시 파일 충돌 가능성이 없다 | ✅ | 순차 구현 명시 (D6) |

**판정: READY**

MEDIUM 이슈(schools.ts의 system_admin 차단 여부)는 구현 시작 전 비즈니스 요구사항 확인 후 Task 9에서 처리할 것을 권장한다. 동작 변화가 의도적이라면 이슈가 아니고, 의도하지 않은 것이라면 패턴 C(academyId null 체크 생략)로 교체해야 한다.
