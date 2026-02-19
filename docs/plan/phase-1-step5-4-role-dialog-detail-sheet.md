# 1-5 Step 4: 역할 변경 AlertDialog + 사용자 상세 Sheet 구현 계획

> **상태**: ✅ 완료
> **작성일**: 2026-02-18
> **완료일**: 2026-02-19
> **모델**: Opus 4.6 (계획)
> **전제 조건**: Step 1(Zod), Step 2(Server Actions), Step 3(DataTable UI) 완료

---

## 1. 요구사항 재정의

### Step 4 범위

| 기능 | 포함 | 설명 |
|------|------|------|
| 역할 변경 AlertDialog | YES | Select로 새 역할 선택 + 확인/취소 |
| 사용자 상세 Sheet | YES | 오른쪽 사이드 패널로 기본 정보 + 액션 버튼 |
| user-columns.tsx 수정 | YES | placeholder 교체 + 상세보기 메뉴 추가 |

### Step 4에서 하지 않는 것

- 사이드바 메뉴 추가 (Step 5)
- 빌드 검증 + 최종 학습 리뷰 (Step 5)
- 테스트 작성 (UI 컴포넌트는 E2E로 Phase 2에서 검증)

---

## 2. 아키텍처 결정

### 2-1. Dialog/Sheet 상태 관리 전략

**결정**: ActionsCell 내부 `useState`로 관리

**이유**:
- Dialog/Sheet는 특정 행(row)의 사용자에 종속된 상태
- 페이지 레벨로 올리면 "어떤 사용자를 대상으로 열었는가"를 별도 state로 관리해야 함 → 복잡도 증가
- ActionsCell은 이미 `row.original`로 대상 사용자 데이터를 가지고 있음
- DropdownMenu 클릭 → `setDialogOpen(true)` → Dialog가 같은 컴포넌트 내에서 렌더링

**대안 검토**: 페이지 레벨 상태 + `selectedUser` state → 불필요한 prop drilling, 거부

### 2-2. AlertDialog vs Dialog 선택

**결정**: AlertDialog 사용

**근거**:
1. **역할 변경은 파괴적(destructive) 작업** — 실수로 admin을 student로 강등하면 해당 사용자가 관리 기능에 접근 불가
2. AlertDialog는 **Escape 키로 닫히지 않음** → 실수 방지
3. AlertDialog는 **배경 클릭으로 닫히지 않음** → 의도적 확인 필요
4. shadcn/ui AlertDialog 컴포넌트가 이미 설치됨

### 2-3. Controlled vs Uncontrolled Dialog

**결정**: Controlled 패턴 (`open` + `onOpenChange` props)

**이유**:
- DropdownMenu에서 열고, AlertDialog의 취소/성공 시 닫아야 함
- Trigger 기반(Uncontrolled)으로는 DropdownMenuItem에서 AlertDialog를 열 수 없음
- `useState<boolean>` + `open={isOpen}` + `onOpenChange={setIsOpen}`

### 2-4. useTransition vs 직접 await

**결정**: `useTransition` 사용

**근거**:
- 프로젝트 기존 패턴과 일관성
- `isPending`으로 확인 버튼 비활성화 → 중복 클릭 방지
- HANDOFF.md에 명시된 패턴

---

## 3. role-change-dialog.tsx 상세 명세

### 3-1. Props 인터페이스

```typescript
interface RoleChangeDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly user: UserProfile
  readonly callerRole: string
}
```

### 3-2. Select 옵션 필터링 로직

```
호출자가 admin인 경우:
  → 선택 가능: student, teacher (admin 부여 불가)
  → 현재 역할 제외

호출자가 system_admin인 경우:
  → 선택 가능: student, teacher, admin (system_admin 승격 절대 불가)
  → 현재 역할 제외
```

**구현 방식**: `getAvailableRoles(callerRole, currentRole)` 유틸 함수

```typescript
function getAvailableRoles(
  callerRole: string,
  currentRole: string
): Array<{ value: string; label: string }> {
  const allRoles = [
    { value: 'student', label: '학생' },
    { value: 'teacher', label: '교사' },
    { value: 'admin', label: '관리자' },
  ]

  return allRoles.filter((role) => {
    if (role.value === currentRole) return false
    if (callerRole === 'admin' && role.value === 'admin') return false
    return true
  })
}
```

