'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/app/lib/supabase'

const T = {
  bg:      '#04050a',
  surface: '#0b0d14',
  border:  '#1a1d2e',
  gold:    '#39e2e6',
  green:   '#34d399',
  red:     '#f87171',
  text:    '#e8e9f0',
  dimText: '#7a7f9a',
  muted:   '#3a3f55',
  violet:  '#a78bfa',
  blue:    '#60a5fa',
}

// ─── Types ────────────────────────────────────────────────────────────────────
// Universos reales de los 3 motores de SIGMA — el usuario elige cuál ver
const SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'LTC'] as const
type Sym = typeof SYMBOLS[number]

const SYM_LABEL: Record<Sym, string> = { BTC: 'BTC', ETH: 'ETH', SOL: 'SOL', BNB: 'BNB', LTC: 'LTC' }

const M2_ASSETS = ['XAU', 'XAG', 'WTI', 'HG', 'NG', 'PL', 'XPD', 'URNM'] as const   // + paladio y uranio (ampliación del motor)
const M3_ASSETS = ['AAPL', 'NVDA', 'TSLA', 'JPM', 'XOM', 'SPX'] as const
const M4_ASSETS = ['SPY', 'QQQ', 'IWM', 'XLE'] as const
const M5_ASSETS = ['EWJ', 'EWT', 'EWY'] as const   // Internacional: Japón · Taiwán · Corea (EWZ excluido por tracking)
type MotorTab = 'm1' | 'm2' | 'm3' | 'm4' | 'm5'

// Acordeón de PRECIOS — un grupo por motor con color de identidad (mismos
// acentos que las matrices del HUD y /modelos). Con 5 motores las tabs ya no
// caben en el rail; el acordeón muestra los 5 siempre y escala al llegar M6+.
const PRICE_MOTORS: { id: MotorTab; label: string; color: string; syms: readonly string[] }[] = [
  { id: 'm1', label: 'M1 · CRYPTO',  color: '#39e2e6', syms: SYMBOLS },
  { id: 'm2', label: 'M2 · COMM',    color: '#1D9E75', syms: M2_ASSETS },
  { id: 'm3', label: 'M3 · STOCKS',  color: '#378ADD', syms: M3_ASSETS },
  { id: 'm4', label: 'M4 · ÍNDICES', color: '#5b8def', syms: M4_ASSETS },
  { id: 'm5', label: 'M5 · INTL',    color: '#a78bfa', syms: M5_ASSETS },
]
const ALL_EXT_SYMBOLS: readonly string[] = [...M2_ASSETS, ...M3_ASSETS, ...M4_ASSETS, ...M5_ASSETS]

interface ExtQuote { price: number; change24h: number; spark: number[] }

// ─── Motor live trades ────────────────────────────────────────────────────────
interface OpenTrade {
  sym?: string; tf?: string; direction?: string
  entry?: number; sl?: number; tp?: number
  strategy?: string; grade?: string; opened_at?: string
}

