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

interface LatexRendererProps {
  readonly text: string | null | undefined
  readonly className?: string
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
 */
function renderSegment(segment: LatexSegment, index: number): React.ReactNode {
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

    case 'figure':
      // 도형 플레이스홀더 — FigureRenderer 구현 전 임시 표시
      return (
        <span
          key={index}
          className="inline-flex items-center rounded bg-muted px-1 text-xs text-muted-foreground"
        >
          {`[도형 ${segment.index}]`}
        </span>
      )
  }
}

/**
 * LaTeX 수식이 포함된 텍스트를 렌더링하는 컴포넌트.
 * React.memo로 래핑하여 동일한 props가 전달될 때 불필요한 리렌더링을 방지한다.
 *
 * @example
 * <LatexRenderer text="이차방정식 $ax^2 + bx + c = 0$의 근의 공식" />
 */
export const LatexRenderer = memo(function LatexRenderer({ text, className }: LatexRendererProps) {
  const segments = parseLatexText(text)

  // 세그먼트가 없으면 빈 span 반환
  if (segments.length === 0) {
    return <span className={className} />
  }

  return (
    <span className={className}>
      {segments.map((segment, index) => renderSegment(segment, index))}
    </span>
  )
})
