import { test, expect, type Page } from '@playwright/test'
import { CORS, NO_CORS, openHarness } from './helpers'

// R1a (C1): a direct source from an origin without CORS. (a) with crossOrigin it fails (control);
// (b) a retry on the same element without crossOrigin plays; (c) the same after
// createMediaElementSource() on the element (welcome screen with a visualizer): does it advance,
// is the analyser flat; (d) without crossOrigin and without Web Audio it plays; (e) a 404 with and
// without CORS against "no CORS": MediaError, time to the error, and whether a fetch probe tells
// them apart. Endless /live.mp3 and finite /tone.mp3. Each case attaches its measurement as JSON.
const PATHS = ['/live.mp3', '/tone.mp3'] as const

type Outcome = { outcome: 'playing' | 'error' | 'timeout'; ms: number; error: { code: number; message: string } | null; play: string }

// Loads (or reloads) and plays; resolves on the first 'playing' or 'error' after `mark` (an event type).
async function playUntil(page: Page, mark: string): Promise<Outcome> {
  return page.evaluate(async (mark) => {
    const s = (window as any).spike
    const from = s.events.findLastIndex((e: any) => e.type === mark)
    const start = s.events[from].t
    const play = s.play()
    const deadline = performance.now() + 10_000
    for (;;) {
      const e = s.events.slice(from + 1).find((x: any) => x.type === 'playing' || x.type === 'error')
      if (e) return { outcome: e.type, ms: e.t - start, error: s.error(), play: await play }
      if (performance.now() > deadline) return { outcome: 'timeout', ms: 10_000, error: s.error(), play: 'pending' }
      await new Promise((r) => setTimeout(r, 20))
    }
  }, mark)
}

async function loadDirect(page: Page, url: string, crossOrigin: boolean) {
  await page.evaluate(([u, c]) => (window as any).spike.loadDirect(u, { crossOrigin: c }), [url, crossOrigin] as const)
  return playUntil(page, 'loadDirect')
}

async function retry(page: Page) {
  await page.evaluate(() => (window as any).spike.retryWithoutCors())
  return playUntil(page, 'retryWithoutCors')
}

// As the visualizer: AudioContext + createMediaElementSource() inside a real click, then resume().
async function connectInGesture(page: Page) {
  await page.evaluate(() => (window as any).spike.armGesture('connectAnalyser'))
  await page.click('#gesture')
  await page.evaluate(() => (window as any).spike.gestureResult)
  return page.evaluate(() => (window as any).spike.resumeContext())
}

const measure = (page: Page) => page.evaluate(() => (window as any).spike.measure({ delta: 2, timeout: 8000 }))

async function report(name: string, body: object) {
  await test.info().attach(`r1a-${name}`, { body: JSON.stringify(body, null, 2), contentType: 'application/json' })
  console.log(`[${test.info().project.name}] ${name}: ${JSON.stringify(body, (k, v) => (k === 'samples' || k === 'events' ? undefined : v))}`)
}

const summary = (m: any) => ({ advanced: m.advanced, ms: m.ms, maxRms: m.maxRms, firstSignalMs: m.firstSignalMs, error: m.state.error, ctxState: m.state.ctxState })

