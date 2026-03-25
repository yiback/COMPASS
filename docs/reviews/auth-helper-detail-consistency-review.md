# Server Action 인증 헬퍼 통합 — 상세 계획 정합성 리뷰 (consistency-reviewer)

> 검토 대상: `docs/plan/auth-helper-tasks-detail.md` (11개 Task)
> 마스터 PLAN: `docs/plan/auth-helper-consolidation.md` v2
> 검토일: 2026-03-25
> 판정: **READY**

---

## 1. ROADMAP.md 목표와의 정합성

### 확인 결과

ROADMAP.md에는 Server Action 인증 헬퍼 통합이 별도 항목으로 등재되어 있지 않다.
단계 2-1 RBAC 완료 항목에 다음 주석이 포함되어 있다:

> "admin/academy getMyAcademy 중복 쿼리 — cache()가 기존 Action 내부 쿼리에 미적용.
> **Action 리팩토링 없이는 해결 불가. 이번 스코프 외로 분리한 것은 올바른 결정.**"

즉 이번 작업은 RBAC 구현(2-1) 시 의도적으로 분리해 놓은 후속 리팩토링으로, ROADMAP의 단계 항목이 아니라 기술 부채 해소 작업이다.

### 판정

ROADMAP에 항목이 없는 것은 **정상** — 리팩토링(기술 부채 해소)은 로드맵 Feature 항목이 아님. 마스터 PLAN도 `유형: 리팩토링 (동작 변경 없음)`으로 명시하고 있다.

이슈 없음.

---

## 2. 회고 교훈 반영 여부

### 2-1 회고 (phase-2.1-retro.md) 교훈 확인

| 교훈 | 상세 PLAN 반영 여부 |
|------|-------------------|
| `ROLES.includes()` 런타임 가드 | ✅ Task 1 코드에 `if (!ROLES.includes(profile.role as Role))` 포함 |
| system_admin `academyId: null` 허용 | ✅ Task 1: `academyId: string \| null` + 주석 "null은 에러가 아님" |
| `as Role` 캐스팅에 런타임 가드 동반 | ✅ Task 1에서 가드 선행 후 캐스팅 |
| DB 제약조건과 코드 로직 교차 검증 | ✅ Task 1 주석 "// 4. academyId null은 에러가 아님 (system_admin)" |

### MEMORY.md 기술 교훈 확인

| MEMORY.md 교훈 | 반영 여부 |
|---------------|---------|
| `ROLES.includes()` 런타임 가드 | ✅ Task 1 D5 결정으로 채택 |
| Server Action `{ error }` 반환 | ✅ 전 Task에서 `return { error }` 패턴 일관 적용 |
| `system_admin academy_id null` 분기 | ✅ Task 1, 8, 9, 10에서 명시적 처리 |
| `cache()` mock 전략 | ✅ 해당 없음 — 이번 helpers.ts는 cache 미사용 (Server Action 컨텍스트) |
| `await cookies()` 필수 | 해당 없음 — createClient 내부에서 처리 |

### 2-2 회고 (phase-2.2-retro.md) 교훈 확인

| 교훈 | 반영 여부 |
|------|---------|
| JSON.parse try/catch 필수 | 해당 없음 — 이번 리팩토링에서 JSON 파싱 없음 |
| Defense in Depth 3계층 | ✅ 설계 결정 D2에서 "역할 체크는 호출부에서"로 일관성 유지 |
| 타입 정의와 마이그레이션 동시 확장 | 해당 없음 — DB 변경 없음 |

이슈 없음.

---

## 3. Supabase 스키마(migrations/)와의 호환성

### 확인 항목

**Task 1의 `profiles` 쿼리**:
```typescript
.from('profiles')
.select('id, role, academy_id')
.eq('id', user.id)
.single()
```

기존 `src/lib/auth/get-current-user.ts`의 쿼리와 비교:
```typescript
.from('profiles')
.select('id, role, academy_id, name, email, avatar_url')
.eq('id', user.id)
.single()
```

`id`, `role`, `academy_id` 세 컬럼은 `00001_initial_schema.sql`에 존재하는 기본 컬럼이다. 이번 리팩토링에서 DB 변경이 없으므로 호환성 문제 없음.

**`ActionProfile` vs `CurrentProfile` 차이**:

| 필드 | `ActionProfile` (helpers.ts) | `CurrentProfile` (get-current-user.ts) |
|------|------------------------------|----------------------------------------|
| id | ✅ | ✅ |
| role | ✅ | ✅ |
| academyId | ✅ | ✅ |
| name | ❌ (미포함) | ✅ |
| email | ❌ (미포함) | ✅ |
| avatarUrl | ❌ (미포함) | ✅ |

`ActionProfile`은 의도적으로 인증/권한 체크에 필요한 최소 필드만 포함한다.
마스터 PLAN의 D1 결정: "Server Action 전용, src/lib/auth/와 분리"에 따른 올바른 설계.

이슈 없음.

---

## 4. `src/types/` 타입 정의와 `ActionProfile` 일관성

### 확인 항목

`src/types/supabase.ts`에서 `profiles` 테이블의 `role` 컬럼은 `string`으로 추론된다 (Supabase 자동 생성 타입). `ActionProfile.role`은 `Role` 유니온 타입으로 강타입화되어 있다.

이 불일치는 `ROLES.includes(profile.role as Role)` 런타임 가드 + `profile.role as Role` 캐스팅으로 안전하게 처리된다. MEMORY.md의 "ROLES.includes() 런타임 가드: DB에서 잘못된 role이 오면 런타임에서 조용히 통과 → includes 가드로 방어" 패턴과 정확히 일치.

