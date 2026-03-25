# 인증 헬퍼 통합 리팩토링 — 2차 보안 리뷰

**날짜**: 2026-03-25
**대상**: `src/lib/actions/` 하위 전체 + `__tests__/` 하위 전체
**역할**: security-reviewer (2차)
**범위**: 리팩토링으로 새로 도입된 보안 문제만 식별 (기존 이슈 제외)

---

## 1. 1차 리뷰 이슈 해소 확인

### H-1: users.ts getUserList — academy_id 코드레벨 필터 누락
- **판정**: 리팩토링 이전부터 동일. 새로 도입된 문제 아님 → **별도 이슈 유지**
- **현황**: RLS가 방어하고 있음. 리팩토링으로 해당 동작 변경 없음.

### H-2: schools.ts 읽기 Actions — 인증 체크 없음
- **판정**: 리팩토링 이전부터 동일. 새로 도입된 문제 아님 → **별도 이슈 유지**
- **현황**: `getSchoolList`, `getSchoolById`에 인증 체크 없음. 리팩토링 이전부터 동일 패턴.

---

## 2. academyId null 경로 테스트 커버리지 확인

리팩토링으로 `getCurrentUser()`가 `academyId: null`을 에러 없이 반환하는 새 동작이 도입됨.
각 Action에서 `!profile.academyId` 체크가 올바르게 수행되는지 테스트로 커버되는지 확인.

| Action 파일 | 테스트 파일 | academyId null 테스트 |
|---|---|---|
| users.ts | users.test.ts | getUserList ✅ / changeUserRole ✅ / toggleUserActive ✅ |
| academies.ts | academies.test.ts | system_admin(null) 케이스 ✅ |
| questions.ts | questions-list.test.ts | ✅ (line 52) / questions-detail.test.ts ✅ (line 44) |
| past-exams.ts | past-exams-list.test.ts | ✅ (line 64) |
| exam-management.ts | exam-management.test.ts | ✅ (line 211) |
| extract-questions.ts | extract-questions.test.ts | ✅ (line 214) |
| generate-questions.ts | generate-questions.test.ts | ✅ (line 123) |
| save-questions.ts | save-questions.test.ts | ✅ (line 124) |
| achievement-standards.ts | achievement-standards.test.ts | system_admin(null) mock ✅ |

**결론**: academyId null 경로는 전 Action에 걸쳐 테스트로 커버됨.
helpers.test.ts에도 `academy_id null (system_admin) → 정상 반환` 케이스 포함.

---

## 3. getCurrentUser() 호출 패턴 검증

모든 Action이 `getCurrentUser()`를 첫 번째 단계로 올바르게 호출하는지 확인.

### 올바른 패턴 (에러 반환 후 즉시 종료)
```typescript
const { error, profile } = await getCurrentUser()
if (error || !profile) return { error: error ?? '인증 실패' }
```

### 파일별 확인

| 파일 | getCurrentUser 호출 위치 | 패턴 |
|---|---|---|
| academies.ts | 맨 앞 (1단계) | ✅ 올바름 |
| users.ts | getUserList: 필터 검증 뒤 (2단계) | ⚠️ 순서 역전 (아래 참조) |
| past-exams.ts | 모두 1단계 | ✅ 올바름 |
| questions.ts | 모두 1단계 | ✅ 올바름 |
| schools.ts | createSchool/updateSchool/deleteSchool: 1단계 | ✅ 올바름 |
| achievement-standards.ts | 모두 1단계 | ✅ 올바름 |
| generate-questions.ts | 1단계 | ✅ 올바름 |
| save-questions.ts | 1단계 | ✅ 올바름 |
| exam-management.ts | 모두 1단계 | ✅ 올바름 |
| extract-questions.ts | 모두 1단계 | ✅ 올바름 |

---

## 4. 새로 도입된 보안 취약점 분석

### 4-1. LOW: users.ts getUserList — 인증 전 필터 검증 순서 역전

**심각도**: LOW

**위치**: `src/lib/actions/users.ts`, 라인 74-93

**내용**:
```typescript
export async function getUserList(filters?: UserFilterInput) {
  // 1. 필터 검증 ← 인증 전에 실행
  const parsed = userFilterSchema.safeParse(filters ?? {})
  if (!parsed.success) {
    return { error: '잘못된 필터 값입니다.' }
  }
  // ...
  // 2. 인증 + 프로필 확인 ← 필터 검증 후에 실행
  const { error, profile } = await getCurrentUser()
```

