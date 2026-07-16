import { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://squantdesk.com'

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
          '/planes',
          '/quienes-somos',
          '/roadmap',
          '/white-paper',
          '/api-docs',
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
          '/modelos',
          '/terminal',
          '/soporte',
          '/comparador',
          '/tax',
          '/lp-signal',
          '/motor-en-vivo',
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
