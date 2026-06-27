'use client'
import { useState } from 'react'
import Link from 'next/link'

const faqs = [
  {
    category: 'PLATAFORMA',
    items: [
      {
        q: '¿Qué es SQuant Desk?',
        a: 'SQuant Desk es una plataforma de análisis cuantitativo especializada en cripto-futuros (Binance Futures). El núcleo es el SIGMA ENGINE: un motor de trading cuantitativo que corre 24/7 con 70+ estrategias optimizadas sobre BTC, ETH, SOL, BNB, LTC y XAU. Incluye backtesting real, paper trading en vivo, dashboard de monitoreo y señales validadas.',
      },
      {
        q: '¿Es necesario tener conocimientos de programación?',
        a: 'No. La plataforma está diseñada para ser usada directamente desde el navegador. Los modelos corren en nuestra infraestructura VPS y los resultados se presentan en dashboards listos para interpretar. Si quieres acceso API para integrar en tu propio código, está disponible en el plan Institutional.',
      },
      {
        q: '¿Con qué mercados y activos trabaja SQuant Desk?',
        a: 'El universo está cerrado en 6 activos sobre Binance Futures: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, LTC/USDT y XAU/USD. Esta decisión es intencional — más activos diluyen la optimización. Múltiples timeframes: 5m, 15m, 1h, 4h y 1d.',
      },
      {
        q: '¿En qué se diferencia de otras plataformas de señales cripto?',
        a: 'La diferencia clave es el rigor estadístico. Cada modelo pasa por walk-forward out-of-sample testing, robustness gates (multi-seed, multi-periodo) y Kelly sizing adaptativo antes de entrar a paper trading. No mostramos el mejor backtest posible — mostramos el resultado honesto con comisiones y slippage real.',
      },
    ],
  },
  {
    category: 'MODELOS Y SEÑALES',
    items: [
      {
        q: '¿Cómo se validan los modelos del SIGMA ENGINE?',
        a: 'Todos los modelos pasan por un pipeline de 3 capas: (1) Backtest con Optuna Bayesian Search sobre datos históricos, (2) Walk-Forward OOS testing con ventanas de entrenamiento y validación estrictamente separadas, (3) Robustness Gate que verifica que el modelo funcione en múltiples seeds y periodos de mercado diferentes. Solo los modelos que pasan los 3 filtros entran a paper trading.',
      },
      {
        q: '¿Las señales garantizan rentabilidad?',
        a: 'No. Ninguna señal cuantitativa garantiza resultados futuros. Los modelos tienen edge estadístico en backtesting y paper trading, pero el mercado puede cambiar. SQuant Desk provee herramientas de análisis; la decisión de inversión y la gestión del riesgo son siempre responsabilidad del usuario.',
      },
      {
        q: '¿Con qué frecuencia se actualizan los modelos?',
        a: 'El motor corre 24/7 evaluando señales en cada cierre de vela (5m, 15m, 1h, 4h, 1d). Los modelos champions se re-optimizan periódicamente con Optuna Bayesian Search. El dashboard se actualiza en tiempo real y las señales activas se notifican vía Telegram y Discord.',
      },
      {
        q: '¿Qué es el paper trading y por qué no ejecutan live todavía?',
        a: 'El paper trading simula ejecuciones reales (con entry/SL/TP) sin poner capital real en riesgo. Antes de activar ejecución real en Binance requerimos un mínimo de 30 trades en paper trading con win rate y PF verificados en condiciones de mercado live. Esta barrera protege el capital real de modelos que podrían tener overfitting.',
      },
    ],
  },
  {
    category: 'PLANES Y PRECIOS',
    items: [
      {
        q: '¿Existe un plan gratuito?',
        a: 'Sí. El plan Terminal es completamente gratuito e incluye el dashboard de portfolio, el journal de trades, la calculadora FIRE básica y el calendario macro. No se requiere tarjeta de crédito para registrarse.',
      },
      {
        q: '¿Qué incluye el plan PRO?',
        a: 'El plan PRO ($29/mes USD) agrega: acceso completo a los modelos ML y champions del SIGMA ENGINE, señales en vivo BTC/ETH/SOL/BNB/XAU, motor de decisión cross-market (ETFs + fondos + cripto), Monte Carlo avanzado, LP DeFi cuantitativo, reporte mensual PDF y soporte prioritario.',
      },
      {
        q: '¿Puedo cancelar mi suscripción en cualquier momento?',
        a: 'Sí. Las suscripciones son mensuales y se pueden cancelar en cualquier momento desde el panel de cuenta. No hay penalizaciones ni periodos mínimos de permanencia.',
      },
    ],
  },
  {
    category: 'DATOS Y PRIVACIDAD',
    items: [
      {
        q: '¿De dónde provienen los datos del SIGMA ENGINE?',
        a: 'Los datos de mercado vienen directamente de Binance (precios OHLCV, open interest, long/short ratio) y Yahoo Finance (ETFs, índices, materias primas). Los backtests usan datos históricos reales con hasta 3+ años de historia según el activo y timeframe.',
      },
      {
        q: '¿Cómo protegen mis datos personales?',
        a: 'Almacenamos únicamente los datos necesarios para la operación del servicio (email, preferencias, historial de alertas). No vendemos datos a terceros. Puedes solicitar la eliminación de tu cuenta y todos tus datos en cualquier momento desde el panel de perfil.',
      },
      {
        q: '¿Dónde corre la infraestructura del motor?',
        a: 'El SIGMA ENGINE corre en un VPS dedicado con monitoreo 24/7. El motor de optimización puede completar 89,000+ trials por hora con hasta 10 procesos paralelos. El dashboard de estado está disponible en tiempo real para usuarios PRO.',
      },
    ],
  },
]

