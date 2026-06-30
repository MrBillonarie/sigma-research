import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Reportes',
  description:
    'Reportes de análisis cuantitativo de SQuant Desk: resumen de mercado, señales activas, régimen HMM y posicionamiento institucional.',
}

export default function ReportesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
