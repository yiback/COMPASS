/**
 * VectorArrow SVG 렌더러 테스트
 *
 * react-dom/server renderToString으로 SSR HTML을 검증한다.
 * node 환경에서 실행 가능 (jsdom 불필요).
 *
 * 총 ~6개 케이스
 */

import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { VectorArrow } from '../vector-arrow'
import type { FigureData } from '@/lib/ai/types'

/** vector 유효 데이터 */
const vectorFigure: Extract<FigureData, { type: 'vector' }> = {
  type: 'vector',
  from: [0, 0],
  to: [3, 4],
  label: 'v',
  displaySize: 'large',
  description: '벡터 v',
}

describe('VectorArrow', () => {
  it('<svg> 엘리먼트가 렌더링된다', () => {
    const html = renderToString(<VectorArrow figure={vectorFigure} />)
    expect(html).toContain('<svg')
  })

  it('aria-label에 description이 포함된다', () => {
    const html = renderToString(<VectorArrow figure={vectorFigure} />)
    expect(html).toContain('벡터 v')
  })

  it('<line> 엘리먼트가 포함된다 (벡터 선분)', () => {
    const html = renderToString(<VectorArrow figure={vectorFigure} />)
    expect(html).toContain('<line')
  })

  it('<defs> 및 화살표 마커가 포함된다', () => {
    const html = renderToString(<VectorArrow figure={vectorFigure} />)
    expect(html).toContain('<defs')
    expect(html).toContain('<marker')
  })

  it('label이 있으면 레이블 텍스트가 렌더링된다', () => {
    const html = renderToString(<VectorArrow figure={vectorFigure} />)
    expect(html).toContain('v')
  })

  it('label 미전달 시에도 크래시 없이 렌더링된다', () => {
    const noLabelFigure: typeof vectorFigure = {
      ...vectorFigure,
      label: undefined,
    }
    expect(() =>
      renderToString(<VectorArrow figure={noLabelFigure} />),
    ).not.toThrow()
  })
})
