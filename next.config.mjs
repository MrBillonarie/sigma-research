/** @type {import('next').NextConfig} */
const nextConfig = {

  // Elimina el header X-Powered-By: Next.js (fingerprinting)
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [

          // ── HSTS — fuerza HTTPS por 1 año, con subdomains y preload ──────────
          {
            key:   'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },

          // ── Previene MIME-type sniffing (drive-by download attacks) ──────────
          {
            key:   'X-Content-Type-Options',
            value: 'nosniff',
          },

          // ── Clickjacking — ningún iframe puede embeber el sitio ──────────────
          {
            key:   'X-Frame-Options',
            value: 'DENY',
          },

          // ── XSS Protection heredado — desactivado a favor del CSP ───────────
          {
            key:   'X-XSS-Protection',
            value: '0',
          },

          // ── Referrer Policy ──────────────────────────────────────────────────
          {
            key:   'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },

          // ── Permissions Policy — deshabilita APIs del browser no usadas ──────
          {
            key:   'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), interest-cohort=(), accelerometer=(), gyroscope=(), magnetometer=()',
          },

          // ── Cross-Origin Opener Policy ───────────────────────────────────────
          // same-origin-allow-popups necesario para Google OAuth popup
          {
            key:   'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },

          // ── Cross-Origin Resource Policy ────────────────────────────────────
          {
            key:   'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },

          // ── Content Security Policy ──────────────────────────────────────────
          // 'unsafe-inline' y 'unsafe-eval' en script-src son requeridos por
          // Next.js 14 App Router (hydration + React Server Components).
          {
            key:   'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https://*.googleusercontent.com https://lh3.googleusercontent.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.binance.com https://api3.binance.com https://api4.binance.com wss://stream.binance.com:9443 https://accounts.google.com https://oauth2.googleapis.com",
              "frame-src 'none'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },

        ],
      },
    ]
  },
}

export default nextConfig
