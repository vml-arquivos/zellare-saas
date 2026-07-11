import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Carimbo de build: injeta a data/hora do build para verificação visual no PWA.
  // Permite confirmar EXATAMENTE qual build está no ar (resolve "fiz deploy e não vejo mudança").
  define: {
    __BUILD_ID__: JSON.stringify(
      new Date().toISOString().slice(0, 16).replace('T', ' ')
    ),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'brand/zelare-logo-square.png'],
      manifest: {
        name: 'Zelare',
        short_name: 'Zelare',
        description: 'cuidado, pedagogia e gestão inteligente',
        theme_color: '#003f4d',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/app/mobile',
        scope: '/',
        lang: 'pt-BR',
        icons: [
          { src: 'favicon.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'brand/zelare-icon-card.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        shortcuts: [
          { name: 'Chamada', url: '/app/mobile/chamada', description: 'Registrar chamada da turma' },
          { name: 'Diário', url: '/app/mobile/diario', description: 'Escrever no diário da turma' },
          { name: 'Observação', url: '/app/mobile/observacao', description: 'Observação individual de criança' },
        ],
        categories: ['education', 'productivity'],
      },
      workbox: {
        // Aumentar limite para arquivos grandes (chunks do recharts etc.)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
        // Cache estratégico: app shell sempre do cache, dados da rede com fallback
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // API: network-first com fallback para cache (dados frescos quando online)
            urlPattern: /^https:\/\/api\.zelare\.seu-dominio\.com\.br\/(?!auth).*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Auth: sempre da rede (tokens não podem ser stale)
            urlPattern: /^https:\/\/api\.zelare\.seu-dominio\.com\.br\/auth.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Assets estáticos: cache-first (imagens, fontes)
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|woff|woff2)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
        // Background sync para ações offline
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/health/],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['react-is'],
  },
  build: {
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react-router') || id.includes('react-is')) return 'vendor-react'
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts'
            if (id.includes('lucide-react')) return 'vendor-icons'
            if (id.includes('@tanstack')) return 'vendor-query'
            if (id.includes('workbox') || id.includes('vite-plugin-pwa')) return 'vendor-pwa'
            return 'vendor'
          }
        },
      },
    },
  },
})
