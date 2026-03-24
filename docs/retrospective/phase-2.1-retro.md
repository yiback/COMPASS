# 단계 2-1 회고 — RBAC 시스템

> 일자: 2026-03-24
> 범위: 단계 2-1 RBAC (세션 31)
> 결과: 23개 파일 변경, 1390 tests, E2E 통과, 콘솔 에러 0건

---

## 1. 무엇을 했는가

### 세션 31 (1세션에 전체 완료)

| 단계 | 작업 | 소요 |
|------|------|------|
| 리서치 | tech/feasibility/devil-advocate 3명 병렬 | 빠름 |
| PLAN v1 | 마스터 PLAN 작성 (8 Task) | 빠름 |
| PLAN v2 | 리서치 결론 반영 (8→5 Task 축소) | 빠름 |
| PLAN v2.1 | 리뷰 MUST FIX 4건 반영 | 빠름 |
| 상세 계획 | Task별 상세 5개 작성 | 빠름 |
| 구현 | Wave 1~4 (Task 1 직렬 → 2+4 병렬 → 3 직렬 → 5) | 핵심 |
| 코드 리뷰 | security/perf/test 3명 → HIGH 4건 수정 | 빠름 |
| E2E | 8개 사용자 여정, 콘솔 에러 0건 | 빠름 |

---

## 2. 잘된 점 (Keep)

### 리서치 프로세스

| 패턴 | 효과 |
|------|------|
| **리서치 팀 3명 병렬** | tech-researcher + feasibility-analyst + devil-advocate. 기술 비교, 실현 가능성, YAGNI 비판을 동시에 수행 → 1페이지 추천안으로 합의 |
| **devil-advocate의 YAGNI 비판** | 8 Task → 5 Task, 30파일 → 17파일. "정말 필요한가?" 질문이 범위를 절반으로 줄임 |
| **방식 C 만장일치** | 3명 모두 page.tsx 개별 체크 추천 → Layout pathname HIGH 리스크 근본 해소 |

### PLAN 프로세스

| 패턴 | 효과 |
|------|------|
| **PLAN 리뷰 3회 제한 준수** | v1(리서치) → v2(리뷰 1차) → v2.1(리뷰 2차)로 마감. 과도 반복 없음 |
| **리뷰 MUST FIX → 즉시 반영** | system_admin null, past-exams 누락, Wave 타입 에러, questions 누락 — 4건 모두 v2.1에 반영 |
| **M 규모 → 상세 PLAN 별도 리뷰 생략** | 마스터 PLAN 리뷰 완료 = 상세 PLAN은 바로 구현. 세션 25 교훈 적용 |

### 구현 프로세스

| 패턴 | 효과 |
|------|------|
| **React 19 cache()** | layout + page 양쪽 getCurrentProfile() 호출 → DB 실질 1회. 새 API 첫 도입 성공 |
| **requireRole() Gateway** | 인증 + 프로필 + 역할 체크를 1줄로. 기존 인라인 10~15줄 → 1줄 교체 |
| **role?: Role optional prop** | Wave 2/3 간 타입 에러 방지. layout 미수정 시 undefined → 전체 메뉴 표시 |
| **ROLES.includes() 런타임 가드** | as Role 캐스팅의 안전성 보완. 코드 리뷰에서 발견 → 즉시 수정 |

### 1세션 완료

| 지표 | 이전 Phase | 이번 Phase |
|------|-----------|-----------|
| 계획 세션 | 6세션 (1-9) / 2세션 (1.5-2) | **0.5세션** |
| 구현 세션 | 1세션 (1-9) / 1세션 (1.5-2) | **0.5세션** |
| 합계 | 7세션 / 3세션 | **1세션** |

리서치 → PLAN → 리뷰 → 구현 → 코드 리뷰 → E2E를 **1세션**에 완료. PLAN 3회 제한 + devil-advocate YAGNI 축소의 효과.

---

## 3. 문제가 된 점 (Problem)

### 프로세스 문제

| 문제 | 영향 | 원인 | 해결 |
|------|------|------|------|
| **PLAN v1 HIGH 리스크 미검증** | Layout pathname 방식으로 설계 후 리서치에서 뒤집힘 | PoC 없이 PLAN 작성 | 리서치 먼저 → PLAN 작성 순서로 변경 |
| **system_admin academy_id null 누락** | PLAN v2에서 발견 못하고 리뷰에서 발견 | DB CHECK 제약조건과 코드 로직 교차 검증 미실시 | 리뷰 체크리스트에 "DB 제약조건과 코드 분기 일치" 항목 추가 |
| **보호 대상 page 누락 2건** | /past-exams, /questions가 Task 3 목록에서 빠짐 | 권한 매트릭스와 Task 목록 교차 검증 미실시 | 리뷰에서 발견 → v2.1 반영 |

