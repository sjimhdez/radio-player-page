import type { Page } from '@playwright/test'

export const CORS = 'http://localhost:8911'
export const NO_CORS = 'http://localhost:8912'

// Aborts and records every http(s) request that leaves localhost (nothing may reach the internet).
export async function blockExternal(page: Page): Promise<string[]> {
  const external: string[] = []
  await page.route(
    (url) => /^https?:$/.test(url.protocol) && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1',
    (route) => { external.push(route.request().url()); return route.abort() },
  )
  return external
}

// Opens the harness with a fresh <audio>, external requests blocked.
export async function openHarness(page: Page): Promise<string[]> {
  const external = await blockExternal(page)
  await page.goto('/')
  await page.waitForFunction(() => (window as any).spike?.audio)
  return external
}
