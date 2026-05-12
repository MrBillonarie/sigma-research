import type { Metadata, Viewport } from 'next'
import { Bebas_Neue, DM_Mono } from 'next/font/google'
import './globals.css'
import ConditionalShell from './components/ConditionalShell'
import PwaRegister from './components/PwaRegister'

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
  display: 'swap',
})

const dmMono = DM_Mono({
  weight: ['300', '400', '500'],
  subsets: ['latin'],
  variable: '--font-dm-mono',
  display: 'swap',
})

export const viewport: Viewport = {
  themeColor: '#d4af37',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: {
    default: 'Sigma Research — Inteligencia Cuantitativa',
    template: '%s — Sigma Research',
  },
  description:
    'Herramientas cuantitativas de grado institucional para inversores independientes: calculadora FIRE, señales algorítmicas y análisis de mercado con ML.',
  keywords: ['quant finance', 'FIRE calculator', 'trading algorítmico', 'machine learning', 'análisis de mercado', 'inversión cuantitativa'],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://sigma-research.vercel.app'),
  openGraph: {
    title: 'Sigma Research — Inteligencia Cuantitativa',
    description: 'Herramientas cuantitativas de grado institucional para inversores independientes.',
    type: 'website',
    url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://sigma-research.vercel.app',
    siteName: 'Sigma Research',
    locale: 'es_ES',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Sigma Research — Inteligencia Cuantitativa',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sigma Research — Inteligencia Cuantitativa',
    description: 'Herramientas cuantitativas de grado institucional para inversores independientes.',
    images: ['/opengraph-image'],
  },
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/apple-icon.png',
  },
  robots: {
    index: true,
    follow: true,
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'Sigma',
    'application-name': 'Sigma Research',
    'msapplication-TileColor': '#04050a',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="dark">
      <body className={`${bebasNeue.variable} ${dmMono.variable} bg-bg text-text antialiased`}>
        <ConditionalShell>
          {children}
        </ConditionalShell>
        <PwaRegister />
      </body>
    </html>
  )
}
