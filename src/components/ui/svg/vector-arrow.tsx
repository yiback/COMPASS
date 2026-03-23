'use client'

/**
 * 벡터 화살표(Vector Arrow) SVG 렌더러.
 *
 * 렌더링 요소:
 * - <line>: from → to를 잇는 직선
 * - 화살표 마커(markerEnd): 끝점에 화살표 표시
 * - 라벨(text): figure.label이 있을 때 선 중간 위쪽에 표시
 *
 * viewBox는 from/to 좌표 범위 + 여백으로 자동 계산한다.
 *
 * SVG y축 반전: 수학 좌표계(위=양수)를 SVG 좌표계(위=0)에 맞게 처리.
 *
 * 화살표 마커는 자체 <defs>에 포함 — 전역 defs 의존 금지.
 *
 * React.memo로 래핑하여 동일 props 시 리렌더링을 방지한다.
 */

import { memo } from 'react'
import type { FigureData } from '@/lib/ai/types'
import { mapToSVG, VECTOR_MARKER_ID } from './svg-utils'

/** vector 타입만 추출한 Props 타입 */
type VectorFigure = Extract<FigureData, { type: 'vector' }>

interface VectorArrowProps {
  readonly figure: VectorFigure
  readonly className?: string
}

/** displaySize에 따른 SVG 크기 (px) */
const SIZE_MAP: Record<'large' | 'small', number> = {
  large: 300,
  small: 200,
}

/** SVG 내부 여백 (px) — 화살표가 잘리지 않도록 충분히 확보 */
const PADDING = 40

// VECTOR_MARKER_ID는 svg-utils.ts에서 import (전역 고유 ID)

/** 라벨 위 오프셋 (px) — 선 중간에서 위쪽으로 */
const LABEL_OFFSET_Y = 10

/**
 * 두 좌표를 받아 x, y 각각의 [min, max] 범위를 계산한다.
 * from/to가 같은 좌표인 경우 ±1 여백을 추가해 mapToSVG 0-나누기를 방지한다.
 */
function calcVectorRange(
  from: readonly [number, number],
  to: readonly [number, number],
) {
  const xMin = Math.min(from[0], to[0])
  const xMax = Math.max(from[0], to[0])
  const yMin = Math.min(from[1], to[1])
  const yMax = Math.max(from[1], to[1])

  return {
    // 범위가 0이면 ±1 여백을 주어 mapToSVG에서 0-나누기를 방지
    xMin: xMin === xMax ? xMin - 1 : xMin,
    xMax: xMin === xMax ? xMax + 1 : xMax,
    yMin: yMin === yMax ? yMin - 1 : yMin,
    yMax: yMin === yMax ? yMax + 1 : yMax,
  }
}

/**
 * 벡터를 화살표 SVG로 렌더링하는 컴포넌트.
 *
 * from → to 방향으로 화살표를 그리며,
 * figure.label이 있으면 선 중간 위쪽에 텍스트를 표시한다.
 *
 * @example
 * <VectorArrow figure={figure} className="my-4" />
 */
export const VectorArrow = memo(function VectorArrow({
  figure,
  className,
}: VectorArrowProps) {
  const size = SIZE_MAP[figure.displaySize]
  const { from, to, label } = figure

  const { xMin, xMax, yMin, yMax } = calcVectorRange(from, to)

  // 데이터 좌표 → SVG 픽셀 좌표 변환 헬퍼
  // SVG y축 반전: yMin↔yMax 교환으로 수학 좌표계(위=양수)와 일치
  const toSvgX = (x: number) =>
    mapToSVG(x, xMin, xMax, PADDING, size - PADDING)
  const toSvgY = (y: number) =>
    mapToSVG(y, yMin, yMax, size - PADDING, PADDING) // 반전!

  // 시작점/끝점 SVG 좌표
  const x1 = toSvgX(from[0])
  const y1 = toSvgY(from[1])
  const x2 = toSvgX(to[0])
  const y2 = toSvgY(to[1])

  // 라벨 위치: 벡터 선분의 중간점, 약간 위쪽
  const labelX = (x1 + x2) / 2
  const labelY = (y1 + y2) / 2 - LABEL_OFFSET_Y

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={className}
      aria-label={figure.description}
      role="img"
    >
      {/* 화살표 마커 정의 — 전역 defs 대신 각 컴포넌트가 자체 포함 */}
      <defs>
        {/* 벡터 끝점 화살표 마커 */}
        <marker
          id={VECTOR_MARKER_ID}
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#1D4ED8" />
        </marker>
      </defs>

      {/* 시작점 표시 원 */}
      <circle
        cx={x1}
        cy={y1}
        r={3}
        fill="#1D4ED8"
      />

      {/* 벡터 선분: from → to, 끝에 화살표 마커 */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#1D4ED8"
        strokeWidth="2"
        strokeLinecap="round"
        markerEnd={`url(#${VECTOR_MARKER_ID})`}
      />

      {/* 라벨: 선 중간 위쪽에 표시 (label이 있을 때만) */}
      {label !== undefined && (
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          fontSize="12"
          fontWeight="600"
          fill="#1E40AF"
        >
          {label}
        </text>
      )}
    </svg>
  )
})
