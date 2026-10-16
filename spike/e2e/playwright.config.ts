import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'results/results.json' }]],
  use: { baseURL: 'http://localhost:8900', trace: 'retain-on-failure' },
  webServer: { command: 'node server.mjs', url: 'http://localhost:8900/dist/manifest.json', reuseExistingServer: true },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { args: process.env.NO_AUTOPLAY_FLAG ? [] : ['--autoplay-policy=no-user-gesture-required'] } },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
