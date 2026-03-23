/**
 * SVG 유틸 함수 테스트 (mapToSVG, calcViewBox, formatNumber)
 *
 * 순수 함수이므로 jsdom/React 불필요 (node 환경).
 *
 * 총 ~8개 케이스
 */

import { describe, expect, it } from 'vitest'
import { mapToSVG, calcViewBox, formatNumber } from '../svg-utils'

// ─── mapToSVG ──────────────────────────────────────────────

describe('mapToSVG', () => {
  it('중앙값은 SVG 범위 중앙에 매핑된다', () => {
    // 데이터 [0,10] → SVG [20,380], 값 5 → 200
    const result = mapToSVG(5, 0, 10, 20, 380)
    expect(result).toBe(200)
  })

  it('최솟값은 svgMin에 매핑된다', () => {
    const result = mapToSVG(0, 0, 10, 20, 380)
    expect(result).toBe(20)
  })

  it('최댓값은 svgMax에 매핑된다', () => {
    const result = mapToSVG(10, 0, 10, 20, 380)
    expect(result).toBe(380)
  })

  it('dataMax === dataMin이면 0-나누기 방지: SVG 중앙값 반환', () => {
    // 데이터 [5,5] (범위 0) → SVG 중앙 (20+380)/2 = 200
    const result = mapToSVG(5, 5, 5, 20, 380)
    expect(result).toBe(200)
  })

  it('음수 범위도 정상 처리된다', () => {
    // 데이터 [-10,0] → SVG [0,100], 값 -5 → 50
    const result = mapToSVG(-5, -10, 0, 0, 100)
    expect(result).toBe(50)
  })
})

// ─── calcViewBox ──────────────────────────────────────────────

describe('calcViewBox', () => {
  it('패딩을 포함한 뷰박스 좌표를 반환한다', () => {
    // min=-2, max=8, padding=4 → svgMin=-4, svgMax=10, size=14
    const result = calcViewBox(-2, 8, 4)
    expect(result.svgMin).toBe(-4)
    expect(result.svgMax).toBe(10)
    expect(result.size).toBe(14)
  })

  it('size는 svgMax - svgMin이다', () => {
    const result = calcViewBox(0, 10, 20)
    expect(result.size).toBe(result.svgMax - result.svgMin)
  })
})

// ─── formatNumber ──────────────────────────────────────────────

describe('formatNumber', () => {
  it('정수는 정수 형태로 표시된다', () => {
    expect(formatNumber(3)).toBe('3')
    expect(formatNumber(-5)).toBe('-5')
    expect(formatNumber(0)).toBe('0')
  })

  it('소수는 소수점 1자리로 표시된다', () => {
    expect(formatNumber(3.14)).toBe('3.1')
    expect(formatNumber(-2.75)).toBe('-2.8')
  })

  it('정수형 소수는 정수로 표시된다', () => {
    // 3.0은 isInteger가 true → "3"
    expect(formatNumber(3.0)).toBe('3')
  })
})
