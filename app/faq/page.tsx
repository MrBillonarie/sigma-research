'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'

// ─── Data ─────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: 'plataforma',
    label: 'PLATAFORMA',
    icon: '◈',
    items: [
      {
        q: '¿Qué es Sigma Research?',
        a: 'Sigma Research es una plataforma de análisis cuantitativo para inversores independientes. Integra modelos de régimen de mercado (HMM), forecasting de volatilidad (GARCH), señales ML, journal de trades, calculadora FIRE e independencia financiera, comparadores de instrumentos chilenos y simulador Monte Carlo — todo en un único dashboard.',
      },
      {
        q: '¿Qué herramientas incluye la plataforma?',
        a: 'El dashboard incluye: HUD de señales en vivo, Journal de trades con importación CSV de Binance Futures, Portafolio consolidado (IBKR, Binance Spot/Futures, Fintual, Santander, Cash), calculadora FIRE, simulador Monte Carlo, Diagnosticador de riesgo, Motor de decisión cuantitativo, comparadores de ETFs / Fondos Mutuos / Renta Fija, tracker de LP DeFi, calculadora de impuestos chilenos (IGC) e Ingresos Pasivos.',
      },
      {
        q: '¿Es necesario saber programar?',
        a: 'No. Toda la plataforma opera desde el navegador sin necesidad de código. Los modelos corren en nuestra infraestructura y los resultados se presentan en dashboards listos para leer e interpretar.',
      },
      {
        q: '¿Con qué mercados y activos trabaja Sigma Research?',
        a: 'Cubrimos múltiples clases de activos: criptomonedas (BTC, ETH, SOL, BNB, AVAX, ARB y más vía Binance), renta variable global (S&P 500, Nasdaq, ETFs sectoriales), renta fija chilena (DAP, BCP, BCU), fondos mutuos (integración CMF/Fintual), Liquidity Pools DeFi (Uniswap v3, PancakeSwap v3) y pares forex.',
      },
      {
        q: '¿En qué se diferencia Sigma Research de otras plataformas?',
        a: 'A diferencia de plataformas generalistas, Sigma Research está construido específicamente para traders e inversores activos que también planifican su independencia financiera. Combina análisis cuantitativo de grado institucional con herramientas de planificación personal (FIRE, Monte Carlo, Tax) y gestión de portafolio multi-plataforma, todo sincronizado entre secciones.',
      },
    ],
  },
  {
    id: 'journal',
    label: 'JOURNAL & TRADES',
    icon: '≡',
    items: [
      {
        q: '¿Cómo importo mis trades de Binance Futures?',
        a: 'En la sección Journal, haz clic en "SELECCIONAR CSV" y sube el archivo exportado desde Binance Futures (Transaction History → Realized PNL → Export). El parser reconstruye automáticamente cada trade agrupando los eventos de PNL realizados por par, calculando entry, exit, tamaño y resultado.',
      },
      {
        q: '¿Puedo registrar trades manuales además de los de Binance?',
        a: 'Sí. El formulario de entrada manual acepta trades de cualquier exchange o activo: par, lado (LONG/SHORT), precio de entrada, precio de salida, tamaño en USD, stop-loss, take-profit y notas. Los trades manuales se guardan en Supabase y son equivalentes a los importados por CSV para todos los análisis.',
      },
      {
        q: '¿Qué métricas calcula el Journal?',
        a: 'Win Rate, P&L total, mejor y peor trade, tamaño promedio, Profit Factor, Sharpe aproximado (desde PnL diario × √252), Max Drawdown acumulado y Win Streak actual. Estos datos se sincronizan automáticamente con el Hero de la landing, la sección Perfil y el Diagnosticador.',
      },
      {
        q: '¿Puedo exportar mi historial de trades?',
        a: 'Sí, en dos formatos. "↓ CSV" descarga todos los trades en formato tabla compatible con Excel. "↓ PDF REPORT" genera un reporte A4 con header Sigma, grid de 6 KPIs coloreados y tabla de los últimos 20 trades con colores WIN/LOSS, listo para compartir o archivar.',
      },
    ],
  },
  {
    id: 'binance',
    label: 'BINANCE & API KEYS',
    icon: '⬡',
    items: [
      {
        q: '¿Por qué necesita la plataforma mis API keys de Binance?',
        a: 'Las API keys son opcionales y se usan para mostrar en tiempo real tus posiciones abiertas de Futures y balances de Spot en la sección Portafolio. Sin ellas, el portafolio funciona igualmente con valores ingresados manualmente.',
      },
      {
        q: '¿Qué permisos debo activar en mis API keys de Binance?',
        a: 'Solo permisos de lectura: "Enable Reading" para Spot y "Enable Futures" para ver posiciones de Futuros. Nunca actives "Enable Withdrawals" ni "Enable Spot & Margin Trading". Recomendamos además restringir las keys a la IP del servidor para mayor seguridad.',
      },
      {
        q: '¿Cómo se almacenan mis API keys?',
        a: 'Las API keys se almacenan cifradas en Supabase bajo tu user_id con Row Level Security activado — ningún otro usuario puede acceder a ellas. Las claves nunca se exponen en el frontend ni en logs del servidor. La firma de cada request a Binance ocurre exclusivamente en el servidor.',
      },
      {
        q: '¿Puedo usar la plataforma sin conectar Binance?',
        a: 'Completamente. La mayoría de las herramientas (Journal manual, FIRE, Monte Carlo, Comparadores, Tax, Motor de Decisión) funcionan de forma independiente sin ninguna API key de Binance.',
      },
    ],
  },
  {
    id: 'modelos',
    label: 'MODELOS & SEÑALES',
    icon: '⬟',
    items: [
      {
        q: '¿Cómo se validan los modelos?',
        a: 'Todos los modelos pasan por walk-forward out-of-sample testing con ventanas de entrenamiento y validación estrictamente separadas. Publicamos las métricas completas (accuracy, Sharpe OOS, MAE) y los periodos de backtest en la documentación de cada modelo dentro de la sección Modelos.',
      },
      {
        q: '¿Las señales garantizan rentabilidad?',
        a: 'No. Ninguna señal cuantitativa garantiza resultados futuros. Los modelos estadísticos tienen edge probabilístico, no certeza. Sigma Research provee herramientas analíticas; la decisión de inversión y la gestión del riesgo son siempre responsabilidad del usuario.',
      },
      {
        q: '¿Con qué frecuencia se actualizan las señales?',
        a: 'El HMM-01 (Regime Detector) y el GARCH-02 (Vol Forecaster) se recalculan diariamente al cierre del mercado americano. El XGB-03 (Momentum Score) se actualiza intraday cada 4 horas. El Motor de Decisión completo se refresca automáticamente cada 30 minutos desde el dashboard.',
      },
      {
        q: '¿Qué es el Motor de Decisión?',
        a: 'El Motor de Decisión es el engine cuantitativo principal de Sigma. Analiza retornos históricos de cripto (Binance), ETFs y renta fija (Yahoo Finance), detecta el régimen de mercado actual (LATERAL / TRENDING / VOLATILE) y genera una asignación de portafolio optimizada para tres perfiles: Retail, Trader e Institucional.',
      },
    ],
  },
  {
    id: 'fire',
    label: 'FIRE & MONTECARLO',
    icon: '🔥',
    items: [
      {
        q: '¿Qué es la calculadora FIRE?',
        a: 'FIRE (Financial Independence, Retire Early) es una metodología basada en la Regla del 4%: si acumulas 25 veces tus gastos anuales, puedes retirarte viviendo de las ganancias del portafolio. La calculadora de Sigma tiene tres modos: Lean FIRE (gastos mínimos), Barista FIRE (trabajo parcial) y Fat FIRE (holgura total), con proyección de años para alcanzar la meta según tu capital actual, ahorro mensual y retorno estimado.',
      },
      {
        q: '¿Qué hace el simulador Monte Carlo?',
        a: 'El simulador genera 2000 trayectorias de patrimonio posibles usando Movimiento Browniano Geométrico (GBM). Puedes ingresar parámetros manualmente o subir tu historial CSV de Binance para usar tus métricas reales (retorno promedio y volatilidad diaria). El resultado muestra los percentiles P10/P50/P90 y la probabilidad de alcanzar tu objetivo FIRE en el horizonte elegido.',
      },
      {
        q: '¿El simulador Monte Carlo considera inflación?',
        a: 'Los parámetros de retorno son nominales por defecto. Para usar retornos reales (ajustados por inflación), simplemente resta la inflación esperada de tu retorno anual antes de ingresarlo. Por ejemplo, si esperas 8% nominal y 4% de inflación, ingresa 4% como retorno.',
      },
    ],
  },
  {
    id: 'datos',
    label: 'DATOS & PRIVACIDAD',
    icon: '⬡',
    items: [
      {
        q: '¿De dónde provienen los datos de mercado?',
        a: 'Usamos múltiples fuentes: Binance (precios de cripto en tiempo real vía WebSocket y REST), Yahoo Finance (ETFs, acciones, divisas), CMF Chile (fondos mutuos), BCCh (tasas de política monetaria y BCP/BCU), Stooq (TRM CLP/USD de respaldo). Los datos históricos cubren desde 2 años para crypto hasta 25+ años para renta variable.',
      },
      {
        q: '¿Cómo protegen mis datos personales?',
        a: 'Almacenamos únicamente los datos necesarios para operar el servicio. Toda la base de datos corre sobre Supabase con Row Level Security (RLS) activado — cada usuario solo puede ver y modificar sus propios datos. No vendemos información a terceros. Puedes solicitar la eliminación completa de tu cuenta y datos en cualquier momento desde la sección Perfil.',
      },
      {
        q: '¿Mis datos de trades y portafolio son privados?',
        a: 'Sí. Tus trades, portafolio, API keys y configuración FIRE son completamente privados. El único contenido que puede ser público son los Setups que eliges publicar voluntariamente en la comunidad desde la sección Perfil — y puedes eliminarlos cuando quieras.',
      },
    ],
  },
  {
    id: 'acceso',
    label: 'ACCESO & CUENTA',
    icon: '◎',
    items: [
      {
        q: '¿El acceso al dashboard es gratuito?',
        a: 'Sí. El dashboard completo — Journal, Portafolio, FIRE, Monte Carlo, Motor de Decisión, Comparadores, HUD, Diagnosticador y todas las herramientas — es de acceso libre para usuarios registrados. No se requiere tarjeta de crédito para crear una cuenta.',
      },
      {
        q: '¿Qué son los Reportes y cómo los obtengo?',
        a: 'Los Reportes son análisis semanales/mensuales curados por el equipo de Sigma: resumen de mercado, señales activas, performance de modelos, análisis cuantitativo y actualización FIRE. Se distribuyen en PDF de alta calidad. Puedes ver los planes disponibles en la sección Reportes.',
      },
      {
        q: '¿Puedo usar la plataforma desde el celular?',
        a: 'Sí. El dashboard tiene navegación mobile con barra inferior (HOME / HUD / CARTERA / JOURNAL / FIRE) y todas las secciones están optimizadas para pantallas pequeñas. Para análisis complejos como Montecarlo o comparadores, recomendamos usar desktop para mejor experiencia.',
      },
      {
        q: '¿Cómo contacto al soporte?',
        a: 'Puedes escribirnos a contacto@sigma-research.io o usar el formulario en la sección Contacto. Respondemos dentro de las 24–48 horas hábiles. Para bugs críticos, puedes reportarlos directamente y los atendemos con mayor prioridad.',
      },
    ],
  },
]

