import { Row, Column, Text, Section } from '@react-email/components'
import * as React from 'react'
import { Base, CTAButton, Label, GOLD, TEXT, MUTED, BG } from './_base'

export interface WelcomeEmailProps {
  firstName: string
  dashboardUrl?: string
}

export default function WelcomeEmail({
  firstName = 'Trader',
  dashboardUrl = 'https://sigma-research.io/home',
}: WelcomeEmailProps) {
  return (
    <Base preview={`Bienvenido a Sigma Research, ${firstName}`}>
      <Section style={{ padding: '32px 32px 8px' }}>
        <Label>// BIENVENIDO</Label>
        <Text style={{ margin: '0 0 20px', fontSize: '32px', fontWeight: 'bold', color: TEXT, letterSpacing: '0.05em' }}>
          HOLA, {firstName.toUpperCase()}
        </Text>
        <Text style={{ margin: '0 0 16px', fontSize: '13px', color: MUTED, lineHeight: '1.8' }}>
          Tu cuenta en Sigma Research está activa. Ahora tienes acceso a la plataforma
          de inteligencia cuantitativa más completa para traders independientes.
        </Text>
        <Text style={{ margin: '0 0 24px', fontSize: '13px', color: MUTED, lineHeight: '1.8' }}>
          Desde el dashboard puedes explorar señales ML en vivo, la calculadora FIRE,
          el Motor Monte Carlo, posiciones LP DeFi y los reportes mensuales con análisis cuantitativo.
        </Text>
        <CTAButton href={dashboardUrl}>IR AL DASHBOARD →</CTAButton>
      </Section>

      <Section style={{ padding: '24px 32px' }}>
        <Row>
          {[
            { icon: '⚡', title: 'HUD EN VIVO', desc: 'Señales y precios en tiempo real' },
            { icon: '🔥', title: 'FIRE PLANNER', desc: 'Proyecta tu independencia financiera' },
            { icon: '📊', title: 'MONTE CARLO', desc: 'Simula escenarios de riesgo' },
          ].map(f => (
            <Column key={f.title} style={{ paddingRight: '12px' }}>
              <Text style={{ margin: '0 0 4px', fontSize: '18px' }}>{f.icon}</Text>
              <Text style={{ margin: '0 0 2px', fontSize: '11px', color: GOLD, letterSpacing: '0.15em' }}>{f.title}</Text>
              <Text style={{ margin: 0, fontSize: '11px', color: '#666666' }}>{f.desc}</Text>
            </Column>
          ))}
        </Row>
      </Section>

      <Section style={{ padding: '0 32px 32px' }}>
        <Text style={{ margin: 0, fontSize: '12px', color: '#444444', lineHeight: '1.8', borderTop: '1px solid #1a1a1a', paddingTop: '20px' }}>
          Si tienes alguna consulta escríbenos a{' '}
          <a href="mailto:soporte@sigma-research.io" style={{ color: GOLD }}>soporte@sigma-research.io</a>
          {' '}— respondemos en menos de 24h en días laborables.
        </Text>
      </Section>
    </Base>
  )
}
