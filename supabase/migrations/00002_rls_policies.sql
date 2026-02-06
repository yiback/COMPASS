-- =============================================================
-- COMPASS RLS (Row Level Security) 정책
-- 멀티테넌시 데이터 격리 + 역할 기반 접근 제어
-- =============================================================

-- ========================
-- 헬퍼 함수
-- ========================

-- 현재 사용자의 academy_id 조회
CREATE OR REPLACE FUNCTION get_user_academy_id()
RETURNS UUID AS $$
  SELECT academy_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 현재 사용자의 role 조회
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 현재 사용자가 특정 역할인지 확인
CREATE OR REPLACE FUNCTION has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = required_role
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 현재 사용자가 여러 역할 중 하나인지 확인
CREATE OR REPLACE FUNCTION has_any_role(required_roles TEXT[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = ANY(required_roles)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ========================
-- 1. academies 테이블 RLS
-- ========================
ALTER TABLE academies ENABLE ROW LEVEL SECURITY;

-- 자기 학원만 조회
CREATE POLICY "academies_select_own"
  ON academies FOR SELECT
  USING (id = get_user_academy_id());

-- 관리자만 학원 정보 수정
CREATE POLICY "academies_update_admin"
  ON academies FOR UPDATE
  USING (
    id = get_user_academy_id()
    AND has_any_role(ARRAY['admin', 'system_admin'])
  );

-- system_admin만 학원 생성
CREATE POLICY "academies_insert_system_admin"
  ON academies FOR INSERT
  WITH CHECK (has_role('system_admin'));

-- ========================
-- 2. profiles 테이블 RLS
-- ========================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 같은 학원 소속 프로필 조회 (또는 자기 자신)
CREATE POLICY "profiles_select_same_academy"
  ON profiles FOR SELECT
  USING (
    academy_id = get_user_academy_id()
    OR id = auth.uid()
  );

-- 자기 프로필만 수정
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- 관리자가 같은 학원 프로필 수정
CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  USING (
    academy_id = get_user_academy_id()
    AND has_any_role(ARRAY['admin', 'system_admin'])
  );

-- 프로필 삽입은 트리거가 처리 (또는 관리자)
CREATE POLICY "profiles_insert"
  ON profiles FOR INSERT
  WITH CHECK (
    id = auth.uid()
    OR has_any_role(ARRAY['admin', 'system_admin'])
  );

-- ========================
-- 3. schools 테이블 RLS
-- ========================
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- 학교 정보는 모든 인증된 사용자가 조회 가능 (공개 정보)
CREATE POLICY "schools_select_authenticated"
  ON schools FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 관리자만 학교 정보 관리
CREATE POLICY "schools_insert_admin"
  ON schools FOR INSERT
  WITH CHECK (has_any_role(ARRAY['admin', 'system_admin']));

CREATE POLICY "schools_update_admin"
  ON schools FOR UPDATE
  USING (has_any_role(ARRAY['admin', 'system_admin']));

-- ========================
-- 4. students 테이블 RLS
-- ========================
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- 같은 학원 학생만 조회
CREATE POLICY "students_select_same_academy"
  ON students FOR SELECT
  USING (academy_id = get_user_academy_id());

-- 자기 정보 또는 관리자/교사가 수정
CREATE POLICY "students_update"
  ON students FOR UPDATE
  USING (
    academy_id = get_user_academy_id()
    AND (
      profile_id = auth.uid()
      OR has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
    )
  );

-- 관리자가 학생 등록
CREATE POLICY "students_insert_admin"
  ON students FOR INSERT
  WITH CHECK (
    academy_id = get_user_academy_id()
    AND has_any_role(ARRAY['admin', 'system_admin'])
  );

-- ========================
-- 5. teachers 테이블 RLS
-- ========================
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

-- 같은 학원 교사 조회
CREATE POLICY "teachers_select_same_academy"
  ON teachers FOR SELECT
  USING (academy_id = get_user_academy_id());

-- 자기 정보 또는 관리자가 수정
CREATE POLICY "teachers_update"
  ON teachers FOR UPDATE
  USING (
    academy_id = get_user_academy_id()
    AND (
      profile_id = auth.uid()
      OR has_any_role(ARRAY['admin', 'system_admin'])
    )
  );

-- 관리자가 교사 등록
CREATE POLICY "teachers_insert_admin"
  ON teachers FOR INSERT
  WITH CHECK (
    academy_id = get_user_academy_id()
    AND has_any_role(ARRAY['admin', 'system_admin'])
  );

-- ========================
-- 6. achievement_standards 테이블 RLS
-- ========================
ALTER TABLE achievement_standards ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 조회 가능 (공개 교육과정 데이터)
CREATE POLICY "achievement_standards_select_authenticated"
  ON achievement_standards FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- system_admin만 관리
CREATE POLICY "achievement_standards_insert_system_admin"
  ON achievement_standards FOR INSERT
  WITH CHECK (has_role('system_admin'));

CREATE POLICY "achievement_standards_update_system_admin"
  ON achievement_standards FOR UPDATE
  USING (has_role('system_admin'));

-- ========================
-- 7. questions 테이블 RLS
-- ========================
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- 같은 학원 문제만 조회
CREATE POLICY "questions_select_same_academy"
  ON questions FOR SELECT
  USING (academy_id = get_user_academy_id());

-- 교사/관리자만 문제 생성
CREATE POLICY "questions_insert_teacher"
  ON questions FOR INSERT
  WITH CHECK (
    academy_id = get_user_academy_id()
    AND has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
  );

-- 교사/관리자만 문제 수정
CREATE POLICY "questions_update_teacher"
  ON questions FOR UPDATE
  USING (
    academy_id = get_user_academy_id()
    AND has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
  );

-- 교사/관리자만 문제 삭제
CREATE POLICY "questions_delete_teacher"
  ON questions FOR DELETE
  USING (
    academy_id = get_user_academy_id()
    AND has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
  );

-- ========================
-- 8. past_exam_questions 테이블 RLS
-- ========================
ALTER TABLE past_exam_questions ENABLE ROW LEVEL SECURITY;

-- 같은 학원 기출문제만 조회
CREATE POLICY "past_exams_select_same_academy"
  ON past_exam_questions FOR SELECT
  USING (academy_id = get_user_academy_id());

-- 교사만 기출문제 등록
CREATE POLICY "past_exams_insert_teacher"
  ON past_exam_questions FOR INSERT
  WITH CHECK (
    academy_id = get_user_academy_id()
    AND has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
  );

-- 교사만 기출문제 수정
CREATE POLICY "past_exams_update_teacher"
  ON past_exam_questions FOR UPDATE
  USING (
    academy_id = get_user_academy_id()
    AND has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
  );

-- ========================
-- 9. exams 테이블 RLS
-- ========================
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

-- 같은 학원 시험 조회
CREATE POLICY "exams_select_same_academy"
  ON exams FOR SELECT
  USING (academy_id = get_user_academy_id());

-- 교사만 시험 생성
CREATE POLICY "exams_insert_teacher"
  ON exams FOR INSERT
  WITH CHECK (
    academy_id = get_user_academy_id()
    AND has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
  );

-- 시험 생성자 또는 관리자만 수정
CREATE POLICY "exams_update_owner"
  ON exams FOR UPDATE
  USING (
    academy_id = get_user_academy_id()
    AND (
      created_by = auth.uid()
      OR has_any_role(ARRAY['admin', 'system_admin'])
    )
  );

-- ========================
-- 10. exam_questions 테이블 RLS
-- ========================
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;

-- 같은 학원 시험-문제 연결 조회 (exams 통해 간접 확인)
CREATE POLICY "exam_questions_select"
  ON exam_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = exam_questions.exam_id
      AND exams.academy_id = get_user_academy_id()
    )
  );

