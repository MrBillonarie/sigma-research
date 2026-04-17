'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const SESSION_KEY = 'sigma_admin_auth'

// ── Mock data ────────────────────────────────────────────────────────────────
const mockUsers = [
  { id: 1,  nombre: 'Carlos Reyes',    email: 'creyes@gmail.com',        plan: 'PRO',          estado: 'ACTIVO',    fecha: '2024-11-03' },
  { id: 2,  nombre: 'Sofía Vargas',    email: 'sofia.v@inversores.cl',   plan: 'TERMINAL',     estado: 'ACTIVO',    fecha: '2024-12-15' },
  { id: 3,  nombre: 'Andrés Molina',   email: 'a.molina@fondocl.com',    plan: 'INSTITUTIONAL',estado: 'ACTIVO',    fecha: '2025-01-08' },
  { id: 4,  nombre: 'Valentina Cruz',  email: 'vcruz@gmail.com',         plan: 'PRO',          estado: 'ACTIVO',    fecha: '2025-01-22' },
  { id: 5,  nombre: 'Rodrigo Peña',    email: 'rpeña@trading.io',        plan: 'TERMINAL',     estado: 'SUSPENDIDO',fecha: '2025-02-01' },
  { id: 6,  nombre: 'Camila Torres',   email: 'cam.torres@outlook.com',  plan: 'PRO',          estado: 'ACTIVO',    fecha: '2025-02-14' },
  { id: 7,  nombre: 'Felipe Araya',    email: 'faraya@uc.cl',            plan: 'TERMINAL',     estado: 'ACTIVO',    fecha: '2025-03-05' },
  { id: 8,  nombre: 'Isidora Lagos',   email: 'isidora.l@gmail.com',     plan: 'PRO',          estado: 'ACTIVO',    fecha: '2025-03-18' },
]

const mockSolicitudes = [
  { id: 1, nombre: 'Pedro Gutiérrez', empresa: 'Fondo Sur Capital',  email: 'pgutierrez@fsc.cl',       motivo: 'Plan Institutional — solicitud de acceso', estado: 'PENDIENTE',  fecha: '2025-04-10' },
  { id: 2, nombre: 'Ana Hernández',   empresa: '',                   email: 'ahernan@gmail.com',        motivo: 'Demo personalizada',                      estado: 'RESPONDIDA', fecha: '2025-04-08' },
  { id: 3, nombre: 'Luis Mora',       empresa: 'Asesores RM',        email: 'luis.mora@asesorerm.cl',   motivo: 'Integración API',                         estado: 'PENDIENTE',  fecha: '2025-04-12' },
  { id: 4, nombre: 'María Fuentes',   empresa: '',                   email: 'm.fuentes@hotmail.com',    motivo: 'Soporte técnico',                         estado: 'RESPONDIDA', fecha: '2025-04-07' },
  { id: 5, nombre: 'Jorge Cáceres',   empresa: 'Renta Quant LLC',    email: 'jcaceres@rentaquant.io',   motivo: 'Propuesta de colaboración',               estado: 'PENDIENTE',  fecha: '2025-04-14' },
]

const mockModelos = [
  { tag: 'HMM-01', name: 'REGIME DETECTOR',  status: 'PRODUCCIÓN', accuracy: '91.2%', metric: 'Accuracy',       activo: true  },
  { tag: 'GARCH-02',name:'VOL FORECASTER',   status: 'PRODUCCIÓN', accuracy: '0.031', metric: 'MAE 30D',        activo: true  },
  { tag: 'XGB-03',  name: 'MOMENTUM SCORE',  status: 'BETA',       accuracy: '2.41',  metric: 'Sharpe OOS',     activo: true  },
  { tag: 'NLP-04',  name: 'SENTIMENT ALPHA', status: 'BETA',       accuracy: '73.8%', metric: 'F1-Score',       activo: false },
  { tag: 'STAT-05', name: 'PAIRS TRADING',   status: 'PRODUCCIÓN', accuracy: '1.87',  metric: 'Sharpe OOS',     activo: true  },
  { tag: 'VAR-06',  name: 'MACRO REGIME',    status: 'PRODUCCIÓN', accuracy: '84.1%', metric: 'Directional Acc',activo: true  },
]

const kpis = [
  { label: 'Usuarios totales',     value: mockUsers.length.toString(),                                     color: 'text-gold' },
  { label: 'Suscripciones PRO+',   value: mockUsers.filter(u => u.plan !== 'TERMINAL').length.toString(),  color: 'text-emerald-400' },
  { label: 'Solicitudes pendientes',value: mockSolicitudes.filter(s => s.estado === 'PENDIENTE').length.toString(), color: 'text-yellow-400' },
  { label: 'Modelos activos',       value: mockModelos.filter(m => m.activo).length.toString(),            color: 'text-gold' },
]

type Tab = 'resumen' | 'usuarios' | 'solicitudes' | 'modelos'

const planColor: Record<string, string> = {
  TERMINAL:      'text-text-dim border-border',
  PRO:           'text-gold border-gold/30',
  INSTITUTIONAL: 'text-emerald-400 border-emerald-400/30',
}

