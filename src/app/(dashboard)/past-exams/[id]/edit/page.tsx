/**
 * 기출문제 추출 편집 페이지 (서버 컴포넌트)
 *
 * past_exams + past_exam_images + past_exam_details 3계층 조회
 * 권한 검증 후 ExtractionEditor 클라이언트 컴포넌트에 props 전달
 */

// sharp 기반 추출 Action이 이 라우트에서 호출됨 — Node.js 런타임 필수
export const runtime = 'nodejs'
export const maxDuration = 60 // Vercel Pro 기준 (Hobby: 10초)

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { ExtractionEditor } from './extraction-editor'

// ─── 타입 정의 ────────────────────────────────────────────

interface EditPageProps {
  readonly params: Promise<{ id: string }>
}

/** 서버 → 클라이언트 전달용 이미지 타입 */
export interface ImageData {
  readonly id: string
  readonly pageNumber: number
  readonly sourceImageUrl: string
}

/** 서버 → 클라이언트 전달용 문제 타입 (DB 전체 컬럼) */
export interface QuestionData {
  readonly id: string
  readonly questionNumber: number
  readonly questionText: string
  readonly questionType: string
  readonly options: string[] | null
  readonly answer: string | null
  readonly hasFigure: boolean
  readonly figures: FigureData[] | null
  readonly confidence: number | null
  readonly isConfirmed: boolean
}

/** 그래프/그림 정보 */
export interface FigureData {
  readonly url: string | null
  readonly description: string | null
  readonly confidence: number | null
  readonly pageNumber: number | null
  readonly boundingBox: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
  } | null
}

/** 시험 메타 정보 */
export interface ExamMeta {
  readonly id: string
  readonly schoolName: string
  readonly grade: number
  readonly subject: string
  readonly examType: string
  readonly year: number
  readonly semester: number
  readonly extractionStatus: string
}

// ─── 페이지 컴포넌트 ──────────────────────────────────────

export default async function EditPage({ params }: EditPageProps) {
  const { id: pastExamId } = await params

  // 1. 역할 검증 — admin/teacher만 접근 가능 (미통과 시 /unauthorized 리다이렉트)
  await requireRole(['admin', 'teacher'])

  // 2. Supabase 서버 클라이언트 생성 (past_exams DB 조회에 필요 — 유지)
  const supabase = await createClient()

  // 3. past_exams + past_exam_images + past_exam_details 조회
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 생성 타입 미생성 (FK JOIN 중첩 객체)
  const { data: row, error: dbError } = (await supabase
    .from('past_exams')
    .select(
      `
        id, year, semester, exam_type, grade, subject,
        extraction_status, created_at,
        schools!inner ( name, school_type ),
        past_exam_images ( id, page_number, source_image_url ),
        past_exam_details (
          id, question_number, question_text, question_type,
          options, answer, has_figure, figures,
          confidence, is_confirmed
        )
      `,
    )
    .eq('id', pastExamId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 생성 타입 미생성
    .single()) as { data: any | null; error: unknown }

  if (dbError || !row) {
    notFound()
  }

  // 5. 데이터 변환 (snake_case → camelCase)
  const examMeta: ExamMeta = {
    id: row.id,
    schoolName: row.schools?.name ?? '',
    grade: row.grade,
    subject: row.subject,
    examType: row.exam_type,
    year: row.year,
    semester: row.semester,
    extractionStatus: row.extraction_status,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB row 타입
  const images: ImageData[] = (row.past_exam_images ?? [])
    .map((img: any) => ({
      id: img.id,
      pageNumber: img.page_number,
      sourceImageUrl: img.source_image_url,
    }))
    .sort(
      (a: ImageData, b: ImageData) => a.pageNumber - b.pageNumber,
    )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB row 타입
  const questions: QuestionData[] = (row.past_exam_details ?? [])
    .map((d: any) => ({
      id: d.id,
      questionNumber: d.question_number,
      questionText: d.question_text,
      questionType: d.question_type ?? 'short_answer',
      options: d.options ?? null,
      answer: d.answer ?? null,
      hasFigure: d.has_figure ?? false,
      figures: d.figures ?? null,
      confidence: d.confidence ?? null,
      isConfirmed: d.is_confirmed ?? false,
    }))
    .sort(
      (a: QuestionData, b: QuestionData) =>
        a.questionNumber - b.questionNumber,
    )

  return (
    <ExtractionEditor
      examMeta={examMeta}
      initialImages={images}
      initialQuestions={questions}
    />
  )
}
