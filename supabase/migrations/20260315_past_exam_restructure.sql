-- =============================================================
-- COMPASS 기출문제 3계층 스키마 마이그레이션
-- past_exam_questions(1계층) → past_exams/past_exam_images/past_exam_details(3계층)
-- =============================================================

-- ========================
-- 1. 테이블 생성
-- ========================

-- 1계층: past_exams (시험 단위)
-- 기존 past_exam_questions를 대체하는 3계층 구조의 최상위 테이블
CREATE TABLE past_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES academies(id),
  school_id UUID NOT NULL REFERENCES schools(id),
  created_by UUID REFERENCES profiles(id),
  year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  semester INTEGER NOT NULL CHECK (semester IN (1, 2)),
  exam_type TEXT NOT NULL CHECK (exam_type IN ('midterm', 'final', 'mock', 'diagnostic')),
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 12),
  subject TEXT NOT NULL,
  -- extraction_status 상태 전이 규칙:
  --   pending    → processing   (추출 시작)
  --   processing → completed    (추출 성공)
  --   processing → failed       (추출 실패/타임아웃)
  --   completed  → pending      (전체 재추출 요청)
  --   failed     → pending      (재시도 요청)
  -- CHECK는 단일 컬럼 값만 제약. 전이 규칙은 Server Action 레벨에서 enforce.
  extraction_status TEXT DEFAULT 'pending'
    CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  raw_ai_response TEXT,  -- AI 원본 응답 백업 (디버깅 + 재분석 시 참조)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2계층: past_exam_images (이미지 단위)
-- academy_id 직접 보유 — RLS 정책에서 JOIN 불필요
CREATE TABLE past_exam_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  past_exam_id UUID NOT NULL REFERENCES past_exams(id) ON DELETE CASCADE,
  academy_id UUID NOT NULL REFERENCES academies(id),
  page_number INTEGER NOT NULL,
  source_image_url TEXT NOT NULL,  -- Storage 경로: {academyId}/{pastExamId}/{page_number}-{fileId}.{ext}
  created_at TIMESTAMPTZ DEFAULT now(),
  -- 동일 시험 동일 page_number 중복 삽입 방어
  UNIQUE(past_exam_id, page_number)
);

-- 3계층: past_exam_details (문제 단위)
-- academy_id 직접 보유 — RLS 정책에서 JOIN 불필요
CREATE TABLE past_exam_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  past_exam_id UUID NOT NULL REFERENCES past_exams(id) ON DELETE CASCADE,
  academy_id UUID NOT NULL REFERENCES academies(id),
  question_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL
    CHECK (question_type IN ('multiple_choice', 'short_answer', 'essay')),
  options JSONB,                   -- 객관식 보기 배열
  answer TEXT,                     -- 정답 (없을 수 있음)
  has_figure BOOLEAN DEFAULT false, -- 그래프/그림 포함 여부
  figures JSONB,                   -- crop된 그래프/그림 정보 배열 (FigureInfo[])
  -- confidence: AI가 해당 문제 추출의 정확도를 자체 평가한 수치
  --   >= 0.8: 높은 신뢰도 (추출 정확)
  --   0.5~0.8: 중간 (사용자 검토 권장)
  --   < 0.5: 낮은 신뢰도 (수동 확인 필수)
  confidence NUMERIC CHECK (confidence BETWEEN 0 AND 1),
  is_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- 2. RLS 활성화 + 정책
-- ========================
-- 기존 헬퍼 함수 재사용: get_user_academy_id(), has_any_role()
-- student 의도적 차단 — teacher/admin/system_admin만 접근 허용

-- ---- past_exams RLS ----
ALTER TABLE past_exams ENABLE ROW LEVEL SECURITY;

-- SELECT: 같은 academy (teacher/admin/system_admin만)
CREATE POLICY "past_exams_select_same_academy"
  ON past_exams FOR SELECT
  USING (
    academy_id = get_user_academy_id()
    AND has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
  );

