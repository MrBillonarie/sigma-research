'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
import type { User } from '@supabase/supabase-js'

import { C } from '@/app/lib/constants'

const MIN_REP = 10

interface Profile {
  id: string; username: string | null; reputation: number
  setups_published: number; setups_won: number
}

type SetupTipo = 'LONG' | 'SHORT' | 'LP'
const TF_OPTIONS = ['1m','5m','15m','1H','4H','1D','1W']

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

  // Binance API Keys
  const [binanceKey,    setBinanceKey]    = useState('')
  const [binanceSecret, setBinanceSecret] = useState('')
  const [savingBinance, setSavingBinance] = useState(false)
  const [binanceMsg,    setBinanceMsg]    = useState('')
  const [binanceError,  setBinanceError]  = useState('')
  const [showSecret,    setShowSecret]    = useState(false)

  // Community setup form
  const emptySetup = { par: '', tipo: 'LONG' as SetupTipo, entry: '', sl: '', tp: '', rangeLow: '', rangeHigh: '', feeTier: '', protocol: '', rr: '', timeframe: '4H', metodologia: '', nota: '' }
  const [setupForm,      setSetupForm]      = useState(emptySetup)
  const [publishingSetup, setPublishingSetup] = useState(false)
  const [setupMsg,       setSetupMsg]       = useState('')
  const [setupError,     setSetupError]     = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace('/login'); return }
      setUser(data.user)
      setNombre(data.user.user_metadata?.nombre ?? '')

      // Load / upsert profile row
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

      // Load binance keys
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
    // Also sync username to profiles table
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
      .upsert({
        user_id: user.id,
        binance_api_key: binanceKey,
        binance_api_secret: binanceSecret,
      }, { onConflict: 'user_id' })

    setSavingBinance(false)
    if (error) {
      setBinanceError(`Error al guardar: ${error.message}`)
    } else {
      setBinanceMsg('API Keys guardadas correctamente.')
    }
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
            {'// CUENTA · CONFIGURACIÓN'}
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 'clamp(40px,5vw,68px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
            <span style={{ color: C.text }}>MI</span>{' '}
            <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow},#a88c25)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>PERFIL</span>
          </h1>
        </div>

        {/* Reputation card */}
        {profile !== null && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px 24px', marginBottom: 1 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 16 }}>{'// REPUTACIÓN'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
              {[
                { label: 'Reputación', val: profile.reputation,        color: profile.reputation >= 50 ? C.gold : profile.reputation >= 20 ? C.green : C.dimText },
                { label: 'Setups Pub.', val: profile.setups_published, color: C.dimText },
                { label: 'TP Alcanzados', val: profile.setups_won,    color: C.green },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 24, color, marginBottom: 4 }}>{val}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 9, color: C.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, lineHeight: 1.7 }}>
              {profile.reputation >= 50
                ? <span style={{ color: C.gold }}>★ Trader Senior — tus setups se publican con destaque.</span>
                : profile.reputation >= 20
                  ? <span style={{ color: C.green }}>◆ Trader Verificado — tus setups son visibles en la sidebar.</span>
                  : profile.reputation >= MIN_REP
                    ? <span>Puedes publicar setups. Sigue obteniendo votos para subir de rango.</span>
                    : <span>Necesitas <strong style={{ color: C.gold }}>{MIN_REP - profile.reputation} puntos más</strong> de reputación para publicar setups.</span>
              }
            </div>
          </div>
        )}

        {/* Account info */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px 24px', marginBottom: 1 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 16 }}>{'// INFORMACIÓN DE CUENTA'}</div>
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
          <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 16 }}>{'// EDITAR NOMBRE'}</div>
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
          <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 4 }}>{'// BINANCE API KEYS'}</div>
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
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 16 }}>{'// CAMBIAR CONTRASEÑA'}</div>
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

        {/* Publish setup */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px 24px', marginBottom: 1 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 4 }}>{'// PUBLICAR SETUP'}</div>
          <p style={{ fontFamily: 'monospace', fontSize: 11, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
            Setups publicados aparecen en la barra lateral para todos los usuarios. Reputación mínima: {MIN_REP}.
          </p>

          {profile !== null && (profile.reputation ?? 0) < MIN_REP ? (
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, background: C.bg, border: `1px solid ${C.border}`, padding: '12px 16px' }}>
              Reputación actual: <span style={{ color: C.gold }}>{profile.reputation}</span> / {MIN_REP} requeridos.
            </div>
          ) : (
            <form onSubmit={handlePublishSetup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Par (ej. BTCUSDT)">
                  <input type="text" value={setupForm.par} onChange={e => setSetupForm(f => ({ ...f, par: e.target.value }))} placeholder="BTCUSDT" style={inputStyle} />
                </Field>
                <Field label="Tipo">
                  <select value={setupForm.tipo} onChange={e => setSetupForm(f => ({ ...f, tipo: e.target.value as SetupTipo }))} style={inputStyle}>
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
                      <input type="number" value={(setupForm as Record<string, string | number>)[f]} onChange={e => setSetupForm(prev => ({ ...prev, [f]: e.target.value }))} placeholder="0" style={inputStyle} />
                    </Field>
                  ))}
                </div>
              )}

              {setupForm.tipo === 'LP' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Rango Bajo">
                    <input type="number" value={setupForm.rangeLow} onChange={e => setSetupForm(f => ({ ...f, rangeLow: e.target.value }))} placeholder="1580" style={inputStyle} />
                  </Field>
                  <Field label="Rango Alto">
                    <input type="number" value={setupForm.rangeHigh} onChange={e => setSetupForm(f => ({ ...f, rangeHigh: e.target.value }))} placeholder="1950" style={inputStyle} />
                  </Field>
                  <Field label="Protocol">
                    <input type="text" value={setupForm.protocol} onChange={e => setSetupForm(f => ({ ...f, protocol: e.target.value }))} placeholder="Uniswap v3" style={inputStyle} />
                  </Field>
                  <Field label="Fee Tier">
                    <input type="text" value={setupForm.feeTier} onChange={e => setSetupForm(f => ({ ...f, feeTier: e.target.value }))} placeholder="0.05%" style={inputStyle} />
                  </Field>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Timeframe">
                  <select value={setupForm.timeframe} onChange={e => setSetupForm(f => ({ ...f, timeframe: e.target.value }))} style={inputStyle}>
                    {TF_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    <option value="—">—</option>
                  </select>
                </Field>
                <Field label="Metodología">
                  <input type="text" value={setupForm.metodologia} onChange={e => setSetupForm(f => ({ ...f, metodologia: e.target.value }))} placeholder="OB+MACD" style={inputStyle} />
                </Field>
              </div>

              <Field label="Nota">
                <textarea value={setupForm.nota} onChange={e => setSetupForm(f => ({ ...f, nota: e.target.value }))} placeholder="Describe el setup brevemente..." rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
              </Field>

              {setupError && <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.red }}>{setupError}</div>}
              {setupMsg   && <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.green }}>{setupMsg}</div>}

              <button type="submit" disabled={publishingSetup} style={{
                padding: '10px 22px', background: C.gold, color: C.bg,
                fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.2em',
                border: 'none', cursor: 'pointer', opacity: publishingSetup ? 0.6 : 1, alignSelf: 'flex-start',
              }}>
                {publishingSetup ? 'PUBLICANDO…' : 'PUBLICAR SETUP'}
              </button>
            </form>
          )}
        </div>

        {/* Sign out */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px 24px' }}>
          <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 12 }}>{'// SESIÓN'}</div>
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
