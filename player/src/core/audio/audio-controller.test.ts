// The audio controller: the direct stream, the events of the audio element, the
// volume, HLS/DASH and the welcome audio, as in src/hooks/use-audio-player.test.tsx,
// with the cases of the welcome audio (K63) and of crossOrigin after it (K70). Play
// after a pause reloads the live stream (K12, ADR 0032). The direct sources get one
// retry without crossOrigin, never with the element in the Web Audio graph (ADR 0033).
// Then come canVisualize and the Web Audio graph (K82, ADR 0031), the concurrency of
// play() and pause() (K80, K81) and, last, the reconnection of the live stream
// (ADR 0061).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAudioController,
  RECONNECT_DELAYS_MS,
  STALL_MS,
} from 'src/core/audio/audio-controller'
import { initialPlayerState } from 'src/core/audio/player-machine'
import { installFakeAudio, media } from 'src/test/fake-audio'
import { createFakeClock } from 'src/test/fake-clock'
import { createFakeDash, createFakeHls } from 'src/test/fake-streaming'
import { FakeAudioContext, webAudio } from 'src/test/fake-web-audio'

const MP3 = 'https://radio.test/live.mp3'
const OGG = 'https://radio.test/other.ogg'
const HLS = 'https://radio.test/live.m3u8'
const DASH = 'https://radio.test/live.mpd'
const INTRO = 'https://radio.test/intro.mp3'

const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0.1 Safari/605.1.15'

/** The Web Audio options of a browser with a (fake) AudioContext */
const withWebAudio = (userAgent = CHROME) => ({
  createContext: vi.fn(() => new FakeAudioContext() as unknown as AudioContext),
  userAgent,
})

/** A volume probe that ignores writes, as on iOS (ADR 0036) */
const readOnlyProbe = () => {
  const probe = new Audio()
  Object.defineProperty(probe, 'volume', { get: () => 1, set: () => {} })
  return probe
}

const IPHONE = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
  maxTouchPoints: 5,
}
/** iPadOS 13+ Safari: the desktop user agent of a Mac, with touch (K13, ADR 0036) */
const IPAD_DESKTOP = { userAgent: SAFARI, maxTouchPoints: 5 }

const live = (streamUrl = MP3) => ({ streamUrl, introUrl: null })
const withIntro = (streamUrl = MP3) => ({ streamUrl, introUrl: INTRO })

let restore: () => void
beforeEach(() => {
  restore = installFakeAudio()
  webAudio.contexts = []
})
afterEach(() => restore())

/**
 * A controller attached to a new audio element, with a fake clock, so no controller
 * leaves a real timer behind (ADR 0061).
 */
function setup(options: Parameters<typeof createAudioController>[0] = {}) {
  const fake = createFakeClock(0)
  const controller = createAudioController({ clock: fake.clock, ...options })
  const audio = new Audio()
  controller.attach(audio)
  return { controller, audio, fake }
}

/** Counts the listeners of audio that are still registered, by event type */
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
    controller.attach(audio)
    controller.attach(audio)
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
    controller.attach(audio)
    controller.detach()
    controller.attach(audio)
    expect(Object.values(listeners())).toEqual([1, 1, 1, 1, 1, 1])
  })

  it('moves its listeners when attached to another element', () => {
    const { controller, audio } = setup()
    const other = new Audio()
    controller.attach(other)
    audio.dispatchEvent(new Event('playing'))
    expect(controller.getSnapshot().status).toBe('idle')
    other.dispatchEvent(new Event('playing'))
    expect(controller.getSnapshot().status).toBe('playing')
  })

  it('applies the volume to the element it attaches to', () => {
    const { controller } = setup()
    controller.setVolume(0.3)
    controller.detach()
    const other = new Audio()
    controller.attach(other)
    expect(other.volume).toBe(0.3)
  })

  it('leaves the volume of the element alone when it cannot be changed (K13)', () => {
    const controller = createAudioController({ volumeProbe: readOnlyProbe })
    const audio = new Audio()
    audio.volume = 0.6
    controller.attach(audio)
    expect(audio.volume).toBe(0.6)
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

  // Play after a pause reloads the live stream, so it plays from the live edge instead
  // of the buffer (ADR 0032).
  it('reloads the live stream on play() after a pause (C7)', async () => {
    const { controller, audio } = setup()
    await controller.play(live())
    controller.pause()
    expect(controller.getSnapshot().status).toBe('paused')
    expect(audio.paused).toBe(true)
    await controller.play(live())
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: false })
    expect(media.load).toHaveBeenCalledTimes(2)
    expect(media.play).toHaveBeenCalledTimes(2)
    expect(audio.src).toBe(MP3)
  })

  it('does nothing on play() when the loaded source is already playing', async () => {
    const { controller } = setup()
    await controller.play(live())
    await controller.play(live())
    expect(media.load).toHaveBeenCalledTimes(1)
    expect(media.play).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: false })
  })

  // An error after the live stream has played reconnects instead (ADR 0061).
  it('reloads the stream on play() after an error', async () => {
    media.failing.add(MP3)
    const { controller } = setup()
    await controller.play(live())
    expect(controller.getSnapshot().status).toBe('error')
    media.failing.delete(MP3)
    await controller.play(live())
    // Two loads for the failing play() and its retry without crossOrigin (ADR 0033).
    expect(media.load).toHaveBeenCalledTimes(3)
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
    // Playing: a pause during the load would destroy it (ADR 0034).
    hls.instances[0].handlers.hlsManifestParsed('hlsManifestParsed', { fatal: false })
    await Promise.resolve()
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

  it('takes the platform when it is created', async () => {
    const hls = createFakeHls()
    const { controller, audio } = setup({
      loaders: { loadHls: hls.loadHls },
      platform: IPHONE,
    })
    await controller.play(live(HLS))
    expect(hls.loadHls).not.toHaveBeenCalled()
    expect(audio.src).toBe(HLS)
    controller.pause()
    await controller.play(live(MP3))
    await controller.play(live(HLS))
    expect(hls.loadHls).not.toHaveBeenCalled()
  })

  it('plays HLS natively on iPadOS with the desktop user agent (K13)', async () => {
    const hls = createFakeHls()
    const { controller, audio } = setup({
      loaders: { loadHls: hls.loadHls },
      platform: IPAD_DESKTOP,
    })
    await controller.play(live(HLS))
    expect(hls.loadHls).not.toHaveBeenCalled()
    expect(audio.src).toBe(HLS)
  })

  it('uses hls.js on a Mac without touch', async () => {
    const hls = createFakeHls()
    const { controller } = setup({
      loaders: { loadHls: hls.loadHls },
      platform: { userAgent: SAFARI, maxTouchPoints: 0 },
    })
    await controller.play(live(HLS))
    expect(hls.instances).toHaveLength(1)
  })
})

