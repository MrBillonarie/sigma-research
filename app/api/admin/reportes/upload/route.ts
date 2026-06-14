import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAdminAuth } from '@/lib/adminAuth'
import crypto from 'crypto'

const BUCKET   = 'Reportes'
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB máximo

// Magic bytes de PDF: %PDF
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46])

function makeService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function isPdf(buffer: ArrayBuffer): boolean {
  const header = Buffer.from(buffer.slice(0, 4))
  return header.equals(PDF_MAGIC)
}

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // 1. Validar extensión
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Solo se permiten archivos PDF' }, { status: 400 })
  }

  // 2. Validar tamaño (max 10MB)
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'El archivo supera el límite de 10 MB' }, { status: 413 })
  }

  const bytes = await file.arrayBuffer()

  // 3. Validar magic bytes (firma real del PDF, no solo extensión)
  if (!isPdf(bytes)) {
    return NextResponse.json({ error: 'El archivo no es un PDF válido' }, { status: 400 })
  }

  const safeName = `${Date.now()}-${crypto.randomUUID()}.pdf`
  const path     = safeName

  const supabase = makeService()
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: 'application/pdf', upsert: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: publicUrl })
}