**주의**: UI 필터링은 UX 편의성일 뿐, **보안은 Server Action이 담당**.

### 3-3. 컴포넌트 흐름

```
1. AlertDialog open → Select에 getAvailableRoles() 결과 표시
2. 사용자가 새 역할 선택 → selectedRole state 업데이트
3. "변경" 버튼 클릭 → startTransition 내에서:
   a. changeUserRole(user.id, selectedRole) 호출
   b. 성공 → toast.success + onOpenChange(false) + router.refresh()
   c. 실패 → toast.error (Dialog는 열린 상태 유지)
4. "취소" 버튼 → onOpenChange(false)
```

### 3-4. 확인 버튼 비활성화 조건

```typescript
const isConfirmDisabled = !selectedRole || isPending
```

### 3-5. UI 레이아웃 (ASCII)

```
┌─────────────────────────────────────┐
│  역할 변경                           │
│                                     │
│  {user.name}님의 역할을 변경합니다.    │
│                                     │
│  현재 역할: [학생]                    │
│                                     │
│  새 역할:                            │
│  ┌─────────────────────────────┐    │
│  │ 역할을 선택하세요        ▼  │    │
│  └─────────────────────────────┘    │
│                                     │
│              [취소]  [변경]          │
└─────────────────────────────────────┘
```

### 3-6. 예상 줄수: ~90줄

---

## 4. user-detail-sheet.tsx 상세 명세

### 4-1. Props 인터페이스

```typescript
interface UserDetailSheetProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly user: UserProfile
  readonly callerId: string
  readonly callerRole: string
  readonly onRoleChangeClick: () => void
}
```

### 4-2. canManage 조건

```typescript
const isSelf = user.id === callerId
const isSystemAdmin = user.role === 'system_admin'
const canManage = !isSelf && !isSystemAdmin
```

### 4-3. 레이아웃 구조 (ASCII)

```
┌──────────────────────────────┐
│ [x]                          │
│ ──────────────────────────── │
│ SheetHeader                  │
│   사용자 상세                  │
│   사용자 정보를 확인합니다       │
│ ──────────────────────────── │
│                              │
│  이름: 홍길동                  │
│  이메일: hong@example.com     │
│  역할: [학생] (Badge)         │
│  상태: [활성] (Badge)         │
│  전화번호: 010-1234-5678      │
│  가입일: 2026. 1. 15.        │
│                              │
│ ── Separator ─────────────── │
│                              │
│ (canManage인 경우만)          │
│ [역할 변경]    (버튼)         │
│ [비활성화]     (버튼, 빨강)    │
└──────────────────────────────┘
```

### 4-4. 역할 변경 버튼

- 클릭 시 `onRoleChangeClick()` 콜백 호출
- **결정**: Sheet 위에 AlertDialog 겹쳐 열기 (Sheet를 닫으면 UX 끊김)

### 4-5. 비활성화/활성화 버튼

- `useTransition` + `toggleUserActive` Server Action
- 성공 시: toast + Sheet 닫기 + router.refresh()
- 실패 시: toast.error (Sheet는 열린 상태 유지)

### 4-6. 상수 공유

**결정**: user-columns.tsx에서 `export`하고 user-detail-sheet.tsx에서 `import`

### 4-7. 예상 줄수: ~130줄

---

## 5. user-columns.tsx 수정 사항

### 5-1. import 추가

```typescript
import { useState } from 'react'
import { RoleChangeDialog } from './role-change-dialog'
import { UserDetailSheet } from './user-detail-sheet'
import { Eye } from 'lucide-react'
```

### 5-2. 상수 export 변경

```diff
- const ROLE_MAP = { ... }
+ export const ROLE_MAP = { ... }

- const ROLE_BADGE_VARIANT = { ... }
+ export const ROLE_BADGE_VARIANT = { ... }

- const STATUS_BADGE = { ... }
+ export const STATUS_BADGE = { ... }
```

### 5-3. ActionsCell 내부 상태 추가

```typescript
const [roleDialogOpen, setRoleDialogOpen] = useState(false)
const [detailSheetOpen, setDetailSheetOpen] = useState(false)
```

### 5-4. handleRoleChange placeholder 교체

```diff
- function handleRoleChange() {
-   toast.info('역할 변경 기능은 곧 추가됩니다.')
- }
```

DropdownMenuItem에서 직접 `setRoleDialogOpen(true)` 호출.