describe('HLS', () => {
  it('uses hls.js on non-iOS without crossOrigin and plays on MANIFEST_PARSED', async () => {
    const hls = createFakeHls()
    const { controller, audio } = setup({ loaders: { loadHls: hls.loadHls } })
    await controller.play(live(HLS))
    expect(hls.instances).toHaveLength(1)
    expect(hls.instances[0].loadSource).toHaveBeenCalledWith(HLS)
    expect(hls.instances[0].attachMedia).toHaveBeenCalledWith(audio)
    expect(media.play).not.toHaveBeenCalled()
    hls.instances[0].handlers.hlsManifestParsed('hlsManifestParsed', { fatal: false })
    await Promise.resolve()
    expect(media.play).toHaveBeenCalledTimes(1)
    expect(audio.crossOrigin).toBeNull()
  })

  // Attaching hls.js is not playing: loading ends with the playing of the element
  // (ADR 0034).
  it('keeps loading until the element plays (K11)', async () => {
    const hls = createFakeHls()
    const { controller } = setup({ loaders: { loadHls: hls.loadHls } })
    await controller.play(live(HLS))
    expect(media.play).not.toHaveBeenCalled()
    expect(controller.getSnapshot()).toMatchObject({ status: 'idle', loading: true })
    hls.instances[0].handlers.hlsManifestParsed('hlsManifestParsed', { fatal: false })
    await Promise.resolve()
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: false })
  })

  // The pause destroys the load, so hls.js does not play on MANIFEST_PARSED (ADR 0034).
  it('respects a pause pressed while HLS loads (K11)', async () => {
    const hls = createFakeHls()
    const { controller } = setup({ loaders: { loadHls: hls.loadHls } })
    await controller.play(live(HLS))
    controller.pause()
    expect(hls.instances[0].destroy).toHaveBeenCalledTimes(1)
    hls.instances[0].handlers.hlsManifestParsed('hlsManifestParsed', { fatal: false })
    hls.instances[0].handlers.hlsError('hlsError', { fatal: true })
    await Promise.resolve()
    expect(media.play).not.toHaveBeenCalled()
    expect(controller.getSnapshot()).toMatchObject({ status: 'paused', loading: false })
  })

  it('sets error when play() after MANIFEST_PARSED rejects', async () => {
    // The fake attachMedia() leaves src empty, so play() runs on ''.
    media.failing.add('')
    const hls = createFakeHls()
    const { controller } = setup({ loaders: { loadHls: hls.loadHls } })
    await controller.play(live(HLS))
    hls.instances[0].handlers.hlsManifestParsed('hlsManifestParsed', { fatal: false })
    await vi.waitFor(() => expect(controller.getSnapshot().status).toBe('error'))
  })

  it('sets error on a fatal hls.js error only', async () => {
    const hls = createFakeHls()
    const { controller } = setup({ loaders: { loadHls: hls.loadHls } })
    await controller.play(live(HLS))
    hls.instances[0].handlers.hlsError('hlsError', { fatal: false })
    expect(controller.getSnapshot().status).toBe('idle')
    hls.instances[0].handlers.hlsError('hlsError', { fatal: true })
    expect(controller.getSnapshot().status).toBe('error')
  })

  // A fatal error arrives after the load, which no longer clears loading (ADR 0034).
  it('clears loading on a fatal hls.js error while it loads', async () => {
    const hls = createFakeHls()
    const { controller } = setup({ loaders: { loadHls: hls.loadHls } })
    await controller.play(live(HLS))
    hls.instances[0].handlers.hlsError('hlsError', { fatal: true })
    // The alert shows: error and not loading.
    expect(controller.getSnapshot()).toMatchObject({ status: 'error', loading: false })
  })

  it('falls back to native HLS with crossOrigin when hls.js is not supported', async () => {
    const hls = createFakeHls()
    hls.setSupported(false)
    const { controller, audio } = setup({ loaders: { loadHls: hls.loadHls } })
    await controller.play(live(HLS))
    expect(hls.instances).toHaveLength(0)
    expect(audio.src).toBe(HLS)
    expect(audio.crossOrigin).toBe('anonymous')
    expect(media.play).toHaveBeenCalledWith(HLS)
    expect(controller.getSnapshot().status).toBe('playing')
  })

  // An error of the element while start() is pending waits for its outcome, with any
  // live source; the fatal hls.js error still sets error (K83).
  it('drops an error of the element while hls.js starts (K83)', async () => {
    const hls = createFakeHls()
    const { controller, audio } = setup({ loaders: { loadHls: hls.loadHls } })
    const playing = controller.play(live(HLS))
    audio.dispatchEvent(new Event('error'))
    await playing
    expect(controller.getSnapshot()).toMatchObject({ status: 'idle', loading: true })
    audio.dispatchEvent(new Event('error'))
    expect(controller.getSnapshot().status).toBe('error')
  })

  // The reload does not depend on comparing audio.src with a blob: URL (K12, ADR 0032).
  it('recreates hls.js to return to the live edge (C7)', async () => {
    const hls = createFakeHls()
    const { controller } = setup({ loaders: { loadHls: hls.loadHls } })
    await controller.play(live(HLS))
    controller.pause()
    await controller.play(live(HLS))
    expect(hls.instances).toHaveLength(2)
    expect(hls.instances[0].destroy).toHaveBeenCalledTimes(1)
    expect(hls.instances[1].loadSource).toHaveBeenCalledWith(HLS)
  })
})

describe('DASH', () => {
  it('uses dashjs with autoplay and without crossOrigin', async () => {
    const dash = createFakeDash()
    const { controller, audio } = setup({ loaders: { loadDash: dash.loadDash } })
    await controller.play(live(DASH))
    expect(dash.players).toHaveLength(1)
    expect(dash.players[0].initialize).toHaveBeenCalledWith(audio, DASH, true)
    expect(audio.crossOrigin).toBeNull()
    expect(media.play).not.toHaveBeenCalled()
  })

  // Attaching dashjs is not playing: loading ends with the playing of the element
  // (ADR 0034).
  it('keeps loading until the element plays with DASH (K11)', async () => {
    const dash = createFakeDash()
    const { controller, audio } = setup({ loaders: { loadDash: dash.loadDash } })
    await controller.play(live(DASH))
    expect(controller.getSnapshot()).toMatchObject({ status: 'idle', loading: true })
    // The dashjs autoplay.
    audio.dispatchEvent(new Event('playing'))
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: false })
  })

  // The pause resets dashjs, which stops its autoplay (ADR 0034).
  it('respects a pause pressed while DASH loads (K11)', async () => {
    const dash = createFakeDash()
    const { controller } = setup({ loaders: { loadDash: dash.loadDash } })
    await controller.play(live(DASH))
    controller.pause()
    // reset() stops the dashjs autoplay.
    expect(dash.players[0].reset).toHaveBeenCalledTimes(1)
    dash.players[0].handlers.error({ error: { code: 17 } })
    expect(controller.getSnapshot()).toMatchObject({ status: 'paused', loading: false })
  })

  it('sets error on a dashjs error', async () => {
    const dash = createFakeDash()
    const { controller } = setup({ loaders: { loadDash: dash.loadDash } })
    await controller.play(live(DASH))
    dash.players[0].handlers.error({ error: { code: 17 } })
    expect(controller.getSnapshot().status).toBe('error')
  })

  it('clears loading on a dashjs error while it loads', async () => {
    const dash = createFakeDash()
    const { controller } = setup({ loaders: { loadDash: dash.loadDash } })
    await controller.play(live(DASH))
    dash.players[0].handlers.error({ error: { code: 17 } })
    expect(controller.getSnapshot()).toMatchObject({ status: 'error', loading: false })
  })

  // As with hls.js (K83).
  it('drops an error of the element while dashjs starts (K83)', async () => {
    const dash = createFakeDash()
    const { controller, audio } = setup({ loaders: { loadDash: dash.loadDash } })
    const playing = controller.play(live(DASH))
    audio.dispatchEvent(new Event('error'))
    await playing
    expect(controller.getSnapshot()).toMatchObject({ status: 'idle', loading: true })
    audio.dispatchEvent(new Event('error'))
    expect(controller.getSnapshot().status).toBe('error')
  })

  // As with hls.js (ADR 0032).
  it('recreates dashjs to return to the live edge after a pause (C7)', async () => {
    const dash = createFakeDash()
    const { controller } = setup({ loaders: { loadDash: dash.loadDash } })
    await controller.play(live(DASH))
    controller.pause()
    await controller.play(live(DASH))
    expect(dash.players).toHaveLength(2)
    expect(dash.players[0].reset).toHaveBeenCalledTimes(1)
    expect(dash.players[1].initialize).toHaveBeenCalledWith(expect.anything(), DASH, true)
  })
})

