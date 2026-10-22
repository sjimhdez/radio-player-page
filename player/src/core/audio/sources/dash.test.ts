// The dash source (spec 0006, task 2.4), as in src/hooks/use-audio-player.test.tsx:
// dashjs with autoplay. K70 (fixed in task 2.9): crossOrigin is left unset (ADR 0004).
// K67 (fixed in spec 0007): no default third-party time source, and its error 16 is ignored.
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

  it('clears the default time sources right after initialize() (K67)', async () => {
    const fake = createFakeDash()
    await createDashSource({ loadDash: fake.loadDash }).start(new Audio(), DASH, callbacks())
    const [player] = fake.players
    expect(player.clearDefaultUTCTimingSources).toHaveBeenCalledTimes(1)
    // initialize() restores the defaults, so clearing them before it does nothing (spike R2).
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

  it('loads the dashjs MediaPlayer by default', async () => {
    const { MediaPlayer } = await import('dashjs')
    await expect(loadDashModule()).resolves.toBe(MediaPlayer)
  })

  // docs/known-issues.md C1 (spec 0007, ADR 0033).
  it('is CORS clean', async () => {
    const fake = createFakeDash()
    const source = createDashSource({ loadDash: fake.loadDash })
    await source.start(new Audio(), DASH, callbacks())
    expect(source.isCorsClean()).toBe(true)
  })
})
