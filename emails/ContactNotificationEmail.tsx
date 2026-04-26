import { Row, Column, Text, Section } from '@react-email/components'
import * as React from 'react'
import { Base, Label, TEXT, MUTED, GOLD, BG, DIM } from './_base'

export interface ContactNotificationEmailProps {
  nombre: string
  email: string
  empresa?: string
  motivo?: string
  mensaje: string
}

export default function ContactNotificationEmail({
  nombre = 'Usuario',
  email = 'user@example.com',
  empresa,
  motivo,
  mensaje = '',
}: ContactNotificationEmailProps) {
  const safeMsg = mensaje.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const rows = [
    ['NOMBRE',  nombre],
    ['EMAIL',   email],
    ['EMPRESA', empresa || '—'],
    ['MOTIVO',  motivo  || '—'],
  ]

  return (
    <Base preview={`[Sigma] Nuevo contacto de ${nombre} — ${email}`}>
      <Section style={{ padding: '32px 32px 8px' }}>
        <Label>// FORMULARIO DE CONTACTO</Label>
        <Text style={{ margin: '0 0 20px', fontSize: '28px', fontWeight: 'bold', color: TEXT, letterSpacing: '0.05em' }}>
          NUEVA SOLICITUD
        </Text>
        <Text style={{ margin: '0 0 4px', fontSize: '11px', color: MUTED }}>
          Responde directamente a este email para contestar al usuario.
        </Text>
      </Section>

      <Section style={{ padding: '0 32px 8px' }}>
        {rows.map(([k, v]) => (
          <Row key={k} style={{ borderBottom: '1px solid #1a1a1a', paddingBottom: '8px', marginBottom: '8px' }}>
            <Column style={{ width: '80px' }}>
              <Text style={{ margin: 0, fontSize: '11px', letterSpacing: '0.2em', color: DIM }}>{k}</Text>
            </Column>
            <Column>
              <Text style={{ margin: 0, fontSize: '13px', color: k === 'EMAIL' ? GOLD : TEXT }}>{v}</Text>
            </Column>
          </Row>
        ))}
      </Section>

      <Section style={{ padding: '8px 32px 32px' }}>
        <Label>// MENSAJE</Label>
        <Row>
          <Column style={{ backgroundColor: BG, padding: '16px', borderLeft: `2px solid ${GOLD}` }}>
            <Text style={{ margin: 0, fontSize: '13px', color: '#aaaaaa', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
              {safeMsg}
            </Text>
          </Column>
        </Row>
      </Section>
    </Base>
  )
}
