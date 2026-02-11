-- =============================================================
-- RLS 정책 업데이트: schools 테이블에 teacher 역할 추가
-- =============================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "schools_insert_admin" ON schools;
DROP POLICY IF EXISTS "schools_update_admin" ON schools;

-- 새 정책 생성 (teacher 추가)
CREATE POLICY "schools_insert_admin_teacher"
  ON schools FOR INSERT
  WITH CHECK (has_any_role(ARRAY['teacher', 'admin', 'system_admin']));

CREATE POLICY "schools_update_admin_teacher"
  ON schools FOR UPDATE
  USING (has_any_role(ARRAY['teacher', 'admin', 'system_admin']));

-- DELETE 정책 추가 (누락되어 있었음)
CREATE POLICY "schools_delete_admin_teacher"
  ON schools FOR DELETE
  USING (has_any_role(ARRAY['teacher', 'admin', 'system_admin']));
