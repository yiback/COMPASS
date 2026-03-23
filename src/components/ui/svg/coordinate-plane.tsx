'use client'

/**
 * 좌표평면(Coordinate Plane) SVG 렌더러.
 *
 * 두 가지 컴포넌트를 export한다:
 * - CoordinatePlaneContent: <g> 반환 (function_graph와 합성하기 위해 분리)
 * - CoordinatePlane: <svg> + <defs> + CoordinatePlaneContent (독립 사용)
 *
 * 렌더링 요소:
 * - 그리드 선 (gridStep 간격, 연한 회색)
 * - x/y 축 (화살표 마커 포함)
 * - 눈금(tick) + 숫자 레이블
 * - 원점(0) 레이블
 *
 * React.memo로 래핑하여 동일 props 시 리렌더링을 방지한다.
 */

import { memo } from 'react'
import type { FigureData } from '@/lib/ai/types'
import {
  mapToSVG,
  formatNumber,
  COORDPLANE_MARKER_ID,
} from './svg-utils'

/** coordinate_plane 타입만 추출한 Props 타입 */
type CoordinatePlaneFigure = Extract<FigureData, { type: 'coordinate_plane' }>

/** displaySize에 따른 SVG 크기 (px) */
const SIZE_MAP: Record<'large' | 'small', number> = {
  large: 300,
  small: 200,
}

/** SVG 내부 여백 (px) — function-graph.tsx에서도 동일 값을 사용하도록 export */
export const PADDING = 30

/** 눈금 길이의 절반 (px, SVG 좌표 기준) */
const TICK_HALF = 0.15

/** 눈금 레이블 오프셋 (px) */
const TICK_LABEL_OFFSET = 1.2

/** 축 화살표 마커 크기 보정값 */
const AXIS_OVERSHOOT = 0.5

/**
 * CoordinatePlaneContent의 Props.
 *
 * CoordinatePlane과 FunctionGraph 모두 동일한 Props를 사용한다.
 */
export interface CoordinatePlaneContentProps {
  /** x축 범위 [min, max] */
  readonly xRange: readonly [number, number]
  /** y축 범위 [min, max] */
  readonly yRange: readonly [number, number]
  /** 그리드/눈금 간격 */
  readonly gridStep: number
  /** SVG 뷰박스 너비 (px) */
  readonly width: number
  /** SVG 뷰박스 높이 (px) */
  readonly height: number
  /** SVG 내부 여백 (px) */
  readonly padding: number
}

/**
 * 범위 내 gridStep 간격 숫자 목록을 반환한다.
 *
 * @param min - 시작 값
 * @param max - 끝 값
 * @param step - 간격
 */
function buildGridValues(min: number, max: number, step: number): number[] {
  const values: number[] = []
  // step의 배수 중 min~max 범위에 해당하는 값만 수집
  const start = Math.ceil(min / step) * step
  for (let v = start; v <= max + 1e-9; v += step) {
    // 부동소수점 오차 보정
    const rounded = Math.round(v / step) * step
    values.push(rounded)
  }
  return values
}

/**
 * 좌표평면의 SVG 내부 엘리먼트를 렌더링하는 컴포넌트.
 *
 * <svg> 태그를 포함하지 않고 <g>만 반환하므로,
 * CoordinatePlane과 FunctionGraph 모두 단일 <svg> 안에서 재사용할 수 있다.
 *
 * SVG y축은 위가 0이므로, 수학 좌표계(위가 양수)와 반전해야 한다.
 * → mapToSVG 호출 시 svgMin과 svgMax를 교환하여 반전 처리.
 */
