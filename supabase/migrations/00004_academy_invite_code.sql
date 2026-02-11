-- =============================================================
-- 학원 초대 코드 + 프로필 트리거 수정
-- 회원가입 시 학원 연결을 위한 invite_code 컬럼 추가
-- handle_new_user 트리거에서 metadata.academy_id 읽기
-- =============================================================

-- ========================
-- 1. academies 테이블에 invite_code 컬럼 추가
-- ========================
ALTER TABLE academies ADD COLUMN invite_code TEXT UNIQUE;

-- 빠른 조회를 위한 인덱스
CREATE INDEX idx_academies_invite_code ON academies(invite_code);

-- ========================
-- 2. handle_new_user 트리거 수정
-- 기존: role='student', name만 metadata에서 읽음
-- 변경: academy_id도 metadata에서 읽어 profiles에 저장
-- ========================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name, role, academy_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'student',
    -- metadata에서 academy_id 읽기 (없으면 NULL)
    -- 보안: academy_id 유효성은 Server Action에서 검증 완료 후 전달됨
    (NEW.raw_user_meta_data->>'academy_id')::UUID
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
