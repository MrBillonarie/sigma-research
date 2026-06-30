import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Preguntas Frecuentes',
  description:
    'Preguntas frecuentes sobre SQuant Desk: el SIGMA ENGINE, backtesting, paper trading, planes y cómo funciona la plataforma.',
}

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