const ALL_ITEMS = CATEGORIES.flatMap(c => c.items.map(item => ({ ...item, category: c.id, categoryLabel: c.label })))

// ─── Components ───────────────────────────────────────────────────────────────
function AccordionItem({ q, a, isOpen, onToggle }: {
  q: string; a: string; id: string; isOpen: boolean; onToggle: () => void
}) {
  return (
    <div style={{ borderBottom: '1px solid #1a1d2e' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', gap: 20,
          padding: '20px 24px', textAlign: 'left', background: 'none', border: 'none',
          cursor: 'pointer',
        }}
      >
        <span style={{
          fontFamily: 'var(--font-dm-mono, monospace)', fontSize: 13, lineHeight: 1.5,
          color: isOpen ? '#d4af37' : '#e8e9f0',
          transition: 'color 0.2s',
          flex: 1,
        }}>
          {q}
        </span>
        <span style={{
          flexShrink: 0, width: 22, height: 22,
          border: `1px solid ${isOpen ? '#d4af37' : '#2a2d3e'}`,
          borderRadius: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isOpen ? '#d4af37' : '#5a5f7a',
          fontFamily: 'monospace', fontSize: 16, lineHeight: 1,
          transition: 'border-color 0.2s, color 0.2s',
          marginTop: 2,
        }}>
          {isOpen ? '−' : '+'}
        </span>
      </button>
      <div style={{
        overflow: 'hidden',
        maxHeight: isOpen ? 600 : 0,
        transition: 'max-height 0.3s ease',
      }}>
        <div style={{ padding: '0 24px 20px' }}>
          <div style={{ width: 32, height: 1, background: '#d4af37', marginBottom: 14, opacity: 0.5 }} />
          <p style={{
            fontFamily: 'var(--font-dm-mono, monospace)', fontSize: 12,
            color: '#7a7f9a', lineHeight: 1.8, margin: 0,
          }}>
            {a}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FaqPage() {
  const [open,       setOpen]       = useState<string | null>(null)
  const [search,     setSearch]     = useState('')
  const [activeTab,  setActiveTab]  = useState<string>('all')

  const toggle = (key: string) => setOpen(prev => prev === key ? null : key)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const items = activeTab === 'all'
      ? ALL_ITEMS
      : ALL_ITEMS.filter(i => i.category === activeTab)
    if (!q) return items
    return items.filter(i => i.q.toLowerCase().includes(q) || i.a.toLowerCase().includes(q))
  }, [search, activeTab])

  const totalQ = ALL_ITEMS.length

  return (
    <main style={{ background: '#04050a', minHeight: '100vh', color: '#e8e9f0' }}>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section style={{
        paddingTop: 160, paddingBottom: 96, paddingLeft: 24, paddingRight: 24,
        backgroundImage: 'linear-gradient(rgba(212,175,55,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 60% 50% at 20% 50%, rgba(212,175,55,0.06) 0%, transparent 70%)',
        }} />
        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
          <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', color: '#d4af37', marginBottom: 20 }}>
            {'// SOPORTE · FAQ'}
          </div>
          <h1 style={{
            fontFamily: "'Bebas Neue', Impact, sans-serif",
            fontSize: 'clamp(64px, 10vw, 120px)',
            lineHeight: 0.9, letterSpacing: '0.02em', margin: '0 0 24px',
          }}>
            <span style={{ color: '#e8e9f0' }}>PREGUNTAS</span><br />
            <span style={{ background: 'linear-gradient(135deg, #d4af37, #f0c040, #a88c25)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              FRECUENTES
            </span>
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <p style={{ fontFamily: 'monospace', fontSize: 12, color: '#7a7f9a', margin: 0, lineHeight: 1.6, maxWidth: 480 }}>
              Todo lo que necesitas saber sobre la plataforma, los modelos, las herramientas y los planes de acceso.
            </p>
            <div style={{
              fontFamily: 'monospace', fontSize: 11, color: '#d4af37',
              border: '1px solid #d4af3740', padding: '6px 14px',
              letterSpacing: '0.15em',
            }}>
              {totalQ} PREGUNTAS
            </div>
          </div>
        </div>
      </section>

      {/* ── Search + Tabs ────────────────────────────────────────────────────── */}
      <section style={{ borderBottom: '1px solid #1a1d2e', position: 'sticky', top: 0, background: '#04050a', zIndex: 40 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Search bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#0b0d14', border: '1px solid #1a1d2e',
            padding: '10px 16px',
          }}>
            <span style={{ fontFamily: 'monospace', fontSize: 14, color: '#5a5f7a' }}>⌕</span>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setActiveTab('all') }}
              placeholder="Buscar preguntas…"
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontFamily: 'monospace', fontSize: 12, color: '#e8e9f0',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontSize: 12, color: '#5a5f7a' }}>
                ✕
              </button>
            )}
          </div>

          {/* Category tabs */}
          <div style={{ display: 'flex', gap: 2, overflowX: 'auto', paddingBottom: 2 }}>
            {[{ id: 'all', label: 'TODAS', icon: '◈' }, ...CATEGORIES].map(cat => {
              const isActive = activeTab === cat.id
              const count = cat.id === 'all'
                ? totalQ
                : CATEGORIES.find(c => c.id === cat.id)!.items.length
              return (
                <button key={cat.id} onClick={() => { setActiveTab(cat.id); setSearch('') }}
                  style={{
                    padding: '7px 14px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                    fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.15em',
                    background: isActive ? '#d4af37' : '#0b0d14',
                    color: isActive ? '#04050a' : '#5a5f7a',
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'background 0.15s, color 0.15s',
                  }}>
                  {'icon' in cat && <span style={{ fontSize: 10 }}>{(cat as typeof CATEGORIES[0]).icon}</span>}
                  {cat.label}
                  <span style={{
                    background: isActive ? '#04050a30' : '#1a1d2e',
                    color: isActive ? '#04050a' : '#3a3f5a',
                    borderRadius: 2, padding: '1px 5px', fontSize: 9,
                  }}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── FAQ Content ──────────────────────────────────────────────────────── */}
      <section style={{ padding: '48px 24px 96px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          {search || activeTab !== 'all' ? (
            /* Filtered flat list */
            <>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#5a5f7a', letterSpacing: '0.2em', marginBottom: 20 }}>
                {filtered.length} RESULTADO{filtered.length !== 1 ? 'S' : ''}
                {search ? ` PARA "${search.toUpperCase()}"` : ''}
              </div>
              {filtered.length === 0 ? (
                <div style={{ padding: '64px 0', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 32, color: '#1a1d2e', marginBottom: 16 }}>◈</div>
                  <p style={{ fontFamily: 'monospace', fontSize: 12, color: '#5a5f7a' }}>
                    Sin resultados. Prueba con otro término o{' '}
                    <a href="mailto:contacto@sigma-research.io" style={{ color: '#d4af37', textDecoration: 'none' }}>
                      escríbenos directamente
                    </a>.
                  </p>
                </div>
              ) : (
                <div style={{ border: '1px solid #1a1d2e' }}>
                  {filtered.map((item, i) => {
                    const id = `flat-${i}`
                    return (
                      <div key={id}>
                        <div style={{ padding: '6px 24px 0', borderTop: i > 0 ? '1px solid #0f1018' : 'none' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.15em', color: '#3a3f5a' }}>
                            {item.categoryLabel}
                          </span>
                        </div>
                        <AccordionItem
                          id={id} q={item.q} a={item.a}
                          isOpen={open === id} onToggle={() => toggle(id)}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            /* Default grouped by category */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
              {CATEGORIES.map(group => (
                <div key={group.id}>
                  {/* Category header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{group.icon}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.3em', color: '#d4af37' }}>
                      {group.label}
                    </span>
                    <div style={{ flex: 1, height: 1, background: '#1a1d2e' }} />
                    <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#3a3f5a', letterSpacing: '0.1em' }}>
                      {group.items.length} PREGUNTAS
                    </span>
                  </div>

                  {/* Accordion */}
                  <div style={{ border: '1px solid #1a1d2e' }}>
                    {group.items.map((item, i) => {
                      const id = `${group.id}-${i}`
                      return (
                        <AccordionItem
                          key={id} id={id} q={item.q} a={item.a}
                          isOpen={open === id} onToggle={() => toggle(id)}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
      <section style={{ borderTop: '1px solid #1a1d2e', borderBottom: '1px solid #1a1d2e' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 1, background: '#1a1d2e' }}>
          {[
            { label: 'Herramientas',  value: '15+'  },
            { label: 'Preguntas FAQ', value: String(totalQ) },
            { label: 'Exchanges',     value: '2'    },
            { label: 'Modelos ML',    value: '4'    },
          ].map(s => (
            <div key={s.label} style={{ background: '#04050a', padding: '24px 28px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 40, color: '#d4af37', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#5a5f7a', letterSpacing: '0.2em', marginTop: 6, textTransform: 'uppercase' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.3em', color: '#d4af37', marginBottom: 16 }}>
            {'// ¿TIENES MÁS PREGUNTAS?'}
          </div>
          <h2 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 'clamp(36px, 5vw, 56px)', color: '#e8e9f0', margin: '0 0 16px', lineHeight: 1 }}>
            HABLEMOS
          </h2>
          <p style={{ fontFamily: 'monospace', fontSize: 12, color: '#7a7f9a', marginBottom: 36, lineHeight: 1.7 }}>
            Si no encontraste lo que buscabas, escríbenos directamente.<br />
            Respondemos dentro de las 24–48 horas hábiles.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/registro"
              style={{
                background: '#d4af37', color: '#04050a',
                fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.2em',
                padding: '13px 32px', textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              CREAR CUENTA GRATIS
            </Link>
            <a
              href="mailto:contacto@sigma-research.io"
              style={{
                border: '1px solid #2a2d3e', color: '#7a7f9a',
                fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.2em',
                padding: '13px 32px', textDecoration: 'none',
                display: 'inline-block',
                transition: 'border-color 0.2s, color 0.2s',
              }}
            >
              CONTACTAR
            </a>
          </div>
        </div>
      </section>

    </main>
  )
}
