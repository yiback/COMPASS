/**
 * 기출 추출 + 재추출 + 재분석 Server Actions
 *
 * - extractQuestionsAction: AI 기출 추출 (Optimistic Lock + crop + INSERT)
 * - resetExtractionAction: 전체 재추출 (Storage cleanup + DELETE + status reset)
 * - reanalyzeQuestionAction: 단일 문제 재분석 (전체 이미지 재로딩 + AI 호출 + UPDATE)
 */

'use server'

// NOTE: runtime='nodejs'와 maxDuration=60은 Server Action 파일에서 직접 설정 불가.
// 이 Action을 호출하는 route segment (page.tsx)에서 설정해야 한다.
// → src/app/(dashboard)/past-exams/[id]/edit/page.tsx에 설정됨.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAIProvider } from '@/lib/ai/provider'
import {
  extractQuestionsSchema,
  resetExtractionSchema,
  reanalyzeQuestionSchema,
} from '@/lib/validations/extract-questions'
import { toDbQuestionType } from '@/lib/ai/types'
import type {
  ImagePart,
  ExtractedQuestion,
  ExtractQuestionResult,
} from '@/lib/ai/types'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── 반환 타입 ────────────────────────────────────────────

export interface ExtractQuestionsResult {
  readonly error?: string
}

export interface ResetExtractionResult {
  readonly error?: string
}

export interface ReanalyzeQuestionResult {
  readonly error?: string
}

// ─── 내부 타입 ────────────────────────────────────────────

interface CurrentUserProfile {
  readonly id: string
  readonly role: string
  readonly academyId: string
}

interface GetCurrentUserResult {
  readonly error?: string
  readonly profile?: CurrentUserProfile
}

/** 허용 역할: teacher, admin, system_admin */
const ALLOWED_ROLES = ['teacher', 'admin', 'system_admin']

// ─── 내부 헬퍼 ────────────────────────────────────────────

/**
 * 현재 사용자 인증 + 프로필 + 역할 확인
 * exam-management.ts의 getCurrentUserWithRole과 동일 패턴
 */
async function getCurrentUserWithRole(): Promise<GetCurrentUserResult> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: '로그인이 필요합니다.' }
  }

  const { data: profile, error: profileError } = (await supabase
    .from('profiles')
    .select('id, role, academy_id')
    .eq('id', user.id)
    .single()) as {
    data: { id: string; role: string; academy_id: string | null } | null
    error: unknown
  }

  if (profileError || !profile) {
    return { error: '프로필을 찾을 수 없습니다.' }
  }

  if (!profile.academy_id) {
    return { error: '소속 학원이 없습니다.' }
  }

  if (!ALLOWED_ROLES.includes(profile.role)) {
    return { error: '권한이 없습니다.' }
  }

  return {
    profile: {
      id: profile.id,
      role: profile.role,
      academyId: profile.academy_id,
    },
  }
}

/**
 * 시험의 모든 이미지를 직렬로 base64 변환하여 ImagePart 배열 반환
 * extractQuestionsAction과 reanalyzeQuestionAction에서 공유
 *
 * 직렬 변환(for...of): 메모리 피크 억제 — 20장 * 5MB 동시 로딩 방지
 */
async function buildImageParts(
  supabase: SupabaseClient,
  pastExamId: string,
): Promise<readonly ImagePart[]> {
  const { data: images } = await supabase
    .from('past_exam_images')
    .select('source_image_url')
    .eq('past_exam_id', pastExamId)
    .order('page_number', { ascending: true })

  const parts: ImagePart[] = []
  for (const image of (images as { source_image_url: string }[]) ?? []) {
    const { data: signedUrlData } = await supabase.storage
      .from('past-exams')
      .createSignedUrl(image.source_image_url, 300)
    const response = await fetch(signedUrlData!.signedUrl)
    const buffer = await response.arrayBuffer()
    const mimeType = response.headers.get('content-type') ?? 'image/jpeg'
    parts.push({
      mimeType,
      data: Buffer.from(buffer).toString('base64'),
    })
  }
  return parts
}

