-- =============================================================
-- 성취기준 테이블 확장: 컬럼 추가 + 중등 수학 전체 시딩
-- 2022 개정 교육과정 (교육부 고시 제2022-33호) 기준
-- 멱등성: 2회 연속 실행해도 에러 없음
-- =============================================================

-- ========================
-- 1. 컬럼 추가 (IF NOT EXISTS)
-- ========================
ALTER TABLE achievement_standards
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_name TEXT,
  ADD COLUMN IF NOT EXISTS order_in_semester INTEGER,
  ADD COLUMN IF NOT EXISTS effective_year INTEGER;

-- ========================
-- 2. 중등 수학 성취기준 UPSERT
-- ========================
-- ON CONFLICT (code) DO UPDATE: 기존 22개는 신규 컬럼 값 채움 + 내용 보강
-- 기존 seed.sql 코드 체계 유지:
--   [8수03-XX] = 연립일차방정식 (기존), [8수04-XX] = 일차함수 (기존)
--   부등식 = [8수05-XX] (신규, 기존 충돌 회피)

-- ----- 중1(7학년) 1학기 -----

-- 소인수분해
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[7수01-01]', '소인수분해의 뜻을 알고, 자연수를 소인수분해할 수 있다.', '수학', 7, 1, '소인수분해', '소인수분해',
    ARRAY['소수', '소인수', '소인수분해'], '2022', '교육부', 2023, 1),
  ('[7수01-02]', '최대공약수와 최소공배수를 구하고, 이를 활용하여 문제를 해결할 수 있다.', '수학', 7, 1, '소인수분해', '최대공약수와 최소공배수',
    ARRAY['최대공약수', '최소공배수', '소인수분해', '활용'], '2022', '교육부', 2023, 2),
  ('[7수01-03]', '소수의 뜻을 알고 자연수를 소수와 합성수로 분류할 수 있다.', '수학', 7, 1, '소인수분해', '소수와 합성수',
    ARRAY['소수', '합성수', '에라토스테네스의 체'], '2022', '교육부', 2023, 3)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- 정수와 유리수
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[7수02-01]', '양수와 음수의 개념을 이해하고, 정수와 유리수의 대소 관계를 안다.', '수학', 7, 1, '정수와 유리수', '정수와 유리수의 개념',
    ARRAY['양수', '음수', '정수', '유리수'], '2022', '교육부', 2023, 4),
  ('[7수02-02]', '정수와 유리수의 사칙연산을 할 수 있다.', '수학', 7, 1, '정수와 유리수', '정수와 유리수의 사칙연산',
    ARRAY['덧셈', '뺄셈', '곱셈', '나눗셈'], '2022', '교육부', 2023, 5),
  ('[7수02-03]', '정수와 유리수의 덧셈과 뺄셈의 원리를 이해하고 계산할 수 있다.', '수학', 7, 1, '정수와 유리수', '덧셈과 뺄셈',
    ARRAY['덧셈', '뺄셈', '교환법칙', '결합법칙'], '2022', '교육부', 2023, 6),
  ('[7수02-04]', '정수와 유리수의 곱셈과 나눗셈의 원리를 이해하고 계산할 수 있다.', '수학', 7, 1, '정수와 유리수', '곱셈과 나눗셈',
    ARRAY['곱셈', '나눗셈', '역수', '분배법칙'], '2022', '교육부', 2023, 7)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- 문자와 식
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[7수03-01]', '문자를 사용하여 식을 나타내고, 일차식의 덧셈과 뺄셈을 할 수 있다.', '수학', 7, 1, '문자와 식', '문자의 사용과 일차식',
    ARRAY['문자', '일차식', '항', '계수'], '2022', '교육부', 2023, 8),
  ('[7수03-02]', '다항식의 뜻을 알고, 일차식의 덧셈과 뺄셈을 할 수 있다.', '수학', 7, 1, '문자와 식', '일차식의 계산',
    ARRAY['다항식', '단항식', '동류항', '일차식'], '2022', '교육부', 2023, 9),
  ('[7수03-03]', '일차식의 곱셈과 나눗셈을 할 수 있다.', '수학', 7, 1, '문자와 식', '일차식의 곱셈과 나눗셈',
    ARRAY['일차식', '곱셈', '나눗셈', '분배법칙'], '2022', '교육부', 2023, 10)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- 일차방정식
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[7수04-01]', '일차방정식을 풀 수 있고, 이를 활용하여 문제를 풀 수 있다.', '수학', 7, 1, '일차방정식', '일차방정식의 풀이',
    ARRAY['일차방정식', '등식', '풀이'], '2022', '교육부', 2023, 11),
  ('[7수04-02]', '등식의 성질을 이해하고, 이를 이용하여 일차방정식을 풀 수 있다.', '수학', 7, 1, '일차방정식', '등식의 성질',
    ARRAY['등식', '이항', '방정식', '해'], '2022', '교육부', 2023, 12),
  ('[7수04-03]', '일차방정식을 활용하여 실생활 문제를 해결할 수 있다.', '수학', 7, 1, '일차방정식', '일차방정식의 활용',
    ARRAY['활용', '문장제', '일차방정식', '실생활'], '2022', '교육부', 2023, 13)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- 좌표평면과 그래프
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[7수05-01]', '순서쌍과 좌표를 이해하고, 좌표평면 위의 점을 나타낼 수 있다.', '수학', 7, 1, '좌표평면과 그래프', '순서쌍과 좌표',
    ARRAY['순서쌍', '좌표', '좌표평면', 'x축', 'y축'], '2022', '교육부', 2023, 14),
  ('[7수05-02]', '정비례와 반비례 관계를 이해하고, 그 그래프를 그릴 수 있다.', '수학', 7, 1, '좌표평면과 그래프', '정비례와 반비례',
    ARRAY['정비례', '반비례', '그래프', '비례상수'], '2022', '교육부', 2023, 15)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- ----- 중1(7학년) 2학기 -----

