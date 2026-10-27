// Web Audio graph and the WebKit exception (spec 0007, task 1.5). The context is
// injected: the fake records contexts, nodes and connections (src/test/fake-web-audio).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createVisualizerGraph, isWebKitBrowser } from 'src/core/audio/web-audio'
import { FakeAudioContext, webAudio } from 'src/test/fake-web-audio'

const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0.1 Safari/605.1.15'

describe('isWebKitBrowser', () => {
  it.each([
    ['Safari on macOS', SAFARI],
    [
      'Safari on iPhone',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1',
    ],
    [
      'Safari on iPad',
      'Mozilla/5.0 (iPad; CPU OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1',
    ],
    [
      'Safari on iPod',
      'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.8 Mobile/15E148 Safari/604.1',
    ],
    [
      'Chrome on iOS (CriOS)',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1',
    ],
    [
      'Firefox on iOS (FxiOS)',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/144.0 Mobile/15E148 Safari/605.1.15',
    ],
    [
      'Edge on iOS (EdgiOS)',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/141.0.0.0 Mobile/15E148 Safari/605.1.15',
    ],
    [
      'Edge on iPad (EdgiOS)',
      'Mozilla/5.0 (iPad; CPU OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/141.0.0.0 Mobile/15E148 Safari/605.1.15',
    ],
    [
      'Edge on iPod (EdgiOS)',
      'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/141.0.0.0 Mobile/15E148 Safari/605.1.15',
    ],
    [
      'Playwright WebKit on Linux',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
    ],
  ])('treats %s as WebKit', (_name, userAgent) => {
    expect(isWebKitBrowser(userAgent)).toBe(true)
  })

  it.each([
    ['Chrome on macOS', CHROME],
    [
      'Chromium on Linux',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chromium/141.0.0.0 Safari/537.36',
    ],
    [
      'Edge on Windows',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
    ],
    [
      'Opera on Windows',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 OPR/125.0.0.0',
    ],
    [
      'Chrome on Android',
      'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
    ],
    [
      'Firefox on macOS',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:144.0) Gecko/20100101 Firefox/144.0',
    ],
    ['an empty user agent', ''],
  ])('does not treat %s as WebKit', (_name, userAgent) => {
    expect(isWebKitBrowser(userAgent)).toBe(false)
  })
})

describe('createVisualizerGraph', () => {
  const createContext = () => new FakeAudioContext() as unknown as AudioContext

  beforeEach(() => {
    webAudio.contexts = []
  })

  it('is supported with a context constructor outside WebKit', () => {
    expect(createVisualizerGraph({ createContext, userAgent: CHROME }).supported).toBe(true)
  })

  it('is not supported without a context constructor', () => {
    const graph = createVisualizerGraph({ userAgent: CHROME })

    graph.prepare()

    expect(graph.supported).toBe(false)
    expect(graph.getAnalyser()).toBeNull()
  })

  it('is not supported in WebKit and never creates the context', () => {
    const graph = createVisualizerGraph({ createContext, userAgent: SAFARI })

    graph.prepare()
    graph.connect(new Audio())

    expect(graph.supported).toBe(false)
    expect(webAudio.contexts).toHaveLength(0)
    expect(graph.isConnected()).toBe(false)
  })

  it('creates nothing until prepare()', () => {
    createVisualizerGraph({ createContext, userAgent: CHROME })

    expect(webAudio.contexts).toHaveLength(0)
  })

  it('creates the context once in prepare()', () => {
    const graph = createVisualizerGraph({ createContext, userAgent: CHROME })

    graph.prepare()
    graph.prepare()

    expect(webAudio.contexts).toHaveLength(1)
    expect(webAudio.contexts[0].resume).not.toHaveBeenCalled()
  })

  it('resumes a suspended context in prepare()', () => {
    const graph = createVisualizerGraph({ createContext, userAgent: CHROME })
    graph.prepare()
    const context = webAudio.contexts[0]
    context.state = 'suspended'

    graph.prepare()

    expect(context.resume).toHaveBeenCalledTimes(1)
    expect(webAudio.contexts).toHaveLength(1)
  })

  it('handles a rejected resume()', async () => {
    const graph = createVisualizerGraph({ createContext, userAgent: CHROME })
    graph.prepare()
    const context = webAudio.contexts[0]
    context.state = 'suspended'
    const rejected = Promise.reject(new Error('not allowed'))
    const handle = vi.spyOn(rejected, 'catch')
    context.resume.mockReturnValueOnce(rejected)

    graph.prepare()

    expect(handle).toHaveBeenCalledTimes(1)
    await expect(rejected).rejects.toThrow('not allowed')
  })

  it('keeps play going when the context cannot be created', () => {
    const graph = createVisualizerGraph({
      createContext: vi.fn(() => {
        throw new Error('no more contexts')
      }),
      userAgent: CHROME,
    })

    expect(() => graph.prepare()).not.toThrow()
    graph.connect(new Audio())
    expect(graph.isConnected()).toBe(false)
  })

  it('does not connect before prepare()', () => {
    const graph = createVisualizerGraph({ createContext, userAgent: CHROME })

    graph.connect(new Audio())

    expect(webAudio.contexts).toHaveLength(0)
    expect(graph.isConnected()).toBe(false)
    expect(graph.getAnalyser()).toBeNull()
  })

  it('connects the element through a 256-point analyser to the destination', () => {
    const graph = createVisualizerGraph({ createContext, userAgent: CHROME })
    const audio = new Audio()
    graph.prepare()

    graph.connect(audio)

    const context = webAudio.contexts[0]
    expect(context.createMediaElementSource).toHaveBeenCalledWith(audio)
    const [source] = context.sources
    const [analyser] = context.analysers
    expect(analyser.fftSize).toBe(256)
    expect(source.connect).toHaveBeenCalledWith(analyser)
    expect(analyser.connect).toHaveBeenCalledWith(context.destination)
    expect(graph.isConnected()).toBe(true)
    expect(graph.getAnalyser()).toBe(analyser)
  })

  it('creates the media element source only once', () => {
    const graph = createVisualizerGraph({ createContext, userAgent: CHROME })
    const audio = new Audio()
    graph.prepare()

    graph.connect(audio)
    graph.connect(audio)

    const context = webAudio.contexts[0]
    expect(context.createMediaElementSource).toHaveBeenCalledTimes(1)
    expect(context.createAnalyser).toHaveBeenCalledTimes(1)
  })

  it('stays unconnected when createMediaElementSource() throws', () => {
    const graph = createVisualizerGraph({ createContext, userAgent: CHROME })
    graph.prepare()
    webAudio.contexts[0].createMediaElementSource.mockImplementationOnce(() => {
      throw new Error('InvalidStateError')
    })

    expect(() => graph.connect(new Audio())).not.toThrow()
    expect(graph.isConnected()).toBe(false)
    expect(graph.getAnalyser()).toBeNull()
  })
})
