// FakeAudioElement (idea of spike R4, spec 0001): happy-dom cannot play media, so
// the media methods of HTMLMediaElement are replaced by fakes that record each call
// and fire the real DOM events the hook listens to. happy-dom also fires canplay and
// durationchange synchronously when src is assigned, which no browser does: the fake
// drops them, so canplay only arrives when a test dispatches it.
import { vi } from 'vitest'

type Deferred = { resolve: () => void; reject: (error: unknown) => void }

export const media = {
  load: vi.fn<(src: string) => void>(),
  play: vi.fn<(src: string) => void>(),
  pause: vi.fn<(src: string) => void>(),
  /** Sources whose play() rejects with NotSupportedError. */
  failing: new Set<string>(),
  /** When true, play() stays pending until release() or fail(). */
  hold: false,
  pending: [] as Deferred[],
  /** Settles the oldest pending play() successfully. */
  release() {
    media.pending.shift()?.resolve()
  },
  /** Settles the oldest pending play() with an error (AbortError after a pause). */
  fail(name = 'NotSupportedError') {
    media.pending.shift()?.reject(new DOMException('fail', name))
  },
}

const playing = new WeakSet<HTMLMediaElement>()

/**
 * Patches HTMLMediaElement.prototype. Returns a function that restores it.
 */
export function installFakeAudio(): () => void {
  media.load.mockReset()
  media.play.mockReset()
  media.pause.mockReset()
  media.failing.clear()
  media.hold = false
  media.pending = []

  const proto = window.HTMLMediaElement.prototype
  const original = {
    load: proto.load,
    play: proto.play,
    pause: proto.pause,
    paused: Object.getOwnPropertyDescriptor(proto, 'paused'),
    src: Object.getOwnPropertyDescriptor(proto, 'src')!,
  }

  Object.defineProperty(proto, 'src', {
    configurable: true,
    get(this: HTMLMediaElement) {
      return original.src.get!.call(this)
    },
    set(this: HTMLMediaElement, value: string) {
      const dispatch = this.dispatchEvent
      this.dispatchEvent = (event: Event) =>
        event.type === 'canplay' || event.type === 'durationchange'
          ? true
          : dispatch.call(this, event)
      try {
        original.src.set!.call(this, value)
      } finally {
        delete (this as { dispatchEvent?: unknown }).dispatchEvent
      }
    },
  })

  Object.defineProperty(proto, 'paused', {
    configurable: true,
    get(this: HTMLMediaElement) {
      return !playing.has(this)
    },
  })
  proto.load = function (this: HTMLMediaElement) {
    media.load(this.src)
    playing.delete(this)
  }
  proto.play = function (this: HTMLMediaElement) {
    media.play(this.src)
    const start = () => {
      playing.add(this)
      this.dispatchEvent(new Event('playing'))
    }
    if (media.failing.has(this.src)) {
      return Promise.reject(new DOMException('fail', 'NotSupportedError'))
    }
    if (media.hold) {
      return new Promise<void>((resolve, reject) => {
        media.pending.push({
          resolve: () => {
            start()
            resolve()
          },
          reject,
        })
      })
    }
    start()
    return Promise.resolve()
  }
  proto.pause = function (this: HTMLMediaElement) {
    media.pause(this.src)
    playing.delete(this)
    this.dispatchEvent(new Event('pause'))
  }

  return () => {
    proto.load = original.load
    proto.play = original.play
    proto.pause = original.pause
    Object.defineProperty(proto, 'src', original.src)
    if (original.paused) {
      Object.defineProperty(proto, 'paused', original.paused)
    } else {
      delete (proto as { paused?: boolean }).paused
    }
  }
}
