'use client'

// ─── Escalera de rangos de comunidad ─────────────────────────────────────────
// Los umbrales salen de la lógica que ya existía en texto: 10 para publicar
// (MIN_REP, también validado en /api/community-setups), 20 Verificado, 50 Senior.

export const RANKS = [
  { name: 'NOVATO',     req: 0,  color: '#8fa3b8', unlocks: 'solo lectura' },
  { name: 'PUBLICA',    req: 10, color: '#39e2e6', unlocks: 'publicar setups' },
  { name: 'VERIFICADO', req: 20, color: '#2fd39a', unlocks: 'distintivo ◆' },
  { name: 'SENIOR',     req: 50, color: '#ffb454', unlocks: 'destaque ★' },
]

export function tierOf(rep: number) {
  let i = 0
  RANKS.forEach((r, k) => { if (rep >= r.req) i = k })
  return i
}

const MONO = "var(--font-dm-mono,'DM Mono',monospace)"

export default function RankLadder({ reputation }: { reputation: number }) {
  const cur = tierOf(reputation)
  const next = RANKS[cur + 1]

  return (
    <div>
      <style>{`
        .rk-ladder{display:flex;align-items:flex-end;gap:8px;height:76px;margin-top:6px}
        .rk-step{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;
          height:100%;position:relative}
        .rk-block{width:100%;border-radius:3px 3px 0 0;position:relative;
          background:linear-gradient(180deg,#1c2431,#11161f);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.06);transition:all .3s}
        .rk-step.done .rk-block{
          background:linear-gradient(180deg,color-mix(in srgb,var(--rc) 55%,#0d1219),color-mix(in srgb,var(--rc) 18%,#0d1219));
          box-shadow:inset 0 1px 0 rgba(255,255,255,.22)}
        .rk-block::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;
          border-radius:3px 3px 0 0;background:#252a3d;transition:all .3s}
        .rk-step.done .rk-block::before{background:var(--rc);box-shadow:0 0 8px var(--rc)}
        .rk-step.now .rk-block{box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 0 20px -6px var(--rc)}
        .rk-step:nth-child(1) .rk-block{height:26%}
        .rk-step:nth-child(2) .rk-block{height:48%}
        .rk-step:nth-child(3) .rk-block{height:72%}
        .rk-step:nth-child(4) .rk-block{height:100%}
        .rk-name{font-family:${MONO};font-size:8px;letter-spacing:.1em;color:rgba(255,255,255,.38);
          margin-top:7px;white-space:nowrap}
        .rk-step.done .rk-name{color:rgba(255,255,255,.55)}
        .rk-step.now .rk-name{color:var(--rc)}
        .rk-req{font-family:${MONO};font-size:7.5px;color:rgba(255,255,255,.38);opacity:.6;
          margin-top:2px;text-align:center;line-height:1.4}
        .rk-mark{position:absolute;top:-13px;font-size:9px;color:var(--rc)}
        .rk-next{font-family:${MONO};font-size:10.5px;color:rgba(255,255,255,.55);margin-top:11px}
        .rk-next b{color:#39e2e6;font-weight:400}
        @media (prefers-reduced-motion: reduce){.rk-block,.rk-block::before{transition:none}}
      `}</style>

      <div className="rk-ladder">
        {RANKS.map((r, i) => {
          const done = i <= cur, now = i === cur
          return (
            <div key={r.name} className={`rk-step${done ? ' done' : ''}${now ? ' now' : ''}`} style={{ ['--rc' as string]: r.color }}>
              {now && <span className="rk-mark">▼</span>}
              <div className="rk-block" />
              <div className="rk-name">{r.name}</div>
              <div className="rk-req">{r.req} · {r.unlocks}</div>
            </div>
          )
        })}
      </div>

      <div className="rk-next">
        {next
          ? <>Te faltan <b>{next.req - reputation} {next.req - reputation === 1 ? 'punto' : 'puntos'}</b> para {next.name} — desbloquea {next.unlocks}.</>
          : 'Alcanzaste el rango máximo.'}
      </div>
    </div>
  )
}
