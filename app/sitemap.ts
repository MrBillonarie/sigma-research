import { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://squantdesk.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const publicRoutes: MetadataRoute.Sitemap = [
    { url: BASE,                          lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE}/registro`,            lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/login`,               lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/planes`,              lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/quienes-somos`,       lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/roadmap`,             lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/white-paper`,         lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/api-docs`,            lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/faq`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/reportes`,            lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE}/contacto`,            lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/recursos`,            lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/terminos`,            lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/privacidad`,          lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ]

  return publicRoutes
}