export default function AdminDashboard() {
  const router  = useRouter()
  const [tab,   setTab]   = useState<Tab>('resumen')
  const [modelos, setModelos] = useState(mockModelos)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) !== 'true') {
      router.replace('/admin')
    } else {
      setLoading(false)
    }
  }, [router])

  function logout() {
    sessionStorage.removeItem(SESSION_KEY)
    router.push('/admin')
  }

  function toggleModelo(tag: string) {
    setModelos(prev => prev.map(m => m.tag === tag ? { ...m, activo: !m.activo } : m))
  }

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
          {([
            { id: 'resumen',     label: 'RESUMEN' },
            { id: 'usuarios',    label: 'USUARIOS' },
            { id: 'solicitudes', label: 'SOLICITUDES' },
            { id: 'modelos',     label: 'MODELOS' },
          ] as { id: Tab; label: string }[]).map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`section-label text-left px-3 py-2.5 transition-colors text-xs ${
                tab === item.id
                  ? 'text-gold bg-gold/5 border-l-2 border-gold'
                  : 'text-text-dim hover:text-gold hover:bg-gold/5 border-l-2 border-transparent'
              }`}
            >
              {item.label}
            </button>
          ))}
        </aside>

        {/* Mobile tabs */}
        <div className="md:hidden w-full border-b border-border bg-surface px-4 flex gap-1 overflow-x-auto">
          {(['resumen','usuarios','solicitudes','modelos'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`section-label text-xs py-3 px-3 whitespace-nowrap border-b-2 transition-colors ${
                tab === t ? 'text-gold border-gold' : 'text-text-dim border-transparent'
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
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
                {/* Distribución de planes */}
                <div className="bg-surface p-6">
                  <div className="section-label text-gold mb-4">DISTRIBUCIÓN DE PLANES</div>
                  {['TERMINAL', 'PRO', 'INSTITUTIONAL'].map(plan => {
                    const count = mockUsers.filter(u => u.plan === plan).length
                    const pct   = Math.round((count / mockUsers.length) * 100)
                    return (
                      <div key={plan} className="mb-4">
                        <div className="flex justify-between mb-1">
                          <span className={`section-label text-xs ${planColor[plan].split(' ')[0]}`}>{plan}</span>
                          <span className="terminal-text text-xs text-text-dim num">{count} usuarios ({pct}%)</span>
                        </div>
                        <div className="h-1.5 bg-border">
                          <div
                            className="h-full bg-gold-gradient transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Estado de modelos */}
                <div className="bg-surface p-6">
                  <div className="section-label text-gold mb-4">ESTADO DE MODELOS</div>
                  <div className="flex flex-col gap-2">
                    {modelos.map(m => (
                      <div key={m.tag} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${m.activo ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          <span className="terminal-text text-xs text-text">{m.name}</span>
                        </div>
                        <span className={`section-label text-xs ${m.activo ? 'text-emerald-400' : 'text-muted'}`}>
                          {m.activo ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── USUARIOS ── */}
          {tab === 'usuarios' && (
            <div className="flex flex-col gap-6">
              <div>
                <div className="section-label text-gold mb-1">{'// GESTIÓN'}</div>
                <h2 className="display-heading text-4xl text-text">USUARIOS</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-surface border-b border-border">
                      {['#', 'Nombre', 'Email', 'Plan', 'Estado', 'Registro'].map(h => (
                        <th key={h} className="section-label text-text-dim text-xs text-left px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mockUsers.map(u => (
                      <tr key={u.id} className="border-b border-border hover:bg-surface/60 transition-colors">
                        <td className="terminal-text text-xs text-muted px-4 py-3 num">{u.id}</td>
                        <td className="terminal-text text-sm text-text px-4 py-3">{u.nombre}</td>
                        <td className="terminal-text text-xs text-text-dim px-4 py-3">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`section-label text-xs border px-2 py-0.5 ${planColor[u.plan]}`}>
                            {u.plan}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`section-label text-xs ${
                            u.estado === 'ACTIVO' ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {u.estado}
                          </span>
                        </td>
                        <td className="terminal-text text-xs text-text-dim px-4 py-3 num">{u.fecha}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                        {s.empresa && (
                          <span className="terminal-text text-xs text-text-dim">· {s.empresa}</span>
                        )}
                      </div>
                      <span className="terminal-text text-xs text-text-dim">{s.email}</span>
                      <span className="terminal-text text-xs text-gold mt-1">{s.motivo}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="terminal-text text-xs text-muted num">{s.fecha}</span>
                      <span className={`section-label text-xs ${
                        s.estado === 'PENDIENTE' ? 'text-yellow-400' : 'text-emerald-400'
                      }`}>
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
                      <span className={`section-label text-xs ${
                        m.status === 'PRODUCCIÓN' ? 'text-emerald-400' : 'text-yellow-400'
                      }`}>{m.status}</span>
                    </div>
                    <div>
                      <div className="display-heading text-2xl text-text">{m.name}</div>
                      <div className="terminal-text text-xs text-text-dim mt-1 num tabular-nums">
                        {m.accuracy} · {m.metric}
                      </div>
                    </div>
                    {/* Toggle */}
                    <button
                      onClick={() => toggleModelo(m.tag)}
                      className={`flex items-center gap-2 self-start section-label text-xs transition-colors ${
                        m.activo ? 'text-emerald-400' : 'text-muted'
                      }`}
                    >
                      <div className={`w-8 h-4 rounded-full transition-colors relative ${
                        m.activo ? 'bg-emerald-400/30' : 'bg-border'
                      }`}>
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${
                          m.activo ? 'left-4 bg-emerald-400' : 'left-0.5 bg-muted'
                        }`} />
                      </div>
                      {m.activo ? 'ACTIVO' : 'INACTIVO'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