### 기술 문제

| 문제 | 원인 | 교훈 |
|------|------|------|
| **admin/academy getMyAcademy 중복 쿼리** | cache()가 기존 Action 내부 쿼리에 미적용 | Action 리팩토링 없이는 해결 불가. 이번 스코프 외로 분리한 것은 올바른 결정 |
| **AUTH_ERRORS 위치 불일치** | Task 2 코드블록과 섹션 7에서 다른 파일 명시 | 코드 스니펫 내 주석과 본문 설명의 일관성 주의 |

---

## 4. 시도할 점 (Try) — 단계 2-2 이후 적용

### 프로세스
1. **리서치 → PLAN 순서 고정**: 기술 선택이 필요한 단계는 리서치 먼저 실행
2. **DB 제약조건 교차 검증**: PLAN에 DB 쿼리 로직이 있으면 해당 테이블 CHECK/FK 제약조건 확인
3. **권한 매트릭스 ↔ Task 목록 자동 검증**: 매트릭스의 모든 경로가 Task에 포함되었는지 확인

### YAGNI 판단 기준 정립
4. **"소비자 0명이면 제거"**: canAccessRoute, permissions.ts, parent 마이그레이션 모두 이 기준으로 결정
5. **"동시 변경하지 마라"**: RBAC + Action 리팩토링을 분리한 것이 범위 축소의 핵심

### 코드 품질
6. **as 캐스팅에는 런타임 가드 동반**: `profile.role as Role` → `ROLES.includes()` 선행
7. **optional prop으로 Wave 간 타입 에러 방지**: `role?: Role` 패턴 재사용

---

## 5. 수치 요약

| 지표 | 값 |
|------|------|
| 세션 수 | 1 |
| PLAN 버전 | v1 → v2 → v2.1 (3회) |
| 리서치 에이전트 | 3명 (tech/feasibility/devil-advocate) |
| 리뷰 에이전트 | tech/scope 2명 × 2차 = 4회 |
| 코드 리뷰 에이전트 | security/perf/test 3명 |
| Task 수 | 5 (v1의 8에서 축소) |
| 신규 파일 | 9개 |
| 수정 파일 | 14개 |
| 테스트 추가 | 23개 (기존 1367 → 1390) |
| CRITICAL/HIGH (코드 리뷰) | 0/4 (전부 수정) |
| E2E 여정 | 8개 |
| 콘솔 에러 | 0건 |

---

## 6. 핵심 기술 교훈 Top 5

1. **React 19 cache()**: `import { cache } from 'react'` — 동일 서버 요청 내 함수 호출 중복 제거. layout + page에서 같은 함수를 호출해도 DB는 1회만 실행
2. **page.tsx 개별 역할 체크 (방식 C)**: Next.js App Router에서 Layout은 pathname 접근 불가. page.tsx에서 `requireRole()` 직접 호출이 공식 권장 패턴
3. **system_admin academy_id null**: DB CHECK `role = 'system_admin' OR academy_id IS NOT NULL` → 코드에서도 동일 분기 필요. DB 제약조건과 코드 로직의 교차 검증 필수
4. **ROLES.includes() 런타임 가드**: `as Role` 타입 캐스팅은 컴파일 타임 only. DB에서 잘못된 role이 오면 런타임에서 조용히 통과 → includes 가드로 방어
5. **devil-advocate YAGNI 비판**: "소비자 0명이면 제거" 원칙으로 8→5 Task, 30→17 파일 축소. 리서치 팀에 반드시 포함할 역할

---

## 7. 다음 Phase 적용 체크리스트

- [ ] 기술 선택이 필요한 단계는 리서치 먼저 실행
- [ ] DB 제약조건과 코드 분기 교차 검증
- [ ] 권한 매트릭스 ↔ Task 목록 일치 확인
- [ ] PLAN 리뷰 3회 제한 유지
- [ ] devil-advocate 역할 리서치 팀에 포함
- [ ] as 캐스팅에 런타임 가드 동반
- [ ] optional prop으로 Wave 간 타입 에러 방지
