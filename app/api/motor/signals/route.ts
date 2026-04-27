export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import { processAsset, computeFlowSignals, computeFlowScore } from '@/lib/signalEngine'
import { computeAllocation, computeMetrics }                  from '@/lib/allocator'
import type { ProfileType, Profile, SignalsResponse }          from '@/types/decision-engine'

// ─── Perfiles ─────────────────────────────────────────────────────────────────
export const PROFILES: Record<ProfileType, Profile> = {
  retail: {
    type: 'retail', label: 'Retail',
    maxCrypto: 5, maxEquity: 70, minFixedIncome: 20,
    riskTolerance: 35, benchmarkReturn: 6,
    description: 'Perfil conservador con énfasis en preservación del capital.',
    horizonte: 'largo plazo (3-5 años)',
  },
  trader: {
    type: 'trader', label: 'Trader Activo',
    maxCrypto: 30, maxEquity: 90, minFixedIncome: 5,
    riskTolerance: 75, benchmarkReturn: 15,
    description: 'Perfil agresivo con tolerancia a alta volatilidad y rotación activa.',
    horizonte: 'corto-medio plazo (3-12 meses)',
  },
  institucional: {
    type: 'institucional', label: 'Institucional',
    maxCrypto: 10, maxEquity: 60, minFixedIncome: 30,
    riskTolerance: 50, benchmarkReturn: 8,
    description: 'Perfil equilibrado con enfoque en rentabilidad ajustada al riesgo.',
    horizonte: 'medio plazo (1-3 años)',
  },
}

// ─── Activos fijos (crypto + renta fija) ──────────────────────────────────────
const CRYPTO_RAW = [
  { id: 'btc', name: 'Bitcoin',   ticker: 'BTC', r1m:  8.2, r3m:  14.5, r1y:  62.1 },
  { id: 'eth', name: 'Ethereum',  ticker: 'ETH', r1m:  3.4, r3m:  -8.2, r1y:  28.4 },
  { id: 'sol', name: 'Solana',    ticker: 'SOL', r1m: 12.1, r3m:  24.6, r1y:  81.3 },
  { id: 'bnb', name: 'BNB',       ticker: 'BNB', r1m:  5.7, r3m:   9.2, r1y:  34.8 },
]

const RF_RAW = [
  { id: 'btp-5y',    name: 'BTP Chile 5 años',      ticker: 'BTP5',   r1m: 0.40, r3m: 1.20, r1y: 5.20 },
  { id: 'tbond-10y', name: 'T-Bond USA 10 años',     ticker: 'TLT',    r1m: 0.80, r3m: -1.4, r1y: 4.40 },
  { id: 'corp-ig',   name: 'Corporativo IG Chile',   ticker: 'CIGCL',  r1m: 0.50, r3m: 1.60, r1y: 6.10 },
  { id: 'bcch-pdr',  name: 'Pagaré BCCh 90d',        ticker: 'PDBC',   r1m: 0.38, r3m: 1.14, r1y: 4.55 },
]

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const profileType = (searchParams.get('profile') ?? 'retail') as ProfileType
  const profile     = PROFILES[profileType] ?? PROFILES.retail

  const db = sb()

  // Fondos y ETFs en paralelo
  const [fondosRes, etfsRes] = await Promise.all([
    db.from('fondos_mutuos')
      .select('id, nombre, categoria, rent_1m, rent_3m, rent_12m')
      .eq('activo', true)
      .not('rent_12m', 'is', null)
      .order('rent_12m', { ascending: false })
      .limit(80),
    db.from('etfs')
      .select('ticker, nombre, exposicion, sector, rent_1m, rent_3m, rent_12m')
      .not('rent_12m', 'is', null)
      .order('rent_12m', { ascending: false })
      .limit(40),
  ])

  const rawFondos = (fondosRes.data ?? []).map((f: any) => ({
    id: f.id, name: f.nombre, assetClass: 'fondos' as const,
    category: f.categoria ?? 'General',
    r1m: Number(f.rent_1m  ?? 0),
    r3m: Number(f.rent_3m  ?? 0),
    r1y: Number(f.rent_12m ?? 0),
  }))

  const rawEtfs = (etfsRes.data ?? []).map((e: any) => ({
    id: e.ticker, name: e.nombre, ticker: e.ticker, assetClass: 'etfs' as const,
    category: e.exposicion ?? e.sector ?? 'Global',
    r1m: Number(e.rent_1m  ?? 0),
    r3m: Number(e.rent_3m  ?? 0),
    r1y: Number(e.rent_12m ?? 0),
  }))

  const rawCrypto = CRYPTO_RAW.map(c => ({ ...c, assetClass: 'crypto' as const }))
  const rawRF     = RF_RAW.map(r     => ({ ...r, assetClass: 'renta_fija' as const }))

  const allAssets = [...rawFondos, ...rawEtfs, ...rawCrypto, ...rawRF].map(processAsset)

  const allocation  = computeAllocation(allAssets, profile)
  const metrics     = computeMetrics(allocation, allAssets)
  const flowSignals = computeFlowSignals(allAssets)
  const flowScore   = computeFlowScore(allAssets)

  const body: SignalsResponse = {
    ok: true, profile, signals: allAssets,
    allocation, metrics, flowSignals, flowScore,
    totalAssets: allAssets.length,
    buyCount:    allAssets.filter(a => a.signal === 'comprar').length,
    sellCount:   allAssets.filter(a => a.signal === 'reducir').length,
    holdCount:   allAssets.filter(a => a.signal === 'mantener' || a.signal === 'neutral').length,
    generatedAt: new Date().toISOString(),
  }

  return NextResponse.json(body)
}
