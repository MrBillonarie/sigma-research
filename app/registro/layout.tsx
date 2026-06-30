import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Registro',
  description:
    'Creá tu cuenta en SQuant Desk y accedé a señales algorítmicas, dashboards en vivo y herramientas cuantitativas de grado institucional.',
}

export default function RegistroLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
