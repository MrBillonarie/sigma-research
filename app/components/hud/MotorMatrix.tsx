import { C, F, cardStyle } from '@/app/lib/constants'
import type { MatrixCellData, ModelStats, CombinedEstimate } from '@/app/types/hud'

interface MotorMatrixProps {
  label: string
  assets: string[]
  cells: MatrixCellData[]
}

const TF_ORDER = ['15m', '1h', '4h', '1d', 'countertrend']

function sortTfs(tfs: string[]): string[] {
  return [...tfs].sort((a, b) => {
    const ia = TF_ORDER.indexOf(a)
    const ib = TF_ORDER.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

function cagrColor(cagr: number | undefined | null): string {
  if (cagr == null) return C.textDim
  return cagr >= 0 ? C.green : C.red
}

function DirRow({ m, direction }: { m: ModelStats | undefined | null; direction: 'long' | 'short' }) {
  const arrow = direction === 'long' ? '▲' : '▼'
  const col = direction === 'long' ? C.green : C.red
  if (!m) {
    return (
      <div style={{ display: 'flex', gap: 4, fontSize: 9, color: C.muted, padding: '1px 0' }}>
        <span style={{ color: col, opacity: 0.5 }}>{arrow}</span>
        <span>pendiente</span>
      </div>
    )
  }
  return (
    <div style={{ padding: '1px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: col, fontSize: 9 }}>{arrow} {(m.strategy ?? '').slice(0, 10)}</span>
        <span style={{ fontFamily: F.mono, color: cagrColor(m.cagr), fontWeight: 700, fontSize: 11 }}>
          {m.cagr != null ? `${m.cagr >= 0 ? '+' : ''}${m.cagr.toFixed(1)}%` : '—'}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 9, color: C.textDim }}>
        {m.wr != null ? `WR ${m.wr.toFixed(0)}% ${m.trades ?? 0}T` : ''}
      </div>
    </div>
  )
}

function CombinedRow({ combined }: { combined: CombinedEstimate | undefined | null }) {
  if (!combined) return null
  const label = combined.source === 'adaptive' ? '◆ ADAPTIVE' : '◆ COMBINADO ~'
  return (
    <>
      <div style={{ borderTop: `1px solid ${C.border}`, margin: '2px 0' }} />
      <div style={{ background: `${C.gold}0d`, borderRadius: 3, padding: '2px 3px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: C.gold, fontSize: 9, fontWeight: combined.source === 'adaptive' ? 700 : 400 }}>{label}</span>
          <span style={{ fontFamily: F.mono, color: cagrColor(combined.cagr), fontWeight: 700, fontSize: 11 }}>
            {combined.cagr != null ? `${combined.cagr >= 0 ? '+' : ''}${combined.cagr.toFixed(1)}%` : '—'}
          </span>
        </div>
        {combined.source === 'estimate' && (
          <div style={{ fontSize: 9, color: C.muted }}>estimado (40% bull + 35% bear)</div>
        )}
        {combined.source === 'adaptive' && combined.wr != null && (
          <div style={{ textAlign: 'right', fontSize: 9, color: C.textDim }}>WR {combined.wr.toFixed(0)}% {combined.trades ?? 0}T</div>
        )}
      </div>
    </>
  )
}

function Cell({ cell }: { cell: MatrixCellData | undefined }) {
  if (!cell || (!cell.long && !cell.short && !cell.combined)) {
    return (
      <div style={{ padding: '8px 6px', textAlign: 'center', color: C.muted, fontFamily: F.mono, fontSize: 10 }}>
        —
      </div>
    )
  }
  return (
    <div style={{ padding: '5px 7px', minWidth: 110 }}>
      <DirRow m={cell.long} direction="long" />
      <div style={{ borderTop: `1px solid ${C.border}`, margin: '2px 0' }} />
      <DirRow m={cell.short} direction="short" />
      <CombinedRow combined={cell.combined} />
    </div>
  )
}

export default function MotorMatrix({ label, assets, cells }: MotorMatrixProps) {
  const relevant = cells.filter(c => c.sym && assets.includes(c.sym))
  const tfs = sortTfs(Array.from(new Set(relevant.map(c => c.tf).filter((tf): tf is string => !!tf))))

  const bySlot = new Map<string, MatrixCellData>()
  for (const c of relevant) {
    if (c.sym && c.tf) bySlot.set(`${c.sym}::${c.tf}`, c)
  }

  if (tfs.length === 0) {
    return null
  }

  return (
    <div style={{ ...cardStyle, background: C.surface, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{
        padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
        fontFamily: F.display, fontSize: 15, letterSpacing: '0.1em', color: C.gold, textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{
                background: C.surface2, color: C.textDim, fontSize: 9, letterSpacing: '0.05em',
                padding: '8px 10px', borderBottom: `1px solid ${C.border}`, textAlign: 'left', textTransform: 'uppercase',
              }}>
                Activo
              </th>
              {tfs.map(tf => (
                <th key={tf} style={{
                  background: C.surface2, color: C.textDim, fontSize: 9, letterSpacing: '0.05em',
                  padding: '8px 6px', borderBottom: `1px solid ${C.border}`, textAlign: 'center', textTransform: 'uppercase',
                }}>
                  {tf}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assets.map(sym => (
              <tr key={sym}>
                <td style={{
                  padding: '8px 10px', borderBottom: `1px solid ${C.border}`,
                  fontFamily: F.mono, fontSize: 12, fontWeight: 700, color: C.text,
                }}>
                  {sym}
                </td>
                {tfs.map(tf => (
                  <td key={tf} style={{ borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}`, verticalAlign: 'top' }}>
                    <Cell cell={bySlot.get(`${sym}::${tf}`)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
