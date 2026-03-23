/**
 * FunctionGraph SVG 렌더러 테스트
 *
 * react-dom/server renderToString으로 SSR HTML을 검증한다.
 * node 환경에서 실행 가능 (jsdom 불필요).
 *
 * 총 ~5개 케이스
 */

import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FunctionGraph } from '../function-graph'
import type { FigureData } from '@/lib/ai/types'

/** function_graph 유효 데이터 */
const functionGraphFigure: Extract<FigureData, { type: 'function_graph' }> = {
  type: 'function_graph',
  points: [
    [0, 0],
    [1, 1],
    [2, 4],
    [3, 9],
  ],
  domain: [-1, 4],
  xRange: [-2, 5],
  yRange: [-1, 10],
  gridStep: 1,
  displaySize: 'large',
  description: '이차함수 y=x²',
}

describe('FunctionGraph', () => {
  it('<svg> 엘리먼트가 렌더링된다', () => {
    const html = renderToString(<FunctionGraph figure={functionGraphFigure} />)
    expect(html).toContain('<svg')
  })

  it('aria-label에 description이 포함된다', () => {
    const html = renderToString(<FunctionGraph figure={functionGraphFigure} />)
    expect(html).toContain('이차함수 y=x²')
  })

  it('<polyline> 엘리먼트가 포함된다 (함수 그래프)', () => {
    const html = renderToString(<FunctionGraph figure={functionGraphFigure} />)
    expect(html).toContain('<polyline')
  })

  it('기본 색상(파란색) 또는 커스텀 color 속성이 적용된다', () => {
    const html = renderToString(<FunctionGraph figure={functionGraphFigure} />)
    // DEFAULT_GRAPH_COLOR = '#2563EB'
    expect(html).toContain('#2563EB')
  })

  it('커스텀 color 전달 시 해당 색상이 적용된다', () => {
    const colorFigure: typeof functionGraphFigure = {
      ...functionGraphFigure,
      color: '#FF0000',
    }
    const html = renderToString(<FunctionGraph figure={colorFigure} />)
    expect(html).toContain('#FF0000')
  })
})
