import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// CSP en meta tag, injectée uniquement dans le build de prod : en dev, le préambule
// React Refresh de @vitejs/plugin-react s'exécute via un <script type="module"> inline,
// que 'script-src self' bloquerait (cassant le HMR). Le build de prod, lui, n'a plus
// aucun script inline (tout est bundlé en fichiers externes servis en 'self').
// Defense in depth derrière la sanitisation DOMPurify du corps des emails
// (voir src/features/inbox/MessageBubble.tsx) — protège même en cas de bypass DOMPurify.
function cspPlugin(): Plugin {
  return {
    name: 're-mail-csp',
    apply: 'build',
    transformIndexHtml() {
      const csp = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src * data: blob:",
        "font-src 'self' data:",
        "connect-src 'self' http://localhost:3001 https://re-mail.onrender.com",
        "frame-src 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: csp },
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

export default defineConfig({
  plugins: [react(), cspPlugin()],
  server: { port: 5173 },
})
