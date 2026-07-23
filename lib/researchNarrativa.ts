// Redacción automática de las narrativas del research con Claude.
//
// El generador arma todos los datos duros; lo editorial (frases de sección,
// clave de la semana, idea de la semana) lo escribe este módulo a partir de
// esos datos. Marketing edita después.
//
// Si no hay ANTHROPIC_API_KEY (env o engine/config/secrets.json), devuelve
// null y el informe cae a los placeholders en ámbar — el PDF sale igual.

import { readFileSync } from 'fs'

const SECRETS_PATH = process.env.SIGMA_SECRETS_PATH ?? '/opt/sigma/engine/config/secrets.json'
const MODEL = 'claude-opus-4-8'

// Los huecos editoriales del informe, con la instrucción de qué va en cada uno.
export interface Narrativas {
  clave:        string   // Sección 01 · CLAVE DE LA SEMANA (una frase)
  estado:       string   // Sección 02 · dos párrafos de cierre semanal
  lecturaGeneral: string // Sección 02 · lectura general del panel
  btc:          string   // Sección 03 · narrativa BTC (dos párrafos)
  diferenciaBtc: string  // Sección 03 · diferencia clave (una a dos frases)
  usa:          string   // Sección 04
  cross:        string   // Sección 05
  metales:      string   // Sección 06
  energia:      string   // Sección 07
  idea:         string   // Sección 08 · idea de la semana
  resultados:   string   // Resultados del motor · comentario de la semana
}

const CLAVES = [
  'clave', 'estado', 'lecturaGeneral', 'btc', 'diferenciaBtc',
  'usa', 'cross', 'metales', 'energia', 'idea', 'resultados',
] as const

function apiKey(): string | null {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY
  try {
    const j = JSON.parse(readFileSync(SECRETS_PATH, 'utf8'))
    if (j.ANTHROPIC_API_KEY) return j.ANTHROPIC_API_KEY as string
  } catch { /* sin key: se resuelve como no disponible */ }
  return null
}

const SISTEMA = `Sos el analista de SIGMA Research, un informe cuantitativo semanal de mercados.
Tu voz: método sobre opinión, sobria, precisa, en español rioplatense neutro. Nada de hype ni
promesas. Frases cortas y afirmativas. Nunca das consejo financiero ni recomendás comprar o vender:
describís lo que el motor y los datos muestran.

Escribís las narrativas de un informe cuyos DATOS ya están calculados (te los paso). No inventás
cifras: usás solo las que aparecen en los datos. Si un dato no está, no lo menciones.

Contexto del método: el "motor" es un sistema propio que evalúa cada activo y decide EJECUTAR o
SIN TRADE. SIN TRADE no es fallo: es el sistema negándose a operar sin estructura, timing y control
de riesgo. Nueve de los trece activos se leen de un panel externo (Pine en TradingView) y no tienen
lectura del motor — no afirmes nada del motor sobre ellos.

Tono de las secciones: informás qué pasó y qué mira el método, sin dramatizar.`

function prompt(datos: unknown): string {
  return `Estos son los datos ya calculados de la edición de esta semana (JSON):

${JSON.stringify(datos, null, 2)}

Redactá las narrativas del informe. Devolvé SOLO el objeto con estas claves:
- clave: la CLAVE DE LA SEMANA en una sola frase potente (máx 30 palabras).
- estado: dos párrafos sobre cómo cerró la semana el mercado (renta variable, energía, metales, tasas), usando las variaciones de los datos.
- lecturaGeneral: un párrafo cerrando la lectura del panel de 13 activos (cuántos ejecutables, la actitud general).
- btc: dos párrafos sobre Bitcoin usando su precio, variación y lectura del motor.
- diferenciaBtc: una a dos frases sobre qué distingue a BTC del resto del tablero esta semana.
- usa: un párrafo sobre SPX/SPY/QQQ (son panel Pine, sin lectura del motor).
- cross: un párrafo sobre VIX/DXY/US10Y (panel Pine).
- metales: un párrafo sobre oro y plata (XAU/XAG tienen motor; GLD/SLV son panel).
- energia: un párrafo sobre WTI y Brent (WTI tiene motor; Brent es panel).
- idea: la IDEA DE LA SEMANA: una tesis metodológica breve (2-3 frases) sobre lo que enseña el tablero de esta semana.
- resultados: un comentario de 2-3 frases sobre los resultados reales de la cuenta de Binance de la semana (operaciones, acierto, resultado neto), sobrio y sin promesas.

Cada texto en español, sin markdown, sin títulos, solo el contenido.`
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: Object.fromEntries(CLAVES.map(k => [k, { type: 'string' }])),
  required: [...CLAVES],
}

export async function redactarNarrativas(datos: unknown): Promise<{ narrativas: Narrativas | null; error: string | null }> {
  const key = apiKey()
  if (!key) return { narrativas: null, error: 'Sin ANTHROPIC_API_KEY: narrativas en blanco para completar a mano.' }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      signal: AbortSignal.timeout(55_000),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 6000,
        thinking: { type: 'adaptive' },
        output_config: {
          effort: 'low',                 // redacción desde datos dados, no razonamiento profundo
          format: { type: 'json_schema', schema: SCHEMA },
        },
        system: SISTEMA,
        messages: [{ role: 'user', content: prompt(datos) }],
      }),
    })

    if (!res.ok) {
      const detalle = await res.text().catch(() => '')
      return { narrativas: null, error: `Claude ${res.status}: ${detalle.slice(0, 200)}` }
    }

    const json = await res.json()
    if (json.stop_reason === 'refusal') {
      return { narrativas: null, error: 'Claude declinó la redacción; completar a mano.' }
    }

    // El texto vive en el primer bloque de tipo "text" (los "thinking" van aparte).
    const texto = (json.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('')
      .trim()

    const parsed = JSON.parse(texto) as Partial<Narrativas>
    // Solo se aceptan claves esperadas y no vacías; el resto queda como placeholder.
    const out = {} as Narrativas
    let algo = false
    for (const k of CLAVES) {
      const v = parsed[k]
      if (typeof v === 'string' && v.trim()) { out[k] = v.trim(); algo = true }
    }
    if (!algo) return { narrativas: null, error: 'Claude no devolvió narrativas utilizables.' }
    return { narrativas: out, error: null }
  } catch (e) {
    return { narrativas: null, error: e instanceof Error ? e.message : String(e) }
  }
}