// ─── extractQuestionsAction ───────────────────────────────

/**
 * 기출 시험지 이미지에서 문제 추출
 *
 * 핵심 흐름:
 * 1. Optimistic Lock (extraction_status IN ('pending', 'failed') → 'processing')
 * 2. 이미지별 직렬 base64 변환 (메모리 방어)
 * 3. AI Provider.extractQuestions 호출
 * 4. sharp crop: normalized → pixel 변환 + 클램핑
 * 5. past_exam_details INSERT
 * 6. extraction_status = 'completed' + raw_ai_response 백업
 * 7. finally: 실패 시 extraction_status = 'failed' 롤백 보장
 */
export async function extractQuestionsAction(
  pastExamId: string,
): Promise<ExtractQuestionsResult> {
  // 1. 인증 + 권한
  const { error: authError, profile } = await getCurrentUserWithRole()
  if (authError || !profile) {
    return { error: authError }
  }

  // 2. Zod 검증
  const parsed = extractQuestionsSchema.safeParse({ pastExamId })
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.',
    }
  }

  const supabase = await createClient()

  // 3. Optimistic Lock — 동시 추출 방지
  //    extraction_status가 pending/failed일 때만 processing으로 전환
  //    빈 배열이면 이미 processing/completed 상태
  //    academy_id 필터: 타 학원 시험 변조 방지 (IDOR 방어)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 생성 타입 미생성
  const { data: locked } = (await supabase
    .from('past_exams')
    .update({ extraction_status: 'processing' })
    .eq('id', pastExamId)
    .eq('academy_id', profile.academyId)
    .in('extraction_status', ['pending', 'failed'])
    .select('id, subject, grade, exam_type, academy_id')) as {
    data:
      | {
          id: string
          subject: string
          grade: number
          exam_type: string
          academy_id: string
        }[]
      | null
    error: unknown
  }

  if (!locked || locked.length === 0) {
    return { error: '이미 처리 중이거나 완료된 시험입니다.' }
  }

  const pastExam = locked[0]

  // 4. 기존 details DELETE 방어 (부분 성공 케이스 — INSERT 성공 + UPDATE 실패 시 잔존 데이터)
  //    academy_id 필터: 타 학원 데이터 삭제 방지 (IDOR 방어)
  await supabase
    .from('past_exam_details')
    .delete()
    .eq('past_exam_id', pastExamId)
    .eq('academy_id', pastExam.academy_id)

  // 5. isCompleted + try/finally 패턴 — 실패 시 'failed' 롤백 보장
  let isCompleted = false
  try {
    // 5a. 이미지 조회 (page_number ASC)
    const { data: images } = await supabase
      .from('past_exam_images')
      .select('id, source_image_url, page_number')
      .eq('past_exam_id', pastExamId)
      .order('page_number', { ascending: true })

    const imageList =
      (images as {
        id: string
        source_image_url: string
        page_number: number
      }[]) ?? []

    // 5b. 이미지별 직렬 base64 변환 (메모리 방어 — for...of)
    //     crop 단계에서 재fetch 방지를 위해 Buffer 맵도 함께 구성
    const imageParts: ImagePart[] = []
    const imageBufferMap = new Map<number, Buffer>()
    for (const image of imageList) {
      const { data: signedUrlData } = await supabase.storage
        .from('past-exams')
        .createSignedUrl(image.source_image_url, 300)
      if (!signedUrlData?.signedUrl) continue
      const response = await fetch(signedUrlData.signedUrl)
      const arrayBuffer = await response.arrayBuffer()
      const mimeType = response.headers.get('content-type') ?? 'image/jpeg'
      const buffer = Buffer.from(arrayBuffer)
      imageBufferMap.set(image.page_number, buffer)
      imageParts.push({
        mimeType,
        data: buffer.toString('base64'),
      })
    }

    if (imageParts.length === 0) {
      throw new Error('변환 가능한 이미지가 없습니다.')
    }

    // 5c. AI Provider.extractQuestions 호출
    const aiProvider = createAIProvider()
    const aiResult: ExtractQuestionResult =
      await aiProvider.extractQuestions({
        imageParts,
        subject: pastExam.subject,
        grade: pastExam.grade,
        examType: pastExam.exam_type,
      })

    // 5d. 그래프 crop 처리 — sharp dynamic import (Edge Runtime 불가)
    const sharp = (await import('sharp')).default
    const admin = createAdminClient()

    // detailId 사전 생성 맵 — crop Storage 경로에 필요하므로 INSERT 전에 할당
    const detailEntries: Array<{
      readonly detailId: string
      readonly question: ExtractedQuestion
      readonly figureUrls: Map<number, string | null>
    }> = []

    for (const question of aiResult.questions) {
      const detailId = crypto.randomUUID()
      const figureUrls = new Map<number, string | null>()

      if (question.hasFigure && question.figures) {
        for (let i = 0; i < question.figures.length; i++) {
          const figure = question.figures[i]
          try {
            // pageNumber로 5b에서 캐싱한 Buffer 재사용 (중복 fetch 방지)
            const imgBuffer = imageBufferMap.get(figure.pageNumber)
            if (!imgBuffer) {
              figureUrls.set(i, null)
              continue
            }

            // normalized → pixel 변환 + 클램핑
            const metadata = await sharp(imgBuffer).metadata()
            const imgWidth = metadata.width!
            const imgHeight = metadata.height!

            let px = Math.round(figure.boundingBox.x * imgWidth)
            let py = Math.round(figure.boundingBox.y * imgHeight)
            let pw = Math.round(figure.boundingBox.width * imgWidth)
            let ph = Math.round(figure.boundingBox.height * imgHeight)

            // 클램핑 — 이미지 경계를 넘지 않도록 보정
            px = Math.max(0, Math.min(px, imgWidth - 1))
            py = Math.max(0, Math.min(py, imgHeight - 1))
            pw = Math.min(pw, imgWidth - px)
            ph = Math.min(ph, imgHeight - py)

            if (pw <= 0 || ph <= 0) {
              throw new Error('Invalid crop dimensions')
            }

            const croppedBuffer = await sharp(imgBuffer)
              .extract({ left: px, top: py, width: pw, height: ph })
              .jpeg({ quality: 85 })
              .toBuffer()

            // Storage 업로드 (admin 클라이언트 — RLS 우회)
            const storagePath = `${pastExam.academy_id}/${pastExamId}/figures/${detailId}-${i}.jpg`
            await admin.storage
              .from('past-exams')
              .upload(storagePath, croppedBuffer, {
                contentType: 'image/jpeg',
              })

            figureUrls.set(i, storagePath)
          } catch {
            // crop 개별 실패 시 figure.url = null (부분 성공 허용)
            figureUrls.set(i, null)
          }
        }
      }

      detailEntries.push({ detailId, question, figureUrls })
    }

    // 5e. past_exam_details INSERT (문제별 1행)
    const details = detailEntries.map(
      ({ detailId, question, figureUrls }) => ({
        id: detailId,
        past_exam_id: pastExamId,
        academy_id: pastExam.academy_id,
        question_number: question.questionNumber,
        question_text: question.questionText,
        question_type: toDbQuestionType(question.questionType),
        options: question.options ? [...question.options] : null,
        answer: question.answer ?? null,
        has_figure: question.hasFigure,
        figures: question.figures
          ? question.figures.map((fig, i) => ({
              url: figureUrls.get(i) ?? null,
              description: fig.description,
              boundingBox: { ...fig.boundingBox },
              pageNumber: fig.pageNumber,
              confidence: fig.confidence,
            }))
          : null,
        confidence: question.confidence,
        is_confirmed: false,
      }),
    )

    if (details.length > 0) {
      const { error: insertError } = await supabase
        .from('past_exam_details')
        .insert(details)
      if (insertError) {
        throw new Error(`문제 저장 실패: ${insertError.message}`)
      }
    }

    // 5f. raw_ai_response 백업 + extraction_status = 'completed'
    //     academy_id 필터: 타 학원 시험 상태 변조 방지 (IDOR 방어)
    await supabase
      .from('past_exams')
      .update({
        extraction_status: 'completed',
        raw_ai_response: JSON.stringify(aiResult),
      })
      .eq('id', pastExamId)
      .eq('academy_id', profile.academyId)

    isCompleted = true
  } catch (error) {
    // AI 에러(Rate Limit 등)를 throw 대신 { error } 반환 — 클라이언트 .then()에서 처리 가능
    console.error('[extractQuestionsAction] 추출 실패:', error)
    const message =
      error instanceof Error
        ? error.message
        : '문제 추출 중 오류가 발생했습니다.'
    return { error: message }
  } finally {
    // 실패 시 extraction_status = 'failed' 롤백 보장
    // academy_id 필터: 타 학원 시험 상태 변조 방지 (IDOR 방어)
    if (!isCompleted) {
      await supabase
        .from('past_exams')
        .update({ extraction_status: 'failed' })
        .eq('id', pastExamId)
        .eq('academy_id', profile.academyId)
    }
  }

  return {}
}

