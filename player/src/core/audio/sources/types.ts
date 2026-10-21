/**
 * What a source reports after start() has resolved.
 */
export interface SourceCallbacks {
  /** A fatal error of the streaming library (hls.js ERROR with fatal, dashjs error). */
  onError: () => void
  /** A play() the source starts on its own (hls.js MANIFEST_PARSED) was rejected. */
  onPlayRejected: (error: unknown) => void
}

/**
 * One way of loading a stream into the audio element: direct, hls or dash.
 */
export interface AudioSource {
  /**
   * Loads url into audio and starts playback. Rejects if the play() it awaits rejects;
   * later failures go through callbacks.
   */
  start: (audio: HTMLAudioElement, url: string, callbacks: SourceCallbacks) => Promise<void>
  /** Releases what start() created. Does not touch the audio element. */
  destroy: () => void
}
