// The audio controller (spec 0006, task 2.6): the direct stream, the events of the
// audio element and the volume, as in src/hooks/use-audio-player.test.tsx. The
// welcome audio, HLS/DASH playback and their currently cases come in task 2.7.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAudioController } from 'src/core/audio/audio-controller'
import { initialPlayerState } from 'src/core/audio/player-machine'
import { installFakeAudio, media } from 'src/test/fake-audio'
import { createFakeDash, createFakeHls } from 'src/test/fake-streaming'

const MP3 = 'https://radio.test/live.mp3'
const OGG = 'https://radio.test/other.ogg'
const HLS = 'https://radio.test/live.m3u8'
const DASH = 'https://radio.test/live.mpd'

const desktop = { isIOS: false }
const live = (streamUrl = MP3, isIOS = false) => ({ streamUrl, introUrl: null, isIOS })

let restore: () => void
beforeEach(() => {
  restore = installFakeAudio()
})
afterEach(() => restore())

/**
 * A controller attached to a new audio element.
 */
function setup(options: Parameters<typeof createAudioController>[0] = {}) {
  const controller = createAudioController(options)
  const audio = new Audio()
  controller.attach(audio, desktop)
  return { controller, audio }
}

/**
 * Counts the listeners of audio that are still registered, by event type.
 */
function countListeners(audio: HTMLAudioElement) {
  const active = new Map<string, Set<unknown>>()
  const add = audio.addEventListener.bind(audio)
  const remove = audio.removeEventListener.bind(audio)
  vi.spyOn(audio, 'addEventListener').mockImplementation((type, listener, options) => {
    if (!active.has(type)) active.set(type, new Set())
    active.get(type)!.add(listener)
    add(type, listener, options)
  })
  vi.spyOn(audio, 'removeEventListener').mockImplementation((type, listener, options) => {
    active.get(type)?.delete(listener)
    remove(type, listener, options)
  })
  return () => Object.fromEntries([...active].map(([type, set]) => [type, set.size]))
}

describe('snapshot and subscription', () => {
  it('starts with the initial state and keeps the same reference', () => {
    const controller = createAudioController()
    expect(controller.getSnapshot()).toBe(initialPlayerState)
    expect(controller.getSnapshot()).toBe(controller.getSnapshot())
  })

  it('notifies subscribers on a change, and only on a change', () => {
    const { controller, audio } = setup()
    const listener = vi.fn()
    controller.subscribe(listener)
    audio.dispatchEvent(new Event('waiting'))
    expect(listener).toHaveBeenCalledTimes(1)
    const snapshot = controller.getSnapshot()
    audio.dispatchEvent(new Event('waiting'))
    expect(listener).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot()).toBe(snapshot)
  })

  it('stops notifying after unsubscribe', () => {
    const { controller, audio } = setup()
    const listener = vi.fn()
    const unsubscribe = controller.subscribe(listener)
    unsubscribe()
    audio.dispatchEvent(new Event('waiting'))
    expect(listener).not.toHaveBeenCalled()
    expect(controller.getSnapshot().loading).toBe(true)
  })
})

describe('attach and detach', () => {
  it('maps playing, pause and error to the status', () => {
    const { controller, audio } = setup()
    audio.dispatchEvent(new Event('playing'))
    expect(controller.getSnapshot().status).toBe('playing')
    audio.dispatchEvent(new Event('pause'))
    expect(controller.getSnapshot().status).toBe('paused')
    audio.dispatchEvent(new Event('error'))
    expect(controller.getSnapshot().status).toBe('error')
  })

  it('sets loading on waiting and clears it on playing', () => {
    const { controller, audio } = setup()
    audio.dispatchEvent(new Event('waiting'))
    expect(controller.getSnapshot().loading).toBe(true)
    audio.dispatchEvent(new Event('playing'))
    expect(controller.getSnapshot().loading).toBe(false)
  })

  it('clears loading on canplay only when idle or in error', () => {
    const { controller, audio } = setup()
    audio.dispatchEvent(new Event('waiting'))
    audio.dispatchEvent(new Event('canplay'))
    expect(controller.getSnapshot().loading).toBe(false)
    audio.dispatchEvent(new Event('playing'))
    audio.dispatchEvent(new Event('waiting'))
    audio.dispatchEvent(new Event('canplay'))
    expect(controller.getSnapshot().loading).toBe(true)
  })

  it('ignores the events of the element after detach()', () => {
    const { controller, audio } = setup()
    controller.detach()
    audio.dispatchEvent(new Event('playing'))
    expect(controller.getSnapshot()).toBe(initialPlayerState)
  })

  it('listens once when attached twice in a row, and detach() removes everything (StrictMode)', () => {
    const controller = createAudioController()
    const audio = new Audio()
    const listeners = countListeners(audio)
    controller.attach(audio, desktop)
    controller.attach(audio, desktop)
    expect(listeners()).toEqual({
      playing: 1,
      pause: 1,
      error: 1,
      canplay: 1,
      waiting: 1,
      ended: 1,
    })
    controller.detach()
    controller.detach()
    expect(Object.values(listeners())).toEqual([0, 0, 0, 0, 0, 0])
  })

  it('listens once after attach, detach and attach again (StrictMode)', () => {
    const controller = createAudioController()
    const audio = new Audio()
    const listeners = countListeners(audio)
    controller.attach(audio, desktop)
    controller.detach()
    controller.attach(audio, desktop)
    expect(Object.values(listeners())).toEqual([1, 1, 1, 1, 1, 1])
  })

  it('moves its listeners when attached to another element', () => {
    const { controller, audio } = setup()
    const other = new Audio()
    controller.attach(other, desktop)
    audio.dispatchEvent(new Event('playing'))
    expect(controller.getSnapshot().status).toBe('idle')
    other.dispatchEvent(new Event('playing'))
    expect(controller.getSnapshot().status).toBe('playing')
  })

  it('applies the volume to the element it attaches to, except on iOS', () => {
    const { controller } = setup()
    controller.setVolume(0.3, desktop)
    controller.detach()
    const ios = new Audio()
    controller.attach(ios, { isIOS: true })
    expect(ios.volume).toBe(1)
    controller.detach()
    const other = new Audio()
    controller.attach(other, desktop)
    expect(other.volume).toBe(0.3)
  })
})

