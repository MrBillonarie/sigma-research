// Datos de demostración: Abril–Junio 2026
// Usados como fallback cuando Supabase no está disponible o la tabla no existe.
// Schema idéntico a macro_events en Supabase.

export interface MacroEvent {
  id: string
  title: string
  currency: string        // USD | EUR | GBP | BTC | ETH | SOL | JPY
  impact: 'HIGH' | 'MED' | 'LOW'
  type: 'MACRO' | 'CRYPTO'
  event_date: string      // YYYY-MM-DD
  event_time: string      // HH:MM (ET / hora de publicación)
  previous: string
  forecast: string
  actual: string          // vacío si pendiente
  description: string
  source: 'FRED' | 'COINMARKETCAL' | 'MANUAL' | 'MOCK'
  is_manual: boolean
  country: string
}

export const MOCK_EVENTS: MacroEvent[] = [
  // ── Abril 2026 ──────────────────────────────────────────────────────────────
  {
    id: 'mock_001',
    title: 'Initial Jobless Claims',
    currency: 'USD', impact: 'MED', type: 'MACRO',
    event_date: '2026-04-17', event_time: '08:30',
    previous: '223K', forecast: '220K', actual: '218K',
    description: 'Solicitudes semanales de desempleo. Dato por debajo del estimado confirma fortaleza laboral → menos presión para corte Fed.',
    source: 'FRED', is_manual: false, country: 'US',
  },
  {
    id: 'mock_002',
    title: 'S&P Global PMI Compuesto (Flash)',
    currency: 'USD', impact: 'MED', type: 'MACRO',
    event_date: '2026-04-22', event_time: '09:45',
    previous: '52.5', forecast: '52.0', actual: '51.8',
    description: 'PMI preliminar de abril. Dato por debajo confirma desaceleración. Positivo para narrative de recorte de tasas.',
    source: 'FRED', is_manual: false, country: 'US',
  },
  {
    id: 'mock_003',
    title: 'PCE Price Index (YoY)',
    currency: 'USD', impact: 'HIGH', type: 'MACRO',
    event_date: '2026-04-25', event_time: '08:30',
    previous: '2.5%', forecast: '2.3%', actual: '',
    description: 'Indicador de inflación favorito de la Fed. Lectura < 2.3% sería bullish para BTC y activos de riesgo.',
    source: 'FRED', is_manual: false, country: 'US',
  },
  {
    id: 'mock_004',
    title: 'GDP Q1 2026 (Advance)',
    currency: 'USD', impact: 'HIGH', type: 'MACRO',
    event_date: '2026-04-28', event_time: '08:30',
    previous: '2.3%', forecast: '1.8%', actual: '',
    description: 'Primera estimación del PIB Q1. Dato bajo + inflación cediendo = catalizador para corte de tasas Fed en junio.',
    source: 'FRED', is_manual: false, country: 'US',
  },
  {
    id: 'mock_005',
    title: 'FOMC Meeting (Día 1)',
    currency: 'USD', impact: 'HIGH', type: 'MACRO',
    event_date: '2026-04-29', event_time: '00:00',
    previous: '4.25–4.50%', forecast: '4.25–4.50%', actual: '',
    description: 'Inicio reunión FOMC. Sin anuncio de tasas hoy. Mercados en modo espera con baja volatilidad.',
    source: 'FRED', is_manual: false, country: 'US',
  },
  {
    id: 'mock_006',
    title: 'FOMC Decision + Press Conference',
    currency: 'USD', impact: 'HIGH', type: 'MACRO',
    event_date: '2026-04-30', event_time: '14:00',
    previous: '4.25–4.50%', forecast: '4.25–4.50%', actual: '',
    description: 'Decisión tasas Fed + conferencia Powell. Evento de máxima volatilidad. BTC históricamente cae 3–5% en los 15 min previos.',
    source: 'FRED', is_manual: false, country: 'US',
  },
  // ── Mayo 2026 ───────────────────────────────────────────────────────────────
  {
    id: 'mock_007',
    title: 'NFP (Non-Farm Payrolls)',
    currency: 'USD', impact: 'HIGH', type: 'MACRO',
    event_date: '2026-05-01', event_time: '08:30',
    previous: '228K', forecast: '195K', actual: '',
    description: 'Empleo no agrícola de abril. NFP < 180K reforzaría expectations de corte en junio. Alta volatilidad crypto 08:25–08:45.',
    source: 'FRED', is_manual: false, country: 'US',
  },
  {
    id: 'mock_008',
    title: 'ADP Employment Change',
    currency: 'USD', impact: 'MED', type: 'MACRO',
    event_date: '2026-05-07', event_time: '08:15',
    previous: '183K', forecast: '175K', actual: '',
    description: 'Empleo privado ADP. Precursor del NFP oficial. Correlación ~0.65 con BTC en rango 08:10–08:30.',
    source: 'FRED', is_manual: false, country: 'US',
  },
  {
    id: 'mock_009',
    title: 'CPI (YoY) — Abril',
    currency: 'USD', impact: 'HIGH', type: 'MACRO',
    event_date: '2026-05-13', event_time: '08:30',
    previous: '2.4%', forecast: '2.2%', actual: '',
    description: 'IPC interanual. Si baja de 2.2%, el mercado pondrá >90% de probabilidad a corte en junio. Bullish masivo para crypto.',
    source: 'FRED', is_manual: false, country: 'US',
  },
  {
    id: 'mock_010',
    title: 'Retail Sales (MoM)',
    currency: 'USD', impact: 'MED', type: 'MACRO',
    event_date: '2026-05-15', event_time: '08:30',
    previous: '0.8%', forecast: '0.3%', actual: '',
    description: 'Ventas minoristas de abril. Dato débil confirma desaceleración del consumo → favorable para dovish Fed.',
    source: 'FRED', is_manual: false, country: 'US',
  },
  {
    id: 'mock_011',
    title: 'FOMC Minutes',
    currency: 'USD', impact: 'HIGH', type: 'MACRO',
    event_date: '2026-05-21', event_time: '14:00',
    previous: '', forecast: '', actual: '',
    description: 'Actas detalladas de reunión FOMC de abril. Claridad sobre path de tasas y condiciones para primer corte.',
    source: 'FRED', is_manual: false, country: 'US',
  },
  {
    id: 'mock_012',
    title: 'PCE Price Index — Abril',
    currency: 'USD', impact: 'HIGH', type: 'MACRO',
    event_date: '2026-05-30', event_time: '08:30',
    previous: '2.3%', forecast: '2.1%', actual: '',
    description: 'PCE de abril. Último gran dato antes de FOMC junio. Lectura confirmando desinflación = rally crypto.',
    source: 'FRED', is_manual: false, country: 'US',
  },
  {
    id: 'mock_013',
    title: 'Bitcoin CME Monthly Options Expiry',
    currency: 'BTC', impact: 'MED', type: 'CRYPTO',
    event_date: '2026-05-30', event_time: '16:00',
    previous: '$75.000', forecast: '$82.000 max pain', actual: '',
    description: 'Vencimiento mensual opciones BTC en CME. Max pain estimado $82K. Posible compresión de volatilidad 48h antes.',
    source: 'COINMARKETCAL', is_manual: false, country: '₿',
  },
  // ── Junio 2026 ──────────────────────────────────────────────────────────────
  {
    id: 'mock_014',
    title: 'NFP (Non-Farm Payrolls) — Mayo',
    currency: 'USD', impact: 'HIGH', type: 'MACRO',
    event_date: '2026-06-05', event_time: '08:30',
    previous: '195K', forecast: '182K', actual: '',
    description: 'Último NFP antes de FOMC junio. Dato crucial. Mercado descuenta corte de 25bps con 75% de probabilidad.',
    source: 'FRED', is_manual: false, country: 'US',
  },
  {
    id: 'mock_015',
    title: 'CPI (YoY) — Mayo',
    currency: 'USD', impact: 'HIGH', type: 'MACRO',
    event_date: '2026-06-11', event_time: '08:30',
    previous: '2.2%', forecast: '2.0%', actual: '',
    description: 'Si CPI llega a 2.0% (target Fed), presión máxima para corte en junio. BTC potencialmente +8–12% en 24h.',
    source: 'FRED', is_manual: false, country: 'US',
  },
  {
    id: 'mock_016',
    title: 'FOMC Decision — Primer Corte',
    currency: 'USD', impact: 'HIGH', type: 'MACRO',
    event_date: '2026-06-17', event_time: '14:00',
    previous: '4.25–4.50%', forecast: '4.00–4.25%', actual: '',
    description: 'Reunión más importante del año. Mercado descuenta primer corte de tasas -25bps. Catalizador masivo para BTC y risk-on.',
    source: 'FRED', is_manual: false, country: 'US',
  },
  {
    id: 'mock_017',
    title: 'Fed Press Conference — Powell',
    currency: 'USD', impact: 'HIGH', type: 'MACRO',
    event_date: '2026-06-17', event_time: '14:30',
    previous: '', forecast: '', actual: '',
    description: 'Conferencia de prensa tras FOMC. El tono dovish/hawkish de Powell mueve mercados ±5% en tiempo real.',
    source: 'FRED', is_manual: false, country: 'US',
  },
  {
    id: 'mock_018',
    title: 'PCE Price Index — Mayo',
    currency: 'USD', impact: 'HIGH', type: 'MACRO',
    event_date: '2026-06-26', event_time: '08:30',
    previous: '2.1%', forecast: '2.0%', actual: '',
    description: 'PCE de mayo post-corte. Si confirma desinflación continua, valida trayectoria dovish Fed para H2 2026.',
    source: 'FRED', is_manual: false, country: 'US',
  },
  {
    id: 'mock_019',
    title: 'Bitcoin Quarterly Options Expiry',
    currency: 'BTC', impact: 'HIGH', type: 'CRYPTO',
    event_date: '2026-06-27', event_time: '16:00',
    previous: '', forecast: '$90.000 max pain', actual: '',
    description: 'Vencimiento trimestral BTC: mayor volumen de opciones del año. Volatilidad esperada ±15% en últimas 72h.',
    source: 'COINMARKETCAL', is_manual: false, country: '₿',
  },
  {
    id: 'mock_020',
    title: 'Solana Breakpoint Conference',
    currency: 'SOL', impact: 'MED', type: 'CRYPTO',
    event_date: '2026-06-20', event_time: '09:00',
    previous: '', forecast: '', actual: '',
    description: 'Conferencia anual de desarrolladores Solana. Posibles anuncios de mejoras de red, nuevos proyectos DeFi y partnerships.',
    source: 'COINMARKETCAL', is_manual: false, country: '₿',
  },
]
