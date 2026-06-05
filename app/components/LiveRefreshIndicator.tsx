'use client'

interface Props {
  loading: boolean
  nextRefreshMs: number
  intervalMs: number
  onRefresh: () => void
}

const MONO = 'var(--font-dm-mono, monospace)'

export default function LiveRefreshIndicator({ loading, nextRefreshMs, intervalMs, onRefresh }: Props) {
  const pct     = intervalMs > 0 ? Math.max(0, Math.min(100, (1 - nextRefreshMs / intervalMs) * 100)) : 0
  const minLeft = Math.ceil(nextRefreshMs / 60_000)
  const secLeft = Math.ceil(nextRefreshMs / 1_000)
  const label   = nextRefreshMs > 60_000
    ? `${minLeft}m`
    : `${secLeft}s`

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 28 }}>
      {/* Barra de progreso */}
      <div style={{
        position: 'relative',
        width: 80,
        height: 3,
        background: '#1a1d2e',
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: `${pct}%`,
          background: loading ? '#d4af37' : '#1D9E75',
          borderRadius: 2,
          transition: 'width 1s linear',
        }} />
      </div>

      {/* Estado */}
      {loading ? (
        <span style={{ fontFamily: MONO, fontSize: 10, color: '#d4af37', letterSpacing: '0.05em' }}>
          Actualizando...
        </span>
      ) : nextRefreshMs > 0 ? (
        <span style={{ fontFamily: MONO, fontSize: 10, color: '#7a7f9a', letterSpacing: '0.05em' }}>
          en {label}
        </span>
      ) : null}

      {/* Botón refresh manual */}
      {!loading && (
        <button
          onClick={onRefresh}
          title="Actualizar ahora"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#7a7f9a',
            fontSize: 12,
            padding: '2px 4px',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          ↻
        </button>
      )}
    </div>
  )
}
