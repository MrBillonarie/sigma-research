import { Resend } from 'resend'
import { render } from '@react-email/render'
import * as React from 'react'

import WelcomeEmail             from '@/emails/WelcomeEmail'
import ConfirmEmailEmail        from '@/emails/ConfirmEmailEmail'
import ResetPasswordEmail       from '@/emails/ResetPasswordEmail'
import ContactReplyEmail        from '@/emails/ContactReplyEmail'
import ContactNotificationEmail from '@/emails/ContactNotificationEmail'
import MarketingOfferEmail      from '@/emails/MarketingOfferEmail'

// ─── Client ───────────────────────────────────────────────────────────────────
function getResend() { return new Resend(process.env.RESEND_API_KEY) }

const FROM     = process.env.EMAIL_FROM     ?? 'onboarding@resend.dev'
const ADMIN_TO = process.env.EMAIL_ADMIN_TO ?? 'alonsomoyanoreyes@gmail.com'
const APP_URL  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sigma-research.io'

type SendResult = { success: boolean; error?: string }

async function toHtml(el: React.ReactElement): Promise<string> {
  return render(el)
}

// ─── Welcome ──────────────────────────────────────────────────────────────────
export async function sendWelcome(to: string, firstName: string): Promise<SendResult> {
  try {
    const html = await toHtml(React.createElement(WelcomeEmail, { firstName, dashboardUrl: `${APP_URL}/home` }))
    const { error } = await getResend().emails.send({ from: FROM, to, subject: 'Bienvenido a Sigma Research', html })
    if (error) { console.error('[email:welcome]', error); return { success: false, error: error.message } }
    return { success: true }
  } catch (e) { console.error('[email:welcome]', e); return { success: false, error: 'Error al enviar bienvenida' } }
}

// ─── Confirmation ─────────────────────────────────────────────────────────────
export async function sendConfirmationEmail(to: string, firstName: string, token: string): Promise<SendResult> {
  try {
    const confirmUrl = `${APP_URL}/auth/callback?token=${encodeURIComponent(token)}&type=signup`
    const html = await toHtml(React.createElement(ConfirmEmailEmail, { firstName, confirmUrl }))
    const { error } = await getResend().emails.send({ from: FROM, to, subject: 'Confirma tu cuenta en Sigma Research', html })
    if (error) { console.error('[email:confirm]', error); return { success: false, error: error.message } }
    return { success: true }
  } catch (e) { console.error('[email:confirm]', e); return { success: false, error: 'Error al enviar confirmación' } }
}

// ─── Reset password ───────────────────────────────────────────────────────────
export async function sendResetPasswordEmail(to: string, firstName: string, token: string): Promise<SendResult> {
  try {
    const resetUrl = `${APP_URL}/auth/callback?token=${encodeURIComponent(token)}&type=recovery`
    const html = await toHtml(React.createElement(ResetPasswordEmail, { firstName, resetUrl }))
    const { error } = await getResend().emails.send({ from: FROM, to, subject: 'Restablece tu contraseña — Sigma Research', html })
    if (error) { console.error('[email:reset]', error); return { success: false, error: error.message } }
    return { success: true }
  } catch (e) { console.error('[email:reset]', e); return { success: false, error: 'Error al enviar recuperación' } }
}

// ─── Contact reply → user ─────────────────────────────────────────────────────
export async function sendContactReply(to: string, name: string, motivo: string, mensaje: string): Promise<SendResult> {
  try {
    const html = await toHtml(React.createElement(ContactReplyEmail, { name, motivo, mensaje }))
    const { error } = await getResend().emails.send({ from: FROM, to, subject: 'Hemos recibido tu mensaje — Sigma Research', html })
    if (error) { console.error('[email:contact-reply]', error); return { success: false, error: error.message } }
    return { success: true }
  } catch (e) { console.error('[email:contact-reply]', e); return { success: false, error: 'Error al confirmar al usuario' } }
}

