-- =============================================================
-- COMPASS Storage 버킷 및 RLS 정책
-- 기출문제 이미지/PDF 저장용 버킷
-- =============================================================

-- ========================
-- 1. past-exams 버킷 생성
-- ========================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'past-exams',
  'past-exams',
  false,                    -- private 버킷 (Signed URL로만 접근)
  5242880,                  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

-- ========================
-- 2. Storage RLS 정책
-- ========================
-- 경로 구조: {academy_id}/{school_id}/{year-semester-type}/{uuid.ext}
-- 예: 550e8400-e29b-41d4-a716-446655440000/...

-- 조회: 같은 학원 경로의 파일만 조회 가능
CREATE POLICY "past_exams_select_same_academy"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'past-exams'
  AND auth.uid() IS NOT NULL
  AND split_part(name, '/', 1)::UUID = get_user_academy_id()
);

-- 업로드: 교사/관리자만 업로드 가능 (같은 학원 경로)
CREATE POLICY "past_exams_insert_teacher"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'past-exams'
  AND has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
  AND split_part(name, '/', 1)::UUID = get_user_academy_id()
);

-- 삭제: 교사/관리자만 삭제 가능 (같은 학원 경로)
CREATE POLICY "past_exams_delete_teacher"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'past-exams'
  AND has_any_role(ARRAY['teacher', 'admin', 'system_admin'])
  AND split_part(name, '/', 1)::UUID = get_user_academy_id()
);