-- 기본 도형
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[7수06-01]', '점, 선, 면, 각의 성질을 이해한다.', '수학', 7, 2, '기본 도형', '점, 선, 면, 각',
    ARRAY['점', '선', '면', '각', '교점', '교선'], '2022', '교육부', 2023, 1),
  ('[7수06-02]', '평행선의 성질을 이해한다.', '수학', 7, 2, '기본 도형', '평행선의 성질',
    ARRAY['평행선', '동위각', '엇각', '수직'], '2022', '교육부', 2023, 2),
  ('[7수06-03]', '위치 관계를 이해하고, 평행선의 성질을 활용할 수 있다.', '수학', 7, 2, '기본 도형', '위치 관계',
    ARRAY['꼬인 위치', '평행', '수직', '위치 관계'], '2022', '교육부', 2023, 3)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- 작도와 합동
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[7수07-01]', '간단한 도형의 작도를 할 수 있다.', '수학', 7, 2, '작도와 합동', '기본 작도',
    ARRAY['작도', '눈금 없는 자', '컴퍼스', '삼각형'], '2022', '교육부', 2023, 4),
  ('[7수07-02]', '삼각형의 합동 조건을 이해하고, 이를 활용할 수 있다.', '수학', 7, 2, '작도와 합동', '삼각형의 합동',
    ARRAY['합동', 'SSS', 'SAS', 'ASA'], '2022', '교육부', 2023, 5)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- 평면도형의 성질
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[7수08-01]', '다각형의 성질을 이해한다.', '수학', 7, 2, '평면도형의 성질', '다각형',
    ARRAY['다각형', '대각선', '내각', '외각'], '2022', '교육부', 2023, 6),
  ('[7수08-02]', '원과 부채꼴의 성질을 이해한다.', '수학', 7, 2, '평면도형의 성질', '원과 부채꼴',
    ARRAY['원', '부채꼴', '호', '중심각'], '2022', '교육부', 2023, 7),
  ('[7수08-03]', '다각형의 내각과 외각의 크기의 합을 구할 수 있다.', '수학', 7, 2, '평면도형의 성질', '내각과 외각의 합',
    ARRAY['내각의 합', '외각의 합', '정다각형', '삼각형'], '2022', '교육부', 2023, 8)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- 입체도형의 성질
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[7수09-01]', '다면체와 회전체의 성질을 이해한다.', '수학', 7, 2, '입체도형의 성질', '다면체와 회전체',
    ARRAY['다면체', '회전체', '각기둥', '각뿔', '원기둥', '원뿔'], '2022', '교육부', 2023, 9),
  ('[7수09-02]', '입체도형의 겉넓이와 부피를 구할 수 있다.', '수학', 7, 2, '입체도형의 성질', '겉넓이와 부피',
    ARRAY['겉넓이', '부피', '전개도', '입체도형'], '2022', '교육부', 2023, 10)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- 자료의 정리와 해석
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[7수10-01]', '줄기와 잎 그림, 도수분포표, 히스토그램, 도수분포다각형을 이해하고 해석할 수 있다.', '수학', 7, 2, '자료의 정리와 해석', '도수분포표와 그래프',
    ARRAY['줄기와 잎 그림', '도수분포표', '히스토그램', '도수분포다각형'], '2022', '교육부', 2023, 11),
  ('[7수10-02]', '상대도수를 구하고, 이를 활용할 수 있다.', '수학', 7, 2, '자료의 정리와 해석', '상대도수',
    ARRAY['상대도수', '도수', '누적도수', '비교'], '2022', '교육부', 2023, 12)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- ----- 중2(8학년) 1학기 -----

