import { joinArtistTitle } from 'src/core/song/normalize'
import type { SongStore } from 'src/core/song/song-poller'

/**
 * A cue of a metadata track: hls.js puts VTTCue and native HLS in WebKit DataCue, both
 * with value.key (the ID3 frame) and value.data, as measured in both.
 */
export type MetadataCue = object

/** The part of a TextTrack the reader uses */
export interface MetadataTrack extends EventTarget {
  kind: string
  mode: string
  activeCues: ArrayLike<MetadataCue> | null
}

/** The part of a TextTrackList the reader uses */
export interface TrackList extends EventTarget, ArrayLike<MetadataTrack> {}

/** The part of the audio element the reader uses */
export interface MediaWithTracks {
  textTracks: TrackList
}

/** A song store that reads the ID3 of the audio element it is attached to */
export interface Id3Reader extends SongStore {
  /** Listens to the metadata tracks of the element; leaves the previous one */
  attach: (media: MediaWithTracks) => void
  /** Stops listening; idempotent */
  detach: () => void
}

/** The text of an ID3 frame in the active cues, or undefined */
function frameText(cues: ArrayLike<MetadataCue>, key: string): string | undefined {
  for (const cue of Array.from(cues)) {
    const { value } = cue as { value?: { key?: unknown; data?: unknown } | null }
    if (value?.key === key && typeof value.data === 'string') return value.data
  }
  return undefined
}

/**
 * Creates the ID3 reader (ADR 0068): the song from the ID3 cues of an HLS stream,
 * TIT2 with TPE1 in front when present ("artist - title"), from the metadata text tracks
 * of the element, with hls.js or native HLS. A disabled metadata track is set to hidden
 * so that it gets cues. It makes no requests. While the live stream does not play the
 * song is null; when it plays again, the active cues are read at once. Cues without a
 * title (a lone PRIV, no cue) keep the song.
 */
export function createId3Reader(): Id3Reader {
  const listeners = new Set<() => void>()
  const watched = new Set<MetadataTrack>()
  let list: TrackList | null = null
  let song: string | null = null
  let playing = false

  const publish = (next: string | null) => {
    if (next === song) return
    song = next
    listeners.forEach((listener) => listener())
  }

  const read = (track: MetadataTrack) => {
    if (!playing || track.activeCues === null) return
    const title = frameText(track.activeCues, 'TIT2')
    const artist = frameText(track.activeCues, 'TPE1')
    if (title !== undefined || artist !== undefined) publish(joinArtistTitle(artist, title))
  }

  function onCueChange(this: MetadataTrack) {
    read(this)
  }

  const watchTracks = () => {
    if (list === null) return
    for (const track of Array.from(list)) {
      if (track.kind !== 'metadata' || watched.has(track)) continue
      if (track.mode === 'disabled') track.mode = 'hidden'
      track.addEventListener('cuechange', onCueChange)
      watched.add(track)
      read(track)
    }
  }

  const detach = () => {
    list?.removeEventListener('addtrack', watchTracks)
    list = null
    watched.forEach((track) => track.removeEventListener('cuechange', onCueChange))
    watched.clear()
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => song,
    setPlaying(value) {
      playing = value
      if (playing) watched.forEach(read)
      else publish(null)
    },
    attach(media) {
      detach()
      list = media.textTracks
      list.addEventListener('addtrack', watchTracks)
      watchTracks()
    },
    detach,
  }
}