-- INSERT: 같은 academy (teacher/admin/system_admin만)
CREATE POLICY "past_exams_insert_teacher"
  ON past_exams FOR INSERT
  WITH CHECK (
    academy_id = get_user_academy_id()
    AND has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
  );

-- UPDATE: 본인 생성분(teacher) 또는 같은 academy(admin/system_admin)
CREATE POLICY "past_exams_update_owner"
  ON past_exams FOR UPDATE
  USING (
    academy_id = get_user_academy_id()
    AND (
      created_by = auth.uid()
      OR has_any_role(ARRAY['admin', 'system_admin'])
    )
  );

-- DELETE: 본인 생성분(teacher) 또는 같은 academy(admin/system_admin)
CREATE POLICY "past_exams_delete_owner"
  ON past_exams FOR DELETE
  USING (
    academy_id = get_user_academy_id()
    AND (
      created_by = auth.uid()
      OR has_any_role(ARRAY['admin', 'system_admin'])
    )
  );

-- ---- past_exam_images RLS ----
ALTER TABLE past_exam_images ENABLE ROW LEVEL SECURITY;

-- SELECT: 같은 academy (teacher/admin/system_admin만)
-- academy_id 직접 사용 — JOIN 불필요
CREATE POLICY "past_exam_images_select_same_academy"
  ON past_exam_images FOR SELECT
  USING (
    academy_id = get_user_academy_id()
    AND has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
  );

-- INSERT: 같은 academy (teacher/admin/system_admin만)
CREATE POLICY "past_exam_images_insert_teacher"
  ON past_exam_images FOR INSERT
  WITH CHECK (
    academy_id = get_user_academy_id()
    AND has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
  );

-- UPDATE: 같은 academy (teacher/admin/system_admin만)
CREATE POLICY "past_exam_images_update_teacher"
  ON past_exam_images FOR UPDATE
  USING (
    academy_id = get_user_academy_id()
    AND has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
  );

-- DELETE: 같은 academy (teacher/admin/system_admin만)
CREATE POLICY "past_exam_images_delete_teacher"
  ON past_exam_images FOR DELETE
  USING (
    academy_id = get_user_academy_id()
    AND has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
  );

-- ---- past_exam_details RLS ----
ALTER TABLE past_exam_details ENABLE ROW LEVEL SECURITY;

-- SELECT: 같은 academy (teacher/admin/system_admin만)
-- academy_id 직접 사용 — JOIN 불필요
CREATE POLICY "past_exam_details_select_same_academy"
  ON past_exam_details FOR SELECT
  USING (
    academy_id = get_user_academy_id()
    AND has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
  );

-- INSERT: 같은 academy (teacher/admin/system_admin만)
CREATE POLICY "past_exam_details_insert_teacher"
  ON past_exam_details FOR INSERT
  WITH CHECK (
    academy_id = get_user_academy_id()
    AND has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
  );

-- UPDATE: 같은 academy (teacher/admin/system_admin만)
CREATE POLICY "past_exam_details_update_teacher"
  ON past_exam_details FOR UPDATE
  USING (
    academy_id = get_user_academy_id()
    AND has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
  );

-- DELETE: 같은 academy (teacher/admin/system_admin만)
CREATE POLICY "past_exam_details_delete_teacher"
  ON past_exam_details FOR DELETE
  USING (
    academy_id = get_user_academy_id()
    AND has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
  );

-- ========================
-- 3. 인덱스
-- ========================

-- ---- past_exams 인덱스 ----
CREATE INDEX idx_pe_academy ON past_exams(academy_id);
CREATE INDEX idx_pe_school ON past_exams(school_id);
CREATE INDEX idx_pe_created_by ON past_exams(created_by)
  WHERE created_by IS NOT NULL;
