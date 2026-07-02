'use client'
import { useState, useEffect, useRef, useMemo, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  BarChart2, Users, MessageSquare, ClipboardList, Mail,
  FileText, Cpu, Search, Plus,
  Bell, LogOut, ExternalLink, X, ChevronRight, RefreshCw,
} from 'lucide-react'

const SESSION_KEY   = 'sigma_admin_auth'
const ADMIN_HEADERS = { 'Content-Type': 'application/json' }

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

interface CampañaRow {
  id: string; segmento: string; subject: string; title: string; sent_count: number; sent_at: string
}

interface CronEntry { lastRun: string | null; status: 'ok' | 'stale' | 'unknown' }
interface SystemHealth {
  crons: { syncFondos: CronEntry; motorSignals: CronEntry; motorAccuracy: CronEntry; sistemaNotifs: CronEntry }
  pending: { lpSignals: number; lpItems: { id: string; hyp_text?: string }[]; reportesSinPdf: number; reportesItems: { id: string; titulo: string; numero: number }[] }
  recentAudit: { id: string; ts: string; action: string; target_id: string | null; meta: Record<string, unknown> | null }[]
}

interface BizAlert { id: string; email?: string; nombre?: string; lastSeen?: string | null; registeredAt?: string; since?: string }
interface BizMetrics {
  mrr: number; mrrGoal: number
  totalUsers: number; proCount: number; freeCount: number; confirmedCount: number
  thisWeek: number; lastWeek: number; weeklyGrowthPct: number | null; weeksToGoal: number
  conversionRate: number
  alerts: { churnRisk: BizAlert[]; convOpportunity: BizAlert[]; urgentTickets: BizAlert[] }
}

interface MarketingForm {
  segmento: 'todos' | 'pro' | 'free'
  subject: string
  title: string
  subtitle: string
  body: string
  ctaText: string
  ctaUrl: string
}

const MARKETING_EMPTY: MarketingForm = {
  segmento: 'pro',
  subject: '',
  title: '',
  subtitle: '',
  body: '',
  ctaText: '',
  ctaUrl: '',
}

type ModeloRow = { tag: string; name: string; status: string; accuracy: string; metric: string; activo: boolean }

type Tab = 'resumen' | 'usuarios' | 'solicitudes' | 'modelos' | 'reportes' | 'soporte' | 'marketing'

const SIDEBAR_GROUPS: { label: string; items: { id: Tab; label: string; icon: React.ElementType }[] }[] = [
  {
    label: 'NEGOCIO',
    items: [{ id: 'resumen', label: 'Resumen', icon: BarChart2 }],
  },
  {
    label: 'COMUNIDAD',
    items: [
      { id: 'usuarios',    label: 'Usuarios',    icon: Users          },
      { id: 'soporte',     label: 'Soporte',     icon: MessageSquare  },
      { id: 'solicitudes', label: 'Solicitudes', icon: ClipboardList  },
      { id: 'marketing',   label: 'Marketing',   icon: Mail           },
    ],
  },
  {
    label: 'CONTENIDO',
    items: [
      { id: 'reportes', label: 'Reportes', icon: FileText },
      { id: 'modelos',  label: 'Modelos',  icon: Cpu      },
    ],
  },
]

// Flat list for mobile tabs (same order)
const SIDEBAR_TABS = SIDEBAR_GROUPS.flatMap(g => g.items)

const EMPTY_FORM = { numero: '', titulo: '', fecha: '', descripcion: '', url_pdf: '' }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
}

