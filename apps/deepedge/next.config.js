/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['api.greyin.net'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.greyin.net',
        pathname: '/storage/v1/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
    // pdf-parse (via its pdfjs-dist dependency) has runtime `require()`
    // calls that don't survive webpack bundling — Next was silently
    // webpack-bundling it into a chunk with the actual parsing code
    // missing, so `output: 'standalone'` never copied a real
    // node_modules/pdf-parse into the deployed image and every resume
    // upload in production failed with a generic "invalid PDF" error
    // regardless of the file. Marking it external makes Next leave it as
    // a plain runtime require() and trace+copy the real package instead.
    serverComponentsExternalPackages: ['pdf-parse'],
  },
}

module.exports = nextConfig
