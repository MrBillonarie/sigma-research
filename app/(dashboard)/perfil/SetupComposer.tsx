'use client'
import { useEffect } from 'react'

// ─── Compositor de setups ────────────────────────────────────────────────────
// Antes se publicaba a ciegas: una pila de campos sin saber cómo se vería en la
// barra lateral. Ahora el formulario va agrupado y al lado se dibuja una réplica
// del componente real de RightBar, en vivo.
//
// El R:R deja de escribirse a mano: se calcula desde Entry/SL/TP y se sincroniza
// hacia arriba, así el valor que se publica nunca contradice a los niveles.

export type SetupTipo = 'LONG' | 'SHORT' | 'LP'

export interface SetupForm {
  par: string; tipo: SetupTipo; entry: string; sl: string; tp: string
  rangeLow: string; rangeHigh: string; feeTier: string; protocol: string
  rr: string; timeframe: string; metodologia: string; nota: string
}

interface Props {
  form: SetupForm
  onPatch: (patch: Partial<SetupForm>) => void
  onSubmit: (e: React.FormEvent) => void
  publishing: boolean
  error?: string
  msg?: string
  username: string
  reputation: number
  tfOptions: string[]
}

const GOLD = '#39e2e6', GREEN = '#2fd39a', RED = '#f87171', AMBER = '#ffb454', BLUE = '#4f92ff'
const MONO = "var(--font-dm-mono,'DM Mono',monospace)"
const TIPO_COLOR: Record<SetupTipo, string> = { LONG: GREEN, SHORT: RED, LP: BLUE }

// Mismo criterio de distintivo que usa RightBar al listar setups.
function repBadge(rep: number) {
  if (rep >= 50) return { sym: '★', color: AMBER }
  if (rep >= 20) return { sym: '◆', color: GREEN }
  return { sym: '·', color: GOLD }
}

/** Devuelve el R:R calculado y los problemas de coherencia del setup. */
export function analyzeLevels(tipo: SetupTipo, entry: string, sl: string, tp: string) {
  if (tipo === 'LP') return { rr: '', issues: [] as string[], complete: false }
  const e = parseFloat(entry), s = parseFloat(sl), t = parseFloat(tp)
  const complete = [e, s, t].every(Number.isFinite)
  if (!complete) return { rr: '', issues: [] as string[], complete: false }

  const issues: string[] = []
  if (tipo === 'LONG') {
    if (t <= e) issues.push('En un LONG el TP debe estar por encima de la entrada.')
    if (s >= e) issues.push('En un LONG el SL debe estar por debajo de la entrada.')
  } else {
    if (t >= e) issues.push('En un SHORT el TP debe estar por debajo de la entrada.')
    if (s <= e) issues.push('En un SHORT el SL debe estar por encima de la entrada.')
  }
  const risk = Math.abs(e - s), reward = Math.abs(t - e)
  const rr = risk > 0 ? (reward / risk).toFixed(2) : ''
  return { rr, issues, complete: true }
}

