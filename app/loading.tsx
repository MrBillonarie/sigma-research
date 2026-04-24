export default function Loading() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        {/* Logo animado */}
        <div className="w-12 h-12 border border-gold flex items-center justify-center animate-glow-pulse">
          <span className="display-heading text-gold text-2xl leading-none">Σ</span>
        </div>

        {/* Barra de carga */}
        <div className="w-48 h-px bg-border relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1/2 bg-gold-gradient animate-[scan-line_1.5s_linear_infinite]" />
        </div>

        <p className="section-label text-text-dim animate-pulse-slow">CARGANDO</p>
      </div>
    </div>
  )
}
