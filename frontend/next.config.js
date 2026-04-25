const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  customWorkerDir: 'worker',
  // Exclude Next.js internal manifests — they are not publicly accessible
  // so Workbox would get 404 trying to precache them, aborting SW install.
  buildExcludes: [
    /app-build-manifest\.json$/,
    /middleware-manifest\.json$/,
    /middleware-build-manifest\.js$/,
    /react-loadable-manifest\.json$/,
    /server\//,
  ],
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
