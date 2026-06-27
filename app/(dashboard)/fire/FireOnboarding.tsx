'use client'
import { useState } from 'react'

const MONO  = 'var(--font-dm-mono, monospace)'
const BEBAS = "'Bebas Neue', Impact, sans-serif"
const GOLD  = '#d4af37'
const BG    = '#0b0d14'
const BORDER = '#1a1d2e'
const DIM   = '#7a7f9a'
const TEXT  = '#e8e9f0'

function NumberField({ label, hint, value, onChange, min, max, prefix }: {
  label: string; hint: string; value: string; onChange: (v: string) => void
  min: number; max: number; prefix?: string
}) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: DIM, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {prefix && <span style={{ fontFamily: MONO, fontSize: 16, color: GOLD }}>{prefix}</span>}
        <input
          type="number" min={min} max={max} value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`,
            borderRadius: 8, padding: '10px 12px', color: TEXT, fontFamily: MONO, fontSize: 14,
          }}
        />
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: '#3a3f55', marginTop: 5, lineHeight: 1.5 }}>{hint}</div>
    </div>
  )
}

export default function FireOnboarding({ onComplete }: {
  onComplete: (data: { edad: number; ahorro: number; gasto: number }) => void
}) {
  const [edad,   setEdad]   = useState('')
  const [ahorro, setAhorro] = useState('')
  const [gasto,  setGasto]  = useState('')
  const [saving, setSaving] = useState(false)

  const edadN   = Number(edad)
  const ahorroN = Number(ahorro)
  const gastoN  = Number(gasto)
  const valid =
    edad !== '' && edadN >= 18 && edadN <= 90 &&
    ahorro !== '' && ahorroN >= 0 && ahorroN <= 100_000 &&
    gasto !== '' && gastoN >= 100 && gastoN <= 100_000

  function handleSubmit() {
    if (!valid || saving) return
    setSaving(true)
    onComplete({ edad: edadN, ahorro: ahorroN, gasto: gastoN })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(4,5,10,0.85)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 14, width: '100%', maxWidth: 480, overflow: 'hidden' }}>

        <div style={{ padding: '20px 28px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22, fontFamily: MONO, color: GOLD }}>🔥</span>
          <div>
            <div style={{ fontFamily: BEBAS, fontSize: 16, letterSpacing: 2, color: TEXT }}>
              PERSONALIZA TU FIRE PLANNER
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: DIM, letterSpacing: 1 }}>
              3 preguntas — tu proyección será real, no genérica
            </div>
          </div>
        </div>

        <div style={{ padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <NumberField
            label="Edad actual" hint="Define cuántos años faltan para tu meta y a qué edad la alcanzarías."
            value={edad} onChange={setEdad} min={18} max={90}
          />
          <NumberField
            label="Ahorro mensual disponible" hint="Cuánto puedes destinar a inversión cada mes, de forma realista."
            value={ahorro} onChange={setAhorro} min={0} max={100_000} prefix="$"
          />
          <NumberField
            label="Gasto mensual deseado en el retiro" hint="Define tu meta de capital (regla del 4%) y tu modo FIRE."
            value={gasto} onChange={setGasto} min={100} max={100_000} prefix="$"
          />
        </div>

        <div style={{ padding: '0 28px 24px' }}>
          <button
            onClick={handleSubmit}
            disabled={!valid || saving}
            style={{
              width: '100%', background: !valid || saving ? '#1a1d2e' : GOLD,
              color: !valid || saving ? '#3a3f55' : '#04050a',
              border: 'none', borderRadius: 7, padding: '12px 24px',
              fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
              cursor: !valid || saving ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
            }}
          >
            {saving ? 'Guardando...' : 'Calcular mi FIRE →'}
          </button>
          <div style={{ fontFamily: MONO, fontSize: 9, color: '#3a3f55', marginTop: 10, textAlign: 'center' }}>
            Podrás ajustar estos valores libremente después con los controles deslizantes.
          </div>
        </div>
      </div>
    </div>
  )
}
