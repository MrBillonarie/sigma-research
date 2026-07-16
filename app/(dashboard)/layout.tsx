import Sidebar from '../components/Sidebar'
import RightBar from '../components/RightBar'
import MobileBottomNav from '../components/MobileBottomNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#080a0f' }}>
      {/* Sidebar — oculto en móvil, visible en md+ */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Contenido principal — padding bottom en móvil para el bottom nav */}
      <main className="flex-1 overflow-y-auto pb-14 md:pb-0">{children}</main>

      {/* RightBar — solo en pantallas grandes */}
      <div className="hidden xl:block">
        <RightBar />
      </div>

      {/* Bottom nav — solo en móvil */}
      <div className="block md:hidden">
        <MobileBottomNav />
      </div>
    </div>
  )
}