test.describe('R1a: direct source without CORS', () => {
  for (const p of PATHS) {
    test(`${p} (a) with crossOrigin fails, (b) retry without it plays`, async ({ page }) => {
      const external = await openHarness(page)
      const first = await loadDirect(page, `${NO_CORS}${p}`, true)
      const second = await retry(page)
      const m = await measure(page)
      await report(`retry${p.replace('/', '-')}`, { first, second, measure: summary(m), external })
      expect(first.outcome, JSON.stringify(first)).toBe('error')
      expect(first.error?.code).toBe(4)
      expect(second.outcome, JSON.stringify(second)).toBe('playing')
      expect(m.advanced).toBeGreaterThanOrEqual(2)
      expect(m.state.crossOrigin).toBeNull()
      expect(external).toEqual([])
    })

    test(`${p} (c) retry after createMediaElementSource()`, async ({ page }) => {
      const external = await openHarness(page)
      const ctxState = await connectInGesture(page)
      const first = await loadDirect(page, `${NO_CORS}${p}`, true)
      const second = await retry(page)
      const m = await measure(page)
      await report(`analyser-then-retry${p.replace('/', '-')}`, { ctxState, first, second, measure: summary(m), samples: m.samples, external })
      expect(first.outcome, JSON.stringify(first)).toBe('error')
      expect(second.outcome, JSON.stringify(second)).toBe('playing')
      expect(m.advanced).toBeGreaterThanOrEqual(2)
      // Tainted element: Web Audio outputs zeros, and so does the speaker (the element's output is the graph's).
      expect(m.maxRms).toBe(0)
      expect(external).toEqual([])
    })

    // Control for (c): the same graph with a CORS origin gives real data, except for the endless MP3 in
    // WebKit on macOS: zeros while it advances (also with crossOrigin before src, and for 7 s). R1b digs.
    test(`${p} (c') createMediaElementSource() with CORS`, async ({ page, browserName }) => {
      const external = await openHarness(page)
      const ctxState = await connectInGesture(page)
      const first = await loadDirect(page, `${CORS}${p}`, true)
      const m = await measure(page)
      await report(`analyser-cors${p.replace('/', '-')}`, { ctxState, first, measure: summary(m), samples: m.samples, external })
      expect(first.outcome).toBe('playing')
      expect(m.advanced).toBeGreaterThanOrEqual(2)
      if (browserName === 'webkit' && p === '/live.mp3') expect(m.maxRms).toBe(0)
      else expect(m.maxRms).toBeGreaterThan(0)
      expect(external).toEqual([])
    })

    test(`${p} (d) without crossOrigin and without Web Audio plays`, async ({ page }) => {
      const external = await openHarness(page)
      const first = await loadDirect(page, `${NO_CORS}${p}`, false)
      const m = await measure(page)
      await report(`plain${p.replace('/', '-')}`, { first, measure: summary(m), external })
      expect(first.outcome).toBe('playing')
      expect(m.advanced).toBeGreaterThanOrEqual(2)
      expect(external).toEqual([])
    })
  }

  // Control for every /live.mp3 case: the fixture. /live-tagged.mp3 loops the whole tone.mp3, as
  // tests/e2e/media-server.mjs does; its Info frame says 8.05 s and WebKit on macOS drops the buffer
  // there and stops (no error, no request). /live.mp3 loops the frames alone and plays on.
  test('fixture: the Info frame of a looped tone.mp3 stops WebKit', async ({ page, browserName }) => {
    const external = await openHarness(page)
    const results: Record<string, object> = {}
    for (const p of ['/live.mp3', '/live-tagged.mp3']) {
      await page.evaluate(() => (window as any).spike.reset())
      const first = await loadDirect(page, `${CORS}${p}`, false)
      const m = await page.evaluate(() => (window as any).spike.measure({ delta: 6, timeout: 9000 }))
      results[p] = { first, measure: summary(m), buffered: m.state.buffered }
    }
    await report('fixture', { results, external })
    expect((results['/live.mp3'] as any).measure.advanced).toBeGreaterThanOrEqual(6)
    const tagged = (results['/live-tagged.mp3'] as any).measure.advanced
    if (browserName === 'webkit') expect(tagged).toBeLessThan(2)
    else expect(tagged).toBeGreaterThanOrEqual(6)
    expect(external).toEqual([])
  })

  // (e) Same MediaError for "no CORS" and 404? And can a fetch probe tell them apart?
  test('(e) 404 vs no CORS: MediaError, time and fetch probe', async ({ page }) => {
    const external = await openHarness(page)
    const cases = {
      noCors: `${NO_CORS}/live.mp3`,
      noCorsFinite: `${NO_CORS}/tone.mp3`,
      notFoundCors: `${CORS}/404.mp3`,
      notFoundNoCors: `${NO_CORS}/404.mp3`,
    }
    const results: Record<string, object> = {}
    for (const [name, url] of Object.entries(cases)) {
      await page.evaluate(() => (window as any).spike.reset())
      const media = await loadDirect(page, url, true)
      const probeCors = await page.evaluate((u) => (window as any).spike.probe(u, 'cors'), url)
      const probeNoCors = await page.evaluate((u) => (window as any).spike.probe(u, 'no-cors'), url)
      // What the C1 retry would do on a 404: a second request, and the same error again.
      const retried = await retry(page)
      results[name] = { media, probeCors, probeNoCors, retried }
    }
    await report('errors', { results, external })
    for (const r of Object.values(results) as any[]) {
      expect(r.media.outcome).toBe('error')
      expect(r.media.error.code).toBe(4)
    }
    expect((results.noCors as any).retried.outcome).toBe('playing')
    expect((results.notFoundCors as any).retried.outcome).toBe('error')
    expect((results.notFoundNoCors as any).retried.outcome).toBe('error')
    expect(external).toEqual([])
  })
})
