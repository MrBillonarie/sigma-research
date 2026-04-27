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
      const doc   = new jsPDF({ unit: 'mm', format: 'a4' })
      const W     = 210
      const MARGIN = 18
      let y        = MARGIN

      const line  = (text: string, size = 10, color: [number,number,number] = [200,200,210], bold = false) => {
        doc.setFontSize(size)
        doc.setFont('helvetica', bold ? 'bold' : 'normal')
        doc.setTextColor(...color)
        const lines = doc.splitTextToSize(text, W - MARGIN * 2)
        doc.text(lines, MARGIN, y)
        y += lines.length * (size * 0.45) + 2
      }

      const divider = () => {
        doc.setDrawColor(30, 33, 50)
        doc.line(MARGIN, y, W - MARGIN, y)
        y += 5
      }

      const nl = (n = 4) => { y += n }

      // Fondo
      doc.setFillColor(4, 5, 10)
      doc.rect(0, 0, W, 297, 'F')

      // Header
      doc.setFillColor(11, 13, 20)
      doc.rect(0, 0, W, 36, 'F')
      line('SIGMA CAPITAL CLUB', 20, [29, 158, 117], true)
      line('MOTOR DE DECISIÓN FINANCIERA — REPORTE SEMANAL', 8, [122, 127, 154])
      nl(2)
      line(`Generado: ${formatDateES(report.generatedAt)}`, 8, [122, 127, 154])
      line(`Perfil: ${report.profile.label.toUpperCase()} | Horizonte: ${report.profile.horizonte}`, 8, [200, 200, 210])
      nl(4)
      divider()

      // Sigma IA Signal
      line('SEÑAL SIGMA TRADER IA', 11, [55, 138, 221], true)
      nl(2)
      line(report.sigmaIASignal.replace(/[🟢🔴🟡]/g, '').trim(), 10, [200, 200, 210])
      nl(4); divider()

      // Resumen
      line('RESUMEN EJECUTIVO', 11, [29, 158, 117], true)
      nl(2)
      line(report.summary, 9, [180, 180, 190])
      nl(4); divider()

      // Asignación
      line('ASIGNACIÓN ÓPTIMA', 11, [212, 175, 55], true)
      nl(2)
      const alloc = report.allocation
      ;[
        ['Fondos Mutuos', alloc.fondos],
        ['ETFs Globales', alloc.etfs],
        ['Renta Fija',    alloc.renta_fija],
        ['Crypto',        alloc.crypto],
      ].forEach(([label, val]) => {
        line(`${label}: ${val}%`, 10, [200, 200, 210])
        nl(1)
      })
      nl(2)
      line(`Retorno esperado: ${report.metrics.expectedReturn.toFixed(1)}%  |  Volatilidad: ${report.metrics.annualVolatility.toFixed(1)}%  |  Sharpe: ${report.metrics.sharpeRatio.toFixed(2)}`, 9, [122, 127, 154])
      nl(4); divider()

      // Top 5 movimientos
      line('TOP 5 MOVIMIENTOS RECOMENDADOS', 11, [167, 139, 250], true)
      nl(2)
      report.topMoves.forEach((m, i) => {
        const sigColor: [number,number,number] = m.action === 'comprar' ? [29,158,117] : m.action === 'reducir' ? [248,113,113] : [212,175,55]
        line(`${i + 1}. ${SIGNAL_ES[m.action]} — ${m.asset}`, 10, sigColor, true)
        line(m.reason, 9, [160, 160, 170])
        line(`Score: ${m.score}/100 | Ret. 1A: ${m.return1y > 0 ? '+' : ''}${m.return1y.toFixed(1)}%`, 8, [122, 127, 154])
        nl(3)
      })
      divider()

      // Score global
      line('SCORE FLUJO DE CAPITAL CROSS-MARKET', 11, [55, 138, 221], true)
      nl(2)
      const fc = report.flowScore
      const fcColor: [number,number,number] = fc > 60 ? [29,158,117] : fc > 40 ? [212,175,55] : [248,113,113]
      line(`${fc}/100 — ${fc > 60 ? 'BULL market: flujo positivo de capital' : fc < 40 ? 'BEAR market: salida de capital' : 'Mercado NEUTRO: señales mixtas'}`, 11, fcColor, true)
      nl(2)
      report.flowSignals.forEach(fs => {
        const trend = fs.trend === 'entrando' ? '↑' : fs.trend === 'saliendo' ? '↓' : '→'
        line(`${trend} ${fs.market}: ${fs.inflow.toFixed(0)}% inflow / ${fs.outflow.toFixed(0)}% outflow`, 9, [160, 160, 170])
        nl(1)
      })

      nl(6)
      line('© Sigma Capital Club — Documento confidencial para uso interno.', 8, [60, 65, 85])
      line('Este reporte no constituye asesoría de inversión regulada.', 8, [60, 65, 85])

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
