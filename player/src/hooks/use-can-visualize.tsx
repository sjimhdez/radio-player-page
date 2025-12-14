import { useEffect, useState } from 'react'

/**
 * Custom hook to determine if audio visualization is possible
 * Checks if the browser and audio source support Web Audio API visualization
 *
 * WebKit browsers (Safari) require same-origin audio sources for visualization
 * due to CORS restrictions with Web Audio API. Other browsers are more permissive.
 *
 * Note: If audio.src is empty or not set, startsWith() returns false,
 * which correctly results in canVisualize being false for WebKit browsers.
 *
 * @param audioRef - React ref to HTMLAudioElement (may not have src set initially)
 * @returns Boolean indicating if visualization is supported and available
 */
export function useCanVisualize(audioRef: React.RefObject<HTMLAudioElement>) {
  const [canVisualize, setCanVisualize] = useState(false)

  useEffect(() => {
    const audioEl = audioRef.current

    if (!audioEl) return

    // Detect WebKit browsers (Safari) that aren't Chrome-based
    const isWebkit =
      /AppleWebKit/.test(navigator.userAgent) &&
      !/Chrome|Chromium|Edg|OPR/.test(navigator.userAgent)
    // Check if audio source is same-origin
    // If src is empty, startsWith() returns false (correctly blocks visualization)
    const sameOrigin = audioEl.src.startsWith(window.location.origin)

    // WebKit browsers require same-origin audio for visualization due to CORS
    // Other browsers are more permissive
    setCanVisualize(!(isWebkit && !sameOrigin))
  }, [audioRef])

  return canVisualize
}