-- 교사만 시험-문제 연결
CREATE POLICY "exam_questions_insert_teacher"
  ON exam_questions FOR INSERT
  WITH CHECK (
    has_any_role(ARRAY['teacher', 'system_admin'])
    AND EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = exam_questions.exam_id
      AND exams.academy_id = get_user_academy_id()
    )
  );

-- 교사만 시험-문제 삭제
CREATE POLICY "exam_questions_delete_teacher"
  ON exam_questions FOR DELETE
  USING (
    has_any_role(ARRAY['teacher', 'system_admin'])
    AND EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = exam_questions.exam_id
      AND exams.academy_id = get_user_academy_id()
    )
  );

-- ========================
-- 11. exam_submissions 테이블 RLS
-- ========================
ALTER TABLE exam_submissions ENABLE ROW LEVEL SECURITY;

-- 같은 학원 제출 조회 (학생: 자기 것만, 교사/관리자: 전체)
CREATE POLICY "submissions_select"
  ON exam_submissions FOR SELECT
  USING (
    academy_id = get_user_academy_id()
    AND (
      -- 교사/관리자는 학원 전체 조회
      has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
      -- 학생은 자기 제출만 조회
      OR student_id = (
        SELECT id FROM students WHERE profile_id = auth.uid()
      )
    )
  );

