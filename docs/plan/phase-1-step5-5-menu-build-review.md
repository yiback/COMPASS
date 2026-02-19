# 1-5 Step 5: 사이드바 메뉴 + 빌드 검증 + 학습 리뷰

> **상태**: ⏳ 대기
> **작성일**: 2026-02-19
> **모델**: Opus 4.6 (계획)
> **난이도**: LOW
> **예상 소요**: 15-20분 (구현 5분 + 검증 5분 + 학습 리뷰 10분)
> **상위 계획**: `docs/plan/phase-1-step5-user-crud.md` Step 5 섹션

---

## 1. 요약

1-5 사용자 관리 CRUD의 마지막 단계. 사이드바에 "사용자 관리" 메뉴 항목을 추가하고, 전체 빌드를 검증한 뒤, 1-5에서 학습한 핵심 개념을 회고한다. 코드 변경은 `menu.ts` 단일 파일, 7줄 이내.

---

## 2. 구현 대상 파일

| 파일 | 변경 종류 | 변경량 |
|------|----------|--------|
| `src/lib/constants/menu.ts` | 수정 | import 1줄 추가 + 배열 항목 5줄 추가 |

**변경하지 않는 파일**: `src/components/layout/dashboard-sidebar.tsx` (MENU_ITEMS.map() 자동 렌더링)

---

## 3. 구현 스텝

### Phase A: 사이드바 메뉴 추가

#### Step A-1: import 수정

lucide-react import 블록에 `Users` 아이콘 추가.

#### Step A-2: MENU_ITEMS 배열에 항목 추가

"학원 관리" (index 3) 다음, "학교 관리" (index 4) 앞에 삽입:

```typescript
{
  title: '사용자 관리',
  href: '/admin/users',
  icon: Users,
  description: '사용자 역할 관리 및 조회',
},
```

**변경 후 MENU_ITEMS 순서**:
1. 대시보드 (`/`)
2. 기출문제 (`/past-exams`)
3. 문제 생성 (`/generate`)
4. 학원 관리 (`/admin/academy`)
5. **사용자 관리** (`/admin/users`) -- 신규
6. 학교 관리 (`/admin/schools`)
7. 설정 (`/settings`)

---

### Phase B: 빌드 검증

```bash
npm run test:run   # 전체 테스트 통과 (300개+)
npm run lint       # 에러 0개
npm run build      # 빌드 성공
```

---

### Phase C: 학습 리뷰 -- 1-5 전체 회고 (MANDATORY)

#### 핵심 개념 6개

| # | 개념 | Step | 핵심 포인트 |
|---|------|------|-----------|
| 1 | Defense in Depth (3중 방어) | 2 | Server Action + Zod `.strip()` + RLS |
| 2 | RBAC 매트릭스 | 2 | 역할별 허용 작업 정의, 권한 상승 방어 |
| 3 | DataTable 패턴 | 3 | createUserColumns 팩토리, URL searchParams 필터 |
| 4 | AlertDialog vs Dialog | 4 | 파괴적 작업 = AlertDialog (Escape 차단) |
| 5 | Controlled Dialog | 4 | Fragment 안에서 형제 배치 (Radix 포커스 충돌 방지) |
| 6 | useTransition + Server Actions | 2,4 | isPending으로 중복 클릭 방지 |

#### 이해도 질문 3개

1. Server Action에서 Zod `.strip()`을 사용하는 이유는? 빼면 어떤 공격이 가능?
2. 역할 변경에 Dialog 대신 AlertDialog를 사용한 이유는? UX 차이는?
3. DropdownMenu 안에 AlertDialog를 직접 넣으면 왜 문제? 해결 방법은?

---

## 4. 완료 후 문서 업데이트

| 문서 | 업데이트 |
|------|---------|
| `HANDOFF.md` | 1-5 전체 완료, 다음 작업 1-6 |
| `MEMORY.md` | 1-5 학습 회고 기록 |
| `docs/plan/phase-1-step5-user-crud.md` | Step 5 ✅ |
| 'docs/plan/phase-1-step5-5-menu-build-review.md' | Step 5-5 ✅ |
| `ROADMAP.md` | 1-5 완료 표시 |

---

## 5. 성공 기준

- [ ] menu.ts에 "사용자 관리" 메뉴 항목 추가
- [ ] 사이드바에 올바른 위치에 표시
- [ ] npm run test:run / lint / build 모두 성공
- [ ] 학습 리뷰 완료 (3개 질문 + 등급 판단)
- [ ] 문서 업데이트 + 커밋
