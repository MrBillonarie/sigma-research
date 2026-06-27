// IBKR Flex Web Service — lectura de Net Asset Value vía token + query id.
// Distinto al fetcher del motor (/opt/sigma/ibkr), que usa una sesión de IB
// Gateway única para el motor. Esto es por-usuario, sin sesión persistente:
// 1) se solicita un statement (SendRequest), 2) se espera a que se genere y
// se descarga (GetStatement, con reintentos), 3) se extrae el NAV total.
//
// Requisito en la cuenta del usuario: la Flex Query configurada debe incluir
// la sección "Net Asset Value" (NAV) o "Equity Summary by Report Date".

const SEND_URL = 'https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.SendRequest'
const POLL_DELAY_MS = 2500
const MAX_POLLS = 5

type FlexResult = { ok: true; usd: number } | { ok: false; error: string }

function extractTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))
  return m ? m[1] : null
}

function extractTotal(xml: string): number | null {
  // EquitySummaryByReportDateInBase Total="12345.67" .../>  (sección NAV más común)
  const m1 = xml.match(/<EquitySummaryByReportDateInBase[^>]*\sTotal="([0-9.\-]+)"/)
  if (m1) return parseFloat(m1[1])
  // <NAV ... Total="12345.67" .../>
  const m2 = xml.match(/<NAV[^>]*\sTotal="([0-9.\-]+)"/)
  if (m2) return parseFloat(m2[1])
  return null
}

export async function getIbkrNetLiquidationUSD(token: string, queryId: string): Promise<FlexResult> {
  try {
    const sendRes = await fetch(`${SEND_URL}?t=${encodeURIComponent(token)}&q=${encodeURIComponent(queryId)}&v=3`, {
      signal: AbortSignal.timeout(15000),
    })
    const sendXml = await sendRes.text()

    if (extractTag(sendXml, 'Status') !== 'Success') {
      const errMsg = extractTag(sendXml, 'ErrorMessage') ?? 'No se pudo solicitar el reporte de IBKR'
      return { ok: false, error: errMsg }
    }
    const refCode = extractTag(sendXml, 'ReferenceCode')
    const getUrl  = extractTag(sendXml, 'Url')
    if (!refCode || !getUrl) return { ok: false, error: 'Respuesta de IBKR sin código de referencia' }

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(r => setTimeout(r, POLL_DELAY_MS))
      const pollRes = await fetch(`${getUrl}?q=${encodeURIComponent(refCode)}&t=${encodeURIComponent(token)}&v=3`, {
        signal: AbortSignal.timeout(15000),
      })
      const xml = await pollRes.text()

      // Mientras se genera, IBKR responde con el mismo formato FlexStatementResponse
      if (xml.includes('<FlexStatementResponse')) {
        const status = extractTag(xml, 'Status')
        if (status === 'Fail') {
          const errMsg = extractTag(xml, 'ErrorMessage') ?? 'Error generando el reporte de IBKR'
          return { ok: false, error: errMsg }
        }
        continue // todavía generándose, reintentar
      }

      const total = extractTotal(xml)
      if (total === null) {
        return { ok: false, error: 'El reporte de IBKR no incluye NAV/Equity Summary — revisa la configuración de tu Flex Query.' }
      }
      return { ok: true, usd: total }
    }

    return { ok: false, error: 'El reporte de IBKR tardó demasiado en generarse. Intenta de nuevo en unos minutos.' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
