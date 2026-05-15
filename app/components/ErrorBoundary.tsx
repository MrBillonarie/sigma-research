'use client'
import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{
          border: '1px solid rgba(248,113,113,0.3)',
          background: 'rgba(248,113,113,0.05)',
          padding: '16px 20px',
          fontFamily: "'Courier New', monospace",
          fontSize: 11,
          color: '#f87171',
          letterSpacing: '0.05em',
        }}>
          // ERROR EN ESTE MÓDULO — recarga la página para reintentar
        </div>
      )
    }
    return this.props.children
  }
}
