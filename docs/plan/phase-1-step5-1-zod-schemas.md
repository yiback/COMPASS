# 단계 1-5 Step 1: Zod 검증 스키마 (TDD)

> **상태**: ✅ 구현 완료 (2026-02-16)
> **작성일**: 2026-02-15
> **완료일**: 2026-02-16
> **상위 계획**: `docs/plan/phase-1-step5-user-crud.md` Step 1
> **학습 등급**: 🟢 ROUTINE
> **테스트**: 37개 통과 (전체 272개 회귀 없음)

---

## 1. Context

단계 1-5 (사용자 관리 CRUD [F009])의 첫 번째 스텝. Server Actions(Step 2)에서 사용할 Zod 검증 스키마를 TDD로 구현한다.

역할 변경 기능의 보안은 여기서부터 시작 — `roleChangeSchema`에서 `system_admin`을 스키마 레벨에서 차단하는 것이 Defense in Depth의 첫 번째 방어선이다.

기존 프로젝트의 Zod 패턴(`academies.ts`, `schools.ts`, `auth.ts`)을 그대로 따른다.

---

## 2. 파일 변경 목록

| 파일 | 작업 | 상태 |
|------|------|------|
| `src/lib/validations/__tests__/users.test.ts` | 새로 생성 | ✅ 37개 테스트 |
| `src/lib/validations/users.ts` | 새로 생성 | ✅ 스키마 3개 + 타입 3개 |

---

## 3. 스키마 정의

### 3.1 userFilterSchema — 사용자 목록 필터

```typescript
export const userFilterSchema = z.object({
  search: z.string().optional(),
  role: z.enum(['student', 'teacher', 'admin', 'all']).optional().default('all'),
  isActive: z.enum(['true', 'false', 'all']).optional().default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
})
```

- `search`: 이름/이메일 검색어. 빈값이면 검색 안 함
- `role`: system_admin은 학원 소속이 아니므로 필터에 미포함
- `isActive`: URL searchParams는 문자열이므로 boolean이 아닌 문자열 enum
- `page`: `z.coerce`로 searchParams 문자열 → 숫자 자동 변환

### 3.2 roleChangeSchema — 역할 변경

```typescript
export const roleChangeSchema = z.object({
  userId: z.string().uuid('올바른 사용자 ID가 아닙니다.'),
  newRole: z.enum(['student', 'teacher', 'admin'], {
    message: '유효하지 않은 역할입니다.',  // Zod 3.23+: errorMap 대신 message 사용
  }),
})
```

- **핵심**: `newRole` enum에 `system_admin` 미포함 → 스키마 레벨에서 권한 상승 차단
- Server Action의 추가 검증(Step 2)과 함께 2중 방어

### 3.3 toggleActiveSchema — 활성화/비활성화

```typescript
export const toggleActiveSchema = z.object({
  userId: z.string().uuid('올바른 사용자 ID가 아닙니다.'),
  isActive: z.boolean(),
}) 
```

- Server Action에서 직접 boolean으로 전달 (FormData가 아닌 직접 호출)

### 3.4 타입 Export

```typescript
export type UserFilterInput = z.infer<typeof userFilterSchema>
export type RoleChangeInput = z.infer<typeof roleChangeSchema>
export type ToggleActiveInput = z.infer<typeof toggleActiveSchema>
```

---

## 4. TDD 테스트 케이스

### 4.1 userFilterSchema (7개)

```
describe('userFilterSchema')
  describe('기본값')
    it('빈 객체면 기본값 적용됨')
      → {} → { role: 'all', isActive: 'all', page: 1, search: undefined }
    it('search 없으면 undefined')
  describe('role 필드')
    it('유효한 역할 통과') → 'student', 'teacher', 'admin', 'all'
    it('무효한 역할 거부') → 'system_admin', 'hacker'
  describe('isActive 필드')
    it('유효한 값 통과') → 'true', 'false', 'all'
    it('무효한 값 거부') → 'yes', '1'
  describe('page 필드')
    it('문자열 숫자가 coerce됨') → '3' → 3
    it('0 이하 거부') → 0, -1
```

### 4.2 roleChangeSchema (6개)

```
describe('roleChangeSchema')
  describe('유효한 입력')
    it('student 역할로 변경 통과')
    it('teacher 역할로 변경 통과')
    it('admin 역할로 변경 통과')
  describe('보안: system_admin 차단')
    it('system_admin으로 변경 시도 → 거부')
  describe('userId 검증')
    it('잘못된 UUID 거부')
    it('빈 문자열 거부')
  describe('악의적 필드 제거')
    it('추가 필드 strip됨') → academyId, role 등 제거 확인
```

### 4.3 toggleActiveSchema (5개)

```
describe('toggleActiveSchema')
  describe('유효한 입력')
    it('활성화 (isActive: true)')
    it('비활성화 (isActive: false)')
  describe('isActive 검증')
    it('문자열 "true" 거부 (boolean만)')
    it('숫자 1 거부')
  describe('악의적 필드 제거')
    it('추가 필드 strip됨')
```

**총 테스트: 37개** (계획 시 ~18개 → 실제 구현 시 경계값/조합 케이스 추가)

---

## 5. 기존 패턴 재사용

| 패턴 | 출처 | 적용 |
|------|------|------|
| `z.coerce.number()` | `src/lib/validations/past-exams.ts` | page 필드 |
| `z.enum([...]).default()` | `src/lib/validations/schools.ts` (schoolFilterSchema) | role, isActive 필드 |
| `z.string().uuid()` | 신규 (프로젝트 최초 사용) | userId 필드 |
| `z.infer<typeof>` | `src/lib/validations/academies.ts`, `schools.ts` | 타입 export |
| safeParse + strip 테스트 | `src/lib/validations/__tests__/academies.test.ts` | 악의적 필드 테스트 |

---

## 6. 설계 결정

1. **userId 공통 필드 추출 안 함** — 2번만 사용되므로 인라인 유지 (MVP 원칙)
2. **역할 상수 추출 안 함** — Zod enum으로 충분, 별도 상수 불필요
3. **isActive를 문자열 enum으로** — URL searchParams가 문자열이므로 `'true'|'false'|'all'` (toggleActiveSchema의 boolean과 별개)
4. **반환 타입은 Step 2에서 정의** — 이 파일은 순수 입력 검증만 담당

---

## 7. TDD 실행 순서

1. **RED**: `src/lib/validations/__tests__/users.test.ts` 테스트 먼저 작성 (~18개)
2. **GREEN**: `src/lib/validations/users.ts` 최소 구현으로 테스트 통과
3. **REFACTOR**: 에러 메시지 한국어 일관성, 불필요한 코드 정리

---

## 8. 검증 ✅

```bash
# 테스트 실행 → 37개 통과
npx vitest run src/lib/validations/__tests__/users.test.ts

# 전체 테스트 → 272개 통과 (회귀 없음)
npx vitest run
```

---

## 9. 학습 포인트 (🟢 ROUTINE)

- `z.coerce.number()`: searchParams 문자열 → 숫자 자동 변환
- `z.enum(['...'])`: 허용 값 리스트 검증 + 나머지 자동 거부
- Zod 기본 strip 동작: 스키마에 없는 필드 자동 제거 (보안)
- `z.infer<typeof schema>`: 스키마에서 TypeScript 타입 자동 추론
- **구현 중 발견**: `z.enum`의 `errorMap` 옵션이 Zod 3.23+에서 동작하지 않음 → `message` 옵션 사용
