import Sidebar from '../components/Sidebar'
import RightBar from '../components/RightBar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#04050a' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <RightBar />
    </div>
  )
}
