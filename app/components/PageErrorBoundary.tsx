'use client'
import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  section?: string
}

interface State {
  hasError: boolean
  error?: Error
}

const MONO  = 'var(--font-dm-mono, monospace)'
const BEBAS = "'Bebas Neue', Impact, sans-serif"

export default class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error(`[PageErrorBoundary:${this.props.section ?? 'unknown'}]`, error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 280,
        padding: '40px 24px',
        textAlign: 'center',
        gap: 16,
        background: 'rgba(248,113,113,0.04)',
        border: '1px solid rgba(248,113,113,0.15)',
        borderRadius: 10,
      }}>
        {/* Icono de error */}
        <div style={{
          width: 52,
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(248,113,113,0.10)',
          border: '1px solid rgba(248,113,113,0.25)',
          borderRadius: 10,
          fontSize: 22,
        }}>
          ⚠
        </div>

        <div>
          <h3 style={{
            margin: '0 0 8px',
            fontFamily: BEBAS,
            fontSize: 20,
            letterSpacing: 2,
            color: '#f87171',
          }}>
            ALGO SALIÓ MAL
          </h3>
          <p style={{
            margin: '0 0 4px',
            fontFamily: MONO,
            fontSize: 12,
            color: '#7a7f9a',
            maxWidth: 360,
            lineHeight: 1.7,
          }}>
            Esta sección encontró un error inesperado.
            {this.props.section && ` (${this.props.section})`}
          </p>
          {this.state.error?.message && (
            <p style={{
              margin: 0,
              fontFamily: MONO,
              fontSize: 10,
              color: 'rgba(248,113,113,0.6)',
              maxWidth: 400,
            }}>
              {this.state.error.message}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            style={{
              background: 'rgba(248,113,113,0.12)',
              border: '1px solid rgba(248,113,113,0.30)',
              borderRadius: 7,
              padding: '9px 18px',
              color: '#f87171',
              fontFamily: MONO,
              fontSize: 11,
              cursor: 'pointer',
              letterSpacing: '0.08em',
            }}
          >
            Reintentar
          </button>
          <a
            href="/contacto"
            style={{
              display: 'inline-block',
              background: 'transparent',
              border: '1px solid #1a1d2e',
              borderRadius: 7,
              padding: '9px 18px',
              color: '#7a7f9a',
              fontFamily: MONO,
              fontSize: 11,
              textDecoration: 'none',
              letterSpacing: '0.08em',
            }}
          >
            Reportar error
          </a>
        </div>
      </div>
    )
  }
}
