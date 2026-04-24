'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
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

// ─── Eye icon ────────────────────────────────────────────────────────────────
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export default function PerfilPage() {
  const router = useRouter()
  const [user,        setUser]        = useState<User | null>(null)
  const [profile,     setProfile]     = useState<Profile | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [nombre,      setNombre]      = useState('')
  const [savingName,  setSavingName]  = useState(false)
  const [nameMsg,     setNameMsg]     = useState('')

  const [pwdNew,      setPwdNew]      = useState('')
  const [pwdConfirm,  setPwdConfirm]  = useState('')
  const [savingPwd,   setSavingPwd]   = useState(false)
  const [pwdMsg,      setPwdMsg]      = useState('')
  const [pwdError,    setPwdError]    = useState('')

  const [binanceKey,    setBinanceKey]    = useState('')
  const [binanceSecret, setBinanceSecret] = useState('')
  const [savingBinance, setSavingBinance] = useState(false)
  const [binanceMsg,    setBinanceMsg]    = useState('')
  const [binanceError,  setBinanceError]  = useState('')
  const [showSecret,    setShowSecret]    = useState(false)

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
        .select('binance_api_key, binance_api_secret')
        .eq('user_id', data.user.id)
        .maybeSingle()
      if (config) {
        setBinanceKey(config.binance_api_key ?? '')
        setBinanceSecret(config.binance_api_secret ?? '')
      }

      setLoading(false)
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

  async function handleSaveBinance(e: React.FormEvent) {
    e.preventDefault()
    setBinanceMsg(''); setBinanceError('')
    if (!binanceKey || !binanceSecret) { setBinanceError('Ambos campos son requeridos.'); return }
    setSavingBinance(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSavingBinance(false); return }
    const { error } = await supabase
      .from('user_config')
      .upsert({ user_id: user.id, binance_api_key: binanceKey, binance_api_secret: binanceSecret }, { onConflict: 'user_id' })
    setSavingBinance(false)
    if (error) setBinanceError(`Error al guardar: ${error.message}`)
    else setBinanceMsg('API Keys guardadas correctamente.')
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
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
  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

  const displayName = nombre || profile?.username || email.split('@')[0] || 'TRADER'
  const initials    = displayName.slice(0, 2).toUpperCase()

  const navLinks = [
    { label: 'Editar nombre',       href: '#editar-nombre', icon: '✎' },
    { label: 'Binance API Keys',    href: '#binance-keys',  icon: '⚿' },
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
              {/* Avatar */}
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: `rgba(245,200,66,0.1)`, border: `2px solid ${GOLD}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <span style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 28, color: GOLD, letterSpacing: '0.05em' }}>{initials}</span>
              </div>
              {/* Name */}
              <div style={{ fontFamily: MONO, fontSize: 14, color: TEXT, fontWeight: 600, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName}
              </div>
              {/* Email */}
              <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, marginBottom: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {email}
              </div>
              {/* Plan badge */}
              <span style={{ display: 'inline-block', fontFamily: MONO, fontSize: 11, color: GOLD, fontWeight: 700, letterSpacing: '0.1em', background: 'rgba(245,200,66,0.12)', border: '1px solid rgba(245,200,66,0.4)', borderRadius: 6, padding: '4px 12px', marginBottom: 14 }}>
                PLAN PRO
              </span>
              {/* Meta */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>
                  <span style={{ color: 'rgba(255,255,255,0.25)', marginRight: 6 }}>Miembro desde</span>
                  {createdAt}
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
                ].map(({ label, val }) => (
                  <div key={label} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '14px 16px' }}>
                    <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED, marginBottom: 6 }}>{label}</div>
                    <div style={{ fontFamily: MONO, fontSize: 13, color: TEXT, fontWeight: 500, wordBreak: 'break-all' }}>{val}</div>
                  </div>
                ))}
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED, marginBottom: 8 }}>Plan</div>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: GOLD, fontWeight: 700, letterSpacing: '0.1em', background: 'rgba(245,200,66,0.12)', border: '1px solid rgba(245,200,66,0.4)', borderRadius: 6, padding: '4px 12px' }}>PLAN PRO</span>
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

            {/* Binance API Keys */}
            <Card id="binance-keys" title="// Binance API Keys">
              {/* Warning banner */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(245,200,66,0.06)', borderLeft: `3px solid ${GOLD}`, borderRadius: 6, padding: '10px 14px', marginBottom: 20 }}>
                <span style={{ color: GOLD, fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚠</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
                  Usa keys de solo lectura. Nunca actives permisos de trading ni retiro.
                </span>
              </div>
              <form onSubmit={handleSaveBinance} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Field label="API Key">
                  <input
                    type="text" value={binanceKey} onChange={e => setBinanceKey(e.target.value)}
                    placeholder="Pega tu Binance API Key aquí"
                    className="perf-input" style={inputCss} autoComplete="off"
                  />
                </Field>
                <Field label="API Secret">
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={binanceSecret} onChange={e => setBinanceSecret(e.target.value)}
                      placeholder="Pega tu Binance API Secret aquí"
                      className="perf-input" style={{ ...inputCss, paddingRight: 48 }} autoComplete="off"
                    />
                    <button
                      type="button" onClick={() => setShowSecret(s => !s)}
                      style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: MUTED, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                    >
                      <EyeIcon open={showSecret} />
                    </button>
                  </div>
                </Field>
                {binanceError && <div style={{ fontFamily: MONO, fontSize: 11, color: RED }}>{binanceError}</div>}
                {binanceMsg   && <div style={{ fontFamily: MONO, fontSize: 11, color: GREEN }}>{binanceMsg}</div>}
                <div>
                  <button type="submit" disabled={savingBinance} className="btn-outline" style={{ ...btnOutline, opacity: savingBinance ? 0.6 : 1 }}>
                    {savingBinance ? 'GUARDANDO…' : 'GUARDAR KEYS'}
                  </button>
                </div>
              </form>
            </Card>

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
