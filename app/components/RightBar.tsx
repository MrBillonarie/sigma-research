'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/app/lib/supabase'

const T = {
  bg:      '#04050a',
  surface: '#0b0d14',
  border:  '#1a1d2e',
  gold:    '#d4af37',
  green:   '#34d399',
  red:     '#f87171',
  text:    '#e8e9f0',
  dimText: '#7a7f9a',
  muted:   '#3a3f55',
  violet:  '#a78bfa',
  blue:    '#60a5fa',
}

// ─── Types ────────────────────────────────────────────────────────────────────
const SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB'] as const
type Sym = typeof SYMBOLS[number]

interface Ticker { price: number; change24h: number; flash: 'up' | 'down' | null }

interface PriceAlert {
  id: string; symbol: Sym; condition: 'ABOVE' | 'BELOW'
  price: number; triggered: boolean; createdAt: string
}

interface Setup {
  id: string; par: string; tipo: 'LONG' | 'SHORT' | 'LP'
  entry?: number; sl?: number; tp?: number; rr?: number
  rangeLow?: number; rangeHigh?: number; feeTier?: string; protocol?: string
  timeframe: string; metodologia: string
  estado: 'ACTIVO' | 'INVALIDO' | 'EJECUTADO' | 'EN_RANGO' | 'FUERA_RANGO'
  nota: string; fecha: string
}

interface CommunitySetup {
  id: string; par: string; tipo: 'LONG' | 'SHORT' | 'LP'
  entry?: number; sl?: number; tp?: number
  range_low?: number; range_high?: number; rr?: number
  timeframe: string; metodologia: string; estado: string
  nota: string; fecha: string; votos_up: number; votos_down: number
  profiles: { username: string; reputation: number } | null
}

// ─── Market sessions (UTC hours) ─────────────────────────────────────────────
const SESSIONS = [
  { name: 'ASIA',     from: 0,  to: 9,  color: T.violet, tz: 'Asia/Tokyo',       label: 'Tokyo'  },
  { name: 'LONDON',   from: 7,  to: 16, color: T.blue,   tz: 'Europe/London',    label: 'London' },
  { name: 'NEW YORK', from: 13, to: 22, color: T.green,  tz: 'America/New_York', label: 'NY'     },
] as const

// ─── Own setups (edit manually) ───────────────────────────────────────────────
const SETUPS: Setup[] = [
  {
    id: '1', par: 'BTCUSDT', tipo: 'LONG',
    entry: 83500, sl: 81200, tp: 88000, rr: 2.1,
    timeframe: '4H', metodologia: 'OB+MACD', estado: 'ACTIVO',
    nota: 'OB 4H respetado, MACD divergencia bull', fecha: '2026-04-18',
  },
  {
    id: '2', par: 'ETH/USDC', tipo: 'LP',
    rangeLow: 1580, rangeHigh: 1950,
    feeTier: '0.05%', protocol: 'Uniswap v3',
    timeframe: '—', metodologia: 'Concentrated LP', estado: 'EN_RANGO',
    nota: 'Rango tight alrededor de precio actual', fecha: '2026-04-18',
  },
]

const SYM_STREAM = SYMBOLS.map(s => `${s.toLowerCase()}usdt@ticker`).join('/')
const WS_URL     = `wss://stream.binance.com:9443/stream?streams=${SYM_STREAM}`

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtPrice(n: number): string {
  if (!n) return '—'
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (n >= 10)   return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

function pad2(n: number) { return String(n).padStart(2, '0') }

function playBeep(ctx: React.MutableRefObject<AudioContext | null>) {
  try {
    if (!ctx.current) ctx.current = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)()
    const ac = ctx.current, osc = ac.createOscillator(), gain = ac.createGain()
    osc.connect(gain); gain.connect(ac.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ac.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, ac.currentTime + 0.2)
    gain.gain.setValueAtTime(0.18, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.35)
    osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.35)
  } catch {}
}

