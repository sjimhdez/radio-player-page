import { defineConfig, devices } from '@playwright/test'

// Spike 0007 phase 0. Ports 8910–8912 do not clash with the e2e (8901–8902) nor spike/e2e (8900–8902).
// AUTOPLAY_POLICY sets Chromium's --autoplay-policy (R1b); default no-user-gesture-required. Headless Chromium
// without the flag is as permissive, so the strict case is AUTOPLAY_POLICY=user-gesture-required.
export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'results/results.json' }]],
  use: { baseURL: 'http://localhost:8910', trace: 'retain-on-failure' },
  webServer: { command: 'node server.mjs', url: 'http://localhost:8910/', reuseExistingServer: true },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { args: [`--autoplay-policy=${process.env.AUTOPLAY_POLICY || 'no-user-gesture-required'}`] } },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
