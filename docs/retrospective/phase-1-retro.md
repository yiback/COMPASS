# Phase 1 전체 회고 — 기출 기반 문제 생성 + 인증 + LaTeX 렌더링

> 일자: 2026-03-22
> 범위: Phase 0 → 단계 1 (1-1~1-9) → 단계 1.5-1 (LaTeX 렌더링) — 세션 1~28
> 결과: 1269+ tests, E2E 통과, 빌드 성공

---

## 1. 무엇을 했는가

### Phase 0 (세션 1~10)
- 프로젝트 초기화 (Next.js 16 + React 19 + Supabase)
- DB 스키마 15개 테이블 + RLS + 트리거
- 공통 UI 컴포넌트 (DataTable, Form, Modal, Toast, Skeleton)
- AI 추상화 레이어 (Factory + Strategy, GeminiProvider, 94 tests)

### 단계 1 (세션 11~26)
| 스텝 | 작업 | 주요 성과 |
|------|------|----------|
| 1-1 | 인증 시스템 | 회원가입/로그인/세션 미들웨어 |
| 1-2 | 기출문제 업로드 | 이미지/PDF 업로드 + Storage |
| 1-3 | 학교 관리 CRUD | DataTable + 권한 체크 |
| 1-4 | 학원 관리 CRUD | 학원 정보 + 초대 코드 |
| 1-5 | 사용자 관리 CRUD | 역할 변경 + 상세 조회 |
| 1-6 | 기출문제 조회 | 서버사이드 페이지네이션 + Signed URL (347 tests) |
| 1-7 | AI 문제 생성 | 프롬프트 빌더 + GeminiProvider 통합 (404 tests) |
| 1-8 | 문제 저장 | Accordion UI + savedIndices Set (535 tests) |
| 1-9 | 기출문제 추출 | 3계층 스키마 + 병렬 구현 5-Wave (1235 tests) |

### 단계 1.5-1 (세션 28)
- KaTeX 기반 LaTeX 수식 렌더링
- Single Pass 파서 + React.memo 렌더러
- EditMode Live Preview (300ms debounce)
- 31 tests + E2E 시각적 검증

---

## 2. 잘된 점 (Keep)

### 아키텍처 결정
| 결정 | 효과 |
|------|------|
| **Defense in Depth (3중 방어)** | RLS + Server Action + Zod — 한 층이 뚫려도 다른 층이 방어. 보안 사고 0건 |
| **Self-referencing ID** | profile.academy_id로 IDOR 공격 원천 차단. URL 파라미터 신뢰 금지 |
| **AI 추상화 레이어 (Factory + Strategy)** | GeminiProvider 교체/확장이 쉬움. 추출/생성/재분석 3기능이 동일 인터페이스 |
| **Server Action `{ error }` 반환** | throw 대신 에러 객체 → 클라이언트에서 일관된 분기 처리. 에러 바운더리 우회 |

### 개발 프로세스
| 패턴 | 효과 |
|------|------|
| **TDD RED→GREEN→REFACTOR** | 테스트 먼저 작성 → 구현 시 막힘 감소. 리팩토링 시 안전망 역할 |
| **Agent Team 리뷰 (3팀 병렬)** | tech/scope/consistency 관점이 서로 다른 이슈 발견. 단독 리뷰 대비 커버리지 2배+ |
| **5-Wave 병렬 구현** | 파일 소유권 명확 → 충돌 0건. 구현 속도 극대화 |
| **E2E 테스트 (Chrome DevTools MCP)** | Mock 테스트로 잡지 못하는 실제 브라우저 이슈 발견 (race condition, DnD 등) |
| **PLAN 리뷰 3회 제한** | 세션 28에서 적용 → PLAN v2에서 구현 시작. 과도 반복 방지 |

### 학습 방법
| 방법 | 효과 |
|------|------|
| **빈칸 채우기 재구현** | 전체 삭제가 아닌 핵심 로직만 빈칸 → 좌절감 없이 핵심 이해 |
| **구현 후 즉시 학습 리뷰** | 코드가 눈앞에 있을 때 개념 설명 → 이해도 질문 → 기억 정착률 높음 |
| **🔴/🟡/🟢 레벨 구분** | 보안/새 패턴=재구현 필수, 반복 패턴=AI OK → 학습 시간 최적화 |

---

## 3. 문제가 된 점 (Problem)

### 프로세스 문제
| 문제 | 영향 | 원인 | 해결 |
|------|------|------|------|
| **PLAN 9회 반복** (1-9) | 계획 6세션, 구현 1세션 | 리뷰 종료 조건 불명확 | 3회 제한 규칙 도입 (세션 28에서 효과 검증) |
| **체크리스트 미출력** | 워크플로우 일관성 저하 | 습관화 부족 | Hook으로 강제 리마인더 추가 |
| **학습 리뷰 생략** | 사용자 학습 기회 놓침 | 구현 완료=작업 완료로 착각 | CLAUDE.md에 MANDATORY 명시 |
| **계획 없이 코드 작성** (5회+) | 방향 틀어지면 전면 재작업 | "간단하니까" 판단 | `docs/plan/` 존재 확인 강제 |

