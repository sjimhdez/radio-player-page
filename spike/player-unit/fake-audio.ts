// FakeAudioElement: neither happy-dom nor jsdom can play media, so the media methods of
// HTMLMediaElement are replaced by fakes that record calls and fire the real events.
import { vi, beforeEach } from 'vitest'

export const media = {
  play: vi.fn(),
  load: vi.fn(),
  pause: vi.fn(),
  playShouldFail: false,
}

beforeEach(() => {
  media.play.mockReset()
  media.load.mockReset()
  media.pause.mockReset()
  media.playShouldFail = false
  const proto = window.HTMLMediaElement.prototype
  Object.defineProperty(proto, 'paused', { configurable: true, get() { return !this.__playing } })
  proto.load = function () { media.load(this.src) }
  proto.play = function () {
    media.play(this.src)
    if (media.playShouldFail) return Promise.reject(new DOMException('fail', 'NotSupportedError'))
    this.__playing = true
    this.dispatchEvent(new Event('playing'))
    return Promise.resolve()
  }
  proto.pause = function () {
    media.pause(this.src)
    this.__playing = false
    this.dispatchEvent(new Event('pause'))
  }
})

declare global {
  interface HTMLMediaElement { __playing?: boolean }
}
