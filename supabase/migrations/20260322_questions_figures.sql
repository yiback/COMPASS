-- =============================================================
-- questions 테이블 도형 컬럼 추가 마이그레이션
-- 도형/그래프 렌더링 지원을 위한 컬럼 추가 (단계 1.5-2)
-- past_exam_details 테이블의 has_figure/figures 패턴과 일관성 유지
-- =============================================================

-- questions 테이블에 도형 관련 컬럼 추가
-- DEFAULT false: 기존 rows에 영향 없음 (BACKWARD COMPATIBLE)
-- figures JSONB: nullable — 도형 없는 문제는 NULL
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS has_figure BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS figures JSONB;

-- 참조: past_exam_details 동일 패턴
--   has_figure BOOLEAN DEFAULT false  -- questions는 NOT NULL DEFAULT false로 더 엄격
--   figures JSONB                     -- crop된 그래프/그림 정보 배열 (FigureInfo[])

-- RLS 정책 변경 불필요:
--   기존 questions RLS 정책이 테이블 전체를 커버하므로
--   신규 컬럼은 자동으로 기존 정책의 보호를 받는다.

-- ROLLBACK 절차 (문제 발생 시):
--   ALTER TABLE questions DROP COLUMN IF EXISTS has_figure;
--   ALTER TABLE questions DROP COLUMN IF EXISTS figures;
