# 2-2 성취기준 DB 구축 [F002] — 마스터 PLAN v2

> 작성일: 2026-03-24
> 상태: **✅ 완료** (2026-03-25)
> 예상 작업량: M (1~1.5주)
> 리서치 종합: `docs/research/achievement-standards-collection-recommendation.md` v3

---

## 1. 요구사항 재정의

### 목표
중등 수학(7~9학년) 2022 개정 교육과정 전체 성취기준을 DB에 시딩하고,
system_admin 전용 CRUD + 전체 역할 조회/검색 UI를 제공하여 단계 2-4(성취기준 기반 AI 문제 생성)의 기반을 구축한다.

### v1 → v2 변경 사유
v1은 YAGNI 원칙으로 CRUD를 제거하고 조회만 구현했으나, 사용자 의사결정에 따라 system_admin CRUD(수동 폼)를 포함하고 4개 컬럼을 추가한다.

### 확정된 의사결정 11개

| # | 항목 | 결정 |
|---|------|------|
| 1 | RLS 권한 | system_admin만 CRUD. admin/teacher 조회만. 기존 RLS 변경 불필요 |
| 2 | 업로드 | 수동 폼만 (MVP). CSV Phase 2 |
| 3 | 편집 필드 | content, keywords, unit, sub_unit, source_name, source_url. code/subject/grade/semester는 읽기전용 |
| 4 | 삭제 정책 | 삭제 금지. is_active=false 비활성화만. AlertDialog로 "비활성화" 표현 |
| 5 | 다과목 | UI 다과목 대응 (subject Select), 시딩 수학만 |
| 6 | 패턴 | schools.ts CRUD 100% 재사용 |
| 7 | 진도 | order_in_semester INTEGER 컬럼 추가 |
| 8 | 자동 수집 | Phase 3+ 이연 (확정) |
| 9 | 출처 | source_name TEXT + source_url TEXT (참조 테이블 불필요) |
| 10 | unit 관리 | TEXT 유지 + UI Combobox Autocomplete + 시딩 표준화 |
| 11 | 시점 | effective_year INTEGER + curriculum_version 유지 |

### 현재 상태

| 항목 | 상태 | 비고 |
|------|------|------|
| 테이블 | 완성 | 4개 컬럼 추가 필요 |
| 시드 데이터 | 22개 | 중등 수학 전체 ~80개 필요 |
| RLS | 완성 | SELECT(인증), INSERT/UPDATE(system_admin). **변경 불필요** |
| 인덱스 | 완성 | (subject, grade), (code), (subject, grade, unit). **변경 불필요** |
| FK 연결 | 존재 | questions, past_exam_questions → achievement_standard_id |
| UI/Action | 미존재 | 이번 PLAN의 핵심 산출물 |

---

## 2. 핵심 설계 결정

| # | 결정 | 선택 | 대안 (기각) | 근거 |
|---|------|------|------------|------|
| D1 | 시딩 방식 | SQL 마이그레이션 (UPSERT) | seed.sql 수정 | 프로덕션 적용 필요, 멱등성 보장 |
| D2 | 페이지네이션 | 없음 (전체 로드) | 서버사이드 | ~100개 미만 |
| D3 | CRUD 범위 | system_admin 전용 | 미구현 | 의사결정 변경 |
| D4 | 필터 방식 | URL searchParams + Zod | 클라이언트만 | 기존 패턴 일관성 |
| D5 | academy_id 필터 | 없음 | academy_id 격리 | 공개 교육과정 데이터 |
| D6 | 라우트 접근 | admin, teacher, student | admin, teacher만 | 학생도 학습 목표 확인 |
| D7 | 키워드 검색 | content ILIKE + keywords @> | tsvector | ~100개에 전문 검색 과도 |
| D8 | 삭제 방식 | is_active=false 비활성화 | 하드 삭제 | FK 참조 보호 |
| D9 | 단원 입력 | Combobox (Select + 자유입력) | 텍스트 Input | 기존 값 재사용 + 신규 입력 |

---

## 3. 기존 인프라 분석

### 스키마 (4개 컬럼 추가 필요)