function resolveSetupStatus(s: Setup, price: number): Setup['estado'] {
  if (!price || s.tipo === 'LP') return s.estado
  if (s.tipo === 'LONG') {
    if (s.sl && price <= s.sl) return 'INVALIDO'
    if (s.tp && price >= s.tp) return 'EJECUTADO'
  } else {
    if (s.sl && price >= s.sl) return 'INVALIDO'
    if (s.tp && price <= s.tp) return 'EJECUTADO'
  }
  return s.estado
}

function resolveLpStatus(s: Setup, price: number): 'EN_RANGO' | 'FUERA_RANGO' {
  if (!price || !s.rangeLow || !s.rangeHigh) return s.estado as 'EN_RANGO' | 'FUERA_RANGO'
  return price >= s.rangeLow && price <= s.rangeHigh ? 'EN_RANGO' : 'FUERA_RANGO'
}

function setupProgress(s: Setup, price: number): number {
  if (!price || !s.entry || !s.tp) return 0
  const p = s.tipo === 'LONG'
    ? (price - s.entry) / (s.tp - s.entry)
    : (s.entry - price) / (s.entry - s.tp)
  return Math.max(0, Math.min(100, p * 100))
}

function symFromPar(par: string): Sym {
  return par.replace('USDT', '').replace('PERP', '').replace('/USDC', '').replace('/USD', '').split('/')[0] as Sym
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function RightBar() {
  const [visible,    setVisible]    = useState(false)
  const [connected,  setConnected]  = useState(false)
  const [tickers,    setTickers]    = useState<Record<Sym, Ticker>>({
    BTC: { price: 0, change24h: 0, flash: null },
    ETH: { price: 0, change24h: 0, flash: null },
    SOL: { price: 0, change24h: 0, flash: null },
    BNB: { price: 0, change24h: 0, flash: null },
  })
  const [alerts,     setAlerts]     = useState<PriceAlert[]>([])
  const [showForm,   setShowForm]   = useState(false)
  const [formSym,    setFormSym]    = useState<Sym>('BTC')
  const [formCond,   setFormCond]   = useState<'ABOVE' | 'BELOW'>('ABOVE')
  const [formPrice,  setFormPrice]  = useState('')
  const [utcNow,     setUtcNow]     = useState(new Date())
  const [community,  setCommunity]  = useState<CommunitySetup[]>([])
  const [userVotes,  setUserVotes]  = useState<Record<string, 'up' | 'down'>>({})

  const wsRef       = useRef<WebSocket | null>(null)
  const reconnRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashRefs   = useRef<Partial<Record<Sym, ReturnType<typeof setTimeout>>>>({})
  const audioCtxRef = useRef<AudioContext | null>(null)
  const alertsRef   = useRef<PriceAlert[]>([])
  alertsRef.current = alerts

  // Mobile visibility
  useEffect(() => {
    const check = () => setVisible(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // UTC clock
  useEffect(() => {
    const id = setInterval(() => setUtcNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Load alerts from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('sigma_alerts')
      if (raw) setAlerts(JSON.parse(raw))
    } catch {}
  }, [])

  // Fetch community setups
  useEffect(() => {
    fetch('/api/community-setups')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setCommunity(data) })
      .catch(() => {})
  }, [])

  function saveAlerts(next: PriceAlert[]) {
    setAlerts(next)
    try { localStorage.setItem('sigma_alerts', JSON.stringify(next)) } catch {}
  }

  // WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      if (reconnRef.current) { clearTimeout(reconnRef.current); reconnRef.current = null }
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string)
        if (!msg?.stream || !msg?.data) return
        const raw = msg.stream.split('@')[0].replace('usdt', '').toUpperCase() as Sym
        if (!SYMBOLS.includes(raw)) return

        const newPrice  = parseFloat(msg.data.c)
        const change24h = parseFloat(msg.data.P)

        setTickers(prev => {
          const old   = prev[raw]
          const flash = old.price === 0 ? null : newPrice > old.price ? 'up' : newPrice < old.price ? 'down' : null
          if (flash) {
            if (flashRefs.current[raw]) clearTimeout(flashRefs.current[raw]!)
            flashRefs.current[raw] = setTimeout(() => {
              setTickers(p => ({ ...p, [raw]: { ...p[raw], flash: null } }))
            }, 300)
          }
          return { ...prev, [raw]: { price: newPrice, change24h, flash } }
        })

        const cur = alertsRef.current
        let changed = false
        const next = cur.map(a => {
          if (a.triggered || a.symbol !== raw) return a
          const hit = a.condition === 'ABOVE' ? newPrice >= a.price : newPrice <= a.price
          if (hit) { changed = true; playBeep(audioCtxRef); return { ...a, triggered: true } }
          return a
        })
        if (changed) {
          alertsRef.current = next
          setAlerts(next)
          try { localStorage.setItem('sigma_alerts', JSON.stringify(next)) } catch {}
        }
      } catch {}
    }

    ws.onclose = () => {
      setConnected(false)
      if (!reconnRef.current) reconnRef.current = setTimeout(connect, 5000)
    }
    ws.onerror = () => ws.close()
  }, [])

  useEffect(() => {
    connect()
    const flashRefsSnapshot = flashRefs.current
    return () => {
      if (reconnRef.current) clearTimeout(reconnRef.current)
      wsRef.current?.close()
      Object.values(flashRefsSnapshot).forEach(t => t && clearTimeout(t))
    }
  }, [connect])

  function addAlert() {
    const p = parseFloat(formPrice)
    if (!p || p <= 0) return
    if (alerts.filter(a => !a.triggered).length >= 5) return
    saveAlerts([...alerts, {
      id: Date.now().toString(), symbol: formSym, condition: formCond,
      price: p, triggered: false, createdAt: new Date().toISOString(),
    }])
    setFormPrice(''); setShowForm(false)
    try {
      if (!audioCtxRef.current)
        audioCtxRef.current = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)()
    } catch {}
  }

  function alertDist(a: PriceAlert) {
    const price = tickers[a.symbol]?.price
    if (!price) return '—'
    const d = ((a.price - price) / price) * 100
    return (d >= 0 ? '+' : '') + d.toFixed(2) + '%'
  }

  async function castVote(setupId: string, voteType: 'up' | 'down') {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setUserVotes(prev => ({ ...prev, [setupId]: voteType }))
    setCommunity(prev => prev.map(cs => cs.id !== setupId ? cs : {
      ...cs,
      votos_up:   voteType === 'up'   ? cs.votos_up + 1   : cs.votos_up,
      votos_down: voteType === 'down' ? cs.votos_down + 1 : cs.votos_down,
    }))
    fetch('/api/community-setups', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ setup_id: setupId, vote_type: voteType }),
    }).catch(() => {})
  }

  if (!visible) return null

  // Session calc
  const utcH           = utcNow.getUTCHours() + utcNow.getUTCMinutes() / 60
  const activeSessions = SESSIONS.filter(s => utcH >= s.from && utcH < s.to)

  function localTime(tz: string) {
    try { return utcNow.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }) }
    catch { return '--:--' }
  }

  const inputStyle: React.CSSProperties = {
    background: T.bg, border: `1px solid ${T.border}`, color: T.text,
    fontFamily: 'monospace', fontSize: 11, padding: '5px 8px',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  }
  const selStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

  return (
    <>
      <style>{`
        .sigma-rb::-webkit-scrollbar { display: none; }
        @keyframes rb-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes rb-gold  { 0%,100%{background:rgba(212,175,55,0.10)} 50%{background:rgba(212,175,55,0.25)} }
        @keyframes rb-sess  { 0%,100%{opacity:1} 50%{opacity:0.55} }
      `}</style>

      <aside
        className="sigma-rb"
        style={{
          width: 220, minWidth: 220, height: '100vh',
          position: 'sticky', top: 0,
          background: T.surface,
          borderLeft: `1px solid ${T.border}`,
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
          scrollbarWidth: 'none',
        } as React.CSSProperties}
      >
        {/* ── Connection dot ── */}
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: connected ? T.green : T.red, animation: connected ? 'rb-pulse 2s infinite' : undefined }} />
          <span style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.2em', color: connected ? T.green : T.red }}>
            {connected ? 'LIVE' : 'RECONNECTING'}
          </span>
        </div>

        {/* ══ MERCADO ══ */}
        <Section label="MERCADO" />
        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${T.border}` }}>
          {/* UTC clock */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 8, color: T.muted, letterSpacing: '0.2em' }}>UTC</span>
            <span style={{ fontFamily: 'monospace', fontSize: 14, color: T.text, letterSpacing: '0.04em' }}>
              {pad2(utcNow.getUTCHours())}:{pad2(utcNow.getUTCMinutes())}:{pad2(utcNow.getUTCSeconds())}
            </span>
          </div>

          {SESSIONS.map(s => {
            const isOpen     = utcH >= s.from && utcH < s.to
            const hoursLeft  = isOpen ? s.to - utcH : null
            const hoursUntil = !isOpen ? (utcH < s.from ? s.from - utcH : 24 - utcH + s.from) : null
            return (
              <div key={s.name} style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5,
                padding: '4px 6px',
                background: isOpen ? s.color + '12' : 'transparent',
                border: `1px solid ${isOpen ? s.color + '40' : T.border}`,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: isOpen ? s.color : T.muted,
                  animation: isOpen ? 'rb-sess 2.5s infinite' : undefined,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.1em', color: isOpen ? s.color : T.muted }}>{s.name}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 9, color: isOpen ? T.text : T.muted }}>{localTime(s.tz)}</span>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 8, color: T.dimText, marginTop: 1 }}>
                    {isOpen && hoursLeft !== null
                      ? `cierra en ${Math.floor(hoursLeft)}h ${Math.round((hoursLeft % 1) * 60)}m`
                      : hoursUntil !== null
                        ? `abre en ${Math.floor(hoursUntil)}h ${Math.round((hoursUntil % 1) * 60)}m`
                        : ''}
                  </div>
                </div>
              </div>
            )
          })}

          {activeSessions.length > 1 && (
            <div style={{ fontFamily: 'monospace', fontSize: 8, color: T.gold, marginTop: 4, letterSpacing: '0.1em' }}>
              ⚡ OVERLAP: {activeSessions.map(s => s.label).join(' + ')}
            </div>
          )}
        </div>

        {/* ══ PRECIOS ══ */}
        <Section label="PRECIOS" />
        <div style={{ padding: '0 0 8px' }}>
          {SYMBOLS.map(sym => {
            const t    = tickers[sym]
            const up   = t.change24h >= 0
            const bg   = t.flash === 'up' ? T.green + '22' : t.flash === 'down' ? T.red + '22' : 'transparent'
            return (
              <div key={sym} style={{ padding: '7px 12px', transition: 'background 0.15s', background: bg, borderBottom: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.15em', color: T.gold }}>{sym}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color: up ? T.green : T.red }}>
                    {up ? '▲' : '▼'} {Math.abs(t.change24h).toFixed(2)}%
                  </span>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 13, color: T.text, letterSpacing: '0.02em', lineHeight: 1 }}>
                  {fmtPrice(t.price)}
                </div>
              </div>
            )
          })}
        </div>

        {/* ══ ALERTAS ══ */}
        <Section label="ALERTAS" />
        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${T.border}` }}>
          <button onClick={() => setShowForm(v => !v)} style={{
            width: '100%', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.12em',
            color: T.gold, background: T.gold + '14', border: `1px solid ${T.gold}44`,
            padding: '5px', cursor: 'pointer',
          }}>
            {showForm ? '✕ CANCELAR' : '+ ALERTA'}
          </button>

          {showForm && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <select value={formSym} onChange={e => setFormSym(e.target.value as Sym)} style={selStyle}>
                {SYMBOLS.map(s => <option key={s}>{s}</option>)}
              </select>
              <select value={formCond} onChange={e => setFormCond(e.target.value as 'ABOVE' | 'BELOW')} style={selStyle}>
                <option value="ABOVE">ABOVE ▲</option>
                <option value="BELOW">BELOW ▼</option>
              </select>
              <input
                type="number" value={formPrice} onChange={e => setFormPrice(e.target.value)}
                placeholder={`Precio (${tickers[formSym].price > 0 ? fmtPrice(tickers[formSym].price) : '...'})`}
                style={inputStyle} onKeyDown={e => e.key === 'Enter' && addAlert()}
              />
              <button onClick={addAlert} style={{
                fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em',
                color: T.bg, background: T.gold, border: 'none', padding: '5px', cursor: 'pointer',
              }}>GUARDAR</button>
            </div>
          )}
        </div>

        {alerts.length === 0
          ? <div style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 10, color: T.muted }}>Sin alertas activas</div>
          : alerts.map(a => (
            <div key={a.id} style={{
              padding: '7px 12px', borderBottom: `1px solid ${T.border}`,
              animation: a.triggered ? 'rb-gold 1.2s infinite' : undefined,
              background: a.triggered ? T.gold + '14' : 'transparent',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: T.gold }}>{a.symbol}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color: a.condition === 'ABOVE' ? T.green : T.red }}>
                    {a.condition === 'ABOVE' ? '▲' : '▼'}
                  </span>
                </div>
                <button onClick={() => saveAlerts(alerts.filter(x => x.id !== a.id))}
                  style={{ background: 'transparent', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 11, padding: 0 }}>✕</button>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: T.text }}>{fmtPrice(a.price)}</div>
              {a.triggered
                ? <div style={{ fontFamily: 'monospace', fontSize: 9, color: T.gold, marginTop: 2, letterSpacing: '0.1em' }}>✓ TRIGGERED</div>
                : <div style={{ fontFamily: 'monospace', fontSize: 9, color: T.dimText, marginTop: 2 }}>dist: {alertDist(a)}</div>}
            </div>
          ))
        }

        {/* ══ SETUPS (propio) ══ */}
        <Section label="SETUPS" />
        {SETUPS.length === 0
          ? <div style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 10, color: T.muted }}>Sin setups activos</div>
          : SETUPS.map(s => <SetupCard key={s.id} s={s} price={tickers[symFromPar(s.par)]?.price ?? 0} />)
        }

        {/* ══ COMUNIDAD ══ */}
        <Section label="COMUNIDAD" />
        {community.length === 0
          ? <div style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 10, color: T.muted }}>Sin setups publicados</div>
          : community.map(cs => (
            <CommunityCard
              key={cs.id} cs={cs}
              price={tickers[symFromPar(cs.par)]?.price ?? 0}
              myVote={userVotes[cs.id]}
              onVote={castVote}
            />
          ))
        }

      </aside>
    </>
  )
}

