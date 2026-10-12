import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Ignore nested agent worktrees; this checkout owns only its root suite.
    include: ['tests/**/*.test.{ts,tsx}']
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) }
  }
})