### 5-5. "상세보기" DropdownMenuItem 추가

```typescript
<DropdownMenuItem onClick={() => setDetailSheetOpen(true)}>
  <Eye className="mr-2 h-4 w-4" />
  상세보기
</DropdownMenuItem>
```

### 5-6. Dialog/Sheet 컴포넌트 렌더링

```typescript
return (
  <>
    <DropdownMenu>...</DropdownMenu>
    <RoleChangeDialog
      open={roleDialogOpen}
      onOpenChange={setRoleDialogOpen}
      user={user}
      callerRole={callerRole}
    />
    <UserDetailSheet
      open={detailSheetOpen}
      onOpenChange={setDetailSheetOpen}
      user={user}
      callerId={callerId}
      callerRole={callerRole}
      onRoleChangeClick={() => setRoleDialogOpen(true)}
    />
  </>
)
```

### 5-7. 예상 줄수 변경: ~140줄 → ~170줄 (+30줄)

---

## 6. DropdownMenu + AlertDialog 충돌 방지

### 알려진 이슈

DropdownMenuItem 클릭 → DropdownMenu 닫힘 → AlertDialog 열림 시 포커스 충돌 가능

### 해결 방법

AlertDialog를 `<DropdownMenu>` **바깥** `<>...</>`에 배치 → Radix 포커스 트랩 충돌 방지

---

## 7. 구현 순서

```
Phase A: role-change-dialog.tsx 작성 (독립 컴포넌트)
Phase B: user-detail-sheet.tsx 작성 (독립 컴포넌트)
Phase C: user-columns.tsx 수정 (Phase A/B 연동)
Phase D: 빌드 검증 (npm run build + lint + vitest)
Phase E: 학습 리뷰 (MANDATORY)
```

---

## 8. 리스크 평가

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| DropdownMenu + AlertDialog 포커스 충돌 | 중간 | AlertDialog를 DropdownMenu 외부에 렌더링 |
| Sheet 위에 AlertDialog z-index | 낮음 | 둘 다 z-50, DOM 순서로 자연 해결 |
| getAvailableRoles와 Server Action 불일치 | 낮음 | UI는 UX, 보안은 Server Action |
| 상수 export 영향 | 낮음 | export 추가는 breaking change 아님 |

---

## 9. 학습 포인트 (🟡 RECOMMENDED)

| 개념 | 설명 |
|------|------|
| AlertDialog vs Dialog | 파괴적 작업 → Escape/배경 클릭 차단 |
| Sheet 패턴 | 페이지 이동 없이 상세 정보 사이드 패널 표시 |
| Controlled Dialog | `open` + `onOpenChange` props로 외부 제어 |
| 조건부 UI 렌더링 | UI 필터링 ≠ 보안. Server Action이 최종 게이트 |

### 이해도 체크 질문 (구현 후)

- Q1: 왜 역할 변경에 Dialog가 아닌 AlertDialog를 사용하는가?
- Q2: `getAvailableRoles`에서 현재 역할을 제외하는 이유는?
- Q3: Controlled Dialog에서 `onOpenChange`의 역할은?
- Q4: Sheet에서 역할 변경 클릭 시 Sheet를 닫지 않는 이유는?
- Q5: UI 필터링이 보안을 대체할 수 없는 이유는?

---

## 10. 파일 변경 요약

### 새로 생성 (2개)

| 파일 | 설명 | 예상 줄수 |
|------|------|----------|
| `_components/role-change-dialog.tsx` | 역할 변경 AlertDialog | ~90줄 |
| `_components/user-detail-sheet.tsx` | 사용자 상세 Sheet | ~130줄 |

### 수정 (1개)

| 파일 | 변경 내용 | 줄수 변화 |
|------|----------|----------|
| `_components/user-columns.tsx` | export + useState + Dialog/Sheet 연동 | +30줄 |

### 검증 체크리스트

- [x] 역할 변경 AlertDialog 정상 열림/닫힘
- [x] Select 옵션 callerRole 따라 필터링
- [x] 역할 변경 성공/실패 시 toast + 상태 변경
- [x] 사용자 상세 Sheet 정보 표시
- [x] canManage 조건부 액션 버튼
- [x] Sheet에서 역할 변경 → AlertDialog 겹쳐 열림
- [x] npm run build 성공
- [x] npm run lint 에러 0개
- [x] npx vitest run 회귀 없음 (300개 테스트 통과)
