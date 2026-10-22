// The direct source (spec 0006, task 2.3): MP3/OGG, native HLS and the welcome audio.
// ADR 0004: a source assigned to audio.src sets crossOrigin = 'anonymous'.
// C1 (fixed in spec 0007, ADR 0033): one retry without crossOrigin when play() fails.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDirectSource } from 'src/core/audio/sources/direct'
import { installFakeAudio, media } from 'src/test/fake-audio'

const MP3 = 'https://radio.test/live.mp3'
const OGG = 'https://radio.test/other.ogg'

let restore: () => void
beforeEach(() => {
  restore = installFakeAudio()
})
afterEach(() => restore())

const callbacks = () => ({ onError: vi.fn(), onPlayRejected: vi.fn() })

/**
 * Records, in order, the writes to src and crossOrigin and the calls to load() and play().
 */
function recordSteps(audio: HTMLAudioElement): string[] {
  const steps: string[] = []
  const proto = Object.getPrototypeOf(audio) as HTMLAudioElement
  for (const name of ['src', 'crossOrigin'] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, name)!
    Object.defineProperty(audio, name, {
      configurable: true,
      get: () => descriptor.get!.call(audio),
      set: (value: string) => {
        steps.push(name)
        descriptor.set!.call(audio, value)
      },
    })
  }
  audio.load = () => {
    steps.push('load')
    proto.load.call(audio)
  }
  audio.play = () => {
    steps.push('play')
    return proto.play.call(audio)
  }
  return steps
}

describe('createDirectSource', () => {
  it('sets src, then crossOrigin, then loads and plays', async () => {
    const audio = new Audio()
    const steps = recordSteps(audio)
    await createDirectSource().start(audio, MP3, callbacks())
    expect(steps).toEqual(['src', 'crossOrigin', 'load', 'play'])
    expect(audio.src).toBe(MP3)
    expect(audio.crossOrigin).toBe('anonymous')
    expect(media.load).toHaveBeenCalledWith(MP3)
    expect(media.play).toHaveBeenCalledWith(MP3)
  })

  it('resolves only when play() resolves', async () => {
    media.hold = true
    const audio = new Audio()
    let started = false
    const start = createDirectSource()
      .start(audio, MP3, callbacks())
      .then(() => (started = true))
    await Promise.resolve()
    expect(started).toBe(false)
    media.release()
    await start
    expect(started).toBe(true)
  })

  it('rejects with the play() error and does not use the callbacks', async () => {
    media.failing.add(MP3)
    const audio = new Audio()
    const cbs = callbacks()
    await expect(createDirectSource().start(audio, MP3, cbs)).rejects.toMatchObject({
      name: 'NotSupportedError',
    })
    expect(cbs.onError).not.toHaveBeenCalled()
    expect(cbs.onPlayRejected).not.toHaveBeenCalled()
  })

  it('destroy() leaves the audio element as it is', async () => {
    const audio = new Audio()
    const source = createDirectSource()
    await source.start(audio, MP3, callbacks())
    source.destroy()
    expect(audio.src).toBe(MP3)
    expect(audio.paused).toBe(false)
    expect(media.pause).not.toHaveBeenCalled()
  })

  it('is CORS clean when it plays with crossOrigin', async () => {
    const source = createDirectSource({ retryWithoutCors: true })
    expect(source.isCorsClean()).toBe(true)
    await source.start(new Audio(), MP3, callbacks())
    expect(source.isCorsClean()).toBe(true)
  })
})

// docs/known-issues.md C1 (spec 0007, ADR 0033).
describe('retry without crossOrigin (C1)', () => {
  it('retries once without crossOrigin when play() fails, and plays', async () => {
    media.corsBlocked.add(MP3)
    const audio = new Audio()
    const steps = recordSteps(audio)
    const source = createDirectSource({ retryWithoutCors: true })
    await source.start(audio, MP3, callbacks())
    expect(steps).toEqual(['src', 'crossOrigin', 'load', 'play', 'load', 'play'])
    expect(audio.hasAttribute('crossorigin')).toBe(false)
    expect(audio.src).toBe(MP3)
    expect(audio.paused).toBe(false)
    expect(source.isCorsClean()).toBe(false)
  })

  it('rejects when the retry fails too, as with a 404', async () => {
    media.failing.add(MP3)
    const audio = new Audio()
    const source = createDirectSource({ retryWithoutCors: true })
    await expect(source.start(audio, MP3, callbacks())).rejects.toMatchObject({
      name: 'NotSupportedError',
    })
    expect(media.play).toHaveBeenCalledTimes(2)
    expect(source.isCorsClean()).toBe(false)
  })

  it.each(['NotAllowedError', 'AbortError'])('does not retry on %s', async (name) => {
    media.hold = true
    const audio = new Audio()
    const source = createDirectSource({ retryWithoutCors: true })
    const start = source.start(audio, MP3, callbacks())
    await Promise.resolve()
    media.fail(name)
    await expect(start).rejects.toMatchObject({ name })
    expect(media.play).toHaveBeenCalledTimes(1)
    expect(audio.crossOrigin).toBe('anonymous')
    expect(source.isCorsClean()).toBe(true)
  })

  it('does not retry without retryWithoutCors', async () => {
    media.corsBlocked.add(MP3)
    const audio = new Audio()
    const source = createDirectSource({ retryWithoutCors: false })
    await expect(source.start(audio, MP3, callbacks())).rejects.toMatchObject({
      name: 'NotSupportedError',
    })
    expect(media.play).toHaveBeenCalledTimes(1)
    expect(audio.crossOrigin).toBe('anonymous')
  })

  it('sets crossOrigin again on the next start', async () => {
    media.corsBlocked.add(MP3)
    const audio = new Audio()
    const source = createDirectSource({ retryWithoutCors: true })
    await source.start(audio, MP3, callbacks())
    await source.start(audio, OGG, callbacks())
    expect(audio.crossOrigin).toBe('anonymous')
    expect(source.isCorsClean()).toBe(true)
  })
})
