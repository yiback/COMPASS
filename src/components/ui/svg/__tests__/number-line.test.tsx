/**
 * NumberLine SVG 렌더러 테스트
 *
 * react-dom/server renderToString으로 SSR HTML을 검증한다.
 * node 환경에서 실행 가능 (jsdom 불필요).
 *
 * 총 ~6개 케이스
 */

import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NumberLine } from '../number-line'
import type { FigureData } from '@/lib/ai/types'

/** number_line 유효 데이터 */
const numberLineFigure: Extract<FigureData, { type: 'number_line' }> = {
  type: 'number_line',
  min: -3,
  max: 3,
  points: [{ value: 1, label: 'A' }],
  displaySize: 'large',
  description: '수직선 (-3 ~ 3)',
}

describe('NumberLine', () => {
  it('<svg> 엘리먼트가 렌더링된다', () => {
    const html = renderToString(<NumberLine figure={numberLineFigure} />)
    expect(html).toContain('<svg')
  })

  it('aria-label에 description이 포함된다', () => {
    const html = renderToString(<NumberLine figure={numberLineFigure} />)
    expect(html).toContain('수직선 (-3 ~ 3)')
  })

  it('<line> 엘리먼트가 포함된다 (수평선 + 눈금)', () => {
    const html = renderToString(<NumberLine figure={numberLineFigure} />)
    expect(html).toContain('<line')
  })

  it('<circle> 엘리먼트가 포함된다 (point 원)', () => {
    const html = renderToString(<NumberLine figure={numberLineFigure} />)
    expect(html).toContain('<circle')
  })

  it('포인트 레이블 텍스트가 렌더링된다', () => {
    const html = renderToString(<NumberLine figure={numberLineFigure} />)
    // points[0].label = 'A'
    expect(html).toContain('A')
  })

  it('displaySize=small → height 60', () => {
    const smallFigure: typeof numberLineFigure = {
      ...numberLineFigure,
      displaySize: 'small',
    }
    const html = renderToString(<NumberLine figure={smallFigure} />)
    // HEIGHT_MAP.small = 60
    expect(html).toContain('60')
  })
})
