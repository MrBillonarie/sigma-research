import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Términos y Condiciones — Sigma Research',
  description: 'Términos y condiciones de uso de la plataforma Sigma Research.',
}

const sections = [
  {
    id: '1',
    title: '1. ACEPTACIÓN DE LOS TÉRMINOS',
    body: [
      'Al acceder o utilizar la plataforma Sigma Research ("la Plataforma"), aceptas quedar vinculado por estos Términos y Condiciones ("Términos"). Si no estás de acuerdo con alguna parte de estos Términos, no debes utilizar la Plataforma.',
      'Sigma Research se reserva el derecho de modificar estos Términos en cualquier momento. Los cambios entrarán en vigor en el momento de su publicación en la Plataforma. El uso continuado de la Plataforma tras la publicación de cambios constituye tu aceptación de los nuevos Términos.',
    ],
  },
  {
    id: '2',
    title: '2. DESCRIPCIÓN DEL SERVICIO',
    body: [
      'Sigma Research provee herramientas de análisis cuantitativo de mercados financieros, incluyendo pero no limitándose a: modelos estadísticos de régimen de mercado, forecasting de volatilidad, screeners de activos, señales algorítmicas y calculadoras de planificación financiera.',
      'El servicio se presta "tal cual" ("as-is") y está sujeto a disponibilidad. Sigma Research no garantiza un tiempo de actividad (uptime) determinado, aunque nos esforzamos por mantener una disponibilidad del 99,5% mensual.',
    ],
  },
  {
    id: '3',
    title: '3. USO PERMITIDO',
    body: [
      'La Plataforma está destinada exclusivamente al uso personal o profesional del usuario registrado. Queda expresamente prohibido: (a) revender, sublicenciar o redistribuir cualquier contenido, señal o dato obtenido a través de la Plataforma; (b) utilizar medios automatizados para extraer datos en masa (scraping) sin autorización escrita previa; (c) usar la Plataforma para actividades ilegales o que vulneren derechos de terceros.',
      'El acceso a la API (plan Institutional) está sujeto a límites de uso definidos en el contrato correspondiente. El uso que exceda dichos límites podrá resultar en la suspensión temporal o permanente del acceso.',
    ],
  },
  {
    id: '4',
    title: '4. INFORMACIÓN FINANCIERA Y DESCARGO DE RESPONSABILIDAD',
    body: [
      'El contenido de Sigma Research tiene carácter exclusivamente informativo y educativo. Nada de lo publicado en la Plataforma constituye asesoramiento financiero, de inversión, legal o fiscal. Los modelos y señales son herramientas analíticas basadas en datos históricos y estadísticos; el rendimiento pasado no garantiza resultados futuros.',
      'Sigma Research no es una empresa de inversión registrada ni un asesor de inversiones regulado. Las decisiones de inversión son responsabilidad exclusiva del usuario. Sigma Research no será responsable de ninguna pérdida financiera derivada del uso, directo o indirecto, de la información proporcionada en la Plataforma.',
    ],
  },
  {
    id: '5',
    title: '5. CUENTAS DE USUARIO',
    body: [
      'Para acceder a las funcionalidades de la Plataforma debes crear una cuenta con un email válido y una contraseña segura. Eres responsable de mantener la confidencialidad de tus credenciales y de todas las actividades que ocurran bajo tu cuenta.',
      'Sigma Research se reserva el derecho de suspender o cancelar cuentas que violen estos Términos, que muestren actividad fraudulenta o que hayan estado inactivas por más de 24 meses consecutivos.',
    ],
  },
  {
    id: '6',
    title: '6. PAGOS Y CANCELACIONES',
    body: [
      'Los planes de pago se facturan mensualmente por adelantado. Puedes cancelar tu suscripción en cualquier momento desde el panel de cuenta; la cancelación tendrá efecto al final del periodo de facturación en curso, sin derecho a reembolso proporcional del tiempo restante salvo en los casos establecidos por la normativa de consumidores aplicable.',
      'Los precios pueden variar. Notificaremos cualquier cambio de precio con al menos 30 días de antelación mediante correo electrónico a la dirección asociada a tu cuenta.',
    ],
  },
  {
    id: '7',
    title: '7. PROPIEDAD INTELECTUAL',
    body: [
      'Todos los contenidos de la Plataforma —incluyendo modelos, algoritmos, código, textos, gráficos, marcas y logotipos— son propiedad de Sigma Research o de sus licenciantes y están protegidos por la legislación de propiedad intelectual aplicable.',
      'Se te concede una licencia limitada, no exclusiva, no transferible y revocable para acceder y utilizar la Plataforma únicamente para los fines previstos en estos Términos.',
    ],
  },
  {
    id: '8',
    title: '8. LIMITACIÓN DE RESPONSABILIDAD',
    body: [
      'En la máxima medida permitida por la ley, Sigma Research no será responsable de daños indirectos, incidentales, especiales, consecuentes o punitivos, ni de pérdida de beneficios o ingresos, tanto si han sido advertidos como si no, derivados del uso o la imposibilidad de uso de la Plataforma.',
      'La responsabilidad total de Sigma Research ante el usuario, por cualquier causa y bajo cualquier teoría legal, no superará el importe abonado por el usuario en los 3 meses anteriores al evento que originó la reclamación.',
    ],
  },
  {
    id: '9',
    title: '9. LEY APLICABLE',
    body: [
      'Estos Términos se rigen por las leyes españolas. Cualquier disputa que no pueda resolverse amistosamente se someterá a la jurisdicción exclusiva de los tribunales de Madrid, España.',
    ],
  },
  {
    id: '10',
    title: '10. CONTACTO',
    body: [
      'Para cualquier consulta relativa a estos Términos, puedes contactarnos en: legal@sigma-research.io',
    ],
  },
]