export default function FaqPage() {
  const [open, setOpen] = useState<string | null>(null)

  const toggle = (key: string) => setOpen(prev => prev === key ? null : key)

  return (
    <main className="bg-bg min-h-screen">

      {/* Hero */}
      <section className="pt-40 pb-24 px-6 bg-grid-pattern bg-grid relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <div className="section-label text-gold mb-6">{'// SOPORTE'}</div>
          <h1 className="display-heading text-6xl sm:text-8xl lg:text-[9rem] text-text leading-none mb-8">
            PREGUNTAS
            <br />
            <span className="gold-text">FRECUENTES</span>
          </h1>
          <p className="terminal-text text-text-dim text-sm leading-relaxed max-w-xl">
            Todo lo que necesitas saber sobre la plataforma, el SIGMA ENGINE y los planes de acceso.
          </p>
        </div>
      </section>

      {/* FAQ accordion */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-16">
          {faqs.map((group) => (
            <div key={group.category}>
              <div className="section-label text-gold mb-6">{group.category}</div>
              <div className="flex flex-col gap-px bg-border">
                {group.items.map((item, i) => {
                  const key = `${group.category}-${i}`
                  const isOpen = open === key
                  return (
                    <div key={key} className="bg-surface">
                      <button
                        className="w-full flex items-center justify-between px-6 py-5 text-left gap-4"
                        onClick={() => toggle(key)}
                      >
                        <span className={`terminal-text text-sm leading-snug transition-colors ${isOpen ? 'text-gold' : 'text-text'}`}>
                          {item.q}
                        </span>
                        <svg
                          className={`w-4 h-4 flex-shrink-0 text-gold transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isOpen && (
                        <div className="px-6 pb-5 border-t border-border">
                          <p className="terminal-text text-sm text-text-dim leading-relaxed pt-4">{item.a}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 border-t border-border">
        <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-6">
          <div className="section-label text-gold">{'// ¿TIENES MÁS PREGUNTAS?'}</div>
          <p className="terminal-text text-text-dim">
            Únete a la comunidad o escríbenos directamente.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/registro" className="bg-gold text-bg section-label px-8 py-3 hover:bg-gold-glow transition-colors duration-200">
              CREAR CUENTA
            </Link>
            <Link href="/contacto" className="border border-border text-text-dim section-label px-8 py-3 hover:border-gold hover:text-gold transition-colors duration-200">
              CONTACTAR
            </Link>
          </div>
        </div>
      </section>

    </main>
  )
}
