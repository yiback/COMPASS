# 2-1 RBAC 코드 리뷰 — 최종 리포트

> 작성일: 2026-03-24
> 리뷰어: security-reviewer, perf-reviewer, test-reviewer
> 대상: RBAC 구현 (23개 파일, 1386 tests)

---

## 종합 판정

| 등급 | security | perf | test | 합계 |
|------|:---:|:---:|:---:|:---:|
| CRITICAL | 0 | 0 | 0 | **0** |
| HIGH | 0 | 2 | 4 | **6** |
| MEDIUM | 3 | 2 | 5 | **10** |
| LOW | 4 | 2 | 3 | **9** |

**CRITICAL 0건 — 배포 차단 이슈 없음.**

---

## HIGH 이슈 (6건)

### security (0건)
없음.

### perf (2건)

| # | 이슈 | 파일 | 조치 |
|---|------|------|------|
| P-H1 | admin/academy — getMyAcademy()가 cache() 밖에서 auth+profiles 중복 쿼리 (요청당 5쿼리) | `academies.ts`, `admin/academy/page.tsx` | **이번 스코프 외** — 독립 Action 리팩토링 이슈. 기존 코드 문제이며 RBAC가 악화시키지 않음 |
| P-H2 | upload/page.tsx — createClient 2회 인스턴스화 | `past-exams/upload/page.tsx` | **수용** — 쿼리 중복 아닌 객체 생성 비용(~1ms). Action 리팩토링 시 함께 처리 |

### test (4건)

| # | 이슈 | 조치 |
|---|------|------|
| T-H1 | `requireRole([])` 빈 배열 호출 시 동작 미검증 | **수정** — 테스트 1개 추가 |
| T-H2 | getCurrentProfile DB 에러 반환 시 동작 미검증 | **수정** — 테스트 1개 추가 |
| T-H3 | DB에서 알 수 없는 role 문자열 시 동작 미검증 | **수정** — ROLES.includes 런타임 가드 + 테스트 추가 (security M1과 연동) |
| T-H4 | ROUTE_PERMISSIONS와 page.tsx requireRole 인자 일치 검증 테스트 없음 | **수정** — 테스트 추가 |

---

## MEDIUM 이슈 (10건) — 구현 중 처리 가능

| # | 출처 | 이슈 | 조치 |
|---|------|------|------|
| S-M1 | security | `as Role` 런타임 검증 부재 | **수정** — ROLES.includes 가드 추가 (T-H3과 함께) |
| S-M2 | security | redirect throw 동작 주석 부재 | **수정** — 주석 1줄 추가 |
| S-M3 | security | canEdit = true 하드코딩 | **수용** — system_admin이 academy 없으면 getMyAcademy 에러 화면. 실질 위험 없음 |
| P-M1 | perf | cache() Server Action 미적용 주의 | **문서화** — 코드 주석 추가 |
| P-M2 | perf | 사이드바 filter useMemo 불필요 확인 | **수용** — 8개 항목 filter 비용 무시 가능 |
| T-M1 | test | cache() mock + resetModules 부재 | **수용** — identity mock이므로 영향 없음 |
| T-M2 | test | readonly 런타임 보장 테스트 없음 | **수용** — TypeScript 컴파일 타임 보장 |
| T-M3 | test | isTeacherOrAbove 파생 로직 테스트 없음 | **수용** — E2E에서 확인 |
| T-M4 | test | Supabase mock select 인자 검증 없음 | **수용** — 단위 테스트 범위 |
| T-M5 | test | canEdit 항상 true 테스트 없음 | **수용** — S-M3과 동일 |

---

## 수정 대상 요약

| 수정 | 파일 | 내용 |
|------|------|------|
| **S-M1 + T-H3** | `get-current-user.ts` | `ROLES.includes()` 런타임 가드 1줄 추가 |
| **S-M2** | `require-role.ts` | redirect throw 주석 1줄 추가 |
| **T-H1** | `require-role.test.ts` | 빈 배열 테스트 1개 추가 |
| **T-H2** | `require-role.test.ts` | DB 에러 테스트 1개 추가 |
| **T-H3** | `require-role.test.ts` | unknown role 테스트 1개 추가 |
| **T-H4** | `roles.test.ts` | ROUTE_PERMISSIONS 일치 검증 테스트 추가 |

---

## Defense in Depth 체크

| 계층 | 상태 |
|------|------|
| 미들웨어 (인증) | ✅ 변경 없음 |
| page.tsx (requireRole) | ✅ 9개 페이지 보호 |
| 사이드바 (UX 가드) | ✅ 역할별 메뉴 필터링 |
| Server Action (기존) | ✅ 변경 없음 유지 |
| RLS (DB) | ✅ 변경 없음 유지 |
