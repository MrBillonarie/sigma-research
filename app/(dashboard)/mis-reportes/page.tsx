'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/app/lib/supabase'
import { C } from '@/app/lib/constants'

interface ReporteRow {
  id:          string
  numero:      number
  titulo:      string
  fecha:       string
  descripcion: string
  url_pdf:     string
}

interface PortfolioRow {
  ibkr: number; binance_spot: number; binance_futures: number
  fintual: number; santander: number; cash: number
}

const GOLD  = '#d4af37'
const DARK  = '#04050a'
const GRAY  = '#8b8fa8'
const GREEN = '#34d399'
const WHITE = '#e8e9f0'

const PLATFORM_LABELS: Record<string, string> = {
  ibkr:             'Interactive Brokers',
  binance_spot:     'Binance Spot',
  binance_futures:  'Binance Futures',
  fintual:          'Fintual',
  santander:        'Santander',
  cash:             'Cash / Banco',
}

const CONTENT = [
  { num: '01', title: 'Resumen de Mercado',   items: ['Análisis macro semanal (SPX, NDX, BTC, Gold, DXY)', 'Régimen de mercado actual con modelo HMM', 'Lecturas de VIX, breadth, put/call ratio', 'Narrativa institucional y posicionamiento'] },
  { num: '02', title: 'Señales Activas',       items: ['Posiciones abiertas PRO.MACD v116', 'Señales OB+MACD 4H en crypto', 'Watchlist de setups high-probability', 'Entry, stop y target para cada señal'] },
  { num: '03', title: 'Performance Mensual',   items: ['Equity curve actualizada por modelo', 'P&L mensual y acumulado', 'Win rate, Sharpe y drawdown del mes', 'Comparativa vs. benchmark (SPX, BTC)'] },
  { num: '04', title: 'Análisis Cuantitativo', items: ['Rotación sectorial por factores PCA', 'Momentum score Top 20 acciones S&P 500', 'Anomalías estadísticas detectadas (z-score)', 'Correlaciones y cambios de régimen macro'] },
  { num: '05', title: 'FIRE & Planning',        items: ['Actualización mensual de la calculadora FIRE', 'Optimización de cartera por plataforma', 'Tax-loss harvesting opportunities', 'Proyección Monte Carlo rolling 12M'] },
  { num: '06', title: 'Modelo del Mes',         items: ['Deep-dive en uno de los modelos cuantitativos', 'Parámetros, lógica y validación estadística', 'Out-of-sample test results', 'Ideas de mejora y próximas versiones'] },
]

