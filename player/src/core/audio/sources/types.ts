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

// The library shapes below use method syntax on purpose: method parameters are
// bivariant, so the generic on() of hls.js and dashjs is assignable to them.

/**
 * The part of an hls.js instance the hls source uses.
 */
export interface HlsInstance {
  loadSource(url: string): void
  attachMedia(media: HTMLMediaElement): void
  on(event: string, listener: (event: string, data: { fatal: boolean }) => void): void
  destroy(): void
}

/**
 * The part of the hls.js default export (the Hls class) the hls source uses.
 */
export interface HlsClass {
  new (config: { preferManagedMediaSource: boolean }): HlsInstance
  isSupported: () => boolean
  Events: { MANIFEST_PARSED: string; ERROR: string }
}

/**
 * The part of a dashjs MediaPlayer instance the dash source uses.
 */
export interface DashPlayer {
  initialize(view: HTMLMediaElement, url: string, autoPlay: boolean): void
  on(type: string, listener: () => void): void
  reset(): void
}

/**
 * The part of the dashjs MediaPlayer factory the dash source uses.
 */
export type DashMediaPlayer = () => { create: () => DashPlayer }