### 기술 문제
| 문제 | 원인 | 교훈 |
|------|------|------|
| **IDOR 9곳 누락** (1-9) | 상세 계획에서 academy_id 필터 미명시 | 모든 UPDATE/DELETE에 academy_id 필터 체크리스트 |
| **`gemini-2.0-flash` 사용 불가** | Google API 정책 변경 | 환경변수로 모델 분리 + 폴백 기본값 관리 |
| **AI crop 정확도 부족** (1-9) | bounding box 좌표 오차 큼 | crop 기능 자체 제거 → AI 도형 생성으로 전환 |
| **Next.js 16 body size 제한** | middleware proxy 10MB 제한 | Route Handler 우회 패턴 |
| **`/g` 플래그 lastIndex** (1.5-1) | 전역 RegExp는 stateful | 함수 진입 시 `lastIndex = 0` 리셋 필수 |

---

## 4. 시도할 점 (Try) — 단계 1.5-2 및 단계 2에 적용

### 프로세스
1. **PLAN 리뷰 최대 3회 유지**: 세션 28에서 효과 검증됨. 계속 유지
2. **상세 계획 별도 리뷰 생략**: 마스터 PLAN 리뷰 완료 = 구현 진행
3. **Step 단위 빌드 체크**: Wave 완료가 아닌 각 에이전트 완료 즉시
4. **마스터 PLAN ↔ 상세 PLAN 동기화**: 리뷰 결정 변경 시 양쪽 즉시 업데이트

### 보안
5. **academy_id 필터 체크리스트**: 모든 DB 쿼리에 적용
6. **프롬프트 인젝션 방어**: 사용자 입력이 AI 프롬프트에 포함될 때 sanitize
7. **`dangerouslySetInnerHTML` 이스케이프**: catch 폴백에서도 HTML 특수문자 이스케이프

### 코드 품질
8. **기존 코드 패턴 먼저 확인**: 에이전트 프롬프트에 "일관성 유지" 명시
9. **인라인 debounce → 커스텀 훅 리팩토링**: 3곳 이상이면 훅 분리 검토
10. **exam-management.ts 잔여 SHOULD FIX**: academy_id 필터 추가

---

## 5. 수치 요약

| 지표 | 값 |
|------|------|
| 총 세션 수 | 28 |
| 테스트 수 | 1269+ (단위 + 통합 + E2E) |
| Phase 0 테스트 | 94 (AI 추상화 레이어) |
| 단계 1 테스트 | 1238 (1-1~1-9) |
| 단계 1.5-1 테스트 | 31 (LaTeX 렌더링) |
| 신규/수정 파일 수 | 80+ |
| 커밋 수 | 90+ |
| MUST FIX 발견/수정 | 모두 수정 완료 |
| E2E 시나리오 | 2개 (업로드→생성, 추출→편집→확정) |
| 빌드 에러 | 발견 즉시 수정 |

---

## 6. 핵심 기술 교훈 Top 10

1. **Defense in Depth**: RLS + Server Action + Zod 3중 방어
2. **Self-referencing ID**: profile.academy_id로 IDOR 차단
3. **Server Action `{ error }` 반환**: throw 대신 에러 객체가 안전
4. **Optimistic Lock**: `.update().in().select('id')` + 빈 배열 체크
5. **useEffect race condition**: `let cancelled = false` + cleanup
6. **Signed URL 패턴**: 경로만 DB, 조회 시에만 URL 생성
7. **Compensating Transaction**: Storage + DB 분산 시 역삼제 패턴
8. **Single Pass 파싱**: 통합 정규식으로 `$$`/`$`/`{{fig:N}}` 한 번에 스캔
9. **React.memo**: 순수 렌더링 컴포넌트에 필수 (KaTeX 재호출 방지)
10. **Mock 테스트 한계**: SQL 문자열 오타도 PASS → E2E 필수

---

## 7. 다음 Phase 적용 체크리스트

- [ ] PLAN 리뷰 최대 3회 제한
- [ ] 상세 계획 별도 리뷰 생략
- [ ] Step 단위 빌드 체크
- [ ] academy_id 필터 체크리스트
- [ ] 에이전트 프롬프트에 "기존 패턴 확인 + 일관성 유지" 포함
- [ ] 마스터 PLAN ↔ 상세 PLAN 동기화 규칙 적용
- [ ] exam-management.ts 잔여 SHOULD FIX 처리
