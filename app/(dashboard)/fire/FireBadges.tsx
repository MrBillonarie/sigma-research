'use client'
import { BADGES } from './challenges'
import { C } from '@/app/lib/constants'
import { Medal } from './FireVisuals'

interface Props {
  earnedBadges: string[]
}

export default function FireBadges({ earnedBadges }: Props) {
  const earned = new Set(earnedBadges)

  return (
    <div style={{ marginTop: 26 }}>
      <style>{`
        .fb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:14px;perspective:900px}
        .fb-medal{display:flex;flex-direction:column;align-items:center;text-align:center;gap:9px;
          padding:18px 10px 15px;border-radius:12px;
          background:linear-gradient(180deg,${C.surface2},${C.surface});border:1px solid ${C.border};
          transform-style:preserve-3d;transition:transform .2s ease-out, box-shadow .2s, border-color .2s;
          box-shadow:0 10px 22px -16px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.04)}
        .fb-medal.on{border-color:color-mix(in srgb,var(--mc) 38%,transparent);
          box-shadow:0 14px 30px -18px rgba(0,0,0,.9), 0 0 22px color-mix(in srgb,var(--mc) 16%,transparent), inset 0 1px 0 rgba(255,255,255,.07)}
        .fb-medal canvas{transform:translateZ(26px)}
        .fb-n{font-family:${"var(--font-dm-mono,'DM Mono',monospace)"};font-size:10.5px;color:${C.dimText};font-weight:600;transform:translateZ(14px)}
        .fb-medal.on .fb-n{color:${C.text}}
        .fb-d{font-family:${"var(--font-dm-mono,'DM Mono',monospace)"};font-size:9px;color:${C.muted};line-height:1.5;transform:translateZ(8px)}
        @media (prefers-reduced-motion: reduce){.fb-medal{transition:none}}
      `}</style>

      <div style={{ fontFamily: "var(--font-dm-mono,'DM Mono',monospace)", fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText, marginBottom: 14 }}>
        {earnedBadges.length}/{BADGES.length} insignias desbloqueadas
      </div>

      <div className="fb-grid">
        {BADGES.map(badge => {
          const isEarned = earned.has(badge.id)
          return (
            <div
              key={badge.id}
              title={badge.description}
              className={`fb-medal${isEarned ? ' on' : ''}`}
              style={{ ['--mc' as string]: badge.color }}
              onMouseMove={e => {
                // inclinación en perspectiva siguiendo el cursor
                const el = e.currentTarget, r = el.getBoundingClientRect()
                const px = (e.clientX - r.left) / r.width - 0.5
                const py = (e.clientY - r.top) / r.height - 0.5
                el.style.transform = `rotateY(${px * 20}deg) rotateX(${-py * 20}deg) translateZ(10px)`
              }}
              onMouseLeave={e => { e.currentTarget.style.transform = '' }}
            >
              <Medal glyph={badge.glyph} color={badge.color} earned={isEarned} size={62} />
              <div className="fb-n">{badge.name}</div>
              <div className="fb-d">{badge.description}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