function fmt(n: number) {
  return '$' + n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function generatePDF(userEmail: string, portfolio: PortfolioRow | null) {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const now = new Date()
  const dateStr = now.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
  const fileMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const platforms = portfolio
    ? Object.entries(PLATFORM_LABELS)
        .map(([key, name]) => ({ name, value: (portfolio as unknown as Record<string, number>)[key] ?? 0 }))
        .filter(p => p.value > 0)
    : []
  const total = platforms.reduce((s, p) => s + p.value, 0)

  // ── Helpers ────────────────────────────────────────────────────────────────
  const setFont = (size: number, style: 'normal' | 'bold' = 'normal', color = WHITE) => {
    doc.setFontSize(size)
    doc.setFont('helvetica', style)
    const hex = color.replace('#', '')
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    doc.setTextColor(r, g, b)
  }

  const fillRect = (x: number, y: number, w: number, h: number, hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    doc.setFillColor(r, g, b)
    doc.rect(x, y, w, h, 'F')
  }

  const line = (x1: number, y1: number, x2: number, y2: number, hex = '#1a1d2e', lw = 0.3) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    doc.setDrawColor(r, g, b)
    doc.setLineWidth(lw)
    doc.line(x1, y1, x2, y2)
  }

  // ── PAGE 1: PORTADA ────────────────────────────────────────────────────────
  fillRect(0, 0, W, 297, DARK)

  // Accent top bar
  fillRect(0, 0, W, 2, GOLD)

  // Logo área
  setFont(9, 'normal', GRAY)
  doc.text('// SIGMA RESEARCH · ANÁLISIS PERSONAL', 20, 30)

  setFont(52, 'bold', GOLD)
  doc.text('SIGMA', 20, 58)
  setFont(52, 'bold', WHITE)
  doc.text('RESEARCH', 20, 78)

  line(20, 88, W - 20, 88, GOLD, 0.5)

  setFont(18, 'bold', WHITE)
  doc.text('REPORTE DE ANÁLISIS', 20, 100)
  setFont(18, 'bold', GOLD)
  doc.text('PERSONAL DE PORTFOLIO', 20, 112)

  setFont(10, 'normal', GRAY)
  doc.text(`Generado el: ${dateStr}`, 20, 126)
  doc.text(`Usuario: ${userEmail}`, 20, 134)
  doc.text('Plan: PRO', 20, 142)

  // Total patrimonio box
  if (total > 0) {
    fillRect(20, 158, W - 40, 40, '#0f1118')
    line(20, 158, W - 20, 158, GOLD, 0.5)
    setFont(8, 'normal', GRAY)
    doc.text('PATRIMONIO TOTAL REGISTRADO', 28, 168)
    setFont(26, 'bold', GOLD)
    doc.text(fmt(total), 28, 182)
    setFont(8, 'normal', GRAY)
    doc.text('USD equivalente · suma de plataformas activas', 28, 191)
  }

  // Secciones incluidas
  setFont(8, 'normal', GRAY)
  doc.text('INCLUYE:', 20, 215)
  const sections = ['01 Resumen de Mercado', '02 Señales Activas', '03 Performance Mensual', '04 Análisis Cuantitativo', '05 FIRE & Planning', '06 Modelo del Mes']
  sections.forEach((s, i) => {
    const col = i < 3 ? 20 : 110
    const row = 223 + (i % 3) * 8
    setFont(8, 'normal', GOLD)
    doc.text('▸', col, row)
    setFont(8, 'normal', WHITE)
    doc.text(s, col + 5, row)
  })

  // Footer p1
  line(20, 280, W - 20, 280, '#1a1d2e', 0.3)
  setFont(7, 'normal', GRAY)
  doc.text('SIGMA RESEARCH · sigma-research.io · Uso exclusivo del titular de la cuenta', 20, 287)
  doc.text('1', W - 20, 287, { align: 'right' })

  // ── PAGE 2: PORTFOLIO ──────────────────────────────────────────────────────
  doc.addPage()
  fillRect(0, 0, W, 297, DARK)
  fillRect(0, 0, W, 1.5, GOLD)

  // Header
  fillRect(0, 14, W, 18, '#0f1118')
  setFont(7, 'normal', GRAY)
  doc.text('// SIGMA RESEARCH · ANÁLISIS PERSONAL', 20, 21)
  setFont(7, 'normal', GRAY)
  doc.text(`${dateStr} · ${userEmail}`, W - 20, 21, { align: 'right' })
  line(0, 32, W, 32, '#1a1d2e', 0.3)

  setFont(8, 'normal', GRAY)
  doc.text('SECCIÓN 00', 20, 44)
  setFont(22, 'bold', WHITE)
  doc.text('PORTFOLIO', 20, 55)
  setFont(22, 'bold', GOLD)
  doc.text('PERSONAL', 70, 55)
  line(20, 60, W - 20, 60, GOLD, 0.4)

  let y = 72
  if (platforms.length === 0) {
    setFont(10, 'normal', GRAY)
    doc.text('No hay datos de portfolio registrados.', 20, y)
    doc.text('Configura tu portfolio en la sección Terminal.', 20, y + 10)
  } else {
    // Table header
    fillRect(20, y - 5, W - 40, 9, '#0f1118')
    setFont(7, 'bold', GRAY)
    doc.text('PLATAFORMA', 22, y)
    doc.text('VALOR USD', 120, y)
    doc.text('% PORTAFOLIO', 160, y)
    y += 6
    line(20, y, W - 20, y, '#1a1d2e', 0.3)
    y += 5

    platforms.forEach((p, i) => {
      if (i % 2 === 0) fillRect(20, y - 4, W - 40, 9, '#08090f')
      setFont(9, 'normal', WHITE)
      doc.text(p.name, 22, y)
      setFont(9, 'bold', GOLD)
      doc.text(fmt(p.value), 120, y)
      setFont(9, 'normal', GRAY)
      doc.text(`${((p.value / total) * 100).toFixed(1)}%`, 160, y)
      y += 9
    })

    line(20, y, W - 20, y, GOLD, 0.4)
    y += 6
    setFont(10, 'bold', GOLD)
    doc.text('TOTAL', 22, y)
    doc.text(fmt(total), 120, y)
    doc.text('100.0%', 160, y)
    y += 16

    // Distribution bars
    setFont(8, 'normal', GRAY)
    doc.text('DISTRIBUCIÓN DE CAPITAL', 20, y)
    y += 6
    const barW = W - 40
    const barH = 8
    let bx = 20
    const colors = ['#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280']
    platforms.forEach((p, i) => {
      const w = (p.value / total) * barW
      const hex = colors[i % colors.length]
      fillRect(bx, y, w, barH, hex)
      bx += w
    })
    y += barH + 4
    platforms.forEach((p, i) => {
      const hex = colors[i % colors.length]
      fillRect(20 + (i % 3) * 60, y + Math.floor(i / 3) * 8, 4, 4, hex)
      setFont(7, 'normal', GRAY)
      doc.text(`${p.name.split(' ')[0]} ${((p.value / total) * 100).toFixed(0)}%`, 26 + (i % 3) * 60, y + Math.floor(i / 3) * 8 + 3)
    })
  }

  // Footer p2
  line(20, 280, W - 20, 280, '#1a1d2e', 0.3)
  setFont(7, 'normal', GRAY)
  doc.text('SIGMA RESEARCH · sigma-research.io', 20, 287)
  doc.text('2', W - 20, 287, { align: 'right' })

  // ── PAGES 3-8: SECCIONES ──────────────────────────────────────────────────
  CONTENT.forEach((section, idx) => {
    doc.addPage()
    fillRect(0, 0, W, 297, DARK)
    fillRect(0, 0, W, 1.5, GOLD)

    // Header
    fillRect(0, 14, W, 18, '#0f1118')
    setFont(7, 'normal', GRAY)
    doc.text('// SIGMA RESEARCH · ANÁLISIS PERSONAL', 20, 21)
    setFont(7, 'normal', GRAY)
    doc.text(`${dateStr} · ${userEmail}`, W - 20, 21, { align: 'right' })
    line(0, 32, W, 32, '#1a1d2e', 0.3)

    // Section title
    setFont(8, 'normal', GRAY)
    doc.text(`SECCIÓN ${section.num}`, 20, 44)
    setFont(26, 'bold', WHITE)
    doc.text(section.title.toUpperCase(), 20, 56)
    line(20, 61, W - 20, 61, GOLD, 0.4)

    // Items
    let sy = 74
    section.items.forEach(item => {
      setFont(8, 'normal', GOLD)
      doc.text('▸', 20, sy)
      setFont(9, 'normal', WHITE)
      const lines = doc.splitTextToSize(item, W - 52)
      doc.text(lines, 28, sy)
      sy += lines.length * 6 + 4
    })

    sy += 6
    line(20, sy, W - 20, sy, '#1a1d2e', 0.3)
    sy += 10

    // Content placeholder box
    fillRect(20, sy, W - 40, 80, '#0a0b10')
    line(20, sy, W - 20, sy, '#1a1d2e', 0.3)
    line(20, sy, 20, sy + 80, '#1a1d2e', 0.3)
    line(W - 20, sy, W - 20, sy + 80, '#1a1d2e', 0.3)
    line(20, sy + 80, W - 20, sy + 80, '#1a1d2e', 0.3)
    setFont(9, 'normal', GRAY)
    doc.text('Datos actualizados disponibles en la plataforma en tiempo real.', W / 2, sy + 36, { align: 'center' })
    doc.text('Accede al dashboard para ver las métricas completas.', W / 2, sy + 46, { align: 'center' })
    setFont(8, 'normal', GOLD)
    doc.text('sigma-research.io/home', W / 2, sy + 58, { align: 'center' })

    // Section note
    sy += 92
    setFont(8, 'normal', GRAY)
    const note = getSectionNote(section.num, portfolio, total)
    if (note) {
      const noteLines = doc.splitTextToSize(note, W - 40)
      doc.text(noteLines, 20, sy)
    }

    // Footer
    line(20, 280, W - 20, 280, '#1a1d2e', 0.3)
    setFont(7, 'normal', GRAY)
    doc.text('SIGMA RESEARCH · sigma-research.io', 20, 287)
    doc.text(String(idx + 3), W - 20, 287, { align: 'right' })
  })

  // ── ÚLTIMA PÁGINA: DISCLAIMER ──────────────────────────────────────────────
  doc.addPage()
  fillRect(0, 0, W, 297, DARK)
  fillRect(0, 0, W, 1.5, GOLD)

  setFont(14, 'bold', GOLD)
  doc.text('AVISO LEGAL', 20, 50)
  line(20, 55, W - 20, 55, GOLD, 0.4)

  const disclaimer = [
    'Este reporte ha sido generado automáticamente a partir de los datos registrados en la plataforma Sigma Research.',
    '',
    'El contenido de este documento tiene carácter exclusivamente informativo y educativo. No constituye asesoramiento',
    'financiero, recomendación de inversión, ni oferta de compra o venta de activos financieros.',
    '',
    'Los modelos cuantitativos y señales presentados son el resultado de análisis estadísticos históricos. El rendimiento',
    'pasado no garantiza resultados futuros. Toda inversión conlleva riesgos, incluyendo la posible pérdida del capital.',
    '',
    'El usuario es el único responsable de sus decisiones de inversión. Sigma Research no asume responsabilidad por',
    'pérdidas derivadas del uso de la información contenida en este reporte.',
    '',
    'Documento generado para uso exclusivo del titular de la cuenta. Prohibida su distribución sin autorización.',
  ]

  let dy = 68
  disclaimer.forEach(l => {
    setFont(8, 'normal', l === '' ? GRAY : GRAY)
    doc.text(l, 20, dy)
    dy += l === '' ? 4 : 7
  })

  line(20, 280, W - 20, 280, '#1a1d2e', 0.3)
  setFont(7, 'normal', GRAY)
  doc.text('© SIGMA RESEARCH · sigma-research.io · Todos los derechos reservados', 20, 287)
  doc.text(String(CONTENT.length + 3), W - 20, 287, { align: 'right' })

  doc.save(`SIGMA_Analisis_Personal_${fileMonth}.pdf`)
}

