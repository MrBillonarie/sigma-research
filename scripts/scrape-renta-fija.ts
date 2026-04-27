/**
 * Scraper de tasas DAP por banco usando Playwright
 * Uso: npx tsx scripts/scrape-renta-fija.ts
 */

import { chromium } from 'playwright'

interface BankRate {
  banco: string
  plazo: string
  tasa: number | null
  moneda: string
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const STEALTH_SCRIPT = `
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] })
  Object.defineProperty(navigator, 'languages', { get: () => ['es-CL','es','en-US','en'] })
  window.chrome = { runtime: {} }
  Object.defineProperty(navigator, 'permissions', { get: () => ({ query: () => Promise.resolve({ state: 'granted' }) }) })
`

async function exploreBank(name: string, url: string): Promise<void> {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'es-CL',
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: {
      'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    }
  })
  await context.addInitScript(STEALTH_SCRIPT)
  const page = await context.newPage()
  const apiCalls: { url: string; body: string }[] = []

  // Interceptar respuestas JSON que puedan tener tasas
  page.on('response', async response => {
    const resUrl = response.url()
    const contentType = response.headers()['content-type'] ?? ''
    if (contentType.includes('json')) {
      try {
        const body = await response.text()
        if (body.includes('tasa') || body.includes('rate') || body.includes('plazo') ||
            body.includes('deposito') || body.includes('dap')) {
          apiCalls.push({ url: resUrl, body: body.slice(0, 800) })
        }
      } catch {}
    }
  })

  try {
    console.log(`\n=== ${name} ===`)
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await sleep(3000)

    // Mostrar llamadas API relevantes interceptadas
    if (apiCalls.length > 0) {
      console.log(`APIs con datos de tasas encontradas: ${apiCalls.length}`)
      apiCalls.forEach(c => {
        console.log('URL:', c.url)
        console.log('Body:', c.body.slice(0, 400))
        console.log('---')
      })
    } else {
      console.log('Sin APIs JSON con datos de tasas')
    }

    // Buscar texto visible con porcentajes
    const bodyText = await page.locator('body').innerText().catch(() => '')
    const pctMatches = bodyText.match(/\d+[,\.]\d+\s*%/g) ?? []
    const plazoMatches = bodyText.match(/\d+\s*d[íi]as?/gi) ?? []
    if (pctMatches.length > 0) console.log('Porcentajes visibles:', Array.from(new Set(pctMatches)).slice(0, 10))
    if (plazoMatches.length > 0) console.log('Plazos visibles:', Array.from(new Set(plazoMatches)).slice(0, 10))

  } catch (e) {
    console.log(`Error ${name}:`, (e as Error).message?.slice(0, 100))
  } finally {
    await context.close()
    await browser.close()
  }
}

async function main() {
  console.log('━━━ Stealth Scraper Tasas DAP ━━━')
  await exploreBank('BancoEstado',    'https://www.bancoestado.cl/content/bancoestado-public/cl/es/home/personas/ahorro-e-inversiones/deposito-a-plazo.html')
  await exploreBank('Banco Security', 'https://www.bancosecurity.cl/personas/inversiones/deposito-a-plazo')
  await exploreBank('Banco BICE',     'https://www.bice.cl/personas/ahorro-e-inversion/deposito-a-plazo')
  await exploreBank('Banco Consorcio','https://www.bancoconsorcio.cl/personas/inversiones/deposito-a-plazo')
  await exploreBank('BTG Pactual',    'https://www.btgpactual.cl/personas/deposito-a-plazo')
  await exploreBank('Banco Ripley',   'https://www.bancoripley.cl/personas/inversiones/deposito-a-plazo')
  console.log('\n━━━ Exploración completa ━━━')
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
