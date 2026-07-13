'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/app/lib/supabase'
import { C, F, cardStyle, numberEmboss } from '@/app/lib/constants'

// ─── Contenido — espejo de la propuesta Free vs PRO (2026-07-08) ──────────────
// Principio: FREE muestra la prueba (paper trading, estados, herramientas);
// PRO entrega lo accionable (entrada/SL/TP, Pine, reportes, alertas).

const BLUE = '#4f92ff'

type ChipKind = 'full' | 'pro' | 'part' | 'lock' | 'none'

const CHIP_COLOR: Record<ChipKind, string> = {
  full: '#2fd39a',   // completo
  pro:  C.glow,      // exclusivo PRO
  part: '#ffb454',   // parcial / muestra
  lock: '#ff6d7a',   // bloqueado
  none: C.muted,     // institucional
}

interface MatrixRow {
  feat: string
  sub?: string
  free: [ChipKind, string]
  pro:  [ChipKind, string]
}

const MATRIX: MatrixRow[] = [
  { feat: 'Panel de Señales (HUD)', sub: 'sistema de decisión en vivo',
    free: ['part', 'Régimen, activos, estados y grades — sin entrada/SL/TP'],
    pro:  ['pro',  'Señales completas y accionables en tiempo real'] },
  { feat: 'Matrices de modelos M1–M5', sub: 'campeones por activo/timeframe',
    free: ['part', 'Estados (listo/optimizando) y win rate'],
    pro:  ['pro',  'Parámetros y detalle completo (Inspector)'] },
  { feat: 'Paper trading · Equity · Proof of Work', sub: 'la prueba de honestidad',
    free: ['full', 'Visible completo — es lo que vende'],
    pro:  ['full', 'Visible completo'] },
  { feat: 'Pine Scripts — SIGMA TERMINAL', sub: 'el indicador de TradingView',
    free: ['lock', 'Bloqueado'],
    pro:  ['pro',  'Descarga del .pine'] },
  { feat: 'Reportes PDF', sub: 'research cuantitativo semanal',
    free: ['part', '1 reporte al mes (la primera edición)'],
    pro:  ['pro',  'Semanal + hemeroteca completa'] },
  { feat: 'Motor de decisión', sub: 'rotación cross-market BUY/SELL/HOLD',
    free: ['part', 'Solo dirección'],
    pro:  ['pro',  'Señal completa en vivo'] },
  { feat: 'Señales LP DeFi (PancakeSwap)', sub: 'rangos y sizing',
    free: ['part', 'Calculadora'],
    pro:  ['pro',  'Señales del modelo'] },
  { feat: 'Herramientas personales', sub: 'Journal · FIRE · Monte Carlo · Portafolio · Calendario',
    free: ['full', 'Completas'],
    pro:  ['full', 'Completas'] },
  { feat: 'Alertas y notificaciones',
    free: ['part', 'Básicas'],
    pro:  ['pro',  'Tiempo real (Telegram / push)'] },
  { feat: 'API · White label · SLA',
    free: ['none', '—'],
    pro:  ['none', '— (plan Institucional)'] },
]

interface PlanDef {
  tier: string
  priceM: string
  priceA: string
  period: string
  hero: boolean
  badge: string | null
  items: string[]
}

const PLANS: PlanDef[] = [
  {
    tier: 'ACCESO LIBRE', priceM: '$0', priceA: '$0', period: 'siempre gratis', hero: false, badge: null,
    items: [
      'HUD con estados, grades y régimen',
      'Paper trading y equity en vivo (proof of work)',
      'Matrices M1–M4: estados y win rate',
      'Herramientas personales completas',
      '1 reporte PDF al mes',
      'Alertas básicas',
    ],
  },
  {
    tier: 'PRO', priceM: '$29', priceA: '$23', period: 'USD / mes', hero: true, badge: '★ MÁS POPULAR',
    items: [
      'Todo lo del plan libre',
      'Señales completas: entrada / SL / TP en vivo',
      'Pine Scripts descargables (SIGMA TERMINAL)',
      'Reporte PDF semanal + hemeroteca completa',
      'Motor de decisión en vivo',
      'Alertas en tiempo real (Telegram / push)',
    ],
  },
  {
    tier: 'INSTITUCIONAL', priceM: 'Custom', priceA: 'Custom', period: 'cotizar', hero: false, badge: null,
    items: [
      'Todo lo del plan PRO',
      'API de acceso completo',
      'Modelos a medida',
      'White label disponible',
      'SLA garantizado',
    ],
  },
]

