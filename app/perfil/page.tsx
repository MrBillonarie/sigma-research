'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
import type { User } from '@supabase/supabase-js'

const C = {
  bg:      '#04050a',
  surface: '#0b0d14',
  border:  '#1a1d2e',
  muted:   '#3a3f55',
  dimText: '#7a7f9a',
  text:    '#e8e9f0',
  gold:    '#d4af37',
  glow:    '#f0cc5a',
  green:   '#34d399',
  red:     '#f87171',
  yellow:  '#fbbf24',
} as const

const inputStyle: React.CSSProperties = {
  background: '#04050a', border: `1px solid #1a1d2e`, outline: 'none',
  color: '#e8e9f0', fontFamily: 'monospace', fontSize: 13, padding: '10px 14px',
  width: '100%',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>{label}</span>
      {children}
    </div>
  )
}

export default function PerfilPage() {
  const router = useRouter()
  const [user,        setUser]        = useState<User | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [nombre,      setNombre]      = useState('')
  const [savingName,  setSavingName]  = useState(false)
  const [nameMsg,     setNameMsg]     = useState('')

  const [pwdNew,      setPwdNew]      = useState('')
  const [pwdConfirm,  setPwdConfirm]  = useState('')
  const [savingPwd,   setSavingPwd]   = useState(false)
  const [pwdMsg,      setPwdMsg]      = useState('')
  const [pwdError,    setPwdError]    = useState('')

  // Binance API Keys
  const [binanceKey,    setBinanceKey]    = useState('')
  const [binanceSecret, setBinanceSecret] = useState('')
  const [savingBinance, setSavingBinance] = useState(false)
  const [binanceMsg,    setBinanceMsg]    = useState('')
  const [binanceError,  setBinanceError]  = useState('')
  const [showSecret,    setShowSecret]    = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace('/login'); return }
      setUser(data.user)
      setNombre(data.user.user_metadata?.nombre ?? '')

      // Cargar keys existentes
      const { data: config } = await supabase
        .from('user_config')
        .select('binance_api_key, binance_api_secret')
        .eq('user_id', data.user.id)
        .single()

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
    setSavingName(false)
    setNameMsg(error ? `Error: ${error.message}` : 'Nombre actualizado.')
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

    // Verificar si ya existe un registro
    const { data: existing } = await supabase
      .from('user_config')
      .select('id')
      .eq('user_id', user.id)
      .single()

    const payload = {
      user_id: user.id,
      binance_api_key: binanceKey,
      binance_api_secret: binanceSecret,
    }

    if (existing) {
      await supabase.from('user_config').update(payload).eq('user_id', user.id)
    } else {
      await supabase.from('user_config').insert(payload)
    }

    setSavingBinance(false)
    setBinanceMsg('API Keys guardadas correctamente.')
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.muted }}>Cargando perfil…</span>
    </div>
  )

  const email    = user?.email ?? ''
  const provider = user?.app_metadata?.provider ?? 'email'
  const isOAuth  = provider !== 'email'
  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono,'DM Mono',monospace)" }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '88px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 10 }}>
            // CUENTA · CONFIGURACIÓN
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 'clamp(40px,5vw,68px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
            <span style={{ color: C.text }}>MI</span>{' '}
            <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow},#a88c25)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>PERFIL</span>
          </h1>
        </div>

        {/* Account info */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px 24px', marginBottom: 1 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 16 }}>// INFORMACIÓN DE CUENTA</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Email</div>
              <div style={{ fontFamily: 'monospace', fontSize: 13 }}>{email}</div>
            </div>
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Miembro desde</div>
              <div style={{ fontFamily: 'monospace', fontSize: 13 }}>{createdAt}</div>
            </div>
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Plan</div>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.gold, border: `1px solid ${C.gold}40`, padding: '2px 10px', letterSpacing: '0.1em' }}>PLAN PRO</span>
            </div>
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Proveedor</div>
              <div style={{ fontFamily: 'monospace', fontSize: 13, color: C.dimText, textTransform: 'uppercase' }}>{provider}</div>
            </div>
          </div>
        </div>

        {/* Edit name */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px 24px', marginBottom: 1 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 16 }}>// EDITAR NOMBRE</div>
          <form onSubmit={handleSaveName} style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Field label="Nombre">
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre" style={inputStyle} />
              </Field>
            </div>
            <button type="submit" disabled={savingName}
              style={{ padding: '10px 22px', background: C.gold, color: C.bg, fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.2em', border: 'none', cursor: 'pointer', opacity: savingName ? 0.6 : 1, whiteSpace: 'nowrap' }}>
              {savingName ? 'GUARDANDO…' : 'GUARDAR'}
            </button>
          </form>
          {nameMsg && <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.green, marginTop: 10 }}>{nameMsg}</div>}
        </div>

        {/* Binance API Keys */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px 24px', marginBottom: 1 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 4 }}>// BINANCE API KEYS</div>
          <p style={{ fontFamily: 'monospace', fontSize: 11, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
            Usa keys de solo lectura. Nunca actives permisos de trading ni retiro.
          </p>
          <form onSubmit={handleSaveBinance} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="API Key">
              <input
                type="text"
                value={binanceKey}
                onChange={e => setBinanceKey(e.target.value)}
                placeholder="Pega tu Binance API Key aquí"
                style={inputStyle}
                autoComplete="off"
              />
            </Field>
            <Field label="API Secret">
              <div style={{ position: 'relative' }}>
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={binanceSecret}
                  onChange={e => setBinanceSecret(e.target.value)}
                  placeholder="Pega tu Binance API Secret aquí"
                  style={{ ...inputStyle, paddingRight: 80 }}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(s => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.dimText, fontFamily: 'monospace', fontSize: 10, cursor: 'pointer', letterSpacing: '0.1em' }}>
                  {showSecret ? 'OCULTAR' : 'MOSTRAR'}
                </button>
              </div>
            </Field>
            {binanceError && <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.red }}>{binanceError}</div>}
            {binanceMsg   && <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.green }}>{binanceMsg}</div>}
            <button type="submit" disabled={savingBinance}
              style={{ padding: '10px 22px', background: 'transparent', color: C.gold, fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.2em', border: `1px solid ${C.gold}`, cursor: 'pointer', opacity: savingBinance ? 0.6 : 1, alignSelf: 'flex-start' }}>
              {savingBinance ? 'GUARDANDO…' : 'GUARDAR KEYS'}
            </button>
          </form>
        </div>

        {/* Change password */}
        {!isOAuth && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px 24px', marginBottom: 1 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 16 }}>// CAMBIAR CONTRASEÑA</div>
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Nueva contraseña">
                <input type="password" value={pwdNew} onChange={e => setPwdNew(e.target.value)} placeholder="Mínimo 8 caracteres" style={inputStyle} />
              </Field>
              <Field label="Confirmar contraseña">
                <input type="password" value={pwdConfirm} onChange={e => setPwdConfirm(e.target.value)} placeholder="Repite la nueva contraseña" style={inputStyle} />
              </Field>
              {pwdError && <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.red }}>{pwdError}</div>}
              {pwdMsg   && <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.green }}>{pwdMsg}</div>}
              <button type="submit" disabled={savingPwd}
                style={{ padding: '10px 22px', background: 'transparent', color: C.gold, fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.2em', border: `1px solid ${C.gold}`, cursor: 'pointer', opacity: savingPwd ? 0.6 : 1, alignSelf: 'flex-start' }}>
                {savingPwd ? 'ACTUALIZANDO…' : 'ACTUALIZAR CONTRASEÑA'}
              </button>
            </form>
          </div>
        )}

        {/* Sign out */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px 24px' }}>
          <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 12 }}>// SESIÓN</div>
          <p style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, marginBottom: 16, lineHeight: 1.6 }}>
            Cierra sesión en este dispositivo. Tus datos quedan guardados en la nube.
          </p>
          <button onClick={handleSignOut}
            style={{ padding: '10px 22px', background: 'transparent', color: C.red, fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.2em', border: `1px solid ${C.red}40`, cursor: 'pointer' }}>
            CERRAR SESIÓN
          </button>
        </div>

      </div>
    </div>
  )
}
