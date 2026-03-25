# 대시보드 상세 계획 일관성 리뷰 (consistency-reviewer)

> 검토 대상: `docs/plan/dashboard-tasks-detail.md`
> 참조 문서: `ROADMAP.md`, `docs/retrospective/phase-2.1-retro.md`, `docs/retrospective/phase-2.2-retro.md`, `MEMORY.md`, `src/lib/actions/helpers.ts`
> 작성일: 2026-03-25
> 규칙: 읽기 전용 — 소스 코드 및 PLAN 파일 수정 금지

---

## 1. ROADMAP.md 2-3 항목과 PLAN 일치 여부

### ROADMAP 2-3 항목
```
- [ ] 학원장 대시보드 (학원 현황, 통계)
- [ ] 강사 대시보드 (담당 학생, 시험 현황)
- [ ] 학생 대시보드 (내 시험, 성적 추이)
- [ ] 대시보드 위젯 시스템
```

### 검토 결과

| ROADMAP 항목 | PLAN 반영 | 판정 |
|------------|----------|------|
| 학원장 대시보드 (학원 현황, 통계) | `AdminDashboard` — 사용자/기출/문제 카드 5개 ✅ | OK |
| 강사 대시보드 (담당 학생, 시험 현황) | `TeacherDashboard` — 기출/문제/추출 통계 ✅ | OK |
| 학생 대시보드 (내 시험, 성적 추이) | 인라인 빈 상태 + 바로가기 — 단, 성적 추이는 미구현 테이블 의존 | ✅ MVP 범위 내 |
| 대시보드 위젯 시스템 | YAGNI 결정(D4)으로 제거. shadcn Card 인라인 사용 | ✅ 명시적 의사결정 |

**판정**: ROADMAP과 PLAN의 불일치 없음. "위젯 시스템" YAGNI 결정이 마스터 PLAN v2에서 D4로 명시되었음.

**주의**: ROADMAP 2-3 강사 대시보드는 "담당 학생, 시험 현황"으로 명시되어 있으나, PLAN은 기출/추출 통계 중심으로 설계됨. 현재 exams 테이블 미구현 상태에서 올바른 MVP 범위 결정이며, 마스터 PLAN v2에서 이미 의사결정되었음.

---

## 2. 회고 교훈 반영 여부

### phase-2.1-retro.md 교훈 검토

| 교훈 | PLAN 반영 여부 |
|------|--------------|
| ROLES.includes() 런타임 가드 | `helpers.ts`의 `getCurrentUser()`에서 이미 처리됨. PLAN이 `getCurrentUser()` 재사용하므로 자동 적용 ✅ |
| system_admin academy_id null 처리 | PLAN 상세: Task 2 테스트 케이스 #2 "academyId null (admin)" — 단, `academyId null`인 경우 error 반환으로 처리. `system_admin` 경우는 별도 분기 ✅ |
| DB 제약조건과 코드 분기 교차 검증 | `system_admin`은 `createAdminClient()` 사용(RLS 우회), admin은 RLS 의존 — helpers.ts와 일관성 ✅ |
| optional prop으로 Wave 간 타입 에러 방지 | Task 1 → Task 2 의존성. Task 2는 Task 1 완료 후 진행으로 명시. 병렬 구현 없음 ✅ |
| redirect() 대신 { error } 반환 | PLAN의 `DashboardResult` 타입: `{ error?: string, stats?: DashboardStats }` ✅ |

### phase-2.2-retro.md 교훈 검토

| 교훈 | PLAN 반영 여부 |
|------|--------------|
| Defense in Depth 3계층 (page + Action + RLS) | page.tsx에서 `getCurrentProfile()` 인증 확인 + Action 내 `getCurrentUser()` 이중 체크 ✅ |
| JSON.parse try/catch 필수 | 대시보드 Action에서 JSON 파싱 없음 (FormData 미사용). 해당 없음 ✅ |
| 타입 정의와 마이그레이션 동시 확장 | 신규 마이그레이션 없음. 기존 테이블만 COUNT. 해당 없음 ✅ |
| 의사결정 주석 달기 | PLAN v2 섹션 3에 D1~D8 의사결정 명시 ✅ |
| UPSERT 불변 필드 분리 | 대시보드는 읽기 전용. 해당 없음 ✅ |

