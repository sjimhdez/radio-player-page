// Characterization of use-media-session (spec 0002, task 1.16).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import 'src/config/i18n'
import useMediaSession from 'src/hooks/use-media-session'
import type { PlayerStatus } from 'src/types/player'

type Handler = (() => void) | null

class FakeMediaMetadata {
  init: MediaMetadataInit
  constructor(init: MediaMetadataInit) {
    this.init = init
  }
}

function installMediaSession() {
  const session = {
    metadata: null as FakeMediaMetadata | null,
    playbackState: 'none' as MediaSessionPlaybackState,
    handlers: {} as Record<string, Handler>,
    setActionHandler: vi.fn((action: string, handler: Handler) => {
      session.handlers[action] = handler
    }),
  }
  Object.defineProperty(navigator, 'mediaSession', { value: session, configurable: true })
  vi.stubGlobal('MediaMetadata', FakeMediaMetadata)
  return session
}

let session: ReturnType<typeof installMediaSession>
const onPlay = () => {}
const onPause = () => {}

function mount(title: string, logoUrl: string, status: PlayerStatus = 'idle') {
  return renderHook(
    (props: { title: string; logoUrl: string; status: PlayerStatus }) =>
      useMediaSession(props.title, props.logoUrl, onPlay, onPause, props.status),
    { initialProps: { title, logoUrl, status } },
  )
}

function metadata() {
  return session.metadata!.init
}

beforeEach(() => {
  session = installMediaSession()
})

afterEach(() => {
  delete (navigator as { mediaSession?: unknown }).mediaSession
  vi.unstubAllGlobals()
})

describe('useMediaSession', () => {
  it('sets the title and six artwork sizes from the logo', () => {
    mount('Radio Test', 'https://site.test/logo.webp')

    expect(metadata().title).toBe('Radio Test')
    expect(metadata().artwork).toEqual(
      ['96x96', '128x128', '192x192', '256x256', '384x384', '512x512'].map((sizes) => ({
        src: 'https://site.test/logo.webp',
        sizes,
        type: 'image/webp',
      })),
    )
  })

  it.each([
    ['logo.png', 'image/png'],
    ['logo.JPG', 'image/jpeg'],
    ['logo.jpeg', 'image/jpeg'],
    ['logo.gif', 'image/gif'],
    ['logo.svg', 'image/svg+xml'],
    ['logo.bmp', 'image/png'],
  ])('detects the type of %s as %s', (file, type) => {
    mount('Radio Test', `https://site.test/${file}`)

    expect(metadata().artwork![0].type).toBe(type)
  })

  // known-issues.md K14: the query and the hash are not part of the extension.
  it.each([
    ['https://site.test/logo.jpg?ver=2', 'image/jpeg'],
    ['https://cdn.test/logo.webp#x', 'image/webp'],
  ])('ignores the query and the hash of %s', (url, type) => {
    mount('Radio Test', url)

    expect(metadata().artwork![0].type).toBe(type)
  })

  it('sends no artwork without a logo', () => {
    mount('Radio Test', '')

    expect(metadata().artwork).toEqual([])
  })

  it('uses the translated "Live Radio" without a title', () => {
    mount('', '')

    expect(metadata().title).toBe('Live Radio')
  })

  it('registers play and pause and disables seeking and tracks', () => {
    mount('Radio Test', '')

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
  ] as const)('maps the status %s to playbackState %s', (status, playbackState) => {
    mount('Radio Test', '', status)

    expect(session.playbackState).toBe(playbackState)
  })

  it('follows status changes', () => {
    const view = mount('Radio Test', '', 'idle')

    view.rerender({ title: 'Radio Test', logoUrl: '', status: 'playing' })

    expect(session.playbackState).toBe('playing')
  })

  it('clears metadata and play/pause on unmount but leaves playbackState', () => {
    const view = mount('Radio Test', '', 'playing')

    view.unmount()

    expect(session.metadata).toBeNull()
    expect(session.handlers.play).toBeNull()
    expect(session.handlers.pause).toBeNull()
    expect(session.playbackState).toBe('playing')
  })

  it('warns instead of throwing when the API fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    session.setActionHandler.mockImplementation(() => {
      throw new Error('unsupported')
    })

    expect(() => mount('Radio Test', '').unmount()).not.toThrow()
    expect(warn).toHaveBeenCalledWith('Media Session API error:', expect.any(Error))
    expect(warn).toHaveBeenCalledWith('Media Session API cleanup error:', expect.any(Error))
  })

  it('does nothing without navigator.mediaSession', () => {
    delete (navigator as { mediaSession?: unknown }).mediaSession
    const MediaMetadata = vi.fn()
    vi.stubGlobal('MediaMetadata', MediaMetadata)

    expect(() => mount('Radio Test', '').unmount()).not.toThrow()
    expect(MediaMetadata).not.toHaveBeenCalled()
  })
})
