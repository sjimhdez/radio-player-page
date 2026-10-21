// The direct source (spec 0006, task 2.3): MP3/OGG, native HLS and the welcome audio.
// ADR 0004: a source assigned to audio.src sets crossOrigin = 'anonymous'.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDirectSource } from 'src/core/audio/sources/direct'
import { installFakeAudio, media } from 'src/test/fake-audio'

const MP3 = 'https://radio.test/live.mp3'

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
})
