// iOS detection for native HLS (spec 0007, K13, ADR 0036). The cases come from the
// characterization of the removed useIsIOS() (spec 0002, task 1.16).
import { describe, expect, it } from 'vitest'
import { isIOSDevice } from 'src/core/audio/platform'

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  ipod: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 12_0 like Mac OS X)',
  // iPadOS 13+ Safari asks for the desktop site by default and reports itself as a Mac.
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
  android:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36',
}

describe('isIOSDevice', () => {
  it.each(['iphone', 'ipad', 'ipod'] as const)('detects %s', (device) => {
    expect(isIOSDevice(UA[device], 5)).toBe(true)
  })

  it.each(['android', 'windows'] as const)('does not detect %s', (device) => {
    expect(isIOSDevice(UA[device], 5)).toBe(false)
  })

  it('matches the user agent case-insensitively', () => {
    expect(isIOSDevice('Mozilla/5.0 (IPHONE; CPU iPhone OS 18_0)', 0)).toBe(true)
  })

  it('detects iPadOS that reports a desktop user agent (K13)', () => {
    expect(isIOSDevice(UA.mac, 5)).toBe(true)
  })

  it.each([0, 1])('does not detect a Mac with %i touch points', (maxTouchPoints) => {
    expect(isIOSDevice(UA.mac, maxTouchPoints)).toBe(false)
  })
})