// ─── SetupCard: handles LONG / SHORT / LP ─────────────────────────────────────
function SetupCard({ s, price }: { s: Setup; price: number }) {

  if (s.tipo === 'LP') {
    const st      = resolveLpStatus(s, price)
    const inRange = st === 'EN_RANGO'
    const pct     = s.rangeLow && s.rangeHigh
      ? Math.max(0, Math.min(100, ((price - s.rangeLow) / (s.rangeHigh - s.rangeLow)) * 100))
      : 50

    return (
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: T.violet, background: T.violet + '20', padding: '1px 5px', letterSpacing: '0.08em' }}>LP</span>
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: inRange ? T.green : T.red, background: (inRange ? T.green : T.red) + '18', padding: '1px 5px' }}>{st}</span>
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: T.text, marginBottom: 4 }}>{s.par}</div>
        {s.protocol && (
          <div style={{ fontFamily: 'monospace', fontSize: 9, color: T.violet, marginBottom: 4 }}>{s.protocol} · {s.feeTier}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: T.muted }}>RANGO</span>
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: T.text }}>{fmtPrice(s.rangeLow ?? 0)} – {fmtPrice(s.rangeHigh ?? 0)}</span>
        </div>
        {price > 0 && (
          <div style={{ marginBottom: 5 }}>
            <div style={{ height: 5, background: T.border, borderRadius: 3, position: 'relative' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: inRange ? T.violet : T.red, borderRadius: 3 }} />
              <div style={{ position: 'absolute', left: `${pct}%`, top: -1, width: 2, height: 7, background: T.gold, transform: 'translateX(-50%)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 8, color: T.dimText, marginTop: 2 }}>
              <span>{fmtPrice(s.rangeLow ?? 0)}</span>
              <span style={{ color: inRange ? T.green : T.red }}>{fmtPrice(price)}</span>
              <span>{fmtPrice(s.rangeHigh ?? 0)}</span>
            </div>
          </div>
        )}
        <div style={{ fontFamily: 'monospace', fontSize: 9, color: T.dimText, lineHeight: 1.5 }}>{s.nota}</div>
        <div style={{ fontFamily: 'monospace', fontSize: 8, color: T.muted, marginTop: 3 }}>{s.fecha}</div>
      </div>
    )
  }

  const st         = resolveSetupStatus(s, price)
  const prog       = st === 'ACTIVO' ? setupProgress(s, price) : 0
  const stColor    = st === 'EJECUTADO' ? T.gold : st === 'INVALIDO' ? T.red : T.dimText
  const badgeColor = s.tipo === 'LONG' ? T.green : T.red

  return (
    <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.08em', color: badgeColor, background: badgeColor + '20', padding: '1px 5px' }}>{s.tipo}</span>
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: T.dimText }}>{s.timeframe}</span>
        </div>
        <span style={{ fontFamily: 'monospace', fontSize: 9, color: stColor, background: stColor + '18', padding: '1px 5px', letterSpacing: '0.1em' }}>{st}</span>
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 11, color: T.text, marginBottom: 4 }}>{s.par}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 6 }}>
        {[{ l: 'E', v: s.entry ?? 0, c: T.dimText }, { l: 'SL', v: s.sl ?? 0, c: T.red + 'cc' }, { l: 'TP', v: s.tp ?? 0, c: T.green + 'cc' }].map(({ l, v, c }) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: T.muted }}>{l}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: c }}>{fmtPrice(v)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: T.muted }}>RR</span>
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: T.gold }}>{s.rr}R</span>
        </div>
      </div>
      {st === 'ACTIVO' && price > 0 && (
        <div style={{ marginBottom: 5 }}>
          <div style={{ height: 3, background: T.border, borderRadius: 2 }}>
            <div style={{ width: `${prog}%`, height: '100%', background: prog > 0 ? T.green : T.muted, borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 8, color: T.dimText, marginTop: 2, textAlign: 'right' }}>{prog.toFixed(0)}% hacia TP</div>
        </div>
      )}
      <div style={{ fontFamily: 'monospace', fontSize: 9, color: T.gold, letterSpacing: '0.08em', marginBottom: 3 }}>{s.metodologia}</div>
      <div style={{ fontFamily: 'monospace', fontSize: 9, color: T.dimText, lineHeight: 1.5 }}>{s.nota}</div>
      <div style={{ fontFamily: 'monospace', fontSize: 8, color: T.muted, marginTop: 3 }}>{s.fecha}</div>
    </div>
  )
}