// ─── Contact notification → admin ─────────────────────────────────────────────
export async function sendContactoNotif(data: {
  nombre: string; email: string; empresa?: string; motivo?: string; mensaje: string
}): Promise<SendResult> {
  try {
    const html = await toHtml(React.createElement(ContactNotificationEmail, data))
    const { error } = await getResend().emails.send({
      from: FROM, to: ADMIN_TO, replyTo: data.email,
      subject: `[Sigma] Nuevo contacto de ${data.nombre}`, html,
    })
    if (error) { console.error('[email:contact-notif]', error); return { success: false, error: error.message } }
    return { success: true }
  } catch (e) { console.error('[email:contact-notif]', e); return { success: false, error: 'Error en notificación interna' } }
}

// ─── Marketing ────────────────────────────────────────────────────────────────
export interface MarketingPayload { title: string; subtitle?: string; body: string; ctaText: string; ctaUrl: string }

export async function sendMarketingEmail(recipients: string[], subject: string, payload: MarketingPayload): Promise<SendResult> {
  try {
    const html = await toHtml(React.createElement(MarketingOfferEmail, payload))
    const results = await Promise.allSettled(recipients.map(to => getResend().emails.send({ from: FROM, to, subject, html })))
    const failed = results.filter(r => r.status === 'rejected').length
    if (failed) console.warn(`[email:marketing] ${failed}/${recipients.length} failed`)
    return { success: failed < recipients.length }
  } catch (e) { console.error('[email:marketing]', e); return { success: false, error: 'Error en envío masivo' } }
}

// ─── Reporte mensual (legacy HTML — works fine without migration) ──────────────
function base(body: string) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Courier New',monospace;color:#e5e5e5">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px">
<tr><td align="center"><table width="100%" style="max-width:560px;background:#111;border:1px solid #222">
<tr><td style="padding:24px 32px;border-bottom:1px solid #222">
<span style="display:inline-block;width:28px;height:28px;border:1px solid #d4af37;text-align:center;line-height:28px;font-size:14px;font-weight:bold;color:#d4af37">Σ</span>
<span style="margin-left:10px;font-size:13px;letter-spacing:0.3em;color:#e5e5e5;vertical-align:middle">SIGMA RESEARCH</span>
</td></tr>${body}
<tr><td style="padding:20px 32px;border-top:1px solid #222">
<p style="margin:0;font-size:11px;color:#555;letter-spacing:0.1em">© ${new Date().getFullYear()} Sigma Research · Inteligencia cuantitativa</p>
</td></tr></table></td></tr></table></body></html>`
}

export function nuevoReporteHtml(nombre: string, r: { numero: number; titulo: string; fecha: string; descripcion: string }) {
  const num = String(r.numero).padStart(3, '0')
  return base(`
    <tr><td style="padding:32px 32px 8px">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.3em;color:#d4af37">// NUEVO REPORTE DISPONIBLE</p>
      <h1 style="margin:0 0 8px;font-size:40px;font-weight:bold;color:#d4af37">#${num}</h1>
      <h2 style="margin:0 0 20px;font-size:20px;font-weight:bold;color:#e5e5e5">${r.titulo}</h2>
      <p style="margin:0 0 8px;font-size:11px;color:#555;letter-spacing:0.2em">${r.fecha}</p>
      <p style="margin:0 0 28px;font-size:13px;color:#999;line-height:1.8">${r.descripcion}</p>
      <a href="${APP_URL}/reportes" style="display:inline-block;background:#d4af37;color:#0a0a0a;padding:12px 28px;font-size:13px;letter-spacing:0.2em;text-decoration:none;font-weight:bold">VER REPORTE</a>
    </td></tr>
    <tr><td style="padding:24px 32px 32px"><p style="margin:0;font-size:11px;color:#555">Hola ${nombre}, tienes acceso a este reporte como suscriptor activo.</p></td></tr>`)
}

export async function sendNuevoReporte(
  subscribers: { email: string; nombre: string }[],
  reporte: { numero: number; titulo: string; fecha: string; descripcion: string },
): Promise<SendResult> {
  try {
    await Promise.allSettled(subscribers.map(s =>
      getResend().emails.send({
        from: FROM, to: s.email,
        subject: `Sigma Research · Nuevo reporte #${String(reporte.numero).padStart(3, '0')} disponible`,
        html: nuevoReporteHtml(s.nombre, reporte),
      })
    ))
    return { success: true }
  } catch (e) { console.error('[email:reporte]', e); return { success: false, error: 'Error al enviar reporte' } }
}
