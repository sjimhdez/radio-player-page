import { test, expect, type Page } from '@playwright/test'
import { CORS, blockExternal, openHarness } from './helpers'

// R1b (ADR 0031): with CORS, does the analyser get real data for each protocol, and when must the
// AudioContext be created or resumed? (1) Per protocol, the visualizer wired and the context resumed
// inside the Play click. (2) What makes WebKit's analyser flat with an endless MP3 (R1a): endless,
// no length/Range, ID3/Info frame, or connecting before 'playing'. (3) The context created outside the
// gesture, as use-audio-visualizer.tsx does today (after 'playing'), with and without a prior click:
// state, whether resume() outside the gesture starts it, whether the diverted audio goes mute.
// Run also with AUTOPLAY_POLICY=user-gesture-required (Chromium, strict autoplay). Each case attaches its JSON.
type Load = (page: Page) => Promise<unknown>

const direct = (url: string, order: 'before' | 'after' = 'after'): Load => (page) =>
  page.evaluate(([u, o]) => (window as any).spike.loadDirect(u, { order: o }), [url, order] as const)

const SOURCES: Record<string, Load> = {
  'mp3-file': direct(`${CORS}/tone.mp3`),
  'mp3-live': direct(`${CORS}/live.mp3`),
  'hls.js': (page) => page.evaluate((u) => (window as any).spike.loadHls(u), `${CORS}/hls/index.m3u8`),
  'dash-vod': (page) => page.evaluate((u) => (window as any).spike.loadDash(u), `${CORS}/dash/manifest.mpd`),
  'dash-live': (page) =>
    page.evaluate((u) => (window as any).spike.loadDash(u, { clearTimeSources: 'after' }), `${CORS}/live.mpd`),
}

// Variants of the direct MP3 that isolate why WebKit's analyser stays flat with /live.mp3.
// `webkitData`: whether WebKit's analyser gets data (measured): only with Content-Length and Range.
const MP3_VARIANTS: Record<string, { path: string; webkitData: boolean }> = {
  'live (frames, endless)': { path: '/live.mp3', webkitData: false },
  'live-tagged (ID3+Info, endless)': { path: '/live-tagged.mp3', webkitData: false },
  'tone (ID3+Info, length, Range)': { path: '/tone.mp3', webkitData: true },
  'tone chunked (ID3+Info, no length)': { path: '/tone.mp3?chunked=1', webkitData: false },
  'frames (length, Range)': { path: '/frames.mp3', webkitData: true },
  'frames chunked (no length)': { path: '/frames.mp3?chunked=1', webkitData: false },
}

const fine = { delta: 3, timeout: 10_000, every: 50 }

async function click(page: Page, name: string, ...args: unknown[]) {
  await page.evaluate(([n, a]) => (window as any).spike.armGesture(n, ...(a as unknown[])), [name, args] as const)
  await page.click('#gesture')
  return page.evaluate(() => (window as any).spike.gestureResult)
}

// Resolves on the first 'playing' or 'error' (or a timeout), from the start of the case.
function waitPlaying(page: Page, timeout = 10_000) {
  return page.evaluate(async (timeout) => {
    const s = (window as any).spike
    const deadline = performance.now() + timeout
    for (;;) {
      const e = s.events.find((x: any) => x.type === 'playing' || x.type === 'error')
      if (e) return { outcome: e.type, t: e.t, error: s.error() }
      if (performance.now() > deadline) return { outcome: 'timeout', t: null, error: s.error() }
      await new Promise((r) => setTimeout(r, 20))
    }
  }, timeout)
}

const measure = (page: Page, opts: object) => page.evaluate((o) => (window as any).spike.measure(o), opts)

const summary = (m: any) => ({ advanced: m.advanced, ms: m.ms, maxRms: m.maxRms, firstSignalMs: m.firstSignalMs,
  error: m.state.error, ctxState: m.state.ctxState })

async function report(name: string, body: object) {
  await test.info().attach(`r1b-${name}`, { body: JSON.stringify(body, null, 2), contentType: 'application/json' })
  console.log(`[${test.info().project.name}${process.env.AUTOPLAY_POLICY ? ` ${process.env.AUTOPLAY_POLICY}` : ''}] ${name}: ${JSON.stringify(body, (k, v) => (k === 'samples' ? undefined : v))}`)
}

