# 성취기준 자동 수집 + 다중 소스 관리 — 실현 가능성 평가

> 작성일: 2026-03-24
> 역할: feasibility-analyst
> 상태: 완료

---

## 1. 기존 스키마 호환성: ✅ 높음

- `subject TEXT` — CHECK 제약조건 없음 → 다과목 확장 자유
- `achievement_standard_id` FK — questions, past_exam_questions에 이미 존재
- RLS — 인증 사용자 SELECT, system_admin INSERT/UPDATE
- 인덱스 — (subject, grade), (code), (subject, grade, unit) 완비

## 2. 마이그레이션 비용: S (매우 간단)

필요 컬럼 추가:
- `collected_at TIMESTAMPTZ` — 수집 시점
- `collection_method TEXT` — manual / auto / csv_upload / migration
- `source_url TEXT` — 출처 URL

모두 nullable → 기존 22개 데이터 역호환성 보장.

## 3. 기존 코드 수정 범위: 최소

| 계층 | 호환성 | 수정 필요 |
|-----|--------|---------|
| Server Actions | ✅ 패턴 재사용 | 새 Action 추가만 |
| AI 프로바이더 | ✅ 기존 그대로 | 과목별 프롬프트 분기 (2-4에서) |
| Supabase 클라이언트 | ✅ admin 클라이언트 | 자동 수집 시 사용 |
| 테스트 | ✅ Vitest 패턴 | 새 테스트 추가만 |

## 4. 작업량 평가

### 구성별 작업량

| 구성 | 시간 | 복잡도 |
|------|------|--------|
| 스키마 마이그레이션 | 1-2h | S |
| 수작업 CRUD UI | 6-8h | S |
| CSV 업로드 | 3-4h | S |
| Server Action (조회/필터) | 3-4h | S |
| 크롤러 개발 (자동 수집) | 8-12h | M |
| 테스트 | 8-12h | M |
| **MVP (자동 수집 제외)** | **~25h (3일)** | **M** |
| **전체 (자동 수집 포함)** | **~45h (5일)** | **L** |

### 추천: MVP 먼저, 자동 수집은 Phase 분리

## 5. 다과목 확장 영향: 낮음

- 스키마: 이미 유연 (TEXT 기반)
- AI 프롬프트: 과목별 분기 필요 → 단계 2-4에서 처리
- UI 필터: subject Select 추가 (기존 grade 필터 옆)

## 6. 최종 판정

**✅ 높은 실현 가능성**

- MVP (시딩 + CRUD + 조회): M 규모 (3일)
- 전체 (+ 자동 수집): L 규모 (5일)
- 리스크: 중간 (교육청 소스 의존 — 자동 수집 시)
