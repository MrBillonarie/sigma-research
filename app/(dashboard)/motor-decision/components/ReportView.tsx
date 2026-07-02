'use client'
import { useState } from 'react'
import type { Report, SignalType } from '@/types/decision-engine'
import { formatDateES } from '@/lib/reportGen'

const SIGNAL_ES: Record<SignalType, string> = {
  comprar: 'COMPRAR', mantener: 'MANTENER', reducir: 'REDUCIR', neutral: 'NEUTRAL',
}
const SIGNAL_COLOR: Record<SignalType, string> = {
  comprar: '#1D9E75', mantener: '#d4af37', reducir: '#f87171', neutral: '#7a7f9a',
}
const CLASS_ICON: Record<string, string> = {
  fondos: '🏦', etfs: '📊', renta_fija: '🏛️', crypto: '🪙',
}

interface Props {
  report: Report
  onClose?: () => void
}

export default function ReportView({ report, onClose }: Props) {
  const [exporting, setExporting] = useState(false)

  async function handlePDF() {
    setExporting(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc    = new jsPDF({ unit: 'mm', format: 'a4' })
      const W      = 210
      const H      = 297
      const MARGIN = 18
      const INNER  = W - MARGIN * 2
      let y        = MARGIN

      // ── Helpers ──────────────────────────────────────────────────────────────

      const line = (text: string, size = 10, color: [number,number,number] = [200,200,210], bold = false) => {
        doc.setFontSize(size)
        doc.setFont('helvetica', bold ? 'bold' : 'normal')
        doc.setTextColor(...color)
        const lines = doc.splitTextToSize(text, INNER)
        doc.text(lines, MARGIN, y)
        y += lines.length * (size * 0.45) + 2
      }

      const sectionHeader = (title: string, color: [number,number,number]) => {
        // Accent bar izquierda
        doc.setFillColor(...color)
        doc.rect(MARGIN, y - 3, 2, 7, 'F')
        // Fondo sutil del header
        doc.setFillColor(11, 13, 20)
        doc.rect(MARGIN + 3, y - 3, INNER - 3, 7, 'F')
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...color)
        doc.text(title, MARGIN + 6, y + 2)
        y += 9
      }

      const divider = () => {
        doc.setDrawColor(26, 29, 46)
        doc.line(MARGIN, y, W - MARGIN, y)
        y += 6
      }

      const nl = (n = 4) => { y += n }

      // Barra horizontal de progreso (para scores)
      const progressBar = (value: number, maxVal: number, barColor: [number,number,number]) => {
        const barW = INNER
        const barH = 3
        doc.setFillColor(26, 29, 46)
        doc.rect(MARGIN, y, barW, barH, 'F')
        doc.setFillColor(...barColor)
        doc.rect(MARGIN, y, barW * Math.min(value / maxVal, 1), barH, 'F')
        y += barH + 5
      }

      // Footer con número de página
      const addFooter = () => {
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(60, 65, 85)
        doc.text('SIGMA CAPITAL CLUB — Documento confidencial. No constituye asesoría de inversión regulada.', MARGIN, H - 8)
        doc.text(`${formatDateES(report.generatedAt)}`, W - MARGIN, H - 8, { align: 'right' })
        // Línea superior del footer
        doc.setDrawColor(26, 29, 46)
        doc.line(MARGIN, H - 12, W - MARGIN, H - 12)
      }

      // ── Fondo global ─────────────────────────────────────────────────────────
      doc.setFillColor(4, 5, 10)
      doc.rect(0, 0, W, H, 'F')

      // ── Header ───────────────────────────────────────────────────────────────
      // Banda superior
      doc.setFillColor(11, 13, 20)
      doc.rect(0, 0, W, 42, 'F')
      // Línea dorada de acento
      doc.setFillColor(212, 175, 55)
      doc.rect(0, 42, W, 1, 'F')
      // Logo Σ (box)
      doc.setFillColor(29, 158, 117)
      doc.rect(MARGIN, 8, 14, 14, 'F')
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(4, 5, 10)
      doc.text('S', MARGIN + 4.5, 19)
      // Título
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(232, 233, 240)
      doc.text('SIGMA CAPITAL CLUB', MARGIN + 18, 17)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(122, 127, 154)
      doc.text('MOTOR DE DECISIÓN FINANCIERA — REPORTE EJECUTIVO', MARGIN + 18, 24)
      // Metadata derecha
      doc.setFontSize(8)
      doc.setTextColor(122, 127, 154)
      doc.text(`Generado: ${formatDateES(report.generatedAt)}`, W - MARGIN, 14, { align: 'right' })
      doc.text(`Perfil: ${report.profile.label.toUpperCase()} | Horizonte: ${report.profile.horizonte}`, W - MARGIN, 21, { align: 'right' })

      y = 52

      // ── Señal Sigma IA ───────────────────────────────────────────────────────
      sectionHeader('SEÑAL SIGMA TRADER IA', [55, 138, 221])
      line(report.sigmaIASignal.replace(/[🟢🔴🟡]/g, '').trim(), 10, [200, 200, 210])
      nl(4); divider()

      // ── Resumen ejecutivo ─────────────────────────────────────────────────────
      sectionHeader('RESUMEN EJECUTIVO', [29, 158, 117])
      line(report.summary, 9, [180, 180, 190])
      nl(4); divider()

      // ── Asignación ────────────────────────────────────────────────────────────
      sectionHeader('ASIGNACIÓN ÓPTIMA', [212, 175, 55])
      nl(2)
      const alloc = report.allocation
      const allocData: [string, number, [number,number,number]][] = [
        ['Fondos Mutuos', alloc.fondos,     [29, 158, 117]],
        ['ETFs Globales', alloc.etfs,       [55, 138, 221]],
        ['Renta Fija',    alloc.renta_fija, [212, 175, 55]],
        ['Crypto',        alloc.crypto,     [167, 139, 250]],
      ]
      allocData.forEach(([label, val, color]) => {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(200, 200, 210)
        doc.text(`${label}`, MARGIN, y)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...color)
        doc.text(`${val}%`, W - MARGIN, y, { align: 'right' })
        y += 4
        // Mini barra
        doc.setFillColor(26, 29, 46)
        doc.rect(MARGIN, y, INNER, 2, 'F')
        doc.setFillColor(...color)
        doc.rect(MARGIN, y, INNER * (val / 100), 2, 'F')
        y += 6
      })
      nl(2)
      line(`Retorno esperado: ${report.metrics.expectedReturn.toFixed(1)}%  |  Vol: ${report.metrics.annualVolatility.toFixed(1)}%  |  Sharpe: ${report.metrics.sharpeRatio.toFixed(2)}`, 8, [122, 127, 154])
      nl(4); divider()

      // ── Top movimientos ───────────────────────────────────────────────────────
      sectionHeader('TOP 5 MOVIMIENTOS RECOMENDADOS', [167, 139, 250])
      nl(2)
      report.topMoves.forEach((m, i) => {
        const sigColor: [number,number,number] = m.action === 'comprar' ? [29,158,117] : m.action === 'reducir' ? [248,113,113] : [212,175,55]
        // Fondo del item
        doc.setFillColor(11, 13, 20)
        doc.rect(MARGIN, y - 2, INNER, 18, 'F')
        line(`${i + 1}. ${SIGNAL_ES[m.action]} — ${m.asset}`, 10, sigColor, true)
        line(m.reason, 9, [160, 160, 170])
        line(`Score: ${m.score}/100  |  Ret. 1A: ${m.return1y > 0 ? '+' : ''}${m.return1y.toFixed(1)}%`, 8, [122, 127, 154])
        nl(3)
      })
      divider()

      // ── Score flujo de capital ────────────────────────────────────────────────
      sectionHeader('SCORE FLUJO DE CAPITAL CROSS-MARKET', [55, 138, 221])
      nl(3)
      const fc = report.flowScore
      const fcColor: [number,number,number] = fc > 60 ? [29,158,117] : fc > 40 ? [212,175,55] : [248,113,113]
      // Score grande
      doc.setFontSize(28)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...fcColor)
      doc.text(`${fc}`, MARGIN, y + 8)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(122, 127, 154)
      doc.text('/100', MARGIN + 16, y + 8)
      doc.setFontSize(10)
      doc.setTextColor(...fcColor)
      doc.text(fc > 60 ? 'BULL — Flujo positivo de capital' : fc < 40 ? 'BEAR — Salida de capital' : 'NEUTRO — Señales mixtas', MARGIN + 30, y + 8)
      y += 14
      progressBar(fc, 100, fcColor)
      nl(2)
      report.flowSignals.forEach(fs => {
        const trend = fs.trend === 'entrando' ? '+' : fs.trend === 'saliendo' ? '-' : '~'
        line(`[${trend}] ${fs.market}  ${fs.inflow.toFixed(0)}% entrada / ${fs.outflow.toFixed(0)}% salida`, 9, [160, 160, 170])
        nl(1)
      })

      addFooter()
      doc.save(`sigma-reporte-${new Date().toISOString().split('T')[0]}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{
      background: '#0b0d14', border: '1px solid #1a1d2e',
      borderRadius: 12, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid #1a1d2e',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <h2 style={{
            margin: 0, fontSize: 14,
            fontFamily: "'Bebas Neue', Impact, sans-serif", letterSpacing: 1,
            color: '#1D9E75',
          }}>
            REPORTE SEMANAL — MOTOR SIGMA
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: '#7a7f9a', fontFamily: 'monospace' }}>
            {formatDateES(report.generatedAt)} · Perfil: {report.profile.label}
          </p>
        </div>
        <button
          onClick={handlePDF}
          disabled={exporting}
          style={{
            background: exporting ? '#1a1d2e' : '#1D9E75',
            color: '#000', border: 'none', borderRadius: 7,
            padding: '8px 16px', fontSize: 12, fontWeight: 700,
            fontFamily: 'monospace', cursor: exporting ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {exporting ? 'Exportando...' : '↓ Descargar PDF'}
        </button>
        {onClose && (
          <button onClick={onClose} style={{
            background: 'transparent', border: '1px solid #1a1d2e',
            borderRadius: 7, padding: '8px 12px', color: '#7a7f9a',
            fontSize: 12, cursor: 'pointer',
          }}>✕</button>
        )}
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Señal IA */}
        <div style={{
          background: '#04050a', border: '1px solid #1a1d2e',
          borderRadius: 8, padding: 16,
          borderLeft: '3px solid #378ADD',
        }}>
          <div style={{ fontSize: 10, color: '#378ADD', fontFamily: 'monospace', marginBottom: 8, letterSpacing: 1 }}>
            SIGMA TRADER IA
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#e8e9f0', lineHeight: 1.6 }}>
            {report.sigmaIASignal}
          </p>
        </div>

        {/* Resumen */}
        <div>
          <div style={{ fontSize: 10, color: '#7a7f9a', fontFamily: 'monospace', marginBottom: 10, letterSpacing: 1 }}>
            RESUMEN EJECUTIVO
          </div>
          <p style={{
            margin: 0, fontSize: 12, color: '#e8e9f0',
            lineHeight: 1.7, whiteSpace: 'pre-wrap',
          }}>
            {report.summary}
          </p>
        </div>

        {/* Score flujo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#04050a', borderRadius: 8, border: '1px solid #1a1d2e' }}>
          <div style={{ fontSize: 10, color: '#7a7f9a', fontFamily: 'monospace', minWidth: 120 }}>SCORE FLUJO GLOBAL</div>
          <div style={{
            fontSize: 28, fontFamily: "'Bebas Neue', Impact, sans-serif",
            color: report.flowScore > 60 ? '#1D9E75' : report.flowScore < 40 ? '#f87171' : '#d4af37',
          }}>
            {report.flowScore}/100
          </div>
        </div>

        {/* Top 5 movimientos */}
        <div>
          <div style={{ fontSize: 10, color: '#7a7f9a', fontFamily: 'monospace', marginBottom: 12, letterSpacing: 1 }}>
            TOP 5 MOVIMIENTOS RECOMENDADOS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {report.topMoves.map((m, i) => (
              <div key={i} style={{
                background: '#04050a', border: '1px solid #1a1d2e',
                borderLeft: `3px solid ${SIGNAL_COLOR[m.action]}`,
                borderRadius: 8, padding: '12px 14px',
                display: 'flex', gap: 12, alignItems: 'flex-start',
              }}>
                <div style={{
                  fontSize: 16, fontFamily: "'Bebas Neue', Impact, sans-serif",
                  color: '#3a3f55', minWidth: 20,
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14 }}>{CLASS_ICON[m.assetClass]}</span>
                    <span style={{ fontSize: 13, color: '#e8e9f0', fontWeight: 600 }}>{m.asset}</span>
                    <span style={{
                      fontSize: 10, color: SIGNAL_COLOR[m.action],
                      background: SIGNAL_COLOR[m.action] + '1a',
                      borderRadius: 4, padding: '2px 7px', fontFamily: 'monospace', fontWeight: 700,
                    }}>
                      {SIGNAL_ES[m.action]}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#7a7f9a', lineHeight: 1.5 }}>{m.reason}</p>
                  <div style={{ marginTop: 6, fontSize: 10, color: '#3a3f55', fontFamily: 'monospace' }}>
                    Score: {m.score}/100 · Ret. 1A: {m.return1y > 0 ? '+' : ''}{m.return1y.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Flujo por mercado */}
        <div>
          <div style={{ fontSize: 10, color: '#7a7f9a', fontFamily: 'monospace', marginBottom: 10, letterSpacing: 1 }}>
            FLUJO DE CAPITAL POR MERCADO
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {report.flowSignals.map(fs => (
              <div key={fs.market} style={{
                background: '#04050a', border: `1px solid ${fs.color}33`,
                borderRadius: 8, padding: '10px 14px', flex: '1 1 160px',
              }}>
                <div style={{ fontSize: 11, color: fs.color, fontFamily: 'monospace', marginBottom: 4 }}>{fs.market}</div>
                <div style={{ fontSize: 10, color: '#7a7f9a', fontFamily: 'monospace' }}>
                  {fs.trend === 'entrando' ? '▲' : fs.trend === 'saliendo' ? '▼' : '→'}{' '}
                  {fs.inflow.toFixed(0)}% / {fs.outflow.toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <p style={{ margin: 0, fontSize: 10, color: '#3a3f55', fontFamily: 'monospace', lineHeight: 1.6 }}>
          Sigma Capital Club. Este reporte es generado automáticamente por el Motor de Decisión y no constituye asesoría de inversión regulada.
          Los datos de fondos mutuos y ETFs provienen de la base de datos de Sigma. Retornos pasados no garantizan resultados futuros.
        </p>
      </div>
    </div>
  )
}
