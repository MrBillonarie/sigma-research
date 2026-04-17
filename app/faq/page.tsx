'use client'
import { useState } from 'react'
import Link from 'next/link'

const faqs = [
  {
    category: 'PLATAFORMA',
    items: [
      {
        q: '¿Qué es Sigma Research?',
        a: 'Sigma Research es una plataforma de análisis cuantitativo que pone al alcance de inversores independientes herramientas de grado institucional: modelos de régimen de mercado, forecasting de volatilidad, screeners con señales ML y la calculadora FIRE.',
      },
      {
        q: '¿Es necesario tener conocimientos de programación?',
        a: 'No. La plataforma está diseñada para ser usada directamente desde el navegador. Los modelos corren en nuestra infraestructura y los resultados se presentan en dashboards listos para interpretar. Si quieres acceso API para integrar en tu propio código, está disponible en el plan Institutional.',
      },
      {
        q: '¿Con qué mercados y activos trabaja Sigma Research?',
        a: 'Actualmente cubrimos renta variable estadounidense (S&P 500, Russell 1000, Nasdaq 100), ETFs sectoriales y principales pares de divisas. La cobertura de cripto y renta fija está en roadmap para Q3 2025.',
      },
    ],
  },
  {
    category: 'MODELOS Y SEÑALES',
    items: [
      {
        q: '¿Cómo se validan los modelos?',
        a: 'Todos los modelos pasan por walk-forward out-of-sample testing con ventanas de entrenamiento y validación estrictamente separadas. Publicamos las métricas completas (accuracy, Sharpe OOS, MAE) y los periodos de backtest en la documentación de cada modelo.',
      },
      {
        q: '¿Las señales garantizan rentabilidad?',
        a: 'No. Ninguna señal cuantitativa garantiza resultados futuros. Los modelos estadísticos tienen edge probabilístico, no certeza. Sigma Research provee herramientas analíticas; la decisión de inversión y la gestión del riesgo son siempre responsabilidad del usuario.',
      },
      {
        q: '¿Con qué frecuencia se actualizan las señales?',
        a: 'Depende del modelo. El Regime Detector y el Macro Regime se actualizan diariamente al cierre de mercado. El Momentum Score se recalcula semanalmente. El Vol Forecaster emite predicciones a 1, 5 y 30 días en tiempo real durante la sesión.',
      },
    ],
  },
  {
    category: 'PLANES Y PRECIOS',
    items: [
      {
        q: '¿Existe un plan gratuito?',
        a: 'Sí. El plan Terminal es completamente gratuito e incluye el screener con 12 filtros, datos diferidos 15 min, la calculadora FIRE básica y hasta 3 alertas diarias. No se requiere tarjeta de crédito para registrarse.',
      },
      {
        q: '¿Puedo cancelar mi suscripción en cualquier momento?',
        a: 'Sí. Las suscripciones Pro son mensuales y se pueden cancelar en cualquier momento desde el panel de cuenta. No hay penalizaciones ni periodos mínimos de permanencia.',
      },
      {
        q: '¿Ofrecéis descuentos para equipos o universidades?',
        a: 'Sí. Contamos con precios especiales para equipos de más de 3 personas, departamentos de finanzas universitarios y programas de investigación. Escríbenos a contacto@sigma-research.io para más detalles.',
      },
    ],
  },
  {
    category: 'DATOS Y PRIVACIDAD',
    items: [
      {
        q: '¿De dónde provienen los datos de mercado?',
        a: 'Trabajamos con proveedores de datos institucionales de primer nivel. Los datos históricos cubren 25+ años para la mayoría de activos. No utilizamos datos sintéticos ni proxies.',
      },
      {
        q: '¿Cómo protegéis mis datos personales?',
        a: 'Almacenamos únicamente los datos necesarios para la operación del servicio (email, preferencias, historial de alertas). No vendemos datos a terceros. Puedes solicitar la eliminación de tu cuenta y todos tus datos en cualquier momento. Consulta nuestra Política de Privacidad para los detalles completos.',
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
            Todo lo que necesitas saber sobre la plataforma, los modelos y los planes de acceso.
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
            Si no encontraste lo que buscabas, escríbenos directamente.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/registro"
              className="bg-gold text-bg section-label px-8 py-3 hover:bg-gold-glow transition-colors duration-200"
            >
              CREAR CUENTA
            </Link>
            <a
              href="mailto:contacto@sigma-research.io"
              className="border border-border text-text-dim section-label px-8 py-3 hover:border-gold hover:text-gold transition-colors duration-200"
            >
              CONTACTAR
            </a>
          </div>
        </div>
      </section>

    </main>
  )
}
