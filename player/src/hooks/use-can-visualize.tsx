import { useEffect, useState } from 'react'

export function useCanVisualize(audioRef: React.RefObject<HTMLAudioElement>) {
  const [canVisualize, setCanVisualize] = useState(false)

  useEffect(() => {
    const audioEl = audioRef.current

    if (!audioEl) return

    const isWebkit =
      /AppleWebKit/.test(navigator.userAgent) &&
      !/Chrome|Chromium|Edg|OPR/.test(navigator.userAgent)
    const sameOrigin = audioEl.src.startsWith(window.location.origin)

    setCanVisualize(!(isWebkit && !sameOrigin))
  }, [audioRef])

  return canVisualize
}
