'use client'
import { usePathname } from 'next/navigation'
import Navbar from './Navbar'
import Footer from './Footer'

const DASHBOARD_ROUTES = [
  '/home', '/hud', '/journal', '/calendario',
  '/montecarlo', '/fire', '/modelos', '/mis-reportes',
  '/lp-defi', '/perfil', '/diagnosticador',
  '/ingresos-pasivos', '/portafolio', '/notificaciones',
  '/motor-decision', '/reportes', '/soporte',
  '/onboarding', '/auth',
  '/motor-en-vivo',
]

export default function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin     = pathname.startsWith('/admin')
  const isDashboard = DASHBOARD_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))

  const showShell = !isAdmin && !isDashboard

  return (
    <>
      {showShell && <Navbar />}
      {children}
      {showShell && <Footer dark />}
    </>
  )
}
