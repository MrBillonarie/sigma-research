'use client'
import { useState } from 'react'

const GOLD: [number, number, number]    = [212, 175, 55]
const TEXT: [number, number, number]    = [225, 225, 232]
const DIM: [number, number, number]     = [122, 127, 154]
const BG: [number, number, number]      = [4, 5, 10]
const BORDER: [number, number, number]  = [26, 29, 46]

const SECTIONS: { title: string; body: string[]; list?: string[] }[] = [
  {
    title: '01 · RESUMEN EJECUTIVO',
    body: [
      'SIGMA es un motor de trading cuantitativo multi-activo construido y operado por un grupo pequeño de traders profesionales junto a un equipo de agentes de IA que cubren investigación, ejecución, riesgo e infraestructura. No es un bot de señales ni un indicador: es un sistema completo de generación, validación y ejecución de estrategias, con capital real desde el 17 de junio de 2026.',
      'La mayoría de los traders retail no pierde por falta de buenas ideas, sino por ausencia de proceso. SIGMA reemplaza la discrecionalidad por un proceso sistemático, auditable y con gates explícitos antes de arriesgar capital.',
      'La misión de fondo es la autocustodia: cada ciclo de ganancias está diseñado para eventualmente retirarse a cold storage. Not your keys, not your coins.',
    ],
  },
  {
    title: '02 · EL PROBLEMA',
    body: ['Tres fallas estructurales explican por qué el trading discrecional retail tiende a perder dinero en el largo plazo:'],
    list: [
      'Sesgo de selección — probar cientos de variantes y quedarse con la mejor in-sample sobreestima su ventaja real fuera de muestra.',
      'Ausencia de validación fuera de muestra — sin walk-forward testing no hay forma de distinguir ventaja real de coincidencia.',
      'Gestión de riesgo discrecional — sin reglas duras de tamaño de posición y drawdown, una racha mala se convierte en pérdida de cuenta.',
    ],
  },
  {
    title: '03 · ARQUITECTURA DEL MOTOR',
    body: ['SIGMA corre dos motores en paralelo, cada uno con su propio universo de activos, pipeline de optimización y gates de riesgo.'],
    list: [
      'Motor 1 — Cripto: BTC, ETH, SOL, BNB, LTC (perpetuos USDT-M). Universo cerrado a propósito.',
      'Motor 2 — Commodities: oro (XAU), plata (XAG), WTI, cobre (HG), gas natural (NG), platino (PL).',
      'Cada slot activo/timeframe/dirección se optimiza 24/7 vía búsqueda bayesiana (Optuna).',
      'Un regime gate (EMA200 semanal) determina si el contexto favorece tendencia, reversión, o ninguna estrategia.',
    ],
  },
  {
    title: '04 · METODOLOGÍA — EL ROBUSTNESS GATE',
    body: ['Ninguna estrategia llega a producción solo por buen resultado en backtest. Antes de ser "champion" debe sobrevivir:'],
    list: [
      'Walk-forward testing fuera de muestra.',
      'Corrección de sesgo de selección (best-of-N de Optuna).',
      'Conteo de apuestas independientes vía PCA.',
      'Perturbación adversarial de slippage.',
      'Techos de sanidad — métricas imposibles se descartan como bug, no como suerte.',
      'Position sizing por fracción de Kelly, reducido a la mitad sin historial suficiente en vivo.',
    ],
  },
  {
    title: '05 · GESTIÓN DE RIESGO',
    body: [],
    list: [
      'Circuit breaker — corta operación tras pérdidas consecutivas o drawdown excesivo.',
      'Gate de correlación cross-motor entre Motor 1 y Motor 2.',
      'Funding-rate gate en perpetuos.',
      'HRP (Hierarchical Risk Parity) para distribuir capital por riesgo, no por convicción.',
      'Regla de gobernanza: el riesgo nunca se ajusta para cumplir una meta o una fecha.',
    ],
  },
  {
    title: '06 · TRACK RECORD',
    body: [
      'Paper trading: el sistema no pasa a capital real hasta cumplir, todos a la vez, ≥30 trades cerrados, ≥21 días de observación, win rate ≥55% y profit factor ≥1.5.',
      'Capital real activo desde el 17 de junio de 2026, cuenta profesional de Binance Lead Trader, $550.51 USDT iniciales. Etapa temprana — días, no años.',
      'Cifras de PnL en vivo no se publican aquí porque cambian a diario. Fuente de verdad: squantdesk.com/hud y el perfil público de Binance Lead Trader.',
    ],
  },
  {
    title: '07 · CÓMO PARTICIPAR',
    body: [
      'La única forma soportada de replicar las operaciones de SIGMA es el Copy Trading oficial de Binance, buscando al Lead Trader del proyecto dentro de la app.',
      'Recomendación operativa: configurar la copia en modalidad Fixed Ratio (%), no Fixed Amount ($) — replica el riesgo proporcional real en vez de un monto fijo desalineado.',
    ],
    list: ['Telegram', 'Discord', 'WhatsApp', 'X (Twitter)', 'LinkedIn', 'Web — squantdesk.com', 'Binance Copy Trading'],
  },
  {
    title: '08 · COMPLIANCE Y CUSTODIA',
    body: [
      'SIGMA nunca solicita ni almacena las API keys de Binance de terceros para operar en su nombre. Toda réplica pasa exclusivamente por el producto de Copy Trading regulado de Binance.',
      'Decisión de diseño: minimiza la superficie de riesgo legal y operacional, y evita custodiar secretos de terceros que no necesita custodiar.',
    ],
  },
  {
    title: '09 · ROADMAP',
    body: [
      'Validación adversarial independiente de los champions ya validados.',
      'Automatización de tesorería — cadencia y monto de retiro a cold storage.',
      'Expansión de 2 a 5 motores (cripto, commodities, acciones, LATAM, forex) bajo un meta-allocator común, en 12-18 meses.',
      'Roadmap completo y actualizado: squantdesk.com/roadmap',
    ],
  },
  {
    title: '10 · RIESGOS Y DISCLAIMERS',
    body: [],
    list: [
      'El trading de futuros y derivados conlleva riesgo real de pérdida total del capital invertido.',
      'Los resultados de backtest y paper trading no garantizan resultados futuros en capital real.',
      'El track record en capital real de SIGMA es reciente (días, no años) y debe evaluarse con ese contexto.',
      'Este documento es informativo y no constituye asesoría financiera ni una oferta de inversión.',
      'Replicar las operaciones de SIGMA vía Binance Copy Trading es responsabilidad exclusiva de cada usuario.',
    ],
  },
]

