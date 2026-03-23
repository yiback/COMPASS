/**
 * FigureData Zod 스키마 + validateFigureIndices 교차 검증 테스트
 *
 * 6가지 도형 타입의 유효/무효 데이터를 검증하고,
 * validateFigureIndices 함수의 교차 검증 동작을 확인한다.
 *
 * 총 ~26개 케이스
 */

import { describe, expect, it } from 'vitest'
import { figureDataSchema, validateFigureIndices } from '../figure-schema'

// ─── 공통 픽스처 ─────────────────────────────────────────

/** coordinate_plane 유효 데이터 */
const validCoordinatePlane = {
  type: 'coordinate_plane' as const,
  xRange: [-5, 5] as [number, number],
  yRange: [-5, 5] as [number, number],
  gridStep: 1,
  displaySize: 'large' as const,
  description: '좌표평면',
}

/** function_graph 유효 데이터 */
const validFunctionGraph = {
  type: 'function_graph' as const,
  points: [
    [0, 0],
    [1, 1],
    [2, 4],
  ] as [number, number][],
  domain: [-3, 3] as [number, number],
  xRange: [-5, 5] as [number, number],
  yRange: [-2, 10] as [number, number],
  gridStep: 1,
  displaySize: 'small' as const,
  description: '이차함수',
}

/** polygon 유효 데이터 */
const validPolygon = {
  type: 'polygon' as const,
  vertices: [
    [0, 0],
    [4, 0],
    [2, 3],
  ] as [number, number][],
  labels: ['A', 'B', 'C'],
  displaySize: 'large' as const,
  description: '삼각형',
}

/** circle 유효 데이터 */
const validCircle = {
  type: 'circle' as const,
  center: [0, 0] as [number, number],
  radius: 3,
  displaySize: 'large' as const,
  description: '원',
}

/** vector 유효 데이터 */
const validVector = {
  type: 'vector' as const,
  from: [0, 0] as [number, number],
  to: [3, 4] as [number, number],
  label: 'v',
  displaySize: 'large' as const,
  description: '벡터',
}

/** number_line 유효 데이터 */
const validNumberLine = {
  type: 'number_line' as const,
  min: -3,
  max: 3,
  points: [{ value: 1, label: 'A' }],
  displaySize: 'large' as const,
  description: '수직선',
}

// ─── coordinate_plane ──────────────────────────────────────

describe('figureDataSchema - coordinate_plane', () => {
  it('유효한 coordinate_plane → 파싱 성공', () => {
    const result = figureDataSchema.parse(validCoordinatePlane)
    expect(result.type).toBe('coordinate_plane')
  })

  it('gridStep이 0이면 파싱 실패', () => {
    expect(() =>
      figureDataSchema.parse({ ...validCoordinatePlane, gridStep: 0 }),
    ).toThrow()
  })

  it('gridStep이 음수이면 파싱 실패', () => {
    expect(() =>
      figureDataSchema.parse({ ...validCoordinatePlane, gridStep: -1 }),
    ).toThrow()
  })

  it('xRange[0] >= xRange[1]이면 파싱 실패', () => {
    expect(() =>
      figureDataSchema.parse({ ...validCoordinatePlane, xRange: [5, 5] }),
    ).toThrow()
  })

  it('yRange[0] >= yRange[1]이면 파싱 실패', () => {
    expect(() =>
      figureDataSchema.parse({ ...validCoordinatePlane, yRange: [3, -3] }),
    ).toThrow()
  })
})

// ─── function_graph ──────────────────────────────────────────

describe('figureDataSchema - function_graph', () => {
  it('유효한 function_graph → 파싱 성공', () => {
    const result = figureDataSchema.parse(validFunctionGraph)
    expect(result.type).toBe('function_graph')
  })

  it('points 1개이면 파싱 실패 (최소 2개)', () => {
    expect(() =>
      figureDataSchema.parse({
        ...validFunctionGraph,
        points: [[0, 0]],
      }),
    ).toThrow()
  })

  it('domain[0] >= domain[1]이면 파싱 실패', () => {
    expect(() =>
      figureDataSchema.parse({ ...validFunctionGraph, domain: [3, -3] }),
    ).toThrow()
  })

  it('color 필드는 선택(optional) — 미전달 시 파싱 성공', () => {
    const { color: _color, ...withoutColor } = validFunctionGraph
    const result = figureDataSchema.parse(withoutColor)
    expect(result.type).toBe('function_graph')
  })
})

// ─── polygon ────────────────────────────────────────────────

describe('figureDataSchema - polygon', () => {
  it('유효한 polygon → 파싱 성공', () => {
    const result = figureDataSchema.parse(validPolygon)
    expect(result.type).toBe('polygon')
  })

  it('vertices 2개이면 파싱 실패 (최소 3개)', () => {
    expect(() =>
      figureDataSchema.parse({
        ...validPolygon,
        vertices: [
          [0, 0],
          [1, 0],
        ],
      }),
    ).toThrow()
  })

  it('labels 필드는 선택(optional) — 미전달 시 파싱 성공', () => {
    const { labels: _labels, ...withoutLabels } = validPolygon
    const result = figureDataSchema.parse(withoutLabels)
    expect(result.type).toBe('polygon')
  })
})

