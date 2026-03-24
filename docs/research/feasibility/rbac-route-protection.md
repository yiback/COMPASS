# RBAC 라우트 보호 — 실현 가능성 평가

> 작성일: 2026-03-24
> 작성자: feasibility-analyst 에이전트

---

## 현재 코드베이스 분석

### 라우트 구조 (page.tsx 12개)

보호가 필요한 페이지 7개:

| 경로 | 허용 역할 |
|------|-----------|
| `/admin/academy` | admin, system_admin |
| `/admin/users` | admin, teacher, system_admin |
| `/admin/schools` (+ new, edit) | admin, teacher, system_admin |
| `/past-exams/upload` | teacher, admin |
| `/past-exams/[id]/edit` | teacher, admin |
| `/generate` | teacher, admin |
| `/questions` | teacher, admin, student |

### 인증 패턴 현황 (7가지 변형)

| 패턴 | 위치 | 특징 |
|------|------|------|
| `getCurrentUserProfile()` | `users.ts`, `questions.ts`, `past-exams.ts` | 역할 체크 호출부 위임 |
| `getCurrentUserWithRole()` | `exam-management.ts`, `extract-questions.ts` | ALLOWED_ROLES 내부 체크 포함 |
| `checkAdminOrTeacherRole()` | `schools.ts` | role 배열 체크 내장 |
| `checkTeacherOrAdmin()` | `save-questions.ts`, `generate-questions.ts` | role 배열 체크 내장 |
| `checkAdminRole()` | `academies.ts` | admin 전용 |
| 직접 조회 (page.tsx) | `users/page.tsx`, `past-exams/page.tsx` | getUser → profiles.select('role') |
| 미들웨어 | `middleware.ts` | 인증 여부만, role 미확인 |

---

## 방식 A: Layout pathname 접근

### 수정 범위
- `src/middleware.ts`: `x-pathname` 헤더 주입 추가 (~5줄)
- `src/app/(dashboard)/layout.tsx`: `await headers()` + pathname 체크 (~15줄)

### 기존 아키텍처 호환성
- **낮음** — layout.tsx가 pathname을 알아야 하는 것은 Next.js App Router 설계 철학에 반함
- 비표준 해결책

### 예상 작업량: M
- 리스크: Next.js 버전 업 시 호환성 불안정

---

## 방식 B: 미들웨어 쿠키 캐시

### 수정 범위
- `src/lib/actions/auth.ts`: loginAction에 role 쿠키 설정 (~10줄)
- `src/middleware.ts`: 쿠키 읽기 + 역할 체크 (~20줄)
- `src/lib/actions/users.ts`: changeUserRole에 쿠키 갱신 로직 (불가능 — 대상 사용자 쿠키 접근 불가)

### 기존 아키텍처 호환성
- **중간** — 미들웨어 수정은 자연스러우나, 역할 변경 동기화 문제 해결 불가

### 예상 작업량: M~L
- 치명적 문제: admin이 다른 사용자 역할 변경 시 해당 사용자 쿠키 갱신 불가

---

## 방식 C: page.tsx 개별 체크

### 수정 범위
- **신규 1개**: `src/lib/auth/require-page-role.ts` (공유 헬퍼, ~20줄)
- **수정 7개**: 보호 대상 page.tsx에 2~5줄 추가

### 기존 아키텍처 호환성
- **높음** — `users/page.tsx`, `past-exams/page.tsx`에 이미 동일 패턴 존재
- 자연스러운 확장

### 예상 작업량: S
- 가장 적은 변경, 가장 높은 호환성

---

## 방식 D: Route Group 분리

### 수정 범위
- `(dashboard)/admin/` 하위 10개+ 파일 이동
- import 경로 전체 업데이트
- 공통 layout 중복 또는 depth 증가

### 기존 아키텍처 호환성
- **낮음** — 기존 구조 전면 재편

### 예상 작업량: L
- 기존 11개 page.tsx 이동 + import 전면 수정

---

## 작업량 비교표

| 방식 | 수정 파일 수 | 신규 파일 수 | 기존 패턴 호환성 | 예상 작업량 |
|------|:-----------:|:-----------:|:---------------:|:-----------:|
| A (Layout pathname) | 2 | 0 | 낮음 | M |
| B (미들웨어 쿠키) | 2 | 0 | 중간 | M~L |
| **C (page.tsx 개별)** | **7** | **1** | **높음** | **S** |
| D (Route Group) | 10+ | 2~3 | 낮음 | L |

---

## 추천: 방식 C

1. 이미 코드베이스에 동일 패턴 존재 → 일관성 최고
2. 미들웨어/layout.tsx 전역 파일 수정 없음 → 영향 범위 최소
3. role 변경 즉시 반영 (항상 DB 조회 기반)
4. React 19 `cache()`로 layout + page 간 중복 조회 제거