CREATE INDEX idx_pe_extraction_status ON past_exams(extraction_status);
CREATE INDEX idx_pe_grade_subject ON past_exams(grade, subject);
-- 시험 검색용 복합 인덱스 (학교별 + 학년/과목 + 연도/학기 내림차순)
CREATE INDEX idx_pe_search
  ON past_exams(school_id, grade, subject, year DESC, semester DESC);

-- ---- past_exam_images 인덱스 ----
CREATE INDEX idx_pei_academy ON past_exam_images(academy_id);
CREATE INDEX idx_pei_past_exam ON past_exam_images(past_exam_id);
-- page_number 순 정렬 조회 최적화
CREATE INDEX idx_pei_past_exam_page ON past_exam_images(past_exam_id, page_number);

-- ---- past_exam_details 인덱스 ----
CREATE INDEX idx_ped_academy ON past_exam_details(academy_id);
CREATE INDEX idx_ped_past_exam ON past_exam_details(past_exam_id);
-- 문제 번호순 정렬 조회 최적화
CREATE INDEX idx_ped_past_exam_qnum ON past_exam_details(past_exam_id, question_number);
-- 미확정 문제 필터링 (부분 인덱스)
CREATE INDEX idx_ped_unconfirmed
  ON past_exam_details(past_exam_id)
  WHERE is_confirmed = false;

-- ========================
-- 4. updated_at 트리거 (기존 update_updated_at_column 함수 재사용)
-- ========================

-- past_exams: updated_at 자동 갱신
CREATE TRIGGER past_exams_updated_at
  BEFORE UPDATE ON past_exams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- past_exam_details: updated_at 자동 갱신
CREATE TRIGGER past_exam_details_updated_at
  BEFORE UPDATE ON past_exam_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- past_exam_images: updated_at 컬럼 없음 → 트리거 불필요

-- ========================
-- 5. DEPRECATED: past_exam_questions
-- ========================
-- 이 테이블은 3계층 구조(past_exams → past_exam_images → past_exam_details)로 대체되었다.
-- 기존 데이터는 개발 데이터이므로 이관하지 않는다.
-- 테이블 자체는 유지하되, 신규 개발 시 사용하지 않는다.
-- 기존 questions.source_metadata.pastExamId 참조도 개발 데이터이므로 무시한다.
COMMENT ON TABLE past_exam_questions IS
  'DEPRECATED: 3계층 구조(past_exams/past_exam_images/past_exam_details)로 대체됨. 신규 사용 금지.';

-- ========================
-- 6. ROLLBACK 절차
-- ========================
-- 문제 발생 시 아래 순서로 롤백 (CASCADE 제약 때문에 자식 테이블부터 삭제):
--
-- Step 1. DROP TABLE IF EXISTS past_exam_details;
-- Step 2. DROP TABLE IF EXISTS past_exam_images;
-- Step 3. DROP TABLE IF EXISTS past_exams;
-- Step 4. COMMENT ON TABLE past_exam_questions IS NULL;  -- deprecated 주석 제거
--
-- 주의: 롤백 시 past_exam_details, past_exam_images 데이터가 모두 삭제된다.
-- Storage의 이미지 파일은 수동으로 정리해야 한다.

-- ========================
-- 7. Storage RLS 경로 호환성
-- ========================
-- 기존 Storage RLS 정책은 split_part(name, '/', 1) 기반으로
-- 경로의 1번째 컴포넌트(academyId)를 기준으로 접근 권한을 검증한다.
-- 신규 경로 구조:
--   원본: {academyId}/{pastExamId}/{page_number}-{fileId}.{ext}
--   crop: {academyId}/{pastExamId}/figures/{detailId}-{figureIndex}.jpg
-- 두 경우 모두 1번째 경로 컴포넌트가 academyId이므로
-- 기존 Storage RLS 정책이 동일하게 동작한다.
-- crop 이미지도 같은 past-exams 버킷을 사용하므로 별도 정책 불필요.
