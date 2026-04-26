import {
  Html, Head, Body, Container, Section, Row, Column,
  Text, Hr, Preview,
} from '@react-email/components'
import * as React from 'react'

const s = {
  body:      { backgroundColor: '#0a0a0a', fontFamily: "'Courier New', monospace", margin: 0, padding: 0 },
  outer:     { backgroundColor: '#0a0a0a', padding: '40px 16px' },
  card:      { maxWidth: '560px', backgroundColor: '#111111', border: '1px solid #222222' },
  header:    { padding: '24px 32px', borderBottom: '1px solid #222222' },
  logoBox:   { display: 'inline-block', width: '28px', height: '28px', border: '1px solid #d4af37', textAlign: 'center' as const, lineHeight: '28px', fontSize: '14px', fontWeight: 'bold', color: '#d4af37' },
  logoText:  { marginLeft: '10px', fontSize: '13px', letterSpacing: '0.3em', color: '#e5e5e5', verticalAlign: 'middle' },
  footer:    { padding: '20px 32px', borderTop: '1px solid #222222' },
  footerTxt: { margin: 0, fontSize: '11px', color: '#555555', letterSpacing: '0.1em' },
}

export interface BaseProps {
  preview: string
  children: React.ReactNode
}

export const GOLD   = '#d4af37'
export const BG     = '#0a0a0a'
export const CARD   = '#111111'
export const BORDER = '#222222'
export const TEXT   = '#e5e5e5'
export const MUTED  = '#999999'
export const DIM    = '#555555'
export const GREEN  = '#22c55e'

export function Base({ preview, children }: BaseProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={s.body}>
        <Container style={s.outer}>
          <Section style={s.card}>
            {/* Header */}
            <Row style={s.header}>
              <Column>
                <span style={s.logoBox}>Σ</span>
                <span style={s.logoText}>SIGMA RESEARCH</span>
              </Column>
            </Row>

            {/* Content */}
            {children}

            {/* Footer */}
            <Hr style={{ borderColor: BORDER, margin: 0 }} />
            <Row style={s.footer}>
              <Column>
                <Text style={s.footerTxt}>
                  © {new Date().getFullYear()} Sigma Research · Inteligencia cuantitativa
                </Text>
              </Column>
            </Row>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export function CTAButton({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} style={{
      display: 'inline-block', backgroundColor: GOLD, color: BG,
      padding: '12px 28px', fontSize: '13px', letterSpacing: '0.2em',
      textDecoration: 'none', fontWeight: 'bold',
    }}>
      {children}
    </a>
  )
}

export function Label({ children }: { children: string }) {
  return (
    <Text style={{ margin: '0 0 6px', fontSize: '11px', letterSpacing: '0.3em', color: GOLD }}>
      {children}
    </Text>
  )
}
