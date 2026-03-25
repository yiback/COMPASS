# Task 1: 마이그레이션 (컬럼 추가 + 시딩 확장) — 상세 계획

> 소유: db-schema (`supabase/migrations/`)
> 의존: 없음
> 산출물: `supabase/migrations/20260324_achievement_standards_v2.sql`

---

## 현재 상태 분석

### 기존 테이블 (00001_initial_schema.sql)
- 12개 컬럼: id, code, content, subject, grade, semester, unit, sub_unit, keywords, curriculum_version, is_active, created_at, updated_at
- UNIQUE(code), CHECK(grade 1-12), CHECK(semester 1,2)
- updated_at 트리거 존재

### 기존 시드 데이터 (seed.sql)
- 22개 성취기준 (중1 4개, 중2 4개, 중3 14개)
- source_name, effective_year, order_in_semester 컬럼 없음
- 코드 패턴: [7수01-01] ~ [9수05-02]

---

## Step 분해

### Step 1: 4개 컬럼 ALTER TABLE

```sql
ALTER TABLE achievement_standards
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_name TEXT,
  ADD COLUMN IF NOT EXISTS order_in_semester INTEGER,
  ADD COLUMN IF NOT EXISTS effective_year INTEGER;
```

- `IF NOT EXISTS`로 멱등성 확보
- 모두 nullable — 기존 22개 레코드 영향 없음
- CHECK 제약조건 없음 (Zod에서 검증)

### Step 2: 기존 22개 + 신규 ~60개 UPSERT

ON CONFLICT (code) DO UPDATE로 멱등성 보장.
- 기존 22개: source_name='교육부', effective_year=2023, order_in_semester=진도순서 추가
- 신규 ~60개: 중등 수학 전체 성취기준 (2022 개정 교육과정)

#### 데이터 범위

| 학년 | 학기 | 단원 | 예상 수 |
|------|------|------|---------|
| 7 (중1) | 1 | 소인수분해, 정수와 유리수, 문자와 식, 일차방정식, 좌표평면과 그래프 | ~15 |
| 7 (중1) | 2 | 기본 도형, 작도와 합동, 평면도형, 입체도형, 통계 | ~12 |
| 8 (중2) | 1 | 유리수와 순환소수, 식의 계산, 부등식, 연립일차방정식, 일차함수 | ~14 |
| 8 (중2) | 2 | 삼각형의 성질, 사각형의 성질, 도형의 닮음, 확률 | ~10 |
| 9 (중3) | 1 | 제곱근과 실수, 다항식, 이차방정식, 이차함수 | ~15 (기존) |
| 9 (중3) | 2 | 통계, 삼각비, 원의 성질 | ~10 |
| **합계** | | | **~80** |

#### UPSERT 구조

```sql
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES (...)
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

- subject, grade, semester는 UPSERT 대상 제외 (code로 식별되는 불변 필드)
- is_active 건드리지 않음

### Step 3: supabase gen types 실행 (수동)

```bash
npx supabase gen types typescript --local > src/types/supabase.ts
```

- 4개 신규 컬럼이 타입에 반영 확인
- stderr 오염 확인 (회고 교훈)

---

## DB 제약조건 교차 검증

| DB 제약 | 마이그레이션에서 확인 |
|---------|---------------------|
| code UNIQUE | ON CONFLICT (code) DO UPDATE |
| grade BETWEEN 1 AND 12 | 시딩 데이터 7~9만 사용 |
| semester IN (1, 2) | 시딩 데이터 1, 2만 사용 |
| 새 컬럼 nullable | 기존 레코드 영향 없음 |

---

## 검증 기준

- [ ] 마이그레이션 2회 연속 실행해도 에러 없음 (멱등성)
- [ ] 기존 22개 레코드 보존 (code, content 유지 + 신규 컬럼 채워짐)
- [ ] 총 ~80개 성취기준 존재 확인
- [ ] 4개 신규 컬럼 값 확인
- [ ] supabase gen types 실행 후 타입 반영
- [ ] npm run build 성공
- [ ] 기존 테스트 전체 PASS (1390+)