function relativeTime(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
  if (h < 1) return 'hace < 1h'
  if (h < 24) return `hace ${h}h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'ayer' : `hace ${d} días`
}

export default function AdminDashboard() {
  const router  = useRouter()
  const [tab,          setTab]          = useState<Tab>('resumen')
  const [modelos,      setModelos]      = useState<ModeloRow[]>([])
  const [modelosError, setModelosError] = useState<string | null>(null)
  const [loading,      setLoading]      = useState(true)

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

  // ── Usuario expandido / email directo ────────────────────────────────────────
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [emailDirecto, setEmailDirecto] = useState<Record<string, string>>({})
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)
  const [emailMsg,     setEmailMsg]     = useState<{ id: string; ok: boolean; text: string } | null>(null)

  // ── Marketing ────────────────────────────────────────────────────────────────
  const [mktForm,     setMktForm]     = useState<MarketingForm>(MARKETING_EMPTY)
  const [sendingMkt,  setSendingMkt]  = useState(false)
  const [mktResult,   setMktResult]   = useState<{ ok: boolean; text: string } | null>(null)
  const [campañas,    setCampañas]    = useState<CampañaRow[]>([])
  const [loadingCamp, setLoadingCamp] = useState(false)

  // ── Business metrics ─────────────────────────────────────────────────────────
  const [bizMetrics,    setBizMetrics]    = useState<BizMetrics | null>(null)
  const [loadingBiz,    setLoadingBiz]    = useState(false)

  // ── System health ─────────────────────────────────────────────────────────────
  const [systemHealth,  setSystemHealth]  = useState<SystemHealth | null>(null)
  const [loadingSys,    setLoadingSys]    = useState(false)

  // ── Ctrl+K global search ──────────────────────────────────────────────────
  const [cmdkOpen,      setCmdkOpen]      = useState(false)
  const [searchQuery,   setSearchQuery]   = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // ── Right panel (user detail) ─────────────────────────────────────────────
  const [rightPanel,    setRightPanel]    = useState<UserRow | null>(null)

  // ── Pine Scripts ─────────────────────────────────────────────────────────────
  const [pineDownloading, setPineDownloading] = useState<string | null>(null)
  const [pineValidating,  setPineValidating]  = useState(false)
  const [pineValidResult, setPineValidResult] = useState<{ total_errors: number; validated_at: string; motors: { motor: number; total_errors: number; total_warns: number }[] } | null>(null)

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) !== 'true') {
      router.replace('/admin')
    } else {
      setLoading(false)
      fetchUsers()
      fetchSyncStatus()
      fetchTickets()
      fetchModelosState()
      fetchCampañas()
      fetchBizMetrics()
      fetchSystemHealth()
    }
  }, [router])

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCmdkOpen(prev => !prev)
        setSearchQuery('')
      }
      if (e.key === 'Escape') { setCmdkOpen(false); setRightPanel(null) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (cmdkOpen) setTimeout(() => searchRef.current?.focus(), 50)
  }, [cmdkOpen])

  async function fetchModelosState() {
    setModelosError(null)
    try {
      // Intentar cargar champions reales desde el VPS
      const vpsRes = await fetch('/api/vps/champions', { cache: 'no-store' })
      if (vpsRes.ok) {
        const champions = await vpsRes.json()
        if (Array.isArray(champions) && champions.length > 0) {
          // Construir vista de modelos a partir de los champions vivos
          const byMotor: Record<number, typeof champions> = {}
          champions.forEach((c: { sym?: string; grade?: string; cagr?: number }) => {
            const CRYPTO = ['BTC','ETH','SOL','BNB','LTC']
            const COMM   = ['XAU','XAG','WTI','HG','NG','PL']
            const STOCKS = ['AAPL','NVDA','TSLA','JPM','XOM']
            const motor  = CRYPTO.includes((c.sym ?? '').toUpperCase()) ? 1
              : COMM.includes((c.sym ?? '').toUpperCase()) ? 2
              : STOCKS.includes((c.sym ?? '').toUpperCase()) ? 3 : 0
            if (motor > 0) { if (!byMotor[motor]) byMotor[motor] = []; byMotor[motor].push(c) }
          })
          const rows: ModeloRow[] = [
            { tag: 'M1-CRYPTO',  name: 'MOTOR 1 — CRYPTO',  status: 'PRODUCCIÓN', accuracy: `${byMotor[1]?.length ?? 0} champions`, metric: 'Champions activos', activo: (byMotor[1]?.length ?? 0) > 0 },
            { tag: 'M2-COMM',    name: 'MOTOR 2 — COMMODITIES', status: 'PRODUCCIÓN', accuracy: `${byMotor[2]?.length ?? 0} champions`, metric: 'Champions activos', activo: (byMotor[2]?.length ?? 0) > 0 },
            { tag: 'M3-STOCKS',  name: 'MOTOR 3 — S&P 500 STOCKS', status: 'PRODUCCIÓN', accuracy: `${byMotor[3]?.length ?? 0} champions`, metric: 'Champions activos', activo: (byMotor[3]?.length ?? 0) > 0 },
          ]
          setModelos(rows)
          return
        }
      }
      // Fallback: estado activo/inactivo desde /api/admin/modelos
      const res  = await fetch('/api/admin/modelos', { headers: ADMIN_HEADERS })
      const json = await res.json()
      if (json.modelos?.length) {
        setModelos(json.modelos)
      } else {
        setModelosError('Motor no disponible — el VPS no respondió o no hay champions activos.')
      }
    } catch {
      setModelosError('Motor no disponible — error de conexión con el VPS.')
    }
  }

  async function fetchBizMetrics() {
    setLoadingBiz(true)
    try {
      const res  = await fetch('/api/admin/business-metrics', { headers: ADMIN_HEADERS })
      const json = await res.json()
      if (!json.error) setBizMetrics(json)
    } catch {}
    setLoadingBiz(false)
  }

  async function fetchSystemHealth() {
    setLoadingSys(true)
    try {
      const res  = await fetch('/api/admin/system-health', { headers: ADMIN_HEADERS })
      const json = await res.json()
      if (!json.error) setSystemHealth(json)
    } catch {}
    setLoadingSys(false)
  }

  async function fetchCampañas() {
    setLoadingCamp(true)
    try {
      const res  = await fetch('/api/admin/campanas', { headers: ADMIN_HEADERS })
      const json = await res.json()
      if (json.campanas) setCampañas(json.campanas)
    } catch {}
    setLoadingCamp(false)
  }

  async function fetchUsers() {
    setLoadingUsers(true)
    try {
      const res  = await fetch('/api/admin/usuarios', { headers: ADMIN_HEADERS })
      const json = await res.json()
      if (json.users) setUsers(json.users)
    } catch {}
    setLoadingUsers(false)
  }

  async function togglePlan(user: UserRow) {
    const newPlan = user.plan === 'pro' ? 'free' : 'pro'
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, plan: newPlan } : u))
    await fetch('/api/admin/usuarios', {
      method:  'PATCH',
      headers: ADMIN_HEADERS,
      body:    JSON.stringify({ id: user.id, plan: newPlan }),
    })
  }

  async function sendEmailDirecto(user: UserRow) {
    const msg = emailDirecto[user.id]?.trim()
    if (!msg) return
    setSendingEmail(user.id)
    try {
      const res  = await fetch('/api/admin/email-directo', {
        method:  'POST',
        headers: ADMIN_HEADERS,
        body:    JSON.stringify({ email: user.email, nombre: user.nombre || 'Trader', mensaje: msg }),
      })
      const json = await res.json()
      if (json.ok) {
        setEmailMsg({ id: user.id, ok: true, text: '✓ Email enviado' })
        setEmailDirecto(prev => { const n = { ...prev }; delete n[user.id]; return n })
        setExpandedUser(null)
      } else {
        setEmailMsg({ id: user.id, ok: false, text: json.error ?? 'Error al enviar' })
      }
    } catch {
      setEmailMsg({ id: user.id, ok: false, text: 'Error de conexión' })
    }
    setSendingEmail(null)
    setTimeout(() => setEmailMsg(null), 4000)
  }

  async function fetchSyncStatus() {
    setLoadingSync(true)
    try {
      const res  = await fetch('/api/admin/sync-status', { headers: ADMIN_HEADERS })
      const json = await res.json()
      if (json.fondos) setSyncStatus(json)
    } catch {}
    setLoadingSync(false)
  }

  async function fetchTickets() {
    setLoadingTickets(true)
    try {
      const res  = await fetch('/api/admin/soporte', { headers: ADMIN_HEADERS })
      const json = await res.json()
      if (json.tickets) setTickets(json.tickets)
    } catch {}
    setLoadingTickets(false)
  }

  async function updateTicket(id: string, status: string, respuesta?: string, enviarEmail?: boolean) {
    setSendingTicket(id)
    const res  = await fetch('/api/admin/soporte', {
      method:  'PATCH',
      headers: ADMIN_HEADERS,
      body:    JSON.stringify({ id, status, respuesta, enviarEmail }),
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
    const res  = await fetch('/api/admin/reportes', { headers: ADMIN_HEADERS })
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
      const res  = await fetch('/api/admin/reportes/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setFormError(json.error ?? 'Error al subir el PDF'); setUploading(false); return }
      url_pdf = json.url
    }

    if (editingId) {
      const res  = await fetch('/api/admin/reportes', {
        method:  'PATCH',
        headers: ADMIN_HEADERS,
        body:    JSON.stringify({ id: editingId, numero: Number(form.numero), titulo: form.titulo, fecha: form.fecha, descripcion: form.descripcion, url_pdf }),
      })
      const json = await res.json()
      if (!res.ok) { setFormError(json.error?.message ?? 'Error al guardar'); setUploading(false); return }
      setEditingId(null)
    } else {
      const res  = await fetch('/api/admin/reportes', {
        method:  'POST',
        headers: ADMIN_HEADERS,
        body:    JSON.stringify({ ...form, numero: Number(form.numero), url_pdf }),
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
      method:  'PATCH',
      headers: ADMIN_HEADERS,
      body:    JSON.stringify({ id, activo: !activo }),
    })
    fetchReportes()
  }

  async function deleteReporte(id: string) {
    if (!confirm('¿Eliminar este reporte?')) return
    await fetch('/api/admin/reportes', {
      method:  'DELETE',
      headers: ADMIN_HEADERS,
      body:    JSON.stringify({ id }),
    })
    fetchReportes()
  }

  async function sendMarketing(e: React.FormEvent) {
    e.preventDefault()
    setSendingMkt(true)
    setMktResult(null)
    try {
      const res  = await fetch('/api/admin/marketing', {
        method:  'POST',
        headers: ADMIN_HEADERS,
        body:    JSON.stringify(mktForm),
      })
      const json = await res.json()
      if (json.ok) {
        setMktResult({ ok: true, text: `✓ Enviado a ${json.sent} destinatarios` })
        // Guardar en historial
        fetch('/api/admin/campanas', {
          method: 'POST', headers: ADMIN_HEADERS,
          body: JSON.stringify({ segmento: mktForm.segmento, subject: mktForm.subject, title: mktForm.title, sent: json.sent }),
        }).then(() => fetchCampañas()).catch(() => {})
        setMktForm(MARKETING_EMPTY)
      } else {
        setMktResult({ ok: false, text: json.error ?? 'Error al enviar' })
      }
    } catch {
      setMktResult({ ok: false, text: 'Error de conexión' })
    }
    setSendingMkt(false)
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY)
    router.push('/admin')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function toggleModelo(tag: string) {
    setModelos(prev => {
      const next = prev.map(m => m.tag === tag ? { ...m, activo: !m.activo } : m)
      const modelo = next.find(m => m.tag === tag)
      if (modelo) {
        fetch('/api/admin/modelos', {
          method: 'PATCH', headers: ADMIN_HEADERS,
          body: JSON.stringify({ tag, activo: modelo.activo }),
        }).catch(() => {})
      }
      return next
    })
  }

  // ── Datos derivados ───────────────────────────────────────────────────────────
  const proCount       = users.filter(u => u.plan === 'pro').length
  const pendingTickets = tickets.filter(t => t.status === 'pendiente').length

  // Gráfico de crecimiento — últimas 8 semanas
  const growthData = useMemo(() => {
    const MS_WEEK = 7 * 24 * 3600 * 1000
    const now     = Date.now()
    return Array.from({ length: 8 }, (_, i) => {
      const start = now - (8 - i) * MS_WEEK
      const end   = now - (7 - i) * MS_WEEK
      const count = users.filter(u => {
        const t = new Date(u.created_at).getTime()
        return t >= start && t < end
      }).length
      const d = new Date(end)
      return { label: d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }), count }
    })
  }, [users])

  const growthMax = useMemo(() => Math.max(...growthData.map(w => w.count), 1), [growthData])

  const totalAlerts = (bizMetrics?.alerts.churnRisk.length ?? 0) +
    (bizMetrics?.alerts.convOpportunity.length ?? 0) +
    (bizMetrics?.alerts.urgentTickets.length ?? 0)

  const staleCrons = systemHealth
    ? Object.values(systemHealth.crons).filter(c => c.status === 'stale').length
    : 0
  const unknownCrons = systemHealth
    ? Object.values(systemHealth.crons).filter(c => c.status === 'unknown').length
    : 0

  const cmdkResults = searchQuery.trim().length > 0
    ? users.filter(u =>
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.nombre || '').toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 8)
    : []

  // Feed de actividad reciente
  const activityFeed = useMemo(() => {
    type ActivityItem = { type: 'signup' | 'ticket' | 'pro'; title: string; sub: string; badge: string; badgeColor: string; date: string }
    const items: ActivityItem[] = [
      ...users.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6).map(u => ({
        type:        (u.plan === 'pro' ? 'pro' : 'signup') as ActivityItem['type'],
        title:       u.nombre || u.email.split('@')[0],
        sub:         u.email,
        badge:       u.plan === 'pro' ? 'PRO' : 'REGISTRO',
        badgeColor:  u.plan === 'pro' ? 'text-gold border-gold/30' : 'text-emerald-400 border-emerald-400/30',
        date:        u.created_at,
      })),
      ...tickets.slice(0, 6).map(t => ({
        type:       'ticket' as ActivityItem['type'],
        title:      t.nombre,
        sub:        t.motivo || t.mensaje.slice(0, 50),
        badge:      t.status.toUpperCase(),
        badgeColor: t.status === 'pendiente' ? 'text-yellow-400 border-yellow-400/30' : t.status === 'resuelto' ? 'text-emerald-400 border-emerald-400/30' : 'text-gold border-gold/30',
        date:       t.created_at,
      })),
    ]
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10)
  }, [users, tickets])

  // Gráfico conversión free → PRO por semana
  const conversionData = useMemo(() => {
    const MS_WEEK = 7 * 24 * 3600 * 1000
    const now     = Date.now()
    return Array.from({ length: 8 }, (_, i) => {
      const start   = now - (8 - i) * MS_WEEK
      const end     = now - (7 - i) * MS_WEEK
      const total   = users.filter(u => { const t = new Date(u.created_at).getTime(); return t >= start && t < end }).length
      const pro     = users.filter(u => u.plan === 'pro' && (() => { const t = new Date(u.created_at).getTime(); return t >= start && t < end })()).length
      const d       = new Date(end)
      return { label: d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }), total, pro }
    })
  }, [users])

  // Conteo de destinatarios para marketing
  const mktCount = useMemo(() => {
    if (mktForm.segmento === 'pro')  return users.filter(u => u.plan === 'pro').length
    if (mktForm.segmento === 'free') return users.filter(u => u.plan !== 'pro').length
    return users.length
  }, [mktForm.segmento, users])

  if (loading) return null

  return (
    <div className="min-h-screen bg-admin-bg text-text flex flex-col">

      {/* ── Mission Control Header ─────────────────────────────────────────── */}
      <header className="bg-admin-surface px-5 py-2.5 flex items-center justify-between sticky top-0 z-50 shadow-admin-header">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border border-admin-violet2 flex items-center justify-center bg-admin-violet/10">
            <span className="display-heading text-admin-violet2 text-xs leading-none">Σ</span>
          </div>
          <span className="display-heading text-base tracking-widest text-text">SIGMA</span>
          <span className="section-label text-[10px] text-admin-violet2 border border-admin-violet/30 px-1.5 py-0.5 ml-0.5">ADMIN</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setCmdkOpen(true); setSearchQuery('') }}
            className="flex items-center gap-2 px-3 py-1.5 bg-admin-surface2 border border-admin-border hover:border-admin-violet/40 transition-colors"
          >
            <Search size={12} className="text-muted" />
            <span className="terminal-text text-xs text-muted hidden sm:block">Buscar</span>
            <kbd className="hidden sm:block terminal-text text-[10px] text-muted border border-admin-border px-1 py-0.5">⌘K</kbd>
          </button>

          <button
            onClick={() => setTab('reportes')}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-admin-border hover:border-admin-violet/40 text-text-dim hover:text-admin-violet2 transition-colors"
          >
            <Plus size={13} />
            <span className="section-label text-[10px] hidden sm:block">REPORTE</span>
          </button>

          <button
            onClick={() => setTab('resumen')}
            className="relative flex items-center px-2.5 py-1.5 border border-admin-border hover:border-admin-violet/40 text-text-dim hover:text-admin-violet2 transition-colors"
          >
            <Bell size={14} />
            {totalAlerts > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] flex items-center justify-center rounded-full leading-none">
                {totalAlerts}
              </span>
            )}
          </button>

          <div className="w-px h-5 bg-admin-border mx-1" />

          <Link href="/" className="flex items-center gap-1.5 terminal-text text-xs text-text-dim hover:text-admin-violet2 transition-colors px-2 py-1.5">
            <ExternalLink size={12} />
            <span className="hidden sm:block">Sitio</span>
          </Link>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 section-label text-[10px] text-red-400/70 hover:text-red-400 transition-colors px-2 py-1.5 border border-transparent hover:border-red-400/30"
          >
            <LogOut size={13} />
            <span className="hidden sm:block">SALIR</span>
          </button>
        </div>
      </header>

      {/* ── Sticky KPI Bar ─────────────────────────────────────────────────── */}
      <div className="bg-admin-bg px-4 py-2 sticky top-[49px] z-40 hidden md:flex items-stretch gap-1.5">
        {[
          { label: 'MRR',          value: loadingBiz   ? '…' : `$${bizMetrics?.mrr ?? 0}`,         color: 'text-gold'           },
          { label: 'ESTA SEMANA',  value: loadingBiz   ? '…' : `+${bizMetrics?.thisWeek ?? 0} reg`, color: 'text-emerald-400'    },
          { label: 'ALERTAS',      value: loadingBiz   ? '…' : String(totalAlerts),                 color: totalAlerts > 0 ? 'text-red-400' : 'text-text-dim' },
          { label: 'TICKETS',      value: String(pendingTickets),                                    color: pendingTickets > 0 ? 'text-yellow-400' : 'text-text-dim' },
          { label: 'PRO',          value: loadingUsers ? '…' : String(proCount),                    color: 'text-admin-violet2'  },
          { label: 'CRONS',        value: loadingSys   ? '…' : staleCrons > 0 ? `${staleCrons} STALE` : unknownCrons === 4 ? '—' : 'OK', color: loadingSys ? 'text-muted' : staleCrons > 0 ? 'text-red-400' : unknownCrons === 4 ? 'text-muted' : 'text-emerald-400' },
        ].map(kpi => (
          <div key={kpi.label} className="flex items-center gap-2.5 px-4 py-2 bg-admin-surface shadow-admin-glow">
            <span className="section-label text-[9px] text-muted tracking-widest">{kpi.label}</span>
            <span className={`terminal-text text-sm num tabular-nums font-medium ${kpi.color}`}>{kpi.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-1">

        {/* ── Grouped Sidebar ─────────────────────────────────────────────── */}
        <aside className="hidden md:flex flex-col w-52 bg-admin-surface2 py-4 px-2 shrink-0 shadow-admin-sidebar">
          {SIDEBAR_GROUPS.map(group => (
            <div key={group.label} className="mb-3">
              <div className="section-label text-[9px] text-muted px-3 mb-1 tracking-widest">{group.label}</div>
              {group.items.map(item => {
                const Icon     = item.icon
                const isActive = tab === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    className={`w-full text-left flex items-center gap-2.5 px-3 py-2 transition-all border-l-2 ${
                      isActive
                        ? 'text-admin-violet2 bg-admin-bg border-admin-violet2 shadow-[inset_0_0_12px_rgba(124,58,237,0.12)]'
                        : 'text-text-dim hover:text-text hover:bg-admin-bg/50 border-transparent'
                    }`}
                  >
                    <Icon size={13} className={isActive ? 'text-admin-violet2' : 'text-muted'} />
                    <span className="section-label text-xs">{item.label}</span>
                    {item.id === 'soporte' && pendingTickets > 0 && (
                      <span className="ml-auto bg-yellow-400/20 text-yellow-400 text-[9px] px-1.5 py-0.5 rounded-full leading-none">
                        {pendingTickets}
                      </span>
                    )}
                    {item.id === 'resumen' && totalAlerts > 0 && (
                      <span className="ml-auto bg-red-400/20 text-red-400 text-[9px] px-1.5 py-0.5 rounded-full leading-none">
                        {totalAlerts}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}

          <div className="my-2 mx-3 h-px bg-admin-violet/10" />

          <Link
            href="/admin/lp-signal"
            className="flex items-center gap-2.5 px-3 py-2 text-text-dim hover:text-admin-violet2 hover:bg-admin-bg/60 border-l-2 border-transparent transition-colors"
          >
            <ExternalLink size={13} className="text-muted" />
            <span className="section-label text-xs">LP SIGNAL</span>
          </Link>
        </aside>

        {/* Mobile tabs */}
        <div className="md:hidden w-full border-b border-admin-border bg-admin-surface px-4 flex gap-1 overflow-x-auto">
          {SIDEBAR_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`section-label text-xs py-3 px-3 whitespace-nowrap border-b-2 transition-colors ${
                tab === t.id ? 'text-admin-violet2 border-admin-violet' : 'text-text-dim border-transparent'
              }`}
            >
              {t.label}
            </button>
          ))}
          <Link href="/admin/lp-signal" className="section-label text-xs py-3 px-3 whitespace-nowrap border-b-2 border-transparent text-text-dim">
            LP SIGNAL ↗
          </Link>
        </div>

        {/* Main content */}
        <main className="flex-1 p-3 sm:p-6 overflow-auto min-w-0">

          {/* ── RESUMEN ─────────────────────────────────────────────────────── */}
          {tab === 'resumen' && (
            <div className="flex flex-col gap-8">
              <div className="flex items-end justify-between">
                <div>
                  <div className="section-label text-[9px] text-muted mb-1 tracking-[0.2em]">{'// ADMIN · RESUMEN'}</div>
                  <h2 className="display-heading text-4xl text-text">OVERVIEW</h2>
                </div>
                <div className="hidden sm:flex flex-col items-end gap-0.5">
                  <div className="terminal-text text-xs text-muted num">
                    {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  <div className="section-label text-[9px] text-gold/40 tracking-widest">SIGMA RESEARCH</div>
                </div>
              </div>

              {/* ── SISTEMA ─────────────────────────────────────────────────── */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="section-label text-[9px] text-muted/50 tabular-nums">01</span>
                  <div className="section-label text-gold">SALUD DEL SISTEMA</div>
                  <div className="flex-1 h-px bg-gold/10" />
                  <button
                    onClick={fetchSystemHealth}
                    className="flex items-center gap-1.5 terminal-text text-xs text-text-dim hover:text-gold transition-colors"
                  >
                    <RefreshCw size={11} className={loadingSys ? 'animate-spin' : ''} />
                    {loadingSys ? 'actualizando…' : 'actualizar'}
                  </button>
                </div>

                {/* Cron status strip */}
                <div className="bg-admin-surface mb-2 grid grid-cols-2 sm:grid-cols-4 divide-x divide-admin-border">
                  {([
                    { key: 'syncFondos',    label: 'SYNC FONDOS'    },
                    { key: 'motorSignals',  label: 'MOTOR SIGNALS'  },
                    { key: 'motorAccuracy', label: 'MOTOR ACCURACY' },
                    { key: 'sistemaNotifs', label: 'NOTIFICACIONES' },
                  ] as const).map(c => {
                    const d      = systemHealth?.crons[c.key]
                    const status = d?.status ?? 'unknown'
                    return (
                      <div key={c.key} className={`p-4 border-b-2 ${
                        status === 'stale' ? 'border-b-red-400' : status === 'ok' ? 'border-b-emerald-400' : 'border-b-transparent'
                      }`}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            status === 'ok' ? 'bg-emerald-400' : status === 'stale' ? 'bg-red-400 animate-pulse' : 'bg-admin-border'
                          }`} />
                          <span className="section-label text-[9px] text-text-dim tracking-widest">{c.label}</span>
                        </div>
                        <div className={`terminal-text text-xs ${
                          status === 'ok' ? 'text-emerald-400' : status === 'stale' ? 'text-red-400' : 'text-muted'
                        }`}>
                          {loadingSys ? '…' : d?.lastRun ? relativeTime(d.lastRun) : 'Sin datos'}
                        </div>
                        <div className={`section-label text-[9px] mt-0.5 ${
                          status === 'ok' ? 'text-emerald-400/60' : status === 'stale' ? 'text-red-400/60' : 'text-muted'
                        }`}>
                          {status.toUpperCase()}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Pendientes + Audit */}
                <div className="grid md:grid-cols-2 gap-1.5">

                  {/* Cola pendiente */}
                  <div className="bg-admin-surface p-5 shadow-admin-glow">
                    <div className="section-label text-gold mb-3">COLA PENDIENTE</div>
                    {loadingSys ? (
                      <div className="terminal-text text-xs text-muted">Cargando…</div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between py-2 border-b border-admin-border">
                          <span className="terminal-text text-xs text-text-dim">LP Signals pendientes</span>
                          <span className={`display-heading text-2xl num ${
                            (systemHealth?.pending.lpSignals ?? 0) > 0 ? 'text-yellow-400' : 'text-muted'
                          }`}>{systemHealth?.pending.lpSignals ?? 0}</span>
                        </div>
                        {(systemHealth?.pending.lpSignals ?? 0) > 0 && (
                          <Link href="/admin/lp-signal" className="terminal-text text-xs text-yellow-400 hover:text-yellow-300 underline underline-offset-2">
                            Revisar señales →
                          </Link>
                        )}
                        <div className="flex items-center justify-between py-2">
                          <span className="terminal-text text-xs text-text-dim">Reportes sin PDF</span>
                          <span className={`display-heading text-2xl num ${
                            (systemHealth?.pending.reportesSinPdf ?? 0) > 0 ? 'text-orange-400' : 'text-muted'
                          }`}>{systemHealth?.pending.reportesSinPdf ?? 0}</span>
                        </div>
                        {(systemHealth?.pending.reportesSinPdf ?? 0) > 0 && (
                          <button
                            onClick={() => setTab('reportes')}
                            className="terminal-text text-xs text-orange-400 hover:text-orange-300 underline underline-offset-2 text-left"
                          >
                            {systemHealth?.pending.reportesItems.map(r => `#${r.numero} ${r.titulo}`).join(', ')} — ir a reportes →
                          </button>
                        )}
                        {(systemHealth?.pending.lpSignals ?? 0) === 0 && (systemHealth?.pending.reportesSinPdf ?? 0) === 0 && (
                          <div className="terminal-text text-xs text-emerald-400/70">Todo al día ✓</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Audit reciente */}
                  <div className="bg-admin-surface p-5 shadow-admin-glow">
                    <div className="section-label text-gold mb-3">ÚLTIMAS ACCIONES</div>
                    {loadingSys ? (
                      <div className="terminal-text text-xs text-muted">Cargando…</div>
                    ) : (systemHealth?.recentAudit ?? []).length === 0 ? (
                      <div className="terminal-text text-xs text-muted">Sin acciones registradas aún.</div>
                    ) : (
                      <div className="flex flex-col divide-y divide-admin-border">
                        {(systemHealth?.recentAudit ?? []).map(log => (
                          <div key={log.id} className="flex items-center gap-2 py-2">
                            <span className="terminal-text text-[10px] text-muted num shrink-0 whitespace-nowrap">
                              {new Date(log.ts).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                            <span className="terminal-text text-xs text-text truncate">{log.action}</span>
                            {log.meta && typeof log.meta === 'object' && 'titulo' in log.meta && (
                              <span className="terminal-text text-[10px] text-muted truncate max-w-[100px]">
                                {String(log.meta.titulo).slice(0, 30)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* ── ESTADO DEL NEGOCIO ──────────────────────────────────────── */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="section-label text-[9px] text-muted/50 tabular-nums">02</span>
                  <div className="section-label text-gold">ESTADO DEL NEGOCIO</div>
                  <div className="flex-1 h-px bg-gold/10" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-2 bg-admin-bg">

                  {/* MRR */}
                  <div className="bg-admin-surface p-6 shadow-admin-glow relative overflow-hidden bg-gradient-to-br from-gold/5 to-transparent">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gold to-transparent" />
                    <div className="section-label text-text-dim text-xs mb-2">MRR ACTUAL</div>
                    <div className="display-heading text-6xl text-gold num tabular-nums drop-shadow-[0_0_24px_rgba(212,175,55,0.25)]">
                      {loadingBiz ? '…' : `$${bizMetrics?.mrr ?? 0}`}
                    </div>
                    <div className="terminal-text text-xs text-muted mt-1">
                      {loadingBiz ? '' : `${bizMetrics?.proCount ?? 0} usuarios PRO × $29 USD`}
                    </div>
                    {bizMetrics && (
                      <div className="mt-3">
                        <div className="flex justify-between terminal-text text-xs text-muted mb-1">
                          <span>META $2,900</span>
                          <span>{Math.round((bizMetrics.mrr / 2900) * 100)}%</span>
                        </div>
                        <div className="h-1 bg-border overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-gold/60 to-gold transition-all" style={{ width: `${Math.min((bizMetrics.mrr / 2900) * 100, 100)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Crecimiento semanal */}
                  <div className="bg-admin-surface p-5 shadow-admin-glow relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400/60 to-transparent" />
                    <div className="section-label text-text-dim text-xs mb-2">CRECIMIENTO SEMANAL</div>
                    <div className="display-heading text-5xl text-emerald-400 num tabular-nums">
                      {loadingBiz ? '…' : `+${bizMetrics?.thisWeek ?? 0}`}
                    </div>
                    <div className="terminal-text text-xs text-muted mt-1">
                      {loadingBiz ? '' : (() => {
                        const g = bizMetrics?.weeklyGrowthPct
                        if (g === null || g === undefined) return 'primera semana con datos'
                        return g >= 0 ? `↑ ${g}% vs semana pasada` : `↓ ${Math.abs(g)}% vs semana pasada`
                      })()}
                    </div>
                    {bizMetrics && (
                      <div className="mt-3 terminal-text text-xs text-muted">
                        Semana anterior: <span className="text-text">{bizMetrics.lastWeek} registro{bizMetrics.lastWeek !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>

                  {/* Proyección */}
                  <div className="bg-admin-surface p-5 shadow-admin-glow relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-yellow-400/60 to-transparent" />
                    <div className="section-label text-text-dim text-xs mb-2">PROYECCIÓN A 100 USUARIOS</div>
                    <div className="display-heading text-5xl text-yellow-400 num tabular-nums">
                      {loadingBiz ? '…' : bizMetrics?.weeksToGoal === 0 ? '✓' : `~${bizMetrics?.weeksToGoal}sem`}
                    </div>
                    <div className="terminal-text text-xs text-muted mt-1">
                      {loadingBiz ? '' : bizMetrics?.weeksToGoal === 0
                        ? 'Meta alcanzada'
                        : `al ritmo actual de ${bizMetrics?.thisWeek ?? 0} reg/semana`}
                    </div>
                    {bizMetrics && (
                      <div className="mt-3">
                        <div className="flex justify-between terminal-text text-xs text-muted mb-1">
                          <span>{bizMetrics.totalUsers} / 100</span>
                          <span>{bizMetrics.totalUsers}%</span>
                        </div>
                        <div className="h-1 bg-border overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-yellow-400/60 to-yellow-400 transition-all" style={{ width: `${Math.min(bizMetrics.totalUsers, 100)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* ── ALERTAS ─────────────────────────────────────────────────── */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="section-label text-[9px] text-muted/50 tabular-nums">03</span>
                  <div className={`section-label ${totalAlerts > 0 && !loadingBiz ? 'text-red-400' : 'text-gold'}`}>ALERTAS</div>
                  <div className="flex-1 h-px bg-gold/10" />
                  {totalAlerts === 0 && !loadingBiz && (
                    <span className="section-label text-[9px] text-emerald-400/70">TODO OK ✓</span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-admin-bg">

                  {/* Churn risk */}
                  <div className={`bg-surface p-5 ${!loadingBiz && (bizMetrics?.alerts.churnRisk.length ?? 0) > 0 ? 'border-l-2 border-red-400' : ''}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${(bizMetrics?.alerts.churnRisk.length ?? 0) > 0 ? 'bg-red-400' : 'bg-border'}`} />
                      <div className="section-label text-xs text-text-dim">CHURN RISK</div>
                    </div>
                    <div className={`display-heading text-4xl num ${(bizMetrics?.alerts.churnRisk.length ?? 0) > 0 ? 'text-red-400' : 'text-muted'}`}>
                      {loadingBiz ? '…' : bizMetrics?.alerts.churnRisk.length ?? 0}
                    </div>
                    <div className="terminal-text text-xs text-muted mt-1">PRO sin actividad &gt;14 días</div>
                    {(bizMetrics?.alerts.churnRisk.length ?? 0) > 0 && (
                      <button onClick={() => setTab('usuarios')} className="mt-3 terminal-text text-xs text-red-400 hover:text-red-300 underline underline-offset-2">
                        Ver usuarios →
                      </button>
                    )}
                  </div>

                  {/* Oportunidad de conversión */}
                  <div className={`bg-surface p-5 ${!loadingBiz && (bizMetrics?.alerts.convOpportunity.length ?? 0) > 0 ? 'border-l-2 border-yellow-400' : ''}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${(bizMetrics?.alerts.convOpportunity.length ?? 0) > 0 ? 'bg-yellow-400' : 'bg-border'}`} />
                      <div className="section-label text-xs text-text-dim">OPORTUNIDAD</div>
                    </div>
                    <div className={`display-heading text-4xl num ${(bizMetrics?.alerts.convOpportunity.length ?? 0) > 0 ? 'text-yellow-400' : 'text-muted'}`}>
                      {loadingBiz ? '…' : bizMetrics?.alerts.convOpportunity.length ?? 0}
                    </div>
                    <div className="terminal-text text-xs text-muted mt-1">Free &gt;7 días sin convertir</div>
                    {(bizMetrics?.alerts.convOpportunity.length ?? 0) > 0 && (
                      <button onClick={() => setTab('marketing')} className="mt-3 terminal-text text-xs text-yellow-400 hover:text-yellow-300 underline underline-offset-2">
                        Enviar campaña →
                      </button>
                    )}
                  </div>

                  {/* Tickets urgentes */}
                  <div className={`bg-surface p-5 ${!loadingBiz && (bizMetrics?.alerts.urgentTickets.length ?? 0) > 0 ? 'border-l-2 border-orange-400' : ''}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${(bizMetrics?.alerts.urgentTickets.length ?? 0) > 0 ? 'bg-orange-400' : 'bg-border'}`} />
                      <div className="section-label text-xs text-text-dim">TICKETS URGENTES</div>
                    </div>
                    <div className={`display-heading text-4xl num ${(bizMetrics?.alerts.urgentTickets.length ?? 0) > 0 ? 'text-orange-400' : 'text-muted'}`}>
                      {loadingBiz ? '…' : bizMetrics?.alerts.urgentTickets.length ?? 0}
                    </div>
                    <div className="terminal-text text-xs text-muted mt-1">Tickets pendientes &gt;48h</div>
                    {(bizMetrics?.alerts.urgentTickets.length ?? 0) > 0 && (
                      <button onClick={() => setTab('soporte')} className="mt-3 terminal-text text-xs text-orange-400 hover:text-orange-300 underline underline-offset-2">
                        Ver soporte →
                      </button>
                    )}
                  </div>

                </div>
              </div>

              {/* ── EMBUDO ──────────────────────────────────────────────────── */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="section-label text-[9px] text-muted/50 tabular-nums">04</span>
                  <div className="section-label text-gold">EMBUDO DE CONVERSIÓN</div>
                  <div className="flex-1 h-px bg-gold/10" />
                </div>
                <div className="bg-admin-surface p-5 shadow-admin-glow">
                  {loadingBiz ? (
                    <div className="terminal-text text-xs text-muted">Calculando…</div>
                  ) : bizMetrics ? (
                    <div className="flex flex-col sm:flex-row items-stretch gap-2 bg-admin-bg">
                      {[
                        { label: 'REGISTRADOS',  value: bizMetrics.totalUsers,     color: 'text-text',        pct: 100 },
                        { label: 'CONFIRMADOS',  value: bizMetrics.confirmedCount,  color: 'text-emerald-400', pct: bizMetrics.totalUsers > 0 ? Math.round((bizMetrics.confirmedCount / bizMetrics.totalUsers) * 100) : 0 },
                        { label: 'CONVERTIDOS PRO', value: bizMetrics.proCount,     color: 'text-gold',        pct: bizMetrics.confirmedCount > 0 ? Math.round((bizMetrics.proCount / bizMetrics.confirmedCount) * 100) : 0 },
                      ].map((step, i) => (
                        <div key={step.label} className="flex-1 bg-surface p-5 flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span className="terminal-text text-xs text-muted">{String(i + 1).padStart(2, '0')}</span>
                            <span className="section-label text-xs text-text-dim">{step.label}</span>
                          </div>
                          <div className={`display-heading text-4xl num tabular-nums ${step.color}`}>{step.value}</div>
                          <div className="h-1 bg-border overflow-hidden">
                            <div className="h-full bg-current transition-all opacity-60" style={{ width: `${step.pct}%`, color: step.color.replace('text-', '') }} />
                          </div>
                          <div className="terminal-text text-xs text-muted">{step.pct}% del paso anterior</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {bizMetrics && (
                    <div className="mt-3 pt-3 border-t border-admin-border flex flex-wrap gap-6">
                      <div>
                        <span className="section-label text-xs text-text-dim">TASA FREE → PRO</span>
                        <span className="ml-3 terminal-text text-gold text-sm num">{bizMetrics.conversionRate}%</span>
                      </div>
                      <div>
                        <span className="section-label text-xs text-text-dim">MRR POTENCIAL (100 PRO)</span>
                        <span className="ml-3 terminal-text text-text text-sm num">${bizMetrics.mrrGoal} USD</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>


              <div className="grid md:grid-cols-2 gap-2 bg-admin-bg">

                {/* Estado de usuarios */}
                <div className="bg-admin-surface p-6 shadow-admin-glow">
                  <div className="section-label text-gold mb-4">ESTADO DE USUARIOS</div>
                  {loadingUsers ? (
                    <div className="terminal-text text-xs text-muted">Cargando…</div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {[
                        { label: 'PRO',  count: proCount,              total: users.length },
                        { label: 'FREE', count: users.length - proCount, total: users.length },
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
                <div className="bg-admin-surface p-6 shadow-admin-glow">
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
                      <div className="flex items-center justify-between py-1.5 border-b border-admin-border">
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

              {/* Crecimiento de usuarios — últimas 8 semanas */}
              <div className="bg-admin-surface p-6 shadow-admin-glow">
                <div className="flex items-center justify-between mb-5">
                  <div className="section-label text-gold">CRECIMIENTO DE USUARIOS</div>
                  <span className="terminal-text text-xs text-muted">últimas 8 semanas</span>
                </div>
                {loadingUsers ? (
                  <div className="terminal-text text-xs text-muted">Cargando…</div>
                ) : (
                  <div className="flex items-end gap-2 h-28">
                    {growthData.map((w, i) => {
                      const pct = Math.round((w.count / growthMax) * 100)
                      return (
                        <div key={i} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                          <span className="terminal-text text-[9px] text-gold num tabular-nums leading-none">
                            {w.count > 0 ? w.count : ''}
                          </span>
                          <div className="w-full relative bg-border" style={{ height: '72px' }}>
                            <div
                              className="absolute bottom-0 w-full transition-all duration-700"
                              style={{
                                height: `${pct}%`,
                                background: pct > 0 ? 'linear-gradient(to top, #d4af37, #d4af3760)' : 'transparent',
                              }}
                            />
                          </div>
                          <span className="terminal-text text-[8px] text-muted text-center leading-tight">{w.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Conversión free → PRO */}
              <div className="bg-admin-surface p-6 shadow-admin-glow">
                <div className="flex items-center justify-between mb-5">
                  <div className="section-label text-gold">CONVERSIÓN FREE → PRO</div>
                  <span className="terminal-text text-xs text-muted">últimas 8 semanas</span>
                </div>
                {loadingUsers ? (
                  <div className="terminal-text text-xs text-muted">Cargando…</div>
                ) : (
                  <div className="flex items-end gap-2 h-28">
                    {conversionData.map((w, i) => {
                      const totalPct = Math.round((w.total / Math.max(...conversionData.map(d => d.total), 1)) * 100)
                      const proPct   = w.total > 0 ? Math.round((w.pro / w.total) * 100) : 0
                      return (
                        <div key={i} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                          <span className="terminal-text text-[9px] text-emerald-400 num tabular-nums leading-none">
                            {w.pro > 0 ? `${w.pro}P` : ''}
                          </span>
                          <div className="w-full relative bg-border" style={{ height: '72px' }}>
                            {totalPct > 0 && (
                              <div className="absolute bottom-0 w-full transition-all duration-700"
                                style={{ height: `${totalPct}%`, background: 'rgba(212,175,55,0.25)' }} />
                            )}
                            {proPct > 0 && totalPct > 0 && (
                              <div className="absolute bottom-0 w-full transition-all duration-700"
                                style={{ height: `${Math.round(totalPct * proPct / 100)}%`, background: '#22c55e' }} />
                            )}
                          </div>
                          <span className="terminal-text text-[8px] text-muted text-center leading-tight">{w.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-400 rounded-sm" /><span className="terminal-text text-[10px] text-muted">PRO</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-gold/25 rounded-sm" /><span className="terminal-text text-[10px] text-muted">Registros totales</span></div>
                </div>
              </div>

              {/* Estado modelos */}
              <div className="bg-admin-surface p-6 shadow-admin-glow">
                <div className="section-label text-gold mb-4">ESTADO DE MODELOS</div>
                {modelosError ? (
                  <div className="terminal-text text-xs text-yellow-400/80 bg-yellow-400/5 border border-yellow-400/20 px-4 py-3">
                    {modelosError}
                  </div>
                ) : modelos.length === 0 ? (
                  <div className="terminal-text text-xs text-muted">Cargando estado del motor…</div>
                ) : (
                  <div className="grid md:grid-cols-3 gap-2 bg-admin-bg">
                    {modelos.map(m => (
                      <div key={m.tag} className="bg-admin-bg p-4 flex items-center justify-between">
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
                )}
              </div>

              {/* Feed de actividad reciente */}
              <div className="bg-admin-surface p-6 shadow-admin-glow">
                <div className="flex items-center justify-between mb-4">
                  <div className="section-label text-gold">ACTIVIDAD RECIENTE</div>
                  <span className="terminal-text text-xs text-muted">últimas acciones</span>
                </div>
                {loadingUsers && loadingTickets ? (
                  <div className="terminal-text text-xs text-muted">Cargando…</div>
                ) : activityFeed.length === 0 ? (
                  <div className="terminal-text text-xs text-muted">Sin actividad aún.</div>
                ) : (
                  <div className="flex flex-col divide-y divide-admin-border">
                    {activityFeed.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 py-2.5">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          item.type === 'pro'    ? 'bg-gold' :
                          item.type === 'signup' ? 'bg-emerald-400' : 'bg-yellow-400'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <span className="terminal-text text-xs text-text truncate block">{item.title}</span>
                          <span className="terminal-text text-[10px] text-muted truncate block">{item.sub}</span>
                        </div>
                        <span className={`section-label text-[10px] border px-2 py-0.5 shrink-0 ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                        <span className="terminal-text text-[10px] text-muted num shrink-0">
                          {new Date(item.date).toLocaleDateString('es-CL')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── USUARIOS ────────────────────────────────────────────────────── */}
          {tab === 'usuarios' && (
            <div className="flex flex-col gap-6">
              <div className="flex items-end justify-between">
                <div>
                  <div className="section-label text-gold mb-1">{'// GESTIÓN'}</div>
                  <h2 className="display-heading text-4xl text-text">USUARIOS</h2>
                </div>
                <button onClick={fetchUsers} className="section-label text-xs text-gold border border-gold/30 px-3 py-1.5 hover:bg-gold/5 transition-colors">
                  ACTUALIZAR
                </button>
              </div>

              {loadingUsers ? (
                <div className="terminal-text text-xs text-muted">Cargando…</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-admin-surface border-b border-admin-border">
                        {['Nombre', 'Email', 'Plan', 'Registro', 'Último acceso', 'Estado', ''].map(h => (
                          <th key={h} className="section-label text-text-dim text-xs text-left px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <Fragment key={u.id}>
                          <tr
                            className={`border-b border-admin-border transition-colors cursor-pointer ${expandedUser === u.id ? 'bg-gold/5' : 'hover:bg-surface/60'}`}
                            onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                          >
                            <td className="terminal-text text-sm text-text px-4 py-3">{u.nombre || '—'}</td>
                            <td className="terminal-text text-xs text-text-dim px-4 py-3">{u.email}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={ev => { ev.stopPropagation(); togglePlan(u) }}
                                className={`section-label text-xs border px-2.5 py-1 transition-colors ${
                                  u.plan === 'pro'
                                    ? 'text-gold border-gold/40 hover:bg-gold/10'
                                    : 'text-text-dim border-admin-border hover:border-gold/40 hover:text-gold'
                                }`}
                              >
                                {u.plan === 'pro' ? 'PRO' : 'FREE'}
                              </button>
                            </td>
                            <td className="terminal-text text-xs text-text-dim px-4 py-3 num">{u.created_at.slice(0, 10)}</td>
                            <td className="terminal-text text-xs text-text-dim px-4 py-3 num">{u.last_sign_in ? u.last_sign_in.slice(0, 10) : '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`section-label text-xs ${u.confirmed ? 'text-emerald-400' : 'text-yellow-400'}`}>
                                {u.confirmed ? 'CONFIRMADO' : 'PENDIENTE'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="terminal-text text-xs text-muted">{expandedUser === u.id ? '▲' : '▼'}</span>
                            </td>
                          </tr>

                          {expandedUser === u.id && (
                            <tr key={`${u.id}-expand`} className="border-b border-admin-border bg-gold/5">
                              <td colSpan={7} className="px-6 py-5">
                                <div className="flex flex-col gap-3 max-w-xl">
                                  <div className="section-label text-gold text-xs">ENVIAR EMAIL DIRECTO</div>
                                  <textarea
                                    rows={3}
                                    placeholder="Escribe el mensaje para este usuario…"
                                    value={emailDirecto[u.id] ?? ''}
                                    onChange={e => setEmailDirecto(prev => ({ ...prev, [u.id]: e.target.value }))}
                                    onClick={e => e.stopPropagation()}
                                    className="w-full bg-bg border border-admin-border focus:border-admin-violet/50 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] outline-none px-4 py-3 terminal-text text-text text-sm placeholder:text-muted transition-colors resize-none"
                                  />
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={e => { e.stopPropagation(); sendEmailDirecto(u) }}
                                      disabled={!emailDirecto[u.id]?.trim() || sendingEmail === u.id}
                                      className="section-label text-xs bg-gold text-bg px-5 py-2 hover:bg-gold-glow transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      {sendingEmail === u.id ? 'ENVIANDO…' : 'ENVIAR EMAIL'}
                                    </button>
                                    <button
                                      onClick={e => { e.stopPropagation(); togglePlan(u) }}
                                      className="section-label text-xs border border-admin-border px-5 py-2 text-text-dim hover:border-gold hover:text-gold transition-colors"
                                    >
                                      {u.plan === 'pro' ? 'BAJAR A FREE' : 'SUBIR A PRO'}
                                    </button>
                                  </div>
                                  {emailMsg?.id === u.id && (
                                    <span className={`terminal-text text-xs ${emailMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                                      {emailMsg.text}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                      {users.length === 0 && (
                        <tr>
                          <td colSpan={7} className="terminal-text text-xs text-muted px-4 py-6 text-center">Sin usuarios.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── SOLICITUDES ─────────────────────────────────────────────────── */}
          {tab === 'solicitudes' && (
            <div className="flex flex-col gap-6">
              <div className="flex items-end justify-between">
                <div>
                  <div className="section-label text-gold mb-1">{'// CONTACTO'}</div>
                  <h2 className="display-heading text-4xl text-text">SOLICITUDES</h2>
                </div>
                <button onClick={fetchTickets} className="section-label text-xs text-gold border border-gold/30 px-3 py-1.5 hover:bg-gold/5 transition-colors">
                  ACTUALIZAR
                </button>
              </div>

              {/* Resumen por estado */}
              {!loadingTickets && tickets.length > 0 && (
                <div className="grid grid-cols-3 gap-2 bg-admin-bg">
                  {(['pendiente', 'visto', 'resuelto'] as const).map(s => {
                    const count  = tickets.filter(t => t.status === s).length
                    const colors = { pendiente: 'text-yellow-400', visto: 'text-gold', resuelto: 'text-emerald-400' }
                    return (
                      <div key={s} className="bg-admin-surface p-4 shadow-admin-glow text-center">
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
                <div className="bg-admin-surface p-8 text-center terminal-text text-xs text-muted">
                  No hay solicitudes todavía.
                </div>
              ) : (
                <div className="flex flex-col gap-2 bg-admin-bg">
                  {tickets.map(t => {
                    const statusColors: Record<string, string> = {
                      pendiente: 'text-yellow-400 border-yellow-400/30',
                      visto:     'text-gold border-gold/30',
                      resuelto:  'text-emerald-400 border-emerald-400/30',
                    }
                    return (
                      <div key={t.id} className="bg-admin-surface p-5 shadow-admin-glow flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="terminal-text text-sm text-text">{t.nombre}</span>
                            {t.empresa && <span className="terminal-text text-xs text-text-dim">· {t.empresa}</span>}
                          </div>
                          <span className="terminal-text text-xs text-text-dim">{t.email}</span>
                          {t.motivo && <span className="terminal-text text-xs text-gold mt-1">{t.motivo}</span>}
                          <span className="terminal-text text-xs text-muted mt-0.5 line-clamp-1">{t.mensaje}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="terminal-text text-xs text-muted num">
                            {new Date(t.created_at).toLocaleDateString('es-CL')}
                          </span>
                          <span className={`section-label text-[10px] border px-2 py-0.5 ${statusColors[t.status]}`}>
                            {t.status.toUpperCase()}
                          </span>
                          <button
                            onClick={() => { setTab('soporte'); setExpandedTicket(t.id) }}
                            className="section-label text-xs text-gold border border-gold/30 px-3 py-1 hover:bg-gold/5 transition-colors"
                          >
                            GESTIONAR →
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── MODELOS ─────────────────────────────────────────────────────── */}
          {tab === 'modelos' && (
            <div className="flex flex-col gap-6">
              <div>
                <div className="section-label text-gold mb-1">{'// INFRAESTRUCTURA'}</div>
                <h2 className="display-heading text-4xl text-text">MODELOS ML</h2>
              </div>

              {modelosError ? (
                <div className="terminal-text text-sm text-yellow-400/80 bg-yellow-400/5 border border-yellow-400/20 px-5 py-4">
                  {modelosError}
                </div>
              ) : modelos.length === 0 ? (
                <div className="terminal-text text-xs text-muted px-1 py-2">Cargando estado del motor…</div>
              ) : null}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2 bg-admin-bg">
                {modelos.map(m => (
                  <div key={m.tag} className="bg-admin-surface p-5 shadow-admin-glow flex flex-col gap-3">
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

              {/* ── PINE SCRIPTS ───────────────────────────────────────────── */}
              <div>
                <div className="section-label text-gold mb-1">{'// PINE SCRIPTS'}</div>
                <h2 className="display-heading text-3xl text-text mb-4">DESCARGAR MOTORES</h2>

                <div className="grid md:grid-cols-2 gap-2 bg-admin-bg mb-4">
                  {/* Motor 1 */}
                  <div className="bg-admin-surface p-6 shadow-admin-glow flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="terminal-text text-xs text-gold border border-gold/20 px-2 py-0.5">MOTOR 1</span>
                      <span className="section-label text-xs text-emerald-400">PRODUCCIÓN</span>
                    </div>
                    <div>
                      <div className="display-heading text-xl text-text">SIGMA K1</div>
                      <div className="terminal-text text-xs text-text-dim mt-1">Multi-TF · 1m / 5m / 15m / 1h / 4h — estrategias por timeframe</div>
                    </div>
                    <button
                      disabled={pineDownloading === 'motor1'}
                      onClick={async () => {
                        setPineDownloading('motor1')
                        try {
                          const res = await fetch('/api/admin/pine?motor=1&action=download', { headers: ADMIN_HEADERS })
                          if (!res.ok) throw new Error(await res.text())
                          const blob = await res.blob()
                          const url  = URL.createObjectURL(blob)
                          const a    = document.createElement('a')
                          a.href = url; a.download = 'SIGMA_K1_MOTOR1.pine'; a.click()
                          URL.revokeObjectURL(url)
                        } catch { alert('Error descargando Motor 1') }
                        finally { setPineDownloading(null) }
                      }}
                      className="self-start flex items-center gap-2 section-label text-xs px-4 py-2.5 bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 transition-colors disabled:opacity-50"
                    >
                      {pineDownloading === 'motor1' ? '⟳ DESCARGANDO...' : '↓ DESCARGAR MOTOR 1'}
                    </button>
                  </div>

                  {/* Motor 2 */}
                  <div className="bg-admin-surface p-6 shadow-admin-glow flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="terminal-text text-xs text-gold border border-gold/20 px-2 py-0.5">MOTOR 2</span>
                      <span className="section-label text-xs text-emerald-400">PRODUCCIÓN</span>
                    </div>
                    <div>
                      <div className="display-heading text-xl text-text">SIGMA v13 COMPLETO</div>
                      <div className="terminal-text text-xs text-text-dim mt-1">Multi-activo · 20 modelos · BTC / ETH / SOL / XAU / ETFs</div>
                    </div>
                    <button
                      disabled={pineDownloading === 'motor2'}
                      onClick={async () => {
                        setPineDownloading('motor2')
                        try {
                          const res = await fetch('/api/admin/pine?motor=2&action=download', { headers: ADMIN_HEADERS })
                          if (!res.ok) throw new Error(await res.text())
                          const blob = await res.blob()
                          const url  = URL.createObjectURL(blob)
                          const a    = document.createElement('a')
                          a.href = url; a.download = 'SIGMA_v13_COMPLETO.pine'; a.click()
                          URL.revokeObjectURL(url)
                        } catch { alert('Error descargando Motor 2') }
                        finally { setPineDownloading(null) }
                      }}
                      className="self-start flex items-center gap-2 section-label text-xs px-4 py-2.5 bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 transition-colors disabled:opacity-50"
                    >
                      {pineDownloading === 'motor2' ? '⟳ DESCARGANDO...' : '↓ DESCARGAR MOTOR 2'}
                    </button>
                  </div>
                </div>

                {/* Validation panel */}
                <div className="bg-admin-surface p-5 shadow-admin-glow flex items-center gap-6">
                  <div className="flex-1">
                    <div className="section-label text-xs text-text-dim mb-1">VALIDACIÓN ESTÁTICA</div>
                    {pineValidResult ? (
                      <div className={`terminal-text text-sm num ${pineValidResult.total_errors === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pineValidResult.total_errors === 0
                          ? `✓ Sin errores críticos — validado ${pineValidResult.validated_at}`
                          : `✗ ${pineValidResult.total_errors} errores detectados — ver consola`}
                        {' '}{pineValidResult.motors.map(m =>
                          <span key={m.motor} className="text-text-dim text-xs ml-2">M{m.motor}: {m.total_errors}E/{m.total_warns}W</span>
                        )}
                      </div>
                    ) : (
                      <div className="terminal-text text-xs text-muted">Ejecuta validación para detectar errores CE/CW antes de publicar</div>
                    )}
                  </div>
                  <button
                    disabled={pineValidating}
                    onClick={async () => {
                      setPineValidating(true)
                      try {
                        const res = await fetch('/api/admin/pine', { method: 'POST', headers: ADMIN_HEADERS })
                        if (res.ok) setPineValidResult(await res.json())
                      } catch { /* silently fail */ }
                      finally { setPineValidating(false) }
                    }}
                    className="section-label text-xs px-4 py-2.5 border border-admin-border hover:border-gold/40 text-text-dim hover:text-gold transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {pineValidating ? '⟳ VALIDANDO...' : 'VALIDAR AHORA'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── REPORTES ────────────────────────────────────────────────────── */}
          {tab === 'reportes' && (
            <div className="flex flex-col gap-8">
              <div>
                <div className="section-label text-gold mb-1">{'// PUBLICACIÓN'}</div>
                <h2 className="display-heading text-4xl text-text">REPORTES</h2>
              </div>

              <div ref={formRef} className={`border p-6 ${editingId ? 'bg-gold/5 border-gold/40' : 'bg-surface border-admin-border'}`}>
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
                        className="bg-admin-bg border border-admin-border focus:border-admin-violet/50 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] outline-none px-4 py-2.5 terminal-text text-text text-sm placeholder:text-muted transition-colors"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label className="section-label text-text-dim text-xs">Título</label>
                      <input type="text" required value={form.titulo}
                        onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                        placeholder="Reporte Mensual #001"
                        className="bg-admin-bg border border-admin-border focus:border-admin-violet/50 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] outline-none px-4 py-2.5 terminal-text text-text text-sm placeholder:text-muted transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="section-label text-text-dim text-xs">Fecha de publicación</label>
                      <input type="date" required value={form.fecha}
                        onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}
                        className="bg-admin-bg border border-admin-border focus:border-admin-violet/50 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] outline-none px-4 py-2.5 terminal-text text-text text-sm transition-colors"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="section-label text-text-dim text-xs">PDF — subir archivo</label>
                      <input ref={fileRef} type="file" accept=".pdf"
                        onChange={e => setPdfFile(e.target.files?.[0] ?? null)}
                        className="bg-admin-bg border border-admin-border focus:border-admin-violet/50 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] outline-none px-4 py-2.5 terminal-text text-text text-sm transition-colors file:mr-3 file:bg-gold file:border-0 file:text-bg file:section-label file:text-xs file:px-3 file:py-1 file:cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="section-label text-text-dim text-xs">URL directa (opcional si subiste archivo)</label>
                    <input type="url" value={form.url_pdf}
                      onChange={e => setForm(p => ({ ...p, url_pdf: e.target.value }))}
                      placeholder="https://..."
                      className="bg-admin-bg border border-admin-border focus:border-admin-violet/50 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] outline-none px-4 py-2.5 terminal-text text-text text-sm placeholder:text-muted transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="section-label text-text-dim text-xs">Descripción</label>
                    <textarea rows={3} value={form.descripcion}
                      onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                      placeholder="Resumen breve del contenido del reporte…"
                      className="bg-admin-bg border border-admin-border focus:border-admin-violet/50 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] outline-none px-4 py-2.5 terminal-text text-text text-sm placeholder:text-muted transition-colors resize-none"
                    />
                  </div>

                  {formError && <p className="terminal-text text-red-400 text-xs">{formError}</p>}

                  <button type="submit" disabled={uploading}
                    className="bg-gold text-bg section-label text-sm px-8 py-3 hover:bg-gold-glow transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-start"
                  >
                    {uploading ? 'GUARDANDO…' : editingId ? 'GUARDAR CAMBIOS' : 'PUBLICAR REPORTE'}
                  </button>
                </form>
              </div>

              <div className="flex flex-col gap-2 bg-admin-bg">
                <div className="bg-admin-surface px-5 py-3">
                  <span className="section-label text-text-dim text-xs">REPORTES PUBLICADOS</span>
                </div>
                {loadingR ? (
                  <div className="bg-admin-bg p-8 text-center terminal-text text-xs text-muted">Cargando…</div>
                ) : reportes.length === 0 ? (
                  <div className="bg-admin-bg p-8 text-center terminal-text text-xs text-muted">No hay reportes todavía.</div>
                ) : reportes.map(r => (
                  <div key={r.id} className="bg-admin-bg px-5 py-4 flex items-center gap-4 flex-wrap">
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
                          : 'text-muted border-admin-border hover:border-gold hover:text-gold'
                      }`}>{r.activo ? 'ACTIVO' : 'OCULTO'}
                    </button>
                    <button onClick={() => startEdit(r)}
                      className={`section-label text-xs border px-3 py-1 transition-colors ${
                        editingId === r.id
                          ? 'text-gold border-gold bg-gold/10'
                          : 'text-text-dim border-admin-border hover:border-gold hover:text-gold'
                      }`}>{editingId === r.id ? 'EDITANDO' : 'EDITAR'}
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

          {/* ── SOPORTE ─────────────────────────────────────────────────────── */}
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

              {!loadingTickets && tickets.length > 0 && (
                <div className="grid grid-cols-3 gap-2 bg-admin-bg">
                  {(['pendiente', 'visto', 'resuelto'] as const).map(s => {
                    const count  = tickets.filter(t => t.status === s).length
                    const colors = { pendiente: 'text-yellow-400', visto: 'text-gold', resuelto: 'text-emerald-400' }
                    return (
                      <div key={s} className="bg-admin-surface p-4 shadow-admin-glow text-center">
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
                <div className="bg-admin-surface p-8 text-center terminal-text text-xs text-muted">
                  No hay tickets todavía.
                </div>
              ) : (
                <div className="flex flex-col gap-2 bg-admin-bg">
                  {tickets.map(t => {
                    const isExpanded = expandedTicket === t.id
                    const statusColors = {
                      pendiente: 'text-yellow-400 border-yellow-400/30',
                      visto:     'text-gold border-gold/30',
                      resuelto:  'text-emerald-400 border-emerald-400/30',
                    }
                    return (
                      <div key={t.id} className={`bg-surface ${isExpanded ? 'border-l-2 border-gold' : ''}`}>
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

                        {isExpanded && (
                          <div className="px-5 pb-6 flex flex-col gap-4 border-t border-admin-border">
                            <div className="mt-4">
                              <div className="section-label text-text-dim text-xs mb-2">MENSAJE</div>
                              <div className="bg-admin-bg border border-admin-border p-4 terminal-text text-sm text-text-dim leading-relaxed whitespace-pre-wrap">
                                {t.mensaje}
                              </div>
                            </div>

                            {t.respuesta && (
                              <div>
                                <div className="section-label text-emerald-400 text-xs mb-2">RESPUESTA ENVIADA</div>
                                <div className="bg-emerald-900/10 border border-emerald-400/20 p-4 terminal-text text-sm text-text-dim leading-relaxed whitespace-pre-wrap">
                                  {t.respuesta}
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="section-label text-text-dim text-xs">ESTADO:</span>
                              {(['pendiente', 'visto', 'resuelto'] as const).map(s => (
                                <button
                                  key={s}
                                  onClick={() => updateTicket(t.id, s)}
                                  disabled={t.status === s || sendingTicket === t.id}
                                  className={`section-label text-xs border px-3 py-1 transition-colors disabled:opacity-40 ${
                                    t.status === s ? statusColors[s] : 'text-text-dim border-admin-border hover:border-gold hover:text-gold'
                                  }`}
                                >
                                  {s.toUpperCase()}
                                </button>
                              ))}
                            </div>

                            <div>
                              <div className="section-label text-gold text-xs mb-2">
                                {t.respuesta ? 'NUEVA RESPUESTA' : 'RESPONDER'}
                              </div>
                              <textarea
                                rows={4}
                                value={respuestas[t.id] ?? ''}
                                onChange={e => setRespuestas(prev => ({ ...prev, [t.id]: e.target.value }))}
                                placeholder="Escribe tu respuesta aquí…"
                                className="w-full bg-bg border border-admin-border focus:border-admin-violet/50 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] outline-none px-4 py-3 terminal-text text-text text-sm placeholder:text-muted transition-colors resize-none"
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
                                  className="section-label text-xs text-text-dim border border-admin-border px-4 py-2.5 hover:border-gold hover:text-gold transition-colors disabled:opacity-40"
                                >
                                  MARCAR RESUELTO SIN EMAIL
                                </button>
                              </div>
                            </div>

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
          {/* ── MARKETING ───────────────────────────────────────────────────── */}
          {tab === 'marketing' && (
            <div className="flex flex-col gap-8">
              <div>
                <div className="section-label text-gold mb-1">{'// COMUNICACIONES'}</div>
                <h2 className="display-heading text-4xl text-text">MARKETING</h2>
              </div>

              {/* Stats de audiencia */}
              <div className="grid grid-cols-3 gap-2 bg-admin-bg">
                {[
                  { label: 'Todos los usuarios', count: users.length,                           seg: 'todos' as const },
                  { label: 'Usuarios PRO',        count: users.filter(u => u.plan === 'pro').length, seg: 'pro'   as const },
                  { label: 'Usuarios Free',       count: users.filter(u => u.plan !== 'pro').length, seg: 'free'  as const },
                ].map(({ label, count, seg }) => (
                  <button
                    key={seg}
                    onClick={() => setMktForm(f => ({ ...f, segmento: seg }))}
                    className={`p-5 text-left transition-colors ${mktForm.segmento === seg ? 'bg-gold/10 border border-gold/40' : 'bg-surface hover:bg-gold/5'}`}
                  >
                    <div className="section-label text-text-dim text-xs mb-1">{label}</div>
                    <div className={`display-heading text-4xl num ${mktForm.segmento === seg ? 'text-gold' : 'text-text'}`}>{loadingUsers ? '…' : count}</div>
                  </button>
                ))}
              </div>

              {/* Formulario */}
              <form onSubmit={sendMarketing} className="bg-admin-surface p-6 shadow-admin-glow flex flex-col gap-5">
                <div className="section-label text-gold">NUEVO ENVÍO</div>

                {/* Segmento */}
                <div className="flex flex-col gap-1.5">
                  <label className="section-label text-text-dim text-xs">Segmento de destinatarios</label>
                  <div className="flex gap-2">
                    {(['todos', 'pro', 'free'] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setMktForm(f => ({ ...f, segmento: s }))}
                        className={`section-label text-xs border px-4 py-2 transition-colors ${
                          mktForm.segmento === s ? 'bg-gold text-bg border-gold' : 'text-text-dim border-admin-border hover:border-gold hover:text-gold'
                        }`}
                      >
                        {s.toUpperCase()} {!loadingUsers && `(${s === 'todos' ? users.length : s === 'pro' ? users.filter(u => u.plan === 'pro').length : users.filter(u => u.plan !== 'pro').length})`}
                      </button>
                    ))}
                  </div>
                  <span className="terminal-text text-xs text-text-dim mt-0.5">
                    Se enviará a <span className="text-gold font-bold">{mktCount}</span> destinatarios confirmados.
                  </span>
                </div>

                {/* Asunto */}
                <div className="flex flex-col gap-1.5">
                  <label className="section-label text-text-dim text-xs">Asunto del email *</label>
                  <input
                    required
                    type="text"
                    value={mktForm.subject}
                    onChange={e => setMktForm(f => ({ ...f, subject: e.target.value }))}
                    placeholder="Sigma Research · Nuevo análisis disponible"
                    className="bg-admin-bg border border-admin-border focus:border-admin-violet/50 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] outline-none px-4 py-2.5 terminal-text text-text text-sm placeholder:text-muted transition-colors"
                  />
                </div>

                {/* Título + Subtítulo */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="section-label text-text-dim text-xs">Título del email *</label>
                    <input
                      required
                      type="text"
                      value={mktForm.title}
                      onChange={e => setMktForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="NUEVO ANÁLISIS"
                      className="bg-admin-bg border border-admin-border focus:border-admin-violet/50 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] outline-none px-4 py-2.5 terminal-text text-text text-sm placeholder:text-muted transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="section-label text-text-dim text-xs">Subtítulo</label>
                    <input
                      type="text"
                      value={mktForm.subtitle}
                      onChange={e => setMktForm(f => ({ ...f, subtitle: e.target.value }))}
                      placeholder="Mercado local — Abril 2025"
                      className="bg-admin-bg border border-admin-border focus:border-admin-violet/50 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] outline-none px-4 py-2.5 terminal-text text-text text-sm placeholder:text-muted transition-colors"
                    />
                  </div>
                </div>

                {/* Cuerpo */}
                <div className="flex flex-col gap-1.5">
                  <label className="section-label text-text-dim text-xs">Cuerpo del mensaje *</label>
                  <textarea
                    required
                    rows={5}
                    value={mktForm.body}
                    onChange={e => setMktForm(f => ({ ...f, body: e.target.value }))}
                    placeholder="Hemos publicado un nuevo análisis con señales para las próximas semanas…"
                    className="bg-admin-bg border border-admin-border focus:border-admin-violet/50 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] outline-none px-4 py-2.5 terminal-text text-text text-sm placeholder:text-muted transition-colors resize-none"
                  />
                </div>

                {/* CTA */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="section-label text-text-dim text-xs">Texto del botón CTA *</label>
                    <input
                      required
                      type="text"
                      value={mktForm.ctaText}
                      onChange={e => setMktForm(f => ({ ...f, ctaText: e.target.value }))}
                      placeholder="VER ANÁLISIS →"
                      className="bg-admin-bg border border-admin-border focus:border-admin-violet/50 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] outline-none px-4 py-2.5 terminal-text text-text text-sm placeholder:text-muted transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="section-label text-text-dim text-xs">URL destino del CTA *</label>
                    <input
                      required
                      type="url"
                      value={mktForm.ctaUrl}
                      onChange={e => setMktForm(f => ({ ...f, ctaUrl: e.target.value }))}
                      placeholder="https://sigma-research.vercel.app/home"
                      className="bg-admin-bg border border-admin-border focus:border-admin-violet/50 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] outline-none px-4 py-2.5 terminal-text text-text text-sm placeholder:text-muted transition-colors"
                    />
                  </div>
                </div>

                {mktResult && (
                  <div className={`terminal-text text-sm border px-4 py-3 ${mktResult.ok ? 'text-emerald-400 border-emerald-400/30 bg-emerald-900/10' : 'text-red-400 border-red-400/30 bg-red-900/10'}`}>
                    {mktResult.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sendingMkt || mktCount === 0}
                  className="bg-gold text-bg section-label py-3 px-8 hover:bg-gold-glow transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-start"
                >
                  {sendingMkt ? 'ENVIANDO…' : `ENVIAR A ${mktCount} DESTINATARIOS`}
                </button>
              </form>

              {/* Historial de campañas */}
              <div className="bg-admin-surface">
                <div className="flex items-center justify-between px-5 py-3 border-b border-admin-border">
                  <span className="section-label text-gold text-xs">HISTORIAL DE CAMPAÑAS</span>
                  <button onClick={fetchCampañas} className="terminal-text text-xs text-text-dim hover:text-gold transition-colors">↻</button>
                </div>
                {loadingCamp ? (
                  <div className="px-5 py-6 terminal-text text-xs text-muted">Cargando…</div>
                ) : campañas.length === 0 ? (
                  <div className="px-5 py-6 terminal-text text-xs text-muted">Aún no hay campañas enviadas.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-admin-border">
                          {['Fecha', 'Asunto', 'Segmento', 'Enviados'].map(h => (
                            <th key={h} className="section-label text-text-dim text-xs text-left px-4 py-2.5">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {campañas.map(c => (
                          <tr key={c.id} className="border-b border-admin-border hover:bg-gold/5 transition-colors">
                            <td className="terminal-text text-xs text-muted px-4 py-3 num whitespace-nowrap">
                              {new Date(c.sent_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="terminal-text text-xs text-text px-4 py-3 max-w-[280px] truncate">{c.subject}</td>
                            <td className="px-4 py-3">
                              <span className={`section-label text-[10px] border px-2 py-0.5 ${
                                c.segmento === 'pro'  ? 'text-gold border-gold/30' :
                                c.segmento === 'free' ? 'text-text-dim border-admin-border' :
                                'text-emerald-400 border-emerald-400/30'
                              }`}>
                                {c.segmento.toUpperCase()}
                              </span>
                            </td>
                            <td className="terminal-text text-xs text-emerald-400 px-4 py-3 num">{c.sent_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── Ctrl+K Modal ─────────────────────────────────────────────────────── */}
      {cmdkOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
          onClick={() => setCmdkOpen(false)}
        >
          <div
            className="w-full max-w-lg mx-4 bg-admin-surface shadow-admin-glow-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-admin-border px-4 py-3">
              <Search size={15} className="text-muted shrink-0" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Buscar usuario por email o nombre…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none terminal-text text-sm text-text placeholder:text-muted"
              />
              <kbd className="terminal-text text-[10px] text-muted border border-admin-border px-1.5 py-0.5">ESC</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {searchQuery.trim().length === 0 ? (
                <div className="px-4 py-6 terminal-text text-xs text-muted text-center">Escribe para buscar usuarios…</div>
              ) : cmdkResults.length === 0 ? (
                <div className="px-4 py-6 terminal-text text-xs text-muted text-center">Sin resultados para &quot;{searchQuery}&quot;</div>
              ) : cmdkResults.map(u => (
                <button
                  key={u.id}
                  className="w-full text-left px-4 py-3 hover:bg-admin-violet/10 transition-colors border-b border-admin-border last:border-0 flex items-center gap-3"
                  onClick={() => { setRightPanel(u); setCmdkOpen(false) }}
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${u.plan === 'pro' ? 'bg-gold' : 'bg-admin-border'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="terminal-text text-sm text-text truncate">{u.nombre || u.email.split('@')[0]}</div>
                    <div className="terminal-text text-xs text-muted truncate">{u.email}</div>
                  </div>
                  <span className={`section-label text-[10px] border px-2 py-0.5 shrink-0 ${u.plan === 'pro' ? 'text-gold border-gold/30' : 'text-text-dim border-admin-border'}`}>
                    {u.plan.toUpperCase()}
                  </span>
                  <ChevronRight size={12} className="text-muted shrink-0" />
                </button>
              ))}
            </div>
            <div className="border-t border-admin-border px-4 py-2">
              <span className="terminal-text text-[10px] text-muted">{users.length} usuarios totales</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Right Panel (user detail) ─────────────────────────────────────────── */}
      {rightPanel && (
        <div className="fixed inset-0 z-[90] flex justify-end" onClick={() => setRightPanel(null)}>
          <div
            className="w-full max-w-sm bg-admin-surface h-full overflow-y-auto shadow-admin-glow-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-admin-border sticky top-0 bg-admin-surface">
              <div className="section-label text-admin-violet2 text-xs">DETALLE USUARIO</div>
              <button onClick={() => setRightPanel(null)} className="text-muted hover:text-text transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-admin-violet/20 border border-admin-violet/30 flex items-center justify-center">
                  <span className="display-heading text-admin-violet2 text-lg leading-none">
                    {(rightPanel.nombre || rightPanel.email)[0].toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="terminal-text text-sm text-text truncate">{rightPanel.nombre || '—'}</div>
                  <div className="terminal-text text-xs text-muted truncate">{rightPanel.email}</div>
                </div>
              </div>

              <div className="flex flex-col gap-2 bg-admin-bg border border-admin-border p-4">
                {[
                  { label: 'PLAN',         value: rightPanel.plan.toUpperCase(),                   color: rightPanel.plan === 'pro' ? 'text-gold' : 'text-text-dim'       },
                  { label: 'ESTADO',       value: rightPanel.confirmed ? 'CONFIRMADO' : 'PENDIENTE', color: rightPanel.confirmed ? 'text-emerald-400' : 'text-yellow-400' },
                  { label: 'REGISTRO',     value: rightPanel.created_at.slice(0, 10),              color: 'text-text'                                                     },
                  { label: 'ÚLTIMO LOGIN', value: rightPanel.last_sign_in?.slice(0, 10) ?? '—',   color: 'text-text'                                                     },
                ].map(f => (
                  <div key={f.label} className="flex items-center justify-between py-1 border-b border-admin-border last:border-0">
                    <span className="section-label text-[10px] text-muted">{f.label}</span>
                    <span className={`terminal-text text-xs num ${f.color}`}>{f.value}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <div className="section-label text-[10px] text-muted mb-1">ACCIONES RÁPIDAS</div>
                <button
                  onClick={() => {
                    const newPlan = rightPanel.plan === 'pro' ? 'free' : 'pro'
                    togglePlan(rightPanel)
                    setRightPanel({ ...rightPanel, plan: newPlan })
                  }}
                  className={`w-full section-label text-xs py-2.5 px-4 border transition-colors text-left ${
                    rightPanel.plan === 'pro'
                      ? 'border-red-400/30 text-red-400 hover:bg-red-400/10'
                      : 'border-gold/30 text-gold hover:bg-gold/10'
                  }`}
                >
                  {rightPanel.plan === 'pro' ? '↓ BAJAR A FREE' : '↑ SUBIR A PRO'}
                </button>
                <button
                  onClick={() => { setTab('usuarios'); setExpandedUser(rightPanel.id); setRightPanel(null) }}
                  className="w-full section-label text-xs py-2.5 px-4 border border-admin-border text-text-dim hover:border-admin-violet/40 hover:text-admin-violet2 transition-colors text-left"
                >
                  → VER EN USUARIOS
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