// ─── CommunityCard ────────────────────────────────────────────────────────────
function CommunityCard({
  cs, price, myVote, onVote,
}: {
  cs: CommunitySetup; price: number
  myVote?: 'up' | 'down'
  onVote: (id: string, v: 'up' | 'down') => void
}) {
  const rep       = cs.profiles?.reputation ?? 0
  const repColor  = rep >= 50 ? T.gold : rep >= 20 ? T.green : T.dimText
  const badgeColor = cs.tipo === 'LP' ? T.violet : cs.tipo === 'LONG' ? T.green : T.red

  const pct = cs.tipo !== 'LP' && cs.entry && cs.tp && price
    ? Math.max(0, Math.min(100,
        cs.tipo === 'LONG'
          ? ((price - cs.entry) / (cs.tp - cs.entry)) * 100
          : ((cs.entry - price) / (cs.entry - cs.tp)) * 100
      ))
    : null

  return (
    <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}` }}>
      {/* Author row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 9, color: T.dimText }}>
          @{cs.profiles?.username ?? 'anon'}
        </span>
        <span style={{
          fontFamily: 'monospace', fontSize: 8, letterSpacing: '0.1em',
          color: repColor, background: repColor + '18', padding: '1px 5px',
        }}>
          {rep >= 50 ? '★' : rep >= 20 ? '◆' : '·'} REP {rep}
        </span>
      </div>

      {/* Type + par */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 9, color: badgeColor, background: badgeColor + '20', padding: '1px 5px' }}>{cs.tipo}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: T.text }}>{cs.par}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 9, color: T.muted }}>{cs.timeframe}</span>
      </div>

      {/* Levels */}
      {cs.tipo !== 'LP' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: pct !== null ? 5 : 4 }}>
          {cs.entry && <Row l="E"  v={cs.entry} c={T.dimText} />}
          {cs.sl    && <Row l="SL" v={cs.sl}    c={T.red + 'cc'} />}
          {cs.tp    && <Row l="TP" v={cs.tp}    c={T.green + 'cc'} />}
          {cs.rr    && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: T.muted }}>RR</span>
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: T.gold }}>{cs.rr}R</span>
            </div>
          )}
        </div>
      )}

      {/* LP range */}
      {cs.tipo === 'LP' && cs.range_low && cs.range_high && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: T.muted }}>RANGO</span>
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: T.text }}>{fmtPrice(cs.range_low)} – {fmtPrice(cs.range_high)}</span>
        </div>
      )}

      {/* Progress bar */}
      {pct !== null && price > 0 && (
        <div style={{ marginBottom: 4 }}>
          <div style={{ height: 3, background: T.border, borderRadius: 2 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: pct > 0 ? T.green : T.muted, borderRadius: 2 }} />
          </div>
        </div>
      )}

      {cs.nota && <div style={{ fontFamily: 'monospace', fontSize: 9, color: T.dimText, lineHeight: 1.5, marginBottom: 6 }}>{cs.nota}</div>}

      {/* Votes */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => onVote(cs.id, 'up')}
          style={{
            fontFamily: 'monospace', fontSize: 9, color: myVote === 'up' ? T.green : T.muted,
            background: myVote === 'up' ? T.green + '18' : 'transparent',
            border: `1px solid ${myVote === 'up' ? T.green + '40' : T.border}`,
            padding: '2px 6px', cursor: 'pointer',
          }}
        >▲ {cs.votos_up}</button>
        <button
          onClick={() => onVote(cs.id, 'down')}
          style={{
            fontFamily: 'monospace', fontSize: 9, color: myVote === 'down' ? T.red : T.muted,
            background: myVote === 'down' ? T.red + '18' : 'transparent',
            border: `1px solid ${myVote === 'down' ? T.red + '40' : T.border}`,
            padding: '2px 6px', cursor: 'pointer',
          }}
        >▼ {cs.votos_down}</button>
      </div>
    </div>
  )
}

function Row({ l, v, c }: { l: string; v: number; c: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontFamily: 'monospace', fontSize: 9, color: T.muted }}>{l}</span>
      <span style={{ fontFamily: 'monospace', fontSize: 9, color: c }}>{fmtPrice(v)}</span>
    </div>
  )
}

function Section({ label }: { label: string }) {
  return (
    <div style={{
      padding: '8px 12px 6px',
      borderTop: `1px solid ${T.border}`,
      fontFamily: 'monospace', fontSize: 9,
      letterSpacing: '0.25em', textTransform: 'uppercase',
      color: T.muted,
    }}>{'// '}{label}</div>
  )
}
