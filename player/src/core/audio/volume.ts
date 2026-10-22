/**
 * Whether the volume of a media element can be changed, by capability: writes a
 * volume different from the current one to probe and checks that it reads back. iOS
 * ignores the write and keeps 1 (docs/known-issues.md K13, ADR 0036).
 *
 * probe must be an element of its own: its volume is changed.
 *
 * @param probe - A media element used only to probe
 * @returns Whether writing volume takes effect
 */
export function isVolumeControllable(probe: HTMLMediaElement): boolean {
  const target = probe.volume === 0.5 ? 0.25 : 0.5
  try {
    probe.volume = target
  } catch {
    return false
  }
  return probe.volume === target
}
