import { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sigma-research.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/registro',
          '/login',
          '/recuperar',
          '/quienes-somos',
          '/faq',
          '/contacto',
          '/terminos',
          '/privacidad',
          '/recursos',
          '/reportes',
        ],
        disallow: [
          '/home',
          '/hud',
          '/portafolio',
          '/journal',
          '/fire',
          '/montecarlo',
          '/motor-decision',
          '/diagnosticador',
          '/calendario',
          '/ingresos-pasivos',
          '/mis-reportes',
          '/perfil',
          '/notificaciones',
          '/lp-defi',
          '/lp-signal',
          '/modelos',
          '/admin',
          '/api',
          '/onboarding',
          '/auth',
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  }
}
