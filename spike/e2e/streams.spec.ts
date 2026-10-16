import { test, expect, type Page } from '@playwright/test'

// R3: the real player build plays each protocol, from a cross-origin server with and without CORS.
const streams = { progressive: '/tone.mp3', infinite: '/live.mp3', hls: '/hls/index.m3u8', dash: '/dash/manifest.mpd' }
const origins = { cors: 'http://localhost:8901', 'no-cors': 'http://localhost:8902' }

async function playAndMeasure(page: Page, stream: string) {
  const failed: string[] = []
  page.on('pageerror', (e) => failed.push(`pageerror: ${e.message}`))
  page.on('requestfailed', (r) => failed.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`))
  await page.goto(`/?stream=${encodeURIComponent(stream)}`)
  await page.getByRole('button', { name: 'Play' }).click()
  // Give the stream up to 10 s to advance at least 1.5 s.
  const progressed = await page
    .waitForFunction(() => { const a = document.querySelector('audio'); return !!a && !a.paused && a.currentTime > 1.5 }, null, { timeout: 10_000 })
    .then(() => true, () => false)
  const audio = await page.evaluate(() => {
    const a = document.querySelector('audio')!
    return { paused: a.paused, currentTime: Math.round(a.currentTime * 10) / 10, crossOrigin: a.crossOrigin,
      error: a.error ? a.error.code : null, readyState: a.readyState }
  })
  const errorShown = await page.getByText('Unable to play the stream').isVisible()
  return { progressed, audio, errorShown, failed }
}

for (const [originName, origin] of Object.entries(origins)) {
  for (const [kind, p] of Object.entries(streams)) {
    test(`${kind} · ${originName}`, async ({ page }, info) => {
      const r = await playAndMeasure(page, origin + p)
      await info.attach('result', { body: JSON.stringify(r, null, 2), contentType: 'application/json' })
      console.log(`[R3] ${info.project.name} · ${kind} · ${originName} → ${JSON.stringify(r)}`)
      if (originName === 'cors') expect(r.progressed, JSON.stringify(r)).toBe(true)
      // no-cors is a measurement (C1): recorded, not asserted.
    })
  }
}