### CONSIDER: `readonly` 불변성

`ActionProfile` 인터페이스의 모든 필드에 `readonly` 선언 — 불변성 원칙 준수. 기존 `CurrentProfile`과 동일한 패턴.

이슈 없음.

---

## 5. `src/lib/auth/` 모듈과의 관계 명확성

### 확인 항목

마스터 PLAN 섹션 2에 "기존 src/lib/auth/ 모듈을 쓰지 않는 이유" 표가 명시되어 있다:

| 구분 | `src/lib/auth/getCurrentProfile()` | `src/lib/actions/helpers.ts getCurrentUser()` |
|------|-----------------------------------|----------------------------------------------|
| cache 래핑 | React `cache()` — 동일 렌더 내 중복 제거 | 없음 (Server Action에서 무의미) |
| 실패 시 | `redirect('/login')` throw | `{ error }` 반환 |
| 용도 | page/layout (서버 컴포넌트) | Server Action |

두 함수는 중복이 아니라 **사용 맥락이 다른 별개 함수**다. 상세 계획도 이 구분을 유지하고 있다.

### 잠재적 혼란 지점

Task 1에서 `import { ROLES, type Role } from '@/lib/auth'`를 사용한다. 이는 `src/lib/auth/roles.ts`의 상수/타입만 가져오는 것으로 의존 방향이 올바르다 (`actions` → `auth/roles.ts` 단방향).

이슈 없음.

---

## 6. 이전 Phase 기술 교훈 반영 종합

### MUST 반영 항목 (MEMORY.md 강조)

| # | 교훈 | 반영 |
|---|------|------|
| 1 | Server Action `{ error }` 반환 — throw 대신 | ✅ 전 Task 일관 |
| 2 | `ROLES.includes()` 런타임 가드 | ✅ Task 1 포함 |
| 3 | system_admin academy_id null 허용 | ✅ Task 1, 9, 10 처리 |
| 4 | academyId camelCase 통일 (기존 academy_id 혼용) | ✅ D3 결정, Task별 명시 |
| 5 | Server Action에서 `cache()` 무의미 | ✅ D1 근거에 명시 |

---

## 7. 추가 발견 이슈

### SHOULD FIX: Task 10 패턴 A 호출부 불완전

**위치**: Task 10 — `getAchievementStandards` 등 조회 Action

**현재 코드**:
```typescript
// 패턴 A: 인증만
const { error } = await getCurrentUser()
if (error) return { error }
```

**문제**: `profile`을 destructure하지 않는 경우 `getCurrentUser()`가 반환하는 `profile`이 낭비된다. 이 자체는 기능 오류가 아니나, `profile`이 항상 `undefined`일 수 없으므로 — `error`가 없으면 `profile`은 반드시 존재한다는 계약이 타입상 보장되지 않는다.

구현 시 주의: 조회 Action에서는 `const { error } = await getCurrentUser()` + `if (error || !profile)` 체크 없이 `if (error)` 만으로 충분하나, 타입스크립트는 `profile`이 undefined일 수 있다고 본다. 실질적으로 `getCurrentUser()` 구현상 `error`가 없으면 `profile`이 항상 존재하므로 기능 문제 없음.

**권고**: 구현자는 조회 Action에서 `if (error) return { error }` 후 profile 미사용이 TS 경고를 유발하지 않는지 확인할 것.

### CONSIDER: Task 4 수파베이스 클라이언트 2회 생성

**위치**: Task 4 주의사항

> "uploadPastExamAction은 supabase 클라이언트를 이미 생성함 → getCurrentUser가 내부에서 또 생성. 2회 생성이지만 Server Action에서는 cache 없으므로 어쩔 수 없음."

이미 PLAN에서 인식하고 수용한 리스크다. 현재 단계에서 최적화는 YAGNI — 이번 리팩토링 목표(중복 코드 통합)에 집중하는 것이 올바름.

이슈 아님.

---

## 8. Plan Review Completion Checklist

| 항목 | 상태 | 비고 |
|------|------|------|
| 모든 Task의 파일 소유권이 명확하다 | ✅ | 각 Task에 소유 파일 명시 |
| Task 간 의존성 순서가 정의되었다 | ✅ | Task 1 완료 후 2~10 순차 (D6: 병렬 구현 불가) |
| 외부 의존성(라이브러리, API)이 명시되었다 | ✅ | Supabase, @/lib/auth (ROLES) |
| 에러 처리 방식이 정해졌다 | ✅ | `{ error }` 반환 패턴 A/B/C 명시 |
| 테스트 전략이 있다 | ✅ | 각 Task에 검증 커맨드, mock 패턴 명시 |
| 이전 Phase 회고 교훈이 반영되었다 | ✅ | ROLES.includes, system_admin null, camelCase |
| 병렬 구현 시 파일 충돌 가능성이 없다 | ✅ | 순차 구현 (병렬 불가 명시, D6) |

---

## 9. 최종 판정

**READY** — MUST FIX 0건, SHOULD FIX 1건 (기능 영향 없음, 구현 시 확인 권고)

| 등급 | 건수 | 내용 |
|------|------|------|
| MUST FIX | **0** | — |
| SHOULD FIX | **1** | Task 10 패턴 A: `error` 체크 후 profile unused 가능성 — TS 경고 확인 |
| CONSIDER | **1** | Task 4 클라이언트 2회 생성 — 이미 PLAN에서 수용, 이슈 아님 |

ROADMAP 목표, 회고 교훈, 스키마 호환성, 타입 일관성, 모듈 분리 모든 항목에서 정합성 확인 완료.