describe('direct streams', () => {
  it('plays an MP3 by assigning src with crossOrigin anonymous', async () => {
    const { controller, audio } = setup()
    await controller.play(live())
    expect(audio.src).toBe(MP3)
    expect(audio.crossOrigin).toBe('anonymous')
    expect(media.load).toHaveBeenCalledTimes(1)
    expect(media.play).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot()).toMatchObject({
      status: 'playing',
      loading: false,
      activeSource: 'live',
      introLocked: false,
    })
  })

  it('does nothing on play() while detached', async () => {
    const controller = createAudioController()
    await controller.play(live())
    expect(media.load).not.toHaveBeenCalled()
    expect(controller.getSnapshot()).toBe(initialPlayerState)
  })

  it('is loading while play() is pending', async () => {
    media.hold = true
    const { controller } = setup()
    const playing = controller.play(live())
    expect(controller.getSnapshot()).toMatchObject({ loading: true, status: 'idle' })
    media.release()
    await playing
    expect(controller.getSnapshot()).toMatchObject({ loading: false, status: 'playing' })
  })

  it('sets error when play() rejects', async () => {
    media.failing.add(MP3)
    const { controller } = setup()
    await controller.play(live())
    expect(controller.getSnapshot()).toMatchObject({ status: 'error', loading: false })
  })

  it('pauses and resumes the loaded source without reloading it', async () => {
    const { controller, audio } = setup()
    await controller.play(live())
    controller.pause()
    expect(controller.getSnapshot().status).toBe('paused')
    expect(audio.paused).toBe(true)
    await controller.play(live())
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: false })
    expect(media.load).toHaveBeenCalledTimes(1)
    expect(media.play).toHaveBeenCalledTimes(2)
  })

  it('does nothing on play() when the loaded source is already playing', async () => {
    const { controller } = setup()
    await controller.play(live())
    await controller.play(live())
    expect(media.load).toHaveBeenCalledTimes(1)
    expect(media.play).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: false })
  })

  it('reloads the stream on play() after an error', async () => {
    const { controller, audio } = setup()
    await controller.play(live())
    audio.dispatchEvent(new Event('error'))
    await controller.play(live())
    expect(media.load).toHaveBeenCalledTimes(2)
    expect(controller.getSnapshot().status).toBe('playing')
  })

  it('loads the new stream on play() after a stream change, not before', async () => {
    const { controller, audio } = setup()
    await controller.play(live())
    controller.pause()
    expect(audio.src).toBe(MP3)
    await controller.play(live(OGG))
    expect(audio.src).toBe(OGG)
    expect(media.load).toHaveBeenLastCalledWith(OGG)
    expect(controller.getSnapshot().status).toBe('playing')
  })

  it('pauses the element and sets paused even before anything is loaded', () => {
    const { controller } = setup()
    controller.pause()
    expect(media.pause).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().status).toBe('paused')
  })
})

describe('sources', () => {
  it('destroys the previous source on the next play()', async () => {
    const hls = createFakeHls()
    const { controller } = setup({ loaders: { loadHls: hls.loadHls } })
    await controller.play(live(HLS))
    controller.pause()
    expect(hls.instances[0].destroy).not.toHaveBeenCalled()
    await controller.play(live(MP3))
    expect(hls.instances[0].destroy).toHaveBeenCalledTimes(1)
  })

  it('dispose() destroys the current source', async () => {
    const dash = createFakeDash()
    const { controller } = setup({ loaders: { loadDash: dash.loadDash } })
    await controller.play(live(DASH))
    controller.dispose()
    expect(dash.players[0].reset).toHaveBeenCalledTimes(1)
    controller.dispose()
    expect(dash.players[0].reset).toHaveBeenCalledTimes(1)
  })

  it('reads isIOS on each play(), not when it is created', async () => {
    const hls = createFakeHls()
    const { controller, audio } = setup({ loaders: { loadHls: hls.loadHls } })
    await controller.play(live(HLS, true))
    expect(hls.loadHls).not.toHaveBeenCalled()
    expect(audio.src).toBe(HLS)
    controller.pause()
    await controller.play(live(MP3))
    await controller.play(live(HLS, false))
    expect(hls.instances).toHaveLength(1)
  })
})

describe('volume', () => {
  it('starts at 1 and applies changes to the element and the snapshot', () => {
    const { controller, audio } = setup()
    expect(controller.getSnapshot().volume).toBe(1)
    controller.setVolume(0.5, desktop)
    expect(audio.volume).toBe(0.5)
    expect(controller.getSnapshot().volume).toBe(0.5)
  })

  it('ignores changes on iOS, reading isIOS on each call', () => {
    const { controller, audio } = setup()
    controller.setVolume(0.5, { isIOS: true })
    expect(audio.volume).toBe(1)
    expect(controller.getSnapshot().volume).toBe(1)
    controller.setVolume(0.4, desktop)
    expect(audio.volume).toBe(0.4)
  })

  it('ignores changes while detached', () => {
    const controller = createAudioController()
    controller.setVolume(0.5, desktop)
    expect(controller.getSnapshot().volume).toBe(1)
  })
})
