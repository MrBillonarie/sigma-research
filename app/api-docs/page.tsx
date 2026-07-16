import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API Reference',
  description: 'Documentación REST API de SQuant Desk para clientes institucionales.',
}

const G = '#39e2e6'
const BG = '#080a0f'
const SURFACE = '#0b0d14'
const BORDER = '#202634'
const TEXT = '#e8e9f0'
const DIM = '#7a7f9a'
const MUTED = '#3a3f55'
const GREEN = '#2fd39a'
const BLUE = '#4f92ff'
const MONO = "'DM Mono','Courier New',monospace"
const DISPLAY = "'Bebas Neue',Impact,sans-serif"

// ─── Endpoint data ─────────────────────────────────────────────────────────────

const endpoints = [
  {
    tag:    'PUBLIC',
    color:  GREEN,
    method: 'GET',
    path:   '/api/public/engine-stats',
    desc:   'Estado global del motor cuantitativo: backtests procesados, win rate, drawdown, régimen de mercado y equity curve.',
    auth:   false,
    response: `{
  "total": 16386795,
  "rate_hr": 124075,
  "timeframes": 7,
  "by_tf": { "4h": 3472285, "1h": 5672653, "15m": 5696032 },
  "assets": 5,
  "live": true,
  "regime": "BULL",
  "equity": 11422.53,
  "equity_initial": 10000,
  "return_pct": 14.23,
  "profit_factor": 1.935,
  "max_dd_pct": -8.74,
  "win_rate": 59.1,
  "total_trades": 22,
  "computed_at": "2026-07-02T14:30:00Z"
}`,
  },
  {
    tag:    'AUTH',
    color:  G,
    method: 'GET',
    path:   '/api/vps/champions',
    desc:   'Lista de modelos campeones activos con métricas out-of-sample, walk-forward test y Monte Carlo por timeframe.',
    auth:   true,
    response: `[
  {
    "slot": "4h_01",
    "sym": "BTCUSDT",
    "tf": "4h",
    "strategy": "PRO.MACD",
    "direction": "LONG",
    "grade": "A+",
    "cagr": 38.2,
    "win_rate": 61.4,
    "max_dd": -7.8,
    "profit_factor": 2.14,
    "mc_confidence": 0.87,
    "risk_pct": 2.5,
    "saved_at": "2026-07-02T12:00:00Z"
  }
]`,
  },
  {
    tag:    'AUTH',
    color:  G,
    method: 'GET',
    path:   '/api/lp-signal/active',
    desc:   'Señal LP activa aprobada por el sistema con hipótesis, rango de precio, Kelly sizing y días proyectados. Requiere plan PRO.',
    auth:   true,
    response: `{
  "signal": {
    "id": "uuid",
    "hyp": "bullish_lp",
    "hyp_text": "Rango alcista concentrado en soporte clave",
    "pool": "ETH/USDC",
    "fee_tier": "0.05%",
    "range_low_pct": -8.5,
    "range_high_pct": 12.0,
    "kelly_pct": 18.4,
    "days_projected": 14,
    "ref_price": 3480.22,
    "created_at": "2026-07-01T08:00:00Z",
    "expires_at": "2026-07-15T08:00:00Z"
  }
}`,
  },
  {
    tag:    'PUBLIC',
    color:  GREEN,
    method: 'GET',
    path:   '/api/community-setups',
    desc:   'Setups publicados por la comunidad con reputación ≥ 10. Incluye par, tipo (LONG/SHORT/LP), entry, SL, TP y votos.',
    auth:   false,
    response: `[
  {
    "id": "uuid",
    "par": "BTCUSDT",
    "tipo": "LONG",
    "entry": 61500,
    "sl": 59800,
    "tp": 67000,
    "rr": 3.24,
    "timeframe": "4h",
    "votos_up": 12,
    "votos_down": 1,
    "estado": "ACTIVO",
    "created_at": "2026-07-01T10:00:00Z",
    "profiles": { "username": "sigma_trader", "reputation": 47 }
  }
]`,
  },
  {
    tag:    'AUTH',
    color:  G,
    method: 'POST',
    path:   '/api/community-setups',
    desc:   'Publicar un nuevo setup. Requiere reputación ≥ 10 en el perfil del usuario autenticado.',
    auth:   true,
    response: `// Body (application/json):
{
  "par": "ETHUSDT",
  "tipo": "SHORT",           // "LONG" | "SHORT" | "LP"
  "entry": 3480,
  "sl": 3650,
  "tp": 3100,
  "rr": 2.11,
  "timeframe": "1h",
  "metodologia": "OB + divergencia RSI en resistencia",
  "nota": "Invalidado si cierra > 3700"
}

// Response 201:
{ "id": "uuid", ... }`,
  },
  {
    tag:    'AUTH',
    color:  G,
    method: 'GET',
    path:   '/api/motor/signals',
    desc:   'Señales activas del motor en vivo: símbolo, dirección, régimen HMM, confianza y timestamp.',
    auth:   true,
    response: `{
  "regime": "BULL",
  "signals": [
    {
      "sym": "BTCUSDT",
      "tf": "4h",
      "direction": "LONG",
      "confidence": 0.78,
      "entry": 61500,
      "updated_at": "2026-07-02T14:00:00Z"
    }
  ]
}`,
  },
]

