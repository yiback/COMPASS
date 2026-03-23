'use client'

/**
 * LaTeX 수식 렌더링 컴포넌트
 *
 * KaTeX를 사용하여 $...$ 인라인 수식, $$...$$ 블록 수식을 렌더링한다.
 * {{fig:N}} 도형 구분자는 [도형 N] 플레이스홀더로 표시한다.
 *
 * @security XSS 안전성 근거 (dangerouslySetInnerHTML 사용에 대해):
 *   - KaTeX는 입력 LaTeX를 자체적으로 파싱·이스케이프하여 안전한 HTML을 생성한다.
 *   - 사용자 입력(LaTeX 구문)이 그대로 HTML에 삽입되지 않으며,
 *     KaTeX의 화이트리스트 기반 HTML 생성 로직을 통과한 결과만 출력된다.
 *   - throwOnError: false 설정으로 잘못된 LaTeX도 에러 텍스트로 안전하게 표시된다.
 *   - 이는 react-katex, MathJax 등 업계 표준 라이브러리가 채택한 동일한 접근 방식이다.
 *   - catch 폴백 경로에서는 HTML 특수문자를 이스케이프하여 XSS를 추가 방지한다.
 */

// LatexRenderer가 사용되는 페이지에서만 KaTeX CSS를 로드한다 (코드 스플리팅 최적화)
import 'katex/dist/katex.min.css'
import { memo } from 'react'
import katex from 'katex'
import { parseLatexText, type LatexSegment } from '@/lib/utils/latex-parser'
import type { FigureData } from '@/lib/ai/types'
import { FigureRenderer } from '@/components/ui/figure-renderer'

interface LatexRendererProps {
  readonly text: string | null | undefined
  readonly className?: string
  /** 도형 데이터 배열 — optional, 미전달 시 플레이스홀더로 graceful degradation */
  readonly figures?: readonly FigureData[]
}

/**
 * KaTeX로 수식 문자열을 HTML 문자열로 변환한다.
 * 렌더링 실패 시 원본 content를 폴백으로 반환한다.
 */