describe('welcome audio (intro)', () => {
  it('plays the intro first with crossOrigin and locks the controls', async () => {
    const { controller, audio } = setup()
    await controller.play(withIntro())
    expect(audio.src).toBe(INTRO)
    expect(audio.crossOrigin).toBe('anonymous')
    expect(controller.getSnapshot()).toMatchObject({
      status: 'playing',
      loading: false,
      introLocked: true,
      activeSource: 'intro',
    })
  })

  it('reports playing when the intro play() resolves, without waiting for the playing event', async () => {
    const controller = createAudioController()
    const audio = new Audio()
    // Registered first, so the controller never hears 'playing'.
    audio.addEventListener('playing', (event) => event.stopImmediatePropagation())
    controller.attach(audio)
    await controller.play(withIntro())
    expect(controller.getSnapshot().status).toBe('playing')
  })

  it('is loading while the intro play() is pending', async () => {
    media.hold = true
    const { controller } = setup()
    const playing = controller.play(withIntro())
    expect(controller.getSnapshot()).toMatchObject({ loading: true, introLocked: true })
    media.release()
    await playing
    expect(controller.getSnapshot()).toMatchObject({ loading: false, status: 'playing' })
  })

  it('cannot be paused while it plays', async () => {
    const { controller } = setup()
    await controller.play(withIntro())
    controller.pause()
    expect(media.pause).not.toHaveBeenCalled()
    expect(controller.getSnapshot().status).toBe('playing')
  })

  it('ignores play() while it plays', async () => {
    const { controller } = setup()
    await controller.play(withIntro())
    await controller.play(withIntro())
    expect(media.play).toHaveBeenCalledTimes(1)
  })

  it('switches to the live stream on ended and unlocks', async () => {
    const { controller, audio } = setup()
    await controller.play(withIntro())
    audio.dispatchEvent(new Event('ended'))
    await vi.waitFor(() => expect(controller.getSnapshot().activeSource).toBe('live'))
    expect(audio.src).toBe(MP3)
    expect(audio.crossOrigin).toBe('anonymous')
    expect(controller.getSnapshot()).toMatchObject({
      status: 'playing',
      loading: false,
      introLocked: false,
      introConsumed: true,
    })
    controller.pause()
    expect(controller.getSnapshot().status).toBe('paused')
  })

  // The 3.5.0 player ignored ended on the live stream; now it reconnects (ADR 0061).
  it('reconnects the live stream that follows it on ended, after the first delay (C8)', async () => {
    const { controller, audio, fake } = setup()
    await controller.play(withIntro())
    audio.dispatchEvent(new Event('ended'))
    await vi.waitFor(() => expect(controller.getSnapshot().activeSource).toBe('live'))
    audio.dispatchEvent(new Event('ended'))
    await Promise.resolve()
    expect(media.load.mock.calls.map(([src]) => src)).toEqual([INTRO, MP3])
    fake.advance(RECONNECT_DELAYS_MS[0])
    expect(media.load.mock.calls.map(([src]) => src)).toEqual([INTRO, MP3, MP3])
  })

  it('ignores ended before anything is loaded', async () => {
    const { controller, audio } = setup()
    audio.dispatchEvent(new Event('ended'))
    await Promise.resolve()
    expect(media.load).not.toHaveBeenCalled()
    expect(controller.getSnapshot()).toBe(initialPlayerState)
  })

  it('falls through to the live stream silently when it fails', async () => {
    media.failing.add(INTRO)
    const { controller, audio } = setup()
    await controller.play(withIntro())
    expect(audio.src).toBe(MP3)
    expect(controller.getSnapshot()).toMatchObject({
      status: 'playing',
      loading: false,
      introLocked: false,
      activeSource: 'live',
      introConsumed: true,
    })
  })

  // The live stream that follows a failed welcome audio keeps loading until the element
  // plays (ADR 0034).
  it('keeps loading until HLS plays when it fails (K11)', async () => {
    media.failing.add(INTRO)
    const hls = createFakeHls()
    const { controller, audio } = setup({ loaders: { loadHls: hls.loadHls } })
    await controller.play(withIntro(HLS))
    expect(controller.getSnapshot()).toMatchObject({ status: 'idle', loading: true })
    // What the element fires once hls.js plays on MANIFEST_PARSED.
    audio.dispatchEvent(new Event('playing'))
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: false })
  })

  it('sets error when it fails and the live stream fails too', async () => {
    media.failing.add(INTRO)
    media.failing.add(MP3)
    const { controller } = setup()
    await controller.play(withIntro())
    expect(controller.getSnapshot()).toMatchObject({ status: 'error', loading: false })
  })

  it('plays only once per controller', async () => {
    const { controller, audio } = setup()
    await controller.play(withIntro())
    audio.dispatchEvent(new Event('ended'))
    await vi.waitFor(() => expect(controller.getSnapshot().activeSource).toBe('live'))
    controller.pause()
    await controller.play(withIntro())
    expect(media.play.mock.calls.map(([src]) => src)).toEqual([INTRO, MP3, MP3])
  })

  it('plays nothing but the live stream without an intro URL', async () => {
    const { controller, audio } = setup()
    await controller.play({ streamUrl: MP3, introUrl: '' })
    expect(audio.src).toBe(MP3)
    expect(controller.getSnapshot().introConsumed).toBe(false)
  })

  // The MSE path takes no crossOrigin, even after the welcome audio set it (ADR 0004).
  it('clears crossOrigin on the hls.js path after the welcome audio (K70)', async () => {
    const hls = createFakeHls()
    const { controller, audio } = setup({ loaders: { loadHls: hls.loadHls } })
    await controller.play(withIntro(HLS))
    audio.dispatchEvent(new Event('ended'))
    await vi.waitFor(() => expect(hls.instances).toHaveLength(1))
    expect(hls.instances[0].attachMedia).toHaveBeenCalledWith(audio)
    expect(audio.crossOrigin).toBeNull()
  })

  it('clears crossOrigin on the dashjs path after the welcome audio (K70)', async () => {
    const dash = createFakeDash()
    const { controller, audio } = setup({ loaders: { loadDash: dash.loadDash } })
    await controller.play(withIntro(DASH))
    audio.dispatchEvent(new Event('ended'))
    await vi.waitFor(() => expect(dash.players).toHaveLength(1))
    expect(dash.players[0].initialize).toHaveBeenCalledWith(audio, DASH, true)
    expect(audio.crossOrigin).toBeNull()
  })
})

describe('streams without CORS (C1)', () => {
  it('plays an MP3 without CORS by retrying without crossOrigin', async () => {
    media.corsBlocked.add(MP3)
    const { controller, audio } = setup()
    await controller.play(live())
    expect(media.play).toHaveBeenCalledTimes(2)
    expect(audio.hasAttribute('crossorigin')).toBe(false)
    expect(controller.getSnapshot()).toMatchObject({
      status: 'playing',
      loading: false,
      activeSource: 'live',
    })
  })

  it('plays native HLS without CORS by retrying without crossOrigin', async () => {
    media.corsBlocked.add(HLS)
    const { controller, audio } = setup({ platform: IPHONE })
    await controller.play(live(HLS))
    expect(media.play).toHaveBeenCalledTimes(2)
    expect(audio.hasAttribute('crossorigin')).toBe(false)
    expect(controller.getSnapshot().status).toBe('playing')
  })

  it('plays the welcome audio and then the live stream without CORS', async () => {
    media.corsBlocked.add(INTRO)
    media.corsBlocked.add(MP3)
    const { controller, audio } = setup()
    await controller.play(withIntro())
    expect(audio.src).toBe(INTRO)
    expect(audio.hasAttribute('crossorigin')).toBe(false)
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', activeSource: 'intro' })
    audio.dispatchEvent(new Event('ended'))
    await vi.waitFor(() => expect(controller.getSnapshot().activeSource).toBe('live'))
    expect(audio.src).toBe(MP3)
    expect(media.play).toHaveBeenCalledTimes(4)
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', introLocked: false })
  })

  it('sets error when the retry fails too', async () => {
    media.failing.add(MP3)
    const { controller } = setup()
    await controller.play(live())
    expect(media.play).toHaveBeenCalledTimes(2)
    expect(controller.getSnapshot().status).toBe('error')
  })

  it('does not retry when the element is in the Web Audio graph, and sets error (D1)', async () => {
    media.corsBlocked.add(OGG)
    const { controller, audio } = setup({ webAudio: withWebAudio() })
    await controller.play(live())
    expect(controller.getSnapshot().canVisualize).toBe(true)
    controller.pause()
    media.play.mockClear()

    await controller.play(live(OGG))

    expect(media.play).toHaveBeenCalledTimes(1)
    expect(audio.crossOrigin).toBe('anonymous')
    expect(controller.getSnapshot().status).toBe('error')
  })

  /** Records each status and loading the controller publishes, without repeats */
  const recordPublished = (controller: ReturnType<typeof setup>['controller']) => {
    const published: Array<{ status: string; loading: boolean }> = []
    controller.subscribe(() => {
      const { status, loading } = controller.getSnapshot()
      const last = published[published.length - 1]
      if (last?.status !== status || last.loading !== loading) published.push({ status, loading })
    })
    return published
  }

  it('publishes no error while the C1 retry loads (K83)', async () => {
    media.corsBlocked.add(MP3)
    media.hold = true
    const { controller, audio } = setup()
    const published = recordPublished(controller)

    const playing = controller.play(live())
    // The browser fires the error of the attempt with crossOrigin before play() rejects.
    audio.dispatchEvent(new Event('error'))
    await vi.waitFor(() => expect(media.play).toHaveBeenCalledTimes(2))
    // The retry without crossOrigin loads and can play.
    audio.dispatchEvent(new Event('canplay'))
    expect(controller.getSnapshot()).toMatchObject({ status: 'idle', loading: false })
    media.release()
    await playing

    // The PlayerPage opens its alert on status 'error' with loading false.
    expect(published).toEqual([
      { status: 'idle', loading: true },
      { status: 'idle', loading: false },
      { status: 'playing', loading: false },
    ])
  })

  it('publishes no error while the C1 retry loads after the pause of Chromium (K83, K1)', async () => {
    media.corsBlocked.add(MP3)
    media.hold = true
    const { controller, audio } = setup()
    const published = recordPublished(controller)

    const playing = controller.play(live())
    // Chromium fires a pause after the error of a failing source (K1).
    audio.dispatchEvent(new Event('error'))
    audio.dispatchEvent(new Event('pause'))
    await vi.waitFor(() => expect(media.play).toHaveBeenCalledTimes(2))
    audio.dispatchEvent(new Event('canplay'))
    media.release()
    await playing

    expect(published).toEqual([
      { status: 'idle', loading: true },
      { status: 'idle', loading: false },
      { status: 'playing', loading: false },
    ])
  })

  it('sets error once when the C1 retry fails too, as with a 404 (K83)', async () => {
    media.failing.add(MP3)
    const { controller, audio } = setup()
    const published = recordPublished(controller)

    const playing = controller.play(live())
    audio.dispatchEvent(new Event('error'))
    audio.dispatchEvent(new Event('pause'))
    await playing

    expect(media.play).toHaveBeenCalledTimes(2)
    expect(published).toEqual([
      { status: 'idle', loading: true },
      { status: 'error', loading: true },
      { status: 'error', loading: false },
    ])
  })
})

