import { redirect } from 'next/navigation'

export default function TerminalPage({
  searchParams,
}: {
  searchParams: { symbol?: string }
}) {
  const symbol = searchParams.symbol
  redirect(symbol ? `/hud?symbol=${encodeURIComponent(symbol)}` : '/hud')
}
