interface Props {
  rows?: number
  cols?: number
  className?: string
}

function Bone({ w = '100%', h = 16, rounded = false }: { w?: string | number; h?: number; rounded?: boolean }) {
  return (
    <div
      className="animate-pulse"
      style={{
        width: w,
        height: h,
        borderRadius: rounded ? 9999 : 4,
        background: 'linear-gradient(90deg, #1a1d2e 0%, #22263a 50%, #1a1d2e 100%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.6s ease-in-out infinite',
      }}
    />
  )
}

export function SkeletonCard({ h = 120 }: { h?: number }) {
  return (
    <div style={{ background: '#0b0d14', border: '1px solid #1a1d2e', padding: '20px', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Bone w="35%" h={10} />
        <Bone w="12%" h={10} rounded />
      </div>
      <Bone w="55%" h={h * 0.4} />
      <Bone w="80%" h={10} />
      <Bone w="60%" h={10} />
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }: Props) {
  return (
    <div style={{ background: '#0b0d14', border: '1px solid #1a1d2e', borderRadius: 6, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 12, padding: '12px 20px', borderBottom: '1px solid #1a1d2e' }}>
        {Array.from({ length: cols }).map((_, i) => <Bone key={i} w="70%" h={9} />)}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 12, padding: '14px 20px', borderBottom: r < rows - 1 ? '1px solid #0d0f18' : 'none' }}>
          {Array.from({ length: cols }).map((_, c) => <Bone key={c} w={c === 0 ? '80%' : '50%'} h={11} />)}
        </div>
      ))}
    </div>
  )
}

export function SkeletonChart({ h = 200 }: { h?: number }) {
  return (
    <div style={{ background: '#0b0d14', border: '1px solid #1a1d2e', borderRadius: 6, padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Bone w="30%" h={11} />
        <Bone w="15%" h={11} />
      </div>
      <div style={{ height: h, background: '#0d0f18', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, transparent 0%, #1a1d2e40 50%, transparent 100%)',
          backgroundSize: '200% 100%',
          animation: 'skeleton-shimmer 1.6s ease-in-out infinite',
        }} />
      </div>
    </div>
  )
}

export default function SkeletonDashboard() {
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`
        @keyframes skeleton-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
        {[80, 80, 80, 80].map((h, i) => <SkeletonCard key={i} h={h} />)}
      </div>
      <SkeletonChart h={220} />
      <SkeletonTable rows={6} cols={5} />
    </div>
  )
}
