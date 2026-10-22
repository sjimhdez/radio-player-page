import { test, expect } from '@playwright/test'
import { CORS, openHarness } from './helpers'

// The harness loads (with hls.js and dashjs) and an MP3 with CORS advances.
test('harness loads and a CORS MP3 advances', async ({ page }) => {
  const external = await openHarness(page)
  expect(await page.evaluate(() => typeof (window as any).Hls === 'function' && typeof (window as any).dashjs === 'object')).toBe(true)

  await page.evaluate((url) => (window as any).spike.loadDirect(url), `${CORS}/tone.mp3`)
  expect(await page.evaluate(() => (window as any).spike.play())).toBe('ok')
  const r = await page.evaluate(() => (window as any).spike.measure({ delta: 1 }))
  expect(r.advanced, JSON.stringify(r)).toBeGreaterThanOrEqual(1)
  expect(r.state.error).toBeNull()
  expect(external).toEqual([])
})