describe('currently (docs/known-issues.md)', () => {
  it('releases the welcome audio when the live stream fails after it (K63)', async () => {
    media.failing.add(MP3)
    const { controller, audio } = setup()
    await controller.play(withIntro())
    audio.dispatchEvent(new Event('ended'))
    await vi.waitFor(() => expect(controller.getSnapshot().status).toBe('error'))
    await vi.waitFor(() => expect(controller.getSnapshot().loading).toBe(false))

    // Play is enabled and loads the live stream, without the welcome audio.
    expect(controller.getSnapshot().introLocked).toBe(false)
    media.failing.clear()
    await controller.play(withIntro())
    // The live stream fails twice: with crossOrigin and on its retry (ADR 0033).
    expect(media.play.mock.calls.map(([src]) => src)).toEqual([INTRO, MP3, MP3, MP3])
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', activeSource: 'live' })
  })

  it('releases the welcome audio when both the welcome audio and the live stream fail (K63)', async () => {
    media.failing.add(INTRO)
    media.failing.add(MP3)
    const { controller } = setup()
    await controller.play(withIntro())
    expect(controller.getSnapshot()).toMatchObject({ status: 'error', introLocked: false })
    media.failing.clear()
    await controller.play(withIntro())
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', activeSource: 'live' })
  })

  it('releases the welcome audio when something else pauses it (K63)', async () => {
    const { controller, audio } = setup()
    await controller.play(withIntro())
    audio.pause()
    expect(controller.getSnapshot()).toMatchObject({
      status: 'paused',
      introLocked: false,
      introConsumed: true,
    })
    await controller.play(withIntro())
    expect(media.play.mock.calls.map(([src]) => src)).toEqual([INTRO, MP3])
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', activeSource: 'live' })
  })

  it('releases the welcome audio when something else pauses it while it starts (K63)', async () => {
    media.hold = true
    const { controller, audio } = setup()
    const playing = controller.play(withIntro())
    audio.pause()
    media.fail('AbortError')
    await playing
    expect(controller.getSnapshot()).toMatchObject({
      status: 'paused',
      loading: false,
      introLocked: false,
    })
    expect(media.play.mock.calls.map(([src]) => src)).toEqual([INTRO])
  })

  it('releases the welcome audio when it errors while playing (K63)', async () => {
    const { controller, audio } = setup()
    await controller.play(withIntro())
    audio.dispatchEvent(new Event('error'))
    await vi.waitFor(() => expect(controller.getSnapshot().activeSource).toBe('live'))
    expect(audio.src).toBe(MP3)
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', introLocked: false })
  })

  it('does not release the welcome audio on the pause before its end (K63)', async () => {
    const { controller, audio } = setup()
    await controller.play(withIntro())
    // What the browser fires when the welcome audio ends: pause, with ended true.
    Object.defineProperty(audio, 'ended', { configurable: true, value: true })
    audio.dispatchEvent(new Event('pause'))
    expect(controller.getSnapshot()).toMatchObject({ introLocked: true, activeSource: 'intro' })
    audio.dispatchEvent(new Event('ended'))
    await vi.waitFor(() => expect(controller.getSnapshot().activeSource).toBe('live'))
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', introLocked: false })
  })

  it('errors in the welcome audio fall through to the live stream once (K63)', async () => {
    media.failing.add(INTRO)
    const { controller, audio } = setup()
    const playing = controller.play(withIntro())
    // The error of the element comes before the rejection of its play().
    audio.dispatchEvent(new Event('error'))
    await playing
    // The welcome audio fails twice: with crossOrigin and on its retry (ADR 0033).
    expect(media.play.mock.calls.map(([src]) => src)).toEqual([INTRO, INTRO, MP3])
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', activeSource: 'live' })
  })

  it('cancels the live stream that follows the welcome audio on pause() (K63)', async () => {
    media.hold = true
    const { controller, audio } = setup()
    const intro = controller.play(withIntro())
    media.release()
    await intro
    audio.dispatchEvent(new Event('ended'))
    await vi.waitFor(() => expect(media.play).toHaveBeenLastCalledWith(MP3))
    controller.pause()
    media.fail('AbortError')
    await vi.waitFor(() => expect(media.pending).toHaveLength(0))
    await Promise.resolve()
    expect(media.pause).toHaveBeenCalledWith(MP3)
    expect(controller.getSnapshot()).toMatchObject({ status: 'paused', loading: false })
  })

  it('keeps a single load of the live stream that follows the welcome audio on play() (K63)', async () => {
    media.hold = true
    const { controller, audio } = setup()
    const intro = controller.play(withIntro())
    media.release()
    await intro
    audio.dispatchEvent(new Event('ended'))
    await vi.waitFor(() => expect(media.play).toHaveBeenLastCalledWith(MP3))
    const again = controller.play(withIntro())
    media.release()
    await again
    expect(media.play.mock.calls.map(([src]) => src)).toEqual([INTRO, MP3])
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', activeSource: 'live' })
  })

  it('clears loading on a pause while buffering (K64)', async () => {
    const { controller, audio } = setup()
    await controller.play(live())
    audio.dispatchEvent(new Event('waiting'))
    controller.pause()
    audio.dispatchEvent(new Event('canplay'))
    // Play replaces the spinner.
    expect(controller.getSnapshot()).toMatchObject({ status: 'paused', loading: false })
  })
})

describe('volume', () => {
  it('starts at 1 and applies changes to the element and the snapshot', () => {
    const { controller, audio } = setup()
    expect(controller.getSnapshot().volume).toBe(1)
    controller.setVolume(0.5)
    expect(audio.volume).toBe(0.5)
    expect(controller.getSnapshot().volume).toBe(0.5)
  })

  it('is controllable without a probe', () => {
    expect(createAudioController().getSnapshot().volumeControllable).toBe(true)
  })

  it('probes once, when it is created, so the first snapshot is right (K13)', () => {
    const volumeProbe = vi.fn(readOnlyProbe)
    const controller = createAudioController({ volumeProbe })
    expect(controller.getSnapshot().volumeControllable).toBe(false)
    controller.attach(new Audio())
    controller.setVolume(0.5)
    expect(volumeProbe).toHaveBeenCalledTimes(1)
  })

  // iOS 18 reads the write back at once and undoes it later, so the probe alone says it
  // can be changed (K108, ADR 0056).
  for (const [device, platform] of [
    ['an iPhone', IPHONE],
    ['an iPad with the desktop site', IPAD_DESKTOP],
  ] as const) {
    it(`is not controllable on ${device}, though iOS 18 takes the write for a moment (K108)`, () => {
      media.revertingVolume = true
      const controller = createAudioController({ platform, volumeProbe: () => new Audio() })
      expect(controller.getSnapshot().volumeControllable).toBe(false)
    })
  }

  it('does not probe on iOS (ADR 0056)', () => {
    const volumeProbe = vi.fn(() => new Audio())
    createAudioController({ platform: IPHONE, volumeProbe })
    expect(volumeProbe).not.toHaveBeenCalled()
  })

  it('is not controllable on iOS without a probe (K108)', () => {
    const controller = createAudioController({ platform: IPHONE })
    expect(controller.getSnapshot().volumeControllable).toBe(false)
  })

  it('is controllable when the probe applies the write', () => {
    const controller = createAudioController({ volumeProbe: () => new Audio() })
    expect(controller.getSnapshot().volumeControllable).toBe(true)
  })

  it('ignores changes when the volume cannot be changed (K13)', () => {
    const { controller, audio } = setup({ volumeProbe: readOnlyProbe })
    controller.setVolume(0.5)
    expect(audio.volume).toBe(1)
    expect(controller.getSnapshot().volume).toBe(1)
  })

  it('ignores changes while detached', () => {
    const controller = createAudioController()
    controller.setVolume(0.5)
    expect(controller.getSnapshot().volume).toBe(1)
  })
})

