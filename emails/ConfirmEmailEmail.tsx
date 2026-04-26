import { Row, Column, Text, Section } from '@react-email/components'
import * as React from 'react'
import { Base, CTAButton, Label, TEXT, MUTED, GOLD } from './_base'

export interface ConfirmEmailProps {
  firstName: string
  confirmUrl: string
}

export default function ConfirmEmailEmail({
  firstName = 'Trader',
  confirmUrl = 'https://sigma-research.io/auth/callback?token=xxx',
}: ConfirmEmailProps) {
  return (
    <Base preview={`Confirma tu cuenta en Sigma Research, ${firstName}`}>
      <Section style={{ padding: '32px 32px 8px' }}>
        <Label>// VERIFICA TU EMAIL</Label>
        <Text style={{ margin: '0 0 20px', fontSize: '28px', fontWeight: 'bold', color: TEXT, letterSpacing: '0.05em' }}>
          CONFIRMA TU CUENTA
        </Text>
        <Text style={{ margin: '0 0 16px', fontSize: '13px', color: MUTED, lineHeight: '1.8' }}>
          Hola {firstName}, gracias por registrarte. Para activar tu cuenta y comenzar
          a usar Sigma Research haz clic en el botón de abajo.
        </Text>
        <CTAButton href={confirmUrl}>CONFIRMAR MI CUENTA →</CTAButton>
      </Section>

      <Section style={{ padding: '24px 32px 32px' }}>
        <Row>
          <Column style={{ backgroundColor: '#0f0f0f', padding: '16px', borderLeft: `3px solid ${GOLD}` }}>
            <Text style={{ margin: '0 0 4px', fontSize: '11px', color: GOLD, letterSpacing: '0.15em' }}>⏱ IMPORTANTE</Text>
            <Text style={{ margin: 0, fontSize: '12px', color: '#777777', lineHeight: '1.8' }}>
              Este enlace expira en <strong style={{ color: TEXT }}>24 horas</strong>.
              Si no creaste esta cuenta, puedes ignorar este email con seguridad.
            </Text>
          </Column>
        </Row>

        <Text style={{ margin: '24px 0 0', fontSize: '11px', color: '#444444', lineHeight: '1.8' }}>
          Si el botón no funciona, copia y pega este enlace en tu navegador:
          <br />
          <a href={confirmUrl} style={{ color: GOLD, wordBreak: 'break-all' }}>{confirmUrl}</a>
        </Text>
      </Section>
    </Base>
  )
}
