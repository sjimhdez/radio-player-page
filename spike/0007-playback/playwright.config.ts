import { defineConfig, devices } from '@playwright/test'

// Spike 0007 phase 0. Ports 8910–8912 do not clash with the e2e (8901–8902) nor spike/e2e (8900–8902).
// NO_AUTOPLAY_FLAG=1 runs Chromium with its default autoplay policy (R1b).
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
      use: { ...devices['Desktop Chrome'], launchOptions: { args: process.env.NO_AUTOPLAY_FLAG ? [] : ['--autoplay-policy=no-user-gesture-required'] } },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
