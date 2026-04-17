'use client'
import { useState, useMemo, useDeferredValue, useEffect } from 'react'
import { fmt } from '../lib/format'

function monteCarlo(
  capital: number,
  gasto: number,
  retornoAnual: number,
  inflacion: number,
  años: number,
  n = 2000
): { exito: number; mediana: number; percentil10: number } {
  let exitos = 0
  const finales: number[] = []

  for (let sim = 0; sim < n; sim++) {
    let c = capital
    for (let y = 0; y < años; y++) {
      const retorno = retornoAnual + (Math.random() - 0.5) * 0.3
      const gAjustado = gasto * Math.pow(1 + inflacion, y) * 12
      c = c * (1 + retorno) - gAjustado
      if (c <= 0) { c = 0; break }
    }
    finales.push(c)
    if (c > 0) exitos++
  }

  finales.sort((a, b) => a - b)
  return {
    exito: (exitos / n) * 100,
    mediana: finales[Math.floor(n / 2)],
    percentil10: finales[Math.floor(n * 0.1)],
  }
}

function fireAge(
  capitalActual: number,
  ahorro: number,
  retorno: number,
  gastoMensual: number
): number {
  const meta = gastoMensual * 12 / 0.04
  let c = capitalActual
  for (let y = 0; y < 80; y++) {
    c = c * (1 + retorno) + ahorro * 12
    if (c >= meta) return y + 1
  }
  return 99
}

export default function FireSimulator() {
  const [capital, setCapital] = useState(100000)
  const [ahorro, setAhorro] = useState(1500)
  const [gasto, setGasto] = useState(2500)
  const [retorno, setRetorno] = useState(7)
  const [inflacion, setInflacion] = useState(3)
  const [edad, setEdad] = useState(28)

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const params = useMemo(
    () => ({ capital, ahorro, gasto, retorno, inflacion, edad }),
    [capital, ahorro, gasto, retorno, inflacion, edad]
  )
  const deferred = useDeferredValue(params)
  const isPending = params !== deferred

  const result = useMemo(() => {
    const { capital, ahorro, gasto, retorno, inflacion, edad } = deferred
    const años = fireAge(capital, ahorro, retorno / 100, gasto)
    const mc = mounted
      ? monteCarlo(capital + ahorro * 12 * años, gasto, retorno / 100, inflacion / 100, 30)
      : { exito: 0, mediana: 0, percentil10: 0 }
    const metaFire = (gasto * 12) / 0.04
    const progressPct = Math.min((capital / metaFire) * 100, 100)
    return { años, mc, metaFire, progressPct, edadFire: edad + años }
  }, [deferred, mounted])

  return (
    <section id="fire" className="bg-surface py-24 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-16">
          <div className="section-label text-gold mb-4">{'// CALCULADORA FIRE'}</div>
          <h2 className="display-heading text-5xl sm:text-7xl text-text">
            SIMULADOR
            <br />
            <span className="gold-text">INDEPENDENCIA</span>
            <br />
            FINANCIERA
          </h2>
          <p className="terminal-text text-text-dim mt-4 max-w-2xl">
            Motor Monte Carlo con 2,000 simulaciones. Regla del 4% + ajuste por secuencia de retornos.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-px bg-border">
          {/* Controls */}
          <div className="bg-bg p-8 lg:p-10 space-y-8">
            {[
              { label: 'Capital Actual', value: capital, set: setCapital, min: 0, max: 2000000, step: 5000, fmt: true },
              { label: 'Ahorro Mensual', value: ahorro, set: setAhorro, min: 0, max: 20000, step: 100, fmt: true },
              { label: 'Gasto Mensual (FIRE)', value: gasto, set: setGasto, min: 500, max: 20000, step: 100, fmt: true },
              { label: 'Retorno Esperado Anual', value: retorno, set: setRetorno, min: 1, max: 20, step: 0.5, fmt: false, suffix: '%' },
              { label: 'Inflación Esperada', value: inflacion, set: setInflacion, min: 0, max: 10, step: 0.5, fmt: false, suffix: '%' },
              { label: 'Edad Actual', value: edad, set: setEdad, min: 18, max: 60, step: 1, fmt: false, suffix: ' años' },
            ].map(({ label, value, set, min, max, step, fmt: doFmt, suffix }) => (
              <div key={label}>
                <div className="flex justify-between items-center mb-2">
                  <label className="section-label text-text-dim">{label}</label>
                  <span className="terminal-text text-gold text-sm">
                    {doFmt ? fmt(value) : `${value}${suffix ?? ''}`}
                  </span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={value}
                  onChange={(e) => set(Number(e.target.value))}
                  aria-label={label}
                  className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-gold"
                />
                <div className="flex justify-between terminal-text text-xs text-muted mt-1">
                  <span>{doFmt ? fmt(min) : `${min}${suffix ?? ''}`}</span>
                  <span>{doFmt ? fmt(max) : `${max}${suffix ?? ''}`}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Results */}
          <div className={`bg-surface p-8 lg:p-10 flex flex-col justify-between transition-opacity duration-150 ${isPending ? 'opacity-50' : 'opacity-100'}`}>
            {/* Primary result */}
            <div className="mb-8">
              <div className="section-label text-text-dim mb-2">EDAD DE INDEPENDENCIA</div>
              <div className="display-heading text-8xl gold-text">{result.edadFire}</div>
              <div className="terminal-text text-text-dim mt-1">
                en {result.años} años · Año {new Date().getFullYear() + result.años}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-8">
              <div className="flex justify-between mb-2">
                <span className="section-label text-text-dim">PROGRESO HACIA FIRE</span>
                <span className="terminal-text text-gold text-sm">{result.progressPct.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-gold-gradient rounded-full transition-all duration-700"
                  style={{ width: `${result.progressPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 terminal-text text-xs text-muted">
                <span>{fmt(capital)}</span>
                <span>Meta: {fmt(result.metaFire)}</span>
              </div>
            </div>

            {/* Monte Carlo stats */}
            <div className="grid grid-cols-3 gap-px bg-border">
              <div className="bg-bg p-4">
                <div className="section-label text-text-dim text-xs mb-1">TASA ÉXITO</div>
                <div
                  className={`display-heading text-3xl ${
                    result.mc.exito > 80 ? 'text-emerald-400' : result.mc.exito > 60 ? 'text-yellow-400' : 'text-red-400'
                  }`}
                >
                  {result.mc.exito.toFixed(0)}%
                </div>
                <div className="terminal-text text-xs text-muted">30 años</div>
              </div>
              <div className="bg-bg p-4">
                <div className="section-label text-text-dim text-xs mb-1">MEDIANA</div>
                <div className="display-heading text-3xl text-gold">{fmt(result.mc.mediana)}</div>
                <div className="terminal-text text-xs text-muted">capital restante</div>
              </div>
              <div className="bg-bg p-4">
                <div className="section-label text-text-dim text-xs mb-1">PEOR 10%</div>
                <div className="display-heading text-3xl text-red-400">{fmt(result.mc.percentil10)}</div>
                <div className="terminal-text text-xs text-muted">percentil 10</div>
              </div>
            </div>

            {/* Methodology note */}
            <div className="mt-6 p-4 border border-border">
              <div className="section-label text-text-dim text-xs mb-1">METODOLOGÍA</div>
              <p className="terminal-text text-xs text-muted leading-relaxed">
                Regla del 4% · 2,000 simulaciones Monte Carlo ·
                Retorno con volatilidad σ=15% · Inflación compuesta
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