// The concurrency of play() and pause(), as in the 'concurrency' cases of
// src/hooks/use-audio-player.test.tsx.
describe('concurrency (spec 0006, 2.10)', () => {
  // A second play() while hls.js loads gets the pending play(), so only one Hls is
  // created, as with a single call (K80).
  it('keeps a single hls.js alive after a second play() while it loads (K80)', async () => {
    const hls = createFakeHls()
    let resolveLoader!: () => void
    const loaded = new Promise<void>((resolve) => {
      resolveLoader = resolve
    })
    const loadHls = vi.fn(async () => {
      await loaded
      return hls.Hls
    })
    const { controller, audio } = setup({ loaders: { loadHls } })
    const first = controller.play(live(HLS))
    const second = controller.play(live(HLS))
    resolveLoader()
    await Promise.all([first, second])

    expect(second).toBe(first)
    expect(loadHls).toHaveBeenCalledTimes(1)
    expect(hls.instances).toHaveLength(1)
    expect(hls.instances[0].attachMedia).toHaveBeenCalledTimes(1)
    expect(hls.instances[0].attachMedia).toHaveBeenCalledWith(audio)
    hls.instances[0].handlers.hlsManifestParsed('hlsManifestParsed', { fatal: false })
    await Promise.resolve()
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: false })

    controller.dispose()
    expect(hls.instances[0].destroy).toHaveBeenCalledTimes(1)
  })

  // The serialization covers every protocol and keeps the options of the first call.
  it('loads the MP3 once after a second play() while the first is pending', async () => {
    media.hold = true
    const { controller, audio } = setup()
    const first = controller.play(live())
    const second = controller.play(live(OGG))
    expect(second).toBe(first)
    media.release()
    await Promise.all([first, second])

    expect(media.load).toHaveBeenCalledTimes(1)
    expect(media.play).toHaveBeenCalledTimes(1)
    expect(audio.src).toBe(MP3)
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: false })
  })

  it('starts a new play() once the previous one has settled', async () => {
    const hls = createFakeHls()
    const { controller } = setup({ loaders: { loadHls: hls.loadHls } })
    await controller.play(live(HLS))
    controller.pause()
    await controller.play(live(HLS))
    // Play after a pause reloads the live stream (ADR 0032), so the second play() was not
    // deduplicated.
    expect(hls.instances).toHaveLength(2)
  })

  // A browser rejects the pending play() with AbortError when pause() interrupts it;
  // the pause cancels the load (K81, ADR 0034).
  it('stays paused, without an error, when a pause interrupts the loading MP3 (K81)', async () => {
    media.hold = true
    const { controller } = setup()
    const playing = controller.play(live())
    controller.pause()
    expect(controller.getSnapshot().status).toBe('paused')

    media.fail('AbortError')
    await playing

    expect(controller.getSnapshot()).toMatchObject({ status: 'paused', loading: false })
  })

  // The pause releases the pending play() (K80), so the next one loads again, and the
  // cancelled load creates no hls.js of its own.
  it('reloads on play() after a pause that cancelled the load', async () => {
    const hls = createFakeHls()
    const releases: (() => void)[] = []
    const loadHls = vi.fn(
      () => new Promise<typeof hls.Hls>((resolve) => releases.push(() => resolve(hls.Hls))),
    )
    const { controller } = setup({ loaders: { loadHls } })
    const first = controller.play(live(HLS))
    controller.pause()
    const second = controller.play(live(HLS))
    expect(second).not.toBe(first)
    releases.forEach((release) => release())
    await Promise.all([first, second])

    expect(loadHls).toHaveBeenCalledTimes(2)
    expect(hls.instances).toHaveLength(1)
    hls.instances[0].handlers.hlsManifestParsed('hlsManifestParsed', { fatal: false })
    await Promise.resolve()
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: false })
  })
})

describe('visualization (K82, ADR 0031)', () => {
  it('starts without a visualizer and creates nothing until play()', () => {
    const options = withWebAudio()
    const { controller, audio } = setup({ webAudio: options })
    audio.dispatchEvent(new Event('playing'))

    expect(options.createContext).not.toHaveBeenCalled()
    expect(controller.getSnapshot().canVisualize).toBe(false)
    expect(controller.getAnalyser()).toBeNull()
  })

  it('creates the context synchronously in play(), inside the gesture', () => {
    media.hold = true
    const options = withWebAudio()
    const { controller } = setup({ webAudio: options })

    void controller.play(live())

    expect(options.createContext).toHaveBeenCalledTimes(1)
  })

  it('visualizes a direct stream with CORS and connects the element once', async () => {
    const { controller, audio } = setup({ webAudio: withWebAudio() })
    await controller.play(live())

    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', canVisualize: true })
    const [context] = webAudio.contexts
    expect(context.createMediaElementSource).toHaveBeenCalledWith(audio)
    expect(controller.getAnalyser()).toBe(context.analysers[0])

    controller.pause()
    await controller.play(live())
    expect(context.createMediaElementSource).toHaveBeenCalledTimes(1)
    expect(webAudio.contexts).toHaveLength(1)
  })

  it('visualizes hls.js (MSE)', async () => {
    const hls = createFakeHls()
    const { controller, audio } = setup({
      loaders: { loadHls: hls.loadHls },
      webAudio: withWebAudio(),
    })
    await controller.play(live(HLS))
    hls.instances[0].handlers[hls.Hls.Events.MANIFEST_PARSED]('', { fatal: false })
    await vi.waitFor(() => expect(controller.getSnapshot().canVisualize).toBe(true))
    expect(webAudio.contexts[0].createMediaElementSource).toHaveBeenCalledWith(audio)
  })

  it('visualizes dashjs (MSE)', async () => {
    const dash = createFakeDash()
    const { controller, audio } = setup({
      loaders: { loadDash: dash.loadDash },
      webAudio: withWebAudio(),
    })
    await controller.play(live(DASH))
    audio.dispatchEvent(new Event('playing'))
    expect(controller.getSnapshot().canVisualize).toBe(true)
  })

  it('does not visualize after the retry without crossOrigin, nor connect the element', async () => {
    media.corsBlocked.add(MP3)
    const { controller } = setup({ webAudio: withWebAudio() })
    await controller.play(live())

    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', canVisualize: false })
    expect(webAudio.contexts[0].createMediaElementSource).not.toHaveBeenCalled()
    expect(controller.getAnalyser()).toBeNull()
  })

  it('never visualizes the welcome audio, and visualizes the live stream after it', async () => {
    const { controller, audio } = setup({ webAudio: withWebAudio() })
    await controller.play(withIntro())

    expect(controller.getSnapshot()).toMatchObject({ activeSource: 'intro', canVisualize: false })
    expect(webAudio.contexts[0].createMediaElementSource).not.toHaveBeenCalled()

    audio.dispatchEvent(new Event('ended'))
    await vi.waitFor(() => expect(controller.getSnapshot().canVisualize).toBe(true))
  })

  it('never creates the context in WebKit, nor visualizes', async () => {
    const options = withWebAudio(SAFARI)
    const { controller } = setup({ webAudio: options })
    await controller.play(live())

    expect(options.createContext).not.toHaveBeenCalled()
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', canVisualize: false })
  })

  it('does not visualize without the Web Audio API', async () => {
    const { controller } = setup({ webAudio: { userAgent: CHROME } })
    await controller.play(live())
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', canVisualize: false })
  })

  it('does not visualize when the element cannot be connected', async () => {
    const createContext = () => {
      const context = new FakeAudioContext()
      context.createMediaElementSource.mockImplementation(() => {
        throw new Error('InvalidStateError')
      })
      return context as unknown as AudioContext
    }
    const { controller } = setup({ webAudio: { createContext, userAgent: CHROME } })
    await controller.play(live())
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', canVisualize: false })
  })

  it('resumes a suspended context in play()', async () => {
    const { controller } = setup({ webAudio: withWebAudio() })
    await controller.play(live())
    controller.pause()
    const [context] = webAudio.contexts
    context.state = 'suspended'

    void controller.play(live())

    expect(context.resume).toHaveBeenCalledTimes(1)
  })

  it('clears canVisualize while the next attempt loads', async () => {
    const { controller } = setup({ webAudio: withWebAudio() })
    await controller.play(live())
    controller.pause()
    media.hold = true

    void controller.play(live(OGG))

    expect(controller.getSnapshot()).toMatchObject({ loading: true, canVisualize: false })
  })
})

