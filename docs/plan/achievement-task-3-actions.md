# Task 3: Server Action (CRUD 6개) — 상세 계획

> 소유: backend-actions (`src/lib/actions/`)
> 의존: Task 2 (Zod 스키마)
> 산출물: `src/lib/actions/achievement-standards.ts`

---

## 기존 패턴: src/lib/actions/schools.ts (271줄)

- `'use server'` 파일 레벨 지시자
- `SchoolActionResult` 공통 반환 타입
- `checkAdminOrTeacherRole()` RBAC 헬퍼
- FormData → Zod safeParse → DB 쿼리 → revalidatePath

### schools.ts와의 차이점

| 항목 | schools.ts | achievement-standards.ts |
|------|-----------|------------------------|
| RBAC | admin, teacher | system_admin (CRUD), 인증 사용자 (조회) |
| academy_id | 없음 | 없음 (동일) |
| 페이지네이션 | 있음 (range) | 없음 (전체 로드) |
| 삭제 | 하드 삭제 | 비활성화 (is_active=false) |
| 정렬 | created_at DESC | grade→semester→order_in_semester→code |

---

## Step 분해

### Step 1: 공통 타입 + RBAC 헬퍼

- `AchievementStandardActionResult`: `{ error?: string, data?: unknown }`
- `checkSystemAdminRole()`: auth.getUser → profiles.role → system_admin 체크
  - schools.ts의 checkAdminOrTeacherRole 구조 동일, role 조건만 다름

### Step 2: getAchievementStandards(filters)

- 권한: 모든 인증 사용자 (RLS 보장)
- 필터: subject, grade, semester, unit, search, isActive
- 검색: `.or('content.ilike.%검색어%')` (keywords 검색은 ~100개이므로 content ILIKE로 충분)
- 정렬: `.order('grade').order('semester').order('order_in_semester').order('code')`
- 페이지네이션 없음

### Step 3: getAchievementStandardById(id)

- 권한: 모든 인증 사용자
- `.eq('id', id).single()`

### Step 4: createAchievementStandard(prevState, formData)

- 권한: system_admin (checkSystemAdminRole)
- FormData → keywords 특수 처리 (JSON.parse)
- Zod safeParse (achievementStandardCreateSchema)
- INSERT + code 중복 에러 처리 (error.code === '23505')
- revalidatePath('/achievement-standards')

### Step 5: updateAchievementStandard(id, prevState, formData)

- 권한: system_admin
- 편집 가능 필드만: content, keywords, unit, sub_unit, source_name, source_url
- Zod safeParse (achievementStandardUpdateSchema)
- UPDATE .eq('id', id)

### Step 6: deactivateAchievementStandard(id)

- 권한: system_admin
- UPDATE { is_active: false } .eq('id', id)
- DELETE RLS 없으므로 하드 삭제 불가능 (이중 방어)

### Step 7: getDistinctUnits(subject?, grade?)

- 권한: 모든 인증 사용자
- `.select('unit').eq('is_active', true).not('unit', 'is', null)`
- JS에서 중복 제거: `[...new Set(data.map(d => d.unit))]`
- PostgREST에 DISTINCT 없으므로 클라이언트 처리

---

## 에러 처리 매트릭스

| 상황 | 에러 메시지 |
|------|-----------|
| 미인증 | '인증이 필요합니다.' |
| 권한 부족 | '권한이 없습니다.' |
| Zod 실패 | parsed.error.issues[0]?.message |
| code 중복 (23505) | '이미 존재하는 성취기준 코드입니다.' |
| DB 일반 에러 | '처리 중 오류가 발생했습니다.' |
| ID 누락 | '성취기준 ID가 필요합니다.' |

---

## 파일 구조 (~250줄)

```
src/lib/actions/achievement-standards.ts
├── AchievementStandardActionResult (타입)
├── checkSystemAdminRole() (private)
├── getAchievementStandards(filters)
├── getAchievementStandardById(id)
├── createAchievementStandard(prevState, formData)
├── updateAchievementStandard(id, prevState, formData)
├── deactivateAchievementStandard(id)
└── getDistinctUnits(subject?, grade?)
```

---

## 검증 기준

- [ ] 'use server' 지시자 파일 첫 줄
- [ ] 6개 Action 모두 export
- [ ] system_admin RBAC: create, update, deactivate
- [ ] academy_id 필터 없음 확인
- [ ] 정렬: grade→semester→order_in_semester→code
- [ ] code 중복 에러 처리
- [ ] npm run build 성공
- [ ] 기존 테스트 전체 PASS (1390+)
