// Fakes of hls.js and dashjs for the core sources. The sources
// receive their loaders as parameters, so no vi.mock is needed: each test creates its
// own fake and passes its loader.
import { vi } from 'vitest'
import type {
  DashErrorEvent,
  DashMediaPlayer,
  HlsClass,
  HlsEventData,
} from 'src/core/audio/sources/types'

type HlsHandler = (event: string, data: HlsEventData) => void

/** An instance of the fake Hls class, with what it was given and its handlers */
export interface FakeHlsInstance {
  config: unknown
  handlers: Record<string, HlsHandler>
  loadSource: ReturnType<typeof vi.fn<(url: string) => void>>
  attachMedia: ReturnType<typeof vi.fn<(media: HTMLMediaElement) => void>>
  destroy: ReturnType<typeof vi.fn<() => void>>
}

/** A fake Hls class that records its instances, its loader and a switch for isSupported() */
export function createFakeHls() {
  const state = { supported: true, instances: [] as FakeHlsInstance[] }

  class FakeHls implements FakeHlsInstance {
    static Events = { MANIFEST_PARSED: 'hlsManifestParsed', ERROR: 'hlsError' } as const
    static isSupported = vi.fn(() => state.supported)
    config: unknown
    handlers: Record<string, HlsHandler> = {}
    loadSource = vi.fn<(url: string) => void>()
    attachMedia = vi.fn<(media: HTMLMediaElement) => void>()
    destroy = vi.fn<() => void>()
    on(event: string, handler: HlsHandler) {
      this.handlers[event] = handler
    }
    constructor(config?: unknown) {
      this.config = config
      state.instances.push(this)
    }
  }

  return {
    Hls: FakeHls,
    instances: state.instances,
    setSupported: (value: boolean) => {
      state.supported = value
    },
    loadHls: vi.fn(async (): Promise<HlsClass> => FakeHls),
  }
}

/** A player of the fake dashjs factory, with its handlers */
export interface FakeDashPlayer {
  handlers: Record<string, (event: DashErrorEvent) => void>
  initialize: ReturnType<
    typeof vi.fn<(view: HTMLMediaElement, url: string, autoPlay: boolean) => void>
  >
  clearDefaultUTCTimingSources: ReturnType<typeof vi.fn<() => void>>
  reset: ReturnType<typeof vi.fn<() => void>>
}

/** A fake dashjs MediaPlayer factory that records its players, and its loader */
export function createFakeDash() {
  const players: FakeDashPlayer[] = []
  const MediaPlayer: DashMediaPlayer = () => ({
    create: () => {
      const player = {
        handlers: {} as Record<string, (event: DashErrorEvent) => void>,
        initialize: vi.fn<(view: HTMLMediaElement, url: string, autoPlay: boolean) => void>(),
        clearDefaultUTCTimingSources: vi.fn<() => void>(),
        reset: vi.fn<() => void>(),
        on(event: string, handler: (event: DashErrorEvent) => void) {
          player.handlers[event] = handler
        },
      }
      players.push(player)
      return player
    },
  })
  return { players, loadDash: vi.fn(async () => MediaPlayer) }
}
