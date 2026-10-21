// The hls source (spec 0006, task 2.4), as in src/hooks/use-audio-player.test.tsx:
// hls.js on non-iOS when supported, native HLS through the direct source otherwise.
// K70: crossOrigin is left as it is on the hls.js path (fixed in task 2.9).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHlsSource, loadHlsModule } from 'src/core/audio/sources/hls'
import { installFakeAudio, media } from 'src/test/fake-audio'
import { createFakeHls } from 'src/test/fake-streaming'

const HLS = 'https://radio.test/live.m3u8'

let restore: () => void
beforeEach(() => {
  restore = installFakeAudio()
})
afterEach(() => restore())

const callbacks = () => ({ onError: vi.fn(), onPlayRejected: vi.fn() })

describe('createHlsSource', () => {
  it('uses hls.js on non-iOS, preferring ManagedMediaSource, without playing yet', async () => {
    const fake = createFakeHls()
    const audio = new Audio()
    await createHlsSource({ loadHls: fake.loadHls, isIOS: false }).start(audio, HLS, callbacks())
    expect(fake.instances).toHaveLength(1)
    const [hls] = fake.instances
    expect(hls.config).toEqual({ preferManagedMediaSource: true })
    expect(hls.loadSource).toHaveBeenCalledWith(HLS)
    expect(hls.attachMedia).toHaveBeenCalledWith(audio)
    expect(audio.src).toBe('')
    expect(audio.crossOrigin).toBeNull()
    expect(media.play).not.toHaveBeenCalled()
  })

  it('plays on MANIFEST_PARSED', async () => {
    const fake = createFakeHls()
    const audio = new Audio()
    const cbs = callbacks()
    await createHlsSource({ loadHls: fake.loadHls, isIOS: false }).start(audio, HLS, cbs)
    fake.instances[0].handlers.hlsManifestParsed('hlsManifestParsed', { fatal: false })
    await Promise.resolve()
    expect(media.play).toHaveBeenCalledTimes(1)
    expect(cbs.onPlayRejected).not.toHaveBeenCalled()
  })

  it('reports a rejected play() after MANIFEST_PARSED with onPlayRejected', async () => {
    const fake = createFakeHls()
    media.failing.add('')
    const audio = new Audio()
    const cbs = callbacks()
    await createHlsSource({ loadHls: fake.loadHls, isIOS: false }).start(audio, HLS, cbs)
    fake.instances[0].handlers.hlsManifestParsed('hlsManifestParsed', { fatal: false })
    await vi.waitFor(() => expect(cbs.onPlayRejected).toHaveBeenCalledTimes(1))
    expect(cbs.onPlayRejected.mock.calls[0][0]).toMatchObject({ name: 'NotSupportedError' })
    expect(cbs.onError).not.toHaveBeenCalled()
  })

  it('reports a fatal hls.js error only with onError', async () => {
    const fake = createFakeHls()
    const cbs = callbacks()
    await createHlsSource({ loadHls: fake.loadHls, isIOS: false }).start(new Audio(), HLS, cbs)
    fake.instances[0].handlers.hlsError('hlsError', { fatal: false })
    expect(cbs.onError).not.toHaveBeenCalled()
    fake.instances[0].handlers.hlsError('hlsError', { fatal: true })
    expect(cbs.onError).toHaveBeenCalledTimes(1)
  })

  it('currently keeps crossOrigin anonymous on the hls.js path after a direct source (K70)', async () => {
    const fake = createFakeHls()
    const audio = new Audio()
    audio.crossOrigin = 'anonymous'
    await createHlsSource({ loadHls: fake.loadHls, isIOS: false }).start(audio, HLS, callbacks())
    expect(fake.instances[0].attachMedia).toHaveBeenCalledWith(audio)
    expect(audio.crossOrigin).toBe('anonymous')
  })

  it('falls back to native HLS with crossOrigin when hls.js is not supported', async () => {
    const fake = createFakeHls()
    fake.setSupported(false)
    const audio = new Audio()
    await createHlsSource({ loadHls: fake.loadHls, isIOS: false }).start(audio, HLS, callbacks())
    expect(fake.instances).toHaveLength(0)
    expect(audio.src).toBe(HLS)
    expect(audio.crossOrigin).toBe('anonymous')
    expect(media.load).toHaveBeenCalledWith(HLS)
    expect(media.play).toHaveBeenCalledWith(HLS)
  })

  it('uses native HLS on iOS with crossOrigin, without loading hls.js', async () => {
    const fake = createFakeHls()
    const audio = new Audio()
    await createHlsSource({ loadHls: fake.loadHls, isIOS: true }).start(audio, HLS, callbacks())
    expect(fake.loadHls).not.toHaveBeenCalled()
    expect(audio.src).toBe(HLS)
    expect(audio.crossOrigin).toBe('anonymous')
    expect(media.play).toHaveBeenCalledWith(HLS)
  })

  it('rejects with the play() error on the native path', async () => {
    const fake = createFakeHls()
    fake.setSupported(false)
    media.failing.add(HLS)
    const source = createHlsSource({ loadHls: fake.loadHls, isIOS: false })
    await expect(source.start(new Audio(), HLS, callbacks())).rejects.toMatchObject({
      name: 'NotSupportedError',
    })
  })

  it('destroy() destroys the hls.js instance once', async () => {
    const fake = createFakeHls()
    const source = createHlsSource({ loadHls: fake.loadHls, isIOS: false })
    await source.start(new Audio(), HLS, callbacks())
    source.destroy()
    source.destroy()
    expect(fake.instances[0].destroy).toHaveBeenCalledTimes(1)
  })

  it('destroy() does nothing before start() or on the native path', async () => {
    const fake = createFakeHls()
    fake.setSupported(false)
    const source = createHlsSource({ loadHls: fake.loadHls, isIOS: false })
    source.destroy()
    await source.start(new Audio(), HLS, callbacks())
    source.destroy()
    expect(media.pause).not.toHaveBeenCalled()
  })

  it('loads the hls.js default export by default', async () => {
    const { default: Hls } = await import('hls.js')
    await expect(loadHlsModule()).resolves.toBe(Hls)
  })
})
