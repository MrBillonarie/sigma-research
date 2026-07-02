'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/app/lib/supabase'
import { usePortfolio } from '@/app/lib/usePortfolio'
import { useFireProfile } from '@/app/lib/useFireProfile'
import type { User } from '@supabase/supabase-js'

const GOLD   = '#F5C842'
const BG     = '#04050a'
const BORDER = 'rgba(255,255,255,0.08)'
const TEXT   = '#e8e9f0'
const MUTED  = 'rgba(255,255,255,0.38)'
const DIM    = 'rgba(255,255,255,0.55)'
const RED    = '#f87171'
const GREEN  = '#34d399'
const MONO   = "var(--font-dm-mono,'DM Mono',monospace)"

const MIN_REP = 10

interface Profile {
  id: string; username: string | null; reputation: number
  setups_published: number; setups_won: number
}

type SetupTipo = 'LONG' | 'SHORT' | 'LP'
const TF_OPTIONS = ['1m','5m','15m','1H','4H','1D','1W']

// ─── Shared styles ────────────────────────────────────────────────────────────
const inputCss: React.CSSProperties = {
  background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, outline: 'none', color: TEXT,
  fontFamily: MONO, fontSize: 13, padding: '12px 16px', width: '100%',
  transition: 'border-color 0.2s, box-shadow 0.2s',
}
const labelCss: React.CSSProperties = {
  fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: MUTED, marginBottom: 8, display: 'block',
}
const btnPrimary: React.CSSProperties = {
  padding: '12px 24px', background: GOLD, color: '#000', fontWeight: 700,
  fontFamily: MONO, fontSize: 11, letterSpacing: '0.15em', border: 'none',
  borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s, transform 0.15s',
}
const btnOutline: React.CSSProperties = {
  padding: '12px 24px', background: 'transparent', color: GOLD,
  fontFamily: MONO, fontSize: 11, letterSpacing: '0.15em',
  border: `1px solid ${GOLD}80`, borderRadius: 8, cursor: 'pointer',
  transition: 'background 0.15s',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={labelCss}>{label}</span>
      {children}
    </div>
  )
}

// Fila plana de panel de ajustes: etiqueta + descripción a la izquierda,
// control a la derecha, separadas por un divisor fino (sin tarjetas).
function Row({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="pf-row" style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 28, padding: '26px 4px', borderBottom: '1px solid rgba(255,255,255,0.06)', alignItems: 'start' }}>
      <div>
        <div style={{ fontFamily: MONO, fontSize: 12, color: TEXT, fontWeight: 600, marginBottom: 6 }}>{label}</div>
        {hint && <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, lineHeight: 1.7 }}>{hint}</div>}
      </div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  )
}

interface TradeStats {
  total: number; wins: number; winRate: number; pnl: number
  best: number; worst: number; streak: number
}

function calcTradeStats(): TradeStats | null {
  try {
    const raw = localStorage.getItem('sigma_trades')
    if (!raw) return null
    const trades: { pnl_usd: number; resultado: string }[] = JSON.parse(raw)
    if (!trades.length) return null
    const wins = trades.filter(t => t.resultado === 'WIN').length
    const pnls = trades.map(t => t.pnl_usd)
    let streak = 0
    for (const t of trades) { if (t.resultado === 'WIN') streak++; else break }
    return {
      total: trades.length, wins,
      winRate: Math.round((wins / trades.length) * 100),
      pnl: pnls.reduce((a, b) => a + b, 0),
      best: Math.max(...pnls), worst: Math.min(...pnls), streak,
    }
  } catch { return null }
}