describe('reconnection (C8, ADR 0061)', () => {
  /** A controller whose live MP3 has played */
  async function playing(options: Parameters<typeof createAudioController>[0] = {}) {
    const context = setup(options)
    await context.controller.play(live())
    expect(context.controller.getSnapshot()).toMatchObject({ status: 'playing', loading: false })
    return context
  }

  it('reconnects after an error of the live stream, without publishing it', async () => {
    const { controller, audio, fake } = await playing()
    const published: string[] = []
    controller.subscribe(() => published.push(controller.getSnapshot().status))

    audio.dispatchEvent(new Event('error'))
    // What WebKitGTK fires after the error of a cut.
    audio.dispatchEvent(new Event('pause'))
    audio.dispatchEvent(new Event('ended'))

    expect(controller.getSnapshot()).toMatchObject({
      status: 'playing',
      loading: true,
      canVisualize: false,
    })
    fake.advance(RECONNECT_DELAYS_MS[0] - 1)
    expect(media.load).toHaveBeenCalledTimes(1)
    fake.advance(1)
    expect(media.load).toHaveBeenCalledTimes(2)
    expect(audio.src).toBe(MP3)
    expect(audio.crossOrigin).toBe('anonymous')
    await vi.waitFor(() => expect(controller.getSnapshot().loading).toBe(false))
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', activeSource: 'live' })
    expect(published).not.toContain('error')
    expect(published).not.toContain('paused')
  })

  it('publishes reconnecting while it reconnects, until the live stream plays again (K129)', async () => {
    const { controller, audio, fake } = await playing()
    expect(controller.getSnapshot().reconnecting).toBe(false)

    audio.dispatchEvent(new Event('error'))
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', reconnecting: true })
    fake.advance(RECONNECT_DELAYS_MS[0])
    await vi.waitFor(() => expect(controller.getSnapshot().loading).toBe(false))
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', reconnecting: false })
  })

  it('clears reconnecting on pause() during the wait (K129)', async () => {
    const { controller, audio } = await playing()
    audio.dispatchEvent(new Event('error'))
    controller.pause()
    expect(controller.getSnapshot()).toMatchObject({ status: 'paused', reconnecting: false })
  })

  it('reconnects on ended of the live stream', async () => {
    const { controller, audio, fake } = await playing()
    audio.dispatchEvent(new Event('ended'))
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: true })
    fake.advance(RECONNECT_DELAYS_MS[0])
    expect(media.load).toHaveBeenCalledTimes(2)
  })

  // The browser pauses an element that reaches its end before it fires ended.
  it('does not publish the pause before ended, and reconnects', async () => {
    const { controller, audio, fake } = await playing()
    Object.defineProperty(audio, 'ended', { configurable: true, value: true })
    audio.dispatchEvent(new Event('pause'))
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: false })
    audio.dispatchEvent(new Event('ended'))
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: true })
    fake.advance(RECONNECT_DELAYS_MS[0])
    expect(media.load).toHaveBeenCalledTimes(2)
  })

  it('keeps an outside pause of the live stream as a pause', async () => {
    const { controller, audio, fake } = await playing()
    audio.dispatchEvent(new Event('pause'))
    expect(controller.getSnapshot()).toMatchObject({ status: 'paused', loading: false })
    fake.advance(60_000)
    expect(media.load).toHaveBeenCalledTimes(1)
  })

  // A call or unplugged headphones pause it; the server may then drop the idle
  // connection: it must not play again on its own.
  it('does not reconnect an error after an outside pause', async () => {
    const { controller, audio, fake } = await playing()
    audio.pause()
    audio.dispatchEvent(new Event('error'))
    expect(controller.getSnapshot()).toMatchObject({ status: 'error', loading: false })
    fake.advance(60_000)
    expect(media.load).toHaveBeenCalledTimes(1)
    expect(fake.timerCount()).toBe(0)
  })

  /** Lets a failed attempt settle and schedule the next one */
  const settle = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve()
  }

  /** Cuts the live stream and makes every attempt fail, as a stream that is down */
  async function cutForGood() {
    const context = await playing()
    media.failing.add(MP3)
    context.audio.dispatchEvent(new Event('error'))
    return context
  }

  // Each failed attempt loads twice: the play() and its retry without crossOrigin
  // (ADR 0033).
  it('waits 1, 2, 4, 8, 15 and 30 s between attempts', async () => {
    const { fake } = await cutForGood()
    let loads = 1
    for (const delay of RECONNECT_DELAYS_MS) {
      fake.advance(delay - 1)
      await settle()
      expect(media.load).toHaveBeenCalledTimes(loads)
      fake.advance(1)
      await settle()
      loads += 2
      expect(media.load).toHaveBeenCalledTimes(loads)
    }
  })

  it('sets error after the sixth failed attempt, and not before', async () => {
    const { controller, fake } = await cutForGood()
    const published: { status: string; loading: boolean }[] = []
    controller.subscribe(() => {
      const { status, loading } = controller.getSnapshot()
      published.push({ status, loading })
    })
    for (const delay of RECONNECT_DELAYS_MS.slice(0, -1)) {
      fake.advance(delay)
      await settle()
      expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: true })
    }
    fake.advance(RECONNECT_DELAYS_MS[RECONNECT_DELAYS_MS.length - 1])
    await settle()
    // The same order as a failed play(): the alert opens once loading is off.
    expect(published).toEqual([
      { status: 'error', loading: true },
      { status: 'error', loading: false },
    ])
    const loads = media.load.mock.calls.length
    fake.advance(120_000)
    expect(media.load).toHaveBeenCalledTimes(loads)
  })

  it('gives reconnect-exhausted after the sixth failed attempt (ADR 0065)', async () => {
    const { controller, fake } = await cutForGood()
    for (const delay of RECONNECT_DELAYS_MS) {
      fake.advance(delay)
      await settle()
      if (controller.getSnapshot().status !== 'error') {
        expect(controller.getSnapshot().errorReason).toBeNull()
      }
    }
    expect(controller.getSnapshot()).toMatchObject({
      status: 'error',
      errorReason: { code: 'reconnect-exhausted' },
      reconnecting: false,
    })
  })

  it('reloads on play() after the attempts run out', async () => {
    const { controller, fake } = await cutForGood()
    for (const delay of RECONNECT_DELAYS_MS) {
      fake.advance(delay)
      await settle()
    }
    expect(controller.getSnapshot().status).toBe('error')
    media.failing.delete(MP3)
    await controller.play(live())
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: false })
  })

  it('restarts the count after an attempt plays', async () => {
    const { controller, audio, fake } = await cutForGood()
    fake.advance(RECONNECT_DELAYS_MS[0])
    await settle()
    media.failing.delete(MP3)
    fake.advance(RECONNECT_DELAYS_MS[1])
    await settle()
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: false })
    const loads = media.load.mock.calls.length
    audio.dispatchEvent(new Event('error'))
    fake.advance(RECONNECT_DELAYS_MS[0])
    expect(media.load).toHaveBeenCalledTimes(loads + 1)
  })

  it('counts an attempt that never plays as failed, and ignores it afterwards', async () => {
    const { controller, audio, fake } = await playing()
    media.hold = true
    audio.dispatchEvent(new Event('error'))
    fake.advance(RECONNECT_DELAYS_MS[0])
    expect(media.load).toHaveBeenCalledTimes(2)
    fake.advance(STALL_MS - 1)
    await settle()
    expect(media.load).toHaveBeenCalledTimes(2)
    fake.advance(1)
    await settle()
    fake.advance(RECONNECT_DELAYS_MS[1])
    expect(media.load).toHaveBeenCalledTimes(3)
    // The play() of the first attempt rejects late: nothing is published.
    media.fail()
    await settle()
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: true })
  })

  // An attempt runs outside the gesture, so a phone may reject its play().
  it('counts a play() rejected with NotAllowedError as a failed attempt', async () => {
    const { audio, fake } = await playing()
    media.hold = true
    audio.dispatchEvent(new Event('error'))
    fake.advance(RECONNECT_DELAYS_MS[0])
    media.fail('NotAllowedError')
    await settle()
    // No retry without crossOrigin: it is not a media error (ADR 0033).
    expect(media.load).toHaveBeenCalledTimes(2)
    fake.advance(RECONNECT_DELAYS_MS[1])
    expect(media.load).toHaveBeenCalledTimes(3)
  })

  it('counts a CORS failure through Web Audio as a failed attempt, and visualizes again once it plays', async () => {
    const { controller, audio, fake } = await playing({ webAudio: withWebAudio() })
    expect(controller.getSnapshot().canVisualize).toBe(true)
    media.corsBlocked.add(MP3)
    audio.dispatchEvent(new Event('error'))
    expect(controller.getSnapshot()).toMatchObject({ loading: true, canVisualize: false })
    fake.advance(RECONNECT_DELAYS_MS[0])
    await settle()
    // No retry without crossOrigin: the element already goes through Web Audio (ADR 0033).
    expect(media.load).toHaveBeenCalledTimes(2)
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: true })
    media.corsBlocked.delete(MP3)
    fake.advance(RECONNECT_DELAYS_MS[1])
    await settle()
    expect(media.load).toHaveBeenCalledTimes(3)
    expect(controller.getSnapshot()).toMatchObject({
      status: 'playing',
      loading: false,
      canVisualize: true,
    })
  })

  /**
   * Gives audio a currentTime the test moves, and plays for seconds, one second per tick
   * of the watch.
   */
  function withClock(audio: HTMLAudioElement, fake: ReturnType<typeof createFakeClock>) {
    let time = 0
    Object.defineProperty(audio, 'currentTime', { configurable: true, get: () => time })
    return {
      play(seconds: number) {
        for (let i = 0; i < seconds; i++) {
          time += 1
          fake.advance(1000)
        }
      },
    }
  }

  it('reconnects when currentTime stops advancing for STALL_MS (Chromium, WebKit)', async () => {
    const { controller, audio, fake } = await playing()
    const element = withClock(audio, fake)
    element.play(3)
    // Chromium marks the stall as buffering; WebKit fires nothing.
    audio.dispatchEvent(new Event('waiting'))
    fake.advance(STALL_MS - 1)
    expect(media.load).toHaveBeenCalledTimes(1)
    fake.advance(1)
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: true })
    fake.advance(RECONNECT_DELAYS_MS[0])
    expect(media.load).toHaveBeenCalledTimes(2)
  })

  it('keeps watching while currentTime advances', async () => {
    const { controller, audio, fake } = await playing()
    withClock(audio, fake).play(120)
    expect(media.load).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: false })
  })

  it('does not watch an element paused from outside', async () => {
    const { controller, audio, fake } = await playing()
    withClock(audio, fake)
    audio.pause()
    fake.advance(120_000)
    expect(media.load).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot()).toMatchObject({ status: 'paused', loading: false })
  })

  it('stops watching on pause()', async () => {
    const { controller, fake } = await playing()
    expect(fake.timerCount()).toBe(1)
    controller.pause()
    expect(fake.timerCount()).toBe(0)
  })

  it('watches again once a reconnection plays', async () => {
    const { audio, fake } = await playing()
    const element = withClock(audio, fake)
    audio.dispatchEvent(new Event('error'))
    fake.advance(RECONNECT_DELAYS_MS[0])
    element.play(3)
    fake.advance(STALL_MS)
    fake.advance(RECONNECT_DELAYS_MS[0])
    expect(media.load).toHaveBeenCalledTimes(3)
  })

  // A direct source keeps loading after its attempt runs out, and may still play.
  it('watches again after an attempt that ran out plays late', async () => {
    const { controller, audio, fake } = await playing()
    const element = withClock(audio, fake)
    media.hold = true
    audio.dispatchEvent(new Event('error'))
    fake.advance(RECONNECT_DELAYS_MS[0])
    fake.advance(STALL_MS)
    await settle()
    media.release()
    await settle()
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: false })
    element.play(3)
    fake.advance(STALL_MS)
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: true })
  })

  // hls.js and dashjs jump to the live edge and recover on their own, so the watch
  // ignores them: their fatal error counts instead.
  it.each([
    ['hls.js', HLS],
    ['dashjs', DASH],
  ])('does not watch %s', async (_, url) => {
    const hls = createFakeHls()
    const dash = createFakeDash()
    const { controller, audio, fake } = setup({
      loaders: { loadHls: hls.loadHls, loadDash: dash.loadDash },
    })
    withClock(audio, fake)
    await controller.play(live(url))
    audio.dispatchEvent(new Event('playing'))
    fake.advance(120_000)
    expect(hls.instances.length + dash.players.length).toBe(1)
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: false })
  })

  it('watches native HLS', async () => {
    const hls = createFakeHls()
    hls.setSupported(false)
    const { controller, audio, fake } = setup({ loaders: { loadHls: hls.loadHls } })
    withClock(audio, fake)
    await controller.play(live(HLS))
    fake.advance(STALL_MS)
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: true })
  })

  /** A controller whose live stream through hls.js has played */
  async function playingHls() {
    const hls = createFakeHls()
    const context = setup({ loaders: { loadHls: hls.loadHls } })
    await context.controller.play(live(HLS))
    // What the element fires once hls.js plays on MANIFEST_PARSED.
    context.audio.dispatchEvent(new Event('playing'))
    return { ...context, hls }
  }

  it('reconnects hls.js after a fatal error once it has played', async () => {
    const { controller, fake, hls } = await playingHls()
    hls.instances[0].handlers.hlsError('hlsError', { fatal: true })
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: true })
    fake.advance(RECONNECT_DELAYS_MS[0])
    await vi.waitFor(() => expect(hls.instances).toHaveLength(2))
    expect(hls.instances[0].destroy).toHaveBeenCalledTimes(1)
    expect(hls.instances[1].loadSource).toHaveBeenCalledWith(HLS)
  })

  it('reconnects dashjs after an error once it has played', async () => {
    const dash = createFakeDash()
    const { controller, audio, fake } = setup({ loaders: { loadDash: dash.loadDash } })
    await controller.play(live(DASH))
    audio.dispatchEvent(new Event('playing'))
    dash.players[0].handlers.error({ error: { code: 17 } })
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: true })
    fake.advance(RECONNECT_DELAYS_MS[0])
    await vi.waitFor(() => expect(dash.players).toHaveLength(2))
    expect(dash.players[0].reset).toHaveBeenCalledTimes(1)
  })

  it('counts a fatal error of hls.js during an attempt as failed', async () => {
    const { controller, fake, hls } = await playingHls()
    hls.instances[0].handlers.hlsError('hlsError', { fatal: true })
    fake.advance(RECONNECT_DELAYS_MS[0])
    await vi.waitFor(() => expect(hls.instances).toHaveLength(2))
    hls.instances[1].handlers.hlsError('hlsError', { fatal: true })
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: true })
    fake.advance(RECONNECT_DELAYS_MS[1])
    await vi.waitFor(() => expect(hls.instances).toHaveLength(3))
  })

  it('counts a play() of hls.js rejected during an attempt as failed', async () => {
    const { controller, fake, hls } = await playingHls()
    hls.instances[0].handlers.hlsError('hlsError', { fatal: true })
    fake.advance(RECONNECT_DELAYS_MS[0])
    await vi.waitFor(() => expect(hls.instances).toHaveLength(2))
    media.hold = true
    hls.instances[1].handlers.hlsManifestParsed('hlsManifestParsed', { fatal: false })
    media.fail('NotAllowedError')
    await vi.waitFor(() => expect(media.pending).toHaveLength(0))
    await Promise.resolve()
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: true })
    fake.advance(RECONNECT_DELAYS_MS[1])
    await vi.waitFor(() => expect(hls.instances).toHaveLength(3))
  })

  it('keeps the error of a fatal error of hls.js before it plays', async () => {
    const hls = createFakeHls()
    const { controller, fake } = setup({ loaders: { loadHls: hls.loadHls } })
    await controller.play(live(HLS))
    hls.instances[0].handlers.hlsError('hlsError', { fatal: true })
    expect(controller.getSnapshot()).toMatchObject({ status: 'error', loading: false })
    fake.advance(120_000)
    expect(hls.instances).toHaveLength(1)
  })

  it('cancels the reconnection on pause() during the wait', async () => {
    const { controller, audio, fake } = await playing()
    audio.dispatchEvent(new Event('error'))
    controller.pause()
    expect(controller.getSnapshot()).toMatchObject({ status: 'paused', loading: false })
    expect(fake.timerCount()).toBe(0)
    fake.advance(120_000)
    expect(media.load).toHaveBeenCalledTimes(1)
  })

  it('cancels the reconnection on pause() during an attempt, and ignores its outcome', async () => {
    const { controller, audio, fake } = await playing()
    media.hold = true
    audio.dispatchEvent(new Event('error'))
    fake.advance(RECONNECT_DELAYS_MS[0])
    expect(media.load).toHaveBeenCalledTimes(2)
    controller.pause()
    expect(fake.timerCount()).toBe(0)
    media.fail('AbortError')
    await settle()
    fake.advance(120_000)
    expect(media.load).toHaveBeenCalledTimes(2)
    expect(controller.getSnapshot()).toMatchObject({ status: 'paused', loading: false })
  })

  it('cancels the reconnection on play() of another stream, which loads at once', async () => {
    const { controller, audio, fake } = await playing()
    audio.dispatchEvent(new Event('error'))
    await controller.play(live(OGG))
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: false })
    // Under STALL_MS: currentTime does not move in these tests.
    fake.advance(STALL_MS - 1)
    expect(media.load.mock.calls.map(([src]) => src)).toEqual([MP3, OGG])
  })

  it('does nothing on play() of the same stream while it reconnects', async () => {
    const { controller, audio, fake } = await playing()
    audio.dispatchEvent(new Event('error'))
    await controller.play(live())
    expect(media.load).toHaveBeenCalledTimes(1)
    fake.advance(RECONNECT_DELAYS_MS[0])
    expect(media.load).toHaveBeenCalledTimes(2)
  })

  // WebKitGTK pauses the element after the error of a cut.
  it('loads at once on play() while it reconnects with the element paused', async () => {
    const { controller, audio, fake } = await playing()
    audio.dispatchEvent(new Event('error'))
    audio.pause()
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: true })
    await controller.play(live())
    expect(media.load).toHaveBeenCalledTimes(2)
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', loading: false })
    // Under STALL_MS: currentTime does not move in these tests.
    fake.advance(STALL_MS - 1)
    expect(media.load).toHaveBeenCalledTimes(2)
  })

  it('dispose() stops watching and cancels the reconnection', async () => {
    const first = await playing()
    expect(first.fake.timerCount()).toBe(1)
    first.controller.dispose()
    expect(first.fake.timerCount()).toBe(0)

    const second = await playing()
    second.audio.dispatchEvent(new Event('error'))
    second.controller.dispose()
    expect(second.fake.timerCount()).toBe(0)
  })

  it('does not reconnect a live stream that never played', async () => {
    media.failing.add(MP3)
    const { controller, fake } = setup()
    await controller.play(live())
    expect(controller.getSnapshot()).toMatchObject({ status: 'error', loading: false })
    const loads = media.load.mock.calls.length
    fake.advance(120_000)
    expect(media.load).toHaveBeenCalledTimes(loads)
  })

  it('does not reconnect after the user paused it', async () => {
    const { controller, audio, fake } = await playing()
    controller.pause()
    audio.dispatchEvent(new Event('error'))
    expect(controller.getSnapshot().status).toBe('error')
    fake.advance(120_000)
    expect(media.load).toHaveBeenCalledTimes(1)
  })

  it('does not reconnect the welcome audio, nor the live stream that fails after it', async () => {
    const { controller, audio, fake } = setup()
    await controller.play(withIntro())
    expect(controller.getSnapshot()).toMatchObject({ activeSource: 'intro', status: 'playing' })
    media.failing.add(MP3)
    audio.dispatchEvent(new Event('ended'))
    await vi.waitFor(() => expect(controller.getSnapshot().status).toBe('error'))
    const loads = media.load.mock.calls.length
    fake.advance(120_000)
    expect(media.load).toHaveBeenCalledTimes(loads)
    expect(controller.getSnapshot()).toMatchObject({ status: 'error', loading: false })
  })
})

