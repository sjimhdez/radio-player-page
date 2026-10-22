import { test, expect, type Page } from '@playwright/test'
import { CORS, openHarness } from './helpers'

// R2 (K67): live DASH without <UTCTiming>. Does it play, what leaves localhost (the default timing
// source is https://time.akamai.com/?iso&ms) and how far from the live edge does it start, with the
// default timing sources kept, cleared before or after initialize(), or the UTC sync disabled, and
// with and without the Date header exposed by CORS. Each case attaches its measurement as JSON.
type Case = {
  name: string
  clearTimeSources?: false | 'before' | 'after'
  settings?: object
  exposeDate?: boolean
  // Client clock offset in ms (server and browser share the machine clock, so 0 hides any skew).
  skewMs?: number
}

const AKAMAI = /^https?:\/\/time\.akamai\.com\//

// dashjs TIME_SYNC_FAILED_ERROR_CODE.
const syncErrors = (r: { events: { type: string; detail?: { code?: number } }[] }) =>
  r.events.filter((e) => e.type === 'dash:error' && e.detail?.code === 16).length

// Shifts Date (Date.now() and new Date()) by `skew` ms before any page script runs.
async function skewClock(page: Page, skew: number) {
  await page.addInitScript((ms) => {
    const RealDate = Date
    class SkewedDate extends RealDate {
      constructor(...args: any[]) {
        if (args.length === 0) super(RealDate.now() + ms)
        else super(...(args as []))
      }
      static now() { return RealDate.now() + ms }
    }
    ;(window as any).Date = SkewedDate
  }, skew)
}

async function run(page: Page, c: Case) {
  const consoleLines: string[] = []
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') consoleLines.push(`${m.type()}: ${m.text()}`) })
  if (c.skewMs) await skewClock(page, c.skewMs)
  const external = await openHarness(page)

  const url = `${CORS}/live.mpd${c.exposeDate ? '?exposeDate=1' : ''}`
  const mpd = await (await page.request.get(`${CORS}/live.mpd`)).text()
  const ast = Date.parse(/availabilityStartTime="([^"]+)"/.exec(mpd)![1])
  await page.request.delete(`${CORS}/__requests`)
  const loadedAt = Date.now()
  await page.evaluate(([u, opts]) => (window as any).spike.loadDash(u, opts), [url, { clearTimeSources: c.clearTimeSources ?? false, settings: c.settings }] as const)
  // dashjs seeks to the live edge first: measure the advance only once playing.
  const playing = await page.waitForFunction(() => (window as any).spike.events.some((e: any) => e.type === 'playing'), null, { timeout: 20_000 })
    .then(() => true, () => false)
  const startupMs = Date.now() - loadedAt
  const m = await page.evaluate(() => (window as any).spike.measure({ delta: 3, timeout: 10_000 }))
  // Distance to the real live edge, with the real (Node) clock: the page clock may be skewed.
  const edgeLatency = +((Date.now() - ast) / 1000 - m.state.currentTime).toFixed(2)
  const info = await page.evaluate(() => (window as any).spike.dashInfo())
  const events = await page.evaluate(() => (window as any).spike.events.filter((e: any) => e.type.startsWith('dash:') || ['error', 'playing', 'waiting', 'stalled'].includes(e.type)))
  const requests = await (await page.request.get(`${CORS}/__requests`)).json()
  const result = {
    case: c, playing, startupMs, advanced: m.advanced, ms: m.ms, error: m.state.error, edgeLatency, dashLatency: info.liveLatency,
    time: info.time, isDynamic: info.isDynamic, external, mpdRequests: Object.entries(requests).filter(([k]) => k.startsWith('/live.mpd')),
    segmentRequests: Object.keys(requests).filter((k) => k.startsWith('/live/')).length, segment404: requests['404 /live/'] ?? 0,
    waiting: events.filter((e: any) => e.type === 'waiting').length, events, console: consoleLines,
  }
  await test.info().attach(`r2-${c.name}`, { body: JSON.stringify(result, null, 2), contentType: 'application/json' })
  console.log(`[${test.info().project.name}] ${c.name}: playing ${playing} after ${startupMs}ms, +${m.advanced}s in ${m.ms}ms, edge ${edgeLatency}s (dashjs ${info.liveLatency}), 404 ${result.segment404}, waiting ${result.waiting}, external ${JSON.stringify(external)}`)
  return result
}

test.describe('R2: dashjs without third-party time source', () => {
  test('control: default timing sources ask Akamai', async ({ page }) => {
    const r = await run(page, { name: 'control' })
    expect(r.external.some((u) => AKAMAI.test(u)), JSON.stringify(r)).toBe(true)
  })

  // Spec 0007 D7 as written: the first initialize() calls restoreDefaultUTCTimingSources().
  for (const exposeDate of [false, true]) {
    test(`clear before initialize, Date ${exposeDate ? 'exposed' : 'hidden'}`, async ({ page }) => {
      const r = await run(page, { name: `before-date${+exposeDate}`, clearTimeSources: 'before', exposeDate })
      expect(r.external.some((u) => AKAMAI.test(u)), JSON.stringify(r)).toBe(true)
    })
  }

  for (const exposeDate of [false, true]) {
    test(`clear after initialize, Date ${exposeDate ? 'exposed' : 'hidden'}`, async ({ page }) => {
      const r = await run(page, { name: `after-date${+exposeDate}`, clearTimeSources: 'after', exposeDate })
      expect(r.external, JSON.stringify(r)).toEqual([])
      expect(r.error).toBeNull()
      expect(r.playing, JSON.stringify(r)).toBe(true)
      expect(r.advanced, JSON.stringify(r)).toBeGreaterThanOrEqual(3)
      // Without any time source (Date hidden) dashjs reports the non-fatal TIME_SYNC_FAILED (16) and plays
      // on the device clock; dash.ts forwards every 'error' to onError().
      expect(syncErrors(r), JSON.stringify(r.events)).toBe(exposeDate ? 0 : 2)
    })
  }

  test('utcSynchronization disabled', async ({ page }) => {
    const r = await run(page, { name: 'sync-disabled', settings: { streaming: { utcSynchronization: { enabled: false } } } })
    expect(r.external, JSON.stringify(r)).toEqual([])
    expect(r.playing, JSON.stringify(r)).toBe(true)
    expect(syncErrors(r), JSON.stringify(r.events)).toBe(0)
  })

  // Risk 3: with no time source the device clock rules; the exposed Date header corrects it.
  for (const skewMs of [-20_000, 20_000]) {
    for (const exposeDate of [false, true]) {
      test(`clear after initialize, client clock ${skewMs > 0 ? '+' : ''}${skewMs / 1000}s, Date ${exposeDate ? 'exposed' : 'hidden'}`, async ({ page }) => {
        const r = await run(page, { name: `after-skew${skewMs / 1000}-date${+exposeDate}`, clearTimeSources: 'after', exposeDate, skewMs })
        expect(r.external, JSON.stringify(r)).toEqual([])
      })
    }
  }
})
