import { useEffect, useState } from 'react'

/**
 * Custom hook to detect if the device is iOS
 * Uses user agent string to identify iPhone, iPad, or iPod devices
 *
 * Used to apply iOS-specific behavior such as:
 * - Hiding volume controls (iOS uses hardware buttons)
 * - Using native HLS support instead of HLS.js
 *
 * @returns Boolean indicating if the device is iOS
 */
export function useIsIOS() {
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase()
    const isIOSDevice = /iphone|ipad|ipod/.test(ua)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- K13, spec 0007
    setIsIOS(isIOSDevice)
  }, [])

  return isIOS
}
