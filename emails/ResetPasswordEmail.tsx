import { Row, Column, Text, Section, Hr } from '@react-email/components'
import * as React from 'react'
import { Base, CTAButton, GOLD, TEXT, MUTED, BG, BORDER } from './_base'

export interface ResetPasswordEmailProps {
  firstName: string
  resetUrl:  string
}

const STEP_STYLE: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', marginBottom: '16px',
}
const NUM_STYLE: React.CSSProperties = {
  display: 'inline-block', width: '22px', height: '22px',
  border: `1px solid ${GOLD}`, borderRadius: '50%',
  textAlign: 'center', lineHeight: '22px',
  fontSize: '11px', fontWeight: 'bold', color: GOLD,
  flexShrink: 0, marginRight: '12px', marginTop: '1px',
}
const STEP_TEXT: React.CSSProperties = {
  margin: 0, fontSize: '12px', color: MUTED, lineHeight: '1.7',
}

export default function ResetPasswordEmail({
  firstName = 'Trader',
  resetUrl  = 'https://sigma-research.vercel.app/auth/callback',
}: ResetPasswordEmailProps) {
  return (
    <Base preview={`${firstName}, restablece tu contraseña de Sigma Research`}>

      {/* ── Encabezado de seguridad ───────────────────────────────────────── */}
      <Section style={{ padding: '28px 32px 0' }}>
        <Text style={{ margin: '0 0 4px', fontSize: '10px', letterSpacing: '0.3em', color: '#ef4444', textTransform: 'uppercase' }}>
          // SEGURIDAD · SOLICITUD DE CAMBIO
        </Text>
        <Text style={{ margin: '0 0 12px', fontSize: '26px', fontWeight: 'bold', color: TEXT, letterSpacing: '0.04em', lineHeight: '1.1' }}>
          RESTABLECE TU<br />CONTRASEÑA
        </Text>
        <Text style={{ margin: '0 0 24px', fontSize: '13px', color: MUTED, lineHeight: '1.8' }}>
          Hola <strong style={{ color: TEXT }}>{firstName}</strong>, recibimos una solicitud para restablecer la contraseña
          de tu cuenta en Sigma Research. Si fuiste tú, sigue los pasos a continuación.
        </Text>
      </Section>

      {/* ── Pasos a seguir ────────────────────────────────────────────────── */}
      <Section style={{ padding: '0 32px 20px' }}>
        <Text style={{ margin: '0 0 14px', fontSize: '10px', letterSpacing: '0.25em', color: GOLD, textTransform: 'uppercase' }}>
          // PASOS A SEGUIR
        </Text>

        {[
          { n: '1', title: 'Haz clic en el botón',      desc: 'Pulsa "Restablecer Contraseña" para ser redirigido a la página segura de Sigma Research.' },
          { n: '2', title: 'Ingresa tu nueva contraseña', desc: 'Elige una contraseña de al menos 8 caracteres. Combina letras, números y símbolos para mayor seguridad.' },
          { n: '3', title: 'Confirma y guarda',          desc: 'Repite la contraseña para confirmarla y haz clic en guardar. Serás redirigido al login automáticamente.' },
        ].map(s => (
          <div key={s.n} style={STEP_STYLE}>
            <span style={NUM_STYLE}>{s.n}</span>
            <Text style={STEP_TEXT}>
              <strong style={{ color: TEXT }}>{s.title}</strong><br />
              {s.desc}
            </Text>
          </div>
        ))}
      </Section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <Section style={{ padding: '0 32px 28px', textAlign: 'center' as const }}>
        <CTAButton href={resetUrl}>RESTABLECER CONTRASEÑA →</CTAButton>
        <Text style={{ margin: '16px 0 0', fontSize: '10px', color: '#444444', textAlign: 'center' as const }}>
          El botón te llevará a una página segura de Sigma Research
        </Text>
      </Section>

      <Hr style={{ borderColor: BORDER, margin: '0 32px' }} />

      {/* ── Advertencia y seguridad ───────────────────────────────────────── */}
      <Section style={{ padding: '20px 32px 8px' }}>
        <Row>
          <Column style={{ backgroundColor: '#0f0f0f', padding: '14px 18px', borderLeft: '3px solid #ef4444', borderRadius: '2px' }}>
            <Text style={{ margin: '0 0 6px', fontSize: '10px', color: '#ef4444', letterSpacing: '0.2em', fontWeight: 'bold' }}>
              ⚠ ENLACE DE USO ÚNICO · EXPIRA EN 1 HORA
            </Text>
            <Text style={{ margin: 0, fontSize: '12px', color: '#777777', lineHeight: '1.7' }}>
              Este enlace es válido por <strong style={{ color: TEXT }}>1 hora</strong> y solo puede usarse una vez.
              Si no solicitaste este cambio, puedes ignorar este email con seguridad —
              tu contraseña actual no cambiará.
            </Text>
          </Column>
        </Row>
      </Section>

      {/* ── Enlace de respaldo ────────────────────────────────────────────── */}
      <Section style={{ padding: '16px 32px 8px' }}>
        <Text style={{ margin: 0, fontSize: '11px', color: '#444444', lineHeight: '1.8' }}>
          Si el botón no funciona, copia y pega este enlace en tu navegador:
        </Text>
        <Text style={{ margin: '6px 0 0', fontSize: '10px', wordBreak: 'break-all' as const }}>
          <a href={resetUrl} style={{ color: GOLD, textDecoration: 'none' }}>{resetUrl}</a>
        </Text>
      </Section>

      {/* ── Soporte ───────────────────────────────────────────────────────── */}
      <Section style={{ padding: '12px 32px 28px' }}>
        <Text style={{ margin: 0, fontSize: '11px', color: '#444444', lineHeight: '1.8', borderTop: `1px solid ${BORDER}`, paddingTop: '16px' }}>
          ¿No reconoces esta solicitud o necesitas ayuda?{' '}
          <a href="mailto:soporte@sigma-research.io" style={{ color: GOLD }}>soporte@sigma-research.io</a>
          {' '}· Respondemos en menos de 24h en días laborables.
        </Text>
      </Section>

    </Base>
  )
}
