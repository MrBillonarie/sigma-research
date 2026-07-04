import type { MatrixCellData, ModelStats, CombinedEstimate } from '@/app/types/hud'

// Valores 1:1 de dashboard.py: c_cagr()/_score_grade() (umbrales de color),
// cell_html()/_row_model()/_combined_row() (estructura de celda), asset-box
// y el reskin Black&Gold que ya se aplicaba sobre el scrape.
const MONO = "'IBM Plex Mono', monospace"
const CARD_BG = '#0b0d14'
const CARD_BORDER = '#1a1d2e'
const GOLD = '#d4af37'

const ASSET_COLOR: Record<string, string> = {
  BTC: '#f7931a', ETH: '#627eea', LTC: '#345d9d', SOL: '#9945ff', BNB: '#f3ba2f',
  XAU: '#FFD700', XAG: '#C0C0C0', WTI: '#4a90d9', HG: '#B87333', NG: '#e67e22', PL: '#7ec8e3',
  AAPL: '#3fb950', NVDA: '#76b900', TSLA: '#cc0000', JPM: '#117cbf', XOM: '#e8a100',
}

function cCagr(v: number | undefined | null): string {
  if (v == null) return '#7a8db5'
  if (v >= 20) return '#2ecc71'
  if (v >= 10) return '#f1c40f'
  if (v > 0) return '#e67e22'
  return '#e74c3c'
}

function scoreGrade(score: number | undefined | null): { color: string; label: string } | null {
  if (score == null || score < 0) return null
  if (score >= 0.70) return { color: '#00c853', label: 'A+' }
  if (score >= 0.55) return { color: '#69f0ae', label: 'A' }
  if (score >= 0.40) return { color: '#ffeb3b', label: 'B' }
  if (score >= 0.25) return { color: '#ff9800', label: 'C' }
  return { color: '#f44336', label: 'D' }
}

const TF_ORDER = ['15m', '1h', '4h', '1d', 'countertrend']
function sortTfs(tfs: string[]): string[] {
  return [...tfs].sort((a, b) => {
    const ia = TF_ORDER.indexOf(a); const ib = TF_ORDER.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

function DirRow({ m, direction }: { m: ModelStats | undefined | null; direction: 'long' | 'short' }) {
  const arrow = direction === 'long' ? '▲' : '▼'
  const col = direction === 'long' ? '#2ecc71' : '#e74c3c'
  if (!m) {
    return (
      <div style={{ color: '#242f55', fontSize: 9, padding: '2px 0' }}>
        {arrow} <span style={{ color: '#242f55' }}>pendiente</span>
      </div>
    )
  }
  const badge = scoreGrade(m.score)
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0 1px' }}>
        <span style={{ color: col, fontSize: 9 }}>{arrow} {(m.strategy ?? '').slice(0, 10)}</span>
        <span style={{ fontFamily: MONO, color: cCagr(m.cagr), fontWeight: 700, fontSize: 11 }}>
          {m.cagr != null ? `${m.cagr >= 0 ? '+' : ''}${m.cagr.toFixed(1)}%` : '-'}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, paddingBottom: 1 }}>
        <span>
          {badge && (
            <span style={{ background: badge.color, color: '#000', padding: '1px 5px', borderRadius: 3, fontSize: 10, fontWeight: 'bold' }}>
              {badge.label}
            </span>
          )}
        </span>
        <span style={{ color: '#7a8db5' }}>{m.wr != null ? `WR ${m.wr.toFixed(0)}%` : ''} {m.trades ?? ''}T</span>
      </div>
    </>
  )
}

function CombinedRow({ combined }: { combined: CombinedEstimate | undefined | null }) {
  if (!combined) return null
  const isAdaptive = combined.source === 'adaptive'
  return (
    <>
      <div style={{ borderTop: '1px solid #141b38', margin: '2px 0' }} />
      <div style={{
        background: isAdaptive ? 'rgba(88,166,255,.08)' : 'rgba(88,166,255,.05)',
        borderRadius: 3, padding: '2px 3px', marginTop: 1,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: GOLD, fontSize: 9, fontWeight: isAdaptive ? 700 : 400 }}>
            {isAdaptive ? '◆ ADAPTIVE' : '◆ COMBINED ~'}
          </span>
          <span style={{ fontFamily: MONO, color: cCagr(combined.cagr), fontWeight: 700, fontSize: 11 }}>
            {combined.cagr != null ? `${combined.cagr >= 0 ? '+' : ''}${combined.cagr.toFixed(1)}%` : '-'}
          </span>
        </div>
        {isAdaptive
          ? <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
              <span style={{ color: '#7a8db5' }}>{combined.wr != null ? `WR ${combined.wr.toFixed(0)}%` : ''} {combined.trades ?? ''}T</span>
            </div>
          : <div style={{ fontSize: 9, color: '#555' }}>estimado (40% bull + 35% bear)</div>
        }
      </div>
    </>
  )
}

function Cell({ cell }: { cell: MatrixCellData | undefined }) {
  if (!cell || (!cell.long && !cell.short && !cell.combined)) {
    return <td style={{ background: 'rgba(36,47,85,.15)', textAlign: 'center', color: '#242f55', padding: '8px 6px' }}>…</td>
  }
  return (
    <td style={{ background: 'rgba(88,166,255,.015)', padding: '4px 6px', verticalAlign: 'top', minWidth: 110 }}>
      <DirRow m={cell.long} direction="long" />
      <div style={{ borderTop: '1px solid #141b38', margin: '2px 0' }} />
      <DirRow m={cell.short} direction="short" />
      <CombinedRow combined={cell.combined} />
    </td>
  )
}