const rateTable = [
  { plan: 'Free',         rpm: '10',   day: '200',    burst: '3' },
  { plan: 'PRO',          rpm: '60',   day: '5 000',  burst: '10' },
  { plan: 'Institutional', rpm: '600', day: 'Sin límite', burst: '50' },
]

// ─── Components ────────────────────────────────────────────────────────────────

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 7px',
      borderRadius: 3,
      border: `1px solid ${color}40`,
      background: `${color}12`,
      color,
      fontFamily: MONO,
      fontSize: 9,
      letterSpacing: '0.15em',
    }}>
      {label}
    </span>
  )
}

function Method({ m }: { m: string }) {
  const colors: Record<string, string> = { GET: GREEN, POST: BLUE, PATCH: '#f59e0b', DELETE: '#f87171' }
  const c = colors[m] ?? DIM
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      background: `${c}18`,
      color: c,
      fontFamily: MONO,
      fontSize: 10,
      letterSpacing: '0.1em',
      borderRadius: 3,
      border: `1px solid ${c}30`,
      fontWeight: 600,
    }}>
      {m}
    </span>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre style={{
      background: BG,
      border: `1px solid ${BORDER}`,
      borderRadius: 6,
      padding: '14px 16px',
      margin: 0,
      overflowX: 'auto',
      fontFamily: MONO,
      fontSize: 11,
      color: DIM,
      lineHeight: 1.6,
      whiteSpace: 'pre',
    }}>
      <code style={{ color: '#a8d8a8' }}>{children}</code>
    </pre>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApiDocsPage() {
  return (
    <main style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: MONO }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px 96px' }}>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.3em', color: DIM, marginBottom: 10 }}>
            {'// SQUANT DESK · API REFERENCE'}
          </div>
          <h1 style={{
            fontFamily: DISPLAY,
            fontSize: 'clamp(38px,5vw,64px)',
            letterSpacing: '0.06em',
            margin: 0,
            lineHeight: 1,
            color: TEXT,
          }}>
            <span style={{ color: G }}>API</span> REFERENCE
          </h1>
          <p style={{ fontSize: 13, color: DIM, marginTop: 14, lineHeight: 1.7, maxWidth: 600 }}>
            REST API de SQuant Desk para integraciones institucionales. Todos los endpoints retornan
            JSON con Content-Type <code style={{ color: G }}>application/json</code>.
            Base URL: <code style={{ color: G }}>https://squantdesk.com</code>
          </p>
        </div>

        {/* ── Auth ──────────────────────────────────────────────────────────── */}
        <section style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 8, letterSpacing: '0.3em', color: MUTED, marginBottom: 12 }}>
            {'// AUTENTICACIÓN'}
          </div>
          <h2 style={{ fontFamily: DISPLAY, fontSize: 22, letterSpacing: '0.08em', margin: '0 0 16px', color: TEXT }}>
            BEARER TOKEN
          </h2>
          <p style={{ fontSize: 12, color: DIM, marginBottom: 16, lineHeight: 1.7 }}>
            Los endpoints marcados como <Tag label="AUTH" color={G} /> requieren un token JWT de Supabase.
            Obtenlo desde tu sesión autenticada e inclúyelo en el header <code style={{ color: G }}>Authorization</code>.
          </p>
          <CodeBlock>{`// Obtener token (JavaScript / TypeScript)
const { data: { session } } = await supabase.auth.getSession()
const token = session?.access_token

// Usar en requests
fetch('https://squantdesk.com/api/vps/champions', {
  headers: {
    'Authorization': \`Bearer \${token}\`,
    'Content-Type': 'application/json',
  }
})`}</CodeBlock>
          <div style={{ marginTop: 12 }}>
            <CodeBlock>{`# cURL
curl -H "Authorization: Bearer <token>" \\
     https://squantdesk.com/api/public/engine-stats`}</CodeBlock>
          </div>
        </section>

        {/* ── Rate limits ───────────────────────────────────────────────────── */}
        <section style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 8, letterSpacing: '0.3em', color: MUTED, marginBottom: 12 }}>
            {'// RATE LIMITS'}
          </div>
          <h2 style={{ fontFamily: DISPLAY, fontSize: 22, letterSpacing: '0.08em', margin: '0 0 16px', color: TEXT }}>
            LÍMITES DE USO
          </h2>
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
              background: SURFACE, borderBottom: `1px solid ${BORDER}`,
            }}>
              {['PLAN', 'REQ / MIN', 'REQ / DÍA', 'BURST'].map(h => (
                <div key={h} style={{ padding: '10px 16px', fontSize: 9, letterSpacing: '0.2em', color: MUTED }}>
                  {h}
                </div>
              ))}
            </div>
            {rateTable.map((row, i) => (
              <div key={row.plan} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
                background: i % 2 === 0 ? BG : SURFACE,
                borderBottom: i < rateTable.length - 1 ? `1px solid ${BORDER}` : 'none',
              }}>
                <div style={{ padding: '12px 16px', fontSize: 12, color: row.plan === 'Institutional' ? G : TEXT }}>
                  {row.plan}
                </div>
                <div style={{ padding: '12px 16px', fontSize: 12, color: DIM, fontFamily: MONO }}>{row.rpm}</div>
                <div style={{ padding: '12px 16px', fontSize: 12, color: DIM, fontFamily: MONO }}>{row.day}</div>
                <div style={{ padding: '12px 16px', fontSize: 12, color: DIM, fontFamily: MONO }}>{row.burst}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: MUTED, marginTop: 10 }}>
            Exceder el límite retorna <code style={{ color: '#f87171' }}>HTTP 429</code> con header{' '}
            <code style={{ color: DIM }}>Retry-After: &lt;seconds&gt;</code>.
          </p>
        </section>

        {/* ── Endpoints ─────────────────────────────────────────────────────── */}
        <section style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 8, letterSpacing: '0.3em', color: MUTED, marginBottom: 12 }}>
            {'// ENDPOINTS'}
          </div>
          <h2 style={{ fontFamily: DISPLAY, fontSize: 22, letterSpacing: '0.08em', margin: '0 0 24px', color: TEXT }}>
            REFERENCIA DE ENDPOINTS
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 24 }}>
            {endpoints.map(ep => (
              <div
                key={ep.path}
                style={{
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 6,
                  overflow: 'hidden',
                }}
              >
                {/* Endpoint header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  padding: '14px 18px', borderBottom: `1px solid ${BORDER}`,
                }}>
                  <Method m={ep.method} />
                  <code style={{ fontFamily: MONO, fontSize: 13, color: TEXT, flex: 1 }}>{ep.path}</code>
                  <Tag label={ep.tag} color={ep.color} />
                </div>

                <div style={{ padding: '14px 18px' }}>
                  <p style={{ fontSize: 12, color: DIM, margin: '0 0 14px', lineHeight: 1.6 }}>{ep.desc}</p>

                  {ep.auth && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '4px 10px', background: `${G}10`, border: `1px solid ${G}30`,
                      borderRadius: 4, marginBottom: 14,
                    }}>
                      <span style={{ color: G, fontSize: 10 }}>🔐</span>
                      <span style={{ fontFamily: MONO, fontSize: 10, color: G }}>
                        Requiere Authorization: Bearer &lt;token&gt;
                      </span>
                    </div>
                  )}

                  <div style={{ fontSize: 9, letterSpacing: '0.2em', color: MUTED, marginBottom: 8 }}>
                    EJEMPLO DE RESPUESTA
                  </div>
                  <CodeBlock>{ep.response}</CodeBlock>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Errors ────────────────────────────────────────────────────────── */}
        <section style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 8, letterSpacing: '0.3em', color: MUTED, marginBottom: 12 }}>
            {'// ERRORES'}
          </div>
          <h2 style={{ fontFamily: DISPLAY, fontSize: 22, letterSpacing: '0.08em', margin: '0 0 16px', color: TEXT }}>
            CÓDIGOS DE ERROR
          </h2>
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden' }}>
            {[
              { code: '200', desc: 'OK — respuesta exitosa' },
              { code: '400', desc: 'Bad Request — parámetro inválido o faltante' },
              { code: '401', desc: 'Unauthorized — token ausente, expirado o inválido' },
              { code: '403', desc: 'Forbidden — plan sin acceso al endpoint solicitado' },
              { code: '429', desc: 'Too Many Requests — rate limit excedido' },
              { code: '500', desc: 'Internal Server Error — error en el motor o base de datos' },
              { code: '503', desc: 'Service Unavailable — motor VPS sin respuesta' },
            ].map((row, i, arr) => (
              <div key={row.code} style={{
                display: 'flex', gap: 24, alignItems: 'center',
                padding: '11px 18px',
                background: i % 2 === 0 ? BG : SURFACE,
                borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none',
              }}>
                <code style={{
                  fontFamily: MONO, fontSize: 13,
                  color: row.code.startsWith('2') ? GREEN : row.code.startsWith('4') ? '#f59e0b' : '#f87171',
                  minWidth: 36,
                }}>
                  {row.code}
                </code>
                <span style={{ fontSize: 12, color: DIM }}>{row.desc}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <CodeBlock>{`// Estructura de error estándar
{
  "error": "Descripción del error en español",
  "code":  "ERROR_CODE"          // presente en algunos endpoints
}`}</CodeBlock>
          </div>
        </section>

        {/* ── SDKs / Contact ────────────────────────────────────────────────── */}
        <section>
          <div style={{ fontSize: 8, letterSpacing: '0.3em', color: MUTED, marginBottom: 12 }}>
            {'// ACCESO INSTITUCIONAL'}
          </div>
          <h2 style={{ fontFamily: DISPLAY, fontSize: 22, letterSpacing: '0.08em', margin: '0 0 16px', color: TEXT }}>
            PLAN INSTITUCIONAL
          </h2>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
            gap: 1, background: BORDER, border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden',
          }}>
            {[
              { icon: '⚡', title: 'Rate limits sin tope',   desc: '600 req/min, sin límite diario, burst de 50.' },
              { icon: '∑',  title: 'Modelos a medida',       desc: 'Backtests y champions parametrizados por contrato.' },
              { icon: '◎',  title: 'White label disponible', desc: 'Branding propio sobre la infraestructura SIGMA.' },
              { icon: '⊕',  title: 'SLA garantizado',        desc: '99.5% uptime mensual con notificaciones proactivas.' },
            ].map(item => (
              <div key={item.title} style={{ background: SURFACE, padding: '18px 20px' }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>{item.icon}</div>
                <div style={{ fontSize: 12, color: TEXT, marginBottom: 4, letterSpacing: '0.05em' }}>{item.title}</div>
                <div style={{ fontSize: 11, color: DIM, lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 20, padding: '16px 20px',
            border: `1px solid ${G}30`, background: `${G}08`, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 12, color: TEXT, marginBottom: 4 }}>
                ¿Necesitas acceso institucional o una integración personalizada?
              </div>
              <div style={{ fontSize: 11, color: DIM }}>
                Tiempo de respuesta: {'<'} 24h hábiles · Cotización sin compromiso
              </div>
            </div>
            <Link
              href="/contacto"
              style={{
                display: 'inline-block',
                padding: '10px 22px',
                background: G,
                color: BG,
                fontFamily: DISPLAY,
                fontSize: 14,
                letterSpacing: '0.12em',
                textDecoration: 'none',
                borderRadius: 4,
                whiteSpace: 'nowrap',
              }}
            >
              CONTACTAR →
            </Link>
          </div>
        </section>

        {/* Footer */}
        <div style={{
          marginTop: 64, paddingTop: 24, borderTop: `1px solid ${BORDER}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
        }}>
          <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>
            SQuant Desk API v2 · 2026
          </span>
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { label: 'Términos', href: '/terminos' },
              { label: 'Privacidad', href: '/privacidad' },
              { label: 'Contacto', href: '/contacto' },
            ].map(l => (
              <Link key={l.href} href={l.href} style={{ fontFamily: MONO, fontSize: 10, color: MUTED, textDecoration: 'none' }}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </main>
  )
}
