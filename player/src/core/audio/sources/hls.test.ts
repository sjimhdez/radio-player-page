// The hls source, as in src/hooks/use-audio-player.test.tsx: hls.js on non-iOS when
// supported, native HLS through the direct source otherwise. The hls.js path leaves
// crossOrigin unset (K70, ADR 0004).
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

  // A network error carries the HTTP status, or 0 without CORS or a server (ADR 0065).
  it.each([
    [{ fatal: true, type: 'networkError', response: { code: 404 } }, { status: 404 }],
    [{ fatal: true, type: 'networkError', response: { code: 0 } }, { status: 0 }],
    [{ fatal: true, type: 'networkError' }, { status: 0 }],
    [{ fatal: true, type: 'mediaError' }, {}],
  ])('reports %j with %j (ADR 0065)', async (data, failure) => {
    const fake = createFakeHls()
    const cbs = callbacks()
    await createHlsSource({ loadHls: fake.loadHls, isIOS: false }).start(new Audio(), HLS, cbs)
    fake.instances[0].handlers.hlsError('hlsError', data)
    expect(cbs.onError).toHaveBeenCalledWith(failure)
  })

  it('clears crossOrigin on the hls.js path after a direct source (K70)', async () => {
    const fake = createFakeHls()
    const audio = new Audio()
    audio.crossOrigin = 'anonymous'
    await createHlsSource({ loadHls: fake.loadHls, isIOS: false }).start(audio, HLS, callbacks())
    expect(fake.instances[0].attachMedia).toHaveBeenCalledWith(audio)
    expect(audio.crossOrigin).toBeNull()
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

  // A pause during the load (K11, ADR 0034): the fake keeps its handlers after
  // destroy(), so the source must ignore them.
  it('ignores MANIFEST_PARSED and errors after destroy()', async () => {
    const fake = createFakeHls()
    const cbs = callbacks()
    const source = createHlsSource({ loadHls: fake.loadHls, isIOS: false })
    await source.start(new Audio(), HLS, cbs)
    source.destroy()
    fake.instances[0].handlers.hlsManifestParsed('hlsManifestParsed', { fatal: false })
    fake.instances[0].handlers.hlsError('hlsError', { fatal: true })
    await Promise.resolve()
    expect(media.play).not.toHaveBeenCalled()
    expect(cbs.onError).not.toHaveBeenCalled()
  })

  it('creates no hls.js when destroyed while hls.js loads', async () => {
    const fake = createFakeHls()
    const source = createHlsSource({ loadHls: fake.loadHls, isIOS: false })
    const started = source.start(new Audio(), HLS, callbacks())
    source.destroy()
    await started
    expect(fake.instances).toHaveLength(0)
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

  // The controller watches the progress of sources without MSE (ADR 0061).
  it('uses Media Source on the hls.js path only', async () => {
    const fake = createFakeHls()
    const source = createHlsSource({ loadHls: fake.loadHls, isIOS: false })
    await source.start(new Audio(), HLS, callbacks())
    expect(source.usesMediaSource()).toBe(true)
    fake.setSupported(false)
    await source.start(new Audio(), HLS, callbacks())
    expect(source.usesMediaSource()).toBe(false)
    const native = createHlsSource({ loadHls: fake.loadHls, isIOS: true })
    await native.start(new Audio(), HLS, callbacks())
    expect(native.usesMediaSource()).toBe(false)
  })

  // MSE sources never retry without crossOrigin, so they stay clean (ADR 0033).
  it('is CORS clean on the hls.js path', async () => {
    const fake = createFakeHls()
    const source = createHlsSource({ loadHls: fake.loadHls, isIOS: false, retryWithoutCors: true })
    await source.start(new Audio(), HLS, callbacks())
    expect(source.isCorsClean()).toBe(true)
  })

  it('does not retry a rejected play() on the hls.js path (C1)', async () => {
    const fake = createFakeHls()
    media.failing.add('')
    const cbs = callbacks()
    const source = createHlsSource({ loadHls: fake.loadHls, isIOS: false, retryWithoutCors: true })
    await source.start(new Audio(), HLS, cbs)
    fake.instances[0].handlers.hlsManifestParsed('hlsManifestParsed', { fatal: false })
    await vi.waitFor(() => expect(cbs.onPlayRejected).toHaveBeenCalledTimes(1))
    expect(media.play).toHaveBeenCalledTimes(1)
    expect(source.isCorsClean()).toBe(true)
  })

  it('retries native HLS without crossOrigin and reports it (C1)', async () => {
    media.corsBlocked.add(HLS)
    const audio = new Audio()
    const source = createHlsSource({ isIOS: true, retryWithoutCors: true })
    await source.start(audio, HLS, callbacks())
    expect(media.play).toHaveBeenCalledTimes(2)
    expect(audio.hasAttribute('crossorigin')).toBe(false)
    expect(source.isCorsClean()).toBe(false)
  })
})
