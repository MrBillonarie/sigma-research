// Renderiza una cadena HTML a PDF con el Chrome headless del VPS.
//
// Se ejecuta como subproceso (child_process), no como librería embebida: si
// Chrome falla o consume memoria, no arrastra al servidor Next. El HTML es
// self-contained (fuentes en base64), así que el navegador no hace ninguna
// petición externa.

import { spawn } from 'child_process'
import { writeFile, readFile, rm, mkdtemp } from 'fs/promises'
import os from 'os'
import path from 'path'

const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome-stable'

export async function htmlAPdf(html: string): Promise<Buffer> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'research-'))
  const htmlPath = path.join(dir, 'in.html')
  const pdfPath  = path.join(dir, 'out.pdf')
  try {
    await writeFile(htmlPath, html, 'utf8')
    await new Promise<void>((resolve, reject) => {
      const p = spawn(CHROME, [
        '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
        '--no-pdf-header-footer',
        `--user-data-dir=${path.join(dir, 'profile')}`,
        `--print-to-pdf=${pdfPath}`,
        `file://${htmlPath}`,
      ], { timeout: 60_000 })
      let err = ''
      p.stderr.on('data', d => { err += String(d) })
      p.on('error', reject)
      p.on('close', code => code === 0 ? resolve() : reject(new Error(`chrome salió ${code}: ${err.slice(-300)}`)))
    })
    return await readFile(pdfPath)
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
