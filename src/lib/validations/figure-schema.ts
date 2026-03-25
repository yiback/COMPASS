/**
 * 도형 데이터(FigureData) Zod 검증 스키마
 *
 * 6가지 도형 타입을 discriminated union으로 정의한다.
 * z.discriminatedUnion('type', [...])을 사용하여 타입별 분기 검증을 수행한다.
 *
 * 주의: figureInfoSchema(extraction-validation.ts)는 AI 추출 단계의 바운딩박스 정보이고,
 * 이 파일은 렌더링용 FigureData의 검증을 담당한다. 혼동 금지.
 */

import { z } from 'zod'

// ─── 공통 필드 ──────────────────────────────────────────

/**
 * 공통 displaySize 필드 — AI가 미전송하면 기본값 'large' 사용
 */
const displaySizeSchema = z.enum(['large', 'small']).default('large')

/**
 * 공통 description 필드 — 렌더링 실패 시 폴백 텍스트로 사용
 */
const descriptionSchema = z.string().min(1, '도형 설명이 비어있습니다.').max(500, '도형 설명은 500자 이하여야 합니다.')

/**
 * 2D 좌표 튜플 스키마 [x, y]
 */
const point2DSchema = z.tuple([z.number(), z.number()])

/**
 * 범위 튜플 스키마 [min, max] — min < max 조건은 각 타입에서 .refine()으로 검증
 */
const rangeSchema = z.tuple([z.number(), z.number()])

// ─── 타입별 스키마 ───────────────────────────────────────

/**
 * 좌표평면 스키마
 * - gridStep: 양수 필수
 * - xRange, yRange: 첫 번째 값 < 두 번째 값 필수
 */
const coordinatePlaneSchema = z
  .object({
    type: z.literal('coordinate_plane'),
    xRange: rangeSchema.refine((r) => r[0] < r[1], {
      message: 'xRange[0]이 xRange[1]보다 작아야 합니다.',
    }),
    yRange: rangeSchema.refine((r) => r[0] < r[1], {
      message: 'yRange[0]이 yRange[1]보다 작아야 합니다.',
    }),
    gridStep: z.number().positive('gridStep은 양수여야 합니다.'),
    displaySize: displaySizeSchema,
    description: descriptionSchema,
  })

/**
 * 함수 그래프 스키마
 * - points: 최소 2개, 최대 50개
 * - domain[0] < domain[1]
 * - xRange[0] < xRange[1], yRange[0] < yRange[1]
 */
const functionGraphSchema = z.object({
  type: z.literal('function_graph'),
  points: z
    .array(point2DSchema)
    .min(2, '함수 그래프는 최소 2개의 점이 필요합니다.')
    .max(50, '함수 그래프는 최대 50개의 점만 허용됩니다.'),
  domain: rangeSchema.refine((r) => r[0] < r[1], {
    message: 'domain[0]이 domain[1]보다 작아야 합니다.',
  }),
  xRange: rangeSchema.refine((r) => r[0] < r[1], {
    message: 'xRange[0]이 xRange[1]보다 작아야 합니다.',
  }),
  yRange: rangeSchema.refine((r) => r[0] < r[1], {
    message: 'yRange[0]이 yRange[1]보다 작아야 합니다.',
  }),
  gridStep: z.number().positive('gridStep은 양수여야 합니다.'),
  color: z.string().max(50, '색상값은 50자 이하여야 합니다.').optional(),
  displaySize: displaySizeSchema,
  description: descriptionSchema,
})

/**
 * 다각형 스키마
 * - vertices: 최소 3개 (삼각형 이상)
 * - labels: 꼭짓점 라벨 (선택)
 */
const polygonSchema = z.object({
  type: z.literal('polygon'),
  vertices: z
    .array(point2DSchema)
    .min(3, '다각형은 최소 3개의 꼭짓점이 필요합니다.'),
  labels: z.array(z.string()).optional(),
  displaySize: displaySizeSchema,
  description: descriptionSchema,
})

