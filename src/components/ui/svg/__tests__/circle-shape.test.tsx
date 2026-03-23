/**
 * CircleShape SVG 렌더러 테스트
 *
 * react-dom/server renderToString으로 SSR HTML을 검증한다.
 * node 환경에서 실행 가능 (jsdom 불필요).
 *
 * 총 ~5개 케이스
 */

import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CircleShape } from '../circle-shape'
import type { FigureData } from '@/lib/ai/types'

/** circle 유효 데이터 */
const circleFigure: Extract<FigureData, { type: 'circle' }> = {
  type: 'circle',
  center: [0, 0],
  radius: 3,
  displaySize: 'large',
  description: '원 (반지름 3)',
}

describe('CircleShape', () => {
  it('<svg> 엘리먼트가 렌더링된다', () => {
    const html = renderToString(<CircleShape figure={circleFigure} />)
    expect(html).toContain('<svg')
  })

  it('aria-label에 description이 포함된다', () => {
    const html = renderToString(<CircleShape figure={circleFigure} />)
    expect(html).toContain('원 (반지름 3)')
  })

  it('<circle> 엘리먼트가 포함된다 (원 본체 + 중심점)', () => {
    const html = renderToString(<CircleShape figure={circleFigure} />)
    // 원 본체와 중심점 circle 두 개 이상
    const matches = (html.match(/<circle/g) || []).length
    expect(matches).toBeGreaterThanOrEqual(2)
  })

  it('<line> 엘리먼트가 포함된다 (반지름 선)', () => {
    const html = renderToString(<CircleShape figure={circleFigure} />)
    expect(html).toContain('<line')
  })

  it('반지름 레이블 텍스트가 렌더링된다', () => {
    const html = renderToString(<CircleShape figure={circleFigure} />)
    // formatNumber(3) = "3" → "r=3"
    expect(html).toContain('r=3')
  })
})
