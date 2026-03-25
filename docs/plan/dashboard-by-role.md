# 단계 2-3: 역할별 대시보드 [F018] 계획 v2

> 작성일: 2026-03-25
> 업데이트: 2026-03-25 (리뷰 SHOULD FIX 3건 반영)
> 유형: 신규 기능
> 예상 시간: 1일 (S)
> 상태: ✅ 완료 (1460 tests, E2E PASS, 코드 리뷰 2차 만장일치 PASS)

---

## 1. 요구사항

PRD [F018]: 학생/교사/관리자별 현황 요약 대시보드

### 현재 상태
- `src/app/(dashboard)/page.tsx`: 더미 통계 카드 4개 (모든 역할 동일, 값 0 고정)
- 레이아웃에서 `profile.role` 사용 가능 (getCurrentProfile → DashboardSidebar)

### MVP 범위
- 현재 DB에 **실제 데이터가 있는 테이블**만 활용 (past_exams, questions, profiles, achievement_standards 등)
- exams, exam_submissions, answers 등 미구현 테이블은 제외
- "위젯 시스템" → YAGNI. **shadcn/ui Card 인라인 사용**

---

## 2. 역할별 대시보드 내용

### admin (학원장)

| 카드 | 데이터 소스 |
|------|-----------|
| 전체 사용자 수 | `profiles` COUNT WHERE `academy_id` = X |
| 교사 / 학생 수 | `profiles` COUNT WHERE `role` = 'teacher'/'student' (2쿼리) |
| 기출문제 수 | `past_exams` COUNT WHERE `academy_id` = X |
| 생성된 문제 수 | `questions` COUNT WHERE `academy_id` = X |
| 최근 기출 업로드 | `past_exams` ORDER BY `created_at` DESC LIMIT 5 |

### teacher (강사)

| 카드 | 데이터 소스 |
|------|-----------|
| 내 기출문제 수 | `past_exams` COUNT WHERE `created_by` = userId |
| 내 생성 문제 수 | `questions` COUNT WHERE `created_by` = userId |
| 추출 완료 | `past_exams` COUNT WHERE `created_by` = userId AND `extraction_status` = 'completed' |
| 추출 대기 | `past_exams` COUNT WHERE `created_by` = userId AND `extraction_status` = 'pending' |
| 최근 업로드 | `past_exams` WHERE `created_by` = userId ORDER BY `created_at` DESC LIMIT 5 |

### student (학생)

| 항목 | 내용 |
|------|------|
| 빈 상태 안내 | "아직 배정된 시험이 없습니다" |
| 바로가기 | 문제 은행 (questions), 성취기준 탐색 (achievement-standards) |

### system_admin

| 카드 | 데이터 소스 |
|------|-----------|
| 전체 학원 수 | `academies` COUNT — `createAdminClient()` 사용 |
| 전체 사용자 수 | `profiles` COUNT — `createAdminClient()` 사용 |
| 전체 기출문제 수 | `past_exams` COUNT — `createAdminClient()` 사용 |
| 활성 성취기준 수 | `achievement_standards` COUNT WHERE `is_active` = true — `createAdminClient()` 사용 |

---

## 3. 설계 결정

| # | 결정 | 근거 |
|---|------|------|
| D1 | Server Action 1개 (`getDashboardStats`) | 역할에 따라 다른 쿼리 실행 |
| D2 | 역할별 컴포넌트: admin + teacher만 분리 | student/system_admin은 page.tsx 인라인 |
| D3 | page.tsx에서 role 분기 | `requireRole` 불필요 (모든 인증 사용자 접근 가능) |
| D4 | shadcn/ui Card 인라인 사용 | 공통 컴포넌트(stat-card 등) 불필요 — 소비자가 대시보드뿐 |
| D5 | RLS 활용 (admin/teacher) | count 쿼리는 RLS가 academy_id 자동 필터 |
| D6 | system_admin은 `createAdminClient()` 사용 | RLS가 academy_id=NULL을 차단하므로 service_role 필요 |
| D7 | teacher 컬럼명 `created_by` 사용 | `uploaded_by`는 deprecated — 실제 컬럼은 `created_by` |
| D8 | 추출 상태별 2개 쿼리 | Supabase JS SDK에서 GROUP BY 미지원 |

---

## 4. 영향 범위

