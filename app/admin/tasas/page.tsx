'use client'
import { useState, useEffect } from 'react'

interface TasaRow {
  id: string; nombre: string
  d30: number; d60: number; d90: number; d180: number; d360: number
  updated_at: string
}

const PLAZOS = ['d30','d60','d90','d180','d360'] as const
const LABELS: Record<string, string> = { d30:'30d', d60:'60d', d90:'90d', d180:'180d', d360:'360d' }

export default function AdminTasasPage() {
  const [password, setPassword]   = useState('')
  const [authed,   setAuthed]     = useState(false)
  const [tasas,    setTasas]      = useState<TasaRow[]>([])
  const [editing,  setEditing]    = useState<Record<string, Partial<TasaRow>>>({})
  const [saving,   setSaving]     = useState<string | null>(null)
  const [msg,      setMsg]        = useState<{ text: string; ok: boolean } | null>(null)
  const [loading,  setLoading]    = useState(false)

  async function load() {
    setLoading(true)
    const r = await fetch('/api/tasas-dap')
    const j = await r.json()
    if (j.ok) setTasas(j.data)
    setLoading(false)
  }

  useEffect(() => { if (authed) load() }, [authed])

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (password === (process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'adminsigma')) {
      setAuthed(true)
    } else {
      setMsg({ text: 'Contraseña incorrecta', ok: false })
    }
  }

  function handleChange(id: string, field: string, value: string) {
    setEditing(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: parseFloat(value) || 0 }
    }))
  }

  async function handleSave(banco: TasaRow) {
    setSaving(banco.id)
    const updated = { ...banco, ...editing[banco.id] }
    const r = await fetch('/api/admin/tasas-dap', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` },
      body: JSON.stringify(updated),
    })
    const j = await r.json()
    if (j.ok) {
      setMsg({ text: `✓ ${banco.nombre} actualizado`, ok: true })
      setEditing(prev => { const n = { ...prev }; delete n[banco.id]; return n })
      await load()
    } else {
      setMsg({ text: `Error: ${j.error}`, ok: false })
    }
    setSaving(null)
    setTimeout(() => setMsg(null), 3000)
  }

  const S = {
    page:   { minHeight:'100vh', background:'#0a0a0a', color:'#e5e5e5', fontFamily:'monospace', padding:'40px 24px' },
    card:   { maxWidth:900, margin:'0 auto', background:'#111', border:'1px solid #222', padding:'32px' },
    title:  { fontSize:28, fontFamily:"'Bebas Neue', Impact, sans-serif", letterSpacing:'0.05em', color:'#d4af37', marginBottom:24 },
    input:  { background:'#1a1a1a', border:'1px solid #333', color:'#e5e5e5', padding:'6px 10px', fontFamily:'monospace', fontSize:13, width:72, textAlign:'right' as const },
    btn:    { background:'#d4af37', color:'#0a0a0a', border:'none', padding:'6px 16px', fontFamily:'monospace', fontSize:12, cursor:'pointer', letterSpacing:'0.1em' },
    btnSm:  { background:'#222', color:'#d4af37', border:'1px solid #d4af3744', padding:'4px 12px', fontFamily:'monospace', fontSize:11, cursor:'pointer' },
    th:     { padding:'8px 12px', fontFamily:'monospace', fontSize:10, letterSpacing:'0.2em', textTransform:'uppercase' as const, color:'#666', textAlign:'left' as const, borderBottom:'1px solid #222' },
    td:     { padding:'10px 12px', fontFamily:'monospace', fontSize:12, borderBottom:'1px solid #1a1a1a', verticalAlign:'middle' as const },
  }

  if (!authed) return (
    <div style={S.page}>
      <div style={{ ...S.card, maxWidth:360 }}>
        <div style={S.title}>ADMIN · TASAS DAP</div>
        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <input
            type="password" placeholder="Contraseña" value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ ...S.input, width:'100%', textAlign:'left', padding:'10px 12px' }}
          />
          <button type="submit" style={S.btn}>ENTRAR</button>
          {msg && <div style={{ color: msg.ok ? '#22c55e' : '#ef4444', fontSize:12 }}>{msg.text}</div>}
        </form>
      </div>
    </div>
  )

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <div style={S.title}>TASAS DAP · EDITOR</div>
          <div style={{ fontSize:11, color:'#666' }}>Actualización mensual recomendada</div>
        </div>

        {msg && (
          <div style={{ background: msg.ok ? '#14532d' : '#7f1d1d', color: msg.ok ? '#86efac' : '#fca5a5', padding:'10px 14px', fontFamily:'monospace', fontSize:12, marginBottom:16 }}>
            {msg.text}
          </div>
        )}

        {loading ? (
          <div style={{ color:'#666', fontSize:12 }}>Cargando...</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                <th style={S.th}>Banco</th>
                {PLAZOS.map(p => <th key={p} style={{ ...S.th, textAlign:'right' }}>{LABELS[p]}</th>)}
                <th style={{ ...S.th, textAlign:'center' }}>Acción</th>
                <th style={S.th}>Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {tasas.map(b => {
                const ed = editing[b.id] ?? {}
                const isDirty = Object.keys(ed).length > 0
                return (
                  <tr key={b.id} style={{ background: isDirty ? '#1a1500' : 'transparent' }}>
                    <td style={{ ...S.td, color:'#e5e5e5' }}>{b.nombre}</td>
                    {PLAZOS.map(p => (
                      <td key={p} style={{ ...S.td, textAlign:'right' }}>
                        <input
                          type="number" step="0.01" min="0" max="5"
                          value={(ed[p as keyof TasaRow] ?? b[p as keyof TasaRow] ?? '') as number}
                          onChange={e => handleChange(b.id, p, e.target.value)}
                          style={S.input}
                        />
                        <span style={{ color:'#666', fontSize:10, marginLeft:2 }}>%</span>
                      </td>
                    ))}
                    <td style={{ ...S.td, textAlign:'center' }}>
                      {isDirty ? (
                        <button
                          onClick={() => handleSave(b)}
                          disabled={saving === b.id}
                          style={S.btn}
                        >
                          {saving === b.id ? '...' : 'GUARDAR'}
                        </button>
                      ) : (
                        <span style={{ color:'#333', fontSize:11 }}>—</span>
                      )}
                    </td>
                    <td style={{ ...S.td, color:'#555', fontSize:10 }}>
                      {new Date(b.updated_at).toLocaleDateString('es-CL')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        <div style={{ marginTop:24, padding:'14px 16px', background:'#0f0f0f', border:'1px solid #1a1a1a', fontSize:11, color:'#555', lineHeight:1.8 }}>
          <div style={{ color:'#666', marginBottom:6, letterSpacing:'0.15em', textTransform:'uppercase', fontSize:10 }}>Instrucciones</div>
          Modifica cualquier tasa y presiona GUARDAR. Los cambios se reflejan en el comparador en &lt;1 hora.<br/>
          Fuente recomendada: revisar sitios web de cada banco o llamar directamente. Tasas en % mensual.
        </div>
      </div>
    </div>
  )
}