function useOpenTrades() {
  const [trades, setTrades] = useState<OpenTrade[]>([])
  useEffect(() => {
    async function load() {
      try {
        const r = await fetch('/api/vps/motor-api/trades', { cache: 'no-store' })
        if (!r.ok) return
        const d = await r.json()
        setTrades(d?.open ?? [])
      } catch {}
    }
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [])
  return trades
}

function motorGradeColor(g?: string) {
  if (g === 'A+') return '#ffd700'
  if (g === 'A')  return '#34d399'
  if (g === 'B')  return '#60a5fa'
  return '#3a3f55'
}

interface Ticker { price: number; change24h: number; flash: 'up' | 'down' | null }

interface PriceAlert {
  id: string; symbol: Sym; condition: 'ABOVE' | 'BELOW'
  price: number; triggered: boolean; createdAt: string
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

// Reloj UTC aislado (PERF-6): el tick de 1s re-renderiza SOLO este span, no todo
// el RightBar (que vive en cada página del dashboard con ~13 estados). El resto
// del RightBar usa un utcNow más lento (30s) para sesiones/hora-local/NYSE.
function UtcClock({ color }: { color: string }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span style={{ fontFamily: 'monospace', fontSize: 14, color, letterSpacing: '0.04em' }}>
      {pad2(now.getUTCHours())}:{pad2(now.getUTCMinutes())}:{pad2(now.getUTCSeconds())}
    </span>
  )
}

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
    LTC: { price: 0, change24h: 0, flash: null },
  })
  const [sparks, setSparks] = useState<Record<string, number[]>>({})
  // Grupo expandido del acordeón de PRECIOS — se recuerda entre sesiones
  // (null = todo colapsado; al recargar vuelve a m1)
  const [motorTab, setMotorTabState] = useState<MotorTab | null>(() => {
    if (typeof window === 'undefined') return 'm1'
    try {
      const s = window.localStorage.getItem('sigma_rb_motor')
      return s === 'm2' || s === 'm3' || s === 'm4' || s === 'm5' ? s : 'm1'
    } catch { return 'm1' }
  })
  const setMotorTab = (t: MotorTab | null) => {
    setMotorTabState(t)
    try { if (t) localStorage.setItem('sigma_rb_motor', t) } catch {}
  }
  // Cotizaciones M2/M3 vía proxy Yahoo (precio + %24h + sparkline)
  const [extData, setExtData] = useState<Record<string, ExtQuote>>({})
  const [alerts,     setAlerts]     = useState<PriceAlert[]>([])
  const [showForm,   setShowForm]   = useState(false)
  const [formSym,    setFormSym]    = useState<Sym>('BTC')
  const [formCond,   setFormCond]   = useState<'ABOVE' | 'BELOW'>('ABOVE')
  const [formPrice,  setFormPrice]  = useState('')
  const [utcNow,     setUtcNow]     = useState(new Date())
  const [community,  setCommunity]  = useState<CommunitySetup[]>([])
  const [userVotes,  setUserVotes]  = useState<Record<string, 'up' | 'down'>>({})
  const motorTrades = useOpenTrades()

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

  // UTC clock — lento (30s): solo alimenta sesiones activas / hora local / NYSE.
  // El reloj con segundos vive aislado en <UtcClock/> (PERF-6).
  useEffect(() => {
    const id = setInterval(() => setUtcNow(new Date()), 30_000)
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

  // Sparklines 24h de cripto (M1) — un fetch al montar + refresh cada 5 min
  useEffect(() => {
    let dead = false
    async function loadSparks() {
      const next: Record<string, number[]> = {}
      await Promise.all(
        SYMBOLS.map(async s => {
          try {
            const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${s}USDT&interval=30m&limit=48`)
            if (!r.ok) return
            const raw: [number, string, string, string, string][] = await r.json()
            next[s] = raw.map(k => parseFloat(k[4]))
          } catch {}
        }),
      )
      if (!dead && Object.keys(next).length) setSparks(prev => ({ ...prev, ...next }))
    }
    loadSparks()
    const id = setInterval(loadSparks, 300_000)
    return () => { dead = true; clearInterval(id) }
  }, [])

  // Cotizaciones M2–M5 vía proxy Yahoo — se piden TODOS los grupos (los
  // headers colapsados del acordeón muestran el resumen ▲/▼ y lo necesitan),
  // refresh 90s
  useEffect(() => {
    let dead = false
    async function load() {
      const results = await Promise.all(ALL_EXT_SYMBOLS.map(async sym => {
        try {
          const r = await fetch(`/api/market/klines?symbol=${sym}&tf=1h`)
          if (!r.ok) return null
          const d = await r.json()
          return [sym, {
            price:     Number(d.price ?? 0),
            change24h: Number(d.change24h ?? 0),
            spark:     Array.isArray(d.klines) ? d.klines.slice(-24).map((k: { value: number }) => k.value) : [],
          }] as const
        } catch { return null }
      }))
      if (dead) return
      setExtData(prev => {
        const next = { ...prev }
        for (const it of results) if (it) next[it[0]] = it[1]
        return next
      })
    }
    load()
    const id = setInterval(load, 90_000)
    return () => { dead = true; clearInterval(id) }
  }, [])

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
        @keyframes rb-gold  { 0%,100%{background:rgba(57,226,230,0.10)} 50%{background:rgba(57,226,230,0.25)} }
        @keyframes rb-sess  { 0%,100%{opacity:1} 50%{opacity:0.55} }
        .rb-setup { transition: transform 0.15s ease, background 0.15s ease; }
        .rb-setup:hover { transform: translateY(-1px); }
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
            <UtcClock color={T.text} />
          </div>

          {SESSIONS.map(s => {
            const isOpen     = utcH >= s.from && utcH < s.to
            const hoursLeft  = isOpen ? s.to - utcH : null
            const hoursUntil = !isOpen ? (utcH < s.from ? s.from - utcH : 24 - utcH + s.from) : null
            const progress   = isOpen ? ((utcH - s.from) / (s.to - s.from)) * 100 : 0
            return (
              <div key={s.name} style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5,
                padding: '5px 6px', borderRadius: 3,
                background: isOpen ? `linear-gradient(90deg, ${s.color}16, ${s.color}06)` : 'transparent',
                border: `1px solid ${isOpen ? s.color + '40' : T.border}`,
                borderLeft: `2px solid ${isOpen ? s.color : T.border}`,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: isOpen ? s.color : T.muted,
                  boxShadow: isOpen ? `0 0 6px ${s.color}` : 'none',
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
                  {/* Progreso de la sesión */}
                  {isOpen && (
                    <div style={{ height: 2, background: T.border, borderRadius: 1, marginTop: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${progress}%`, height: '100%', borderRadius: 1,
                        background: `linear-gradient(90deg, ${s.color}66, ${s.color})`,
                        transition: 'width 1s linear',
                      }} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {activeSessions.length > 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginTop: 6,
              padding: '4px 7px', borderRadius: 3,
              background: 'rgba(57,226,230,0.08)', border: '1px solid rgba(57,226,230,0.3)',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: T.gold, boxShadow: `0 0 6px ${T.gold}`, animation: 'rb-pulse 1.6s infinite' }} />
              <span style={{ fontFamily: 'monospace', fontSize: 8, color: T.gold, letterSpacing: '0.12em' }}>
                OVERLAP: {activeSessions.map(s => s.label).join(' + ')}
              </span>
            </div>
          )}
        </div>

        {/* ══ PRECIOS — separados por motor ══ */}
        <Section label="PRECIOS" />

        {/* Acordeón por motor — los 5 siempre visibles; el abierto se recuerda.
            Headers colapsados muestran resumen ▲/▼ del grupo en vivo. */}
        <div style={{ padding: '0 0 8px' }}>
          {PRICE_MOTORS.map(m => {
            const open = motorTab === m.id
            let upN = 0, dnN = 0
            if (m.id === 'm1') {
              SYMBOLS.forEach(s => { const t = tickers[s]; if (t && t.price > 0) { if (t.change24h >= 0) upN++; else dnN++ } })
            } else {
              m.syms.forEach(s => { const q = extData[s]; if (q && q.price > 0) { if (q.change24h >= 0) upN++; else dnN++ } })
            }
            const nyseClosed = (m.id === 'm3' || m.id === 'm4' || m.id === 'm5') && (() => {
              const d = utcNow.getUTCDay()
              const h = utcNow.getUTCHours() + utcNow.getUTCMinutes() / 60
              return !(d >= 1 && d <= 5 && h >= 13.5 && h < 20)
            })()
            return (
              <div key={m.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                {/* Cabecera del grupo */}
                <button
                  onClick={() => setMotorTab(open ? null : m.id)}
                  aria-expanded={open}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                    padding: '8px 12px 8px 0', cursor: 'pointer',
                    background: open ? `${m.color}0d` : 'transparent',
                    border: 'none', borderLeft: `3px solid ${open ? m.color : 'transparent'}`,
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                >
                  <span aria-hidden style={{ width: 6, height: 6, borderRadius: 2, background: m.color, boxShadow: open ? `0 0 8px ${m.color}` : 'none', marginLeft: 9, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.14em', color: open ? m.color : T.dimText, whiteSpace: 'nowrap' }}>{m.label}</span>
                  <span style={{ flex: 1 }} />
                  {(upN + dnN) > 0 && (
                    <span style={{ fontFamily: 'monospace', fontSize: 8, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                      <span style={{ color: T.green }}>▲{upN}</span>
                      <span style={{ color: T.red, marginLeft: 5 }}>▼{dnN}</span>
                    </span>
                  )}
                  <span aria-hidden style={{ fontFamily: 'monospace', fontSize: 9, color: T.muted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>▾</span>
                </button>

                {/* Aviso NYSE cerrado — dentro del grupo expandido */}
                {open && nyseClosed && (
                  <div style={{ padding: '3px 12px 6px', fontFamily: 'monospace', fontSize: 8, letterSpacing: '0.1em', color: T.muted }}>
                    ◦ NYSE CERRADO · último cierre
                  </div>
                )}

                {/* M1 — cripto en tiempo real (Binance WS) */}
                {open && m.id === 'm1' && SYMBOLS.map(sym => {
                  const t    = tickers[sym]
                  const up   = t.change24h >= 0
                  const bg   = t.flash === 'up' ? T.green + '22' : t.flash === 'down' ? T.red + '22' : 'transparent'
                  return (
                    <div key={sym} style={{ padding: '7px 12px', transition: 'background 0.15s', background: bg, borderTop: `1px solid ${T.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.15em', color: T.gold }}>{SYM_LABEL[sym]}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 9, color: up ? T.green : T.red }}>
                          {up ? '▲' : '▼'} {Math.abs(t.change24h).toFixed(2)}%
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 13, color: T.text, letterSpacing: '0.02em', lineHeight: 1 }}>
                          {fmtPrice(t.price)}
                        </span>
                        <Spark data={sparks[sym]} up={up} />
                      </div>
                    </div>
                  )
                })}

                {/* M2–M5 — commodities, stocks, índices y ETFs país vía proxy Yahoo */}
                {open && m.id !== 'm1' && m.syms.map(sym => {
                  const q  = extData[sym]
                  const up = (q?.change24h ?? 0) >= 0
                  return (
                    <div key={sym} style={{ padding: '7px 12px', borderTop: `1px solid ${T.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.15em', color: T.gold }}>{sym}</span>
                          {sym === 'SPX' && (
                            <span style={{ fontFamily: 'monospace', fontSize: 7, letterSpacing: '0.1em', color: T.muted, border: `1px solid ${T.muted}40`, padding: '1px 4px' }}>ÍNDICE</span>
                          )}
                        </div>
                        {q ? (
                          <span style={{ fontFamily: 'monospace', fontSize: 9, color: up ? T.green : T.red }}>
                            {up ? '▲' : '▼'} {Math.abs(q.change24h).toFixed(2)}%
                          </span>
                        ) : (
                          <span style={{ fontFamily: 'monospace', fontSize: 9, color: T.muted }}>…</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 13, color: T.text, letterSpacing: '0.02em', lineHeight: 1 }}>
                          {q && q.price > 0 ? fmtPrice(q.price) : '—'}
                        </span>
                        <Spark data={q?.spark} up={up} />
                      </div>
                    </div>
                  )
                })}
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

        {/* ══ SETUPS (motor live) ══ */}
        <Section label="SETUPS" />
        {motorTrades.length === 0
          ? <div style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 10, color: T.muted }}>Sin posiciones abiertas</div>
          : motorTrades.map((t, i) => <MotorSetupCard key={i} t={t} />)
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
    <div className="rb-setup" style={{
      padding: '10px 12px', borderBottom: `1px solid ${T.border}`,
      borderLeft: `2px solid ${badgeColor}`,
      background: `linear-gradient(90deg, ${badgeColor}0a, transparent 55%)`,
    }}>
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

// ─── MotorSetupCard: live open trades from the motor ─────────────────────────
function MotorSetupCard({ t }: { t: OpenTrade }) {
  const isLong   = (t.direction ?? '') !== 'short'
  const dirColor = isLong ? T.green : T.red
  const sym      = t.sym ?? '?'
  const tf       = t.tf?.toUpperCase() ?? ''
  const gc       = motorGradeColor(t.grade)

  return (
    <div className="rb-setup" style={{
      padding: '10px 12px', borderBottom: `1px solid ${T.border}`,
      borderLeft: `2px solid ${dirColor}`,
      background: `linear-gradient(90deg, ${dirColor}0a, transparent 55%)`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: dirColor, background: dirColor + '1a', padding: '1px 5px', letterSpacing: '0.08em', borderRadius: 2 }}>
            {isLong ? 'LONG' : 'SHORT'}
          </span>
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: T.muted }}>{tf}</span>
        </div>
        <span style={{
          fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color: gc,
          background: gc + '20', border: `1px solid ${gc}40`, padding: '1px 5px',
          borderRadius: 2, boxShadow: `0 0 8px ${gc}40`,
        }}>
          {t.grade ?? '?'}
        </span>
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 11, color: T.text, marginBottom: 4 }}>{sym}</div>
      {t.strategy && (
        <div style={{ fontFamily: 'monospace', fontSize: 9, color: T.gold, letterSpacing: '0.05em', marginBottom: 4 }}>
          {t.strategy.slice(0, 20)}
        </div>
      )}
      {t.entry != null && t.sl != null && t.tp != null && (
        <LevelBar entry={t.entry} sl={t.sl} tp={t.tp} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {t.entry != null && <Row l="E"  v={t.entry} c={T.dimText} />}
        {t.sl    != null && <Row l="SL" v={t.sl}    c={T.red + 'cc'} />}
        {t.tp    != null && <Row l="TP" v={t.tp}    c={T.green + 'cc'} />}
      </div>
    </div>
  )
}

// ─── Sparkline 24h ────────────────────────────────────────────────────────────
function Spark({ data, up }: { data?: number[]; up: boolean }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const W = 62, H = 18
  const pts  = data.map((v, i) => [(i / (data.length - 1)) * W, H - 1.5 - ((v - min) / range) * (H - 3)] as const)
  const line = pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const color = up ? T.green : T.red
  return (
    <svg width={W} height={H} style={{ display: 'block', flexShrink: 0 }} aria-hidden>
      <polygon points={`0,${H} ${line} ${W},${H}`} fill={color} opacity="0.08" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.1" opacity="0.85" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Barra visual SL → Entry → TP ────────────────────────────────────────────
function LevelBar({ entry, sl, tp }: { entry: number; sl: number; tp: number }) {
  const lo = Math.min(sl, tp), hi = Math.max(sl, tp)
  if (!(hi > lo)) return null
  const ePos = Math.max(0, Math.min(100, ((entry - lo) / (hi - lo)) * 100))
  const leftColor  = sl <= tp ? T.red : T.green
  const rightColor = sl <= tp ? T.green : T.red
  return (
    <div style={{
      position: 'relative', height: 4, borderRadius: 2, margin: '7px 0 3px',
      background: `linear-gradient(90deg, ${leftColor}55, ${rightColor}55)`,
    }}>
      <span style={{
        position: 'absolute', left: `${ePos}%`, top: '50%',
        transform: 'translate(-50%,-50%)',
        width: 7, height: 7, borderRadius: '50%',
        background: T.gold, border: `1px solid ${T.bg}`,
        boxShadow: `0 0 5px ${T.gold}aa`,
      }} />
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
