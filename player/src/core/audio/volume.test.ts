// Whether the volume can be changed, decided by capability (K13, ADR 0036).
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isVolumeControllable } from 'src/core/audio/volume'
import { installFakeAudio, media } from 'src/test/fake-audio'

let restore: () => void
beforeEach(() => {
  restore = installFakeAudio()
})
afterEach(() => restore())

describe('isVolumeControllable', () => {
  it('is true when the element applies a volume write', () => {
    expect(isVolumeControllable(new Audio())).toBe(true)
  })

  it('is true whatever volume the probe starts at', () => {
    const probe = new Audio()
    probe.volume = 0.5
    expect(isVolumeControllable(probe)).toBe(true)
  })

  it('is false when the element ignores volume writes, as on iOS (K13)', () => {
    media.readOnlyVolume = true
    expect(isVolumeControllable(new Audio())).toBe(false)
  })

  // The probe alone cannot tell iOS 18, which reads the write back at once and
  // undoes it later; the controller also asks isIOSDevice() (K108, ADR 0056).
  it('is true when the element undoes the write later, as iOS 18 (K108)', async () => {
    media.revertingVolume = true
    const probe = new Audio()
    expect(isVolumeControllable(probe)).toBe(true)
    await new Promise((resolve) => setTimeout(resolve))
    expect(probe.volume).toBe(1)
  })

  it('is false when writing volume throws', () => {
    const probe = new Audio()
    Object.defineProperty(probe, 'volume', {
      get: () => 1,
      set: () => {
        throw new DOMException('fail', 'NotSupportedError')
      },
    })
    expect(isVolumeControllable(probe)).toBe(false)
  })

  it('only writes to the probe', () => {
    const player = new Audio()
    player.volume = 0.7
    isVolumeControllable(new Audio())
    expect(player.volume).toBe(0.7)
  })
})
