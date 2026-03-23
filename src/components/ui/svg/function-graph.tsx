'use client'

/**
 * 함수 그래프(Function Graph) SVG 렌더러.
 *
 * 단일 <svg> 안에 CoordinatePlaneContent + <polyline>을 합성한다.
 * - 좌표평면(그리드, 축, 눈금)은 CoordinatePlaneContent가 렌더링
 * - 함수 그래프는 points를 SVG 좌표로 변환하여 <polyline>으로 렌더링
 *
 * React.memo로 래핑하여 동일 props 시 리렌더링을 방지한다.
 */

import { memo } from 'react'
import type { FigureData } from '@/lib/ai/types'
import { mapToSVG, FUNCGRAPH_MARKER_ID } from './svg-utils'
import { CoordinatePlaneContent, PADDING as CP_PADDING } from './coordinate-plane'

/** function_graph 타입만 추출한 Props 타입 */
type FunctionGraphFigure = Extract<FigureData, { type: 'function_graph' }>

interface FunctionGraphProps {
  readonly figure: FunctionGraphFigure
  readonly className?: string
}

/** displaySize에 따른 SVG 크기 (px) */
const SIZE_MAP: Record<'large' | 'small', number> = {
  large: 300,
  small: 200,
}

/** SVG 내부 여백 — CoordinatePlaneContent와 동일한 값 사용 */
const PADDING = CP_PADDING

/** 함수 그래프 기본 색상 */
const DEFAULT_GRAPH_COLOR = '#2563EB'

/**
 * 함수 그래프를 SVG로 렌더링하는 컴포넌트.
 *
 * points 배열을 SVG 좌표로 변환하여 <polyline>으로 이어 그린다.
 * SVG y축 반전(위가 0)을 고려하여 mapToSVG 호출 시 svgMin/svgMax를 교환한다.
 *
 * @example
 * <FunctionGraph figure={figure} className="my-4" />
 */
export const FunctionGraph = memo(function FunctionGraph({
  figure,
  className,
}: FunctionGraphProps) {
  const size = SIZE_MAP[figure.displaySize]
  const { xRange, yRange, gridStep, points, color } = figure

  const [xMin, xMax] = xRange
  const [yMin, yMax] = yRange

  // 데이터 좌표 → SVG 픽셀 좌표 변환 헬퍼 (CoordinatePlaneContent와 동일 로직)
  // y축 반전: svgMin↔svgMax 교환으로 수학 좌표계와 일치
  const toSvgX = (x: number) =>
    mapToSVG(x, xMin, xMax, PADDING, size - PADDING)
  const toSvgY = (y: number) =>
    mapToSVG(y, yMin, yMax, size - PADDING, PADDING) // 반전!

  // points 배열을 "x1,y1 x2,y2 ..." 형식의 polyline points 문자열로 변환
  const polylinePoints = points
    .map(([x, y]) => `${toSvgX(x)},${toSvgY(y)}`)
    .join(' ')

  const graphColor = color ?? DEFAULT_GRAPH_COLOR

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
        {/* 정방향 화살표 (선 끝) */}
        <marker
          id={FUNCGRAPH_MARKER_ID}
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" fill="#374151" />
        </marker>
        {/* 역방향 화살표 (선 시작) */}
        <marker
          id={`${FUNCGRAPH_MARKER_ID}-rev`}
          markerWidth="8"
          markerHeight="8"
          refX="2"
          refY="3"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L0,6 L8,3 z" fill="#374151" />
        </marker>
      </defs>

      {/* 좌표평면 (그리드, 축, 눈금) */}
      <CoordinatePlaneContent
        xRange={xRange}
        yRange={yRange}
        gridStep={gridStep}
        width={size}
        height={size}
        padding={PADDING}
      />

      {/* 함수 그래프: points를 SVG 좌표로 변환하여 꺾은선으로 렌더링 */}
      {polylinePoints && (
        <polyline
          points={polylinePoints}
          fill="none"
          stroke={graphColor}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
})
