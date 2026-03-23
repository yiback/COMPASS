/**
 * LatexRenderer figure 통합 테스트
 *
 * figures prop 전달/미전달 케이스와
 * 연속 도형 수평 배치 동작을 검증한다.
 * node 환경에서 실행 가능 (jsdom 불필요).
 *
 * 총 ~8개 케이스
 */

import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LatexRenderer } from '../latex-renderer'
import type { FigureData } from '@/lib/ai/types'

// ─── 픽스처 ──────────────────────────────────────────────────

/** 수직선 도형 픽스처 */
const numberLineFigure: FigureData = {
  type: 'number_line',
  min: -2,
  max: 2,
  points: [{ value: 0, label: 'O' }],
  displaySize: 'large',
  description: '수직선',
}

/** 좌표평면 도형 픽스처 */
const coordinatePlaneFigure: FigureData = {
  type: 'coordinate_plane',
  xRange: [-3, 3],
  yRange: [-3, 3],
  gridStep: 1,
  displaySize: 'small',
  description: '좌표평면',
}

// ─── figures 미전달 → 플레이스홀더 ───────────────────────────

describe('LatexRenderer + figures 미전달 (플레이스홀더)', () => {
  it('{{fig:1}} + figures 미전달 → "[도형 1]" 플레이스홀더 표시', () => {
    const html = renderToString(<LatexRenderer text="{{fig:1}}" />)
    expect(html).toContain('[도형 1]')
  })

  it('{{fig:2}} + figures 미전달 → "[도형 2]" 플레이스홀더 표시', () => {
    const html = renderToString(<LatexRenderer text="{{fig:2}}" />)
    expect(html).toContain('[도형 2]')
  })

  it('텍스트 + {{fig:1}} 혼합 + figures 미전달 → 텍스트 및 플레이스홀더 모두 표시', () => {
    const html = renderToString(
      <LatexRenderer text="다음 그림 {{fig:1}}을 보시오." />,
    )
    expect(html).toContain('다음 그림')
    expect(html).toContain('[도형 1]')
  })
})

// ─── figures 전달 → FigureRenderer 렌더링 ──────────────────

describe('LatexRenderer + figures 전달 (FigureRenderer 렌더링)', () => {
  it('{{fig:1}} + figures 1개 → <svg> 포함', () => {
    const html = renderToString(
      <LatexRenderer text="{{fig:1}}" figures={[numberLineFigure]} />,
    )
    expect(html).toContain('<svg')
  })

  it('{{fig:1}} + figures 1개 → 플레이스홀더 "[도형 1]" 미포함', () => {
    const html = renderToString(
      <LatexRenderer text="{{fig:1}}" figures={[numberLineFigure]} />,
    )
    // FigureRenderer가 렌더링되면 플레이스홀더 텍스트는 없어야 함
    expect(html).not.toContain('[도형 1]')
  })

  it('{{fig:2}} + figures 1개 → 인덱스 초과 → "[도형 2]" 플레이스홀더 표시', () => {
    const html = renderToString(
      <LatexRenderer text="{{fig:2}}" figures={[numberLineFigure]} />,
    )
    expect(html).toContain('[도형 2]')
  })

  it('{{fig:1}} + 수식 혼합 → svg 및 katex 모두 포함', () => {
    const html = renderToString(
      <LatexRenderer
        text="$x^2$에서 {{fig:1}}를 참조하시오."
        figures={[numberLineFigure]}
      />,
    )
    expect(html).toContain('katex')
    expect(html).toContain('<svg')
  })
})

// ─── 연속 도형 → flex 래퍼 ──────────────────────────────────

describe('LatexRenderer + 연속 도형 (수평 배치)', () => {
  it('{{fig:1}}{{fig:2}} 연속 → flex 래퍼 포함', () => {
    const html = renderToString(
      <LatexRenderer
        text="{{fig:1}}{{fig:2}}"
        figures={[numberLineFigure, coordinatePlaneFigure]}
      />,
    )
    // groupAdjacentFigures → flex flex-row gap-4 justify-center 래퍼
    expect(html).toContain('flex')
  })

  it('{{fig:1}}{{fig:2}} 연속 + figures 2개 → <svg> 두 개 이상 포함', () => {
    const html = renderToString(
      <LatexRenderer
        text="{{fig:1}}{{fig:2}}"
        figures={[numberLineFigure, coordinatePlaneFigure]}
      />,
    )
    const svgCount = (html.match(/<svg/g) || []).length
    expect(svgCount).toBeGreaterThanOrEqual(2)
  })
})