export default function DownloadWhitePaperPdf({ className = '' }: { className?: string }) {
  const [exporting, setExporting] = useState(false)

  async function handlePDF() {
    setExporting(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const W = 210
      const H = 297
      const MARGIN = 18
      let y = MARGIN

      const fillPage = () => {
        doc.setFillColor(...BG)
        doc.rect(0, 0, W, H, 'F')
      }

      const ensureSpace = (needed: number) => {
        if (y + needed > H - MARGIN) {
          doc.addPage()
          fillPage()
          y = MARGIN
        }
      }

      const line = (text: string, size = 10, color: [number, number, number] = TEXT, bold = false) => {
        doc.setFontSize(size)
        doc.setFont('helvetica', bold ? 'bold' : 'normal')
        const lines = doc.splitTextToSize(text, W - MARGIN * 2) as string[]
        ensureSpace(lines.length * (size * 0.45) + 2)
        doc.setTextColor(...color)
        doc.text(lines, MARGIN, y)
        y += lines.length * (size * 0.45) + 2
      }

      const divider = () => {
        ensureSpace(6)
        doc.setDrawColor(...BORDER)
        doc.line(MARGIN, y, W - MARGIN, y)
        y += 5
      }

      const nl = (n = 4) => { y += n }

      fillPage()

      // Cover
      doc.setFillColor(11, 13, 20)
      doc.rect(0, 0, W, 50, 'F')
      line('SIGMA ENGINE', 26, GOLD, true)
      nl(1)
      line('WHITE PAPER', 14, TEXT, true)
      nl(2)
      line('Versión 1.0 — Junio 2026 · squantdesk.com', 9, DIM)
      y = 60
      divider()
      nl(2)

      SECTIONS.forEach(s => {
        ensureSpace(14)
        line(s.title, 13, GOLD, true)
        nl(2)
        s.body.forEach(p => { line(p, 9.5, TEXT); nl(2) })
        if (s.list) {
          s.list.forEach(item => { line(`—  ${item}`, 9, DIM); nl(1) })
        }
        nl(4)
        divider()
        nl(4)
      })

      ensureSpace(14)
      line('© SIGMA Engine — squantdesk.com', 8, DIM)
      line('Este documento es informativo y no constituye asesoría financiera ni una oferta de inversión.', 8, DIM)

      doc.save(`sigma-white-paper-v1.0.pdf`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      onClick={handlePDF}
      disabled={exporting}
      className={
        className ||
        'border border-gold/30 text-text-dim section-label px-6 py-2.5 hover:border-gold hover:text-gold transition-colors duration-200 text-center text-xs disabled:opacity-50'
      }
    >
      {exporting ? 'GENERANDO…' : '↓ DESCARGAR PDF'}
    </button>
  )
}
