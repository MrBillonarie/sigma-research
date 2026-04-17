'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import TickerBar from './TickerBar'

const metrics = [
  { label: 'Sharpe Ratio', value: '2.41', unit: '', prefix: '' },
  { label: 'Alpha Anual', value: '18.7', unit: '%', prefix: '' },
  { label: 'Max Drawdown', value: '-4.2', unit: '%', prefix: '' },
  { label: 'Win Rate', value: '67.3', unit: '%', prefix: '' },
  { label: 'Calmar Ratio', value: '4.45', unit: '', prefix: '' },
  { label: 'Beta SPX', value: '0.12', unit: '', prefix: '' },
]

function AnimatedNumber({ target, decimals = 2 }: { target: number; decimals?: number }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const duration = 2000
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setVal(parseFloat((eased * target).toFixed(decimals)))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, decimals])
  return <>{val.toFixed(decimals)}</>
}

export default function Hero() {
  const [time, setTime] = useState('')

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/New_York' }) + ' EST')
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <section className="relative min-h-screen flex flex-col bg-bg overflow-hidden">
      {/* Grid background */}
      <div
        className="absolute inset-0 bg-grid-pattern bg-grid opacity-60"
        style={{ backgroundSize: '40px 40px' }}
      />

      {/* Radial gold glow center */}
      <div className="absolute inset-0 bg-radial-gold opacity-40 pointer-events-none" />

      {/* Scan line effect */}
      <div
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-30 animate-scan-line pointer-events-none"
        style={{ top: '40%' }}
      />

      <Navbar />

      <div className="relative z-10 flex-1 flex flex-col justify-center px-6 pt-24 pb-12 max-w-7xl mx-auto w-full">
        {/* Status line */}
        <div className="flex items-center gap-3 mb-8">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-slow" />
          <span className="section-label text-text-dim">SISTEMA ACTIVO</span>
          <span className="section-label text-border">|</span>
          <span className="section-label text-text-dim font-mono">{time}</span>
        </div>

        {/* Main headline */}
        <div className="mb-6">
          <div className="section-label text-gold mb-4">{'// SIGMA RESEARCH v2.4.1'}</div>
          <h1 className="display-heading text-6xl sm:text-8xl lg:text-[10rem] leading-none mb-4">
            <span className="text-text">QUANT</span>
            <br />
            <span className="gold-text">INTELLIGENCE</span>
            <br />
            <span className="text-text">PLATFORM</span>
          </h1>
          <p className="terminal-text text-text-dim max-w-2xl text-base leading-relaxed mt-6">
            Modelos estadísticos de grado institucional para análisis de mercados,
            planificación financiera y señales algorítmicas.
            Construido sobre datos reales. Diseñado para resultados reales.
          </p>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-wrap gap-4 mb-16">
          <a
            href="#productos"
            className="px-8 py-3 bg-gold text-bg display-heading text-xl tracking-widest hover:bg-gold-glow transition-colors duration-200 shadow-gold-lg"
          >
            EXPLORAR PLATAFORMA
          </a>
          <a
            href="#fire"
            className="px-8 py-3 gold-border display-heading text-xl tracking-widest text-gold hover:bg-gold/10 transition-all duration-200"
          >
            CALCULADORA FIRE
          </a>
        </div>

        {/* Live metrics grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-border">
          {metrics.map((m) => (
            <div key={m.label} className="bg-surface p-4 flex flex-col gap-1">
              <span className="section-label text-text-dim text-xs">{m.label}</span>
              <span className="display-heading text-2xl text-gold">
                {m.prefix}
                <AnimatedNumber
                  target={parseFloat(m.value)}
                  decimals={m.value.includes('.') ? m.value.split('.')[1].length : 0}
                />
                {m.unit}
              </span>
              <span className="terminal-text text-xs text-text-dim">LIVE ▸</span>
            </div>
          ))}
        </div>
      </div>

      {/* Ticker bar at bottom of hero */}
      <div className="relative z-10">
        <TickerBar />
      </div>
    </section>
  )
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-bg/95 backdrop-blur-md border-b border-border' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 border border-gold flex items-center justify-center">
            <span className="display-heading text-gold text-sm leading-none">Σ</span>
          </div>
          <span className="display-heading text-xl tracking-widest text-text">SIGMA RESEARCH</span>
        </div>

        <div className="hidden md:flex items-center gap-6">
          {[
            ['Terminal',    '/terminal'],
            ['Modelos',     '/modelos'],
            ['FIRE',        '/fire'],
            ['Monte Carlo', '/montecarlo'],
            ['Reportes',    '/reportes'],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="section-label text-text-dim hover:text-gold transition-colors duration-200"
            >
              {label}
            </Link>
          ))}
          <Link
            href="/reportes"
            className="section-label px-4 py-2 bg-gold text-bg hover:bg-gold-glow transition-all duration-200"
          >
            PRO
          </Link>
        </div>
      </div>
    </nav>
  )
}