export default function PerfilPage() {
  const router = useRouter()
  const { totalUSD: portfolioTotal, ready: portfolioReady } = usePortfolio()
  const { profile: fireProfile } = useFireProfile()
  const [user,        setUser]        = useState<User | null>(null)
  const [profile,     setProfile]     = useState<Profile | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [tradeStats,  setTradeStats]  = useState<TradeStats | null>(null)
  const [copytrading, setCopytrading] = useState<{ enabled: boolean; capital: number } | null>(null)
  const [nombre,      setNombre]      = useState('')
  const [savingName,  setSavingName]  = useState(false)
  const [nameMsg,     setNameMsg]     = useState('')

  const [pwdNew,      setPwdNew]      = useState('')
  const [pwdConfirm,  setPwdConfirm]  = useState('')
  const [savingPwd,   setSavingPwd]   = useState(false)
  const [pwdMsg,      setPwdMsg]      = useState('')
  const [pwdError,    setPwdError]    = useState('')

  const [avatarUrl,     setAvatarUrl]     = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarMsg,     setAvatarMsg]     = useState('')
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Credenciales de Binance/IBKR/MT5 guardadas con una versión anterior de
  // esta página — ya no hay formularios para editarlas, pero quien las
  // guardó antes debe poder borrarlas.
  const [hasStoredCreds, setHasStoredCreds] = useState(false)
  const [clearingCreds,  setClearingCreds]  = useState(false)
  const [confirmClear,   setConfirmClear]   = useState(false)
  const [clearMsg,       setClearMsg]       = useState('')

  const emptySetup = { par: '', tipo: 'LONG' as SetupTipo, entry: '', sl: '', tp: '', rangeLow: '', rangeHigh: '', feeTier: '', protocol: '', rr: '', timeframe: '4H', metodologia: '', nota: '' }
  const [setupForm,       setSetupForm]       = useState(emptySetup)
  const [publishingSetup, setPublishingSetup] = useState(false)
  const [setupMsg,        setSetupMsg]        = useState('')
  const [setupError,      setSetupError]      = useState('')

  const [tab, setTab] = useState<'cuenta' | 'seguridad' | 'comunidad' | 'sesion'>('cuenta')

  // Deep-links del buscador global (#cambiar-pwd, #publicar-setup, etc.) → pestaña correcta
  useEffect(() => {
    const h = window.location.hash
    if (h === '#cambiar-pwd' || h === '#credenciales-guardadas' || h === '#binance-keys') setTab('seguridad')
    else if (h === '#publicar-setup') setTab('comunidad')
    else if (h === '#sesion') setTab('sesion')
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace('/login'); return }
      setUser(data.user)
      setNombre(data.user.user_metadata?.nombre ?? '')
      // Cargar avatar si existe
      const avatarMeta = data.user.user_metadata?.avatar_url as string | undefined
      if (avatarMeta) setAvatarUrl(avatarMeta)

      const { data: prof } = await supabase
        .from('profiles')
        .upsert({ id: data.user.id }, { onConflict: 'id', ignoreDuplicates: true })
        .select('id, username, reputation, setups_published, setups_won')
        .maybeSingle()
      if (prof) setProfile(prof as Profile)
      else {
        const { data: existing } = await supabase
          .from('profiles')
          .select('id, username, reputation, setups_published, setups_won')
          .eq('id', data.user.id)
          .maybeSingle()
        if (existing) setProfile(existing as Profile)
      }

      const { data: config } = await supabase
        .from('user_config')
        .select('copytrading_enabled, copytrading_capital_usd, binance_api_key, binance_api_secret, ibkr_flex_token, ibkr_query_id, mt5_login, mt5_password, mt5_server')
        .eq('user_id', data.user.id)
        .maybeSingle()
      if (config) {
        setCopytrading({ enabled: !!config.copytrading_enabled, capital: config.copytrading_capital_usd ?? 0 })
        setHasStoredCreds(!!(
          config.binance_api_key || config.binance_api_secret ||
          config.ibkr_flex_token || config.ibkr_query_id ||
          config.mt5_login || config.mt5_password || config.mt5_server
        ))
      }

      setLoading(false)
      setTradeStats(calcTradeStats())
    })
  }, [router])

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    setSavingName(true); setNameMsg('')
    const { error } = await supabase.auth.updateUser({ data: { nombre } })
    if (!error && user) {
      await supabase.from('profiles').upsert({ id: user.id, username: nombre }, { onConflict: 'id' })
      setProfile(p => p ? { ...p, username: nombre } : p)
    }
    setSavingName(false)
    setNameMsg(error ? `Error: ${error.message}` : 'Nombre actualizado.')
  }

  async function handlePublishSetup(e: React.FormEvent) {
    e.preventDefault()
    setSetupMsg(''); setSetupError('')
    if (!setupForm.par.trim()) { setSetupError('El par es requerido.'); return }
    setPublishingSetup(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSetupError('No autenticado.'); setPublishingSetup(false); return }
    const isLP = setupForm.tipo === 'LP'
    const res = await fetch('/api/community-setups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        par:        setupForm.par.trim().toUpperCase(),
        tipo:       setupForm.tipo,
        entry:      !isLP && setupForm.entry    ? parseFloat(setupForm.entry)    : null,
        sl:         !isLP && setupForm.sl       ? parseFloat(setupForm.sl)       : null,
        tp:         !isLP && setupForm.tp       ? parseFloat(setupForm.tp)       : null,
        range_low:   isLP && setupForm.rangeLow  ? parseFloat(setupForm.rangeLow)  : null,
        range_high:  isLP && setupForm.rangeHigh ? parseFloat(setupForm.rangeHigh) : null,
        fee_tier:    isLP ? setupForm.feeTier   || null : null,
        protocol:    isLP ? setupForm.protocol  || null : null,
        rr:         !isLP && setupForm.rr       ? parseFloat(setupForm.rr)       : null,
        timeframe:  setupForm.timeframe  || null,
        metodologia: setupForm.metodologia || null,
        nota:        setupForm.nota        || null,
      }),
    })
    setPublishingSetup(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setSetupError((err as { error?: string }).error ?? 'Error al publicar.')
    } else {
      setSetupMsg('Setup publicado. Aparecerá en la barra lateral para todos.')
      setSetupForm(emptySetup)
      setProfile(p => p ? { ...p, setups_published: p.setups_published + 1 } : p)
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 2 * 1024 * 1024) { setAvatarMsg('Máximo 2MB'); return }
    setUploadingAvatar(true); setAvatarMsg('')
    try {
      const ext  = file.name.split('.').pop()
      const path = `avatars/${user.id}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = urlData.publicUrl
      await supabase.auth.updateUser({ data: { avatar_url: url } })
      setAvatarUrl(url)
      setAvatarMsg('Foto actualizada.')
    } catch (err) {
      setAvatarMsg(`Error: ${err instanceof Error ? err.message : 'No se pudo subir la imagen'}`)
    }
    setUploadingAvatar(false)
    setTimeout(() => setAvatarMsg(''), 3000)
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdMsg(''); setPwdError('')
    if (pwdNew.length < 8)     { setPwdError('Mínimo 8 caracteres.'); return }
    if (pwdNew !== pwdConfirm) { setPwdError('Las contraseñas no coinciden.'); return }
    setSavingPwd(true)
    const { error } = await supabase.auth.updateUser({ password: pwdNew })
    setSavingPwd(false)
    if (error) { setPwdError(error.message) }
    else { setPwdMsg('Contraseña actualizada.'); setPwdNew(''); setPwdConfirm('') }
  }

  async function handleClearCredentials() {
    if (!confirmClear) { setConfirmClear(true); return }
    setClearingCreds(true); setClearMsg('')
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) { setClearingCreds(false); setConfirmClear(false); setClearMsg('Tu sesión expiró. Vuelve a iniciar sesión.'); return }
    const { error } = await supabase
      .from('user_config')
      .update({
        binance_api_key: null, binance_api_secret: null,
        ibkr_flex_token: null, ibkr_query_id: null,
        mt5_login: null, mt5_password: null, mt5_server: null,
      })
      .eq('user_id', u.id)
    setClearingCreds(false); setConfirmClear(false)
    if (error) setClearMsg(`Error: ${error.message}`)
    else { setClearMsg('Credenciales guardadas eliminadas.'); setHasStoredCreds(false) }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    const SIGMA_KEYS = ['sigma_portfolio','sigma_positions','sigma_trades','sigma_fire_target','sigma_montecarlo','sigma_activity','sigma_portfolio_total','sigma_setups','sigma_alerts','sigma_lp_capital','sigma_fire_gasto','sigma_fire_ahorro','sigma_fire_edad']
    SIGMA_KEYS.forEach(k => { try { localStorage.removeItem(k) } catch {} })
    router.push('/')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: MONO, fontSize: 12, color: MUTED }}>Cargando perfil…</span>
    </div>
  )

  const email    = user?.email ?? ''
  const provider = user?.app_metadata?.provider ?? 'email'
  const isOAuth  = provider !== 'email'
  const plan     = (user?.app_metadata?.plan as string) ?? 'free'
  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'
  const lastLogin = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

  const displayName = nombre || profile?.username || email.split('@')[0] || 'TRADER'
  const initials    = displayName.slice(0, 2).toUpperCase()

  const fireTarget = fireProfile.fire_completed && fireProfile.fire_gasto_mensual
    ? (fireProfile.fire_gasto_mensual * 12) / 0.04
    : null

  const sigmaId = `Σ-${(user?.id ?? '0000').replace(/-/g, '').slice(0, 4).toUpperCase()}`

  const TABS = [
    { id: 'cuenta'    as const, label: 'CUENTA' },
    { id: 'seguridad' as const, label: 'SEGURIDAD' },
    { id: 'comunidad' as const, label: 'COMUNIDAD' },
    { id: 'sesion'    as const, label: 'SESIÓN' },
  ]

  const headerStats: Array<{ label: string; val: string; color: string; href?: string }> = [
    { label: 'META FIRE',   val: fireTarget ? `$${Math.round(fireTarget).toLocaleString('es-CL')}` : '—', color: fireTarget ? GOLD : MUTED, href: '/fire' },
    { label: 'CAPITAL',     val: portfolioReady ? `$${Math.round(portfolioTotal).toLocaleString('es-CL')}` : '—', color: TEXT, href: '/portafolio' },
    { label: 'COPYTRADING', val: copytrading?.enabled ? `$${Math.round(copytrading.capital).toLocaleString('es-CL')}` : 'NO INSCRITO', color: copytrading?.enabled ? GREEN : MUTED },
    { label: 'REPUTACIÓN',  val: String(profile?.reputation ?? 0), color: (profile?.reputation ?? 0) >= 50 ? GOLD : (profile?.reputation ?? 0) >= 20 ? GREEN : DIM },
    ...(tradeStats ? [{ label: 'WIN RATE', val: `${tradeStats.winRate}%`, color: tradeStats.winRate >= 50 ? GREEN : RED }] : []),
  ]

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: MONO }}>
      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes pf-spin { to { transform: rotate(360deg) } }
        .perf-input:focus { border-color:${GOLD}!important; box-shadow:0 0 0 2px rgba(245,200,66,0.15)!important; }
        .btn-primary:hover { background:#e0b438!important; transform:scale(1.01); }
        .btn-outline:hover { background:rgba(245,200,66,0.08)!important; }
        .pf-stat { transition: background 0.15s; text-decoration: none; display: block; }
        .pf-stat:hover { background: rgba(245,200,66,0.05); }
        .pf-tab:hover { color: ${TEXT} !important; }
        @media(max-width:768px){
          .pf-row  { grid-template-columns: 1fr !important; gap: 10px !important; }
          .pf-head { flex-direction: column !important; align-items: flex-start !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '64px 24px 90px' }}>

        {/* ── Título ── */}
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: MUTED, marginBottom: 8 }}>
          {'// PANEL DE USUARIO'}
        </div>
        <h1 style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 'clamp(38px,5vw,60px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: '0 0 24px' }}>
          <span style={{ color: TEXT }}>MI </span>
          <span style={{ background: `linear-gradient(135deg,${GOLD},#f0cc5a)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>PERFIL</span>
        </h1>

        {/* ── Banda de identidad ── */}
        <div style={{ position: 'relative', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden', marginBottom: 36, background: '#0b0d14' }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 70% 120% at 0% 0%, rgba(245,200,66,0.08), transparent 55%)' }} />
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(245,200,66,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(245,200,66,0.025) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />

          <div className="pf-head" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 24, padding: '30px 32px', flexWrap: 'wrap' }}>
            {/* Avatar con anillo dorado animado */}
            <div style={{ position: 'relative', width: 92, height: 92, flexShrink: 0 }}>
              <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', background: `conic-gradient(from 0deg, transparent 0%, ${GOLD} 18%, transparent 40%)`, animation: 'pf-spin 5s linear infinite' }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden', border: '3px solid #0b0d14', background: 'rgba(245,200,66,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {avatarUrl
                  ? <Image src={avatarUrl} alt="avatar" width={92} height={92} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                  : <span style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 34, color: GOLD, letterSpacing: '0.05em' }}>{initials}</span>}
              </div>
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                title="Cambiar foto"
                style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: '50%', background: GOLD, border: '2px solid #0b0d14', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, zIndex: 2 }}
              >
                {uploadingAvatar ? '…' : '✎'}
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
            </div>

            {/* Identidad */}
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 34, color: TEXT, letterSpacing: '0.04em', lineHeight: 1 }}>{displayName}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: '0.15em' }}>{sigmaId}</span>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, margin: '6px 0 12px' }}>{email}</div>
              <div style={{ display: 'flex', gap: '6px 18px', flexWrap: 'wrap', fontFamily: MONO, fontSize: 10, color: MUTED }}>
                <span><span style={{ color: 'rgba(255,255,255,0.25)' }}>Miembro desde </span>{createdAt}</span>
                <span><span style={{ color: 'rgba(255,255,255,0.25)' }}>Último acceso </span>{lastLogin}</span>
                <span><span style={{ color: 'rgba(255,255,255,0.25)' }}>Acceso vía </span>{provider.toUpperCase()}</span>
              </div>
              {avatarMsg && <div style={{ fontFamily: MONO, fontSize: 10, color: avatarMsg.startsWith('Error') ? RED : GREEN, marginTop: 8 }}>{avatarMsg}</div>}
            </div>

            {/* Plan + estado */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', borderRadius: 6, padding: '6px 16px',
                color: plan === 'pro' ? '#000' : DIM,
                background: plan === 'pro' ? `linear-gradient(135deg,${GOLD},#e0b438)` : 'rgba(255,255,255,0.05)',
                border: plan === 'pro' ? 'none' : '1px solid rgba(255,255,255,0.12)',
                boxShadow: plan === 'pro' ? '0 0 18px rgba(245,200,66,0.35)' : 'none',
              }}>
                {plan === 'pro' ? 'PLAN PRO' : 'PLAN FREE'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: MONO, fontSize: 10, color: GREEN, letterSpacing: '0.1em' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN, animation: 'pulse-dot 2s ease infinite' }} />
                CUENTA ACTIVA
              </span>
            </div>
          </div>

          {/* Stats del trader — strip plano con divisores */}
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${headerStats.length}, 1fr)`, borderTop: `1px solid ${BORDER}` }}>
            {headerStats.map((s, i) => {
              const inner = (
                <>
                  <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 24, color: s.color, lineHeight: 1, marginBottom: 5 }}>{s.val}</div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: '0.15em' }}>{s.label}</div>
                </>
              )
              const st: React.CSSProperties = { padding: '16px 12px', borderLeft: i > 0 ? `1px solid ${BORDER}` : 'none', textAlign: 'center' }
              return s.href
                ? <a key={s.label} href={s.href} className="pf-stat" style={st}>{inner}</a>
                : <div key={s.label} style={st}>{inner}</div>
            })}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${BORDER}`, marginBottom: 8, flexWrap: 'wrap' }}>
          {TABS.map(t => {
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className="pf-tab" style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '12px 20px', fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 17, letterSpacing: '0.08em',
                color: active ? GOLD : MUTED,
                borderBottom: `2px solid ${active ? GOLD : 'transparent'}`,
                marginBottom: -1, transition: 'color 0.15s, border-color 0.15s',
              }}>
                {t.label}
              </button>
            )
          })}
        </div>

        {/* ══ CUENTA ══ */}
        {tab === 'cuenta' && (
          <div>

            <Row label="Nombre visible" hint="Cómo te ven otros usuarios en la comunidad y en tus setups publicados.">
              <form onSubmit={handleSaveName} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <input
                  type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="Tu nombre" className="perf-input" style={{ ...inputCss, maxWidth: 320 }}
                />
                <button type="submit" disabled={savingName} className="btn-primary" style={{ ...btnPrimary, opacity: savingName ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                  {savingName ? 'GUARDANDO…' : 'GUARDAR'}
                </button>
              </form>
              {nameMsg && <div style={{ fontFamily: MONO, fontSize: 11, color: GREEN, marginTop: 12 }}>{nameMsg}</div>}
            </Row>

            {tradeStats && (
              <Row label="Performance de trading" hint="Sincronizado desde tu Journal.">
                <div style={{ display: 'flex', gap: '20px 40px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'TOTAL TRADES', val: String(tradeStats.total),                                                                   color: GOLD },
                    { label: 'WIN RATE',     val: `${tradeStats.winRate}%`,                                                                   color: tradeStats.winRate >= 50 ? GREEN : RED },
                    { label: 'PNL TOTAL',    val: `${tradeStats.pnl >= 0 ? '+' : ''}$${Math.round(tradeStats.pnl).toLocaleString('es-CL')}`, color: tradeStats.pnl >= 0 ? GREEN : RED },
                    { label: 'MEJOR',        val: `+$${Math.round(tradeStats.best).toLocaleString('es-CL')}`,                                color: GREEN },
                    { label: 'PEOR',         val: `$${Math.round(tradeStats.worst).toLocaleString('es-CL')}`,                                color: RED },
                    { label: 'STREAK',       val: `${tradeStats.streak}W`,                                                                   color: tradeStats.streak >= 3 ? GOLD : DIM },
                  ].map(({ label, val, color }) => (
                    <div key={label}>
                      <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 24, color, lineHeight: 1, marginBottom: 4 }}>{val}</div>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: '0.12em' }}>{label}</div>
                    </div>
                  ))}
                </div>
              </Row>
            )}

            {!fireProfile.fire_completed && (
              <Row label="Plan FIRE" hint="Define tu meta de independencia financiera para verla en el panel.">
                <a href="/fire" className="btn-outline" style={{ ...btnOutline, display: 'inline-block', textDecoration: 'none' }}>
                  CONFIGURAR EN /FIRE →
                </a>
              </Row>
            )}

          </div>
        )}

        {/* ══ SEGURIDAD ══ */}
        {tab === 'seguridad' && (
          <div>
            {hasStoredCreds && (
              <Row label="Credenciales guardadas" hint="Claves de Binance, IBKR o MetaTrader 5 guardadas en una versión anterior. Ya no se gestionan ni sincronizan — puedes borrarlas de forma permanente.">
                {clearMsg && <div style={{ fontFamily: MONO, fontSize: 11, color: clearMsg.startsWith('Error') ? RED : GREEN, marginBottom: 12 }}>{clearMsg}</div>}
                <button
                  type="button" onClick={handleClearCredentials} disabled={clearingCreds}
                  className="btn-outline" style={{ ...btnOutline, color: RED, borderColor: RED + '80', opacity: clearingCreds ? 0.6 : 1 }}
                >
                  {clearingCreds ? 'BORRANDO…' : confirmClear ? '¿SEGURO? CONFIRMAR BORRADO' : 'BORRAR CREDENCIALES GUARDADAS'}
                </button>
                {confirmClear && !clearingCreds && (
                  <button
                    type="button" onClick={() => setConfirmClear(false)}
                    style={{ marginLeft: 10, padding: '12px 20px', background: 'transparent', color: MUTED, fontFamily: MONO, fontSize: 11, letterSpacing: '0.15em', border: `1px solid ${BORDER}`, borderRadius: 8, cursor: 'pointer' }}
                  >
                    CANCELAR
                  </button>
                )}
              </Row>
            )}

            {!isOAuth ? (
              <Row label="Cambiar contraseña" hint="Mínimo 8 caracteres. El cambio se aplica de inmediato.">
                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 380 }}>
                  <Field label="Nueva contraseña">
                    <input type="password" value={pwdNew} onChange={e => setPwdNew(e.target.value)} placeholder="Mínimo 8 caracteres" className="perf-input" style={inputCss} />
                  </Field>
                  <Field label="Confirmar contraseña">
                    <input type="password" value={pwdConfirm} onChange={e => setPwdConfirm(e.target.value)} placeholder="Repite la nueva contraseña" className="perf-input" style={inputCss} />
                  </Field>
                  {pwdError && <div style={{ fontFamily: MONO, fontSize: 11, color: RED }}>{pwdError}</div>}
                  {pwdMsg   && <div style={{ fontFamily: MONO, fontSize: 11, color: GREEN }}>{pwdMsg}</div>}
                  <div>
                    <button type="submit" disabled={savingPwd} className="btn-outline" style={{ ...btnOutline, opacity: savingPwd ? 0.6 : 1 }}>
                      {savingPwd ? 'ACTUALIZANDO…' : 'ACTUALIZAR CONTRASEÑA'}
                    </button>
                  </div>
                </form>
              </Row>
            ) : (
              <Row label="Contraseña" hint="Tu acceso está gestionado por un proveedor externo.">
                <span style={{ fontFamily: MONO, fontSize: 11, color: DIM, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '8px 14px', display: 'inline-block', letterSpacing: '0.08em' }}>
                  GESTIONADA POR {provider.toUpperCase()}
                </span>
              </Row>
            )}
          </div>
        )}

        {/* ══ COMUNIDAD ══ */}
        {tab === 'comunidad' && (
          <div>
            {profile !== null && (
              <Row
                label="Reputación"
                hint={profile.reputation >= 50
                  ? <span style={{ color: GOLD }}>★ Trader Senior — tus setups se publican con destaque.</span>
                  : profile.reputation >= 20
                    ? <span style={{ color: GREEN }}>◆ Trader Verificado — tus setups son visibles en la sidebar.</span>
                    : profile.reputation >= MIN_REP
                      ? 'Puedes publicar setups. Sigue obteniendo votos para subir de rango.'
                      : <span>Necesitas <strong style={{ color: GOLD }}>{MIN_REP - profile.reputation} puntos más</strong> de reputación para publicar setups.</span>}
              >
                <div style={{ display: 'flex', gap: '20px 40px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'REPUTACIÓN',    val: profile.reputation,       color: profile.reputation >= 50 ? GOLD : profile.reputation >= 20 ? GREEN : DIM },
                    { label: 'SETUPS PUB.',   val: profile.setups_published, color: DIM },
                    { label: 'TP ALCANZADOS', val: profile.setups_won,       color: GREEN },
                  ].map(({ label, val, color }) => (
                    <div key={label}>
                      <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 28, color, lineHeight: 1, marginBottom: 4 }}>{val}</div>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: '0.12em' }}>{label}</div>
                    </div>
                  ))}
                </div>
              </Row>
            )}

            <Row label="Publicar setup" hint={`Los setups publicados aparecen en la barra lateral para todos los usuarios. Reputación mínima: ${MIN_REP}.`}>
              {profile !== null && (profile.reputation ?? 0) < MIN_REP ? (
                <div style={{ fontFamily: MONO, fontSize: 11, color: DIM, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 18px' }}>
                  Reputación actual: <span style={{ color: GOLD }}>{profile.reputation}</span> / {MIN_REP} requeridos.
                </div>
              ) : (
                <form onSubmit={handlePublishSetup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Par (ej. BTCUSDT)">
                      <input type="text" value={setupForm.par} onChange={e => setSetupForm(f => ({ ...f, par: e.target.value }))} placeholder="BTCUSDT" className="perf-input" style={inputCss} />
                    </Field>
                    <Field label="Tipo">
                      <select value={setupForm.tipo} onChange={e => setSetupForm(f => ({ ...f, tipo: e.target.value as SetupTipo }))} className="perf-input" style={inputCss}>
                        <option value="LONG">LONG</option>
                        <option value="SHORT">SHORT</option>
                        <option value="LP">LP (Liquidity)</option>
                      </select>
                    </Field>
                  </div>
                  {setupForm.tipo !== 'LP' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                      {['entry', 'sl', 'tp', 'rr'].map(f => (
                        <Field key={f} label={f.toUpperCase()}>
                          <input type="number" value={(setupForm as Record<string, string | number>)[f]} onChange={e => setSetupForm(prev => ({ ...prev, [f]: e.target.value }))} placeholder="0" className="perf-input" style={inputCss} />
                        </Field>
                      ))}
                    </div>
                  )}
                  {setupForm.tipo === 'LP' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <Field label="Rango Bajo"><input type="number" value={setupForm.rangeLow} onChange={e => setSetupForm(f => ({ ...f, rangeLow: e.target.value }))} placeholder="1580" className="perf-input" style={inputCss} /></Field>
                      <Field label="Rango Alto"><input type="number" value={setupForm.rangeHigh} onChange={e => setSetupForm(f => ({ ...f, rangeHigh: e.target.value }))} placeholder="1950" className="perf-input" style={inputCss} /></Field>
                      <Field label="Protocol"><input type="text" value={setupForm.protocol} onChange={e => setSetupForm(f => ({ ...f, protocol: e.target.value }))} placeholder="Uniswap v3" className="perf-input" style={inputCss} /></Field>
                      <Field label="Fee Tier"><input type="text" value={setupForm.feeTier} onChange={e => setSetupForm(f => ({ ...f, feeTier: e.target.value }))} placeholder="0.05%" className="perf-input" style={inputCss} /></Field>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Timeframe">
                      <select value={setupForm.timeframe} onChange={e => setSetupForm(f => ({ ...f, timeframe: e.target.value }))} className="perf-input" style={inputCss}>
                        {TF_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                        <option value="—">—</option>
                      </select>
                    </Field>
                    <Field label="Metodología">
                      <input type="text" value={setupForm.metodologia} onChange={e => setSetupForm(f => ({ ...f, metodologia: e.target.value }))} placeholder="OB+MACD" className="perf-input" style={inputCss} />
                    </Field>
                  </div>
                  <Field label="Nota">
                    <textarea value={setupForm.nota} onChange={e => setSetupForm(f => ({ ...f, nota: e.target.value }))} placeholder="Describe el setup brevemente..." rows={3} className="perf-input" style={{ ...inputCss, resize: 'vertical', lineHeight: 1.5 }} />
                  </Field>
                  {setupError && <div style={{ fontFamily: MONO, fontSize: 11, color: RED }}>{setupError}</div>}
                  {setupMsg   && <div style={{ fontFamily: MONO, fontSize: 11, color: GREEN }}>{setupMsg}</div>}
                  <div>
                    <button type="submit" disabled={publishingSetup} className="btn-primary" style={{ ...btnPrimary, opacity: publishingSetup ? 0.6 : 1 }}>
                      {publishingSetup ? 'PUBLICANDO…' : 'PUBLICAR SETUP'}
                    </button>
                  </div>
                </form>
              )}
            </Row>
          </div>
        )}

        {/* ══ SESIÓN — zona de cierre ══ */}
        {tab === 'sesion' && (
          <div style={{ marginTop: 28, border: `1px dashed ${RED}55`, borderRadius: 12, padding: '26px 28px', background: 'rgba(248,113,113,0.03)' }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.25em', color: RED, marginBottom: 12 }}>⚠ ZONA DE CIERRE</div>
            <p style={{ fontFamily: MONO, fontSize: 11, color: MUTED, margin: '0 0 20px', lineHeight: 1.7, maxWidth: 520 }}>
              Cierra sesión en este dispositivo. Tus datos quedan guardados en la nube; los datos locales del navegador (portafolio, alertas, journal) se limpian de este equipo.
            </p>
            <button
              onClick={handleSignOut}
              style={{ padding: '12px 24px', background: 'transparent', color: RED, fontFamily: MONO, fontSize: 11, letterSpacing: '0.15em', border: `1px solid ${RED}44`, borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.08)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
            >
              CERRAR SESIÓN
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