function renderKatex(content: string, displayMode: boolean): string {
  try {
    return katex.renderToString(content, {
      displayMode,
      throwOnError: false,
    })
  } catch {
    // katex 런타임 예외 → XSS 방지를 위해 HTML 특수문자 이스케이프 후 폴백
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
}

/**
 * 단일 LatexSegment를 JSX 엘리먼트로 변환한다.
 *
 * @param segment - 렌더링할 세그먼트
 * @param index   - 리액트 key 용 인덱스
 * @param figures - 도형 데이터 배열 (optional, 미전달 시 플레이스홀더 표시)
 *
 * @note 모듈 레벨 함수로 유지 — 컴포넌트 내부로 이동하면 매 렌더링마다 함수 재생성되어 React.memo 무력화
 */
function renderSegment(
  segment: LatexSegment,
  index: number,
  figures: readonly FigureData[] | undefined,
): React.ReactNode {
  switch (segment.type) {
    case 'text':
      return (
        <span key={index} className="whitespace-pre-wrap">
          {segment.content}
        </span>
      )

    case 'inline': {
      // XSS 안전: KaTeX 화이트리스트 HTML 출력만 삽입
      const html = renderKatex(segment.content, false)
      return (
        <span
          key={index}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )
    }

    case 'block': {
      // XSS 안전: KaTeX 화이트리스트 HTML 출력만 삽입
      const html = renderKatex(segment.content, true)
      return (
        <div
          key={index}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )
    }

    case 'figure': {
      // {{fig:N}}의 N은 1-based → 배열 인덱스는 0-based
      const figure = figures?.[segment.index - 1]

      if (!figure) {
        // figures 미전달이거나 인덱스 초과 → 기존 플레이스홀더 유지 (graceful degradation)
        return (
          <span
            key={index}
            className="inline-flex items-center rounded bg-muted px-1 text-xs text-muted-foreground"
          >
            {`[도형 ${segment.index}]`}
          </span>
        )
      }

      // segment.display로 블록/인라인 레이아웃 결정 (displaySize는 FigureRenderer 내부에서만 사용)
      // 블록 레이아웃은 groupAdjacentFigures에서 그룹화하여 처리하므로 여기서는 래퍼 없이 FigureRenderer만 반환
      return <FigureRenderer key={index} figure={figure} />
    }
  }
}

/**
 * 그룹화된 렌더링 항목의 타입
 * - single: 단독 세그먼트 (텍스트, 수식, 인라인 도형)
 * - figureGroup: 연속된 figure 세그먼트 묶음 (수평 배치)
 */
type RenderItem =
  | { readonly kind: 'single'; readonly segment: LatexSegment; readonly index: number }
  | { readonly kind: 'figureGroup'; readonly segments: readonly { readonly segment: LatexSegment & { type: 'figure' }; readonly index: number }[] }

/**
 * 세그먼트 배열에서 연속된 figure 세그먼트를 그룹으로 묶는다.
 *
 * - figure가 2개 이상 연속되면 figureGroup으로 묶어 수평 배치
 * - 단독 figure는 기존 display 기반 레이아웃으로 처리
 * - 텍스트·수식 세그먼트는 single로 그대로 유지
 *
 * @note 모듈 레벨 함수로 유지 — 컴포넌트 내부 정의 시 React.memo 무력화
 */
function groupAdjacentFigures(segments: readonly LatexSegment[]): readonly RenderItem[] {
  const result: RenderItem[] = []
  let i = 0

  while (i < segments.length) {
    const segment = segments[i]

    if (segment.type === 'figure') {
      // 연속 figure 세그먼트 수집
      const figureGroup: { segment: LatexSegment & { type: 'figure' }; index: number }[] = [
        { segment: segment as LatexSegment & { type: 'figure' }, index: i },
      ]

      // 다음 세그먼트도 figure면 같은 그룹으로 묶기
      while (i + 1 < segments.length && segments[i + 1].type === 'figure') {
        i++
        figureGroup.push({
          segment: segments[i] as LatexSegment & { type: 'figure' },
          index: i,
        })
      }

      if (figureGroup.length > 1) {
        // 연속 figure 2개 이상 → 그룹으로 묶어 수평 배치
        result.push({ kind: 'figureGroup', segments: figureGroup })
      } else {
        // 단독 figure → single로 처리 (기존 display 기반 레이아웃 유지)
        result.push({ kind: 'single', segment: figureGroup[0].segment, index: figureGroup[0].index })
      }
    } else {
      result.push({ kind: 'single', segment, index: i })
    }

    i++
  }

  return result
}

/**
 * RenderItem 배열을 JSX 엘리먼트 배열로 변환한다.
 *
 * - figureGroup: flex-row 래퍼로 수평 배치
 * - single figure (block): 기존 justify-center my-4 래퍼 유지
 * - single figure (inline): inline-flex 래퍼 유지
 * - 그 외: renderSegment 위임
 *
 * @note 모듈 레벨 함수로 유지 — React.memo 무력화 방지
 */
function renderItems(
  items: readonly RenderItem[],
  figures: readonly FigureData[] | undefined,
): React.ReactNode[] {
  return items.map((item) => {
    if (item.kind === 'figureGroup') {
      // 연속 도형 → 수평 배치 래퍼로 감싸기
      return (
        <div
          key={`figureGroup-${item.segments[0].index}`}
          className="flex flex-row gap-4 justify-center my-4"
        >
          {item.segments.map(({ segment, index }) =>
            renderSegment(segment, index, figures),
          )}
        </div>
      )
    }

    // single 항목
    const { segment, index } = item

    if (segment.type === 'figure') {
      const figure = figures?.[segment.index - 1]

      if (!figure) {
        // figures 미전달이거나 인덱스 초과 → 플레이스홀더 (graceful degradation)
        return (
          <span
            key={index}
            className="inline-flex items-center rounded bg-muted px-1 text-xs text-muted-foreground"
          >
            {`[도형 ${segment.index}]`}
          </span>
        )
      }

      // 단독 figure: 블록/인라인 레이아웃 결정
      if (segment.display === 'block') {
        return (
          <div key={index} className="flex justify-center my-4">
            <FigureRenderer figure={figure} />
          </div>
        )
      }
      return (
        <span key={index} className="inline-flex">
          <FigureRenderer figure={figure} />
        </span>
      )
    }

    // figure 외 세그먼트 (text, inline, block)
    return renderSegment(segment, index, figures)
  })
}

/**
 * LaTeX 수식이 포함된 텍스트를 렌더링하는 컴포넌트.
 * React.memo로 래핑하여 동일한 props가 전달될 때 불필요한 리렌더링을 방지한다.
 *
 * @example
 * <LatexRenderer text="이차방정식 $ax^2 + bx + c = 0$의 근의 공식" />
 */
export const LatexRenderer = memo(function LatexRenderer({ text, className, figures }: LatexRendererProps) {
  const segments = parseLatexText(text)

  // 세그먼트가 없으면 빈 span 반환
  if (segments.length === 0) {
    return <span className={className} />
  }

  // 연속 figure 세그먼트를 그룹화 (수평 배치 처리)
  const items = groupAdjacentFigures(segments)

  return (
    <span className={className}>
      {/* groupAdjacentFigures로 연속 도형을 수평 배치, 나머지는 기존 로직 유지 */}
      {renderItems(items, figures)}
    </span>
  )
})
