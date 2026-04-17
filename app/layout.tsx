import type { Metadata } from 'next'
import { Bebas_Neue, DM_Mono } from 'next/font/google'
import './globals.css'

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
  title: 'SIGMA Research — Quantitative Intelligence',
  description: 'Institutional-grade quantitative research tools. FIRE calculator, algorithmic signals, and ML-powered market analysis.',
  keywords: ['quant finance', 'FIRE calculator', 'algorithmic trading', 'machine learning', 'market research'],
  openGraph: {
    title: 'SIGMA Research — Quantitative Intelligence',
    description: 'Institutional-grade quantitative research tools.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${bebasNeue.variable} ${dmMono.variable} bg-bg text-text antialiased`}>
        {children}
      </body>
    </html>
  )
}
