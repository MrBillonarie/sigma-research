import { computeNotional } from '@/app/lib/dedupePositions'
import type { Position } from '@/app/types/hud'

// Valores 1:1 de dashboard.py (const TD/TH/TDR/THR de la tabla de posiciones,
// dirC/gradeC de _row_model) -- mismo diseno que el scrape, sin reinterpretar.
const MONO = "'IBM Plex Mono', monospace"
const CARD_BG = '#0b0d14'
const CARD_BORDER = '#1a1d2e'

const th: React.CSSProperties = {
  padding: '4px 5px', textAlign: 'left', color: '#444', fontSize: 9,
  textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '2px solid #1a2240',
  fontWeight: 500, whiteSpace: 'nowrap', fontFamily: MONO,
}
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const thC: React.CSSProperties = { ...th, textAlign: 'center' }
const td: React.CSSProperties = {
  padding: '5px 6px', borderBottom: '1px solid #161622', whiteSpace: 'nowrap',
  fontSize: 11, fontFamily: MONO,
}
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const tdC: React.CSSProperties = { ...td, textAlign: 'center' }

function gradeColor(g?: string): string {
  if (g === 'A+') return '#00c853'
  if (g === 'A') return '#69f0ae'
  if (g === 'B') return '#ffeb3b'
  if (g === 'C') return '#ff9800'
  return '#f85149'
}

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
    .substring(0, 12)
}

interface PositionsTableProps {
  positions: Position[]
  equity: number
}

export default function PositionsTable({ positions, equity }: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <div style={{
        position: 'relative', background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
        borderRadius: 10, padding: 16, fontFamily: MONO, fontSize: 12, color: '#555',
        textAlign: 'center', overflow: 'hidden',
      }}>
        Sin posiciones abiertas
      </div>
    )
  }

  return (
    <div style={{
      position: 'relative', background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
      borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 22px rgba(0,0,0,0.35)',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, rgba(57,226,230,0.75), transparent 70%)',
      }} />
      <div style={{
        padding: '10px 14px', fontFamily: MONO, fontSize: 10, color: '#555',
        textTransform: 'uppercase', letterSpacing: '.8px',
      }}>
        Posiciones abiertas
      </div>
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
              <th style={thR}>P&L live</th>
              <th style={th}>Hora</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p, i) => {
              const isLong = p.direction !== 'short'
              const dirC = isLong ? '#00e676' : '#f85149'
              const isReal = p.mode === 'LIVE' && !!p.live_contracts
              const rn = p.sl && p.tp ? Math.abs(p.tp - p.entry) / Math.abs(p.entry - p.sl) : 0
              const rrC = rn >= 2 ? '#00c853' : rn >= 1.5 ? '#69f0ae' : '#ff9800'
              const notional = computeNotional(p, equity)
              const pnl = p.pnl_pct ?? 0
              const pnlCol = pnl >= 0 ? '#00e676' : '#f44336'
              const horaTxt = (p.opened_at || '').substring(11, 16)
              const rStyle: React.CSSProperties = {
                background: `rgba(${isLong ? '0,230,118' : '248,81,73'},0.05)`,
                borderLeft: `3px solid ${dirC}`,
              }

              return (
                <tr key={`${p.sym}::${p.tf}::${p.direction}::${p.strategy}::${i}`} style={rStyle}>
                  <td style={td}>
                    <span style={{ background: dirC, color: '#000', padding: '2px 8px', borderRadius: 4, fontWeight: 'bold', fontSize: 11 }}>
                      {isLong ? 'L' : 'S'}
                    </span>
                  </td>
                  <td style={{ ...td, color: '#c9d1d9', fontWeight: 700 }}>{p.sym}</td>
                  <td style={{ ...td, color: '#6a737d' }}>{p.tf.toUpperCase()}</td>
                  <td style={{ ...td, color: '#8b949e' }}>{stratShort(p.strategy)}</td>
                  <td style={tdC}>
                    <span style={{ background: gradeColor(p.grade), color: '#000', padding: '1px 7px', borderRadius: 8, fontWeight: 'bold', fontSize: 11 }}>
                      {p.grade ?? '?'}
                    </span>
                  </td>
                  <td style={{ ...tdR, color: '#8b949e' }}>{p.wr != null ? `${p.wr.toFixed(0)}%` : '-'}</td>
                  <td style={{ ...tdR, color: (p.cagr ?? 0) > 0 ? '#00e676' : '#f85149', fontWeight: 600 }}>
                    {p.cagr != null ? `${p.cagr >= 0 ? '+' : ''}${p.cagr.toFixed(1)}%` : '-'}
                  </td>
                  <td style={{ ...tdR, color: '#8b949e' }}>{p.entry}</td>
                  <td style={{ ...tdR, color: '#f85149' }}>{p.sl}</td>
                  <td style={{ ...tdR, color: '#00e676' }}>{p.tp}</td>
                  <td style={{ ...tdR, color: rrC, fontWeight: 'bold' }}>{rn > 0 ? `${rn.toFixed(1)}:1` : '-'}</td>
                  <td style={{ ...tdR, color: isReal ? '#00bcd4' : '#e0bb3a', fontWeight: 600 }}>
                    {notional > 0 ? `$${Math.round(notional).toLocaleString()}` : '-'}
                    {isReal && <><br /><span style={{ fontSize: 9, color: '#00bcd4' }}>REAL</span></>}
                  </td>
                  <td style={{ ...tdR, color: pnlCol, fontWeight: 'bold', fontSize: 13 }}>
                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                  </td>
                  <td style={{ ...td, color: '#444', fontSize: 10 }}>{horaTxt}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
