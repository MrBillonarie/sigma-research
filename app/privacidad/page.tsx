import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de Privacidad — Sigma Research',
  description: 'Política de privacidad y protección de datos de Sigma Research.',
}

const sections = [
  {
    id: '1',
    title: '1. RESPONSABLE DEL TRATAMIENTO',
    body: [
      'Sigma Research ("nosotros", "la Empresa") es el responsable del tratamiento de los datos personales recabados a través de la Plataforma. Puedes contactarnos en: privacidad@sigma-research.io',
    ],
  },
  {
    id: '2',
    title: '2. DATOS QUE RECOPILAMOS',
    body: [
      'Recopilamos únicamente los datos necesarios para la prestación del servicio: (a) Datos de cuenta: nombre, dirección de correo electrónico y contraseña (almacenada con hash bcrypt). (b) Datos de uso: acciones dentro de la Plataforma, alertas configuradas, preferencias de pantalla. (c) Datos técnicos: dirección IP, tipo de navegador, sistema operativo y páginas visitadas, con fines de seguridad y mejora del servicio.',
      'No recopilamos datos de pago directamente. Los pagos son procesados por un proveedor externo certificado PCI-DSS; únicamente almacenamos un identificador de suscripción anonimizado.',
    ],
  },
  {
    id: '3',
    title: '3. FINALIDAD Y BASE LEGAL',
    body: [
      'Tratamos tus datos para: (a) Prestación del servicio contratado — base legal: ejecución del contrato. (b) Comunicaciones transaccionales (confirmaciones, alertas de seguridad) — base legal: ejecución del contrato. (c) Comunicaciones de marketing (novedades, actualizaciones de modelos) — base legal: consentimiento expreso, revocable en cualquier momento. (d) Mejora del servicio y detección de fraude — base legal: interés legítimo.',
    ],
  },
  {
    id: '4',
    title: '4. CONSERVACIÓN DE DATOS',
    body: [
      'Conservamos tus datos personales mientras tu cuenta esté activa. Tras la cancelación de la cuenta, los datos se eliminan en un plazo máximo de 90 días, salvo obligación legal de conservación.',
      'Los datos de uso anonimizados pueden conservarse indefinidamente para análisis estadístico agregado.',
    ],
  },
  {
    id: '5',
    title: '5. COMPARTICIÓN CON TERCEROS',
    body: [
      'No vendemos, alquilamos ni compartimos tus datos personales con terceros con fines comerciales. Únicamente compartimos datos con: (a) Proveedores de infraestructura cloud que actúan como encargados del tratamiento bajo contrato y con garantías adecuadas. (b) Proveedores de pago, exclusivamente los datos necesarios para procesar la transacción. (c) Autoridades públicas cuando sea legalmente requerido.',
    ],
  },
  {
    id: '6',
    title: '6. SEGURIDAD',
    body: [
      'Implementamos medidas técnicas y organizativas apropiadas para proteger tus datos: cifrado en tránsito (TLS 1.3), cifrado en reposo (AES-256), autenticación de doble factor disponible, y controles de acceso internos basados en el principio de mínimo privilegio.',
      'En caso de brecha de seguridad que afecte a tus datos, te notificaremos en los plazos establecidos por la normativa aplicable.',
    ],
  },
  {
    id: '7',
    title: '7. TUS DERECHOS',
    body: [
      'De acuerdo con el Reglamento General de Protección de Datos (RGPD) y la normativa española aplicable, tienes derecho a: acceder a tus datos, rectificarlos, suprimirlos ("derecho al olvido"), oponerte al tratamiento, solicitar la portabilidad y limitar el tratamiento.',
      'Para ejercer cualquiera de estos derechos, escríbenos a privacidad@sigma-research.io adjuntando una copia de tu documento de identidad. Responderemos en un plazo máximo de 30 días.',
    ],
  },
  {
    id: '8',
    title: '8. COOKIES',
    body: [
      'Utilizamos cookies estrictamente necesarias para el funcionamiento de la sesión y cookies analíticas propias (sin terceros) para medir el uso de la Plataforma. No utilizamos cookies publicitarias ni de seguimiento entre sitios.',
      'Puedes configurar tu navegador para rechazar cookies, aunque algunas funcionalidades de la Plataforma pueden verse afectadas.',
    ],
  },
  {
    id: '9',
    title: '9. CAMBIOS EN ESTA POLÍTICA',
    body: [
      'Podemos actualizar esta Política periódicamente. Notificaremos los cambios materiales por correo electrónico con al menos 15 días de antelación. El uso continuado de la Plataforma tras la entrada en vigor de los cambios implica su aceptación.',
    ],
  },
  {
    id: '10',
    title: '10. CONTACTO Y RECLAMACIONES',
    body: [
      'Para cualquier consulta sobre privacidad: privacidad@sigma-research.io. Si consideras que el tratamiento de tus datos vulnera la normativa, tienes derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (aepd.es).',
    ],
  },
]

export default function PrivacidadPage() {
  return (
    <main className="bg-bg min-h-screen">

      {/* Hero */}
      <section className="pt-40 pb-20 px-6 bg-grid-pattern bg-grid relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <div className="section-label text-gold mb-6">{'// LEGAL'}</div>
          <h1 className="display-heading text-6xl sm:text-8xl text-text leading-none mb-6">
            POLÍTICA DE
            <br />
            <span className="gold-text">PRIVACIDAD</span>
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
                href="/terminos"
                className="section-label text-text-dim hover:text-gold transition-colors"
              >
                → Términos y Condiciones
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
