import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contacto',
  description:
    'Hablá con el equipo de SQuant Desk — soporte técnico, demos personalizadas, acceso al plan Institutional e integraciones API.',
}

export default function ContactoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
