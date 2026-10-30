// Fake text tracks for the ID3 reader of the current song: a track list and metadata
// tracks whose active cues the test sets, with the shapes measured in the browsers
// (hls.js VTTCue and the DataCue of native HLS in WebKit, both with value.key and
// value.data).
import type { MetadataCue, MetadataTrack, TrackList } from 'src/core/song/id3-cues'

/** A metadata track whose active cues the test sets */
export class FakeTrack extends EventTarget implements MetadataTrack {
  activeCues: MetadataCue[] = []
  kind: string
  mode: string

  constructor(kind: string, mode = 'disabled') {
    super()
    this.kind = kind
    this.mode = mode
  }

  /** Sets the active cues and fires cuechange */
  show(...cues: MetadataCue[]) {
    this.activeCues = cues
    this.dispatchEvent(new Event('cuechange'))
  }
}

/** A track list the test adds tracks to */
export class FakeTrackList extends EventTarget implements TrackList {
  [index: number]: FakeTrack
  length = 0

  /** Adds a track and fires addtrack */
  add(track: FakeTrack) {
    this[this.length] = track
    this.length += 1
    this.dispatchEvent(new Event('addtrack'))
    return track
  }
}

/** A cue of hls.js (VTTCue) with an ID3 frame */
export const vttCue = (key: string, data: unknown): MetadataCue => ({ value: { key, data } })

/** A cue of native HLS in WebKit (DataCue) with an ID3 frame */
export class FakeDataCue {
  value: unknown

  constructor(value: unknown) {
    this.value = value
  }
}