-- 유리수와 순환소수
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[8수01-01]', '유리수와 순환소수의 관계를 이해한다.', '수학', 8, 1, '유리수와 순환소수', '유리수와 순환소수',
    ARRAY['유리수', '순환소수', '유한소수'], '2022', '교육부', 2023, 1),
  ('[8수01-02]', '유한소수와 순환소수를 분수로 나타낼 수 있다.', '수학', 8, 1, '유리수와 순환소수', '순환소수의 분수 표현',
    ARRAY['유한소수', '순환소수', '분수', '소수'], '2022', '교육부', 2023, 2)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- 식의 계산
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[8수02-01]', '단항식의 곱셈과 나눗셈을 할 수 있다.', '수학', 8, 1, '식의 계산', '단항식의 계산',
    ARRAY['단항식', '곱셈', '나눗셈'], '2022', '교육부', 2023, 3),
  ('[8수02-02]', '다항식의 덧셈과 뺄셈을 할 수 있다.', '수학', 8, 1, '식의 계산', '다항식의 덧셈과 뺄셈',
    ARRAY['다항식', '덧셈', '뺄셈', '동류항'], '2022', '교육부', 2023, 4),
  ('[8수02-03]', '단항식과 다항식의 곱셈, 다항식을 단항식으로 나누는 나눗셈을 할 수 있다.', '수학', 8, 1, '식의 계산', '단항식과 다항식의 혼합 계산',
    ARRAY['단항식', '다항식', '곱셈', '나눗셈', '분배법칙'], '2022', '교육부', 2023, 5)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- 연립일차방정식 (기존 [8수03-XX] 코드 유지)
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[8수03-01]', '연립일차방정식과 그 해의 의미를 안다.', '수학', 8, 1, '연립일차방정식', '연립일차방정식과 풀이',
    ARRAY['연립방정식', '미지수', '해'], '2022', '교육부', 2023, 9),
  ('[8수03-02]', '연립일차방정식을 풀 수 있다.', '수학', 8, 1, '연립일차방정식', '연립일차방정식의 풀이',
    ARRAY['가감법', '대입법', '연립방정식', '풀이'], '2022', '교육부', 2023, 10),
  ('[8수03-03]', '연립일차방정식을 활용하여 문제를 해결할 수 있다.', '수학', 8, 1, '연립일차방정식', '연립일차방정식의 활용',
    ARRAY['활용', '문장제', '연립방정식', '실생활'], '2022', '교육부', 2023, 11)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- 일차함수 (기존 [8수04-XX] 코드 유지)
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[8수04-01]', '일차함수의 의미를 이해하고, 그 그래프를 그릴 수 있다.', '수학', 8, 1, '일차함수', '일차함수와 그래프',
    ARRAY['일차함수', '기울기', '절편'], '2022', '교육부', 2023, 12),
  ('[8수04-02]', '일차함수의 그래프의 성질을 이해한다.', '수학', 8, 1, '일차함수', '일차함수 그래프의 성질',
    ARRAY['기울기', 'x절편', 'y절편', '평행이동'], '2022', '교육부', 2023, 13),
  ('[8수04-03]', '일차함수와 일차방정식의 관계를 이해한다.', '수학', 8, 1, '일차함수', '일차함수와 일차방정식',
    ARRAY['일차함수', '일차방정식', '연립방정식', '교점'], '2022', '교육부', 2023, 14)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- 부등식 (신규 [8수05-XX] — 기존 [8수03-XX] 연립일차방정식과 충돌 회피)
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[8수05-01]', '부등식과 그 해의 의미를 알고, 부등식의 성질을 이해한다.', '수학', 8, 1, '부등식', '부등식의 뜻과 성질',
    ARRAY['부등식', '부등호', '해', '부등식의 성질'], '2022', '교육부', 2023, 6),
  ('[8수05-02]', '일차부등식을 풀 수 있다.', '수학', 8, 1, '부등식', '일차부등식의 풀이',
    ARRAY['일차부등식', '풀이', '해집합', '수직선'], '2022', '교육부', 2023, 7),
  ('[8수05-03]', '일차부등식을 활용하여 문제를 해결할 수 있다.', '수학', 8, 1, '부등식', '일차부등식의 활용',
    ARRAY['활용', '문장제', '일차부등식', '실생활'], '2022', '교육부', 2023, 8)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- ----- 중2(8학년) 2학기 -----

