-- =============================================================
-- COMPASS 성능 인덱스
-- 고빈도 조회 패턴에 대한 인덱스 최적화
-- =============================================================

-- ========================
-- profiles 인덱스
-- ========================
CREATE INDEX idx_profiles_academy ON profiles(academy_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);

-- ========================
-- students 인덱스
-- ========================
CREATE INDEX idx_students_academy ON students(academy_id);
CREATE INDEX idx_students_school ON students(school_id);
CREATE INDEX idx_students_grade ON students(grade);
CREATE INDEX idx_students_profile ON students(profile_id);

-- ========================
-- teachers 인덱스
-- ========================
CREATE INDEX idx_teachers_academy ON teachers(academy_id);
CREATE INDEX idx_teachers_profile ON teachers(profile_id);

-- ========================
-- achievement_standards 인덱스
-- ========================
CREATE INDEX idx_standards_subject_grade ON achievement_standards(subject, grade);
CREATE INDEX idx_standards_code ON achievement_standards(code);
CREATE INDEX idx_standards_unit ON achievement_standards(subject, grade, unit);

-- ========================
-- questions 인덱스
-- ========================
CREATE INDEX idx_questions_academy ON questions(academy_id);
CREATE INDEX idx_questions_grade_subject ON questions(grade, subject);
CREATE INDEX idx_questions_achievement ON questions(achievement_standard_id);
CREATE INDEX idx_questions_type ON questions(type);
CREATE INDEX idx_questions_difficulty ON questions(difficulty);
CREATE INDEX idx_questions_created_by ON questions(created_by);

-- AI 생성 문제 검수 필터링 (부분 인덱스)
CREATE INDEX idx_questions_ai_review
  ON questions(ai_review_status)
  WHERE is_ai_generated = true;

-- 문제 검색용 복합 인덱스
CREATE INDEX idx_questions_search
  ON questions(academy_id, grade, subject, type);

-- ========================
-- past_exam_questions 인덱스
-- ========================
CREATE INDEX idx_past_exams_academy ON past_exam_questions(academy_id);
CREATE INDEX idx_past_exams_school ON past_exam_questions(school_id);
CREATE INDEX idx_past_exams_year_semester ON past_exam_questions(year, semester);
CREATE INDEX idx_past_exams_grade_subject ON past_exam_questions(grade, subject);
CREATE INDEX idx_past_exams_extraction ON past_exam_questions(extraction_status);

-- ========================
-- exams 인덱스
-- ========================
CREATE INDEX idx_exams_academy ON exams(academy_id);
CREATE INDEX idx_exams_status ON exams(status);
CREATE INDEX idx_exams_created_by ON exams(created_by);
CREATE INDEX idx_exams_grade_subject ON exams(grade, subject);
CREATE INDEX idx_exams_scheduled ON exams(scheduled_at)
  WHERE status IN ('draft', 'published');

-- ========================
-- exam_questions 인덱스
-- ========================
CREATE INDEX idx_exam_questions_exam ON exam_questions(exam_id);
CREATE INDEX idx_exam_questions_question ON exam_questions(question_id);

-- ========================
-- exam_submissions 인덱스
-- ========================
CREATE INDEX idx_submissions_academy ON exam_submissions(academy_id);
CREATE INDEX idx_submissions_student ON exam_submissions(student_id);
CREATE INDEX idx_submissions_exam ON exam_submissions(exam_id);
CREATE INDEX idx_submissions_status ON exam_submissions(status);

-- ========================
-- answers 인덱스
-- ========================
CREATE INDEX idx_answers_submission ON answers(submission_id);
CREATE INDEX idx_answers_question ON answers(question_id);

-- 교사 검수 필요한 답안 필터링 (부분 인덱스)
CREATE INDEX idx_answers_needs_review
  ON answers(needs_review)
  WHERE needs_review = true;

-- ========================
-- wrong_answer_notes 인덱스
-- ========================
CREATE INDEX idx_wrong_notes_student ON wrong_answer_notes(student_id);
CREATE INDEX idx_wrong_notes_academy ON wrong_answer_notes(academy_id);
CREATE INDEX idx_wrong_notes_question ON wrong_answer_notes(question_id);

-- 미복습 오답 필터링 (부분 인덱스)
CREATE INDEX idx_wrong_notes_unreviewed
  ON wrong_answer_notes(student_id)
  WHERE is_reviewed = false;

-- ========================
-- grade_appeals 인덱스
-- ========================
CREATE INDEX idx_appeals_academy ON grade_appeals(academy_id);
CREATE INDEX idx_appeals_student ON grade_appeals(student_id);
CREATE INDEX idx_appeals_status ON grade_appeals(status);

-- ========================
-- ai_generation_logs 인덱스
-- ========================
CREATE INDEX idx_ai_logs_academy ON ai_generation_logs(academy_id);
CREATE INDEX idx_ai_logs_user ON ai_generation_logs(user_id);
CREATE INDEX idx_ai_logs_action ON ai_generation_logs(action_type);
CREATE INDEX idx_ai_logs_created ON ai_generation_logs(created_at DESC);

-- ========================
-- 리뷰 보완: 복합 인덱스 (RLS 정책 최적화)
-- ========================

-- 학생의 시험 제출 조회 패턴
CREATE INDEX idx_submissions_academy_student
  ON exam_submissions(academy_id, student_id);

-- 학생의 최근 제출 조회
CREATE INDEX idx_submissions_academy_submitted
  ON exam_submissions(academy_id, submitted_at DESC)
  WHERE submitted_at IS NOT NULL;

-- 기출문제 검색 (학교별 + 학년/과목)
CREATE INDEX idx_past_exams_search
  ON past_exam_questions(school_id, grade, subject, year DESC, semester DESC);

-- 오답 노트: 학생별 최근 오답
CREATE INDEX idx_wrong_notes_student_created
  ON wrong_answer_notes(student_id, created_at DESC);

-- 이의제기: 학원별 + 상태
CREATE INDEX idx_appeals_academy_status
  ON grade_appeals(academy_id, status);

-- ========================
-- 리뷰 보완: 외래 키 인덱스 (reviewed_by 컬럼)
-- ========================
CREATE INDEX idx_questions_reviewed_by ON questions(reviewed_by)
  WHERE reviewed_by IS NOT NULL;
CREATE INDEX idx_answers_reviewed_by ON answers(reviewed_by)
  WHERE reviewed_by IS NOT NULL;
CREATE INDEX idx_past_exams_uploaded_by ON past_exam_questions(uploaded_by)
  WHERE uploaded_by IS NOT NULL;
CREATE INDEX idx_appeals_reviewed_by ON grade_appeals(reviewed_by)
  WHERE reviewed_by IS NOT NULL;
