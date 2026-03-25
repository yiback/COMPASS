# Dashboard Test Review

**리뷰 대상**
- `src/lib/actions/dashboard.ts`
- `src/lib/actions/__tests__/dashboard.test.ts`

**리뷰어**: test-reviewer
**날짜**: 2026-03-25

---

## 1. 커버리지 체크리스트

| 항목 | 상태 | 비고 |
|------|------|------|
| admin 정상 | ✅ | 테스트 #3 |
| teacher 정상 | ✅ | 테스트 #5 |
| student 즉시 반환 | ✅ | 테스트 #7 |
| system_admin 정상 | ✅ | 테스트 #8 |
| 미인증 에러 | ✅ | 테스트 #1 |
| admin academyId null | ✅ | 테스트 #2 |
| teacher academyId null | ✅ | 테스트 #11 |
| 데이터 0건 (admin) | ✅ | 테스트 #4 |
| 데이터 0건 (teacher) | ✅ | 테스트 #6 |
| DB 에러 try/catch | ✅ | 테스트 #9 |
| snake→camelCase 변환 | ✅ | 테스트 #10 |
| createAdminClient 격리 | ⚠️ | system_admin 테스트에서 mockAdminSupabase 사용 확인 가능하나, admin/teacher 시 createAdminClient가 **호출되지 않음**을 명시적으로 assert하는 테스트 없음 |

---

## 2. 이슈 목록

### MEDIUM

#### M-1: `createAdminClient` 비호출 검증 누락
- **위치**: 테스트 #3 (admin), #5 (teacher), #7 (student)
- **문제**: `createAdminClient`가 admin/teacher/student 경로에서 호출되지 않는지 명시적으로 검증하지 않음. 코드에서 실수로 `createAdminClient()`를 잘못된 분기에 추가해도 테스트 통과
- **권장**: 세 케이스에 `expect(vi.mocked(createAdminClient)).not.toHaveBeenCalled()` 추가

#### M-2: 알 수 없는 역할(unknown role) 방어 경로 미테스트
- **위치**: `dashboard.ts` 132줄 — `return { error: '대시보드 데이터를 불러올 수 없습니다.' }` (unknown role fallback)
- **문제**: `getCurrentUser`가 `role: 'unknown_role'`인 profile을 반환할 때의 방어 분기를 테스트하지 않음
- **권장**: `vi.mocked(getCurrentUser).mockResolvedValue({ profile: { id: 'x', role: 'unknown' as Role, academyId: null } })` + 에러 반환 assert

#### M-3: DB 에러 케이스가 `createClient` throw만 테스트
- **위치**: 테스트 #9
- **문제**: `createClient`가 reject하는 케이스만 커버. 개별 쿼리(`.from('profiles')`, `.from('past_exams')`) 결과의 `error` 필드가 있을 때 처리 여부를 테스트하지 않음. 현재 구현은 `error` 필드를 무시하고 `count ?? 0`으로 처리하므로 실제로는 실패해도 0을 반환
- **권장**: `mockCountResult`에 `error` 필드를 포함한 케이스 추가 또는 현재 구현의 `error` 무시 동작을 명시적으로 문서화

### LOW

#### L-1: `recentPastExams`가 null인 경우 (`data: null`) 미테스트
- **위치**: `toRecentPastExams` 함수 — `if (!rows || rows.length === 0) return []`
- **문제**: `mockSelectResult`는 항상 배열을 반환. `recentRes.data`가 `null`인 경우(네트워크 에러 등)의 방어 경로 테스트 없음
- **권장**: `{ count: null, data: null, error: 'network error' }` 형태의 케이스를 최근 기출 쿼리 슬롯에 설정하여 `recentPastExams: []` 반환을 확인

#### L-2: `system_admin`에서 `createClient`가 호출되지 않는다는 검증 누락
- **위치**: 테스트 #8
- **문제**: system_admin 경로에서 `createClient`(RLS 적용 클라이언트)가 사용되지 않고 `createAdminClient`만 사용하는 것이 의도임. 이를 명시적으로 assert하지 않음
- **권장**: `expect(vi.mocked(createClient)).not.toHaveBeenCalled()` 추가

#### L-3: `fetchSystemAdminStats`는 `await` 없이 호출
- **위치**: `dashboard.ts` 128줄 — `return fetchSystemAdminStats()` (`await` 없음)
- **문제**: `fetchSystemAdminStats`는 `async` 함수이므로 `await` 없이 호출해도 동작은 하지만, try/catch가 해당 함수 내부의 throw를 잡지 못함 (Promise가 상위로 전파됨)
- **현재 테스트 상태**: DB 에러 테스트가 `createClient` throw만 테스트하므로 이 경로의 에러 처리가 검증되지 않음
- **권장**: `createAdminClient`가 throw할 때의 케이스 추가 (`mockRejectedValueOnce` 대신 `mockImplementationOnce(() => { throw new Error(...) })`)

---

## 3. 긍정적 평가

- Proxy 기반 체인 mock이 Supabase 쿼리 빌더 패턴을 깔끔하게 처리
- `callIndex`로 `Promise.all` 내 순서 기반 결과 주입 방식이 명확
- admin, teacher, student, system_admin 4개 역할 모두 Happy Path 커버
- 데이터 0건 케이스 별도 테스트 (admin, teacher 각각)
- camelCase 변환 키 존재 + snake_case 키 부재 동시 검증
- `beforeEach(() => vi.clearAllMocks())` 테스트 격리 올바름

---

## 4. 판정

**READY** — 핵심 경로(4개 역할, 인증 실패, academyId null, 0건, DB 에러, 변환)가 모두 커버됨. M-1/M-2/M-3은 구현 중 또는 완료 후 보완 가능한 수준.

단, M-3의 쿼리 수준 에러 무시(error 필드 무시 + `count ?? 0`) 동작은 운영 환경에서 잘못된 0을 반환할 수 있으므로 **SHOULD FIX**로 구현팀에 전달 권장.
