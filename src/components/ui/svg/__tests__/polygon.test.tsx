/**
 * PolygonShape SVG 렌더러 테스트
 *
 * react-dom/server renderToString으로 SSR HTML을 검증한다.
 * node 환경에서 실행 가능 (jsdom 불필요).
 *
 * 총 ~6개 케이스
 */

import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PolygonShape } from '../polygon'
import type { FigureData } from '@/lib/ai/types'

/** polygon 유효 데이터 (삼각형) */
const polygonFigure: Extract<FigureData, { type: 'polygon' }> = {
  type: 'polygon',
  vertices: [
    [0, 0],
    [4, 0],
    [2, 3],
  ],
  labels: ['A', 'B', 'C'],
  displaySize: 'large',
  description: '삼각형 ABC',
}

describe('PolygonShape', () => {
  it('<svg> 엘리먼트가 렌더링된다', () => {
    const html = renderToString(<PolygonShape figure={polygonFigure} />)
    expect(html).toContain('<svg')
  })

  it('aria-label에 description이 포함된다', () => {
    const html = renderToString(<PolygonShape figure={polygonFigure} />)
    expect(html).toContain('삼각형 ABC')
  })

  it('<polygon> 엘리먼트가 포함된다', () => {
    const html = renderToString(<PolygonShape figure={polygonFigure} />)
    expect(html).toContain('<polygon')
  })

  it('<circle> 엘리먼트가 포함된다 (꼭짓점 점 표시)', () => {
    const html = renderToString(<PolygonShape figure={polygonFigure} />)
    expect(html).toContain('<circle')
  })

  it('labels가 있으면 꼭짓점 레이블 텍스트가 렌더링된다', () => {
    const html = renderToString(<PolygonShape figure={polygonFigure} />)
    expect(html).toContain('A')
    expect(html).toContain('B')
    expect(html).toContain('C')
  })

  it('labels 미전달 시에도 크래시 없이 렌더링된다', () => {
    const noLabelFigure: typeof polygonFigure = {
      ...polygonFigure,
      labels: undefined,
    }
    expect(() =>
      renderToString(<PolygonShape figure={noLabelFigure} />),
    ).not.toThrow()
  })
})
