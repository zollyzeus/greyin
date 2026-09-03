import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://deepedge.greyin.net'
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/dashboard', '/employer', '/profile', '/api'] },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
