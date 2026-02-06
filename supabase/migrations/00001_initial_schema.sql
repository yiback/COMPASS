-- =============================================================
-- COMPASS 초기 스키마 마이그레이션
-- 15개 테이블 + 트리거 + 함수
-- =============================================================

-- ========================
-- 1. 확장 기능 활성화
-- ========================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================
-- 2. 커스텀 타입 (ENUM 대신 CHECK 사용 - 유연성)
-- ========================

-- ========================
-- 3. 유틸리티 함수
-- ========================

-- updated_at 자동 갱신 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================
-- 4. 인프라 테이블
-- ========================

-- 4-1. academies (학원 = 테넌트)
CREATE TABLE academies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER academies_updated_at
  BEFORE UPDATE ON academies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4-2. profiles (사용자 프로필 - auth.users 연동)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  academy_id UUID REFERENCES academies(id),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin', 'system_admin')),
  avatar_url TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- system_admin 외 모든 사용자는 academy_id 필수
  CONSTRAINT profiles_academy_required
    CHECK (role = 'system_admin' OR academy_id IS NOT NULL)
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4-3. schools (학교 정보)
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  school_type TEXT NOT NULL CHECK (school_type IN ('elementary', 'middle', 'high')),
  region TEXT,
  district TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER schools_updated_at
  BEFORE UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================
-- 5. 확장 테이블
-- ========================

-- 5-1. students (학생 확장 정보)
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  academy_id UUID NOT NULL REFERENCES academies(id),
  school_id UUID REFERENCES schools(id),
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 12),
  parent_phone TEXT,
  parent_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5-2. teachers (교사 확장 정보)
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  academy_id UUID NOT NULL REFERENCES academies(id),
  subjects TEXT[] DEFAULT '{}',
  grades INTEGER[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER teachers_updated_at
  BEFORE UPDATE ON teachers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================
-- 6. 교육과정 테이블
-- ========================

-- 6-1. achievement_standards (성취기준 - 교육부 학습목표)
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

CREATE TRIGGER achievement_standards_updated_at
  BEFORE UPDATE ON achievement_standards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================
-- 7. 문제 테이블
-- ========================

-- 7-1. questions (문제 - AI 생성 + 수동)
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES academies(id),
  created_by UUID REFERENCES profiles(id),
  -- 문제 내용
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('multiple_choice', 'short_answer', 'descriptive')),
  options JSONB,
  answer TEXT NOT NULL,
  explanation TEXT,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
  points INTEGER DEFAULT 1,
  -- 교육과정 연계
  achievement_standard_id UUID REFERENCES achievement_standards(id),
  subject TEXT NOT NULL,
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 12),
  unit TEXT,
  -- AI 생성 관련
  is_ai_generated BOOLEAN DEFAULT false,
  ai_review_status TEXT DEFAULT 'none'
    CHECK (ai_review_status IN ('none', 'pending', 'approved', 'rejected')),
  ai_model TEXT,
  ai_generation INTEGER DEFAULT 0,
  ai_prompt TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  -- 출처
  source_type TEXT CHECK (source_type IN ('past_exam', 'textbook', 'self_made', 'ai_generated')),
  source_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7-2. past_exam_questions (기출문제 - 학교별)
CREATE TABLE past_exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES academies(id),
  school_id UUID NOT NULL REFERENCES schools(id),
  uploaded_by UUID REFERENCES profiles(id),
  -- 기출 메타데이터
  year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  semester INTEGER NOT NULL CHECK (semester IN (1, 2)),
  exam_type TEXT NOT NULL CHECK (exam_type IN ('midterm', 'final', 'mock', 'diagnostic')),
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 12),
  subject TEXT NOT NULL,
  -- 이미지/내용
  source_image_url TEXT,
  extracted_content TEXT,
  extraction_status TEXT DEFAULT 'pending'
    CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  -- 교육과정 연계
  achievement_standard_id UUID REFERENCES achievement_standards(id),
  -- 연결된 문제 (추출 후)
  question_id UUID REFERENCES questions(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER past_exam_questions_updated_at
  BEFORE UPDATE ON past_exam_questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================
-- 8. 시험 테이블
-- ========================

-- 8-1. exams (시험)
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES academies(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  -- 대상 정보
  target_school_id UUID REFERENCES schools(id),
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 12),
  subject TEXT NOT NULL,
  -- 시험 설정
  duration_minutes INTEGER,
  total_points INTEGER DEFAULT 100,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'in_progress', 'completed', 'archived')),
  -- 기간
  scheduled_at TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER exams_updated_at
  BEFORE UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8-2. exam_questions (시험-문제 연결 M:N)
