import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Login',
  description:
    'Iniciá sesión en tu cuenta de SQuant Desk para acceder a tu dashboard, señales en vivo y herramientas de análisis cuantitativo.',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
