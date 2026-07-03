import { C, F, cardStyle, gradeColor } from '@/app/lib/constants'
import { computeNotional } from '@/app/lib/dedupePositions'
import type { Position } from '@/app/types/hud'

interface PositionsTableProps {
  positions: Position[]
  equity: number
}

const th: React.CSSProperties = {
  background: C.surface2,
  color: C.textDim,
  fontWeight: 600,
  letterSpacing: '0.05em',
  fontSize: 9,
  padding: '8px 6px',
  borderBottom: `1px solid ${C.border}`,
  textAlign: 'left',
  textTransform: 'uppercase',
}
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const thC: React.CSSProperties = { ...th, textAlign: 'center' }
const td: React.CSSProperties = {
  padding: '8px 6px',
  borderBottom: `1px solid ${C.border}`,
  fontFamily: F.mono,
  fontSize: 12,
}
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const tdC: React.CSSProperties = { ...td, textAlign: 'center' }

function stratShort(s: string): string {
  return (s || '')
    .replace('_short', '↓')
    .replace('momentum', 'MOM')
    .replace('breakdown', 'BRK')
    .replace('breakout', 'BRK↑')
    .replace('tma_bands', 'TMA')
    .replace('ichimoku', 'ICH')
    .replace('pullback', 'PB')
    .replace(/_/g, ' ')
    .substring(0, 16)
}

export default function PositionsTable({ positions, equity }: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <div style={{ ...cardStyle, background: C.surface, padding: 16, fontFamily: F.mono, fontSize: 12, color: C.muted, textAlign: 'center' }}>
        Sin posiciones abiertas
      </div>
    )
  }

  return (
    <div style={{ ...cardStyle, background: C.surface, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Dir</th>
              <th style={th}>Activo</th>
              <th style={th}>TF</th>
              <th style={th}>Estrategia</th>
              <th style={thC}>Grade</th>
              <th style={thR}>WR bt</th>
              <th style={thR}>CAGR bt</th>
              <th style={thR}>Entrada</th>
              <th style={thR}>SL</th>
              <th style={thR}>TP</th>
              <th style={thR}>RR</th>
              <th style={thR}>Posición $</th>
              <th style={thR}>P&L</th>
              <th style={th}>Hora</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p, i) => {
              const isLong = p.direction !== 'short'
              const dirColor = isLong ? C.green : C.red
              const isReal = p.mode === 'LIVE' && !!p.live_contracts
              const rn = p.sl && p.tp ? Math.abs(p.tp - p.entry) / Math.abs(p.entry - p.sl) : 0
              const rrColor = rn >= 2 ? C.green : rn >= 1.5 ? '#69f0ae' : C.amber
              const notional = computeNotional(p, equity)
              const pnl = p.pnl_pct ?? 0
              const pnlColor = pnl >= 0 ? C.green : C.red
              const horaTxt = (p.opened_at || '').substring(11, 16)

              return (
                <tr key={`${p.sym}::${p.tf}::${p.direction}::${p.strategy}::${i}`}
                    style={{ background: isLong ? `${C.green}0d` : `${C.red}0d` }}>
                  <td style={td}>
                    <span style={{ background: dirColor, color: '#000', padding: '2px 8px', borderRadius: 4, fontWeight: 'bold', fontSize: 11 }}>
                      {isLong ? 'L' : 'S'}
                    </span>
                  </td>
                  <td style={{ ...td, fontWeight: 700, color: C.text }}>{p.sym}</td>
                  <td style={{ ...td, color: C.textDim }}>{p.tf.toUpperCase()}</td>
                  <td style={{ ...td, color: C.textDim }}>{stratShort(p.strategy)}</td>
                  <td style={tdC}>
                    <span style={{ background: gradeColor(p.grade), color: '#000', padding: '1px 7px', borderRadius: 8, fontWeight: 'bold', fontSize: 11 }}>
                      {p.grade ?? '?'}
                    </span>
                  </td>
                  <td style={{ ...tdR, color: C.textDim }}>{p.wr != null ? `${p.wr.toFixed(0)}%` : '—'}</td>
                  <td style={{ ...tdR, color: (p.cagr ?? 0) > 0 ? C.green : C.red, fontWeight: 600 }}>
                    {p.cagr != null ? `${p.cagr >= 0 ? '+' : ''}${p.cagr.toFixed(1)}%` : '—'}
                  </td>
                  <td style={{ ...tdR, color: C.textDim }}>{p.entry}</td>
                  <td style={{ ...tdR, color: C.red }}>{p.sl}</td>
                  <td style={{ ...tdR, color: C.green }}>{p.tp}</td>
                  <td style={{ ...tdR, color: rrColor, fontWeight: 'bold' }}>{rn > 0 ? `${rn.toFixed(1)}:1` : '—'}</td>
                  <td style={{ ...tdR, color: isReal ? '#00bcd4' : C.amber, fontWeight: 600 }}>
                    {notional > 0 ? `$${Math.round(notional).toLocaleString()}` : '—'}
                    {isReal && <div style={{ fontSize: 9, color: '#00bcd4' }}>REAL</div>}
                  </td>
                  <td style={{ ...tdR, color: pnlColor, fontWeight: 'bold' }}>
                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                  </td>
                  <td style={{ ...td, color: C.muted, fontSize: 10 }}>{horaTxt}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