```sql
-- 기존 컬럼 (00001_initial_schema.sql)
CREATE TABLE achievement_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 12),
  semester INTEGER CHECK (semester IN (1, 2)),
  unit TEXT,
  sub_unit TEXT,
  keywords TEXT[] DEFAULT '{}',
  curriculum_version TEXT DEFAULT '2022',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 추가할 컬럼 4개
-- source_url TEXT          — 출처 URL
-- source_name TEXT         — 출처 이름 ('교육부', '해법수학')
-- order_in_semester INTEGER — 학기 내 진도 순서
-- effective_year INTEGER   — 적용 시작 연도 (2023)
```

### RLS (변경 불필요)

| 정책 | 대상 | 조건 |
|------|------|------|
| achievement_standards_select_authenticated | SELECT | auth.uid() IS NOT NULL |
| achievement_standards_insert_system_admin | INSERT | has_role('system_admin') |
| achievement_standards_update_system_admin | UPDATE | has_role('system_admin') |

**DELETE 정책 없음** = DB 레벨에서도 삭제 차단 (의사결정 #4와 일치).

### DB 제약조건 교차 검증 (회고 교훈 반영)

| DB 제약 | 코드 분기 필요 |
|---------|--------------|
| grade BETWEEN 1 AND 12 | Zod에서 grade 범위 검증 |
| semester IN (1, 2) | Zod에서 semester 1/2만 허용 |
| code UNIQUE | INSERT 시 중복 코드 에러 핸들링 |
| RLS: system_admin만 INSERT/UPDATE | Action에서 role 체크 + RLS 이중 방어 |
| DELETE 정책 없음 | 비활성화(UPDATE is_active=false)만 구현 |

---

## 4. Task 분해

### 의존성 그래프

```
Task 1 (마이그레이션) ──┐
                        ├──→ Task 3 (Action) ─→ Task 4 (UI) ─→ Task 5 (테스트)
Task 2 (Zod 스키마)  ──┘
```

---

### Task 1: 마이그레이션 (컬럼 추가 + 시딩 확장)

- **소유**: db-schema (`supabase/migrations/`)
- **의존**: 없음
- **위험도**: Medium (데이터 정확성)

#### 생성 파일

| 파일 | 설명 |
|------|------|
| `supabase/migrations/20260324_achievement_standards_v2.sql` | 4개 컬럼 ALTER + 중등 수학 ~80개 UPSERT |

#### 마이그레이션 후 필수 작업

마이그레이션 실행 후 **반드시** `supabase gen types` 실행하여 `src/types/supabase.ts` 갱신.
4개 신규 컬럼(source_url, source_name, order_in_semester, effective_year)이 타입에 반영되어야 Task 2~3에서 타입 안전성 확보.

#### 핵심 설계

```sql
-- 1단계: 컬럼 추가
ALTER TABLE achievement_standards
ADD COLUMN source_url TEXT,
ADD COLUMN source_name TEXT,
ADD COLUMN order_in_semester INTEGER,
ADD COLUMN effective_year INTEGER;

-- 2단계: 중등 수학 전체 시딩 (ON CONFLICT 멱등성)
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[7수01-01]', '...', '수학', 7, 1, '소인수분해', '소인수분해',
   ARRAY['소수', '소인수'], '2022', '교육부', 2023, 1),
  -- ... 전체 성취기준
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();
```

#### 데이터 범위 (2022 개정 교육과정 중등 수학)

| 학년 | 학기 | 영역 (unit) | 예상 수 |
|------|------|-------------|---------|
| 7 (중1) | 1 | 소인수분해, 정수와 유리수, 문자와 식, 일차방정식, 좌표평면과 그래프 | ~15-18 |
| 7 (중1) | 2 | 기본 도형, 작도와 합동, 평면도형, 입체도형, 통계 | ~15-18 |
| 8 (중2) | 1 | 유리수와 순환소수, 식의 계산, 부등식, 연립일차방정식, 일차함수 | ~15-18 |
| 8 (중2) | 2 | 삼각형의 성질, 사각형의 성질, 도형의 닮음, 확률 | ~12-15 |
| 9 (중3) | 1 | 제곱근과 실수, 다항식의 곱셈과 인수분해, 이차방정식, 이차함수 | ~15 |
| 9 (중3) | 2 | 통계, 삼각비, 원의 성질 | ~10-12 |
| **합계** | | | **~80-100** |

시딩 공통 값: `source_name='교육부'`, `effective_year=2023`, `curriculum_version='2022'`

---

### Task 2: Zod 스키마

- **소유**: backend-actions (`src/lib/validations/`)
- **의존**: 없음
- **위험도**: Low

#### 생성 파일

| 파일 | 설명 |
|------|------|
| `src/lib/validations/achievement-standards.ts` | 생성/수정/필터 Zod 스키마 |

#### 스키마 설계

**생성 스키마 (achievementStandardCreateSchema)**:
- code: `z.string().min(1).max(20)` — 필수
- content: `z.string().min(1).max(1000)` — 필수
- subject: `z.string().min(1)` — 필수
- grade: `z.coerce.number().int().min(1).max(12)` — 필수
- semester: `z.coerce.number().int().min(1).max(2).optional()`
- unit: `z.string().max(100).optional()`
- sub_unit: `z.string().max(100).optional()`
- keywords: `z.array(z.string()).default([])`
- source_name: `z.string().max(100).optional()`
- source_url: `z.string().url().optional().or(z.literal(''))`
- order_in_semester: `z.coerce.number().int().min(1).optional()`
- effective_year: `z.coerce.number().int().min(2000).max(2100).optional()`
- curriculum_version: `z.string().default('2022')`

**수정 스키마 (achievementStandardUpdateSchema)**:
- content, keywords, unit, sub_unit, source_name, source_url만 포함
- code/subject/grade/semester 제외 (의사결정 #3)

**필터 스키마 (achievementStandardFilterSchema)**:
- subject, grade, semester, unit, search — 모두 optional
- isActive: `z.enum(['true', 'false', 'all']).optional().default('true')`

---

### Task 3: Server Action (CRUD 6개)

- **소유**: backend-actions (`src/lib/actions/`)
- **의존**: Task 2
- **위험도**: Low

#### 생성 파일

| 파일 | 설명 |
|------|------|
| `src/lib/actions/achievement-standards.ts` | Server Actions 6개 |

#### Action 목록

| Action | 접근 권한 | 설명 |
|--------|----------|------|
| `getAchievementStandards(filters)` | 모든 인증 사용자 | 목록 조회 + 필터 |
| `getAchievementStandardById(id)` | 모든 인증 사용자 | 단일 조회 |
| `createAchievementStandard(prevState, formData)` | system_admin | 생성 |
| `updateAchievementStandard(id, prevState, formData)` | system_admin | 수정 (편집 가능 필드만) |
| `deactivateAchievementStandard(id)` | system_admin | 비활성화 (is_active=false) |
| `getDistinctUnits(subject?, grade?)` | 모든 인증 사용자 | 단원 Autocomplete용 |

#### 주요 설계
- **academy_id 필터 없음**: 글로벌 공개 데이터
- **페이지네이션 없음**: ~100개 미만, 전체 로드
- **정렬**: grade → semester → order_in_semester → code
- **비활성화**: UPDATE is_active=false (DB에 DELETE RLS 없음)
- **code 중복**: unique constraint 위반 → `{ error: '이미 존재하는 코드입니다.' }`
- **getDistinctUnits**: `SELECT DISTINCT unit WHERE is_active = true` + subject/grade 필터

---

### Task 4: UI (DataTable + Dialog + Toolbar + RBAC)

- **소유**: frontend-ui (`src/app/`, `src/components/`)
- **의존**: Task 3
- **위험도**: Low

#### 생성 파일

| 파일 | 설명 |
|------|------|
| `src/app/(dashboard)/achievement-standards/page.tsx` | 목록 페이지 |
| `src/components/achievement-standards/columns.ts` | DataTable 컬럼 |
| `src/components/achievement-standards/toolbar.tsx` | 캐스케이딩 필터 |
| `src/components/achievement-standards/form-dialog.tsx` | 생성/수정 Dialog |
| `src/components/achievement-standards/deactivate-dialog.tsx` | 비활성화 AlertDialog |

#### 수정 파일 (Shared — 리드 승인)

| 파일 | 변경 | 변경량 |
|------|------|--------|
| `src/lib/auth/route-permissions.ts` | `/achievement-standards` 추가 | +1줄 |
| `src/lib/constants/menu.ts` | 성취기준 메뉴 추가 | +6줄 |

#### UI 설계

```
┌──────────────────────────────────────────────────────────────────────┐
│ 성취기준 관리                                   [+ 성취기준 추가]    │
│                                                 (system_admin만)     │
├──────────────────────────────────────────────────────────────────────┤
│ [과목 ▼] [학년 ▼] [학기 ▼] [단원(Combobox) ▼]  [키워드 검색 ...]   │
├────┬──────────┬──────────┬──────┬──────────┬──────┬──────┬──────────┤
│코드│ 내용     │ 단원     │ 학기 │ 키워드   │진도  │학년  │ 작업     │
├────┼──────────┼──────────┼──────┼──────────┼──────┼──────┼──────────┤
│[9수│제곱근의  │제곱근과  │  1   │제곱근,   │  1   │중3   │ 수정 |   │
│01- │뜻을 알고 │실수      │      │양의제곱근│      │      │ 비활성화 │
│01] │...       │          │      │          │      │      │(sysadmin)│
└────┴──────────┴──────────┴──────┴──────────┴──────┴──────┴──────────┘
```

#### RBAC 설정

| 위치 | 설정 |
|------|------|
| page.tsx | `requireRole(['admin', 'teacher', 'student'])` |
| route-permissions.ts | `roles: ['admin', 'teacher', 'student']` |
| menu.ts | `roles: ['admin', 'teacher']` (학생 메뉴 미노출) |
| 생성/수정/비활성화 버튼 | `role === 'system_admin'` 조건부 렌더링 |

#### 필터 Toolbar (캐스케이딩)

| 필터 | 컴포넌트 | 동작 |
|------|----------|------|
| 과목 | Select (수학/전체) | 다과목 UI 대응 |
| 학년 | Select (중1/중2/중3/전체) | 단원 목록 갱신 |
| 학기 | Select (1학기/2학기/전체) | |
| 단원 | Combobox (학년별 동적) | `getDistinctUnits()` 호출 |
| 검색 | Input (debounce 300ms) | content + keywords 검색 |

#### form-dialog.tsx

- **생성 모드**: 전체 필드 입력
- **수정 모드**: code/subject/grade/semester 읽기전용 + 편집 필드만 활성
- **keywords**: Badge Input (Enter 추가, x 삭제)
- **단원**: Combobox (기존 값 자동완성 + 자유입력)

---

### Task 5: 테스트

- **소유**: tester (`__tests__/`)
- **의존**: Task 1~4
- **위험도**: Low

#### 생성 파일

| 파일 | 내용 |
|------|------|
| `src/lib/validations/__tests__/achievement-standards.test.ts` | Zod ~10개 |
| `src/lib/actions/__tests__/achievement-standards.test.ts` | Action ~20개 |

#### 테스트 범위 (~30개)

**Zod (~10개)**: 생성/수정/필터 스키마 유효/거부 검증
**Action (~20개)**: 조회(필터 조합), CRUD(권한 체크), 비활성화, Autocomplete

**회귀**: 기존 1390+ 전체 PASS

---

## 5. Wave 구성 (병렬 구현)

```
Wave 1 (기반) ─ 병렬
├── Task 1: 마이그레이션         (db-schema)       ← 의존 없음
└── Task 2: Zod 스키마           (backend-actions)  ← 의존 없음

Wave 2 (백엔드) ─ 직렬
└── Task 3: Server Action        (backend-actions)  ← Task 2

Wave 3 (프론트엔드) ─ 직렬
└── Task 4: UI + RBAC            (frontend-ui)      ← Task 3

Wave 4 (검증) ─ 직렬
└── Task 5: 테스트                (tester)           ← Task 1~4
```

### 병렬 충돌 분석

| Wave | 소유 파일 | 충돌 |
|------|----------|------|
| Wave 1 | supabase/migrations/ + src/lib/validations/ | 없음 |
| Wave 2 | src/lib/actions/ | 없음 |
| Wave 3 | src/app/ + src/components/ + Shared | 없음 |
| Wave 4 | __tests__/ | 없음 |

---

## 6. 에러 처리 전략

| 상황 | 동작 |
|------|------|
| 미인증 | `{ error: '인증이 필요합니다.' }` |
| 권한 부족 | `{ error: '권한이 없습니다.' }` |
| Zod 실패 | `{ error: '입력값이 올바르지 않습니다.' }` |
| DB 실패 | `{ error: '처리 중 오류가 발생했습니다.' }` |
| code 중복 | `{ error: '이미 존재하는 성취기준 코드입니다.' }` |
| 비활성화 시 questions 연결 | 경고 표시 후 비활성화 허용 |
| 역할 불일치 (라우트) | `/unauthorized` 리다이렉트 |
| 빈 결과 | "해당 조건에 맞는 성취기준이 없습니다." |

---

## 7. 리스크 + 완화 전략

| 등급 | 리스크 | 대응 |
|------|--------|------|
| MEDIUM | 교육과정 데이터 정확성 | 교육부 고시 기반 + UPSERT 멱등성 |
| LOW | 단원명 불일치 | 시딩 표준화 + UI Combobox Autocomplete |
| LOW | Shared 파일 수정 | 극소 변경량 (각 +1~6줄) |
| LOW | keywords Badge Input | 기존 프로젝트 패턴 + shadcn/ui Badge |

---

## 8. 테스트 전략

| 유형 | 대상 | 수 |
|------|------|-----|
| 단위 | Zod 스키마 | ~10 |
| 통합 | Server Action (mock Supabase) | ~20 |
| 회귀 | 기존 1390+ | 기존 |
| E2E | Chrome DevTools MCP | 5~8 여정 |

---

## 9. 회고 교훈 반영

| 교훈 | 반영 |
|------|------|
| PLAN 리뷰 3회 제한 | v2 리뷰 → MUST FIX 0이면 구현 |
| YAGNI | CSV, 자동 수집, 참조 테이블 모두 이연/제거 |
| DB 제약조건 교차 검증 | 섹션 3 교차 검증 표 추가 |
| 권한 매트릭스 ↔ Task 교차 | 모든 Action 권한 명시 |
| 리서치 → PLAN 순서 | v1→v2→v3 리서치 후 PLAN |

---

## 10. 변경 영향 범위

### 신규 파일 (~8개)

| 파일 | Task |
|------|------|
| `supabase/migrations/20260324_achievement_standards_v2.sql` | 1 |
| `src/lib/validations/achievement-standards.ts` | 2 |
| `src/lib/actions/achievement-standards.ts` | 3 |
| `src/app/(dashboard)/achievement-standards/page.tsx` | 4 |
| `src/components/achievement-standards/columns.ts` | 4 |
| `src/components/achievement-standards/toolbar.tsx` | 4 |
| `src/components/achievement-standards/form-dialog.tsx` | 4 |
| `src/components/achievement-standards/deactivate-dialog.tsx` | 4 |

### 수정 파일 (~2개 — Shared)

| 파일 | Task | 변경량 |
|------|------|--------|
| `src/lib/auth/route-permissions.ts` | 4 | +1줄 |
| `src/lib/constants/menu.ts` | 4 | +6줄 |

### 테스트 파일 (~2개)

| 파일 | Task |
|------|------|
| `src/lib/validations/__tests__/achievement-standards.test.ts` | 5 |
| `src/lib/actions/__tests__/achievement-standards.test.ts` | 5 |

---

## 11. 이후 작업 (PLAN 범위 외)

| 항목 | 시점 | 조건 |
|------|------|------|
| CSV 일괄 업로드 | Phase 2 | 대량 데이터 필요 시 |
| 자동 수집 (크롤링) | Phase 3+ | 의사결정 #8 |
| 초등/고등/다른 과목 | MVP 확장 시 | 타겟 사용자 확대 |
| keywords GIN 인덱스 | 1000개+ | 검색 성능 저하 시 |
| 성취기준 → AI 문제 생성 | 단계 2-4 | 직접 후속 |

---

## Plan Review Completion Checklist

- [x] 모든 Task의 파일 소유권이 명확하다
- [x] Task 간 의존성 순서가 정의되었다
- [x] 외부 의존성이 명시되었다 — 신규 라이브러리 없음
- [x] 에러 처리 방식이 정해졌다
- [x] 테스트 전략이 있다
- [x] 이전 Phase 회고 교훈이 반영되었다
- [x] 병렬 구현 시 파일 충돌 가능성이 없다
