import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb', // 다중 이미지 업로드 (최대 20장 x 5MB = 100MB)
    },
  },
}

export default nextConfig
