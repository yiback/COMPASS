# 세션 33 회고 — 인프라 부채 정리 + 단계 2-3 대시보드

> 날짜: 2026-03-25
> 범위: 코드 리뷰 잔여 4건 + 테스트 수정 2건 + 인증 헬퍼 통합 + 역할별 대시보드

---

## 작업 요약

| 커밋 | 내용 | 테스트 |
|------|------|--------|
| `dfcf1f5` | 코드 리뷰 잔여 이슈 4건 정리 | 1432 |
| `8525390` | extract-questions 테스트 2건 수정 | 1434 |
| `fa56f80` | 인증 헬퍼 12개 → getCurrentUser() 1개 통합 | 1449 |
| `70776b7` | 단계 2-3 역할별 대시보드 [F018] | 1460 |
| `b6e010c` | 문서 업데이트 | - |

**총 수정**: ~60파일, 순수 코드 감소 ~1000줄, 테스트 1434 → 1460

---

## Keep (잘한 것 — 반복할 패턴)

### 1. 인프라 부채 먼저 정리 → 기능 개발
- 코드 리뷰 잔여 → 테스트 실패 → 인증 헬퍼 통합 → **그 다음** 대시보드
- 기술 부채가 쌓인 상태에서 기능 추가하면 복잡도 폭발. 정리 후 시작이 효율적

### 2. 인증 헬퍼 통합의 3 에이전트 병렬 구현
- Agent A(users/questions/past-exams), B(extract/exam/generate/save), C(academies/schools/achievement)
- 파일 소유권 명확 → 충돌 0건, 3개 에이전트가 동시에 ~25파일 수정

### 3. 리뷰 MUST FIX 0이면 즉시 구현
- PLAN 리뷰 3회 제한 규칙 준수
- 마스터 PLAN → 리뷰 → 상세 PLAN → 리뷰 → 구현 (총 2회 리뷰)
- 대시보드는 마스터 + 상세 합쳐서 2회 리뷰로 끝남

### 4. Sequential Thinking MCP 활용
- 복잡한 설계 결정(인증 헬퍼 통합 전략, 대시보드 쿼리 설계)에 ST 사용
- 3~6 thought로 분석 → 명확한 결론 도출

### 5. 코드 리뷰 `await` 발견
- `return fetchSystemAdminStats()` → `return await fetchSystemAdminStats()`
- try/catch 안에서 `return promise`는 reject 시 catch 미작동 — 리뷰어가 발견

---

## Problem (문제점 — 개선 필요)

### 1. PLAN에서 헬퍼 변형 7개 → 실제 12개 누락
- 초기 PLAN 작성 시 grep 범위가 부족 (함수 정의만 검색, 인라인 코드 미포함)
- **교훈**: 리팩토링 PLAN 작성 시 `supabase.auth.getUser` 같은 패턴으로 전수 검색 필수

### 2. 테스트 파일명 불일치
- PLAN에 `questions.test.ts`라고 썼지만 실제는 `questions-list.test.ts` + `questions-detail.test.ts`
- **교훈**: PLAN 작성 시 `Glob('__tests__/*.test.ts')`로 실제 파일 목록 확인

### 3. 마이그레이션 00004 "미적용" 기록 오류
- HANDOFF.md에 "미적용"으로 기록되었지만 실제로는 이미 적용됨
- SQL 실행 시 `column already exists` 에러로 발견
- **교훈**: 마이그레이션 적용 시 즉시 HANDOFF.md 업데이트. "확인 안 됨"과 "미적용"을 구분

### 4. 대시보드 인증 2회 중복
- `getCurrentProfile()` (page.tsx, cache 적용) + `getCurrentUser()` (Server Action, cache 미적용)
- 같은 요청에서 auth.getUser + profiles SELECT가 2번 실행
- MVP에서 허용했지만, 향후 profile 주입 패턴으로 개선 필요

---

## Try (다음에 시도할 것)

### 1. 리팩토링 PLAN 시 전수 검색 패턴 표준화
```bash
# 함수 정의 검색 (기존)
grep "async function check|async function getCurrent"
# 패턴 검색 (추가 — 인라인 코드도 포착)
grep "supabase.auth.getUser"
```

### 2. getDashboardStats에 profile 주입
```typescript
// 현재: 내부에서 getCurrentUser() 호출 (인증 2회)
export async function getDashboardStats(): Promise<DashboardResult>

// 개선: profile을 매개변수로 받기 (인증 1회)
export async function getDashboardStats(profile: ActionProfile): Promise<DashboardResult>
```

### 3. 세션 시작 시 인프라 부채 체크리스트
- HANDOFF.md "진행 중 이슈" 섹션을 먼저 확인
- 부채 0건이면 기능 개발 시작, 있으면 먼저 정리

---

## 기술 교훈 Top 5

1. **`return await` vs `return promise`**: async 함수의 try/catch 안에서 `return promise`는 reject 시 catch가 잡지 못함. `return await promise` 필수
2. **Supabase count 패턴**: `select('*', { count: 'exact', head: true })` → 데이터 미반환, count만. RLS 자동 적용
3. **system_admin RLS 차단**: `get_user_academy_id()` → NULL → `NULL = NULL` = FALSE. 전체 통계 필요 시 `createAdminClient()` 사용
4. **discriminated union**: `DashboardStats = AdminStats | TeacherStats | ...` — `stats.role`로 타입 좁히기, switch 대신 if 분기
5. **React.memo 안의 useMemo**: memo는 props 전체 동일 시 리렌더 방지, useMemo는 특정 의존성만 동일 시 계산 방지 — 서로 다른 시나리오 커버

---

## 수치

| 항목 | 값 |
|------|-----|
| 커밋 수 | 5 |
| 수정 파일 | ~60 |
| 순수 코드 감소 | ~1000줄 |
| 테스트 증가 | 1434 → 1460 (+26) |
| 코드 리뷰 | 4회 (인증 2차 + 대시보드 2차) |
| E2E | admin 대시보드 PASS, 콘솔 에러 0건 |
| 에이전트 스폰 | ~25회 |
