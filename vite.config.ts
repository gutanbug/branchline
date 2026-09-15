import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  optimizeDeps: { include: ['react-dom', '@base-ui/react/context-menu', '@base-ui/react/menu'] },
  plugins: [react(), {
    name: 'desktop-content-security-policy',
    apply: 'build',
    transformIndexHtml: (_html, context) => context.path === '/index.html' ? [{
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'" },
      injectTo: 'head-prepend',
    }] : [],
  }],
  base: './',
})
