import { Text, Section, Hr } from '@react-email/components'
import * as React from 'react'
import { Base, CTAButton, GOLD, TEXT, MUTED, BORDER } from './_base'

export interface OnboardingCompleteEmailProps {
  firstName: string
  perfil:    'retail' | 'trader' | 'institucional'
  dashboardUrl?: string
}

const PERFILES = {
  retail:        { label: 'INVERSOR',       icon: '◈', color: '#60a5fa' },
  trader:        { label: 'TRADER ACTIVO',  icon: '⚡', color: GOLD },
  institucional: { label: 'INSTITUCIONAL',  icon: '∑',  color: '#a78bfa' },
}

const FEATURES: Record<string, { icon: string; title: string; desc: string }[]> = {
  retail: [
    { icon: '◎', title: 'CALCULADORA FIRE',    desc: 'Proyecta tu independencia financiera con Monte Carlo' },
    { icon: '◈', title: 'PORTAFOLIO',           desc: 'Seguimiento multi-plataforma de tus activos' },
    { icon: '▣', title: 'COMPARADOR FONDOS',    desc: 'ETFs, fondos mutuos y depósitos a plazo en CL' },
  ],
  trader: [
    { icon: '⚡', title: 'HUD EN VIVO',         desc: 'Señales ML y precios Binance en tiempo real' },
    { icon: '◉', title: 'TRADE JOURNAL',        desc: 'Registra, analiza y exporta tus operaciones' },
    { icon: '∑',  title: 'MOTOR DE DECISIÓN',   desc: 'Señales algorítmicas optimizadas para traders' },
  ],
  institucional: [
    { icon: '∑',  title: 'MOTOR INSTITUCIONAL', desc: 'Análisis cuantitativo de grado profesional' },
    { icon: '◈', title: 'MODELOS ML',           desc: 'HMM, XGBoost, GARCH y PAIRS TRADING en vivo' },
    { icon: '▣', title: 'REPORTES MENSUALES',   desc: 'Deep-dive en modelos con métricas OOS' },
  ],
}

export default function OnboardingCompleteEmail({
  firstName  = 'Trader',
  perfil     = 'trader',
  dashboardUrl = 'https://sigma-research.io/home',
}: OnboardingCompleteEmailProps) {
  const p = PERFILES[perfil]
  const features = FEATURES[perfil]

  return (
    <Base preview={`${firstName}, tu configuración en Sigma Research está lista`}>

      {/* Header */}
      <Section style={{ padding: '32px 32px 8px' }}>
        <Text style={{ margin: '0 0 4px', fontSize: '10px', letterSpacing: '0.3em', color: p.color, textTransform: 'uppercase' }}>
          // CONFIGURACIÓN COMPLETA
        </Text>
        <Text style={{ margin: '0 0 16px', fontSize: '28px', fontWeight: 'bold', color: TEXT, letterSpacing: '0.04em', lineHeight: '1.1' }}>
          TODO LISTO,<br />{firstName.toUpperCase()}
        </Text>
        <Text style={{ margin: '0 0 8px', fontSize: '13px', color: MUTED, lineHeight: '1.8' }}>
          Completaste la configuración inicial. Tu cuenta está optimizada para el perfil{' '}
          <strong style={{ color: p.color }}>{p.icon} {p.label}</strong>.
        </Text>
      </Section>

      <Hr style={{ borderColor: BORDER, margin: '0 32px' }} />

      {/* Features personalizadas */}
      <Section style={{ padding: '24px 32px 8px' }}>
        <Text style={{ margin: '0 0 16px', fontSize: '10px', letterSpacing: '0.25em', color: GOLD, textTransform: 'uppercase' }}>
          // TUS HERRAMIENTAS PRINCIPALES
        </Text>
        {features.map(f => (
          <div key={f.title} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '14px' }}>
            <span style={{ fontSize: '16px', marginRight: '14px', marginTop: '1px', color: p.color, flexShrink: 0, width: '20px' }}>{f.icon}</span>
            <div>
              <Text style={{ margin: '0 0 2px', fontSize: '11px', fontWeight: 'bold', color: TEXT, letterSpacing: '0.1em' }}>
                {f.title}
              </Text>
              <Text style={{ margin: 0, fontSize: '12px', color: MUTED, lineHeight: '1.6' }}>
                {f.desc}
              </Text>
            </div>
          </div>
        ))}
      </Section>

      {/* CTA */}
      <Section style={{ padding: '8px 32px 28px', textAlign: 'center' as const }}>
        <CTAButton href={dashboardUrl}>IR AL DASHBOARD →</CTAButton>
      </Section>

      <Hr style={{ borderColor: BORDER, margin: '0 32px' }} />

      {/* Footer */}
      <Section style={{ padding: '16px 32px 28px' }}>
        <Text style={{ margin: 0, fontSize: '11px', color: '#444444', lineHeight: '1.8' }}>
          ¿Tienes preguntas sobre la plataforma?{' '}
          <a href="mailto:soporte@sigma-research.io" style={{ color: GOLD }}>soporte@sigma-research.io</a>
          {' '}— respondemos en menos de 24h en días laborables.
        </Text>
      </Section>

    </Base>
  )
}
