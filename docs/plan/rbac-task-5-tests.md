# Task 5: 테스트 ✅

> 소유: tester (`src/lib/auth/__tests__/`)
> 의존성: Task 1~4 전체
> Wave: 4 (검증, 직렬)

## 생성 파일

| 파일 | 설명 |
|------|------|
| `src/lib/auth/__tests__/roles.test.ts` | ROLES 상수, ROUTE_PERMISSIONS 매핑 검증 |
| `src/lib/auth/__tests__/require-role.test.ts` | requireRole + getCurrentProfile mock 테스트 |

## 구체적 구현

### 1. `roles.test.ts` — 상수 검증

```typescript
describe('ROLES', () => {
  it('4개 역할이 정의되어 있다')
  it('student, teacher, admin, system_admin 포함')
})

describe('ROUTE_PERMISSIONS', () => {
  it('보호 대상 경로 6개 정의')
  it('모든 roles에 유효한 Role만 포함')
  it('/admin/academy는 admin만')
  it('/past-exams는 admin, teacher만')
  it('/questions는 admin, teacher, student')
  it('system_admin은 roles에 미포함 (requireRole에서 별도 처리)')
})
```

### 2. `require-role.test.ts` — 핵심 동작 검증

Mock 전략:
- `vi.mock('next/navigation')` — redirect를 throw로 모방
- `vi.mock('@/lib/supabase/server')` — DB 호출 대체
- `vi.resetModules()` — 각 테스트 간 cache() 리셋

```typescript
describe('requireRole', () => {
  it('미인증 → /login redirect')
  it('프로필 없음 → /login redirect')
  it('역할 불일치 → /unauthorized redirect')
  it('역할 일치 → profile 반환')
  it('system_admin → 항상 허용')
  it('student → admin 전용 페이지 → /unauthorized')
})

describe('getCurrentProfile', () => {
  it('system_admin + academy_id=null → 정상 반환')
  it('teacher + academy_id=null → null 반환')
  it('teacher + academy_id 존재 → 정상 반환')
  it('미인증 → null')
  it('프로필 없음 → null')
})
```

## 테스트 범위

| 유형 | 예상 수 |
|------|---------|
| roles/route-permissions | ~8개 |
| requireRole | ~6개 |
| getCurrentProfile | ~5개 |
| **총계** | **~19개** |

## 빌드 검증

```bash
npx vitest run src/lib/auth/__tests__/   # 새 테스트 PASS
npx vitest run                            # 기존 1367 + 새 ~19 = 1386+ 전체 PASS
npx vitest run src/lib/auth/ --coverage  # 80%+ 확인
```