-- 삼각형의 성질
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[8수06-01]', '이등변삼각형의 성질을 이해하고 활용할 수 있다.', '수학', 8, 2, '삼각형의 성질', '이등변삼각형',
    ARRAY['이등변삼각형', '꼭지각', '밑각', '이등분'], '2022', '교육부', 2023, 1),
  ('[8수06-02]', '직각삼각형의 합동 조건을 이해하고 활용할 수 있다.', '수학', 8, 2, '삼각형의 성질', '직각삼각형의 합동',
    ARRAY['직각삼각형', '합동', 'RHA', 'RHS'], '2022', '교육부', 2023, 2),
  ('[8수06-03]', '삼각형의 외심과 내심의 성질을 이해한다.', '수학', 8, 2, '삼각형의 성질', '외심과 내심',
    ARRAY['외심', '내심', '외접원', '내접원', '수직이등분선'], '2022', '교육부', 2023, 3)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- 사각형의 성질
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[8수07-01]', '평행사변형의 성질을 이해하고 활용할 수 있다.', '수학', 8, 2, '사각형의 성질', '평행사변형의 성질',
    ARRAY['평행사변형', '대변', '대각', '대각선'], '2022', '교육부', 2023, 4),
  ('[8수07-02]', '평행사변형이 되는 조건을 이해한다.', '수학', 8, 2, '사각형의 성질', '평행사변형이 되는 조건',
    ARRAY['평행사변형', '조건', '증명', '사각형'], '2022', '교육부', 2023, 5),
  ('[8수07-03]', '여러 가지 사각형의 성질과 관계를 이해한다.', '수학', 8, 2, '사각형의 성질', '여러 가지 사각형',
    ARRAY['직사각형', '마름모', '정사각형', '등변사다리꼴'], '2022', '교육부', 2023, 6)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- 도형의 닮음
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[8수08-01]', '닮음의 의미와 닮음비를 이해한다.', '수학', 8, 2, '도형의 닮음', '닮음의 뜻과 성질',
    ARRAY['닮음', '닮음비', '대응변', '대응각'], '2022', '교육부', 2023, 7),
  ('[8수08-02]', '삼각형의 닮음 조건을 이해하고, 이를 활용하여 문제를 해결할 수 있다.', '수학', 8, 2, '도형의 닮음', '삼각형의 닮음 조건',
    ARRAY['AA 닮음', 'SAS 닮음', 'SSS 닮음', '닮음 조건'], '2022', '교육부', 2023, 8)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- 확률
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[8수09-01]', '경우의 수를 구할 수 있다.', '수학', 8, 2, '확률', '경우의 수',
    ARRAY['경우의 수', '합의 법칙', '곱의 법칙', '수형도'], '2022', '교육부', 2023, 9),
  ('[8수09-02]', '확률의 뜻을 알고, 확률을 구할 수 있다.', '수학', 8, 2, '확률', '확률의 뜻과 계산',
    ARRAY['확률', '사건', '수학적 확률', '통계적 확률'], '2022', '교육부', 2023, 10)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- ----- 중3(9학년) 1학기 — 기존 14개 보강 -----

