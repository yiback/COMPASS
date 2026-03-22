/**
 * LatexRenderer 렌더링 테스트
 *
 * react-dom/server renderToString을 활용해 SSR HTML 출력을 검증한다.
 * jsdom / @testing-library/react 의존성 없이 동작하며,
 * node 환경에서 실행 가능하다.
 *
 * 검증 방식:
 *   - renderToString() → HTML 문자열 생성
 *   - 문자열 포함/불포함 여부로 렌더링 결과 확인
 *
 * 총 9개 케이스
 */

import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LatexRenderer } from '../latex-renderer'

describe('LatexRenderer', () => {
  // ─────────────────────────────────────────────
  // 기본 케이스
  // ─────────────────────────────────────────────
  describe('기본 렌더링', () => {
    it('null text → 크래시 없이 빈 span 반환', () => {
      // 에러 없이 렌더링되어야 함
      expect(() => renderToString(<LatexRenderer text={null} />)).not.toThrow()
      const html = renderToString(<LatexRenderer text={null} />)
      // 세그먼트 없으므로 빈 span 태그
      expect(html).toContain('<span')
    })

    it('순수 텍스트 → 텍스트 내용 포함', () => {
      const html = renderToString(<LatexRenderer text="안녕하세요" />)
      expect(html).toContain('안녕하세요')
    })

    it('className prop → wrapper span에 클래스 적용', () => {
      const html = renderToString(
        <LatexRenderer text="테스트" className="custom-class" />,
      )
      expect(html).toContain('custom-class')
    })
  })

  // ─────────────────────────────────────────────
  // 수식 렌더링
  // ─────────────────────────────────────────────
  describe('수식 렌더링', () => {
    it('인라인 수식 → .katex 클래스 포함', () => {
      const html = renderToString(<LatexRenderer text="$x^2$" />)
      // KaTeX는 렌더링된 HTML에 katex 클래스를 포함함
      expect(html).toContain('katex')
    })

    it('블록 수식 → .katex-display 클래스 포함', () => {
      const html = renderToString(<LatexRenderer text="$$E=mc^2$$" />)
      // KaTeX displayMode=true 시 katex-display 클래스 생성
      expect(html).toContain('katex-display')
    })

    it('잘못된 LaTeX → 크래시 없이 폴백 텍스트 렌더링', () => {
      // KaTeX throwOnError: false 설정으로 에러 없이 폴백 처리
      expect(() =>
        renderToString(<LatexRenderer text="$\\invalid{{}$" />),
      ).not.toThrow()
    })

    it('잘못된 LaTeX → katex-error 클래스 또는 원본 텍스트 포함', () => {
      const html = renderToString(<LatexRenderer text="$\\invalid{{}$" />)
      // throwOnError: false → katex-error 클래스 생성 또는 원본 텍스트 폴백
      const hasFallback = html.includes('katex-error') || html.includes('\\invalid')
      expect(hasFallback).toBe(true)
    })
  })

  // ─────────────────────────────────────────────
  // figure 플레이스홀더 [v2]
  // ─────────────────────────────────────────────
  describe('figure 플레이스홀더 [v2]', () => {
    it('{{fig:0}} → "[도형 0]" 플레이스홀더 텍스트 포함', () => {
      const html = renderToString(<LatexRenderer text="{{fig:0}}" />)
      expect(html).toContain('[도형 0]')
    })

    it('{{fig:2}} → "[도형 2]" 플레이스홀더 텍스트 포함', () => {
      const html = renderToString(<LatexRenderer text="{{fig:2}}" />)
      expect(html).toContain('[도형 2]')
    })
  })
})
