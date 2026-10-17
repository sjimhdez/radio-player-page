// Characterization of use-is-ios (spec 0002, task 1.16).
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIsIOS } from 'src/hooks/use-is-ios'

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  ipod: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 12_0 like Mac OS X)',
  // iPadOS 13+ Safari asks for the desktop site by default and reports itself as a Mac.
  ipadDesktop:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
  android:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36',
}

function isIOS(userAgent: string) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
  return renderHook(() => useIsIOS()).result.current
}

describe('useIsIOS', () => {
  it.each(['iphone', 'ipad', 'ipod'] as const)('detects %s', (device) => {
    expect(isIOS(UA[device])).toBe(true)
  })

  it.each(['android', 'windows'] as const)('does not detect %s', (device) => {
    expect(isIOS(UA[device])).toBe(false)
  })

  it('matches the user agent case-insensitively', () => {
    expect(isIOS('Mozilla/5.0 (IPHONE; CPU iPhone OS 18_0)')).toBe(true)
  })

  // known-issues.md K13: iPadOS with the desktop user agent is not detected.
  it('currently does not detect iPadOS that reports a desktop user agent', () => {
    vi.spyOn(navigator, 'maxTouchPoints', 'get').mockReturnValue(5)

    expect(isIOS(UA.ipadDesktop)).toBe(false)
  })

  it('returns false on the first render, before the effect runs', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(UA.iphone)
    const renders: boolean[] = []

    renderHook(() => renders.push(useIsIOS()))

    expect(renders).toEqual([false, true])
  })
})