### 신규 파일 (5개)

| 파일 | 역할 |
|------|------|
| `src/lib/actions/dashboard.ts` | getDashboardStats Server Action |
| `src/lib/actions/__tests__/dashboard.test.ts` | 단위 테스트 |
| `src/components/dashboard/admin-dashboard.tsx` | 학원장 대시보드 |
| `src/components/dashboard/teacher-dashboard.tsx` | 강사 대시보드 |

### 수정 파일 (1개)

| 파일 | 변경 |
|------|------|
| `src/app/(dashboard)/page.tsx` | 더미 → 역할별 대시보드 분기 (student/system_admin 인라인) |

---

## 5. Task 분해

### Task 1: Server Action (`getDashboardStats`) + 테스트

**소유 파일**:
- `src/lib/actions/dashboard.ts` (신규)
- `src/lib/actions/__tests__/dashboard.test.ts` (신규)

**내용**:
- `getCurrentUser()` import (helpers.ts 활용)
- role에 따라 분기:
  - admin → 학원 내 사용자/기출/문제 count + 최근 활동 (RLS 활용)
  - teacher → 내 기출/문제 count + 추출 상태별 2쿼리 + 최근 활동 (RLS + `created_by` 필터)
  - student → 빈 응답 (미래 확장용 구조만)
  - system_admin → `createAdminClient()`로 전체 통계
- 반환 타입: `DashboardStats` (역할별 discriminated union)
- 테스트: 역할별 4케이스 + 인증 실패 1케이스 + academyId null 1케이스

**검증**: `npx vitest run src/lib/actions/__tests__/dashboard.test.ts`

### Task 2: 역할별 대시보드 컴포넌트 + page.tsx 교체

**소유 파일**:
- `src/components/dashboard/admin-dashboard.tsx` (신규)
- `src/components/dashboard/teacher-dashboard.tsx` (신규)
- `src/app/(dashboard)/page.tsx` (수정)

**내용**:
- `AdminDashboard`: shadcn/ui Card로 통계 카드 5개 + 최근 활동 목록
- `TeacherDashboard`: shadcn/ui Card로 통계 카드 4개 + 최근 활동 목록
- `page.tsx`: `getCurrentProfile()` → `getDashboardStats()` → role 분기
  - admin → `<AdminDashboard stats={stats} />`
  - teacher → `<TeacherDashboard stats={stats} />`
  - student → 인라인 (빈 상태 + 바로가기 링크)
  - system_admin → 인라인 (전체 통계 카드 4개)

### Task 3: 전체 검증

- `npx vitest run` 전체 (1449+ tests PASS)
- `npx tsc --noEmit`
- E2E: 각 역할로 로그인 → 대시보드 확인

---

## 6. 리스크

| 등급 | 리스크 | 대응 |
|------|--------|------|
| **LOW** | count 쿼리 성능 | 현재 데이터 규모에서 문제 없음 |
| **LOW** | 학생 대시보드 콘텐츠 부족 | 빈 상태 + 바로가기로 충분 |

---

## 7. 파일 소유권 (병렬 구현 시)

| 역할 | 소유 파일 |
|------|----------|
| backend-actions | `src/lib/actions/dashboard.ts`, `__tests__/dashboard.test.ts` |
| frontend-ui | `src/components/dashboard/*`, `src/app/(dashboard)/page.tsx` |

Task 1 (backend) 완료 후 Task 2 (frontend) 진행.

---

## 8. 리뷰 이슈 반영 추적

| 이슈 | 등급 | 조치 |
|------|------|------|
| S1: `uploaded_by` → `created_by` 컬럼명 | SHOULD FIX | v2 섹션 2 + D7 수정 |
| S2: system_admin RLS 차단 | SHOULD FIX | v2 D6 — `createAdminClient()` 사용으로 변경 |
| S3: 공통 컴포넌트 불필요 | SHOULD FIX | v2 D4 — stat-card/recent-activity 제거, 인라인 처리 |
| C1: system-admin-dashboard 별도 파일 불필요 | CONSIDER | 채택 — page.tsx 인라인 |
| C2: teacher 추출 상태 2쿼리 | CONSIDER | D8 추가 |
| C3: student-dashboard 인라인 가능 | CONSIDER | 채택 — page.tsx 인라인 |
