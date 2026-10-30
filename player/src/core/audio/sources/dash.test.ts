// The dash source, as in src/hooks/use-audio-player.test.tsx: dashjs with autoplay.
// crossOrigin is left unset (K70, ADR 0004). No default third-party time source, and
// its error 16 is ignored (K67).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDashSource, loadDashModule } from 'src/core/audio/sources/dash'
import { installFakeAudio, media } from 'src/test/fake-audio'
import { createFakeDash } from 'src/test/fake-streaming'

const DASH = 'https://radio.test/live.mpd'

let restore: () => void
beforeEach(() => {
  restore = installFakeAudio()
})
afterEach(() => restore())

const callbacks = () => ({ onError: vi.fn(), onPlayRejected: vi.fn() })

describe('createDashSource', () => {
  it('initializes dashjs with autoplay, without src or play()', async () => {
    const fake = createFakeDash()
    const audio = new Audio()
    await createDashSource({ loadDash: fake.loadDash }).start(audio, DASH, callbacks())
    expect(fake.players).toHaveLength(1)
    expect(fake.players[0].initialize).toHaveBeenCalledWith(audio, DASH, true)
    expect(audio.src).toBe('')
    expect(audio.crossOrigin).toBeNull()
    expect(media.play).not.toHaveBeenCalled()
  })

  it('reports a dashjs error with onError', async () => {
    const fake = createFakeDash()
    const cbs = callbacks()
    await createDashSource({ loadDash: fake.loadDash }).start(new Audio(), DASH, cbs)
    expect(cbs.onError).not.toHaveBeenCalled()
    fake.players[0].handlers.error({ error: { code: 17 } })
    expect(cbs.onError).toHaveBeenCalledTimes(1)
    expect(cbs.onPlayRejected).not.toHaveBeenCalled()
  })

  // A download error carries the HTTP status, or 0 without CORS or a server (ADR 0065).
  it.each([
    [{ error: { code: 25, data: { response: { status: 404 } } } }, { status: 404 }],
    [{ error: { code: 25, data: { response: { status: 0 } } } }, { status: 0 }],
    [{ error: { code: 17, data: null } }, {}],
    [{ error: { code: 17 } }, {}],
  ])('reports %j with %j (ADR 0065)', async (event, failure) => {
    const fake = createFakeDash()
    const cbs = callbacks()
    await createDashSource({ loadDash: fake.loadDash }).start(new Audio(), DASH, cbs)
    fake.players[0].handlers.error(event)
    expect(cbs.onError).toHaveBeenCalledWith(failure)
  })

  it('clears the default time sources right after initialize() (K67)', async () => {
    const fake = createFakeDash()
    await createDashSource({ loadDash: fake.loadDash }).start(new Audio(), DASH, callbacks())
    const [player] = fake.players
    expect(player.clearDefaultUTCTimingSources).toHaveBeenCalledTimes(1)
    // initialize() restores the defaults, so clearing them before it does nothing.
    expect(player.clearDefaultUTCTimingSources.mock.invocationCallOrder[0]).toBeGreaterThan(
      player.initialize.mock.invocationCallOrder[0],
    )
  })

  it('ignores the time sync error (code 16) it gets without a time source (K67)', async () => {
    const fake = createFakeDash()
    const cbs = callbacks()
    await createDashSource({ loadDash: fake.loadDash }).start(new Audio(), DASH, cbs)
    fake.players[0].handlers.error({ error: { code: 16 } })
    expect(cbs.onError).not.toHaveBeenCalled()
  })

  it('clears crossOrigin after a direct source (K70)', async () => {
    const fake = createFakeDash()
    const audio = new Audio()
    audio.crossOrigin = 'anonymous'
    await createDashSource({ loadDash: fake.loadDash }).start(audio, DASH, callbacks())
    expect(audio.crossOrigin).toBeNull()
  })

  it('destroy() resets the player once, and does nothing before start()', async () => {
    const fake = createFakeDash()
    const source = createDashSource({ loadDash: fake.loadDash })
    source.destroy()
    await source.start(new Audio(), DASH, callbacks())
    source.destroy()
    source.destroy()
    expect(fake.players[0].reset).toHaveBeenCalledTimes(1)
  })

  // A pause during the load (K11, ADR 0034): the fake keeps its handlers after reset(),
  // so the source must ignore them.
  it('ignores errors after destroy()', async () => {
    const fake = createFakeDash()
    const cbs = callbacks()
    const source = createDashSource({ loadDash: fake.loadDash })
    await source.start(new Audio(), DASH, cbs)
    source.destroy()
    fake.players[0].handlers.error({ error: { code: 17 } })
    expect(cbs.onError).not.toHaveBeenCalled()
  })

  it('creates no dashjs player when destroyed while dashjs loads', async () => {
    const fake = createFakeDash()
    const source = createDashSource({ loadDash: fake.loadDash })
    const started = source.start(new Audio(), DASH, callbacks())
    source.destroy()
    await started
    expect(fake.players).toHaveLength(0)
  })

  it('loads the dashjs MediaPlayer by default', async () => {
    const { MediaPlayer } = await import('dashjs')
    await expect(loadDashModule()).resolves.toBe(MediaPlayer)
  })

  // MSE sources never retry without crossOrigin, so they stay clean (ADR 0033).
  it('is CORS clean', async () => {
    const fake = createFakeDash()
    const source = createDashSource({ loadDash: fake.loadDash })
    await source.start(new Audio(), DASH, callbacks())
    expect(source.isCorsClean()).toBe(true)
  })

  // The controller watches the progress of sources without MSE (ADR 0061).
  it('uses Media Source', () => {
    expect(createDashSource().usesMediaSource()).toBe(true)
  })
})
