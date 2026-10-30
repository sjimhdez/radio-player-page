/** What a fatal error of hls.js or dashjs tells about the failure (ADR 0065) */
export interface SourceFailure {
  /** The HTTP status of a network error; 0 without a response (no CORS, server down) */
  status?: number
}

/** What a source reports after start() has resolved */
export interface SourceCallbacks {
  /** A fatal error of the streaming library (hls.js ERROR with fatal, dashjs error) */
  onError: (failure: SourceFailure) => void
  /** A play() the source starts on its own (hls.js MANIFEST_PARSED) was rejected */
  onPlayRejected: (error: unknown) => void
}

/** One way of loading a stream into the audio element: direct, hls or dash */
export interface AudioSource {
  /**
   * Loads url into audio and starts playback. Rejects if the play() it awaits rejects;
   * later failures go through callbacks.
   */
  start: (audio: HTMLAudioElement, url: string, callbacks: SourceCallbacks) => Promise<void>
  /**
   * The audio of the last start() can go through Web Audio: false after the retry
   * without crossOrigin of a direct source (ADR 0033).
   */
  isCorsClean: () => boolean
  /**
   * The audio of the last start() goes through Media Source (hls.js, dashjs): the
   * controller does not watch its progress (ADR 0061).
   */
  usesMediaSource: () => boolean
  /** Releases what start() created, without touching the audio element */
  destroy: () => void
}

// The library shapes below use method syntax on purpose: method parameters are
// bivariant, so the generic on() of hls.js and dashjs is assignable to them.

/**
 * The part of the data of an hls.js event the hls source reads: type and response only
 * in ERROR (ADR 0065).
 */
export interface HlsEventData {
  fatal: boolean
  type?: string
  response?: { code?: number }
}

/** The part of an hls.js instance the hls source uses */
export interface HlsInstance {
  loadSource(url: string): void
  attachMedia(media: HTMLMediaElement): void
  on(event: string, listener: (event: string, data: HlsEventData) => void): void
  destroy(): void
}

/** The part of the hls.js default export (the Hls class) the hls source uses */
export interface HlsClass {
  new (config: { preferManagedMediaSource: boolean }): HlsInstance
  isSupported: () => boolean
  Events: { MANIFEST_PARSED: string; ERROR: string }
}

/** The part of a dashjs error event the dash source reads */
export interface DashErrorEvent {
  /** data.response of a download error has the HTTP status, 0 without a response */
  error: { code: number; data?: { response?: { status?: number } } | null }
}

/** The part of a dashjs MediaPlayer instance the dash source uses */
export interface DashPlayer {
  initialize(view: HTMLMediaElement, url: string, autoPlay: boolean): void
  clearDefaultUTCTimingSources(): void
  on(type: string, listener: (event: DashErrorEvent) => void): void
  reset(): void
}

/** The part of the dashjs MediaPlayer factory the dash source uses */
export type DashMediaPlayer = () => { create: () => DashPlayer }
