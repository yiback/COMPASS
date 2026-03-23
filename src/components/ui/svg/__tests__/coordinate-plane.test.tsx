/**
 * CoordinatePlane SVG 렌더러 테스트
 *
 * react-dom/server renderToString으로 SSR HTML을 검증한다.
 * node 환경에서 실행 가능 (jsdom 불필요).
 *
 * 총 ~6개 케이스
 */

import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CoordinatePlane } from '../coordinate-plane'
import type { FigureData } from '@/lib/ai/types'

/** coordinate_plane 유효 데이터 */
const coordinatePlaneFigure: Extract<FigureData, { type: 'coordinate_plane' }> = {
  type: 'coordinate_plane',
  xRange: [-5, 5],
  yRange: [-5, 5],
  gridStep: 1,
  displaySize: 'large',
  description: '좌표평면 (-5~5)',
}

describe('CoordinatePlane', () => {
  it('<svg> 엘리먼트가 렌더링된다', () => {
    const html = renderToString(<CoordinatePlane figure={coordinatePlaneFigure} />)
    expect(html).toContain('<svg')
  })

  it('aria-label에 description이 포함된다', () => {
    const html = renderToString(<CoordinatePlane figure={coordinatePlaneFigure} />)
    expect(html).toContain('좌표평면 (-5~5)')
  })

  it('<line> 엘리먼트가 포함된다 (그리드 + 축)', () => {
    const html = renderToString(<CoordinatePlane figure={coordinatePlaneFigure} />)
    expect(html).toContain('<line')
  })

  it('<defs> 및 <marker> 엘리먼트가 포함된다 (화살표 마커)', () => {
    const html = renderToString(<CoordinatePlane figure={coordinatePlaneFigure} />)
    expect(html).toContain('<defs')
    expect(html).toContain('<marker')
  })

  it('displaySize=large → viewBox 크기 300x300', () => {
    const html = renderToString(<CoordinatePlane figure={coordinatePlaneFigure} />)
    // SIZE_MAP.large = 300 → viewBox="0 0 300 300"
    expect(html).toContain('0 0 300 300')
  })

  it('displaySize=small → viewBox 크기 200x200', () => {
    const smallFigure: typeof coordinatePlaneFigure = {
      ...coordinatePlaneFigure,
      displaySize: 'small',
    }
    const html = renderToString(<CoordinatePlane figure={smallFigure} />)
    expect(html).toContain('0 0 200 200')
  })
})
