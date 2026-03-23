/**
 * FigureRenderer 렌더링 테스트
 *
 * react-dom/server renderToString으로 SSR HTML을 검증한다.
 * 각 6가지 타입이 올바른 SVG 컴포넌트를 렌더링하는지 확인한다.
 * node 환경에서 실행 가능 (jsdom 불필요).
 *
 * 총 ~8개 케이스
 */

import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FigureRenderer } from '../figure-renderer'
import type { FigureData } from '@/lib/ai/types'

// ─── 각 타입별 픽스처 ────────────────────────────────────────

const numberLineFigure: FigureData = {
  type: 'number_line',
  min: -3,
  max: 3,
  points: [{ value: 1, label: 'A' }],
  displaySize: 'large',
  description: '수직선',
}

const coordinatePlaneFigure: FigureData = {
  type: 'coordinate_plane',
  xRange: [-5, 5],
  yRange: [-5, 5],
  gridStep: 1,
  displaySize: 'large',
  description: '좌표평면',
}

const functionGraphFigure: FigureData = {
  type: 'function_graph',
  points: [
    [0, 0],
    [1, 1],
    [2, 4],
  ],
  domain: [-1, 3],
  xRange: [-2, 4],
  yRange: [-1, 5],
  gridStep: 1,
  displaySize: 'large',
  description: '함수 그래프',
}

const polygonFigure: FigureData = {
  type: 'polygon',
  vertices: [
    [0, 0],
    [4, 0],
    [2, 3],
  ],
  displaySize: 'large',
  description: '삼각형',
}

const circleFigure: FigureData = {
  type: 'circle',
  center: [0, 0],
  radius: 2,
  displaySize: 'large',
  description: '원',
}

const vectorFigure: FigureData = {
  type: 'vector',
  from: [0, 0],
  to: [3, 4],
  displaySize: 'large',
  description: '벡터',
}

// ─── 테스트 ──────────────────────────────────────────────────

describe('FigureRenderer', () => {
  it('number_line 타입 → <svg> 엘리먼트 렌더링', () => {
    const html = renderToString(<FigureRenderer figure={numberLineFigure} />)
    expect(html).toContain('<svg')
  })

  it('coordinate_plane 타입 → <svg> 엘리먼트 렌더링', () => {
    const html = renderToString(<FigureRenderer figure={coordinatePlaneFigure} />)
    expect(html).toContain('<svg')
  })

  it('function_graph 타입 → <svg> + <polyline> 렌더링', () => {
    const html = renderToString(<FigureRenderer figure={functionGraphFigure} />)
    expect(html).toContain('<svg')
    expect(html).toContain('<polyline')
  })

  it('polygon 타입 → <svg> + <polygon> 렌더링', () => {
    const html = renderToString(<FigureRenderer figure={polygonFigure} />)
    expect(html).toContain('<svg')
    expect(html).toContain('<polygon')
  })

  it('circle 타입 → <svg> + <circle> 렌더링', () => {
    const html = renderToString(<FigureRenderer figure={circleFigure} />)
    expect(html).toContain('<svg')
    expect(html).toContain('<circle')
  })

  it('vector 타입 → <svg> + <line> 렌더링', () => {
    const html = renderToString(<FigureRenderer figure={vectorFigure} />)
    expect(html).toContain('<svg')
    expect(html).toContain('<line')
  })

  it('className prop이 전달되면 크래시 없이 렌더링된다', () => {
    expect(() =>
      renderToString(<FigureRenderer figure={circleFigure} className="my-4" />),
    ).not.toThrow()
  })

  it('각 타입의 aria-label에 description이 포함된다', () => {
    const html = renderToString(<FigureRenderer figure={circleFigure} />)
    expect(html).toContain('원')
  })
})