/**
 * 원 스키마
 * - radius: 양수 필수
 */
const circleSchema = z.object({
  type: z.literal('circle'),
  center: point2DSchema,
  radius: z.number().positive('radius는 양수여야 합니다.'),
  displaySize: displaySizeSchema,
  description: descriptionSchema,
})

/**
 * 벡터 스키마
 * - from !== to: 시작점과 끝점이 동일하면 제로 벡터 — 배열은 참조 비교 불가이므로 좌표값 직접 비교
 */
const vectorSchema = z
  .object({
    type: z.literal('vector'),
    from: point2DSchema,
    to: point2DSchema,
    label: z.string().optional(),
    displaySize: displaySizeSchema,
    description: descriptionSchema,
  })
  .refine((v) => v.from[0] !== v.to[0] || v.from[1] !== v.to[1], {
    message: '벡터의 시작점과 끝점이 동일합니다 (제로 벡터).',
  })

/**
 * 수직선 스키마
 * - min < max
 * - points: 최소 1개
 */
const numberLineSchema = z
  .object({
    type: z.literal('number_line'),
    min: z.number(),
    max: z.number(),
    points: z
      .array(
        z.object({
          value: z.number(),
          label: z.string(),
        })
      )
      .min(1, '수직선은 최소 1개의 점이 필요합니다.'),
    displaySize: displaySizeSchema,
    description: descriptionSchema,
  })
  .refine((v) => v.min < v.max, {
    message: 'min이 max보다 작아야 합니다.',
  })

// ─── Discriminated Union ──────────────────────────────────

/**
 * FigureData Zod 스키마 — 6가지 도형 타입 discriminated union
 *
 * z.discriminatedUnion은 'type' 판별자를 기준으로 빠르게 분기하며,
 * z.union보다 에러 메시지가 명확하다.
 */
export const figureDataSchema = z.discriminatedUnion('type', [
  coordinatePlaneSchema,
  functionGraphSchema,
  polygonSchema,
  circleSchema,
  vectorSchema,
  numberLineSchema,
])

/** figureDataSchema에서 추론된 FigureData 타입 */
export type FigureDataInput = z.input<typeof figureDataSchema>
export type FigureDataOutput = z.output<typeof figureDataSchema>

// ─── 교차 검증 유틸 ──────────────────────────────────────

/**
 * {{fig:N}} 참조 교차 검증 유틸
 *
 * questionText에서 {{fig:N}} 패턴을 추출하여 figures 배열 길이와 비교한다.
 * duck typing 시그니처 `{ length: number }`를 사용하므로
 * FigureInfo[]와 FigureData[] 모두 타입 캐스팅 없이 전달 가능하다.
 *
 * @param questionText - 문제 텍스트 ({{fig:N}} 패턴 포함 가능)
 * @param figures - 도형 배열 또는 undefined (duck typing: { length: number })
 * @returns 경고 메시지 배열 (throw하지 않음 — 부분 성공 허용)
 *
 * 주의사항:
 * - /g 플래그 정규식은 stateful → lastIndex 리셋 필수 (MEMORY.md 교훈)
 * - N은 1-based → figures[0]에 대응
 * - 범위 초과(figIndex > figures.length)만 감지, 미참조는 허용
 */
export function validateFigureIndices(
  questionText: string,
  figures: { length: number } | undefined
): string[] {
  // figures가 undefined이면 교차 검증 건너뜀 (early return)
  if (!figures) return []

  const warnings: string[] = []

  // /g 플래그 정규식은 stateful — 함수 진입 시 반드시 리셋 (MEMORY.md 교훈)
  const pattern = /\{\{fig:(\d+)\}\}/g
  pattern.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = pattern.exec(questionText)) !== null) {
    // N은 1-based ({{fig:1}} → figures[0])
    const figIndex = parseInt(match[1], 10)
    if (figIndex > figures.length) {
      warnings.push(
        `{{fig:${figIndex}}}가 있지만 figures 배열 길이는 ${figures.length}입니다.`
      )
    }
  }

  return warnings
}
