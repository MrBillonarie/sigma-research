import { Row, Column, Text, Section } from '@react-email/components'
import * as React from 'react'
import { Base, Label, TEXT, MUTED, GOLD, BG, DIM } from './_base'

export interface ContactReplyEmailProps {
  name: string
  motivo: string
  mensaje: string
}

export default function ContactReplyEmail({
  name = 'Equipo',
  motivo = 'Consulta general',
  mensaje = 'Mensaje de ejemplo',
}: ContactReplyEmailProps) {
  const safeMsg = mensaje.replace(/</g, '&lt;').replace(/>/g, '&gt;')

  return (
    <Base preview={`Hemos recibido tu mensaje, ${name} — Sigma Research`}>
      <Section style={{ padding: '32px 32px 8px' }}>
        <Label>// SOLICITUD RECIBIDA</Label>
        <Text style={{ margin: '0 0 20px', fontSize: '26px', fontWeight: 'bold', color: TEXT, letterSpacing: '0.05em' }}>
          HOLA, {name.toUpperCase()}
        </Text>
        <Text style={{ margin: '0 0 8px', fontSize: '13px', color: MUTED, lineHeight: '1.8' }}>
          Hemos recibido tu mensaje y nuestro equipo lo revisará a la brevedad.
        </Text>
        <Text style={{ margin: '0 0 24px', fontSize: '13px', color: '#22c55e', lineHeight: '1.8' }}>
          ✓ Te responderemos en menos de 24 horas en días laborables.
        </Text>
      </Section>

      <Section style={{ padding: '0 32px 16px' }}>
        <Label>// RESUMEN DE TU SOLICITUD</Label>
        <Row style={{ marginBottom: '12px' }}>
          <Column style={{ width: '90px' }}>
            <Text style={{ margin: 0, fontSize: '11px', letterSpacing: '0.2em', color: DIM }}>MOTIVO</Text>
          </Column>
          <Column>
            <Text style={{ margin: 0, fontSize: '13px', color: GOLD }}>{motivo}</Text>
          </Column>
        </Row>
        <Row>
          <Column style={{ backgroundColor: BG, padding: '16px', borderLeft: `2px solid ${GOLD}` }}>
            <Text style={{ margin: 0, fontSize: '13px', color: '#aaaaaa', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
              {safeMsg}
            </Text>
          </Column>
        </Row>
      </Section>

      <Section style={{ padding: '16px 32px 32px' }}>
        <Text style={{ margin: 0, fontSize: '11px', color: '#444444', lineHeight: '1.8', borderTop: '1px solid #1a1a1a', paddingTop: '16px' }}>
          Si tienes alguna duda adicional, responde este email o escríbenos directamente a{' '}
          <a href="mailto:soporte@sigma-research.io" style={{ color: GOLD }}>soporte@sigma-research.io</a>
        </Text>
      </Section>
    </Base>
  )
}