type SessionState = 'anon' | 'free' | 'pro'

export default function PlanesPage() {
  const [annual,  setAnnual]  = useState(false)
  const [session, setSession] = useState<SessionState>('anon')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { setSession('anon'); return }
      const plan = (data.user.app_metadata?.plan as string) ?? 'free'
      setSession(plan === 'pro' || plan === 'anual' ? 'pro' : 'free')
    }).catch(() => setSession('anon'))
  }, [])

  // CTA según quién mira la página
  function ctaFor(tier: string): { label: string; href: string | null; kind: 'primary' | 'ghost' | 'done' } {
    if (tier === 'INSTITUCIONAL') return { label: 'CONTACTAR', href: '/contacto', kind: 'ghost' }
    if (tier === 'PRO') {
      if (session === 'pro')  return { label: '✓ YA ERES PRO', href: null, kind: 'done' }
      if (session === 'free') return { label: 'SOLICITAR ACTIVACIÓN →', href: '/soporte', kind: 'primary' }
      return { label: 'CREAR CUENTA Y ACTIVAR', href: '/registro', kind: 'primary' }
    }
    // ACCESO LIBRE
    if (session === 'anon') return { label: 'ABRIR CUENTA GRATIS', href: '/registro', kind: 'ghost' }
    return { label: session === 'pro' ? 'INCLUIDO EN TU PLAN' : 'TU PLAN ACTUAL', href: null, kind: 'done' }
  }

  return (
    <div id="sigma-planes" style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: F.mono }}>
      <style>{`
        #sigma-planes .pl-cta {
          display: block; text-align: center; padding: 14px; border-radius: 8px;
          font-family: var(--font-dm-mono,'DM Mono',monospace); font-size: 10px; letter-spacing: .22em;
          text-decoration: none; cursor: pointer; border: none;
          background: linear-gradient(100deg, ${C.glow}, ${BLUE}); color: #04050a; font-weight: 700;
          box-shadow: 0 0 18px rgba(57,226,230,0.22);
          transition: filter .15s, box-shadow .15s;
        }
        #sigma-planes .pl-cta:hover { filter: brightness(1.12); box-shadow: 0 0 28px rgba(57,226,230,0.35); }
        #sigma-planes .pl-ghost {
          display: block; text-align: center; padding: 14px; border-radius: 8px;
          font-family: var(--font-dm-mono,'DM Mono',monospace); font-size: 10px; letter-spacing: .22em;
          text-decoration: none; cursor: pointer;
          background: transparent; border: 1px solid ${C.border2}; color: ${C.dimText};
          transition: border-color .15s, color .15s, box-shadow .15s;
        }
        #sigma-planes .pl-ghost:hover { border-color: rgba(57,226,230,0.55); color: ${C.glow}; box-shadow: 0 0 14px rgba(57,226,230,0.14); }
        #sigma-planes .pl-done {
          display: block; text-align: center; padding: 14px; border-radius: 8px;
          font-family: var(--font-dm-mono,'DM Mono',monospace); font-size: 10px; letter-spacing: .22em;
          background: rgba(47,211,154,0.08); border: 1px solid rgba(47,211,154,0.35); color: #2fd39a;
          cursor: default;
        }
        #sigma-planes table.pl-matrix tbody tr { transition: background .15s; }
        #sigma-planes table.pl-matrix tbody tr:hover { background: rgba(57,226,230,0.035); }
        @media (max-width: 860px) {
          #sigma-planes .pl-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px 80px' }}>

        {/* ── Mini nav ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 0' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
            <span style={{
              width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center',
              fontFamily: F.display, fontSize: 16, color: '#04121e',
              background: `linear-gradient(135deg, ${C.gold}, ${C.glow})`,
              boxShadow: '0 0 18px rgba(57,226,230,0.4)',
            }}>Σ</span>
            <span style={{ fontSize: 12, letterSpacing: '0.26em', color: C.text }}>SIGMA RESEARCH</span>
          </Link>
          <Link href="/home" style={{ fontSize: 10, letterSpacing: '0.2em', color: C.dimText, textDecoration: 'none' }}>
            MI CUENTA →
          </Link>
        </div>

        {/* ── Hero ── */}
        <header style={{ padding: '42px 0 34px' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.28em', color: C.gold, marginBottom: 14 }}>
            {'// PLANES · FREE VS PRO'}
          </div>
          <h1 style={{ fontFamily: F.display, fontSize: 'clamp(38px,6vw,64px)', lineHeight: 0.95, letterSpacing: '0.02em', margin: 0 }}>
            <span style={{ color: C.text }}>LA PRUEBA ES GRATIS. </span>
            <span style={{ background: `linear-gradient(100deg, ${C.glow}, ${BLUE})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              LO ACCIONABLE ES PRO.
            </span>
          </h1>
          <p style={{ fontSize: 13, color: C.dimText, maxWidth: 640, lineHeight: 1.8, margin: '18px 0 0' }}>
            El paper trading, los estados del motor y tus herramientas personales son visibles para todos —
            esa transparencia es nuestra carta de presentación. Las señales operables (entrada / SL / TP),
            los Pine Scripts y el research mensual son del plan PRO.
          </p>
        </header>

        {/* ── Toggle mensual / anual ── */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginBottom: 36 }}>
          <span style={{ fontSize: 10, color: !annual ? C.glow : C.muted, letterSpacing: '0.15em', transition: 'color 0.2s' }}>MENSUAL</span>
          <button
            onClick={() => setAnnual(v => !v)}
            aria-label="Alternar facturación anual"
            style={{
              width: 44, height: 24, borderRadius: 12,
              background: annual ? C.gold : C.border,
              border: `1px solid ${annual ? C.gold : C.border2}`,
              position: 'relative', cursor: 'pointer', transition: 'background 0.25s, border-color 0.25s',
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: annual ? 23 : 3,
              width: 16, height: 16, borderRadius: '50%',
              background: annual ? C.bg : C.dimText,
              transition: 'left 0.25s ease, background 0.25s',
            }} />
          </button>
          <span style={{ fontSize: 10, color: annual ? C.glow : C.muted, letterSpacing: '0.15em', transition: 'color 0.2s' }}>
            ANUAL
            <span style={{
              marginLeft: 8, fontSize: 8, padding: '1px 6px', borderRadius: 999,
              background: 'rgba(57,226,230,0.12)', color: C.glow, border: `1px solid ${C.gold}40`,
              opacity: annual ? 1 : 0.5, transition: 'opacity 0.2s',
            }}>−20%</span>
          </span>
        </div>

        {/* ── Plan cards ── */}
        <div className="pl-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 18 }}>
          {PLANS.map(p => {
            const price = annual ? p.priceA : p.priceM
            const cta = ctaFor(p.tier)
            return (
              <div key={p.tier} style={{
                ...cardStyle,
                position: 'relative', display: 'flex', flexDirection: 'column',
                padding: '38px 28px 28px',
                overflow: 'hidden',
                backgroundColor: C.surface,
                ...(p.hero ? {
                  border: `1px solid ${C.gold}40`,
                  boxShadow: `${C.shadowCard}, ${C.glowGoldSm}`,
                  backgroundImage: `linear-gradient(180deg, rgba(57,226,230,0.07), transparent 55%)`,
                } : {
                  backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.008))',
                }),
              }}>
                {p.hero && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                    background: `linear-gradient(90deg, ${C.gold}, ${BLUE} 55%, transparent)`,
                  }} />
                )}
                {p.badge && (
                  <div style={{
                    position: 'absolute', top: 14, right: 14,
                    fontSize: 9, letterSpacing: '0.12em', padding: '4px 10px', borderRadius: 999,
                    color: '#04121e', background: `linear-gradient(135deg, ${C.gold}, ${C.glow})`,
                  }}>{p.badge}</div>
                )}

                <div style={{ fontSize: 10, letterSpacing: '0.25em', color: p.hero ? C.gold : C.dimText, marginBottom: 14 }}>{p.tier}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: F.display, fontSize: 56, color: p.hero ? C.glow : C.text, lineHeight: 1, textShadow: numberEmboss }}>
                    {price}
                  </span>
                  <div>
                    <div style={{ fontSize: 11, color: C.muted }}>{p.period}</div>
                    {annual && p.priceA !== p.priceM && p.priceA !== 'Custom' && (
                      <div style={{ fontSize: 9, color: '#2fd39a', letterSpacing: '0.08em', marginTop: 2 }}>facturado anualmente</div>
                    )}
                  </div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, margin: '24px 0 28px' }}>
                  {p.items.map(item => (
                    <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ color: p.hero ? C.glow : C.dimText, fontSize: 12, flexShrink: 0, marginTop: 1 }}>✓</span>
                      <span style={{ fontSize: 11, color: C.dimText, lineHeight: 1.5 }}>{item}</span>
                    </div>
                  ))}
                </div>

                {cta.href
                  ? <Link href={cta.href} className={cta.kind === 'primary' ? 'pl-cta' : 'pl-ghost'}>{cta.label}</Link>
                  : <div className="pl-done">{cta.label}</div>}

                {p.tier === 'PRO' && session === 'free' && (
                  <div style={{ fontSize: 9, color: C.muted, textAlign: 'center', marginTop: 10, lineHeight: 1.6 }}>
                    Activación manual por el equipo mientras habilitamos pagos en línea.
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Comparativa completa ── */}
        <div style={{ fontSize: 10, letterSpacing: '0.2em', color: C.muted, margin: '42px 0 12px' }}>LA COMPARATIVA COMPLETA</div>
        <div style={{ ...cardStyle, backgroundColor: C.surface, overflow: 'hidden', overflowX: 'auto' }}>
          <div style={{ height: 2, background: `linear-gradient(90deg, rgba(57,226,230,0.85), rgba(79,146,255,0.4) 45%, transparent 82%)` }} />
          <table className="pl-matrix" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
            <thead>
              <tr style={{ background: C.surface2 }}>
                {['FUNCIÓN', '🆓 FREE', '⭐ PRO'].map((h, i) => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '14px 16px',
                    fontSize: 10, letterSpacing: '0.14em', fontWeight: 400,
                    color: i === 2 ? C.gold : C.dimText,
                    borderBottom: `1px solid ${C.border2}`,
                    width: i > 0 ? '30%' : undefined,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((r, i) => (
                <tr key={r.feat} style={{ borderBottom: i < MATRIX.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <td style={{ padding: '13px 16px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{r.feat}</div>
                    {r.sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{r.sub}</div>}
                  </td>
                  {[r.free, r.pro].map(([kind, txt], j) => (
                    <td key={j} style={{ padding: '13px 16px', verticalAlign: 'top' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: CHIP_COLOR[kind] }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: CHIP_COLOR[kind],
                          boxShadow: kind !== 'none' ? `0 0 8px ${CHIP_COLOR[kind]}` : 'none',
                        }} />
                        {txt}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Leyenda */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, margin: '14px 2px 0' }}>
          {([['full', 'Completo'], ['pro', 'Exclusivo PRO'], ['part', 'Parcial / muestra'], ['lock', 'Bloqueado'], ['none', 'Institucional']] as [ChipKind, string][]).map(([kind, label]) => (
            <span key={kind} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, color: CHIP_COLOR[kind] }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: CHIP_COLOR[kind], boxShadow: kind !== 'none' ? `0 0 8px ${CHIP_COLOR[kind]}` : 'none' }} />
              {label}
            </span>
          ))}
        </div>

        {/* ── Cierre honesto ── */}
        <div style={{
          ...cardStyle, backgroundColor: C.surface, marginTop: 42, padding: '22px 26px',
          borderLeft: `3px solid ${C.gold}`,
          backgroundImage: 'linear-gradient(90deg, rgba(57,226,230,0.05), transparent 50%)',
        }}>
          <div style={{ fontSize: 12, color: C.text, marginBottom: 6, fontWeight: 600 }}>¿Por qué el paper trading es gratis?</div>
          <div style={{ fontSize: 11, color: C.dimText, lineHeight: 1.8, maxWidth: 720 }}>
            Porque es la prueba. Cualquiera puede prometer señales ganadoras — nosotros preferimos que veas
            el equity curve, los trades y los estados del motor funcionando en vivo antes de pagar un peso.
            Cuando decidas que el sistema merece tu confianza, PRO te da las señales para operarlo.
          </div>
        </div>

      </div>
    </div>
  )
}
