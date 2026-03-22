/**
 * parseLatexText 단위 테스트 (22개 케이스)
 *
 * 파싱 우선순위: $$...$$ > {{fig:N}} > $...$ > 텍스트
 */

import { describe, expect, it } from 'vitest'
import { parseLatexText, type LatexSegment } from '../latex-parser'

// 타입 헬퍼 — 테스트 가독성 향상
const text = (content: string): LatexSegment => ({ type: 'text', content })
const inline = (content: string): LatexSegment => ({ type: 'inline', content })
const block = (content: string): LatexSegment => ({ type: 'block', content })
const figure = (index: number, display: 'block' | 'inline'): LatexSegment => ({
  type: 'figure',
  index,
  display,
})

describe('parseLatexText', () => {
  // ─────────────────────────────────────────────
  // 그룹 1: 기본 케이스 (1-5)
  // ─────────────────────────────────────────────
  describe('기본 케이스', () => {
    it('1. null 입력 → 빈 배열', () => {
      expect(parseLatexText(null)).toEqual([])
    })

    it('2. undefined 입력 → 빈 배열', () => {
      expect(parseLatexText(undefined)).toEqual([])
    })

    it('3. 빈 문자열 → 빈 배열', () => {
      expect(parseLatexText('')).toEqual([])
    })

    it('4. 순수 텍스트 → text 세그먼트 1개', () => {
      expect(parseLatexText('안녕하세요')).toEqual([text('안녕하세요')])
    })

    it('5. 이스케이프된 \\$ → 수식 미파싱, text 세그먼트로 반환', () => {
      // \\$ 는 달러 기호로 이스케이프되었으므로 수식 파싱 대상이 아님
      expect(parseLatexText('\\$5 가격')).toEqual([text('\\$5 가격')])
    })
  })

  // ─────────────────────────────────────────────
  // 그룹 2: 수식 파싱 (6-9)
  // ─────────────────────────────────────────────
  describe('수식 파싱', () => {
    it('6. 인라인 수식 단독 → inline 세그먼트 1개', () => {
      expect(parseLatexText('$x^2$')).toEqual([inline('x^2')])
    })

    it('7. 블록 수식 단독 → block 세그먼트 1개', () => {
      expect(parseLatexText('$$\\frac{1}{2}$$')).toEqual([block('\\frac{1}{2}')])
    })

    it('8. 텍스트 + 인라인 수식 혼합 → [text, inline, text]', () => {
      const result = parseLatexText('넓이는 $S=\\pi r^2$ 입니다')
      expect(result).toEqual([
        text('넓이는 '),
        inline('S=\\pi r^2'),
        text(' 입니다'),
      ])
    })

    it('9. 닫히지 않은 $ → 폴백으로 text 세그먼트 반환', () => {
      // 닫히는 $ 없으면 수식이 아닌 텍스트로 처리
      expect(parseLatexText('$닫히지 않은')).toEqual([text('$닫히지 않은')])
    })
  })

  // ─────────────────────────────────────────────
  // 그룹 3: 혼합 및 우선순위 (10-13)
  // ─────────────────────────────────────────────
  describe('혼합 및 우선순위', () => {
    it('10. 블록 수식 + 뒤 텍스트 → [block, text]', () => {
      const result = parseLatexText('$$E=mc^2$$ 공식')
      expect(result).toEqual([block('E=mc^2'), text(' 공식')])
    })

    it('11. 인라인 수식 2개 → [inline, text, inline]', () => {
      const result = parseLatexText('$a$ + $b$')
      expect(result).toEqual([inline('a'), text(' + '), inline('b')])
    })

    it('12. $$ 가 $ 보다 우선순위 높음 → block 세그먼트 1개만 반환', () => {
      // "$$x^2$$"는 블록 1개. 인라인으로 분리되지 않음
      expect(parseLatexText('$$x^2$$')).toEqual([block('x^2')])
    })

    it('13. 빈 text 세그먼트 필터링 → inline만 반환 (앞뒤 빈 텍스트 없음)', () => {
      // "$x$" → inline('x') 만. 빈 text 세그먼트 없음
      expect(parseLatexText('$x$')).toEqual([inline('x')])
    })
  })

  // ─────────────────────────────────────────────
  // 그룹 4: figure 세그먼트 [v2] (14-17)
  // ─────────────────────────────────────────────
  describe('figure 세그먼트 [v2]', () => {
    it('14. 텍스트 중간에 {{fig:0}} → [text, figure(0,inline), text]', () => {
      const result = parseLatexText('텍스트 {{fig:0}} 계속')
      expect(result).toEqual([
        text('텍스트 '),
        figure(0, 'inline'),
        text(' 계속'),
      ])
    })

    it('15. 연속 figure → [figure(0,inline), figure(1,inline)]', () => {
      const result = parseLatexText('{{fig:0}}{{fig:1}}')
      expect(result).toEqual([figure(0, 'inline'), figure(1, 'inline')])
    })

    it('16. 인라인 수식 + figure 혼합 → [inline, text, figure(0,inline)]', () => {
      const result = parseLatexText('$x^2$ 와 {{fig:0}}')
      expect(result).toEqual([
        inline('x^2'),
        text(' 와 '),
        figure(0, 'inline'),
      ])
    })

    it('17. 줄바꿈으로 분리된 figure → 각 figure가 block display', () => {
      // 앞뒤가 줄바꿈(또는 문자열 경계)이면 block
      const result = parseLatexText('{{fig:0}}\n{{fig:1}}')
      expect(result).toEqual([
        figure(0, 'block'),
        text('\n'),
        figure(1, 'block'),
      ])
    })
  })

  // ─────────────────────────────────────────────
  // 그룹 5: 엣지 케이스 (18-22)
  // ─────────────────────────────────────────────
  describe('엣지 케이스', () => {
    it('18. 동일 함수를 연속 2회 호출해도 동일한 결과 반환 (lastIndex 리셋 검증)', () => {
      const input = '$x^2$'
      const result1 = parseLatexText(input)
      const result2 = parseLatexText(input)
      expect(result1).toEqual(result2)
    })

    it('19. $a$b$c$ → inline(a), text(b), inline(c)', () => {
      const result = parseLatexText('$a$b$c$')
      // $a$ 매칭 → b → $c$ 매칭
      expect(result).toEqual([inline('a'), text('b'), inline('c')])
    })

    it('20. $$a$b$$ → block 1개 (내부 $ 포함)', () => {
      const result = parseLatexText('$$a$b$$')
      expect(result).toEqual([block('a$b')])
    })

    it('21. {{fig:}} 빈 인덱스 → text 폴백', () => {
      expect(parseLatexText('{{fig:}}')).toEqual([text('{{fig:}}')])
    })

    it('22. {{fig:-1}} 음수 인덱스 → text 폴백', () => {
      expect(parseLatexText('{{fig:-1}}')).toEqual([text('{{fig:-1}}')])
    })
  })
})