// ─── resetExtractionAction ────────────────────────────────

/**
 * 전체 재추출 — 기존 추출 결과 삭제 + status 초기화
 *
 * Storage orphan cleanup은 Non-blocking — 삭제 실패 시 무시
 * (orphan 파일은 Phase 2 cleanup job으로 처리)
 */
export async function resetExtractionAction(
  pastExamId: string,
): Promise<ResetExtractionResult> {
  // 1. 인증 + 권한
  const { error: authError, profile } = await getCurrentUserWithRole()
  if (authError || !profile) {
    return { error: authError }
  }

  // 2. Zod 검증
  const parsed = resetExtractionSchema.safeParse({ pastExamId })
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.',
    }
  }

  const supabase = await createClient()

  // 3. 기존 past_exam_details 조회 → figures[].url 목록 수집
  //    academy_id 필터: 타 학원 데이터 조회 방지 (IDOR 방어)
  const { data: existingDetails } = await supabase
    .from('past_exam_details')
    .select('figures')
    .eq('past_exam_id', pastExamId)
    .eq('academy_id', profile.academyId)

  // 4. Storage orphan cleanup (Non-blocking)
  //    삭제 실패 시 무시하고 계속 진행
  //    이유: 재추출 흐름을 Storage 오류로 중단하지 않음 (사용자 경험 우선)
  const figurePaths: string[] = []
  for (const detail of (existingDetails as { figures: unknown }[]) ?? []) {
    if (detail.figures && Array.isArray(detail.figures)) {
      for (const fig of detail.figures) {
        if (
          fig &&
          typeof fig === 'object' &&
          'url' in fig &&
          typeof fig.url === 'string'
        ) {
          figurePaths.push(fig.url)
        }
      }
    }
  }
  if (figurePaths.length > 0) {
    try {
      const admin = createAdminClient()
      await admin.storage.from('past-exams').remove(figurePaths)
    } catch {
      // Non-blocking: Storage 삭제 실패 무시
    }
  }

  // 5. past_exam_details DELETE
  //    academy_id 필터: 타 학원 데이터 삭제 방지 (IDOR 방어)
  await supabase
    .from('past_exam_details')
    .delete()
    .eq('past_exam_id', pastExamId)
    .eq('academy_id', profile.academyId)

  // 6. extraction_status = 'pending'
  //    academy_id 필터: 타 학원 시험 상태 변조 방지 (IDOR 방어)
  await supabase
    .from('past_exams')
    .update({ extraction_status: 'pending' })
    .eq('id', pastExamId)
    .eq('academy_id', profile.academyId)

  return {}
}

