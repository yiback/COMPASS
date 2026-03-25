# Task 4: UI (DataTable + Dialog + Toolbar + RBAC) — 상세 계획

> 소유: frontend-ui (`src/app/`, `src/components/`)
> 의존: Task 3 (Server Action)
> 산출물: 5개 신규 파일 + 2개 수정 파일

---

## 기존 패턴: schools UI

| 파일 | 패턴 | 줄 수 |
|------|------|-------|
| admin/schools/page.tsx | Server Component + requireRole + DataTable | ~85 |
| school-columns.tsx | ColumnDef + DropdownMenu 액션 | ~112 |
| schools-toolbar.tsx | 검색 debounce + Select 필터 | ~71 |
| school-form.tsx | useForm + zodResolver + useTransition | ~221 |

### schools와의 차이

| 항목 | schools | achievement-standards |
|------|---------|---------------------|
| 라우트 | /admin/schools | /achievement-standards |
| 권한 | admin, teacher | admin/teacher/student (조회), system_admin (CRUD) |
| 페이지네이션 | 서버사이드 | 클라이언트사이드 |
| 폼 | 별도 페이지 | Dialog 내 폼 |
| 삭제 | confirm() | AlertDialog (비활성화) |
| 필터 | 검색 + 유형 | 캐스케이딩 4단 + 검색 |
| 추가 UI | 없음 | keywords Badge Input, Combobox |

---

## 선행 작업: shadcn/ui 컴포넌트 추가

```bash
npx shadcn@latest add command popover
```

- command.tsx, popover.tsx 생성 (Combobox 구현에 필요)
- cmdk 의존성 자동 추가
- **리드 승인 필요** (package.json 변경)

---

## Step 분해

### Step 0: shadcn/ui 컴포넌트 추가

`npx shadcn@latest add command popover` 실행.

### Step 1: route-permissions.ts + menu.ts 수정 (Shared)

**route-permissions.ts** (+1줄):
```
{ pattern: '/achievement-standards', roles: ['admin', 'teacher', 'student'] }
```

**menu.ts** (+6줄):
```
{
  title: '성취기준',
  href: '/achievement-standards',
  icon: Target,
  description: '교육과정 성취기준 조회',
  roles: ['admin', 'teacher'],
}
```

- 학생 메뉴 미노출 (roles에 student 제외)
- Target 아이콘 import 추가

### Step 2: columns.ts

DataTable 컬럼 7개:

| 컬럼 | 필드 | 정렬 | cell 커스텀 |
|------|------|------|------------|
| 코드 | code | O | 모노스페이스 |
| 내용 | content | - | 100자 truncate |
| 학년 | grade | O | 7→중1 변환 |
| 학기 | semester | O | 1→1학기 |
| 단원 | unit | O | null→"-" |
| 키워드 | keywords | - | Badge (최대 3개 + 더보기) |
| 작업 | actions | - | 수정/비활성화 (system_admin만) |

- **팩토리 함수**: `createAchievementStandardColumns(isSystemAdmin)` — system_admin 아니면 actions 컬럼 제거
- 학년 변환: `{ 7: '중1', 8: '중2', 9: '중3' }`

### Step 3: toolbar.tsx (캐스케이딩 필터)

```
[과목 Select] [학년 Select] [학기 Select] [단원 Combobox] [검색 Input]
```

- 과목 변경 → 학년/학기/단원 초기화
- 학년 변경 → 단원 목록 갱신 (getDistinctUnits 호출)
- 검색: debounce 300ms (기존 인라인 패턴)
- URL searchParams 기반 상태 관리 (router.push)
- race condition 방지: `let cancelled = false` (회고 교훈)

### Step 4: form-dialog.tsx (생성/수정 Dialog)

- mode: 'create' | 'edit'
- 생성 모드: 전체 필드
- 수정 모드: code/subject/grade/semester disabled + 편집 필드만 활성
- useForm + zodResolver + useTransition
- **keywords Badge Input**:
  - useState<string[]> 별도 관리
  - Input + Enter → 배열 추가 (불변성: [...prev, trimmed])
  - Badge + x → 배열 제거 (불변성: prev.filter)
  - form.setValue('keywords', keywords)로 react-hook-form 동기화
- **단원 Combobox**: Popover + Command (기존 값 자동완성 + 자유입력)
- 성공 → toast.success + Dialog 닫기
- 실패 → toast.error

### Step 5: deactivate-dialog.tsx (AlertDialog)

- AlertDialog + AlertDialogTrigger + AlertDialogContent
- "성취기준 비활성화" 제목
- 경고: "비활성화된 성취기준은 목록에서 숨겨지지만 삭제되지 않습니다."
- useTransition + deactivateAchievementStandard(id) 호출
- 성공 → toast.success + router.refresh()

### Step 6: page.tsx (Server Component)

- requireRole(['admin', 'teacher', 'student'])
- getCurrentProfile() → role 확인 (system_admin 여부)
- searchParams 파싱 → getAchievementStandards(filters)
- role === 'system_admin' → "성취기준 추가" 버튼
- DataTable: columns(팩토리), data, toolbar

---

## RBAC 매트릭스 (교차 검증)

| 위치 | 역할 | 동작 |
|------|------|------|
| page.tsx requireRole | admin, teacher, student | 페이지 접근 |
| route-permissions.ts | admin, teacher, student | 테스트 문서 |
| menu.ts | admin, teacher | 사이드바 (student 미노출) |
| 추가 버튼 | system_admin | 조건부 렌더링 |
| columns actions | system_admin | 팩토리 함수 |
| form-dialog | system_admin | Action RBAC + RLS |
| deactivate-dialog | system_admin | Action RBAC + RLS |

---

## 파일 구조

```
src/app/(dashboard)/achievement-standards/page.tsx (~80줄)
src/components/achievement-standards/columns.ts (~100줄)
src/components/achievement-standards/toolbar.tsx (~120줄)
src/components/achievement-standards/form-dialog.tsx (~200줄)
src/components/achievement-standards/deactivate-dialog.tsx (~60줄)

수정: route-permissions.ts (+1줄), menu.ts (+6줄)
```

---

## 검증 기준

- [ ] shadcn/ui command, popover 설치
- [ ] /achievement-standards 라우트 접근 가능
- [ ] admin/teacher/student 페이지 표시
- [ ] system_admin만 추가/수정/비활성화 버튼
- [ ] 캐스케이딩 필터 동작
- [ ] 검색 debounce 300ms
- [ ] keywords Badge 추가/삭제
- [ ] 생성/수정 Dialog 동작
- [ ] 비활성화 AlertDialog 동작
- [ ] 사이드바 메뉴 (admin, teacher만)
- [ ] npm run build 성공
- [ ] 기존 테스트 전체 PASS (1390+)
