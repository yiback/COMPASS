# RBAC 라우트 보호 방식 기술 비교

> 작성일: 2026-03-24
> 작성자: tech-researcher 에이전트

---

## 현재 프로젝트 상태

- **Next.js 16.1.6** + React 19.2.3
- `src/middleware.ts`: 인증(로그인 여부)만 체크, 역할 체크 없음
- `src/app/(dashboard)/layout.tsx`: profiles 조회하지만 역할 체크/redirect 없음
- `admin/users/page.tsx`, `past-exams/page.tsx`: 이미 **방식 C 패턴** 사용 중

---

## 방식 A: Layout에서 headers() + 커스텀 헤더로 pathname 접근

### 동작 원리
미들웨어에서 `response.headers.set('x-pathname', request.nextUrl.pathname)` 주입 → Layout에서 `await headers()` 읽기

### 장점
- 단일 진입점, 기존 layout profiles 조회 재활용

### 단점
- Next.js App Router에서 Layout은 **의도적으로 pathname에 접근 불가** 설계 (navigation 간 layout 상태 보존)
- `x-invoke-path`는 비공식 내부 헤더 — 버전 업 시 깨질 위험
- 미들웨어에서 커스텀 헤더 주입은 공식 지원이나, 비표준 해결책

### 호환성/안정성
- `x-invoke-path`: 비공식, 불안정
- 커스텀 헤더 주입: 가능하나 우회적 방법

---

## 방식 B: 미들웨어 쿠키 캐시

### 동작 원리
로그인 시 `user-role` 쿠키 저장 → 미들웨어에서 DB 없이 역할 체크

### 장점
- 성능 최고 (DB 조회 0회)

### 단점 (치명적)
- 쿠키 조작으로 역할 우회 가능 (UX 가드 수준이지만 혼란 유발)
- admin이 역할 변경 시 해당 사용자 쿠키는 서버에서 갱신 불가 (stale 상태 지속)
- 로그인 플로우 전면 수정 필요

### 호환성/안정성
- **배제 권장**: COMPASS Defense in Depth 원칙 위배

---

## 방식 C: 각 page.tsx에서 개별 역할 체크

### 동작 원리
각 page.tsx Server Component에서 공유 헬퍼 `requireRole(allowedRoles)` 호출

### 장점
- **공식 Next.js + Vercel/Supabase 권장 패턴**
- 기존 코드베이스 완전 일치 (이미 2개 page.tsx에서 사용 중)
- pathname 접근 문제 없음
- React 19 `cache()`로 중복 DB 조회 자동 제거 (layout + page 간 실질 1회)

### 단점
- 새 page 추가 시 체크 누락 가능성 → 코드 리뷰 체크리스트로 방지
- 보일러플레이트 (2~5줄/page)

### 코드 예시

```typescript
// 공유 헬퍼
import { cache } from 'react'
export const getCurrentProfile = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles').select('id, role, academy_id').eq('id', user.id).single()
  return profile
})

// page.tsx에서 사용
const profile = await getCurrentProfile()
if (!profile || !canAccessRoute(profile.role, '/admin/users')) {
  redirect('/unauthorized')
}
```

### 호환성/안정성
- React 19 `cache()`: 안정, 공식 API
- 패턴: Next.js App Router 공식 권장

---

## 방식 D: Route Group 분리

### 동작 원리
`(admin)/layout.tsx`, `(staff)/layout.tsx` 등 역할별 레이아웃 분리

### 장점
- 역할별 단일 책임 layout

### 단점 (치명적)
- 기존 `(dashboard)/` 구조 전면 재편 필요
- 대규모 파일 이동 + import 경로 전체 업데이트
- `/admin/users`는 admin+teacher+system_admin 접근 → 순수 역할별 분리 불가
- 공통 UI(사이드바, 헤더) 중복

### 호환성/안정성
- **배제 권장**: YAGNI, 구현 비용 과다

---

## 비교표

| 기준 | A (Layout) | B (미들웨어 쿠키) | C (page.tsx) | D (Route Group) |
|------|:---:|:---:|:---:|:---:|
| Next.js 16 호환성 | 중 (비표준 헤더) | 높 | **높** | 높 |
| Supabase Auth 연동 | 높 | 중 (쿠키 동기화) | **높** | 높 |
| 성능 (DB 조회) | 0회 추가 | 0회 | 0회 (cache) | 1회/그룹 |
| 보안 (우회 가능성) | 낮 | **높** (쿠키 조작) | 낮 | 낮 |
| 유지보수성 | 중 | 낮 (동기화) | **높** | 낮 (파일 이동) |
| 기존 패턴 일치 | 낮 | 낮 | **높** | 낮 |
| 구현 비용 | M | M~L | **S** | L |

---

## 추천안

### **방식 C (page.tsx 개별 체크) + React 19 `cache()` 최적화**

| 근거 | 설명 |
|------|------|
| 공식 패턴 | Vercel/Supabase 공식 문서 권장 |
| 기존 코드 일치 | 이미 2개 page.tsx에서 동일 패턴 사용 중 |
| DB 효율 | `React.cache()`로 동일 요청 내 1회 조회 |
| 보안 | Defense in Depth 4중: Layout(UX) + page.tsx(라우트) + Action(requireRole) + RLS(DB) |
| 구현 비용 | 공유 헬퍼 2개 + 기존 인라인 코드 교체만 |

### PLAN 변경 권고

Task 3 설계 변경:
- **기존**: "Layout에서 pathname 기반 역할 체크"
- **변경**: "Layout은 RoleProvider + 사이드바 필터링, 실제 보호는 page.tsx의 requireRole()"
- HIGH 리스크 항목 해소됨
