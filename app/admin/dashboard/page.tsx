'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const SESSION_KEY   = 'sigma_admin_auth'
const ADMIN_SECRET  = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? 'adminsigma'
const ADMIN_HEADERS = { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_SECRET}` }

interface ReporteRow {
  id: string; numero: number; titulo: string; fecha: string
  descripcion: string; url_pdf: string; activo: boolean; created_at: string
}

interface UserRow {
  id: string
  email: string
  nombre: string
  created_at: string
  confirmed: boolean
  last_sign_in: string | null
  plan: 'free' | 'pro'
}

interface SyncStatus {
  fondos: { total: number; updatedToday: number; lastUpdate: string | null; pctToday: number }
  etfs:   { total: number; lastUpdate: string | null }
  agf:    { total: number }
}

interface TicketRow {
  id: string
  nombre: string
  empresa: string | null
  email: string
  motivo: string | null
  mensaje: string
  status: 'pendiente' | 'visto' | 'resuelto'
  respuesta: string | null
  created_at: string
}

const mockModelos = [
  { tag: 'HMM-01',   name: 'REGIME DETECTOR',  status: 'PRODUCCIÓN', accuracy: '91.2%', metric: 'Accuracy',        activo: true  },
  { tag: 'GARCH-02', name: 'VOL FORECASTER',   status: 'PRODUCCIÓN', accuracy: '0.031', metric: 'MAE 30D',         activo: true  },
  { tag: 'XGB-03',   name: 'MOMENTUM SCORE',   status: 'BETA',       accuracy: '2.41',  metric: 'Sharpe OOS',      activo: true  },
  { tag: 'NLP-04',   name: 'SENTIMENT ALPHA',  status: 'BETA',       accuracy: '73.8%', metric: 'F1-Score',        activo: false },
  { tag: 'STAT-05',  name: 'PAIRS TRADING',    status: 'PRODUCCIÓN', accuracy: '1.87',  metric: 'Sharpe OOS',      activo: true  },
  { tag: 'VAR-06',   name: 'MACRO REGIME',     status: 'PRODUCCIÓN', accuracy: '84.1%', metric: 'Directional Acc', activo: true  },
]

const mockSolicitudes = [
  { id: 1, nombre: 'Pedro Gutiérrez', empresa: 'Fondo Sur Capital', email: 'pgutierrez@fsc.cl',       motivo: 'Plan Institutional — solicitud de acceso', estado: 'PENDIENTE',  fecha: '2025-04-10' },
  { id: 2, nombre: 'Ana Hernández',   empresa: '',                  email: 'ahernan@gmail.com',        motivo: 'Demo personalizada',                      estado: 'RESPONDIDA', fecha: '2025-04-08' },
  { id: 3, nombre: 'Luis Mora',       empresa: 'Asesores RM',       email: 'luis.mora@asesorerm.cl',   motivo: 'Integración API',                         estado: 'PENDIENTE',  fecha: '2025-04-12' },
]

type Tab = 'resumen' | 'usuarios' | 'solicitudes' | 'modelos' | 'reportes' | 'tasas' | 'sync' | 'soporte'

const SIDEBAR_TABS: { id: Tab; label: string }[] = [
  { id: 'resumen',     label: 'RESUMEN'      },
  { id: 'usuarios',    label: 'USUARIOS'     },
  { id: 'soporte',     label: 'SOPORTE'      },
  { id: 'solicitudes', label: 'SOLICITUDES'  },
  { id: 'modelos',     label: 'MODELOS'      },
  { id: 'reportes',    label: 'REPORTES'     },
  { id: 'tasas',       label: 'TASAS DAP'    },
  { id: 'sync',        label: 'SYNC DATOS'   },
]

const EMPTY_FORM = { numero: '', titulo: '', fecha: '', descripcion: '', url_pdf: '' }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AdminDashboard() {
  const router = useRouter()
  const [tab,     setTab]     = useState<Tab>('resumen')
  const [modelos, setModelos] = useState(mockModelos)
  const [loading, setLoading] = useState(true)

  const [users,        setUsers]        = useState<UserRow[]>([])
  const [syncStatus,   setSyncStatus]   = useState<SyncStatus | null>(null)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingSync,  setLoadingSync]  = useState(false)

  const [tickets,        setTickets]        = useState<TicketRow[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null)
  const [respuestas,     setRespuestas]     = useState<Record<string, string>>({})
  const [sendingTicket,  setSendingTicket]  = useState<string | null>(null)
  const [ticketMsg,      setTicketMsg]      = useState<{ id: string; text: string; ok: boolean } | null>(null)

  const [reportes,   setReportes]   = useState<ReporteRow[]>([])
  const [loadingR,   setLoadingR]   = useState(false)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [pdfFile,    setPdfFile]    = useState<File | null>(null)
  const [uploading,  setUploading]  = useState(false)
  const [formError,  setFormError]  = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) !== 'true') {
      router.replace('/admin')
    } else {
      setLoading(false)
      fetchUsers()
      fetchSyncStatus()
      fetchTickets()
    }
  }, [router])

  async function fetchUsers() {
    setLoadingUsers(true)
    try {
      const res = await fetch('/api/admin/usuarios', { headers: ADMIN_HEADERS })
      const json = await res.json()
      if (json.users) setUsers(json.users)
    } catch {}
    setLoadingUsers(false)
  }

  async function togglePlan(user: UserRow) {
    const newPlan = user.plan === 'pro' ? 'free' : 'pro'
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, plan: newPlan } : u))
    await fetch('/api/admin/usuarios', {
      method: 'PATCH',
      headers: ADMIN_HEADERS,
      body: JSON.stringify({ id: user.id, plan: newPlan }),
    })
  }

  async function fetchSyncStatus() {
    setLoadingSync(true)
    try {
      const res = await fetch('/api/admin/sync-status', { headers: ADMIN_HEADERS })
      const json = await res.json()
      if (json.fondos) setSyncStatus(json)
    } catch {}
    setLoadingSync(false)
  }

  async function fetchTickets() {
    setLoadingTickets(true)
    try {
      const res = await fetch('/api/admin/soporte', { headers: ADMIN_HEADERS })
      const json = await res.json()
      if (json.tickets) setTickets(json.tickets)
    } catch {}
    setLoadingTickets(false)
  }

  async function updateTicket(id: string, status: string, respuesta?: string, enviarEmail?: boolean) {
    setSendingTicket(id)
    const res = await fetch('/api/admin/soporte', {
      method: 'PATCH',
      headers: ADMIN_HEADERS,
      body: JSON.stringify({ id, status, respuesta, enviarEmail }),
    })
    const json = await res.json()
    if (json.ok) {
      setTickets(prev => prev.map(t =>
        t.id === id ? { ...t, status: status as TicketRow['status'], respuesta: respuesta ?? t.respuesta } : t
      ))
      setTicketMsg({ id, text: enviarEmail ? '✓ Respuesta enviada por email' : '✓ Estado actualizado', ok: true })
      if (enviarEmail) setExpandedTicket(null)
    } else {
      setTicketMsg({ id, text: json.error ?? 'Error', ok: false })
    }
    setSendingTicket(null)
    setTimeout(() => setTicketMsg(null), 3000)
  }

  async function fetchReportes() {
    setLoadingR(true)
    const res = await fetch('/api/admin/reportes', { headers: ADMIN_HEADERS })
    const json = await res.json()
    if (json.reportes) setReportes(json.reportes)
    setLoadingR(false)
  }

  useEffect(() => {
    if (tab === 'reportes') fetchReportes()
  }, [tab])

  function startEdit(r: ReporteRow) {
    setEditingId(r.id)
    setForm({ numero: String(r.numero), titulo: r.titulo, fecha: r.fecha, descripcion: r.descripcion ?? '', url_pdf: r.url_pdf ?? '' })
    setPdfFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setFormError('')
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setPdfFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setFormError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!form.numero || !form.titulo || !form.fecha) {
      setFormError('Número, título y fecha son obligatorios.')
      return
    }
    setUploading(true)
    let url_pdf = form.url_pdf
    if (pdfFile) {
      const fd = new FormData()
      fd.append('file', pdfFile)
      const res = await fetch('/api/admin/reportes/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
        body: fd,
      })
      const json = await res.json()
      if (!res.ok) { setFormError(json.error ?? 'Error al subir el PDF'); setUploading(false); return }
      url_pdf = json.url
    }

    if (editingId) {
      const res = await fetch('/api/admin/reportes', {
        method: 'PATCH',
        headers: ADMIN_HEADERS,
        body: JSON.stringify({ id: editingId, numero: Number(form.numero), titulo: form.titulo, fecha: form.fecha, descripcion: form.descripcion, url_pdf }),
      })
      const json = await res.json()
      if (!res.ok) { setFormError(json.error?.message ?? 'Error al guardar'); setUploading(false); return }
      setEditingId(null)
    } else {
      const res = await fetch('/api/admin/reportes', {
        method: 'POST',
        headers: ADMIN_HEADERS,
        body: JSON.stringify({ ...form, numero: Number(form.numero), url_pdf }),
      })
      const json = await res.json()
      if (!res.ok) { setFormError(json.error?.message ?? 'Error al guardar'); setUploading(false); return }
    }

    setForm(EMPTY_FORM)
    setPdfFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setUploading(false)
    fetchReportes()
  }

  async function toggleActivo(id: string, activo: boolean) {
    await fetch('/api/admin/reportes', {
      method: 'PATCH',
      headers: ADMIN_HEADERS,
      body: JSON.stringify({ id, activo: !activo }),
    })
    fetchReportes()
  }

  async function deleteReporte(id: string) {
    if (!confirm('¿Eliminar este reporte?')) return
    await fetch('/api/admin/reportes', {
      method: 'DELETE',
      headers: ADMIN_HEADERS,
      body: JSON.stringify({ id }),
    })
    fetchReportes()
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY)
    router.push('/admin')
  }

  function toggleModelo(tag: string) {
    setModelos(prev => prev.map(m => m.tag === tag ? { ...m, activo: !m.activo } : m))
  }

  const proCount        = users.filter(u => u.plan === 'pro').length
  const pendingTickets  = tickets.filter(t => t.status === 'pendiente').length

  const kpis = [
    { label: 'Usuarios registrados', value: loadingUsers ? '…' : users.length.toString(),                               color: 'text-gold' },
    { label: 'Usuarios PRO',         value: loadingUsers ? '…' : proCount.toString(),                                   color: 'text-gold' },
    { label: 'Fondos en DB',         value: loadingSync  ? '…' : (syncStatus?.fondos.total.toLocaleString('es-CL') ?? '—'), color: 'text-emerald-400' },
    { label: 'ETFs en DB',           value: loadingSync  ? '…' : (syncStatus?.etfs.total?.toString() ?? '—'),            color: 'text-emerald-400' },
  ]

  if (loading) return null

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">

      {/* Top bar */}
      <header className="bg-surface border-b border-border px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 border border-gold flex items-center justify-center">
              <span className="display-heading text-gold text-xs leading-none">Σ</span>
            </div>
            <span className="display-heading text-lg tracking-widest text-text">SIGMA</span>
            <span className="section-label text-gold ml-1">ADMIN</span>
          </div>
          <span className="hidden sm:block terminal-text text-xs text-muted border-l border-border pl-4">
            admin@sigma.cl
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="terminal-text text-xs text-text-dim hover:text-gold transition-colors">
            ← Ver sitio
          </Link>
          <button
            onClick={logout}
            className="section-label text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            SALIR
          </button>
        </div>
      </header>

      <div className="flex flex-1">

        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-48 bg-surface border-r border-border py-6 px-3 gap-1 shrink-0">
          {SIDEBAR_TABS.map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`section-label text-left px-3 py-2.5 transition-colors text-xs flex items-center justify-between ${
                tab === item.id
                  ? 'text-gold bg-gold/5 border-l-2 border-gold'
                  : 'text-text-dim hover:text-gold hover:bg-gold/5 border-l-2 border-transparent'
              }`}
            >
              {item.label}
              {item.id === 'soporte' && pendingTickets > 0 && (
                <span className="bg-yellow-400/20 text-yellow-400 text-[10px] px-1.5 py-0.5 rounded-full leading-none">
                  {pendingTickets}
                </span>
              )}
            </button>
          ))}

          <div className="border-t border-border my-3 mx-1" />

          <Link
            href="/admin/lp-signal"
            className="section-label text-left px-3 py-2.5 text-xs text-text-dim hover:text-gold hover:bg-gold/5 border-l-2 border-transparent transition-colors flex items-center justify-between"
          >
            LP SIGNAL
            <span className="text-muted text-[10px]">↗</span>
          </Link>
        </aside>

        {/* Mobile tabs */}
        <div className="md:hidden w-full border-b border-border bg-surface px-4 flex gap-1 overflow-x-auto">
          {SIDEBAR_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`section-label text-xs py-3 px-3 whitespace-nowrap border-b-2 transition-colors ${
                tab === t.id ? 'text-gold border-gold' : 'text-text-dim border-transparent'
              }`}
            >
              {t.label}
            </button>
          ))}
          <Link
            href="/admin/lp-signal"
            className="section-label text-xs py-3 px-3 whitespace-nowrap border-b-2 border-transparent text-text-dim"
          >
            LP SIGNAL ↗
          </Link>
        </div>

        {/* Main content */}
        <main className="flex-1 p-6 overflow-auto">

          {/* ── RESUMEN ── */}
          {tab === 'resumen' && (
            <div className="flex flex-col gap-8">
              <div>
                <div className="section-label text-gold mb-1">{'// RESUMEN'}</div>
                <h2 className="display-heading text-4xl text-text">OVERVIEW</h2>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border">
                {kpis.map(k => (
                  <div key={k.label} className="bg-surface p-5">
                    <div className="section-label text-text-dim text-xs mb-1">{k.label}</div>
                    <div className={`display-heading text-5xl num tabular-nums ${k.color}`}>{k.value}</div>
                  </div>
                ))}
              </div>

              <div className="grid md:grid-cols-2 gap-px bg-border">
                {/* Estado de usuarios */}
                <div className="bg-surface p-6">
                  <div className="section-label text-gold mb-4">ESTADO DE USUARIOS</div>
                  {loadingUsers ? (
                    <div className="terminal-text text-xs text-muted">Cargando…</div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {[
                        { label: 'PRO',            count: proCount,                      total: users.length },
                        { label: 'FREE',           count: users.length - proCount,        total: users.length },
                      ].map(({ label, count, total }) => {
                        const pct = total ? Math.round((count / total) * 100) : 0
                        return (
                          <div key={label}>
                            <div className="flex justify-between mb-1">
                              <span className="section-label text-xs text-text-dim">{label}</span>
                              <span className="terminal-text text-xs text-text-dim num">{count} ({pct}%)</span>
                            </div>
                            <div className="h-1.5 bg-border">
                              <div className="h-full bg-gold-gradient transition-all duration-700" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                      <div className="terminal-text text-xs text-muted mt-1">
                        Último registro: {users[0] ? fmtDate(users[0].created_at) : '—'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Estado de sync */}
                <div className="bg-surface p-6">
                  <div className="section-label text-gold mb-4">SYNC DE DATOS</div>
                  {loadingSync ? (
                    <div className="terminal-text text-xs text-muted">Cargando…</div>
                  ) : syncStatus ? (
                    <div className="flex flex-col gap-3">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="section-label text-xs text-text-dim">Fondos hoy</span>
                          <span className="terminal-text text-xs text-gold num">
                            {syncStatus.fondos.updatedToday.toLocaleString('es-CL')} / {syncStatus.fondos.total.toLocaleString('es-CL')} ({syncStatus.fondos.pctToday}%)
                          </span>
                        </div>
                        <div className="h-1.5 bg-border">
                          <div className="h-full bg-gold-gradient transition-all duration-700" style={{ width: `${syncStatus.fondos.pctToday}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between py-1.5 border-b border-border">
                        <span className="terminal-text text-xs text-text">ETFs</span>
                        <span className="terminal-text text-xs text-emerald-400 num">{syncStatus.etfs.total} fondos</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="terminal-text text-xs text-text">AGFs cubiertos</span>
                        <span className="terminal-text text-xs text-text-dim num">{syncStatus.agf.total}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Estado modelos */}
              <div className="bg-surface p-6">
                <div className="section-label text-gold mb-4">ESTADO DE MODELOS</div>
                <div className="grid md:grid-cols-3 gap-px bg-border">
                  {modelos.map(m => (
                    <div key={m.tag} className="bg-bg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${m.activo ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span className="terminal-text text-xs text-text">{m.name}</span>
                      </div>
                      <span className={`section-label text-xs ${m.activo ? 'text-emerald-400' : 'text-muted'}`}>
                        {m.activo ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── USUARIOS ── */}
          {tab === 'usuarios' && (
            <div className="flex flex-col gap-6">
              <div className="flex items-end justify-between">
                <div>
                  <div className="section-label text-gold mb-1">{'// GESTIÓN'}</div>
                  <h2 className="display-heading text-4xl text-text">USUARIOS</h2>
                </div>
                <button
                  onClick={fetchUsers}
                  className="section-label text-xs text-gold border border-gold/30 px-3 py-1.5 hover:bg-gold/5 transition-colors"
                >
                  ACTUALIZAR
                </button>
              </div>

              {loadingUsers ? (
                <div className="terminal-text text-xs text-muted">Cargando…</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-surface border-b border-border">
                        {['Nombre', 'Email', 'Plan', 'Registro', 'Último acceso', 'Estado'].map(h => (
                          <th key={h} className="section-label text-text-dim text-xs text-left px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} className="border-b border-border hover:bg-surface/60 transition-colors">
                          <td className="terminal-text text-sm text-text px-4 py-3">{u.nombre || '—'}</td>
                          <td className="terminal-text text-xs text-text-dim px-4 py-3">{u.email}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => togglePlan(u)}
                              className={`section-label text-xs border px-2.5 py-1 transition-colors ${
                                u.plan === 'pro'
                                  ? 'text-gold border-gold/40 hover:bg-gold/10'
                                  : 'text-text-dim border-border hover:border-gold/40 hover:text-gold'
                              }`}
                            >
                              {u.plan === 'pro' ? 'PRO' : 'FREE'}
                            </button>
                          </td>
                          <td className="terminal-text text-xs text-text-dim px-4 py-3 num">{u.created_at.slice(0, 10)}</td>
                          <td className="terminal-text text-xs text-text-dim px-4 py-3 num">
                            {u.last_sign_in ? u.last_sign_in.slice(0, 10) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`section-label text-xs ${u.confirmed ? 'text-emerald-400' : 'text-yellow-400'}`}>
                              {u.confirmed ? 'CONFIRMADO' : 'PENDIENTE'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr>
                          <td colSpan={6} className="terminal-text text-xs text-muted px-4 py-6 text-center">Sin usuarios.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── SOLICITUDES ── */}
          {tab === 'solicitudes' && (
            <div className="flex flex-col gap-6">
              <div>
                <div className="section-label text-gold mb-1">{'// CONTACTO'}</div>
                <h2 className="display-heading text-4xl text-text">SOLICITUDES</h2>
              </div>

              <div className="flex flex-col gap-px bg-border">
                {mockSolicitudes.map(s => (
                  <div key={s.id} className="bg-surface p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="terminal-text text-sm text-text">{s.nombre}</span>
                        {s.empresa && <span className="terminal-text text-xs text-text-dim">· {s.empresa}</span>}
                      </div>
                      <span className="terminal-text text-xs text-text-dim">{s.email}</span>
                      <span className="terminal-text text-xs text-gold mt-1">{s.motivo}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="terminal-text text-xs text-muted num">{s.fecha}</span>
                      <span className={`section-label text-xs ${s.estado === 'PENDIENTE' ? 'text-yellow-400' : 'text-emerald-400'}`}>
                        {s.estado}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── MODELOS ── */}
          {tab === 'modelos' && (
            <div className="flex flex-col gap-6">
              <div>
                <div className="section-label text-gold mb-1">{'// INFRAESTRUCTURA'}</div>
                <h2 className="display-heading text-4xl text-text">MODELOS ML</h2>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
                {modelos.map(m => (
                  <div key={m.tag} className="bg-surface p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="terminal-text text-xs text-gold border border-gold/20 px-2 py-0.5">{m.tag}</span>
                      <span className={`section-label text-xs ${m.status === 'PRODUCCIÓN' ? 'text-emerald-400' : 'text-yellow-400'}`}>
                        {m.status}
                      </span>
                    </div>
                    <div>
                      <div className="display-heading text-2xl text-text">{m.name}</div>
                      <div className="terminal-text text-xs text-text-dim mt-1 num tabular-nums">
                        {m.accuracy} · {m.metric}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleModelo(m.tag)}
                      className={`flex items-center gap-2 self-start section-label text-xs transition-colors ${m.activo ? 'text-emerald-400' : 'text-muted'}`}
                    >
                      <div className={`w-8 h-4 rounded-full transition-colors relative ${m.activo ? 'bg-emerald-400/30' : 'bg-border'}`}>
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${m.activo ? 'left-4 bg-emerald-400' : 'left-0.5 bg-muted'}`} />
                      </div>
                      {m.activo ? 'ACTIVO' : 'INACTIVO'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── REPORTES ── */}
          {tab === 'reportes' && (
            <div className="flex flex-col gap-8">
              <div>
                <div className="section-label text-gold mb-1">{'// PUBLICACIÓN'}</div>
                <h2 className="display-heading text-4xl text-text">REPORTES</h2>
              </div>

              <div ref={formRef} className={`border p-6 ${editingId ? 'bg-gold/5 border-gold/40' : 'bg-surface border-border'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="section-label text-gold">
                    {editingId ? `EDITANDO REPORTE #${form.numero.padStart(3, '0')}` : 'NUEVO REPORTE'}
                  </div>
                  {editingId && (
                    <button type="button" onClick={cancelEdit} className="section-label text-xs text-text-dim hover:text-red-400 transition-colors">
                      CANCELAR
                    </button>
                  )}
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="section-label text-text-dim text-xs">Número</label>
                      <input type="number" required value={form.numero}
                        onChange={e => setForm(p => ({ ...p, numero: e.target.value }))}
                        placeholder="001"
                        className="bg-bg border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text text-sm placeholder:text-muted transition-colors"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label className="section-label text-text-dim text-xs">Título</label>
                      <input type="text" required value={form.titulo}
                        onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                        placeholder="Reporte Mensual #001"
                        className="bg-bg border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text text-sm placeholder:text-muted transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="section-label text-text-dim text-xs">Fecha de publicación</label>
                      <input type="date" required value={form.fecha}
                        onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}
                        className="bg-bg border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text text-sm transition-colors"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="section-label text-text-dim text-xs">PDF — subir archivo</label>
                      <input ref={fileRef} type="file" accept=".pdf"
                        onChange={e => setPdfFile(e.target.files?.[0] ?? null)}
                        className="bg-bg border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text text-sm transition-colors file:mr-3 file:bg-gold file:border-0 file:text-bg file:section-label file:text-xs file:px-3 file:py-1 file:cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="section-label text-text-dim text-xs">URL directa (opcional si subiste archivo)</label>
                    <input type="url" value={form.url_pdf}
                      onChange={e => setForm(p => ({ ...p, url_pdf: e.target.value }))}
                      placeholder="https://..."
                      className="bg-bg border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text text-sm placeholder:text-muted transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="section-label text-text-dim text-xs">Descripción</label>
                    <textarea rows={3} value={form.descripcion}
                      onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                      placeholder="Resumen breve del contenido del reporte…"
                      className="bg-bg border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text text-sm placeholder:text-muted transition-colors resize-none"
                    />
                  </div>

                  {formError && <p className="terminal-text text-red-400 text-xs">{formError}</p>}

                  <div className="flex items-center gap-3">
                    <button type="submit" disabled={uploading}
                      className="bg-gold text-bg section-label text-sm px-8 py-3 hover:bg-gold-glow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploading ? 'GUARDANDO…' : editingId ? 'GUARDAR CAMBIOS' : 'PUBLICAR REPORTE'}
                    </button>
                    {editingId && (
                      <button type="button" onClick={cancelEdit} className="section-label text-xs text-text-dim hover:text-red-400 transition-colors px-4 py-3">
                        CANCELAR
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="flex flex-col gap-px bg-border">
                <div className="bg-surface px-5 py-3">
                  <span className="section-label text-text-dim text-xs">REPORTES PUBLICADOS</span>
                </div>
                {loadingR ? (
                  <div className="bg-bg p-8 text-center terminal-text text-xs text-muted">Cargando…</div>
                ) : reportes.length === 0 ? (
                  <div className="bg-bg p-8 text-center terminal-text text-xs text-muted">No hay reportes todavía.</div>
                ) : reportes.map(r => (
                  <div key={r.id} className="bg-bg px-5 py-4 flex items-center gap-4 flex-wrap">
                    <span className="display-heading text-2xl text-gold min-w-[3rem]">
                      #{String(r.numero).padStart(3, '0')}
                    </span>
                    <div className="flex-1 min-w-[200px]">
                      <div className="terminal-text text-sm text-text">{r.titulo}</div>
                      <div className="terminal-text text-xs text-text-dim mt-0.5">{r.descripcion}</div>
                      <div className="terminal-text text-xs text-muted mt-0.5">{r.fecha}</div>
                    </div>
                    {r.url_pdf
                      ? <a href={r.url_pdf} target="_blank" rel="noopener noreferrer" className="terminal-text text-xs text-gold hover:underline">PDF ↗</a>
                      : <span className="terminal-text text-xs text-muted">sin PDF</span>
                    }
                    <button onClick={() => toggleActivo(r.id, r.activo)}
                      className={`section-label text-xs border px-3 py-1 transition-colors ${
                        r.activo
                          ? 'text-emerald-400 border-emerald-400/30 hover:border-red-400 hover:text-red-400'
                          : 'text-muted border-border hover:border-gold hover:text-gold'
                      }`}>
                      {r.activo ? 'ACTIVO' : 'OCULTO'}
                    </button>
                    <button onClick={() => startEdit(r)}
                      className={`section-label text-xs border px-3 py-1 transition-colors ${
                        editingId === r.id
                          ? 'text-gold border-gold bg-gold/10'
                          : 'text-text-dim border-border hover:border-gold hover:text-gold'
                      }`}>
                      EDITAR
                    </button>
                    <button onClick={() => deleteReporte(r.id)}
                      className="section-label text-xs text-red-400/60 hover:text-red-400 transition-colors">
                      ELIMINAR
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TASAS DAP ── */}
          {tab === 'tasas' && (
            <div className="flex flex-col gap-6">
              <div>
                <div className="section-label text-gold mb-1">{'// TASAS DAP'}</div>
                <h2 className="display-heading text-4xl text-text">DEPÓSITOS A PLAZO</h2>
                <p className="text-text-dim text-sm mt-2">Actualiza las tasas de los bancos. Se reflejan en el comparador en menos de 1 hora.</p>
              </div>
              <TasasDapEditor adminSecret={ADMIN_SECRET} />
            </div>
          )}

          {/* ── SOPORTE ── */}
          {tab === 'soporte' && (
            <div className="flex flex-col gap-6">
              <div className="flex items-end justify-between">
                <div>
                  <div className="section-label text-gold mb-1">{'// SOPORTE'}</div>
                  <h2 className="display-heading text-4xl text-text">TICKETS</h2>
                </div>
                <button onClick={fetchTickets} className="section-label text-xs text-gold border border-gold/30 px-3 py-1.5 hover:bg-gold/5 transition-colors">
                  ACTUALIZAR
                </button>
              </div>

              {/* Resumen de estados */}
              {!loadingTickets && tickets.length > 0 && (
                <div className="grid grid-cols-3 gap-px bg-border">
                  {(['pendiente', 'visto', 'resuelto'] as const).map(s => {
                    const count = tickets.filter(t => t.status === s).length
                    const colors = { pendiente: 'text-yellow-400', visto: 'text-gold', resuelto: 'text-emerald-400' }
                    return (
                      <div key={s} className="bg-surface p-4 text-center">
                        <div className={`display-heading text-4xl num ${colors[s]}`}>{count}</div>
                        <div className="section-label text-text-dim text-xs mt-1">{s.toUpperCase()}</div>
                      </div>
                    )
                  })}
                </div>
              )}

              {loadingTickets ? (
                <div className="terminal-text text-xs text-muted">Cargando…</div>
              ) : tickets.length === 0 ? (
                <div className="bg-surface border border-border p-8 text-center terminal-text text-xs text-muted">
                  No hay tickets todavía.
                </div>
              ) : (
                <div className="flex flex-col gap-px bg-border">
                  {tickets.map(t => {
                    const isExpanded = expandedTicket === t.id
                    const statusColors = {
                      pendiente: 'text-yellow-400 border-yellow-400/30',
                      visto:     'text-gold border-gold/30',
                      resuelto:  'text-emerald-400 border-emerald-400/30',
                    }
                    return (
                      <div key={t.id} className={`bg-surface ${isExpanded ? 'border-l-2 border-gold' : ''}`}>
                        {/* Cabecera del ticket */}
                        <div
                          className="p-5 flex flex-col sm:flex-row sm:items-center gap-3 cursor-pointer hover:bg-gold/5 transition-colors"
                          onClick={() => setExpandedTicket(isExpanded ? null : t.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="terminal-text text-sm text-text font-medium">{t.nombre}</span>
                              {t.empresa && <span className="terminal-text text-xs text-text-dim">· {t.empresa}</span>}
                              <span className={`section-label text-[10px] border px-2 py-0.5 ${statusColors[t.status]}`}>
                                {t.status.toUpperCase()}
                              </span>
                            </div>
                            <div className="terminal-text text-xs text-text-dim mt-0.5">{t.email}</div>
                            {t.motivo && <div className="terminal-text text-xs text-gold mt-1">{t.motivo}</div>}
                            <div className="terminal-text text-xs text-muted mt-1 line-clamp-1">{t.mensaje}</div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="terminal-text text-xs text-muted num">
                              {new Date(t.created_at).toLocaleDateString('es-CL')}
                            </span>
                            <span className="terminal-text text-xs text-text-dim">{isExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>

                        {/* Detalle expandido */}
                        {isExpanded && (
                          <div className="px-5 pb-6 flex flex-col gap-4 border-t border-border">
                            {/* Mensaje completo */}
                            <div className="mt-4">
                              <div className="section-label text-text-dim text-xs mb-2">MENSAJE</div>
                              <div className="bg-bg border border-border p-4 terminal-text text-sm text-text-dim leading-relaxed whitespace-pre-wrap">
                                {t.mensaje}
                              </div>
                            </div>

                            {/* Respuesta anterior si existe */}
                            {t.respuesta && (
                              <div>
                                <div className="section-label text-emerald-400 text-xs mb-2">RESPUESTA ENVIADA</div>
                                <div className="bg-emerald-900/10 border border-emerald-400/20 p-4 terminal-text text-sm text-text-dim leading-relaxed whitespace-pre-wrap">
                                  {t.respuesta}
                                </div>
                              </div>
                            )}

                            {/* Cambio de estado rápido */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="section-label text-text-dim text-xs">ESTADO:</span>
                              {(['pendiente', 'visto', 'resuelto'] as const).map(s => (
                                <button
                                  key={s}
                                  onClick={() => updateTicket(t.id, s)}
                                  disabled={t.status === s || sendingTicket === t.id}
                                  className={`section-label text-xs border px-3 py-1 transition-colors disabled:opacity-40 ${
                                    t.status === s
                                      ? statusColors[s]
                                      : 'text-text-dim border-border hover:border-gold hover:text-gold'
                                  }`}
                                >
                                  {s.toUpperCase()}
                                </button>
                              ))}
                            </div>

                            {/* Área de respuesta */}
                            <div>
                              <div className="section-label text-gold text-xs mb-2">
                                {t.respuesta ? 'NUEVA RESPUESTA' : 'RESPONDER'}
                              </div>
                              <textarea
                                rows={4}
                                value={respuestas[t.id] ?? ''}
                                onChange={e => setRespuestas(prev => ({ ...prev, [t.id]: e.target.value }))}
                                placeholder="Escribe tu respuesta aquí…"
                                className="w-full bg-bg border border-border focus:border-gold/60 outline-none px-4 py-3 terminal-text text-text text-sm placeholder:text-muted transition-colors resize-none"
                              />
                              <div className="flex items-center gap-3 mt-3 flex-wrap">
                                <button
                                  onClick={() => updateTicket(t.id, 'resuelto', respuestas[t.id], true)}
                                  disabled={!respuestas[t.id]?.trim() || sendingTicket === t.id}
                                  className="section-label text-sm bg-gold text-bg px-6 py-2.5 hover:bg-gold-glow transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  {sendingTicket === t.id ? 'ENVIANDO…' : 'ENVIAR RESPUESTA'}
                                </button>
                                <button
                                  onClick={() => updateTicket(t.id, 'resuelto', respuestas[t.id], false)}
                                  disabled={sendingTicket === t.id}
                                  className="section-label text-xs text-text-dim border border-border px-4 py-2.5 hover:border-gold hover:text-gold transition-colors disabled:opacity-40"
                                >
                                  MARCAR RESUELTO SIN EMAIL
                                </button>
                              </div>
                            </div>

                            {/* Feedback */}
                            {ticketMsg?.id === t.id && (
                              <div className={`terminal-text text-xs ${ticketMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                                {ticketMsg.text}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── SYNC DATOS ── */}
          {tab === 'sync' && (
            <div className="flex flex-col gap-8">
              <div className="flex items-end justify-between">
                <div>
                  <div className="section-label text-gold mb-1">{'// SINCRONIZACIÓN'}</div>
                  <h2 className="display-heading text-4xl text-text">ESTADO DE DATOS</h2>
                </div>
                <button
                  onClick={fetchSyncStatus}
                  className="section-label text-xs text-gold border border-gold/30 px-3 py-1.5 hover:bg-gold/5 transition-colors"
                >
                  ACTUALIZAR
                </button>
              </div>

              {loadingSync ? (
                <div className="terminal-text text-xs text-muted">Cargando…</div>
              ) : syncStatus ? (
                <div className="grid md:grid-cols-2 gap-px bg-border">

                  {/* Fondos Mutuos */}
                  <div className="bg-surface p-6 flex flex-col gap-5">
                    <div className="section-label text-gold">FONDOS MUTUOS</div>

                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span className="terminal-text text-xs text-text-dim">Actualizados hoy</span>
                        <span className="terminal-text text-xs text-gold num tabular-nums">
                          {syncStatus.fondos.updatedToday.toLocaleString('es-CL')} / {syncStatus.fondos.total.toLocaleString('es-CL')} ({syncStatus.fondos.pctToday}%)
                        </span>
                      </div>
                      <div className="h-2 bg-border">
                        <div
                          className="h-full bg-gold-gradient transition-all duration-700"
                          style={{ width: `${syncStatus.fondos.pctToday}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-px bg-border">
                      <div className="bg-bg p-4">
                        <div className="section-label text-text-dim text-xs mb-1">Total fondos</div>
                        <div className="display-heading text-4xl text-gold num">{syncStatus.fondos.total.toLocaleString('es-CL')}</div>
                      </div>
                      <div className="bg-bg p-4">
                        <div className="section-label text-text-dim text-xs mb-1">AGFs cubiertos</div>
                        <div className="display-heading text-4xl text-text num">{syncStatus.agf.total}</div>
                      </div>
                    </div>

                    {syncStatus.fondos.lastUpdate && (
                      <div className="terminal-text text-xs text-text-dim">
                        Última sync: {fmtDate(syncStatus.fondos.lastUpdate)}
                      </div>
                    )}
                  </div>

                  {/* ETFs */}
                  <div className="bg-surface p-6 flex flex-col gap-5">
                    <div className="section-label text-gold">ETFs</div>

                    <div className="bg-bg p-4">
                      <div className="section-label text-text-dim text-xs mb-1">Total ETFs</div>
                      <div className="display-heading text-4xl text-gold num">{syncStatus.etfs.total}</div>
                    </div>

                    {syncStatus.etfs.lastUpdate && (
                      <div className="terminal-text text-xs text-text-dim">
                        Última sync: {fmtDate(syncStatus.etfs.lastUpdate)}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-auto">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="terminal-text text-xs text-emerald-400">Sync diario 3 AM Chile</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="terminal-text text-xs text-red-400">Error cargando estado</div>
              )}

              {/* Schedule */}
              <div className="bg-surface border border-border p-6">
                <div className="section-label text-gold mb-4">SCHEDULE GITHUB ACTIONS</div>
                <div className="flex flex-col gap-3">
                  {[
                    { color: 'bg-emerald-400', text: 'Fondos Mutuos (update) — Lun a Sáb · 3:00 AM Chile' },
                    { color: 'bg-yellow-400',  text: 'Fondos Mutuos (discover) — Domingos · 2:00 AM Chile' },
                    { color: 'bg-emerald-400', text: 'ETFs — Todos los días · 3:00 AM Chile' },
                  ].map(({ color, text }) => (
                    <div key={text} className="flex items-center gap-3">
                      <span className={`w-1.5 h-1.5 rounded-full ${color} shrink-0`} />
                      <span className="terminal-text text-xs text-text">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}

// ── Editor de tasas DAP ───────────────────────────────────────────────────────
interface TasaRow {
  id: string; nombre: string
  d7: number; d14: number; d30: number; d60: number; d90: number; d180: number; d360: number
  updated_at: string
}
const PLAZOS_DAP = ['d7','d14','d30','d60','d90','d180','d360'] as const
const LABELS_DAP: Record<string, string> = { d7:'7d', d14:'14d', d30:'30d', d60:'60d', d90:'90d', d180:'180d', d360:'360d' }

function TasasDapEditor({ adminSecret }: { adminSecret: string }) {
  const [tasas,   setTasas]   = useState<TasaRow[]>([])
  const [editing, setEditing] = useState<Record<string, Partial<TasaRow>>>({})
  const [saving,  setSaving]  = useState<string | null>(null)
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    fetch('/api/tasas-dap').then(r => r.json()).then(j => { if (j.ok) setTasas(j.data) }).catch(() => {})
  }, [])

  function handleChange(id: string, field: string, value: string) {
    setEditing(prev => ({ ...prev, [id]: { ...prev[id], [field]: parseFloat(value) || 0 } }))
  }

  async function handleSave(banco: TasaRow) {
    setSaving(banco.id)
    const updated = { ...banco, ...editing[banco.id] }
    const r = await fetch('/api/admin/tasas-dap', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminSecret}` },
      body: JSON.stringify(updated),
    })
    const j = await r.json()
    if (j.ok) {
      setMsg({ text: `✓ ${banco.nombre} guardado`, ok: true })
      setEditing(prev => { const n = { ...prev }; delete n[banco.id]; return n })
      fetch('/api/tasas-dap').then(r => r.json()).then(j => { if (j.ok) setTasas(j.data) }).catch(() => {})
    } else {
      setMsg({ text: `Error: ${j.error}`, ok: false })
    }
    setSaving(null)
    setTimeout(() => setMsg(null), 3000)
  }

  return (
    <div className="bg-surface border border-border">
      {msg && (
        <div className={`px-4 py-3 text-sm font-mono ${msg.ok ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
          {msg.text}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-mono tracking-widest text-text-dim uppercase">Banco</th>
              {PLAZOS_DAP.map(p => (
                <th key={p} className="text-right px-3 py-3 text-xs font-mono tracking-widest text-text-dim uppercase">{LABELS_DAP[p]}</th>
              ))}
              <th className="px-4 py-3 text-xs font-mono text-text-dim uppercase text-center">Acción</th>
              <th className="px-4 py-3 text-xs font-mono text-text-dim uppercase">Actualizado</th>
            </tr>
          </thead>
          <tbody>
            {tasas.map(b => {
              const ed = editing[b.id] ?? {}
              const isDirty = Object.keys(ed).length > 0
              return (
                <tr key={b.id} className={`border-b border-border ${isDirty ? 'bg-gold/5' : ''}`}>
                  <td className="px-4 py-3 font-mono text-sm text-text">{b.nombre}</td>
                  {PLAZOS_DAP.map(p => (
                    <td key={p} className="px-3 py-3 text-right">
                      <input
                        type="number" step="0.01" min="0" max="5"
                        value={(ed[p as keyof TasaRow] ?? b[p as keyof TasaRow] ?? '') as number}
                        onChange={e => handleChange(b.id, p, e.target.value)}
                        className="bg-background border border-border text-text font-mono text-sm text-right w-16 px-2 py-1"
                      />
                      <span className="text-text-dim text-xs ml-1">%</span>
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center">
                    {isDirty ? (
                      <button
                        onClick={() => handleSave(b)}
                        disabled={saving === b.id}
                        className="section-label text-xs bg-gold text-background px-3 py-1.5 hover:bg-gold/80 transition-colors disabled:opacity-50"
                      >
                        {saving === b.id ? '...' : 'GUARDAR'}
                      </button>
                    ) : (
                      <span className="text-text-dim text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-dim">
                    {b.updated_at ? new Date(b.updated_at).toLocaleDateString('es-CL') : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-border text-xs font-mono text-text-dim">
        Tasas en % mensual · Fuente: verificar sitios web de cada banco · Actualización mensual recomendada
      </div>
    </div>
  )
}
