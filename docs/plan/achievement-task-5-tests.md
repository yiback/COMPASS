# Task 5: 테스트 — 상세 계획

> 소유: tester (`__tests__/`)
> 의존: Task 1~4 전체
> 산출물: 2개 테스트 파일 (~30개 테스트)

---

## 기존 패턴: src/lib/actions/__tests__/schools.test.ts (661줄)

- Mock: mockSupabaseClient (auth.getUser, from)
- vi.mock('@/lib/supabase/server'), vi.mock('next/cache')
- Helper: createMockFormData, mockAuthAsTeacher, mockAuthFailed
- 패턴: mockSupabaseClient.from.mockReturnValueOnce 체인
- describe 블록: Action별 그룹

### schools.test.ts와의 차이

| 항목 | schools | achievement-standards |
|------|---------|---------------------|
| RBAC mock | teacher, student | system_admin, admin, student |
| 쿼리 체인 | select→order→range | select→eq(필터)→order(4개) |
| 삭제 테스트 | 의존성 체크 | 비활성화 (update is_active=false) |
| unique violation | 없음 | code 중복 (23505) |

---

## Step 분해

### Step 1: Zod 스키마 테스트 (~10개)

파일: `src/lib/validations/__tests__/achievement-standards.test.ts`

```
describe('achievementStandardCreateSchema')
  it('유효: 전체 필드')
  it('유효: 필수 필드만')
  it('거부: code 빈 문자열')
  it('거부: content 누락')
  it('거부: grade 범위 초과 (0, 13)')
  it('거부: semester 범위 초과 (0, 3)')
  it('거부: source_url 잘못된 URL')
  it('통과: source_url 빈 문자열')

describe('achievementStandardUpdateSchema')
  it('유효: content + keywords 수정')
  it('거부: content 빈 문자열')

describe('achievementStandardFilterSchema')
  it('유효: 빈 객체 (기본값)')
  it('유효: 전체 필터 조합')
  it('통과: isActive 기본값 "true"')
  it('통과: grade 문자열→숫자 (coerce)')
```

### Step 2: Server Action 테스트 (~20개)

파일: `src/lib/actions/__tests__/achievement-standards.test.ts`

#### Mock 설정

```
mockSupabaseClient = { auth: { getUser }, from }
vi.mock('@/lib/supabase/server')
vi.mock('next/cache')
```

#### Helper

```
mockAuthAsSystemAdmin() — role: 'system_admin'
mockAuthAsAdmin() — role: 'admin'
mockAuthAsStudent() — role: 'student'
mockAuthFailed() — user: null
createMockFormData(data) — keywords는 JSON.stringify
```

#### 테스트 목록

```
describe('getAchievementStandards')
  it('성공: 전체 조회')
  it('성공: grade 필터')
  it('성공: 검색')
  it('성공: 복합 필터')
  it('실패: DB 에러')

describe('getAchievementStandardById')
  it('성공: 단일 조회')
  it('실패: ID 누락')
  it('실패: 미존재 ID')

describe('createAchievementStandard')
  it('성공: system_admin 생성')
  it('실패: admin 권한 부족')
  it('실패: 인증 실패')
  it('실패: 필수 필드 누락')
  it('실패: code 중복 (23505)')
  it('실패: DB 에러')

describe('updateAchievementStandard')
  it('성공: system_admin 수정')
  it('실패: admin 권한 부족')
  it('실패: content 누락')
  it('실패: DB 에러')

describe('deactivateAchievementStandard')
  it('성공: system_admin 비활성화')
  it('실패: admin 권한 부족')
  it('실패: ID 누락')

describe('getDistinctUnits')
  it('성공: 전체 단원')
  it('성공: 학년별 필터')
```

#### Mock 체인 패턴 (order 4중 체인)

```javascript
// flattened mock 패턴 (권장)
const mockQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  order: vi.fn()
    .mockReturnValueOnce(mockQuery)  // 1st order
    .mockReturnValueOnce(mockQuery)  // 2nd order
    .mockReturnValueOnce(mockQuery)  // 3rd order
    .mockResolvedValueOnce({         // 4th order → 결과
      data: mockStandards,
      error: null,
    }),
}
mockSupabaseClient.from.mockReturnValue(mockQuery)
```

---

## 파일 구조

```
src/lib/validations/__tests__/achievement-standards.test.ts (~100줄)
├── achievementStandardCreateSchema — 8개
├── achievementStandardUpdateSchema — 2개
└── achievementStandardFilterSchema — 4개

src/lib/actions/__tests__/achievement-standards.test.ts (~400줄)
├── Mock + Helpers
├── getAchievementStandards — 5개
├── getAchievementStandardById — 3개
├── createAchievementStandard — 6개
├── updateAchievementStandard — 4개
├── deactivateAchievementStandard — 3개
└── getDistinctUnits — 2개
```

---

## 검증 기준

- [ ] Zod 테스트 ~10개 PASS
- [ ] Action 테스트 ~20개 PASS
- [ ] 기존 1390+ 전체 PASS (회귀 없음)
- [ ] Mock 패턴 schools.test.ts와 일관성
- [ ] 권한 테스트: system_admin 성공, admin/teacher 거부 (CRUD)
- [ ] code 중복 에러 테스트 포함
- [ ] 비활성화 테스트 포함
