import { test, expect, type Page } from '@playwright/test'
import { CORS, openHarness } from './helpers'

// R3 (K18, C7): Pause + Play of an endless MP3 with CORS and crossOrigin (as the player loads it).
// Today the player resumes (a plain play()); the fix candidate reloads (src again + load() + play()).
// For each: new requests, currentTime, buffered, and whether it freezes (advances < 1 s in 6 s with
// paused false and no error). Both streams: /live.mp3 (frames alone, as Icecast) and /live-tagged.mp3
// (the whole tone.mp3 in a loop, as tests/e2e/media-server.mjs; WebKit stops at its Info frame's
// 8.05 s, 0.3). A short and a long pause, and a control without pause. Each case attaches its JSON.
const STREAMS = ['/live.mp3', '/live-tagged.mp3'] as const
const PAUSES = [1000, 8000] as const

type Mode = 'resume' | 'reload'

const requests = async (page: Page, path: string): Promise<number> =>
  ((await (await page.request.get(`${CORS}/__requests`)).json()) as Record<string, number>)[path] ?? 0

const state = (page: Page) => page.evaluate(() => (window as any).spike.state())

// Polls until currentTime advances `delta` s past its value at the call, or `timeout` ms pass.
const advance = (page: Page, delta: number, timeout: number) =>
  page.evaluate(([d, t]) => (window as any).spike.measure({ delta: d, timeout: t, every: 100 }), [delta, timeout] as const)

const wait = (page: Page, ms: number) => page.evaluate((ms) => new Promise((r) => setTimeout(r, ms)), ms)

async function report(name: string, body: object) {
  await test.info().attach(`r3-${name}`, { body: JSON.stringify(body, null, 2), contentType: 'application/json' })
  console.log(`[${test.info().project.name}] ${name}: ${JSON.stringify(body)}`)
}

// Loads the stream and plays it until it has advanced 2 s.
async function start(page: Page, p: string) {
  await page.request.delete(`${CORS}/__requests`)
  await page.evaluate((u) => (window as any).spike.loadDirect(u, { crossOrigin: true }), `${CORS}${p}`)
  const play = await page.evaluate(() => (window as any).spike.play())
  const started = await advance(page, 2, 8000)
  return { play, advanced: started.advanced, ms: started.ms }
}

// After the play, 6 s: does it advance (and how much), and where is it.
async function after(page: Page) {
  const m = await advance(page, 6, 6000)
  return { advanced: m.advanced, ms: m.ms, state: m.state }
}

const frozen = (m: { advanced: number; state: { paused: boolean; error: unknown } }) =>
  m.advanced < 1 && !m.state.paused && m.state.error === null

test.describe('R3: Pause + Play of a live MP3', () => {
  for (const p of STREAMS) {
    // Control: without a pause, does the stream itself play on for 8 s?
    test(`${p} control: no pause`, async ({ page, browserName }) => {
      const external = await openHarness(page)
      const started = await start(page, p)
      const m = await advance(page, 8, 9000)
      const r = { started, advanced: m.advanced, ms: m.ms, state: m.state, requests: await requests(page, p), external }
      await report(`control${p.replace('/', '-')}`, r)
      // WebKit on macOS stops the tagged stream at 1.76 s without any pause (its Info frame, 0.3).
      if (browserName === 'webkit' && p === '/live-tagged.mp3') expect(m.advanced).toBeLessThan(2)
      else expect(m.advanced).toBeGreaterThanOrEqual(8)
      expect(external).toEqual([])
    })

    for (const pauseMs of PAUSES) {
      for (const mode of ['resume', 'reload'] as Mode[]) {
        test(`${p} pause ${pauseMs} ms then ${mode}`, async ({ page, browserName }) => {
          // The tagged stream never gets 2 s in WebKit (control above): it is the fixture, not the pause.
          const tagged = browserName === 'webkit' && p === '/live-tagged.mp3'
          const external = await openHarness(page)
          const started = await start(page, p)
          const before = await requests(page, p)
          await page.evaluate(() => (window as any).spike.audio.pause())
          const paused = await state(page)
          await wait(page, pauseMs)
          const pausedEnd = await state(page)
          if (mode === 'reload') await page.evaluate(() => (window as any).spike.reload())
          const play = await page.evaluate(() => (window as any).spike.play())
          const m = await after(page)
          const r = {
            started, paused, pausedEnd, play, after: m, frozen: frozen(m),
            newRequests: (await requests(page, p)) - before, external,
          }
          await report(`${mode}-${pauseMs}${p.replace('/', '-')}`, r)
          expect(play).toBe('ok')
          expect(external).toEqual([])
          if (tagged) {
            expect(started.advanced).toBeLessThan(2)
            // Reloading starts the stream again, so it plays its 1.76 s again; resuming stays frozen.
            expect(r.frozen).toBe(mode === 'resume')
          } else {
            expect(started.advanced).toBeGreaterThanOrEqual(2)
            expect(r.frozen).toBe(false)
            expect(m.advanced).toBeGreaterThanOrEqual(5)
          }
          if (mode === 'reload') {
            // A new connection (WebKit opens two) and the position starts again from 0: back to live.
            expect(r.newRequests).toBeGreaterThanOrEqual(1)
            expect(m.state.currentTime).toBeLessThan(paused.currentTime + m.advanced)
          } else {
            // Same connection, the position goes on from the pause (C7: behind the live edge).
            expect(r.newRequests).toBe(0)
          }
        })
      }
    }
  }
})
