import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Deribit Options & DI Tracker',
        short_name: 'DeribitPro',
        description: 'Options chain, IV tracker, Dual Investment & Term Structure',
        theme_color: '#060a0f',
        background_color: '#060a0f',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/www\.deribit\.com\/api/,
            handler: 'NetworkFirst',
            options: { cacheName: 'deribit-api', expiration: { maxAgeSeconds: 60 } }
          }
        ]
      }
    })
  ]
})