export default function SetupComposer({ form, onPatch, onSubmit, publishing, error, msg, username, reputation, tfOptions }: Props) {
  const isLP = form.tipo === 'LP'
  const { rr, issues, complete } = analyzeLevels(form.tipo, form.entry, form.sl, form.tp)
  const badge = repBadge(reputation)
  const tipoColor = TIPO_COLOR[form.tipo]

  // El R:R calculado viaja al form del padre para que se publique ese valor.
  useEffect(() => {
    if (rr !== form.rr) onPatch({ rr })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rr])

  const set = (k: keyof SetupForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onPatch({ [k]: e.target.value } as Partial<SetupForm>)

  const levelsState = !complete ? { t: 'INCOMPLETO', c: 'rgba(255,255,255,.38)' }
    : issues.length ? { t: 'REVISAR', c: AMBER }
    : { t: 'COHERENTE', c: GREEN }

  return (
    <div className="sc-wrap">
      <style>{`
        .sc-wrap{display:grid;grid-template-columns:1fr 210px;gap:16px}
        @media(max-width:900px){.sc-wrap{grid-template-columns:1fr}}
        .sc-glass{position:relative;border-radius:12px;overflow:hidden;
          background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.022));
          backdrop-filter:blur(26px) brightness(.94);-webkit-backdrop-filter:blur(26px) brightness(.94);
          box-shadow:inset 0 1.5px 0 rgba(255,255,255,.30),inset 0 -2px 3px rgba(0,0,0,.5),
            0 3px 0 -1px rgba(255,255,255,.045),0 5px 0 -1px rgba(0,0,0,.55),0 14px 28px -14px rgba(0,0,0,.9)}
        .sc-glass::after{content:'';position:absolute;inset:0;pointer-events:none;opacity:.4;
          background-image:radial-gradient(rgba(255,255,255,.07) .5px,transparent .5px);background-size:3px 3px}
        .sc-glass > *{position:relative;z-index:2}
        .sc-head{display:flex;align-items:center;gap:9px;padding:10px 15px;
          border-bottom:1px solid rgba(255,255,255,.08);
          background:linear-gradient(180deg,rgba(255,255,255,.05),transparent)}
        .sc-ht{font-family:${MONO};font-size:8.5px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.38)}
        .sc-hs{margin-left:auto;font-family:${MONO};font-size:8.5px;letter-spacing:.1em}
        .sc-sec{padding:14px 15px;border-bottom:1px solid rgba(255,255,255,.06)}
        .sc-sec:last-child{border-bottom:none}
        .sc-st{font-family:${MONO};font-size:8px;letter-spacing:.2em;text-transform:uppercase;
          color:rgba(255,255,255,.38);margin-bottom:10px;display:flex;align-items:center;gap:8px}
        .sc-st::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.07)}
        .sc-grid{display:grid;gap:10px}
        .sc-c2{grid-template-columns:1fr 1fr}
        .sc-c3{grid-template-columns:1fr 1fr 1fr}
        @media(max-width:620px){.sc-c2,.sc-c3{grid-template-columns:1fr 1fr}}
        .sc-lbl{font-family:${MONO};font-size:8.5px;letter-spacing:.17em;text-transform:uppercase;
          color:rgba(255,255,255,.38);display:block;margin-bottom:5px}
        .sc-inp{background:rgba(0,0,0,.32);border:1px solid #252a3d;border-radius:8px;color:#e8e9f0;
          font-family:${MONO};font-size:12px;padding:10px 12px;width:100%;outline:none;
          box-shadow:inset 0 2px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(255,255,255,.08);
          transition:border-color .2s,box-shadow .2s}
        .sc-inp:focus{border-color:${GOLD};box-shadow:inset 0 2px 5px rgba(0,0,0,.6),0 0 0 2px rgba(57,226,230,.2)}
        .sc-inp.warn{border-color:rgba(255,180,84,.6);box-shadow:inset 0 2px 5px rgba(0,0,0,.6),0 0 0 2px rgba(255,180,84,.15)}
        .sc-inp.ro{background:rgba(57,226,230,.05);border-color:rgba(57,226,230,.25);color:${GOLD};cursor:default}
        .sc-alert{display:flex;gap:8px;align-items:flex-start;font-family:${MONO};font-size:10px;line-height:1.6;
          color:${AMBER};background:rgba(255,180,84,.07);border:1px solid rgba(255,180,84,.2);
          border-radius:7px;padding:9px 11px;margin-top:10px}
        .sc-btn{padding:12px 22px;border-radius:9px;font-family:${MONO};font-size:10.5px;font-weight:700;
          letter-spacing:.14em;cursor:pointer;border:none;color:#04050a;width:100%;
          background:linear-gradient(180deg,rgba(180,250,253,.96),${GOLD} 52%,rgba(31,166,173,.95));
          box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 4px 0 rgba(18,112,122,.9),0 12px 22px -8px rgba(57,226,230,.5);
          transition:transform .1s,box-shadow .1s,filter .25s}
        .sc-btn:active:not([disabled]){transform:translateY(3px);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 1px 0 rgba(18,112,122,.9)}
        .sc-btn[disabled]{filter:grayscale(.9) brightness(.55);cursor:not-allowed;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 3px 0 rgba(28,34,44,.95)}
        .sc-fb{font-family:${MONO};font-size:10.5px;line-height:1.6;margin-bottom:10px}

        /* réplica del componente de RightBar */
        .sc-pvwrap{background:#080a10;border-radius:10px;padding:12px;border:1px solid #1a1d2e;
          box-shadow:inset 0 2px 10px rgba(0,0,0,.7)}
        .sc-pvl{font-family:${MONO};font-size:8px;letter-spacing:.18em;color:rgba(255,255,255,.38);
          margin-bottom:9px;display:flex;align-items:center;gap:7px}
        .sc-dot{width:5px;height:5px;border-radius:50%;background:${GREEN};box-shadow:0 0 6px ${GREEN};
          animation:scpl 1.8s infinite}
        @keyframes scpl{50%{opacity:.35}}
        .sc-card{padding:10px 12px;border-bottom:1px solid #1a1d2e;border-left:2px solid var(--bc);
          background:linear-gradient(90deg,color-mix(in srgb,var(--bc) 5%,transparent),transparent 55%);font-family:${MONO}}
        .sc-r{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px}
        .sc-au{font-size:9px;color:rgba(255,255,255,.55)}
        .sc-rep{font-size:8px;letter-spacing:.1em;padding:1px 5px}
        .sc-ty{display:flex;gap:4px;align-items:center;margin-bottom:4px}
        .sc-tag{font-size:9px;color:var(--bc);background:color-mix(in srgb,var(--bc) 13%,transparent);padding:1px 5px}
        .sc-par{font-size:10px;color:#e8e9f0}
        .sc-tf{font-size:9px;color:rgba(255,255,255,.38)}
        .sc-lev{display:flex;flex-direction:column;gap:2px;margin-bottom:4px}
        .sc-lrow{display:flex;justify-content:space-between;font-size:9px}
        .sc-lrow .k{color:rgba(255,255,255,.38)}
        .sc-nota{font-size:9px;color:rgba(255,255,255,.55);line-height:1.5;margin-top:5px}
        .sc-note{font-family:${MONO};font-size:9px;color:rgba(255,255,255,.38);margin-top:8px;line-height:1.6}
        @media (prefers-reduced-motion: reduce){.sc-dot{animation:none}.sc-inp,.sc-btn{transition:none}}
      `}</style>

      <form onSubmit={onSubmit} className="sc-glass">
        <div className="sc-head">
          <span className="sc-ht">Nuevo setup</span>
          {!isLP && <span className="sc-hs" style={{ color: levelsState.c }}>{levelsState.t}</span>}
        </div>

        <div className="sc-sec">
          <div className="sc-st">Instrumento</div>
          <div className="sc-grid sc-c2">
            <div>
              <span className="sc-lbl">Par</span>
              <input className="sc-inp" value={form.par} onChange={set('par')} placeholder="BTCUSDT" />
            </div>
            <div>
              <span className="sc-lbl">Tipo</span>
              <select className="sc-inp" value={form.tipo} onChange={set('tipo')}>
                <option value="LONG">LONG</option><option value="SHORT">SHORT</option><option value="LP">LP (Liquidity)</option>
              </select>
            </div>
          </div>
        </div>

        {!isLP && (
          <div className="sc-sec">
            <div className="sc-st">Niveles</div>
            <div className="sc-grid sc-c3">
              <div><span className="sc-lbl">Entry</span>
                <input type="number" className={`sc-inp${issues.length ? ' warn' : ''}`} value={form.entry} onChange={set('entry')} placeholder="0" /></div>
              <div><span className="sc-lbl">SL</span>
                <input type="number" className={`sc-inp${issues.length ? ' warn' : ''}`} value={form.sl} onChange={set('sl')} placeholder="0" /></div>
              <div><span className="sc-lbl">TP</span>
                <input type="number" className={`sc-inp${issues.length ? ' warn' : ''}`} value={form.tp} onChange={set('tp')} placeholder="0" /></div>
            </div>
            <div className="sc-grid sc-c2" style={{ marginTop: 10 }}>
              <div><span className="sc-lbl">R:R — calculado</span>
                <input className="sc-inp ro" value={rr || '—'} readOnly tabIndex={-1} /></div>
            </div>
            {issues.length > 0 && (
              <div className="sc-alert"><span>▲</span><div>{issues.map((t, i) => <div key={i}>{t}</div>)}</div></div>
            )}
          </div>
        )}

        {isLP && (
          <div className="sc-sec">
            <div className="sc-st">Rango de liquidez</div>
            <div className="sc-grid sc-c2">
              <div><span className="sc-lbl">Rango bajo</span><input type="number" className="sc-inp" value={form.rangeLow} onChange={set('rangeLow')} placeholder="1580" /></div>
              <div><span className="sc-lbl">Rango alto</span><input type="number" className="sc-inp" value={form.rangeHigh} onChange={set('rangeHigh')} placeholder="1950" /></div>
              <div><span className="sc-lbl">Protocol</span><input className="sc-inp" value={form.protocol} onChange={set('protocol')} placeholder="Uniswap v3" /></div>
              <div><span className="sc-lbl">Fee tier</span><input className="sc-inp" value={form.feeTier} onChange={set('feeTier')} placeholder="0.05%" /></div>
            </div>
          </div>
        )}

        <div className="sc-sec">
          <div className="sc-st">Contexto</div>
          <div className="sc-grid sc-c2" style={{ marginBottom: 10 }}>
            <div><span className="sc-lbl">Timeframe</span>
              <select className="sc-inp" value={form.timeframe} onChange={set('timeframe')}>
                {tfOptions.map(t => <option key={t} value={t}>{t}</option>)}<option value="—">—</option>
              </select></div>
            <div><span className="sc-lbl">Metodología</span>
              <input className="sc-inp" value={form.metodologia} onChange={set('metodologia')} placeholder="OB+MACD" /></div>
          </div>
          <div><span className="sc-lbl">Nota</span>
            <input className="sc-inp" value={form.nota} onChange={set('nota')} placeholder="Describe el setup brevemente…" /></div>
        </div>

        <div className="sc-sec">
          {error && <div className="sc-fb" style={{ color: RED }}>{error}</div>}
          {msg   && <div className="sc-fb" style={{ color: GREEN }}>{msg}</div>}
          <button type="submit" className="sc-btn" disabled={publishing || !form.par.trim()}>
            {publishing ? 'PUBLICANDO…' : 'PUBLICAR SETUP'}
          </button>
        </div>
      </form>

      <div>
        <div className="sc-pvwrap">
          <div className="sc-pvl"><span className="sc-dot" />Así lo verán</div>
          <div className="sc-card" style={{ ['--bc' as string]: tipoColor }}>
            <div className="sc-r">
              <span className="sc-au">@{username}</span>
              <span className="sc-rep" style={{ color: badge.color, background: badge.color + '18' }}>
                {badge.sym} REP {reputation}
              </span>
            </div>
            <div className="sc-ty">
              <span className="sc-tag">{form.tipo}</span>
              <span className="sc-par">{form.par.trim().toUpperCase() || '—'}</span>
              <span className="sc-tf">{form.timeframe}</span>
            </div>
            {!isLP && (
              <div className="sc-lev">
                {form.entry && <div className="sc-lrow"><span className="k">E</span><span style={{ color: 'rgba(255,255,255,.55)' }}>{form.entry}</span></div>}
                {form.sl    && <div className="sc-lrow"><span className="k">SL</span><span style={{ color: RED + 'cc' }}>{form.sl}</span></div>}
                {form.tp    && <div className="sc-lrow"><span className="k">TP</span><span style={{ color: GREEN + 'cc' }}>{form.tp}</span></div>}
                {rr         && <div className="sc-lrow"><span className="k">RR</span><span style={{ color: GOLD }}>{rr}R</span></div>}
              </div>
            )}
            {isLP && form.rangeLow && form.rangeHigh && (
              <div className="sc-lrow" style={{ marginBottom: 4 }}>
                <span className="k">RANGO</span><span style={{ color: '#e8e9f0' }}>{form.rangeLow} – {form.rangeHigh}</span>
              </div>
            )}
            {form.nota && <div className="sc-nota">{form.nota}</div>}
          </div>
        </div>
        <div className="sc-note">Réplica del componente real de la barra lateral.</div>
      </div>
    </div>
  )
}
