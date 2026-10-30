// applyMediaSession, mimeTypeFor and artworkFor. The cases mirror
// src/hooks/use-media-session.test.ts with a fake MediaSession injected.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyMediaSession,
  artworkFor,
  mimeTypeFor,
  type MediaSessionDeps,
  type MediaSessionState,
} from 'src/core/media-session/media-session'
import type { PlayerStatus } from 'src/types/player'

type Handler = MediaSessionActionHandler | null

function createFakeSession() {
  const session = {
    metadata: null as MediaMetadata | null,
    playbackState: 'none' as MediaSessionPlaybackState,
    handlers: {} as Record<string, Handler>,
    setActionHandler: vi.fn((action: MediaSessionAction, handler: Handler) => {
      session.handlers[action] = handler
    }),
  }
  return session
}

let session: ReturnType<typeof createFakeSession>
let deps: MediaSessionDeps
const onPlay = () => {}
const onPause = () => {}

function apply(overrides: Partial<MediaSessionState> = {}) {
  return applyMediaSession(deps, {
    title: 'Radio Test',
    logoUrl: '',
    onPlay,
    onPause,
    status: 'idle',
    ...overrides,
  })
}

function metadata() {
  return session.metadata as unknown as MediaMetadataInit
}

beforeEach(() => {
  session = createFakeSession()
  deps = { session, createMetadata: (init) => init as unknown as MediaMetadata }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('mimeTypeFor', () => {
  it.each([
    ['logo.png', 'image/png'],
    ['logo.JPG', 'image/jpeg'],
    ['logo.jpeg', 'image/jpeg'],
    ['logo.gif', 'image/gif'],
    ['logo.webp', 'image/webp'],
    ['logo.svg', 'image/svg+xml'],
    ['logo.bmp', 'image/png'],
    ['logo', 'image/png'],
  ])('detects the type of %s as %s', (file, type) => {
    expect(mimeTypeFor(`https://site.test/${file}`)).toBe(type)
  })

  // The query and the hash are not part of the extension (K14).
  it.each([
    ['https://site.test/logo.jpg?ver=2', 'image/jpeg'],
    ['https://cdn.test/logo.webp#x', 'image/webp'],
  ])('ignores the query and the hash of %s', (url, type) => {
    expect(mimeTypeFor(url)).toBe(type)
  })
})

describe('artworkFor', () => {
  it('lists six sizes of the logo with its type', () => {
    expect(artworkFor('https://site.test/logo.webp')).toEqual(
      ['96x96', '128x128', '192x192', '256x256', '384x384', '512x512'].map((sizes) => ({
        src: 'https://site.test/logo.webp',
        sizes,
        type: 'image/webp',
      })),
    )
  })
})

describe('applyMediaSession', () => {
  it('sets the title and the artwork of the logo', () => {
    apply({ logoUrl: 'https://site.test/logo.png' })

    expect(metadata()).toEqual({
      title: 'Radio Test',
      artwork: artworkFor('https://site.test/logo.png'),
    })
  })

  it('sends no artwork without a logo', () => {
    apply({ logoUrl: '' })

    expect(metadata().artwork).toEqual([])
  })

  it('uses the title it receives, already translated', () => {
    apply({ title: 'Radio en directo' })

    expect(metadata().title).toBe('Radio en directo')
  })

  it('registers play and pause and disables seeking and tracks', () => {
    apply()

    expect(session.handlers).toEqual({
      play: onPlay,
      pause: onPause,
      seekbackward: null,
      seekforward: null,
      seekto: null,
      previoustrack: null,
      nexttrack: null,
    })
  })

  it.each([
    ['playing', 'playing'],
    ['idle', 'paused'],
    ['paused', 'paused'],
    ['error', 'paused'],
  ] as const)('maps the status %s to playbackState %s', (status: PlayerStatus, playbackState) => {
    apply({ status })

    expect(session.playbackState).toBe(playbackState)
  })

  it('clears metadata and play/pause on cleanup but leaves playbackState', () => {
    const cleanup = apply({ status: 'playing' })

    cleanup()

    expect(session.metadata).toBeNull()
    expect(session.handlers.play).toBeNull()
    expect(session.handlers.pause).toBeNull()
    expect(session.handlers.seekto).toBeNull()
    expect(session.playbackState).toBe('playing')
  })

  it('warns instead of throwing when the API fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    session.setActionHandler.mockImplementation(() => {
      throw new Error('unsupported')
    })

    expect(() => apply()()).not.toThrow()
    expect(warn).toHaveBeenCalledWith('Media Session API error:', expect.any(Error))
    expect(warn).toHaveBeenCalledWith('Media Session API cleanup error:', expect.any(Error))
  })

  it('warns when the metadata cannot be created', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    deps.createMetadata = () => {
      throw new TypeError('bad artwork')
    }

    expect(() => apply()).not.toThrow()
    expect(warn).toHaveBeenCalledWith('Media Session API error:', expect.any(TypeError))
    expect(session.setActionHandler).not.toHaveBeenCalled()
  })
})