function getSectionNote(num: string, portfolio: PortfolioRow | null, total: number): string {
  if (!portfolio) return ''
  switch (num) {
    case '01': return 'Nota: Tu portfolio registrado cubre múltiples clases de activos. Consulta el HUD para señales de régimen en tiempo real.'
    case '03': return total > 0 ? `Tu patrimonio total registrado es ${fmt(total)} USD. Revisa el Terminal para el P&L detallado por plataforma.` : ''
    case '05': return 'Usa el Simulador FIRE de la plataforma para proyectar tu independencia financiera con los datos actuales de tu portfolio.'
    default:   return ''
  }
}

export default function MisReportesPage() {
  const [reportes,    setReportes]    = useState<ReporteRow[]>([])
  const [loading,     setLoading]     = useState(true)
  const [generating,  setGenerating]  = useState(false)
  const [userEmail,   setUserEmail]   = useState('')
  const [portfolio,   setPortfolio]   = useState<PortfolioRow | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setLoading(false); return }
      setUserEmail(data.user.email ?? '')

      const [reportesRes, portfolioRes] = await Promise.all([
        supabase.from('reportes').select('id,numero,titulo,fecha,descripcion,url_pdf').eq('activo', true).order('numero', { ascending: false }),
        supabase.from('portfolio').select('*').eq('user_id', data.user.id).maybeSingle(),
      ])
      if (reportesRes.data) setReportes(reportesRes.data as ReporteRow[])
      if (portfolioRes.data) setPortfolio(portfolioRes.data as PortfolioRow)
      setLoading(false)
    })
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    try {
      await generatePDF(userEmail, portfolio)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono,'DM Mono',monospace)" }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '88px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 10 }}>
              {'// SIGMA RESEARCH · REPORTE MENSUAL'}
            </div>
            <h1 style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 'clamp(44px,6vw,80px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
              <span style={{ color: C.text }}>MIS</span>{' '}
              <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow},#a88c25)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>REPORTES</span>
            </h1>
          </div>
        </div>

        {/* ── GENERAR ANÁLISIS ── */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, marginBottom: 1 }}>
          <div style={{ padding: '14px 24px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold }}>
              {'// GENERAR ANÁLISIS PERSONAL'}
            </span>
          </div>
          <div style={{ padding: '28px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
            <div style={{ maxWidth: 520 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 13, color: C.text, marginBottom: 8 }}>
                Reporte PDF con tu portfolio actual
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, lineHeight: 1.8 }}>
                Genera un PDF personalizado con tus datos de portfolio registrados, distribución de capital por plataforma
                y las 6 secciones de análisis de Sigma Research. Se descarga directamente en tu dispositivo.
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
                {['Portfolio multi-plataforma', 'Distribución de capital', '6 secciones de análisis', 'Descarga instantánea'].map(tag => (
                  <span key={tag} style={{ fontFamily: 'monospace', fontSize: 10, color: GREEN, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', padding: '3px 10px' }}>
                    ✓ {tag}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || loading}
              style={{
                padding: '16px 36px',
                background: generating ? 'transparent' : C.gold,
                color: generating ? C.gold : C.bg,
                border: `1px solid ${C.gold}`,
                fontFamily: "'Bebas Neue',Impact,sans-serif",
                fontSize: 20, letterSpacing: '0.1em',
                cursor: generating || loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                minWidth: 220,
              }}
            >
              {generating ? '⟳ GENERANDO PDF…' : '↓ GENERAR MI ANÁLISIS'}
            </button>
          </div>
        </div>

        {/* ── REPORTES PUBLICADOS ── */}
        <div style={{ marginBottom: 1 }}>
          <div style={{ background: C.surface, padding: '12px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold }}>
              REPORTES PUBLICADOS · DESCARGA
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted }}>PLAN PRO</span>
          </div>

          {loading ? (
            <div style={{ background: C.bg, padding: '40px', textAlign: 'center', fontFamily: 'monospace', fontSize: 12, color: C.muted }}>
              Cargando reportes…
            </div>
          ) : reportes.length === 0 ? (
            <div style={{ background: C.bg, padding: '40px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.muted, marginBottom: 10 }}>
                Aún no hay reportes publicados.
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>
                El primer reporte se publica el primer miércoles de cada mes.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: C.border }}>
              {reportes.map(r => {
                const disponible = !!r.url_pdf
                const num        = String(r.numero).padStart(3, '0')
                const fileName   = `SIGMA_Reporte_Mensual_#${num}_${r.fecha?.slice(0, 7) ?? ''}.pdf`
                return (
                  <div key={r.id} style={{ background: C.bg, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 36, color: C.gold, lineHeight: 1, minWidth: 56, flexShrink: 0 }}>
                      #{num}
                    </span>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 13, color: C.text, marginBottom: 4 }}>{r.titulo}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, marginBottom: 4 }}>{r.descripcion}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted }}>{r.fecha}</div>
                    </div>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.18em', padding: '4px 12px', flexShrink: 0,
                      background: disponible ? 'rgba(52,211,153,0.1)'  : 'rgba(107,114,128,0.12)',
                      color:      disponible ? '#34d399'               : '#6b7280',
                      border:     `1px solid ${disponible ? 'rgba(52,211,153,0.25)' : 'rgba(107,114,128,0.2)'}`,
                    }}>
                      {disponible ? 'DISPONIBLE' : 'PRÓXIMAMENTE'}
                    </span>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      {disponible ? (
                        <>
                          <a href={`/api/reportes/${r.id}/download`} download={fileName}
                            style={{ padding: '9px 18px', background: C.gold, color: C.bg, fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.18em', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                            ↓ DESCARGAR
                          </a>
                          <a href={r.url_pdf} target="_blank" rel="noopener noreferrer"
                            style={{ padding: '9px 18px', background: 'transparent', color: C.dimText, border: `1px solid ${C.border}`, fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.18em', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                            VISUALIZAR
                          </a>
                        </>
                      ) : (
                        <span style={{ padding: '9px 18px', fontFamily: 'monospace', fontSize: 11, color: C.muted, border: `1px solid ${C.border}` }}>
                          PRÓXIMAMENTE
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Qué incluye cada reporte */}
        <div style={{ marginTop: 1, background: C.border }}>
          <div style={{ background: C.surface, padding: '12px 22px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>
              QUÉ INCLUYE CADA REPORTE
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1 }}>
            {CONTENT.map(s => (
              <div key={s.num} style={{ background: C.bg, padding: '20px 22px' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                  <span style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 18, color: C.gold, lineHeight: 1, flexShrink: 0 }}>{s.num}</span>
                  <span style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 16, color: C.text, lineHeight: 1.1 }}>{s.title.toUpperCase()}</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {s.items.map(item => (
                    <li key={item} style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, lineHeight: 1.5, display: 'flex', gap: 8 }}>
                      <span style={{ color: C.gold, flexShrink: 0 }}>▸</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