-- 제곱근과 실수 (기존 3개 + 신규 컬럼)
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[9수01-01]', '제곱근의 뜻을 알고, 그 성질을 이해한다.', '수학', 9, 1, '제곱근과 실수', '제곱근의 뜻과 성질',
    ARRAY['제곱근', '양의 제곱근', '음의 제곱근'], '2022', '교육부', 2023, 1),
  ('[9수01-02]', '무리수의 개념을 이해하고, 실수의 체계를 안다.', '수학', 9, 1, '제곱근과 실수', '무리수와 실수',
    ARRAY['무리수', '유리수', '실수'], '2022', '교육부', 2023, 2),
  ('[9수01-03]', '근호를 포함한 식의 사칙연산을 할 수 있다.', '수학', 9, 1, '제곱근과 실수', '근호를 포함한 식의 계산',
    ARRAY['근호', '제곱근의 곱셈', '제곱근의 나눗셈'], '2022', '교육부', 2023, 3)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- 다항식의 곱셈과 인수분해 (기존 4개 + 신규 컬럼)
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[9수02-01]', '다항식의 곱셈을 할 수 있다.', '수학', 9, 1, '다항식의 곱셈과 인수분해', '다항식의 곱셈',
    ARRAY['다항식', '곱셈공식', '전개'], '2022', '교육부', 2023, 4),
  ('[9수02-02]', '곱셈 공식을 이용하여 다항식을 전개할 수 있다.', '수학', 9, 1, '다항식의 곱셈과 인수분해', '곱셈 공식',
    ARRAY['완전제곱식', '합차공식', '곱셈공식'], '2022', '교육부', 2023, 5),
  ('[9수02-03]', '인수분해의 뜻을 알고, 공통인수를 이용하여 인수분해할 수 있다.', '수학', 9, 1, '다항식의 곱셈과 인수분해', '인수분해',
    ARRAY['인수분해', '공통인수', '인수'], '2022', '교육부', 2023, 6),
  ('[9수02-04]', '인수분해 공식을 이용하여 인수분해할 수 있다.', '수학', 9, 1, '다항식의 곱셈과 인수분해', '인수분해 공식',
    ARRAY['인수분해 공식', '완전제곱식', '합차공식'], '2022', '교육부', 2023, 7)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- 이차방정식 (기존 5개 + 신규 컬럼)
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[9수03-01]', '이차방정식과 그 해의 뜻을 안다.', '수학', 9, 1, '이차방정식', '이차방정식과 그 풀이',
    ARRAY['이차방정식', '해', '근'], '2022', '교육부', 2023, 8),
  ('[9수03-02]', '인수분해를 이용하여 이차방정식을 풀 수 있다.', '수학', 9, 1, '이차방정식', '인수분해를 이용한 풀이',
    ARRAY['인수분해', '이차방정식', '풀이'], '2022', '교육부', 2023, 9),
  ('[9수03-03]', '제곱근을 이용하여 이차방정식을 풀 수 있다.', '수학', 9, 1, '이차방정식', '제곱근을 이용한 풀이',
    ARRAY['제곱근', '완전제곱식', '풀이'], '2022', '교육부', 2023, 10),
  ('[9수03-04]', '근의 공식을 유도하고, 이를 활용하여 이차방정식을 풀 수 있다.', '수학', 9, 1, '이차방정식', '근의 공식',
    ARRAY['근의 공식', '판별식', '이차방정식'], '2022', '교육부', 2023, 11),
  ('[9수03-05]', '이차방정식을 활용하여 문제를 풀 수 있다.', '수학', 9, 1, '이차방정식', '이차방정식의 활용',
    ARRAY['활용', '문장제', '이차방정식'], '2022', '교육부', 2023, 12)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- 이차함수 (기존 3개 + 신규 컬럼)
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[9수04-01]', '이차함수의 의미를 이해하고, y=ax^2의 그래프를 그릴 수 있다.', '수학', 9, 1, '이차함수', '이차함수와 그래프',
    ARRAY['이차함수', '포물선', '그래프'], '2022', '교육부', 2023, 13),
  ('[9수04-02]', 'y=a(x-p)^2+q의 그래프를 그릴 수 있다.', '수학', 9, 1, '이차함수', '이차함수의 그래프',
    ARRAY['꼭짓점', '축', '평행이동'], '2022', '교육부', 2023, 14),
  ('[9수04-03]', 'y=ax^2+bx+c의 그래프를 그릴 수 있다.', '수학', 9, 1, '이차함수', '일반형 이차함수',
    ARRAY['일반형', '표준형', '변환'], '2022', '교육부', 2023, 15)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- ----- 중3(9학년) 2학기 — 기존 2개 + 신규 -----

