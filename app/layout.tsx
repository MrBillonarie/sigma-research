import type { Metadata } from 'next'
import { Bebas_Neue, DM_Mono } from 'next/font/google'
import './globals.css'
import ConditionalShell from './components/ConditionalShell'

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

export const metadata: Metadata = {
  title: {
    default: 'Sigma Research — Inteligencia Cuantitativa',
    template: '%s — Sigma Research',
  },
  description:
    'Herramientas cuantitativas de grado institucional para inversores independientes: calculadora FIRE, señales algorítmicas y análisis de mercado con ML.',
  keywords: ['quant finance', 'FIRE calculator', 'trading algorítmico', 'machine learning', 'análisis de mercado', 'inversión cuantitativa'],
  metadataBase: new URL('https://sigma-research.io'),
  openGraph: {
    title: 'Sigma Research — Inteligencia Cuantitativa',
    description: 'Herramientas cuantitativas de grado institucional para inversores independientes.',
    type: 'website',
    url: 'https://sigma-research.io',
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
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  robots: {
    index: true,
    follow: true,
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
      </body>
    </html>
  )
}
