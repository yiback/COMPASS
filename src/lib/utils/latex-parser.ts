/**
 * LaTeX 텍스트 파싱 유틸리티
 *
 * 텍스트 문자열을 렌더링 가능한 세그먼트 배열로 분해한다.
 * 파싱 우선순위: $$...$$ > {{fig:N}} > $...$ > 텍스트
 */

/**
 * 파싱된 텍스트 세그먼트 타입
 * - text: 일반 텍스트
 * - inline: $...$ 인라인 수식
 * - block: $$...$$ 블록 수식
 * - figure: {{fig:N}} 도형 구분자 (display: 레이아웃 위치)
 */
export type LatexSegment =
  | { type: 'text'; content: string }
  | { type: 'inline'; content: string }
  | { type: 'block'; content: string }
  | { type: 'figure'; index: number; display: 'block' | 'inline' }

/**
 * 블록 수식 패턴: $$...$$
 * 중간에 $ 또는 \n이 있어도 허용
 */
const BLOCK_MATH_PATTERN = /\$\$([\s\S]+?)\$\$/g

/**
 * 도형 구분자 패턴: {{fig:N}} (N은 숫자)
 */
const FIGURE_PATTERN = /\{\{fig:(\d+)\}\}/g

/**
 * 인라인 수식 패턴: $...$
 * - \\$ (이스케이프)는 매칭 제외
 * - 줄바꿈 불포함
 * - 빈 $ 미매칭
 */
const INLINE_MATH_PATTERN = /(?<!\\)\$([^$\n]+?)\$/g

/**
 * 통합 파싱 패턴 (우선순위 순서로 구성)
 * 각 그룹:
 *   1: 블록 수식 내용 ($$...$$)
 *   2: 도형 인덱스 ({{fig:N}})
 *   3: 인라인 수식 내용 ($...$)
 */
const COMBINED_PATTERN = /\$\$([\s\S]+?)\$\$|\{\{fig:(\d+)\}\}|(?<!\\)\$([^$\n]+?)\$/g

/**
 * figure 세그먼트의 display 모드를 판단한다.
 *
 * 판단 기준:
 * - {{fig:N}} 앞이 \n 또는 문자열 시작 AND 뒤가 \n 또는 문자열 끝 → 'block'
 * - 그 외 → 'inline'
 */
function determineFigureDisplay(
  fullText: string,
  matchStart: number,
  matchEnd: number,
): 'block' | 'inline' {
  // 앞 문자 확인: 문자열 시작 또는 \n
  const charBefore = matchStart === 0 ? '\n' : fullText[matchStart - 1]
  // 뒤 문자 확인: 문자열 끝 또는 \n
  const charAfter = matchEnd >= fullText.length ? '\n' : fullText[matchEnd]

  const isBlockContext = charBefore === '\n' && charAfter === '\n'
  return isBlockContext ? 'block' : 'inline'
}

/**
 * LaTeX 텍스트를 렌더링 세그먼트 배열로 파싱한다.
 *
 * @param text - 파싱할 텍스트 (null/undefined 허용)
 * @returns LatexSegment 배열 (빈 text 세그먼트 필터링됨)
 *
 * @example
 * parseLatexText("$x^2$와 $$y=mx+b$$")
 * // => [{ type: 'inline', content: 'x^2' }, { type: 'text', content: '와 ' }, { type: 'block', content: 'y=mx+b' }]
 */
export function parseLatexText(text: string | null | undefined): LatexSegment[] {
  // null / undefined / 빈 문자열 → 빈 배열
  if (!text) return []

  const segments: LatexSegment[] = []
  let cursor = 0

  // COMBINED_PATTERN은 stateful(lastIndex)이므로 매번 reset
  COMBINED_PATTERN.lastIndex = 0

  let match: RegExpExecArray | null

  while ((match = COMBINED_PATTERN.exec(text)) !== null) {
    const matchStart = match.index
    const matchEnd = matchStart + match[0].length

    // 매치 이전 텍스트 → text 세그먼트
    if (matchStart > cursor) {
      segments.push({ type: 'text', content: text.slice(cursor, matchStart) })
    }

    if (match[1] !== undefined) {
      // 그룹 1: 블록 수식 $$...$$
      segments.push({ type: 'block', content: match[1] })
    } else if (match[2] !== undefined) {
      // 그룹 2: 도형 {{fig:N}}
      const figIndex = parseInt(match[2], 10)
      const display = determineFigureDisplay(text, matchStart, matchEnd)
      segments.push({ type: 'figure', index: figIndex, display })
    } else if (match[3] !== undefined) {
      // 그룹 3: 인라인 수식 $...$
      segments.push({ type: 'inline', content: match[3] })
    }

    cursor = matchEnd
  }

  // 나머지 텍스트 → text 세그먼트
  if (cursor < text.length) {
    segments.push({ type: 'text', content: text.slice(cursor) })
  }

  // 빈 text 세그먼트 필터링
  return segments.filter(
    (segment) => segment.type !== 'text' || segment.content.length > 0,
  )
}
