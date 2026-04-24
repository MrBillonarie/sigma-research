import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM     = process.env.EMAIL_FROM     ?? 'Sigma Research <noreply@sigma-research.com>'
const ADMIN_TO = process.env.EMAIL_ADMIN_TO ?? 'alonsomoyanoreyes@gmail.com'

// ── Shared styles ─────────────────────────────────────────────────────────────
const base = (body: string) => `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Courier New',monospace;color:#e5e5e5">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#111;border:1px solid #222">
        <!-- Header -->
        <tr><td style="padding:24px 32px;border-bottom:1px solid #222">
          <table width="100%"><tr>
            <td>
              <span style="display:inline-block;width:28px;height:28px;border:1px solid #d4af37;text-align:center;line-height:28px;font-size:14px;font-weight:bold;color:#d4af37">Σ</span>
              <span style="margin-left:10px;font-size:14px;letter-spacing:0.3em;color:#e5e5e5;vertical-align:middle">SIGMA RESEARCH</span>
            </td>
          </tr></table>
        </td></tr>
        <!-- Body -->
        ${body}
        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid #222">
          <p style="margin:0;font-size:11px;color:#555;letter-spacing:0.1em">
            © ${new Date().getFullYear()} Sigma Research · Inteligencia cuantitativa
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

// ── Templates ─────────────────────────────────────────────────────────────────
export function welcomeHtml(nombre: string) {
  return base(`
    <tr><td style="padding:32px 32px 8px">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.3em;color:#d4af37">// BIENVENIDO</p>
      <h1 style="margin:0 0 20px;font-size:32px;font-weight:bold;color:#e5e5e5;letter-spacing:0.05em">
        HOLA, ${nombre.toUpperCase()}
      </h1>
      <p style="margin:0 0 16px;font-size:13px;color:#999;line-height:1.8">
        Tu cuenta en Sigma Research está activa. Ahora tienes acceso a la plataforma de inteligencia cuantitativa.
      </p>
      <p style="margin:0 0 24px;font-size:13px;color:#999;line-height:1.8">
        Desde el dashboard puedes explorar modelos ML, señales activas, la calculadora FIRE y los reportes mensuales.
      </p>
      <a href="https://sigma-research.com/home"
        style="display:inline-block;background:#d4af37;color:#0a0a0a;padding:12px 28px;font-size:13px;letter-spacing:0.2em;text-decoration:none;font-weight:bold">
        IR AL DASHBOARD
      </a>
    </td></tr>
    <tr><td style="padding:24px 32px 32px">
      <p style="margin:0;font-size:12px;color:#555;line-height:1.8">
        Si tienes alguna consulta, responde este email o escríbenos en la sección de contacto.
      </p>
    </td></tr>
  `)
}

export function contactoHtml(data: { nombre: string; email: string; empresa?: string; motivo?: string; mensaje: string }) {
  return base(`
    <tr><td style="padding:32px 32px 8px">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.3em;color:#d4af37">// FORMULARIO DE CONTACTO</p>
      <h1 style="margin:0 0 24px;font-size:28px;font-weight:bold;color:#e5e5e5;letter-spacing:0.05em">
        NUEVA SOLICITUD
      </h1>
    </td></tr>
    <tr><td style="padding:0 32px 32px">
      <table width="100%" style="border-collapse:collapse">
        ${[
          ['Nombre',   data.nombre],
          ['Email',    data.email],
          ['Empresa',  data.empresa || '—'],
          ['Motivo',   data.motivo  || '—'],
        ].map(([k, v]) => `
          <tr>
            <td style="padding:8px 0;font-size:11px;letter-spacing:0.2em;color:#555;white-space:nowrap;width:90px">${k}</td>
            <td style="padding:8px 0;font-size:13px;color:#e5e5e5;border-bottom:1px solid #1a1a1a">${v}</td>
          </tr>`).join('')}
      </table>
      <div style="margin-top:20px;padding:16px;background:#0a0a0a;border-left:2px solid #d4af37">
        <p style="margin:0;font-size:13px;color:#aaa;line-height:1.8;white-space:pre-wrap">${data.mensaje}</p>
      </div>
    </td></tr>
  `)
}

export function nuevoReporteHtml(nombre: string, reporte: { numero: number; titulo: string; fecha: string; descripcion: string }) {
  const num = String(reporte.numero).padStart(3, '0')
  return base(`
    <tr><td style="padding:32px 32px 8px">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.3em;color:#d4af37">// NUEVO REPORTE DISPONIBLE</p>
      <h1 style="margin:0 0 8px;font-size:40px;font-weight:bold;color:#d4af37;letter-spacing:0.05em">#${num}</h1>
      <h2 style="margin:0 0 20px;font-size:20px;font-weight:bold;color:#e5e5e5">${reporte.titulo}</h2>
      <p style="margin:0 0 8px;font-size:11px;color:#555;letter-spacing:0.2em">${reporte.fecha}</p>
      <p style="margin:0 0 28px;font-size:13px;color:#999;line-height:1.8">${reporte.descripcion}</p>
      <a href="https://sigma-research.com/reportes"
        style="display:inline-block;background:#d4af37;color:#0a0a0a;padding:12px 28px;font-size:13px;letter-spacing:0.2em;text-decoration:none;font-weight:bold">
        VER REPORTE
      </a>
    </td></tr>
    <tr><td style="padding:24px 32px 32px">
      <p style="margin:0;font-size:11px;color:#555">
        Hola ${nombre}, tienes acceso a este reporte como suscriptor activo.
      </p>
    </td></tr>
  `)
}

// ── Send helpers ──────────────────────────────────────────────────────────────
export async function sendWelcome(to: string, nombre: string) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: 'Bienvenido a Sigma Research',
    html: welcomeHtml(nombre),
  })
}

export async function sendContactoNotif(data: Parameters<typeof contactoHtml>[0]) {
  return resend.emails.send({
    from: FROM,
    to: ADMIN_TO,
    replyTo: data.email,
    subject: `[Sigma] Nuevo contacto de ${data.nombre}`,
    html: contactoHtml(data),
  })
}

export async function sendNuevoReporte(
  subscribers: { email: string; nombre: string }[],
  reporte: Parameters<typeof nuevoReporteHtml>[1]
) {
  await Promise.all(
    subscribers.map(s =>
      resend.emails.send({
        from: FROM,
        to: s.email,
        subject: `Sigma Research · Nuevo reporte #${String(reporte.numero).padStart(3, '0')} disponible`,
        html: nuevoReporteHtml(s.nombre, reporte),
      })
    )
  )
}
