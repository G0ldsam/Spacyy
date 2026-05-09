import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['../**/*.test.ts', '**/*.test.ts'],
    exclude: ['node_modules', '.next'],
    reporters: ['verbose'],
  },
  resolve: {
    alias: {
      '@/shared': path.resolve(__dirname, '../shared'),
      '@': path.resolve(__dirname, '.'),
    },
  },
})