### MEMORY.md 기술 교훈 검토

| 교훈 (MEMORY.md) | PLAN 반영 여부 |
|-----------------|--------------|
| Server Action `{ error }` 반환 패턴 | `DashboardResult.error?: string` — 일관성 ✅ |
| IDOR 방어 (`academy_id` 필터) | admin 쿼리는 RLS 의존. 명시적 `.eq('academy_id')` 없음 — **주의 참조** |
| `createAdminClient()` RLS 우회 | system_admin 전용 명시 (D6). 패턴 일관성 ✅ |
| `sanitizeFilters` 빈 문자열 처리 | 필터 파라미터 없음. 해당 없음 ✅ |
| React 19 `cache()` — layout + page DB 1회 | PLAN: `page.tsx`에서 `getCurrentProfile()` + `getDashboardStats()` 2회 호출 — 구현자 주의 필요 |

---

## 3. 기존 src/lib/actions/ 패턴과 일관성

### helpers.ts 활용

PLAN Task 1 mock 패턴에서:
```typescript
import { getCurrentUser } from '../helpers'
vi.mock('../helpers', () => ({ getCurrentUser: vi.fn() }))
```

**현재 helpers.ts 실제 시그니처**:
```typescript
export async function getCurrentUser(): Promise<GetCurrentUserResult>
// GetCurrentUserResult = { error?: string, profile?: ActionProfile }
// ActionProfile = { id: string, role: Role, academyId: string | null }
```

PLAN 상세 계획의 `profile.id`, `profile.role`, `profile.academyId` 사용 패턴이 `ActionProfile` 타입과 일치함 ✅

### { error } 반환 패턴

기존 Action들 (`schools.ts`, `achievement-standards.ts` 등) 모두 `{ error?: string, data?: unknown }` 패턴 사용.

PLAN의 `DashboardResult = { error?: string, stats?: DashboardStats }` — 동일 패턴 ✅

### 'use server' 선언

PLAN 상세 계획에 `'use server'` 지시문 명시 없음. 기존 모든 Action 파일은 첫 줄에 `'use server'` 필수.

---

## 4. 이슈 목록

### MUST FIX

없음.

---

### SHOULD FIX

#### S1: admin 쿼리에 RLS 의존 — 명시적 아카데미 필터 누락 가능성

**위치**: Task 1 쿼리 설계 — admin 6쿼리 블록
**내용**:
```typescript
// RLS가 academy_id 자동 필터 → 같은 학원 데이터만 반환
supabase.from('profiles').select('*', { count: 'exact', head: true })
```
**우려사항**: MEMORY.md IDOR 방어 교훈에서 "모든 UPDATE/DELETE에 `.eq('academy_id', ...)` 포함 확인"을 강조함. admin COUNT 쿼리는 RLS가 처리하지만, **RLS 설정이 잘못되었거나 createClient가 인증 컨텍스트 없이 호출될 경우** 전체 데이터 노출 위험이 있음.

**권장**: PLAN 주석에 "admin 쿼리는 RLS 의존. `supabase auth.getUser()` 통해 인증된 컨텍스트 필요" 명시. 구현 시 `createClient()`가 SSR 쿠키 기반 인증 컨텍스트를 올바르게 전달하는지 확인.

---

#### S2: `'use server'` 지시문 명시 누락

**위치**: Task 1 — `src/lib/actions/dashboard.ts` 구현 가이드
**내용**: PLAN 상세 코드 블록에 `'use server'` 지시문이 명시되어 있지 않음.
**근거**: 기존 모든 Server Action 파일(`schools.ts`, `achievement-standards.ts` 등)이 파일 첫 줄에 `'use server'` 선언. MEMORY.md에도 "'use server' 파일에서 export const runtime 무효" 교훈이 있어 이 지시문의 중요성이 강조됨.
**권장**: 구현자에게 `'use server'` 첫 줄 필수임을 PLAN에 명시.

