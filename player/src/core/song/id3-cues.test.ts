// The song from the ID3 cues of an HLS stream, read from the metadata text tracks of
// the element, by value.key and value.data, whatever the cue constructor (ADR 0068).
import { describe, expect, it, vi } from 'vitest'
import { createId3Reader } from 'src/core/song/id3-cues'
import { FakeDataCue, FakeTrack, FakeTrackList, vttCue } from 'src/test/fake-text-tracks'

function setup() {
  const textTracks = new FakeTrackList()
  const reader = createId3Reader()
  const listener = vi.fn()
  reader.subscribe(listener)
  reader.attach({ textTracks })
  reader.setPlaying(true)
  return { textTracks, reader, listener }
}

describe('createId3Reader', () => {
  it('reads TIT2 from the cues of a metadata track added by hls.js', () => {
    const { textTracks, reader, listener } = setup()
    const track = textTracks.add(new FakeTrack('metadata'))
    track.show(vttCue('TIT2', 'Konchiva Kanmani'))
    expect(reader.getSnapshot()).toBe('Konchiva Kanmani')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('joins TPE1 and TIT2 with a hyphen (ADR 0068 §10)', () => {
    const { textTracks, reader } = setup()
    textTracks
      .add(new FakeTrack('metadata'))
      .show(vttCue('PRIV', new Uint8Array(8)), vttCue('TPE1', 'Artist'), vttCue('TIT2', 'Title'))
    expect(reader.getSnapshot()).toBe('Artist - Title')
  })

  it('reads the DataCue of native HLS the same way', () => {
    const { textTracks, reader } = setup()
    textTracks
      .add(new FakeTrack('metadata'))
      .show(
        new FakeDataCue({ key: 'TPE1', data: 'A' }),
        new FakeDataCue({ key: 'TIT2', data: 'B' }),
      )
    expect(reader.getSnapshot()).toBe('A - B')
  })

  it('shows the hidden cues of a disabled metadata track, and leaves other kinds alone', () => {
    const { textTracks } = setup()
    const metadata = textTracks.add(new FakeTrack('metadata', 'disabled'))
    const showing = textTracks.add(new FakeTrack('metadata', 'showing'))
    const captions = textTracks.add(new FakeTrack('captions', 'disabled'))
    expect(metadata.mode).toBe('hidden')
    expect(showing.mode).toBe('showing')
    expect(captions.mode).toBe('disabled')
  })

  it('ignores the cues of tracks that are not metadata', () => {
    const { textTracks, reader } = setup()
    textTracks.add(new FakeTrack('captions')).show(vttCue('TIT2', 'No'))
    expect(reader.getSnapshot()).toBeNull()
  })

  it('reads the tracks the element already has when attached', () => {
    const textTracks = new FakeTrackList()
    const track = textTracks.add(new FakeTrack('metadata'))
    track.activeCues = [vttCue('TIT2', 'Already')]
    const reader = createId3Reader()
    reader.subscribe(() => {})
    reader.attach({ textTracks })
    reader.setPlaying(true)
    expect(reader.getSnapshot()).toBe('Already')
  })

  it('keeps the song when the cues change without a title (a lone PRIV, no cue)', () => {
    const { textTracks, reader } = setup()
    const track = textTracks.add(new FakeTrack('metadata'))
    track.show(vttCue('TIT2', 'A'))
    track.show(vttCue('PRIV', new Uint8Array(8)))
    track.show()
    expect(reader.getSnapshot()).toBe('A')
  })

  it('ignores frames whose data is not text, and normalizes the text', () => {
    const { textTracks, reader } = setup()
    const track = textTracks.add(new FakeTrack('metadata'))
    track.show(vttCue('TIT2', new Uint8Array(2)), { value: null }, {})
    expect(reader.getSnapshot()).toBeNull()
    track.show(vttCue('TIT2', '  Two   spaces '))
    expect(reader.getSnapshot()).toBe('Two spaces')
  })

  it('clears the song and ignores the cues while the stream does not play', () => {
    const { textTracks, reader } = setup()
    const track = textTracks.add(new FakeTrack('metadata'))
    track.show(vttCue('TIT2', 'A'))
    reader.setPlaying(false)
    expect(reader.getSnapshot()).toBeNull()
    track.show(vttCue('TIT2', 'B'))
    expect(reader.getSnapshot()).toBeNull()
    reader.setPlaying(true)
    expect(reader.getSnapshot()).toBe('B')
  })

  it('stops listening when detached', () => {
    const { textTracks, reader } = setup()
    const track = textTracks.add(new FakeTrack('metadata'))
    reader.detach()
    track.show(vttCue('TIT2', 'A'))
    textTracks.add(new FakeTrack('metadata')).show(vttCue('TIT2', 'B'))
    expect(reader.getSnapshot()).toBeNull()
  })

  it('attaching again leaves the previous element', () => {
    const { textTracks, reader } = setup()
    const old = textTracks.add(new FakeTrack('metadata'))
    const other = new FakeTrackList()
    reader.attach({ textTracks: other })
    old.show(vttCue('TIT2', 'Old'))
    expect(reader.getSnapshot()).toBeNull()
    other.add(new FakeTrack('metadata')).show(vttCue('TIT2', 'New'))
    expect(reader.getSnapshot()).toBe('New')
  })

  it('stops notifying an unsubscribed listener', () => {
    const { textTracks, reader } = setup()
    const other = vi.fn()
    reader.subscribe(other)()
    textTracks.add(new FakeTrack('metadata')).show(vttCue('TIT2', 'A'))
    expect(other).not.toHaveBeenCalled()
  })
})
