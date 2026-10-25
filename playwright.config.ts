import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against a production build served under a
 * GitHub Pages-style sub-path to prove base-path + HashRouter compatibility.
 */
const BASE_PATH = '/it-finance-demo/'
const PORT = 4179

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE_PATH}`,
    env: { VITE_BASE_PATH: BASE_PATH },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
