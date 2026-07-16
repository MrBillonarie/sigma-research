import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SQuant Desk',
    short_name: 'SQuant',
    description: 'Infraestructura cuantitativa institucional para inversores independientes en LATAM',
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#080a0f',
    theme_color: '#39e2e6',
    lang: 'es',
    categories: ['finance', 'productivity'],
    icons: [
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/icon.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/api/icon/192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/api/icon/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'HUD — Señales',
        short_name: 'HUD',
        description: 'Ver señales del Motor en vivo',
        url: '/hud',
        icons: [{ src: '/api/icon/192', sizes: '192x192' }],
      },
      {
        name: 'Journal',
        short_name: 'Journal',
        description: 'Registrar trades',
        url: '/journal',
        icons: [{ src: '/api/icon/192', sizes: '192x192' }],
      },
      {
        name: 'FIRE',
        short_name: 'FIRE',
        description: 'Calculadora de independencia financiera',
        url: '/fire',
        icons: [{ src: '/api/icon/192', sizes: '192x192' }],
      },
    ],
  }
}