-- 학생만 답안 제출
CREATE POLICY "submissions_insert_student"
  ON exam_submissions FOR INSERT
  WITH CHECK (
    academy_id = get_user_academy_id()
    AND student_id = (
      SELECT id FROM students WHERE profile_id = auth.uid()
    )
  );

-- 제출 업데이트 (학생: 자기 것, 교사/관리자: 채점)
CREATE POLICY "submissions_update"
  ON exam_submissions FOR UPDATE
  USING (
    academy_id = get_user_academy_id()
    AND (
      student_id = (SELECT id FROM students WHERE profile_id = auth.uid())
      OR has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
    )
  );

-- ========================
-- 12. answers 테이블 RLS
-- ========================
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

-- 같은 학원 답안 조회 (submission을 통해 간접 확인)
CREATE POLICY "answers_select"
  ON answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM exam_submissions
      WHERE exam_submissions.id = answers.submission_id
      AND exam_submissions.academy_id = get_user_academy_id()
      AND (
        has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
        OR exam_submissions.student_id = (
          SELECT id FROM students WHERE profile_id = auth.uid()
        )
      )
    )
  );

-- 학생만 답안 제출
CREATE POLICY "answers_insert_student"
  ON answers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM exam_submissions
      WHERE exam_submissions.id = answers.submission_id
      AND exam_submissions.academy_id = get_user_academy_id()
      AND exam_submissions.student_id = (
        SELECT id FROM students WHERE profile_id = auth.uid()
      )
    )
  );

-- 교사/시스템만 답안 수정 (채점)
CREATE POLICY "answers_update_teacher"
  ON answers FOR UPDATE
  USING (
    has_any_role(ARRAY['teacher', 'system_admin'])
    AND EXISTS (
      SELECT 1 FROM exam_submissions
      WHERE exam_submissions.id = answers.submission_id
      AND exam_submissions.academy_id = get_user_academy_id()
    )
  );

-- ========================
-- 13. wrong_answer_notes 테이블 RLS
-- ========================
ALTER TABLE wrong_answer_notes ENABLE ROW LEVEL SECURITY;

-- 같은 학원 오답 노트 조회 (학생: 자기 것만, 교사/관리자: 전체)
CREATE POLICY "wrong_notes_select"
  ON wrong_answer_notes FOR SELECT
  USING (
    academy_id = get_user_academy_id()
    AND (
      has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
      OR student_id = (
        SELECT id FROM students WHERE profile_id = auth.uid()
      )
    )
  );

-- 시스템(서비스)이 오답 노트 자동 생성 (service_role 키 사용)
-- 학생도 복습 상태 업데이트 가능
CREATE POLICY "wrong_notes_insert"
  ON wrong_answer_notes FOR INSERT
  WITH CHECK (
    academy_id = get_user_academy_id()
  );

CREATE POLICY "wrong_notes_update"
  ON wrong_answer_notes FOR UPDATE
  USING (
    academy_id = get_user_academy_id()
    AND (
      student_id = (SELECT id FROM students WHERE profile_id = auth.uid())
      OR has_any_role(ARRAY['teacher', 'system_admin'])
    )
  );

-- ========================
-- 14. grade_appeals 테이블 RLS
-- ========================
ALTER TABLE grade_appeals ENABLE ROW LEVEL SECURITY;

-- 같은 학원 이의제기 조회
CREATE POLICY "appeals_select"
  ON grade_appeals FOR SELECT
  USING (
    academy_id = get_user_academy_id()
    AND (
      has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
      OR student_id = (
        SELECT id FROM students WHERE profile_id = auth.uid()
      )
    )
  );

-- 학생만 이의제기 생성
CREATE POLICY "appeals_insert_student"
  ON grade_appeals FOR INSERT
  WITH CHECK (
    academy_id = get_user_academy_id()
    AND student_id = (
      SELECT id FROM students WHERE profile_id = auth.uid()
    )
  );

-- 교사만 이의제기 처리
CREATE POLICY "appeals_update_teacher"
  ON grade_appeals FOR UPDATE
  USING (
    academy_id = get_user_academy_id()
    AND has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
  );

-- ========================
-- 15. ai_generation_logs 테이블 RLS
-- ========================
ALTER TABLE ai_generation_logs ENABLE ROW LEVEL SECURITY;

-- 같은 학원 로그 조회 (관리자/교사만)
CREATE POLICY "ai_logs_select"
  ON ai_generation_logs FOR SELECT
  USING (
    academy_id = get_user_academy_id()
    AND has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
  );

-- 인증된 사용자가 로그 생성 (서비스 레이어에서 호출)
CREATE POLICY "ai_logs_insert"
  ON ai_generation_logs FOR INSERT
  WITH CHECK (
    academy_id = get_user_academy_id()
  );
