/**
 * SVG 렌더링에 공통으로 사용되는 순수 유틸 함수 모음.
 *
 * React 의존성 없음 — 순수 TypeScript 계산 함수만 포함.
 * 모든 SVG 렌더러(number_line, coordinate_plane 등)가 공유한다.
 */

/**
 * 데이터 값을 SVG 픽셀 좌표로 선형 변환한다.
 *
 * 예: 데이터 범위 [0, 10]을 SVG 범위 [20, 380]으로 매핑할 때
 * value=5 → 200(중앙)
 *
 * @param value - 변환할 데이터 값
 * @param dataMin - 데이터 최솟값
 * @param dataMax - 데이터 최댓값
 * @param svgMin - SVG 픽셀 최솟값
 * @param svgMax - SVG 픽셀 최댓값
 * @returns 선형 보간된 SVG 픽셀 좌표
 */
export function mapToSVG(
  value: number,
  dataMin: number,
  dataMax: number,
  svgMin: number,
  svgMax: number,
): number {
  // dataMax === dataMin이면 0으로 나누기 발생 → 중앙값 반환으로 방지
  if (dataMax === dataMin) {
    return (svgMin + svgMax) / 2
  }
  return svgMin + ((value - dataMin) / (dataMax - dataMin)) * (svgMax - svgMin)
}

/**
 * SVG 뷰박스 계산 결과 타입.
 */
export interface ViewBoxResult {
  /** 패딩을 포함한 SVG 시작 좌표 */
  readonly svgMin: number
  /** 패딩을 포함한 SVG 끝 좌표 */
  readonly svgMax: number
  /** 전체 크기 (svgMax - svgMin) */
  readonly size: number
}

/**
 * 데이터 범위와 패딩을 고려한 SVG 뷰박스 좌표를 계산한다.
 *
 * 예: min=-2, max=8, padding=40 → svgMin=-2, svgMax=48, size=50
 * (양쪽에 padding/2씩 여백을 추가)
 *
 * @param min - 데이터 최솟값
 * @param max - 데이터 최댓값
 * @param padding - 양쪽에 추가할 총 여백 픽셀 (각 측면에 padding/2 적용)
 * @returns 뷰박스 계산 결과
 */
export function calcViewBox(
  min: number,
  max: number,
  padding: number,
): ViewBoxResult {
  const half = padding / 2
  const svgMin = min - half
  const svgMax = max + half
  return {
    svgMin,
    svgMax,
    size: svgMax - svgMin,
  }
}

/**
 * 숫자를 표시용 문자열로 포맷한다.
 *
 * - 정수이면 정수 형태로 표시 (예: 3 → "3")
 * - 소수이면 소수점 1자리로 표시 (예: 3.14 → "3.1")
 *
 * @param n - 포맷할 숫자
 * @returns 포맷된 문자열
 */
export function formatNumber(n: number): string {
  if (Number.isInteger(n)) {
    return String(n)
  }
  return n.toFixed(1)
}

/**
 * SVG 화살표 마커 ID 상수 — 컴포넌트별 고유 prefix.
 *
 * 같은 페이지에 여러 SVG 컴포넌트가 동시 렌더링될 때
 * HTML 문서 전체에서 `<defs>` 내 ID가 고유해야 한다.
 * 동일 ID 사용 시 브라우저가 첫 번째 정의만 참조하여 마커 충돌 발생.
 */
export const NUMBERLINE_MARKER_ID = 'nl-arrowhead'
export const COORDPLANE_MARKER_ID = 'cp-arrowhead'
export const FUNCGRAPH_MARKER_ID = 'fg-arrowhead'
export const VECTOR_MARKER_ID = 'vec-arrowhead'
