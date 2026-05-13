import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "75mb",
    },
    middlewareClientMaxBodySize: "80mb",
  },
}

export default nextConfig
