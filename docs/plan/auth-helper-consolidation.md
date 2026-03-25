# Server Action 인증 헬퍼 통합 계획 v2

> 작성일: 2026-03-25
> 업데이트: 2026-03-25 (리뷰 반영 + **구현 완료**)
> 유형: 리팩토링 (동작 변경 없음)
> 상태: ✅ 완료 (1449 tests PASS, 코드 리뷰 2차 만장일치 PASS)

---

## 1. 문제 정의

Server Action 파일 **10개**에 인증 헬퍼 함수가 **12곳** 중복 정의되어 있다.
모두 동일한 패턴 (`supabase.auth.getUser()` → `profiles.select` → 에러 체크`)이지만
이름, 반환 타입, 역할 체크 범위가 제각각이다.

### 현재 변형 목록 (v2 — 리뷰 반영)

| # | 파일 | 헬퍼 이름 | 반환 프로필 | 역할 체크 | academy_id 체크 |
|---|------|----------|-----------|----------|----------------|
| 1 | `users.ts` | `getCurrentUserProfile()` | id, role, academy_id | 호출부에서 | O |
| 2 | `questions.ts` | `getCurrentUserProfile()` | 동일 (복붙) | 호출부에서 | O |
| 3 | `past-exams.ts` | `getCurrentUserProfile()` + 인라인 1곳 | 동일 | 호출부에서 | O |
| 4 | `extract-questions.ts` | `getCurrentUserWithRole()` | 동일 | teacher/admin/system_admin | O |
| 5 | `exam-management.ts` | `getCurrentUserWithRole()` | 동일 | teacher/admin/system_admin | O |
| 6 | `generate-questions.ts` | `checkTeacherOrAdmin()` | id, role, academy_id | teacher/admin/system_admin | O |
| 7 | `save-questions.ts` | `checkTeacherOrAdmin()` | 동일 (복붙) | teacher/admin/system_admin | O |
| 8 | `academies.ts` | `checkAdminRole()` | role, academyId | admin/system_admin | O |
| 9 | `schools.ts` | `checkAdminOrTeacherRole()` | role만 | admin/teacher/system_admin | X |
| 10 | `achievement-standards.ts` | `checkAuthenticated()` + `checkSystemAdminRole()` | 없음 / role만 | 없음 / system_admin만 | X |

---

## 2. 설계 결정

### 통합 함수: `getCurrentUser()`

**위치**: `src/lib/actions/helpers.ts`

```typescript
import type { Role } from '@/lib/auth'

export interface ActionProfile {
  readonly id: string
  readonly role: Role
  readonly academyId: string | null  // system_admin은 null — 에러가 아님
}

export interface GetCurrentUserResult {
  readonly error?: string
  readonly profile?: ActionProfile
}

export async function getCurrentUser(): Promise<GetCurrentUserResult>
```

### 핵심 설계 결정

| # | 결정 | 근거 |
|---|------|------|
| D1 | `src/lib/actions/helpers.ts`에 배치 | Server Action 전용, `src/lib/auth/`와 분리 |
| D2 | 역할 체크는 호출부에서 수행 | 함수 범용성 유지, SRP |
| D3 | 반환 타입 camelCase 통일 | `academyId` (기존 `academy_id` 혼용 정리) |
| D4 | `academyId: string | null` 반환 | system_admin은 academy_id null. 호출부에서 null 체크 |
| D5 | `ROLES.includes()` 런타임 가드 포함 | MEMORY.md 기록 패턴 — DB에서 잘못된 role 방어 |
| D6 | 병렬 구현 불가 → 순차 처리 | 모든 파일이 helpers.ts에 의존 |

### 기존 `src/lib/auth/` 모듈을 쓰지 않는 이유

| `src/lib/auth/` | `src/lib/actions/helpers.ts` |
|---|---|
| `getCurrentProfile()` — React `cache()` 감싸짐 | cache 없음 (Server Action에서 무의미) |
| `requireRole()` — `redirect()` throw | `{ error }` 반환 (클라이언트 분기) |
| page/layout 전용 | Server Action 전용 |

### 호출부 패턴 (역할 + academy_id 체크)

```typescript
// 패턴 A: 인증만 (achievement-standards 조회)
const { error, profile } = await getCurrentUser()
if (error || !profile) return { error: error ?? '인증 실패' }

// 패턴 B: 인증 + academy_id 필수 (대부분의 Action)
const { error, profile } = await getCurrentUser()
if (error || !profile) return { error: error ?? '인증 실패' }
if (!profile.academyId) return { error: '소속 학원이 없습니다.' }

// 패턴 C: 인증 + 역할 + academy_id (역할 제한 Action)
const { error, profile } = await getCurrentUser()
if (error || !profile) return { error: error ?? '인증 실패' }
if (!profile.academyId) return { error: '소속 학원이 없습니다.' }
if (!['teacher', 'admin', 'system_admin'].includes(profile.role)) {
  return { error: '권한이 없습니다.' }
}
```

---

## 3. 영향 범위 (v2)

### Action 파일 (10개 수정)

| 파일 | 제거 대상 | 특이사항 |
|------|----------|---------|
| `users.ts` | `getCurrentUserProfile()` + `GetCurrentUserResult` | — |
| `questions.ts` | `getCurrentUserProfile()` + `GetCurrentUserResult` | — |
| `past-exams.ts` | `getCurrentUserProfile()` + `uploadPastExamAction` 인라인 | 인라인 1곳 추가 |
| `extract-questions.ts` | `getCurrentUserWithRole()` + `GetCurrentUserResult` | 역할 분기 호출부 이동 |
| `exam-management.ts` | `getCurrentUserWithRole()` + `GetCurrentUserResult` | 역할 분기 호출부 이동 |
| `generate-questions.ts` | `checkTeacherOrAdmin()` + `AuthCheckResult` + `AuthorizedUser` | 역할 분기 호출부 이동 |
| `save-questions.ts` | `checkTeacherOrAdmin()` + `AuthCheckResult` + `AuthorizedUser` | 역할 분기 호출부 이동 |
| `academies.ts` | `checkAdminRole()` + `CheckAdminRoleResult` | admin 분기 호출부 이동 |
| `schools.ts` | `checkAdminOrTeacherRole()` | 역할 분기 호출부 이동 |
| `achievement-standards.ts` | `checkAuthenticated()` + `checkSystemAdminRole()` | 헬퍼 2개 제거 |

### 테스트 파일 (최대 13개 수정)

| 테스트 파일 | 대응 Action |
|------------|------------|
| `users.test.ts` | users.ts |
| `questions-list.test.ts` | questions.ts |
| `questions-detail.test.ts` | questions.ts |
| `past-exams.test.ts` | past-exams.ts |
| `past-exams-list.test.ts` | past-exams.ts |
| `extract-questions.test.ts` | extract-questions.ts |
| `reanalyze-question.test.ts` | extract-questions.ts (reanalyze) |
| `exam-management.test.ts` | exam-management.ts |
| `generate-questions.test.ts` | generate-questions.ts |
| `save-questions.test.ts` | save-questions.ts |
| `academies.test.ts` | academies.ts |
| `schools.test.ts` | schools.ts |
| `achievement-standards.test.ts` | achievement-standards.ts |

### 신규 파일 (2개)

- `src/lib/actions/helpers.ts`
- `src/lib/actions/__tests__/helpers.test.ts`

**총: ~25파일** (신규 2 + Action 10 + 테스트 13)

---

## 4. Task 분해 (v2)

### Task 1: helpers.ts 생성 + 단위 테스트 (30분)

**소유 파일**:
- `src/lib/actions/helpers.ts` (신규)
- `src/lib/actions/__tests__/helpers.test.ts` (신규)

**내용**:
- `getCurrentUser()` 함수 정의 — 인증 + 프로필(id, role, academyId) 조회
- `ROLES.includes()` 런타임 가드 포함
- `academyId: string | null` 반환 (null은 에러 아님)
- `ActionProfile`, `GetCurrentUserResult` 타입 export
- 단위 테스트 (~8개): 미인증, 프로필 없음, 잘못된 role, academy_id null(정상), 정상 반환 등

**검증**: `npx vitest run src/lib/actions/__tests__/helpers.test.ts`

---

### Task 2: users.ts 교체 (15분)

**소유 파일**: `users.ts`, `__tests__/users.test.ts`

**내용**:
- `getCurrentUserProfile()` + `GetCurrentUserResult` 타입 제거
- `import { getCurrentUser } from './helpers'` 추가
- 호출부 3곳 교체 (패턴 B: academyId null 체크 추가)
- 테스트: `vi.mock('./helpers')` → getCurrentUser mock

**검증**: `npx vitest run src/lib/actions/__tests__/users.test.ts`

---

### Task 3: questions.ts 교체 (15분)

**소유 파일**: `questions.ts`, `__tests__/questions-list.test.ts`, `__tests__/questions-detail.test.ts`

**내용**: Task 2와 동일 패턴
**주의**: 테스트 파일이 2개 (list + detail)

---

### Task 4: past-exams.ts 교체 (20분)

**소유 파일**: `past-exams.ts`, `__tests__/past-exams.test.ts`, `__tests__/past-exams-list.test.ts`

**내용**:
- `getCurrentUserProfile()` 제거 → import 교체
- `uploadPastExamAction` 내 인라인 인증 코드도 getCurrentUser로 교체
- 테스트 파일 2개

---

### Task 5: extract-questions.ts 교체 (20분)

**소유 파일**: `extract-questions.ts`, `__tests__/extract-questions.test.ts`, `__tests__/reanalyze-question.test.ts`

**내용**:
- `getCurrentUserWithRole()` 제거 → import getCurrentUser
- 역할 분기 (`teacher/admin/system_admin`) 호출부로 이동
- 테스트 파일 2개 (extract + reanalyze)

---

### Task 6: exam-management.ts 교체 (15분)

**소유 파일**: `exam-management.ts`, `__tests__/exam-management.test.ts`

**내용**:
- `getCurrentUserWithRole()` + `ALLOWED_ROLES` 제거 → import getCurrentUser
- 역할 분기 호출부로 이동

---

### Task 7: generate-questions.ts + save-questions.ts 교체 (20분)

**소유 파일**: `generate-questions.ts`, `save-questions.ts`, `__tests__/generate-questions.test.ts`, `__tests__/save-questions.test.ts`

**내용**:
- `checkTeacherOrAdmin()` + `AuthCheckResult` + `AuthorizedUser` 제거 (양쪽)
- 역할 분기 호출부로 이동
- 두 파일 패턴 동일하므로 1 Task로 묶음

---

### Task 8: academies.ts 교체 (20분)

**소유 파일**: `academies.ts`, `__tests__/academies.test.ts`

**내용**:
- `checkAdminRole()` + `CheckAdminRoleResult` 제거
- `getMyAcademy()` 내 인라인 인증도 getCurrentUser로 교체
- admin 역할 분기 호출부 유지

---

### Task 9: schools.ts 교체 (15분)

**소유 파일**: `schools.ts`, `__tests__/schools.test.ts`

**내용**:
- `checkAdminOrTeacherRole()` 제거 → import getCurrentUser
- 역할 분기 호출부로 이동

---

### Task 10: achievement-standards.ts 교체 (15분)

**소유 파일**: `achievement-standards.ts`, `__tests__/achievement-standards.test.ts`

**내용**:
- `checkAuthenticated()` + `checkSystemAdminRole()` 둘 다 제거
- 조회 Action: 패턴 A (인증만, 프로필 미사용 OK)
- CUD Action: 패턴 C (role === 'system_admin' 분기)

---

### Task 11: 전체 검증 + 정리 (15분)

**내용**:
- `npx vitest run` 전체 (1434+ tests PASS 목표)
- `npx tsc --noEmit` (타입 에러 0건)
- 각 파일에서 미사용 로컬 타입 정리 확인

---

## 5. 검증 계획

- 각 Task 완료 시: 해당 파일 테스트 실행
- Task 11: `npx vitest run` 전체 + `npx tsc --noEmit`
- 목표: 1434+ tests PASS, 타입 에러 0건

---

## 6. 리스크

| 등급 | 리스크 | 대응 |
|------|--------|------|
| **HIGH** | 테스트 mock 구조 변경 (~13개 파일) | `vi.mock('./helpers')`로 함수 단위 mock → 기존보다 간결 |
| **MEDIUM** | `academyId: string | null` 반환 시 호출부 null 체크 추가 | 기존 헬퍼가 내부에서 차단하던 곳에 `if (!profile.academyId)` 추가 |
| **MEDIUM** | academies.ts `getMyAcademy` 인라인 인증 교체 | getCurrentUser 사용 + 기존 academy 조회 로직은 유지 |
| **LOW** | achievement-standards에 불필요한 프로필 반환 | 사용 안 해도 비용 동일, 미래 확장에 유리 |

---

## 7. 리뷰 이슈 반영 추적

| 이슈 | 등급 | 조치 |
|------|------|------|
| M1: 누락된 헬퍼 3개 | MUST FIX | v2에서 #4~7 추가 (10개 → 전체 반영) |
| M2: achievement-standards 헬퍼 2개 | MUST FIX | v2 Task 10에 둘 다 명시 |
| S1: 테스트 파일명 정정 | SHOULD FIX | v2 섹션 3에 실제 파일명 반영 (13개) |
| S2: academyId null 반환 영향 | SHOULD FIX | v2 섹션 2 호출부 패턴 A/B/C + D4 결정 추가 |
| S3: extract-questions 함수명 정정 | SHOULD FIX | v2에서 getCurrentUserWithRole로 수정 |
| C1: ROLES.includes() 가드 | CONSIDER | D5로 채택 (포함) |
| C2: 단계적 분할 | CONSIDER | Task 11개로 분할, 각 Task 후 검증 |
