import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact — SQuant Desk',
}

export default function EnContactoPage() {
  redirect('/contacto')
}