interface MotorMatrixProps {
  label: string
  assets: string[]
  cells: MatrixCellData[]
}

export default function MotorMatrix({ label, assets, cells }: MotorMatrixProps) {
  const relevant = cells.filter(c => c.sym && assets.includes(c.sym))
  const tfs = sortTfs(Array.from(new Set(relevant.map(c => c.tf).filter((tf): tf is string => !!tf))))
  const bySlot = new Map<string, MatrixCellData>()
  for (const c of relevant) if (c.sym && c.tf) bySlot.set(`${c.sym}::${c.tf}`, c)

  if (tfs.length === 0) return null

  // Ponderado por columna -- APROXIMADO: promedio simple entre todos los
  // modelos long/short con datos en esa columna, ponderado por trades. NO
  // reproduce el filtro por robustness (BLOCKED excluido) ni el tie-break
  // long-vs-short que usa dashboard.py para su "Ponderado" real -- esa
  // logica vive junto a la seleccion de campeon/portfolio, que se decidio
  // no tocar. Es una cifra de referencia, no la oficial del motor.
  const weighted = tfs.map(tf => {
    const vals = assets
      .map(sym => bySlot.get(`${sym}::${tf}`))
      .flatMap(c => {
        const out: { cagr: number; wr: number; trades: number }[] = []
        if (c?.long) out.push({ cagr: c.long.cagr ?? 0, wr: c.long.wr ?? 0, trades: c.long.trades ?? 0 })
        if (c?.short) out.push({ cagr: c.short.cagr ?? 0, wr: c.short.wr ?? 0, trades: c.short.trades ?? 0 })
        return out
      })
    if (vals.length === 0) return null
    const totalT = vals.reduce((s, v) => s + v.trades, 0)
    const avgCagr = vals.reduce((s, v) => s + v.cagr, 0) / vals.length
    const wWr = totalT > 0 ? vals.reduce((s, v) => s + v.wr * v.trades, 0) / totalT : 0
    return { cagr: avgCagr, wr: wWr, trades: totalT, n: vals.length }
  })
  const allVals = weighted.filter((w): w is NonNullable<typeof w> => w != null)
  const totalTrades = allVals.reduce((s, w) => s + w.trades, 0)
  const totalSlots = allVals.reduce((s, w) => s + w.n, 0)
  const portCagr = allVals.length > 0 ? allVals.reduce((s, w) => s + w.cagr * w.n, 0) / totalSlots : 0
  const portWr = totalTrades > 0 ? allVals.reduce((s, w) => s + w.wr * w.trades, 0) / totalTrades : 0

  return (
    <div style={{
      position: 'relative', background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
      borderRadius: 10, overflow: 'hidden', marginBottom: 20, boxShadow: '0 8px 22px rgba(0,0,0,0.35)',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, rgba(212,175,55,0.75), transparent 70%)',
      }} />
      <div style={{
        padding: '10px 14px', fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 18,
        letterSpacing: '.18em', color: GOLD, textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: '4px 5px', textAlign: 'left', color: '#444', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '2px solid #1a2240', fontFamily: MONO }}>Activo</th>
              {tfs.map(tf => (
                <th key={tf} style={{ padding: '4px 5px', textAlign: 'center', color: '#444', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '2px solid #1a2240', fontFamily: MONO }}>
                  {tf.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assets.map(sym => (
              <tr key={sym}>
                <td style={{ padding: '5px 6px', borderBottom: '1px solid #161622' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: ASSET_COLOR[sym] ?? GOLD, fontWeight: 'bold', fontSize: 12 }}>●</span>
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 12, color: '#c9d1d9' }}>{sym}</span>
                  </div>
                </td>
                {tfs.map(tf => <Cell key={tf} cell={bySlot.get(`${sym}::${tf}`)} />)}
              </tr>
            ))}
            <tr>
              <td style={{ borderTop: '2px solid #242f55', padding: '7px 8px' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#7a8db5', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Ponderado ~
                </span>
              </td>
              {weighted.map((w, i) => (
                <td key={i} style={{ textAlign: 'center', borderTop: '2px solid #242f55', padding: '7px 4px' }}>
                  {w ? (
                    <>
                      <div style={{ color: cCagr(w.cagr), fontFamily: MONO, fontSize: 12, fontWeight: 700 }}>
                        {w.cagr >= 0 ? '+' : ''}{w.cagr.toFixed(1)}%
                      </div>
                      <div style={{ fontSize: 10, color: '#2ecc71' }}>WR {w.wr.toFixed(0)}%</div>
                      <div style={{ fontSize: 10, color: '#7a8db5' }}>{w.trades}T</div>
                    </>
                  ) : <span style={{ color: '#242f55' }}>—</span>}
                </td>
              ))}
            </tr>
            <tr>
              <td colSpan={tfs.length + 1} style={{ padding: '8px 10px', borderTop: '1px solid #141b38', fontSize: 11, color: '#7a8db5' }}>
                Portafolio (aprox., todos los slots con dato): <b style={{ fontFamily: MONO, color: cCagr(portCagr), fontWeight: 700, fontSize: 13 }}>
                  {portCagr >= 0 ? '+' : ''}{portCagr.toFixed(1)}%
                </b>
                {' '}·{' '} WR <b style={{ fontFamily: MONO, color: '#2ecc71', fontWeight: 700, fontSize: 12 }}>{portWr.toFixed(0)}%</b>
                {' '}·{' '} Trades <b style={{ fontFamily: MONO, color: '#dde3f5', fontSize: 12 }}>{totalTrades}</b>
                {' '}·{' '} Slots <b style={{ fontFamily: MONO, color: GOLD, fontSize: 12 }}>{totalSlots}</b>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
