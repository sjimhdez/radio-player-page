/**
 * The platform the player runs on, as read from navigator.
 */
export interface Platform {
  /** navigator.userAgent */
  userAgent: string
  /** navigator.maxTouchPoints */
  maxTouchPoints: number
}

/**
 * Whether the device is iOS, for native HLS. iPadOS 13+ Safari asks for the desktop
 * site by default and reports itself as a Mac: a Mac with touch is an iPad
 * (docs/known-issues.md K13, ADR 0036).
 *
 * @param userAgent - navigator.userAgent
 * @param maxTouchPoints - navigator.maxTouchPoints
 * @returns Whether the device is an iPhone, iPad or iPod
 */
export function isIOSDevice(userAgent: string, maxTouchPoints: number): boolean {
  const ua = userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(ua) || (ua.includes('macintosh') && maxTouchPoints > 1)
}