describe('error reason (ADR 0065)', () => {
  const HTTP_MP3 = 'http://radio.test/live.mp3'

  /** Gives audio the MediaError code a browser would set */
  const mediaError = (audio: HTMLAudioElement, code: number) =>
    Object.defineProperty(audio, 'error', { configurable: true, value: { code } })

  it('starts without a reason', () => {
    expect(setup().controller.getSnapshot().errorReason).toBeNull()
  })

  it('gives not-supported when the direct stream fails after its retry without CORS', async () => {
    media.failing.add(MP3)
    const { controller } = setup()
    await controller.play(live())
    expect(controller.getSnapshot()).toMatchObject({
      status: 'error',
      errorReason: { code: 'not-supported' },
    })
  })

  it('gives unreachable with a network MediaError', async () => {
    media.failing.add(MP3)
    const { controller, audio } = setup()
    mediaError(audio, 2)
    await controller.play(live())
    expect(controller.getSnapshot().errorReason).toEqual({ code: 'unreachable' })
  })

  it('gives mixed-content for an http stream on an https page', async () => {
    media.failing.add(HTTP_MP3)
    const { controller } = setup({ pageProtocol: 'https:' })
    await controller.play(live(HTTP_MP3))
    expect(controller.getSnapshot().errorReason).toEqual({ code: 'mixed-content' })
  })

  it('gives no reason for a play() that is not allowed', async () => {
    media.hold = true
    const { controller } = setup()
    const pending = controller.play(live())
    await Promise.resolve()
    media.fail('NotAllowedError')
    await pending
    expect(controller.getSnapshot()).toMatchObject({ status: 'error', errorReason: null })
  })

  it('clears the reason when Play loads again', async () => {
    media.failing.add(MP3)
    const { controller } = setup()
    await controller.play(live())
    media.failing.delete(MP3)
    media.hold = true
    const pending = controller.play(live())
    expect(controller.getSnapshot()).toMatchObject({ loading: true, errorReason: null })
    media.release()
    await pending
    expect(controller.getSnapshot()).toMatchObject({ status: 'playing', errorReason: null })
  })

  it('gives the reason of the live stream that fails after the welcome audio', async () => {
    media.failing.add(INTRO)
    media.failing.add(MP3)
    const { controller } = setup()
    await controller.play(withIntro())
    expect(controller.getSnapshot()).toMatchObject({
      status: 'error',
      errorReason: { code: 'not-supported' },
    })
  })

  it('gives the reason of an error of the element after the live stream started', async () => {
    const hls = createFakeHls()
    const { controller, audio } = setup({ loaders: { loadHls: hls.loadHls } })
    await controller.play(live(HLS))
    mediaError(audio, 4)
    audio.dispatchEvent(new Event('error'))
    expect(controller.getSnapshot()).toMatchObject({
      status: 'error',
      errorReason: { code: 'not-supported' },
    })
  })

  it.each([
    [
      { fatal: true, type: 'networkError', response: { code: 404 } },
      { code: 'http', status: 404 },
    ],
    [{ fatal: true, type: 'networkError', response: { code: 0 } }, { code: 'unreachable' }],
    [{ fatal: true, type: 'mediaError' }, null],
  ])('gives the reason of the fatal hls.js error %j: %j', async (data, reason) => {
    const hls = createFakeHls()
    const { controller } = setup({ loaders: { loadHls: hls.loadHls } })
    await controller.play(live(HLS))
    hls.instances[0].handlers.hlsError('hlsError', data)
    expect(controller.getSnapshot()).toMatchObject({ status: 'error', errorReason: reason })
  })

  it('gives the HTTP status of a dashjs error', async () => {
    const dash = createFakeDash()
    const { controller } = setup({ loaders: { loadDash: dash.loadDash } })
    await controller.play(live(DASH))
    dash.players[0].handlers.error({ error: { code: 25, data: { response: { status: 503 } } } })
    expect(controller.getSnapshot().errorReason).toEqual({ code: 'http', status: 503 })
  })

  it('gives mixed-content for a fatal hls.js error of an http stream on an https page', async () => {
    const hls = createFakeHls()
    const { controller } = setup({ loaders: { loadHls: hls.loadHls }, pageProtocol: 'https:' })
    await controller.play(live('http://radio.test/live.m3u8'))
    hls.instances[0].handlers.hlsError('hlsError', {
      fatal: true,
      type: 'networkError',
      response: { code: 0 },
    })
    expect(controller.getSnapshot().errorReason).toEqual({ code: 'mixed-content' })
  })
})
