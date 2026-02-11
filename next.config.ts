import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb', // 기출문제 이미지/PDF 업로드 (최대 5MB + 메타데이터)
    },
  },
}

export default nextConfig
