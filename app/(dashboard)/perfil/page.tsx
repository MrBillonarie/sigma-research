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
const CARD   = '#0f0f0f'
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

function Card({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '28px 32px' }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {title}
      </div>
      {children}
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

  const navLinks = [
    { label: 'Editar nombre',       href: '#editar-nombre', icon: '✎' },
    ...(hasStoredCreds ? [{ label: 'Credenciales guardadas', href: '#credenciales-guardadas', icon: '⚿' }] : []),
    ...(!isOAuth ? [{ label: 'Cambiar contraseña', href: '#cambiar-pwd', icon: '🔒' }] : []),
    { label: 'Publicar setup',      href: '#publicar-setup', icon: '▲' },
    { label: 'Sesión',              href: '#sesion',         icon: '→' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: MONO }}>
      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.4} }
        .perf-input:focus { border-color:${GOLD}!important; box-shadow:0 0 0 2px rgba(245,200,66,0.15)!important; }
        .btn-primary:hover { background:#e0b438!important; transform:scale(1.01); }
        .btn-outline:hover { background:rgba(245,200,66,0.08)!important; }
        .nav-link:hover { color:${GOLD}!important; background:rgba(245,200,66,0.06)!important; }
        @media(max-width:768px){
          .perfil-grid { grid-template-columns:1fr!important; }
          .perfil-sidebar { position:static!important; }
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 24px 80px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: MUTED, marginBottom: 8 }}>
              {'// CUENTA · CONFIGURACIÓN'}
            </div>
            <h1 style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 'clamp(38px,5vw,64px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
              <span style={{ color: TEXT }}>MI </span>
              <span style={{ background: `linear-gradient(135deg,${GOLD},#f0cc5a)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>PERFIL</span>
            </h1>
          </div>
          {/* Account status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: GREEN, display: 'inline-block', animation: 'pulse-dot 2s ease infinite' }} />
            <span style={{ fontFamily: MONO, fontSize: 11, color: GREEN, letterSpacing: '0.08em' }}>Cuenta activa</span>
          </div>
        </div>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 32 }} />

        {/* ── Two-column layout ── */}
        <div className="perfil-grid" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, alignItems: 'start' }}>

          {/* ── LEFT SIDEBAR ── */}
          <div className="perfil-sidebar" style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 0, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
            {/* Avatar + info */}
            <div style={{ padding: '28px 24px 20px', borderBottom: `1px solid ${BORDER}` }}>
              {/* Avatar con upload */}
              <div style={{ position: 'relative', width: 72, height: 72, marginBottom: 16 }}>
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="avatar" width={72} height={72} style={{ borderRadius: '50%', objectFit: 'cover', border: `2px solid ${GOLD}55` }} />
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: `rgba(245,200,66,0.1)`, border: `2px solid ${GOLD}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 28, color: GOLD, letterSpacing: '0.05em' }}>{initials}</span>
                  </div>
                )}
                {/* Upload overlay */}
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: '50%', background: GOLD, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}
                  title="Cambiar foto"
                >
                  {uploadingAvatar ? '…' : '✎'}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
              </div>
              {avatarMsg && <div style={{ fontFamily: MONO, fontSize: 10, color: avatarMsg.startsWith('Error') ? '#f87171' : '#34d399', marginBottom: 8 }}>{avatarMsg}</div>}
              {/* Name */}
              <div style={{ fontFamily: MONO, fontSize: 14, color: TEXT, fontWeight: 600, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName}
              </div>
              {/* Email */}
              <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, marginBottom: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {email}
              </div>
              {/* Plan badge */}
              <span style={{ display: 'inline-block', fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', borderRadius: 6, padding: '4px 12px', marginBottom: 14,
                color: plan === 'pro' ? GOLD : DIM,
                background: plan === 'pro' ? 'rgba(245,200,66,0.12)' : 'rgba(255,255,255,0.05)',
                border: plan === 'pro' ? '1px solid rgba(245,200,66,0.4)' : '1px solid rgba(255,255,255,0.12)',
              }}>
                {plan === 'pro' ? 'PLAN PRO' : 'PLAN FREE'}
              </span>
              {/* Meta */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>
                  <span style={{ color: 'rgba(255,255,255,0.25)', marginRight: 6 }}>Miembro desde</span>
                  {createdAt}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>
                  <span style={{ color: 'rgba(255,255,255,0.25)', marginRight: 6 }}>Último acceso</span>
                  {lastLogin}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>
                  <span style={{ color: 'rgba(255,255,255,0.25)', marginRight: 6 }}>Acceso via</span>
                  {provider.toUpperCase()}
                </div>
              </div>
            </div>

            {/* Nav links */}
            <nav style={{ padding: '12px 0' }}>
              {navLinks.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  className="nav-link"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px', fontFamily: MONO, fontSize: 12, color: DIM, textDecoration: 'none', transition: 'color 0.15s, background 0.15s', borderRadius: 0 }}
                >
                  <span style={{ fontSize: 13, width: 16, textAlign: 'center', flexShrink: 0 }}>{link.icon}</span>
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          {/* ── RIGHT CONTENT ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Mi Plan Sigma — resumen consolidado */}
            <Card title="// Mi Plan Sigma">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                <a href="/fire" style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '14px 12px', textAlign: 'center', display: 'block' }}>
                  <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 22, color: fireTarget ? GOLD : MUTED, lineHeight: 1, marginBottom: 6 }}>
                    {fireTarget ? `$${Math.round(fireTarget).toLocaleString('es-CL')}` : 'Sin definir'}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Meta FIRE</div>
                </a>
                <a href="/portafolio" style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '14px 12px', textAlign: 'center', display: 'block' }}>
                  <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 22, color: TEXT, lineHeight: 1, marginBottom: 6 }}>
                    {portfolioReady ? `$${Math.round(portfolioTotal).toLocaleString('es-CL')}` : '—'}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Capital total</div>
                </a>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '14px 12px', textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 22, color: copytrading?.enabled ? GREEN : MUTED, lineHeight: 1, marginBottom: 6 }}>
                    {copytrading?.enabled ? `$${Math.round(copytrading.capital).toLocaleString('es-CL')}` : 'No inscrito'}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Copytrading</div>
                </div>
              </div>
              {!fireProfile.fire_completed && (
                <div style={{ fontFamily: MONO, fontSize: 11, color: DIM, marginTop: 14, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, borderLeft: `2px solid ${GOLD}` }}>
                  Aún no configuras tu plan FIRE. <a href="/fire" style={{ color: GOLD }}>Ir a /fire →</a>
                </div>
              )}
            </Card>

            {/* Performance Stats */}
            {tradeStats && (
              <Card title="// Performance de Trading">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 12 }}>
                  {[
                    { label: 'Total trades',  val: String(tradeStats.total),                                                              color: GOLD },
                    { label: 'Win rate',      val: `${tradeStats.winRate}%`,                                                             color: tradeStats.winRate >= 50 ? GREEN : RED },
                    { label: 'PnL total',     val: `${tradeStats.pnl >= 0 ? '+' : ''}$${Math.round(tradeStats.pnl).toLocaleString('es-CL')}`, color: tradeStats.pnl >= 0 ? GREEN : RED },
                    { label: 'Mejor trade',   val: `+$${Math.round(tradeStats.best).toLocaleString('es-CL')}`,                           color: GREEN },
                    { label: 'Peor trade',    val: `$${Math.round(tradeStats.worst).toLocaleString('es-CL')}`,                           color: RED },
                    { label: 'Win streak',    val: `${tradeStats.streak}W`,                                                              color: tradeStats.streak >= 3 ? GOLD : DIM },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '14px 12px', textAlign: 'center' }}>
                      <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 26, color, lineHeight: 1, marginBottom: 6 }}>{val}</div>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, textAlign: 'right' }}>
                  Datos sincronizados desde Journal
                </div>
              </Card>
            )}

            {/* Reputación */}
            {profile !== null && (
              <Card title="// Reputación">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                  {[
                    { label: 'Reputación',    val: profile.reputation,        color: profile.reputation >= 50 ? GOLD : profile.reputation >= 20 ? GREEN : DIM },
                    { label: 'Setups Pub.',   val: profile.setups_published,  color: DIM },
                    { label: 'TP Alcanzados', val: profile.setups_won,        color: GREEN },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '14px 8px' }}>
                      <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 32, color, lineHeight: 1, marginBottom: 6 }}>{val}</div>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: DIM, lineHeight: 1.7, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, borderLeft: `2px solid ${profile.reputation >= 50 ? GOLD : profile.reputation >= 20 ? GREEN : 'rgba(255,255,255,0.12)'}` }}>
                  {profile.reputation >= 50
                    ? <span style={{ color: GOLD }}>★ Trader Senior — tus setups se publican con destaque.</span>
                    : profile.reputation >= 20
                      ? <span style={{ color: GREEN }}>◆ Trader Verificado — tus setups son visibles en la sidebar.</span>
                      : profile.reputation >= MIN_REP
                        ? <span>Puedes publicar setups. Sigue obteniendo votos para subir de rango.</span>
                        : <span>Necesitas <strong style={{ color: GOLD }}>{MIN_REP - profile.reputation} puntos más</strong> de reputación para publicar setups.</span>
                  }
                </div>
              </Card>
            )}

            {/* Información de cuenta */}
            <Card title="// Información de cuenta">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  { label: 'Email',          val: email },
                  { label: 'Miembro desde',  val: createdAt },
                  { label: 'Último acceso',  val: lastLogin },
                ].map(({ label, val }) => (
                  <div key={label} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '14px 16px' }}>
                    <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED, marginBottom: 6 }}>{label}</div>
                    <div style={{ fontFamily: MONO, fontSize: 13, color: TEXT, fontWeight: 500, wordBreak: 'break-all' }}>{val}</div>
                  </div>
                ))}
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED, marginBottom: 8 }}>Plan</div>
                  <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', borderRadius: 6, padding: '4px 12px',
                    color: plan === 'pro' ? GOLD : DIM,
                    background: plan === 'pro' ? 'rgba(245,200,66,0.12)' : 'rgba(255,255,255,0.05)',
                    border: plan === 'pro' ? '1px solid rgba(245,200,66,0.4)' : '1px solid rgba(255,255,255,0.12)',
                  }}>{plan === 'pro' ? 'PLAN PRO' : 'PLAN FREE'}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED, marginBottom: 6 }}>Proveedor</div>
                  <div style={{ fontFamily: MONO, fontSize: 13, color: TEXT, fontWeight: 500, textTransform: 'uppercase' }}>{provider}</div>
                </div>
              </div>
            </Card>

            {/* Editar nombre */}
            <Card id="editar-nombre" title="// Editar nombre">
              <form onSubmit={handleSaveName} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <Field label="Nombre visible">
                    <input
                      type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                      placeholder="Tu nombre" className="perf-input" style={inputCss}
                    />
                  </Field>
                </div>
                <button type="submit" disabled={savingName} className="btn-primary" style={{ ...btnPrimary, opacity: savingName ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                  {savingName ? 'GUARDANDO…' : 'GUARDAR'}
                </button>
              </form>
              {nameMsg && <div style={{ fontFamily: MONO, fontSize: 11, color: GREEN, marginTop: 12 }}>{nameMsg}</div>}
            </Card>

            {/* Credenciales guardadas de una versión anterior — sin formularios
                de edición, solo la opción de borrarlas permanentemente. */}
            {hasStoredCreds && (
              <Card id="credenciales-guardadas" title="// Credenciales guardadas">
                <p style={{ fontFamily: MONO, fontSize: 11, color: MUTED, marginBottom: 16, lineHeight: 1.6 }}>
                  Tienes credenciales de sincronización (Binance, IBKR o MetaTrader 5) guardadas de una versión anterior de esta página. Ya no se gestionan ni se sincronizan desde aquí — puedes borrarlas de forma permanente.
                </p>
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
              </Card>
            )}

            {/* Cambiar contraseña */}
            {!isOAuth && (
              <Card id="cambiar-pwd" title="// Cambiar contraseña">
                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
              </Card>
            )}

            {/* Publicar setup */}
            <Card id="publicar-setup" title="// Publicar setup">
              <p style={{ fontFamily: MONO, fontSize: 11, color: MUTED, marginBottom: 20, lineHeight: 1.6 }}>
                Setups publicados aparecen en la barra lateral para todos los usuarios. Reputación mínima: {MIN_REP}.
              </p>
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
            </Card>

            {/* Sesión */}
            <Card id="sesion" title="// Sesión">
              <p style={{ fontFamily: MONO, fontSize: 11, color: MUTED, marginBottom: 20, lineHeight: 1.6 }}>
                Cierra sesión en este dispositivo. Tus datos quedan guardados en la nube.
              </p>
              <button
                onClick={handleSignOut}
                style={{ padding: '12px 24px', background: 'transparent', color: RED, fontFamily: MONO, fontSize: 11, letterSpacing: '0.15em', border: `1px solid ${RED}44`, borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.08)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              >
                CERRAR SESIÓN
              </button>
            </Card>

          </div>
        </div>
      </div>
    </div>
  )
}