export default function TerminosPage() {
  return (
    <main className="bg-bg min-h-screen">

      {/* Hero */}
      <section className="pt-40 pb-20 px-6 bg-grid-pattern bg-grid relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <div className="section-label text-gold mb-6">{'// LEGAL'}</div>
          <h1 className="display-heading text-6xl sm:text-8xl text-text leading-none mb-6">
            TÉRMINOS Y
            <br />
            <span className="gold-text">CONDICIONES</span>
          </h1>
          <p className="terminal-text text-text-dim text-xs">
            Última actualización: enero 2025
          </p>
        </div>
      </section>

      {/* Índice + Contenido */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-[240px_1fr] gap-12 items-start">

          {/* Índice lateral sticky */}
          <nav className="hidden lg:flex flex-col gap-1 sticky top-24">
            <div className="section-label text-gold mb-3">ÍNDICE</div>
            {sections.map(s => (
              <a
                key={s.id}
                href={`#s${s.id}`}
                className="terminal-text text-xs text-text-dim hover:text-gold transition-colors py-1"
              >
                {s.title.split('. ')[1]}
              </a>
            ))}
          </nav>

          {/* Cuerpo */}
          <div className="flex flex-col gap-12">
            {sections.map(s => (
              <div key={s.id} id={`s${s.id}`} className="scroll-mt-24">
                <h2 className="display-heading text-2xl text-gold mb-4">{s.title}</h2>
                <div className="flex flex-col gap-4">
                  {s.body.map((p, i) => (
                    <p key={i} className="terminal-text text-sm text-text-dim leading-relaxed">{p}</p>
                  ))}
                </div>
              </div>
            ))}

            <div className="pt-8 border-t border-border flex flex-col sm:flex-row gap-4">
              <Link
                href="/privacidad"
                className="section-label text-text-dim hover:text-gold transition-colors"
              >
                → Política de Privacidad
              </Link>
              <Link
                href="/faq"
                className="section-label text-text-dim hover:text-gold transition-colors"
              >
                → Preguntas Frecuentes
              </Link>
            </div>
          </div>
        </div>
      </section>

    </main>
  )
}
