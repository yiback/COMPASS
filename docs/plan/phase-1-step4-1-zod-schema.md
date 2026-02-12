# Step 1: Zod 검증 스키마 (TDD) — 상세 계획

> **상태**: ✅ 완료 (2026-02-12)
> **상위 계획**: `phase-1-step4-academy-crud.md`
> **작성일**: 2026-02-12
> **완료일**: 2026-02-12
> **TDD 순서**: RED(테스트 먼저) → GREEN(구현) → REFACTOR(정리)

---

## 1. 무엇을 만드는가

`academyUpdateSchema` — 학원 정보 수정용 Zod 스키마 1개.

학교 관리(1-3)에서는 생성/수정/필터 스키마 3개를 만들었지만, 학원 관리에서는 **수정 스키마만** 필요합니다.

| 학교 관리 스키마 | 학원 관리 스키마 | 이유 |
|-----------------|-----------------|------|
| schoolSchema (생성) | **없음** | 학원 생성은 system_admin 영역 |
| updateSchoolSchema (수정) | **academyUpdateSchema** | admin이 자기 학원 정보 수정 |
| schoolFilterSchema (필터) | **없음** | 자기 학원 1개만 (목록 없음) |

---

## 2. DB 필드 → 스키마 필드 매핑

### 스키마에 포함하는 필드 (수정 가능)

| DB 컬럼 | 스키마 필드 | 타입 | 검증 규칙 |
|---------|-----------|------|----------|
| `name` | `name` | string (필수) | 1~100자 |
| `address` | `address` | string (선택) | 최대 200자, 빈 문자열 허용 |
| `phone` | `phone` | string (선택) | 최대 20자, 빈 문자열 허용 |
| `logo_url` | `logoUrl` | string (선택) | 유효한 URL 또는 빈 문자열 |

### 스키마에서 제외하는 필드 (수정 불가)

| DB 컬럼 | 제외 이유 |
|---------|----------|
| `id` | 기본키, 변경 불가 |
| `invite_code` | 읽기 전용 (재생성은 Phase 2+) |
| `settings` | MVP 미사용 (확장 예약 JSONB) |
| `is_active` | system_admin 전용 |
| `created_at` / `updated_at` | 트리거 자동 관리 |

**Zod의 strip 기본 동작**: 스키마에 정의되지 않은 필드는 파싱 결과에서 자동 제거됩니다. 누군가 FormData에 `invite_code`를 몰래 넣어도 `.safeParse()` 결과에는 포함되지 않습니다. 이것이 **수정 불가 필드 보호의 1차 방어선**입니다.

---

## 3. logoUrl 검증 설계

### 왜 특별한 처리가 필요한가?

`z.string().url()`은 빈 문자열을 거부합니다. 하지만 로고를 설정하지 않은 학원도 있으므로 빈 문자열도 허용해야 합니다.

### 3가지 접근법 비교

```typescript
// A: .optional().or(z.literal('')) — 기존 address/phone 패턴
logoUrl: z.string().url().optional().or(z.literal(''))
// 문제: .url()이 먼저 실행되어 빈 문자열 입력 시 URL 에러 발생

// B: URL 검증 없이 단순 문자열
logoUrl: z.string().max(500).optional().or(z.literal(''))
// 문제: 아무 문자열이나 DB에 저장됨

// C: z.union() 또는 .or() 패턴 ✅ 채택
logoUrl: z.union([z.string().url('에러메시지'), z.literal('')]).optional()
// 또는: z.string().url('에러메시지').or(z.literal('')).optional()
// 장점: "유효한 URL 또는 빈 문자열" 두 경우를 명시적으로 허용
```

### 채택: `.or(z.literal(''))` 패턴

```typescript
logoUrl: z
  .string()
  .url('올바른 URL 형식이 아닙니다.')
  .or(z.literal(''))
  .optional()
```

**동작 원리**: Zod의 `.or()`는 첫 번째 스키마(`z.string().url()`)가 실패하면 두 번째 스키마(`z.literal('')`)를 시도합니다. 빈 문자열은 URL 검증에 실패하지만, `z.literal('')`에는 성공합니다.

---

## 4. 스키마 코드 청사진

```typescript
// src/lib/validations/academies.ts

import { z } from 'zod'

// ─── 학원 수정 스키마 ──────────────────────────────────
// 생성 스키마 없음: 학원은 테넌트(멀티테넌시 최상위 단위)
// system_admin만 학원을 생성할 수 있으며, 이는 MVP 범위 밖

export const academyUpdateSchema = z.object({
  name: z
    .string()
    .min(1, '학원명을 입력해주세요.')
    .max(100, '학원명은 100자 이하여야 합니다.'),
  address: z
    .string()
    .max(200, '주소는 200자 이하여야 합니다.')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .max(20, '전화번호는 20자 이하여야 합니다.')
    .optional()
    .or(z.literal('')),
  logoUrl: z
    .string()
    .url('올바른 URL 형식이 아닙니다.')
    .or(z.literal(''))
    .optional(),
})

export type AcademyUpdateInput = z.infer<typeof academyUpdateSchema>
```

### camelCase → snake_case 변환

스키마는 `logoUrl`(camelCase), DB는 `logo_url`(snake_case). 변환은 **Server Action(Step 2)**에서 처리합니다. 학교 관리에서도 `schoolType → school_type` 동일 패턴을 사용했습니다.

---

## 5. TDD 테스트 케이스

### 테스트 구조 (약 14개)