export function CoordinatePlaneContent({
  xRange,
  yRange,
  gridStep,
  width,
  height,
  padding,
}: CoordinatePlaneContentProps) {
  const [xMin, xMax] = xRange
  const [yMin, yMax] = yRange

  // 데이터 좌표 → SVG 픽셀 좌표 변환 헬퍼
  // SVG y축 반전: svgMin/svgMax 교환으로 수학 좌표계와 일치시킴
  const toSvgX = (x: number) =>
    mapToSVG(x, xMin, xMax, padding, width - padding)
  const toSvgY = (y: number) =>
    mapToSVG(y, yMin, yMax, height - padding, padding) // 반전!

  // 원점 SVG 좌표
  const originX = toSvgX(0)
  const originY = toSvgY(0)

  // 그리드/눈금에 사용할 값 목록
  const xValues = buildGridValues(xMin, xMax, gridStep)
  const yValues = buildGridValues(yMin, yMax, gridStep)

  // 축 끝 좌표 (화살표가 범위 경계보다 약간 더 나가도록)
  const axisLeft = toSvgX(xMin) - AXIS_OVERSHOOT
  const axisRight = toSvgX(xMax) + AXIS_OVERSHOOT
  const axisBottom = toSvgY(yMin) + AXIS_OVERSHOOT
  const axisTop = toSvgY(yMax) - AXIS_OVERSHOOT

  return (
    <g>
      {/* 수직 그리드 선 (x축 방향) */}
      {xValues.map((x) => {
        const sx = toSvgX(x)
        return (
          <line
            key={`vgrid-${x}`}
            x1={sx}
            y1={padding}
            x2={sx}
            y2={height - padding}
            stroke="#E5E7EB"
            strokeWidth="0.5"
          />
        )
      })}

      {/* 수평 그리드 선 (y축 방향) */}
      {yValues.map((y) => {
        const sy = toSvgY(y)
        return (
          <line
            key={`hgrid-${y}`}
            x1={padding}
            y1={sy}
            x2={width - padding}
            y2={sy}
            stroke="#E5E7EB"
            strokeWidth="0.5"
          />
        )
      })}

      {/* x축 (수평, 화살표 양쪽) */}
      <line
        x1={axisLeft}
        y1={originY}
        x2={axisRight}
        y2={originY}
        stroke="#374151"
        strokeWidth="1.5"
        markerEnd={`url(#${COORDPLANE_MARKER_ID})`}
        markerStart={`url(#${COORDPLANE_MARKER_ID}-rev)`}
      />

      {/* y축 (수직, 화살표 양쪽) */}
      <line
        x1={originX}
        y1={axisBottom}
        x2={originX}
        y2={axisTop}
        stroke="#374151"
        strokeWidth="1.5"
        markerEnd={`url(#${COORDPLANE_MARKER_ID})`}
        markerStart={`url(#${COORDPLANE_MARKER_ID}-rev)`}
      />

      {/* x축 눈금 + 레이블 */}
      {xValues.map((x) => {
        if (x === 0) return null // 원점은 별도 처리
        const sx = toSvgX(x)
        // 눈금 길이를 데이터 단위 비율로 계산 (픽셀 독립)
        const tickPx = ((height - padding * 2) / (yMax - yMin)) * TICK_HALF
        return (
          <g key={`xtick-${x}`}>
            {/* 눈금 수직선 */}
            <line
              x1={sx}
              y1={originY - tickPx}
              x2={sx}
              y2={originY + tickPx}
              stroke="#374151"
              strokeWidth="1"
            />
            {/* 눈금 레이블 (축 아래) */}
            <text
              x={sx}
              y={originY + tickPx * TICK_LABEL_OFFSET + 10}
              textAnchor="middle"
              fontSize="9"
              fill="#6B7280"
            >
              {formatNumber(x)}
            </text>
          </g>
        )
      })}

      {/* y축 눈금 + 레이블 */}
      {yValues.map((y) => {
        if (y === 0) return null // 원점은 별도 처리
        const sy = toSvgY(y)
        const tickPx = ((width - padding * 2) / (xMax - xMin)) * TICK_HALF
        return (
          <g key={`ytick-${y}`}>
            {/* 눈금 수평선 */}
            <line
              x1={originX - tickPx}
              y1={sy}
              x2={originX + tickPx}
              y2={sy}
              stroke="#374151"
              strokeWidth="1"
            />
            {/* 눈금 레이블 (축 왼쪽) */}
            <text
              x={originX - tickPx - 4}
              y={sy + 3}
              textAnchor="end"
              fontSize="9"
              fill="#6B7280"
            >
              {formatNumber(y)}
            </text>
          </g>
        )
      })}

      {/* 원점 레이블 */}
      <text
        x={originX - 6}
        y={originY + 12}
        textAnchor="end"
        fontSize="9"
        fill="#6B7280"
      >
        O
      </text>
    </g>
  )
}

interface CoordinatePlaneProps {
  readonly figure: CoordinatePlaneFigure
  readonly className?: string
}

/**
 * 좌표평면을 독립적으로 렌더링하는 완성 컴포넌트.
 *
 * <svg> + <defs>(화살표 마커) + CoordinatePlaneContent로 구성되며
 * 단독으로 사용할 때 이 컴포넌트를 사용한다.
 * FunctionGraph와 합성할 때는 CoordinatePlaneContent를 직접 사용한다.
 *
 * @example
 * <CoordinatePlane figure={figure} className="my-4" />
 */
export const CoordinatePlane = memo(function CoordinatePlane({
  figure,
  className,
}: CoordinatePlaneProps) {
  const size = SIZE_MAP[figure.displaySize]

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
          id={COORDPLANE_MARKER_ID}
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
          id={`${COORDPLANE_MARKER_ID}-rev`}
          markerWidth="8"
          markerHeight="8"
          refX="2"
          refY="3"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L0,6 L8,3 z" fill="#374151" />
        </marker>
      </defs>

      <CoordinatePlaneContent
        xRange={figure.xRange}
        yRange={figure.yRange}
        gridStep={figure.gridStep}
        width={size}
        height={size}
        padding={PADDING}
      />
    </svg>
  )
})
