// ─── Retos diarios FIRE — datos compartidos ──────────────────────────────────
// Vive fuera de FireChallenges.tsx ('use client') para que el cron del servidor
// (/api/cron/fire-daily-reminder) pueda anunciar el reto concreto del día en vez
// de un texto genérico. Una sola fuente de verdad para ambos.

export interface DailyChallenge {
  id:        string
  glyph:     string           // clave en GLYPHS (FireVisuals) — se dibuja, no es emoji
  title:     string
  desc:      string
  amountBase: number          // 0 = no monetary component
  unitFn:    (amt: number) => string
  impactFn:  (amt: number) => string
}

export function getToday(): string { return new Date().toISOString().split('T')[0] }

export function getWeekKey(d = new Date()): string {
  const year  = d.getFullYear()
  const start = new Date(year, 0, 1)
  const week  = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
  return `${year}-W${week}`
}

// El monto se escala al ahorro real del usuario, no es un número fijo.
export function scaleAmt(ahorro: number, base: number): number {
  if (base === 0) return 0
  const factor = ahorro < 500 ? 0.5 : ahorro < 2000 ? 1 : 2
  return Math.max(1, Math.round(base * factor))
}

export function fmtUSD(n: number): string {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${Math.round(n)}`
}

// ─── Challenge data ───────────────────────────────────────────────────────────
// 3 sets de 7 retos diarios, rotan por semana (weekNum % 3) para que el mismo
// día de la semana no muestre siempre el mismo reto — antes era 1 set fijo
// para siempre, se sentía repetitivo a las pocas semanas.
const DAILY_1: DailyChallenge[] = [
  // 0 Sun
  {
    id: 'sun', glyph: 'calendar',
    title: 'Planifica la semana financiera',
    desc:  'Define tu presupuesto de la semana, revisa tus metas FIRE y ajusta el slider de ahorro si cambiaste ingresos.',
    amountBase: 0,
    unitFn:    () => 'Plan semanal listo',
    impactFn:  () => 'Planificación semanal reduce el gasto promedio un 23% según estudios conductuales',
  },
  // 1 Mon
  {
    id: 'mon', glyph: 'bolt',
    title: 'El café de hoy, al portafolio',
    desc:  'Transfiere al ahorro en vez de un gasto extra. Pequeño sacrificio, gran impacto compuesto.',
    amountBase: 2,
    unitFn:    (a) => `+${fmtUSD(a)} hoy`,
    impactFn:  (a) => {
      const yr  = fmtUSD(a * 365)
      const dec = fmtUSD(Math.round(a * 365 * ((Math.pow(1.08, 10) - 1) / 0.08)))
      return `Repetido 1 año → +${yr} · Al 8% anual en 10 años → +${dec}`
    },
  },
  // 2 Tue
  {
    id: 'tue', glyph: 'tag',
    title: 'Día sin compras impulsivas',
    desc:  'Pausa cualquier compra no planificada por 24h. Si mañana igual la quieres, entonces cómprala.',
    amountBase: 0,
    unitFn:    () => '$0 gasto impulsivo',
    impactFn:  () => 'El usuario promedio ahorra $18/mes practicando esta regla',
  },
  // 3 Wed
  {
    id: 'wed', glyph: 'chartUp',
    title: 'Revisa tu equity curve',
    desc:  'Abre el HUD y revisa el rendimiento de tus modelos activos. Toma nota de una mejora posible.',
    amountBase: 0,
    unitFn:    () => '1 insight de mercado',
    impactFn:  () => 'Traders que revisan métricas semanalmente mejoran su win rate un 12%',
  },
  // 4 Thu
  {
    id: 'thu', glyph: 'target',
    title: 'Busca ingresos extra hoy',
    desc:  'Vende algo que no uses, ofrece un servicio pequeño o negocia un descuento.',
    amountBase: 5,
    unitFn:    (a) => `+${fmtUSD(a)} ingreso extra`,
    impactFn:  (a) => `Si lo haces 2× semana → +${fmtUSD(a * 2 * 52)}/año al portafolio`,
  },
  // 5 Fri
  {
    id: 'fri', glyph: 'calc',
    title: 'Calcula tu tasa de ahorro real',
    desc:  'Divide tu ahorro mensual entre tu ingreso total. Si es menor al 20%, ajusta un gasto esta semana.',
    amountBase: 0,
    unitFn:    () => 'Tasa de ahorro ≥ 20%',
    impactFn:  () => 'Subir del 10% al 20% de ahorro puede adelantar tu FIRE hasta 7 años',
  },
  // 6 Sat
  {
    id: 'sat', glyph: 'book',
    title: 'Lee 10 páginas sobre finanzas',
    desc:  '"The Psychology of Money", "A Random Walk Down Wall Street" o cualquier libro financiero.',
    amountBase: 0,
    unitFn:    () => '10 páginas leídas',
    impactFn:  () => '1 libro/mes = 12 libros/año. El conocimiento es el activo que más compone',
  },
]

const DAILY_2: DailyChallenge[] = [
  // 0 Sun
  {
    id: 'sun2', glyph: 'search',
    title: 'Audita tus suscripciones activas',
    desc:  'Revisa streaming, apps y membresías. Detecta al menos una que no usas hace más de un mes.',
    amountBase: 0,
    unitFn:    () => '1 suscripción auditada',
    impactFn:  () => 'El usuario promedio paga por 2-3 suscripciones que olvidó cancelar',
  },
  // 1 Mon
  {
    id: 'mon2', glyph: 'repeat',
    title: 'Automatiza una transferencia a tu ahorro',
    desc:  'Programa una transferencia automática, aunque sea pequeña. Quitarle la decisión al futuro-tú.',
    amountBase: 3,
    unitFn:    (a) => `+${fmtUSD(a)} automatizado`,
    impactFn:  (a) => `El ahorro automático es ~3x más consistente que el manual · proyectado a 1 año: +${fmtUSD(a * 365)}`,
  },
  // 2 Tue
  {
    id: 'tue2', glyph: 'tag',
    title: 'Compara precios antes de comprar algo',
    desc:  'Antes de tu próxima compra, compara al menos 2 alternativas de precio.',
    amountBase: 0,
    unitFn:    () => '$0 en sobreprecio',
    impactFn:  () => 'Comparar precios ahorra en promedio 8-15% en compras no rutinarias',
  },
  // 3 Wed
  {
    id: 'wed2', glyph: 'chartDown',
    title: 'Revisa el drawdown de tu portafolio',
    desc:  'Abre el HUD y revisa cuánto ha caído tu equity curve desde su máximo. Conocerlo evita el pánico.',
    amountBase: 0,
    unitFn:    () => '1 revisión de riesgo',
    impactFn:  () => 'Conocer tu drawdown máximo real reduce la probabilidad de vender en pánico',
  },
  // 4 Thu
  {
    id: 'thu2', glyph: 'phone',
    title: 'Negocia una cuenta o servicio fijo',
    desc:  'Llama a tu compañía de internet, celular o luz y pide un mejor plan. Casi siempre hay margen.',
    amountBase: 4,
    unitFn:    (a) => `+${fmtUSD(a)} negociado`,
    impactFn:  (a) => `Repetido cada 6 meses → +${fmtUSD(a * 2 * 12)}/año al portafolio`,
  },
  // 5 Fri
  {
    id: 'fri2', glyph: 'doc',
    title: 'Registra todos tus gastos de la semana',
    desc:  'Anota cada gasto, sin excepción, aunque sea $1. El gasto hormiga se esconde en lo que no anotas.',
    amountBase: 0,
    unitFn:    () => 'Semana registrada',
    impactFn:  () => 'Llevar registro de gastos reduce el gasto hormiga hasta un 15%',
  },
  // 6 Sat
  {
    id: 'sat2', glyph: 'book',
    title: 'Aprende sobre un instrumento de inversión nuevo',
    desc:  'ETFs, bonos, REITs — elige uno que no conozcas y entiende cómo funciona.',
    amountBase: 0,
    unitFn:    () => '1 instrumento nuevo',
    impactFn:  () => 'Diversificar tu conocimiento reduce el riesgo de decisiones impulsivas',
  },
]

const DAILY_3: DailyChallenge[] = [
  // 0 Sun
  {
    id: 'sun3', glyph: 'target',
    title: 'Define una meta de ahorro para el mes',
    desc:  'Pon un número concreto, no "ahorrar más". Lo que se mide, se mejora.',
    amountBase: 0,
    unitFn:    () => 'Meta del mes definida',
    impactFn:  () => 'Metas específicas y medibles se cumplen ~2x más que metas vagas',
  },
  // 1 Mon
  {
    id: 'mon3', glyph: 'box',
    title: 'Vende algo que no usas',
    desc:  'Ropa, electrónica, lo que sea. Convierte desorden en capital FIRE.',
    amountBase: 6,
    unitFn:    (a) => `+${fmtUSD(a)} ingreso extra`,
    impactFn:  (a) => `Repetido 1 vez al mes → +${fmtUSD(a * 12)}/año`,
  },
  // 2 Tue
  {
    id: 'tue3', glyph: 'pot',
    title: 'Día sin delivery ni comida fuera',
    desc:  'Cocina todas tus comidas hoy. Simple, pero el ahorro se acumula rápido.',
    amountBase: 0,
    unitFn:    () => '$0 en delivery',
    impactFn:  () => 'Cocinar en casa un día ahorra en promedio $8-12 vs. pedir comida',
  },
  // 3 Wed
  {
    id: 'wed3', glyph: 'compass',
    title: 'Revisa el ranking de tus modelos activos',
    desc:  'Abre /modelos o /terminal y revisa cuál estrategia está rindiendo mejor este mes.',
    amountBase: 0,
    unitFn:    () => '1 revisión de modelos',
    impactFn:  () => 'Entender qué mueve tu rendimiento te hace un inversionista más consciente',
  },
  // 4 Thu
  {
    id: 'thu3', glyph: 'briefcase',
    title: 'Ofrece un servicio o freelance hoy',
    desc:  'Una habilidad tuya, aunque sea pequeña, puede generar ingreso extra hoy mismo.',
    amountBase: 7,
    unitFn:    (a) => `+${fmtUSD(a)} ingreso extra`,
    impactFn:  (a) => `Si lo repites 1×/semana → +${fmtUSD(a * 52)}/año al portafolio`,
  },
  // 5 Fri
  {
    id: 'fri3', glyph: 'shield',
    title: 'Calcula tu fondo de emergencia',
    desc:  '¿Cuántos meses de gastos cubre tu efectivo disponible? La meta sana es 3-6 meses.',
    amountBase: 0,
    unitFn:    () => 'Fondo de emergencia calculado',
    impactFn:  () => 'Tener 3-6 meses cubiertos evita vender inversiones en una emergencia',
  },
  // 6 Sat
  {
    id: 'sat3', glyph: 'speak',
    title: 'Comparte lo que aprendiste esta semana',
    desc:  'Cuéntale a alguien (o escríbelo) un aprendizaje financiero de esta semana.',
    amountBase: 0,
    unitFn:    () => '1 aprendizaje compartido',
    impactFn:  () => 'Enseñar refuerza tu propio aprendizaje mucho más que solo leer',
  },
]

const DAILY_4: DailyChallenge[] = [
  // 0 Sun
  {
    id: 'sun4', glyph: 'scale',
    title: 'Revisa tu asignación de activos',
    desc:  'Mira qué porcentaje tienes en cripto, acciones y efectivo. ¿Se parece a tu perfil de riesgo real?',
    amountBase: 0,
    unitFn:    () => 'Asignación revisada',
    impactFn:  () => 'La asignación de activos explica ~90% de la variabilidad de tus retornos a largo plazo',
  },
  // 1 Mon
  {
    id: 'mon4', glyph: 'bank',
    title: 'Compara comisiones de tu corredora',
    desc:  'Revisa cuánto pagas por operación y custodia. Compara con una alternativa antes de terminar el día.',
    amountBase: 4,
    unitFn:    (a) => `+${fmtUSD(a)}/mes ahorrado`,
    impactFn:  (a) => `Bajar comisiones ${fmtUSD(a)}/mes → +${fmtUSD(a * 12)}/año que se queda componiendo`,
  },
  // 2 Tue
  {
    id: 'tue4', glyph: 'car',
    title: 'Día sin auto ni taxi',
    desc:  'Camina, usa bici o transporte público hoy. Cuenta lo que no gastaste en combustible o viajes.',
    amountBase: 3,
    unitFn:    (a) => `+${fmtUSD(a)} no gastado`,
    impactFn:  (a) => `2 días/semana sin auto → +${fmtUSD(a * 2 * 52)}/año al portafolio`,
  },
  // 3 Wed
  {
    id: 'wed4', glyph: 'calc',
    title: 'Calcula tu patrimonio neto real',
    desc:  'Suma todo lo que tienes y réstale todo lo que debes. Ese número, no tu sueldo, es tu marcador.',
    amountBase: 0,
    unitFn:    () => 'Patrimonio neto calculado',
    impactFn:  () => 'Medir tu patrimonio neto mensual es el hábito #1 de quienes alcanzan FIRE',
  },
  // 4 Thu
  {
    id: 'thu4', glyph: 'percent',
    title: 'Revisa la tasa de tus deudas',
    desc:  'Lista tus deudas por tasa de interés. Cualquiera sobre 15% rinde más pagarla que invertir.',
    amountBase: 0,
    unitFn:    () => 'Deudas ordenadas por tasa',
    impactFn:  () => 'Pagar una deuda al 20% equivale a una inversión garantizada al 20% libre de riesgo',
  },
  // 5 Fri
  {
    id: 'fri4', glyph: 'doc',
    title: 'Aprende sobre impuestos a la inversión',
    desc:  'Entiende cómo tributan tus ganancias de capital. Lo que no sabes te está costando dinero.',
    amountBase: 0,
    unitFn:    () => '1 concepto tributario nuevo',
    impactFn:  () => 'Optimizar la tributación de tu portafolio puede sumar 0.5–1% de retorno neto anual',
  },
  // 6 Sat
  {
    id: 'sat4', glyph: 'search',
    title: 'Audita una suscripción familiar',
    desc:  'Revisa planes compartidos: streaming, nube, celular. Un plan familiar suele costar menos que 3 individuales.',
    amountBase: 0,
    unitFn:    () => '1 plan optimizado',
    impactFn:  () => 'Consolidar servicios en planes familiares ahorra en promedio $12–$25/mes',
  },
]

const DAILY_5: DailyChallenge[] = [
  // 0 Sun
  {
    id: 'sun5', glyph: 'shield',
    title: 'Actualiza tus beneficiarios',
    desc:  'Revisa a quién dejas designado en tus cuentas y seguros. Toma 10 minutos y casi nadie lo hace.',
    amountBase: 0,
    unitFn:    () => 'Beneficiarios al día',
    impactFn:  () => 'Un beneficiario desactualizado puede trabar tu patrimonio por años en sucesión',
  },
  // 1 Mon
  {
    id: 'mon5', glyph: 'percent',
    title: 'Revisa el costo anual de tus fondos',
    desc:  'Busca el "expense ratio" de tus fondos o ETFs. Sobre 1% anual es caro y erosiona el interés compuesto.',
    amountBase: 0,
    unitFn:    () => 'Costos de fondos revisados',
    impactFn:  () => 'Bajar el costo de 1.5% a 0.2% anual puede sumar +30% de capital final en 30 años',
  },
  // 2 Tue
  {
    id: 'tue5', glyph: 'pot',
    title: 'Cocina en lote para la semana',
    desc:  'Prepara varias porciones de una vez. Menos delivery esta semana con cero fuerza de voluntad extra.',
    amountBase: 6,
    unitFn:    (a) => `+${fmtUSD(a)} no gastado`,
    impactFn:  (a) => `Batch-cooking semanal → +${fmtUSD(a * 52)}/año directo al portafolio`,
  },
  // 3 Wed
  {
    id: 'wed5', glyph: 'chartUp',
    title: 'Aprende sobre bonos indexados a inflación',
    desc:  'Entiende cómo funcionan los instrumentos que protegen tu poder adquisitivo (UF, TIPS, linkers).',
    amountBase: 0,
    unitFn:    () => '1 instrumento nuevo entendido',
    impactFn:  () => 'La inflación es el impuesto invisible: 4% anual corta tu poder de compra a la mitad en 18 años',
  },
  // 4 Thu
  {
    id: 'thu5', glyph: 'phone',
    title: 'Compara tu seguro antes de renovar',
    desc:  'Pide al menos 2 cotizaciones alternativas de tu seguro de auto, salud u hogar.',
    amountBase: 5,
    unitFn:    (a) => `+${fmtUSD(a)}/mes ahorrado`,
    impactFn:  (a) => `Cotizar seguros cada año ahorra en promedio ${fmtUSD(a * 12)}/año sin perder cobertura`,
  },
  // 5 Fri
  {
    id: 'fri5', glyph: 'speak',
    title: 'Practica decir que no a un gasto social',
    desc:  'Propone una alternativa más barata en vez de aceptar por inercia. Nadie se ofende, y tú ahorras.',
    amountBase: 8,
    unitFn:    (a) => `+${fmtUSD(a)} no gastado`,
    impactFn:  (a) => `1 vez/semana → +${fmtUSD(a * 52)}/año, sin sacrificar tu vida social`,
  },
  // 6 Sat
  {
    id: 'sat5', glyph: 'box',
    title: 'Dona o vende ropa que no usas',
    desc:  'Revisa tu clóset: lo que no usaste en un año, no lo vas a usar. Conviértelo en capital o espacio.',
    amountBase: 7,
    unitFn:    (a) => `+${fmtUSD(a)} ingreso extra`,
    impactFn:  (a) => `Una limpieza de clóset al trimestre → +${fmtUSD(a * 4)}/año y menos gasto impulsivo`,
  },
]

// 5 sets rotando por semana: el mismo día no repite reto hasta 5 semanas después.
const DAILY_SETS = [DAILY_1, DAILY_2, DAILY_3, DAILY_4, DAILY_5]

/** Reto que corresponde a una fecha dada. Rotación: 5 sets × 7 días. */
export function pickDaily(d = new Date()): DailyChallenge {
  const weekNum = parseInt(getWeekKey(d).split('-W')[1])
  return DAILY_SETS[weekNum % DAILY_SETS.length][d.getDay()]
}
