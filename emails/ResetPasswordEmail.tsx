import { Row, Column, Text, Section } from '@react-email/components'
import * as React from 'react'
import { Base, CTAButton, Label, TEXT, MUTED, GOLD } from './_base'

export interface ResetPasswordEmailProps {
  firstName: string
  resetUrl: string
}

export default function ResetPasswordEmail({
  firstName = 'Trader',
  resetUrl = 'https://sigma-research.io/auth/callback?token=xxx',
}: ResetPasswordEmailProps) {
  return (
    <Base preview="Restablece tu contraseña de Sigma Research">
      <Section style={{ padding: '32px 32px 8px' }}>
        <Label>// SEGURIDAD DE CUENTA</Label>
        <Text style={{ margin: '0 0 20px', fontSize: '28px', fontWeight: 'bold', color: TEXT, letterSpacing: '0.05em' }}>
          NUEVA CONTRASEÑA
        </Text>
        <Text style={{ margin: '0 0 16px', fontSize: '13px', color: MUTED, lineHeight: '1.8' }}>
          Hola {firstName}, recibimos una solicitud para restablecer la contraseña
          de tu cuenta. Haz clic en el botón de abajo para crear una nueva.
        </Text>
        <CTAButton href={resetUrl}>RESTABLECER CONTRASEÑA →</CTAButton>
      </Section>

      <Section style={{ padding: '24px 32px 32px' }}>
        <Row>
          <Column style={{ backgroundColor: '#0f0f0f', padding: '16px', borderLeft: '3px solid #ef4444' }}>
            <Text style={{ margin: '0 0 4px', fontSize: '11px', color: '#ef4444', letterSpacing: '0.15em' }}>⏱ ENLACE TEMPORAL</Text>
            <Text style={{ margin: 0, fontSize: '12px', color: '#777777', lineHeight: '1.8' }}>
              Este enlace expira en <strong style={{ color: TEXT }}>1 hora</strong>.
              Si no solicitaste este cambio, ignora este email — tu contraseña no cambiará.
            </Text>
          </Column>
        </Row>

        <Text style={{ margin: '24px 0 0', fontSize: '11px', color: '#444444', lineHeight: '1.8' }}>
          Si el botón no funciona, copia este enlace:
          <br />
          <a href={resetUrl} style={{ color: GOLD, wordBreak: 'break-all' }}>{resetUrl}</a>
        </Text>

        <Text style={{ margin: '20px 0 0', fontSize: '11px', color: '#444444' }}>
          ¿No solicitaste esto? Escríbenos a{' '}
          <a href="mailto:soporte@sigma-research.io" style={{ color: GOLD }}>soporte@sigma-research.io</a>
        </Text>
      </Section>
    </Base>
  )
}
