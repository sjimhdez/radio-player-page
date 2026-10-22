// FakeAudioContext: happy-dom has no Web Audio API. The fake records every
// context, node and connection so a test can check how the graph is built, and
// fills the analyser buffers with a known value per data type.
import { vi } from 'vitest'

export const TIME_DOMAIN_BYTE = 128
export const FREQUENCY_BYTE = 200

export class FakeAnalyserNode {
  fftSize = 2048
  get frequencyBinCount() {
    return this.fftSize / 2
  }
  connect = vi.fn()
  getByteTimeDomainData = vi.fn((array: Uint8Array) => array.fill(TIME_DOMAIN_BYTE))
  getByteFrequencyData = vi.fn((array: Uint8Array) => array.fill(FREQUENCY_BYTE))
}

export class FakeMediaElementSourceNode {
  readonly mediaElement: HTMLMediaElement
  constructor(mediaElement: HTMLMediaElement) {
    this.mediaElement = mediaElement
  }
  connect = vi.fn()
}

export class FakeAudioContext {
  state: AudioContextState = 'running'
  readonly destination = { kind: 'destination' }
  analysers: FakeAnalyserNode[] = []
  sources: FakeMediaElementSourceNode[] = []

  constructor() {
    webAudio.contexts.push(this)
  }

  resume = vi.fn(() => {
    this.state = 'running'
    return Promise.resolve()
  })

  createAnalyser = vi.fn(() => {
    const node = new FakeAnalyserNode()
    this.analysers.push(node)
    return node
  })

  createMediaElementSource = vi.fn((element: HTMLMediaElement) => {
    const node = new FakeMediaElementSourceNode(element)
    this.sources.push(node)
    return node
  })
}

export const webAudio = {
  contexts: [] as FakeAudioContext[],
}

/**
 * Installs FakeAudioContext as the global AudioContext. Returns a function that
 * removes it.
 */
export function installFakeWebAudio(): () => void {
  webAudio.contexts = []
  vi.stubGlobal('AudioContext', FakeAudioContext)
  return () => vi.unstubAllGlobals()
}
