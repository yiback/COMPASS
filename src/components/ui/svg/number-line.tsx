'use client'

/**
 * 수직선(Number Line) SVG 렌더러.
 *
 * FigureData의 number_line 타입을 받아 수평 SVG로 렌더링한다.
 * - 수평선 + 양쪽 화살표
 * - 정수 간격 눈금(tick mark)
 * - 지정된 points: 원(circle) + 레이블 텍스트
 * - 각 SVG 내부에 <defs>를 포함하므로 전역 의존성 없음
 *
 * React.memo로 래핑하여 동일 props 시 리렌더링을 방지한다.
 */

import { memo } from 'react'
import type { FigureData } from '@/lib/ai/types'
import {
  mapToSVG,
  calcViewBox,
  formatNumber,
  NUMBERLINE_MARKER_ID,
} from './svg-utils'

/** number_line 타입만 추출한 Props 타입 */
type NumberLineFigure = Extract<FigureData, { type: 'number_line' }>

interface NumberLineProps {
  readonly figure: NumberLineFigure
  readonly className?: string
}

/** displaySize에 따른 SVG 높이 (px) */
const HEIGHT_MAP: Record<'large' | 'small', number> = {
  large: 80,
  small: 60,
}

/** 눈금 높이 (px, 뷰박스 단위가 데이터 단위이므로 실제 픽셀 비율 고려) */
const TICK_HALF_HEIGHT = 8
/** 포인트 원의 반지름 */
const POINT_RADIUS = 4
/** 수평선의 Y 좌표(뷰박스 기준) — 0으로 고정, 레이블은 위/아래 배치 */
const LINE_Y = 0
/** 레이블 텍스트의 Y 오프셋 (선 위로) */
const LABEL_Y_OFFSET = -16
/** 눈금 레이블의 Y 오프셋 (선 아래로) */
const TICK_LABEL_Y_OFFSET = 18
/** 양옆 패딩 (뷰박스 단위) */
const PADDING = 2

/**
 * 정수 눈금 목록을 계산한다.
 * min~max 범위의 모든 정수를 반환.
 */
function buildTicks(min: number, max: number): number[] {
  const ticks: number[] = []
  const start = Math.ceil(min)
  const end = Math.floor(max)
  for (let i = start; i <= end; i++) {
    ticks.push(i)
  }
  return ticks
}

/**
 * 수직선(Number Line)을 SVG로 렌더링하는 컴포넌트.
 *
 * @example
 * <NumberLine figure={figure} className="my-2" />
 */
export const NumberLine = memo(function NumberLine({
  figure,
  className,
}: NumberLineProps) {
  const { min, max, points, displaySize } = figure
  const height = HEIGHT_MAP[displaySize]

  // 뷰박스: 데이터 범위 + 패딩 여백
  const { svgMin, svgMax, size: svgWidth } = calcViewBox(min, max, PADDING * 2)

  // 데이터 값 → SVG X 좌표 변환 헬퍼
  const toX = (value: number) => mapToSVG(value, svgMin, svgMax, svgMin, svgMax)

  // 화살표가 시작/끝나는 X 좌표 (마커 크기 보정)
  const lineStartX = svgMin
  const lineEndX = svgMax

  // 정수 눈금 목록 계산
  const ticks = buildTicks(min, max)

  // 포인트 값 Set — 눈금과 포인트가 겹칠 때 눈금 레이블 생략 판단용
  const pointValues = new Set(points.map((p) => p.value))

  return (
    <svg
      viewBox={`${svgMin} ${LINE_Y - height / 2} ${svgWidth} ${height}`}
      width="100%"
      height={height}
      className={className}
      aria-label={figure.description}
      role="img"
      overflow="visible"
    >
      {/* 화살표 마커 정의 — 전역 defs 대신 각 컴포넌트가 자체 포함 */}
      <defs>
        <marker
          id={NUMBERLINE_MARKER_ID}
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" fill="#374151" />
        </marker>
      </defs>

      {/* 수평선 (양쪽 화살표 포함) */}
      <line
        x1={lineStartX}
        y1={LINE_Y}
        x2={lineEndX}
        y2={LINE_Y}
        stroke="#374151"
        strokeWidth="1.5"
        markerStart={`url(#${NUMBERLINE_MARKER_ID})`}
        markerEnd={`url(#${NUMBERLINE_MARKER_ID})`}
        transform={`rotate(180, ${(lineStartX + lineEndX) / 2}, ${LINE_Y})`}
      />

      {/* 정수 눈금 */}
      {ticks.map((tick) => {
        const x = toX(tick)
        const isPoint = pointValues.has(tick)
        return (
          <g key={`tick-${tick}`}>
            {/* 눈금 수직선 */}
            <line
              x1={x}
              y1={LINE_Y - TICK_HALF_HEIGHT}
              x2={x}
              y2={LINE_Y + TICK_HALF_HEIGHT}
              stroke="#374151"
              strokeWidth="1"
            />
            {/* 포인트와 겹치는 눈금은 레이블 생략 (포인트 레이블이 대체) */}
            {!isPoint && (
              <text
                x={x}
                y={LINE_Y + TICK_LABEL_Y_OFFSET}
                textAnchor="middle"
                fontSize="10"
                fill="#6B7280"
              >
                {formatNumber(tick)}
              </text>
            )}
          </g>
        )
      })}

      {/* 지정 포인트: 원 + 레이블 */}
      {points.map((point, index) => {
        const x = toX(point.value)
        return (
          <g key={`point-${index}-${point.value}`}>
            {/* 포인트 원 */}
            <circle
              cx={x}
              cy={LINE_Y}
              r={POINT_RADIUS}
              fill="#2563EB"
              stroke="#fff"
              strokeWidth="1.5"
            />
            {/* 포인트 레이블 (선 위) */}
            <text
              x={x}
              y={LINE_Y + LABEL_Y_OFFSET}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="#2563EB"
            >
              {point.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
})
