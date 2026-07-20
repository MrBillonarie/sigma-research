'use client'
import { useState } from 'react'

// ─── Cambio de contraseña — tarjeta partida ──────────────────────────────────
// Izquierda los campos, derecha una columna con la verificación en vivo. Antes
// los dos campos eran ciegos: escribías, apretabas y recién ahí el servidor te
// decía si algo fallaba.
//
// Nota sobre la política: el botón se habilita con 8+ caracteres y coincidencia
// —lo mismo que validaba antes— así que nadie queda sin poder cambiar su clave.
// Mayúscula/número/símbolo son guía visual, no requisitos duros.

interface Props {
  value: string
  confirm: string
  onValue: (v: string) => void
  onConfirm: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  saving: boolean
  error?: string
  msg?: string
}

const GOLD = '#39e2e6'
const GREEN = '#2fd39a'
const RED = '#f87171'
const AMBER = '#ffb454'
const STEEL = '#8fa3b8'
const MONO = "var(--font-dm-mono,'DM Mono',monospace)"

const LEVELS = [
  { t: 'SIN DEFINIR', c: STEEL },
  { t: 'DÉBIL',       c: RED },
  { t: 'ACEPTABLE',   c: AMBER },
  { t: 'BUENA',       c: GREEN },
  { t: 'EXCELENTE',   c: GOLD },
]

const REQS = [
  { k: 'len',   label: '8+ car.',   test: (v: string) => v.length >= 8 },
  { k: 'upper', label: 'Mayúscula', test: (v: string) => /[A-Z]/.test(v) },
  { k: 'num',   label: 'Número',    test: (v: string) => /[0-9]/.test(v) },
  { k: 'sym',   label: 'Símbolo',   test: (v: string) => /[^A-Za-z0-9]/.test(v) },
]

function scoreOf(v: string) {
  if (!v) return 0                    // 0 se reserva para "campo vacío"
  let s = REQS.reduce((acc, r) => acc + (r.test(v) ? 1 : 0), 0)
  if (v.length >= 14 && s >= 3) s = 4
  // Con algo escrito el piso es DÉBIL: si dijera "SIN DEFINIR" se leería
  // como si el campo estuviera vacío.
  return Math.min(4, Math.max(1, s))
}

const EyeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.4}>
    <path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10z" /><circle cx="10" cy="10" r="2.6" />
  </svg>
)
const CheckIcon = ({ size = 9, color = GREEN }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 6.2l2.6 2.6L10 3" />
  </svg>
)

