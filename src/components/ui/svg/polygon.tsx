'use client'

/**
 * 다각형(Polygon) SVG 렌더러.
 *
 * 렌더링 요소:
 * - <polygon>: 꼭짓점을 연결한 다각형 도형
 * - 꼭짓점 점(circle): 각 꼭짓점 위치에 작은 원 표시
 * - 꼭짓점 라벨(text): figure.labels가 있을 때 각 꼭짓점 옆에 표시
 *
 * SVG y축 반전: 수학 좌표계(위=양수)를 SVG 좌표계(위=0)에 맞게 처리.
 * vertices의 y좌표를 뒤집어서 매핑한다.
 *
 * React.memo로 래핑하여 동일 props 시 리렌더링을 방지한다.
 */

import { memo } from 'react'
import type { FigureData } from '@/lib/ai/types'
import { mapToSVG, formatNumber } from './svg-utils'

/** polygon 타입만 추출한 Props 타입 */
type PolygonFigure = Extract<FigureData, { type: 'polygon' }>

interface PolygonShapeProps {
  readonly figure: PolygonFigure
  readonly className?: string
}

/** displaySize에 따른 SVG 크기 (px) */
const SIZE_MAP: Record<'large' | 'small', number> = {
  large: 300,
  small: 200,
}

/** SVG 내부 여백 (px) — 꼭짓점 라벨이 잘리지 않도록 */
const PADDING = 30

/** 꼭짓점 표시 원의 반지름 (px) */
const VERTEX_RADIUS = 3

/** 꼭짓점 라벨 오프셋 (px) — 꼭짓점 점에서 텍스트까지의 거리 */
const LABEL_OFFSET = 10

/**
 * vertices 배열에서 x, y 범위를 각각 계산한다.
 * 꼭짓점이 하나뿐이거나 모두 같은 경우 ±1 여백을 추가해 0-나누기를 방지한다.
 */
function calcRange(vertices: readonly (readonly [number, number])[]) {
  const xs = vertices.map(([x]) => x)
  const ys = vertices.map(([, y]) => y)

  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const yMin = Math.min(...ys)
  const yMax = Math.max(...ys)

  return {
    // 범위가 0이면 ±1 여백을 주어 mapToSVG에서 0-나누기를 방지
    xMin: xMin === xMax ? xMin - 1 : xMin,
    xMax: xMin === xMax ? xMax + 1 : xMax,
    yMin: yMin === yMax ? yMin - 1 : yMin,
    yMax: yMin === yMax ? yMax + 1 : yMax,
  }
}

/**
 * 꼭짓점의 바깥 방향(도형 중심 기준)에 라벨을 배치하기 위한 오프셋을 계산한다.
 *
 * 중심에서 꼭짓점을 향하는 방향으로 오프셋을 적용하면
 * 라벨이 항상 도형 바깥쪽에 표시된다.
 *
 * @param vx - 꼭짓점 SVG x 좌표
 * @param vy - 꼭짓점 SVG y 좌표
 * @param cx - 중심 SVG x 좌표
 * @param cy - 중심 SVG y 좌표
 * @returns { dx, dy } — 라벨 위치 보정값
 */
function calcLabelOffset(
  vx: number,
  vy: number,
  cx: number,
  cy: number,
): { dx: number; dy: number } {
  const dx = vx - cx
  const dy = vy - cy
  const dist = Math.sqrt(dx * dx + dy * dy)

  // 중심과 꼭짓점이 완전히 겹치는 경우 위쪽으로 기본 오프셋
  if (dist === 0) {
    return { dx: 0, dy: -LABEL_OFFSET }
  }

  // 단위 벡터에 LABEL_OFFSET 곱하기
  return {
    dx: (dx / dist) * LABEL_OFFSET,
    dy: (dy / dist) * LABEL_OFFSET,
  }
}

/**
 * 다각형을 SVG로 렌더링하는 컴포넌트.
 *
 * vertices 좌표를 SVG 좌표계로 변환하고 <polygon>으로 그린다.
 * 각 꼭짓점에 작은 원(점)을 표시하며, figure.labels가 있으면 라벨도 표시한다.
 *
 * @example
 * <PolygonShape figure={figure} className="my-4" />
 */
export const PolygonShape = memo(function PolygonShape({
  figure,
  className,
}: PolygonShapeProps) {
  const size = SIZE_MAP[figure.displaySize]
  const { vertices, labels } = figure

  const { xMin, xMax, yMin, yMax } = calcRange(vertices)

  // 데이터 좌표 → SVG 픽셀 좌표 변환 헬퍼
  // SVG y축 반전: yMin↔yMax 교환으로 수학 좌표계(위=양수)와 일치
  const toSvgX = (x: number) =>
    mapToSVG(x, xMin, xMax, PADDING, size - PADDING)
  const toSvgY = (y: number) =>
    mapToSVG(y, yMin, yMax, size - PADDING, PADDING) // 반전!

  // SVG <polygon> points 속성 문자열 생성
  const polygonPoints = vertices
    .map(([x, y]) => `${formatNumber(toSvgX(x))},${formatNumber(toSvgY(y))}`)
    .join(' ')

  // 도형 중심 SVG 좌표 (라벨 방향 계산용)
  const svgVertices = vertices.map(([x, y]) => ({
    x: toSvgX(x),
    y: toSvgY(y),
  }))
  const centerX =
    svgVertices.reduce((sum, v) => sum + v.x, 0) / svgVertices.length
  const centerY =
    svgVertices.reduce((sum, v) => sum + v.y, 0) / svgVertices.length

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

      {/* 다각형 본체 */}
      <polygon
        points={polygonPoints}
        fill="#EFF6FF"
        stroke="#2563EB"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* 꼭짓점 점 + 라벨 */}
      {svgVertices.map((v, i) => {
        const { dx, dy } = calcLabelOffset(v.x, v.y, centerX, centerY)
        const label = labels?.[i]

        return (
          <g key={`vertex-${i}`}>
            {/* 꼭짓점 표시 원 */}
            <circle
              cx={v.x}
              cy={v.y}
              r={VERTEX_RADIUS}
              fill="#1D4ED8"
            />

            {/* 꼭짓점 라벨 (labels 배열이 있고 해당 인덱스 값이 있을 때만) */}
            {label !== undefined && (
              <text
                x={v.x + dx}
                y={v.y + dy}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="11"
                fontWeight="600"
                fill="#1E40AF"
              >
                {label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
})
