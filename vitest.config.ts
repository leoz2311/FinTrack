import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  cacheDir: './node_modules/.vitest',
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: { include: ['src/**/*.test.ts'], environment: 'node', pool: 'threads', coverage: { reporter: ['text', 'html'] } }
})