---

#### S3: page.tsx에서 `getCurrentProfile()` import 경로 확인 필요

**위치**: Task 2 page.tsx 코드 블록
```typescript
import { getCurrentProfile } from '@/lib/auth'
```
**우려사항**: `getCurrentProfile`이 `@/lib/auth`에서 export되는지 확인 필요. 기존 코드베이스에서 `auth/index.ts`의 export 구성에 따라 경로가 다를 수 있음. 현재 helpers.ts는 `@/lib/auth`에서 `ROLES`, `Role`을 import함.
**권장**: 구현 전 `src/lib/auth/index.ts` 배럴 파일 확인.

---

### CONSIDER

#### C1: `getCurrentProfile()` + `getDashboardStats()` 이중 호출 비용

**위치**: Task 2 — page.tsx 구현
**내용**: page.tsx에서 `getCurrentProfile()`(React 19 cache 적용)과 `getDashboardStats()`(내부에서 `getCurrentUser()` 호출) 2회 인증 조회. React 19 `cache()`가 Server Action 컨텍스트에서는 미적용(MEMORY.md 교훈)이므로 실질적으로 인증 DB 조회 2회 발생.
**영향**: 대시보드 S 규모에서 성능 영향 미미. 그러나 패턴 일관성 관점에서 향후 리팩토링 대상.
**현황**: 마스터 PLAN v2에서 명시적으로 결정하지 않은 사항. MVP에서는 허용 가능.

---

#### C2: `system_admin` 인라인 UI 미완성

**위치**: Task 2 — page.tsx 코드 블록 내 system_admin 섹션
```tsx
{/* system_admin — 인라인 */}
{stats.role === 'system_admin' && (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    {/* 4개 카드: academyCount, totalUsers, totalPastExams, activeStandardsCount */}
  </div>
)}
```
**내용**: PLAN 상세 코드 블록에 system_admin UI가 주석으로만 표시되어 있음. 구현자가 마스터 PLAN v2 섹션 2 (`system_admin` 테이블)를 참조해야 함.
**영향**: 마스터 PLAN v2에 데이터 소스가 명시되어 있어 구현자는 참조 가능. 단, 카드 레이블(한국어) 등이 상세 계획에 없음.

---

## 5. Plan Review Completion Checklist 판정

| 항목 | 판정 |
|------|------|
| 모든 Task의 파일 소유권이 명확하다 | ✅ (마스터 PLAN v2 섹션 7) |
| Task 간 의존성 순서가 정의되었다 | ✅ (Task 1 완료 후 Task 2) |
| 외부 의존성(라이브러리, API)이 명시되었다 | ✅ (shadcn/ui Card, createAdminClient, Promise.all) |
| 에러 처리 방식이 정해졌다 | ✅ (`{ error }` 반환, 개별 count 0 폴백) |
| 테스트 전략이 있다 | ✅ (10개 케이스, mock 패턴 명시) |
| 이전 Phase 회고 교훈이 반영되었다 | ✅ (2-1, 2-2 교훈 반영 확인) |
| 병렬 구현 시 파일 충돌 가능성이 없다 | ✅ (Task 1 직렬 → Task 2, 파일 소유 분리) |

---

## 6. 종합 판정

**READY** — MUST FIX 0건.

SHOULD FIX 3건(S1~S3)은 구현자가 주의할 패턴이며, 기존 코드베이스 관행과 MEMORY.md 교훈에서 도출됨. 마스터 PLAN의 의사결정(D1~D8)이 명확하고, 회고 교훈이 잘 반영되어 있음.

구현 진행 가능. 구현자는 S1(RLS 인증 컨텍스트), S2(`'use server'` 첫 줄), S3(import 경로) 3가지를 구현 시 확인할 것.
