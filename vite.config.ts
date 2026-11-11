import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fintrack-icon.svg', 'fintrack-icon-192.png', 'fintrack-icon-512.png'],
      manifest: {
        name: 'FinTrack — osobne financije',
        short_name: 'FinTrack',
        description: 'Privatno upravljanje osobnim financijama',
        lang: 'hr-HR',
        start_url: '/',
        display: 'standalone',
        background_color: '#07101f',
        theme_color: '#07101f',
        orientation: 'any',
        icons: [
          { src: '/fintrack-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/fintrack-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/fintrack-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\//,
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ],
  server: { port: 4173 },
  preview: { port: 4173 }
})
