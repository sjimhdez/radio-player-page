import { useEffect, useState } from 'react'

export function useIsIOS() {
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase()
    const isIOSDevice = /iphone|ipad|ipod/.test(ua)
    setIsIOS(isIOSDevice)
  }, [])

  return isIOS
}