// ─── reanalyzeQuestionAction ──────────────────────────────

/**
 * 단일 문제 재분석 — 사용자 피드백 반영
 *
 * 전체 이미지를 전달하는 이유:
 * - 페이지 경계를 넘는 문제 가능성
 * - AI 컨텍스트 일관성 보장
 * - 특정 페이지만 전달하면 앞뒤 맥락 부족으로 정확도 저하 우려
 */
export async function reanalyzeQuestionAction(
  detailId: string,
  feedback?: string,
): Promise<ReanalyzeQuestionResult> {
  // 1. 인증 + 권한
  const { error: authError, profile } = await getCurrentUserWithRole()
  if (authError || !profile) {
    return { error: authError }
  }

  // 2. Zod 검증
  const parsed = reanalyzeQuestionSchema.safeParse({ detailId, feedback })
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.',
    }
  }

  const supabase = await createClient()

  // 3. 해당 detail + 시험 정보 조회
  //    academy_id 필터: 타 학원 데이터 조회 방지 (IDOR 방어)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 생성 타입 미생성
  const { data: detail, error: detailError } = (await supabase
    .from('past_exam_details')
    .select('*, past_exams(id, subject, grade, exam_type)')
    .eq('id', detailId)
    .eq('academy_id', profile.academyId)
    .single()) as {
    data: {
      id: string
      question_number: number
      question_text: string
      question_type: string
      options: string[] | null
      answer: string | null
      confidence: number
      has_figure: boolean
      figures: unknown[] | null
      past_exams: {
        id: string
        subject: string
        grade: number
        exam_type: string
      }
    } | null
    error: unknown
  }

  if (detailError || !detail) {
    return { error: '문제를 찾을 수 없습니다.' }
  }

  // 4. 전체 이미지 → 직렬 base64 변환 (buildImageParts 재사용)
  const imageParts = await buildImageParts(supabase, detail.past_exams.id)

  // 5. AI Provider.reanalyzeQuestion 호출
  const aiProvider = createAIProvider()

  // DB question_type → AI QuestionType 변환
  const { fromDbQuestionType } = await import('@/lib/ai/types')
  const aiQuestionType = fromDbQuestionType(
    detail.question_type as 'multiple_choice' | 'short_answer' | 'descriptive',
  )

  const currentQuestion: ExtractedQuestion = {
    questionNumber: detail.question_number,
    questionText: detail.question_text,
    questionType: aiQuestionType,
    options: detail.options ?? undefined,
    answer: detail.answer ?? undefined,
    confidence: detail.confidence,
    hasFigure: detail.has_figure,
    figures: (detail.figures as ExtractedQuestion['figures']) ?? undefined,
  }

  try {
    const result = await aiProvider.reanalyzeQuestion({
      imageParts,
      questionNumber: detail.question_number,
      currentQuestion,
      userFeedback: feedback,
      subject: detail.past_exams.subject,
      grade: detail.past_exams.grade,
    })

    // 6. 해당 detail만 UPDATE
    //    academy_id 필터: 타 학원 데이터 변조 방지 (IDOR 방어)
    const { error: updateError } = await supabase
      .from('past_exam_details')
      .update({
        question_text: result.questionText,
        question_type: toDbQuestionType(result.questionType),
        options: result.options ? [...result.options] : null,
        answer: result.answer ?? null,
        confidence: result.confidence,
        has_figure: result.hasFigure,
        figures: result.figures
          ? result.figures.map((fig) => ({
              url: fig.url,
              description: fig.description,
              boundingBox: { ...fig.boundingBox },
              pageNumber: fig.pageNumber,
              confidence: fig.confidence,
            }))
          : null,
      })
      .eq('id', detailId)
      .eq('academy_id', profile.academyId)

    if (updateError) {
      return { error: '문제 업데이트에 실패했습니다.' }
    }
  } catch {
    return { error: 'AI 재분석에 실패했습니다. 다시 시도해주세요.' }
  }

  return {}
}