```
describe('academyUpdateSchema')
│
├── describe('유효한 입력값')
│   ├── it('필수 필드만 있는 경우')
│   ├── it('모든 필드가 있는 경우')
│   └── it('선택 필드가 빈 문자열인 경우')
│
├── describe('name 필드 검증')
│   ├── it('빈 문자열이면 실패')
│   ├── it('100자 초과하면 실패')
│   └── it('정확히 100자면 성공')
│
├── describe('address 필드 검증')
│   ├── it('200자 초과하면 실패')
│   └── it('빈 문자열 허용')
│
├── describe('phone 필드 검증')
│   ├── it('20자 초과하면 실패')
│   └── it('빈 문자열 허용')
│
├── describe('logoUrl 필드 검증')
│   ├── it('유효한 URL이면 성공')
│   ├── it('잘못된 URL이면 실패')
│   └── it('빈 문자열 허용 (로고 미설정)')
│
└── describe('수정 불가 필드 확인')
    └── it('스키마에 없는 필드(inviteCode, settings)는 파싱 결과에서 제거됨')
```

### 주요 테스트 상세

#### 경계값 테스트 (왜 하는가?)

```typescript
it('정확히 100자면 성공', () => {
  const valid = { name: 'a'.repeat(100) }
  expect(result.success).toBe(true)
})

it('100자 초과하면 실패', () => {
  const invalid = { name: 'a'.repeat(101) }
  expect(result.success).toBe(false)
})
```

**학습**: off-by-one 에러 방지. `.max(100)`이 "100자 포함"인지 "100자 미만"인지 코드를 읽는 것만으로는 헷갈릴 수 있습니다. 테스트가 이를 문서화합니다.

#### 수정 불가 필드 strip 테스트

```typescript
it('스키마에 없는 필드는 파싱 결과에서 제거됨', () => {
  const input = {
    name: '학원',
    inviteCode: 'HACK123',  // 악의적 입력
    settings: { maxStudents: 999 },  // 악의적 입력
  }
  const result = academyUpdateSchema.parse(input)
  expect(result).not.toHaveProperty('inviteCode')
  expect(result).not.toHaveProperty('settings')
})
```

**학습**: Zod의 기본 모드는 `strip`입니다. 스키마에 정의되지 않은 키는 파싱 결과에서 자동 제거됩니다. `.strict()`를 쓰면 제거 대신 에러를 발생시킵니다. 우리는 기본(`strip`)을 사용하여 불필요한 필드를 조용히 제거합니다.

---

## 6. 실행 순서

### RED (테스트 먼저)
1. `src/lib/validations/__tests__/academies.test.ts` 작성
2. `npx vitest run src/lib/validations/__tests__/academies.test.ts` 실행
3. **모든 테스트 실패 확인** (import할 모듈이 없으므로)

### GREEN (최소 구현)
4. `src/lib/validations/academies.ts` 작성
5. `npx vitest run src/lib/validations/__tests__/academies.test.ts` 실행
6. **모든 테스트 통과 확인**

### REFACTOR (정리)
7. 기존 schools 스키마와 패턴 일관성 확인
8. 불필요한 코드 제거
9. 최종 테스트 통과 확인

---

## 7. 학습 포인트 요약

| 번호 | 개념 | 이 Step에서 어떻게 배우는가 |
|------|------|--------------------------|
| 1 | **도메인 분석 → 스키마 결정** | 왜 생성/필터 스키마가 없는지 (학원=테넌트) |
| 2 | **z.union() / .or() 패턴** | logoUrl의 "URL 또는 빈문자열" 처리 |
| 3 | **Zod strip 기본 동작** | 수정 불가 필드(invite_code) 보호의 1차 방어선 |
| 4 | **경계값 테스트** | off-by-one 에러 방지, 테스트를 문서로 활용 |
| 5 | **TDD RED→GREEN 사이클** | 테스트 먼저 → 실패 확인 → 구현 → 통과 |

---

## 8. 완료 요약 (2026-02-12)

### 구현 완료
- ✅ **academyUpdateSchema** 구현 완료
  - name (필수, 1-100자)
  - address (선택, 최대 200자, 빈 문자열 허용)
  - phone (선택, 최대 20자, 빈 문자열 허용)
  - logoUrl (선택, 유효한 URL 또는 빈 문자열)

### 테스트 완료
- ✅ **14개 테스트 모두 통과** (`npx vitest run src/lib/validations/__tests__/academies.test.ts`)
  - 유효한 입력값 (3개 테스트)
  - name 필드 검증 (3개 테스트)
  - address 필드 검증 (2개 테스트)
  - phone 필드 검증 (2개 테스트)
  - logoUrl 필드 검증 (3개 테스트)
  - 수정 불가 필드 확인 (1개 테스트)

### TDD 사이클 완료
1. ✅ **RED**: 테스트 먼저 작성 → 모든 테스트 실패 확인
2. ✅ **GREEN**: 최소 구현 → 모든 테스트 통과 확인
3. ✅ **REFACTOR**: 기존 schools 스키마와 패턴 일관성 확인 → 최종 테스트 통과

### 핵심 패턴 적용
- ✅ `.or(z.literal(''))` 패턴으로 logoUrl 검증 (URL 또는 빈 문자열)
- ✅ 경계값 테스트로 off-by-one 에러 방지 (100자 vs 101자)
- ✅ Zod strip 모드로 수정 불가 필드 자동 제거 (invite_code, settings)

### 학습 리뷰 완료
- ✅ Multi-tenancy 개념 이해 (학원=테넌트, 생성 스키마 없는 이유)
- ✅ `.or(z.literal(''))` 패턴의 동작 원리
- ✅ 경계값 테스트의 중요성
- ✅ Zod strip 모드와 보안 방어선
