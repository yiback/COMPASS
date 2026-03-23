'use client'

/**
 * 원(Circle) SVG 렌더러.
 *
 * 렌더링 요소:
 * - <circle>: 원 본체
 * - 중심점 표시(circle): 작은 원으로 중심 위치 표시
 * - 반지름 표시선(line): 중심 → 오른쪽 끝까지 선 + "r" 레이블 (optional)
 *
 * viewBox는 center ± radius + 여백으로 자동 계산한다.
 *
 * SVG y축 반전: 수학 좌표계(위=양수)를 SVG 좌표계(위=0)에 맞게 처리.
 *
 * React.memo로 래핑하여 동일 props 시 리렌더링을 방지한다.
 */

import { memo } from 'react'
import type { FigureData } from '@/lib/ai/types'
import { mapToSVG, formatNumber } from './svg-utils'

/** circle 타입만 추출한 Props 타입 */
type CircleFigure = Extract<FigureData, { type: 'circle' }>

interface CircleShapeProps {
  readonly figure: CircleFigure
  readonly className?: string
}

/** displaySize에 따른 SVG 크기 (px) */
const SIZE_MAP: Record<'large' | 'small', number> = {
  large: 300,
  small: 200,
}

/** SVG 내부 여백 (px) — 원이 잘리지 않도록 */
const PADDING = 30

/** 중심점 표시 원의 반지름 (px) */
const CENTER_DOT_RADIUS = 3

/** 반지름 레이블 오프셋 (px) — 선 중간에서 위쪽으로 */
const RADIUS_LABEL_OFFSET = 8

/**
 * 원을 SVG로 렌더링하는 컴포넌트.
 *
 * center 좌표와 radius를 SVG 좌표계로 변환하여 렌더링한다.
 * 수학 좌표계 기준이므로 y축을 반전하여 처리한다.
 *
 * @example
 * <CircleShape figure={figure} className="my-4" />
 */
export const CircleShape = memo(function CircleShape({
  figure,
  className,
}: CircleShapeProps) {
  const size = SIZE_MAP[figure.displaySize]
  const { center, radius } = figure

  const [cx, cy] = center

  // 원의 범위: 중심 ± 반지름
  // SVG y축 반전을 위해 yMin/yMax 교환 → mapToSVG가 위아래를 반전함
  const xMin = cx - radius
  const xMax = cx + radius
  const yMin = cy - radius
  const yMax = cy + radius

  // 데이터 좌표 → SVG 픽셀 좌표 변환 헬퍼
  // SVG y축 반전: yMin↔yMax 교환으로 수학 좌표계(위=양수)와 일치
  const toSvgX = (x: number) =>
    mapToSVG(x, xMin, xMax, PADDING, size - PADDING)
  const toSvgY = (y: number) =>
    mapToSVG(y, yMin, yMax, size - PADDING, PADDING) // 반전!

  // 중심 SVG 좌표
  const svgCx = toSvgX(cx)
  const svgCy = toSvgY(cy)

  // SVG 좌표계에서의 반지름 (픽셀 단위)
  // x축 방향으로 변환하여 픽셀 반지름을 계산
  const svgRadius = toSvgX(cx + radius) - svgCx

  // 반지름 선 끝점: 중심에서 오른쪽으로 반지름만큼
  const radiusEndX = svgCx + svgRadius
  const radiusEndY = svgCy

  // 반지름 레이블 위치: 선의 중간, 약간 위쪽
  const radiusLabelX = svgCx + svgRadius / 2
  const radiusLabelY = svgCy - RADIUS_LABEL_OFFSET

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={className}
      aria-label={figure.description}
      role="img"
    >
      {/* 각 컴포넌트가 자체 <defs>를 포함 — 전역 defs 의존 금지 */}
      <defs />

      {/* 원 본체 */}
      <circle
        cx={svgCx}
        cy={svgCy}
        r={svgRadius}
        fill="#EFF6FF"
        stroke="#2563EB"
        strokeWidth="1.5"
      />

      {/* 반지름 표시선: 중심 → 오른쪽 끝 */}
      <line
        x1={svgCx}
        y1={svgCy}
        x2={radiusEndX}
        y2={radiusEndY}
        stroke="#1D4ED8"
        strokeWidth="1"
        strokeDasharray="4 2"
      />

      {/* 반지름 레이블: 선 위 중간에 표시 */}
      <text
        x={radiusLabelX}
        y={radiusLabelY}
        textAnchor="middle"
        fontSize="10"
        fill="#1E40AF"
      >
        {`r=${formatNumber(radius)}`}
      </text>

      {/* 중심점 표시 원 */}
      <circle
        cx={svgCx}
        cy={svgCy}
        r={CENTER_DOT_RADIUS}
        fill="#1D4ED8"
      />

      {/* 중심 좌표 레이블 */}
      <text
        x={svgCx + 6}
        y={svgCy - 6}
        fontSize="9"
        fill="#6B7280"
      >
        {`(${formatNumber(cx)}, ${formatNumber(cy)})`}
      </text>
    </svg>
  )
})