CREATE TABLE exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id),
  order_number INTEGER NOT NULL CHECK (order_number > 0),
  points INTEGER DEFAULT 1 CHECK (points > 0),
  UNIQUE(exam_id, question_id),
  UNIQUE(exam_id, order_number)
);

-- ========================
-- 9. 채점 테이블
-- ========================

-- 9-1. exam_submissions (시험 제출)
CREATE TABLE exam_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id),
  student_id UUID NOT NULL REFERENCES students(id),
  academy_id UUID NOT NULL REFERENCES academies(id),
  -- 제출 정보
  status TEXT DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'submitted', 'grading', 'graded', 'reviewed')),
  submitted_at TIMESTAMPTZ,
  -- 점수
  total_score NUMERIC,
  max_score NUMERIC,
  -- 답안지 이미지
  answer_sheet_urls TEXT[] DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(exam_id, student_id)
);

CREATE TRIGGER exam_submissions_updated_at
  BEFORE UPDATE ON exam_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9-2. answers (답안 - AI 채점 + 교사 검수)
CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES exam_submissions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id),
  -- 학생 답안
  student_answer TEXT,
  answer_image_url TEXT,
  -- 정답 여부
  is_correct BOOLEAN,
  score NUMERIC CHECK (score >= 0),
  max_score NUMERIC CHECK (max_score >= 0),
  -- AI 채점
  ai_score NUMERIC,
  ai_confidence NUMERIC CHECK (ai_confidence BETWEEN 0 AND 1),
  ai_feedback TEXT,
  needs_review BOOLEAN DEFAULT false,
  -- 교사 검수
  teacher_score NUMERIC,
  teacher_feedback TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(submission_id, question_id)
);

-- ========================
-- 10. 분석 테이블
-- ========================

-- 10-1. wrong_answer_notes (오답 노트)
CREATE TABLE wrong_answer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academy_id UUID NOT NULL REFERENCES academies(id),
  question_id UUID NOT NULL REFERENCES questions(id),
  answer_id UUID REFERENCES answers(id),
  -- 오답 정보
  student_answer TEXT,
  correct_answer TEXT,
  -- 학습 상태
  is_reviewed BOOLEAN DEFAULT false,
  review_count INTEGER DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  -- AI 분석
  weakness_tags TEXT[] DEFAULT '{}',
  ai_recommendation TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER wrong_answer_notes_updated_at
  BEFORE UPDATE ON wrong_answer_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10-2. grade_appeals (이의제기)
CREATE TABLE grade_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id UUID NOT NULL REFERENCES answers(id),
  student_id UUID NOT NULL REFERENCES students(id),
  academy_id UUID NOT NULL REFERENCES academies(id),
  -- 이의 내용
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewing', 'accepted', 'rejected')),
  -- 처리
  reviewed_by UUID REFERENCES profiles(id),
  review_comment TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER grade_appeals_updated_at
  BEFORE UPDATE ON grade_appeals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================
-- 11. 모니터링 테이블
-- ========================

-- 11-1. ai_generation_logs (AI 생성 로그)
CREATE TABLE ai_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES academies(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  -- 요청 정보
  action_type TEXT NOT NULL
    CHECK (action_type IN ('question_generation', 'grading', 'ocr_extraction', 'trend_analysis')),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  -- 입출력
  input_params JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  -- 결과
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed', 'timeout')),
  error_message TEXT,
  -- 성능
  duration_ms INTEGER,
  token_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- 12. 프로필 자동 생성 트리거
-- ========================

-- auth.users에 새 사용자 생성 시 profiles 자동 생성
-- 보안: role은 항상 'student'로 고정 (권한 상승 방지)
-- 관리자/교사 역할은 학원 관리자가 수동으로 변경
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'student'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
