// Characterization of use-can-visualize (spec 0007, task 1.4). The decision is
// taken once, on mount, from the user agent and audio.src (K82).
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCanVisualize } from 'src/hooks/use-can-visualize'

const UA = {
  safari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  chrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  firefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:131.0) Gecko/20100101 Firefox/131.0',
}

const CROSS_ORIGIN = 'https://stream.example.com/live.mp3'

function mount(userAgent: string, src = '') {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
  const audio = document.createElement('audio')
  if (src) audio.src = src
  const audioRef = { current: audio }
  const hook = renderHook(() => useCanVisualize(audioRef))
  return { audio, hook }
}

describe('useCanVisualize', () => {
  // K82: the player mounts with an empty src, so WebKit never visualizes.
  it.each(['safari', 'iphone'] as const)(
    'currently returns false on %s with an empty src',
    (ua) => {
      expect(mount(UA[ua]).hook.result.current).toBe(false)
    },
  )

  it.each(['chrome', 'edge', 'firefox'] as const)(
    'currently returns true on %s with an empty src',
    (ua) => {
      expect(mount(UA[ua]).hook.result.current).toBe(true)
    },
  )

  it('returns false on WebKit with a cross-origin src', () => {
    expect(mount(UA.safari, CROSS_ORIGIN).hook.result.current).toBe(false)
  })

  it('returns true on WebKit with a same-origin src', () => {
    const src = `${window.location.origin}/live.mp3`
    expect(mount(UA.safari, src).hook.result.current).toBe(true)
  })

  // K82: the source loaded later (same origin) never reaches the decision.
  it('currently keeps false on WebKit after a same-origin source loads', () => {
    const { audio, hook } = mount(UA.safari)
    audio.src = `${window.location.origin}/live.mp3`
    hook.rerender()
    expect(hook.result.current).toBe(false)
  })

  // K82: nor does a cross-origin one, or a source without CORS.
  it('currently keeps true on Chrome after a cross-origin source loads', () => {
    const { audio, hook } = mount(UA.chrome)
    audio.src = CROSS_ORIGIN
    hook.rerender()
    expect(hook.result.current).toBe(true)
  })

  it('returns false without an audio element', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(UA.chrome)
    // The signature takes RefObject<HTMLAudioElement>, but the ref is empty before mount.
    const audioRef = { current: null } as unknown as React.RefObject<HTMLAudioElement>
    expect(renderHook(() => useCanVisualize(audioRef)).result.current).toBe(false)
  })
})