// ─── circle ─────────────────────────────────────────────────

describe('figureDataSchema - circle', () => {
  it('유효한 circle → 파싱 성공', () => {
    const result = figureDataSchema.parse(validCircle)
    expect(result.type).toBe('circle')
  })

  it('radius가 0이면 파싱 실패', () => {
    expect(() =>
      figureDataSchema.parse({ ...validCircle, radius: 0 }),
    ).toThrow()
  })

  it('radius가 음수이면 파싱 실패', () => {
    expect(() =>
      figureDataSchema.parse({ ...validCircle, radius: -5 }),
    ).toThrow()
  })
})

// ─── vector ─────────────────────────────────────────────────

describe('figureDataSchema - vector', () => {
  it('유효한 vector → 파싱 성공', () => {
    const result = figureDataSchema.parse(validVector)
    expect(result.type).toBe('vector')
  })

  it('from === to이면 파싱 실패 (제로 벡터)', () => {
    expect(() =>
      figureDataSchema.parse({
        ...validVector,
        from: [1, 2],
        to: [1, 2],
      }),
    ).toThrow()
  })

  it('label 필드는 선택(optional) — 미전달 시 파싱 성공', () => {
    const { label: _label, ...withoutLabel } = validVector
    const result = figureDataSchema.parse(withoutLabel)
    expect(result.type).toBe('vector')
  })
})

// ─── number_line ─────────────────────────────────────────────

describe('figureDataSchema - number_line', () => {
  it('유효한 number_line → 파싱 성공', () => {
    const result = figureDataSchema.parse(validNumberLine)
    expect(result.type).toBe('number_line')
  })

  it('min >= max이면 파싱 실패', () => {
    expect(() =>
      figureDataSchema.parse({ ...validNumberLine, min: 3, max: -3 }),
    ).toThrow()
  })

  it('points 빈 배열이면 파싱 실패 (최소 1개)', () => {
    expect(() =>
      figureDataSchema.parse({ ...validNumberLine, points: [] }),
    ).toThrow()
  })
})

// ─── 공통 필드 검증 ──────────────────────────────────────────

describe('figureDataSchema - 공통 필드', () => {
  it('displaySize 미전달 → 기본값 "large" 적용', () => {
    const { displaySize: _ds, ...withoutDisplaySize } = validCircle
    const result = figureDataSchema.parse(withoutDisplaySize)
    expect(result.displaySize).toBe('large')
  })

  it('displaySize "small" → 그대로 파싱', () => {
    const result = figureDataSchema.parse({ ...validCircle, displaySize: 'small' })
    expect(result.displaySize).toBe('small')
  })

  it('description 빈 문자열이면 파싱 실패', () => {
    expect(() =>
      figureDataSchema.parse({ ...validCircle, description: '' }),
    ).toThrow()
  })

  it('알 수 없는 type이면 파싱 실패', () => {
    expect(() =>
      figureDataSchema.parse({
        type: 'unknown_type',
        description: '알 수 없는 타입',
        displaySize: 'large',
      }),
    ).toThrow()
  })
})

// ─── validateFigureIndices 교차 검증 ─────────────────────────

describe('validateFigureIndices', () => {
  it('{{fig:1}} + figures 1개 → 경고 0', () => {
    const warnings = validateFigureIndices('{{fig:1}}', { length: 1 })
    expect(warnings).toHaveLength(0)
  })

  it('{{fig:2}} + figures 1개 → 경고 1 (범위 초과)', () => {
    const warnings = validateFigureIndices('{{fig:2}}', { length: 1 })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('fig:2')
  })

  it('{{fig:1}}{{fig:2}} + figures 2개 → 경고 0', () => {
    const warnings = validateFigureIndices('{{fig:1}}{{fig:2}}', { length: 2 })
    expect(warnings).toHaveLength(0)
  })

  it('figures undefined → 빈 배열 반환 (early return)', () => {
    const warnings = validateFigureIndices('{{fig:1}}', undefined)
    expect(warnings).toHaveLength(0)
  })

  it('figures 빈 배열 + {{fig:1}} → 경고 1', () => {
    const warnings = validateFigureIndices('{{fig:1}}', { length: 0 })
    expect(warnings).toHaveLength(1)
  })

  it('{{fig:}} 미참조 → 경고 없음 (미참조는 허용)', () => {
    // 텍스트에 fig 참조 없이 figures 배열이 있어도 경고 없음
    const warnings = validateFigureIndices('일반 텍스트', { length: 2 })
    expect(warnings).toHaveLength(0)
  })

  it('여러 범위 초과 → 경고 여러 개', () => {
    const warnings = validateFigureIndices('{{fig:3}}{{fig:4}}', { length: 2 })
    expect(warnings).toHaveLength(2)
  })
})