test.describe('R1b: analyser data and AudioContext with CORS', () => {
  // (1) Per protocol: loaded, then the Play click wires the analyser, resumes the context and plays.
  for (const [name, load] of Object.entries(SOURCES)) {
    test(`(1) ${name}: analyser wired in the Play gesture`, async ({ page, browserName }) => {
      const external = await openHarness(page)
      await load(page)
      const gesture = await click(page, 'connectAndPlay')
      const m = await measure(page, fine)
      const playing = await waitPlaying(page, 0)
      await report(`protocol-${name}`, { gesture, playing, measure: summary(m), samples: m.samples, external })
      expect(m.state.error).toBeNull()
      expect(m.advanced).toBeGreaterThanOrEqual(3)
      // WebKit (macOS): only a finite MP3 with length feeds the analyser; zeros while it advances otherwise.
      if (browserName === 'webkit' && name !== 'mp3-file') expect(m.maxRms).toBe(0)
      else expect(m.maxRms).toBeGreaterThan(0)
      expect(external).toEqual([])
    })
  }

  // (2) WebKit and the endless MP3: which property of the stream leaves the analyser flat?
  // Each variant twice: wired before load (in the gesture) and wired after 'playing' (context made in a click).
  for (const [name, { path: p, webkitData }] of Object.entries(MP3_VARIANTS)) {
    test(`(2) mp3 ${name}`, async ({ page, browserName }) => {
      const external = await openHarness(page)
      await direct(`${CORS}${p}`)(page)
      await click(page, 'connectAndPlay')
      const before = await measure(page, fine)

      await page.evaluate(() => (window as any).spike.reset())
      await click(page, 'createContext')
      await page.evaluate(() => (window as any).spike.resumeContext())
      await direct(`${CORS}${p}`)(page)
      await page.evaluate(() => (window as any).spike.play())
      const playing = await waitPlaying(page)
      await page.evaluate(() => (window as any).spike.connectAnalyser())
      const after = await measure(page, fine)

      await report(`mp3-${p}`, { before: summary(before), playing, after: summary(after), external })
      expect(before.state.error).toBeNull()
      expect(after.state.error).toBeNull()
      // The wiring moment does not matter: the same result before load and after 'playing'.
      for (const m of [before, after]) {
        if (browserName === 'webkit' && !webkitData) expect(m.maxRms).toBe(0)
        else expect(m.maxRms).toBeGreaterThan(0)
      }
      expect(external).toEqual([])
    })
  }

  // crossOrigin before src (the order phase 1 may adopt) with the endless MP3.
  test('(2) mp3 live, crossOrigin before src', async ({ page, browserName }) => {
    const external = await openHarness(page)
    await direct(`${CORS}/live.mp3`, 'before')(page)
    await click(page, 'connectAndPlay')
    const m = await measure(page, fine)
    await report('mp3-live-before', { measure: summary(m), external })
    expect(m.state.error).toBeNull()
    if (browserName === 'webkit') expect(m.maxRms).toBe(0)
    else expect(m.maxRms).toBeGreaterThan(0)
    expect(external).toEqual([])
  })

  // (3) Context outside the gesture, as today: play, then on 'playing' create it and wire the analyser.
  // The harness drives each case itself (?auto=context) and reports via the console: page.evaluate()
  // runs with a user gesture in Chromium and WebKit and would give the page activation.
  async function auto(page: Page, query: string, clickPlay: boolean) {
    const external = await blockExternal(page)
    const ready = clickPlay && page.waitForEvent('console', { predicate: (m) => m.text().startsWith('auto-ready'), timeout: 10_000 })
    const done = page.waitForEvent('console', { predicate: (m) => m.text().startsWith('auto-done'), timeout: 30_000 })
    await page.goto(`/?auto=context${query}`)
    if (clickPlay) { await ready; await page.click('#gesture') }
    const r = JSON.parse((await done).text().slice('auto-done '.length))
    return { ...r, createdMeasure: summary(r.createdMeasure), resumedOutsideMeasure: summary(r.resumedOutsideMeasure), external }
  }

  // (3a) Play is a real click; the context comes from a timer right after 'playing' (within the transient
  // activation) or 6 s later (sticky activation only, as a slow live stream or a later visualizer switch).
  // Then a real click resumes the context (the Play/visualizer gesture of phase 1).
  // WebKit: created suspended in both; it starts on its own only within the transient activation. Past it,
  // resume() outside a gesture stays pending and the element advances with the analyser at zero (the
  // diverted audio is silent); a click resumes it. Chromium: running in every case.
  for (const delay of [0, 6000]) {
    test(`(3a) AudioContext ${delay} ms after 'playing', after a Play click`, async ({ page, browserName }) => {
      const r = await auto(page, `&click=1&delay=${delay}`, true)
      const inGesture = { result: await click(page, 'resumeContext'),
        ...summary(await measure(page, { delta: 1.5, timeout: 3000, every: 50 })) }
      await report(`context-click-${delay}`, { ...r, inGesture })
      expect(r.play).toBe('ok')
      expect(r.activationAtContext?.transient).toBe(delay === 0)
      const mute = browserName === 'webkit' && delay > 0
      expect(r.created.ctxState).toBe(browserName === 'webkit' ? 'suspended' : 'running')
      expect(r.resumedOutside).toBe(mute ? 'pending' : 'running')
      expect(r.createdMeasure.advanced).toBeGreaterThan(1)
      if (mute) expect(r.createdMeasure.maxRms).toBe(0)
      else expect(r.createdMeasure.maxRms).toBeGreaterThan(0)
      expect(inGesture.result).toBe('running')
      expect(inGesture.maxRms).toBeGreaterThan(0)
      expect(r.external).toEqual([])
    })
  }

  // (3b) No user activation at all; then a real click tries to resume the context.
  test(`(3b) AudioContext after 'playing', no user activation`, async ({ page }) => {
    const r = await auto(page, '', false)
    const inGesture = { result: await click(page, 'resumeContext'),
      ...summary(await measure(page, { delta: 1.5, timeout: 3000, every: 50 })) }
    await report('context-no-activation', { ...r, inGesture })
    expect(r.activationAtLoad?.sticky).not.toBe(true)
    expect(r.external).toEqual([])
  })
})