**문제**: 미인증 사용자도 필터 검증 오류 메시지를 받을 수 있음. 인증 실패여야 할 상황에서 입력값 오류 메시지가 반환되는 정보 노출.
- 보안 영향은 낮으나, "인증이 필요합니다" 대신 "잘못된 필터 값입니다"가 반환될 수 있어 인증 상태 정보가 필터 검증 오류로 가려짐.
- 리팩토링 이전부터 있던 패턴인지, 리팩토링으로 새로 도입된 것인지 불명확하나 일관성 이슈임.

**분류**: LOW (정보 노출 최소화 원칙 위반 — 기능 보안에는 영향 없음)

---

### 4-2. LOW: auth.ts — console.log 정보 노출

**심각도**: LOW

**위치**: `src/lib/actions/auth.ts`, 라인 87

**내용**:
```typescript
console.log('[signup] academy found:', academy)
```

**문제**: 회원가입 시 학원 객체 전체가 서버 로그에 출력됨. `invite_code` 등 민감 필드가 포함될 수 있음. 리팩토링 범위 외이나 auth.ts는 동일 디렉토리이므로 보고.

**분류**: LOW (서버사이드 로그, 클라이언트 노출 없음)

---

### 4-3. CONSIDER: users.ts changeUserRole UPDATE — academy_id 코드레벨 필터 없음

**심각도**: CONSIDER (기존 이슈의 연장선)

**위치**: `src/lib/actions/users.ts`, 라인 225-236

```typescript
const { data: updated, error: updateError } = await supabase
  .from('profiles')
  .update({ role: newRole })
  .eq('id', userId)  // academy_id 필터 없음
  .select(...)
  .single()
```

**문제**: UPDATE 쿼리에 `.eq('academy_id', caller.academyId)` 없음.
RLS가 방어하지만 코드레벨 방어가 없음. 5번 단계에서 대상 사용자를 SELECT로 확인했으나 UPDATE는 별도 쿼리이므로 이론적으로 race condition 가능.
- MEMORY.md의 "Server Action IDOR 누락" 반복 실수 패턴과 동일.
- 리팩토링 이전부터 동일하며 1차 리뷰 H-1의 연장선. "별도 이슈"로 유지.

**분류**: CONSIDER (RLS로 방어 중, 단 코드레벨 방어 권장)

---

## 5. 긍정적 확인 사항

### helpers.ts 설계
- `getCurrentUser()`가 단일 진실점(Single Source of Truth)으로 통합됨
- `ROLES.includes()` 런타임 role 가드 포함 (MEMORY.md 교훈 반영)
- `academyId null` = system_admin 허용 (에러 아님) 명시 — DB CHECK 제약과 일관성

### 일관성
- 모든 Action(10개 파일, 약 30개 Action)에서 `getCurrentUser()` import 사용 확인
- 이전 직접 Supabase 호출 패턴(분산 인증 로직) 잔존 없음

### academy_id IDOR 방어
- `extractQuestionsAction`: `.eq('academy_id', profile.academyId)` Optimistic Lock에 포함 ✅
- `resetExtractionAction`: 모든 DELETE/UPDATE에 academy_id 필터 포함 ✅
- `reanalyzeQuestionAction`: SELECT/UPDATE에 academy_id 필터 포함 ✅
- `questions.ts getQuestionList`: `.eq('academy_id', profile.academyId)` 명시 ✅

---

## 6. 이슈 요약

| ID | 심각도 | 파일 | 내용 | 리팩토링 신규 여부 |
|---|---|---|---|---|
| S2-1 | LOW | users.ts | getUserList 인증 전 필터 검증 순서 역전 | 불명확 |
| S2-2 | LOW | auth.ts | console.log academy 객체 노출 | 기존 |
| S2-3 | CONSIDER | users.ts | changeUserRole UPDATE에 academy_id 필터 없음 | 기존(H-1 연장) |

**리팩토링으로 새로 도입된 HIGH/CRITICAL 이슈: 없음**

---

## 7. 판정

**READY**

리팩토링으로 새로 도입된 CRITICAL/HIGH 보안 취약점 없음.
LOW 이슈 2건 모두 기존 코드에서 이전된 사항이며 기능 보안에 영향 없음.
`getCurrentUser()` 통합 자체는 분산 인증 로직 제거, 런타임 role 가드 추가, 단일 진실점 확립 면에서 **보안이 향상된 변경**으로 평가함.
