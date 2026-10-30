import { useEffect, useMemo, useSyncExternalStore, type RefObject } from 'react'
import { createCurrentSong } from 'src/core/song/current-song'
import type { Visibility } from 'src/core/song/song-poller'

/** Whether the document is visible, and its visibilitychange */
const documentVisibility: Visibility = {
  isVisible: () => document.visibilityState === 'visible',
  subscribe(listener) {
    document.addEventListener('visibilitychange', listener)
    return () => document.removeEventListener('visibilitychange', listener)
  },
}

const subscribeToNothing = () => () => {}
const noSong = () => null

/**
 * The current song of the stream, or null (ADR 0068).
 *
 * Adapter of src/core/song/: with showSong, creates the source of the song for the stream
 * (status-json.xsl and then ICY for direct audio, the ID3 cues of the element for HLS,
 * none for DASH), with window.fetch, the visibility of the document and the protocol of
 * the page, attaches it to the audio element and tells it whether the live stream plays.
 * It asks the server only while the stream plays and the page is visible.
 *
 * @param showSong - Whether the station shows the current song (RADPLAPAG_CONFIG.showSong)
 * @param isPlaying - Whether the live stream plays (not the welcome audio)
 * @param audioRef - The audio element, for the ID3 cues of HLS
 */
function useCurrentSong(
  streamUrl: string,
  showSong: boolean,
  isPlaying: boolean,
  audioRef: RefObject<HTMLAudioElement>,
): string | null {
  const source = useMemo(
    () =>
      showSong
        ? createCurrentSong({
            streamUrl,
            fetch: (url, init) => window.fetch(url, init),
            visibility: documentVisibility,
            pageProtocol: window.location.protocol,
          })
        : null,
    [streamUrl, showSong],
  )

  const song = useSyncExternalStore(
    source?.subscribe ?? subscribeToNothing,
    source?.getSnapshot ?? noSong,
  )

  useEffect(() => {
    const audio = audioRef.current
    if (source === null || !audio) return
    source.attach(audio)
    return () => source.detach()
  }, [source, audioRef])

  useEffect(() => {
    source?.setPlaying(isPlaying)
  }, [source, isPlaying])

  return song
}

export default useCurrentSong