-- 통계 (기존 2개 + 신규 1개)
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[9수05-01]', '대푯값의 의미를 알고, 평균, 중앙값, 최빈값을 구할 수 있다.', '수학', 9, 2, '통계', '대푯값',
    ARRAY['평균', '중앙값', '최빈값', '대푯값'], '2022', '교육부', 2023, 1),
  ('[9수05-02]', '분산과 표준편차의 의미를 알고, 이를 구할 수 있다.', '수학', 9, 2, '통계', '산포도',
    ARRAY['분산', '표준편차', '산포도'], '2022', '교육부', 2023, 2),
  ('[9수05-03]', '자료를 산점도로 나타내고, 상관관계를 말할 수 있다.', '수학', 9, 2, '통계', '산점도와 상관관계',
    ARRAY['산점도', '상관관계', '양의 상관', '음의 상관'], '2022', '교육부', 2023, 3)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- 삼각비 (신규)
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[9수06-01]', '삼각비의 뜻을 알고, 간단한 삼각비의 값을 구할 수 있다.', '수학', 9, 2, '삼각비', '삼각비의 뜻',
    ARRAY['삼각비', '사인', '코사인', '탄젠트'], '2022', '교육부', 2023, 4),
  ('[9수06-02]', '30도, 45도, 60도의 삼각비의 값을 구할 수 있다.', '수학', 9, 2, '삼각비', '특수각의 삼각비',
    ARRAY['30도', '45도', '60도', '특수각', '삼각비'], '2022', '교육부', 2023, 5),
  ('[9수06-03]', '삼각비를 활용하여 삼각형과 사각형의 넓이를 구할 수 있다.', '수학', 9, 2, '삼각비', '삼각비의 활용 (넓이)',
    ARRAY['넓이', '삼각형', '사각형', '삼각비', '활용'], '2022', '교육부', 2023, 6),
  ('[9수06-04]', '삼각비를 활용하여 실생활 문제를 해결할 수 있다.', '수학', 9, 2, '삼각비', '삼각비의 활용 (실생활)',
    ARRAY['실생활', '높이', '거리', '삼각비', '활용'], '2022', '교육부', 2023, 7)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- 원의 성질 (신규)
INSERT INTO achievement_standards (
  code, content, subject, grade, semester, unit, sub_unit,
  keywords, curriculum_version, source_name, effective_year, order_in_semester
) VALUES
  ('[9수07-01]', '원에서 현에 관한 성질을 이해한다.', '수학', 9, 2, '원의 성질', '원과 현',
    ARRAY['원', '현', '수직이등분', '중심거리'], '2022', '교육부', 2023, 8),
  ('[9수07-02]', '원에서 접선에 관한 성질을 이해한다.', '수학', 9, 2, '원의 성질', '원과 접선',
    ARRAY['접선', '접점', '수직', '접선의 길이'], '2022', '교육부', 2023, 9),
  ('[9수07-03]', '원주각과 중심각의 관계를 이해하고 활용할 수 있다.', '수학', 9, 2, '원의 성질', '원주각과 중심각',
    ARRAY['원주각', '중심각', '호', '원에 내접하는 사각형'], '2022', '교육부', 2023, 10)
ON CONFLICT (code) DO UPDATE SET
  content = EXCLUDED.content,
  unit = EXCLUDED.unit,
  sub_unit = EXCLUDED.sub_unit,
  keywords = EXCLUDED.keywords,
  source_name = EXCLUDED.source_name,
  effective_year = EXCLUDED.effective_year,
  order_in_semester = EXCLUDED.order_in_semester,
  updated_at = now();

-- ========================
-- 3. 검증 쿼리 (주석 — 수동 확인용)
-- ========================
-- SELECT grade, semester, count(*) FROM achievement_standards GROUP BY grade, semester ORDER BY grade, semester;
-- 예상: 7/1=15, 7/2=12, 8/1=14, 8/2=10, 9/1=15, 9/2=10 → 총 76개+
-- SELECT code, unit, order_in_semester FROM achievement_standards WHERE grade=8 AND semester=1 ORDER BY order_in_semester;
