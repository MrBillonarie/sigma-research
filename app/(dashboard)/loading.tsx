// El dashboard es oscuro (no sigue la paleta clara del sitio público).
// Colores en línea para que este skeleton no herede los tokens claros.
export default function DashboardLoading() {
  return (
    <div style={{ minHeight: '100vh', background: '#04050a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <div className="animate-glow-pulse" style={{ width: 48, height: 48, border: '1px solid #d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", color: '#d4af37', fontSize: 24, lineHeight: 1 }}>Σ</span>
        </div>
        <div style={{ width: 192, height: 1, background: '#1a1d2e', position: 'relative', overflow: 'hidden' }}>
          <div className="animate-[scan-line_1.5s_linear_infinite]" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '50%', background: 'linear-gradient(90deg, #d4af37, #f0cc5a)' }} />
        </div>
        <p className="animate-pulse-slow" style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#7a7f9a' }}>CARGANDO</p>
      </div>
    </div>
  )
}
