import { Row, Column, Text, Section } from '@react-email/components'
import * as React from 'react'
import { Base, CTAButton, Label, TEXT, MUTED, GOLD, DIM } from './_base'

export interface MarketingOfferEmailProps {
  title: string
  subtitle?: string
  body: string
  ctaText: string
  ctaUrl: string
  unsubscribeUrl?: string
}

export default function MarketingOfferEmail({
  title = 'Oferta Especial',
  subtitle,
  body = 'Contenido del email',
  ctaText = 'VER OFERTA',
  ctaUrl = 'https://sigma-research.io',
  unsubscribeUrl = 'https://sigma-research.io/unsubscribe',
}: MarketingOfferEmailProps) {
  return (
    <Base preview={`${title} — Sigma Research`}>
      <Section style={{ padding: '32px 32px 8px' }}>
        <Label>// SIGMA RESEARCH</Label>
        <Text style={{ margin: '0 0 8px', fontSize: '30px', fontWeight: 'bold', color: TEXT, letterSpacing: '0.05em', lineHeight: '1.1' }}>
          {title.toUpperCase()}
        </Text>
        {subtitle && (
          <Text style={{ margin: '0 0 20px', fontSize: '16px', color: GOLD, letterSpacing: '0.1em' }}>
            {subtitle}
          </Text>
        )}
        <Text style={{ margin: '0 0 28px', fontSize: '13px', color: MUTED, lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
          {body}
        </Text>
        <CTAButton href={ctaUrl}>{`${ctaText} →`}</CTAButton>
      </Section>

      <Section style={{ padding: '32px 32px 24px' }}>
        <Row style={{ borderTop: '1px solid #1a1a1a', paddingTop: '20px' }}>
          <Column>
            <Text style={{ margin: 0, fontSize: '11px', color: DIM, lineHeight: '1.8' }}>
              Recibes este email porque estás suscrito a Sigma Research.
              <br />
              <a href={unsubscribeUrl} style={{ color: '#555555', textDecoration: 'underline' }}>
                Cancelar suscripción
              </a>
              {' · '}
              <a href="https://sigma-research.io/privacidad" style={{ color: '#555555', textDecoration: 'underline' }}>
                Política de privacidad
              </a>
            </Text>
          </Column>
        </Row>
      </Section>
    </Base>
  )
}
