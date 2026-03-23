'use client'

/**
 * 도형 렌더링 컴포넌트
 *
 * FigureData를 받아 적절한 SVG 컴포넌트를 렌더링한다.
 * Wave 1: 모든 타입에서 FigurePlaceholder 폴백 렌더링
 * Wave 2: NumberLine 컴포넌트로 교체 예정
 * Wave 3: CoordinatePlane, FunctionGraph, Polygon, Circle, Vector 컴포넌트로 교체 예정
 *
 * 레이아웃(블록/인라인) 결정은 LatexRenderer가 segment.display로 처리하며,
 * 이 컴포넌트는 레이아웃을 결정하지 않는다.
 */

import { memo } from 'react'
import type { FigureData } from '@/lib/ai/types'
import { NumberLine } from '@/components/ui/svg/number-line'
import { CoordinatePlane } from '@/components/ui/svg/coordinate-plane'
import { FunctionGraph } from '@/components/ui/svg/function-graph'
import { PolygonShape } from '@/components/ui/svg/polygon'
import { CircleShape } from '@/components/ui/svg/circle-shape'
import { VectorArrow } from '@/components/ui/svg/vector-arrow'

interface FigureRendererProps {
  readonly figure: FigureData
  readonly className?: string
}

/**
 * 도형 렌더링이 아직 구현되지 않은 경우 표시되는 플레이스홀더.
 * 점선 테두리 + 타입 + 설명 텍스트를 보여준다.
 */
function FigurePlaceholder({ figure }: { figure: FigureData }) {
  return (
    <span className="flex items-center gap-2 rounded border border-dashed border-muted-foreground p-2 text-sm text-muted-foreground">
      {`[도형: ${figure.type}] ${figure.description}`}
    </span>
  )
}

/**
 * 도형 데이터를 받아 SVG 기반 시각적 컴포넌트로 렌더링한다.
 * React.memo로 래핑하여 동일한 props가 전달될 때 불필요한 리렌더링을 방지한다.
 *
 * className은 최상위 래퍼에 전달되므로 외부에서 레이아웃 스타일링이 가능하다.
 *
 * @example
 * <FigureRenderer figure={figureData} className="my-4" />
 */
export const FigureRenderer = memo(function FigureRenderer({
  figure,
  className,
}: FigureRendererProps) {
  // figure.type에 따라 적절한 SVG 컴포넌트를 렌더링한다.
  // Wave 2~3에서 각 case가 전용 SVG 컴포넌트로 교체될 예정이다.
  const content = (() => {
    switch (figure.type) {
      case 'number_line':
        // Wave 2: NumberLine SVG 컴포넌트로 렌더링
        return <NumberLine figure={figure} className={className} />
      case 'coordinate_plane':
        // Wave 3a: CoordinatePlane SVG 컴포넌트로 렌더링
        return <CoordinatePlane figure={figure} className={className} />
      case 'function_graph':
        // Wave 3a: FunctionGraph SVG 컴포넌트로 렌더링
        return <FunctionGraph figure={figure} className={className} />
      case 'polygon':
        // Wave 3b: PolygonShape SVG 컴포넌트로 렌더링
        return <PolygonShape figure={figure} className={className} />
      case 'circle':
        // Wave 3b: CircleShape SVG 컴포넌트로 렌더링
        return <CircleShape figure={figure} className={className} />
      case 'vector':
        // Wave 3b: VectorArrow SVG 컴포넌트로 렌더링
        return <VectorArrow figure={figure} className={className} />
      default:
        // 알 수 없는 타입 — 폴백 플레이스홀더 렌더링
        return <FigurePlaceholder figure={figure} />
    }
  })()

  // SVG 컴포넌트들은 className을 직접 처리하므로 래퍼 없이 반환한다.
  // FigurePlaceholder(미구현 타입)는 래퍼 span에 className을 적용한다.
  if (
    figure.type === 'number_line' ||
    figure.type === 'coordinate_plane' ||
    figure.type === 'function_graph' ||
    figure.type === 'polygon' ||
    figure.type === 'circle' ||
    figure.type === 'vector'
  ) {
    return content
  }

  // 미구현 타입: className을 래퍼 span에 전달
  return <span className={className}>{content}</span>
})
