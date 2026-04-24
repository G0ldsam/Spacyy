const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  customWorkerDir: 'worker',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    domains: [],
  },
  transpilePackages: [],
  // Transpile the shared folder
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    }
    return config
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self)',
          },
        ],
      },
    ]
  },
}

module.exports = withPWA(nextConfig)
