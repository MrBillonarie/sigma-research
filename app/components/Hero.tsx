'use client'
import { useEffect, useState } from 'react'
import TickerBar from './TickerBar'
import StatBar from './StatBar'

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
    <>
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
          <div
            className="section-label text-gold mb-4 animate-fade-up"
            style={{ animationDelay: '0ms' }}
          >
            {'// SIGMA RESEARCH v2.4.1'}
          </div>
          <h1 className="display-heading text-6xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-[9rem] 2xl:text-[10rem] leading-none mb-4 overflow-hidden">
            <span
              className="block text-text animate-fade-up"
              style={{ animationDelay: '80ms' }}
            >
              QUANT
            </span>
            <span
              className="block gold-text animate-fade-up"
              style={{ animationDelay: '180ms' }}
            >
              INTELLIGENCE
            </span>
            <span
              className="block text-text animate-fade-up"
              style={{ animationDelay: '280ms' }}
            >
              PLATFORM
            </span>
          </h1>
          <p
            className="terminal-text text-text-dim max-w-2xl text-base leading-relaxed mt-6 animate-fade-up"
            style={{ animationDelay: '400ms' }}
          >
            Modelos estadísticos de grado institucional para análisis de mercados,
            planificación financiera y señales algorítmicas.
            Construido sobre datos reales. Diseñado para resultados reales.
          </p>
        </div>

        {/* CTA buttons */}
        <div
          className="flex flex-wrap gap-4 mb-16 animate-fade-up"
          style={{ animationDelay: '520ms' }}
        >
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
              {/* TODO: conectar a API real */}
              <span className="terminal-text text-xs text-text-dim">DEMO</span>
            </div>
          ))}
        </div>
      </div>

      {/* Ticker bar at bottom of hero */}
      <div className="relative z-10">
        <TickerBar />
      </div>
    </section>

    {/* Stat bar — outside hero section, below fold */}
    <StatBar />
    </>
  )
}