export default function PasswordCard({ value, confirm, onValue, onConfirm, onSubmit, saving, error, msg }: Props) {
  const [show, setShow] = useState(false)
  const [showC, setShowC] = useState(false)

  const score = scoreOf(value)
  const level = LEVELS[score]
  const met = Object.fromEntries(REQS.map(r => [r.k, r.test(value)]))
  const match = value.length > 0 && value === confirm
  const allReq = REQS.every(r => r.test(value))
  const ready = value.length >= 8 && match

  const btnLabel = saving ? 'ACTUALIZANDO…'
    : ready ? 'ACTUALIZAR CONTRASEÑA'
    : allReq ? 'CONFIRMÁ LA CONTRASEÑA'
    : 'COMPLETÁ LOS REQUISITOS'

  return (
    <form onSubmit={onSubmit} className="pwc" style={{ ['--sc' as string]: level.c }}>
      <style>{`
        .pwc{position:relative;border-radius:13px;max-width:460px;overflow:hidden;
          background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.022));
          backdrop-filter:blur(26px) brightness(.94);-webkit-backdrop-filter:blur(26px) brightness(.94);
          box-shadow:inset 0 1.5px 0 rgba(255,255,255,.30),inset 0 -2px 3px rgba(0,0,0,.5),
            0 3px 0 -1px rgba(255,255,255,.045),0 5px 0 -1px rgba(0,0,0,.55),0 16px 30px -14px rgba(0,0,0,.9)}
        .pwc::after{content:'';position:absolute;inset:0;pointer-events:none;opacity:.4;
          background-image:radial-gradient(rgba(255,255,255,.07) .5px,transparent .5px);background-size:3px 3px}
        .pwc > *{position:relative;z-index:2}
        .pwc-head{display:flex;align-items:center;gap:9px;padding:11px 16px;
          border-bottom:1px solid rgba(255,255,255,.08);
          background:linear-gradient(180deg,rgba(255,255,255,.05),transparent)}
        .pwc-ct{font-size:8.5px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.38)}
        .pwc-badge{margin-left:auto;font-size:8.5px;letter-spacing:.12em;padding:3px 9px;border-radius:20px;
          color:var(--sc);border:1px solid currentColor;opacity:.9;transition:color .25s}
        .pwc-split{display:grid;grid-template-columns:1fr 138px}
        @media(max-width:600px){.pwc-split{grid-template-columns:1fr}}
        .pwc-l{padding:16px}
        .pwc-r{padding:16px 14px;border-left:1px solid rgba(255,255,255,.08);
          background:linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,.4))}
        @media(max-width:600px){.pwc-r{border-left:none;border-top:1px solid rgba(255,255,255,.08)}}
        .pwc-lbl{font-size:8.5px;letter-spacing:.17em;text-transform:uppercase;color:rgba(255,255,255,.38);
          display:block;margin-bottom:6px}
        .pwc-fld{position:relative;margin-bottom:12px}
        .pwc-inp{background:rgba(0,0,0,.32);border:1px solid #252a3d;border-radius:9px;color:#e8e9f0;
          font-family:${MONO};font-size:13px;padding:12px 42px 12px 14px;width:100%;outline:none;letter-spacing:.06em;
          box-shadow:inset 0 2px 6px rgba(0,0,0,.65),inset 0 -1px 0 rgba(255,255,255,.09);
          transition:box-shadow .2s,border-color .2s}
        .pwc-inp:focus{border-color:${GOLD};box-shadow:inset 0 2px 6px rgba(0,0,0,.65),0 0 0 2px rgba(57,226,230,.22)}
        .pwc-inp.ok{border-color:rgba(47,211,154,.6);box-shadow:inset 0 2px 6px rgba(0,0,0,.65),0 0 0 2px rgba(47,211,154,.18)}
        .pwc-inp.bad{border-color:rgba(248,113,113,.6);box-shadow:inset 0 2px 6px rgba(0,0,0,.65),0 0 0 2px rgba(248,113,113,.16)}
        .pwc-eye{position:absolute;right:9px;bottom:8px;width:26px;height:26px;border:none;background:transparent;
          cursor:pointer;color:rgba(255,255,255,.38);display:flex;align-items:center;justify-content:center;
          border-radius:6px;transition:color .15s,background .15s;padding:0}
        .pwc-eye:hover{color:${GOLD};background:rgba(57,226,230,.1)}
        .pwc-tick{position:absolute;right:38px;bottom:13px;opacity:0;transition:opacity .2s;pointer-events:none}
        .pwc-tick.show{opacity:1}
        .pwc-vlist{display:flex;flex-direction:column;gap:9px;margin-top:9px}
        .pwc-vi{display:flex;align-items:center;gap:8px;font-size:9.5px;color:rgba(255,255,255,.38);transition:color .2s}
        .pwc-vi.ok{color:${GREEN}}
        .pwc-vbox{width:15px;height:15px;border-radius:4px;border:1px solid #252a3d;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35);transition:all .22s}
        .pwc-vi.ok .pwc-vbox{border-color:${GREEN};background:rgba(47,211,154,.18);box-shadow:0 0 9px -1px rgba(47,211,154,.6)}
        .pwc-vbox svg{opacity:0;transition:opacity .2s}
        .pwc-vi.ok .pwc-vbox svg{opacity:1}
        .pwc-meter{margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08)}
        .pwc-bars{display:flex;gap:3px;align-items:flex-end;height:26px;margin-top:6px}
        .pwc-b{flex:1;border-radius:2px 2px 0 0;background:rgba(0,0,0,.45);
          box-shadow:inset 0 1px 2px rgba(0,0,0,.7);transition:all .3s}
        .pwc-b:nth-child(1){height:35%}.pwc-b:nth-child(2){height:57%}
        .pwc-b:nth-child(3){height:79%}.pwc-b:nth-child(4){height:100%}
        .pwc-b.on{background:linear-gradient(180deg,color-mix(in srgb,var(--sc) 72%,white),var(--sc));
          box-shadow:0 0 9px -1px var(--sc)}
        .pwc-vtxt{font-size:9px;letter-spacing:.1em;color:var(--sc);margin-top:6px;transition:color .3s}
        .pwc-btn{width:100%;padding:13px 0;border-radius:9px;font-family:${MONO};font-size:10.5px;font-weight:700;
          letter-spacing:.14em;cursor:pointer;border:none;color:#04050a;margin-top:4px;
          background:linear-gradient(180deg,rgba(180,250,253,.96),${GOLD} 52%,rgba(31,166,173,.95));
          box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 4px 0 rgba(18,112,122,.9),0 12px 22px -8px rgba(57,226,230,.5);
          transition:transform .1s,box-shadow .1s,filter .25s}
        .pwc-btn:active:not([disabled]){transform:translateY(3px);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 1px 0 rgba(18,112,122,.9)}
        .pwc-btn[disabled]{filter:grayscale(.9) brightness(.55);cursor:not-allowed;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 3px 0 rgba(28,34,44,.95)}
        .pwc-fb{font-size:10.5px;margin-bottom:10px;line-height:1.6}
        @media (prefers-reduced-motion: reduce){
          .pwc-inp,.pwc-vbox,.pwc-b,.pwc-btn,.pwc-badge,.pwc-tick{transition:none}
        }
      `}</style>

      <div className="pwc-head">
        <span className="pwc-ct">Seguridad de la clave</span>
        <span className="pwc-badge">{level.t}</span>
      </div>

      <div className="pwc-split">
        <div className="pwc-l">
          <div className="pwc-fld">
            <span className="pwc-lbl">Nueva contraseña</span>
            <input
              className="pwc-inp" type={show ? 'text' : 'password'} value={value}
              onChange={e => onValue(e.target.value)} placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
            />
            <button type="button" className="pwc-eye" onClick={() => setShow(s => !s)}
              title={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              <EyeIcon />
            </button>
          </div>

          <div className="pwc-fld">
            <span className="pwc-lbl">Confirmar contraseña</span>
            <input
              className={`pwc-inp${confirm ? (match ? ' ok' : ' bad') : ''}`}
              type={showC ? 'text' : 'password'} value={confirm}
              onChange={e => onConfirm(e.target.value)} placeholder="Repite la nueva contraseña"
              autoComplete="new-password"
            />
            <span className={`pwc-tick${match ? ' show' : ''}`} aria-hidden><CheckIcon size={14} /></span>
            <button type="button" className="pwc-eye" onClick={() => setShowC(s => !s)}
              title={showC ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-label={showC ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              <EyeIcon />
            </button>
          </div>

          {error && <div className="pwc-fb" style={{ color: RED }}>{error}</div>}
          {msg   && <div className="pwc-fb" style={{ color: GREEN }}>{msg}</div>}

          <button type="submit" className="pwc-btn" disabled={saving || !ready}>{btnLabel}</button>
        </div>

        <div className="pwc-r">
          <span className="pwc-lbl">Requisitos</span>
          <div className="pwc-vlist">
            {REQS.map(r => (
              <div key={r.k} className={`pwc-vi${met[r.k] ? ' ok' : ''}`}>
                <span className="pwc-vbox"><CheckIcon /></span>{r.label}
              </div>
            ))}
          </div>
          <div className="pwc-meter">
            <span className="pwc-lbl">Fortaleza</span>
            <div className="pwc-bars" role="img" aria-label={`Fortaleza: ${level.t}`}>
              {[0, 1, 2, 3].map(i => <span key={i} className={`pwc-b${i < score ? ' on' : ''}`} />)}
            </div>
            <div className="pwc-vtxt">{value ? level.t : '—'}</div>
          </div>
        </div>
      </div>
    </form>
  )
}
